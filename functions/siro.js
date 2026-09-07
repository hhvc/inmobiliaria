import crypto from "node:crypto";
import process from "node:process";

import admin from "firebase-admin";
import { defineSecret } from "firebase-functions/params";
import { HttpsError, onCall, onRequest } from "firebase-functions/v2/https";

import {
    buildSiroAssignmentId,
    buildSiroCpe,
    buildSiroCustomerCode,
    buildSiroReceiptNumber,
    cleanSiroText,
    createSiroPublicToken,
    extractSiroAgreements,
    extractSiroCallbackResultId,
    hashSiroPublicToken,
    isSiroPublicTokenValid,
    normalizeSiroAgreementId,
    normalizeSiroConcept,
    normalizeSiroPaymentStatus,
} from "./siro.helpers.js";

if (!admin.apps.length) admin.initializeApp();

const db = admin.firestore();
const Timestamp = admin.firestore.Timestamp;

const SIRO_HOMO_USERNAME = defineSecret("SIRO_HOMO_USERNAME");
const SIRO_HOMO_PASSWORD = defineSecret("SIRO_HOMO_PASSWORD");

const REGION = "southamerica-east1";
const SESSION_URL = "https://apisesionh.bancoroela.com.ar/auth/Sesion";
const AGREEMENTS_URL = "https://apisiroh.bancoroela.com.ar/siro/Convenios";
const PAYMENTS_URL = "https://siropagosh.bancoroela.com.ar/api/Pago";
const ASSIGNMENTS = "payment_provider_assignments";
const CONNECTIONS = "payment_provider_connections";
const ORDERS = "payment_provider_orders";
const CALLBACKS = "payment_provider_callbacks";
const ORDER_TTL_MS = 48 * 60 * 60 * 1000;
const TARGET_COLLECTIONS = { consortium: "condominiums" };
const sessionCache = new Map();

class SiroApiError extends Error {
    constructor(message, status = 500, data = null) {
        super(message);
        this.name = "SiroApiError";
        this.status = status;
        this.data = data;
    }
}

const timestampMillis = (value) => (
    value?.toMillis?.() || Number(value?.seconds || 0) * 1000 || 0
);

const serialize = (value) => {
    if (value?.toDate) return value.toDate().toISOString();
    if (Array.isArray(value)) return value.map(serialize);
    if (value && typeof value === "object") {
        return Object.fromEntries(Object.entries(value).map(([key, item]) => (
            [key, serialize(item)]
        )));
    }
    return value;
};

const userHasRole = (user = {}, role) => (
    user.role === role || user.primaryRole === role ||
    (Array.isArray(user.roles) && user.roles.includes(role))
);

const getUser = async (uid) => {
    if (!uid) throw new HttpsError("unauthenticated", "Tenés que iniciar sesión.");
    const snap = await db.collection("users").doc(uid).get();
    if (!snap.exists) {
        throw new HttpsError("permission-denied", "Perfil de usuario no encontrado.");
    }
    return snap.data() || {};
};

const assertAgencyManager = async (uid, inmobiliariaId) => {
    const safeId = cleanSiroText(inmobiliariaId, 128);
    if (!safeId) throw new HttpsError("invalid-argument", "Falta la inmobiliaria.");
    const user = await getUser(uid);
    const ids = Array.isArray(user.inmobiliarias) ? user.inmobiliarias : [];
    if (!userHasRole(user, "root") &&
        (!userHasRole(user, "admin") || !ids.includes(safeId))) {
        throw new HttpsError("permission-denied",
            "No tenés permisos para administrar esta inmobiliaria.");
    }
    return { user, isRoot: userHasRole(user, "root"), inmobiliariaId: safeId };
};

const assertConsortiumPortalAccess = async ({
    uid,
    authEmail,
    emailVerified,
    inmobiliariaId,
    obligation,
}) => {
    const user = await getUser(uid);
    const managerIds = Array.isArray(user.inmobiliarias) ? user.inmobiliarias : [];
    if (userHasRole(user, "root") ||
        (userHasRole(user, "admin") && managerIds.includes(inmobiliariaId))) return;
    const email = cleanSiroText(authEmail || user.email, 220).toLowerCase();
    if (!email || emailVerified === false || user.emailVerified === false) {
        throw new HttpsError("permission-denied", "El email debe estar verificado.");
    }
    const unitSnap = await db.collection("inmobiliarias").doc(inmobiliariaId)
        .collection("condominium_units").doc(obligation.unitId).get();
    const unit = unitSnap.data() || {};
    const emails = [
        ...(Array.isArray(unit.portalEmails) ? unit.portalEmails : []),
        ...(Array.isArray(unit.ownerPortalEmails) ? unit.ownerPortalEmails : []),
        ...(Array.isArray(unit.occupantPortalEmails) ? unit.occupantPortalEmails : []),
    ].map((value) => cleanSiroText(value, 220).toLowerCase());
    if (!unitSnap.exists || !emails.includes(email)) {
        throw new HttpsError("permission-denied",
            "No tenés acceso a la unidad de esta expensa.");
    }
};

const getCredentials = () => {
    const username = SIRO_HOMO_USERNAME.value().trim();
    const password = SIRO_HOMO_PASSWORD.value().trim();
    if (!username || !password) {
        throw new Error("Faltan las credenciales de homologación de SIRO.");
    }
    return { username, password };
};

const apiFetch = async (url, { token = "", method = "GET", body } = {}) => {
    const response = await fetch(url, {
        method,
        headers: {
            accept: "application/json",
            ...(body ? { "content-type": "application/json" } : {}),
            ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(27000),
    });
    const text = await response.text();
    let data = null;
    try {
        data = text ? JSON.parse(text) : null;
    } catch {
        data = { Message: text };
    }
    if (!response.ok) {
        const message = cleanSiroText(
            data?.Message || data?.message || data?.error_description ||
            data?.error || `SIRO respondió HTTP ${response.status}`,
            1000,
        );
        throw new SiroApiError(message, response.status, data);
    }
    return data;
};

const getSessionToken = async () => {
    const credentials = getCredentials();
    const cacheKey = crypto.createHash("sha256")
        .update(credentials.username).digest("hex");
    const cached = sessionCache.get(cacheKey);
    if (cached && cached.expiresAtMs > Date.now() + 60000) return cached.token;
    const data = await apiFetch(SESSION_URL, {
        method: "POST",
        body: { Usuario: credentials.username, Password: credentials.password },
    });
    const token = cleanSiroText(data?.access_token, 4000);
    if (!token) throw new SiroApiError("SIRO no devolvió un token de sesión.");
    const expiresIn = Math.max(60, Number(data?.expires_in || 3599));
    sessionCache.set(cacheKey, {
        token,
        expiresAtMs: Date.now() + expiresIn * 1000,
    });
    return token;
};

const fetchAgreements = async (token) => {
    const data = await apiFetch(AGREEMENTS_URL, { token });
    return extractSiroAgreements(data);
};

const connectionIdFor = (inmobiliariaId) => `siro_homologation_${
    cleanSiroText(inmobiliariaId, 128).replace(/[^A-Za-z0-9_-]/g, "")}`;

const getProjectId = () => process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT ||
    process.env.GOOGLE_CLOUD_PROJECT || "inmobiliaria-bcc63";

const getCallbackUrl = (callbackToken) => `https://${REGION}-${
    getProjectId()}.cloudfunctions.net/siroPaymentCallback?c=${
    encodeURIComponent(callbackToken)}`;

const getPortalResultUrl = ({ orderId, token }) => (
    `https://onoprop.com/pagos/resultado?provider=siro&order=${
        encodeURIComponent(orderId)}&token=${encodeURIComponent(token)}`
);

const publicOrder = (snap) => {
    const order = snap.data() || {};
    return serialize({
        id: snap.id,
        provider: "siro",
        environment: order.environment || "homologation",
        contextType: order.contextType,
        inmobiliariaId: order.inmobiliariaId || "",
        targetType: order.targetType || "",
        targetId: order.targetId || "",
        obligationId: order.obligationId || "",
        title: order.title,
        amountMinor: order.amountMinor,
        currency: order.currency,
        status: order.status,
        credited: order.credited === true,
        simulatedApproved: order.simulatedApproved === true,
        needsReview: order.needsReview === true,
        reviewReason: order.reviewReason || "",
        providerPaymentId: order.providerPaymentId || "",
        providerStatus: order.providerStatus || "",
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
    });
};

export const siroGetConfiguration = onCall({
    region: REGION,
    invoker: "public",
}, async (request) => {
    const inmobiliariaId = cleanSiroText(request.data?.inmobiliariaId, 128);
    await assertAgencyManager(request.auth?.uid, inmobiliariaId);
    const [connectionSnap, assignmentsSnap, ordersSnap] = await Promise.all([
        db.collection(CONNECTIONS).doc(connectionIdFor(inmobiliariaId)).get(),
        db.collection(ASSIGNMENTS)
            .where("inmobiliariaId", "==", inmobiliariaId).get(),
        db.collection(ORDERS)
            .where("inmobiliariaId", "==", inmobiliariaId).limit(100).get(),
    ]);
    const orders = ordersSnap.docs
        .filter((snap) => snap.data()?.provider === "siro")
        .sort((a, b) => timestampMillis(b.data()?.createdAt) -
            timestampMillis(a.data()?.createdAt))
        .slice(0, 30)
        .map(publicOrder);
    return serialize({
        environment: "homologation",
        connected: connectionSnap.exists && connectionSnap.data()?.ok === true,
        lastTestAt: connectionSnap.data()?.lastTestAt || null,
        lastError: connectionSnap.data()?.lastError || "",
        agreements: connectionSnap.data()?.agreements || [],
        assignments: assignmentsSnap.docs
            .map((snap) => ({ id: snap.id, ...snap.data() }))
            .filter((item) => item.provider === "siro"),
        orders,
        callbackUrl: getCallbackUrl("TOKEN_INTERNO"),
    });
});

export const siroTestHomologation = onCall({
    region: REGION,
    invoker: "public",
    secrets: [SIRO_HOMO_USERNAME, SIRO_HOMO_PASSWORD],
}, async (request) => {
    const inmobiliariaId = cleanSiroText(request.data?.inmobiliariaId, 128);
    const { isRoot } = await assertAgencyManager(
        request.auth?.uid, inmobiliariaId,
    );
    if (!isRoot) {
        throw new HttpsError("permission-denied",
            "La homologación de SIRO está reservada para ONO Prop.");
    }
    const connectionRef = db.collection(CONNECTIONS)
        .doc(connectionIdFor(inmobiliariaId));
    try {
        const token = await getSessionToken();
        const agreements = await fetchAgreements(token);
        await connectionRef.set({
            provider: "siro",
            environment: "homologation",
            inmobiliariaId,
            ok: true,
            agreements,
            lastError: "",
            lastTestAt: Timestamp.now(),
            updatedBy: request.auth.uid,
            updatedAt: Timestamp.now(),
            createdAt: Timestamp.now(),
        }, { merge: true });
        return { ok: true, agreements };
    } catch (error) {
        console.error("Prueba SIRO", { inmobiliariaId, error });
        await connectionRef.set({
            provider: "siro",
            environment: "homologation",
            inmobiliariaId,
            ok: false,
            lastError: cleanSiroText(error.message, 1000),
            lastTestAt: Timestamp.now(),
            updatedBy: request.auth.uid,
            updatedAt: Timestamp.now(),
            createdAt: Timestamp.now(),
        }, { merge: true });
        throw new HttpsError("unavailable",
            `No se pudo conectar con SIRO: ${cleanSiroText(error.message, 300)}`);
    }
});

export const siroSaveAssignment = onCall({
    region: REGION,
    invoker: "public",
}, async (request) => {
    const uid = request.auth?.uid;
    const inmobiliariaId = cleanSiroText(request.data?.inmobiliariaId, 128);
    const { isRoot } = await assertAgencyManager(uid, inmobiliariaId);
    if (!isRoot) {
        throw new HttpsError("permission-denied",
            "La homologación de SIRO está reservada para ONO Prop.");
    }
    const targetType = cleanSiroText(request.data?.targetType, 40);
    const targetId = cleanSiroText(request.data?.targetId, 128);
    const agreementId = normalizeSiroAgreementId(request.data?.agreementId);
    const treasuryAccountId = cleanSiroText(
        request.data?.treasuryAccountId, 128,
    );
    if (!TARGET_COLLECTIONS[targetType] || !targetId || !agreementId) {
        throw new HttpsError("invalid-argument", "La asignación de SIRO está incompleta.");
    }
    const base = db.collection("inmobiliarias").doc(inmobiliariaId);
    const targetRef = base.collection(TARGET_COLLECTIONS[targetType]).doc(targetId);
    const connectionRef = db.collection(CONNECTIONS)
        .doc(connectionIdFor(inmobiliariaId));
    const [targetSnap, connectionSnap, treasurySnap] = await Promise.all([
        targetRef.get(),
        connectionRef.get(),
        treasuryAccountId ? base.collection("condominium_treasury_accounts")
            .doc(treasuryAccountId).get() : null,
    ]);
    if (!targetSnap.exists) throw new HttpsError("not-found", "El consorcio no existe.");
    if (!connectionSnap.exists || connectionSnap.data()?.ok !== true) {
        throw new HttpsError("failed-precondition",
            "Probá primero la conexión de homologación con SIRO.");
    }
    const agreements = connectionSnap.data()?.agreements || [];
    const agreement = agreements.find((item) => item.id === agreementId);
    if (!agreement) {
        throw new HttpsError("invalid-argument",
            "El convenio no pertenece a la conexión probada.");
    }
    if (treasuryAccountId && (!treasurySnap?.exists ||
        treasurySnap.data()?.active === false ||
        treasurySnap.data()?.consortiumId !== targetId)) {
        throw new HttpsError("invalid-argument",
            "La cuenta de tesorería no está activa o no pertenece al consorcio.");
    }
    const assignmentId = buildSiroAssignmentId({
        targetType, inmobiliariaId, targetId,
    });
    await db.collection(ASSIGNMENTS).doc(assignmentId).set({
        provider: "siro",
        environment: "homologation",
        targetType,
        targetId,
        targetName: targetSnap.data()?.name || targetId,
        inmobiliariaId,
        agreementId,
        agreementName: agreement.name || `Convenio ${agreementId}`,
        administratorCuit: agreement.administratorCuit || "",
        treasuryAccountId,
        active: true,
        updatedBy: uid,
        updatedAt: Timestamp.now(),
        createdAt: Timestamp.now(),
    }, { merge: true });
    return { assignmentId };
});

export const siroDisableAssignment = onCall({
    region: REGION,
    invoker: "public",
}, async (request) => {
    const uid = request.auth?.uid;
    const inmobiliariaId = cleanSiroText(request.data?.inmobiliariaId, 128);
    const { isRoot } = await assertAgencyManager(uid, inmobiliariaId);
    if (!isRoot) {
        throw new HttpsError("permission-denied",
            "La homologación de SIRO está reservada para ONO Prop.");
    }
    const targetType = cleanSiroText(request.data?.targetType, 40);
    const targetId = cleanSiroText(request.data?.targetId, 128);
    const assignmentId = buildSiroAssignmentId({
        targetType, inmobiliariaId, targetId,
    });
    const ref = db.collection(ASSIGNMENTS).doc(assignmentId);
    const snap = await ref.get();
    if (snap.exists && snap.data()?.inmobiliariaId === inmobiliariaId) {
        await ref.update({
            active: false,
            updatedBy: uid,
            updatedAt: Timestamp.now(),
        });
    }
    return { disabled: true };
});

const resolveSiroCheckoutContext = async ({ request, inmobiliariaId, obligationId }) => {
    if (!request.auth?.uid) {
        throw new HttpsError("unauthenticated", "Tenés que iniciar sesión.");
    }
    const base = db.collection("inmobiliarias").doc(inmobiliariaId);
    const obligationSnap = await base.collection("condominium_obligations")
        .doc(obligationId).get();
    if (!obligationSnap.exists) {
        throw new HttpsError("not-found", "La expensa no existe.");
    }
    const obligation = obligationSnap.data() || {};
    await assertConsortiumPortalAccess({
        uid: request.auth.uid,
        authEmail: request.auth.token?.email,
        emailVerified: request.auth.token?.email_verified,
        inmobiliariaId,
        obligation,
    });
    const targetId = obligation.consortiumId;
    const assignmentId = buildSiroAssignmentId({
        targetType: "consortium", inmobiliariaId, targetId,
    });
    const assignmentSnap = await db.collection(ASSIGNMENTS).doc(assignmentId).get();
    if (!assignmentSnap.exists || assignmentSnap.data()?.provider !== "siro" ||
        assignmentSnap.data()?.active !== true) {
        throw new HttpsError("failed-precondition",
            "El consorcio todavía no habilitó cobros con SIRO.");
    }
    const amountMinor = Math.max(0, Number(obligation.balanceMinor || 0));
    if (!amountMinor) {
        throw new HttpsError("failed-precondition", "La expensa no tiene saldo pendiente.");
    }
    if ((obligation.currency || "ARS") !== "ARS") {
        throw new HttpsError("failed-precondition", "SIRO opera este cobro en pesos.");
    }
    const assignment = assignmentSnap.data() || {};
    const customerCode = buildSiroCustomerCode({
        inmobiliariaId,
        consortiumId: targetId,
        unitId: obligation.unitId,
    });
    const cpe = buildSiroCpe({
        customerCode,
        agreementId: assignment.agreementId,
    });
    if (!cpe) throw new HttpsError("failed-precondition", "El convenio SIRO es inválido.");
    return {
        inmobiliariaId,
        targetType: "consortium",
        targetId,
        obligationId,
        unitId: obligation.unitId,
        treasuryAccountId: assignment.treasuryAccountId || "",
        agreementId: assignment.agreementId,
        customerCode,
        cpe,
        receiptNumber: buildSiroReceiptNumber({
            obligationId,
            periodKey: obligation.periodKey,
            dueDate: obligation.dueDate,
        }),
        amountMinor,
        currency: "ARS",
        title: `Expensas ${obligation.periodKey || ""} · Unidad ${
            obligation.unitSnapshot?.code || obligation.unitId}`,
    };
};

export const siroCreateCheckout = onCall({
    region: REGION,
    invoker: "public",
    secrets: [SIRO_HOMO_USERNAME, SIRO_HOMO_PASSWORD],
}, async (request) => {
    const contextType = cleanSiroText(request.data?.contextType, 60);
    if (contextType !== "consortium_obligation") {
        throw new HttpsError("invalid-argument",
            "La homologación de SIRO está habilitada únicamente para expensas.");
    }
    const inmobiliariaId = cleanSiroText(request.data?.inmobiliariaId, 128);
    const obligationId = cleanSiroText(request.data?.obligationId, 128);
    const context = await resolveSiroCheckoutContext({
        request, inmobiliariaId, obligationId,
    });
    const operationId = cleanSiroText(request.data?.operationId, 128)
        .replace(/[^A-Za-z0-9_-]/g, "") || `siro_${crypto.randomUUID()}`;
    const orderRef = db.collection(ORDERS).doc(operationId);
    if ((await orderRef.get()).exists) {
        throw new HttpsError("already-exists",
            "La intención ya fue creada. Actualizá el estado antes de reintentar.");
    }
    const publicToken = createSiroPublicToken();
    const callbackToken = crypto.randomBytes(12).toString("hex");
    const now = Timestamp.now();
    const order = {
        ...context,
        provider: "siro",
        environment: "homologation",
        contextType,
        status: "creating",
        credited: false,
        needsReview: false,
        publicTokenHash: hashSiroPublicToken(publicToken),
        callbackTokenHash: hashSiroPublicToken(callbackToken),
        createdBy: request.auth.uid,
        createdAt: now,
        updatedAt: now,
        expiresAtMs: Date.now() + ORDER_TTL_MS,
    };
    await orderRef.create(order);
    await db.collection(CALLBACKS).doc(callbackToken).create({
        provider: "siro",
        orderId: orderRef.id,
        createdAt: now,
        expiresAtMs: Date.now() + ORDER_TTL_MS,
    });
    const callbackUrl = getCallbackUrl(callbackToken);
    const payload = {
        Concepto: normalizeSiroConcept(context.title) || "Expensas",
        Detalle: [{
            Descripcion: normalizeSiroConcept(context.title) || "Expensas",
            Importe: context.amountMinor / 100,
        }],
        Importe: context.amountMinor / 100,
        URL_OK: callbackUrl,
        nro_comprobante: context.receiptNumber,
        URL_ERROR: `${callbackUrl}&error=1`,
        IdReferenciaOperacion: orderRef.id,
        nro_cliente_empresa: context.cpe,
    };
    try {
        const token = await getSessionToken();
        const response = await apiFetch(PAYMENTS_URL, {
            token,
            method: "POST",
            body: payload,
        });
        const initPoint = cleanSiroText(response?.Url || response?.URL, 3000);
        const hash = cleanSiroText(response?.Hash || response?.hash, 200);
        if (!initPoint || !hash) {
            throw new SiroApiError("SIRO no devolvió el enlace y Hash esperados.");
        }
        await orderRef.update({
            initPoint,
            providerHash: hash,
            status: "pending",
            updatedAt: Timestamp.now(),
        });
        return {
            provider: "siro",
            environment: "homologation",
            orderId: orderRef.id,
            statusToken: publicToken,
            initPoint,
            status: "pending",
        };
    } catch (error) {
        console.error("Crear intención SIRO", { orderId: orderRef.id, error });
        await orderRef.update({
            status: "creation_failed",
            providerError: cleanSiroText(error.message, 1000),
            updatedAt: Timestamp.now(),
        });
        throw new HttpsError("unavailable",
            `SIRO no pudo iniciar el pago: ${cleanSiroText(error.message, 300)}`);
    }
});

const getResultReference = (result = {}) => cleanSiroText(
    result.IdReferenciaOperacion || result.idReferenciaOperacion ||
    result.idReferenciOperacion,
    128,
);

const getResultOperationId = (result = {}) => cleanSiroText(
    result.IdOperacion || result.idOperacion || result.id_resultado,
    128,
);

const applyConsortiumPayment = async ({ orderSnap, result }) => {
    const order = { id: orderSnap.id, ...orderSnap.data() };
    const providerPaymentId = getResultOperationId(result) ||
        crypto.createHash("sha256").update(orderSnap.id).digest("hex").slice(0, 32);
    const safePaymentId = providerPaymentId.replace(/[^A-Za-z0-9_-]/g, "");
    const base = db.collection("inmobiliarias").doc(order.inmobiliariaId);
    const obligationRef = base.collection("condominium_obligations")
        .doc(order.obligationId);
    const paymentRef = base.collection("condominium_payments")
        .doc(`siro_${safePaymentId}`);
    const movementRef = base.collection("condominium_treasury_movements")
        .doc(`siro_${safePaymentId}`);
    let applied = {};
    await db.runTransaction(async (transaction) => {
        const treasuryAccountRef = order.treasuryAccountId
            ? base.collection("condominium_treasury_accounts")
                .doc(order.treasuryAccountId) : null;
        const [obligationSnap, paymentSnap, accountSnap] = await Promise.all([
            transaction.get(obligationRef),
            transaction.get(paymentRef),
            treasuryAccountRef ? transaction.get(treasuryAccountRef) : null,
        ]);
        if (paymentSnap.exists) {
            applied = { paymentId: paymentRef.id, idempotent: true };
            return;
        }
        if (!obligationSnap.exists) throw new Error("La expensa no existe.");
        const obligation = obligationSnap.data() || {};
        const balance = Math.max(0, Number(obligation.balanceMinor || 0));
        if (order.amountMinor > balance) {
            applied = { needsReview: true, reason: "El saldo cambió antes de acreditarse." };
            return;
        }
        const informedMajor = Number(result?.Request?.Importe ?? result?.request?.importe);
        if (Number.isFinite(informedMajor) &&
            Math.round(informedMajor * 100) !== order.amountMinor) {
            applied = { needsReview: true, reason: "SIRO informó un importe diferente." };
            return;
        }
        const paidAmountMinor = Number(obligation.paidAmountMinor || 0) +
            order.amountMinor;
        const balanceMinor = Math.max(0,
            Number(obligation.totalAmountMinor || 0) - paidAmountMinor);
        const date = cleanSiroText(
            result.FechaOperacion || result.fechaOperacion, 10,
        ) || new Date().toISOString().slice(0, 10);
        transaction.set(paymentRef, {
            id: paymentRef.id,
            obligationId: order.obligationId,
            consortiumId: obligation.consortiumId,
            periodId: obligation.periodId || "",
            periodKey: obligation.periodKey || "",
            source: obligation.source || "monthly_assessment",
            unitId: obligation.unitId,
            unitSnapshot: obligation.unitSnapshot || {},
            currency: obligation.currency || "ARS",
            amountMinor: order.amountMinor,
            date,
            method: "siro",
            reference: `SIRO ${providerPaymentId}`,
            notes: "Acreditado automáticamente por consulta a SIRO.",
            treasuryAccountId: order.treasuryAccountId || "",
            treasuryMovementId: order.treasuryAccountId ? movementRef.id : "",
            provider: "siro",
            providerPaymentId,
            providerOrderId: order.id,
            providerFeeMinor: 0,
            providerDeductionMinor: 0,
            netReceivedAmountMinor: order.amountMinor,
            providerFeeDetails: [],
            providerStatus: "approved",
            providerReversedAmountMinor: 0,
            voided: false,
            inmobiliariaId: order.inmobiliariaId,
            ownerInmobiliariaId: order.inmobiliariaId,
            createdBy: "siro_reconciliation",
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
        });
        if (treasuryAccountRef && accountSnap?.exists &&
            accountSnap.data()?.active !== false) {
            const account = accountSnap.data() || {};
            transaction.set(movementRef, {
                id: movementRef.id,
                schemaVersion: 1,
                inmobiliariaId: order.inmobiliariaId,
                ownerInmobiliariaId: order.inmobiliariaId,
                consortiumId: obligation.consortiumId,
                accountId: order.treasuryAccountId,
                accountSnapshot: {
                    name: account.name || "SIRO",
                    type: account.type || "bank",
                },
                source: "consortium_collection",
                sourceId: paymentRef.id,
                direction: "inflow",
                amountMinor: order.amountMinor,
                currency: obligation.currency || "ARS",
                date,
                concept: `Cobro SIRO · Unidad ${
                    obligation.unitSnapshot?.code || obligation.unitId}`,
                reference: providerPaymentId,
                voided: false,
                createdBy: "siro_reconciliation",
                createdAt: Timestamp.now(),
            });
            transaction.update(treasuryAccountRef, {
                currentBalanceMinor: Number(account.currentBalanceMinor || 0) +
                    order.amountMinor,
                updatedBy: "siro_reconciliation",
                updatedAt: Timestamp.now(),
            });
        }
        transaction.update(obligationRef, {
            paidAmountMinor,
            balanceMinor,
            status: balanceMinor <= 0 ? "paid" : "partial",
            paymentIds: [
                ...(Array.isArray(obligation.paymentIds) ? obligation.paymentIds : []),
                paymentRef.id,
            ],
            updatedBy: "siro_reconciliation",
            updatedAt: Timestamp.now(),
        });
        applied = { paymentId: paymentRef.id, idempotent: false };
    });
    return applied;
};

const queryOrderStatus = async (orderSnap, resultId = "") => {
    const order = { id: orderSnap.id, ...orderSnap.data() };
    const token = await getSessionToken();
    let results;
    if (resultId && order.providerHash) {
        const url = `${PAYMENTS_URL}/${encodeURIComponent(order.providerHash)}/${
            encodeURIComponent(resultId)}`;
        results = [await apiFetch(url, { token, method: "POST", body: {
            hash: order.providerHash,
            id_resultado: resultId,
        } })];
    } else {
        const from = new Date(timestampMillis(order.createdAt) - 24 * 60 * 60 * 1000);
        const to = new Date(Date.now() + 24 * 60 * 60 * 1000);
        const response = await apiFetch(`${PAYMENTS_URL}/Consulta`, {
            token,
            method: "POST",
            body: {
                FechaDesde: from.toISOString(),
                FechaHasta: to.toISOString(),
                idReferenciaOperacion: order.id,
            },
        });
        results = Array.isArray(response) ? response : [response].filter(Boolean);
    }
    const result = results.find((item) => getResultReference(item) === order.id) ||
        results[0];
    if (!result) return { status: "pending", credited: false };
    const status = normalizeSiroPaymentStatus(result);
    const providerPaymentId = getResultOperationId(result);
    const update = {
        status,
        providerStatus: cleanSiroText(result.Estado || result.estado, 80),
        providerStatusMessage: cleanSiroText(
            result.MensajeResultado || result.mensajeResultado, 500,
        ),
        providerPaymentId,
        lastSyncAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
    };
    if (status === "approved" && order.environment === "homologation") {
        Object.assign(update, {
            credited: false,
            simulatedApproved: true,
            needsReview: false,
            reviewReason: "",
        });
    } else if (status === "approved" && order.credited !== true) {
        const applied = await applyConsortiumPayment({ orderSnap, result });
        if (applied.needsReview) {
            Object.assign(update, {
                credited: false,
                needsReview: true,
                reviewReason: applied.reason,
            });
        } else {
            Object.assign(update, {
                credited: true,
                needsReview: false,
                reviewReason: "",
                creditedAt: Timestamp.now(),
                application: applied,
            });
        }
    }
    await orderSnap.ref.update(update);
    return { ...update, result };
};

export const siroGetOrderStatus = onCall({
    region: REGION,
    invoker: "public",
    secrets: [SIRO_HOMO_USERNAME, SIRO_HOMO_PASSWORD],
}, async (request) => {
    const orderId = cleanSiroText(request.data?.orderId, 128);
    const token = cleanSiroText(request.data?.statusToken, 300);
    let snap = await db.collection(ORDERS).doc(orderId).get();
    const tokenIsValid = snap.exists && (
        isSiroPublicTokenValid(token, snap.data()?.publicTokenHash) ||
        isSiroPublicTokenValid(token, snap.data()?.callbackTokenHash)
    );
    if (!snap.exists || snap.data()?.provider !== "siro" || !tokenIsValid) {
        throw new HttpsError("permission-denied", "El enlace de pago no es válido.");
    }
    const order = snap.data() || {};
    if (order.credited !== true && ["pending", "in_process"].includes(order.status) &&
        Date.now() - timestampMillis(order.lastSyncAt) > 10000) {
        try {
            await queryOrderStatus(snap);
            snap = await snap.ref.get();
        } catch (error) {
            console.warn("Consulta de estado SIRO", { orderId, message: error.message });
        }
    }
    return publicOrder(snap);
});

export const siroSyncOrder = onCall({
    region: REGION,
    invoker: "public",
    secrets: [SIRO_HOMO_USERNAME, SIRO_HOMO_PASSWORD],
}, async (request) => {
    const orderId = cleanSiroText(request.data?.orderId, 128);
    const snap = await db.collection(ORDERS).doc(orderId).get();
    if (!snap.exists || snap.data()?.provider !== "siro") {
        throw new HttpsError("not-found", "La orden SIRO no existe.");
    }
    await assertAgencyManager(request.auth?.uid, snap.data()?.inmobiliariaId);
    await queryOrderStatus(snap);
    return { synced: true };
});

export const siroPaymentCallback = onRequest({
    region: REGION,
    invoker: "public",
    secrets: [SIRO_HOMO_USERNAME, SIRO_HOMO_PASSWORD],
}, async (request, response) => {
    const callbackToken = cleanSiroText(request.query.c, 100);
    const callbackSnap = await db.collection(CALLBACKS).doc(callbackToken).get();
    if (!callbackSnap.exists || callbackSnap.data()?.provider !== "siro" ||
        Number(callbackSnap.data()?.expiresAtMs || 0) < Date.now()) {
        response.status(400).send("La referencia de pago no es válida o venció.");
        return;
    }
    const orderRef = db.collection(ORDERS).doc(callbackSnap.data().orderId);
    let orderSnap = await orderRef.get();
    if (!orderSnap.exists || !isSiroPublicTokenValid(
        callbackToken, orderSnap.data()?.callbackTokenHash,
    )) {
        response.status(400).send("La referencia de pago no coincide.");
        return;
    }
    const callbackData = { ...request.query, ...(request.body || {}) };
    const resultId = extractSiroCallbackResultId(callbackData);
    try {
        await orderRef.update({
            callbackReceivedAt: Timestamp.now(),
            callbackResultId: resultId,
            callbackReportedError: request.query.error === "1",
            updatedAt: Timestamp.now(),
        });
        orderSnap = await orderRef.get();
        await queryOrderStatus(orderSnap, resultId);
    } catch (error) {
        console.error("Callback SIRO", { orderId: orderSnap.id, error });
        await orderRef.update({
            needsReview: true,
            reviewReason: cleanSiroText(error.message, 500),
            updatedAt: Timestamp.now(),
        });
    }
    const acceptsHtml = cleanSiroText(request.get("accept"), 300)
        .includes("text/html");
    if (acceptsHtml || request.method === "GET") {
        response.redirect(302, getPortalResultUrl({
            orderId: orderSnap.id,
            token: callbackToken,
        }));
        return;
    }
    response.status(200).json({ received: true });
});
