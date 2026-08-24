import { getFunctions, httpsCallable } from "firebase/functions";

import app, { appCheckReadyPromise } from "../../firebase/config";

const functions = getFunctions(app, "southamerica-east1");
const IN_FLIGHT_EVENTS = new Set();
const STORAGE_PREFIX = "onoprop.performance.v1";

const getLocalDateKey = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = `${now.getMonth() + 1}`.padStart(2, "0");
    const day = `${now.getDate()}`.padStart(2, "0");
    return `${year}-${month}-${day}`;
};

const buildEventKey = (payload = {}) => [
    STORAGE_PREFIX,
    getLocalDateKey(),
    payload.eventType || "",
    payload.ownerAgencyId || "",
    payload.inmuebleId || "",
    payload.presentationAgencyId || "",
].join(":");

const wasRecorded = (key) => {
    try {
        return window.localStorage.getItem(key) === "1";
    } catch {
        return false;
    }
};

const markRecorded = (key) => {
    try {
        const currentPrefix = `${STORAGE_PREFIX}:${getLocalDateKey()}:`;
        const staleKeys = [];
        for (let index = 0; index < window.localStorage.length; index += 1) {
            const storedKey = window.localStorage.key(index) || "";
            if (storedKey.startsWith(`${STORAGE_PREFIX}:`) && !storedKey.startsWith(currentPrefix)) {
                staleKeys.push(storedKey);
            }
        }
        staleKeys.forEach((storedKey) => window.localStorage.removeItem(storedKey));
        window.localStorage.setItem(key, "1");
    } catch {
        // El registro es auxiliar: la navegación pública nunca debe bloquearse.
    }
};

export const recordPortalPerformanceEvent = async (payload = {}) => {
    if (
        !payload.ownerAgencyId ||
        !payload.inmuebleId ||
        payload.sourceType === "particular"
    ) return { ok: false, skipped: true };

    const key = buildEventKey(payload);
    if (wasRecorded(key) || IN_FLIGHT_EVENTS.has(key)) {
        return { ok: true, deduplicated: true };
    }

    IN_FLIGHT_EVENTS.add(key);

    try {
        const appCheckResult = await appCheckReadyPromise;
        if (appCheckResult?.success === false) return { ok: false, skipped: true };

        const callable = httpsCallable(functions, "portalRecordPerformanceEvent");
        const result = await callable(payload);
        markRecorded(key);
        return result.data;
    } catch (error) {
        console.warn("No se pudo registrar la interacción de rendimiento:", error);
        return { ok: false, skipped: true };
    } finally {
        IN_FLIGHT_EVENTS.delete(key);
    }
};

export const getPortalPerformanceDashboard = async ({
    inmobiliariaId,
    dateFrom,
    dateTo,
}) => {
    try {
        const callable = httpsCallable(functions, "portalGetPerformanceDashboard");
        const result = await callable({ inmobiliariaId, dateFrom, dateTo });
        return result.data;
    } catch (error) {
        const knownMessages = {
            "functions/unauthenticated": "Iniciá sesión para consultar el rendimiento.",
            "functions/permission-denied":
                "No tenés permisos para ver el rendimiento de esta inmobiliaria.",
            "functions/invalid-argument": "Revisá el período seleccionado.",
        };
        throw new Error(
            knownMessages[error?.code] ||
            error?.details?.message ||
            error?.message ||
            "No se pudo cargar el rendimiento.",
        );
    }
};
