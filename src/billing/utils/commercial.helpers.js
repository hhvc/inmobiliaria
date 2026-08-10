export const COMMERCIAL_LEAD_STATUS_OPTIONS = [
    { id: "new", label: "Nuevo", badge: "text-bg-primary" },
    { id: "contacted", label: "Contactado", badge: "text-bg-info" },
    { id: "demo", label: "Demostración", badge: "text-bg-warning" },
    { id: "proposal", label: "Propuesta enviada", badge: "text-bg-secondary" },
    { id: "won", label: "Ganado", badge: "text-bg-success" },
    { id: "lost", label: "Perdido", badge: "text-bg-dark" },
];

export const COMMERCIAL_PROPERTY_VOLUME_OPTIONS = [
    { value: "1-20", label: "Hasta 20 propiedades" },
    { value: "21-50", label: "Entre 21 y 50" },
    { value: "51-150", label: "Entre 51 y 150" },
    { value: "151-500", label: "Entre 151 y 500" },
    { value: "500+", label: "Más de 500" },
];

export const getCommercialLeadStatus = (status = "new") => (
    COMMERCIAL_LEAD_STATUS_OPTIONS.find((item) => item.id === status) ||
    { id: status, label: status || "Sin estado", badge: "text-bg-secondary" }
);

export const buildCommercialSource = ({
    href = "",
    pathname = "",
    search = "",
    referrer = "",
} = {}) => {
    let params = new URLSearchParams(search);
    try {
        const url = new URL(href || `https://onoprop.com${pathname}${search}`);
        params = url.searchParams;
        pathname = pathname || url.pathname;
    } catch {
        // Los valores parciales siguen siendo suficientes para atribución básica.
    }
    return {
        path: pathname || "/planes",
        referrer,
        utmSource: params.get("utm_source") || "",
        utmMedium: params.get("utm_medium") || "",
        utmCampaign: params.get("utm_campaign") || "",
        utmContent: params.get("utm_content") || "",
        utmTerm: params.get("utm_term") || "",
    };
};

export const buildCommercialWhatsappUrl = (phone = "", message = "") => {
    const digits = phone.toString().replace(/\D/g, "");
    if (!digits) return "";
    const text = message ? `?text=${encodeURIComponent(message)}` : "";
    return `https://wa.me/${digits}${text}`;
};

export const getCommercialInterestSummary = (lead = {}) => {
    const names = Array.isArray(lead.interestNames)
        ? lead.interestNames.filter(Boolean)
        : [];
    return names.length ? names.join(" · ") : "Demostración general";
};
