import { Buffer } from "node:buffer";
import crypto from "node:crypto";

import admin from "firebase-admin";
import { defineSecret } from "firebase-functions/params";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { HttpsError, onCall, onRequest } from "firebase-functions/v2/https";

import {
    buildMercadoLibreNotificationId,
    isSupportedMercadoLibreNotification,
    normalizeMercadoLibreLead,
    normalizeMercadoLibreLeadSearchResults,
    normalizeMercadoLibreNotification,
    parseMercadoLibreItemResource,
    parseMercadoLibreLeadResource,
} from "./mercadolibre.notifications.helpers.js";

if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;
const Timestamp = admin.firestore.Timestamp;

const MERCADOLIBRE_CLIENT_ID = defineSecret("MERCADOLIBRE_CLIENT_ID");
const MERCADOLIBRE_CLIENT_SECRET = defineSecret("MERCADOLIBRE_CLIENT_SECRET");
const MERCADOLIBRE_REDIRECT_URI = defineSecret("MERCADOLIBRE_REDIRECT_URI");
const MERCADOLIBRE_TOKEN_ENCRYPTION_KEY = defineSecret(
    "MERCADOLIBRE_TOKEN_ENCRYPTION_KEY",
);

const REGION = "southamerica-east1";
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const TOKEN_REFRESH_MARGIN_MS = 5 * 60 * 1000;
const TOKEN_REFRESH_LEASE_MS = 30 * 1000;
const PUBLICATION_LEASE_MS = 2 * 60 * 1000;
const NOTIFICATION_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const LEAD_SYNC_DAYS = 30;
const LEAD_PAGE_SIZE = 50;
const LEAD_MANAGEMENT_STATUSES = new Set(["nuevo", "contactado", "cerrado"]);
const MERCADOLIBRE_API_BASE_URL = "https://api.mercadolibre.com";
const ALLOWED_LISTING_TYPES = new Set(["silver", "gold", "gold_premium"]);
const REAL_ESTATE_ROOT_CATEGORY_BY_SITE = {
    MLA: "MLA1459",
};

class MercadoLibreApiError extends Error {
    constructor(message, { status = 500, data = null, path = "" } = {}) {
        super(message);
        this.name = "MercadoLibreApiError";
        this.status = status;
        this.data = data;
        this.path = path;
    }
}

const cleanText = (value = "", maxLength = 500) => {
    return value?.toString?.().trim().slice(0, maxLength) || "";
};

const normalizeCategoryId = (value = "") => {
    const categoryId = cleanText(value, 32).toUpperCase();

    if (categoryId && !/^MLA\d+$/.test(categoryId)) {
        throw new HttpsError(
            "invalid-argument",
            "El category_id debe pertenecer al sitio MLA.",
        );
    }

    return categoryId;
};

const toFiniteNumberOrNull = (value) => {
    if (value === null || value === undefined || value === "") return null;
    if (typeof value === "number") {
        return Number.isFinite(value) ? value : null;
    }

    let normalized = value.toString().trim().replace(/[^\d,.-]/g, "");

    if (normalized.includes(",") && normalized.includes(".")) {
        normalized = normalized.replace(/\./g, "").replace(",", ".");
    } else if (normalized.includes(",")) {
        normalized = normalized.replace(",", ".");
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
};

const escapeHtml = (value = "") => {
    return value
        .toString()
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll("\"", "&quot;")
        .replaceAll("'", "&#039;");
};

const getUserData = async (uid) => {
    const userSnap = await db.collection("users").doc(uid).get();

    if (!userSnap.exists) {
        throw new HttpsError("permission-denied", "Perfil de usuario no encontrado.");
    }

    return userSnap.data() || {};
};

const userHasRole = (userData = {}, roleName = "") => {
    return (
        userData.role === roleName ||
        userData.primaryRole === roleName ||
        (Array.isArray(userData.roles) && userData.roles.includes(roleName))
    );
};

const assertCanManageInmobiliaria = async (uid, inmobiliariaId) => {
    if (!uid || !inmobiliariaId) {
        throw new HttpsError("invalid-argument", "Usuario o inmobiliaria inválidos.");
    }

    const userData = await getUserData(uid);
    const isRoot = userHasRole(userData, "root");
    const isAdmin = userHasRole(userData, "admin");
    const userInmobiliarias = Array.isArray(userData.inmobiliarias)
        ? userData.inmobiliarias
        : [];

    if (isRoot || (isAdmin && userInmobiliarias.includes(inmobiliariaId))) {
        return userData;
    }

    throw new HttpsError(
        "permission-denied",
        "No tenés permisos para administrar esta inmobiliaria.",
    );
};

const assertAuthenticatedManager = async (request) => {
    const uid = request.auth?.uid;
    const inmobiliariaId = cleanText(request.data?.inmobiliariaId, 128);

    if (!uid) {
        throw new HttpsError("unauthenticated", "Tenés que iniciar sesión.");
    }

    await assertCanManageInmobiliaria(uid, inmobiliariaId);
    return { uid, inmobiliariaId };
};

const integrationRef = (inmobiliariaId) => {
    return db
        .collection("inmobiliarias")
        .doc(inmobiliariaId)
        .collection("privateIntegrations")
        .doc("mercadolibre");
};

const publicationRef = (inmobiliariaId, inmuebleId) => {
    return db
        .collection("inmobiliarias")
        .doc(inmobiliariaId)
        .collection("inmuebles")
        .doc(inmuebleId)
        .collection("private")
        .doc("mercadolibre");
};

const inmuebleRef = (inmobiliariaId, inmuebleId) => {
    return db
        .collection("inmobiliarias")
        .doc(inmobiliariaId)
        .collection("inmuebles")
        .doc(inmuebleId);
};

const sellerConnectionRef = (sellerId) => {
    return db.collection("mercadolibre_seller_connections").doc(sellerId.toString());
};

const itemLinkRef = (itemId) => {
    return db.collection("mercadolibre_item_links").doc(itemId);
};

const notificationQueueRef = (notificationId) => {
    return db.collection("mercadolibre_notification_queue").doc(notificationId);
};

const leadsCollectionRef = (inmobiliariaId) => {
    return integrationRef(inmobiliariaId).collection("leads");
};

const leadRef = (inmobiliariaId, leadId) => {
    return leadsCollectionRef(inmobiliariaId).doc(leadId);
};

const parseEncryptionKey = (rawKey) => {
    const value = cleanText(rawKey, 500);

    if (/^[0-9a-fA-F]{64}$/.test(value)) {
        return Buffer.from(value, "hex");
    }

    const decoded = Buffer.from(value, "base64");
    if (decoded.length === 32) return decoded;

    throw new Error(
        "MERCADOLIBRE_TOKEN_ENCRYPTION_KEY debe contener exactamente 32 bytes en base64 o 64 caracteres hexadecimales.",
    );
};

const encryptToken = (token, rawKey) => {
    if (!token) return null;

    const key = parseEncryptionKey(rawKey);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([
        cipher.update(token.toString(), "utf8"),
        cipher.final(),
    ]);

    return {
        version: 1,
        algorithm: "aes-256-gcm",
        iv: iv.toString("base64"),
        tag: cipher.getAuthTag().toString("base64"),
        data: encrypted.toString("base64"),
    };
};

const decryptToken = (encryptedToken, rawKey, legacyPlaintext = "") => {
    if (!encryptedToken) return legacyPlaintext || "";

    const key = parseEncryptionKey(rawKey);
    const decipher = crypto.createDecipheriv(
        "aes-256-gcm",
        key,
        Buffer.from(encryptedToken.iv, "base64"),
    );
    decipher.setAuthTag(Buffer.from(encryptedToken.tag, "base64"));

    return Buffer.concat([
        decipher.update(Buffer.from(encryptedToken.data, "base64")),
        decipher.final(),
    ]).toString("utf8");
};

const readJsonResponse = async (response) => {
    const raw = await response.text();

    if (!raw) return null;

    try {
        return JSON.parse(raw);
    } catch {
        return { message: raw };
    }
};

const mercadoLibreRequest = async (
    path,
    { accessToken, method = "GET", body } = {},
) => {
    const response = await fetch(`${MERCADOLIBRE_API_BASE_URL}${path}`, {
        method,
        headers: {
            Accept: "application/json",
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
            ...(body ? { "Content-Type": "application/json" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const data = await readJsonResponse(response);

    if (!response.ok) {
        throw new MercadoLibreApiError(
            data?.message || data?.error || `Mercado Libre respondió ${response.status}.`,
            {
                status: response.status,
                data,
                path,
            },
        );
    }

    return data;
};

const oauthTokenRequest = async (params) => {
    const response = await fetch(`${MERCADOLIBRE_API_BASE_URL}/oauth/token`, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json",
        },
        body: new URLSearchParams(params).toString(),
    });
    const data = await readJsonResponse(response);

    if (!response.ok) {
        throw new MercadoLibreApiError(
            data?.message || data?.error || "No se pudo obtener el token.",
            {
                status: response.status,
                data,
                path: "/oauth/token",
            },
        );
    }

    return data;
};

const formatMercadoLibreError = (error) => {
    const causes = Array.isArray(error?.data?.cause) ? error.data.cause : [];
    const causeMessages = causes
        .map((cause) => cleanText(cause?.message || cause?.code, 300))
        .filter(Boolean);

    return causeMessages.length > 0
        ? causeMessages.join(" · ")
        : cleanText(error?.message, 700) || "Error desconocido de Mercado Libre.";
};

const toHttpsError = (error, fallbackMessage = "Error comunicando con Mercado Libre.") => {
    if (error instanceof HttpsError) return error;

    if (error instanceof MercadoLibreApiError) {
        console.error("Mercado Libre API error", {
            status: error.status,
            path: error.path,
            error: error.data?.error || "",
        });

        const code =
            error.status === 401 || error.status === 403
                ? "failed-precondition"
                : error.status === 404
                    ? "not-found"
                    : error.status === 409
                        ? "already-exists"
                        : "internal";

        return new HttpsError(code, formatMercadoLibreError(error));
    }

    console.error("Mercado Libre unexpected error", {
        name: error?.name || "",
        message: error?.message || "",
    });
    return new HttpsError("internal", error?.message || fallbackMessage);
};

const buildMercadoLibreAuthUrl = ({
    clientId,
    redirectUri,
    state,
    codeChallenge,
}) => {
    const params = new URLSearchParams({
        response_type: "code",
        client_id: clientId,
        redirect_uri: redirectUri,
        state,
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
    });

    return `https://auth.mercadolibre.com.ar/authorization?${params.toString()}`;
};

const getValidConnection = async (inmobiliariaId) => {
    const ref = integrationRef(inmobiliariaId);
    const encryptionKey = MERCADOLIBRE_TOKEN_ENCRYPTION_KEY.value();
    const initialSnap = await ref.get();

    if (!initialSnap.exists) {
        throw new HttpsError(
            "failed-precondition",
            "La inmobiliaria todavía no conectó una cuenta de Mercado Libre.",
        );
    }

    const initialData = initialSnap.data() || {};
    if (initialData.connected !== true || initialData.requiresReconnect === true) {
        throw new HttpsError(
            "failed-precondition",
            "La cuenta de Mercado Libre necesita volver a conectarse.",
        );
    }

    if (
        Number(initialData.expiresAtMs || 0) >
        Date.now() + TOKEN_REFRESH_MARGIN_MS
    ) {
        return {
            accessToken: decryptToken(
                initialData.accessTokenEncrypted,
                encryptionKey,
                initialData.accessToken,
            ),
            integration: initialData,
        };
    }

    const leaseId = crypto.randomUUID();
    const claim = await db.runTransaction(async (transaction) => {
        const snap = await transaction.get(ref);
        const data = snap.data() || {};
        const now = Date.now();

        if (Number(data.expiresAtMs || 0) > now + TOKEN_REFRESH_MARGIN_MS) {
            return { status: "fresh", data };
        }

        if (
            data.refreshLeaseId &&
            Number(data.refreshLeaseUntilMs || 0) > now
        ) {
            return { status: "waiting" };
        }

        transaction.update(ref, {
            refreshLeaseId: leaseId,
            refreshLeaseUntilMs: now + TOKEN_REFRESH_LEASE_MS,
            updatedAt: FieldValue.serverTimestamp(),
        });
        return { status: "claimed", data };
    });

    if (claim.status === "fresh") {
        return {
            accessToken: decryptToken(
                claim.data.accessTokenEncrypted,
                encryptionKey,
                claim.data.accessToken,
            ),
            integration: claim.data,
        };
    }

    if (claim.status === "waiting") {
        await new Promise((resolve) => setTimeout(resolve, 1200));
        const refreshedSnap = await ref.get();
        const refreshedData = refreshedSnap.data() || {};

        if (
            Number(refreshedData.expiresAtMs || 0) >
            Date.now() + TOKEN_REFRESH_MARGIN_MS
        ) {
            return {
                accessToken: decryptToken(
                    refreshedData.accessTokenEncrypted,
                    encryptionKey,
                    refreshedData.accessToken,
                ),
                integration: refreshedData,
            };
        }

        throw new HttpsError(
            "aborted",
            "La conexión se está renovando. Volvé a intentar en unos segundos.",
        );
    }

    const refreshToken = decryptToken(
        claim.data.refreshTokenEncrypted,
        encryptionKey,
        claim.data.refreshToken,
    );

    if (!refreshToken) {
        await ref.update({
            connected: false,
            requiresReconnect: true,
            refreshLeaseId: FieldValue.delete(),
            refreshLeaseUntilMs: FieldValue.delete(),
            updatedAt: FieldValue.serverTimestamp(),
        });
        throw new HttpsError(
            "failed-precondition",
            "Mercado Libre no entregó un refresh token. Volvé a conectar la cuenta.",
        );
    }

    try {
        const tokenData = await oauthTokenRequest({
            grant_type: "refresh_token",
            client_id: MERCADOLIBRE_CLIENT_ID.value(),
            client_secret: MERCADOLIBRE_CLIENT_SECRET.value(),
            refresh_token: refreshToken,
        });
        const expiresIn = Number(tokenData.expires_in || 0);
        const expiresAtMs = Date.now() + expiresIn * 1000;

        await ref.update({
            accessTokenEncrypted: encryptToken(
                tokenData.access_token,
                encryptionKey,
            ),
            refreshTokenEncrypted: encryptToken(
                tokenData.refresh_token || refreshToken,
                encryptionKey,
            ),
            accessToken: FieldValue.delete(),
            refreshToken: FieldValue.delete(),
            tokenType: tokenData.token_type || "Bearer",
            scope: tokenData.scope || claim.data.scope || "",
            expiresIn,
            expiresAtMs,
            connected: true,
            requiresReconnect: false,
            refreshLeaseId: FieldValue.delete(),
            refreshLeaseUntilMs: FieldValue.delete(),
            lastRefreshedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        });

        return {
            accessToken: tokenData.access_token,
            integration: {
                ...claim.data,
                expiresAtMs,
                connected: true,
                requiresReconnect: false,
            },
        };
    } catch (error) {
        const invalidGrant =
            error instanceof MercadoLibreApiError &&
            (error.status === 400 || error.status === 401);

        await ref.update({
            refreshLeaseId: FieldValue.delete(),
            refreshLeaseUntilMs: FieldValue.delete(),
            ...(invalidGrant
                ? {
                    connected: false,
                    requiresReconnect: true,
                    accessTokenEncrypted: FieldValue.delete(),
                    refreshTokenEncrypted: FieldValue.delete(),
                    accessToken: FieldValue.delete(),
                    refreshToken: FieldValue.delete(),
                }
                : {}),
            lastTokenError: cleanText(error?.message, 500),
            updatedAt: FieldValue.serverTimestamp(),
        });

        throw error;
    }
};

const mapMercadoLibreItemStatus = (status = "", fallback = "enviado") => {
    if (status === "active") return "publicado";
    if (status === "paused") return "pausado";
    if (status === "closed") return "cerrado";
    return fallback;
};

const toTimestampOrNull = (value) => {
    const millis = Number(value);
    if (!Number.isFinite(millis) || millis <= 0) return null;
    return Timestamp.fromMillis(millis);
};

const serializeTimestamp = (value) => {
    if (value?.toMillis) return value.toMillis();
    if (Number.isFinite(Number(value))) return Number(value);
    return null;
};

const getQuestionDetails = async (lead, accessToken) => {
    if (
        lead.contactType !== "question" ||
        !/^\d+$/.test(lead.externalId || "")
    ) {
        return {};
    }

    try {
        const question = await mercadoLibreRequest(
            `/questions/${lead.externalId}?api_version=4`,
            { accessToken },
        );

        return {
            questionText: cleanText(question?.text, 4000),
            questionStatus: cleanText(question?.status, 80),
            answerText: cleanText(question?.answer?.text, 4000),
            answerStatus: cleanText(question?.answer?.status, 80),
        };
    } catch (error) {
        console.warn("Mercado Libre question detail could not be loaded", {
            questionId: lead.externalId,
            message: error?.message || "",
        });
        return {};
    }
};

const persistMercadoLibreLead = async ({
    inmobiliariaId,
    sellerId,
    lead,
    accessToken = "",
    notification = null,
}) => {
    if (!lead?.leadId) {
        throw new Error("Mercado Libre no informó el ID del lead.");
    }

    let inmuebleId = "";
    let inmuebleTitle = "";

    if (lead.itemId) {
        const itemLinkSnap = await itemLinkRef(lead.itemId).get();
        if (
            itemLinkSnap.exists &&
            itemLinkSnap.data()?.inmobiliariaId === inmobiliariaId
        ) {
            inmuebleId = cleanText(itemLinkSnap.data()?.inmuebleId, 128);
        }
    }

    if (inmuebleId) {
        const inmuebleSnap = await inmuebleRef(inmobiliariaId, inmuebleId).get();
        if (inmuebleSnap.exists) {
            const inmueble = inmuebleSnap.data() || {};
            inmuebleTitle = cleanText(
                inmueble.titulo || inmueble.title || inmueble.nombre,
                300,
            );
        }
    }

    const questionDetails = accessToken
        ? await getQuestionDetails(lead, accessToken)
        : {};
    const ref = leadRef(inmobiliariaId, lead.leadId);

    await db.runTransaction(async (transaction) => {
        const currentSnap = await transaction.get(ref);
        const current = currentSnap.data() || {};
        const createdAtRemote = toTimestampOrNull(lead.createdAtMs);

        transaction.set(
            ref,
            {
                provider: "mercadolibre",
                leadId: lead.leadId,
                inmobiliariaId,
                sellerId,
                itemId: lead.itemId || "",
                inmuebleId,
                inmuebleTitle,
                buyerId: lead.buyerId || "",
                externalId: lead.externalId || "",
                contactType: lead.contactType || "",
                actions: lead.actions || [],
                status: lead.status || "",
                subStatus: lead.subStatus || "",
                name: lead.name || "",
                email: lead.email || "",
                phone: lead.phone || "",
                createdAtMs: lead.createdAtMs || Date.now(),
                createdAtRemote,
                questionText:
                    questionDetails.questionText || current.questionText || "",
                questionStatus:
                    questionDetails.questionStatus || current.questionStatus || "",
                answerText:
                    questionDetails.answerText || current.answerText || "",
                answerStatus:
                    questionDetails.answerStatus || current.answerStatus || "",
                managementStatus: current.managementStatus || "nuevo",
                managementNote: current.managementNote || "",
                firstReceivedAt:
                    current.firstReceivedAt || FieldValue.serverTimestamp(),
                lastReceivedAt: FieldValue.serverTimestamp(),
                lastNotificationId:
                    notification?.notificationId ||
                    current.lastNotificationId ||
                    "",
                notificationCount: FieldValue.increment(1),
                updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true },
        );
    });

    return {
        leadId: lead.leadId,
        inmuebleId,
        contactType: lead.contactType || "",
    };
};

const processMercadoLibreItemNotification = async ({
    inmobiliariaId,
    normalized,
    accessToken,
}) => {
    const parsed = parseMercadoLibreItemResource(normalized.resource);
    if (!parsed) return { ignored: true, reason: "invalid_item_resource" };

    const linkSnap = await itemLinkRef(parsed.itemId).get();
    if (!linkSnap.exists) {
        return { ignored: true, reason: "unknown_item" };
    }

    const link = linkSnap.data() || {};
    if (
        link.inmobiliariaId !== inmobiliariaId ||
        (
            normalized.sellerId &&
            link.sellerId &&
            normalized.sellerId !== link.sellerId.toString()
        )
    ) {
        return { ignored: true, reason: "seller_or_agency_mismatch" };
    }

    const item = await mercadoLibreRequest(parsed.apiResource, { accessToken });

    await publicationRef(inmobiliariaId, link.inmuebleId).set(
        {
            externalId: item.id || parsed.itemId,
            permalink: item.permalink || "",
            mlStatus: item.status || "",
            status: mapMercadoLibreItemStatus(item.status),
            lastNotificationAt: FieldValue.serverTimestamp(),
            lastSyncedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
    );

    return {
        processed: true,
        itemId: item.id || parsed.itemId,
        inmuebleId: link.inmuebleId || "",
    };
};

const processMercadoLibreLeadNotification = async ({
    inmobiliariaId,
    normalized,
    accessToken,
}) => {
    const parsed = parseMercadoLibreLeadResource(normalized.resource);
    if (!parsed) return { ignored: true, reason: "invalid_lead_resource" };

    const response = await mercadoLibreRequest(parsed.apiResource, {
        accessToken,
    });
    const lead = normalizeMercadoLibreLead(response || {}, {
        leadId: parsed.leadId,
        sellerId: normalized.sellerId,
        actions: normalized.actions,
    });

    return persistMercadoLibreLead({
        inmobiliariaId,
        sellerId: normalized.sellerId,
        lead,
        accessToken,
        notification: normalized,
    });
};

const processQueuedMercadoLibreNotification = async (
    notificationId,
    queuedNotification,
) => {
    const queueRef = notificationQueueRef(notificationId);
    const normalized = normalizeMercadoLibreNotification(queuedNotification);

    await queueRef.set(
        {
            status: "processing",
            processingStartedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
    );

    if (!normalized.sellerId) {
        await queueRef.set(
            {
                status: "ignored",
                ignoreReason: "missing_seller",
                processedAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true },
        );
        return;
    }

    const sellerConnectionSnap =
        await sellerConnectionRef(normalized.sellerId).get();
    if (!sellerConnectionSnap.exists) {
        await queueRef.set(
            {
                status: "ignored",
                ignoreReason: "seller_not_connected",
                processedAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true },
        );
        return;
    }

    const sellerConnection = sellerConnectionSnap.data() || {};
    const inmobiliariaId = cleanText(
        sellerConnection.inmobiliariaId,
        128,
    );
    if (!inmobiliariaId) {
        throw new Error("La conexión del seller no indica una inmobiliaria.");
    }

    const { accessToken } = await getValidConnection(inmobiliariaId);
    let result;

    if (normalized.topic === "items") {
        result = await processMercadoLibreItemNotification({
            inmobiliariaId,
            normalized,
            accessToken,
        });
    } else if (normalized.topic === "vis_leads") {
        result = await processMercadoLibreLeadNotification({
            inmobiliariaId,
            normalized,
            accessToken,
        });
    } else {
        result = { ignored: true, reason: "unsupported_topic" };
    }

    await queueRef.set(
        {
            status: result?.ignored ? "ignored" : "processed",
            ignoreReason: result?.reason || FieldValue.delete(),
            result: result || {},
            inmobiliariaId,
            processedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
    );
};

const getUtcDate = (daysAgo = 0) => {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - daysAgo);
    return date.toISOString().slice(0, 10);
};

const serializeLead = (document) => {
    const data = document.data() || {};

    return {
        id: document.id,
        leadId: data.leadId || document.id,
        itemId: data.itemId || "",
        inmuebleId: data.inmuebleId || "",
        inmuebleTitle: data.inmuebleTitle || "",
        buyerId: data.buyerId || "",
        externalId: data.externalId || "",
        contactType: data.contactType || "",
        actions: Array.isArray(data.actions) ? data.actions : [],
        status: data.status || "",
        subStatus: data.subStatus || "",
        name: data.name || "",
        email: data.email || "",
        phone: data.phone || "",
        questionText: data.questionText || "",
        questionStatus: data.questionStatus || "",
        answerText: data.answerText || "",
        answerStatus: data.answerStatus || "",
        managementStatus: data.managementStatus || "nuevo",
        managementNote: data.managementNote || "",
        createdAtMs:
            Number(data.createdAtMs) ||
            serializeTimestamp(data.createdAtRemote) ||
            null,
        firstReceivedAt: serializeTimestamp(data.firstReceivedAt),
        lastReceivedAt: serializeTimestamp(data.lastReceivedAt),
        updatedAt: serializeTimestamp(data.updatedAt),
    };
};

const sanitizeSettings = (settings = {}) => {
    const listingTypeId = cleanText(settings.listingTypeId, 40) || "silver";

    if (!ALLOWED_LISTING_TYPES.has(listingTypeId)) {
        throw new HttpsError(
            "invalid-argument",
            "Tipo de publicación inmobiliaria inválido.",
        );
    }

    const latitude = toFiniteNumberOrNull(settings.location?.latitude);
    const longitude = toFiniteNumberOrNull(settings.location?.longitude);
    const publicUrl = cleanText(settings.publicUrl, 1000);

    if (publicUrl && !/^https?:\/\//i.test(publicUrl)) {
        throw new HttpsError("invalid-argument", "La URL pública no es válida.");
    }

    return {
        categoryId: normalizeCategoryId(settings.categoryId),
        listingTypeId,
        publicUrl,
        internalNote: cleanText(settings.internalNote, 2000),
        location: {
            addressLine: cleanText(settings.location?.addressLine, 300),
            zipCode: cleanText(settings.location?.zipCode, 30),
            stateId: cleanText(settings.location?.stateId, 100),
            cityId: cleanText(settings.location?.cityId, 100),
            neighborhoodId: cleanText(
                settings.location?.neighborhoodId,
                100,
            ),
            latitude,
            longitude,
        },
        contact: {
            name: cleanText(settings.contact?.name, 120),
            email: cleanText(settings.contact?.email, 200),
            areaCode: cleanText(settings.contact?.areaCode, 12),
            phone: cleanText(settings.contact?.phone, 40),
        },
        videoId: cleanText(settings.videoId, 200),
    };
};

const getDireccion = (inmueble = {}) => {
    const direccion = inmueble.direccion || {};
    return {
        provincia: cleanText(inmueble.provincia || direccion.provincia, 120),
        ciudad: cleanText(inmueble.ciudad || direccion.ciudad, 120),
        barrio: cleanText(inmueble.barrio || direccion.barrio, 120),
        calle: cleanText(inmueble.calle || direccion.calle, 180),
        numero: cleanText(inmueble.numero || direccion.numero, 40),
    };
};

const getSortedImageUrls = (inmueble = {}) => {
    if (!Array.isArray(inmueble.images)) return [];

    return [...inmueble.images]
        .filter((image) => image?.url)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((image) => cleanText(image.url, 2000))
        .filter((url) => /^https?:\/\//i.test(url));
};

const getYouTubeVideoId = (inmueble = {}, configuredVideoId = "") => {
    if (configuredVideoId) return configuredVideoId;

    const videoUrl = Array.isArray(inmueble.videos)
        ? inmueble.videos
            .map((video) => video?.url || video)
            .find((value) => typeof value === "string")
        : "";

    if (!videoUrl) return "";

    const match = videoUrl.match(
        /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{6,})/i,
    );
    return match?.[1] ? `${match[1]};youtube` : "";
};

const buildAttribute = (id, value, { unit = "" } = {}) => {
    if (value === null || value === undefined || value === "") return null;

    return {
        id,
        value_name: `${value}${unit ? ` ${unit}` : ""}`,
    };
};

const buildPublicationPayload = ({
    inmueble,
    inmobiliaria,
    settings,
    inmuebleId,
}) => {
    const direccion = getDireccion(inmueble);
    const features = inmueble.caracteristicas || {};
    const surface = inmueble.superficie || {};
    const images = getSortedImageUrls(inmueble);
    const price = toFiniteNumberOrNull(inmueble.precio);
    const agencyContact = inmobiliaria.configuracion?.contacto || {};
    const contactPhone =
        settings.contact.phone ||
        cleanText(agencyContact.telefono || agencyContact.whatsapp, 40);
    const contactEmail =
        settings.contact.email || cleanText(agencyContact.email, 200);
    const contactName =
        settings.contact.name || cleanText(inmobiliaria.nombre, 120);
    const addressLine =
        settings.location.addressLine ||
        [direccion.calle, direccion.numero].filter(Boolean).join(" ");

    const location = {
        address_line: addressLine,
        zip_code: settings.location.zipCode,
        ...(settings.location.stateId
            ? { state: { id: settings.location.stateId } }
            : direccion.provincia
                ? { state: { name: direccion.provincia } }
                : {}),
        ...(settings.location.cityId
            ? { city: { id: settings.location.cityId } }
            : direccion.ciudad
                ? { city: { name: direccion.ciudad } }
                : {}),
        ...(settings.location.neighborhoodId
            ? { neighborhood: { id: settings.location.neighborhoodId } }
            : direccion.barrio
                ? { neighborhood: { name: direccion.barrio } }
                : {}),
        ...(settings.location.latitude !== null &&
            settings.location.longitude !== null
            ? {
                latitude: settings.location.latitude,
                longitude: settings.location.longitude,
            }
            : {}),
    };

    const description = [
        cleanText(inmueble.descripcion, 50000),
        settings.publicUrl ? `Ficha pública: ${settings.publicUrl}` : "",
    ]
        .filter(Boolean)
        .join("\n\n");

    const attributes = [
        buildAttribute(
            "ROOMS",
            features.ambientes || inmueble.ambientes,
        ),
        buildAttribute(
            "BEDROOMS",
            features.dormitorios || inmueble.dormitorios,
        ),
        buildAttribute(
            "FULL_BATHROOMS",
            features.banos || inmueble.banos || inmueble.banios,
        ),
        buildAttribute(
            "PARKING_LOTS",
            features.cocherasCantidad || inmueble.cocheras,
        ),
        buildAttribute(
            "COVERED_AREA",
            surface.cubierta || inmueble.superficieCubierta,
            { unit: "m²" },
        ),
        buildAttribute(
            "TOTAL_AREA",
            surface.total || inmueble.superficieTotal,
            { unit: "m²" },
        ),
    ].filter(Boolean);

    const payload = {
        title: cleanText(inmueble.titulo, 60),
        category_id: settings.categoryId,
        price,
        currency_id: cleanText(inmueble.moneda, 10) || "USD",
        available_quantity: 1,
        buying_mode: "classified",
        listing_type_id: settings.listingTypeId,
        condition: "not_specified",
        channels: ["marketplace"],
        pictures: images.map((source) => ({ source })),
        seller_contact: {
            contact: contactName,
            other_info: "",
            area_code: settings.contact.areaCode,
            phone: contactPhone,
            area_code2: "",
            phone2: "",
            email: contactEmail,
            webmail: "",
        },
        location,
        attributes,
        description: {
            plain_text: description,
        },
    };

    const videoId = getYouTubeVideoId(inmueble, settings.videoId);
    if (videoId) payload.video_id = videoId;

    const errors = [];
    if (!payload.category_id) errors.push("Falta la categoría final de Mercado Libre.");
    if (!payload.title || payload.title.length < 8) {
        errors.push("El título debe tener al menos 8 caracteres.");
    }
    if (!price || price <= 0) errors.push("El precio debe ser mayor a cero.");
    if (images.length === 0) errors.push("Debe incluir al menos una imagen.");
    if (!description || description.length < 40) {
        errors.push("La descripción debe tener al menos 40 caracteres.");
    }
    if (!location.city && !location.neighborhood) {
        errors.push("Debe informar al menos ciudad o barrio.");
    }
    if (!contactEmail && !contactPhone) {
        errors.push("Falta email o teléfono de contacto de la inmobiliaria.");
    }

    return {
        payload,
        errors,
        internalReference: `onoprop:${inmuebleId}`,
    };
};

const getPublicationContext = async (
    inmobiliariaId,
    inmuebleId,
    requestedSettings,
) => {
    if (!inmuebleId) {
        throw new HttpsError("invalid-argument", "Falta el inmueble.");
    }

    const inmoRef = db.collection("inmobiliarias").doc(inmobiliariaId);
    const [inmuebleSnap, inmobiliariaSnap, publicationSnap] = await Promise.all([
        inmuebleRef(inmobiliariaId, inmuebleId).get(),
        inmoRef.get(),
        publicationRef(inmobiliariaId, inmuebleId).get(),
    ]);

    if (!inmuebleSnap.exists) {
        throw new HttpsError("not-found", "No se encontró el inmueble.");
    }
    if (!inmobiliariaSnap.exists) {
        throw new HttpsError("not-found", "No se encontró la inmobiliaria.");
    }

    const inmueble = { id: inmuebleId, ...(inmuebleSnap.data() || {}) };
    const inmobiliaria = {
        id: inmobiliariaId,
        ...(inmobiliariaSnap.data() || {}),
    };
    const publication = publicationSnap.data() || {};
    const legacySettings = inmueble.distribution?.mercadolibre || {};
    const settings = sanitizeSettings({
        ...legacySettings,
        ...(publication.settings || {}),
        ...(requestedSettings || {}),
        location: {
            ...(legacySettings.location || {}),
            ...(publication.settings?.location || {}),
            ...(requestedSettings?.location || {}),
        },
        contact: {
            ...(legacySettings.contact || {}),
            ...(publication.settings?.contact || {}),
            ...(requestedSettings?.contact || {}),
        },
    });

    return {
        inmueble,
        inmobiliaria,
        publication,
        settings,
        ref: publicationRef(inmobiliariaId, inmuebleId),
        inmuebleDocumentRef: inmuebleRef(inmobiliariaId, inmuebleId),
    };
};

const assertLocallyValidPayload = (result) => {
    if (result.errors.length > 0) {
        throw new HttpsError("failed-precondition", result.errors.join(" · "));
    }
};

const persistPrivateSettings = async ({
    ref,
    inmuebleDocumentRef,
    settings,
    uid,
}) => {
    const batch = db.batch();
    batch.set(
        ref,
        {
            provider: "mercadolibre",
            settings,
            updatedBy: uid,
            updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
    );
    batch.update(inmuebleDocumentRef, {
        "distribution.mercadolibre": FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
    });
    await batch.commit();
};

const getRequiredAttributes = (attributes = []) => {
    return attributes
        .filter((attribute) => attribute?.tags?.required === true)
        .map((attribute) => ({
            id: attribute.id,
            name: attribute.name || attribute.id,
            valueType: attribute.value_type || "",
            values: Array.isArray(attribute.values)
                ? attribute.values.slice(0, 100).map((value) => ({
                    id: value.id || "",
                    name: value.name || "",
                }))
                : [],
        }));
};

const extractListingTypes = (packs) => {
    const types = new Set();
    const visit = (value) => {
        if (Array.isArray(value)) {
            value.forEach(visit);
            return;
        }
        if (!value || typeof value !== "object") return;

        if (
            typeof value.listing_type_id === "string" &&
            ALLOWED_LISTING_TYPES.has(value.listing_type_id)
        ) {
            types.add(value.listing_type_id);
        }
        Object.values(value).forEach(visit);
    };

    visit(packs);
    return [...types];
};

export const mercadoLibreAuthStart = onCall(
    {
        region: REGION,
        secrets: [MERCADOLIBRE_CLIENT_ID, MERCADOLIBRE_REDIRECT_URI],
    },
    async (request) => {
        const { uid, inmobiliariaId } = await assertAuthenticatedManager(request);
        const state = crypto.randomBytes(32).toString("hex");
        const codeVerifier = crypto.randomBytes(48).toString("base64url");
        const codeChallenge = crypto
            .createHash("sha256")
            .update(codeVerifier)
            .digest("base64url");
        const now = Date.now();

        await db.collection("mercadolibre_oauth_states").doc(state).set({
            state,
            uid,
            inmobiliariaId,
            codeVerifier,
            used: false,
            createdAt: FieldValue.serverTimestamp(),
            expiresAtMs: now + OAUTH_STATE_TTL_MS,
            expiresAt: Timestamp.fromMillis(now + OAUTH_STATE_TTL_MS),
        });

        return {
            authUrl: buildMercadoLibreAuthUrl({
                clientId: MERCADOLIBRE_CLIENT_ID.value(),
                redirectUri: MERCADOLIBRE_REDIRECT_URI.value(),
                state,
                codeChallenge,
            }),
            expiresAtMs: now + OAUTH_STATE_TTL_MS,
        };
    },
);

export const mercadoLibreOAuthCallback = onRequest(
    {
        region: REGION,
        secrets: [
            MERCADOLIBRE_CLIENT_ID,
            MERCADOLIBRE_CLIENT_SECRET,
            MERCADOLIBRE_REDIRECT_URI,
            MERCADOLIBRE_TOKEN_ENCRYPTION_KEY,
        ],
    },
    async (req, res) => {
        try {
            const code = cleanText(req.query.code, 1000);
            const state = cleanText(req.query.state, 200);
            const oauthError = cleanText(req.query.error, 300);

            if (oauthError) {
                throw new Error(`Mercado Libre rechazó la autorización: ${oauthError}`);
            }
            if (!code || !state) {
                res.status(400).send("Falta code o state.");
                return;
            }

            const stateRef = db.collection("mercadolibre_oauth_states").doc(state);
            let stateData;

            await db.runTransaction(async (transaction) => {
                const stateSnap = await transaction.get(stateRef);

                if (!stateSnap.exists) {
                    throw new HttpsError(
                        "invalid-argument",
                        "State inválido o vencido.",
                    );
                }

                stateData = stateSnap.data() || {};
                if (stateData.used === true) {
                    throw new HttpsError(
                        "already-exists",
                        "State ya utilizado.",
                    );
                }
                if (
                    !stateData.expiresAtMs ||
                    Date.now() > stateData.expiresAtMs
                ) {
                    throw new HttpsError(
                        "deadline-exceeded",
                        "State vencido.",
                    );
                }

                transaction.update(stateRef, {
                    used: true,
                    usedAt: FieldValue.serverTimestamp(),
                });
            });

            const { uid, inmobiliariaId } = stateData;
            await assertCanManageInmobiliaria(uid, inmobiliariaId);

            const tokenData = await oauthTokenRequest({
                grant_type: "authorization_code",
                client_id: MERCADOLIBRE_CLIENT_ID.value(),
                client_secret: MERCADOLIBRE_CLIENT_SECRET.value(),
                code,
                redirect_uri: MERCADOLIBRE_REDIRECT_URI.value(),
                code_verifier: stateData.codeVerifier || "",
            });
            const mlUser = await mercadoLibreRequest("/users/me", {
                accessToken: tokenData.access_token,
            });
            const sellerId = (
                tokenData.user_id ||
                mlUser.id ||
                ""
            ).toString();

            if (!sellerId) {
                throw new Error("Mercado Libre no informó el seller_id.");
            }

            const expiresIn = Number(tokenData.expires_in || 0);
            const expiresAtMs = Date.now() + expiresIn * 1000;
            const encryptionKey = MERCADOLIBRE_TOKEN_ENCRYPTION_KEY.value();
            const existingSellerConnection =
                await sellerConnectionRef(sellerId).get();

            if (
                existingSellerConnection.exists &&
                existingSellerConnection.data()?.inmobiliariaId !== inmobiliariaId
            ) {
                throw new HttpsError(
                    "already-exists",
                    "Esta cuenta de Mercado Libre ya está conectada a otra inmobiliaria.",
                );
            }

            const connectionData = {
                provider: "mercadolibre",
                connected: true,
                requiresReconnect: false,
                connectedBy: uid,
                mercadoLibreUserId: sellerId,
                sellerId,
                sellerNickname: cleanText(mlUser.nickname, 200),
                sellerEmail: cleanText(mlUser.email, 300),
                siteId: cleanText(mlUser.site_id, 20) || "MLA",
                accessTokenEncrypted: encryptToken(
                    tokenData.access_token,
                    encryptionKey,
                ),
                refreshTokenEncrypted: encryptToken(
                    tokenData.refresh_token,
                    encryptionKey,
                ),
                accessToken: FieldValue.delete(),
                refreshToken: FieldValue.delete(),
                tokenType: tokenData.token_type || "Bearer",
                expiresIn,
                expiresAtMs,
                scope: tokenData.scope || "",
                updatedAt: FieldValue.serverTimestamp(),
                connectedAt: FieldValue.serverTimestamp(),
                accountMode: "own_account",
            };
            const batch = db.batch();

            batch.set(integrationRef(inmobiliariaId), connectionData, {
                merge: true,
            });
            batch.set(
                sellerConnectionRef(sellerId),
                {
                    sellerId,
                    inmobiliariaId,
                    siteId: connectionData.siteId,
                    updatedAt: FieldValue.serverTimestamp(),
                },
                { merge: true },
            );
            batch.delete(stateRef);
            await batch.commit();

            res.status(200).send(`
        <!doctype html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>Mercado Libre conectado</title>
          </head>
          <body style="font-family: Arial, sans-serif; padding: 32px;">
            <h1>Mercado Libre conectado correctamente</h1>
            <p>Esta ventana se cerrará automáticamente.</p>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: "mercadolibre-oauth-success" }, "*");
              }
              window.setTimeout(() => window.close(), 800);
            </script>
          </body>
        </html>
      `);
        } catch (error) {
            console.error("Mercado Libre OAuth callback error", {
                name: error?.name || "",
                message: error?.message || "",
            });

            res.status(500).send(`
        <!doctype html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>Error Mercado Libre</title>
          </head>
          <body style="font-family: Arial, sans-serif; padding: 32px;">
            <h1>No se pudo conectar Mercado Libre</h1>
            <p>${escapeHtml(error?.message || "Error desconocido")}</p>
          </body>
        </html>
      `);
        }
    },
);

export const mercadoLibreConnectionStatus = onCall(
    { region: REGION },
    async (request) => {
        const { inmobiliariaId } = await assertAuthenticatedManager(request);
        const integrationSnap = await integrationRef(inmobiliariaId).get();

        if (!integrationSnap.exists) {
            return {
                connected: false,
                requiresReconnect: false,
                accountMode: "own_account",
            };
        }

        const data = integrationSnap.data() || {};
        const hasRefreshToken = Boolean(
            data.refreshTokenEncrypted || data.refreshToken,
        );
        const accessTokenExpired =
            Number(data.expiresAtMs || 0) <= Date.now();

        return {
            connected:
                data.connected === true &&
                data.requiresReconnect !== true &&
                hasRefreshToken,
            requiresReconnect:
                data.requiresReconnect === true ||
                (accessTokenExpired && !hasRefreshToken),
            accessTokenExpired,
            accountMode: data.accountMode || "own_account",
            sellerId: data.sellerId || "",
            sellerNickname: data.sellerNickname || "",
            sellerEmail: data.sellerEmail || "",
            siteId: data.siteId || "MLA",
            expiresAtMs: data.expiresAtMs || null,
            updatedAt: data.updatedAt?.toMillis?.() || null,
        };
    },
);

export const mercadoLibreDisconnect = onCall(
    { region: REGION },
    async (request) => {
        const { uid, inmobiliariaId } = await assertAuthenticatedManager(request);
        const ref = integrationRef(inmobiliariaId);
        const snap = await ref.get();

        if (!snap.exists) return { disconnected: true };

        const data = snap.data() || {};
        const batch = db.batch();
        batch.set(
            ref,
            {
                connected: false,
                requiresReconnect: false,
                disconnectedBy: uid,
                disconnectedAt: FieldValue.serverTimestamp(),
                accessTokenEncrypted: FieldValue.delete(),
                refreshTokenEncrypted: FieldValue.delete(),
                accessToken: FieldValue.delete(),
                refreshToken: FieldValue.delete(),
                expiresAtMs: FieldValue.delete(),
                refreshLeaseId: FieldValue.delete(),
                refreshLeaseUntilMs: FieldValue.delete(),
                updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true },
        );
        if (data.sellerId) {
            batch.delete(sellerConnectionRef(data.sellerId));
        }
        await batch.commit();

        return { disconnected: true };
    },
);

export const mercadoLibreGetDistribution = onCall(
    { region: REGION },
    async (request) => {
        const { inmobiliariaId } = await assertAuthenticatedManager(request);
        const inmuebleId = cleanText(request.data?.inmuebleId, 128);
        const context = await getPublicationContext(inmobiliariaId, inmuebleId);
        const data = context.publication;

        return {
            settings: context.settings,
            externalId: data.externalId || "",
            permalink: data.permalink || "",
            status: data.status || "no_preparado",
            mlStatus: data.mlStatus || "",
            lastError: data.lastError || "",
            lastValidatedAt: data.lastValidatedAt?.toMillis?.() || null,
            lastSyncedAt: data.lastSyncedAt?.toMillis?.() || null,
            updatedAt: data.updatedAt?.toMillis?.() || null,
        };
    },
);

export const mercadoLibreSaveSettings = onCall(
    { region: REGION },
    async (request) => {
        const { uid, inmobiliariaId } = await assertAuthenticatedManager(request);
        const inmuebleId = cleanText(request.data?.inmuebleId, 128);
        const context = await getPublicationContext(
            inmobiliariaId,
            inmuebleId,
            request.data?.settings,
        );

        await persistPrivateSettings({
            ref: context.ref,
            inmuebleDocumentRef: context.inmuebleDocumentRef,
            settings: context.settings,
            uid,
        });

        return { saved: true, settings: context.settings };
    },
);

export const mercadoLibreGetCategoryDetails = onCall(
    {
        region: REGION,
        secrets: [
            MERCADOLIBRE_CLIENT_ID,
            MERCADOLIBRE_CLIENT_SECRET,
            MERCADOLIBRE_TOKEN_ENCRYPTION_KEY,
        ],
    },
    async (request) => {
        try {
            const { inmobiliariaId } = await assertAuthenticatedManager(request);
            const requestedCategoryId = normalizeCategoryId(
                request.data?.categoryId,
            );
            const { accessToken, integration } =
                await getValidConnection(inmobiliariaId);
            const siteId =
                cleanText(integration.siteId, 20).toUpperCase() || "MLA";
            const rootId = REAL_ESTATE_ROOT_CATEGORY_BY_SITE[siteId];

            if (!rootId) {
                throw new HttpsError(
                    "failed-precondition",
                    `La cuenta conectada pertenece al sitio ${siteId}, que todavía no está habilitado para inmuebles.`,
                );
            }

            const categoryId = requestedCategoryId || rootId;
            const category = await mercadoLibreRequest(
                `/categories/${categoryId}`,
                { accessToken },
            );
            const path = Array.isArray(category.path_from_root)
                ? category.path_from_root.map((segment) => ({
                    id: segment.id || "",
                    name: segment.name || "",
                }))
                : [];

            if (!path.some((segment) => segment.id === rootId)) {
                throw new HttpsError(
                    "invalid-argument",
                    `La categoría debe pertenecer a Inmuebles del sitio ${siteId}.`,
                );
            }

            const children = Array.isArray(category.children_categories)
                ? category.children_categories.map((child) => ({
                    id: child.id,
                    name: child.name,
                }))
                : [];
            const isLeaf = children.length === 0;
            let attributes = [];
            let listingTypes = [];

            if (isLeaf) {
                [attributes] = await Promise.all([
                    mercadoLibreRequest(`/categories/${categoryId}/attributes`, {
                        accessToken,
                    }),
                ]);

                try {
                    const packs = await mercadoLibreRequest(
                        `/users/${integration.sellerId}/classifieds_promotion_packs?categoryId=${categoryId}`,
                        { accessToken },
                    );
                    listingTypes = extractListingTypes(packs);
                } catch (error) {
                    console.warn(
                        "No se pudieron consultar los paquetes de Mercado Libre",
                        { status: error?.status || 0 },
                    );
                }
            }

            return {
                id: category.id || categoryId,
                name: category.name || "",
                siteId,
                rootId,
                path,
                isLeaf,
                children,
                requiredAttributes: getRequiredAttributes(attributes),
                listingTypes:
                    listingTypes.length > 0
                        ? listingTypes
                        : ["silver", "gold", "gold_premium"],
            };
        } catch (error) {
            throw toHttpsError(error);
        }
    },
);

export const mercadoLibreGetLocationOptions = onCall(
    {
        region: REGION,
        secrets: [
            MERCADOLIBRE_CLIENT_ID,
            MERCADOLIBRE_CLIENT_SECRET,
            MERCADOLIBRE_TOKEN_ENCRYPTION_KEY,
        ],
    },
    async (request) => {
        try {
            const { inmobiliariaId } = await assertAuthenticatedManager(request);
            const level = cleanText(request.data?.level, 30);
            const locationId = cleanText(request.data?.locationId, 120);
            const { accessToken } = await getValidConnection(inmobiliariaId);
            let path;
            let responseField;

            if (level === "country") {
                path = `/classified_locations/countries/${locationId || "AR"}`;
                responseField = "states";
            } else if (level === "state" && locationId) {
                path = `/classified_locations/states/${encodeURIComponent(locationId)}`;
                responseField = "cities";
            } else if (level === "city" && locationId) {
                path = `/classified_locations/cities/${encodeURIComponent(locationId)}`;
                responseField = "neighborhoods";
            } else {
                throw new HttpsError(
                    "invalid-argument",
                    "Nivel o ubicación inválidos.",
                );
            }

            const data = await mercadoLibreRequest(path, { accessToken });
            const options = Array.isArray(data?.[responseField])
                ? data[responseField].map((option) => ({
                    id: option.id || "",
                    name: option.name || "",
                }))
                : [];

            return {
                level,
                id: data?.id || locationId,
                name: data?.name || "",
                options,
            };
        } catch (error) {
            throw toHttpsError(error);
        }
    },
);

export const mercadoLibreValidateItem = onCall(
    {
        region: REGION,
        timeoutSeconds: 60,
        secrets: [
            MERCADOLIBRE_CLIENT_ID,
            MERCADOLIBRE_CLIENT_SECRET,
            MERCADOLIBRE_TOKEN_ENCRYPTION_KEY,
        ],
    },
    async (request) => {
        const { uid, inmobiliariaId } = await assertAuthenticatedManager(request);
        const inmuebleId = cleanText(request.data?.inmuebleId, 128);

        try {
            const context = await getPublicationContext(
                inmobiliariaId,
                inmuebleId,
                request.data?.settings,
            );
            const result = buildPublicationPayload({
                inmueble: context.inmueble,
                inmobiliaria: context.inmobiliaria,
                settings: context.settings,
                inmuebleId,
            });

            await persistPrivateSettings({
                ref: context.ref,
                inmuebleDocumentRef: context.inmuebleDocumentRef,
                settings: context.settings,
                uid,
            });

            if (result.errors.length > 0) {
                return {
                    valid: false,
                    errors: result.errors,
                    payload: result.payload,
                };
            }

            const { accessToken } = await getValidConnection(inmobiliariaId);

            try {
                await mercadoLibreRequest("/items/validate", {
                    accessToken,
                    method: "POST",
                    body: result.payload,
                });
            } catch (error) {
                if (error instanceof MercadoLibreApiError) {
                    const validationError = formatMercadoLibreError(error);
                    await context.ref.set(
                        {
                            lastValidationErrors: [validationError],
                            lastValidatedAt: FieldValue.serverTimestamp(),
                            updatedAt: FieldValue.serverTimestamp(),
                        },
                        { merge: true },
                    );
                    return {
                        valid: false,
                        errors: [validationError],
                        payload: result.payload,
                    };
                }
                throw error;
            }

            await context.ref.set(
                {
                    lastValidationErrors: [],
                    lastValidatedAt: FieldValue.serverTimestamp(),
                    updatedAt: FieldValue.serverTimestamp(),
                },
                { merge: true },
            );

            return {
                valid: true,
                errors: [],
                payload: result.payload,
            };
        } catch (error) {
            throw toHttpsError(error);
        }
    },
);

export const mercadoLibrePublishItem = onCall(
    {
        region: REGION,
        timeoutSeconds: 90,
        secrets: [
            MERCADOLIBRE_CLIENT_ID,
            MERCADOLIBRE_CLIENT_SECRET,
            MERCADOLIBRE_TOKEN_ENCRYPTION_KEY,
        ],
    },
    async (request) => {
        const { uid, inmobiliariaId } = await assertAuthenticatedManager(request);
        const inmuebleId = cleanText(request.data?.inmuebleId, 128);
        const operationId = crypto.randomUUID();

        try {
            const context = await getPublicationContext(
                inmobiliariaId,
                inmuebleId,
                request.data?.settings,
            );
            const result = buildPublicationPayload({
                inmueble: context.inmueble,
                inmobiliaria: context.inmobiliaria,
                settings: context.settings,
                inmuebleId,
            });
            assertLocallyValidPayload(result);

            await db.runTransaction(async (transaction) => {
                const snap = await transaction.get(context.ref);
                const data = snap.data() || {};
                const now = Date.now();

                if (data.externalId && data.mlStatus !== "closed") {
                    throw new HttpsError(
                        "already-exists",
                        `El inmueble ya está vinculado a ${data.externalId}.`,
                    );
                }
                if (
                    data.operationStatus === "publishing" &&
                    Number(data.operationLeaseUntilMs || 0) > now
                ) {
                    throw new HttpsError(
                        "aborted",
                        "Ya hay una publicación en curso.",
                    );
                }

                transaction.set(
                    context.ref,
                    {
                        provider: "mercadolibre",
                        settings: context.settings,
                        operationId,
                        operationStatus: "publishing",
                        operationLeaseUntilMs: now + PUBLICATION_LEASE_MS,
                        updatedBy: uid,
                        updatedAt: FieldValue.serverTimestamp(),
                    },
                    { merge: true },
                );
            });

            const { accessToken, integration } =
                await getValidConnection(inmobiliariaId);
            await mercadoLibreRequest("/items/validate", {
                accessToken,
                method: "POST",
                body: result.payload,
            });
            const item = await mercadoLibreRequest("/items", {
                accessToken,
                method: "POST",
                body: result.payload,
            });

            if (!item?.id) {
                throw new Error("Mercado Libre no devolvió el ID de la publicación.");
            }

            const batch = db.batch();
            batch.set(
                context.ref,
                {
                    provider: "mercadolibre",
                    settings: context.settings,
                    externalId: item.id,
                    permalink: item.permalink || "",
                    status: "publicado",
                    mlStatus: item.status || "active",
                    sellerId: integration.sellerId || "",
                    operationId,
                    operationStatus: "published",
                    operationLeaseUntilMs: FieldValue.delete(),
                    lastError: FieldValue.delete(),
                    publishedBy: uid,
                    publishedAt: FieldValue.serverTimestamp(),
                    lastSyncedAt: FieldValue.serverTimestamp(),
                    updatedAt: FieldValue.serverTimestamp(),
                },
                { merge: true },
            );
            batch.set(
                itemLinkRef(item.id),
                {
                    itemId: item.id,
                    inmobiliariaId,
                    inmuebleId,
                    sellerId: integration.sellerId || "",
                    createdAt: FieldValue.serverTimestamp(),
                    updatedAt: FieldValue.serverTimestamp(),
                },
                { merge: true },
            );
            batch.update(context.inmuebleDocumentRef, {
                "distribution.mercadolibre": FieldValue.delete(),
                updatedAt: FieldValue.serverTimestamp(),
            });
            await batch.commit();

            return {
                published: true,
                externalId: item.id,
                permalink: item.permalink || "",
                mlStatus: item.status || "active",
            };
        } catch (error) {
            if (inmuebleId) {
                await publicationRef(inmobiliariaId, inmuebleId).set(
                    {
                        operationId,
                        operationStatus: "error",
                        operationLeaseUntilMs: FieldValue.delete(),
                        status: "error",
                        lastError: formatMercadoLibreError(error),
                        updatedAt: FieldValue.serverTimestamp(),
                    },
                    { merge: true },
                );
            }
            throw toHttpsError(error, "No se pudo publicar el inmueble.");
        }
    },
);

export const mercadoLibreUpdateItem = onCall(
    {
        region: REGION,
        timeoutSeconds: 90,
        secrets: [
            MERCADOLIBRE_CLIENT_ID,
            MERCADOLIBRE_CLIENT_SECRET,
            MERCADOLIBRE_TOKEN_ENCRYPTION_KEY,
        ],
    },
    async (request) => {
        const { uid, inmobiliariaId } = await assertAuthenticatedManager(request);
        const inmuebleId = cleanText(request.data?.inmuebleId, 128);

        try {
            const context = await getPublicationContext(
                inmobiliariaId,
                inmuebleId,
                request.data?.settings,
            );
            const itemId = cleanText(context.publication.externalId, 80);

            if (!/^MLA\d+$/.test(itemId)) {
                throw new HttpsError(
                    "failed-precondition",
                    "El inmueble todavía no tiene una publicación de Mercado Libre.",
                );
            }

            const result = buildPublicationPayload({
                inmueble: context.inmueble,
                inmobiliaria: context.inmobiliaria,
                settings: context.settings,
                inmuebleId,
            });
            assertLocallyValidPayload(result);
            const { description, category_id: ignoredCategory, ...itemPayload } =
                result.payload;
            void ignoredCategory;
            delete itemPayload.listing_type_id;
            delete itemPayload.available_quantity;
            delete itemPayload.buying_mode;
            delete itemPayload.condition;
            delete itemPayload.channels;

            const { accessToken } = await getValidConnection(inmobiliariaId);
            const item = await mercadoLibreRequest(`/items/${itemId}`, {
                accessToken,
                method: "PUT",
                body: itemPayload,
            });

            if (description?.plain_text) {
                await mercadoLibreRequest(`/items/${itemId}/description`, {
                    accessToken,
                    method: "PUT",
                    body: description,
                });
            }

            await context.ref.set(
                {
                    settings: context.settings,
                    permalink: item?.permalink || context.publication.permalink || "",
                    status: "publicado",
                    mlStatus: item?.status || context.publication.mlStatus || "",
                    lastError: FieldValue.delete(),
                    updatedBy: uid,
                    lastSyncedAt: FieldValue.serverTimestamp(),
                    updatedAt: FieldValue.serverTimestamp(),
                },
                { merge: true },
            );

            return {
                updated: true,
                externalId: itemId,
                permalink: item?.permalink || context.publication.permalink || "",
                mlStatus: item?.status || context.publication.mlStatus || "",
            };
        } catch (error) {
            throw toHttpsError(error, "No se pudo actualizar la publicación.");
        }
    },
);

export const mercadoLibreChangeItemStatus = onCall(
    {
        region: REGION,
        timeoutSeconds: 60,
        secrets: [
            MERCADOLIBRE_CLIENT_ID,
            MERCADOLIBRE_CLIENT_SECRET,
            MERCADOLIBRE_TOKEN_ENCRYPTION_KEY,
        ],
    },
    async (request) => {
        const { uid, inmobiliariaId } = await assertAuthenticatedManager(request);
        const inmuebleId = cleanText(request.data?.inmuebleId, 128);
        const requestedStatus = cleanText(request.data?.status, 20);

        if (!["active", "paused", "closed"].includes(requestedStatus)) {
            throw new HttpsError("invalid-argument", "Estado inválido.");
        }

        try {
            const context = await getPublicationContext(
                inmobiliariaId,
                inmuebleId,
            );
            const itemId = cleanText(context.publication.externalId, 80);

            if (!/^MLA\d+$/.test(itemId)) {
                throw new HttpsError(
                    "failed-precondition",
                    "El inmueble no tiene una publicación vinculada.",
                );
            }

            const { accessToken } = await getValidConnection(inmobiliariaId);
            const item = await mercadoLibreRequest(`/items/${itemId}`, {
                accessToken,
                method: "PUT",
                body: { status: requestedStatus },
            });
            const mlStatus = item?.status || requestedStatus;

            await context.ref.set(
                {
                    mlStatus,
                    status:
                        mlStatus === "active"
                            ? "publicado"
                            : mlStatus === "paused"
                                ? "pausado"
                                : "cerrado",
                    updatedBy: uid,
                    lastSyncedAt: FieldValue.serverTimestamp(),
                    updatedAt: FieldValue.serverTimestamp(),
                },
                { merge: true },
            );

            return { changed: true, mlStatus };
        } catch (error) {
            throw toHttpsError(error, "No se pudo cambiar el estado.");
        }
    },
);

export const mercadoLibreSyncItemStatus = onCall(
    {
        region: REGION,
        timeoutSeconds: 60,
        secrets: [
            MERCADOLIBRE_CLIENT_ID,
            MERCADOLIBRE_CLIENT_SECRET,
            MERCADOLIBRE_TOKEN_ENCRYPTION_KEY,
        ],
    },
    async (request) => {
        const { inmobiliariaId } = await assertAuthenticatedManager(request);
        const inmuebleId = cleanText(request.data?.inmuebleId, 128);

        try {
            const context = await getPublicationContext(
                inmobiliariaId,
                inmuebleId,
            );
            const itemId = cleanText(context.publication.externalId, 80);

            if (!/^MLA\d+$/.test(itemId)) {
                throw new HttpsError(
                    "failed-precondition",
                    "El inmueble no tiene una publicación vinculada.",
                );
            }

            const { accessToken } = await getValidConnection(inmobiliariaId);
            const item = await mercadoLibreRequest(`/items/${itemId}`, {
                accessToken,
            });

            await context.ref.set(
                {
                    externalId: item.id || itemId,
                    permalink: item.permalink || context.publication.permalink || "",
                    mlStatus: item.status || "",
                    status:
                        item.status === "active"
                            ? "publicado"
                            : item.status === "paused"
                                ? "pausado"
                                : item.status === "closed"
                                    ? "cerrado"
                                    : context.publication.status || "enviado",
                    lastSyncedAt: FieldValue.serverTimestamp(),
                    updatedAt: FieldValue.serverTimestamp(),
                },
                { merge: true },
            );

            return {
                externalId: item.id || itemId,
                permalink: item.permalink || "",
                mlStatus: item.status || "",
            };
        } catch (error) {
            throw toHttpsError(error, "No se pudo sincronizar la publicación.");
        }
    },
);

export const mercadoLibreGetLeads = onCall(
    { region: REGION },
    async (request) => {
        const { inmobiliariaId } = await assertAuthenticatedManager(request);
        const requestedLimit = Number(request.data?.limit || 100);
        const limit = Math.min(Math.max(requestedLimit, 1), 200);
        const managementStatus = cleanText(
            request.data?.managementStatus,
            30,
        );
        const contactType = cleanText(request.data?.contactType, 80);
        const inmuebleId = cleanText(request.data?.inmuebleId, 128);
        const snapshot = await leadsCollectionRef(inmobiliariaId)
            .orderBy("createdAtMs", "desc")
            .limit(200)
            .get();
        const leads = snapshot.docs
            .map(serializeLead)
            .filter((lead) => {
                if (
                    managementStatus &&
                    lead.managementStatus !== managementStatus
                ) {
                    return false;
                }
                if (contactType && lead.contactType !== contactType) {
                    return false;
                }
                if (inmuebleId && lead.inmuebleId !== inmuebleId) {
                    return false;
                }
                return true;
            })
            .slice(0, limit);

        return {
            leads,
            count: leads.length,
            generatedAtMs: Date.now(),
        };
    },
);

export const mercadoLibreUpdateLeadStatus = onCall(
    { region: REGION },
    async (request) => {
        const { uid, inmobiliariaId } =
            await assertAuthenticatedManager(request);
        const leadId = cleanText(request.data?.leadId, 200);
        const managementStatus = cleanText(
            request.data?.managementStatus,
            30,
        );
        const managementNote = cleanText(request.data?.managementNote, 2000);

        if (!leadId) {
            throw new HttpsError("invalid-argument", "Falta el ID del lead.");
        }
        if (!LEAD_MANAGEMENT_STATUSES.has(managementStatus)) {
            throw new HttpsError(
                "invalid-argument",
                "El estado de seguimiento no es válido.",
            );
        }

        const ref = leadRef(inmobiliariaId, leadId);
        const snapshot = await ref.get();
        if (!snapshot.exists) {
            throw new HttpsError("not-found", "No se encontró el lead.");
        }

        await ref.update({
            managementStatus,
            managementNote,
            managementUpdatedBy: uid,
            managementUpdatedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        });

        return {
            updated: true,
            leadId,
            managementStatus,
            managementNote,
        };
    },
);

export const mercadoLibreAnswerQuestion = onCall(
    {
        region: REGION,
        timeoutSeconds: 60,
        secrets: [
            MERCADOLIBRE_CLIENT_ID,
            MERCADOLIBRE_CLIENT_SECRET,
            MERCADOLIBRE_TOKEN_ENCRYPTION_KEY,
        ],
    },
    async (request) => {
        const { uid, inmobiliariaId } =
            await assertAuthenticatedManager(request);
        const leadId = cleanText(request.data?.leadId, 200);
        const answerText = cleanText(request.data?.answerText, 2000);

        if (!leadId || !answerText) {
            throw new HttpsError(
                "invalid-argument",
                "El lead y la respuesta son obligatorios.",
            );
        }

        const ref = leadRef(inmobiliariaId, leadId);
        const snapshot = await ref.get();
        if (!snapshot.exists) {
            throw new HttpsError("not-found", "No se encontró el lead.");
        }

        const lead = snapshot.data() || {};
        const questionId = cleanText(lead.externalId, 100);
        if (lead.contactType !== "question" || !/^\d+$/.test(questionId)) {
            throw new HttpsError(
                "failed-precondition",
                "Este lead no corresponde a una pregunta respondible.",
            );
        }

        const { accessToken } = await getValidConnection(inmobiliariaId);
        const question = await mercadoLibreRequest("/answers", {
            accessToken,
            method: "POST",
            body: {
                question_id: Number(questionId),
                text: answerText,
            },
        });

        await ref.update({
            questionStatus: cleanText(question?.status, 80) || "ANSWERED",
            answerText:
                cleanText(question?.answer?.text, 2000) || answerText,
            answerStatus:
                cleanText(question?.answer?.status, 80) || "ACTIVE",
            managementStatus: "contactado",
            answeredBy: uid,
            answeredAt: FieldValue.serverTimestamp(),
            managementUpdatedBy: uid,
            managementUpdatedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        });

        return {
            answered: true,
            leadId,
            questionStatus:
                cleanText(question?.status, 80) || "ANSWERED",
            answerText:
                cleanText(question?.answer?.text, 2000) || answerText,
            answerStatus:
                cleanText(question?.answer?.status, 80) || "ACTIVE",
            managementStatus: "contactado",
        };
    },
);

export const mercadoLibreSyncLeads = onCall(
    {
        region: REGION,
        timeoutSeconds: 120,
        secrets: [
            MERCADOLIBRE_CLIENT_ID,
            MERCADOLIBRE_CLIENT_SECRET,
            MERCADOLIBRE_TOKEN_ENCRYPTION_KEY,
        ],
    },
    async (request) => {
        const { inmobiliariaId } = await assertAuthenticatedManager(request);
        const { accessToken, integration } =
            await getValidConnection(inmobiliariaId);
        const sellerId = cleanText(integration.sellerId, 100);

        if (!sellerId) {
            throw new HttpsError(
                "failed-precondition",
                "La conexión no contiene el seller_id de Mercado Libre.",
            );
        }

        const collected = new Map();
        let offset = 0;
        let total = 0;

        for (let page = 0; page < 2; page += 1) {
            const params = new URLSearchParams({
                offset: offset.toString(),
                limit: LEAD_PAGE_SIZE.toString(),
                date_from: getUtcDate(LEAD_SYNC_DAYS),
                date_to: getUtcDate(0),
                contact_types: "whatsapp,question,call,schedule,quotation",
                include_guest: "true",
            });
            const response = await mercadoLibreRequest(
                `/vis/users/${sellerId}/leads/buyers?${params.toString()}`,
                { accessToken },
            );
            const pageLeads = normalizeMercadoLibreLeadSearchResults(
                response || {},
                { sellerId },
            );

            pageLeads.forEach((lead) => {
                if (lead.leadId) collected.set(lead.leadId, lead);
            });

            const resultCount = Array.isArray(response?.results)
                ? response.results.length
                : 0;
            total = Number(response?.paging?.total || resultCount);
            offset += resultCount;

            if (!resultCount || offset >= total) break;
        }

        const leads = [...collected.values()];
        for (let index = 0; index < leads.length; index += 10) {
            const group = leads.slice(index, index + 10);
            await Promise.all(
                group.map((lead) => persistMercadoLibreLead({
                    inmobiliariaId,
                    sellerId,
                    lead,
                    accessToken,
                })),
            );
        }

        return {
            synced: true,
            count: leads.length,
            dateFrom: getUtcDate(LEAD_SYNC_DAYS),
            dateTo: getUtcDate(0),
            available: total,
        };
    },
);

export const mercadoLibreProcessNotification = onDocumentCreated(
    {
        region: REGION,
        document: "mercadolibre_notification_queue/{notificationId}",
        timeoutSeconds: 120,
        secrets: [
            MERCADOLIBRE_CLIENT_ID,
            MERCADOLIBRE_CLIENT_SECRET,
            MERCADOLIBRE_TOKEN_ENCRYPTION_KEY,
        ],
    },
    async (event) => {
        if (!event.data) return;

        const notificationId = event.params.notificationId;
        try {
            await processQueuedMercadoLibreNotification(
                notificationId,
                event.data.data() || {},
            );
        } catch (error) {
            console.error("Mercado Libre notification processing error", {
                notificationId,
                name: error?.name || "",
                message: error?.message || "",
            });
            await notificationQueueRef(notificationId).set(
                {
                    status: "error",
                    error: cleanText(error?.message, 1000),
                    failedAt: FieldValue.serverTimestamp(),
                    updatedAt: FieldValue.serverTimestamp(),
                },
                { merge: true },
            );
        }
    },
);

export const mercadoLibreNotifications = onRequest(
    {
        region: REGION,
        timeoutSeconds: 10,
        secrets: [MERCADOLIBRE_CLIENT_ID],
    },
    async (req, res) => {
        try {
            if (req.method !== "POST") {
                res.status(405).send("Method not allowed");
                return;
            }

            const notification = req.body || {};
            const normalized =
                normalizeMercadoLibreNotification(notification);
            const configuredApplicationId =
                MERCADOLIBRE_CLIENT_ID.value().trim();
            const applicationIdMatches =
                normalized.applicationId === configuredApplicationId ||
                (
                    typeof notification.application_id === "number" &&
                    Number.isFinite(notification.application_id) &&
                    notification.application_id ===
                        Number(configuredApplicationId)
                );

            if (
                !normalized.applicationId ||
                !applicationIdMatches
            ) {
                res.status(403).send("Invalid application");
                return;
            }

            if (!isSupportedMercadoLibreNotification(notification)) {
                res.status(200).send("ok");
                return;
            }

            const notificationId =
                buildMercadoLibreNotificationId(notification);
            try {
                await notificationQueueRef(notificationId).create({
                    _id: notificationId,
                    application_id: normalized.applicationId,
                    user_id: normalized.sellerId,
                    topic: normalized.topic,
                    resource: normalized.resource,
                    actions: normalized.actions,
                    attempts: normalized.attempts,
                    sent: cleanText(notification.sent, 100),
                    received: cleanText(
                        notification.received || notification.recieved,
                        100,
                    ),
                    status: "pending",
                    createdAt: FieldValue.serverTimestamp(),
                    updatedAt: FieldValue.serverTimestamp(),
                    expiresAt: Timestamp.fromMillis(
                        Date.now() + NOTIFICATION_RETENTION_MS,
                    ),
                });
            } catch (error) {
                if (
                    error?.code !== 6 &&
                    error?.code !== "6" &&
                    error?.code !== "already-exists"
                ) {
                    throw error;
                }
            }

            res.status(200).send("ok");
        } catch (error) {
            console.error("Mercado Libre notification error", {
                name: error?.name || "",
                message: error?.message || "",
            });
            res.status(500).send("error");
        }
    },
);
