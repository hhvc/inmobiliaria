const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);

/**
 * Mapa futuro de dominios propios.
 *
 * Cuando una inmobiliaria tenga dominio propio, agregamos:
 *
 * "cliente.com.ar": "slug-de-la-inmobiliaria",
 * "www.cliente.com.ar": "slug-de-la-inmobiliaria",
 *
 * Importante:
 * - La clave es el dominio.
 * - El valor es el slug público de la inmobiliaria.
 */
export const CUSTOM_DOMAIN_SLUGS = {
    "ladoctaprop.com.ar": "ladoctaprop",
    "www.ladoctaprop.com.ar": "ladoctaprop",
};

export const getHostname = () => {
    if (typeof window === "undefined") return "";

    return window.location.hostname.toLowerCase();
};

export const isLocalhost = () => {
    return LOCAL_HOSTS.has(getHostname());
};

export const getAgencySlugFromPath = (pathname = "") => {
    const match = pathname.match(/^\/inmobiliaria\/([^/]+)/);

    return match?.[1] || null;
};

export const getAgencySlugFromDomain = () => {
    const hostname = getHostname();

    return CUSTOM_DOMAIN_SLUGS[hostname] || null;
};

export const getActiveAgencySlug = (pathname = "") => {
    return getAgencySlugFromPath(pathname) || getAgencySlugFromDomain();
};

export const isAgencyDomain = () => {
    return Boolean(getAgencySlugFromDomain());
};

export const buildAgencyPath = (slug) => {
    return slug ? `/inmobiliaria/${slug}` : "/";
};