import admin from "firebase-admin";
import { defineSecret } from "firebase-functions/params";
import { HttpsError, onCall } from "firebase-functions/v2/https";

import {
    OMI_BASE_URL,
    buildOmiFeatureUrl,
    extractCookieHeader,
    normalizeOmiBounds,
    normalizeOmiCollection,
    normalizeOmiLimit,
} from "./omi.helpers.js";

if (!admin.apps.length) admin.initializeApp();

const db = admin.firestore();
const REGION = "southamerica-east1";
const OMI_USERNAME = defineSecret("OMI_USERNAME");
const OMI_PASSWORD = defineSecret("OMI_PASSWORD");
const OMI_SESSION_TTL_MS = 15 * 60 * 1000;
const OMI_REQUEST_TIMEOUT_MS = 20000;
const OMI_USAGE_NOTICE =
    "Uso profesional autorizado. Mantener atribución a OMI/IDECOR y trazabilidad de la fuente.";

let cachedSession = null;

const getUserData = async (uid) => {
    if (!uid) {
        throw new HttpsError("unauthenticated", "Tenés que iniciar sesión.");
    }

    const snap = await db.collection("users").doc(uid).get();
    if (!snap.exists) {
        throw new HttpsError(
            "permission-denied",
            "Perfil de usuario no encontrado.",
        );
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

const cleanId = (value) => String(value || "").trim().slice(0, 180);

const assertOmiAccess = async (uid, requestedInmobiliariaId = "") => {
    const userData = await getUserData(uid);
    const isRoot = userHasRole(userData, "root");
    const inactive = userData.status === "inactivo" ||
        userData.status === "inactive" || userData.activo === false;
    const inmobiliariaId = cleanId(requestedInmobiliariaId);

    if (inactive) {
        throw new HttpsError(
            "permission-denied",
            "El usuario no se encuentra habilitado para consultar OMI.",
        );
    }
    if (isRoot && !inmobiliariaId) return;
    if (!inmobiliariaId) {
        throw new HttpsError(
            "failed-precondition",
            "Seleccioná una inmobiliaria antes de consultar OMI.",
        );
    }
    const assignedAgencies = Array.isArray(userData.inmobiliarias) ?
        userData.inmobiliarias : [];
    if (!isRoot && !assignedAgencies.includes(inmobiliariaId)) {
        throw new HttpsError(
            "permission-denied",
            "El usuario no pertenece a la inmobiliaria seleccionada.",
        );
    }
    const agencySnap = await db.collection("inmobiliarias")
        .doc(inmobiliariaId).get();
    if (!agencySnap.exists) {
        throw new HttpsError("not-found", "La inmobiliaria no existe.");
    }
    const agency = agencySnap.data() || {};
    const modules = Array.isArray(agency.modulosSuscriptos) ?
        agency.modulosSuscriptos : [];
    if (!isRoot && agency.activa === false) {
        throw new HttpsError(
            "permission-denied",
            "La inmobiliaria no se encuentra activa.",
        );
    }
    if (!isRoot && !modules.includes("tasaciones")) {
        throw new HttpsError(
            "permission-denied",
            "La inmobiliaria no tiene contratado el Módulo Tasaciones.",
        );
    }
};

const readSetCookieHeaders = (response) => {
    if (typeof response.headers.getSetCookie === "function") {
        return response.headers.getSetCookie();
    }
    return response.headers.get("set-cookie") || "";
};

const fetchWithTimeout = async (url, options = {}) => {
    const controller = new AbortController();
    const timeout = setTimeout(
        () => controller.abort(),
        OMI_REQUEST_TIMEOUT_MS,
    );
    try {
        return await fetch(url, {
            ...options,
            signal: controller.signal,
        });
    } finally {
        clearTimeout(timeout);
    }
};

const createOmiSession = async () => {
    const username = OMI_USERNAME.value();
    const password = OMI_PASSWORD.value();
    if (!username || !password) {
        throw new Error("Faltan las credenciales seguras de OMI.");
    }

    const response = await fetchWithTimeout(
        `${OMI_BASE_URL}/login/index.php`,
        {
            method: "POST",
            redirect: "manual",
            headers: {
                "content-type": "application/x-www-form-urlencoded",
                "user-agent": "ONO Prop OMI Integration/1.0",
            },
            body: new URLSearchParams({ username, password }),
        },
    );
    const cookie = extractCookieHeader(readSetCookieHeaders(response));
    if (!cookie || response.status >= 400) {
        throw new Error("OMI rechazó el inicio de sesión.");
    }

    cachedSession = {
        cookie,
        expiresAt: Date.now() + OMI_SESSION_TTL_MS,
    };
    return cachedSession;
};

const getOmiSession = async (forceRefresh = false) => {
    if (!forceRefresh && cachedSession?.cookie &&
        cachedSession.expiresAt > Date.now()) {
        return cachedSession;
    }
    return createOmiSession();
};

const responseRequiresLogin = (response, responseText = "") => {
    const location = response.headers.get("location") || "";
    return response.status === 401 || response.status === 403 ||
        (response.status >= 300 && response.status < 400) ||
        /login/i.test(location) ||
        /<form[^>]+(?:login|username)|login\/index\.php/i.test(responseText);
};

const fetchOmiCollection = async ({ bounds, limit }) => {
    const url = buildOmiFeatureUrl({ bounds, limit });

    for (let attempt = 0; attempt < 2; attempt += 1) {
        const session = await getOmiSession(attempt > 0);
        const response = await fetchWithTimeout(url, {
            method: "GET",
            redirect: "manual",
            headers: {
                accept: "application/json",
                cookie: session.cookie,
                "user-agent": "ONO Prop OMI Integration/1.0",
            },
        });
        const responseText = await response.text();

        if (responseRequiresLogin(response, responseText)) {
            cachedSession = null;
            if (attempt === 0) continue;
            throw new Error("La sesión profesional de OMI no está disponible.");
        }
        if (!response.ok) {
            throw new Error(`OMI respondió con estado ${response.status}.`);
        }

        let payload;
        try {
            payload = JSON.parse(responseText);
        } catch {
            throw new Error("OMI devolvió una respuesta que no se pudo interpretar.");
        }
        return normalizeOmiCollection(payload);
    }

    throw new Error("No se pudo consultar OMI.");
};

const callableError = (error) => {
    if (error instanceof HttpsError) return error;
    console.error("Error consultando OMI:", error?.message || error);
    if (error?.name === "AbortError") {
        return new HttpsError(
            "deadline-exceeded",
            "OMI demoró demasiado en responder.",
        );
    }
    return new HttpsError(
        "unavailable",
        error?.message || "No se pudo consultar OMI.",
    );
};

const callableOptions = {
    region: REGION,
    timeoutSeconds: 60,
    memory: "256MiB",
    secrets: [OMI_USERNAME, OMI_PASSWORD],
};

export const omiTestConnection = onCall(callableOptions, async (request) => {
    try {
        await assertOmiAccess(
            request.auth?.uid,
            request.data?.inmobiliariaId,
        );
        cachedSession = null;
        await fetchOmiCollection({
            bounds: {
                minX: -7153250,
                minY: -3681263,
                maxX: -7139110,
                maxY: -3672472,
            },
            limit: 1,
        });
        return {
            connected: true,
            provider: "OMI profesional - IDECOR",
            checkedAt: new Date().toISOString(),
            usageNotice: OMI_USAGE_NOTICE,
        };
    } catch (error) {
        throw callableError(error);
    }
});

export const omiSearchComparables = onCall(
    callableOptions,
    async (request) => {
        try {
            await assertOmiAccess(
                request.auth?.uid,
                request.data?.inmobiliariaId,
            );
            const crs = request.data?.crs || "EPSG:4326";
            const bounds = normalizeOmiBounds(request.data?.bounds, crs);
            const limit = normalizeOmiLimit(request.data?.limit);
            const result = await fetchOmiCollection({ bounds, limit });

            return {
                ...result,
                provider: "OMI profesional - IDECOR",
                usageNotice: OMI_USAGE_NOTICE,
            };
        } catch (error) {
            throw callableError(error);
        }
    },
);
