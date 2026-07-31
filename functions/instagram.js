import crypto from "node:crypto";

import admin from "firebase-admin";
import { defineSecret } from "firebase-functions/params";
import { HttpsError, onCall, onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";

import {
    DEFAULT_INSTAGRAM_OPENER_ORIGIN,
    decryptInstagramToken,
    encryptInstagramToken,
    getInstagramConnectionIdentifiers,
    getInstagramConnectionLinkEntries,
    isInstagramTokenRefreshDue,
    normalizeInstagramIdentifier,
    normalizeInstagramOpenerOrigin,
    verifyInstagramSignedRequest,
} from "./instagram.helpers.js";

if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;
const Timestamp = admin.firestore.Timestamp;

const INSTAGRAM_APP_ID = defineSecret("INSTAGRAM_APP_ID");
const INSTAGRAM_APP_SECRET = defineSecret("INSTAGRAM_APP_SECRET");
const INSTAGRAM_REDIRECT_URI = defineSecret("INSTAGRAM_REDIRECT_URI");
const INSTAGRAM_TOKEN_ENCRYPTION_KEY = defineSecret(
    "INSTAGRAM_TOKEN_ENCRYPTION_KEY",
);

const REGION = "southamerica-east1";
const GRAPH_VERSION = "v23.0";
const GRAPH_BASE_URL = `https://graph.instagram.com/${GRAPH_VERSION}`;
const INSTAGRAM_AUTH_URL = "https://www.instagram.com/oauth/authorize";
const INSTAGRAM_TOKEN_URL = "https://api.instagram.com/oauth/access_token";
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const TOKEN_REFRESH_MARGIN_MS = 7 * 24 * 60 * 60 * 1000;
const PUBLICATION_LEASE_MS = 2 * 60 * 1000;
const MAX_CAPTION_LENGTH = 2200;
const MAX_CAROUSEL_ITEMS = 10;
const INSTAGRAM_MODULE_ID = "instagram";
const INSTAGRAM_SCOPES = [
    "instagram_business_basic",
    "instagram_business_content_publish",
];

class InstagramApiError extends Error {
    constructor(message, { status = 500, data = null, path = "" } = {}) {
        super(message);
        this.name = "InstagramApiError";
        this.status = status;
        this.data = data;
        this.path = path;
    }
}

const cleanText = (value = "", maxLength = 500) => {
    return value?.toString?.().trim().slice(0, maxLength) || "";
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

const normalizeTarget = (value = "") => {
    const target = cleanText(value, 30).toLowerCase();

    if (target !== "agency" && target !== "onoprop") {
        throw new HttpsError(
            "invalid-argument",
            "El destino de Instagram no es válido.",
        );
    }

    return target;
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

const assertRoot = async (uid) => {
    if (!uid) {
        throw new HttpsError("unauthenticated", "Tenés que iniciar sesión.");
    }

    const userData = await getUserData(uid);
    if (!userHasRole(userData, "root")) {
        throw new HttpsError(
            "permission-denied",
            "Esta operación sólo está disponible para la administración de Onoprop.",
        );
    }

    return userData;
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

const getInmobiliaria = async (inmobiliariaId) => {
    const snap = await db.collection("inmobiliarias").doc(inmobiliariaId).get();

    if (!snap.exists) {
        throw new HttpsError("not-found", "No se encontró la inmobiliaria.");
    }

    return { id: snap.id, ...(snap.data() || {}) };
};

const assertActiveInmobiliaria = (inmobiliaria) => {
    if (inmobiliaria.activa === false) {
        throw new HttpsError(
            "failed-precondition",
            "La inmobiliaria no está habilitada para publicar.",
        );
    }
};

const assertOwnInstagramEntitlement = (userData, inmobiliaria) => {
    if (userHasRole(userData, "root")) return;

    const modules = Array.isArray(inmobiliaria.modulosSuscriptos)
        ? inmobiliaria.modulosSuscriptos
        : [];

    if (!modules.includes(INSTAGRAM_MODULE_ID)) {
        throw new HttpsError(
            "permission-denied",
            "La inmobiliaria no tiene contratado el módulo de Instagram propio.",
        );
    }
};

const assertAuthenticatedManager = async (request) => {
    const uid = request.auth?.uid;
    const inmobiliariaId = cleanText(request.data?.inmobiliariaId, 128);

    if (!uid) {
        throw new HttpsError("unauthenticated", "Tenés que iniciar sesión.");
    }

    const userData = await assertCanManageInmobiliaria(uid, inmobiliariaId);
    const inmobiliaria = await getInmobiliaria(inmobiliariaId);
    assertActiveInmobiliaria(inmobiliaria);

    return { uid, inmobiliariaId, userData, inmobiliaria };
};

const agencyIntegrationRef = (inmobiliariaId) => {
    return db
        .collection("inmobiliarias")
        .doc(inmobiliariaId)
        .collection("privateIntegrations")
        .doc("instagram");
};

const onopropIntegrationRef = () => {
    return db.collection("platform_private_integrations").doc("instagram_onoprop");
};

const connectionRefForTarget = (target, inmobiliariaId) => {
    return target === "onoprop"
        ? onopropIntegrationRef()
        : agencyIntegrationRef(inmobiliariaId);
};

const accountConnectionRef = (instagramIdentifier) => {
    const identifier = normalizeInstagramIdentifier(instagramIdentifier);

    if (!identifier) {
        throw new Error("El identificador de Instagram no es válido.");
    }

    return db
        .collection("instagram_account_connections")
        .doc(identifier);
};

const connectionRefFromPath = (path = "") => {
    const normalizedPath = cleanText(path, 500);

    if (!normalizedPath || normalizedPath.split("/").length % 2 !== 0) {
        return null;
    }

    try {
        return db.doc(normalizedPath);
    } catch {
        return null;
    }
};

const buildAccountConnectionLinkData = (
    entry,
    connectionData,
    connectionPath,
) => {
    return {
        instagramIdentifier: entry.identifier,
        identifierType: entry.identifierType,
        canonicalInstagramUserId: connectionData.instagramUserId || "",
        target: connectionData.target || "",
        targetKey: connectionData.targetKey || "",
        inmobiliariaId: connectionData.inmobiliariaId || "",
        connectionPath,
        updatedAt: FieldValue.serverTimestamp(),
    };
};

const findConnectionByInstagramIdentifier = async (rawIdentifier) => {
    const identifier = normalizeInstagramIdentifier(rawIdentifier);
    if (!identifier) return null;

    const directLinkRef = accountConnectionRef(identifier);
    const directLinkSnap = await directLinkRef.get();

    if (directLinkSnap.exists) {
        const directConnectionRef = connectionRefFromPath(
            directLinkSnap.data()?.connectionPath,
        );
        const directConnectionSnap = directConnectionRef
            ? await directConnectionRef.get()
            : null;

        if (directConnectionSnap?.exists) {
            return {
                connectionRef: directConnectionRef,
                connectionData: directConnectionSnap.data() || {},
            };
        }

        await directLinkRef.delete();
    }

    const allLinksSnap = await db
        .collection("instagram_account_connections")
        .get();
    const connectionPaths = new Set([onopropIntegrationRef().path]);

    allLinksSnap.docs.forEach((doc) => {
        const path = cleanText(doc.data()?.connectionPath, 500);
        if (connectionRefFromPath(path)) connectionPaths.add(path);
    });

    const refs = [...connectionPaths]
        .map(connectionRefFromPath)
        .filter(Boolean);

    for (let offset = 0; offset < refs.length; offset += 100) {
        const snapshots = await db.getAll(...refs.slice(offset, offset + 100));

        for (const snap of snapshots) {
            if (
                snap.exists &&
                getInstagramConnectionIdentifiers(snap.data() || {})
                    .includes(identifier)
            ) {
                const connectionData = snap.data() || {};
                const linkEntry =
                    getInstagramConnectionLinkEntries(connectionData)
                        .find((entry) => entry.identifier === identifier) || {
                        identifier,
                        identifierType: "meta_callback_id",
                    };

                await directLinkRef.set(
                    buildAccountConnectionLinkData(
                        linkEntry,
                        connectionData,
                        snap.ref.path,
                    ),
                    { merge: true },
                );

                return {
                    connectionRef: snap.ref,
                    connectionData,
                };
            }
        }
    }

    return null;
};

const inmuebleRef = (inmobiliariaId, inmuebleId) => {
    return db
        .collection("inmobiliarias")
        .doc(inmobiliariaId)
        .collection("inmuebles")
        .doc(inmuebleId);
};

const distributionRef = (inmobiliariaId, inmuebleId) => {
    return inmuebleRef(inmobiliariaId, inmuebleId)
        .collection("private")
        .doc("instagram");
};

const onopropRequestRef = (requestId = "") => {
    const collectionRef = db.collection("instagram_onoprop_publication_requests");
    return requestId ? collectionRef.doc(requestId) : collectionRef.doc();
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

const throwInstagramApiError = (response, data, path) => {
    const apiError = data?.error || {};
    throw new InstagramApiError(
        cleanText(
            apiError.error_user_msg ||
            apiError.message ||
            data?.message ||
            `Instagram respondió ${response.status}.`,
            1000,
        ),
        {
            status: response.status,
            data,
            path,
        },
    );
};

const instagramApiRequest = async (
    path,
    { accessToken, method = "GET", form, query } = {},
) => {
    const url = new URL(`${GRAPH_BASE_URL}${path}`);
    Object.entries(query || {}).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
            url.searchParams.set(key, value.toString());
        }
    });

    const response = await fetch(url, {
        method,
        headers: {
            Accept: "application/json",
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
            ...(form
                ? { "Content-Type": "application/x-www-form-urlencoded" }
                : {}),
        },
        ...(form ? { body: new URLSearchParams(form).toString() } : {}),
    });
    const data = await readJsonResponse(response);

    if (!response.ok) throwInstagramApiError(response, data, path);
    return data;
};

const shortLivedTokenRequest = async (params) => {
    const response = await fetch(INSTAGRAM_TOKEN_URL, {
        method: "POST",
        headers: {
            Accept: "application/json",
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams(params).toString(),
    });
    const data = await readJsonResponse(response);

    if (!response.ok) {
        throwInstagramApiError(response, data, "/oauth/access_token");
    }

    return data;
};

const exchangeForLongLivedToken = async (shortLivedToken) => {
    const url = new URL(`${GRAPH_BASE_URL}/access_token`);
    url.searchParams.set("grant_type", "ig_exchange_token");
    url.searchParams.set("client_secret", INSTAGRAM_APP_SECRET.value());
    url.searchParams.set("access_token", shortLivedToken);

    const response = await fetch(url, {
        headers: { Accept: "application/json" },
    });
    const data = await readJsonResponse(response);

    if (!response.ok) {
        throwInstagramApiError(response, data, "/access_token");
    }

    return data;
};

const refreshLongLivedToken = async (accessToken) => {
    const url = new URL(`${GRAPH_BASE_URL}/refresh_access_token`);
    url.searchParams.set("grant_type", "ig_refresh_token");
    url.searchParams.set("access_token", accessToken);

    const response = await fetch(url, {
        headers: { Accept: "application/json" },
    });
    const data = await readJsonResponse(response);

    if (!response.ok) {
        throwInstagramApiError(response, data, "/refresh_access_token");
    }

    return data;
};

const formatInstagramError = (error) => {
    return cleanText(
        error?.data?.error?.error_user_msg ||
        error?.data?.error?.message ||
        error?.message,
        1000,
    ) || "Error desconocido de Instagram.";
};

const toHttpsError = (error, fallback = "Error comunicando con Instagram.") => {
    if (error instanceof HttpsError) return error;

    if (error instanceof InstagramApiError) {
        console.error("Instagram API error", {
            status: error.status,
            path: error.path,
            code: error.data?.error?.code || null,
            subcode: error.data?.error?.error_subcode || null,
        });

        const code =
            error.status === 401 || error.status === 403
                ? "failed-precondition"
                : error.status === 404
                    ? "not-found"
                    : error.status === 429
                        ? "resource-exhausted"
                        : "internal";

        return new HttpsError(code, formatInstagramError(error));
    }

    console.error("Instagram unexpected error", {
        name: error?.name || "",
        message: error?.message || "",
    });
    return new HttpsError("internal", error?.message || fallback);
};

const buildInstagramAuthUrl = ({ state }) => {
    const params = new URLSearchParams({
        enable_fb_login: "0",
        force_reauth: "true",
        client_id: INSTAGRAM_APP_ID.value(),
        redirect_uri: INSTAGRAM_REDIRECT_URI.value(),
        response_type: "code",
        scope: INSTAGRAM_SCOPES.join(","),
        state,
    });

    return `${INSTAGRAM_AUTH_URL}?${params.toString()}`;
};

const sanitizeConnection = (data = {}) => {
    const expiresAtMs = Number(data.expiresAtMs || 0);
    const expired = expiresAtMs > 0 && expiresAtMs <= Date.now();
    const hasToken = Boolean(data.accessTokenEncrypted);

    return {
        connected:
            data.connected === true &&
            data.requiresReconnect !== true &&
            hasToken &&
            !expired,
        requiresReconnect:
            data.requiresReconnect === true ||
            (data.connected === true && (!hasToken || expired)),
        instagramUserId: data.instagramUserId || "",
        username: data.username || "",
        accountType: data.accountType || "",
        target: data.target || "",
        expiresAtMs: expiresAtMs || null,
        updatedAt: data.updatedAt?.toMillis?.() || null,
    };
};

const getValidConnection = async (target, inmobiliariaId = "") => {
    const ref = connectionRefForTarget(target, inmobiliariaId);
    const snap = await ref.get();

    if (!snap.exists) {
        throw new HttpsError(
            "failed-precondition",
            target === "onoprop"
                ? "La cuenta central de Instagram de Onoprop no está conectada."
                : "La inmobiliaria todavía no conectó su cuenta de Instagram.",
        );
    }

    const data = snap.data() || {};
    if (data.connected !== true || data.requiresReconnect === true) {
        throw new HttpsError(
            "failed-precondition",
            "La cuenta de Instagram necesita volver a conectarse.",
        );
    }

    const encryptionKey = INSTAGRAM_TOKEN_ENCRYPTION_KEY.value();
    let accessToken;

    try {
        accessToken = decryptInstagramToken(
            data.accessTokenEncrypted,
            encryptionKey,
        );
    } catch {
        await ref.set(
            {
                requiresReconnect: true,
                accessTokenEncrypted: FieldValue.delete(),
                lastTokenError:
                    "El token cifrado de Instagram no se pudo recuperar.",
                tokenRefreshFailedAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true },
        );
        throw new HttpsError(
            "failed-precondition",
            "La cuenta de Instagram necesita volver a conectarse.",
        );
    }

    const now = Date.now();

    if (!accessToken || Number(data.expiresAtMs || 0) <= now) {
        await ref.set(
            {
                requiresReconnect: true,
                accessTokenEncrypted: FieldValue.delete(),
                updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true },
        );
        throw new HttpsError(
            "failed-precondition",
            "El acceso a Instagram venció. Volvé a conectar la cuenta.",
        );
    }

    if (
        isInstagramTokenRefreshDue(
            data.expiresAtMs,
            now,
            TOKEN_REFRESH_MARGIN_MS,
        )
    ) {
        try {
            const refreshed = await refreshLongLivedToken(accessToken);
            accessToken = refreshed.access_token || accessToken;
            const expiresIn = Number(refreshed.expires_in || 0);

            if (expiresIn <= 0) {
                throw new Error(
                    "Instagram no informó la vigencia del token renovado.",
                );
            }

            const expiresAtMs = now + expiresIn * 1000;

            await ref.set(
                {
                    accessTokenEncrypted: encryptInstagramToken(
                        accessToken,
                        encryptionKey,
                    ),
                    expiresIn,
                    expiresAtMs,
                    requiresReconnect: false,
                    tokenRefreshedAt: FieldValue.serverTimestamp(),
                    lastTokenError: FieldValue.delete(),
                    tokenRefreshFailedAt: FieldValue.delete(),
                    updatedAt: FieldValue.serverTimestamp(),
                },
                { merge: true },
            );
            data.expiresIn = expiresIn;
            data.expiresAtMs = expiresAtMs;
        } catch (error) {
            await ref.set(
                {
                    lastTokenError: formatInstagramError(error),
                    tokenRefreshFailedAt: FieldValue.serverTimestamp(),
                    updatedAt: FieldValue.serverTimestamp(),
                },
                { merge: true },
            );
            throw error;
        }
    }

    return { accessToken, integration: data, ref };
};

const disconnectAccountByInstagramIdentifier = async (
    instagramIdentifier,
    extraData = {},
    deleteConnection = false,
) => {
    const located = await findConnectionByInstagramIdentifier(
        instagramIdentifier,
    );
    if (!located) return false;

    const { connectionRef, connectionData } = located;
    const identifiers = new Set([
        ...getInstagramConnectionIdentifiers(connectionData),
        normalizeInstagramIdentifier(instagramIdentifier),
    ]);
    const batch = db.batch();

    if (deleteConnection) {
        batch.delete(connectionRef);
    } else {
        batch.set(
            connectionRef,
            {
                connected: false,
                requiresReconnect: false,
                accessTokenEncrypted: FieldValue.delete(),
                expiresAtMs: FieldValue.delete(),
                disconnectedAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
                ...extraData,
            },
            { merge: true },
        );
    }
    identifiers.forEach((identifier) => {
        if (identifier) batch.delete(accountConnectionRef(identifier));
    });
    await batch.commit();
    return true;
};

const getSortedImageUrls = (inmueble = {}) => {
    if (!Array.isArray(inmueble.images)) return [];

    return [...inmueble.images]
        .filter((image) => image?.url)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((image) => cleanText(image.url, 3000))
        .filter(Boolean);
};

const assertPublicHttpsUrl = (value) => {
    try {
        const url = new URL(value);
        if (url.protocol !== "https:") throw new Error("invalid protocol");
    } catch {
        throw new HttpsError(
            "failed-precondition",
            "Instagram necesita imágenes accesibles mediante URLs públicas HTTPS.",
        );
    }
};

const resolveSelectedImages = (inmueble, requestedImages = []) => {
    const availableImages = getSortedImageUrls(inmueble);
    const requested = Array.isArray(requestedImages)
        ? requestedImages.map((url) => cleanText(url, 3000)).filter(Boolean)
        : [];
    const selected = requested.length > 0
        ? [...new Set(requested)]
        : availableImages.slice(0, MAX_CAROUSEL_ITEMS);
    const allowed = new Set(availableImages);

    if (selected.length === 0) {
        throw new HttpsError(
            "failed-precondition",
            "El inmueble no tiene imágenes para publicar en Instagram.",
        );
    }
    if (selected.length > MAX_CAROUSEL_ITEMS) {
        throw new HttpsError(
            "invalid-argument",
            `Instagram admite hasta ${MAX_CAROUSEL_ITEMS} imágenes por publicación.`,
        );
    }
    if (selected.some((url) => !allowed.has(url))) {
        throw new HttpsError(
            "permission-denied",
            "Sólo se pueden publicar imágenes pertenecientes al inmueble.",
        );
    }

    selected.forEach(assertPublicHttpsUrl);
    return selected;
};

const getPublicationContext = async (
    inmobiliariaId,
    inmuebleId,
    requestedImages,
    requestedCaption,
) => {
    if (!inmuebleId) {
        throw new HttpsError("invalid-argument", "Falta el inmueble.");
    }

    const [inmuebleSnap, inmobiliaria] = await Promise.all([
        inmuebleRef(inmobiliariaId, inmuebleId).get(),
        getInmobiliaria(inmobiliariaId),
    ]);

    if (!inmuebleSnap.exists) {
        throw new HttpsError("not-found", "No se encontró el inmueble.");
    }
    assertActiveInmobiliaria(inmobiliaria);

    const inmueble = { id: inmuebleId, ...(inmuebleSnap.data() || {}) };
    const caption = cleanText(requestedCaption, MAX_CAPTION_LENGTH);
    const imageUrls = resolveSelectedImages(inmueble, requestedImages);

    if (!caption) {
        throw new HttpsError(
            "failed-precondition",
            "El texto de la publicación de Instagram está vacío.",
        );
    }

    return {
        inmueble,
        inmobiliaria,
        caption,
        imageUrls,
        ref: distributionRef(inmobiliariaId, inmuebleId),
    };
};

const wait = (milliseconds) => {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
};

const waitForContainerReady = async (containerId, accessToken) => {
    for (let attempt = 0; attempt < 12; attempt += 1) {
        const status = await instagramApiRequest(`/${containerId}`, {
            accessToken,
            query: { fields: "status_code,status" },
        });
        const statusCode = cleanText(status?.status_code, 30).toUpperCase();

        if (!statusCode || statusCode === "FINISHED") return status;
        if (statusCode === "ERROR" || statusCode === "EXPIRED") {
            throw new Error(
                cleanText(status?.status, 500) ||
                "Instagram no pudo procesar una imagen.",
            );
        }

        await wait(1000);
    }

    throw new Error("Instagram tardó demasiado en procesar las imágenes.");
};

const createImageContainer = async ({
    instagramUserId,
    accessToken,
    imageUrl,
    caption = "",
    isCarouselItem = false,
}) => {
    const result = await instagramApiRequest(`/${instagramUserId}/media`, {
        accessToken,
        method: "POST",
        form: {
            image_url: imageUrl,
            ...(caption ? { caption } : {}),
            ...(isCarouselItem ? { is_carousel_item: "true" } : {}),
        },
    });

    if (!result?.id) {
        throw new Error("Instagram no devolvió el contenedor de la imagen.");
    }

    await waitForContainerReady(result.id, accessToken);
    return result.id.toString();
};

const publishInstagramMedia = async ({
    accessToken,
    instagramUserId,
    caption,
    imageUrls,
}) => {
    let containerId;

    if (imageUrls.length === 1) {
        containerId = await createImageContainer({
            instagramUserId,
            accessToken,
            imageUrl: imageUrls[0],
            caption,
        });
    } else {
        const childIds = await Promise.all(
            imageUrls.map((imageUrl) =>
                createImageContainer({
                    instagramUserId,
                    accessToken,
                    imageUrl,
                    isCarouselItem: true,
                }),
            ),
        );

        const parent = await instagramApiRequest(`/${instagramUserId}/media`, {
            accessToken,
            method: "POST",
            form: {
                media_type: "CAROUSEL",
                children: childIds.join(","),
                caption,
            },
        });
        if (!parent?.id) {
            throw new Error("Instagram no devolvió el contenedor del carrusel.");
        }
        containerId = parent.id.toString();
        await waitForContainerReady(containerId, accessToken);
    }

    const published = await instagramApiRequest(
        `/${instagramUserId}/media_publish`,
        {
            accessToken,
            method: "POST",
            form: { creation_id: containerId },
        },
    );
    const mediaId = cleanText(published?.id, 100);

    if (!mediaId) {
        throw new Error("Instagram no devolvió el identificador de publicación.");
    }

    let media = { id: mediaId };
    try {
        media = await instagramApiRequest(`/${mediaId}`, {
            accessToken,
            query: {
                fields: "id,permalink,timestamp,media_type,media_product_type",
            },
        });
    } catch (error) {
        console.warn("No se pudo consultar el permalink de Instagram", {
            mediaId,
            message: error?.message || "",
        });
    }

    return {
        externalId: mediaId,
        permalink: cleanText(media?.permalink, 2000),
        mediaType: cleanText(media?.media_type, 50),
        mediaProductType: cleanText(media?.media_product_type, 50),
        instagramTimestamp: cleanText(media?.timestamp, 100),
        containerId,
    };
};

const claimPublicationLease = async (ref, destination) => {
    const leaseId = crypto.randomUUID();
    const now = Date.now();

    await db.runTransaction(async (transaction) => {
        const snap = await transaction.get(ref);
        const current = snap.data()?.destinations?.[destination] || {};

        if (
            current.status === "publishing" &&
            Number(current.leaseUntilMs || 0) > now
        ) {
            throw new HttpsError(
                "resource-exhausted",
                "Ya hay una publicación de Instagram en proceso.",
            );
        }

        transaction.set(
            ref,
            {
                provider: "instagram",
                destinations: {
                    [destination]: {
                        ...current,
                        status: "publishing",
                        leaseId,
                        leaseUntilMs: now + PUBLICATION_LEASE_MS,
                        lastError: FieldValue.delete(),
                        updatedAt: FieldValue.serverTimestamp(),
                    },
                },
                updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true },
        );
    });

    return leaseId;
};

const persistPublishedMedia = async ({
    ref,
    destination,
    result,
    caption,
    imageUrls,
    uid,
    requestId = "",
}) => {
    const publicationData = {
        status: "published",
        externalId: result.externalId,
        permalink: result.permalink,
        mediaType: result.mediaType,
        mediaProductType: result.mediaProductType,
        instagramTimestamp: result.instagramTimestamp,
        containerId: result.containerId,
        caption,
        imageUrls,
        requestId,
        publishedBy: uid,
        publishedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        leaseId: FieldValue.delete(),
        leaseUntilMs: FieldValue.delete(),
        lastError: FieldValue.delete(),
    };
    const batch = db.batch();
    batch.set(
        ref,
        {
            provider: "instagram",
            destinations: { [destination]: publicationData },
            updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
    );
    batch.set(
        ref.collection("history").doc(result.externalId),
        {
            provider: "instagram",
            destination,
            ...publicationData,
            createdAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
    );
    await batch.commit();
    return {
        status: "published",
        externalId: result.externalId,
        permalink: result.permalink,
        mediaType: result.mediaType,
        mediaProductType: result.mediaProductType,
        instagramTimestamp: result.instagramTimestamp,
        containerId: result.containerId,
        caption,
        imageUrls,
        requestId,
        publishedAt: Date.now(),
        updatedAt: Date.now(),
    };
};

const persistPublicationError = async ({
    ref,
    destination,
    error,
    uid,
}) => {
    await ref.set(
        {
            provider: "instagram",
            destinations: {
                [destination]: {
                    status: "error",
                    lastError: formatInstagramError(error),
                    failedBy: uid,
                    failedAt: FieldValue.serverTimestamp(),
                    updatedAt: FieldValue.serverTimestamp(),
                    leaseId: FieldValue.delete(),
                    leaseUntilMs: FieldValue.delete(),
                },
            },
            updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
    );
};

const timestampToMillis = (value) => {
    return value?.toMillis?.() || null;
};

const sanitizeDistribution = (data = {}) => {
    const destinations = data.destinations || {};
    const sanitizeDestination = (destination = {}) => ({
        status: destination.status || "not_started",
        externalId: destination.externalId || "",
        permalink: destination.permalink || "",
        mediaType: destination.mediaType || "",
        mediaProductType: destination.mediaProductType || "",
        caption: destination.caption || "",
        imageUrls: Array.isArray(destination.imageUrls)
            ? destination.imageUrls
            : [],
        requestId: destination.requestId || "",
        lastError: destination.lastError || "",
        publishedAt: timestampToMillis(destination.publishedAt),
        requestedAt: timestampToMillis(destination.requestedAt),
        updatedAt: timestampToMillis(destination.updatedAt),
    });

    return {
        agency: sanitizeDestination(destinations.agency),
        onoprop: sanitizeDestination(destinations.onoprop),
    };
};

const ensureAccountConnectionLinks = async (connectionRef, connectionData) => {
    const entries = getInstagramConnectionLinkEntries(connectionData);
    if (entries.length === 0) return 0;

    const batch = db.batch();
    entries.forEach((entry) => {
        batch.set(
            accountConnectionRef(entry.identifier),
            buildAccountConnectionLinkData(
                entry,
                connectionData,
                connectionRef.path,
            ),
            { merge: true },
        );
    });
    await batch.commit();
    return entries.length;
};

const getTrackedInstagramConnectionRefs = async () => {
    const linksSnap = await db
        .collection("instagram_account_connections")
        .get();
    const paths = new Set([onopropIntegrationRef().path]);

    linksSnap.docs.forEach((doc) => {
        const path = cleanText(doc.data()?.connectionPath, 500);
        if (connectionRefFromPath(path)) paths.add(path);
    });

    return [...paths]
        .map(connectionRefFromPath)
        .filter(Boolean);
};

const refreshStoredInstagramConnection = async (ref, now) => {
    const snap = await ref.get();
    if (!snap.exists) return "missing";

    const data = snap.data() || {};
    if (data.connected !== true || data.requiresReconnect === true) {
        return "inactive";
    }

    const expiresAtMs = Number(data.expiresAtMs || 0);
    if (!data.accessTokenEncrypted || expiresAtMs <= now) {
        await ref.set(
            {
                requiresReconnect: true,
                accessTokenEncrypted: FieldValue.delete(),
                lastTokenError: "El token de Instagram está ausente o vencido.",
                tokenRefreshFailedAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true },
        );
        return "expired";
    }

    await ensureAccountConnectionLinks(ref, data);

    if (
        !isInstagramTokenRefreshDue(
            expiresAtMs,
            now,
            TOKEN_REFRESH_MARGIN_MS,
        )
    ) {
        return "active";
    }

    let accessToken;
    const encryptionKey = INSTAGRAM_TOKEN_ENCRYPTION_KEY.value();

    try {
        accessToken = decryptInstagramToken(
            data.accessTokenEncrypted,
            encryptionKey,
        );
    } catch (error) {
        await ref.set(
            {
                requiresReconnect: true,
                accessTokenEncrypted: FieldValue.delete(),
                lastTokenError: formatInstagramError(error),
                tokenRefreshFailedAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true },
        );
        return "invalid";
    }

    try {
        const refreshed = await refreshLongLivedToken(accessToken);
        const refreshedToken = refreshed.access_token || accessToken;
        const expiresIn = Number(refreshed.expires_in || 0);

        if (expiresIn <= 0) {
            throw new Error(
                "Instagram no informó la vigencia del token renovado.",
            );
        }

        await ref.set(
            {
                accessTokenEncrypted: encryptInstagramToken(
                    refreshedToken,
                    encryptionKey,
                ),
                expiresIn,
                expiresAtMs: now + expiresIn * 1000,
                requiresReconnect: false,
                tokenRefreshedAt: FieldValue.serverTimestamp(),
                lastTokenError: FieldValue.delete(),
                tokenRefreshFailedAt: FieldValue.delete(),
                updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true },
        );
        return "refreshed";
    } catch (error) {
        await ref.set(
            {
                lastTokenError: formatInstagramError(error),
                tokenRefreshFailedAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true },
        );
        return "retry";
    }
};

const deleteExpiredInstagramDocuments = async (collectionName, now) => {
    const snap = await db
        .collection(collectionName)
        .where("expiresAtMs", "<=", now)
        .limit(450)
        .get();

    if (snap.empty) return 0;

    const batch = db.batch();
    snap.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    return snap.size;
};

export const instagramMaintainConnections = onSchedule(
    {
        region: REGION,
        schedule: "15 3 * * *",
        timeZone: "America/Argentina/Buenos_Aires",
        timeoutSeconds: 300,
        secrets: [INSTAGRAM_TOKEN_ENCRYPTION_KEY],
    },
    async () => {
        const now = Date.now();
        const refs = await getTrackedInstagramConnectionRefs();
        const summary = {
            active: 0,
            expired: 0,
            failed: 0,
            inactive: 0,
            invalid: 0,
            missing: 0,
            refreshed: 0,
            retry: 0,
        };

        for (const ref of refs) {
            try {
                const status =
                    await refreshStoredInstagramConnection(ref, now);
                summary[status] = Number(summary[status] || 0) + 1;
            } catch (error) {
                summary.failed += 1;
                console.error("Instagram connection maintenance failed", {
                    connectionPath: ref.path,
                    message: formatInstagramError(error),
                });
            }
        }

        const [expiredStates, expiredDeletionRequests] = await Promise.all([
            deleteExpiredInstagramDocuments("instagram_oauth_states", now),
            deleteExpiredInstagramDocuments(
                "instagram_data_deletion_requests",
                now,
            ),
        ]);

        console.info("Instagram maintenance completed", {
            ...summary,
            expiredStates,
            expiredDeletionRequests,
        });
    },
);

export const instagramAuthStart = onCall(
    {
        region: REGION,
        invoker: "public",
        secrets: [INSTAGRAM_APP_ID, INSTAGRAM_REDIRECT_URI],
    },
    async (request) => {
        try {
            const target = normalizeTarget(request.data?.target);
            const openerOrigin = normalizeInstagramOpenerOrigin(
                request.data?.openerOrigin ||
                DEFAULT_INSTAGRAM_OPENER_ORIGIN,
            );
            const { uid, inmobiliariaId, userData, inmobiliaria } =
                await assertAuthenticatedManager(request);

            if (target === "onoprop") {
                await assertRoot(uid);
            } else {
                assertOwnInstagramEntitlement(userData, inmobiliaria);
            }

            const state = crypto.randomBytes(32).toString("hex");
            const now = Date.now();

            await db.collection("instagram_oauth_states").doc(state).set({
                state,
                uid,
                inmobiliariaId,
                target,
                openerOrigin,
                used: false,
                createdAt: FieldValue.serverTimestamp(),
                expiresAtMs: now + OAUTH_STATE_TTL_MS,
                expiresAt: Timestamp.fromMillis(now + OAUTH_STATE_TTL_MS),
            });

            return {
                authUrl: buildInstagramAuthUrl({ state }),
                expiresAtMs: now + OAUTH_STATE_TTL_MS,
                target,
                openerOrigin,
            };
        } catch (error) {
            throw toHttpsError(error, "No se pudo iniciar la conexión con Instagram.");
        }
    },
);

export const instagramOAuthCallback = onRequest(
    {
        region: REGION,
        invoker: "public",
        secrets: [
            INSTAGRAM_APP_ID,
            INSTAGRAM_APP_SECRET,
            INSTAGRAM_REDIRECT_URI,
            INSTAGRAM_TOKEN_ENCRYPTION_KEY,
        ],
    },
    async (req, res) => {
        try {
            const code = cleanText(req.query.code, 2000);
            const state = cleanText(req.query.state, 200);
            const oauthError = cleanText(
                req.query.error_description || req.query.error,
                500,
            );

            if (oauthError) {
                throw new Error(`Instagram rechazó la autorización: ${oauthError}`);
            }
            if (!code || !state) {
                res.status(400).send("Falta code o state.");
                return;
            }

            const stateRef = db.collection("instagram_oauth_states").doc(state);
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
                    throw new HttpsError("already-exists", "State ya utilizado.");
                }
                if (
                    !stateData.expiresAtMs ||
                    Date.now() > stateData.expiresAtMs
                ) {
                    throw new HttpsError("deadline-exceeded", "State vencido.");
                }

                transaction.update(stateRef, {
                    used: true,
                    usedAt: FieldValue.serverTimestamp(),
                });
            });

            const { uid, inmobiliariaId } = stateData;
            const target = normalizeTarget(stateData.target);
            const openerOrigin = normalizeInstagramOpenerOrigin(
                stateData.openerOrigin || DEFAULT_INSTAGRAM_OPENER_ORIGIN,
            );
            const userData = await assertCanManageInmobiliaria(uid, inmobiliariaId);
            const inmobiliaria = await getInmobiliaria(inmobiliariaId);
            assertActiveInmobiliaria(inmobiliaria);

            if (target === "onoprop") {
                await assertRoot(uid);
            } else {
                assertOwnInstagramEntitlement(userData, inmobiliaria);
            }

            const shortLived = await shortLivedTokenRequest({
                client_id: INSTAGRAM_APP_ID.value(),
                client_secret: INSTAGRAM_APP_SECRET.value(),
                grant_type: "authorization_code",
                redirect_uri: INSTAGRAM_REDIRECT_URI.value(),
                code,
            });
            const longLived = await exchangeForLongLivedToken(
                shortLived.access_token,
            );
            const accessToken =
                longLived.access_token || shortLived.access_token || "";
            const oauthUserId = cleanText(
                shortLived.user_id || longLived.user_id,
                100,
            );

            if (!accessToken || !oauthUserId) {
                throw new Error(
                    "Instagram no devolvió el token o el identificador de la cuenta.",
                );
            }

            const profile = await instagramApiRequest("/me", {
                accessToken,
                query: { fields: "id,user_id,username,account_type" },
            });
            const instagramUserId = cleanText(
                profile.user_id || profile.id || oauthUserId,
                100,
            );

            if (!instagramUserId) {
                throw new Error(
                    "Instagram no devolvió el identificador publicable de la cuenta.",
                );
            }

            const targetKey =
                target === "onoprop" ? "onoprop" : `agency:${inmobiliariaId}`;
            const connectionRef = connectionRefForTarget(target, inmobiliariaId);
            const expiresIn = Number(longLived.expires_in || 0);

            if (expiresIn <= 0) {
                throw new Error(
                    "Instagram no informó la vigencia del token de acceso.",
                );
            }

            const expiresAtMs = Date.now() + expiresIn * 1000;
            const encryptionKey = INSTAGRAM_TOKEN_ENCRYPTION_KEY.value();
            const connectionData = {
                provider: "instagram",
                connected: true,
                requiresReconnect: false,
                connectedBy: uid,
                target,
                targetKey,
                inmobiliariaId: target === "agency" ? inmobiliariaId : "",
                instagramUserId,
                instagramScopedId: cleanText(profile.id, 100),
                oauthUserId,
                username: cleanText(profile.username, 200),
                accountType:
                    cleanText(profile.account_type, 50) || "professional",
                accessTokenEncrypted: encryptInstagramToken(
                    accessToken,
                    encryptionKey,
                ),
                tokenType: longLived.token_type || "Bearer",
                expiresIn,
                expiresAtMs,
                scope: INSTAGRAM_SCOPES,
                connectedAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
            };
            const linkEntries =
                getInstagramConnectionLinkEntries(connectionData);
            const linkRefs = linkEntries
                .map((entry) => accountConnectionRef(entry.identifier));

            await db.runTransaction(async (transaction) => {
                const [existingConnection, ...existingLinks] =
                    await Promise.all([
                        transaction.get(connectionRef),
                        ...linkRefs.map((ref) => transaction.get(ref)),
                    ]);

                if (existingLinks.some(
                    (linkSnap) =>
                        linkSnap.exists &&
                        linkSnap.data()?.targetKey !== targetKey,
                )) {
                    throw new HttpsError(
                        "already-exists",
                        "Esta cuenta de Instagram ya está conectada a otro destino de Onoprop.",
                    );
                }

                const previousIdentifiers = new Set(
                    getInstagramConnectionIdentifiers(
                        existingConnection.data() || {},
                    ),
                );
                const currentIdentifiers = new Set(
                    linkEntries.map((entry) => entry.identifier),
                );

                previousIdentifiers.forEach((identifier) => {
                    if (!currentIdentifiers.has(identifier)) {
                        transaction.delete(accountConnectionRef(identifier));
                    }
                });

                transaction.set(connectionRef, connectionData, { merge: true });
                linkEntries.forEach((entry, index) => {
                    transaction.set(
                        linkRefs[index],
                        buildAccountConnectionLinkData(
                            entry,
                            connectionData,
                            connectionRef.path,
                        ),
                        { merge: true },
                    );
                });
                transaction.delete(stateRef);
            });

            res.status(200).send(`
                <!doctype html>
                <html>
                  <head>
                    <meta charset="utf-8" />
                    <title>Instagram conectado</title>
                  </head>
                  <body style="font-family: Arial, sans-serif; padding: 32px;">
                    <h1>Instagram conectado correctamente</h1>
                    <p>Esta ventana se cerrará automáticamente.</p>
                    <script>
                      if (window.opener) {
                        window.opener.postMessage({
                          type: "instagram-oauth-success",
                          target: ${JSON.stringify(target)}
                        }, ${JSON.stringify(openerOrigin)});
                      }
                      window.setTimeout(() => window.close(), 800);
                    </script>
                  </body>
                </html>
            `);
        } catch (error) {
            console.error("Instagram OAuth callback error", {
                name: error?.name || "",
                message: error?.message || "",
            });

            res.status(500).send(`
                <!doctype html>
                <html>
                  <head>
                    <meta charset="utf-8" />
                    <title>Error Instagram</title>
                  </head>
                  <body style="font-family: Arial, sans-serif; padding: 32px;">
                    <h1>No se pudo conectar Instagram</h1>
                    <p>${escapeHtml(formatInstagramError(error))}</p>
                  </body>
                </html>
            `);
        }
    },
);

export const instagramConnectionStatus = onCall(
    { region: REGION, invoker: "public" },
    async (request) => {
        try {
            const { uid, inmobiliariaId, userData, inmobiliaria } =
                await assertAuthenticatedManager(request);
            const [agencySnap, onopropSnap] = await Promise.all([
                agencyIntegrationRef(inmobiliariaId).get(),
                onopropIntegrationRef().get(),
            ]);
            const ownEligible =
                userHasRole(userData, "root") ||
                (
                    Array.isArray(inmobiliaria.modulosSuscriptos) &&
                    inmobiliaria.modulosSuscriptos.includes(INSTAGRAM_MODULE_ID)
                );

            return {
                agency: sanitizeConnection(agencySnap.data() || {}),
                onoprop: sanitizeConnection(onopropSnap.data() || {}),
                eligibility: {
                    agency: ownEligible,
                    onoprop: inmobiliaria.activa !== false,
                    canManageOnoprop: userHasRole(userData, "root"),
                    moduleId: INSTAGRAM_MODULE_ID,
                },
                requestedBy: uid,
            };
        } catch (error) {
            throw toHttpsError(error, "No se pudo consultar la conexión de Instagram.");
        }
    },
);

export const instagramDisconnect = onCall(
    { region: REGION, invoker: "public" },
    async (request) => {
        try {
            const target = normalizeTarget(request.data?.target);
            const { uid, inmobiliariaId } =
                await assertAuthenticatedManager(request);

            if (target === "onoprop") await assertRoot(uid);

            const ref = connectionRefForTarget(target, inmobiliariaId);
            const snap = await ref.get();
            if (!snap.exists) return { disconnected: true, target };

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
                    expiresAtMs: FieldValue.delete(),
                    updatedAt: FieldValue.serverTimestamp(),
                },
                { merge: true },
            );
            getInstagramConnectionIdentifiers(data).forEach((identifier) => {
                batch.delete(accountConnectionRef(identifier));
            });
            await batch.commit();

            return { disconnected: true, target };
        } catch (error) {
            throw toHttpsError(error, "No se pudo desconectar Instagram.");
        }
    },
);

export const instagramGetDistribution = onCall(
    { region: REGION, invoker: "public" },
    async (request) => {
        try {
            const { inmobiliariaId } =
                await assertAuthenticatedManager(request);
            const inmuebleId = cleanText(request.data?.inmuebleId, 128);

            if (!inmuebleId) {
                throw new HttpsError("invalid-argument", "Falta el inmueble.");
            }

            const snap = await distributionRef(inmobiliariaId, inmuebleId).get();
            return sanitizeDistribution(snap.data() || {});
        } catch (error) {
            throw toHttpsError(
                error,
                "No se pudo consultar la difusión de Instagram.",
            );
        }
    },
);

export const instagramPublishAgencyMedia = onCall(
    {
        region: REGION,
        invoker: "public",
        timeoutSeconds: 120,
        secrets: [INSTAGRAM_TOKEN_ENCRYPTION_KEY],
    },
    async (request) => {
        let context;

        try {
            const {
                uid,
                inmobiliariaId,
                userData,
                inmobiliaria,
            } = await assertAuthenticatedManager(request);
            assertOwnInstagramEntitlement(userData, inmobiliaria);

            const inmuebleId = cleanText(request.data?.inmuebleId, 128);
            context = await getPublicationContext(
                inmobiliariaId,
                inmuebleId,
                request.data?.imageUrls,
                request.data?.caption,
            );
            await claimPublicationLease(context.ref, "agency");

            const connection = await getValidConnection(
                "agency",
                inmobiliariaId,
            );
            const result = await publishInstagramMedia({
                accessToken: connection.accessToken,
                instagramUserId: connection.integration.instagramUserId,
                caption: context.caption,
                imageUrls: context.imageUrls,
            });
            const persisted = await persistPublishedMedia({
                ref: context.ref,
                destination: "agency",
                result,
                caption: context.caption,
                imageUrls: context.imageUrls,
                uid,
            });

            return {
                published: true,
                destination: "agency",
                ...persisted,
                publishedAt: Date.now(),
                updatedAt: Date.now(),
            };
        } catch (error) {
            if (context?.ref && request.auth?.uid) {
                await persistPublicationError({
                    ref: context.ref,
                    destination: "agency",
                    error,
                    uid: request.auth.uid,
                }).catch(() => {});
            }
            throw toHttpsError(error, "No se pudo publicar en Instagram.");
        }
    },
);

export const instagramSubmitOnopropPublication = onCall(
    { region: REGION, invoker: "public" },
    async (request) => {
        try {
            const { uid, inmobiliariaId } =
                await assertAuthenticatedManager(request);
            const inmuebleId = cleanText(request.data?.inmuebleId, 128);
            const context = await getPublicationContext(
                inmobiliariaId,
                inmuebleId,
                request.data?.imageUrls,
                request.data?.caption,
            );
            const centralConnection = await onopropIntegrationRef().get();

            if (!sanitizeConnection(centralConnection.data() || {}).connected) {
                throw new HttpsError(
                    "failed-precondition",
                    "La cuenta central de Onoprop todavía no está conectada.",
                );
            }

            const requestRef = onopropRequestRef();
            const requestData = {
                provider: "instagram",
                destination: "onoprop",
                status: "pending",
                inmobiliariaId,
                inmobiliariaNombre:
                    cleanText(context.inmobiliaria.nombre, 200) || inmobiliariaId,
                inmuebleId,
                inmuebleTitulo:
                    cleanText(context.inmueble.titulo, 300) || inmuebleId,
                caption: context.caption,
                imageUrls: context.imageUrls,
                requestedBy: uid,
                requestedAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
            };
            let existingRequestId = "";
            await db.runTransaction(async (transaction) => {
                const distributionSnap = await transaction.get(context.ref);
                const current =
                    distributionSnap.data()?.destinations?.onoprop || {};

                if (current.status === "pending" && current.requestId) {
                    existingRequestId = current.requestId;
                    return;
                }

                transaction.set(requestRef, requestData);
                transaction.set(
                    context.ref,
                    {
                        provider: "instagram",
                        destinations: {
                            onoprop: {
                                status: "pending",
                                requestId: requestRef.id,
                                caption: context.caption,
                                imageUrls: context.imageUrls,
                                requestedBy: uid,
                                requestedAt: FieldValue.serverTimestamp(),
                                updatedAt: FieldValue.serverTimestamp(),
                                lastError: FieldValue.delete(),
                            },
                        },
                        updatedAt: FieldValue.serverTimestamp(),
                    },
                    { merge: true },
                );
            });

            return {
                submitted: true,
                status: "pending",
                requestId: existingRequestId || requestRef.id,
                alreadyPending: Boolean(existingRequestId),
                requestedAt: Date.now(),
                updatedAt: Date.now(),
            };
        } catch (error) {
            throw toHttpsError(
                error,
                "No se pudo enviar la publicación a Onoprop.",
            );
        }
    },
);

export const instagramListOnopropRequests = onCall(
    { region: REGION, invoker: "public" },
    async (request) => {
        try {
            await assertRoot(request.auth?.uid);
            const status = cleanText(request.data?.status, 30) || "pending";
            const allowedStatuses = new Set([
                "pending",
                "publishing",
                "published",
                "rejected",
                "error",
            ]);

            if (!allowedStatuses.has(status)) {
                throw new HttpsError(
                    "invalid-argument",
                    "El estado solicitado no es válido.",
                );
            }

            const snap = await db
                .collection("instagram_onoprop_publication_requests")
                .where("status", "==", status)
                .limit(100)
                .get();
            const requests = snap.docs
                .map((doc) => {
                    const data = doc.data() || {};
                    return {
                        id: doc.id,
                        status: data.status || "",
                        inmobiliariaId: data.inmobiliariaId || "",
                        inmobiliariaNombre: data.inmobiliariaNombre || "",
                        inmuebleId: data.inmuebleId || "",
                        inmuebleTitulo: data.inmuebleTitulo || "",
                        caption: data.caption || "",
                        imageUrls: Array.isArray(data.imageUrls)
                            ? data.imageUrls
                            : [],
                        permalink: data.permalink || "",
                        externalId: data.externalId || "",
                        lastError: data.lastError || "",
                        rejectionReason: data.rejectionReason || "",
                        requestedAt: timestampToMillis(data.requestedAt),
                        publishedAt: timestampToMillis(data.publishedAt),
                        updatedAt: timestampToMillis(data.updatedAt),
                    };
                })
                .sort(
                    (a, b) =>
                        Number(b.requestedAt || 0) - Number(a.requestedAt || 0),
                );

            return { status, requests };
        } catch (error) {
            throw toHttpsError(
                error,
                "No se pudieron consultar las solicitudes de Onoprop.",
            );
        }
    },
);

export const instagramApproveOnopropPublication = onCall(
    {
        region: REGION,
        invoker: "public",
        timeoutSeconds: 120,
        secrets: [INSTAGRAM_TOKEN_ENCRYPTION_KEY],
    },
    async (request) => {
        let requestRef;
        let requestData;
        let publicationDocumentRef;

        try {
            const uid = request.auth?.uid;
            await assertRoot(uid);
            const requestId = cleanText(request.data?.requestId, 128);
            if (!requestId) {
                throw new HttpsError("invalid-argument", "Falta la solicitud.");
            }

            requestRef = onopropRequestRef(requestId);
            await db.runTransaction(async (transaction) => {
                const snap = await transaction.get(requestRef);
                if (!snap.exists) {
                    throw new HttpsError("not-found", "No se encontró la solicitud.");
                }

                requestData = snap.data() || {};
                if (
                    requestData.status !== "pending" &&
                    requestData.status !== "error"
                ) {
                    throw new HttpsError(
                        "failed-precondition",
                        "La solicitud ya fue procesada.",
                    );
                }

                transaction.update(requestRef, {
                    status: "publishing",
                    approvedBy: uid,
                    approvedAt: FieldValue.serverTimestamp(),
                    updatedAt: FieldValue.serverTimestamp(),
                    lastError: FieldValue.delete(),
                });
            });

            const context = await getPublicationContext(
                requestData.inmobiliariaId,
                requestData.inmuebleId,
                requestData.imageUrls,
                requestData.caption,
            );
            publicationDocumentRef = context.ref;
            await claimPublicationLease(context.ref, "onoprop");

            const connection = await getValidConnection("onoprop");
            const result = await publishInstagramMedia({
                accessToken: connection.accessToken,
                instagramUserId: connection.integration.instagramUserId,
                caption: context.caption,
                imageUrls: context.imageUrls,
            });
            const persisted = await persistPublishedMedia({
                ref: context.ref,
                destination: "onoprop",
                result,
                caption: context.caption,
                imageUrls: context.imageUrls,
                uid,
                requestId,
            });

            await requestRef.update({
                status: "published",
                externalId: result.externalId,
                permalink: result.permalink,
                mediaType: result.mediaType,
                publishedBy: uid,
                publishedAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
            });

            return {
                published: true,
                destination: "onoprop",
                requestId,
                ...persisted,
                publishedAt: Date.now(),
                updatedAt: Date.now(),
            };
        } catch (error) {
            if (requestRef) {
                await requestRef.set(
                    {
                        status: "error",
                        lastError: formatInstagramError(error),
                        updatedAt: FieldValue.serverTimestamp(),
                    },
                    { merge: true },
                ).catch(() => {});
            }
            if (publicationDocumentRef && request.auth?.uid) {
                await persistPublicationError({
                    ref: publicationDocumentRef,
                    destination: "onoprop",
                    error,
                    uid: request.auth.uid,
                }).catch(() => {});
            }
            throw toHttpsError(
                error,
                "No se pudo publicar la solicitud en Onoprop.",
            );
        }
    },
);

export const instagramRejectOnopropPublication = onCall(
    { region: REGION, invoker: "public" },
    async (request) => {
        try {
            const uid = request.auth?.uid;
            await assertRoot(uid);
            const requestId = cleanText(request.data?.requestId, 128);
            const rejectionReason = cleanText(
                request.data?.rejectionReason,
                1000,
            );
            const requestRef = onopropRequestRef(requestId);
            const snap = await requestRef.get();

            if (!snap.exists) {
                throw new HttpsError("not-found", "No se encontró la solicitud.");
            }

            const data = snap.data() || {};
            if (data.status !== "pending" && data.status !== "error") {
                throw new HttpsError(
                    "failed-precondition",
                    "La solicitud ya fue procesada.",
                );
            }

            const publicationDocumentRef = distributionRef(
                data.inmobiliariaId,
                data.inmuebleId,
            );
            const batch = db.batch();
            batch.update(requestRef, {
                status: "rejected",
                rejectionReason,
                rejectedBy: uid,
                rejectedAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
            });
            batch.set(
                publicationDocumentRef,
                {
                    provider: "instagram",
                    destinations: {
                        onoprop: {
                            status: "rejected",
                            requestId,
                            rejectionReason,
                            updatedAt: FieldValue.serverTimestamp(),
                        },
                    },
                    updatedAt: FieldValue.serverTimestamp(),
                },
                { merge: true },
            );
            await batch.commit();

            return { rejected: true, requestId };
        } catch (error) {
            throw toHttpsError(
                error,
                "No se pudo rechazar la solicitud de Onoprop.",
            );
        }
    },
);

export const instagramDeauthorize = onRequest(
    {
        region: REGION,
        invoker: "public",
        secrets: [INSTAGRAM_APP_SECRET],
    },
    async (req, res) => {
        try {
            const payload = verifyInstagramSignedRequest(
                req.body?.signed_request,
                INSTAGRAM_APP_SECRET.value(),
            );
            const instagramUserId = cleanText(payload.user_id, 100);

            if (!instagramUserId) {
                throw new Error("Meta no informó el usuario de Instagram.");
            }

            await disconnectAccountByInstagramIdentifier(instagramUserId, {
                deauthorizedByMeta: true,
                deauthorizedAt: FieldValue.serverTimestamp(),
            });
            res.status(200).send("OK");
        } catch (error) {
            console.error("Instagram deauthorize error", {
                message: error?.message || "",
            });
            res.status(400).send("Solicitud inválida.");
        }
    },
);

export const instagramDataDeletion = onRequest(
    {
        region: REGION,
        invoker: "public",
        secrets: [INSTAGRAM_APP_SECRET],
    },
    async (req, res) => {
        if (req.method === "GET") {
            const confirmationCode = cleanText(req.query.code, 128);
            const snap = confirmationCode
                ? await db
                    .collection("instagram_data_deletion_requests")
                    .doc(confirmationCode)
                    .get()
                : null;
            const completed = snap?.exists && snap.data()?.status === "completed";

            res.status(completed ? 200 : 404).send(`
                <!doctype html>
                <html>
                  <head>
                    <meta charset="utf-8" />
                    <title>Eliminación de datos de Instagram</title>
                  </head>
                  <body style="font-family: Arial, sans-serif; padding: 32px;">
                    <h1>${completed
                        ? "Solicitud completada"
                        : "Solicitud no encontrada"}</h1>
                    <p>${completed
                        ? "La conexión y los tokens de Instagram fueron eliminados de Onoprop."
                        : "No encontramos una solicitud con ese código."}</p>
                  </body>
                </html>
            `);
            return;
        }

        try {
            const payload = verifyInstagramSignedRequest(
                req.body?.signed_request,
                INSTAGRAM_APP_SECRET.value(),
            );
            const instagramUserId = cleanText(payload.user_id, 100);
            if (!instagramUserId) {
                throw new Error("Meta no informó el usuario de Instagram.");
            }

            await disconnectAccountByInstagramIdentifier(instagramUserId, {
                dataDeletionRequestedByMeta: true,
                dataDeletionRequestedAt: FieldValue.serverTimestamp(),
            }, true);

            const confirmationCode = crypto.randomUUID();
            const expiresAtMs =
                Date.now() + 30 * 24 * 60 * 60 * 1000;
            await db
                .collection("instagram_data_deletion_requests")
                .doc(confirmationCode)
                .set({
                    confirmationCode,
                    instagramUserIdHash: crypto
                        .createHash("sha256")
                        .update(instagramUserId)
                        .digest("hex"),
                    status: "completed",
                    completedAt: FieldValue.serverTimestamp(),
                    expiresAtMs,
                    expiresAt: Timestamp.fromMillis(expiresAtMs),
                });

            const statusUrl = `${req.protocol}://${req.get("host")}${req.path}` +
                `?code=${encodeURIComponent(confirmationCode)}`;
            res.status(200).json({
                url: statusUrl,
                confirmation_code: confirmationCode,
            });
        } catch (error) {
            console.error("Instagram data deletion error", {
                message: error?.message || "",
            });
            res.status(400).json({ error: "Solicitud inválida." });
        }
    },
);
