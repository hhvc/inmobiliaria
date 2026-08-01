export const BILLING_RECURRENCES = new Set([
    "once",
    "weekly",
    "monthly",
    "quarterly",
    "semiannual",
    "annual",
]);

export const BILLING_CONTRACT_OPEN_STATUSES = new Set([
    "requested",
    "quoted",
    "accepted",
    "pending_payment",
    "pending_setup",
    "active",
    "cancel_requested",
    "suspended",
]);

export const cleanBillingText = (value = "", maxLength = 500) => {
    return value?.toString?.().trim().slice(0, maxLength) || "";
};

export const normalizeBillingCode = (value = "") => {
    return cleanBillingText(value, 80)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80);
};

export const normalizeCurrencyCode = (value = "ARS") => {
    const currency = cleanBillingText(value, 3).toUpperCase();
    return /^[A-Z]{3}$/.test(currency) ? currency : "ARS";
};

export const normalizeCountryCode = (value = "AR") => {
    const country = cleanBillingText(value, 2).toUpperCase();
    return /^[A-Z]{2}$/.test(country) ? country : "AR";
};

export const normalizeAmountMinor = (value, { nullable = false } = {}) => {
    if (nullable && (value === null || value === undefined || value === "")) {
        return null;
    }

    const amount = Number(value);
    if (!Number.isSafeInteger(amount) || amount < 0) return null;
    return amount;
};

const normalizeRecurrence = (value = "once") => {
    const recurrence = cleanBillingText(value, 20).toLowerCase();
    return BILLING_RECURRENCES.has(recurrence) ? recurrence : "once";
};

export const normalizePricingComponents = (components = []) => {
    if (!Array.isArray(components)) return [];

    const seen = new Set();
    return components.slice(0, 20).map((component = {}, index) => {
        const fallbackId = `price-${index + 1}`;
        let id = normalizeBillingCode(component.id || fallbackId) || fallbackId;
        while (seen.has(id)) id = `${id}-${index + 1}`;
        seen.add(id);

        const quoteRequired = component.quoteRequired === true;
        const amountMinor = quoteRequired
            ? null
            : normalizeAmountMinor(component.amountMinor);

        return {
            id,
            label:
                cleanBillingText(component.label, 120) ||
                (normalizeRecurrence(component.recurrence) === "once"
                    ? "Cargo único"
                    : "Abono recurrente"),
            recurrence: normalizeRecurrence(component.recurrence),
            countryCode: normalizeCountryCode(component.countryCode),
            currency: normalizeCurrencyCode(component.currency),
            quoteRequired,
            amountMinor,
        };
    });
};

export const normalizeCatalogBenefits = (benefits = []) => {
    if (!Array.isArray(benefits)) return [];

    return benefits.slice(0, 20).map((benefit = {}, index) => {
        const type = cleanBillingText(benefit.type, 50).toLowerCase();
        const grantMode = ["per_quantity", "recurring"].includes(
            benefit.grantMode,
        )
            ? benefit.grantMode
            : "per_quantity";

        return {
            id:
                normalizeBillingCode(benefit.id || `benefit-${index + 1}`) ||
                `benefit-${index + 1}`,
            type: type === "highlight_credits" ? type : "informational",
            label: cleanBillingText(benefit.label, 300),
            quantity: Math.max(
                0,
                Math.min(100000, Math.trunc(Number(benefit.quantity || 0))),
            ),
            grantMode,
            recurrence:
                grantMode === "recurring"
                    ? normalizeRecurrence(benefit.recurrence || "monthly")
                    : "once",
            rollover: benefit.rollover === true,
        };
    });
};

export const catalogPricingRequiresQuote = (pricing = []) => {
    return normalizePricingComponents(pricing).some(
        (component) => component.quoteRequired,
    );
};

const addMonthsUtc = (date, months) => {
    const originalDay = date.getUTCDate();
    const next = new Date(date.getTime());
    next.setUTCDate(1);
    next.setUTCMonth(next.getUTCMonth() + months);
    const daysInMonth = new Date(
        Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0),
    ).getUTCDate();
    next.setUTCDate(Math.min(originalDay, daysInMonth));
    return next;
};

export const addBillingIntervalMs = (timestampMs, recurrence) => {
    const date = new Date(Number(timestampMs));
    if (Number.isNaN(date.getTime())) return 0;

    switch (normalizeRecurrence(recurrence)) {
    case "weekly":
        return date.getTime() + 7 * 24 * 60 * 60 * 1000;
    case "monthly":
        return addMonthsUtc(date, 1).getTime();
    case "quarterly":
        return addMonthsUtc(date, 3).getTime();
    case "semiannual":
        return addMonthsUtc(date, 6).getTime();
    case "annual":
        return addMonthsUtc(date, 12).getTime();
    default:
        return 0;
    }
};

export const buildBillingPeriodKey = (timestampMs, recurrence = "monthly") => {
    const date = new Date(Number(timestampMs));
    if (Number.isNaN(date.getTime())) return "invalid";

    const datePart = date.toISOString().slice(0, 10).replaceAll("-", "");
    return `${normalizeRecurrence(recurrence)}-${datePart}`;
};

export const getNextBillingAtMs = (schedules = []) => {
    const values = schedules
        .map((schedule) => Number(schedule.nextBillingAtMs || 0))
        .filter((value) => Number.isFinite(value) && value > 0);
    return values.length ? Math.min(...values) : 0;
};

export const buildBillingSchedules = ({
    pricing = [],
    benefits = [],
    startAtMs = Date.now(),
} = {}) => {
    const schedules = normalizePricingComponents(pricing)
        .filter((component) => component.recurrence !== "once")
        .map((component) => ({
            componentId: component.id,
            recurrence: component.recurrence,
            nextBillingAtMs: addBillingIntervalMs(startAtMs, component.recurrence),
            cycle: 1,
        }));
    const scheduledRecurrences = new Set(
        schedules.map((schedule) => schedule.recurrence),
    );

    normalizeCatalogBenefits(benefits)
        .filter((benefit) => benefit.grantMode === "recurring")
        .forEach((benefit) => {
            if (scheduledRecurrences.has(benefit.recurrence)) return;
            schedules.push({
                componentId: `benefits-${benefit.recurrence}`,
                recurrence: benefit.recurrence,
                nextBillingAtMs: addBillingIntervalMs(
                    startAtMs,
                    benefit.recurrence,
                ),
                cycle: 1,
            });
            scheduledRecurrences.add(benefit.recurrence);
        });

    return schedules;
};

export const buildInitialBillingCatalog = () => [
    {
        id: "dominio-propio",
        code: "dominio-propio",
        itemType: "service",
        name: "Conectar dominio propio",
        description:
            "Conexión de un dominio de la inmobiliaria con su espacio público en ONO Prop.",
        active: true,
        displayOrder: 10,
        allowQuantity: false,
        unitLabel: "servicio",
        requirements: [
            {
                type: "external",
                label: "Dominio propio o contratación del dominio a través de ONO Prop.",
                catalogItemId: "",
            },
        ],
        inclusions: [
            "10 días de avisos destacados por cada ciclo mensual.",
            "Avisos ilimitados dentro del dominio propio.",
        ],
        moduleGrants: ["dominios"],
        pricing: [
            {
                id: "conexion-inicial",
                label: "Conexión inicial",
                recurrence: "once",
                countryCode: "AR",
                currency: "ARS",
                quoteRequired: false,
                amountMinor: 5000000,
            },
            {
                id: "mantenimiento-mensual",
                label: "Mantenimiento mensual",
                recurrence: "monthly",
                countryCode: "AR",
                currency: "ARS",
                quoteRequired: false,
                amountMinor: 1000000,
            },
        ],
        benefits: [
            {
                id: "destacados-mensuales",
                type: "highlight_credits",
                label: "10 créditos de 24 horas para destacar avisos",
                quantity: 10,
                grantMode: "recurring",
                recurrence: "monthly",
                rollover: false,
            },
        ],
    },
    {
        id: "personalizacion-web",
        code: "personalizacion-web",
        itemType: "service",
        name: "Personalización web propia",
        description:
            "Diseño y configuración personalizada del sitio de la inmobiliaria.",
        active: true,
        displayOrder: 20,
        allowQuantity: false,
        unitLabel: "servicio",
        requirements: [
            {
                type: "catalog_item",
                label: "Dominio propio conectado",
                catalogItemId: "dominio-propio",
            },
        ],
        inclusions: ["Alcance y entregables definidos en la cotización."],
        moduleGrants: ["branding"],
        pricing: [
            {
                id: "personalizacion-inicial",
                label: "Personalización inicial",
                recurrence: "once",
                countryCode: "AR",
                currency: "ARS",
                quoteRequired: true,
                amountMinor: null,
            },
            {
                id: "mantenimiento-personalizado",
                label: "Mantenimiento mensual",
                recurrence: "monthly",
                countryCode: "AR",
                currency: "ARS",
                quoteRequired: true,
                amountMinor: null,
            },
        ],
        benefits: [],
    },
    {
        id: "destacado-24h",
        code: "destacado-24h",
        itemType: "product",
        name: "Aviso destacado por 24 horas",
        description:
            "Crédito aplicable a un inmueble publicado en el portal ONO Prop.",
        active: true,
        displayOrder: 30,
        allowQuantity: true,
        unitLabel: "día destacado",
        requirements: [],
        inclusions: ["Cada unidad equivale a 24 horas de destaque."],
        moduleGrants: [],
        pricing: [
            {
                id: "credito-destacado",
                label: "Crédito de 24 horas",
                recurrence: "once",
                countryCode: "AR",
                currency: "ARS",
                quoteRequired: false,
                amountMinor: 100000,
            },
        ],
        benefits: [
            {
                id: "credito-destacado",
                type: "highlight_credits",
                label: "Crédito de 24 horas para destacar un aviso",
                quantity: 1,
                grantMode: "per_quantity",
                recurrence: "once",
                rollover: true,
            },
        ],
    },
    {
        id: "instagram-propio",
        code: "instagram-propio",
        itemType: "service",
        name: "Integración con Instagram propio",
        description:
            "Configuración para publicar desde ONO Prop en la cuenta profesional de la inmobiliaria.",
        active: true,
        displayOrder: 40,
        allowQuantity: false,
        unitLabel: "integración",
        requirements: [
            {
                type: "external",
                label: "Cuenta profesional de Instagram propia.",
                catalogItemId: "",
            },
        ],
        inclusions: ["Conexión y prueba inicial de publicación."],
        moduleGrants: ["instagram"],
        pricing: [
            {
                id: "integracion-instagram",
                label: "Integración inicial",
                recurrence: "once",
                countryCode: "AR",
                currency: "ARS",
                quoteRequired: true,
                amountMinor: null,
            },
        ],
        benefits: [],
    },
    {
        id: "mercadolibre-propio",
        code: "mercadolibre-propio",
        itemType: "service",
        name: "Integración con Mercado Libre propio",
        description:
            "Configuración para publicar y recibir leads desde la cuenta inmobiliaria de Mercado Libre.",
        active: true,
        displayOrder: 50,
        allowQuantity: false,
        unitLabel: "integración",
        requirements: [
            {
                type: "external",
                label: "Cuenta inmobiliaria habilitada en Mercado Libre.",
                catalogItemId: "",
            },
        ],
        inclusions: ["Conexión y prueba inicial de publicación y leads."],
        moduleGrants: ["mercadolibre"],
        pricing: [
            {
                id: "integracion-mercadolibre",
                label: "Integración inicial",
                recurrence: "once",
                countryCode: "AR",
                currency: "ARS",
                quoteRequired: true,
                amountMinor: null,
            },
        ],
        benefits: [],
    },
];
