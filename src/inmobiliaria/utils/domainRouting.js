const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);

const PORTAL_HOSTS = new Set([
    "inmobiliaria-bcc63.web.app",
    "inmobiliaria-bcc63.firebaseapp.com",
]);

/**
 * Fallback manual.
 *
 * Idealmente, los dominios se resuelven desde Firestore usando:
 * dominiosPublicos: ["dominio.com.ar", "www.dominio.com.ar"]
 *
 * Este mapa queda como respaldo por si todavía no se cargó el dominio
 * en el documento de la inmobiliaria.
 */
export const CUSTOM_DOMAIN_SLUGS = {
    "ladoctaprop.com.ar": "ladoctaprop",
    "www.ladoctaprop.com.ar": "ladoctaprop",
};

export const getHostname = () => {
    if (typeof window === "undefined") return "";

    return window.location.hostname.toLowerCase();
};

export const isLocalhost = (hostname = getHostname()) => {
    return LOCAL_HOSTS.has(hostname);
};

export const isPortalHost = (hostname = getHostname()) => {
    return PORTAL_HOSTS.has(hostname);
};

export const shouldResolveDomainFromFirestore = (hostname = getHostname()) => {
    if (!hostname) return false;
    if (isLocalhost(hostname)) return false;
    if (isPortalHost(hostname)) return false;

    return true;
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