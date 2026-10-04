import crypto from "node:crypto";
import process from "node:process";

import admin from "firebase-admin";
import {defineSecret} from "firebase-functions/params";
import {HttpsError, onCall} from "firebase-functions/v2/https";

import {
    buildPropertyDraftInstructions,
    extractResponseOutputText,
    PROPERTY_DRAFT_SCHEMA,
    redactPrivateContactDetails,
    sanitizePropertyDraftResponse,
} from "./inmuebleAi.helpers.js";

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
    const snap = await db.collection("users").doc(uid).get();
    if (!snap.exists) {
        throw new HttpsError(
            "permission-denied",
            "No encontramos tu perfil de usuario.",
        );
    }
    return snap.data() || {};
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

const getArgentinaDayKey = () => new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
}).format(new Date());

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
                "Alcanzaste el límite diario de borradores asistidos. Podés continuar la carga manualmente o volver a intentarlo mañana.",
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

const toHttpsError = (error) => {
    if (error instanceof HttpsError) return error;

    if (error?.name === "TimeoutError" || error?.name === "AbortError") {
        return new HttpsError(
            "deadline-exceeded",
            "La preparación demoró demasiado. Volvé a intentarlo.",
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
            "La carga asistida todavía no está disponible. Avisá a ONO Prop.",
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
        "No pudimos preparar el borrador. Podés continuar la carga manualmente.",
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

    try {
        const {result, usage, model} = await callOpenAi({
            apiKey,
            sourceText: redactPrivateContactDetails(sourceText),
            uid,
        });

        await quota.usageRef.set({
            successes: FieldValue.increment(1),
            inputTokens: FieldValue.increment(Number(usage.input_tokens || 0)),
            outputTokens: FieldValue.increment(Number(usage.output_tokens || 0)),
            lastModel: model,
            lastSuccessAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        }, {merge: true});

        return {
            ...result,
            quota: {
                dailyLimit: quota.dailyLimit,
                remainingAttempts: quota.remainingAttempts,
            },
        };
    } catch (error) {
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

