import crypto from "node:crypto";

import admin from "firebase-admin";
import { HttpsError, onCall } from "firebase-functions/v2/https";

import {
    ONOPROP_ACQUISITION_CONVERSION_COUNTERS,
    cleanAcquisitionText,
    getAcquisitionDateKey,
    getAcquisitionRangeDays,
    isOnopropMcpAttribution,
    normalizeAcquisitionAttribution,
    normalizeAcquisitionConversionType,
    normalizeAcquisitionDateKey,
    normalizeAcquisitionGoal,
    normalizeAcquisitionSearch,
    serializeAcquisitionRecord,
} from "./onopropAcquisition.helpers.js";

if (!admin.apps.length) admin.initializeApp();

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;
const REGION = "southamerica-east1";
const COLLECTION = "onoprop_acquisition_daily";
const DEDUP_COLLECTION = "onoprop_acquisition_event_dedup";
const MAX_DASHBOARD_RECORDS = 5000;
const MAX_DASHBOARD_DAYS = 366;
const PORTAL_EVENT_COUNTERS = Object.freeze({
    detail_view: "detailViews",
    favorite_add: "favoriteAdds",
    whatsapp_click: "whatsappClicks",
    email_click: "emailClicks",
    inquiry_submitted: "inquiries",
});

const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");

const analyticsRuntimeEnabled = () => Boolean(
    globalThis.process?.env?.K_SERVICE || globalThis.process?.env?.FUNCTION_TARGET,
);

const summaryReference = (dateKey) => db.collection(COLLECTION)
    .doc(`${dateKey}_chatgpt_plugin`);

const summaryData = (dateKey, increments = {}) => ({
    dateKey,
    kind: "summary",
    source: "chatgpt_plugin",
    counters: Object.fromEntries(Object.entries(increments).map(([key, value]) => [
        key,
        FieldValue.increment(value),
    ])),
    updatedAt: FieldValue.serverTimestamp(),
});

const persistAnalytics = async (label, writer) => {
    if (!analyticsRuntimeEnabled()) return { ok: false, skipped: true };

    try {
        const result = await writer();
        return { ok: true, ...(result || {}) };
    } catch (error) {
        console.warn(`[ONO Prop acquisition] ${label} failed`, {
            message: error instanceof Error ? error.message : "Unknown error",
        });
        return { ok: false, skipped: true };
    }
};

export const recordOnopropAcquisitionConversion = async ({
    eventType: eventTypeValue = "",
    attribution: attributionValue = {},
    eventId: eventIdValue = "",
} = {}) => {
    const eventType = normalizeAcquisitionConversionType(eventTypeValue);
    const attribution = normalizeAcquisitionAttribution(attributionValue);
    const eventId = cleanAcquisitionText(eventIdValue, 200);
    const counterKey = ONOPROP_ACQUISITION_CONVERSION_COUNTERS[eventType];

    if (!eventType || !counterKey || !isOnopropMcpAttribution(attribution)) {
        return { ok: false, skipped: true };
    }

    const dateKey = getAcquisitionDateKey();
    const content = attribution.content || "sin_contenido";
    const conversionHash = sha256(`${eventType}:${content}`).slice(0, 32);
    const conversionReference = db.collection(COLLECTION)
        .doc(`${dateKey}_conversion_${conversionHash}`);
    const dedupReference = eventId
        ? db.collection(DEDUP_COLLECTION).doc(sha256(eventId))
        : null;

    return persistAnalytics(`conversion ${eventType}`, async () => {
        if (!dedupReference) {
            const batch = db.batch();
            batch.set(summaryReference(dateKey), summaryData(dateKey, {
                [counterKey]: 1,
            }), { merge: true });
            batch.set(conversionReference, {
                dateKey,
                kind: "conversion",
                source: "chatgpt_plugin",
                conversionType: eventType,
                attributionContent: content,
                counters: {
                    [counterKey]: FieldValue.increment(1),
                },
                updatedAt: FieldValue.serverTimestamp(),
            }, { merge: true });
            await batch.commit();
            return {};
        }

        return db.runTransaction(async (transaction) => {
            const existing = await transaction.get(dedupReference);
            if (existing.exists) return { deduplicated: true };

            transaction.set(dedupReference, {
                createdAt: FieldValue.serverTimestamp(),
                expiresAt: admin.firestore.Timestamp.fromMillis(
                    Date.now() + (90 * 86400000),
                ),
            });
            transaction.set(summaryReference(dateKey), summaryData(dateKey, {
                [counterKey]: 1,
            }), { merge: true });
            transaction.set(conversionReference, {
                dateKey,
                kind: "conversion",
                source: "chatgpt_plugin",
                conversionType: eventType,
                attributionContent: content,
                counters: {
                    [counterKey]: FieldValue.increment(1),
                },
                updatedAt: FieldValue.serverTimestamp(),
            }, { merge: true });
            return { deduplicated: false };
        });
    });
};

export const recordOnopropMcpSearch = async (filters = {}, resultCount = 0) => {
    const dateKey = getAcquisitionDateKey();
    const search = normalizeAcquisitionSearch(filters);
    const safeResultCount = Math.max(0, Math.min(20, Math.round(Number(resultCount) || 0)));
    const searchHash = sha256(JSON.stringify(search)).slice(0, 32);
    const searchReference = db.collection(COLLECTION)
        .doc(`${dateKey}_search_${searchHash}`);
    const zeroResultIncrement = safeResultCount === 0 ? 1 : 0;

    return persistAnalytics("search", async () => {
        const batch = db.batch();
        batch.set(summaryReference(dateKey), summaryData(dateKey, {
            searches: 1,
            zeroResultSearches: zeroResultIncrement,
            resultsReturned: safeResultCount,
        }), { merge: true });
        batch.set(searchReference, {
            dateKey,
            kind: "search",
            source: "chatgpt_plugin",
            search,
            counters: {
                searches: FieldValue.increment(1),
                zeroResultSearches: FieldValue.increment(zeroResultIncrement),
                resultsReturned: FieldValue.increment(safeResultCount),
            },
            updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
        await batch.commit();
    });
};

export const recordOnopropMcpPropertyDetail = async () => {
    const dateKey = getAcquisitionDateKey();
    return persistAnalytics("property detail", () => summaryReference(dateKey).set(
        summaryData(dateKey, { propertyDetails: 1 }),
        { merge: true },
    ));
};

export const recordOnopropMcpStart = async (goalValue = "") => {
    const dateKey = getAcquisitionDateKey();
    const goal = normalizeAcquisitionGoal(goalValue);
    const goalReference = db.collection(COLLECTION).doc(`${dateKey}_goal_${goal}`);

    return persistAnalytics("start option", async () => {
        const batch = db.batch();
        batch.set(summaryReference(dateKey), summaryData(dateKey, {
            startRequests: 1,
        }), { merge: true });
        batch.set(goalReference, {
            dateKey,
            kind: "goal",
            source: "chatgpt_plugin",
            goal,
            counters: {
                startRequests: FieldValue.increment(1),
            },
            updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
        await batch.commit();
    });
};

export const recordChatgptPortalInteraction = async (eventTypeValue = "") => {
    const eventType = cleanAcquisitionText(eventTypeValue, 40);
    const counterKey = PORTAL_EVENT_COUNTERS[eventType];
    if (!counterKey) return { ok: false, skipped: true };

    const dateKey = getAcquisitionDateKey();
    return persistAnalytics("portal interaction", () => summaryReference(dateKey).set(
        summaryData(dateKey, { [counterKey]: 1 }),
        { merge: true },
    ));
};

const getUserData = async (uid) => {
    if (!uid) throw new HttpsError("unauthenticated", "Iniciá sesión para continuar.");
    const snapshot = await db.collection("users").doc(uid).get();
    if (!snapshot.exists) {
        throw new HttpsError("permission-denied", "No encontramos tu perfil de acceso.");
    }
    return snapshot.data() || {};
};

const userIsRoot = (userData = {}) => (
    userData.role === "root" ||
    userData.primaryRole === "root" ||
    (Array.isArray(userData.roles) && userData.roles.includes("root"))
);

export const onopropGetAcquisitionDashboard = onCall(
    {
        region: REGION,
        invoker: "public",
        timeoutSeconds: 60,
    },
    async (request) => {
        const userData = await getUserData(request.auth?.uid);
        if (!userIsRoot(userData)) {
            throw new HttpsError(
                "permission-denied",
                "Solo la administración ROOT puede ver la adquisición global.",
            );
        }

        const today = getAcquisitionDateKey();
        const defaultFrom = getAcquisitionDateKey(new Date(Date.now() - (29 * 86400000)));
        const dateFrom = normalizeAcquisitionDateKey(request.data?.dateFrom) || defaultFrom;
        const dateTo = normalizeAcquisitionDateKey(request.data?.dateTo) || today;
        const rangeDays = getAcquisitionRangeDays(dateFrom, dateTo);

        if (rangeDays <= 0 || rangeDays > MAX_DASHBOARD_DAYS) {
            throw new HttpsError(
                "invalid-argument",
                `Elegí un período de entre 1 y ${MAX_DASHBOARD_DAYS} días.`,
            );
        }

        const snapshot = await db.collection(COLLECTION)
            .where("dateKey", ">=", dateFrom)
            .where("dateKey", "<=", dateTo)
            .orderBy("dateKey", "asc")
            .limit(MAX_DASHBOARD_RECORDS + 1)
            .get();
        const truncated = snapshot.size > MAX_DASHBOARD_RECORDS;
        const records = snapshot.docs
            .slice(0, MAX_DASHBOARD_RECORDS)
            .map(serializeAcquisitionRecord);

        return {
            dateFrom,
            dateTo,
            records,
            truncated,
        };
    },
);

export const onopropRecordAcquisitionConversion = onCall(
    {
        region: REGION,
        invoker: "public",
        enforceAppCheck: true,
        timeoutSeconds: 30,
    },
    async (request) => {
        const result = await recordOnopropAcquisitionConversion({
            eventType: request.data?.eventType,
            attribution: request.data?.attribution,
            eventId: request.data?.eventId,
        });
        if (result.skipped) {
            throw new HttpsError(
                "invalid-argument",
                "La conversión o su atribución no son válidas.",
            );
        }
        return result;
    },
);
