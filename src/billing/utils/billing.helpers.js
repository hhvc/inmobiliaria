export const BILLING_RECURRENCE_OPTIONS = [
    { value: "once", label: "Por única vez" },
    { value: "weekly", label: "Semanal" },
    { value: "monthly", label: "Mensual" },
    { value: "quarterly", label: "Trimestral" },
    { value: "semiannual", label: "Semestral" },
    { value: "annual", label: "Anual" },
];

export const BILLING_CONTRACT_STATUS = {
    requested: "Solicitud pendiente",
    quoted: "Cotizado · pendiente de aceptación",
    accepted: "Cotización aceptada",
    pending_payment: "Pendiente de pago o confirmación",
    pending_setup: "Pendiente de configuración",
    active: "Activo",
    cancel_requested: "Baja solicitada",
    cancelled: "Cancelado",
    rejected: "Rechazado",
    suspended: "Suspendido",
};

export const BILLING_CONTRACT_BADGES = {
    requested: "text-bg-warning",
    quoted: "text-bg-info",
    accepted: "text-bg-primary",
    pending_payment: "text-bg-warning",
    pending_setup: "text-bg-info",
    active: "text-bg-success",
    cancel_requested: "text-bg-danger",
    cancelled: "text-bg-secondary",
    rejected: "text-bg-dark",
    suspended: "text-bg-danger",
};

export const BILLING_ENTRY_LABELS = {
    contract_charge: "Cargo de contratación",
    recurring_charge: "Cargo recurrente",
    payment: "Pago",
    manual_charge: "Cargo manual",
    manual_credit: "Crédito manual",
    adjustment_debit: "Ajuste débito",
    adjustment_credit: "Ajuste crédito",
    reversal: "Reversión",
};

export const formatMoneyMinor = (
    amountMinor = 0,
    currency = "ARS",
    locale = "es-AR",
) => {
    const amount = Number(amountMinor || 0) / 100;
    try {
        return new Intl.NumberFormat(locale, {
            style: "currency",
            currency: currency || "ARS",
            currencyDisplay: "symbol",
        }).format(amount);
    } catch {
        return `${currency || "ARS"} ${amount.toLocaleString(locale, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        })}`;
    }
};

export const majorAmountToMinor = (value) => {
    if (value === null || value === undefined || value === "") return null;
    let normalized = value.toString().trim().replace(/\s/g, "");
    if (normalized.includes(",") && normalized.includes(".")) {
        normalized = normalized.replace(/\./g, "").replace(",", ".");
    } else if (normalized.includes(",")) {
        normalized = normalized.replace(",", ".");
    }
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed) || parsed < 0) return null;
    return Math.round(parsed * 100);
};

export const minorAmountToMajorInput = (amountMinor) => {
    if (amountMinor === null || amountMinor === undefined) return "";
    return (Number(amountMinor) / 100).toString();
};

export const formatBillingDate = (value, { withTime = false } = {}) => {
    if (!value) return "-";
    const date = new Date(Number(value));
    if (Number.isNaN(date.getTime())) return "-";
    return new Intl.DateTimeFormat("es-AR", withTime
        ? { dateStyle: "short", timeStyle: "short" }
        : { dateStyle: "short" }).format(date);
};

export const getRecurrenceLabel = (recurrence = "once") => {
    return BILLING_RECURRENCE_OPTIONS.find(
        (item) => item.value === recurrence,
    )?.label || recurrence;
};

export const catalogItemRequiresQuote = (item = {}) => {
    return Array.isArray(item.pricing) && item.pricing.some(
        (price) => price.quoteRequired === true,
    );
};

export const getCatalogPricingSummary = (item = {}) => {
    const pricing = Array.isArray(item.pricing) ? item.pricing : [];
    if (pricing.length === 0) return ["Sin precio configurado"];
    return pricing.map((component) => {
        const price = component.quoteRequired
            ? "A convenir"
            : formatMoneyMinor(component.amountMinor, component.currency);
        return `${component.label}: ${price} · ${getRecurrenceLabel(component.recurrence)}`;
    });
};

export const getContractStatusLabel = (status = "requested") => {
    return BILLING_CONTRACT_STATUS[status] || status;
};

export const getContractBadgeClass = (status = "requested") => {
    return `badge ${BILLING_CONTRACT_BADGES[status] || "text-bg-secondary"}`;
};

export const buildEmptyCatalogItem = () => ({
    code: "",
    itemType: "service",
    name: "",
    description: "",
    active: true,
    displayOrder: 0,
    allowQuantity: false,
    unitLabel: "servicio",
    requirements: [],
    inclusions: [],
    moduleGrants: [],
    pricing: [
        {
            id: "cargo-inicial",
            label: "Cargo inicial",
            recurrence: "once",
            countryCode: "AR",
            currency: "ARS",
            quoteRequired: false,
            amountMajor: "",
        },
    ],
    benefits: [],
});

export const catalogItemToForm = (item = {}) => ({
    ...buildEmptyCatalogItem(),
    ...item,
    requirements: Array.isArray(item.requirements) ? item.requirements : [],
    inclusions: Array.isArray(item.inclusions) ? item.inclusions : [],
    moduleGrants: Array.isArray(item.moduleGrants) ? item.moduleGrants : [],
    pricing: (item.pricing || []).map((component) => ({
        ...component,
        amountMajor: minorAmountToMajorInput(component.amountMinor),
    })),
    benefits: Array.isArray(item.benefits) ? item.benefits : [],
});

export const catalogFormToPayload = (form = {}) => ({
    ...form,
    displayOrder: Math.trunc(Number(form.displayOrder || 0)),
    requirements: (form.requirements || []).filter((item) => item.label?.trim()),
    inclusions: (form.inclusions || []).map((item) => item.trim()).filter(Boolean),
    moduleGrants: (form.moduleGrants || []).map((item) => item.trim()).filter(Boolean),
    pricing: (form.pricing || []).map(({ amountMajor, ...component }) => ({
        ...component,
        amountMinor: component.quoteRequired
            ? null
            : majorAmountToMinor(amountMajor),
    })),
    benefits: (form.benefits || []).filter((item) => item.label?.trim()),
});
