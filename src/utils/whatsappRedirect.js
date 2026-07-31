const WHATSAPP_REDIRECT_PATH = "/contacto/whatsapp";

export const buildWhatsappRedirectUrl = ({
  agencySlug = "",
  source = "site",
} = {}) => {
  const params = new URLSearchParams();
  const cleanAgencySlug = agencySlug.toString().trim().toLowerCase();
  const cleanSource = source.toString().trim().toLowerCase();

  if (cleanAgencySlug) params.set("agency", cleanAgencySlug);
  if (cleanSource) params.set("source", cleanSource.slice(0, 40));

  const query = params.toString();
  return query ? `${WHATSAPP_REDIRECT_PATH}?${query}` : WHATSAPP_REDIRECT_PATH;
};
