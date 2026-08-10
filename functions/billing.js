import admin from "firebase-admin";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";

import {
    BILLING_CONTRACT_OPEN_STATUSES,
    addBillingIntervalMs,
    addCalendarDaysToDateKey,
    applyContractDiscount,
    buildBillingSchedules,
    buildBillingPeriodKey,
    buildFifoPaymentAllocation,
    buildInitialBillingCatalog,
    calculateDailyMoratoryInterestMinor,
    calculateInitialMoratoryInterestByDailyBaseMinor,
    calculatePaymentDueDateKey,
    catalogPricingRequiresQuote,
    cleanBillingText,
    dateKeyFromMs,
    findTnaForDate,
    getPromotionEligibilityError,
    getNextBillingAtMs,
    listDateKeysInclusive,
    normalizeAmountMinor,
    normalizeBillingCode,
    normalizeCatalogBenefits,
    normalizeContractDiscount,
    normalizeCountryCode,
    normalizeCurrencyCode,
    normalizeDateKey,
    normalizePricingComponents,
    normalizePromotionCode,
    normalizeTnaMillionths,
    resolveContractFinancialTerms,
} from "./billing.helpers.js";

if (!admin.apps.length) admin.initializeApp();

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;
const Timestamp = admin.firestore.Timestamp;
const REGION = "southamerica-east1";
const TERMS_VERSION = "2026-08-05.2";
const CATALOG_COLLECTION = "billing_catalog_items";
const CONTRACTS_COLLECTION = "billing_contracts";
const ACCOUNTS_COLLECTION = "billing_accounts";
const PAYMENT_REPORTS_COLLECTION = "billing_payment_reports";
const INTEREST_RATES_COLLECTION = "billing_interest_rates";
const PROMOTIONS_COLLECTION = "billing_promotion_codes";
const COMMERCIAL_LEADS_COLLECTION = "billing_commercial_leads";
const MAX_OVERVIEW_ITEMS = 300;
const COMMERCIAL_LEAD_STATUSES = new Set([
    "new",
    "contacted",
    "demo",
    "proposal",
    "won",
    "lost",
]);

const getUserData = async (uid) => {
    if (!uid) {
        throw new HttpsError("unauthenticated", "Tenés que iniciar sesión.");
    }

    const snap = await db.collection("users").doc(uid).get();
    if (!snap.exists) {
        throw new HttpsError("permission-denied", "Perfil de usuario no encontrado.");
    }
    return snap.data() || {};
};

const userHasRole = (userData = {}, roleName = "") => {
    return (
        userData.role === roleName ||
        userData.primaryRole === roleName ||
        (Array.isArray(userData.roles) && userData.roles.includes(roleName))
    );
};

const assertRoot = async (uid) => {
    const userData = await getUserData(uid);
    if (!userHasRole(userData, "root")) {
        throw new HttpsError(
            "permission-denied",
            "Esta operación está reservada para la administración de ONO Prop.",
        );
    }
    return userData;
};

const assertCanManageInmobiliaria = async (uid, inmobiliariaId) => {
    const safeInmobiliariaId = cleanBillingText(inmobiliariaId, 128);
    if (!safeInmobiliariaId) {
        throw new HttpsError("invalid-argument", "Falta la inmobiliaria.");
    }

    const userData = await getUserData(uid);
    const isRoot = userHasRole(userData, "root");
    const isAdmin = userHasRole(userData, "admin");
    const inmobiliarias = Array.isArray(userData.inmobiliarias)
        ? userData.inmobiliarias
        : [];

    if (!isRoot && (!isAdmin || !inmobiliarias.includes(safeInmobiliariaId))) {
        throw new HttpsError(
            "permission-denied",
            "No tenés permisos para administrar esta inmobiliaria.",
        );
    }

    return { userData, isRoot, inmobiliariaId: safeInmobiliariaId };
};

const assertInmobiliariaExists = async (inmobiliariaId) => {
    const snap = await db.collection("inmobiliarias").doc(inmobiliariaId).get();
    if (!snap.exists) {
        throw new HttpsError("not-found", "No se encontró la inmobiliaria.");
    }
    return { id: snap.id, ...(snap.data() || {}) };
};

const catalogRef = (itemId) => db.collection(CATALOG_COLLECTION).doc(itemId);
const contractRef = (contractId) => db.collection(CONTRACTS_COLLECTION).doc(contractId);
const accountRef = (inmobiliariaId) => db.collection(ACCOUNTS_COLLECTION).doc(inmobiliariaId);
const entriesRef = (inmobiliariaId) => accountRef(inmobiliariaId).collection("entries");
const entitlementsRef = (inmobiliariaId) => accountRef(inmobiliariaId).collection("entitlements");
const creditUsagesRef = (inmobiliariaId) => accountRef(inmobiliariaId).collection("credit_usages");
const obligationsRef = (inmobiliariaId) => accountRef(inmobiliariaId)
    .collection("obligations");
const paymentAllocationsRef = (inmobiliariaId) => accountRef(inmobiliariaId)
    .collection("payment_allocations");
const paymentReportRef = (reportId) => db.collection(PAYMENT_REPORTS_COLLECTION).doc(reportId);
const interestRateRef = (currency, effectiveDateKey) => db
    .collection(INTEREST_RATES_COLLECTION)
    .doc(`${normalizeCurrencyCode(currency)}_${effectiveDateKey}`);
const promotionRef = (code) => db.collection(PROMOTIONS_COLLECTION)
    .doc(normalizePromotionCode(code));
const promotionAgencyUsageRef = (code, inmobiliariaId) => promotionRef(code)
    .collection("agency_usage")
    .doc(inmobiliariaId);
const commercialLeadRef = (leadId) => db
    .collection(COMMERCIAL_LEADS_COLLECTION)
    .doc(leadId);

const PROMOTION_ERROR_MESSAGES = {
    inactive: "El código de bonificación no está activo.",
    invalid_date: "No se pudo validar la fecha del código de bonificación.",
    not_started: "El código de bonificación todavía no está vigente.",
    expired: "El código de bonificación está vencido.",
    not_applicable: "El código de bonificación no corresponde a este servicio.",
    global_limit: "El código de bonificación agotó su cupo.",
    agency_limit: "La inmobiliaria ya utilizó este código de bonificación.",
};

const timestampToMillis = (value) => {
    if (!value) return 0;
    if (typeof value.toMillis === "function") return value.toMillis();
    if (typeof value === "number") return value;
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
};

const serializeValue = (value) => {
    if (value === null || value === undefined) return value;
    if (typeof value.toMillis === "function") return value.toMillis();
    if (Array.isArray(value)) return value.map(serializeValue);
    if (typeof value === "object") {
        return Object.fromEntries(
            Object.entries(value).map(([key, nested]) => [
                key,
                serializeValue(nested),
            ]),
        );
    }
    return value;
};

const serializeSnap = (snap) => ({
    id: snap.id,
    ...serializeValue(snap.data() || {}),
});

const appendContractActivity = ({ type, uid, note = "" }) => ({
    type: cleanBillingText(type, 50),
    uid: cleanBillingText(uid, 128),
    note: cleanBillingText(note, 500),
    at: Timestamp.now(),
});

const normalizeStringList = (values = [], maxItems = 30, maxLength = 300) => {
    if (!Array.isArray(values)) return [];
    return [...new Set(values
        .map((value) => cleanBillingText(value, maxLength))
        .filter(Boolean))]
        .slice(0, maxItems);
};

const normalizeRequirements = (requirements = []) => {
    if (!Array.isArray(requirements)) return [];
    return requirements.slice(0, 20).map((requirement = {}) => ({
        type: requirement.type === "catalog_item" ? "catalog_item" : "external",
        label: cleanBillingText(requirement.label, 300),
        catalogItemId:
            requirement.type === "catalog_item"
                ? cleanBillingText(requirement.catalogItemId, 128)
                : "",
    })).filter((requirement) => requirement.label);
};

const normalizeEmail = (value = "") => cleanBillingText(value, 200).toLowerCase();

const normalizePhone = (value = "") => cleanBillingText(value, 50)
    .replace(/[^+\d\s()-]/g, "");

const isValidEmail = (value = "") => (
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
);

const escapeHtml = (value = "") => value
    .toString()
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const normalizeCommercialSource = (source = {}) => ({
    path: cleanBillingText(source.path, 300),
    referrer: cleanBillingText(source.referrer, 600),
    utmSource: cleanBillingText(source.utmSource, 120),
    utmMedium: cleanBillingText(source.utmMedium, 120),
    utmCampaign: cleanBillingText(source.utmCampaign, 160),
    utmContent: cleanBillingText(source.utmContent, 160),
    utmTerm: cleanBillingText(source.utmTerm, 160),
});

const normalizeCatalogItem = (raw = {}, existingId = "") => {
    const name = cleanBillingText(raw.name, 200);
    const code = normalizeBillingCode(raw.code || name);
    const id = cleanBillingText(existingId, 128) || code;
    const pricing = normalizePricingComponents(raw.pricing);

    if (!name || !code || !id) {
        throw new HttpsError(
            "invalid-argument",
            "El producto necesita nombre y código.",
        );
    }
    if (pricing.length === 0) {
        throw new HttpsError(
            "invalid-argument",
            "Agregá al menos un componente de precio.",
        );
    }
    if (pricing.some((component) => (
        component.quoteRequired !== true && component.amountMinor === null
    ))) {
        throw new HttpsError(
            "invalid-argument",
            "Los precios fijos deben tener un importe válido.",
        );
    }
    if (new Set(pricing.map((component) => component.id)).size !== pricing.length) {
        throw new HttpsError(
            "invalid-argument",
            "Cada componente de precio debe tener un identificador único.",
        );
    }

    return {
        id,
        code,
        itemType: raw.itemType === "product" ? "product" : "service",
        name,
        description: cleanBillingText(raw.description, 3000),
        active: raw.active !== false,
        publiclyVisible: raw.publiclyVisible !== false,
        featured: raw.featured === true,
        displayOrder: Math.trunc(Number(raw.displayOrder || 0)),
        allowQuantity: raw.allowQuantity === true,
        unitLabel: cleanBillingText(raw.unitLabel, 80) || "unidad",
        requirements: normalizeRequirements(raw.requirements),
        inclusions: normalizeStringList(raw.inclusions, 30, 500),
        moduleGrants: normalizeStringList(raw.moduleGrants, 30, 80)
            .map(normalizeBillingCode)
            .filter(Boolean),
        pricing,
        benefits: normalizeCatalogBenefits(raw.benefits),
    };
};

const getCatalogItems = async ({ activeOnly = false } = {}) => {
    const snap = await db.collection(CATALOG_COLLECTION).limit(200).get();
    return snap.docs
        .map(serializeSnap)
        .filter((item) => (activeOnly ? item.active !== false : true))
        .sort((a, b) => (
            Number(a.displayOrder || 0) - Number(b.displayOrder || 0) ||
            a.name.localeCompare(b.name, "es")
        ));
};

const getPublicCatalogItems = async () => (await getCatalogItems({activeOnly: true}))
    .filter((item) => item.publiclyVisible !== false)
    .map((item) => ({
        id: item.id,
        code: item.code || item.id,
        itemType: item.itemType === "product" ? "product" : "service",
        name: item.name || "Producto o servicio",
        description: item.description || "",
        featured: item.featured === true,
        displayOrder: Number(item.displayOrder || 0),
        allowQuantity: item.allowQuantity === true,
        unitLabel: item.unitLabel || "unidad",
        requirements: Array.isArray(item.requirements) ? item.requirements : [],
        inclusions: Array.isArray(item.inclusions) ? item.inclusions : [],
        moduleGrants: Array.isArray(item.moduleGrants) ? item.moduleGrants : [],
        pricing: Array.isArray(item.pricing) ? item.pricing : [],
    }));

const enqueueCommercialLeadNotification = async (lead) => {
    const interests = (lead.interestNames || []).join(" · ") || "Demostración general";
    const subjectName = lead.agencyName || lead.contactName;
    const text = [
        `Nueva oportunidad comercial: ${subjectName}`,
        `Contacto: ${lead.contactName}`,
        `Email: ${lead.email || "No informado"}`,
        `Teléfono: ${lead.phone || "No informado"}`,
        `Ciudad: ${lead.city || "No informada"}`,
        `Interés: ${interests}`,
        `Mensaje: ${lead.message || "Sin mensaje"}`,
    ].join("\n");
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto">
        <h2 style="color:#1769e0">Nueva oportunidad comercial</h2>
        <p><strong>Inmobiliaria:</strong> ${escapeHtml(lead.agencyName)}</p>
        <p><strong>Contacto:</strong> ${escapeHtml(lead.contactName)}</p>
        <p><strong>Email:</strong> ${escapeHtml(lead.email || "No informado")}</p>
        <p><strong>Teléfono:</strong> ${escapeHtml(lead.phone || "No informado")}</p>
        <p><strong>Ciudad:</strong> ${escapeHtml(lead.city || "No informada")}</p>
        <p><strong>Interés:</strong> ${escapeHtml(interests)}</p>
        <p><strong>Código promocional:</strong> ${escapeHtml(
        lead.promotionCode || "No informado",
    )}</p>
        <hr>
        <p>${escapeHtml(lead.message || "Sin mensaje adicional")}</p>
      </div>`;

    return db.collection("mail").add({
        to: ["contacto@onoprop.com"],
        ...(lead.email ? {replyTo: lead.email} : {}),
        message: {
            subject: `Nueva oportunidad: ${subjectName}`,
            text,
            html,
        },
        createdAt: FieldValue.serverTimestamp(),
    });
};

const getContract = async (contractId) => {
    const snap = await contractRef(contractId).get();
    if (!snap.exists) {
        throw new HttpsError("not-found", "No se encontró la contratación.");
    }
    return { id: snap.id, ...(snap.data() || {}) };
};

const getAccountBalance = (account = {}, currency = "ARS") => {
    const balances = account.balanceByCurrency || {};
    const value = Number(balances[currency] || 0);
    return Number.isSafeInteger(value) ? value : 0;
};

const postLedgerEntry = async ({
    inmobiliariaId,
    entryId = "",
    type,
    direction,
    amountMinor,
    currency,
    description,
    contractId = "",
    catalogItemId = "",
    obligationId = "",
    paymentReportId = "",
    createdBy = "system",
    metadata = {},
}) => {
    const safeAmount = normalizeAmountMinor(amountMinor);
    const safeCurrency = normalizeCurrencyCode(currency);
    const safeDirection = direction === "credit" ? "credit" : "debit";
    if (safeAmount === null || safeAmount <= 0) {
        throw new HttpsError("invalid-argument", "El importe debe ser mayor a cero.");
    }

    const ref = entryId
        ? entriesRef(inmobiliariaId).doc(entryId)
        : entriesRef(inmobiliariaId).doc();
    let result = null;

    await db.runTransaction(async (transaction) => {
        const existing = await transaction.get(ref);
        if (existing.exists) {
            result = { id: existing.id, ...(existing.data() || {}), existing: true };
            return;
        }

        const accRef = accountRef(inmobiliariaId);
        const accountSnap = await transaction.get(accRef);
        const account = accountSnap.data() || {};
        const currentBalance = getAccountBalance(account, safeCurrency);
        const delta = safeDirection === "debit" ? safeAmount : -safeAmount;
        const nextBalance = currentBalance + delta;
        const now = Timestamp.now();
        const entry = {
            type: cleanBillingText(type, 50),
            direction: safeDirection,
            amountMinor: safeAmount,
            currency: safeCurrency,
            description: cleanBillingText(description, 500),
            contractId: cleanBillingText(contractId, 128),
            catalogItemId: cleanBillingText(catalogItemId, 128),
            obligationId: cleanBillingText(obligationId, 180),
            paymentReportId: cleanBillingText(paymentReportId, 128),
            createdBy: cleanBillingText(createdBy, 128),
            metadata: serializeValue(metadata),
            balanceAfterMinor: nextBalance,
            createdAt: now,
        };

        transaction.set(ref, entry);
        transaction.set(accRef, {
            inmobiliariaId,
            balanceByCurrency: {
                ...(account.balanceByCurrency || {}),
                [safeCurrency]: nextBalance,
            },
            status: "open",
            lastEntryAt: now,
            createdAt: account.createdAt || now,
            updatedAt: now,
        }, { merge: true });
        result = { id: ref.id, ...entry, existing: false };
    });

    return result;
};

const timestampFromDateKey = (dateKey) => {
    const normalized = normalizeDateKey(dateKey);
    return normalized
        ? Timestamp.fromDate(new Date(`${normalized}T12:00:00.000Z`))
        : null;
};

const getInterestRates = async () => {
    const snap = await db.collection(INTEREST_RATES_COLLECTION).limit(1000).get();
    return snap.docs.map(serializeSnap).sort(
        (a, b) => a.effectiveDateKey.localeCompare(b.effectiveDateKey),
    );
};

const createContractObligation = async ({
    contract,
    component,
    periodStartAtMs,
    periodEndAtMs = 0,
    createdBy,
}) => {
    const periodStartDateKey = dateKeyFromMs(periodStartAtMs);
    const recurrence = component.recurrence || "once";
    const periodKey = recurrence === "once"
        ? "initial"
        : buildBillingPeriodKey(periodStartAtMs, recurrence);
    const obligationId = `contract_${contract.id}_${component.id}_${periodKey}`;
    const ref = obligationsRef(contract.inmobiliariaId).doc(obligationId);
    const entryRef = entriesRef(contract.inmobiliariaId).doc(`charge_${obligationId}`);
    const grossAmountMinor = Number(component.amountMinor || 0) *
        Math.max(1, Number(contract.quantity || 1));
    const discount = applyContractDiscount({
        grossAmountMinor,
        currency: component.currency,
        obligationDateKey: periodStartDateKey,
        discount: contract.discount,
    });
    const paymentTermDays = Math.max(
        1,
        Math.min(365, Math.trunc(Number(contract.paymentTermDays || 15))),
    );
    const dueDateKey = calculatePaymentDueDateKey(
        periodStartDateKey,
        paymentTermDays,
    );
    const nextPeriodAtMs = recurrence === "once"
        ? 0
        : addBillingIntervalMs(periodStartAtMs, recurrence);
    const periodEndDateKey = periodEndAtMs
        ? dateKeyFromMs(periodEndAtMs)
        : recurrence === "once"
            ? normalizeDateKey(contract.serviceEndDateKey) || periodStartDateKey
            : addCalendarDaysToDateKey(dateKeyFromMs(nextPeriodAtMs), -1);
    let result = null;

    await db.runTransaction(async (transaction) => {
        const obligationSnap = await transaction.get(ref);
        if (obligationSnap.exists) {
            result = { id: obligationSnap.id, ...(obligationSnap.data() || {}), existing: true };
            return;
        }
        const accRef = accountRef(contract.inmobiliariaId);
        const accountSnap = discount.netAmountMinor > 0
            ? await transaction.get(accRef)
            : null;
        const entrySnap = discount.netAmountMinor > 0
            ? await transaction.get(entryRef)
            : null;
        const account = accountSnap?.data() || {};
        const currentBalance = getAccountBalance(account, component.currency);
        const openingCreditAppliedMinor = Math.min(
            discount.netAmountMinor,
            Math.max(0, -currentBalance),
        );
        const principalOutstandingMinor = discount.netAmountMinor -
            openingCreditAppliedMinor;
        const now = Timestamp.now();
        const obligation = {
            inmobiliariaId: contract.inmobiliariaId,
            contractId: contract.id,
            financialAmendmentId: contract.appliedFinancialAmendmentId || "",
            catalogItemId: contract.catalogItemId,
            catalogName: contract.catalogName,
            componentId: component.id,
            componentLabel: component.label,
            recurrence,
            currency: component.currency,
            quantity: Math.max(1, Number(contract.quantity || 1)),
            unitAmountMinor: Number(component.amountMinor || 0),
            ...discount,
            principalOriginalMinor: discount.netAmountMinor,
            principalOutstandingMinor,
            interestAccruedMinor: 0,
            interestOutstandingMinor: 0,
            paidPrincipalMinor: openingCreditAppliedMinor,
            paidInterestMinor: 0,
            openingCreditAppliedMinor,
            principalPaymentEvents: openingCreditAppliedMinor > 0 ? [{
                paymentReportId: "account-credit",
                dateKey: periodStartDateKey,
                amountMinor: openingCreditAppliedMinor,
            }] : [],
            periodStartDateKey,
            periodEndDateKey,
            periodStartAt: Timestamp.fromMillis(periodStartAtMs),
            periodEndAt: timestampFromDateKey(periodEndDateKey),
            obligationDateKey: periodStartDateKey,
            obligationAt: Timestamp.fromMillis(periodStartAtMs),
            dueDateKey,
            dueAt: timestampFromDateKey(dueDateKey),
            paymentTermDays,
            status: principalOutstandingMinor > 0 ? "open" : "paid",
            interestPolicy: {
                source: "general_tna",
                annualDivisorDays: 365,
                firstCapitalization: "day_after_due_from_period_start",
                subsequentCapitalization: "daily",
            },
            lastInterestAccrualDateKey: "",
            interestCapitalizations: 0,
            createdBy: cleanBillingText(createdBy, 128),
            createdAt: now,
            updatedAt: now,
        };
        transaction.set(ref, obligation);

        if (discount.netAmountMinor > 0 && !entrySnap.exists) {
            const nextBalance = currentBalance + discount.netAmountMinor;
            transaction.set(entryRef, {
                type: recurrence === "once" ? "contract_charge" : "recurring_charge",
                direction: "debit",
                amountMinor: discount.netAmountMinor,
                currency: component.currency,
                description: `${contract.catalogName}: ${component.label}`,
                contractId: contract.id,
                catalogItemId: contract.catalogItemId,
                obligationId,
                paymentReportId: "",
                createdBy: cleanBillingText(createdBy, 128),
                metadata: {
                    componentId: component.id,
                    recurrence,
                    quantity: contract.quantity || 1,
                    unitAmountMinor: component.amountMinor,
                    periodKey,
                    periodStartDateKey,
                    periodEndDateKey,
                    dueDateKey,
                    discount,
                    financialAmendmentId: contract.appliedFinancialAmendmentId || "",
                    openingCreditAppliedMinor,
                },
                balanceAfterMinor: nextBalance,
                createdAt: now,
            });
            transaction.set(accRef, {
                inmobiliariaId: contract.inmobiliariaId,
                balanceByCurrency: {
                    ...(account.balanceByCurrency || {}),
                    [component.currency]: nextBalance,
                },
                status: "open",
                lastEntryAt: now,
                createdAt: account.createdAt || now,
                updatedAt: now,
            }, { merge: true });
        }
        result = { id: ref.id, ...obligation, existing: false };
    });

    return result;
};

const getPricingForCountry = (pricing = [], countryCode = "AR") => {
    const country = normalizeCountryCode(countryCode);
    const selected = normalizePricingComponents(pricing)
        .filter((component) => component.countryCode === country);
    return selected.length ? selected : normalizePricingComponents(pricing);
};

const grantEntitlement = async ({
    inmobiliariaId,
    contract,
    benefit,
    grantKey,
    expiresAtMs = 0,
}) => {
    if (benefit.type !== "highlight_credits" || benefit.quantity <= 0) return;

    const quantity = benefit.grantMode === "per_quantity"
        ? benefit.quantity * Math.max(1, Number(contract.quantity || 1))
        : benefit.quantity;
    const entitlementId = `${contract.id}_${benefit.id}`;
    const ref = entitlementsRef(inmobiliariaId).doc(entitlementId);

    await db.runTransaction(async (transaction) => {
        const snap = await transaction.get(ref);
        const current = snap.data() || {};
        if (current.lastGrantKey === grantKey) return;

        const rollover = benefit.rollover === true;
        const previousRemaining = Math.max(0, Number(current.remaining || 0));
        const nextRemaining = rollover ? previousRemaining + quantity : quantity;
        const now = Timestamp.now();

        transaction.set(ref, {
            inmobiliariaId,
            contractId: contract.id,
            catalogItemId: contract.catalogItemId,
            benefitId: benefit.id,
            type: benefit.type,
            label: benefit.label || "Créditos para avisos destacados",
            grantMode: benefit.grantMode,
            recurrence: benefit.recurrence,
            rollover,
            granted: quantity,
            remaining: nextRemaining,
            active: true,
            lastGrantKey: grantKey,
            expiresAt: expiresAtMs ? Timestamp.fromMillis(expiresAtMs) : null,
            createdAt: current.createdAt || now,
            updatedAt: now,
        }, { merge: true });
    });
};

const grantInitialBenefits = async (contract) => {
    const benefits = normalizeCatalogBenefits(contract.benefits);
    const startAtMs = timestampToMillis(contract.serviceStartAt) || Date.now();

    for (const benefit of benefits) {
        const schedule = (contract.recurringSchedules || []).find(
            (item) => item.recurrence === benefit.recurrence,
        );
        await grantEntitlement({
            inmobiliariaId: contract.inmobiliariaId,
            contract,
            benefit,
            grantKey: benefit.grantMode === "recurring"
                ? `initial-${buildBillingPeriodKey(startAtMs, benefit.recurrence)}`
                : "initial",
            expiresAtMs: benefit.grantMode === "recurring"
                ? Number(schedule?.nextBillingAtMs || 0)
                : 0,
        });
    }
};

const grantRecurringBenefits = async ({
    contract,
    recurrence,
    periodStartMs,
    nextPeriodMs,
}) => {
    const benefits = normalizeCatalogBenefits(contract.benefits)
        .filter((benefit) => (
            benefit.grantMode === "recurring" &&
            benefit.recurrence === recurrence
        ));

    for (const benefit of benefits) {
        await grantEntitlement({
            inmobiliariaId: contract.inmobiliariaId,
            contract,
            benefit,
            grantKey: buildBillingPeriodKey(periodStartMs, recurrence),
            expiresAtMs: nextPeriodMs,
        });
    }
};

const syncBillingModules = async (inmobiliariaId) => {
    const contractsSnap = await db.collection(CONTRACTS_COLLECTION)
        .where("inmobiliariaId", "==", inmobiliariaId)
        .where("status", "==", "active")
        .get();
    const activeGrants = new Set();
    contractsSnap.docs.forEach((snap) => {
        normalizeStringList(snap.data()?.moduleGrants, 30, 80)
            .forEach((moduleId) => activeGrants.add(moduleId));
    });

    const ref = db.collection("inmobiliarias").doc(inmobiliariaId);
    await db.runTransaction(async (transaction) => {
        const snap = await transaction.get(ref);
        if (!snap.exists) return;
        const data = snap.data() || {};
        const existingModules = new Set(
            Array.isArray(data.modulosSuscriptos) ? data.modulosSuscriptos : [],
        );
        const previousManaged = Array.isArray(data.billingModuleGrants)
            ? data.billingModuleGrants
            : [];
        previousManaged.forEach((moduleId) => existingModules.delete(moduleId));
        activeGrants.forEach((moduleId) => existingModules.add(moduleId));

        transaction.update(ref, {
            modulosSuscriptos: [...existingModules].sort(),
            billingModuleGrants: [...activeGrants].sort(),
            updatedAt: Timestamp.now(),
        });
    });
};

const getAgencyOverviewData = async (inmobiliariaId) => {
    const [
        inmobiliaria,
        catalog,
        contractsSnap,
        accountSnap,
        entriesSnap,
        obligationsSnap,
        reportsSnap,
        entitlementsSnap,
        usagesSnap,
        inmueblesSnap,
        interestRates,
    ] = await Promise.all([
        assertInmobiliariaExists(inmobiliariaId),
        getCatalogItems({ activeOnly: true }),
        db.collection(CONTRACTS_COLLECTION)
            .where("inmobiliariaId", "==", inmobiliariaId)
            .limit(MAX_OVERVIEW_ITEMS)
            .get(),
        accountRef(inmobiliariaId).get(),
        entriesRef(inmobiliariaId).limit(MAX_OVERVIEW_ITEMS).get(),
        obligationsRef(inmobiliariaId).limit(MAX_OVERVIEW_ITEMS).get(),
        db.collection(PAYMENT_REPORTS_COLLECTION)
            .where("inmobiliariaId", "==", inmobiliariaId)
            .limit(MAX_OVERVIEW_ITEMS)
            .get(),
        entitlementsRef(inmobiliariaId).limit(MAX_OVERVIEW_ITEMS).get(),
        creditUsagesRef(inmobiliariaId).limit(100).get(),
        db.collection("inmobiliarias").doc(inmobiliariaId)
            .collection("inmuebles").limit(500).get(),
        getInterestRates(),
    ]);

    const sortDesc = (items, field = "createdAt") => items.sort(
        (a, b) => Number(b[field] || 0) - Number(a[field] || 0),
    );
    const entitlements = entitlementsSnap.docs.map(serializeSnap);
    const nowMs = Date.now();
    const highlightCreditsAvailable = entitlements
        .filter((item) => (
            item.type === "highlight_credits" &&
            item.active !== false &&
            (!timestampToMillis(item.expiresAt) ||
                timestampToMillis(item.expiresAt) > nowMs)
        ))
        .reduce((total, item) => total + Math.max(0, Number(item.remaining || 0)), 0);

    return {
        inmobiliaria: {
            id: inmobiliaria.id,
            nombre: inmobiliaria.nombre || inmobiliaria.razonSocial || inmobiliaria.id,
            razonSocial: inmobiliaria.razonSocial || "",
            cuit: inmobiliaria.cuit || "",
        },
        catalog,
        contracts: sortDesc(contractsSnap.docs.map(serializeSnap), "updatedAt"),
        account: accountSnap.exists ? serializeSnap(accountSnap) : {
            id: inmobiliariaId,
            inmobiliariaId,
            balanceByCurrency: {},
            status: "open",
        },
        entries: sortDesc(entriesSnap.docs.map(serializeSnap)),
        obligations: obligationsSnap.docs.map(serializeSnap).sort((a, b) => (
            (a.dueDateKey || "").localeCompare(b.dueDateKey || "") ||
            (a.createdAt || 0) - (b.createdAt || 0)
        )),
        paymentReports: sortDesc(reportsSnap.docs.map(serializeSnap), "updatedAt"),
        entitlements: sortDesc(entitlements, "updatedAt"),
        creditUsages: sortDesc(usagesSnap.docs.map(serializeSnap)),
        highlightCreditsAvailable,
        interestRates: interestRates.sort((a, b) => (
            b.effectiveDateKey.localeCompare(a.effectiveDateKey)
        )).slice(0, 60),
        inmuebles: inmueblesSnap.docs
            .map(serializeSnap)
            .filter((item) => item.deleted !== true)
            .map((item) => ({
                id: item.id,
                titulo: item.titulo || "Inmueble sin título",
                estado: item.estado || "",
                publicarEnPortal: item.publicarEnPortal === true,
                destacado: item.destacado === true,
                promotion: item.promotion || null,
            }))
            .sort((a, b) => a.titulo.localeCompare(b.titulo, "es")),
    };
};

export const billingGetPublicCatalog = onCall(
    { region: REGION, invoker: "public" },
    async () => ({ catalog: await getPublicCatalogItems() }),
);

export const billingCreateCommercialLead = onCall(
    { region: REGION, invoker: "public" },
    async (request) => {
        const input = request.data || {};
        if (cleanBillingText(input.website, 200)) {
            return { received: true };
        }
        if (input.consentAccepted !== true) {
            throw new HttpsError(
                "failed-precondition",
                "Debés aceptar el contacto comercial y la política de privacidad.",
            );
        }

        const startedAtMs = Number(input.startedAtMs || 0);
        if (!Number.isFinite(startedAtMs) || Date.now() - startedAtMs < 1500) {
            throw new HttpsError(
                "failed-precondition",
                "Esperá un momento y volvé a enviar la solicitud.",
            );
        }

        const contactName = cleanBillingText(input.contactName, 160);
        const agencyName = cleanBillingText(input.agencyName, 200);
        const email = normalizeEmail(input.email);
        const phone = normalizePhone(input.phone);
        if (!contactName || !agencyName || (!email && !phone)) {
            throw new HttpsError(
                "invalid-argument",
                "Ingresá la inmobiliaria, una persona de contacto y email o teléfono.",
            );
        }
        if (email && !isValidEmail(email)) {
            throw new HttpsError("invalid-argument", "El email no es válido.");
        }
        if (phone && phone.replace(/\D/g, "").length < 8) {
            throw new HttpsError("invalid-argument", "El teléfono no es válido.");
        }

        const catalog = await getPublicCatalogItems();
        const catalogById = new Map(catalog.map((item) => [item.id, item]));
        const interestIds = normalizeStringList(input.interestIds, 12, 128)
            .filter((itemId) => catalogById.has(itemId));
        const primaryCatalogItemId = cleanBillingText(
            input.primaryCatalogItemId,
            128,
        );
        if (primaryCatalogItemId && !catalogById.has(primaryCatalogItemId)) {
            throw new HttpsError(
                "invalid-argument",
                "El servicio seleccionado ya no está disponible.",
            );
        }
        if (primaryCatalogItemId && !interestIds.includes(primaryCatalogItemId)) {
            interestIds.unshift(primaryCatalogItemId);
        }

        const now = Timestamp.now();
        const ref = db.collection(COMMERCIAL_LEADS_COLLECTION).doc();
        const lead = {
            contactName,
            agencyName,
            email,
            phone,
            city: cleanBillingText(input.city, 160),
            countryCode: normalizeCountryCode(input.countryCode || "AR"),
            propertyVolume: cleanBillingText(input.propertyVolume, 50),
            preferredContact: ["email", "phone", "whatsapp"].includes(
                input.preferredContact,
            ) ? input.preferredContact : "whatsapp",
            interestIds,
            interestNames: interestIds.map((itemId) => catalogById.get(itemId)?.name)
                .filter(Boolean),
            primaryCatalogItemId,
            promotionCode: normalizePromotionCode(input.promotionCode),
            message: cleanBillingText(input.message, 2500),
            source: normalizeCommercialSource(input.source),
            status: "new",
            nextActionDateKey: "",
            lastNote: "",
            linkedInmobiliariaId: "",
            linkedInmobiliariaName: "",
            createdByUid: cleanBillingText(request.auth?.uid, 128),
            consentAccepted: true,
            consentVersion: TERMS_VERSION,
            activity: [{
                type: "created",
                status: "new",
                uid: cleanBillingText(request.auth?.uid, 128) || "public",
                note: "Solicitud comercial recibida desde el portal.",
                at: now,
            }],
            createdAt: now,
            updatedAt: now,
        };
        await ref.set(lead);

        try {
            const mailRef = await enqueueCommercialLeadNotification(lead);
            await ref.update({
                notificationSent: true,
                notificationMailId: mailRef.id,
            });
        } catch (notificationError) {
            console.error("No se pudo notificar la oportunidad comercial", {
                leadId: ref.id,
                error: notificationError.message,
            });
            await ref.update({ notificationSent: false });
        }

        return { received: true, leadId: ref.id };
    },
);

export const billingUpdateCommercialLead = onCall(
    { region: REGION, invoker: "public" },
    async (request) => {
        const uid = request.auth?.uid;
        await assertRoot(uid);
        const leadId = cleanBillingText(request.data?.leadId, 128);
        const status = cleanBillingText(request.data?.status, 50);
        if (!leadId || !COMMERCIAL_LEAD_STATUSES.has(status)) {
            throw new HttpsError(
                "invalid-argument",
                "La oportunidad o el estado no son válidos.",
            );
        }

        const ref = commercialLeadRef(leadId);
        const snap = await ref.get();
        if (!snap.exists) {
            throw new HttpsError("not-found", "No se encontró la oportunidad.");
        }

        const linkedInmobiliariaId = cleanBillingText(
            request.data?.linkedInmobiliariaId,
            128,
        );
        let linkedInmobiliariaName = "";
        if (linkedInmobiliariaId) {
            const inmobiliaria = await assertInmobiliariaExists(linkedInmobiliariaId);
            linkedInmobiliariaName = inmobiliaria.nombre ||
                inmobiliaria.razonSocial || linkedInmobiliariaId;
        }

        const previous = snap.data() || {};
        const note = cleanBillingText(request.data?.note, 1000);
        const nextActionDateKey = request.data?.nextActionDateKey
            ? normalizeDateKey(request.data.nextActionDateKey)
            : "";
        if (request.data?.nextActionDateKey && !nextActionDateKey) {
            throw new HttpsError(
                "invalid-argument",
                "La fecha de próxima acción no es válida.",
            );
        }
        const now = Timestamp.now();
        const activity = Array.isArray(previous.activity)
            ? previous.activity.slice(-99)
            : [];
        activity.push({
            type: "status_updated",
            status,
            uid,
            note,
            at: now,
        });

        const update = {
            status,
            nextActionDateKey,
            lastNote: note,
            linkedInmobiliariaId,
            linkedInmobiliariaName,
            activity,
            updatedAt: now,
            updatedBy: uid,
            ...(status === "won" ? { wonAt: previous.wonAt || now } : {}),
        };
        await ref.update(update);
        return { lead: serializeValue({ id: ref.id, ...previous, ...update }) };
    },
);

export const billingGetAgencyOverview = onCall(
    { region: REGION, invoker: "public", timeoutSeconds: 120 },
    async (request) => {
        const uid = request.auth?.uid;
        const inmobiliariaId = cleanBillingText(request.data?.inmobiliariaId, 128);
        await assertCanManageInmobiliaria(uid, inmobiliariaId);
        return getAgencyOverviewData(inmobiliariaId);
    },
);

export const billingGetAdminOverview = onCall(
    { region: REGION, invoker: "public", timeoutSeconds: 120 },
    async (request) => {
        await assertRoot(request.auth?.uid);
        const [
            catalog,
            contractsSnap,
            reportsSnap,
            accountsSnap,
            inmoSnap,
            interestRates,
            promotionsSnap,
            commercialLeadsSnap,
        ] =
            await Promise.all([
                getCatalogItems(),
                db.collection(CONTRACTS_COLLECTION).limit(500).get(),
                db.collection(PAYMENT_REPORTS_COLLECTION).limit(500).get(),
                db.collection(ACCOUNTS_COLLECTION).limit(500).get(),
                db.collection("inmobiliarias").limit(500).get(),
                getInterestRates(),
                db.collection(PROMOTIONS_COLLECTION).limit(500).get(),
                db.collection(COMMERCIAL_LEADS_COLLECTION).limit(500).get(),
            ]);
        const agencies = inmoSnap.docs.map((snap) => ({
            id: snap.id,
            nombre: snap.data()?.nombre || snap.data()?.razonSocial || snap.id,
            razonSocial: snap.data()?.razonSocial || "",
            cuit: snap.data()?.cuit || "",
        })).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
        const sortUpdated = (items) => items.sort(
            (a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0),
        );

        return {
            catalog,
            agencies,
            contracts: sortUpdated(contractsSnap.docs.map(serializeSnap)),
            paymentReports: sortUpdated(reportsSnap.docs.map(serializeSnap)),
            accounts: accountsSnap.docs.map(serializeSnap),
            interestRates: interestRates.sort((a, b) => (
                b.effectiveDateKey.localeCompare(a.effectiveDateKey)
            )),
            promotions: promotionsSnap.docs.map(serializeSnap).sort((a, b) => (
                a.code.localeCompare(b.code, "es")
            )),
            commercialLeads: sortUpdated(
                commercialLeadsSnap.docs.map(serializeSnap),
            ),
        };
    },
);

export const billingUpsertInterestRate = onCall(
    { region: REGION, invoker: "public" },
    async (request) => {
        const uid = request.auth?.uid;
        await assertRoot(uid);
        const effectiveDateKey = normalizeDateKey(request.data?.effectiveDateKey);
        const currency = normalizeCurrencyCode(request.data?.currency || "ARS");
        const tnaMillionths = normalizeTnaMillionths(request.data?.tnaMillionths);
        if (!effectiveDateKey || tnaMillionths === null) {
            throw new HttpsError(
                "invalid-argument",
                "Ingresá una fecha de vigencia y una TNA válidas.",
            );
        }
        const ref = interestRateRef(currency, effectiveDateKey);
        const existing = await ref.get();
        const now = Timestamp.now();
        const existingData = existing.data() || {};
        const revisionLog = Array.isArray(existingData.revisionLog)
            ? [...existingData.revisionLog]
            : [];
        revisionLog.push({
            tnaMillionths,
            note: cleanBillingText(request.data?.note, 500),
            uid,
            at: now,
        });
        await ref.set({
            effectiveDateKey,
            effectiveAt: timestampFromDateKey(effectiveDateKey),
            currency,
            tnaMillionths,
            source: "manual",
            note: cleanBillingText(request.data?.note, 1000),
            revisionLog: revisionLog.slice(-100),
            createdAt: existingData.createdAt || now,
            createdBy: existingData.createdBy || uid,
            updatedAt: now,
            updatedBy: uid,
        }, { merge: false });
        return {
            rate: serializeValue({
                id: ref.id,
                effectiveDateKey,
                currency,
                tnaMillionths,
                updatedAt: now,
            }),
        };
    },
);

export const billingUpsertPromotion = onCall(
    { region: REGION, invoker: "public" },
    async (request) => {
        const uid = request.auth?.uid;
        await assertRoot(uid);
        const input = request.data?.promotion || {};
        const code = normalizePromotionCode(input.code);
        const existingCode = normalizePromotionCode(request.data?.promotionId);
        const percentageBasisPoints = Number(input.percentageBasisPoints || 0);
        const fixedAmountMinor = normalizeAmountMinor(input.fixedAmountMinor || 0);
        const validFrom = input.validFrom ? normalizeDateKey(input.validFrom) : "";
        const validUntil = input.validUntil ? normalizeDateKey(input.validUntil) : "";
        const maxRedemptions = Math.trunc(Number(input.maxRedemptions || 0));
        const maxRedemptionsPerAgency = Math.trunc(Number(
            input.maxRedemptionsPerAgency ?? 1,
        ));
        const catalogItemIds = [...new Set((Array.isArray(input.catalogItemIds)
            ? input.catalogItemIds
            : [])
            .map((itemId) => cleanBillingText(itemId, 128))
            .filter(Boolean))].slice(0, 100);

        if (!code || (existingCode && existingCode !== code)) {
            throw new HttpsError(
                "invalid-argument",
                existingCode
                    ? "El código no puede cambiarse; creá otra promoción."
                    : "Ingresá un código de bonificación válido.",
            );
        }
        if (
            !Number.isSafeInteger(percentageBasisPoints) ||
            percentageBasisPoints < 0 ||
            percentageBasisPoints > 10000 ||
            fixedAmountMinor === null ||
            (percentageBasisPoints <= 0 && fixedAmountMinor <= 0) ||
            (input.validFrom && !validFrom) ||
            (input.validUntil && !validUntil) ||
            (validFrom && validUntil && validUntil < validFrom) ||
            !Number.isSafeInteger(maxRedemptions) ||
            maxRedemptions < 0 ||
            maxRedemptions > 1000000 ||
            !Number.isSafeInteger(maxRedemptionsPerAgency) ||
            maxRedemptionsPerAgency < 0 ||
            maxRedemptionsPerAgency > 10000
        ) {
            throw new HttpsError(
                "invalid-argument",
                "Revisá la bonificación, su vigencia y los límites de uso.",
            );
        }

        const ref = promotionRef(code);
        const existing = await ref.get();
        const previous = existing.data() || {};
        const now = Timestamp.now();
        const promotion = {
            code,
            description: cleanBillingText(input.description, 500),
            active: input.active !== false,
            percentageBasisPoints,
            fixedAmountMinor,
            fixedCurrency: normalizeCurrencyCode(input.fixedCurrency || "ARS"),
            validFrom,
            validUntil,
            catalogItemIds,
            maxRedemptions,
            maxRedemptionsPerAgency,
            reservedCount: Math.max(0, Number(previous.reservedCount || 0)),
            redeemedCount: Math.max(0, Number(previous.redeemedCount || 0)),
            createdAt: previous.createdAt || now,
            createdBy: previous.createdBy || uid,
            updatedAt: now,
            updatedBy: uid,
        };
        await ref.set(promotion, { merge: false });
        return { promotion: serializeValue({ id: ref.id, ...promotion }) };
    },
);

export const billingUpsertCatalogItem = onCall(
    { region: REGION, invoker: "public" },
    async (request) => {
        const uid = request.auth?.uid;
        await assertRoot(uid);
        const existingId = cleanBillingText(request.data?.itemId, 128);
        const item = normalizeCatalogItem(request.data?.item || {}, existingId);
        const ref = catalogRef(item.id);
        const existing = await ref.get();
        const duplicate = await db.collection(CATALOG_COLLECTION)
            .where("code", "==", item.code).limit(2).get();
        if (duplicate.docs.some((snap) => snap.id !== item.id)) {
            throw new HttpsError("already-exists", "Ya existe un ítem con ese código.");
        }

        const now = Timestamp.now();
        await ref.set({
            ...item,
            createdAt: existing.data()?.createdAt || now,
            createdBy: existing.data()?.createdBy || uid,
            updatedAt: now,
            updatedBy: uid,
        }, { merge: false });
        return { item: serializeValue({ ...item, updatedAt: now }) };
    },
);

export const billingSeedInitialCatalog = onCall(
    { region: REGION, invoker: "public" },
    async (request) => {
        const uid = request.auth?.uid;
        await assertRoot(uid);
        const items = buildInitialBillingCatalog();
        const batch = db.batch();
        let created = 0;

        for (const rawItem of items) {
            const item = normalizeCatalogItem(rawItem, rawItem.id);
            const ref = catalogRef(item.id);
            const snap = await ref.get();
            if (snap.exists) continue;
            const now = Timestamp.now();
            batch.set(ref, {
                ...item,
                createdAt: now,
                createdBy: uid,
                updatedAt: now,
                updatedBy: uid,
            });
            created += 1;
        }

        if (created > 0) await batch.commit();
        return { created, total: items.length };
    },
);

export const billingRequestContract = onCall(
    { region: REGION, invoker: "public" },
    async (request) => {
        const uid = request.auth?.uid;
        const inmobiliariaId = cleanBillingText(request.data?.inmobiliariaId, 128);
        await assertCanManageInmobiliaria(uid, inmobiliariaId);
        const inmobiliaria = await assertInmobiliariaExists(inmobiliariaId);

        if (request.data?.termsAccepted !== true) {
            throw new HttpsError(
                "failed-precondition",
                "Debés aceptar las condiciones de contratación.",
            );
        }

        const catalogItemId = cleanBillingText(request.data?.catalogItemId, 128);
        const itemSnap = await catalogRef(catalogItemId).get();
        if (!itemSnap.exists || itemSnap.data()?.active === false) {
            throw new HttpsError("not-found", "El producto no está disponible.");
        }

        const item = { id: itemSnap.id, ...(itemSnap.data() || {}) };
        const requirements = normalizeRequirements(item.requirements);
        for (const requirement of requirements) {
            if (requirement.type !== "catalog_item" || !requirement.catalogItemId) {
                continue;
            }
            const requiredContracts = await db.collection(CONTRACTS_COLLECTION)
                .where("inmobiliariaId", "==", inmobiliariaId)
                .where("catalogItemId", "==", requirement.catalogItemId)
                .get();
            const requirementMet = requiredContracts.docs.some(
                (snap) => snap.data()?.status === "active",
            );
            if (!requirementMet) {
                throw new HttpsError(
                    "failed-precondition",
                    `Requisito pendiente: ${requirement.label}.`,
                );
            }
        }
        const countryCode = normalizeCountryCode(request.data?.countryCode || "AR");
        const pricing = getPricingForCountry(item.pricing, countryCode);
        const quantity = item.allowQuantity === true
            ? Math.max(1, Math.min(1000, Math.trunc(Number(request.data?.quantity || 1))))
            : 1;

        if (!item.allowQuantity) {
            const existingSnap = await db.collection(CONTRACTS_COLLECTION)
                .where("inmobiliariaId", "==", inmobiliariaId)
                .where("catalogItemId", "==", catalogItemId)
                .get();
            const hasOpenContract = existingSnap.docs.some((snap) => (
                BILLING_CONTRACT_OPEN_STATUSES.has(snap.data()?.status)
            ));
            if (hasOpenContract) {
                throw new HttpsError(
                    "already-exists",
                    "Ya existe una contratación abierta para este servicio.",
                );
            }
        }

        const now = Timestamp.now();
        const requestDateKey = dateKeyFromMs(now.toMillis());
        const ref = db.collection(CONTRACTS_COLLECTION).doc();
        const promotionCode = normalizePromotionCode(request.data?.promotionCode);
        const requiresQuote = catalogPricingRequiresQuote(pricing);
        const activity = appendContractActivity({
            type: "requested",
            uid,
            note: cleanBillingText(request.data?.note, 500),
        });
        const contract = {
            inmobiliariaId,
            inmobiliariaNombre:
                inmobiliaria.nombre || inmobiliaria.razonSocial || inmobiliariaId,
            catalogItemId,
            catalogCode: item.code || catalogItemId,
            catalogName: item.name || "Producto o servicio",
            catalogDescription: item.description || "",
            itemType: item.itemType || "service",
            countryCode,
            quantity,
            unitLabel: item.unitLabel || "unidad",
            requirements,
            inclusions: normalizeStringList(item.inclusions, 30, 500),
            moduleGrants: normalizeStringList(item.moduleGrants, 30, 80),
            benefits: normalizeCatalogBenefits(item.benefits),
            pricing,
            requiresQuote,
            status: "requested",
            customerNote: cleanBillingText(request.data?.note, 2000),
            termsVersion: TERMS_VERSION,
            termsAcceptedAt: now,
            termsAcceptedBy: uid,
            requestedAt: now,
            requestedBy: uid,
            activityLog: [activity],
            createdAt: now,
            updatedAt: now,
        };

        if (promotionCode) {
            const promoRef = promotionRef(promotionCode);
            const usageRef = promotionAgencyUsageRef(promotionCode, inmobiliariaId);
            await db.runTransaction(async (transaction) => {
                const [promotionSnap, usageSnap] = await Promise.all([
                    transaction.get(promoRef),
                    transaction.get(usageRef),
                ]);
                if (!promotionSnap.exists) {
                    throw new HttpsError(
                        "not-found",
                        "El código de bonificación no existe.",
                    );
                }
                const promotion = promotionSnap.data() || {};
                const usage = usageSnap.data() || {};
                const eligibilityError = getPromotionEligibilityError({
                    promotion,
                    dateKey: requestDateKey,
                    catalogItemId,
                    globalReserved: promotion.reservedCount,
                    globalRedeemed: promotion.redeemedCount,
                    agencyReserved: usage.reservedCount,
                    agencyRedeemed: usage.redeemedCount,
                });
                if (eligibilityError) {
                    throw new HttpsError(
                        "failed-precondition",
                        PROMOTION_ERROR_MESSAGES[eligibilityError] ||
                            "El código de bonificación no puede utilizarse.",
                    );
                }
                const promotionSnapshot = {
                    id: promotionSnap.id,
                    code: promotion.code || promotionCode,
                    description: promotion.description || "",
                    discount: {
                        percentageBasisPoints: Number(
                            promotion.percentageBasisPoints || 0,
                        ),
                        fixedAmountMinor: Number(promotion.fixedAmountMinor || 0),
                        fixedCurrency: normalizeCurrencyCode(
                            promotion.fixedCurrency || "ARS",
                        ),
                    },
                    requestedAtDateKey: requestDateKey,
                    validFrom: promotion.validFrom || "",
                    validUntil: promotion.validUntil || "",
                };
                transaction.update(promoRef, {
                    reservedCount: Math.max(
                        0,
                        Number(promotion.reservedCount || 0),
                    ) + 1,
                    updatedAt: now,
                });
                transaction.set(usageRef, {
                    inmobiliariaId,
                    reservedCount: Math.max(0, Number(usage.reservedCount || 0)) + 1,
                    redeemedCount: Math.max(0, Number(usage.redeemedCount || 0)),
                    createdAt: usage.createdAt || now,
                    updatedAt: now,
                }, { merge: true });
                transaction.set(ref, {
                    ...contract,
                    promotion: promotionSnapshot,
                    promotionReservationStatus: "reserved",
                    promotionReservedAt: now,
                });
            });
        } else {
            await ref.set(contract);
        }
        return { contract: serializeValue({ id: ref.id, ...contract }) };
    },
);

export const billingSetContractQuote = onCall(
    { region: REGION, invoker: "public" },
    async (request) => {
        const uid = request.auth?.uid;
        await assertRoot(uid);
        const contractId = cleanBillingText(request.data?.contractId, 128);
        const contract = await getContract(contractId);
        if (!["requested", "quoted"].includes(contract.status)) {
            throw new HttpsError(
                "failed-precondition",
                "La contratación ya no admite una cotización.",
            );
        }

        const quoteAmounts = request.data?.quoteAmounts || {};
        const quotedPricing = normalizePricingComponents(contract.pricing)
            .map((component) => {
                if (!component.quoteRequired) return component;
                const rawQuote = quoteAmounts[component.id] || {};
                const amountMinor = normalizeAmountMinor(rawQuote.amountMinor);
                if (amountMinor === null) {
                    throw new HttpsError(
                        "invalid-argument",
                        `Ingresá un importe para ${component.label}.`,
                    );
                }
                return {
                    ...component,
                    currency: normalizeCurrencyCode(
                        rawQuote.currency || component.currency,
                    ),
                    amountMinor,
                };
            });
        const now = Timestamp.now();
        await contractRef(contractId).update({
            pricing: quotedPricing,
            status: "quoted",
            quotedAt: now,
            quotedBy: uid,
            quoteNote: cleanBillingText(request.data?.quoteNote, 2000),
            activityLog: FieldValue.arrayUnion(appendContractActivity({
                type: "quoted",
                uid,
                note: request.data?.quoteNote,
            })),
            updatedAt: now,
        });
        return { status: "quoted" };
    },
);

export const billingAcceptContractQuote = onCall(
    { region: REGION, invoker: "public" },
    async (request) => {
        const uid = request.auth?.uid;
        const contractId = cleanBillingText(request.data?.contractId, 128);
        const contract = await getContract(contractId);
        await assertCanManageInmobiliaria(uid, contract.inmobiliariaId);
        if (contract.status !== "quoted") {
            throw new HttpsError(
                "failed-precondition",
                "La cotización no está disponible para aceptar.",
            );
        }
        if (request.data?.termsAccepted !== true) {
            throw new HttpsError(
                "failed-precondition",
                "Debés aceptar la cotización y sus condiciones.",
            );
        }

        const now = Timestamp.now();
        await contractRef(contractId).update({
            status: "accepted",
            quoteAcceptedAt: now,
            quoteAcceptedBy: uid,
            termsVersion: TERMS_VERSION,
            activityLog: FieldValue.arrayUnion(appendContractActivity({
                type: "quote_accepted",
                uid,
            })),
            updatedAt: now,
        });
        return { status: "accepted" };
    },
);

const updateContractWithPromotionResolution = async ({
    contractId,
    allowedStatuses,
    resolution,
    contractUpdate,
}) => {
    await db.runTransaction(async (transaction) => {
        const ref = contractRef(contractId);
        const contractSnap = await transaction.get(ref);
        if (!contractSnap.exists) {
            throw new HttpsError("not-found", "No se encontró la contratación.");
        }
        const contract = contractSnap.data() || {};
        if (!allowedStatuses.includes(contract.status)) {
            throw new HttpsError(
                "failed-precondition",
                "La contratación cambió de estado. Actualizá la pantalla.",
            );
        }

        let promoRef = null;
        let usageRef = null;
        let promotion = null;
        let usage = null;
        const hasReservation = contract.promotionReservationStatus === "reserved" &&
            contract.promotion?.code;
        if (hasReservation) {
            promoRef = promotionRef(contract.promotion.code);
            usageRef = promotionAgencyUsageRef(
                contract.promotion.code,
                contract.inmobiliariaId,
            );
            const promotionSnap = await transaction.get(promoRef);
            const usageSnap = await transaction.get(usageRef);
            promotion = promotionSnap.data() || {};
            usage = usageSnap.data() || {};
        }

        const now = Timestamp.now();
        if (promoRef && usageRef) {
            transaction.set(promoRef, {
                reservedCount: Math.max(0, Number(promotion.reservedCount || 0) - 1),
                redeemedCount: Math.max(0, Number(promotion.redeemedCount || 0)) +
                    (resolution === "redeemed" ? 1 : 0),
                updatedAt: now,
            }, { merge: true });
            transaction.set(usageRef, {
                inmobiliariaId: contract.inmobiliariaId,
                reservedCount: Math.max(0, Number(usage.reservedCount || 0) - 1),
                redeemedCount: Math.max(0, Number(usage.redeemedCount || 0)) +
                    (resolution === "redeemed" ? 1 : 0),
                updatedAt: now,
            }, { merge: true });
        }

        transaction.update(ref, {
            ...contractUpdate,
            ...(hasReservation ? {
                promotionReservationStatus: resolution,
                promotionReservationResolvedAt: now,
            } : {}),
        });
    });
};

export const billingRejectContract = onCall(
    { region: REGION, invoker: "public" },
    async (request) => {
        const uid = request.auth?.uid;
        await assertRoot(uid);
        const contractId = cleanBillingText(request.data?.contractId, 128);
        const contract = await getContract(contractId);
        if (!["requested", "quoted", "accepted"].includes(contract.status)) {
            throw new HttpsError(
                "failed-precondition",
                "La contratación ya no puede rechazarse.",
            );
        }
        const now = Timestamp.now();
        const note = cleanBillingText(request.data?.note, 1000);
        await updateContractWithPromotionResolution({
            contractId,
            allowedStatuses: ["requested", "quoted", "accepted"],
            resolution: "released",
            contractUpdate: {
            status: "rejected",
            rejectedAt: now,
            rejectedBy: uid,
            rejectionNote: note,
            activityLog: FieldValue.arrayUnion(appendContractActivity({
                type: "rejected",
                uid,
                note,
            })),
            updatedAt: now,
            },
        });
        return { status: "rejected" };
    },
);

const createInitialContractCharges = async ({ contract, uid, startAtMs }) => {
    const obligations = [];
    for (const component of normalizePricingComponents(contract.pricing)) {
        const amountMinor = normalizeAmountMinor(component.amountMinor);
        if (amountMinor === null) continue;
        const obligation = await createContractObligation({
            contract,
            component,
            periodStartAtMs: startAtMs,
            createdBy: uid,
        });
        obligations.push(obligation);
    }
    return obligations;
};

export const billingApproveContract = onCall(
    { region: REGION, invoker: "public", timeoutSeconds: 120 },
    async (request) => {
        const uid = request.auth?.uid;
        await assertRoot(uid);
        const contractId = cleanBillingText(request.data?.contractId, 128);
        const contract = await getContract(contractId);
        const allowed = contract.requiresQuote === true
            ? contract.status === "accepted"
            : contract.status === "requested";
        if (!allowed) {
            throw new HttpsError(
                "failed-precondition",
                "La contratación aún no está lista para aprobar.",
            );
        }

        const requestedStart = timestampToMillis(request.data?.serviceStartAt);
        if (request.data?.serviceStartAt && !requestedStart) {
            throw new HttpsError("invalid-argument", "La fecha de inicio no es válida.");
        }
        const startAtMs = requestedStart || Date.now();
        const serviceStartDateKey = dateKeyFromMs(startAtMs);
        const requestedEnd = timestampToMillis(request.data?.serviceEndAt);
        if (request.data?.serviceEndAt && !requestedEnd) {
            throw new HttpsError(
                "invalid-argument",
                "La fecha de finalización no es válida.",
            );
        }
        const serviceEndDateKey = requestedEnd ? dateKeyFromMs(requestedEnd) : "";
        if (serviceEndDateKey && serviceEndDateKey < serviceStartDateKey) {
            throw new HttpsError(
                "invalid-argument",
                "La fecha de finalización no puede ser anterior al inicio.",
            );
        }
        const paymentTermDays = Math.max(
            1,
            Math.min(365, Math.trunc(Number(request.data?.paymentTermDays || 15))),
        );
        const discountInput = request.data?.discount || {};
        const requestedPercentage = Number(
            discountInput.percentageBasisPoints || 0,
        );
        const requestedFixedAmount = normalizeAmountMinor(
            discountInput.fixedAmountMinor || 0,
        );
        const requestedDiscountStart = discountInput.startsOn
            ? normalizeDateKey(discountInput.startsOn)
            : "";
        const requestedDiscountEnd = discountInput.endsOn
            ? normalizeDateKey(discountInput.endsOn)
            : "";
        if (
            !Number.isSafeInteger(requestedPercentage) ||
            requestedPercentage < 0 ||
            requestedPercentage > 10000 ||
            requestedFixedAmount === null ||
            (discountInput.startsOn && !requestedDiscountStart) ||
            (discountInput.endsOn && !requestedDiscountEnd) ||
            (requestedDiscountStart && requestedDiscountEnd &&
                requestedDiscountEnd < requestedDiscountStart)
        ) {
            throw new HttpsError(
                "invalid-argument",
                "La bonificación o su período de vigencia no son válidos.",
            );
        }
        const rawDiscount = normalizeContractDiscount(discountInput);
        const hasDiscount = rawDiscount.percentageBasisPoints > 0 ||
            rawDiscount.fixedAmountMinor > 0;
        const discount = {
            ...rawDiscount,
            startsOn: hasDiscount
                ? rawDiscount.startsOn || serviceStartDateKey
                : "",
        };
        const promotionDiscount = contract.promotion?.discount || null;
        if (promotionDiscount) {
            const minimumPercentage = Math.max(
                0,
                Number(promotionDiscount.percentageBasisPoints || 0),
            );
            const minimumFixed = Math.max(
                0,
                Number(promotionDiscount.fixedAmountMinor || 0),
            );
            const promotionCurrency = normalizeCurrencyCode(
                promotionDiscount.fixedCurrency || "ARS",
            );
            if (
                discount.percentageBasisPoints < minimumPercentage ||
                discount.fixedAmountMinor < minimumFixed ||
                (minimumFixed > 0 && discount.fixedCurrency !== promotionCurrency) ||
                (discount.startsOn && discount.startsOn > serviceStartDateKey) ||
                (discount.endsOn && discount.endsOn < serviceStartDateKey)
            ) {
                throw new HttpsError(
                    "failed-precondition",
                    "La aprobación no puede reducir la bonificación prometida por el código promocional.",
                );
            }
        }
        const pricing = normalizePricingComponents(contract.pricing);
        if (pricing.some((component) => component.amountMinor === null)) {
            throw new HttpsError(
                "failed-precondition",
                "La contratación contiene importes pendientes de cotización.",
            );
        }
        const configuredRates = await getInterestRates();
        const chargeCurrencies = [...new Set(pricing
            .filter((component) => Number(component.amountMinor || 0) > 0)
            .map((component) => component.currency))];
        for (const currency of chargeCurrencies) {
            const initialRate = findTnaForDate(
                configuredRates.filter((rate) => rate.currency === currency),
                serviceStartDateKey,
            );
            if (!initialRate) {
                throw new HttpsError(
                    "failed-precondition",
                    `Configurá una TNA para ${currency} vigente al ${serviceStartDateKey}.`,
                );
            }
        }

        const financialContract = {
            ...contract,
            serviceStartDateKey,
            serviceEndDateKey,
            paymentTermDays,
            discount,
        };
        const obligations = await createInitialContractCharges({
            contract: financialContract,
            uid,
            startAtMs,
        });
        const recurringSchedules = buildBillingSchedules({
            pricing,
            benefits: contract.benefits,
            startAtMs,
        });
        const nextBillingAtMs = getNextBillingAtMs(recurringSchedules);
        const hasPayableObligations = obligations.some(
            (obligation) => Number(obligation.principalOriginalMinor || 0) > 0,
        );
        const nextStatus = hasPayableObligations ? "pending_payment" : "pending_setup";
        const now = Timestamp.now();
        await updateContractWithPromotionResolution({
            contractId,
            allowedStatuses: [contract.status],
            resolution: "redeemed",
            contractUpdate: {
            status: nextStatus,
            pricing,
            serviceStartAt: Timestamp.fromMillis(startAtMs),
            serviceStartDateKey,
            serviceEndAt: requestedEnd ? Timestamp.fromMillis(requestedEnd) : null,
            serviceEndDateKey,
            paymentTermDays,
            discount,
            recurringSchedules,
            nextBillingAt: nextBillingAtMs
                ? Timestamp.fromMillis(nextBillingAtMs)
                : null,
            approvedAt: now,
            approvedBy: uid,
            adminNote: cleanBillingText(request.data?.adminNote, 2000),
            activityLog: FieldValue.arrayUnion(appendContractActivity({
                type: "approved",
                uid,
                note: request.data?.adminNote,
            })),
            updatedAt: now,
            },
        });
        return {
            status: nextStatus,
            obligations: obligations.map((obligation) => serializeValue(obligation)),
        };
    },
);

export const billingActivateContract = onCall(
    { region: REGION, invoker: "public", timeoutSeconds: 120 },
    async (request) => {
        const uid = request.auth?.uid;
        await assertRoot(uid);
        const contractId = cleanBillingText(request.data?.contractId, 128);
        const contract = await getContract(contractId);
        if (!["pending_payment", "pending_setup", "suspended", "active"]
            .includes(contract.status)) {
            throw new HttpsError(
                "failed-precondition",
                "La contratación no está lista para activar.",
            );
        }

        if (contract.status !== "active") {
            const now = Timestamp.now();
            await contractRef(contractId).update({
                status: "active",
                activatedAt: now,
                activatedBy: uid,
                activityLog: FieldValue.arrayUnion(appendContractActivity({
                    type: "activated",
                    uid,
                    note: request.data?.adminNote,
                })),
                updatedAt: now,
            });
        }
        const activeContract = { ...contract, id: contractId, status: "active" };
        await Promise.all([
            syncBillingModules(contract.inmobiliariaId),
            grantInitialBenefits(activeContract),
        ]);
        return { status: "active" };
    },
);

export const billingAmendContractFinancialTerms = onCall(
    { region: REGION, invoker: "public", timeoutSeconds: 120 },
    async (request) => {
        const uid = request.auth?.uid;
        await assertRoot(uid);
        const contractId = cleanBillingText(request.data?.contractId, 128);
        const amendmentId = cleanBillingText(request.data?.amendmentId, 128) ||
            db.collection("_ids").doc().id;
        const effectiveDateKey = normalizeDateKey(request.data?.effectiveDateKey);
        const todayDateKey = getArgentinaDateKey();
        if (!effectiveDateKey || effectiveDateKey < todayDateKey) {
            throw new HttpsError(
                "invalid-argument",
                "La enmienda debe comenzar hoy o en una fecha futura.",
            );
        }

        const percentageBasisPoints = Number(
            request.data?.discount?.percentageBasisPoints || 0,
        );
        const fixedAmountMinor = normalizeAmountMinor(
            request.data?.discount?.fixedAmountMinor || 0,
        );
        const rawDiscount = request.data?.discount || {};
        if (
            !Number.isSafeInteger(percentageBasisPoints) ||
            percentageBasisPoints < 0 ||
            percentageBasisPoints > 10000 ||
            fixedAmountMinor === null ||
            (rawDiscount.startsOn && !normalizeDateKey(rawDiscount.startsOn)) ||
            (rawDiscount.endsOn && !normalizeDateKey(rawDiscount.endsOn))
        ) {
            throw new HttpsError(
                "invalid-argument",
                "La bonificación de la enmienda no es válida.",
            );
        }
        const hasDiscount = percentageBasisPoints > 0 || fixedAmountMinor > 0;
        const discount = normalizeContractDiscount({
            ...rawDiscount,
            percentageBasisPoints,
            fixedAmountMinor,
            startsOn: hasDiscount
                ? normalizeDateKey(rawDiscount.startsOn) || effectiveDateKey
                : "",
        });
        if (
            discount.startsOn && discount.startsOn < effectiveDateKey ||
            discount.startsOn && discount.endsOn && discount.endsOn < discount.startsOn
        ) {
            throw new HttpsError(
                "invalid-argument",
                "La bonificación no puede comenzar antes de la enmienda.",
            );
        }

        const ref = contractRef(contractId);
        const amendmentRef = ref.collection("financial_amendments").doc(amendmentId);
        let result = null;
        await db.runTransaction(async (transaction) => {
            const [contractSnap, existingAmendmentSnap] = await Promise.all([
                transaction.get(ref),
                transaction.get(amendmentRef),
            ]);
            if (existingAmendmentSnap.exists) {
                result = {
                    id: existingAmendmentSnap.id,
                    ...(existingAmendmentSnap.data() || {}),
                    existing: true,
                };
                return;
            }
            if (!contractSnap.exists) {
                throw new HttpsError("not-found", "No se encontró la contratación.");
            }
            const contract = { id: contractSnap.id, ...(contractSnap.data() || {}) };
            if (!["active", "pending_payment", "pending_setup", "suspended"]
                .includes(contract.status)) {
                throw new HttpsError(
                    "failed-precondition",
                    "Solo pueden modificarse contratos vigentes o pendientes de activación.",
                );
            }
            if (
                contract.serviceEndDateKey &&
                effectiveDateKey > contract.serviceEndDateKey
            ) {
                throw new HttpsError(
                    "invalid-argument",
                    "La enmienda comienza después de la finalización del servicio.",
                );
            }

            const currentTerms = resolveContractFinancialTerms(
                contract,
                effectiveDateKey,
            );
            const pricingAmounts = request.data?.pricingAmounts || {};
            const pricing = currentTerms.pricing.map((component) => {
                if (component.recurrence === "once") return component;
                const proposed = pricingAmounts[component.id];
                const amountMinor = normalizeAmountMinor(proposed?.amountMinor);
                if (amountMinor === null) {
                    throw new HttpsError(
                        "invalid-argument",
                        `Ingresá el nuevo importe para ${component.label}.`,
                    );
                }
                return { ...component, amountMinor };
            });
            const now = Timestamp.now();
            const amendment = {
                id: amendmentId,
                effectiveDateKey,
                effectiveAt: timestampFromDateKey(effectiveDateKey),
                pricing,
                discount,
                note: cleanBillingText(request.data?.note, 2000),
                previousTerms: {
                    pricing: currentTerms.pricing,
                    discount: currentTerms.discount,
                    amendmentId: currentTerms.amendment?.id || "",
                },
                createdAt: now,
                createdBy: uid,
            };
            const financialAmendments = Array.isArray(contract.financialAmendments)
                ? [...contract.financialAmendments, amendment].slice(-100)
                : [amendment];
            transaction.set(amendmentRef, amendment);
            transaction.update(ref, {
                financialAmendments,
                latestFinancialAmendmentId: amendmentId,
                latestFinancialAmendmentEffectiveDateKey: effectiveDateKey,
                activityLog: FieldValue.arrayUnion(appendContractActivity({
                    type: "financial_terms_amended",
                    uid,
                    note: request.data?.note,
                })),
                updatedAt: now,
            });
            result = { ...amendment, existing: false };
        });
        return { amendment: serializeValue(result) };
    },
);

export const billingRequestCancellation = onCall(
    { region: REGION, invoker: "public" },
    async (request) => {
        const uid = request.auth?.uid;
        const contractId = cleanBillingText(request.data?.contractId, 128);
        const contract = await getContract(contractId);
        await assertCanManageInmobiliaria(uid, contract.inmobiliariaId);
        if (!["active", "pending_payment", "pending_setup", "suspended"].includes(contract.status)) {
            throw new HttpsError(
                "failed-precondition",
                "Esta contratación no admite una solicitud de baja.",
            );
        }

        const now = Timestamp.now();
        await contractRef(contractId).update({
            statusBeforeCancellation: contract.status,
            status: "cancel_requested",
            cancellationReason: cleanBillingText(request.data?.reason, 1000),
            cancellationRequestedAt: now,
            cancellationRequestedBy: uid,
            activityLog: FieldValue.arrayUnion(appendContractActivity({
                type: "cancellation_requested",
                uid,
                note: request.data?.reason,
            })),
            updatedAt: now,
        });
        return { status: "cancel_requested" };
    },
);

const deactivateRecurringContractBenefits = async (contract, contractId) => {
    const entitlementSnap = await entitlementsRef(contract.inmobiliariaId)
        .where("contractId", "==", contractId).get();
    const batch = db.batch();
    let updates = 0;
    entitlementSnap.docs.forEach((snap) => {
        if (snap.data()?.grantMode === "recurring") {
            batch.update(snap.ref, {
                active: false,
                remaining: 0,
                updatedAt: Timestamp.now(),
            });
            updates += 1;
        }
    });
    if (updates > 0) await batch.commit();
    await syncBillingModules(contract.inmobiliariaId);
};

export const billingResolveCancellation = onCall(
    { region: REGION, invoker: "public", timeoutSeconds: 120 },
    async (request) => {
        const uid = request.auth?.uid;
        await assertRoot(uid);
        const contractId = cleanBillingText(request.data?.contractId, 128);
        const contract = await getContract(contractId);
        const approve = request.data?.approve === true;
        if (approve && contract.status === "cancelled") {
            await deactivateRecurringContractBenefits(contract, contractId);
            return { status: "cancelled", repaired: true };
        }
        if (contract.status !== "cancel_requested") {
            throw new HttpsError(
                "failed-precondition",
                "No hay una solicitud de baja pendiente.",
            );
        }

        const nextStatus = approve
            ? "cancelled"
            : cleanBillingText(contract.statusBeforeCancellation, 30) || "active";
        const now = Timestamp.now();
        await contractRef(contractId).update({
            status: nextStatus,
            cancellationResolvedAt: now,
            cancellationResolvedBy: uid,
            cancellationResolutionNote: cleanBillingText(request.data?.note, 1000),
            ...(approve ? { cancelledAt: now, cancelledBy: uid } : {}),
            activityLog: FieldValue.arrayUnion(appendContractActivity({
                type: approve ? "cancelled" : "cancellation_rejected",
                uid,
                note: request.data?.note,
            })),
            updatedAt: now,
        });

        if (approve) {
            await deactivateRecurringContractBenefits(contract, contractId);
        }
        return { status: nextStatus };
    },
);

const assertPaymentProof = async ({ inmobiliariaId, reportId, proofPath }) => {
    if (!proofPath) return;
    const prefix = `billing/${inmobiliariaId}/payment-proofs/${reportId}/`;
    if (!proofPath.startsWith(prefix) || proofPath.length <= prefix.length) {
        throw new HttpsError("permission-denied", "El comprobante no es válido.");
    }

    const [exists] = await admin.storage().bucket().file(proofPath).exists();
    if (!exists) {
        throw new HttpsError("not-found", "No se encontró el comprobante subido.");
    }
};

export const billingCreatePaymentReport = onCall(
    { region: REGION, invoker: "public", timeoutSeconds: 120 },
    async (request) => {
        const uid = request.auth?.uid;
        const inmobiliariaId = cleanBillingText(request.data?.inmobiliariaId, 128);
        await assertCanManageInmobiliaria(uid, inmobiliariaId);
        const inmobiliaria = await assertInmobiliariaExists(inmobiliariaId);
        const reportId = cleanBillingText(request.data?.reportId, 128);
        if (!/^[A-Za-z0-9_-]{12,128}$/.test(reportId)) {
            throw new HttpsError("invalid-argument", "Identificador de pago inválido.");
        }

        const amountMinor = normalizeAmountMinor(request.data?.amountMinor);
        if (amountMinor === null || amountMinor <= 0) {
            throw new HttpsError("invalid-argument", "Ingresá un importe válido.");
        }
        const requestedPaidDateKey = normalizeDateKey(request.data?.paidAt);
        const paidAtMs = requestedPaidDateKey
            ? timestampToMillis(timestampFromDateKey(requestedPaidDateKey))
            : timestampToMillis(request.data?.paidAt) || Date.now();
        const paidDateKey = requestedPaidDateKey || dateKeyFromMs(paidAtMs);
        if (paidAtMs > Date.now() + 24 * 60 * 60 * 1000) {
            throw new HttpsError(
                "invalid-argument",
                "La fecha de pago no puede ser futura.",
            );
        }
        const proofPath = cleanBillingText(request.data?.proofPath, 1000);
        await assertPaymentProof({ inmobiliariaId, reportId, proofPath });

        const ref = paymentReportRef(reportId);
        if ((await ref.get()).exists) {
            throw new HttpsError("already-exists", "El pago ya fue informado.");
        }
        const now = Timestamp.now();
        const data = {
            inmobiliariaId,
            inmobiliariaNombre:
                inmobiliaria.nombre || inmobiliaria.razonSocial || inmobiliariaId,
            amountMinor,
            currency: normalizeCurrencyCode(request.data?.currency),
            paidAt: Timestamp.fromMillis(paidAtMs),
            paidDateKey,
            paymentMethod: cleanBillingText(request.data?.paymentMethod, 80),
            reference: cleanBillingText(request.data?.reference, 300),
            note: cleanBillingText(request.data?.note, 1000),
            proofPath,
            proofUrl: cleanBillingText(request.data?.proofUrl, 3000),
            status: "pending",
            reportedBy: uid,
            reportedAt: now,
            createdAt: now,
            updatedAt: now,
        };
        await ref.set(data);
        return { report: serializeValue({ id: ref.id, ...data }) };
    },
);

const allocatePaymentToObligations = async ({ reportId, report, uid }) => {
    const allocationRef = paymentAllocationsRef(report.inmobiliariaId).doc(reportId);
    const allocationDateKey = getArgentinaDateKey();
    let result = null;

    await db.runTransaction(async (transaction) => {
        const allocationSnap = await transaction.get(allocationRef);
        if (allocationSnap.exists) {
            result = { id: allocationSnap.id, ...(allocationSnap.data() || {}) };
            return;
        }
        const query = obligationsRef(report.inmobiliariaId)
            .where("currency", "==", report.currency);
        const obligationsSnap = await transaction.get(query);
        const obligationDocs = new Map(obligationsSnap.docs.map((snap) => [
            snap.id,
            snap,
        ]));
        const allocationResult = buildFifoPaymentAllocation(
            obligationsSnap.docs.map((snap) => ({
                id: snap.id,
                ...(snap.data() || {}),
            })),
            report.amountMinor,
        );
        const allocations = [];
        const now = Timestamp.now();

        for (const allocationLine of allocationResult.allocations) {
            const obligationSnap = obligationDocs.get(allocationLine.obligationId);
            if (!obligationSnap) continue;
            const obligation = obligationSnap.data() || {};
            const interestOutstanding = Math.max(
                0,
                Number(obligation.interestOutstandingMinor || 0),
            );
            const principalOutstanding = Math.max(
                0,
                Number(obligation.principalOutstandingMinor || 0),
            );
            const { interestPaidMinor, principalPaidMinor } = allocationLine;

            const nextInterest = interestOutstanding - interestPaidMinor;
            const nextPrincipal = principalOutstanding - principalPaidMinor;
            const principalPaymentEvents = Array.isArray(
                obligation.principalPaymentEvents,
            ) ? [...obligation.principalPaymentEvents] : [];
            if (principalPaidMinor > 0) {
                principalPaymentEvents.push({
                    paymentReportId: reportId,
                    dateKey: allocationDateKey,
                    amountMinor: principalPaidMinor,
                });
            }
            transaction.update(obligationSnap.ref, {
                principalOutstandingMinor: nextPrincipal,
                interestOutstandingMinor: nextInterest,
                paidPrincipalMinor: Math.max(
                    0,
                    Number(obligation.paidPrincipalMinor || 0),
                ) + principalPaidMinor,
                paidInterestMinor: Math.max(
                    0,
                    Number(obligation.paidInterestMinor || 0),
                ) + interestPaidMinor,
                principalPaymentEvents: principalPaymentEvents.slice(-500),
                status: nextPrincipal + nextInterest <= 0
                    ? "paid"
                    : allocationDateKey > obligation.dueDateKey
                        ? "overdue"
                        : "open",
                lastPaymentAt: now,
                ...(nextPrincipal + nextInterest <= 0 ? { paidAt: now } : {}),
                updatedAt: now,
            });
            allocations.push({
                obligationId: obligationSnap.id,
                contractId: obligation.contractId || "",
                componentLabel: obligation.componentLabel || "",
                interestPaidMinor,
                principalPaidMinor,
            });
        }

        const allocation = {
            inmobiliariaId: report.inmobiliariaId,
            paymentReportId: reportId,
            currency: report.currency,
            paymentAmountMinor: report.amountMinor,
            allocatedMinor: allocationResult.allocatedMinor,
            unallocatedMinor: allocationResult.unallocatedMinor,
            allocationMethod: "fifo_due_date_interest_then_principal",
            allocationDateKey,
            allocations,
            createdBy: uid,
            createdAt: now,
        };
        transaction.set(allocationRef, allocation);
        result = { id: allocationRef.id, ...allocation };
    });
    return result;
};

export const billingResolvePaymentReport = onCall(
    { region: REGION, invoker: "public", timeoutSeconds: 120 },
    async (request) => {
        const uid = request.auth?.uid;
        await assertRoot(uid);
        const reportId = cleanBillingText(request.data?.reportId, 128);
        const ref = paymentReportRef(reportId);
        const snap = await ref.get();
        if (!snap.exists) {
            throw new HttpsError("not-found", "No se encontró el pago informado.");
        }
        const report = snap.data() || {};
        if (report.status !== "pending") {
            throw new HttpsError("failed-precondition", "El pago ya fue resuelto.");
        }

        const approve = request.data?.approve === true;
        let entry = null;
        let allocation = null;
        if (approve) {
            await processMoratoryInterests(getArgentinaDateKey());
            entry = await postLedgerEntry({
                inmobiliariaId: report.inmobiliariaId,
                entryId: `payment_${reportId}`,
                type: "payment",
                direction: "credit",
                amountMinor: report.amountMinor,
                currency: report.currency,
                description: `Pago informado${report.reference ? ` · ${report.reference}` : ""}`,
                paymentReportId: reportId,
                createdBy: uid,
                metadata: {
                    paidAtMs: timestampToMillis(report.paidAt),
                    paymentMethod: report.paymentMethod || "",
                },
            });
            allocation = await allocatePaymentToObligations({
                reportId,
                report,
                uid,
            });
        }

        const now = Timestamp.now();
        const status = approve ? "confirmed" : "rejected";
        await ref.update({
            status,
            resolutionNote: cleanBillingText(request.data?.note, 1000),
            resolvedAt: now,
            resolvedBy: uid,
            ledgerEntryId: entry?.id || "",
            paymentAllocationId: allocation?.id || "",
            allocatedMinor: allocation?.allocatedMinor || 0,
            unallocatedMinor: allocation?.unallocatedMinor || 0,
            updatedAt: now,
        });
        return {
            status,
            entry: entry ? serializeValue(entry) : null,
            allocation: allocation ? serializeValue(allocation) : null,
        };
    },
);

export const billingCreateManualEntry = onCall(
    { region: REGION, invoker: "public", timeoutSeconds: 120 },
    async (request) => {
        const uid = request.auth?.uid;
        await assertRoot(uid);
        const inmobiliariaId = cleanBillingText(request.data?.inmobiliariaId, 128);
        await assertInmobiliariaExists(inmobiliariaId);
        const type = cleanBillingText(request.data?.type, 50);
        const allowedTypes = new Set([
            "manual_charge",
            "manual_credit",
            "adjustment_debit",
            "adjustment_credit",
        ]);
        if (!allowedTypes.has(type)) {
            throw new HttpsError("invalid-argument", "Tipo de movimiento inválido.");
        }
        const direction = type.endsWith("credit") ? "credit" : "debit";
        const entry = await postLedgerEntry({
            inmobiliariaId,
            type,
            direction,
            amountMinor: request.data?.amountMinor,
            currency: request.data?.currency,
            description: request.data?.description,
            createdBy: uid,
        });
        return { entry: serializeValue(entry) };
    },
);

export const billingReverseLedgerEntry = onCall(
    { region: REGION, invoker: "public", timeoutSeconds: 120 },
    async (request) => {
        const uid = request.auth?.uid;
        await assertRoot(uid);
        const inmobiliariaId = cleanBillingText(request.data?.inmobiliariaId, 128);
        const entryId = cleanBillingText(request.data?.entryId, 128);
        const originalRef = entriesRef(inmobiliariaId).doc(entryId);
        const originalSnap = await originalRef.get();
        if (!originalSnap.exists) {
            throw new HttpsError("not-found", "No se encontró el movimiento.");
        }
        const original = originalSnap.data() || {};
        if (original.reversedByEntryId) {
            throw new HttpsError("failed-precondition", "El movimiento ya fue revertido.");
        }
        if (original.obligationId || original.paymentReportId) {
            throw new HttpsError(
                "failed-precondition",
                "Este movimiento está imputado a una obligación y requiere una corrección específica.",
            );
        }

        const reversal = await postLedgerEntry({
            inmobiliariaId,
            entryId: `reversal_${entryId}`,
            type: "reversal",
            direction: original.direction === "debit" ? "credit" : "debit",
            amountMinor: original.amountMinor,
            currency: original.currency,
            description:
                cleanBillingText(request.data?.reason, 400) ||
                `Reversión de ${original.description || entryId}`,
            contractId: original.contractId || "",
            catalogItemId: original.catalogItemId || "",
            createdBy: uid,
            metadata: { reversesEntryId: entryId },
        });
        await originalRef.update({
            reversedByEntryId: reversal.id,
            reversedAt: Timestamp.now(),
            reversedBy: uid,
        });
        return { entry: serializeValue(reversal) };
    },
);

export const billingApplyHighlightCredits = onCall(
    { region: REGION, invoker: "public", timeoutSeconds: 120 },
    async (request) => {
        const uid = request.auth?.uid;
        const inmobiliariaId = cleanBillingText(request.data?.inmobiliariaId, 128);
        await assertCanManageInmobiliaria(uid, inmobiliariaId);
        const inmuebleId = cleanBillingText(request.data?.inmuebleId, 128);
        const days = Math.max(
            1,
            Math.min(365, Math.trunc(Number(request.data?.days || 1))),
        );
        const inmuebleRef = db.collection("inmobiliarias").doc(inmobiliariaId)
            .collection("inmuebles").doc(inmuebleId);
        const usageRef = creditUsagesRef(inmobiliariaId).doc();
        let promotionEndsAtMs = 0;

        await db.runTransaction(async (transaction) => {
            const inmuebleSnap = await transaction.get(inmuebleRef);
            if (!inmuebleSnap.exists || inmuebleSnap.data()?.deleted === true) {
                throw new HttpsError("not-found", "No se encontró el inmueble.");
            }
            if (inmuebleSnap.data()?.publicarEnPortal !== true) {
                throw new HttpsError(
                    "failed-precondition",
                    "El inmueble debe estar publicado en el portal para destacarlo.",
                );
            }

            const entitlementQuery = entitlementsRef(inmobiliariaId)
                .where("type", "==", "highlight_credits")
                .where("active", "==", true);
            const entitlementSnap = await transaction.get(entitlementQuery);
            const nowMs = Date.now();
            const available = entitlementSnap.docs
                .map((snap) => ({ ref: snap.ref, id: snap.id, ...(snap.data() || {}) }))
                .filter((item) => (
                    Number(item.remaining || 0) > 0 &&
                    (!timestampToMillis(item.expiresAt) ||
                        timestampToMillis(item.expiresAt) > nowMs)
                ))
                .sort((a, b) => {
                    const aExpiry = timestampToMillis(a.expiresAt) || Number.MAX_SAFE_INTEGER;
                    const bExpiry = timestampToMillis(b.expiresAt) || Number.MAX_SAFE_INTEGER;
                    return aExpiry - bExpiry;
                });
            const total = available.reduce(
                (sum, item) => sum + Number(item.remaining || 0),
                0,
            );
            if (total < days) {
                throw new HttpsError(
                    "failed-precondition",
                    `No hay créditos suficientes. Disponibles: ${total}.`,
                );
            }

            let pending = days;
            const allocations = [];
            for (const entitlement of available) {
                if (pending <= 0) break;
                const current = Number(entitlement.remaining || 0);
                const used = Math.min(current, pending);
                transaction.update(entitlement.ref, {
                    remaining: current - used,
                    updatedAt: Timestamp.now(),
                });
                allocations.push({ entitlementId: entitlement.id, quantity: used });
                pending -= used;
            }

            const currentPromotionEnd = timestampToMillis(
                inmuebleSnap.data()?.promotion?.endsAt,
            );
            const startsAtMs = Math.max(nowMs, currentPromotionEnd || nowMs);
            promotionEndsAtMs = startsAtMs + days * 24 * 60 * 60 * 1000;
            const promotion = {
                active: true,
                plan: "destacado",
                source: "billing_credits",
                startsAt: Timestamp.fromMillis(startsAtMs),
                endsAt: Timestamp.fromMillis(promotionEndsAtMs),
                updatedAt: Timestamp.now(),
                updatedBy: uid,
            };
            transaction.update(inmuebleRef, {
                destacado: true,
                promotion,
                updatedAt: Timestamp.now(),
            });
            transaction.set(usageRef, {
                inmobiliariaId,
                inmuebleId,
                inmuebleTitulo: inmuebleSnap.data()?.titulo || inmuebleId,
                quantity: days,
                unit: "highlight_day_24h",
                allocations,
                startsAt: promotion.startsAt,
                endsAt: promotion.endsAt,
                createdBy: uid,
                createdAt: Timestamp.now(),
            });
        });

        return {
            usageId: usageRef.id,
            days,
            promotionEndsAt: promotionEndsAtMs,
        };
    },
);

const processRecurringContract = async (contractSnap, nowMs) => {
    const contract = { id: contractSnap.id, ...(contractSnap.data() || {}) };
    const schedules = Array.isArray(contract.recurringSchedules)
        ? contract.recurringSchedules.map((schedule) => ({ ...schedule }))
        : [];
    const serviceEndDateKey = normalizeDateKey(contract.serviceEndDateKey);
    const serviceEndExclusiveAtMs = serviceEndDateKey
        ? timestampToMillis(timestampFromDateKey(
            addCalendarDaysToDateKey(serviceEndDateKey, 1),
        ))
        : 0;
    let processed = 0;

    for (const schedule of schedules) {
        let nextAtMs = Number(schedule.nextBillingAtMs || 0);
        let safety = 0;
        while (nextAtMs && nextAtMs <= nowMs && safety < 24) {
            const periodStartDateKey = dateKeyFromMs(nextAtMs);
            if (serviceEndDateKey && periodStartDateKey > serviceEndDateKey) {
                schedule.nextBillingAtMs = 0;
                schedule.completed = true;
                processed += 1;
                break;
            }
            const financialTerms = resolveContractFinancialTerms(
                contract,
                periodStartDateKey,
            );
            const pricingById = new Map(
                financialTerms.pricing.map((component) => [component.id, component]),
            );
            const component = pricingById.get(schedule.componentId);
            const recurrence = component?.recurrence || schedule.recurrence;
            if (!recurrence || recurrence === "once") break;
            if (component) {
                await createContractObligation({
                    contract: {
                        ...contract,
                        discount: financialTerms.discount,
                        appliedFinancialAmendmentId:
                            financialTerms.amendment?.id || "",
                    },
                    component,
                    periodStartAtMs: nextAtMs,
                    createdBy: "billing-scheduler",
                });
            }
            const followingAtMs = addBillingIntervalMs(
                nextAtMs,
                recurrence,
            );
            await grantRecurringBenefits({
                contract,
                recurrence,
                periodStartMs: nextAtMs,
                nextPeriodMs: serviceEndExclusiveAtMs
                    ? Math.min(followingAtMs, serviceEndExclusiveAtMs)
                    : followingAtMs,
            });
            const followingDateKey = dateKeyFromMs(followingAtMs);
            nextAtMs = serviceEndDateKey && followingDateKey > serviceEndDateKey
                ? 0
                : followingAtMs;
            schedule.cycle = Number(schedule.cycle || 0) + 1;
            schedule.nextBillingAtMs = nextAtMs;
            if (!nextAtMs) schedule.completed = true;
            processed += 1;
            safety += 1;
        }
    }

    if (processed > 0) {
        const nextBillingAtMs = getNextBillingAtMs(schedules);
        await contractSnap.ref.update({
            recurringSchedules: schedules,
            nextBillingAt: nextBillingAtMs
                ? Timestamp.fromMillis(nextBillingAtMs)
                : null,
            lastBilledAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
        });
    }
    return processed;
};

const getArgentinaDateKey = (timestampMs = Date.now()) => {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Argentina/Buenos_Aires",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(new Date(timestampMs));
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
};

const capitalizeObligationInterest = async ({
    obligationRef,
    mode,
    accrualFromDateKey,
    accrualToDateKey,
    postingDateKey,
    rateSnapshots,
}) => {
    const obligationId = obligationRef.id;
    const inmobiliariaId = obligationRef.parent.parent.id;
    const suffix = mode === "initial"
        ? `initial_${accrualToDateKey}`
        : `daily_${accrualToDateKey}`;
    const entryRef = entriesRef(inmobiliariaId)
        .doc(`interest_${obligationId}_${suffix}`);
    let result = null;

    await db.runTransaction(async (transaction) => {
        const entrySnap = await transaction.get(entryRef);
        if (entrySnap.exists) {
            result = { id: entrySnap.id, ...(entrySnap.data() || {}), existing: true };
            return;
        }
        const obligationSnap = await transaction.get(obligationRef);
        if (!obligationSnap.exists) return;
        const obligation = obligationSnap.data() || {};
        const principalOutstandingMinor = Math.max(
            0,
            Number(obligation.principalOutstandingMinor || 0),
        );
        const interestOutstandingMinor = Math.max(
            0,
            Number(obligation.interestOutstandingMinor || 0),
        );
        const outstandingBaseMinor = principalOutstandingMinor +
            interestOutstandingMinor;
        if (outstandingBaseMinor <= 0) {
            transaction.update(obligationRef, {
                status: "paid",
                lastInterestAccrualDateKey: accrualToDateKey,
                updatedAt: Timestamp.now(),
            });
            return;
        }

        const tnaValues = rateSnapshots.map((rate) => rate.tnaMillionths);
        const principalPaymentEvents = Array.isArray(
            obligation.principalPaymentEvents,
        ) ? obligation.principalPaymentEvents : [];
        const amountMinor = mode === "initial"
            ? calculateInitialMoratoryInterestByDailyBaseMinor(
                rateSnapshots.map((rate) => ({
                    baseMinor: Math.max(
                        0,
                        Number(obligation.principalOriginalMinor || 0) -
                        principalPaymentEvents
                            .filter((event) => event.dateKey <= rate.dateKey)
                            .reduce(
                                (total, event) => total +
                                    Number(event.amountMinor || 0),
                                0,
                            ),
                    ),
                    tnaMillionths: rate.tnaMillionths,
                })),
            )
            : calculateDailyMoratoryInterestMinor(
                outstandingBaseMinor,
                tnaValues[0],
            );
        const accRef = accountRef(inmobiliariaId);
        const accountSnap = amountMinor && amountMinor > 0
            ? await transaction.get(accRef)
            : null;
        const now = Timestamp.now();
        const nextInterestOutstanding = interestOutstandingMinor +
            Math.max(0, Number(amountMinor || 0));
        const obligationUpdate = {
            interestAccruedMinor: Math.max(
                0,
                Number(obligation.interestAccruedMinor || 0),
            ) + Math.max(0, Number(amountMinor || 0)),
            interestOutstandingMinor: nextInterestOutstanding,
            lastInterestAccrualDateKey: accrualToDateKey,
            interestCapitalizations: Math.max(
                0,
                Number(obligation.interestCapitalizations || 0),
            ) + 1,
            status: "overdue",
            interestPendingRateDateKey: "",
            updatedAt: now,
            ...(mode === "initial" ? {
                firstInterestCapitalizedAt: now,
                firstInterestCapitalizedDateKey: postingDateKey,
            } : {}),
        };
        transaction.update(obligationRef, obligationUpdate);

        if (!amountMinor || amountMinor <= 0) {
            result = { amountMinor: 0, existing: false };
            return;
        }

        const account = accountSnap.data() || {};
        const currentBalance = getAccountBalance(account, obligation.currency);
        const nextBalance = currentBalance + amountMinor;
        const entry = {
            type: "interest_charge",
            direction: "debit",
            amountMinor,
            currency: obligation.currency,
            description: mode === "initial"
                ? `Interés moratorio inicial · ${obligation.componentLabel}`
                : `Interés moratorio diario · ${obligation.componentLabel}`,
            contractId: obligation.contractId,
            catalogItemId: obligation.catalogItemId,
            obligationId,
            paymentReportId: "",
            createdBy: "billing-scheduler",
            metadata: {
                mode,
                accrualFromDateKey,
                accrualToDateKey,
                postingDateKey,
                principalOutstandingMinor,
                previousInterestOutstandingMinor: interestOutstandingMinor,
                principalPaymentEvents,
                annualDivisorDays: 365,
                rateSnapshots,
            },
            balanceAfterMinor: nextBalance,
            createdAt: now,
        };
        transaction.set(entryRef, entry);
        transaction.set(accRef, {
            inmobiliariaId,
            balanceByCurrency: {
                ...(account.balanceByCurrency || {}),
                [obligation.currency]: nextBalance,
            },
            status: "open",
            lastEntryAt: now,
            createdAt: account.createdAt || now,
            updatedAt: now,
        }, { merge: true });
        result = { id: entryRef.id, ...entry, existing: false };
    });
    return result;
};

const processMoratoryInterests = async (todayDateKey) => {
    const [obligationsSnap, allRates] = await Promise.all([
        db.collectionGroup("obligations")
            .where("status", "in", ["open", "overdue"])
            .orderBy("dueDateKey", "asc")
            .limit(500)
            .get(),
        getInterestRates(),
    ]);
    let capitalizations = 0;

    for (const obligationSnap of obligationsSnap.docs) {
        const obligation = obligationSnap.data() || {};
        const dueDateKey = normalizeDateKey(obligation.dueDateKey);
        const periodStartDateKey = normalizeDateKey(obligation.periodStartDateKey);
        if (!dueDateKey || !periodStartDateKey || todayDateKey <= dueDateKey) {
            continue;
        }
        const rates = allRates.filter(
            (rate) => rate.currency === obligation.currency,
        );
        let lastAccrualDateKey = normalizeDateKey(
            obligation.lastInterestAccrualDateKey,
        );

        if (!lastAccrualDateKey) {
            const accrualDates = listDateKeysInclusive(
                periodStartDateKey,
                dueDateKey,
                365,
            );
            const rateSnapshots = accrualDates.map((dateKey) => {
                const rate = findTnaForDate(rates, dateKey);
                return rate ? {
                    dateKey,
                    rateId: rate.id,
                    tnaMillionths: rate.tnaMillionths,
                } : null;
            });
            const missingIndex = rateSnapshots.findIndex((rate) => !rate);
            if (missingIndex >= 0 || rateSnapshots.length !== accrualDates.length) {
                await obligationSnap.ref.update({
                    interestPendingRateDateKey:
                        accrualDates[missingIndex] || periodStartDateKey,
                    updatedAt: Timestamp.now(),
                });
                continue;
            }
            await capitalizeObligationInterest({
                obligationRef: obligationSnap.ref,
                mode: "initial",
                accrualFromDateKey: periodStartDateKey,
                accrualToDateKey: dueDateKey,
                postingDateKey: addCalendarDaysToDateKey(dueDateKey, 1),
                rateSnapshots,
            });
            capitalizations += 1;
            lastAccrualDateKey = dueDateKey;
        }

        let nextAccrualDateKey = addCalendarDaysToDateKey(
            lastAccrualDateKey,
            1,
        );
        let safety = 0;
        while (nextAccrualDateKey < todayDateKey && safety < 370) {
            const rate = findTnaForDate(rates, nextAccrualDateKey);
            if (!rate) {
                await obligationSnap.ref.update({
                    interestPendingRateDateKey: nextAccrualDateKey,
                    updatedAt: Timestamp.now(),
                });
                break;
            }
            await capitalizeObligationInterest({
                obligationRef: obligationSnap.ref,
                mode: "daily",
                accrualFromDateKey: nextAccrualDateKey,
                accrualToDateKey: nextAccrualDateKey,
                postingDateKey: addCalendarDaysToDateKey(nextAccrualDateKey, 1),
                rateSnapshots: [{
                    dateKey: nextAccrualDateKey,
                    rateId: rate.id,
                    tnaMillionths: rate.tnaMillionths,
                }],
            });
            capitalizations += 1;
            nextAccrualDateKey = addCalendarDaysToDateKey(
                nextAccrualDateKey,
                1,
            );
            safety += 1;
        }
    }
    return { obligations: obligationsSnap.size, capitalizations };
};

const completeEndedContracts = async (todayDateKey) => {
    const snap = await db.collection(CONTRACTS_COLLECTION)
        .where("status", "==", "active")
        .limit(500)
        .get();
    let completed = 0;
    for (const contractSnap of snap.docs) {
        const contract = { id: contractSnap.id, ...(contractSnap.data() || {}) };
        const serviceEndDateKey = normalizeDateKey(contract.serviceEndDateKey);
        if (!serviceEndDateKey || todayDateKey <= serviceEndDateKey) continue;
        const now = Timestamp.now();
        await contractSnap.ref.update({
            status: "completed",
            completedAt: now,
            activityLog: FieldValue.arrayUnion(appendContractActivity({
                type: "completed",
                uid: "billing-scheduler",
                note: `Finalización acordada: ${serviceEndDateKey}`,
            })),
            updatedAt: now,
        });
        await deactivateRecurringContractBenefits(contract, contract.id);
        completed += 1;
    }
    return completed;
};

const expireFinishedHighlights = async (nowMs) => {
    const snap = await db.collectionGroup("inmuebles")
        .where("promotion.active", "==", true)
        .limit(500)
        .get();
    const expired = snap.docs.filter((item) => (
        item.data()?.promotion?.source === "billing_credits" &&
        timestampToMillis(item.data()?.promotion?.endsAt) <= nowMs
    ));
    if (expired.length === 0) return 0;

    const batch = db.batch();
    expired.forEach((item) => batch.update(item.ref, {
        destacado: false,
        "promotion.active": false,
        "promotion.expiredAt": Timestamp.now(),
        updatedAt: Timestamp.now(),
    }));
    await batch.commit();
    return expired.length;
};

const runBillingMaintenance = async () => {
    const nowMs = Date.now();
    const todayDateKey = getArgentinaDateKey(nowMs);
    const contractsSnap = await db.collection(CONTRACTS_COLLECTION)
        .where("status", "==", "active")
        .limit(500)
        .get();
    let chargesProcessed = 0;
    for (const contractSnap of contractsSnap.docs) {
        const nextBillingAtMs = timestampToMillis(
            contractSnap.data()?.nextBillingAt,
        );
        if (!nextBillingAtMs || nextBillingAtMs > nowMs) continue;
        chargesProcessed += await processRecurringContract(contractSnap, nowMs);
    }
    const interestResult = await processMoratoryInterests(todayDateKey);
    const contractsCompleted = await completeEndedContracts(todayDateKey);
    const highlightsExpired = await expireFinishedHighlights(nowMs);
    const result = {
        todayDateKey,
        activeContracts: contractsSnap.size,
        chargesProcessed,
        interestCapitalizations: interestResult.capitalizations,
        interestObligationsReviewed: interestResult.obligations,
        contractsCompleted,
        highlightsExpired,
    };
    console.info("Billing maintenance completed", result);
    return result;
};

export const billingRunMaintenance = onCall(
    { region: REGION, invoker: "public", timeoutSeconds: 540 },
    async (request) => {
        await assertRoot(request.auth?.uid);
        return runBillingMaintenance();
    },
);

export const billingGenerateRecurringCharges = onSchedule(
    {
        region: REGION,
        schedule: "every day 03:10",
        timeZone: "America/Argentina/Buenos_Aires",
        timeoutSeconds: 540,
    },
    runBillingMaintenance,
);
