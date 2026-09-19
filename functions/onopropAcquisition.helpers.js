export const ONOPROP_ACQUISITION_COUNTER_KEYS = Object.freeze([
    "searches",
    "zeroResultSearches",
    "resultsReturned",
    "propertyDetails",
    "startRequests",
    "detailViews",
    "favoriteAdds",
    "whatsappClicks",
    "emailClicks",
    "inquiries",
    "registrationsCompleted",
    "publicationStarts",
    "publicationsCompleted",
    "agencyOnboardingStarts",
    "agenciesCompleted",
    "appraisalRequestStarts",
    "appraisalRequestsCompleted",
    "commercialInterestStarts",
    "commercialLeadsSubmitted",
    "serviceContractsRequested",
    "serviceContractsActivated",
]);

export const ONOPROP_ACQUISITION_CONVERSION_COUNTERS = Object.freeze({
    registration_completed: "registrationsCompleted",
    publication_started: "publicationStarts",
    publication_completed: "publicationsCompleted",
    agency_onboarding_started: "agencyOnboardingStarts",
    agency_onboarding_completed: "agenciesCompleted",
    appraisal_request_started: "appraisalRequestStarts",
    appraisal_request_completed: "appraisalRequestsCompleted",
    commercial_interest_started: "commercialInterestStarts",
    commercial_lead_submitted: "commercialLeadsSubmitted",
    service_contract_requested: "serviceContractsRequested",
    service_contract_activated: "serviceContractsActivated",
});

export const ONOPROP_ACQUISITION_GOALS = Object.freeze([
    "publicar_inmueble",
    "sumar_inmobiliaria",
    "contratar_software",
    "solicitar_tasacion",
    "todas_las_opciones",
]);

const GOAL_SET = new Set(ONOPROP_ACQUISITION_GOALS);
const CONVERSION_TYPE_SET = new Set(
    Object.keys(ONOPROP_ACQUISITION_CONVERSION_COUNTERS),
);

export const cleanAcquisitionText = (value = "", maxLength = 160) => value
    ?.toString()
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength) || "";

export const normalizeAcquisitionDateKey = (value = "") => {
    const dateKey = cleanAcquisitionText(value, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return "";

    const parsed = new Date(`${dateKey}T12:00:00.000Z`);
    return Number.isFinite(parsed.getTime()) &&
        parsed.toISOString().slice(0, 10) === dateKey
        ? dateKey
        : "";
};

export const getAcquisitionDateKey = (date = new Date()) => {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Argentina/Buenos_Aires",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
};

export const getAcquisitionRangeDays = (fromKey, toKey) => {
    const from = new Date(`${fromKey}T12:00:00.000Z`).getTime();
    const to = new Date(`${toKey}T12:00:00.000Z`).getTime();
    if (!Number.isFinite(from) || !Number.isFinite(to)) return Number.POSITIVE_INFINITY;
    return Math.floor((to - from) / 86400000) + 1;
};

const normalizeInteger = (value, maximum = 100) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0) return null;
    return Math.min(maximum, Math.round(numeric));
};

export const normalizeAcquisitionSearch = (filters = {}) => ({
    operation: cleanAcquisitionText(filters.operation, 40).toLowerCase(),
    propertyType: cleanAcquisitionText(filters.property_type, 60).toLowerCase(),
    location: cleanAcquisitionText(filters.location, 120).toLowerCase(),
    locationScope: cleanAcquisitionText(filters.location_scope || "auto", 40).toLowerCase(),
    currency: cleanAcquisitionText(filters.currency, 10).toUpperCase(),
    minBedrooms: normalizeInteger(filters.min_bedrooms, 50),
    hasFreeText: Boolean(cleanAcquisitionText(filters.query, 200)),
});

export const buildAcquisitionSearchLabel = (search = {}) => {
    const parts = [
        search.operation,
        search.propertyType,
        search.location,
        search.minBedrooms === null || search.minBedrooms === undefined
            ? ""
            : `${search.minBedrooms}+ dorm.`,
        search.hasFreeText ? "con texto libre" : "",
    ].filter(Boolean);

    return parts.join(" · ") || "Búsqueda general";
};

export const normalizeAcquisitionGoal = (value = "") => {
    const goal = cleanAcquisitionText(value || "todas_las_opciones", 60).toLowerCase();
    return GOAL_SET.has(goal) ? goal : "todas_las_opciones";
};

export const normalizeAcquisitionConversionType = (value = "") => {
    const eventType = cleanAcquisitionText(value, 80).toLowerCase();
    return CONVERSION_TYPE_SET.has(eventType) ? eventType : "";
};

export const normalizeAcquisitionAttribution = (value = {}) => ({
    source: cleanAcquisitionText(value?.source, 40).toLowerCase(),
    medium: cleanAcquisitionText(value?.medium, 40).toLowerCase(),
    campaign: cleanAcquisitionText(value?.campaign, 80).toLowerCase(),
    content: cleanAcquisitionText(value?.content, 80).toLowerCase(),
});

export const isOnopropMcpAttribution = (value = {}) => {
    const attribution = normalizeAcquisitionAttribution(value);
    return attribution.source === "chatgpt" &&
        attribution.medium === "plugin" &&
        attribution.campaign === "onoprop_mcp";
};

export const normalizeAcquisitionCounters = (counters = {}) => (
    ONOPROP_ACQUISITION_COUNTER_KEYS.reduce((result, key) => {
        const value = Number(counters?.[key] || 0);
        result[key] = Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
        return result;
    }, {})
);

export const serializeAcquisitionRecord = (snapshot) => {
    const data = snapshot.data() || {};
    const minBedrooms = normalizeInteger(data.search?.minBedrooms, 50);

    return {
        id: snapshot.id,
        dateKey: cleanAcquisitionText(data.dateKey, 10),
        kind: cleanAcquisitionText(data.kind, 24),
        source: cleanAcquisitionText(data.source || "chatgpt_plugin", 40),
        goal: normalizeAcquisitionGoal(data.goal),
        conversionType: normalizeAcquisitionConversionType(data.conversionType),
        attributionContent: cleanAcquisitionText(data.attributionContent, 80),
        search: {
            operation: cleanAcquisitionText(data.search?.operation, 40),
            propertyType: cleanAcquisitionText(data.search?.propertyType, 60),
            location: cleanAcquisitionText(data.search?.location, 120),
            locationScope: cleanAcquisitionText(data.search?.locationScope, 40),
            currency: cleanAcquisitionText(data.search?.currency, 10),
            minBedrooms,
            hasFreeText: data.search?.hasFreeText === true,
        },
        counters: normalizeAcquisitionCounters(data.counters),
    };
};
