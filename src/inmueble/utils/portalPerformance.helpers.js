export const PERFORMANCE_COUNTER_KEYS = Object.freeze([
    "detailViews",
    "favoriteAdds",
    "whatsappClicks",
    "emailClicks",
    "inquiries",
]);

export const PERFORMANCE_SOURCE_LABELS = Object.freeze({
    home: "Inicio",
    search: "Buscador",
    map: "Mapa",
    agency_page: "Página propia",
    friend_agency: "Inmobiliaria amiga",
    favorites: "Favoritos",
    direct: "Acceso directo",
});

export const createEmptyPerformanceCounters = () => ({
    detailViews: 0,
    favoriteAdds: 0,
    whatsappClicks: 0,
    emailClicks: 0,
    inquiries: 0,
});

export const addPerformanceCounters = (target, source = {}) => {
    PERFORMANCE_COUNTER_KEYS.forEach((key) => {
        const value = Number(source?.[key] || 0);
        target[key] += Number.isFinite(value) ? value : 0;
    });
    return target;
};

const totalContacts = (counters = {}) => (
    Number(counters.whatsappClicks || 0) +
    Number(counters.emailClicks || 0) +
    Number(counters.inquiries || 0)
);

export const filterPerformanceRecords = (records = [], filters = {}) => records.filter(
    (record) => {
        if (filters.branchId && record.branchId !== filters.branchId) return false;
        if (filters.inmuebleId && record.inmuebleId !== filters.inmuebleId) return false;
        if (filters.operation && record.inmuebleOperation !== filters.operation) return false;
        if (filters.promotion === "promoted" && record.promoted !== true) return false;
        if (filters.promotion === "organic" && record.promoted === true) return false;
        return true;
    },
);

export const aggregatePerformanceRecords = (records = []) => {
    const summary = createEmptyPerformanceCounters();
    const promoted = createEmptyPerformanceCounters();
    const organic = createEmptyPerformanceCounters();
    const properties = new Map();
    const daily = new Map();
    const sources = new Map();

    records.forEach((record) => {
        const counters = record?.counters || {};
        addPerformanceCounters(summary, counters);
        addPerformanceCounters(record.promoted ? promoted : organic, counters);

        const propertyKey = `${record.ownerAgencyId || ""}:${record.inmuebleId || ""}`;
        const property = properties.get(propertyKey) || {
            ownerAgencyId: record.ownerAgencyId || "",
            inmuebleId: record.inmuebleId || "",
            inmuebleSlug: record.inmuebleSlug || record.inmuebleId || "",
            inmuebleTitle: record.inmuebleTitle || "Inmueble publicado",
            inmuebleType: record.inmuebleType || "",
            inmuebleOperation: record.inmuebleOperation || "",
            promoted: false,
            counters: createEmptyPerformanceCounters(),
        };
        property.promoted = property.promoted || record.promoted === true;
        addPerformanceCounters(property.counters, counters);
        properties.set(propertyKey, property);

        const day = daily.get(record.dateKey) || {
            dateKey: record.dateKey,
            counters: createEmptyPerformanceCounters(),
        };
        addPerformanceCounters(day.counters, counters);
        daily.set(record.dateKey, day);

        const sourceKey = record.source || "direct";
        const source = sources.get(sourceKey) || {
            source: sourceKey,
            label: PERFORMANCE_SOURCE_LABELS[sourceKey] || sourceKey,
            counters: createEmptyPerformanceCounters(),
        };
        addPerformanceCounters(source.counters, counters);
        sources.set(sourceKey, source);
    });

    const rankedProperties = [...properties.values()]
        .map((item) => ({
            ...item,
            contacts: totalContacts(item.counters),
            conversionRate: item.counters.detailViews > 0
                ? (totalContacts(item.counters) / item.counters.detailViews) * 100
                : 0,
        }))
        .sort((a, b) => (
            b.contacts - a.contacts ||
            b.counters.detailViews - a.counters.detailViews
        ));

    return {
        summary: {
            ...summary,
            contacts: totalContacts(summary),
            conversionRate: summary.detailViews > 0
                ? (totalContacts(summary) / summary.detailViews) * 100
                : 0,
        },
        comparison: {
            promoted: { ...promoted, contacts: totalContacts(promoted) },
            organic: { ...organic, contacts: totalContacts(organic) },
        },
        properties: rankedProperties,
        daily: [...daily.values()].sort((a, b) => a.dateKey.localeCompare(b.dateKey)),
        sources: [...sources.values()].sort((a, b) => (
            b.counters.detailViews - a.counters.detailViews
        )),
    };
};

const escapeCsvCell = (value) => {
    const text = value === null || value === undefined ? "" : value.toString();
    return `"${text.replace(/"/g, '""')}"`;
};

export const buildPerformanceCsv = (properties = []) => {
    const rows = [[
        "Inmueble",
        "Tipo",
        "Operación",
        "Con destaque",
        "Visitas al detalle",
        "Favoritos",
        "WhatsApp",
        "Email",
        "Consultas",
        "Contactos totales",
        "Conversión",
    ]];

    properties.forEach((item) => rows.push([
        item.inmuebleTitle,
        item.inmuebleType,
        item.inmuebleOperation,
        item.promoted ? "Sí" : "No",
        item.counters.detailViews,
        item.counters.favoriteAdds,
        item.counters.whatsappClicks,
        item.counters.emailClicks,
        item.counters.inquiries,
        item.contacts,
        `${item.conversionRate.toFixed(2)}%`,
    ]));

    return `\uFEFF${rows.map((row) => row.map(escapeCsvCell).join(";")).join("\n")}`;
};
