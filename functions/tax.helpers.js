const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const TAX_TIME_ZONE = "America/Argentina/Buenos_Aires";

export const DEFAULT_TAX_NOTIFICATION_SETTINGS = Object.freeze({
    enabled: true,
    inAppEnabled: true,
    emailEnabled: false,
    overdueAlert: true,
    recipientEmails: [],
    timezone: TAX_TIME_ZONE,
});

const cleanText = (value = "", maxLength = 500) => (
    value?.toString?.().trim().replace(/\s+/g, " ").slice(0, maxLength) || ""
);

export const normalizeTaxNotificationEmails = (value = []) => {
    const source = Array.isArray(value) ? value : value?.toString?.().split(",") || [];
    return [...new Set(source
        .map((item) => cleanText(item, 254).toLowerCase())
        .filter((item) => EMAIL_PATTERN.test(item)))]
        .slice(0, 10);
};
export const normalizeTaxNotificationSettings = (value = {}) => ({
    enabled: value.enabled !== false,
    inAppEnabled: value.inAppEnabled !== false,
    emailEnabled: value.emailEnabled === true,
    overdueAlert: value.overdueAlert !== false,
    recipientEmails: normalizeTaxNotificationEmails(value.recipientEmails),
    timezone: TAX_TIME_ZONE,
});

export const dateKeyInTimeZone = (
    nowMs = Date.now(),
    timezone = TAX_TIME_ZONE,
) => {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(new Date(nowMs));
    const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${byType.year}-${byType.month}-${byType.day}`;
};

const dateKeyToUtcMs = (value = "") => {
    if (!DATE_KEY_PATTERN.test(value)) return NaN;
    const [year, month, day] = value.split("-").map(Number);
    return Date.UTC(year, month - 1, day);
};

export const addDaysToDateKey = (value, days) => {
    const dateMs = dateKeyToUtcMs(value);
    if (!Number.isFinite(dateMs)) return "";
    return new Date(dateMs + Math.round(Number(days) || 0) * 86400000)
        .toISOString()
        .slice(0, 10);
};

export const differenceInDateKeys = (fromDateKey, toDateKey) => {
    const fromMs = dateKeyToUtcMs(fromDateKey);
    const toMs = dateKeyToUtcMs(toDateKey);
    if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) return null;
    return Math.round((toMs - fromMs) / 86400000);
};

const normalizeReminderDays = (value = []) => [...new Set(
    (Array.isArray(value) ? value : [])
        .map((item) => Math.round(Number(item)))
        .filter((item) => item >= 0 && item <= 365),
)];

const normalizeAmountMinor = (value) => Math.max(
    0,
    Math.round(Number(value) || 0),
);

export const formatTaxNotificationAmount = (
    amountMinor = 0,
    currency = "ARS",
) => new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: /^[A-Z]{3}$/.test(currency) ? currency : "ARS",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
}).format(normalizeAmountMinor(amountMinor) / 100);

const buildNotificationId = (obligationId, suffix) => (
    `${cleanText(obligationId, 128).replace(/[^A-Za-z0-9_-]/g, "_")}__${suffix}`
);

export const buildTaxDueAlert = ({
    obligation = {},
    taxObject = {},
    todayDateKey,
    settings = {},
} = {}) => {
    if (!DATE_KEY_PATTERN.test(todayDateKey || "")) return null;
    if (!DATE_KEY_PATTERN.test(obligation.dueDate || "")) return null;
    if (!obligation.id || !obligation.taxObjectId) return null;
    if (!["pending", "overdue"].includes(obligation.status)) return null;

    const normalizedSettings = normalizeTaxNotificationSettings(settings);
    if (!normalizedSettings.enabled || !normalizedSettings.inAppEnabled) return null;

    const daysUntilDue = differenceInDateKeys(todayDateKey, obligation.dueDate);
    if (daysUntilDue === null) return null;

    let type;
    let notificationId;
    let title;
    let message;

    const propertyLabel = cleanText(
        taxObject.inmuebleSnapshot?.title || taxObject.inmuebleSnapshot?.address,
        180,
    ) || "Inmueble vinculado";
    const concept = cleanText(obligation.concept, 180) || "Obligación tributaria";
    const amount = formatTaxNotificationAmount(
        obligation.amountMinor,
        obligation.currency,
    );

    if (daysUntilDue < 0) {
        if (!normalizedSettings.overdueAlert) return null;
        const daysOverdue = Math.abs(daysUntilDue);
        type = "tax_overdue";
        notificationId = buildNotificationId(obligation.id, "overdue");
        title = `Obligación vencida: ${propertyLabel}`;
        message = `${concept} por ${amount} venció hace ${daysOverdue} ${
            daysOverdue === 1 ? "día" : "días"
        }.`;
    } else {
        const reminderDays = normalizeReminderDays(taxObject.reminderDays);
        if (!reminderDays.includes(daysUntilDue)) return null;
        type = daysUntilDue === 0 ? "tax_due_today" : "tax_due_reminder";
        notificationId = buildNotificationId(
            obligation.id,
            `due_${daysUntilDue}`,
        );
        title = daysUntilDue === 0
            ? `Vence hoy: ${propertyLabel}`
            : `Próximo vencimiento: ${propertyLabel}`;
        message = daysUntilDue === 0
            ? `${concept} por ${amount} vence hoy.`
            : `${concept} por ${amount} vence en ${daysUntilDue} ${
                daysUntilDue === 1 ? "día" : "días"
            }.`;
    }

    return {
        id: notificationId,
        type,
        title,
        message,
        obligationId: obligation.id,
        taxObjectId: obligation.taxObjectId,
        inmuebleId: obligation.inmuebleId || taxObject.inmuebleId || "",
        dueDate: obligation.dueDate,
        amountMinor: normalizeAmountMinor(obligation.amountMinor),
        currency: /^[A-Z]{3}$/.test(obligation.currency || "")
            ? obligation.currency
            : "ARS",
        daysUntilDue,
        providerId: obligation.providerId || taxObject.providerId || "",
        concept,
        propertyLabel,
    };
};
