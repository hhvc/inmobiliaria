import { getFunctions, httpsCallable } from "firebase/functions";

import app, { appCheckReadyPromise } from "../../firebase/config";
import {
    buildAcquisitionAttributionFromLocation,
    isAcquisitionAttributionActive,
    normalizeAcquisitionAttribution,
} from "../utils/acquisitionAttribution.helpers";

const functions = getFunctions(app, "southamerica-east1");
const ATTRIBUTION_STORAGE_KEY = "onoprop.acquisition.attribution.v1";
const EVENT_STORAGE_PREFIX = "onoprop.acquisition.event.v1";
const IN_FLIGHT_EVENTS = new Set();

const randomId = () => {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
};

const readJson = (key) => {
    try {
        return JSON.parse(window.localStorage.getItem(key) || "null");
    } catch {
        return null;
    }
};

const writeJson = (key, value) => {
    try {
        window.localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch {
        return false;
    }
};

export const captureAcquisitionAttribution = ({ search, pathname } = {}) => {
    if (typeof window === "undefined") return null;
    const attribution = buildAcquisitionAttributionFromLocation({
        search: search ?? window.location.search,
        pathname: pathname ?? window.location.pathname,
        attributionId: randomId(),
        capturedAt: Date.now(),
    });
    if (!attribution) return getActiveAcquisitionAttribution();
    writeJson(ATTRIBUTION_STORAGE_KEY, attribution);
    return attribution;
};

export const getActiveAcquisitionAttribution = () => {
    if (typeof window === "undefined") return null;
    const value = readJson(ATTRIBUTION_STORAGE_KEY);
    if (isAcquisitionAttributionActive(value)) {
        return normalizeAcquisitionAttribution(value);
    }
    try {
        window.localStorage.removeItem(ATTRIBUTION_STORAGE_KEY);
    } catch {
        // La medición nunca debe impedir el uso del portal.
    }
    return null;
};

const buildStoredEventKey = (attribution, eventType, dedupeKey) => [
    EVENT_STORAGE_PREFIX,
    attribution.attributionId,
    eventType,
    dedupeKey || "default",
].join(":");

export const recordAcquisitionConversion = async (
    eventType,
    { dedupeKey = "" } = {},
) => {
    const attribution = getActiveAcquisitionAttribution();
    if (!attribution || !eventType) return { ok: false, skipped: true };

    const storedKey = buildStoredEventKey(attribution, eventType, dedupeKey);
    const storedEvent = readJson(storedKey);
    if (storedEvent?.status === "recorded" || IN_FLIGHT_EVENTS.has(storedKey)) {
        return { ok: true, deduplicated: true };
    }

    const eventId = storedEvent?.eventId || randomId();
    writeJson(storedKey, { eventId, status: "pending" });
    IN_FLIGHT_EVENTS.add(storedKey);

    try {
        const appCheckResult = await appCheckReadyPromise;
        if (appCheckResult?.success === false) return { ok: false, skipped: true };

        const callable = httpsCallable(functions, "onopropRecordAcquisitionConversion");
        const result = await callable({
            eventType,
            eventId,
            attribution: {
                source: attribution.source,
                medium: attribution.medium,
                campaign: attribution.campaign,
                content: attribution.content,
            },
        });
        writeJson(storedKey, { eventId, status: "recorded" });
        return result.data;
    } catch (error) {
        console.warn("No se pudo registrar la conversión agregada:", error);
        return { ok: false, skipped: true };
    } finally {
        IN_FLIGHT_EVENTS.delete(storedKey);
    }
};
