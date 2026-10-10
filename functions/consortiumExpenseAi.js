import crypto from "node:crypto";
import process from "node:process";
import {Buffer} from "node:buffer";

import admin from "firebase-admin";
import {defineSecret} from "firebase-functions/params";
import {HttpsError, onCall} from "firebase-functions/v2/https";

import {
    buildConsortiumExpenseDocumentInstructions,
    CONSORTIUM_EXPENSE_DOCUMENT_SCHEMA,
    sanitizeConsortiumExpenseDocumentResult,
} from "./consortiumExpenseAi.helpers.js";
import {extractResponseOutputText} from "./inmuebleAi.helpers.js";

if (!admin.apps.length) admin.initializeApp();

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;
const REGION = "southamerica-east1";
const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const DEFAULT_MODEL = "gpt-6-luna";
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const USAGE_COLLECTION = "ai_consortium_expense_usage";
const EVENT_COLLECTION = "ai_consortium_expense_events";
const ENABLED = /^(1|true|yes)$/i.test(String(
    process.env.OPENAI_CONSORTIUM_EXPENSE_ENABLED ||
    process.env.OPENAI_PROPERTY_DRAFT_ENABLED ||
    "",
).trim());
const OPENAI_API_KEY = ENABLED ? defineSecret("OPENAI_API_KEY") : null;
const OPENAI_SECRET_BINDINGS = ENABLED ? [OPENAI_API_KEY] : [];
const ALLOWED_TYPES = new Set([
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
]);

const cleanText = (value = "", maxLength = 220) => String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);

const normalizeRole = (value = "") => {
    const role = cleanText(value, 40).toLowerCase();
    return role === "user" ? "usuario" : role;
};

const userHasRole = (user = {}, role = "") => {
    const expected = normalizeRole(role);
    return normalizeRole(user.role) === expected ||
        normalizeRole(user.primaryRole) === expected ||
        (Array.isArray(user.roles) && user.roles.some(
            (item) => normalizeRole(item) === expected,
        ));
};

const assertCanManageConsortium = async ({uid, inmobiliariaId, consortiumId, periodId}) => {
    if (!uid) throw new HttpsError("unauthenticated", "Tenés que iniciar sesión.");
    if (!inmobiliariaId || !consortiumId || !periodId) {
        throw new HttpsError("invalid-argument", "Faltan datos de la liquidación.");
    }
    const [userSnap, agencySnap, consortiumSnap, periodSnap] = await Promise.all([
        db.collection("users").doc(uid).get(),
        db.collection("inmobiliarias").doc(inmobiliariaId).get(),
        db.collection("inmobiliarias").doc(inmobiliariaId)
            .collection("condominiums").doc(consortiumId).get(),
        db.collection("inmobiliarias").doc(inmobiliariaId)
            .collection("condominium_periods").doc(periodId).get(),
    ]);
    if (!userSnap.exists) throw new HttpsError("permission-denied", "Perfil de usuario no encontrado.");
    if (!agencySnap.exists || agencySnap.data()?.activa === false) {
        throw new HttpsError("failed-precondition", "La inmobiliaria no está activa.");
    }
    if (!consortiumSnap.exists || consortiumSnap.data()?.deleted === true) {
        throw new HttpsError("not-found", "El consorcio no existe.");
    }
    const period = periodSnap.data() || {};
    if (!periodSnap.exists || period.consortiumId !== consortiumId || period.deleted === true) {
        throw new HttpsError("not-found", "La liquidación no existe.");
    }
    if (period.status !== "draft") {
        throw new HttpsError(
            "failed-precondition",
            "La lectura asistida solo puede agregar gastos a un borrador.",
        );
    }

    const user = userSnap.data() || {};
    const isRoot = userHasRole(user, "root");
    const agencies = Array.isArray(user.inmobiliarias) ? user.inmobiliarias : [];
    const roles = user.inmobiliariaRoles && typeof user.inmobiliariaRoles === "object" ?
        user.inmobiliariaRoles : {};
    const agencyRole = normalizeRole(
        roles[inmobiliariaId] || (userHasRole(user, "admin") ? "admin" : ""),
    );
    if (!isRoot && (!agencies.includes(inmobiliariaId) || ![
        "admin", "editor",
    ].includes(agencyRole))) {
        throw new HttpsError(
            "permission-denied",
            "No tenés permisos para preparar gastos de este consorcio.",
        );
    }
    if (!isRoot && !Array.isArray(agencySnap.data()?.modulosSuscriptos)) {
        throw new HttpsError("failed-precondition", "La inmobiliaria no tiene módulos habilitados.");
    }
    if (!isRoot && !agencySnap.data().modulosSuscriptos.includes("consorcios")) {
        throw new HttpsError("failed-precondition", "El módulo de consorcios no está habilitado.");
    }

    return {
        isRoot,
        consortium: {id: consortiumSnap.id, ...(consortiumSnap.data() || {})},
        period: {id: periodSnap.id, ...period},
    };
};

const decodeFile = ({dataUrl, contentType}) => {
    if (!ALLOWED_TYPES.has(contentType)) {
        throw new HttpsError(
            "invalid-argument",
            "Solo se pueden analizar PDF, JPG, PNG o WEBP.",
        );
    }
    const match = /^data:([^;,]+);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl || "");
    if (!match || match[1].toLowerCase() !== contentType) {
        throw new HttpsError("invalid-argument", "El archivo no tiene un formato válido.");
    }
    const bytes = Buffer.from(match[2], "base64");
    if (!bytes.length || bytes.length > MAX_FILE_BYTES) {
        throw new HttpsError(
            "invalid-argument",
            "El archivo debe pesar entre 1 byte y 5 MB para usar la lectura asistida.",
        );
    }
    return bytes;
};

const getArgentinaDayKey = () => new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
}).format(new Date());

const reserveDailyAttempt = async ({uid, isRoot}) => {
    const dayKey = getArgentinaDayKey();
    const dailyLimit = isRoot ? 50 : 10;
    const ref = db.collection(USAGE_COLLECTION).doc(`${uid}_${dayKey}`);
    const attempts = await db.runTransaction(async (transaction) => {
        const snap = await transaction.get(ref);
        const current = Number(snap.data()?.attempts || 0);
        if (current >= dailyLimit) {
            throw new HttpsError(
                "resource-exhausted",
                "Alcanzaste el límite diario de comprobantes asistidos. Podés continuar la carga manualmente.",
            );
        }
        transaction.set(ref, {
            uid,
            dayKey,
            attempts: current + 1,
            successes: Number(snap.data()?.successes || 0),
            inputTokens: Number(snap.data()?.inputTokens || 0),
            outputTokens: Number(snap.data()?.outputTokens || 0),
            createdAt: snap.data()?.createdAt || FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        }, {merge: true});
        return current + 1;
    });
    return {
        ref,
        dailyLimit,
        remainingAttempts: Math.max(0, dailyLimit - attempts),
    };
};

const getModel = () => cleanText(
    process.env.OPENAI_CONSORTIUM_EXPENSE_MODEL ||
    process.env.OPENAI_PROPERTY_DRAFT_MODEL ||
    DEFAULT_MODEL,
    100,
) || DEFAULT_MODEL;

const safetyIdentifier = (uid) => crypto
    .createHash("sha256")
    .update(`onoprop-consortium-expense:${uid}`)
    .digest("hex");

const callOpenAi = async ({apiKey, uid, fileName, contentType, dataUrl, consortium}) => {
    const model = getModel();
    const fileContent = contentType === "application/pdf" ? {
        type: "input_file",
        filename: fileName,
        file_data: dataUrl,
        detail: "low",
    } : {
        type: "input_image",
        image_url: dataUrl,
        detail: "low",
    };
    const coefficientGroups = (Array.isArray(consortium.coefficientGroups) ?
        consortium.coefficientGroups : [])
        .filter((item) => item.active !== false)
        .map((item) => item.name || item.id)
        .filter(Boolean)
        .slice(0, 8);
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
            safety_identifier: safetyIdentifier(uid),
            max_output_tokens: 1800,
            input: [{
                role: "system",
                content: buildConsortiumExpenseDocumentInstructions(),
            }, {
                role: "user",
                content: [{
                    type: "input_text",
                    text: `Grupos de coeficientes disponibles: ${coefficientGroups.join(", ") || "general"}. Analizá el comprobante adjunto.`,
                }, fileContent],
            }],
            text: {
                format: {
                    type: "json_schema",
                    name: "onoprop_consortium_expense_document",
                    strict: true,
                    schema: CONSORTIUM_EXPENSE_DOCUMENT_SCHEMA,
                },
            },
        }),
        signal: AbortSignal.timeout(60000),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        const error = new Error("OpenAI rechazó la lectura del comprobante.");
        error.status = response.status;
        error.type = data?.error?.type || "";
        error.requestId = response.headers.get("x-request-id") || "";
        throw error;
    }
    const outputText = extractResponseOutputText(data);
    if (!outputText) throw new Error("La IA no devolvió datos utilizables.");
    let parsed;
    try {
        parsed = JSON.parse(outputText);
    } catch {
        throw new Error("La IA devolvió datos con un formato inválido.");
    }
    return {
        result: sanitizeConsortiumExpenseDocumentResult(parsed),
        usage: data.usage || {},
        model,
    };
};

const toHttpsError = (error) => {
    if (error instanceof HttpsError) return error;
    if (error?.name === "TimeoutError" || error?.name === "AbortError") {
        return new HttpsError("deadline-exceeded", "La lectura demoró demasiado. Volvé a intentarlo.");
    }
    if (error?.status === 429) {
        return new HttpsError("resource-exhausted", "La lectura asistida está ocupada. Reintentá en unos minutos.");
    }
    if ([401, 403].includes(error?.status)) {
        return new HttpsError("failed-precondition", "La lectura asistida todavía no está disponible.");
    }
    if (Number(error?.status || 0) >= 500) {
        return new HttpsError("unavailable", "El servicio de lectura no está disponible en este momento.");
    }
    return new HttpsError(
        "internal",
        "No pudimos leer el comprobante. Podés continuar con la carga manual.",
    );
};

export const consortiumAnalyzeExpenseDocument = onCall({
    region: REGION,
    secrets: OPENAI_SECRET_BINDINGS,
    timeoutSeconds: 90,
    memory: "512MiB",
    maxInstances: 5,
}, async (request) => {
    const uid = request.auth?.uid || "";
    const inmobiliariaId = cleanText(request.data?.inmobiliariaId, 128);
    const consortiumId = cleanText(request.data?.consortiumId, 128);
    const periodId = cleanText(request.data?.periodId, 160);
    const fileName = cleanText(request.data?.fileName, 220) || "comprobante";
    const contentType = cleanText(request.data?.contentType, 80).toLowerCase();
    const dataUrl = typeof request.data?.dataUrl === "string" ? request.data.dataUrl : "";

    if (!ENABLED || !OPENAI_API_KEY) {
        throw new HttpsError("failed-precondition", "La lectura asistida todavía no está habilitada.");
    }
    const access = await assertCanManageConsortium({
        uid,
        inmobiliariaId,
        consortiumId,
        periodId,
    });
    const bytes = decodeFile({dataUrl, contentType});
    const apiKey = OPENAI_API_KEY.value().trim();
    if (!apiKey) throw new HttpsError("failed-precondition", "La lectura asistida no está configurada.");

    const quota = await reserveDailyAttempt({uid, isRoot: access.isRoot});
    const eventRef = db.collection(EVENT_COLLECTION).doc();
    const startedAt = Date.now();
    const documentHash = crypto.createHash("sha256").update(bytes).digest("hex");
    try {
        const {result, usage, model} = await callOpenAi({
            apiKey,
            uid,
            fileName,
            contentType,
            dataUrl,
            consortium: access.consortium,
        });
        const inputTokens = Number(usage.input_tokens || 0);
        const outputTokens = Number(usage.output_tokens || 0);
        const latencyMs = Date.now() - startedAt;
        const batch = db.batch();
        batch.set(quota.ref, {
            successes: FieldValue.increment(1),
            inputTokens: FieldValue.increment(inputTokens),
            outputTokens: FieldValue.increment(outputTokens),
            latencyTotalMs: FieldValue.increment(latencyMs),
            lastModel: model,
            lastSuccessAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        }, {merge: true});
        batch.set(eventRef, {
            actorHash: safetyIdentifier(uid),
            inmobiliariaId,
            consortiumId,
            periodId,
            status: "success",
            contentType,
            fileSize: bytes.length,
            documentHash,
            model,
            inputTokens,
            outputTokens,
            latencyMs,
            confidence: result.confidence,
            warningCount: result.warnings.length,
            createdAt: FieldValue.serverTimestamp(),
            completedAt: FieldValue.serverTimestamp(),
        });
        await batch.commit();
        return {
            ...result,
            documentHash,
            generationId: eventRef.id,
            quota: {
                dailyLimit: quota.dailyLimit,
                remainingAttempts: quota.remainingAttempts,
            },
        };
    } catch (error) {
        const latencyMs = Date.now() - startedAt;
        await Promise.all([
            quota.ref.set({
                failures: FieldValue.increment(1),
                latencyTotalMs: FieldValue.increment(latencyMs),
                updatedAt: FieldValue.serverTimestamp(),
            }, {merge: true}),
            eventRef.set({
                actorHash: safetyIdentifier(uid),
                inmobiliariaId,
                consortiumId,
                periodId,
                status: "failure",
                contentType,
                fileSize: bytes.length,
                documentHash,
                failureType: cleanText(error?.type || error?.name || "unknown", 80),
                failureStatus: cleanText(error?.status, 20),
                latencyMs,
                createdAt: FieldValue.serverTimestamp(),
                completedAt: FieldValue.serverTimestamp(),
            }),
        ]).catch(() => {});
        console.error("Error leyendo comprobante de consorcio con IA", {
            uid,
            inmobiliariaId,
            consortiumId,
            periodId,
            status: error?.status || null,
            type: error?.type || "",
            requestId: error?.requestId || "",
            message: error?.message || "",
        });
        throw toHttpsError(error);
    }
});

