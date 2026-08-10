import crypto from "node:crypto";

import admin from "firebase-admin";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";

import {
    addDaysToDateKey,
    buildTaxDueAlert,
    dateKeyInTimeZone,
    DEFAULT_TAX_NOTIFICATION_SETTINGS,
    formatTaxNotificationAmount,
    normalizeTaxNotificationSettings,
    TAX_TIME_ZONE,
} from "./tax.helpers.js";

if (!admin.apps.length) admin.initializeApp();

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;
const FieldPath = admin.firestore.FieldPath;
const REGION = "southamerica-east1";
const AGENCY_PAGE_SIZE = 150;
const OBLIGATION_LIMIT = 1000;
const MAX_REMINDER_DAYS = 365;

const cleanText = (value = "", maxLength = 500) => (
    value?.toString?.().trim().replace(/\s+/g, " ").slice(0, maxLength) || ""
);
const escapeHtml = (value = "") => cleanText(value, 2000)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const userHasRole = (userData = {}, roleName = "") => (
    userData.role === roleName ||
    userData.primaryRole === roleName ||
    (Array.isArray(userData.roles) && userData.roles.includes(roleName))
);

const assertRoot = async (uid) => {
    if (!uid) throw new HttpsError("unauthenticated", "Tenés que iniciar sesión.");
    const snap = await db.collection("users").doc(uid).get();
    if (!snap.exists || !userHasRole(snap.data(), "root")) {
        throw new HttpsError(
            "permission-denied",
            "Esta operación está reservada para la administración de ONO Prop.",
        );
    }
};

const agencySupportsTaxes = (agency = {}) => (
    agency.activa !== false &&
    Array.isArray(agency.modulosSuscriptos) &&
    agency.modulosSuscriptos.includes("tributos")
);

const settingsRefForAgency = (agencyRef) => (
    agencyRef.collection("tax_notification_settings").doc("default")
);

const loadSettings = async (agencyRef) => {
    const snap = await settingsRefForAgency(agencyRef).get();
    return normalizeTaxNotificationSettings(
        snap.exists ? snap.data() : DEFAULT_TAX_NOTIFICATION_SETTINGS,
    );
};

const listAgencySnapshots = async (specificAgencyId = "") => {
    if (specificAgencyId) {
        const snap = await db.collection("inmobiliarias").doc(specificAgencyId).get();
        return snap.exists ? [snap] : [];
    }

    const agencies = [];
    let cursor = null;
    do {
        let query = db.collection("inmobiliarias")
            .orderBy(FieldPath.documentId())
            .limit(AGENCY_PAGE_SIZE);
        if (cursor) query = query.startAfter(cursor);
        const snap = await query.get();
        agencies.push(...snap.docs);
        cursor = snap.size === AGENCY_PAGE_SIZE
            ? snap.docs[snap.docs.length - 1]
            : null;
    } while (cursor);
    return agencies;
};

const loadCandidateObligations = async (agencyRef, todayDateKey) => {
    const lastRelevantDateKey = addDaysToDateKey(
        todayDateKey,
        MAX_REMINDER_DAYS,
    );
    const snap = await agencyRef.collection("tax_obligations")
        .where("dueDate", "<=", lastRelevantDateKey)
        .orderBy("dueDate", "desc")
        .limit(OBLIGATION_LIMIT)
        .get();
    return snap.docs
        .map((item) => ({ id: item.id, ref: item.ref, ...(item.data() || {}) }))
        .filter((item) => ["pending", "overdue"].includes(item.status));
};

const loadTaxObjects = async (agencyRef, obligations = []) => {
    const ids = [...new Set(obligations.map((item) => item.taxObjectId).filter(Boolean))];
    if (ids.length === 0) return new Map();
    const refs = ids.map((id) => agencyRef.collection("tax_objects").doc(id));
    const snaps = await db.getAll(...refs);
    return new Map(snaps
        .filter((snap) => snap.exists)
        .map((snap) => [snap.id, { id: snap.id, ...(snap.data() || {}) }]));
};

const ensureNotification = async ({
    agencyRef,
    agency,
    obligation,
    alert,
    settings,
    todayDateKey,
}) => {
    const ref = agencyRef.collection("tax_notifications").doc(alert.id);
    const eventRef = agencyRef.collection("tax_events")
        .doc(`notification_${alert.id}`);
    return db.runTransaction(async (transaction) => {
        const existing = await transaction.get(ref);
        if (existing.exists) {
            const data = existing.data() || {};
            return {
                created: false,
                notification: { id: existing.id, ref, ...data },
                needsEmail: data.generatedDateKey === todayDateKey &&
                    data.channels?.email?.status === "pending",
            };
        }

        const notification = {
            schemaVersion: 1,
            inmobiliariaId: agencyRef.id,
            ownerInmobiliariaId: agencyRef.id,
            agencyName: cleanText(agency.nombre, 180),
            ...alert,
            status: "unread",
            generatedDateKey: todayDateKey,
            channels: {
                inApp: { status: "created" },
                email: {
                    status: settings.emailEnabled &&
                        settings.recipientEmails.length > 0
                        ? "pending"
                        : "disabled",
                },
                whatsapp: { status: "not_configured" },
            },
            createdAt: FieldValue.serverTimestamp(),
            createdBy: "tax-scheduler",
        };
        transaction.create(ref, notification);

        if (alert.type === "tax_overdue" && obligation.status === "pending") {
            transaction.update(obligation.ref, {
                status: "overdue",
                updatedAt: FieldValue.serverTimestamp(),
                updatedBy: "tax-scheduler",
            });
            transaction.set(eventRef, {
                schemaVersion: 1,
                inmobiliariaId: agencyRef.id,
                ownerInmobiliariaId: agencyRef.id,
                entityType: "tax_obligation",
                entityId: obligation.id,
                action: "status_overdue_automatic",
                actorId: "tax-scheduler",
                actorEmail: "",
                occurredAt: FieldValue.serverTimestamp(),
            });
        }

        return {
            created: true,
            notification: { id: ref.id, ref, ...notification },
            needsEmail: notification.channels.email.status === "pending",
        };
    });
};

const buildDigestMessage = ({ agency, alerts, todayDateKey }) => {
    const agencyName = cleanText(agency.nombre, 180) || "Inmobiliaria";
    const rows = alerts.map((item) => {
        const amount = formatTaxNotificationAmount(item.amountMinor, item.currency);
        return `<tr>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${
    escapeHtml(item.propertyLabel)
}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${
    escapeHtml(item.concept)
}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${
    escapeHtml(item.dueDate)
}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">${
    escapeHtml(amount)
}</td>
        </tr>`;
    }).join("");
    const textLines = alerts.map((item) => (
        `- ${item.propertyLabel}: ${item.concept}; vence ${item.dueDate}; ${
            formatTaxNotificationAmount(item.amountMinor, item.currency)
        }`
    ));

    return {
        subject: `ONO Prop · ${alerts.length} alerta${alerts.length === 1 ? "" : "s"} tributaria${alerts.length === 1 ? "" : "s"}`,
        text: [
            `Resumen tributario de ${agencyName} (${todayDateKey})`,
            "",
            ...textLines,
            "",
            "Ingresá a ONO Prop para revisar y registrar los pagos.",
        ].join("\n"),
        html: `<div style="font-family:Arial,sans-serif;max-width:760px;margin:auto;">
          <h2 style="color:#0d6efd;">Resumen tributario diario</h2>
          <p><strong>${escapeHtml(agencyName)}</strong> · ${escapeHtml(todayDateKey)}</p>
          <table style="border-collapse:collapse;width:100%;font-size:14px;">
            <thead><tr>
              <th style="padding:8px;text-align:left;">Inmueble</th>
              <th style="padding:8px;text-align:left;">Concepto</th>
              <th style="padding:8px;text-align:left;">Vencimiento</th>
              <th style="padding:8px;text-align:right;">Importe</th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
          <p style="margin-top:20px;">
            <a href="https://onoprop.com/admin/tributos">Abrir control tributario</a>
          </p>
          <p style="color:#64748b;font-size:12px;">
            Aviso automático de ONO Prop. No respondas enviando claves fiscales o bancarias.
          </p>
        </div>`,
    };
};

const queueDailyDigest = async ({
    agencyRef,
    agency,
    settings,
    notifications,
    todayDateKey,
}) => {
    const pending = notifications
        .filter((item) => item.needsEmail)
        .map((item) => item.notification);
    if (!settings.emailEnabled || settings.recipientEmails.length === 0 ||
        pending.length === 0) {
        return { queued: false, alerts: 0 };
    }

    const alertIds = pending.map((item) => item.id).sort();
    const hash = crypto.createHash("sha256")
        .update(alertIds.join("|"))
        .digest("hex")
        .slice(0, 16);
    const mailId = `tax_${agencyRef.id}_${todayDateKey}_${hash}`;
    const mailRef = db.collection("mail").doc(mailId);
    const message = buildDigestMessage({
        agency,
        alerts: pending,
        todayDateKey,
    });

    try {
        await mailRef.create({
            to: settings.recipientEmails,
            message,
            createdAt: FieldValue.serverTimestamp(),
            source: "tax_due_automation",
            inmobiliariaId: agencyRef.id,
            notificationIds: alertIds,
        });
    } catch (error) {
        if (![6, "already-exists"].includes(error?.code)) throw error;
    }

    const batch = db.batch();
    pending.forEach((notification) => batch.update(notification.ref, {
        "channels.email.status": "queued",
        "channels.email.mailDocId": mailId,
        "channels.email.queuedAt": FieldValue.serverTimestamp(),
    }));
    await batch.commit();
    return { queued: true, alerts: pending.length, mailId };
};

const processAgency = async (agencySnap, todayDateKey) => {
    const agency = agencySnap.data() || {};
    const agencyRef = agencySnap.ref;
    if (!agencySupportsTaxes(agency)) {
        return { skipped: true, reason: "module_inactive" };
    }

    const settings = await loadSettings(agencyRef);
    if (!settings.enabled || !settings.inAppEnabled) {
        return { skipped: true, reason: "automation_disabled" };
    }

    const obligations = await loadCandidateObligations(agencyRef, todayDateKey);
    const objectsById = await loadTaxObjects(agencyRef, obligations);
    const notificationResults = [];

    for (const obligation of obligations) {
        const taxObject = objectsById.get(obligation.taxObjectId);
        if (!taxObject || taxObject.status === "archived") continue;
        const alert = buildTaxDueAlert({
            obligation,
            taxObject,
            todayDateKey,
            settings,
        });
        if (!alert) continue;
        notificationResults.push(await ensureNotification({
            agencyRef,
            agency,
            obligation,
            alert,
            settings,
            todayDateKey,
        }));
    }

    const digest = await queueDailyDigest({
        agencyRef,
        agency,
        settings,
        notifications: notificationResults,
        todayDateKey,
    });
    return {
        skipped: false,
        obligationsReviewed: obligations.length,
        notificationsCreated: notificationResults.filter((item) => item.created).length,
        emailQueued: digest.queued,
        emailAlerts: digest.alerts,
    };
};

const runTaxDueAutomation = async ({ specificAgencyId = "" } = {}) => {
    const todayDateKey = dateKeyInTimeZone(Date.now(), TAX_TIME_ZONE);
    const agencies = await listAgencySnapshots(cleanText(specificAgencyId, 128));
    const summary = {
        todayDateKey,
        agenciesFound: agencies.length,
        agenciesProcessed: 0,
        agenciesSkipped: 0,
        agenciesFailed: 0,
        obligationsReviewed: 0,
        notificationsCreated: 0,
        emailDigestsQueued: 0,
        emailAlerts: 0,
    };

    for (const agencySnap of agencies) {
        try {
            const result = await processAgency(agencySnap, todayDateKey);
            if (result.skipped) {
                summary.agenciesSkipped += 1;
                continue;
            }
            summary.agenciesProcessed += 1;
            summary.obligationsReviewed += result.obligationsReviewed;
            summary.notificationsCreated += result.notificationsCreated;
            summary.emailDigestsQueued += result.emailQueued ? 1 : 0;
            summary.emailAlerts += result.emailAlerts;
        } catch (error) {
            summary.agenciesFailed += 1;
            console.error("Tax due automation failed for agency", {
                inmobiliariaId: agencySnap.id,
                message: error?.message || String(error),
            });
        }
    }
    console.info("Tax due automation completed", summary);
    return summary;
};

export const taxRunDueAutomation = onCall(
    { region: REGION, invoker: "public", timeoutSeconds: 540 },
    async (request) => {
        await assertRoot(request.auth?.uid);
        return runTaxDueAutomation({
            specificAgencyId: request.data?.inmobiliariaId || "",
        });
    },
);

export const taxProcessDueReminders = onSchedule(
    {
        region: REGION,
        schedule: "30 6 * * *",
        timeZone: TAX_TIME_ZONE,
        timeoutSeconds: 540,
    },
    runTaxDueAutomation,
);
