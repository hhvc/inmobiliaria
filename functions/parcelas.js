import admin from "firebase-admin";
import {HttpsError, onCall} from "firebase-functions/v2/https";

import {
    buildIdecorPointQueryUrl,
    firstFeature,
    normalizeIdecorCoordinate,
    normalizeLandUseFeature,
    normalizeOccupancyFeature,
    normalizeParcelFeature,
    normalizeSubdivisionFeature,
} from "./parcelas.helpers.js";

if (!admin.apps.length) admin.initializeApp();

const db = admin.firestore();
const REGION = "southamerica-east1";
const MODULE_ID = "parcelas";
const REQUEST_TIMEOUT_MS = 20000;
const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX_ENTRIES = 200;
const cache = new Map();

const LAYERS = {
    parcel: "parcelas",
    occupancy: "normativas_urbanas_ocupacion_v",
    subdivision: "normativas_urbanas_fraccionamiento_v",
    landUse: "normativas_urbanas_usos_suelos_v",
};

const hasRole = (data = {}, role) => {
    return data.role === role || data.primaryRole === role ||
        (Array.isArray(data.roles) && data.roles.includes(role));
};

const cleanId = (value) => String(value || "").trim().slice(0, 180);

const assertParcelAccess = async (uid, inmobiliariaId) => {
    if (!uid) {
        throw new HttpsError("unauthenticated", "Tenés que iniciar sesión.");
    }
    const userSnap = await db.collection("users").doc(uid).get();
    if (!userSnap.exists) {
        throw new HttpsError(
            "permission-denied",
            "No se encontró el perfil del usuario.",
        );
    }
    const user = userSnap.data() || {};
    const isRoot = hasRole(user, "root");
    const agencyId = cleanId(inmobiliariaId);

    if (isRoot && !agencyId) return {isRoot, inmobiliariaId: ""};
    if (!agencyId) {
        throw new HttpsError(
            "failed-precondition",
            "Seleccioná una inmobiliaria antes de consultar.",
        );
    }
    const assignedAgencies = Array.isArray(user.inmobiliarias) ?
        user.inmobiliarias : [];
    if (!isRoot && !assignedAgencies.includes(agencyId)) {
        throw new HttpsError(
            "permission-denied",
            "El usuario no pertenece a la inmobiliaria seleccionada.",
        );
    }

    const agencySnap = await db.collection("inmobiliarias").doc(agencyId).get();
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
    if (!isRoot && !modules.includes(MODULE_ID)) {
        throw new HttpsError(
            "permission-denied",
            "La inmobiliaria no tiene contratado el módulo de parcelas.",
        );
    }
    return {isRoot, inmobiliariaId: agencyId};
};

const fetchWithTimeout = async (url) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
        const response = await fetch(url, {
            headers: {
                accept: "application/json",
                "user-agent": "ONO Prop Parcelas/1.0",
            },
            signal: controller.signal,
        });
        if (!response.ok) {
            throw new Error(`IDECOR respondió con estado ${response.status}.`);
        }
        return await response.json();
    } finally {
        clearTimeout(timeout);
    }
};

const fetchLayerAtPoint = async (layer, latitude, longitude) => {
    const url = buildIdecorPointQueryUrl({layer, latitude, longitude});
    const payload = await fetchWithTimeout(url);
    return firstFeature(payload);
};

const readCache = (key) => {
    const entry = cache.get(key);
    if (!entry || entry.expiresAt <= Date.now()) {
        cache.delete(key);
        return null;
    }
    return entry.value;
};

const writeCache = (key, value) => {
    if (cache.size >= CACHE_MAX_ENTRIES) {
        cache.delete(cache.keys().next().value);
    }
    cache.set(key, {value, expiresAt: Date.now() + CACHE_TTL_MS});
};

const queryIdecorAtPoint = async (latitude, longitude) => {
    const cacheKey = `${latitude.toFixed(6)}:${longitude.toFixed(6)}`;
    const cached = readCache(cacheKey);
    if (cached) return {...cached, cached: true};

    const entries = Object.entries(LAYERS);
    const settled = await Promise.allSettled(
        entries.map(([, layer]) => fetchLayerAtPoint(
            layer,
            latitude,
            longitude,
        )),
    );
    const features = {};
    const unavailableLayers = [];
    settled.forEach((result, index) => {
        const [key] = entries[index];
        if (result.status === "fulfilled") {
            features[key] = result.value;
        } else {
            console.error(
                `Error consultando capa ${entries[index][1]}:`,
                result.reason?.message || result.reason,
            );
            features[key] = null;
            unavailableLayers.push(key);
        }
    });
    if (settled[0].status === "rejected") {
        throw settled[0].reason;
    }

    const value = {
        parcel: normalizeParcelFeature(features.parcel),
        urbanPlanning: {
            occupancy: normalizeOccupancyFeature(features.occupancy),
            subdivision: normalizeSubdivisionFeature(features.subdivision),
            landUse: normalizeLandUseFeature(features.landUse),
        },
        unavailableLayers,
        queriedAt: new Date().toISOString(),
        cached: false,
    };
    writeCache(cacheKey, value);
    return value;
};

const toCallableError = (error) => {
    if (error instanceof HttpsError) return error;
    console.error("Error en consulta profesional de parcelas:", error);
    if (error?.name === "AbortError") {
        return new HttpsError(
            "deadline-exceeded",
            "El geoservicio oficial demoró demasiado en responder.",
        );
    }
    return new HttpsError(
        "unavailable",
        "No se pudo consultar el geoservicio oficial en este momento.",
    );
};

export const parcelasGetAtPoint = onCall({
    region: REGION,
    timeoutSeconds: 60,
    memory: "256MiB",
}, async (request) => {
    try {
        await assertParcelAccess(
            request.auth?.uid,
            request.data?.inmobiliariaId,
        );
        const latitude = normalizeIdecorCoordinate(
            request.data?.latitude,
            "latitude",
        );
        const longitude = normalizeIdecorCoordinate(
            request.data?.longitude,
            "longitude",
        );
        const result = await queryIdecorAtPoint(latitude, longitude);
        return {
            ...result,
            location: {latitude, longitude},
            provider: "IDECOR / Mapas Córdoba",
            coverageNotice:
                "La normativa urbana sólo aparece donde existe cobertura municipal publicada.",
            legalNotice:
                "Información orientativa. Verificá vigencia y alcance con Catastro y el municipio competente antes de emitir un informe profesional.",
        };
    } catch (error) {
        throw toCallableError(error);
    }
});
