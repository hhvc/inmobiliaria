import admin from "firebase-admin";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";

import {
    BILLING_CONTRACT_OPEN_STATUSES,
    addBillingIntervalMs,
    buildBillingSchedules,
    buildBillingPeriodKey,
    buildInitialBillingCatalog,
    catalogPricingRequiresQuote,
    cleanBillingText,
    getNextBillingAtMs,
    normalizeAmountMinor,
    normalizeBillingCode,
    normalizeCatalogBenefits,
    normalizeCountryCode,
    normalizeCurrencyCode,
    normalizePricingComponents,
} from "./billing.helpers.js";

if (!admin.apps.length) admin.initializeApp();

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;
const Timestamp = admin.firestore.Timestamp;
const REGION = "southamerica-east1";
const TERMS_VERSION = "2026-07-31";
const CATALOG_COLLECTION = "billing_catalog_items";
const CONTRACTS_COLLECTION = "billing_contracts";
const ACCOUNTS_COLLECTION = "billing_accounts";
const PAYMENT_REPORTS_COLLECTION = "billing_payment_reports";
const MAX_OVERVIEW_ITEMS = 300;

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
const paymentReportRef = (reportId) => db.collection(PAYMENT_REPORTS_COLLECTION).doc(reportId);

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
        reportsSnap,
        entitlementsSnap,
        usagesSnap,
        inmueblesSnap,
    ] = await Promise.all([
        assertInmobiliariaExists(inmobiliariaId),
        getCatalogItems({ activeOnly: true }),
        db.collection(CONTRACTS_COLLECTION)
            .where("inmobiliariaId", "==", inmobiliariaId)
            .limit(MAX_OVERVIEW_ITEMS)
            .get(),
        accountRef(inmobiliariaId).get(),
        entriesRef(inmobiliariaId).limit(MAX_OVERVIEW_ITEMS).get(),
        db.collection(PAYMENT_REPORTS_COLLECTION)
            .where("inmobiliariaId", "==", inmobiliariaId)
            .limit(MAX_OVERVIEW_ITEMS)
            .get(),
        entitlementsRef(inmobiliariaId).limit(MAX_OVERVIEW_ITEMS).get(),
        creditUsagesRef(inmobiliariaId).limit(100).get(),
        db.collection("inmobiliarias").doc(inmobiliariaId)
            .collection("inmuebles").limit(500).get(),
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
        paymentReports: sortDesc(reportsSnap.docs.map(serializeSnap), "updatedAt"),
        entitlements: sortDesc(entitlements, "updatedAt"),
        creditUsages: sortDesc(usagesSnap.docs.map(serializeSnap)),
        highlightCreditsAvailable,
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
        const [catalog, contractsSnap, reportsSnap, accountsSnap, inmoSnap] =
            await Promise.all([
                getCatalogItems(),
                db.collection(CONTRACTS_COLLECTION).limit(500).get(),
                db.collection(PAYMENT_REPORTS_COLLECTION).limit(500).get(),
                db.collection(ACCOUNTS_COLLECTION).limit(500).get(),
                db.collection("inmobiliarias").limit(500).get(),
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
        };
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
        const ref = db.collection(CONTRACTS_COLLECTION).doc();
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

        await ref.set(contract);
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
        await contractRef(contractId).update({
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
        });
        return { status: "rejected" };
    },
);

const createInitialContractCharges = async ({ contract, uid, startAtMs }) => {
    const entries = [];
    for (const component of normalizePricingComponents(contract.pricing)) {
        const amountMinor = normalizeAmountMinor(component.amountMinor);
        if (amountMinor === null || amountMinor === 0) continue;
        const totalAmount = amountMinor * Math.max(1, Number(contract.quantity || 1));
        const periodKey = component.recurrence === "once"
            ? "initial"
            : buildBillingPeriodKey(startAtMs, component.recurrence);
        const entry = await postLedgerEntry({
            inmobiliariaId: contract.inmobiliariaId,
            entryId: `contract_${contract.id}_${component.id}_${periodKey}`,
            type: component.recurrence === "once" ? "contract_charge" : "recurring_charge",
            direction: "debit",
            amountMinor: totalAmount,
            currency: component.currency,
            description: `${contract.catalogName}: ${component.label}`,
            contractId: contract.id,
            catalogItemId: contract.catalogItemId,
            createdBy: uid,
            metadata: {
                componentId: component.id,
                recurrence: component.recurrence,
                quantity: contract.quantity || 1,
                unitAmountMinor: amountMinor,
                periodKey,
            },
        });
        entries.push(entry);
    }
    return entries;
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
        const startAtMs = requestedStart || Date.now();
        const pricing = normalizePricingComponents(contract.pricing);
        if (pricing.some((component) => component.amountMinor === null)) {
            throw new HttpsError(
                "failed-precondition",
                "La contratación contiene importes pendientes de cotización.",
            );
        }

        const entries = await createInitialContractCharges({
            contract,
            uid,
            startAtMs,
        });
        const recurringSchedules = buildBillingSchedules({
            pricing,
            benefits: contract.benefits,
            startAtMs,
        });
        const nextBillingAtMs = getNextBillingAtMs(recurringSchedules);
        const nextStatus = entries.length > 0 ? "pending_payment" : "pending_setup";
        const now = Timestamp.now();
        await contractRef(contractId).update({
            status: nextStatus,
            pricing,
            serviceStartAt: Timestamp.fromMillis(startAtMs),
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
        });
        return {
            status: nextStatus,
            entries: entries.map((entry) => serializeValue(entry)),
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
        const paidAtMs = timestampToMillis(request.data?.paidAt) || Date.now();
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
        if (approve) {
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
        }

        const now = Timestamp.now();
        const status = approve ? "confirmed" : "rejected";
        await ref.update({
            status,
            resolutionNote: cleanBillingText(request.data?.note, 1000),
            resolvedAt: now,
            resolvedBy: uid,
            ledgerEntryId: entry?.id || "",
            updatedAt: now,
        });
        return { status, entry: entry ? serializeValue(entry) : null };
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
    const pricingById = new Map(
        normalizePricingComponents(contract.pricing)
            .map((component) => [component.id, component]),
    );
    const schedules = Array.isArray(contract.recurringSchedules)
        ? contract.recurringSchedules.map((schedule) => ({ ...schedule }))
        : [];
    let processed = 0;

    for (const schedule of schedules) {
        let nextAtMs = Number(schedule.nextBillingAtMs || 0);
        let safety = 0;
        while (nextAtMs && nextAtMs <= nowMs && safety < 24) {
            const component = pricingById.get(schedule.componentId);
            const recurrence = component?.recurrence || schedule.recurrence;
            if (!recurrence || recurrence === "once") break;
            const amountMinor = Number(component?.amountMinor || 0) *
                Math.max(1, Number(contract.quantity || 1));
            const periodKey = buildBillingPeriodKey(nextAtMs, recurrence);
            if (amountMinor > 0) {
                await postLedgerEntry({
                    inmobiliariaId: contract.inmobiliariaId,
                    entryId: `contract_${contract.id}_${component.id}_${periodKey}`,
                    type: "recurring_charge",
                    direction: "debit",
                    amountMinor,
                    currency: component.currency,
                    description: `${contract.catalogName}: ${component.label}`,
                    contractId: contract.id,
                    catalogItemId: contract.catalogItemId,
                    createdBy: "billing-scheduler",
                    metadata: {
                        componentId: component.id,
                        recurrence,
                        periodKey,
                    },
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
                nextPeriodMs: followingAtMs,
            });
            nextAtMs = followingAtMs;
            schedule.cycle = Number(schedule.cycle || 0) + 1;
            schedule.nextBillingAtMs = nextAtMs;
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

export const billingGenerateRecurringCharges = onSchedule(
    {
        region: REGION,
        schedule: "every day 03:10",
        timeZone: "America/Argentina/Buenos_Aires",
        timeoutSeconds: 540,
    },
    async () => {
        const nowMs = Date.now();
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
        const highlightsExpired = await expireFinishedHighlights(nowMs);
        console.info("Billing maintenance completed", {
            activeContracts: contractsSnap.size,
            chargesProcessed,
            highlightsExpired,
        });
    },
);
