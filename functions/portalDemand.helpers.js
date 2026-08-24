export const PORTAL_ALERT_FILTER_KEYS = Object.freeze([
    "search",
    "sourceType",
    "operacion",
    "tipo",
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

const NUMBER_FILTER_KEYS = new Set([
    "dormitoriosMin",
    "banosMin",
    "cocherasMin",
    "superficieMin",
    "precioMin",
    "precioMax",
]);

const BOOLEAN_FILTER_KEYS = new Set([
    "piscina",
    "patio",
    "jardin",
    "aptoCredito",
    "video",
]);

const cleanText = (value = "", maxLength = 160) => value
    .toString()
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);

export const normalizePortalAlertEmail = (value = "") => cleanText(value, 254)
    .toLowerCase();

export const isValidPortalAlertEmail = (value = "") => {
    const email = normalizePortalAlertEmail(value);
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const normalizeNumberFilter = (value) => {
    if (value === "" || value === null || value === undefined) return "";

    const normalized = value.toString().replace(",", ".").trim();
    const number = Number(normalized);

    if (!Number.isFinite(number) || number < 0) return "";

    return number.toString();
};

export const normalizePortalAlertFilters = (filters = {}) => {
    const source = filters && typeof filters === "object" ? filters : {};

    return PORTAL_ALERT_FILTER_KEYS.reduce((result, key) => {
        if (NUMBER_FILTER_KEYS.has(key)) {
            result[key] = normalizeNumberFilter(source[key]);
            return result;
        }

        if (BOOLEAN_FILTER_KEYS.has(key)) {
            result[key] = source[key] === true || source[key] === "true" ? "true" : "";
            return result;
        }

        result[key] = cleanText(source[key], key === "search" ? 200 : 100);
        return result;
    }, {});
};

export const hasMeaningfulPortalAlertFilters = (filters = {}) => {
    const normalized = normalizePortalAlertFilters(filters);

    return PORTAL_ALERT_FILTER_KEYS.some((key) => (
        key !== "sortBy" && Boolean(normalized[key])
    ));
};

export const canonicalizePortalAlertFilters = (filters = {}) => {
    const normalized = normalizePortalAlertFilters(filters);

    return JSON.stringify(PORTAL_ALERT_FILTER_KEYS.reduce((result, key) => {
        if (key !== "sortBy" && normalized[key]) result[key] = normalized[key];
        return result;
    }, {}));
};

export const buildPortalAlertSearchQuery = (filters = {}) => {
    const normalized = normalizePortalAlertFilters(filters);
    const params = new URLSearchParams();

    PORTAL_ALERT_FILTER_KEYS.forEach((key) => {
        const value = normalized[key];

        if (!value || (key === "sortBy" && value === "destacados")) return;
        params.set(key, value);
    });

    return params.toString();
};

const normalizeComparableText = (value = "") => cleanText(value, 5000)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const toNumber = (value) => {
    if (value === "" || value === null || value === undefined) return null;

    const cleanValue = value.toString()
        .replace(/[^\d,.-]/g, "")
        .replace(/\./g, "")
        .replace(",", ".");
    const number = Number(cleanValue);

    return Number.isFinite(number) ? number : null;
};

const getAddressValue = (item, key) => item?.direccion?.[key] || item?.[key] || "";

const getFeatureNumber = (item, keys = []) => {
    for (const key of keys) {
        const candidates = [
            item?.[key],
            item?.caracteristicas?.[key],
            item?.superficie?.[key],
        ];
        const value = candidates.map(toNumber).find((candidate) => candidate !== null);

        if (value !== undefined) return value;
    }

    return null;
};

const hasAmenity = (item, key) => {
    const values = [
        item?.[key],
        item?.amenities?.[key],
        item?.caracteristicas?.[key],
        item?.servicios?.[key],
    ];

    return values.some((value) => value === true || value === "true" || value === "si");
};

const hasVideo = (item) => Array.isArray(item?.videos) && item.videos.some((video) => (
    video && video.status !== "deleted" && (video.url || video.downloadUrl || video.storagePath)
));

const matchesMinimum = (current, filter) => {
    const minimum = toNumber(filter);

    if (minimum === null) return true;
    return current !== null && current >= minimum;
};

export const portalItemMatchesAlert = (item = {}, filters = {}) => {
    const normalized = normalizePortalAlertFilters(filters);

    if (normalized.sourceType && item.sourceType !== normalized.sourceType) return false;
    if (normalized.operacion && item.operacion !== normalized.operacion) return false;
    if (normalized.tipo && item.tipo !== normalized.tipo) return false;

    if (
        normalized.ciudad &&
        normalizeComparableText(getAddressValue(item, "ciudad")) !==
        normalizeComparableText(normalized.ciudad)
    ) return false;

    if (
        normalized.barrio &&
        normalizeComparableText(getAddressValue(item, "barrio")) !==
        normalizeComparableText(normalized.barrio)
    ) return false;

    if (normalized.search) {
        const searchable = [
            item.titulo,
            item.descripcion,
            item.tipo,
            item.operacion,
            item.ubicacion,
            getAddressValue(item, "calle"),
            getAddressValue(item, "barrio"),
            getAddressValue(item, "ciudad"),
            getAddressValue(item, "provincia"),
        ].filter(Boolean).join(" ");

        if (!normalizeComparableText(searchable).includes(
            normalizeComparableText(normalized.search),
        )) return false;
    }

    const dormitorios = getFeatureNumber(item, ["dormitorios"]);
    const banos = getFeatureNumber(item, ["banos", "banios", "baños"]);
    const cocheras = getFeatureNumber(item, ["cocherasCantidad", "cocheras"]);
    const superficie = getFeatureNumber(item, [
        "total",
        "superficieTotal",
        "cubierta",
        "superficieCubierta",
        "terreno",
        "superficieTerreno",
    ]);

    if (!matchesMinimum(dormitorios, normalized.dormitoriosMin)) return false;
    if (!matchesMinimum(banos, normalized.banosMin)) return false;
    if (!matchesMinimum(cocheras, normalized.cocherasMin)) return false;
    if (!matchesMinimum(superficie, normalized.superficieMin)) return false;

    const price = toNumber(item.precio || item.precioEstimado);
    const priceMin = toNumber(normalized.precioMin);
    const priceMax = toNumber(normalized.precioMax);

    if (priceMin !== null && (price === null || price < priceMin)) return false;
    if (priceMax !== null && (price === null || price > priceMax)) return false;

    for (const key of BOOLEAN_FILTER_KEYS) {
        if (normalized[key] !== "true") continue;
        if (key === "video" ? !hasVideo(item) : !hasAmenity(item, key)) return false;
    }

    return true;
};

export const escapePortalAlertHtml = (value = "") => value.toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

export const getPortalItemDateMillis = (item = {}) => {
    const value = item.updatedAt || item.approvedAt || item.createdAt;

    if (!value) return 0;
    if (typeof value.toMillis === "function") return value.toMillis();
    if (typeof value.toDate === "function") return value.toDate().getTime();

    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date.getTime() : 0;
};
