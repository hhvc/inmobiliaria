export const PORTAL_PERFORMANCE_EVENT_COUNTERS = Object.freeze({
    detail_view: "detailViews",
    favorite_add: "favoriteAdds",
    whatsapp_click: "whatsappClicks",
    email_click: "emailClicks",
    inquiry_submitted: "inquiries",
});

export const PORTAL_PERFORMANCE_SOURCES = Object.freeze([
    "home",
    "search",
    "map",
    "agency_page",
    "friend_agency",
    "favorites",
    "direct",
]);

const SOURCE_SET = new Set(PORTAL_PERFORMANCE_SOURCES);

export const cleanPerformanceText = (value = "", maxLength = 160) => value
    .toString()
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);

export const normalizePerformanceSource = (value = "") => {
    const source = cleanPerformanceText(value, 40).toLowerCase();
    return SOURCE_SET.has(source) ? source : "direct";
};

export const normalizePerformanceDateKey = (value = "") => {
    const dateKey = cleanPerformanceText(value, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return "";

    const parsed = new Date(`${dateKey}T12:00:00.000Z`);
    return Number.isFinite(parsed.getTime()) &&
        parsed.toISOString().slice(0, 10) === dateKey
        ? dateKey
        : "";
};

export const getPortalPerformanceDateKey = (date = new Date()) => {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Argentina/Buenos_Aires",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
};

export const getDateRangeDays = (fromKey, toKey) => {
    const from = new Date(`${fromKey}T12:00:00.000Z`).getTime();
    const to = new Date(`${toKey}T12:00:00.000Z`).getTime();
    if (!Number.isFinite(from) || !Number.isFinite(to)) return Number.POSITIVE_INFINITY;
    return Math.floor((to - from) / 86400000) + 1;
};

const timestampMillis = (value) => {
    if (!value) return 0;
    if (typeof value.toMillis === "function") return value.toMillis();
    if (typeof value.toDate === "function") return value.toDate().getTime();
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
};

export const isActivePortalPromotion = (item = {}, now = Date.now()) => {
    const promotion = item.promotion || item.promo || null;

    if (promotion?.active === true) {
        const startsAt = timestampMillis(promotion.startsAt);
        const endsAt = timestampMillis(promotion.endsAt);
        if (startsAt && startsAt > now) return false;
        if (endsAt && endsAt < now) return false;
        return true;
    }

    return item.destacado === true;
};

export const normalizePerformanceCounters = (counters = {}) => Object.values(
    PORTAL_PERFORMANCE_EVENT_COUNTERS,
).reduce((result, key) => {
    const value = Number(counters?.[key] || 0);
    result[key] = Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
    return result;
}, {});

export const serializePerformanceRecord = (snapshot) => {
    const data = snapshot.data() || {};
    return {
        id: snapshot.id,
        dateKey: cleanPerformanceText(data.dateKey, 10),
        ownerAgencyId: cleanPerformanceText(data.ownerAgencyId, 128),
        presentationAgencyId: cleanPerformanceText(data.presentationAgencyId, 128),
        branchId: cleanPerformanceText(data.branchId, 128),
        inmuebleId: cleanPerformanceText(data.inmuebleId, 128),
        inmuebleSlug: cleanPerformanceText(data.inmuebleSlug, 180),
        inmuebleTitle: cleanPerformanceText(data.inmuebleTitle, 240),
        inmuebleType: cleanPerformanceText(data.inmuebleType, 80),
        inmuebleOperation: cleanPerformanceText(data.inmuebleOperation, 80),
        source: normalizePerformanceSource(data.source),
        promoted: data.promoted === true,
        counters: normalizePerformanceCounters(data.counters),
    };
};
