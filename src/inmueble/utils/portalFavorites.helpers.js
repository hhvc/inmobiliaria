export const PORTAL_FAVORITES_STORAGE_KEY = "onoprop.portalFavorites.v1";
export const PORTAL_FAVORITES_CHANGED_EVENT = "onoprop:favorites-changed";
export const PORTAL_FAVORITES_LIMIT = 100;

const cleanText = (value = "", maxLength = 300) => value
    .toString()
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);

const getFirstImageUrl = (item = {}) => {
    if (item.coverImageUrl) return cleanText(item.coverImageUrl, 1000);
    if (!Array.isArray(item.images)) return "";

    const image = [...item.images]
        .filter((candidate) => candidate?.url || candidate?.thumbnailUrl)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))[0];

    return cleanText(image?.thumbnailUrl || image?.url || "", 1000);
};

const getLocationLabel = (item = {}) => {
    const direccion = item.direccion && typeof item.direccion === "object"
        ? item.direccion
        : {};

    return cleanText(
        item.locationLabel ||
        item.ubicacion ||
        [
            item.barrio || direccion.barrio,
            item.ciudad || item.localidad || direccion.ciudad,
        ].filter(Boolean).join(", ") ||
        "Ubicación a consultar",
    );
};

const getPriceLabel = (item = {}) => {
    if (item.priceLabel || item.precioLabel) {
        return cleanText(item.priceLabel || item.precioLabel);
    }

    const price = Number(item.precio || item.precioEstimado);

    if (!Number.isFinite(price) || price <= 0) return "Consultar precio";

    return `${cleanText(item.moneda || "USD", 10)} ${price.toLocaleString("es-AR")}`;
};

export const getPortalFavoriteKey = (item = {}) => {
    const id = cleanText(item.id || item.slug, 160);

    if (!id) return "";

    return `${item.sourceType === "particular" ? "particular" : "inmobiliaria"}:${id}`;
};

export const buildPortalFavoriteSnapshot = (item = {}, now = new Date()) => {
    const sourceType = item.sourceType === "particular"
        ? "particular"
        : "inmobiliaria";
    const id = cleanText(item.id || item.slug, 160);

    if (!id) return null;

    const addedAtDate = now instanceof Date ? now : new Date(now);

    return {
        key: `${sourceType}:${id}`,
        id,
        sourceType,
        publicPath: cleanText(
            item.publicPath || (sourceType === "particular"
                ? `/particulares/${id}`
                : `/inmueble/${item.slug || id}`),
            600,
        ),
        titulo: cleanText(item.titulo || item.ubicacion || "Inmueble publicado"),
        locationLabel: getLocationLabel(item),
        priceLabel: getPriceLabel(item),
        coverImageUrl: getFirstImageUrl(item),
        sourceLabel: cleanText(
            item.sourceLabel ||
            item.inmobiliariaNombre ||
            (sourceType === "particular" ? "Dueño particular" : "Inmobiliaria adherida"),
            160,
        ),
        addedAt: Number.isFinite(addedAtDate.getTime())
            ? addedAtDate.toISOString()
            : new Date().toISOString(),
    };
};

export const parsePortalFavorites = (rawValue) => {
    try {
        const parsed = typeof rawValue === "string" ? JSON.parse(rawValue) : rawValue;

        if (!Array.isArray(parsed)) return [];

        const unique = new Map();

        parsed.forEach((item) => {
            const snapshot = buildPortalFavoriteSnapshot(item, item?.addedAt || new Date());

            if (snapshot) unique.set(snapshot.key, snapshot);
        });

        return Array.from(unique.values()).slice(0, PORTAL_FAVORITES_LIMIT);
    } catch {
        return [];
    }
};

export const togglePortalFavorite = (favorites = [], item = {}, now = new Date()) => {
    const snapshot = buildPortalFavoriteSnapshot(item, now);

    if (!snapshot) return { favorites: parsePortalFavorites(favorites), added: false };

    const normalized = parsePortalFavorites(favorites);
    const exists = normalized.some((favorite) => favorite.key === snapshot.key);

    if (exists) {
        return {
            favorites: normalized.filter((favorite) => favorite.key !== snapshot.key),
            added: false,
        };
    }

    return {
        favorites: [snapshot, ...normalized].slice(0, PORTAL_FAVORITES_LIMIT),
        added: true,
    };
};
