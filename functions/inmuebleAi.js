import crypto from "node:crypto";
import process from "node:process";

import admin from "firebase-admin";
import {defineSecret} from "firebase-functions/params";
import {HttpsError, onCall} from "firebase-functions/v2/https";

import {
    buildPropertyDraftInstructions,
    buildPropertyImageReviewInstructions,
    buildPropertyReviewInstructions,
    extractResponseOutputText,
    PROPERTY_DRAFT_SCHEMA,
    PROPERTY_IMAGE_REVIEW_SCHEMA,
    PROPERTY_REVIEW_SCHEMA,
    redactPrivateContactDetails,
    sanitizePropertyDraftResponse,
    sanitizePropertyImageReviewResponse,
    sanitizePropertyImageUrls,
    sanitizePropertyReviewInput,
    sanitizePropertyReviewResponse,
} from "./inmuebleAi.helpers.js";
import {
    aggregateAiDraftEvents,
    getAiAnalyticsRangeDays,
    normalizeAiAnalyticsDateKey,
} from "./inmuebleAiAnalytics.helpers.js";

if (!admin.apps.length) admin.initializeApp();

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

// The assistant is optional while ONO Prop validates its API budget. Keeping
// the secret binding behind a non-secret flag prevents unrelated Firebase
// deployments from asking for an OpenAI key before the feature is activated.
const OPENAI_PROPERTY_DRAFT_ENABLED = /^(1|true|yes)$/i.test(
    String(process.env.OPENAI_PROPERTY_DRAFT_ENABLED || "").trim(),
);
const OPENAI_API_KEY = OPENAI_PROPERTY_DRAFT_ENABLED ?
    defineSecret("OPENAI_API_KEY") : null;
const OPENAI_SECRET_BINDINGS = OPENAI_PROPERTY_DRAFT_ENABLED ?
    [OPENAI_API_KEY] : [];

const REGION = "southamerica-east1";
const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const DEFAULT_MODEL = "gpt-6-luna";
const MAX_SOURCE_LENGTH = 6000;
const MIN_SOURCE_LENGTH = 20;
const USAGE_COLLECTION = "ai_property_draft_usage";
const VISION_USAGE_COLLECTION = "ai_property_vision_usage";
const EVENT_COLLECTION = "ai_property_draft_events";
const MAX_DASHBOARD_DAYS = 366;
const MAX_DASHBOARD_EVENTS = 5000;

const cleanId = (value, maxLength = 160) => (
    typeof value === "string" ? value.trim().slice(0, maxLength) : ""
);

const normalizeRole = (value = "") => {
    const role = value.toString().trim().toLowerCase();
    return role === "user" ? "usuario" : role;
};

const userHasRole = (user = {}, role) => {
    const expected = normalizeRole(role);
    const roles = Array.isArray(user.roles) ? user.roles : [];
    return normalizeRole(user.role) === expected ||
        normalizeRole(user.primaryRole) === expected ||
        roles.some((item) => normalizeRole(item) === expected);
};

const getUserProfile = async (uid) => {
    if (!uid) {
        throw new HttpsError("unauthenticated", "Tenés que iniciar sesión.");
    }
    const snap = await db.collection("users").doc(uid).get();
    if (!snap.exists) {
        throw new HttpsError(
            "permission-denied",
            "No encontramos tu perfil de usuario.",
        );
    }
    return snap.data() || {};
};

const assertRoot = async (uid) => {
    const user = await getUserProfile(uid);
    if (!userHasRole(user, "root")) {
        throw new HttpsError(
            "permission-denied",
            "Solo la administración ROOT puede consultar estas métricas.",
        );
    }
    return user;
};

const assertCanPrepareDraft = async (uid, inmobiliariaId) => {
    const user = await getUserProfile(uid);
    const isRoot = userHasRole(user, "root");

    if (!inmobiliariaId) {
        return {user, isRoot, agencyMode: false};
    }

    const agencyIds = Array.isArray(user.inmobiliarias) ?
        user.inmobiliarias : [];
    const agencyRoles = user.inmobiliariaRoles &&
        typeof user.inmobiliariaRoles === "object" ?
        user.inmobiliariaRoles : {};
    const agencyRole = normalizeRole(
        agencyRoles[inmobiliariaId] || (userHasRole(user, "admin") ? "admin" : ""),
    );
    const canCreate = isRoot || (
        userHasRole(user, "admin") &&
        agencyIds.includes(inmobiliariaId) &&
        ["admin", "editor", "branch_manager"].includes(agencyRole)
    );

    if (!canCreate) {
        throw new HttpsError(
            "permission-denied",
            "No tenés permisos para preparar inmuebles de esta inmobiliaria.",
        );
    }

    return {user, isRoot, agencyMode: true};
};

const getArgentinaDayKey = (date = new Date()) => new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
}).format(date);

const reserveDailyAttempt = async ({uid, isRoot, agencyMode}) => {
    const dayKey = getArgentinaDayKey();
    const dailyLimit = isRoot ? 100 : agencyMode ? 25 : 5;
    const usageRef = db.collection(USAGE_COLLECTION).doc(`${uid}_${dayKey}`);

    const count = await db.runTransaction(async (transaction) => {
        const snap = await transaction.get(usageRef);
        const current = Number(snap.data()?.attempts || 0);

        if (current >= dailyLimit) {
            throw new HttpsError(
                "resource-exhausted",
                "Alcanzaste el límite diario de asistencias con IA. Podés continuar manualmente o volver a intentarlo mañana.",
            );
        }

        transaction.set(usageRef, {
            uid,
            dayKey,
            attempts: current + 1,
            successes: Number(snap.data()?.successes || 0),
            inputTokens: Number(snap.data()?.inputTokens || 0),
            outputTokens: Number(snap.data()?.outputTokens || 0),
            updatedAt: FieldValue.serverTimestamp(),
            createdAt: snap.exists ?
                snap.data()?.createdAt || FieldValue.serverTimestamp() :
                FieldValue.serverTimestamp(),
        }, {merge: true});

        return current + 1;
    });

    return {
        usageRef,
        dailyLimit,
        remainingAttempts: Math.max(0, dailyLimit - count),
    };
};

const reserveDailyVisionAttempt = async ({uid, isRoot, agencyMode}) => {
    const dayKey = getArgentinaDayKey();
    const dailyLimit = isRoot ? 20 : agencyMode ? 5 : 1;
    const usageRef = db.collection(VISION_USAGE_COLLECTION)
        .doc(`${uid}_${dayKey}`);

    const count = await db.runTransaction(async (transaction) => {
        const snap = await transaction.get(usageRef);
        const current = Number(snap.data()?.attempts || 0);
        if (current >= dailyLimit) {
            throw new HttpsError(
                "resource-exhausted",
                "Alcanzaste el límite diario de revisiones visuales. Podés ordenar las fotos manualmente o volver a intentarlo mañana.",
            );
        }

        transaction.set(usageRef, {
            uid,
            dayKey,
            attempts: current + 1,
            successes: Number(snap.data()?.successes || 0),
            inputTokens: Number(snap.data()?.inputTokens || 0),
            outputTokens: Number(snap.data()?.outputTokens || 0),
            updatedAt: FieldValue.serverTimestamp(),
            createdAt: snap.exists ?
                snap.data()?.createdAt || FieldValue.serverTimestamp() :
                FieldValue.serverTimestamp(),
        }, {merge: true});
        return current + 1;
    });

    return {
        usageRef,
        dailyLimit,
        remainingAttempts: Math.max(0, dailyLimit - count),
    };
};

const getOpenAiModel = () => cleanId(
    process.env.OPENAI_PROPERTY_DRAFT_MODEL || DEFAULT_MODEL,
    100,
) || DEFAULT_MODEL;

const buildSafetyIdentifier = (uid) => crypto
    .createHash("sha256")
    .update(`onoprop-property-draft:${uid}`)
    .digest("hex");

const callOpenAi = async ({apiKey, sourceText, uid}) => {
    const model = getOpenAiModel();
    const response = await fetch(OPENAI_RESPONSES_URL, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model,
            store: false,
            reasoning: {effort: "none"},
            safety_identifier: buildSafetyIdentifier(uid),
            max_output_tokens: 3500,
            input: [
                {
                    role: "system",
                    content: buildPropertyDraftInstructions(),
                },
                {
                    role: "user",
                    content: sourceText,
                },
            ],
            text: {
                format: {
                    type: "json_schema",
                    name: "onoprop_property_draft",
                    strict: true,
                    schema: PROPERTY_DRAFT_SCHEMA,
                },
            },
        }),
        signal: AbortSignal.timeout(45000),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        const error = new Error("OpenAI rechazó la preparación del borrador.");
        error.status = response.status;
        error.requestId = response.headers.get("x-request-id") || "";
        error.type = data?.error?.type || "";
        throw error;
    }

    const outputText = extractResponseOutputText(data);
    if (!outputText) {
        throw new Error("La IA no devolvió un borrador utilizable.");
    }

    let parsed;
    try {
        parsed = JSON.parse(outputText);
    } catch {
        throw new Error("La IA devolvió un borrador con formato inválido.");
    }

    return {
        result: sanitizePropertyDraftResponse(parsed),
        usage: data.usage || {},
        model,
    };
};

const callOpenAiReview = async ({apiKey, property, uid}) => {
    const model = getOpenAiModel();
    const response = await fetch(OPENAI_RESPONSES_URL, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model,
            store: false,
            reasoning: {effort: "none"},
            safety_identifier: buildSafetyIdentifier(uid),
            max_output_tokens: 4000,
            input: [
                {
                    role: "system",
                    content: buildPropertyReviewInstructions(),
                },
                {
                    role: "user",
                    content: JSON.stringify(property),
                },
            ],
            text: {
                format: {
                    type: "json_schema",
                    name: "onoprop_property_review",
                    strict: true,
                    schema: PROPERTY_REVIEW_SCHEMA,
                },
            },
        }),
        signal: AbortSignal.timeout(45000),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        const error = new Error("OpenAI rechazó la revisión de la publicación.");
        error.status = response.status;
        error.requestId = response.headers.get("x-request-id") || "";
        error.type = data?.error?.type || "";
        throw error;
    }

    const outputText = extractResponseOutputText(data);
    if (!outputText) {
        throw new Error("La IA no devolvió una revisión utilizable.");
    }

    let parsed;
    try {
        parsed = JSON.parse(outputText);
    } catch {
        throw new Error("La IA devolvió una revisión con formato inválido.");
    }

    return {
        result: sanitizePropertyReviewResponse(parsed),
        usage: data.usage || {},
        model,
    };
};

const callOpenAiImageReview = async ({apiKey, property, imageUrls, uid}) => {
    const model = getOpenAiModel();
    const response = await fetch(OPENAI_RESPONSES_URL, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model,
            store: false,
            reasoning: {effort: "none"},
            safety_identifier: buildSafetyIdentifier(uid),
            max_output_tokens: 3500,
            input: [
                {
                    role: "system",
                    content: buildPropertyImageReviewInstructions(),
                },
                {
                    role: "user",
                    content: [
                        {
                            type: "input_text",
                            text: [
                                `Datos públicos: ${JSON.stringify(property)}`,
                                "Las imágenes siguientes corresponden, en orden, a los índices 0 en adelante.",
                            ].join("\n"),
                        },
                        ...imageUrls.map((imageUrl) => ({
                            type: "input_image",
                            image_url: imageUrl,
                            detail: "low",
                        })),
                    ],
                },
            ],
            text: {
                format: {
                    type: "json_schema",
                    name: "onoprop_property_image_review",
                    strict: true,
                    schema: PROPERTY_IMAGE_REVIEW_SCHEMA,
                },
            },
        }),
        signal: AbortSignal.timeout(60000),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        const error = new Error("OpenAI rechazó la revisión visual.");
        error.status = response.status;
        error.requestId = response.headers.get("x-request-id") || "";
        error.type = data?.error?.type || "";
        throw error;
    }

    const outputText = extractResponseOutputText(data);
    if (!outputText) throw new Error("La IA no devolvió un análisis visual.");

    let parsed;
    try {
        parsed = JSON.parse(outputText);
    } catch {
        throw new Error("La IA devolvió un análisis visual con formato inválido.");
    }

    return {
        result: sanitizePropertyImageReviewResponse(
            parsed,
            imageUrls.length,
        ),
        usage: data.usage || {},
        model,
    };
};

const toHttpsError = (error) => {
    if (error instanceof HttpsError) return error;

    if (error?.name === "TimeoutError" || error?.name === "AbortError") {
        return new HttpsError(
            "deadline-exceeded",
            "La asistencia demoró demasiado. Volvé a intentarlo.",
        );
    }

    if (error?.status === 429) {
        return new HttpsError(
            "resource-exhausted",
            "El asistente está temporalmente ocupado. Volvé a intentarlo en unos minutos.",
        );
    }

    if (error?.status === 401 || error?.status === 403) {
        return new HttpsError(
            "failed-precondition",
            "La asistencia con IA todavía no está disponible. Avisá a ONO Prop.",
        );
    }

    if (Number(error?.status || 0) >= 500) {
        return new HttpsError(
            "unavailable",
            "El servicio de IA no está disponible en este momento.",
        );
    }

    return new HttpsError(
        "internal",
        "No pudimos completar la asistencia con IA. Podés continuar manualmente.",
    );
};

export const inmueblePrepareAiDraft = onCall({
    region: REGION,
    secrets: OPENAI_SECRET_BINDINGS,
    timeoutSeconds: 60,
    memory: "256MiB",
    maxInstances: 10,
}, async (request) => {
    const uid = request.auth?.uid || "";
    if (!uid) {
        throw new HttpsError(
            "unauthenticated",
            "Tenés que iniciar sesión para usar la carga asistida.",
        );
    }

    const sourceText = typeof request.data?.sourceText === "string" ?
        request.data.sourceText.trim() : "";
    const inmobiliariaId = cleanId(request.data?.inmobiliariaId);

    if (sourceText.length < MIN_SOURCE_LENGTH) {
        throw new HttpsError(
            "invalid-argument",
            "Contanos un poco más sobre el inmueble antes de preparar el borrador.",
        );
    }

    if (sourceText.length > MAX_SOURCE_LENGTH) {
        throw new HttpsError(
            "invalid-argument",
            `La descripción no puede superar ${MAX_SOURCE_LENGTH} caracteres.`,
        );
    }

    if (!OPENAI_PROPERTY_DRAFT_ENABLED || !OPENAI_API_KEY) {
        throw new HttpsError(
            "failed-precondition",
            "La carga asistida todavía no está habilitada.",
        );
    }

    const access = await assertCanPrepareDraft(uid, inmobiliariaId);
    const apiKey = OPENAI_API_KEY.value().trim();

    if (!apiKey) {
        throw new HttpsError(
            "failed-precondition",
            "La carga asistida todavía no está configurada.",
        );
    }

    const quota = await reserveDailyAttempt({
        uid,
        isRoot: access.isRoot,
        agencyMode: access.agencyMode,
    });
    const eventRef = db.collection(EVENT_COLLECTION).doc();
    const startedAt = Date.now();
    const dayKey = getArgentinaDayKey();

    try {
        await eventRef.set({
            actorHash: buildSafetyIdentifier(uid),
            inmobiliariaId,
            mode: access.agencyMode ? "agency" : "particular",
            operationType: "draft",
            dayKey,
            status: "processing",
            sourceLength: sourceText.length,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        });

        const {result, usage, model} = await callOpenAi({
            apiKey,
            sourceText: redactPrivateContactDetails(sourceText),
            uid,
        });
        const inputTokens = Number(usage.input_tokens || 0);
        const outputTokens = Number(usage.output_tokens || 0);
        const latencyMs = Date.now() - startedAt;
        const batch = db.batch();

        batch.set(quota.usageRef, {
            successes: FieldValue.increment(1),
            inputTokens: FieldValue.increment(inputTokens),
            outputTokens: FieldValue.increment(outputTokens),
            latencyTotalMs: FieldValue.increment(latencyMs),
            lastModel: model,
            lastSuccessAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        }, {merge: true});
        batch.set(eventRef, {
            status: "success",
            model,
            inputTokens,
            outputTokens,
            totalTokens: inputTokens + outputTokens,
            latencyMs,
            detectedFieldCount: Array.isArray(result.detectedFields) ?
                result.detectedFields.length : 0,
            missingFieldCount: Array.isArray(result.missingFields) ?
                result.missingFields.length : 0,
            warningCount: Array.isArray(result.warnings) ?
                result.warnings.length : 0,
            completedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        }, {merge: true});
        await batch.commit();

        return {
            ...result,
            generationId: eventRef.id,
            quota: {
                dailyLimit: quota.dailyLimit,
                remainingAttempts: quota.remainingAttempts,
            },
        };
    } catch (error) {
        const latencyMs = Date.now() - startedAt;
        const failureType = cleanId(error?.type || error?.name || "unknown", 80);
        const failureStatus = cleanId(error?.status?.toString() || "", 20);
        const batch = db.batch();
        batch.set(quota.usageRef, {
            failures: FieldValue.increment(1),
            latencyTotalMs: FieldValue.increment(latencyMs),
            lastFailureAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        }, {merge: true});
        batch.set(eventRef, {
            actorHash: buildSafetyIdentifier(uid),
            inmobiliariaId,
            mode: access.agencyMode ? "agency" : "particular",
            operationType: "draft",
            dayKey,
            status: "failure",
            sourceLength: sourceText.length,
            latencyMs,
            failureType,
            failureStatus,
            completedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        }, {merge: true});
        await batch.commit().catch((telemetryError) => {
            console.warn("No se pudo registrar la telemetría de IA", {
                message: telemetryError?.message || "",
            });
        });

        console.error("Error preparando borrador inmobiliario con IA", {
            uid,
            inmobiliariaId,
            status: error?.status || null,
            type: error?.type || "",
            requestId: error?.requestId || "",
            message: error?.message || "",
        });
        throw toHttpsError(error);
    }
});

export const inmuebleReviewAiPublication = onCall({
    region: REGION,
    secrets: OPENAI_SECRET_BINDINGS,
    timeoutSeconds: 60,
    memory: "256MiB",
    maxInstances: 10,
}, async (request) => {
    const uid = request.auth?.uid || "";
    if (!uid) {
        throw new HttpsError(
            "unauthenticated",
            "Tenés que iniciar sesión para revisar la publicación.",
        );
    }

    const inmobiliariaId = cleanId(request.data?.inmobiliariaId);
    const property = sanitizePropertyReviewInput(request.data?.property || {});
    const meaningfulFields = [
        property.titulo,
        property.descripcion,
        property.tipo,
        property.operacion,
        property.precio,
    ].filter(Boolean).length;

    if (meaningfulFields < 2) {
        throw new HttpsError(
            "invalid-argument",
            "Completá al menos dos datos principales antes de revisar la publicación.",
        );
    }

    if (!OPENAI_PROPERTY_DRAFT_ENABLED || !OPENAI_API_KEY) {
        throw new HttpsError(
            "failed-precondition",
            "La revisión asistida todavía no está habilitada.",
        );
    }

    const access = await assertCanPrepareDraft(uid, inmobiliariaId);
    const apiKey = OPENAI_API_KEY.value().trim();
    if (!apiKey) {
        throw new HttpsError(
            "failed-precondition",
            "La revisión asistida todavía no está configurada.",
        );
    }

    const quota = await reserveDailyAttempt({
        uid,
        isRoot: access.isRoot,
        agencyMode: access.agencyMode,
    });
    const eventRef = db.collection(EVENT_COLLECTION).doc();
    const startedAt = Date.now();
    const dayKey = getArgentinaDayKey();
    const sourceLength = JSON.stringify(property).length;

    try {
        await eventRef.set({
            actorHash: buildSafetyIdentifier(uid),
            inmobiliariaId,
            mode: access.agencyMode ? "agency" : "particular",
            operationType: "review",
            dayKey,
            status: "processing",
            sourceLength,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        });

        const {result, usage, model} = await callOpenAiReview({
            apiKey,
            property,
            uid,
        });
        const inputTokens = Number(usage.input_tokens || 0);
        const outputTokens = Number(usage.output_tokens || 0);
        const latencyMs = Date.now() - startedAt;
        const issueCount = result.review.issues.length;
        const missingFieldCount = result.review.missingFields.length;
        const contradictionCount = result.review.contradictions.length;
        const batch = db.batch();

        batch.set(quota.usageRef, {
            successes: FieldValue.increment(1),
            inputTokens: FieldValue.increment(inputTokens),
            outputTokens: FieldValue.increment(outputTokens),
            latencyTotalMs: FieldValue.increment(latencyMs),
            lastModel: model,
            lastSuccessAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        }, {merge: true});
        batch.set(eventRef, {
            status: "success",
            model,
            inputTokens,
            outputTokens,
            totalTokens: inputTokens + outputTokens,
            latencyMs,
            reviewScore: result.review.score,
            reviewReadiness: result.review.readiness,
            issueCount,
            missingFieldCount,
            contradictionCount,
            completedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        }, {merge: true});
        await batch.commit();

        return {
            ...result,
            generationId: eventRef.id,
            quota: {
                dailyLimit: quota.dailyLimit,
                remainingAttempts: quota.remainingAttempts,
            },
        };
    } catch (error) {
        const latencyMs = Date.now() - startedAt;
        const failureType = cleanId(error?.type || error?.name || "unknown", 80);
        const failureStatus = cleanId(error?.status?.toString() || "", 20);
        const batch = db.batch();
        batch.set(quota.usageRef, {
            failures: FieldValue.increment(1),
            latencyTotalMs: FieldValue.increment(latencyMs),
            lastFailureAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        }, {merge: true});
        batch.set(eventRef, {
            actorHash: buildSafetyIdentifier(uid),
            inmobiliariaId,
            mode: access.agencyMode ? "agency" : "particular",
            operationType: "review",
            dayKey,
            status: "failure",
            sourceLength,
            latencyMs,
            failureType,
            failureStatus,
            completedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        }, {merge: true});
        await batch.commit().catch((telemetryError) => {
            console.warn("No se pudo registrar la telemetría de revisión IA", {
                message: telemetryError?.message || "",
            });
        });

        console.error("Error revisando publicación inmobiliaria con IA", {
            uid,
            inmobiliariaId,
            status: error?.status || null,
            type: error?.type || "",
            requestId: error?.requestId || "",
            message: error?.message || "",
        });
        throw toHttpsError(error);
    }
});

export const inmuebleReviewAiImages = onCall({
    region: REGION,
    secrets: OPENAI_SECRET_BINDINGS,
    timeoutSeconds: 90,
    memory: "256MiB",
    maxInstances: 5,
}, async (request) => {
    const uid = request.auth?.uid || "";
    if (!uid) {
        throw new HttpsError(
            "unauthenticated",
            "Tenés que iniciar sesión para analizar las fotos.",
        );
    }

    const inmobiliariaId = cleanId(request.data?.inmobiliariaId);
    const imageUrls = sanitizePropertyImageUrls(request.data?.images);
    if (imageUrls.length < 2) {
        throw new HttpsError(
            "invalid-argument",
            "Cargá al menos dos imágenes públicas para revisar la galería.",
        );
    }
    if (!OPENAI_PROPERTY_DRAFT_ENABLED || !OPENAI_API_KEY) {
        throw new HttpsError(
            "failed-precondition",
            "La revisión visual todavía no está habilitada.",
        );
    }

    const access = await assertCanPrepareDraft(uid, inmobiliariaId);
    const apiKey = OPENAI_API_KEY.value().trim();
    if (!apiKey) {
        throw new HttpsError(
            "failed-precondition",
            "La revisión visual todavía no está configurada.",
        );
    }

    const property = sanitizePropertyReviewInput(request.data?.property || {});
    const quota = await reserveDailyVisionAttempt({
        uid,
        isRoot: access.isRoot,
        agencyMode: access.agencyMode,
    });
    const eventRef = db.collection(EVENT_COLLECTION).doc();
    const startedAt = Date.now();
    const dayKey = getArgentinaDayKey();

    try {
        await eventRef.set({
            actorHash: buildSafetyIdentifier(uid),
            inmobiliariaId,
            mode: access.agencyMode ? "agency" : "particular",
            operationType: "image_review",
            dayKey,
            status: "processing",
            imageCount: imageUrls.length,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        });

        const {result, usage, model} = await callOpenAiImageReview({
            apiKey,
            property,
            imageUrls,
            uid,
        });
        const inputTokens = Number(usage.input_tokens || 0);
        const outputTokens = Number(usage.output_tokens || 0);
        const latencyMs = Date.now() - startedAt;
        const privacyRiskCount = result.photos.reduce(
            (total, photo) => total + photo.privacyRisks.length,
            0,
        );
        const batch = db.batch();
        batch.set(quota.usageRef, {
            successes: FieldValue.increment(1),
            inputTokens: FieldValue.increment(inputTokens),
            outputTokens: FieldValue.increment(outputTokens),
            latencyTotalMs: FieldValue.increment(latencyMs),
            lastModel: model,
            lastSuccessAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        }, {merge: true});
        batch.set(eventRef, {
            status: "success",
            model,
            inputTokens,
            outputTokens,
            totalTokens: inputTokens + outputTokens,
            latencyMs,
            analyzedImageCount: imageUrls.length,
            privacyRiskCount,
            coverageGapCount: result.coverageGaps.length,
            completedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        }, {merge: true});
        await batch.commit();

        return {
            ...result,
            generationId: eventRef.id,
            analyzedImageCount: imageUrls.length,
            quota: {
                dailyLimit: quota.dailyLimit,
                remainingAttempts: quota.remainingAttempts,
            },
        };
    } catch (error) {
        const latencyMs = Date.now() - startedAt;
        const failureType = cleanId(error?.type || error?.name || "unknown", 80);
        const failureStatus = cleanId(error?.status?.toString() || "", 20);
        const batch = db.batch();
        batch.set(quota.usageRef, {
            failures: FieldValue.increment(1),
            latencyTotalMs: FieldValue.increment(latencyMs),
            lastFailureAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        }, {merge: true});
        batch.set(eventRef, {
            actorHash: buildSafetyIdentifier(uid),
            inmobiliariaId,
            mode: access.agencyMode ? "agency" : "particular",
            operationType: "image_review",
            dayKey,
            status: "failure",
            imageCount: imageUrls.length,
            latencyMs,
            failureType,
            failureStatus,
            completedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        }, {merge: true});
        await batch.commit().catch((telemetryError) => {
            console.warn("No se pudo registrar la revisión visual IA", {
                message: telemetryError?.message || "",
            });
        });
        console.error("Error revisando imágenes inmobiliarias con IA", {
            uid,
            inmobiliariaId,
            imageCount: imageUrls.length,
            status: error?.status || null,
            type: error?.type || "",
            requestId: error?.requestId || "",
            message: error?.message || "",
        });
        throw toHttpsError(error);
    }
});

const clampOutcomeCount = (value) => {
    const numeric = Math.round(Number(value || 0));
    return Number.isFinite(numeric) ? Math.max(0, Math.min(200, numeric)) : 0;
};

export const inmuebleRecordAiDraftOutcome = onCall({
    region: REGION,
    timeoutSeconds: 30,
}, async (request) => {
    const uid = request.auth?.uid || "";
    await getUserProfile(uid);

    const generationId = cleanId(request.data?.generationId);
    const rating = cleanId(request.data?.rating, 40);
    const applied = request.data?.applied === true;

    if (!generationId) {
        throw new HttpsError("invalid-argument", "Falta identificar el borrador.");
    }
    if (rating && !["useful", "needs_improvement"].includes(rating)) {
        throw new HttpsError("invalid-argument", "La valoración no es válida.");
    }
    if (!applied && !rating) {
        throw new HttpsError("invalid-argument", "No hay un resultado para registrar.");
    }

    const eventRef = db.collection(EVENT_COLLECTION).doc(generationId);
    const eventSnap = await eventRef.get();
    const eventData = eventSnap.data() || {};
    const ownsEvent = eventData.actorHash === buildSafetyIdentifier(uid) ||
        eventData.uid === uid;
    if (!eventSnap.exists || !ownsEvent) {
        throw new HttpsError(
            "permission-denied",
            "No podés actualizar el resultado de este borrador.",
        );
    }
    if (eventSnap.data()?.status !== "success") {
        throw new HttpsError(
            "failed-precondition",
            "El borrador todavía no tiene un resultado válido.",
        );
    }

    const update = {updatedAt: FieldValue.serverTimestamp()};
    if (applied) {
        update.applied = true;
        update.appliedFieldCount = clampOutcomeCount(
            request.data?.appliedFieldCount,
        );
        update.preservedFieldCount = clampOutcomeCount(
            request.data?.preservedFieldCount,
        );
        update.appliedAt = FieldValue.serverTimestamp();
    }
    if (rating) {
        update.feedback = rating;
        update.feedbackAt = FieldValue.serverTimestamp();
    }

    await eventRef.set(update, {merge: true});
    return {ok: true};
});

export const inmuebleGetAiDraftDashboard = onCall({
    region: REGION,
    timeoutSeconds: 60,
}, async (request) => {
    await assertRoot(request.auth?.uid);

    const today = getArgentinaDayKey();
    const defaultFrom = getArgentinaDayKey(
        new Date(Date.now() - (29 * 86400000)),
    );
    const dateFrom = normalizeAiAnalyticsDateKey(request.data?.dateFrom) ||
        defaultFrom;
    const dateTo = normalizeAiAnalyticsDateKey(request.data?.dateTo) || today;
    const rangeDays = getAiAnalyticsRangeDays(dateFrom, dateTo);

    if (rangeDays <= 0 || rangeDays > MAX_DASHBOARD_DAYS) {
        throw new HttpsError(
            "invalid-argument",
            `Elegí un período de entre 1 y ${MAX_DASHBOARD_DAYS} días.`,
        );
    }

    const snapshot = await db.collection(EVENT_COLLECTION)
        .where("dayKey", ">=", dateFrom)
        .where("dayKey", "<=", dateTo)
        .orderBy("dayKey", "asc")
        .limit(MAX_DASHBOARD_EVENTS + 1)
        .get();
    const truncated = snapshot.size > MAX_DASHBOARD_EVENTS;
    const events = snapshot.docs
        .slice(0, MAX_DASHBOARD_EVENTS)
        .map((item) => item.data() || {});
    const analytics = aggregateAiDraftEvents(events);
    const agencyIds = analytics.agencies
        .map((item) => item.inmobiliariaId)
        .filter((id) => id && id !== "particular");
    const agencySnapshots = agencyIds.length > 0 ? await db.getAll(
        ...agencyIds.map((id) => db.collection("inmobiliarias").doc(id)),
    ) : [];
    const agencyNames = new Map(agencySnapshots.map((item) => [
        item.id,
        cleanId(
            item.data()?.nombre || item.data()?.name ||
            item.data()?.razonSocial || item.id,
            160,
        ),
    ]));

    return {
        dateFrom,
        dateTo,
        truncated,
        ...analytics,
        agencies: analytics.agencies.map((item) => ({
            ...item,
            inmobiliariaNombre: item.inmobiliariaId === "particular" ?
                "Particulares / sin inmobiliaria" :
                agencyNames.get(item.inmobiliariaId) || item.inmobiliariaId,
        })),
    };
});

