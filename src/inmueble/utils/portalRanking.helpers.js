import {
    getBanos,
    getCocherasCantidad,
    getDormitorios,
    getInmuebleAmenityBadges,
    getSuperficiePrincipal,
    hasCochera,
} from "./inmuebleDisplay.helpers";
import { getVisibleInmuebleVideos } from "./inmuebleVideos.helpers";

export const DEFAULT_PORTAL_RANKING_CONFIG = {
    version: 1,
    enabled: true,

    labels: {
        defaultSortLabel: "Relevancia",
    },

    paidPromotion: {
        enabled: true,
        premium: 1000000,
        destacado: 500000,
        simple: 250000,
        legacyDestacado: 300000,
    },

    sourcePriority: {
        inmobiliaria: 100000,
        particular: 0,
    },

    quality: {
        enabled: true,

        photos: {
            enabled: true,
            minCount: 8,
            maxScore: 2000,
        },

        video: {
            enabled: true,
            maxScore: 1500,
        },

        price: {
            enabled: true,
            maxScore: 1500,
        },

        location: {
            enabled: true,
            maxScore: 1500,
        },

        features: {
            enabled: true,
            maxScore: 1500,
        },

        description: {
            enabled: true,
            minLength: 180,
            maxScore: 1000,
        },

        amenities: {
            enabled: true,
            minCount: 3,
            maxScore: 1000,
        },
    },

    recency: {
        enabled: true,

        updatedAt: {
            enabled: true,
            maxScore: 5000,
            daysWindow: 90,
        },

        createdAt: {
            enabled: true,
            maxScore: 3000,
            daysWindow: 120,
        },
    },
};

const clamp = (value, min, max) => {
    return Math.max(min, Math.min(max, value));
};

const toNumber = (value) => {
    if (value === null || value === undefined || value === "") return null;

    const number = Number(value);

    return Number.isFinite(number) ? number : null;
};

const getDateValue = (value) => {
    if (!value) return 0;

    if (typeof value.toDate === "function") {
        return value.toDate().getTime();
    }

    const date = value instanceof Date ? value : new Date(value);

    return Number.isFinite(date.getTime()) ? date.getTime() : 0;
};

const mergeDeep = (base, override) => {
    if (!override || typeof override !== "object") return base;

    return Object.entries(override).reduce(
        (acc, [key, value]) => {
            if (
                value &&
                typeof value === "object" &&
                !Array.isArray(value) &&
                acc[key] &&
                typeof acc[key] === "object" &&
                !Array.isArray(acc[key])
            ) {
                acc[key] = mergeDeep(acc[key], value);
            } else {
                acc[key] = value;
            }

            return acc;
        },
        { ...base },
    );
};

export const mergePortalRankingConfig = (config = {}) => {
    return mergeDeep(DEFAULT_PORTAL_RANKING_CONFIG, config);
};

const getPhotoCount = (item = {}) => {
    if (!Array.isArray(item.images)) return 0;

    return item.images.filter((image) => image?.url).length;
};

const getAmenityCount = (item = {}) => {
    return getInmuebleAmenityBadges(item, 50).length;
};

const hasPrice = (item = {}) => {
    return Boolean(item.precio || item.precioLabel || item.precioEstimado);
};

const hasLocation = (item = {}) => {
    return Boolean(
        item.ubicacion ||
        item.ciudad ||
        item.barrio ||
        item.direccion?.ciudad ||
        item.direccion?.barrio,
    );
};

const hasEnoughFeatures = (item = {}) => {
    const dormitorios = toNumber(getDormitorios(item));
    const banos = toNumber(getBanos(item));
    const cocherasCantidad = toNumber(getCocherasCantidad(item));
    const superficie = toNumber(getSuperficiePrincipal(item));

    return Boolean(
        dormitorios ||
        banos ||
        cocherasCantidad ||
        hasCochera(item) ||
        superficie,
    );
};

const getTextLength = (value = "") => {
    return value.toString().replace(/\s+/g, " ").trim().length;
};

const getRatioScore = ({ currentValue, targetValue, maxScore }) => {
    const current = toNumber(currentValue) || 0;
    const target = toNumber(targetValue) || 1;

    if (target <= 0) return 0;

    return Math.round(clamp(current / target, 0, 1) * maxScore);
};

const getBooleanScore = ({ condition, maxScore }) => {
    return condition ? maxScore : 0;
};

const getRecencyScore = ({ dateValue, maxScore, daysWindow }) => {
    const timestamp = getDateValue(dateValue);

    if (!timestamp) return 0;

    const now = Date.now();
    const ageMs = Math.max(0, now - timestamp);
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    const windowDays = toNumber(daysWindow) || 1;

    const ratio = 1 - clamp(ageDays / windowDays, 0, 1);

    return Math.round(ratio * maxScore);
};

const isPromotionActive = (item = {}) => {
    const promotion = item.promotion || item.promo || null;

    if (!promotion || promotion.active !== true) return false;

    const now = Date.now();
    const startsAt = getDateValue(promotion.startsAt);
    const endsAt = getDateValue(promotion.endsAt);

    if (startsAt && startsAt > now) return false;
    if (endsAt && endsAt < now) return false;

    return true;
};

export const getPaidPromotionScore = (
    item = {},
    config = DEFAULT_PORTAL_RANKING_CONFIG,
) => {
    const paidConfig = config.paidPromotion || {};

    if (paidConfig.enabled === false) return 0;

    if (isPromotionActive(item)) {
        const promotion = item.promotion || item.promo || {};
        const plan = promotion.plan || "destacado";
        const explicitPriority = toNumber(promotion.priority);

        if (explicitPriority !== null) {
            return explicitPriority;
        }

        return toNumber(paidConfig[plan]) || toNumber(paidConfig.destacado) || 0;
    }

    if (item.destacado === true) {
        return toNumber(paidConfig.legacyDestacado) || 0;
    }

    return 0;
};

export const getSourcePriorityScore = (
    item = {},
    config = DEFAULT_PORTAL_RANKING_CONFIG,
) => {
    const sourceConfig = config.sourcePriority || {};

    if (item.sourceType === "inmobiliaria") {
        return toNumber(sourceConfig.inmobiliaria) || 0;
    }

    if (item.sourceType === "particular") {
        return toNumber(sourceConfig.particular) || 0;
    }

    return 0;
};

export const getQualityScore = (
    item = {},
    config = DEFAULT_PORTAL_RANKING_CONFIG,
) => {
    const qualityConfig = config.quality || {};

    if (qualityConfig.enabled === false) return 0;

    let score = 0;

    const photoCount = getPhotoCount(item);
    const videoCount = getVisibleInmuebleVideos(item.videos || []).length;
    const amenityCount = getAmenityCount(item);
    const descriptionLength = getTextLength(item.descripcion);

    if (qualityConfig.photos?.enabled !== false) {
        score += getRatioScore({
            currentValue: photoCount,
            targetValue: qualityConfig.photos?.minCount,
            maxScore: toNumber(qualityConfig.photos?.maxScore) || 0,
        });
    }

    if (qualityConfig.video?.enabled !== false) {
        score += getBooleanScore({
            condition: videoCount > 0,
            maxScore: toNumber(qualityConfig.video?.maxScore) || 0,
        });
    }

    if (qualityConfig.price?.enabled !== false) {
        score += getBooleanScore({
            condition: hasPrice(item),
            maxScore: toNumber(qualityConfig.price?.maxScore) || 0,
        });
    }

    if (qualityConfig.location?.enabled !== false) {
        score += getBooleanScore({
            condition: hasLocation(item),
            maxScore: toNumber(qualityConfig.location?.maxScore) || 0,
        });
    }

    if (qualityConfig.features?.enabled !== false) {
        score += getBooleanScore({
            condition: hasEnoughFeatures(item),
            maxScore: toNumber(qualityConfig.features?.maxScore) || 0,
        });
    }

    if (qualityConfig.description?.enabled !== false) {
        score += getRatioScore({
            currentValue: descriptionLength,
            targetValue: qualityConfig.description?.minLength,
            maxScore: toNumber(qualityConfig.description?.maxScore) || 0,
        });
    }

    if (qualityConfig.amenities?.enabled !== false) {
        score += getRatioScore({
            currentValue: amenityCount,
            targetValue: qualityConfig.amenities?.minCount,
            maxScore: toNumber(qualityConfig.amenities?.maxScore) || 0,
        });
    }

    return Math.round(score);
};

export const getRecencyRankingScore = (
    item = {},
    config = DEFAULT_PORTAL_RANKING_CONFIG,
) => {
    const recencyConfig = config.recency || {};

    if (recencyConfig.enabled === false) return 0;

    let score = 0;

    if (recencyConfig.updatedAt?.enabled !== false) {
        score += getRecencyScore({
            dateValue: item.updatedAt,
            maxScore: toNumber(recencyConfig.updatedAt?.maxScore) || 0,
            daysWindow: toNumber(recencyConfig.updatedAt?.daysWindow) || 90,
        });
    }

    if (recencyConfig.createdAt?.enabled !== false) {
        score += getRecencyScore({
            dateValue: item.createdAt,
            maxScore: toNumber(recencyConfig.createdAt?.maxScore) || 0,
            daysWindow: toNumber(recencyConfig.createdAt?.daysWindow) || 120,
        });
    }

    return Math.round(score);
};

export const getPortalRankingScore = (
    item = {},
    config = DEFAULT_PORTAL_RANKING_CONFIG,
) => {
    const safeConfig = mergePortalRankingConfig(config);

    const paidScore = getPaidPromotionScore(item, safeConfig);
    const sourceScore = getSourcePriorityScore(item, safeConfig);
    const qualityScore = getQualityScore(item, safeConfig);
    const recencyScore = getRecencyRankingScore(item, safeConfig);

    return {
        paidScore,
        sourceScore,
        qualityScore,
        recencyScore,
        totalScore: paidScore + sourceScore + qualityScore + recencyScore,
    };
};

export const sortPortalItemsByRelevance = (
    items = [],
    config = DEFAULT_PORTAL_RANKING_CONFIG,
) => {
    const safeConfig = mergePortalRankingConfig(config);

    return [...items].sort((a, b) => {
        const scoreA = getPortalRankingScore(a, safeConfig);
        const scoreB = getPortalRankingScore(b, safeConfig);

        if (scoreA.totalScore !== scoreB.totalScore) {
            return scoreB.totalScore - scoreA.totalScore;
        }

        const updatedDiff = getDateValue(b.updatedAt) - getDateValue(a.updatedAt);

        if (updatedDiff !== 0) return updatedDiff;

        return getDateValue(b.createdAt) - getDateValue(a.createdAt);
    });
};