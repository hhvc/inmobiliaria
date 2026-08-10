import crypto from "node:crypto";

export const CONSORTIUM_TIME_ZONE = "America/Argentina/Buenos_Aires";

export const DEFAULT_CONSORTIUM_NOTIFICATION_SETTINGS = Object.freeze({
    enabled: false,
    sendOnIssue: false,
    preDueDays: [3],
    overdueDays: [1, 7, 15],
    replyToEmail: "",
    subjectTemplate: "Expensas {{periodo}} · Unidad {{unidad}}",
    introText: "Te enviamos la liquidación de expensas correspondiente al período {{periodo}}.",
});

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const cleanConsortiumText = (value = "", maxLength = 1000) => (
    value?.toString?.().trim().replace(/\s+/g, " ").slice(0, maxLength) || ""
);

export const normalizeConsortiumEmail = (value = "") => {
    const email = cleanConsortiumText(value, 220).toLowerCase();
    return EMAIL_PATTERN.test(email) ? email : "";
};

export const normalizeConsortiumEmails = (values = []) => {
    const source = Array.isArray(values) ? values : String(values || "").split(/[\n,;]+/);
    return [...new Set(source.map(normalizeConsortiumEmail).filter(Boolean))];
};

export const normalizeReminderDays = (value, fallback = []) => {
    if (value == null) return [...fallback];
    const source = Array.isArray(value) ? value : String(value || "").split(/[;,\s]+/);
    const result = [...new Set(source
        .map((item) => String(item ?? "").trim())
        .filter(Boolean)
        .map((item) => Math.trunc(Number(item)))
        .filter((item) => Number.isFinite(item) && item >= 0 && item <= 365))]
        .sort((a, b) => a - b)
        .slice(0, 12);
    return result;
};

export const normalizeConsortiumNotificationSettings = (value = {}) => ({
    enabled: value.enabled === true,
    sendOnIssue: value.sendOnIssue === true,
    preDueDays: normalizeReminderDays(
        value.preDueDays,
        DEFAULT_CONSORTIUM_NOTIFICATION_SETTINGS.preDueDays,
    ),
    overdueDays: normalizeReminderDays(
        value.overdueDays,
        DEFAULT_CONSORTIUM_NOTIFICATION_SETTINGS.overdueDays,
    ).filter((item) => item > 0),
    replyToEmail: normalizeConsortiumEmail(value.replyToEmail),
    subjectTemplate: cleanConsortiumText(value.subjectTemplate, 180) ||
        DEFAULT_CONSORTIUM_NOTIFICATION_SETTINGS.subjectTemplate,
    introText: cleanConsortiumText(value.introText, 1000) ||
        DEFAULT_CONSORTIUM_NOTIFICATION_SETTINGS.introText,
});

export const resolveConsortiumRecipients = (unit = {}) => {
    const preference = ["owner", "occupant", "both", "none"]
        .includes(unit.notificationPreference) ? unit.notificationPreference : "owner";
    const ownerEmail = normalizeConsortiumEmail(unit.ownerEmail || unit.email);
    const occupantEmail = normalizeConsortiumEmail(unit.occupantEmail);
    const candidates = [];
    if (["owner", "both"].includes(preference) && ownerEmail) {
        candidates.push({
            email: ownerEmail,
            role: "owner",
            name: cleanConsortiumText(unit.ownerName, 220) || "Titular",
        });
    }
    if (["occupant", "both"].includes(preference) && occupantEmail) {
        candidates.push({
            email: occupantEmail,
            role: "occupant",
            name: cleanConsortiumText(unit.occupantName, 220) || "Ocupante",
        });
    }
    const seen = new Set();
    return candidates.filter((item) => {
        if (seen.has(item.email)) return false;
        seen.add(item.email);
        return true;
    });
};

export const dateKeyInConsortiumTimeZone = (nowMs = Date.now()) => {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: CONSORTIUM_TIME_ZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(new Date(nowMs));
    const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${map.year}-${map.month}-${map.day}`;
};

const utcDateFromKey = (dateKey = "") => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
    if (!match) return null;
    const value = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    const date = new Date(value);
    if (date.toISOString().slice(0, 10) !== dateKey) return null;
    return value;
};

export const daysFromTodayToDueDate = (todayDateKey, dueDateKey) => {
    const today = utcDateFromKey(todayDateKey);
    const due = utcDateFromKey(dueDateKey);
    if (today == null || due == null) return null;
    return Math.round((due - today) / 86400000);
};

export const getAutomaticConsortiumCommunication = ({
    obligation = {},
    settings = {},
    todayDateKey = "",
} = {}) => {
    if (obligation.source && obligation.source !== "period") return null;
    if (Number(obligation.balanceMinor || 0) <= 0) return null;
    const normalized = normalizeConsortiumNotificationSettings(settings);
    if (!normalized.enabled) return null;
    const daysUntilDue = daysFromTodayToDueDate(todayDateKey, obligation.dueDate);
    if (daysUntilDue == null) return null;
    if (normalized.preDueDays.includes(daysUntilDue)) {
        return { kind: "before_due", offsetDays: daysUntilDue };
    }
    const overdueDays = Math.abs(daysUntilDue);
    if (daysUntilDue < 0 && normalized.overdueDays.includes(overdueDays)) {
        return { kind: "overdue", offsetDays: overdueDays };
    }
    return null;
};

export const applyConsortiumTemplate = (template = "", values = {}) => (
    String(template || "").replace(/{{\s*([a-z_]+)\s*}}/gi, (match, key) => (
        Object.hasOwn(values, key) ? String(values[key] ?? "") : match
    ))
);

export const buildConsortiumCommunicationId = ({
    obligationId = "",
    kind = "manual",
    offsetDays = 0,
    dateKey = "",
    nonce = "",
} = {}) => {
    const raw = [obligationId, kind, offsetDays, dateKey, nonce].join("|");
    const suffix = crypto.createHash("sha256").update(raw).digest("hex").slice(0, 20);
    return `comm_${cleanConsortiumText(obligationId, 80).replace(/[^a-zA-Z0-9_-]/g, "_")}_${suffix}`;
};
