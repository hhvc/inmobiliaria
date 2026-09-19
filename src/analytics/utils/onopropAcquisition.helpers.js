export const ACQUISITION_COUNTER_KEYS = Object.freeze([
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

export const ACQUISITION_GOAL_LABELS = Object.freeze({
    publicar_inmueble: "Publicar un inmueble",
    sumar_inmobiliaria: "Sumar una inmobiliaria",
    contratar_software: "Conocer o contratar servicios",
    solicitar_tasacion: "Solicitar una tasación",
    todas_las_opciones: "Explorar todas las opciones",
    property_listing: "Ficha de inmueble",
    sin_contenido: "Recorrido general",
});

export const ACQUISITION_CONVERSION_LABELS = Object.freeze({
    registration_completed: "Cuenta creada",
    publication_started: "Publicación iniciada",
    publication_completed: "Solicitud de publicación enviada",
    agency_onboarding_started: "Alta de inmobiliaria iniciada",
    agency_onboarding_completed: "Inmobiliaria creada",
    appraisal_request_started: "Solicitud de tasación iniciada",
    appraisal_request_completed: "Solicitud de tasación enviada",
    commercial_interest_started: "Recorrido comercial iniciado",
    commercial_lead_submitted: "Consulta comercial enviada",
    service_contract_requested: "Contratación solicitada",
    service_contract_activated: "Servicio activado",
});

export const createEmptyAcquisitionCounters = () => (
    Object.fromEntries(ACQUISITION_COUNTER_KEYS.map((key) => [key, 0]))
);

const addCounters = (target, source = {}) => {
    ACQUISITION_COUNTER_KEYS.forEach((key) => {
        target[key] += Number(source?.[key] || 0);
    });
};

const totalContacts = (counters = {}) => (
    Number(counters.whatsappClicks || 0) +
    Number(counters.emailClicks || 0) +
    Number(counters.inquiries || 0)
);

const searchKey = (search = {}) => JSON.stringify([
    search.operation || "",
    search.propertyType || "",
    search.location || "",
    search.locationScope || "",
    search.currency || "",
    search.minBedrooms ?? "",
    search.hasFreeText === true,
]);

export const formatAcquisitionSearch = (search = {}) => {
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

export const aggregateAcquisitionRecords = (records = []) => {
    const summary = createEmptyAcquisitionCounters();
    const daily = new Map();
    const searches = new Map();
    const goals = new Map();
    const conversions = new Map();

    records.forEach((record) => {
        if (record.kind === "summary") {
            addCounters(summary, record.counters);
            if (!daily.has(record.dateKey)) {
                daily.set(record.dateKey, {
                    dateKey: record.dateKey,
                    counters: createEmptyAcquisitionCounters(),
                });
            }
            addCounters(daily.get(record.dateKey).counters, record.counters);
        }

        if (record.kind === "search") {
            const key = searchKey(record.search);
            if (!searches.has(key)) {
                searches.set(key, {
                    search: record.search || {},
                    label: formatAcquisitionSearch(record.search),
                    counters: createEmptyAcquisitionCounters(),
                });
            }
            addCounters(searches.get(key).counters, record.counters);
        }

        if (record.kind === "goal") {
            const goal = record.goal || "todas_las_opciones";
            if (!goals.has(goal)) {
                goals.set(goal, {
                    goal,
                    label: ACQUISITION_GOAL_LABELS[goal] || goal,
                    requests: 0,
                });
            }
            goals.get(goal).requests += Number(record.counters?.startRequests || 0);
        }

        if (record.kind === "conversion" && record.conversionType) {
            const content = record.attributionContent || "sin_contenido";
            const key = `${record.conversionType}:${content}`;
            if (!conversions.has(key)) {
                conversions.set(key, {
                    conversionType: record.conversionType,
                    label: ACQUISITION_CONVERSION_LABELS[record.conversionType] ||
                        record.conversionType,
                    attributionContent: content,
                    goalLabel: ACQUISITION_GOAL_LABELS[content] || content,
                    counters: createEmptyAcquisitionCounters(),
                    total: 0,
                });
            }
            const item = conversions.get(key);
            addCounters(item.counters, record.counters);
            item.total += ACQUISITION_COUNTER_KEYS.reduce(
                (sum, counterKey) => sum + Number(record.counters?.[counterKey] || 0),
                0,
            );
        }
    });

    const contacts = totalContacts(summary);
    const averageResults = summary.searches > 0
        ? summary.resultsReturned / summary.searches
        : 0;
    const zeroResultRate = summary.searches > 0
        ? (summary.zeroResultSearches / summary.searches) * 100
        : 0;
    const listingOpenRate = summary.searches > 0
        ? (summary.detailViews / summary.searches) * 100
        : 0;
    const contactRate = summary.detailViews > 0
        ? (contacts / summary.detailViews) * 100
        : 0;
    const journeyStarts = summary.publicationStarts +
        summary.agencyOnboardingStarts +
        summary.appraisalRequestStarts +
        summary.commercialInterestStarts;
    const completedOutcomes = summary.publicationsCompleted +
        summary.agenciesCompleted +
        summary.appraisalRequestsCompleted +
        summary.commercialLeadsSubmitted +
        summary.serviceContractsRequested;
    const journeyCompletionRate = journeyStarts > 0
        ? (completedOutcomes / journeyStarts) * 100
        : 0;

    return {
        summary: {
            ...summary,
            contacts,
            averageResults,
            zeroResultRate,
            listingOpenRate,
            contactRate,
            journeyStarts,
            completedOutcomes,
            journeyCompletionRate,
        },
        daily: [...daily.values()].sort((a, b) => a.dateKey.localeCompare(b.dateKey)),
        searches: [...searches.values()].sort((a, b) => (
            b.counters.searches - a.counters.searches ||
            b.counters.zeroResultSearches - a.counters.zeroResultSearches
        )),
        zeroResultSearches: [...searches.values()]
            .filter((item) => item.counters.zeroResultSearches > 0)
            .sort((a, b) => (
                b.counters.zeroResultSearches - a.counters.zeroResultSearches ||
                b.counters.searches - a.counters.searches
            )),
        goals: [...goals.values()].sort((a, b) => b.requests - a.requests),
        conversions: [...conversions.values()].sort((a, b) => (
            b.total - a.total || a.label.localeCompare(b.label, "es")
        )),
    };
};

const csvEscape = (value) => {
    const text = String(value ?? "");
    return /[";,\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export const buildAcquisitionSearchCsv = (searches = []) => {
    const header = [
        "Búsqueda agregada",
        "Operación",
        "Tipo",
        "Localidad o zona",
        "Dormitorios mínimos",
        "Búsquedas",
        "Sin resultados",
        "Resultados devueltos",
    ];
    const rows = searches.map((item) => [
        item.label,
        item.search.operation,
        item.search.propertyType,
        item.search.location,
        item.search.minBedrooms ?? "",
        item.counters.searches,
        item.counters.zeroResultSearches,
        item.counters.resultsReturned,
    ]);

    return [header, ...rows]
        .map((row) => row.map(csvEscape).join(";"))
        .join("\n");
};
