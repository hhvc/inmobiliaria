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

export const normalizeWhatsappContextText = (value = "", maxLength = 120) =>
    value
        .toString()
        .replace(/[\r\n\t]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, maxLength);

export const buildWhatsappMessage = ({
    agencyName = "",
    developmentName = "",
    unitReference = "",
} = {}) => {
    const cleanAgencyName = normalizeWhatsappContextText(agencyName);
    const cleanDevelopmentName = normalizeWhatsappContextText(developmentName);
    const cleanUnitReference = normalizeWhatsappContextText(unitReference, 80);

    if (cleanDevelopmentName && cleanUnitReference) {
        return `Hola, quiero consultar por ${cleanUnitReference} del emprendimiento ${cleanDevelopmentName}${
            cleanAgencyName ? ` publicado por ${cleanAgencyName}` : ""
        }.`;
    }

    if (cleanDevelopmentName) {
        return `Hola, quiero consultar por el emprendimiento ${cleanDevelopmentName}${
            cleanAgencyName ? ` publicado por ${cleanAgencyName}` : ""
        }.`;
    }

    if (cleanAgencyName) {
        return `Hola, quiero consultar por las propiedades de ${cleanAgencyName}.`;
    }

    return [
        "Hola, quiero recibir información sobre ONO Prop.",
        "Me interesa conocer cómo funciona la plataforma para inmobiliarias.",
    ].join("\n");
};

export const buildWhatsappDestinationUrl = ({
    number,
    agencyName = "",
    developmentName = "",
    unitReference = "",
}) => {
    const normalizedNumber = normalizeWhatsappNumber(number);
    if (!normalizedNumber) return "";

    const message = buildWhatsappMessage({
        agencyName,
        developmentName,
        unitReference,
    });
    return `https://wa.me/${normalizedNumber}?text=${encodeURIComponent(message)}`;
};
