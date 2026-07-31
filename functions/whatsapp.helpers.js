export const normalizeWhatsappNumber = (value = "") => {
    let digits = value.toString().replace(/\D/g, "");

    if (digits.startsWith("00")) digits = digits.slice(2);
    if (digits.startsWith("0")) digits = digits.slice(1);

    if (/^549\d{10}$/.test(digits)) return digits;
    if (/^54\d{10}$/.test(digits)) return `549${digits.slice(2)}`;
    if (/^\d{10}$/.test(digits)) return `549${digits}`;

    return "";
};

export const normalizeWhatsappAgencySlug = (value = "") => {
    const slug = value.toString().trim().toLowerCase();
    return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ? slug : "";
};

export const buildWhatsappMessage = ({ agencyName = "" } = {}) => {
    const cleanAgencyName = agencyName.toString().trim().slice(0, 120);

    if (cleanAgencyName) {
        return `Hola, quiero consultar por las propiedades de ${cleanAgencyName}.`;
    }

    return [
        "Hola, quiero recibir información sobre ONO Prop.",
        "Me interesa conocer cómo funciona la plataforma para inmobiliarias.",
    ].join("\n");
};

export const buildWhatsappDestinationUrl = ({ number, agencyName = "" }) => {
    const normalizedNumber = normalizeWhatsappNumber(number);
    if (!normalizedNumber) return "";

    const message = buildWhatsappMessage({ agencyName });
    return `https://wa.me/${normalizedNumber}?text=${encodeURIComponent(message)}`;
};
