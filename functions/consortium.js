import crypto from "node:crypto";

import admin from "firebase-admin";
import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";

import {
    applyConsortiumTemplate,
    buildConsortiumCommunicationId,
    cleanConsortiumText,
    CONSORTIUM_TIME_ZONE,
    dateKeyInConsortiumTimeZone,
    getAutomaticConsortiumCommunication,
    normalizeConsortiumNotificationSettings,
    resolveConsortiumRecipients,
    resolveEffectiveConsortiumNotificationSettings,
} from "./consortium.helpers.js";

if (!admin.apps.length) admin.initializeApp();

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;
const FieldPath = admin.firestore.FieldPath;
const REGION = "southamerica-east1";
const SETTINGS_COLLECTION = "condominium_notification_settings";
const CONSENTS_COLLECTION = "condominium_communication_consents";
const COMMUNICATIONS_COLLECTION = "condominium_communications";
const OBLIGATIONS_COLLECTION = "condominium_obligations";
const UNITS_COLLECTION = "condominium_units";
const CONSORTIUMS_COLLECTION = "condominiums";
const MANUAL_LIMIT = 150;
const AGENCY_PAGE_SIZE = 150;
const AUTOMATION_CONSENT_VERSION = "2026-08-10.1";

const escapeHtml = (value = "") => String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const getUserData = async (uid) => {
    if (!uid) throw new HttpsError("unauthenticated", "Tenés que iniciar sesión.");
    const snap = await db.collection("users").doc(uid).get();
    if (!snap.exists) throw new HttpsError("permission-denied", "Perfil de usuario no encontrado.");
    return snap.data() || {};
};

const userHasRole = (user = {}, role = "") => (
    user.role === role || user.primaryRole === role ||
    (Array.isArray(user.roles) && user.roles.includes(role))
);

const assertCanManageAgency = async (uid, agencyId) => {
    const inmobiliariaId = cleanConsortiumText(agencyId, 128);
    if (!inmobiliariaId) throw new HttpsError("invalid-argument", "Falta la inmobiliaria.");
    const user = await getUserData(uid);
    const agencies = Array.isArray(user.inmobiliarias) ? user.inmobiliarias : [];
    if (!userHasRole(user, "root") &&
        (!userHasRole(user, "admin") || !agencies.includes(inmobiliariaId))) {
        throw new HttpsError(
            "permission-denied",
            "No tenés permisos para enviar comunicaciones de esta inmobiliaria.",
        );
    }
    const agencySnap = await db.collection("inmobiliarias").doc(inmobiliariaId).get();
    if (!agencySnap.exists || agencySnap.data()?.activa === false) {
        throw new HttpsError("failed-precondition", "La inmobiliaria no está activa.");
    }
    if (!userHasRole(user, "root") &&
        !Array.isArray(agencySnap.data()?.modulosSuscriptos)) {
        throw new HttpsError("failed-precondition", "La inmobiliaria no tiene módulos habilitados.");
    }
    if (!userHasRole(user, "root") &&
        !agencySnap.data().modulosSuscriptos.includes("consorcios")) {
        throw new HttpsError("failed-precondition", "El módulo de consorcios no está habilitado.");
    }
    return { agency: { id: agencySnap.id, ...(agencySnap.data() || {}) }, user };
};

const agencyRef = (agencyId) => db.collection("inmobiliarias").doc(agencyId);
const nestedRef = (agencyId, collectionName, id) => (
    agencyRef(agencyId).collection(collectionName).doc(id)
);

const formatPeriod = (periodKey = "") => {
    const match = /^(\d{4})-(\d{2})$/.exec(periodKey);
    if (!match) return periodKey || "período informado";
    const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1));
    const label = new Intl.DateTimeFormat("es-AR", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
    }).format(date);
    return label.charAt(0).toUpperCase() + label.slice(1);
};

const formatAmount = (amountMinor = 0, currency = "ARS") => {
    try {
        return new Intl.NumberFormat("es-AR", {
            style: "currency",
            currency: currency || "ARS",
            minimumFractionDigits: 2,
        }).format(Number(amountMinor || 0) / 100);
    } catch {
        return `${currency || "ARS"} ${(Number(amountMinor || 0) / 100).toFixed(2)}`;
    }
};

const communicationKindLabel = (kind, offsetDays = 0) => ({
    manual: "Liquidación de expensas",
    issue: "Nueva liquidación de expensas",
    before_due: `Recordatorio de vencimiento (${offsetDays} día${offsetDays === 1 ? "" : "s"})`,
    overdue: `Expensas vencidas (${offsetDays} día${offsetDays === 1 ? "" : "s"})`,
}[kind] || "Liquidación de expensas");

const buildMessage = ({
    agency,
    consortium,
    unit,
    obligation,
    settings,
    kind,
    offsetDays,
}) => {
    const period = formatPeriod(obligation.periodKey);
    const unitCode = unit.code || obligation.unitSnapshot?.code || obligation.unitId;
    const balance = formatAmount(obligation.balanceMinor, obligation.currency);
    const values = {
        consorcio: consortium.name || "Consorcio",
        periodo: period,
        unidad: unitCode,
        vencimiento: obligation.dueDate || "Sin informar",
        saldo: balance,
    };
    const baseSubject = applyConsortiumTemplate(settings.subjectTemplate, values);
    const subject = kind === "overdue"
        ? `Vencida · ${baseSubject}`
        : kind === "before_due" ? `Recordatorio · ${baseSubject}` : baseSubject;
    const intro = applyConsortiumTemplate(settings.introText, values);
    const link = `https://onoprop.com/mi-consorcio/${encodeURIComponent(agency.id)}/` +
        `${encodeURIComponent(consortium.id)}/liquidaciones/${encodeURIComponent(obligation.id)}`;
    const kindText = communicationKindLabel(kind, offsetDays);
    const text = [
        kindText,
        `${consortium.name || "Consorcio"} · Unidad ${unitCode}`,
        intro,
        `Vencimiento: ${obligation.dueDate || "Sin informar"}`,
        `Saldo actual: ${balance}`,
        `Ver liquidación: ${link}`,
        "",
        `Administración: ${agency.nombre || agency.razonSocial || "ONO Prop"}`,
        "El enlace requiere iniciar sesión con el email autorizado para la unidad.",
    ].join("\n");
    const html = `<div style="font-family:Arial,sans-serif;max-width:680px;margin:auto;color:#1f2937;">
      <div style="background:#0d6efd;color:white;padding:18px 22px;border-radius:10px 10px 0 0;">
        <h2 style="margin:0;font-size:20px;">${escapeHtml(kindText)}</h2>
      </div>
      <div style="border:1px solid #dbe3ec;border-top:0;padding:22px;border-radius:0 0 10px 10px;">
        <p><strong>${escapeHtml(consortium.name || "Consorcio")}</strong><br>Unidad ${escapeHtml(unitCode)}</p>
        <p>${escapeHtml(intro)}</p>
        <table style="width:100%;border-collapse:collapse;margin:18px 0;">
          <tr><td style="padding:8px;background:#f4f7fb;">Período</td><td style="padding:8px;text-align:right;"><strong>${escapeHtml(period)}</strong></td></tr>
          <tr><td style="padding:8px;">Vencimiento</td><td style="padding:8px;text-align:right;"><strong>${escapeHtml(obligation.dueDate || "Sin informar")}</strong></td></tr>
          <tr><td style="padding:8px;background:#f4f7fb;">Saldo actual</td><td style="padding:8px;text-align:right;"><strong>${escapeHtml(balance)}</strong></td></tr>
        </table>
        <p style="text-align:center;margin:24px 0;"><a href="${escapeHtml(link)}" style="display:inline-block;background:#0d6efd;color:white;text-decoration:none;padding:12px 20px;border-radius:7px;">Ver liquidación segura</a></p>
        <p style="font-size:12px;color:#64748b;">El acceso requiere una cuenta de ONO Prop verificada con alguno de los emails autorizados para esta unidad. No reenvíes información sensible ni claves.</p>
        <hr style="border:0;border-top:1px solid #e5e7eb;margin:20px 0;">
        <p style="font-size:12px;color:#64748b;margin:0;">Administración: ${escapeHtml(agency.nombre || agency.razonSocial || "ONO Prop")}</p>
      </div>
    </div>`;
    return { subject, text, html, link };
};

const loadSettings = async (agencyId, consortiumId) => {
    const snap = await nestedRef(agencyId, SETTINGS_COLLECTION, consortiumId).get();
    const normalized = normalizeConsortiumNotificationSettings(
        snap.exists ? snap.data() : {},
    );
    return {
        ...normalized,
        enabled: normalized.enabled && normalized.automationAuthorized,
    };
};

const listAgencySnapshots = async () => {
    const agencies = [];
    let cursor = null;
    do {
        let source = db.collection("inmobiliarias")
            .orderBy(FieldPath.documentId())
            .limit(AGENCY_PAGE_SIZE);
        if (cursor) source = source.startAfter(cursor);
        const snap = await source.get();
        agencies.push(...snap.docs);
        cursor = snap.size === AGENCY_PAGE_SIZE ? snap.docs[snap.docs.length - 1] : null;
    } while (cursor);
    return agencies;
};

const mapMailState = (delivery = {}) => {
    const state = cleanConsortiumText(delivery.state, 40).toUpperCase();
    if (["SUCCESS", "SENT", "DELIVERED"].includes(state)) return "sent";
    if (["ERROR", "FAILED"].includes(state)) return "failed";
    if (["PROCESSING", "LEASED"].includes(state)) return "processing";
    return "queued";
};

const queueCommunication = async ({
    agency,
    consortium,
    unit,
    obligation,
    settings,
    kind = "manual",
    offsetDays = 0,
    source = "manual",
    actorUid = "system",
    eventNonce = "",
    dateKey = dateKeyInConsortiumTimeZone(),
}) => {
    if (!agency?.id || !consortium?.id || !unit?.id || !obligation?.id) {
        return { queued: false, reason: "incomplete_data", obligationId: obligation?.id || "" };
    }
    const recipients = resolveConsortiumRecipients(unit);
    if (!recipients.length) {
        return { queued: false, reason: "missing_recipients", obligationId: obligation.id };
    }
    const nonce = source === "manual"
        ? (eventNonce || `${Date.now()}_${crypto.randomUUID?.() || Math.random()}`)
        : "";
    const communicationId = buildConsortiumCommunicationId({
        obligationId: obligation.id,
        kind,
        offsetDays,
        dateKey: source === "manual" ? dateKey : obligation.dueDate || dateKey,
        nonce,
    });
    const communicationRef = nestedRef(
        agency.id,
        COMMUNICATIONS_COLLECTION,
        communicationId,
    );
    const existing = await communicationRef.get();
    if (existing.exists) {
        return { queued: false, reason: "already_queued", obligationId: obligation.id, communicationId };
    }
    const mailRef = db.collection("mail").doc(`consortium_${communicationId}`);
    const message = buildMessage({
        agency,
        consortium,
        unit,
        obligation,
        settings,
        kind,
        offsetDays,
    });
    const recipientEmails = recipients.map((item) => item.email);
    const batch = db.batch();
    batch.create(communicationRef, {
        id: communicationId,
        schemaVersion: 1,
        inmobiliariaId: agency.id,
        ownerInmobiliariaId: agency.id,
        consortiumId: consortium.id,
        periodId: obligation.periodId || "",
        periodKey: obligation.periodKey || "",
        obligationId: obligation.id,
        unitId: unit.id,
        unitSnapshot: {
            code: unit.code || "",
            ownerName: unit.ownerName || "",
            occupantName: unit.occupantName || "",
        },
        kind,
        offsetDays,
        source,
        status: "queued",
        recipientSnapshot: recipients,
        subject: message.subject,
        secureLink: message.link,
        dueDate: obligation.dueDate || "",
        balanceMinor: Math.max(0, Number(obligation.balanceMinor) || 0),
        currency: obligation.currency || consortium.currency || "ARS",
        mailDocId: mailRef.id,
        createdBy: actorUid,
        createdAt: FieldValue.serverTimestamp(),
        queuedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
    });
    batch.create(mailRef, {
        to: recipientEmails,
        ...(settings.replyToEmail ? { replyTo: settings.replyToEmail } : {}),
        message: {
            subject: message.subject,
            text: message.text,
            html: message.html,
        },
        source: "consortium_communication",
        inmobiliariaId: agency.id,
        communicationPath: communicationRef.path,
        createdAt: FieldValue.serverTimestamp(),
    });
    batch.set(nestedRef(agency.id, UNITS_COLLECTION, unit.id), {
        portalEmails: FieldValue.arrayUnion(...recipientEmails),
        updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    batch.set(nestedRef(agency.id, CONSORTIUMS_COLLECTION, consortium.id), {
        portalEmails: FieldValue.arrayUnion(...recipientEmails),
        updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    try {
        await batch.commit();
        return { queued: true, obligationId: obligation.id, communicationId };
    } catch (error) {
        if ([6, "already-exists"].includes(error?.code)) {
            return { queued: false, reason: "already_queued", obligationId: obligation.id, communicationId };
        }
        throw error;
    }
};

export const consortiumSaveNotificationSettings = onCall(
    { region: REGION, invoker: "public" },
    async (request) => {
        const inmobiliariaId = cleanConsortiumText(request.data?.inmobiliariaId, 128);
        const consortiumId = cleanConsortiumText(request.data?.consortiumId, 128);
        if (!consortiumId) {
            throw new HttpsError("invalid-argument", "Falta el consorcio.");
        }
        const { agency, user } = await assertCanManageAgency(
            request.auth?.uid,
            inmobiliariaId,
        );
        const consortiumRef = nestedRef(
            inmobiliariaId,
            CONSORTIUMS_COLLECTION,
            consortiumId,
        );
        const settingsRef = nestedRef(
            inmobiliariaId,
            SETTINGS_COLLECTION,
            consortiumId,
        );
        const [consortiumSnap, previousSnap] = await Promise.all([
            consortiumRef.get(),
            settingsRef.get(),
        ]);
        if (!consortiumSnap.exists || consortiumSnap.data()?.status === "archived") {
            throw new HttpsError("failed-precondition", "El consorcio no está activo.");
        }
        const previous = previousSnap.exists ? previousSnap.data() || {} : {};
        const normalized = normalizeConsortiumNotificationSettings(
            request.data?.settings || {},
        );
        const wasAuthorized = previous.enabled === true &&
            previous.automationAuthorized === true;
        const shouldEnable = normalized.enabled === true;
        if (shouldEnable && !wasAuthorized && request.data?.authorizationAccepted !== true) {
            throw new HttpsError(
                "failed-precondition",
                "Confirmá la autorización de envíos automáticos para este consorcio.",
            );
        }

        const now = FieldValue.serverTimestamp();
        const actorEmail = cleanConsortiumText(
            request.auth?.token?.email || user.email,
            220,
        );
        const next = {
            ...normalized,
            id: consortiumId,
            schemaVersion: 1,
            inmobiliariaId,
            ownerInmobiliariaId: inmobiliariaId,
            consortiumId,
            automationAuthorized: shouldEnable,
            consentVersion: AUTOMATION_CONSENT_VERSION,
            updatedBy: request.auth.uid,
            updatedAt: now,
        };
        if (shouldEnable) {
            next.authorizedBy = wasAuthorized
                ? previous.authorizedBy || request.auth.uid
                : request.auth.uid;
            next.authorizedByEmail = wasAuthorized
                ? previous.authorizedByEmail || actorEmail
                : actorEmail;
            next.authorizedAt = wasAuthorized && previous.authorizedAt
                ? previous.authorizedAt : now;
            next.revokedBy = "";
            next.revokedByEmail = "";
            next.revokedAt = null;
        } else {
            next.authorizedBy = "";
            next.authorizedByEmail = "";
            next.authorizedAt = null;
            if (wasAuthorized) {
                next.revokedBy = request.auth.uid;
                next.revokedByEmail = actorEmail;
                next.revokedAt = now;
            }
        }

        const batch = db.batch();
        batch.set(settingsRef, next, { merge: true });
        if (shouldEnable !== wasAuthorized) {
            const consentRef = agencyRef(inmobiliariaId)
                .collection(CONSENTS_COLLECTION)
                .doc();
            batch.create(consentRef, {
                id: consentRef.id,
                schemaVersion: 1,
                action: shouldEnable ? "authorized" : "revoked",
                scope: "consortium",
                inmobiliariaId,
                ownerInmobiliariaId: inmobiliariaId,
                consortiumId,
                consortiumName: cleanConsortiumText(consortiumSnap.data()?.name, 220),
                consentVersion: AUTOMATION_CONSENT_VERSION,
                settingsSnapshot: {
                    sendOnIssue: normalized.sendOnIssue,
                    preDueDays: normalized.preDueDays,
                    overdueDays: normalized.overdueDays,
                },
                actorUid: request.auth.uid,
                actorEmail,
                agencyName: cleanConsortiumText(
                    agency.nombre || agency.razonSocial,
                    220,
                ),
                createdAt: now,
            });
        }
        await batch.commit();
        return {
            settings: {
                ...normalized,
                enabled: shouldEnable,
                automationAuthorized: shouldEnable,
                authorizedByEmail: shouldEnable
                    ? next.authorizedByEmail : "",
                consentVersion: AUTOMATION_CONSENT_VERSION,
            },
        };
    },
);

export const consortiumSendCommunications = onCall(
    { region: REGION, invoker: "public", timeoutSeconds: 540 },
    async (request) => {
        const inmobiliariaId = cleanConsortiumText(request.data?.inmobiliariaId, 128);
        const obligationIds = [...new Set((Array.isArray(request.data?.obligationIds)
            ? request.data.obligationIds : [])
            .map((item) => cleanConsortiumText(item, 180))
            .filter(Boolean))];
        if (!obligationIds.length || obligationIds.length > MANUAL_LIMIT) {
            throw new HttpsError(
                "invalid-argument",
                `Seleccioná entre 1 y ${MANUAL_LIMIT} liquidaciones por envío.`,
            );
        }
        const { agency } = await assertCanManageAgency(request.auth?.uid, inmobiliariaId);
        const obligationSnaps = await db.getAll(...obligationIds.map((id) => (
            nestedRef(inmobiliariaId, OBLIGATIONS_COLLECTION, id)
        )));
        const consortiumCache = new Map();
        const unitCache = new Map();
        const settingsCache = new Map();
        const results = [];
        for (const obligationSnap of obligationSnaps) {
            if (!obligationSnap.exists) {
                results.push({ queued: false, reason: "not_found", obligationId: obligationSnap.id });
                continue;
            }
            const obligation = { id: obligationSnap.id, ...(obligationSnap.data() || {}) };
            if (obligation.source && obligation.source !== "period") {
                results.push({
                    queued: false,
                    reason: "unsupported_source",
                    obligationId: obligation.id,
                });
                continue;
            }
            if (!consortiumCache.has(obligation.consortiumId)) {
                const snap = await nestedRef(
                    inmobiliariaId,
                    CONSORTIUMS_COLLECTION,
                    obligation.consortiumId,
                ).get();
                consortiumCache.set(obligation.consortiumId, snap.exists
                    ? { id: snap.id, ...(snap.data() || {}) } : null);
            }
            if (!unitCache.has(obligation.unitId)) {
                const snap = await nestedRef(
                    inmobiliariaId,
                    UNITS_COLLECTION,
                    obligation.unitId,
                ).get();
                unitCache.set(obligation.unitId, snap.exists
                    ? { id: snap.id, ...(snap.data() || {}) } : null);
            }
            if (!settingsCache.has(obligation.consortiumId)) {
                settingsCache.set(
                    obligation.consortiumId,
                    await loadSettings(inmobiliariaId, obligation.consortiumId),
                );
            }
            const consortium = consortiumCache.get(obligation.consortiumId);
            const unit = unitCache.get(obligation.unitId);
            if (!consortium || !unit || consortium.status === "archived" ||
                unit.deleted === true || unit.status === "archived") {
                results.push({ queued: false, reason: "inactive_record", obligationId: obligation.id });
                continue;
            }
            results.push(await queueCommunication({
                agency,
                consortium,
                unit,
                obligation,
                settings: settingsCache.get(obligation.consortiumId),
                kind: "manual",
                source: "manual",
                actorUid: request.auth.uid,
                eventNonce: `${request.rawRequest?.headers?.["x-cloud-trace-context"] || ""}_${Date.now()}`,
            }));
        }
        return {
            queued: results.filter((item) => item.queued).length,
            skipped: results.filter((item) => !item.queued).length,
            results,
        };
    },
);

export const consortiumSendOnObligationCreated = onDocumentCreated(
    {
        region: REGION,
        document: "inmobiliarias/{inmobiliariaId}/condominium_obligations/{obligationId}",
    },
    async (event) => {
        if (!event.data) return null;
        const obligation = { id: event.params.obligationId, ...(event.data.data() || {}) };
        if (obligation.source && obligation.source !== "period") return null;
        const settings = await loadSettings(event.params.inmobiliariaId, obligation.consortiumId);
        const [agencySnap, consortiumSnap, unitSnap] = await Promise.all([
            agencyRef(event.params.inmobiliariaId).get(),
            nestedRef(event.params.inmobiliariaId, CONSORTIUMS_COLLECTION, obligation.consortiumId).get(),
            nestedRef(event.params.inmobiliariaId, UNITS_COLLECTION, obligation.unitId).get(),
        ]);
        if (!agencySnap.exists || agencySnap.data()?.activa === false ||
            !Array.isArray(agencySnap.data()?.modulosSuscriptos) ||
            !agencySnap.data().modulosSuscriptos.includes("consorcios") ||
            !consortiumSnap.exists || consortiumSnap.data()?.status === "archived" ||
            !unitSnap.exists || unitSnap.data()?.deleted === true ||
            unitSnap.data()?.status === "archived") return null;
        const unit = { id: unitSnap.id, ...(unitSnap.data() || {}) };
        const effectiveSettings = resolveEffectiveConsortiumNotificationSettings(
            settings,
            unit,
        );
        if (!effectiveSettings.enabled || !effectiveSettings.sendOnIssue) return null;
        return queueCommunication({
            agency: { id: agencySnap.id, ...(agencySnap.data() || {}) },
            consortium: { id: consortiumSnap.id, ...(consortiumSnap.data() || {}) },
            unit,
            obligation,
            settings: effectiveSettings,
            kind: "issue",
            source: "automatic",
            actorUid: "system",
        });
    },
);

const runConsortiumReminderAutomation = async () => {
    const todayDateKey = dateKeyInConsortiumTimeZone();
    const agencies = await listAgencySnapshots();
    const summary = {
        agencies: agencies.length,
        settings: 0,
        reviewed: 0,
        queued: 0,
        skipped: 0,
        failed: 0,
    };
    for (const agencySnap of agencies) {
        if (agencySnap.data()?.activa === false ||
            !Array.isArray(agencySnap.data()?.modulosSuscriptos) ||
            !agencySnap.data().modulosSuscriptos.includes("consorcios")) continue;
        const agencyDocumentRef = agencySnap.ref;
        const inmobiliariaId = agencySnap.id;
        const settingsSnap = await agencyDocumentRef.collection(SETTINGS_COLLECTION)
            .where("enabled", "==", true)
            .limit(500)
            .get();
        summary.settings += settingsSnap.size;
        for (const settingSnap of settingsSnap.docs) {
            const consortiumId = cleanConsortiumText(
                settingSnap.data()?.consortiumId || settingSnap.id,
                128,
            );
            try {
                const [consortiumSnap, obligationsSnap] = await Promise.all([
                    nestedRef(inmobiliariaId, CONSORTIUMS_COLLECTION, consortiumId).get(),
                    agencyDocumentRef.collection(OBLIGATIONS_COLLECTION)
                        .where("consortiumId", "==", consortiumId)
                        .limit(1000)
                        .get(),
                ]);
                if (!consortiumSnap.exists || consortiumSnap.data()?.status === "archived") {
                    summary.skipped += 1;
                    continue;
                }
                const agency = { id: agencySnap.id, ...(agencySnap.data() || {}) };
                const consortium = { id: consortiumSnap.id, ...(consortiumSnap.data() || {}) };
                const settings = normalizeConsortiumNotificationSettings(settingSnap.data());
                const units = new Map();
                for (const obligationSnap of obligationsSnap.docs) {
                    const obligation = { id: obligationSnap.id, ...(obligationSnap.data() || {}) };
                    if (!units.has(obligation.unitId)) {
                        const unitSnap = await nestedRef(
                            inmobiliariaId,
                            UNITS_COLLECTION,
                            obligation.unitId,
                        ).get();
                        units.set(obligation.unitId, unitSnap.exists
                            ? { id: unitSnap.id, ...(unitSnap.data() || {}) } : null);
                    }
                    const unit = units.get(obligation.unitId);
                    if (!unit || unit.deleted === true || unit.status === "archived" ||
                        unit.active === false) {
                        summary.skipped += 1;
                        continue;
                    }
                    const effectiveSettings = resolveEffectiveConsortiumNotificationSettings(
                        settings,
                        unit,
                    );
                    const action = getAutomaticConsortiumCommunication({
                        obligation,
                        settings: effectiveSettings,
                        todayDateKey,
                    });
                    if (!action) continue;
                    summary.reviewed += 1;
                    const result = await queueCommunication({
                        agency,
                        consortium,
                        unit,
                        obligation,
                        settings: effectiveSettings,
                        ...action,
                        source: "automatic",
                        actorUid: "system",
                        dateKey: todayDateKey,
                    });
                    if (result.queued) summary.queued += 1;
                    else summary.skipped += 1;
                }
            } catch (error) {
                summary.failed += 1;
                console.error("Consortium reminder automation failed", {
                    inmobiliariaId,
                    consortiumId,
                    message: error?.message || String(error),
                });
            }
        }
    }
    console.info("Consortium reminder automation completed", { todayDateKey, ...summary });
    return { todayDateKey, ...summary };
};

export const consortiumRunReminderAutomation = onCall(
    { region: REGION, invoker: "public", timeoutSeconds: 540 },
    async (request) => {
        const user = await getUserData(request.auth?.uid);
        if (!userHasRole(user, "root")) {
            throw new HttpsError("permission-denied", "La ejecución global está reservada a ONO Prop.");
        }
        return runConsortiumReminderAutomation();
    },
);

export const consortiumProcessReminders = onSchedule(
    {
        region: REGION,
        schedule: "15 7 * * *",
        timeZone: CONSORTIUM_TIME_ZONE,
        timeoutSeconds: 540,
    },
    runConsortiumReminderAutomation,
);

export const consortiumSyncMailStatus = onDocumentUpdated(
    { region: REGION, document: "mail/{mailId}" },
    async (event) => {
        if (!event.data) return null;
        const before = event.data.before.data() || {};
        const after = event.data.after.data() || {};
        if (after.source !== "consortium_communication" || !after.communicationPath) return null;
        const status = mapMailState(after.delivery || {});
        const previousStatus = mapMailState(before.delivery || {});
        if (status === previousStatus && before.delivery?.state === after.delivery?.state) return null;
        const path = cleanConsortiumText(after.communicationPath, 500);
        if (!/^inmobiliarias\/[^/]+\/condominium_communications\/[^/]+$/.test(path)) return null;
        const update = {
            status,
            deliveryState: cleanConsortiumText(after.delivery?.state, 80),
            deliveryError: cleanConsortiumText(
                after.delivery?.error || after.delivery?.info?.response || "",
                1000,
            ),
            updatedAt: FieldValue.serverTimestamp(),
        };
        if (status === "sent") update.sentAt = FieldValue.serverTimestamp();
        if (status === "failed") update.failedAt = FieldValue.serverTimestamp();
        await db.doc(path).set(update, { merge: true });
        return { status };
    },
);
