const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);

const PORTAL_HOSTS = new Set([
    "inmobiliaria-bcc63.web.app",
    "inmobiliaria-bcc63.firebaseapp.com",
    "onoprop.com",
    "www.onoprop.com",
]);

/**
 * Fallback manual.
 *
 * Idealmente, los dominios propios de inmobiliarias se resuelven
 * desde Firestore usando:
 *
 * dominiosPublicos: ["dominio.com.ar", "www.dominio.com.ar"]
 *
 * Este mapa queda como respaldo por si todavía no se cargó el dominio
 * en el documento de la inmobiliaria.
 *
 * Importante:
 * No agregar acá dominios base del portal como onoprop.com.
 */
export const CUSTOM_DOMAIN_SLUGS = {
    "ladoctaprop.com.ar": "ladoctaprop",
    "www.ladoctaprop.com.ar": "ladoctaprop",
};

export const normalizeHostname = (hostname = "") => {
    return hostname
        .toString()
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//, "")
        .replace(/\/.*$/, "")
        .replace(/:\d+$/, "");
};

export const getHostname = () => {
    if (typeof window === "undefined") return "";

    return normalizeHostname(window.location.hostname);
};

export const isLocalhost = (hostname = getHostname()) => {
    return LOCAL_HOSTS.has(normalizeHostname(hostname));
};

export const isPortalHost = (hostname = getHostname()) => {
    return PORTAL_HOSTS.has(normalizeHostname(hostname));
};

/**
 * Alias semántico.
 *
 * Lo usamos cuando queremos preguntar:
 * "¿Este dominio es del portal principal?"
 */
export const isPortalBaseDomain = (hostname = getHostname()) => {
    return isLocalhost(hostname) || isPortalHost(hostname);
};

/**
 * Indica si conviene buscar en Firestore si el dominio actual
 * pertenece a una inmobiliaria.
 *
 * Para dominios base del portal NO debe buscar:
 * - localhost
 * - inmobiliaria-bcc63.web.app
 * - inmobiliaria-bcc63.firebaseapp.com
 * - onoprop.com
 * - www.onoprop.com
 */
export const shouldResolveDomainFromFirestore = (hostname = getHostname()) => {
    const normalizedHostname = normalizeHostname(hostname);

    if (!normalizedHostname) return false;
    if (isPortalBaseDomain(normalizedHostname)) return false;

    return true;
};

export const getAgencySlugFromPath = (pathname = "") => {
    const match = pathname.match(/^\/inmobiliaria\/([^/]+)/);

    return match?.[1] || null;
};

export const getAgencySlugFromDomain = () => {
    const hostname = getHostname();

    if (isPortalBaseDomain(hostname)) {
        return null;
    }

    return CUSTOM_DOMAIN_SLUGS[hostname] || null;
};

export const getActiveAgencySlug = (pathname = "") => {
    return getAgencySlugFromPath(pathname) || getAgencySlugFromDomain();
};

export const isAgencyDomain = () => {
    const hostname = getHostname();

    if (isPortalBaseDomain(hostname)) {
        return false;
    }

    return Boolean(getAgencySlugFromDomain());
};

export const buildAgencyPath = (slug) => {
    return slug ? `/inmobiliaria/${slug}` : "/";
};