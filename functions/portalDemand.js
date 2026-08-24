import crypto from "node:crypto";
import { Buffer } from "node:buffer";

import admin from "firebase-admin";
import { HttpsError, onCall, onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";

import {
    buildPortalAlertSearchQuery,
    canonicalizePortalAlertFilters,
    escapePortalAlertHtml,
    getPortalItemDateMillis,
    hasMeaningfulPortalAlertFilters,
    isValidPortalAlertEmail,
    normalizePortalAlertEmail,
    normalizePortalAlertFilters,
    portalItemMatchesAlert,
} from "./portalDemand.helpers.js";

if (!admin.apps.length) admin.initializeApp();

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;
const REGION = "southamerica-east1";
const SITE_URL = "https://onoprop.com";
const FUNCTION_BASE_URL = `https://${REGION}-inmobiliaria-bcc63.cloudfunctions.net`;
const ALERT_COLLECTION = "portal_search_alerts";
const RATE_LIMIT_COLLECTION = "portal_search_alert_rate_limits";
const CONSENT_VERSION = "portal-alerts-2026-08-23-v1";
const MAX_REQUESTS_PER_DAY = 5;
const MAX_UNSUBSCRIBE_TOKEN_HASHES = 365;

const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const createToken = () => crypto.randomBytes(32).toString("base64url");

const timestampToMillis = (value) => {
    if (!value) return 0;
    if (typeof value.toMillis === "function") return value.toMillis();
    if (typeof value.toDate === "function") return value.toDate().getTime();

    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime()) ? parsed.getTime() : 0;
};

const safelyCompareToken = (providedToken, storedHash) => {
    if (!providedToken || !storedHash) return false;

    const providedHash = Buffer.from(sha256(providedToken), "hex");
    const expectedHash = Buffer.from(storedHash, "hex");

    return providedHash.length === expectedHash.length &&
        crypto.timingSafeEqual(providedHash, expectedHash);
};

const matchesUnsubscribeToken = (providedToken, alert = {}) => {
    const hashes = Array.isArray(alert.unsubscribeTokenHashes)
        ? alert.unsubscribeTokenHashes
        : [alert.unsubscribeTokenHash].filter(Boolean);

    return hashes.some((storedHash) => safelyCompareToken(providedToken, storedHash));
};

const getRequestIp = (request) => {
    const forwarded = request.rawRequest?.headers?.["x-forwarded-for"];

    if (typeof forwarded === "string" && forwarded) {
        return forwarded.split(",")[0].trim();
    }

    return request.rawRequest?.ip || "unknown";
};

const consumeRateLimit = async ({ email, ip }) => {
    const dayKey = new Date().toISOString().slice(0, 10);
    const rateId = sha256(`${dayKey}:${email}:${ip}`).slice(0, 48);
    const rateRef = db.collection(RATE_LIMIT_COLLECTION).doc(rateId);

    await db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(rateRef);
        const count = Number(snapshot.data()?.count || 0);

        if (count >= MAX_REQUESTS_PER_DAY) {
            throw new HttpsError(
                "resource-exhausted",
                "Alcanzaste el límite diario de búsquedas guardadas. Intentá mañana.",
            );
        }

        transaction.set(rateRef, {
            dayKey,
            emailHash: sha256(email),
            count: count + 1,
            updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
    });
};

const buildConfirmationMail = ({ alertId, email, confirmationToken }) => {
    const confirmationUrl = `${FUNCTION_BASE_URL}/portalSearchAlertConfirm?` +
        new URLSearchParams({ id: alertId, token: confirmationToken }).toString();
    const safeUrl = escapePortalAlertHtml(confirmationUrl);

    return {
        to: [email],
        message: {
            subject: "Confirmá tu búsqueda guardada en ONO Prop",
            text: [
                "Recibimos tu solicitud para guardar una búsqueda de inmuebles.",
                "",
                `Confirmala desde este enlace: ${confirmationUrl}`,
                "",
                "Si no hiciste esta solicitud, podés ignorar este mensaje.",
            ].join("\n"),
            html: `
              <div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;color:#172033">
                <h2 style="color:#1f5fbf">Confirmá tu búsqueda guardada</h2>
                <p>Recibimos tu solicitud para recibir novedades de inmuebles que coincidan con tu búsqueda.</p>
                <p style="margin:28px 0">
                  <a href="${safeUrl}" style="background:#1f5fbf;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;display:inline-block">
                    Confirmar búsqueda
                  </a>
                </p>
                <p style="font-size:13px;color:#64748b">El enlace vence en 7 días. Si no hiciste esta solicitud, ignorá este mensaje.</p>
              </div>
            `,
        },
        source: "portal_search_alert_confirmation",
        alertId,
        createdAt: FieldValue.serverTimestamp(),
    };
};

export const portalSaveSearchAlert = onCall(
    {
        region: REGION,
        invoker: "public",
        enforceAppCheck: true,
        timeoutSeconds: 60,
    },
    async (request) => {
        const payload = request.data && typeof request.data === "object"
            ? request.data
            : {};
        const email = normalizePortalAlertEmail(payload.email);
        const filters = normalizePortalAlertFilters(payload.filters);
        const frequency = payload.frequency === "weekly" ? "weekly" : "daily";

        if (payload.honeypot) {
            return { ok: true, confirmationRequired: true };
        }

        if (!isValidPortalAlertEmail(email)) {
            throw new HttpsError("invalid-argument", "Ingresá un email válido.");
        }

        if (payload.consentAccepted !== true) {
            throw new HttpsError(
                "failed-precondition",
                "Necesitamos tu consentimiento para enviarte alertas por email.",
            );
        }

        if (!hasMeaningfulPortalAlertFilters(filters)) {
            throw new HttpsError(
                "invalid-argument",
                "Elegí al menos un criterio antes de guardar la búsqueda.",
            );
        }

        await consumeRateLimit({ email, ip: getRequestIp(request) });

        const filterSignature = canonicalizePortalAlertFilters(filters);
        const alertId = sha256(`${email}:${filterSignature}`).slice(0, 48);
        const alertRef = db.collection(ALERT_COLLECTION).doc(alertId);
        const existing = await alertRef.get();

        if (existing.exists && existing.data()?.status === "active") {
            await alertRef.set({
                frequency,
                filters,
                updatedAt: FieldValue.serverTimestamp(),
            }, { merge: true });

            return { ok: true, alreadyActive: true, confirmationRequired: false };
        }

        const confirmationToken = createToken();
        const now = Date.now();

        await alertRef.set({
            email,
            emailHash: sha256(email),
            filters,
            filterSignature,
            frequency,
            status: "pending_confirmation",
            confirmationTokenHash: sha256(confirmationToken),
            confirmationExpiresAt: admin.firestore.Timestamp.fromMillis(
                now + (7 * 24 * 60 * 60 * 1000),
            ),
            unsubscribeTokenHashes: [],
            consent: {
                accepted: true,
                version: CONSENT_VERSION,
                acceptedAt: FieldValue.serverTimestamp(),
            },
            createdAt: existing.exists
                ? existing.data()?.createdAt || FieldValue.serverTimestamp()
                : FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });

        await db.collection("mail").add(buildConfirmationMail({
            alertId,
            email,
            confirmationToken,
        }));

        return { ok: true, confirmationRequired: true };
    },
);

const redirectWithAlertStatus = (response, status, filters = {}) => {
    const params = new URLSearchParams(buildPortalAlertSearchQuery(filters));
    params.set("alerta", status);
    response.set("Cache-Control", "no-store");
    response.set("X-Robots-Tag", "noindex, nofollow");
    response.redirect(302, `${SITE_URL}/inmuebles?${params.toString()}`);
};

export const portalSearchAlertConfirm = onRequest(
    { region: REGION, invoker: "public", timeoutSeconds: 30 },
    async (request, response) => {
        const alertId = request.query.id?.toString() || "";
        const token = request.query.token?.toString() || "";

        if (!/^[a-f0-9]{48}$/.test(alertId) || !token) {
            redirectWithAlertStatus(response, "invalida");
            return;
        }

        const alertRef = db.collection(ALERT_COLLECTION).doc(alertId);
        const snapshot = await alertRef.get();
        const alert = snapshot.data();

        if (!snapshot.exists || alert?.status !== "pending_confirmation") {
            redirectWithAlertStatus(
                response,
                alert?.status === "active" ? "confirmada" : "invalida",
                alert?.filters,
            );
            return;
        }

        if (
            timestampToMillis(alert.confirmationExpiresAt) < Date.now() ||
            !safelyCompareToken(token, alert.confirmationTokenHash)
        ) {
            redirectWithAlertStatus(response, "vencida", alert.filters);
            return;
        }

        await alertRef.update({
            status: "active",
            confirmedAt: FieldValue.serverTimestamp(),
            lastCheckedAt: FieldValue.serverTimestamp(),
            confirmationTokenHash: FieldValue.delete(),
            confirmationExpiresAt: FieldValue.delete(),
            updatedAt: FieldValue.serverTimestamp(),
        });

        redirectWithAlertStatus(response, "confirmada", alert.filters);
    },
);

export const portalSearchAlertUnsubscribe = onRequest(
    { region: REGION, invoker: "public", timeoutSeconds: 30 },
    async (request, response) => {
        const alertId = request.query.id?.toString() || "";
        const token = request.query.token?.toString() || "";

        if (!/^[a-f0-9]{48}$/.test(alertId) || !token) {
            redirectWithAlertStatus(response, "baja-invalida", alert?.filters);
            return;
        }

        const alertRef = db.collection(ALERT_COLLECTION).doc(alertId);
        const snapshot = await alertRef.get();
        const alert = snapshot.data();

        if (!snapshot.exists || !matchesUnsubscribeToken(token, alert)) {
            redirectWithAlertStatus(response, "baja-invalida");
            return;
        }

        await alertRef.update({
            status: "unsubscribed",
            unsubscribedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        });

        redirectWithAlertStatus(response, "cancelada", alert.filters);
    },
);

const mapAgencyAlertItem = (snapshot) => {
    const data = snapshot.data();
    const id = snapshot.id;
    const parentInmobiliariaId = snapshot.ref.parent.parent?.id || "";

    return {
        id,
        ...data,
        inmobiliariaId: data.inmobiliariaId || parentInmobiliariaId,
        sourceType: "inmobiliaria",
        publicPath: `/inmueble/${data.slug || id}`,
    };
};

const mapParticularAlertItem = (snapshot) => {
    const data = snapshot.data();

    return {
        id: snapshot.id,
        ...data,
        sourceType: "particular",
        precio: data.precio || data.precioEstimado || "",
        publicPath: `/particulares/${snapshot.id}`,
    };
};

const getPublicAlertInventory = async () => {
    const [agencySnap, particularSnap] = await Promise.all([
        db.collectionGroup("inmuebles")
            .where("deleted", "==", false)
            .where("estado", "==", "activo")
            .where("publicarEnPortal", "==", true)
            .get(),
        db.collection("particular_publications")
            .where("publicationType", "==", "particular")
            .where("publicStatus", "==", "active")
            .where("moderationStatus", "==", "approved")
            .get(),
    ]);

    return [
        ...agencySnap.docs.map(mapAgencyAlertItem),
        ...particularSnap.docs.map(mapParticularAlertItem),
    ];
};

const formatAlertPrice = (item = {}) => {
    const rawPrice = item.precio || item.precioEstimado;
    const price = Number(rawPrice);

    if (!Number.isFinite(price) || price <= 0) return "Consultar precio";
    return `${item.moneda || "USD"} ${price.toLocaleString("es-AR")}`;
};

const buildAlertResultsMail = ({ alertId, alert, matches }) => {
    const searchQuery = buildPortalAlertSearchQuery(alert.filters);
    const searchUrl = `${SITE_URL}/inmuebles${searchQuery ? `?${searchQuery}` : ""}`;
    const unsubscribeUrl = `${FUNCTION_BASE_URL}/portalSearchAlertUnsubscribe?` +
        new URLSearchParams({ id: alertId, token: alert.unsubscribeToken }).toString();
    const visibleMatches = matches.slice(0, 10);
    const resultLines = visibleMatches.map((item) => (
        `- ${item.titulo || item.ubicacion || "Inmueble publicado"}: ` +
        `${formatAlertPrice(item)} (${SITE_URL}${item.publicPath})`
    ));
    const resultCards = visibleMatches.map((item) => {
        const title = escapePortalAlertHtml(
            item.titulo || item.ubicacion || "Inmueble publicado",
        );
        const price = escapePortalAlertHtml(formatAlertPrice(item));
        const url = escapePortalAlertHtml(`${SITE_URL}${item.publicPath}`);

        return `<li style="margin-bottom:14px"><a href="${url}" style="color:#1f5fbf;font-weight:700">${title}</a><br><span style="color:#475569">${price}</span></li>`;
    }).join("");

    return {
        to: [alert.email],
        message: {
            subject: `${matches.length} ${matches.length === 1 ? "nueva coincidencia" : "nuevas coincidencias"} en ONO Prop`,
            text: [
                "Encontramos nuevas publicaciones para tu búsqueda guardada:",
                "",
                ...resultLines,
                "",
                `Ver la búsqueda: ${searchUrl}`,
                `Dejar de recibir esta alerta: ${unsubscribeUrl}`,
            ].join("\n"),
            html: `
              <div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;color:#172033">
                <h2 style="color:#1f5fbf">Nuevas coincidencias en ONO Prop</h2>
                <p>Encontramos ${matches.length} ${matches.length === 1 ? "publicación nueva" : "publicaciones nuevas"} para tu búsqueda.</p>
                <ul style="padding-left:20px">${resultCards}</ul>
                <p><a href="${escapePortalAlertHtml(searchUrl)}" style="background:#1f5fbf;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;display:inline-block">Ver búsqueda completa</a></p>
                <p style="font-size:12px;color:#64748b;margin-top:30px"><a href="${escapePortalAlertHtml(unsubscribeUrl)}" style="color:#64748b">Dejar de recibir esta alerta</a></p>
              </div>
            `,
        },
        source: "portal_search_alert_results",
        alertId,
        createdAt: FieldValue.serverTimestamp(),
    };
};

const runPortalSearchAlerts = async () => {
    const now = new Date();
    const isMonday = now.getDay() === 1;
    const alertsSnap = await db.collection(ALERT_COLLECTION)
        .where("status", "==", "active")
        .get();
    const dueAlerts = alertsSnap.docs.filter((snapshot) => (
        snapshot.data()?.frequency !== "weekly" || isMonday
    ));

    if (dueAlerts.length === 0) return { alerts: 0, emails: 0, inventory: 0 };

    const scanStartedAt = admin.firestore.Timestamp.now();
    const scanStartedAtMillis = scanStartedAt.toMillis();
    const inventory = await getPublicAlertInventory();
    let emails = 0;

    for (const alertSnapshot of dueAlerts) {
        const alert = alertSnapshot.data();
        const sinceMillis = timestampToMillis(
            alert.lastCheckedAt || alert.confirmedAt || alert.createdAt,
        );
        const matches = inventory.filter((item) => {
            const itemDateMillis = getPortalItemDateMillis(item);

            return itemDateMillis > sinceMillis &&
                itemDateMillis <= scanStartedAtMillis &&
                portalItemMatchesAlert(item, alert.filters);
        });

        if (matches.length > 0) {
            const unsubscribeToken = createToken();
            const previousTokenHashes = Array.isArray(alert.unsubscribeTokenHashes)
                ? alert.unsubscribeTokenHashes
                : [alert.unsubscribeTokenHash].filter(Boolean);
            const unsubscribeTokenHashes = [
                sha256(unsubscribeToken),
                ...previousTokenHashes,
            ].slice(0, MAX_UNSUBSCRIBE_TOKEN_HASHES);
            const mailRef = db.collection("mail").doc();
            const batch = db.batch();

            batch.update(alertSnapshot.ref, {
                unsubscribeTokenHashes,
                unsubscribeTokenHash: FieldValue.delete(),
                unsubscribeToken: FieldValue.delete(),
                lastCheckedAt: scanStartedAt,
                lastNotifiedAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
            });
            batch.set(mailRef, buildAlertResultsMail({
                alertId: alertSnapshot.id,
                alert: { ...alert, unsubscribeToken },
                matches,
            }));
            await batch.commit();
            emails += 1;
        } else {
            await alertSnapshot.ref.update({
                lastCheckedAt: scanStartedAt,
                updatedAt: FieldValue.serverTimestamp(),
            });
        }
    }

    return { alerts: dueAlerts.length, emails, inventory: inventory.length };
};

export const portalProcessSearchAlerts = onSchedule(
    {
        region: REGION,
        schedule: "every day 10:20",
        timeZone: "America/Argentina/Buenos_Aires",
        timeoutSeconds: 540,
    },
    runPortalSearchAlerts,
);
