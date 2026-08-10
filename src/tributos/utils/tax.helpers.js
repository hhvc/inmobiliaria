import {
  getTaxProvider,
  TAX_NOTIFICATION_DEFAULT_SETTINGS,
  TAX_OBLIGATION_STATUS_OPTIONS,
} from "./tax.constants.js";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_OBLIGATION_STATUSES = new Set(
  TAX_OBLIGATION_STATUS_OPTIONS.map((item) => item.id),
);

const cleanText = (value = "", maxLength = 500) => (
  value?.toString?.().trim().replace(/\s+/g, " ").slice(0, maxLength) || ""
);

const cleanIdentifier = (value = "") => (
  value?.toString?.().trim().replace(/\s+/g, " ").slice(0, 120) || ""
);

export const taxMajorToMinor = (value) => {
  if (typeof value === "number") return Math.max(0, Math.round(value * 100));
  const text = value?.toString?.().trim().replace(/\s/g, "") || "";
  if (!text) return 0;
  const normalized = text.includes(",")
    ? text.replace(/\./g, "").replace(",", ".")
    : text;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed * 100)) : 0;
};

export const taxMinorToMajorInput = (value = 0) => {
  const amount = Math.max(0, Math.round(Number(value) || 0)) / 100;
  return amount > 0 ? amount.toString() : "";
};

export const formatTaxMoney = (amountMinor = 0, currency = "ARS") => (
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: /^[A-Z]{3}$/.test(currency) ? currency : "ARS",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.max(0, Math.round(Number(amountMinor) || 0)) / 100)
);

export const isSafeOfficialUrl = (value = "") => {
  const text = cleanText(value, 1000);
  if (!text) return true;
  try {
    return new URL(text).protocol === "https:";
  } catch {
    return false;
  }
};

export const normalizeTaxNotificationEmails = (value = []) => {
  const source = Array.isArray(value)
    ? value
    : value?.toString?.().split(",") || [];
  return [...new Set(source
    .map((item) => cleanText(item, 254).toLowerCase())
    .filter((item) => EMAIL_PATTERN.test(item)))]
    .slice(0, 10);
};

export const normalizeTaxNotificationSettings = (value = {}) => ({
  ...TAX_NOTIFICATION_DEFAULT_SETTINGS,
  enabled: value.enabled !== false,
  inAppEnabled: value.inAppEnabled !== false,
  emailEnabled: value.emailEnabled === true,
  overdueAlert: value.overdueAlert !== false,
  recipientEmails: normalizeTaxNotificationEmails(value.recipientEmails),
  timezone: TAX_NOTIFICATION_DEFAULT_SETTINGS.timezone,
});

export const validateTaxNotificationSettings = (value = {}) => {
  const settings = normalizeTaxNotificationSettings(value);
  if (settings.emailEnabled && settings.recipientEmails.length === 0) {
    return ["Ingresá al menos un destinatario para activar el resumen por correo."];
  }
  return [];
};

const normalizeReminderDays = (value = [15, 5, 1]) => {
  const source = Array.isArray(value)
    ? value
    : value?.toString?.().split(",") || [];
  return Array.from(new Set(source
    .map((item) => Math.round(Number(item)))
    .filter((item) => item >= 0 && item <= 365)))
    .sort((a, b) => b - a);
};

export const normalizeTaxObject = (value = {}) => {
  const provider = getTaxProvider(value.providerId);
  const identifierType = provider.identifierTypes.some(
    (item) => item.id === value.identifierType,
  )
    ? value.identifierType
    : provider.identifierTypes[0]?.id || "account";
  return {
    schemaVersion: 1,
    providerId: provider.id,
    authority: {
      id: provider.id,
      name: cleanText(value.authority?.name || provider.authorityName, 160),
    },
    jurisdiction: {
      countryCode: "AR",
      level: cleanText(value.jurisdiction?.level || provider.jurisdictionLevel, 40),
      code: cleanText(value.jurisdiction?.code || provider.jurisdictionCode, 80),
    },
    taxType: cleanText(value.taxType || provider.taxType, 80),
    taxTypeLabel: cleanText(value.taxTypeLabel || provider.taxTypeLabel, 180),
    identifierType,
    identifier: cleanIdentifier(value.identifier),
    secondaryIdentifier: cleanIdentifier(value.secondaryIdentifier),
    inmuebleId: cleanText(value.inmuebleId, 128),
    inmuebleSnapshot: {
      title: cleanText(value.inmuebleSnapshot?.title, 220),
      address: cleanText(value.inmuebleSnapshot?.address, 300),
      propertyType: cleanText(value.inmuebleSnapshot?.propertyType, 100),
    },
    responsibleName: cleanText(value.responsibleName, 220),
    representation: {
      status: ["not_required", "pending", "authorized", "expired", "revoked"]
        .includes(value.representation?.status)
        ? value.representation.status
        : "not_required",
      reference: cleanText(value.representation?.reference, 220),
      validFrom: DATE_PATTERN.test(value.representation?.validFrom || "")
        ? value.representation.validFrom
        : "",
      validUntil: DATE_PATTERN.test(value.representation?.validUntil || "")
        ? value.representation.validUntil
        : "",
    },
    reminderDays: normalizeReminderDays(value.reminderDays),
    officialPortalUrl: cleanText(
      value.officialPortalUrl || provider.officialPortalUrl,
      1000,
    ),
    integration: {
      mode: cleanText(value.integration?.mode || provider.integrationMode, 40),
      status: cleanText(value.integration?.status || "not_connected", 40),
      lastCheckedAt: cleanText(value.integration?.lastCheckedAt, 40),
      externalObjectId: cleanIdentifier(value.integration?.externalObjectId),
    },
    notes: cleanText(value.notes, 1000),
    status: value.status === "archived" ? "archived" : "active",
  };
};

export const validateTaxObject = (value = {}) => {
  const item = normalizeTaxObject(value);
  const provider = getTaxProvider(item.providerId);
  const errors = [];
  if (!item.inmuebleId) errors.push("Seleccioná un inmueble cargado.");
  if (!item.identifier) errors.push(`Ingresá ${provider.identifierTypes[0]?.label?.toLowerCase() || "el identificador fiscal"}.`);
  if (!item.authority.name) errors.push("Informá el organismo recaudador.");
  if (!isSafeOfficialUrl(item.officialPortalUrl)) {
    errors.push("La URL oficial debe ser una dirección HTTPS válida.");
  }
  if (
    item.representation.validFrom &&
    item.representation.validUntil &&
    item.representation.validUntil < item.representation.validFrom
  ) {
    errors.push("La vigencia de la autorización no puede finalizar antes de comenzar.");
  }
  return errors;
};

export const resolveTaxObligationStatus = (
  value = {},
  todayKey = new Date().toISOString().slice(0, 10),
) => {
  const status = ALLOWED_OBLIGATION_STATUSES.has(value.status)
    ? value.status
    : "pending";
  if (["paid", "cancelled", "disputed", "payment_pending"].includes(status)) {
    return status;
  }
  return DATE_PATTERN.test(value.dueDate || "") && value.dueDate < todayKey
    ? "overdue"
    : "pending";
};

export const normalizeTaxObligation = (value = {}, todayKey) => {
  const normalized = {
    schemaVersion: 1,
    taxObjectId: cleanText(value.taxObjectId, 128),
    providerId: cleanText(value.providerId, 80),
    authorityName: cleanText(value.authorityName, 160),
    inmuebleId: cleanText(value.inmuebleId, 128),
    concept: cleanText(value.concept, 220),
    periodKey: PERIOD_PATTERN.test(value.periodKey || "") ? value.periodKey : "",
    dueDate: DATE_PATTERN.test(value.dueDate || "") ? value.dueDate : "",
    amountMinor: Math.max(0, Math.round(Number(value.amountMinor) || 0)),
    currency: /^[A-Z]{3}$/.test(value.currency || "") ? value.currency : "ARS",
    status: ALLOWED_OBLIGATION_STATUSES.has(value.status) ? value.status : "pending",
    source: ["manual", "import", "api"].includes(value.source) ? value.source : "manual",
    externalId: cleanIdentifier(value.externalId),
    officialDocumentUrl: cleanText(value.officialDocumentUrl, 1000),
    officialPaymentUrl: cleanText(value.officialPaymentUrl, 1000),
    notes: cleanText(value.notes, 1000),
    payment: {
      paidAt: DATE_PATTERN.test(value.payment?.paidAt || "") ? value.payment.paidAt : "",
      reference: cleanText(value.payment?.reference, 220),
      evidenceUrl: cleanText(value.payment?.evidenceUrl, 1000),
    },
  };
  normalized.status = resolveTaxObligationStatus(normalized, todayKey);
  return normalized;
};

export const validateTaxObligation = (value = {}) => {
  const item = normalizeTaxObligation(value);
  const errors = [];
  if (!item.taxObjectId) errors.push("Seleccioná el objeto fiscal.");
  if (!item.concept) errors.push("Ingresá el concepto de la obligación.");
  if (!item.periodKey) errors.push("Ingresá un período mensual válido.");
  if (!item.dueDate) errors.push("Ingresá una fecha de vencimiento válida.");
  if (!(item.amountMinor > 0)) errors.push("Ingresá un importe mayor a cero.");
  if (!isSafeOfficialUrl(item.officialDocumentUrl)) {
    errors.push("La URL del cedulón debe ser HTTPS.");
  }
  if (!isSafeOfficialUrl(item.officialPaymentUrl)) {
    errors.push("La URL de pago debe ser HTTPS.");
  }
  return errors;
};

export const summarizeTaxPortfolio = (
  taxObjects = [],
  obligations = [],
  todayKey = new Date().toISOString().slice(0, 10),
) => {
  const nextThirtyDays = new Date(`${todayKey}T12:00:00Z`);
  nextThirtyDays.setUTCDate(nextThirtyDays.getUTCDate() + 30);
  const limitKey = nextThirtyDays.toISOString().slice(0, 10);
  const activeObligations = obligations
    .map((item) => ({ ...item, status: resolveTaxObligationStatus(item, todayKey) }))
    .filter((item) => item.status !== "cancelled");
  const outstanding = activeObligations.filter((item) => item.status !== "paid");
  return {
    activeObjects: taxObjects.filter((item) => item.status !== "archived").length,
    pending: outstanding.filter((item) => item.status === "pending").length,
    overdue: outstanding.filter((item) => item.status === "overdue").length,
    dueSoon: outstanding.filter((item) => (
      item.dueDate >= todayKey && item.dueDate <= limitKey
    )).length,
    outstandingAmountMinor: outstanding.reduce(
      (sum, item) => sum + Math.max(0, Math.round(Number(item.amountMinor) || 0)),
      0,
    ),
  };
};
