const WHATSAPP_REDIRECT_PATH = "/contacto/whatsapp";

export const buildWhatsappRedirectUrl = ({
  agencySlug = "",
  source = "site",
  developmentName = "",
  unitReference = "",
} = {}) => {
  const params = new URLSearchParams();
  const cleanAgencySlug = agencySlug.toString().trim().toLowerCase();
  const cleanSource = source.toString().trim().toLowerCase();
  const cleanDevelopmentName = developmentName
    .toString()
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  const cleanUnitReference = unitReference
    .toString()
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);

  if (cleanAgencySlug) params.set("agency", cleanAgencySlug);
  if (cleanSource) params.set("source", cleanSource.slice(0, 40));
  if (cleanDevelopmentName) params.set("development", cleanDevelopmentName);
  if (cleanUnitReference) params.set("unit", cleanUnitReference);

  const query = params.toString();
  return query ? `${WHATSAPP_REDIRECT_PATH}?${query}` : WHATSAPP_REDIRECT_PATH;
};
