import { Buffer } from "node:buffer";
import crypto from "node:crypto";
import process from "node:process";

import admin from "firebase-admin";
import { defineSecret } from "firebase-functions/params";
import { HttpsError, onCall, onRequest } from "firebase-functions/v2/https";

import {
    applyApprovedBillingProviderPayment,
    applyBillingProviderPaymentReversal,
    refreshBillingInterestsForCheckout,
} from "./billing.js";
import {
    buildMercadoPagoAccountId,
    buildMercadoPagoAssignmentId,
    cleanMercadoPagoText,
    createMercadoPagoStatusToken,
    getMercadoPagoPaymentCostSummary,
    getMercadoPagoReversalSummary,
    hashMercadoPagoStatusToken,
    isMercadoPagoStatusTokenValid,
    mercadoPagoMinorToMajor,
    normalizeMercadoPagoAmountMinor,
    normalizeMercadoPagoCurrency,
    verifyMercadoPagoWebhookSignature,
} from "./mercadopago.helpers.js";

if (!admin.apps.length) admin.initializeApp();

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;
const Timestamp = admin.firestore.Timestamp;

const MERCADOPAGO_CLIENT_ID = defineSecret("MERCADOPAGO_CLIENT_ID");
const MERCADOPAGO_CLIENT_SECRET = defineSecret("MERCADOPAGO_CLIENT_SECRET");
const MERCADOPAGO_REDIRECT_URI = defineSecret("MERCADOPAGO_REDIRECT_URI");
const MERCADOPAGO_TOKEN_ENCRYPTION_KEY = defineSecret(
    "MERCADOPAGO_TOKEN_ENCRYPTION_KEY",
);
const MERCADOPAGO_WEBHOOK_SECRET = defineSecret("MERCADOPAGO_WEBHOOK_SECRET");

const REGION = "southamerica-east1";
const API_BASE = "https://api.mercadopago.com";
const AUTH_URL = "https://auth.mercadopago.com/authorization";
const STATE_TTL_MS = 10 * 60 * 1000;
const TOKEN_MARGIN_MS = 10 * 60 * 1000;
const ORDER_TTL_MS = 48 * 60 * 60 * 1000;
const ACCOUNTS = "mercadopago_accounts";
const ACCOUNT_LINKS = "mercadopago_account_links";
const STATES = "mercadopago_oauth_states";
const ASSIGNMENTS = "mercadopago_assignments";
const ORDERS = "mercadopago_orders";
const WEBHOOK_EVENTS = "mercadopago_webhook_events";
const DONATIONS = "mercadopago_donations";
const TARGET_COLLECTIONS = {
    consortium: "condominiums",
    rental_contract: "rental_contracts",
};
const CONTEXTS = new Set([
    "consortium_obligation",
    "rental_obligation",
    "billing_account",
    "billing_obligation",
    "donation",
]);

class MercadoPagoApiError extends Error {
    constructor(message, status = 500, data = null) {
        super(message);
        this.name = "MercadoPagoApiError";
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

const assertRoot = async (uid) => {
    const user = await getUser(uid);
    if (!userHasRole(user, "root")) {
        throw new HttpsError("permission-denied",
            "Esta operación está reservada para ONO Prop.");
    }
    return user;
};

const assertAgencyManager = async (uid, inmobiliariaId) => {
    const safeId = cleanMercadoPagoText(inmobiliariaId, 128);
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

const parseEncryptionKey = () => {
    const raw = MERCADOPAGO_TOKEN_ENCRYPTION_KEY.value().trim();
    const key = Buffer.from(raw, "base64");
    if (key.length !== 32) {
        throw new Error(
            "MERCADOPAGO_TOKEN_ENCRYPTION_KEY debe contener 32 bytes en Base64.",
        );
    }
    return key;
};

const encryptToken = (value) => {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", parseEncryptionKey(), iv);
    const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    return {
        iv: iv.toString("base64"),
        tag: cipher.getAuthTag().toString("base64"),
        value: encrypted.toString("base64"),
    };
};

const decryptToken = (payload = {}) => {
    const decipher = crypto.createDecipheriv(
        "aes-256-gcm",
        parseEncryptionKey(),
        Buffer.from(payload.iv || "", "base64"),
    );
    decipher.setAuthTag(Buffer.from(payload.tag || "", "base64"));
    return Buffer.concat([
        decipher.update(Buffer.from(payload.value || "", "base64")),
        decipher.final(),
    ]).toString("utf8");
};

const apiFetch = async (
    path,
    { token = "", method = "GET", body, headers = {} } = {},
) => {
    const response = await fetch(`${API_BASE}${path}`, {
        method,
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...headers,
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        const message = data?.message || data?.error ||
            "Mercado Pago rechazó la operación.";
        throw new MercadoPagoApiError(message, response.status, data);
    }
    return data;
};

const exchangeToken = async (body) => {
    const response = await fetch(`${API_BASE}/oauth/token`, {
        method: "POST",
        headers: {
            Accept: "application/json",
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new MercadoPagoApiError(
            data?.message || data?.error || "No se pudo autorizar Mercado Pago.",
            response.status,
            data,
        );
    }
    return data;
};

const saveTokens = async (
    accountRef,
    account,
    tokenData,
    { preserveRefreshToken = true } = {},
) => {
    const now = Date.now();
    await accountRef.set({
        accessTokenEncrypted: encryptToken(tokenData.access_token),
        refreshTokenEncrypted: tokenData.refresh_token
            ? encryptToken(tokenData.refresh_token)
            : preserveRefreshToken ? account.refreshTokenEncrypted || null : null,
        expiresAtMs: now + Number(tokenData.expires_in || 0) * 1000,
        scope: cleanMercadoPagoText(tokenData.scope, 500),
        connected: true,
        requiresReconnect: false,
        tokenUpdatedAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
    }, { merge: true });
};

const requestClientCredentialsToken = () => exchangeToken({
    grant_type: "client_credentials",
    client_id: MERCADOPAGO_CLIENT_ID.value(),
    client_secret: MERCADOPAGO_CLIENT_SECRET.value(),
});

const getAccessToken = async (accountId) => {
    const ref = db.collection(ACCOUNTS).doc(accountId);
    const snap = await ref.get();
    if (!snap.exists || snap.data()?.connected !== true) {
        throw new HttpsError("failed-precondition",
            "La cuenta de Mercado Pago no está conectada.");
    }
    let account = snap.data() || {};
    if (Number(account.expiresAtMs || 0) > Date.now() + TOKEN_MARGIN_MS) {
        return { account, token: decryptToken(account.accessTokenEncrypted) };
    }
    if (account.authMode === "client_credentials") {
        const tokenData = await requestClientCredentialsToken();
        await saveTokens(ref, account, tokenData, { preserveRefreshToken: false });
        account = {
            ...account,
            expiresAtMs: Date.now() + Number(tokenData.expires_in || 0) * 1000,
        };
        return { account, token: tokenData.access_token };
    }
    if (!account.refreshTokenEncrypted) {
        await ref.update({ requiresReconnect: true, updatedAt: Timestamp.now() });
        throw new HttpsError("failed-precondition",
            "Mercado Pago requiere volver a conectar la cuenta.");
    }
    const tokenData = await exchangeToken({
        grant_type: "refresh_token",
        client_id: MERCADOPAGO_CLIENT_ID.value(),
        client_secret: MERCADOPAGO_CLIENT_SECRET.value(),
        refresh_token: decryptToken(account.refreshTokenEncrypted),
    });
    await saveTokens(ref, account, tokenData);
    account = { ...account, expiresAtMs: Date.now() +
        Number(tokenData.expires_in || 0) * 1000 };
    return { account, token: tokenData.access_token };
};

const publicAccount = (snap) => {
    if (!snap?.exists) return null;
    const value = snap.data() || {};
    return serialize({
        id: snap.id,
        ownerType: value.ownerType,
        ownerId: value.ownerId || "",
        connected: value.connected === true,
        requiresReconnect: value.requiresReconnect === true,
        mpUserId: value.mpUserId || "",
        nickname: value.nickname || "",
        email: value.email || "",
        siteId: value.siteId || "",
        testMode: value.testMode === true,
        authMode: value.authMode || "authorization_code",
        expiresAtMs: value.expiresAtMs || 0,
        updatedAt: value.updatedAt,
    });
};

const getProjectId = () => process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT ||
    admin.app().options.projectId;

const getWebhookUrl = () => (
    `https://${REGION}-${getProjectId()}.cloudfunctions.net/mercadoPagoWebhook`
);

const getPortalUrl = () => "https://onoprop.com";

const renderOAuthResult = ({ success, message }) => `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>Mercado Pago</title></head>
<body style="font-family:Arial,sans-serif;padding:32px;text-align:center">
<h1>${success ? "Cuenta conectada" : "No se pudo conectar"}</h1>
<p>${cleanMercadoPagoText(message, 500)
        .replaceAll("&", "&amp;").replaceAll("<", "&lt;")}</p>
<script>
window.opener?.postMessage({type:"onoprop:mercadopago-oauth",success:${success}},
"${getPortalUrl()}"); setTimeout(()=>window.close(),1200);
</script></body></html>`;

const persistConnectedAccount = async ({
    accountId,
    ownerType,
    ownerId,
    uid,
    testMode = false,
    authMode,
    tokenData,
    profile,
}) => {
    const mpUserId = cleanMercadoPagoText(profile.id, 80);
    if (!mpUserId) throw new Error("Mercado Pago no informó la cuenta conectada.");
    const linkRef = db.collection(ACCOUNT_LINKS).doc(mpUserId);
    const linkSnap = await linkRef.get();
    if (linkSnap.exists && linkSnap.data()?.accountId !== accountId) {
        throw new Error("Esta cuenta de Mercado Pago ya está vinculada a otro titular.");
    }
    const accountRef = db.collection(ACCOUNTS).doc(accountId);
    const previous = await accountRef.get();
    const previousData = previous.data?.() || {};
    const previousMpUserId = cleanMercadoPagoText(previousData.mpUserId, 80);
    if (previousMpUserId && previousMpUserId !== mpUserId) {
        await db.collection(ACCOUNT_LINKS).doc(previousMpUserId).delete();
    }
    await accountRef.set({
        ownerType,
        ownerId,
        mpUserId,
        nickname: cleanMercadoPagoText(profile.nickname, 160),
        email: cleanMercadoPagoText(profile.email, 220),
        siteId: cleanMercadoPagoText(profile.site_id, 20),
        testMode,
        authMode,
        connectedAt: Timestamp.now(),
        connectedBy: uid,
        createdAt: previous.exists ? previousData.createdAt || Timestamp.now() :
            Timestamp.now(),
    }, { merge: true });
    await saveTokens(accountRef, previousData, tokenData, {
        preserveRefreshToken: authMode !== "client_credentials",
    });
    await linkRef.set({ accountId, updatedAt: Timestamp.now() });
    return accountRef.get();
};

export const mercadoPagoConnectPlatform = onCall({
    region: REGION,
    invoker: "public",
    secrets: [
        MERCADOPAGO_CLIENT_ID,
        MERCADOPAGO_CLIENT_SECRET,
        MERCADOPAGO_TOKEN_ENCRYPTION_KEY,
    ],
}, async (request) => {
    const uid = request.auth?.uid;
    await assertRoot(uid);
    try {
        const tokenData = await requestClientCredentialsToken();
        const profile = await apiFetch("/users/me", { token: tokenData.access_token });
        const accountSnap = await persistConnectedAccount({
            accountId: "platform_onoprop",
            ownerType: "platform",
            ownerId: "onoprop",
            uid,
            authMode: "client_credentials",
            tokenData,
            profile,
        });
        return { account: publicAccount(accountSnap) };
    } catch (error) {
        console.error("Mercado Pago central connection", {
            message: error.message,
            status: error.status,
        });
        throw new HttpsError("failed-precondition",
            error.message || "No se pudo conectar la cuenta central de Mercado Pago.");
    }
});

export const mercadoPagoAuthStart = onCall({
    region: REGION,
    invoker: "public",
    secrets: [MERCADOPAGO_CLIENT_ID, MERCADOPAGO_REDIRECT_URI],
}, async (request) => {
    const uid = request.auth?.uid;
    const ownerType = request.data?.ownerType === "platform" ? "platform" : "agency";
    const ownerId = cleanMercadoPagoText(request.data?.ownerId, 128);
    if (ownerType === "platform") {
        throw new HttpsError("failed-precondition",
            "La cuenta central se conecta directamente con las credenciales de ONO Prop.");
    }
    await assertAgencyManager(uid, ownerId);
    const accountId = buildMercadoPagoAccountId({ ownerType, ownerId });
    const state = crypto.randomBytes(24).toString("base64url");
    const codeVerifier = crypto.randomBytes(48).toString("base64url");
    const codeChallenge = crypto.createHash("sha256")
        .update(codeVerifier).digest("base64url");
    await db.collection(STATES).doc(state).set({
        uid,
        accountId,
        ownerType,
        ownerId: ownerType === "platform" ? "onoprop" : ownerId,
        codeVerifier,
        testMode: request.data?.testMode === true,
        expiresAtMs: Date.now() + STATE_TTL_MS,
        createdAt: Timestamp.now(),
    });
    const url = new URL(AUTH_URL);
    url.searchParams.set("client_id", MERCADOPAGO_CLIENT_ID.value());
    url.searchParams.set("response_type", "code");
    url.searchParams.set("platform_id", "mp");
    url.searchParams.set("redirect_uri", MERCADOPAGO_REDIRECT_URI.value());
    url.searchParams.set("state", state);
    url.searchParams.set("scope", "offline_access read write");
    url.searchParams.set("code_challenge", codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");
    return { url: url.toString() };
});

export const mercadoPagoOAuthCallback = onRequest({
    region: REGION,
    invoker: "public",
    secrets: [
        MERCADOPAGO_CLIENT_ID,
        MERCADOPAGO_CLIENT_SECRET,
        MERCADOPAGO_REDIRECT_URI,
        MERCADOPAGO_TOKEN_ENCRYPTION_KEY,
    ],
}, async (request, response) => {
    try {
        const state = cleanMercadoPagoText(request.query.state, 200);
        const code = cleanMercadoPagoText(request.query.code, 1000);
        const stateRef = db.collection(STATES).doc(state);
        const stateSnap = await stateRef.get();
        if (!state || !code || !stateSnap.exists ||
            Number(stateSnap.data()?.expiresAtMs || 0) < Date.now()) {
            throw new Error("La autorización venció. Iniciá la conexión nuevamente.");
        }
        const oauth = stateSnap.data() || {};
        const tokenData = await exchangeToken({
            grant_type: "authorization_code",
            client_id: MERCADOPAGO_CLIENT_ID.value(),
            client_secret: MERCADOPAGO_CLIENT_SECRET.value(),
            code,
            redirect_uri: MERCADOPAGO_REDIRECT_URI.value(),
            code_verifier: oauth.codeVerifier,
            ...(oauth.testMode ? { test_token: "true" } : {}),
        });
        const profile = await apiFetch("/users/me", { token: tokenData.access_token });
        await persistConnectedAccount({
            accountId: oauth.accountId,
            ownerType: oauth.ownerType,
            ownerId: oauth.ownerId,
            uid: oauth.uid,
            testMode: oauth.testMode === true,
            authMode: "authorization_code",
            tokenData,
            profile,
        });
        await stateRef.delete();
        response.status(200).send(renderOAuthResult({
            success: true,
            message: `La cuenta ${profile.nickname || profile.id} quedó conectada.`,
        }));
    } catch (error) {
        console.error("Mercado Pago OAuth callback", error);
        response.status(400).send(renderOAuthResult({
            success: false,
            message: error.message || "No se pudo completar la conexión.",
        }));
    }
});

export const mercadoPagoGetConfiguration = onCall({
    region: REGION,
    invoker: "public",
}, async (request) => {
    const uid = request.auth?.uid;
    const inmobiliariaId = cleanMercadoPagoText(request.data?.inmobiliariaId, 128);
    const { isRoot } = await assertAgencyManager(uid, inmobiliariaId);
    const agencyId = buildMercadoPagoAccountId({
        ownerType: "agency",
        ownerId: inmobiliariaId,
    });
    const [
        agencySnap,
        platformSnap,
        assignmentsSnap,
        ordersSnap,
        donationOrdersSnap,
    ] = await Promise.all([
        db.collection(ACCOUNTS).doc(agencyId).get(),
        isRoot ? db.collection(ACCOUNTS).doc("platform_onoprop").get() : null,
        db.collection(ASSIGNMENTS)
            .where("inmobiliariaId", "==", inmobiliariaId).get(),
        db.collection(ORDERS).where("inmobiliariaId", "==", inmobiliariaId)
            .limit(100).get(),
        isRoot ? db.collection(ORDERS).where("contextType", "==", "donation")
            .limit(50).get() : null,
    ]);
    const orderDocs = new Map([
        ...ordersSnap.docs,
        ...(donationOrdersSnap?.docs || []),
    ].map((snap) => [snap.id, snap]));
    const orders = [...orderDocs.values()]
        .map((snap) => ({ id: snap.id, ...snap.data() }))
        .sort((a, b) => timestampMillis(b.createdAt) - timestampMillis(a.createdAt))
        .slice(0, 30)
        .map((order) => serialize({
            id: order.id,
            contextType: order.contextType,
            title: order.title,
            amountMinor: order.amountMinor,
            currency: order.currency,
            status: order.status,
            providerStatus: order.providerStatus || "",
            mpPaymentId: order.mpPaymentId || "",
            providerFeeMinor: order.providerFeeMinor || 0,
            providerDeductionMinor: order.providerDeductionMinor || 0,
            netReceivedAmountMinor: order.netReceivedAmountMinor || 0,
            reversedAmountMinor: order.reversedAmountMinor || 0,
            reviewReason: order.reviewReason || "",
            needsReview: order.needsReview === true,
            credited: order.credited === true,
            createdAt: order.createdAt,
            updatedAt: order.updatedAt,
        }));
    return {
        isRoot,
        accounts: [publicAccount(agencySnap), publicAccount(platformSnap)]
            .filter(Boolean),
        assignments: assignmentsSnap.docs.map((snap) => serialize({
            id: snap.id,
            ...snap.data(),
        })),
        orders,
        webhookUrl: getWebhookUrl(),
    };
});

export const mercadoPagoDisconnect = onCall({
    region: REGION,
    invoker: "public",
}, async (request) => {
    const accountId = cleanMercadoPagoText(request.data?.accountId, 180);
    const ref = db.collection(ACCOUNTS).doc(accountId);
    const snap = await ref.get();
    if (!snap.exists) return { disconnected: true };
    const account = snap.data() || {};
    if (account.ownerType === "platform") await assertRoot(request.auth?.uid);
    else await assertAgencyManager(request.auth?.uid, account.ownerId);
    await ref.update({
        connected: false,
        requiresReconnect: false,
        accessTokenEncrypted: FieldValue.delete(),
        refreshTokenEncrypted: FieldValue.delete(),
        disconnectedAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
    });
    return { disconnected: true };
});

export const mercadoPagoSaveAssignment = onCall({
    region: REGION,
    invoker: "public",
}, async (request) => {
    const uid = request.auth?.uid;
    const inmobiliariaId = cleanMercadoPagoText(request.data?.inmobiliariaId, 128);
    const { isRoot } = await assertAgencyManager(uid, inmobiliariaId);
    const targetType = cleanMercadoPagoText(request.data?.targetType, 40);
    const targetId = cleanMercadoPagoText(request.data?.targetId, 128);
    const accountId = cleanMercadoPagoText(request.data?.accountId, 180);
    if (!TARGET_COLLECTIONS[targetType] || !targetId || !accountId) {
        throw new HttpsError("invalid-argument", "La asignación está incompleta.");
    }
    const targetRef = db.collection("inmobiliarias").doc(inmobiliariaId)
        .collection(TARGET_COLLECTIONS[targetType]).doc(targetId);
    const accountRef = db.collection(ACCOUNTS).doc(accountId);
    const [targetSnap, accountSnap] = await Promise.all([
        targetRef.get(), accountRef.get(),
    ]);
    if (!targetSnap.exists) throw new HttpsError("not-found", "El destino no existe.");
    if (!accountSnap.exists || accountSnap.data()?.connected !== true) {
        throw new HttpsError("failed-precondition", "La cuenta no está conectada.");
    }
    const account = accountSnap.data() || {};
    if (!isRoot && (account.ownerType !== "agency" ||
        account.ownerId !== inmobiliariaId)) {
        throw new HttpsError("permission-denied",
            "Solo ONO Prop puede asignar la cuenta central.");
    }
    const treasuryAccountId = cleanMercadoPagoText(
        request.data?.treasuryAccountId, 128,
    );
    if (targetType === "consortium" && treasuryAccountId) {
        const treasurySnap = await db.collection("inmobiliarias")
            .doc(inmobiliariaId).collection("condominium_treasury_accounts")
            .doc(treasuryAccountId).get();
        if (!treasurySnap.exists || treasurySnap.data()?.active === false ||
            treasurySnap.data()?.consortiumId !== targetId) {
            throw new HttpsError("invalid-argument",
                "La cuenta de tesorería no está activa o no pertenece al consorcio.");
        }
    }
    const assignmentId = buildMercadoPagoAssignmentId({
        targetType, inmobiliariaId, targetId,
    });
    await db.collection(ASSIGNMENTS).doc(assignmentId).set({
        targetType,
        targetId,
        targetName: targetSnap.data()?.name ||
            targetSnap.data()?.inmuebleSnapshot?.title || targetId,
        inmobiliariaId,
        accountId,
        treasuryAccountId: targetType === "consortium" ? treasuryAccountId : "",
        active: true,
        updatedBy: uid,
        updatedAt: Timestamp.now(),
        createdAt: Timestamp.now(),
    }, { merge: true });
    return { assignmentId };
});

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
    const email = cleanMercadoPagoText(authEmail || user.email, 220).toLowerCase();
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
    ].map((value) => cleanMercadoPagoText(value, 220).toLowerCase());
    if (!unitSnap.exists || !emails.includes(email)) {
        throw new HttpsError("permission-denied",
            "No tenés acceso a la unidad de esta expensa.");
    }
};

const resolveCheckoutContext = async ({
    contextType,
    data,
    uid,
    authEmail,
    emailVerified,
}) => {
    if (contextType === "donation") {
        const amountMinor = normalizeMercadoPagoAmountMinor(data.amountMinor);
        if (amountMinor === null || amountMinor < 10000 || amountMinor > 100000000) {
            throw new HttpsError("invalid-argument",
                "La donación debe ser de $100 a $1.000.000.");
        }
        return {
            accountId: "platform_onoprop",
            inmobiliariaId: "",
            targetType: "platform",
            targetId: "onoprop",
            amountMinor,
            currency: "ARS",
            title: "Donación a ONO Prop",
            payerEmail: cleanMercadoPagoText(data.email, 220),
            donorName: cleanMercadoPagoText(data.name, 160),
            donorMessage: cleanMercadoPagoText(data.message, 1000),
        };
    }
    const inmobiliariaId = cleanMercadoPagoText(data.inmobiliariaId, 128);
    const obligationId = cleanMercadoPagoText(data.obligationId, 128);
    if (!uid) throw new HttpsError("unauthenticated", "Tenés que iniciar sesión.");
    if (contextType === "billing_account") {
        await assertAgencyManager(uid, inmobiliariaId);
        const interestRefresh = await refreshBillingInterestsForCheckout({
            inmobiliariaId,
        });
        if (interestRefresh.pendingRateDateKey) {
            throw new HttpsError("failed-precondition",
                `Falta configurar la TNA vigente desde ${
                    interestRefresh.pendingRateDateKey}.`);
        }
        const snap = await db.collection("billing_accounts").doc(inmobiliariaId).get();
        const account = snap.data() || {};
        return {
            accountId: "platform_onoprop",
            inmobiliariaId,
            targetType: "billing_account",
            targetId: inmobiliariaId,
            amountMinor: Math.max(0, Number(account.balanceByCurrency?.ARS || 0)),
            currency: "ARS",
            title: "Saldo de cuenta corriente ONO Prop",
            payerEmail: cleanMercadoPagoText(authEmail, 220),
        };
    }
    if (contextType === "billing_obligation") {
        await assertAgencyManager(uid, inmobiliariaId);
        const interestRefresh = await refreshBillingInterestsForCheckout({
            inmobiliariaId,
            obligationId,
        });
        if (interestRefresh.pendingRateDateKey) {
            throw new HttpsError("failed-precondition",
                `Falta configurar la TNA vigente desde ${
                    interestRefresh.pendingRateDateKey}.`);
        }
        const snap = await db.collection("billing_accounts").doc(inmobiliariaId)
            .collection("obligations").doc(obligationId).get();
        if (!snap.exists) throw new HttpsError("not-found", "La obligación no existe.");
        const obligation = snap.data() || {};
        return {
            accountId: "platform_onoprop",
            inmobiliariaId,
            targetType: "billing_account",
            targetId: inmobiliariaId,
            obligationId,
            amountMinor: Math.max(0, Number(obligation.principalOutstandingMinor || 0) +
                Number(obligation.interestOutstandingMinor || 0)),
            currency: normalizeMercadoPagoCurrency(obligation.currency),
            title: cleanMercadoPagoText(
                obligation.componentLabel || obligation.catalogName || "Abono ONO Prop", 200,
            ),
            payerEmail: cleanMercadoPagoText(authEmail, 220),
        };
    }
    const collection = contextType === "consortium_obligation"
        ? "condominium_obligations" : "rental_obligations";
    const snap = await db.collection("inmobiliarias").doc(inmobiliariaId)
        .collection(collection).doc(obligationId).get();
    if (!snap.exists) throw new HttpsError("not-found", "La obligación no existe.");
    const obligation = snap.data() || {};
    if (contextType === "consortium_obligation") {
        await assertConsortiumPortalAccess({
            uid,
            authEmail,
            emailVerified,
            inmobiliariaId,
            obligation,
        });
        const targetId = obligation.consortiumId;
        const assignmentId = buildMercadoPagoAssignmentId({
            targetType: "consortium", inmobiliariaId, targetId,
        });
        const assignmentSnap = await db.collection(ASSIGNMENTS).doc(assignmentId).get();
        if (!assignmentSnap.exists || assignmentSnap.data()?.active !== true) {
            throw new HttpsError("failed-precondition",
                "El consorcio todavía no habilitó cobros con Mercado Pago.");
        }
        return {
            accountId: assignmentSnap.data().accountId,
            inmobiliariaId,
            targetType: "consortium",
            targetId,
            obligationId,
            unitId: obligation.unitId,
            treasuryAccountId: assignmentSnap.data().treasuryAccountId || "",
            amountMinor: Math.max(0, Number(obligation.balanceMinor || 0)),
            currency: normalizeMercadoPagoCurrency(obligation.currency),
            title: `Expensas ${obligation.periodKey || ""} · Unidad ${
                obligation.unitSnapshot?.code || obligation.unitId}`,
        };
    }
    await assertAgencyManager(uid, inmobiliariaId);
    const targetId = obligation.contractId;
    const assignmentId = buildMercadoPagoAssignmentId({
        targetType: "rental_contract", inmobiliariaId, targetId,
    });
    const assignmentSnap = await db.collection(ASSIGNMENTS).doc(assignmentId).get();
    if (!assignmentSnap.exists || assignmentSnap.data()?.active !== true) {
        throw new HttpsError("failed-precondition",
            "El contrato todavía no tiene una cuenta de Mercado Pago asignada.");
    }
    return {
        accountId: assignmentSnap.data().accountId,
        inmobiliariaId,
        targetType: "rental_contract",
        targetId,
        obligationId,
        amountMinor: Math.max(0, Number(obligation.balanceMinor || 0)),
        currency: normalizeMercadoPagoCurrency(obligation.currency),
        title: `Alquiler ${obligation.periodKey || ""}`,
    };
};

export const mercadoPagoCreateCheckout = onCall({
    region: REGION,
    invoker: "public",
    secrets: [
        MERCADOPAGO_CLIENT_ID,
        MERCADOPAGO_CLIENT_SECRET,
        MERCADOPAGO_TOKEN_ENCRYPTION_KEY,
    ],
}, async (request) => {
    const contextType = cleanMercadoPagoText(request.data?.contextType, 60);
    if (!CONTEXTS.has(contextType)) {
        throw new HttpsError("invalid-argument", "El tipo de cobro no es válido.");
    }
    const context = await resolveCheckoutContext({
        contextType,
        data: request.data || {},
        uid: request.auth?.uid,
        authEmail: request.auth?.token?.email,
        emailVerified: request.auth?.token?.email_verified,
    });
    if (context.currency !== "ARS") {
        throw new HttpsError("failed-precondition",
            "El piloto de Mercado Pago opera únicamente en pesos argentinos.");
    }
    if (!(context.amountMinor > 0)) {
        throw new HttpsError("failed-precondition", "La obligación no tiene saldo pendiente.");
    }
    const operationId = cleanMercadoPagoText(request.data?.operationId, 128)
        .replace(/[^A-Za-z0-9_-]/g, "");
    if (operationId.length < 12) {
        throw new HttpsError("invalid-argument", "Identificador de operación inválido.");
    }
    const orderRef = db.collection(ORDERS).doc(operationId);
    const existing = await orderRef.get();
    if (existing.exists && existing.data()?.initPoint) {
        return {
            orderId: orderRef.id,
            statusToken: request.data?.statusToken || "",
            initPoint: existing.data().initPoint,
            status: existing.data().status,
        };
    }
    const statusToken = createMercadoPagoStatusToken();
    const now = Timestamp.now();
    const order = {
        ...context,
        contextType,
        amountMinor: Math.round(context.amountMinor),
        currency: context.currency,
        status: "creating",
        credited: false,
        needsReview: false,
        statusTokenHash: hashMercadoPagoStatusToken(statusToken),
        createdBy: request.auth?.uid || "public_donor",
        createdAt: now,
        updatedAt: now,
        expiresAtMs: Date.now() + ORDER_TTL_MS,
    };
    await orderRef.create(order);
    const { account, token } = await getAccessToken(context.accountId);
    const resultUrl = `${getPortalUrl()}/pagos/resultado?order=${
        encodeURIComponent(orderRef.id)}&token=${encodeURIComponent(statusToken)}`;
    try {
        const preference = await apiFetch("/checkout/preferences", {
            token,
            method: "POST",
            headers: {
                "X-Idempotency-Key": crypto.createHash("sha256")
                    .update(orderRef.id).digest("hex"),
            },
            body: {
                items: [{
                    id: orderRef.id,
                    title: context.title,
                    quantity: 1,
                    currency_id: context.currency,
                    unit_price: mercadoPagoMinorToMajor(context.amountMinor),
                }],
                external_reference: orderRef.id,
                ...(context.payerEmail ? { payer: { email: context.payerEmail } } : {}),
                back_urls: {
                    success: resultUrl,
                    pending: resultUrl,
                    failure: resultUrl,
                },
                auto_return: "approved",
                notification_url: getWebhookUrl(),
                expires: true,
                expiration_date_to: new Date(Date.now() + ORDER_TTL_MS).toISOString(),
                statement_descriptor: "ONO PROP",
            },
        });
        const initPoint = account.testMode === true
            ? preference.sandbox_init_point : preference.init_point;
        await orderRef.update({
            preferenceId: cleanMercadoPagoText(preference.id, 180),
            initPoint: cleanMercadoPagoText(initPoint, 3000),
            status: "pending",
            updatedAt: Timestamp.now(),
        });
        return { orderId: orderRef.id, statusToken, initPoint, status: "pending" };
    } catch (error) {
        await orderRef.update({
            status: "creation_failed",
            providerError: cleanMercadoPagoText(error.message, 1000),
            updatedAt: Timestamp.now(),
        });
        throw new HttpsError("internal",
            "No se pudo iniciar el pago. Reintentá en unos minutos.");
    }
});

const applyRentalPayment = async ({ order, payment, paymentCosts }) => {
    const ref = db.collection("inmobiliarias").doc(order.inmobiliariaId)
        .collection("rental_obligations").doc(order.obligationId);
    let result = {};
    await db.runTransaction(async (transaction) => {
        const snap = await transaction.get(ref);
        if (!snap.exists) throw new Error("La obligación de alquiler no existe.");
        const current = snap.data() || {};
        const payments = Array.isArray(current.payments) ? current.payments : [];
        if (payments.some((item) => item.providerPaymentId === `${payment.id}`)) {
            result = { idempotent: true };
            return;
        }
        const balance = Math.max(0, Number(current.balanceMinor || 0));
        if (order.amountMinor > balance) {
            result = { needsReview: true, reason: "El saldo cambió antes de acreditarse." };
            return;
        }
        const sequence = payments.length + 1;
        const paymentRecord = {
            id: `mp_${payment.id}`,
            receiptNumber: `REC-${order.obligationId.slice(0, 6).toUpperCase()}-MP-${sequence}`,
            amountMinor: order.amountMinor,
            paidAt: cleanMercadoPagoText(payment.date_approved, 10) ||
                new Date().toISOString().slice(0, 10),
            method: "mercadopago",
            reference: `Mercado Pago ${payment.id}`,
            notes: "Acreditado automáticamente.",
            provider: "mercadopago",
            providerPaymentId: `${payment.id}`,
            providerOrderId: order.id,
            providerFeeMinor: paymentCosts.providerFeeMinor,
            providerDeductionMinor: paymentCosts.providerDeductionMinor,
            netReceivedAmountMinor: paymentCosts.netReceivedAmountMinor,
            providerFeeDetails: paymentCosts.feeDetails,
            providerStatus: "approved",
            providerReversedAmountMinor: 0,
            recordedBy: "mercadopago_webhook",
            recordedAt: Timestamp.now(),
        };
        const paidAmountMinor = Number(current.paidAmountMinor || 0) + order.amountMinor;
        const balanceMinor = Math.max(0,
            Number(current.totalAmountMinor || 0) - paidAmountMinor);
        transaction.update(ref, {
            payments: [...payments, paymentRecord],
            paidAmountMinor,
            balanceMinor,
            status: balanceMinor <= 0 ? "paid" : "partial",
            lastPaymentAt: paymentRecord.paidAt,
            updatedAt: Timestamp.now(),
            updatedBy: "mercadopago_webhook",
        });
        result = { paymentId: paymentRecord.id, idempotent: false };
    });
    return result;
};

const applyConsortiumPayment = async ({ order, payment, paymentCosts }) => {
    const base = db.collection("inmobiliarias").doc(order.inmobiliariaId);
    const obligationRef = base.collection("condominium_obligations")
        .doc(order.obligationId);
    const paymentRef = base.collection("condominium_payments").doc(`mp_${payment.id}`);
    const movementRef = base.collection("condominium_treasury_movements")
        .doc(`mp_${payment.id}`);
    const deductionMovementRef = base.collection("condominium_treasury_movements")
        .doc(`mp_${payment.id}_deductions`);
    let result = {};
    await db.runTransaction(async (transaction) => {
        const treasuryAccountRef = order.treasuryAccountId
            ? base.collection("condominium_treasury_accounts")
                .doc(order.treasuryAccountId)
            : null;
        const [obligationSnap, paymentSnap, accountSnap] = await Promise.all([
            transaction.get(obligationRef),
            transaction.get(paymentRef),
            treasuryAccountRef ? transaction.get(treasuryAccountRef) : null,
        ]);
        if (paymentSnap.exists) {
            result = { paymentId: paymentRef.id, idempotent: true };
            return;
        }
        if (!obligationSnap.exists) throw new Error("La expensa no existe.");
        const obligation = obligationSnap.data() || {};
        const balance = Math.max(0, Number(obligation.balanceMinor || 0));
        if (order.amountMinor > balance) {
            result = { needsReview: true, reason: "El saldo cambió antes de acreditarse." };
            return;
        }
        const paidAmountMinor = Number(obligation.paidAmountMinor || 0) +
            order.amountMinor;
        const balanceMinor = Math.max(0,
            Number(obligation.totalAmountMinor || 0) - paidAmountMinor);
        const date = cleanMercadoPagoText(payment.date_approved, 10) ||
            new Date().toISOString().slice(0, 10);
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
            method: "mercadopago",
            reference: `Mercado Pago ${payment.id}`,
            notes: "Acreditado automáticamente.",
            treasuryAccountId: order.treasuryAccountId || "",
            treasuryMovementId: order.treasuryAccountId ? movementRef.id : "",
            treasuryDeductionMovementId: order.treasuryAccountId &&
                paymentCosts.providerDeductionMinor > 0
                ? deductionMovementRef.id : "",
            provider: "mercadopago",
            providerPaymentId: `${payment.id}`,
            providerOrderId: order.id,
            providerFeeMinor: paymentCosts.providerFeeMinor,
            providerDeductionMinor: paymentCosts.providerDeductionMinor,
            netReceivedAmountMinor: paymentCosts.netReceivedAmountMinor,
            providerFeeDetails: paymentCosts.feeDetails,
            providerStatus: "approved",
            providerReversedAmountMinor: 0,
            voided: false,
            inmobiliariaId: order.inmobiliariaId,
            ownerInmobiliariaId: order.inmobiliariaId,
            createdBy: "mercadopago_webhook",
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
        });
        if (treasuryAccountRef) {
            if (accountSnap.exists && accountSnap.data()?.active !== false) {
                const account = accountSnap.data() || {};
                transaction.set(movementRef, {
                    id: movementRef.id,
                    schemaVersion: 1,
                    inmobiliariaId: order.inmobiliariaId,
                    ownerInmobiliariaId: order.inmobiliariaId,
                    consortiumId: obligation.consortiumId,
                    accountId: order.treasuryAccountId,
                    accountSnapshot: { name: account.name || "Mercado Pago",
                        type: account.type || "wallet" },
                    source: "consortium_collection",
                    sourceId: paymentRef.id,
                    direction: "inflow",
                    amountMinor: order.amountMinor,
                    currency: obligation.currency || "ARS",
                    date,
                    concept: `Cobro Mercado Pago · Unidad ${
                        obligation.unitSnapshot?.code || obligation.unitId}`,
                    reference: `${payment.id}`,
                    voided: false,
                    createdBy: "mercadopago_webhook",
                    createdAt: Timestamp.now(),
                });
                if (paymentCosts.providerDeductionMinor > 0) {
                    transaction.set(deductionMovementRef, {
                        id: deductionMovementRef.id,
                        schemaVersion: 1,
                        inmobiliariaId: order.inmobiliariaId,
                        ownerInmobiliariaId: order.inmobiliariaId,
                        consortiumId: obligation.consortiumId,
                        accountId: order.treasuryAccountId,
                        accountSnapshot: {
                            name: account.name || "Mercado Pago",
                            type: account.type || "wallet",
                        },
                        source: "mercadopago_deduction",
                        sourceId: paymentRef.id,
                        direction: "outflow",
                        amountMinor: paymentCosts.providerDeductionMinor,
                        currency: obligation.currency || "ARS",
                        date,
                        concept: "Comisiones, impuestos y deducciones de Mercado Pago",
                        reference: `${payment.id}`,
                        voided: false,
                        createdBy: "mercadopago_webhook",
                        createdAt: Timestamp.now(),
                    });
                }
                transaction.update(treasuryAccountRef, {
                    currentBalanceMinor: Number(account.currentBalanceMinor || 0) +
                        paymentCosts.netReceivedAmountMinor,
                    updatedBy: "mercadopago_webhook",
                    updatedAt: Timestamp.now(),
                });
            }
        }
        transaction.update(obligationRef, {
            paidAmountMinor,
            balanceMinor,
            status: balanceMinor <= 0 ? "paid" : "partial",
            paymentIds: [
                ...(Array.isArray(obligation.paymentIds) ? obligation.paymentIds : []),
                paymentRef.id,
            ],
            updatedBy: "mercadopago_webhook",
            updatedAt: Timestamp.now(),
        });
        result = { paymentId: paymentRef.id, idempotent: false };
    });
    return result;
};

const getOutstandingStatus = ({ paidAmountMinor, balanceMinor, dueDate }) => {
    if (balanceMinor <= 0) return "paid";
    const safeDueDate = cleanMercadoPagoText(dueDate, 10);
    const overdue = Boolean(safeDueDate) && safeDueDate <
        new Date().toISOString().slice(0, 10);
    if (overdue) return "overdue";
    return paidAmountMinor > 0 ? "partial" : "pending";
};

const applyRentalPaymentReversal = async ({
    order,
    payment,
    reversalDeltaMinor,
    totalReversedAmountMinor,
    providerStatus,
}) => {
    const base = db.collection("inmobiliarias").doc(order.inmobiliariaId);
    const obligationRef = base.collection("rental_obligations")
        .doc(order.obligationId);
    let result = {};
    await db.runTransaction(async (transaction) => {
        const obligationSnap = await transaction.get(obligationRef);
        if (!obligationSnap.exists) throw new Error("La obligación de alquiler no existe.");
        const obligation = obligationSnap.data() || {};
        const payments = Array.isArray(obligation.payments)
            ? obligation.payments : [];
        const paymentIndex = payments.findIndex((item) => (
            item.providerPaymentId === `${payment.id}`
        ));
        if (paymentIndex < 0) {
            result = { needsReview: true, reason: "No se encontró el cobro a revertir." };
            return;
        }
        const settlementRef = obligation.contractId && obligation.periodKey
            ? base.collection("rental_settlements")
                .doc(`${obligation.contractId}_${obligation.periodKey}`)
            : null;
        const settlementSnap = settlementRef
            ? await transaction.get(settlementRef) : null;
        const now = Timestamp.now();
        const updatedPayments = payments.map((item, index) => index === paymentIndex
            ? {
                ...item,
                providerStatus,
                providerReversedAmountMinor: totalReversedAmountMinor,
                providerReversalUpdatedAt: now,
                notes: "Mercado Pago informó una devolución o contracargo.",
            }
            : item);
        const paidAmountMinor = Math.max(
            0,
            Number(obligation.paidAmountMinor || 0) - reversalDeltaMinor,
        );
        const balanceMinor = Math.max(
            0,
            Number(obligation.totalAmountMinor || 0) - paidAmountMinor,
        );
        transaction.update(obligationRef, {
            payments: updatedPayments,
            paidAmountMinor,
            balanceMinor,
            status: getOutstandingStatus({
                paidAmountMinor,
                balanceMinor,
                dueDate: obligation.dueDate,
            }),
            lastProviderReversalAt: now,
            updatedAt: now,
            updatedBy: "mercadopago_webhook",
        });
        if (settlementSnap?.exists) {
            const settlement = settlementSnap.data() || {};
            transaction.update(settlementRef, {
                status: "needs_recalculation",
                statusBeforeProviderReversal: settlement.status || "draft",
                staleReason: "mercadopago_payment_reversed",
                staleAt: now,
                updatedAt: now,
                updatedBy: "mercadopago_webhook",
            });
        }
        result = {
            paymentId: payments[paymentIndex].id,
            reversalDeltaMinor,
            needsReview: settlementSnap?.exists === true,
            reason: settlementSnap?.exists
                ? "La liquidación del locador debe revisarse y recalcularse." : "",
        };
    });
    return result;
};

const applyConsortiumPaymentReversal = async ({
    order,
    payment,
    reversalDeltaMinor,
    totalReversedAmountMinor,
    providerStatus,
}) => {
    const base = db.collection("inmobiliarias").doc(order.inmobiliariaId);
    const obligationRef = base.collection("condominium_obligations")
        .doc(order.obligationId);
    const paymentRef = base.collection("condominium_payments")
        .doc(`mp_${payment.id}`);
    const reversalMovementRef = base.collection("condominium_treasury_movements")
        .doc(`mp_${payment.id}_reversal_${totalReversedAmountMinor}`);
    let result = {};
    await db.runTransaction(async (transaction) => {
        const [obligationSnap, paymentSnap, reversalMovementSnap] = await Promise.all([
            transaction.get(obligationRef),
            transaction.get(paymentRef),
            transaction.get(reversalMovementRef),
        ]);
        if (reversalMovementSnap.exists) {
            result = { paymentId: paymentRef.id, idempotent: true };
            return;
        }
        if (!obligationSnap.exists || !paymentSnap.exists) {
            result = { needsReview: true, reason: "No se encontró el cobro a revertir." };
            return;
        }
        const obligation = obligationSnap.data() || {};
        const paymentRecord = paymentSnap.data() || {};
        const treasuryAccountRef = paymentRecord.treasuryAccountId
            ? base.collection("condominium_treasury_accounts")
                .doc(paymentRecord.treasuryAccountId)
            : null;
        const treasuryAccountSnap = treasuryAccountRef
            ? await transaction.get(treasuryAccountRef) : null;
        const paidAmountMinor = Math.max(
            0,
            Number(obligation.paidAmountMinor || 0) - reversalDeltaMinor,
        );
        const balanceMinor = Math.max(
            0,
            Number(obligation.totalAmountMinor || 0) - paidAmountMinor,
        );
        const now = Timestamp.now();
        const date = new Date().toISOString().slice(0, 10);
        transaction.update(paymentRef, {
            providerStatus,
            providerReversedAmountMinor: totalReversedAmountMinor,
            providerReversalUpdatedAt: now,
            notes: "Mercado Pago informó una devolución o contracargo.",
            updatedAt: now,
        });
        transaction.update(obligationRef, {
            paidAmountMinor,
            balanceMinor,
            status: getOutstandingStatus({
                paidAmountMinor,
                balanceMinor,
                dueDate: obligation.dueDate,
            }),
            lastProviderReversalAt: now,
            updatedAt: now,
            updatedBy: "mercadopago_webhook",
        });
        if (treasuryAccountRef && treasuryAccountSnap?.exists) {
            const account = treasuryAccountSnap.data() || {};
            transaction.set(reversalMovementRef, {
                id: reversalMovementRef.id,
                schemaVersion: 1,
                inmobiliariaId: order.inmobiliariaId,
                ownerInmobiliariaId: order.inmobiliariaId,
                consortiumId: obligation.consortiumId,
                accountId: paymentRecord.treasuryAccountId,
                accountSnapshot: {
                    name: account.name || "Mercado Pago",
                    type: account.type || "wallet",
                },
                source: "mercadopago_reversal",
                sourceId: paymentRef.id,
                reversesMovementId: paymentRecord.treasuryMovementId || "",
                direction: "outflow",
                amountMinor: reversalDeltaMinor,
                currency: obligation.currency || "ARS",
                date,
                concept: providerStatus === "charged_back"
                    ? "Contracargo de Mercado Pago"
                    : "Devolución de Mercado Pago",
                reference: `${payment.id}`,
                voided: false,
                createdBy: "mercadopago_webhook",
                createdAt: now,
            });
            transaction.update(treasuryAccountRef, {
                currentBalanceMinor: Number(account.currentBalanceMinor || 0) -
                    reversalDeltaMinor,
                updatedBy: "mercadopago_webhook",
                updatedAt: now,
            });
        }
        result = {
            paymentId: paymentRef.id,
            reversalDeltaMinor,
            needsReview: true,
            reason: "Revisá en Mercado Pago los ajustes de comisiones e impuestos de la reversión.",
        };
    });
    return result;
};

const applyOrderReversal = async ({ orderSnap, payment, reversal }) => {
    const order = { id: orderSnap.id, ...(orderSnap.data() || {}) };
    let result = {};
    if (["billing_account", "billing_obligation"].includes(order.contextType)) {
        result = await applyBillingProviderPaymentReversal({
            inmobiliariaId: order.inmobiliariaId,
            providerPaymentId: `${payment.id}`,
            providerOrderId: order.id,
            totalReversedAmountMinor: reversal.totalReversedAmountMinor,
            providerStatus: payment.status,
        });
    } else if (order.contextType === "rental_obligation") {
        result = await applyRentalPaymentReversal({
            order,
            payment,
            reversalDeltaMinor: reversal.reversalDeltaMinor,
            totalReversedAmountMinor: reversal.totalReversedAmountMinor,
            providerStatus: payment.status,
        });
    } else if (order.contextType === "consortium_obligation") {
        result = await applyConsortiumPaymentReversal({
            order,
            payment,
            reversalDeltaMinor: reversal.reversalDeltaMinor,
            totalReversedAmountMinor: reversal.totalReversedAmountMinor,
            providerStatus: payment.status,
        });
    } else if (order.contextType === "donation") {
        await db.collection(DONATIONS).doc(`${payment.id}`).set({
            status: reversal.fullyReversed ? "reversed" : "partially_reversed",
            providerStatus: payment.status,
            providerReversedAmountMinor: reversal.totalReversedAmountMinor,
            updatedAt: Timestamp.now(),
        }, { merge: true });
    }
    await orderSnap.ref.update({
        reversedAmountMinor: reversal.totalReversedAmountMinor,
        reversedAt: Timestamp.now(),
        credited: true,
        financiallyReversed: reversal.fullyReversed,
        needsReview: true,
        reviewReason: result.reason ||
            "Reversión aplicada. Revisá la documentación fiscal y la conciliación.",
        updatedAt: Timestamp.now(),
    });
    return result;
};

const applyApprovedOrder = async ({ orderSnap, payment }) => {
    const order = { id: orderSnap.id, ...(orderSnap.data() || {}) };
    if (order.credited === true) return { idempotent: true };
    const paymentCosts = getMercadoPagoPaymentCostSummary(payment);
    let result = {};
    if (["billing_account", "billing_obligation"].includes(order.contextType)) {
        result = await applyApprovedBillingProviderPayment({
            inmobiliariaId: order.inmobiliariaId,
            amountMinor: order.amountMinor,
            currency: order.currency,
            providerPaymentId: `${payment.id}`,
            providerOrderId: order.id,
            providerFeeMinor: paymentCosts.providerFeeMinor,
            providerDeductionMinor: paymentCosts.providerDeductionMinor,
            netReceivedAmountMinor: paymentCosts.netReceivedAmountMinor,
            paidAtMs: Date.parse(payment.date_approved || "") || Date.now(),
        });
    } else if (order.contextType === "rental_obligation") {
        result = await applyRentalPayment({ order, payment, paymentCosts });
    } else if (order.contextType === "consortium_obligation") {
        result = await applyConsortiumPayment({ order, payment, paymentCosts });
    } else if (order.contextType === "donation") {
        await db.collection(DONATIONS).doc(`${payment.id}`).set({
            orderId: order.id,
            amountMinor: order.amountMinor,
            currency: order.currency,
            donorName: order.donorName || "",
            donorMessage: order.donorMessage || "",
            payerEmail: order.payerEmail || "",
            providerPaymentId: `${payment.id}`,
            providerFeeMinor: paymentCosts.providerFeeMinor,
            netReceivedAmountMinor: paymentCosts.netReceivedAmountMinor,
            status: "approved",
            createdAt: Timestamp.now(),
        }, { merge: true });
    }
    if (result.needsReview) {
        await orderSnap.ref.update({
            needsReview: true,
            reviewReason: result.reason || "Revisión contable requerida.",
            updatedAt: Timestamp.now(),
        });
        return result;
    }
    await orderSnap.ref.update({
        credited: true,
        creditedAt: Timestamp.now(),
        creditedReference: result.paymentId || result.reportId || `${payment.id}`,
        updatedAt: Timestamp.now(),
    });
    return result;
};

const reconcilePayment = async ({ payment, accountId }) => {
    const orderId = cleanMercadoPagoText(payment.external_reference, 128);
    let orderSnap = await db.collection(ORDERS).doc(orderId).get();
    if (!orderSnap.exists) throw new Error("La orden informada no pertenece a ONO Prop.");
    const order = orderSnap.data() || {};
    const paymentCosts = getMercadoPagoPaymentCostSummary(payment);
    const amountMinor = paymentCosts.transactionAmountMinor;
    if (order.accountId !== accountId || amountMinor !== order.amountMinor ||
        normalizeMercadoPagoCurrency(payment.currency_id) !== order.currency) {
        await orderSnap.ref.update({
            needsReview: true,
            reviewReason: "Los datos acreditados no coinciden con la orden.",
            updatedAt: Timestamp.now(),
        });
        throw new Error("El pago no coincide con la orden original.");
    }
    const status = cleanMercadoPagoText(payment.status, 60);
    const reversal = getMercadoPagoReversalSummary({
        payment,
        orderAmountMinor: order.amountMinor,
        previouslyReversedMinor: order.reversedAmountMinor,
    });
    const reconciledStatus = reversal.totalReversedAmountMinor > 0 &&
        !reversal.fullyReversed
        ? "partially_refunded" : status;
    await orderSnap.ref.update({
        status: reconciledStatus,
        providerStatus: status,
        providerStatusDetail: cleanMercadoPagoText(payment.status_detail, 120),
        mpPaymentId: `${payment.id}`,
        providerFeeMinor: paymentCosts.providerFeeMinor,
        providerDeductionMinor: paymentCosts.providerDeductionMinor,
        netReceivedAmountMinor: paymentCosts.netReceivedAmountMinor,
        providerRefundedAmountMinor: paymentCosts.refundedAmountMinor,
        providerFeeDetails: paymentCosts.feeDetails,
        updatedAt: Timestamp.now(),
        paymentSnapshot: {
            id: `${payment.id}`,
            status,
            currencyId: payment.currency_id || "",
            transactionAmount: Number(payment.transaction_amount || 0),
            providerFeeMinor: paymentCosts.providerFeeMinor,
            providerDeductionMinor: paymentCosts.providerDeductionMinor,
            netReceivedAmountMinor: paymentCosts.netReceivedAmountMinor,
            refundedAmountMinor: paymentCosts.refundedAmountMinor,
            dateApproved: payment.date_approved || "",
        },
    });
    if (status === "approved" && order.credited !== true) {
        await applyApprovedOrder({ orderSnap, payment });
        orderSnap = await orderSnap.ref.get();
    }
    if (reversal.reversalDeltaMinor > 0 && orderSnap.data()?.credited === true) {
        return applyOrderReversal({ orderSnap, payment, reversal });
    }
    if (reversal.reversalDeltaMinor > 0) {
        await orderSnap.ref.update({
            needsReview: true,
            reviewReason: "Mercado Pago informó una reversión de un cobro que no estaba imputado.",
            updatedAt: Timestamp.now(),
        });
    }
    return { status: reconciledStatus };
};

const syncPaymentById = async (paymentId, expectedAccountId = "") => {
    let accountId = expectedAccountId;
    if (!accountId) {
        const orderSnap = await db.collection(ORDERS)
            .where("mpPaymentId", "==", `${paymentId}`).limit(1).get();
        accountId = orderSnap.docs[0]?.data()?.accountId || "";
    }
    if (!accountId) throw new Error("No se pudo identificar la cuenta receptora.");
    const { account, token } = await getAccessToken(accountId);
    const payment = await apiFetch(`/v1/payments/${encodeURIComponent(paymentId)}`, {
        token,
    });
    if (`${payment.collector_id || ""}` !== `${account.mpUserId || ""}`) {
        throw new Error("El cobro pertenece a otro vendedor.");
    }
    await reconcilePayment({ payment, accountId });
    return payment;
};

export const mercadoPagoWebhook = onRequest({
    region: REGION,
    invoker: "public",
    secrets: [
        MERCADOPAGO_CLIENT_ID,
        MERCADOPAGO_CLIENT_SECRET,
        MERCADOPAGO_TOKEN_ENCRYPTION_KEY,
        MERCADOPAGO_WEBHOOK_SECRET,
    ],
}, async (request, response) => {
    const notificationType = cleanMercadoPagoText(
        request.body?.type || request.query?.type,
        80,
    ).toLowerCase();
    const dataId = cleanMercadoPagoText(
        request.query?.["data.id"] || request.body?.data?.id || request.query?.id, 180,
    );
    const requestId = cleanMercadoPagoText(request.get("x-request-id"), 300);
    const signatureHeader = cleanMercadoPagoText(request.get("x-signature"), 1000);
    if (!verifyMercadoPagoWebhookSignature({
        signatureHeader,
        requestId,
        dataId,
        secret: MERCADOPAGO_WEBHOOK_SECRET.value(),
    })) {
        response.status(401).send("invalid signature");
        return;
    }
    const eventId = crypto.createHash("sha256")
        .update(`${requestId}:${dataId}:${notificationType}`)
        .digest("hex");
    const eventRef = db.collection(WEBHOOK_EVENTS).doc(eventId);
    const existing = await eventRef.get();
    if (existing.exists && existing.data()?.processed === true) {
        response.status(200).send("ok");
        return;
    }
    await eventRef.set({
        dataId,
        requestId,
        type: notificationType,
        processed: false,
        receivedAt: Timestamp.now(),
    }, { merge: true });
    try {
        const accountLinkSnap = await db.collection(ACCOUNT_LINKS)
            .doc(cleanMercadoPagoText(request.body?.user_id, 80)).get();
        const accountId = accountLinkSnap.data()?.accountId || "";
        if (!dataId || !accountId) throw new Error("Notificación sin cuenta o pago.");
        let paymentId = cleanMercadoPagoText(
            request.body?.data?.payment_id,
            180,
        );
        if (!paymentId && notificationType.includes("chargeback")) {
            const { token } = await getAccessToken(accountId);
            const chargeback = await apiFetch(
                `/v1/chargebacks/${encodeURIComponent(dataId)}`,
                { token },
            );
            paymentId = cleanMercadoPagoText(
                chargeback.payment_id || chargeback.payments?.[0]?.payment_id ||
                    chargeback.payments?.[0]?.id,
                180,
            );
        }
        if (!paymentId) paymentId = dataId;
        await syncPaymentById(paymentId, accountId);
        await eventRef.update({ processed: true, processedAt: Timestamp.now() });
        response.status(200).send("ok");
    } catch (error) {
        console.error("Mercado Pago webhook", { eventId, dataId, error });
        await eventRef.update({
            error: cleanMercadoPagoText(error.message, 1000),
            updatedAt: Timestamp.now(),
        });
        response.status(200).send("received");
    }
});

export const mercadoPagoGetOrderStatus = onCall({
    region: REGION,
    invoker: "public",
    secrets: [
        MERCADOPAGO_CLIENT_ID,
        MERCADOPAGO_CLIENT_SECRET,
        MERCADOPAGO_TOKEN_ENCRYPTION_KEY,
    ],
}, async (request) => {
    const orderId = cleanMercadoPagoText(request.data?.orderId, 128);
    const token = cleanMercadoPagoText(request.data?.statusToken, 300);
    const providerPaymentId = cleanMercadoPagoText(
        request.data?.providerPaymentId, 128,
    ).replace(/[^0-9]/g, "");
    let snap = await db.collection(ORDERS).doc(orderId).get();
    if (!snap.exists || !isMercadoPagoStatusTokenValid(
        token, snap.data()?.statusTokenHash,
    )) {
        throw new HttpsError("permission-denied", "El enlace de pago no es válido.");
    }
    if (providerPaymentId && snap.data()?.credited !== true) {
        try {
            await syncPaymentById(providerPaymentId, snap.data()?.accountId);
            snap = await snap.ref.get();
        } catch (error) {
            console.warn("No se pudo conciliar el retorno de Mercado Pago", {
                orderId,
                providerPaymentId,
                message: error.message,
            });
        }
    }
    const order = snap.data() || {};
    return serialize({
        id: snap.id,
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
        financiallyReversed: order.financiallyReversed === true,
        reversedAmountMinor: order.reversedAmountMinor || 0,
        needsReview: order.needsReview === true,
        providerStatusDetail: order.providerStatusDetail || "",
        updatedAt: order.updatedAt,
    });
});

export const mercadoPagoSyncOrder = onCall({
    region: REGION,
    invoker: "public",
    secrets: [
        MERCADOPAGO_CLIENT_ID,
        MERCADOPAGO_CLIENT_SECRET,
        MERCADOPAGO_TOKEN_ENCRYPTION_KEY,
    ],
}, async (request) => {
    const orderId = cleanMercadoPagoText(request.data?.orderId, 128);
    const snap = await db.collection(ORDERS).doc(orderId).get();
    if (!snap.exists) throw new HttpsError("not-found", "La orden no existe.");
    const order = snap.data() || {};
    if (order.inmobiliariaId) {
        await assertAgencyManager(request.auth?.uid, order.inmobiliariaId);
    } else {
        await assertRoot(request.auth?.uid);
    }
    if (!order.mpPaymentId) {
        throw new HttpsError("failed-precondition",
            "Mercado Pago todavía no informó un pago para esta orden.");
    }
    await syncPaymentById(order.mpPaymentId, order.accountId);
    return { synced: true };
});
