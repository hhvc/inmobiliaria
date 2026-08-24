export const PORTAL_INITIAL_FILTERS = Object.freeze({
    search: "",
    sourceType: "",
    operacion: "",
    tipo: "",
    ciudad: "",
    barrio: "",
    dormitoriosMin: "",
    banosMin: "",
    cocherasMin: "",
    superficieMin: "",
    precioMin: "",
    precioMax: "",
    piscina: "",
    patio: "",
    jardin: "",
    aptoCredito: "",
    video: "",
    sortBy: "destacados",
});

export const PORTAL_ADVANCED_FILTER_KEYS = Object.freeze([
    "sourceType",
    "ciudad",
    "barrio",
    "dormitoriosMin",
    "banosMin",
    "cocherasMin",
    "superficieMin",
    "precioMin",
    "precioMax",
    "piscina",
    "patio",
    "jardin",
    "aptoCredito",
    "video",
    "sortBy",
]);

export const getPortalFiltersFromSearchParams = (searchParams) => {
    const params = searchParams instanceof URLSearchParams
        ? searchParams
        : new URLSearchParams(searchParams || "");

    return Object.keys(PORTAL_INITIAL_FILTERS).reduce((filters, key) => {
        const defaultValue = PORTAL_INITIAL_FILTERS[key];
        filters[key] = params.get(key) || defaultValue;
        return filters;
    }, {});
};

export const getPortalSearchParamsFromFilters = (filters = {}) => {
    const params = new URLSearchParams();

    Object.entries({ ...PORTAL_INITIAL_FILTERS, ...filters }).forEach(
        ([key, value]) => {
            const normalizedValue = typeof value === "string" ? value.trim() : value;

            if (!normalizedValue) return;

            if (
                key === "sortBy" &&
                normalizedValue === PORTAL_INITIAL_FILTERS.sortBy
            ) {
                return;
            }

            params.set(key, normalizedValue.toString());
        },
    );

    return params;
};

export const hasAdvancedPortalFilters = (filters = {}) => {
    return PORTAL_ADVANCED_FILTER_KEYS.some((key) => {
        const value = filters[key];

        if (!value) return false;

        return !(
            key === "sortBy" &&
            value === PORTAL_INITIAL_FILTERS.sortBy
        );
    });
};

export const hasMeaningfulPortalSearch = (filters = {}) => {
    return Object.entries({ ...PORTAL_INITIAL_FILTERS, ...filters }).some(
        ([key, value]) => {
            if (key === "sortBy") return false;
            return Boolean(typeof value === "string" ? value.trim() : value);
        },
    );
};

export const mergePortalItems = (currentItems = [], newItems = []) => {
    const itemsByKey = new Map();

    [...currentItems, ...newItems].forEach((item) => {
        if (!item?.id) return;

        const key = `${item.sourceType || "inmobiliaria"}:${item.id}`;
        itemsByKey.set(key, item);
    });

    return Array.from(itemsByKey.values());
};
