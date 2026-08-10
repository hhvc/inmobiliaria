import { normalizeConsortiumEmails } from "./consorcioPortal.helpers.js";

export const DEFAULT_CONSORTIUM_NOTIFICATION_SETTINGS = Object.freeze({
  enabled: false,
  automationAuthorized: false,
  sendOnIssue: false,
  preDueDays: [3],
  overdueDays: [1, 7, 15],
  replyToEmail: "",
  subjectTemplate: "Expensas {{periodo}} · Unidad {{unidad}}",
  introText: "Te enviamos la liquidación de expensas correspondiente al período {{periodo}}.",
});

export const normalizeConsortiumDeliveryPreference = (value = "owner") => (
  ["owner", "occupant", "both", "none"].includes(value) ? value : "owner"
);

export const getConsortiumUnitNotificationRecipients = (unit = {}) => {
  const preference = normalizeConsortiumDeliveryPreference(unit.notificationPreference);
  const ownerEmail = normalizeConsortiumEmails([unit.ownerEmail || unit.email])[0] || "";
  const occupantEmail = normalizeConsortiumEmails([unit.occupantEmail])[0] || "";
  const candidates = [];
  if (["owner", "both"].includes(preference) && ownerEmail) {
    candidates.push({ email: ownerEmail, role: "owner", name: unit.ownerName || "Titular" });
  }
  if (["occupant", "both"].includes(preference) && occupantEmail) {
    candidates.push({ email: occupantEmail, role: "occupant", name: unit.occupantName || "Ocupante" });
  }
  const seen = new Set();
  return candidates.filter((item) => {
    if (seen.has(item.email)) return false;
    seen.add(item.email);
    return true;
  });
};

export const normalizeReminderDays = (value, fallback = []) => {
  if (value == null) return [...fallback];
  const source = Array.isArray(value) ? value : String(value || "").split(/[;,\s]+/);
  const normalized = source
    .map((item) => String(item ?? "").trim())
    .filter(Boolean)
    .map((item) => Math.trunc(Number(item)))
    .filter((item) => Number.isFinite(item) && item >= 0 && item <= 365);
  return [...new Set(normalized)].sort((a, b) => a - b).slice(0, 12);
};

export const normalizeConsortiumNotificationSettings = (value = {}) => ({
  ...DEFAULT_CONSORTIUM_NOTIFICATION_SETTINGS,
  enabled: value.enabled === true,
  automationAuthorized: value.automationAuthorized === true,
  sendOnIssue: value.sendOnIssue === true,
  preDueDays: normalizeReminderDays(
    value.preDueDays,
    DEFAULT_CONSORTIUM_NOTIFICATION_SETTINGS.preDueDays,
  ),
  overdueDays: normalizeReminderDays(
    value.overdueDays,
    DEFAULT_CONSORTIUM_NOTIFICATION_SETTINGS.overdueDays,
  ).filter((item) => item > 0),
  replyToEmail: normalizeConsortiumEmails([value.replyToEmail])[0] || "",
  subjectTemplate: value.subjectTemplate?.toString?.().trim().slice(0, 180)
    || DEFAULT_CONSORTIUM_NOTIFICATION_SETTINGS.subjectTemplate,
  introText: value.introText?.toString?.().trim().slice(0, 1000)
    || DEFAULT_CONSORTIUM_NOTIFICATION_SETTINGS.introText,
});

export const normalizeConsortiumUnitAutomationMode = (value = "inherit") => (
  ["inherit", "custom", "disabled"].includes(value) ? value : "inherit"
);

export const getEffectiveConsortiumNotificationSettings = (settings = {}, unit = {}) => {
  const base = normalizeConsortiumNotificationSettings(settings);
  const mode = normalizeConsortiumUnitAutomationMode(unit.notificationAutomationMode);
  if (!base.enabled || !base.automationAuthorized || mode === "disabled") {
    return { ...base, enabled: false, unitMode: mode };
  }
  if (mode !== "custom") return { ...base, unitMode: mode };
  return {
    ...base,
    sendOnIssue: unit.notificationSendOnIssue === true,
    preDueDays: normalizeReminderDays(unit.notificationPreDueDays, base.preDueDays),
    overdueDays: normalizeReminderDays(unit.notificationOverdueDays, base.overdueDays)
      .filter((item) => item > 0),
    unitMode: mode,
  };
};

export const getConsortiumCommunicationStatus = (status = "queued") => ({
  queued: { label: "En cola", badge: "text-bg-warning" },
  processing: { label: "Procesando", badge: "text-bg-info" },
  sent: { label: "Enviado", badge: "text-bg-success" },
  failed: { label: "Falló", badge: "text-bg-danger" },
  skipped: { label: "Omitido", badge: "text-bg-secondary" },
}[status] || { label: "En cola", badge: "text-bg-warning" });
