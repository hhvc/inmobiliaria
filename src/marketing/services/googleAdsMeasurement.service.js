import {
  buildGoogleAdsLeadEvent,
  normalizeGoogleAdsConfig,
} from "../utils/googleAdsMeasurement.helpers";

const runtimeEnv = import.meta.env || {};
const GOOGLE_ADS_ID = runtimeEnv.VITE_GOOGLE_ADS_ID || "AW-18438651271";
const GOOGLE_ADS_LEAD_CONVERSION_LABEL =
  runtimeEnv.VITE_GOOGLE_ADS_LEAD_CONVERSION_LABEL || "a9lLCIGR64EdEIf7ndhE";
const GOOGLE_ADS_EVENT_STORAGE_PREFIX = "onoprop.google-ads.lead.v1";
const ONOPROP_PRODUCTION_HOSTS = new Set(["onoprop.com", "www.onoprop.com"]);

let destinationConfigured = false;

const isProductionPortal = () => typeof window !== "undefined" &&
  ONOPROP_PRODUCTION_HOSTS.has(window.location.hostname.toLowerCase());

const getGoogleTag = () => {
  if (typeof window === "undefined") return null;
  if (typeof window.gtag === "function") return window.gtag;

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    window.dataLayer.push(arguments);
  };
  return window.gtag;
};

const wasLeadConversionSent = (storageKey) => {
  try {
    return window.sessionStorage.getItem(storageKey) === "sent";
  } catch {
    return false;
  }
};

const markLeadConversionAsSent = (storageKey) => {
  try {
    window.sessionStorage.setItem(storageKey, "sent");
  } catch {
    // La medición nunca debe impedir que el formulario termine correctamente.
  }
};

export const configureGoogleAdsMeasurement = () => {
  if (!isProductionPortal()) return false;

  const config = normalizeGoogleAdsConfig({
    adsId: GOOGLE_ADS_ID,
    conversionLabel: GOOGLE_ADS_LEAD_CONVERSION_LABEL,
  });
  if (!config) return false;
  if (destinationConfigured) return true;

  const gtag = getGoogleTag();
  if (!gtag) return false;

  // Agrega Google Ads como destino de la etiqueta ya cargada por Firebase.
  // No vuelve a insertar gtag.js ni genera una segunda vista de página.
  gtag("config", config.adsId, { send_page_view: false });
  destinationConfigured = true;
  return true;
};

export const trackGoogleAdsLeadConversion = ({ leadId, value = 1 } = {}) => {
  if (!configureGoogleAdsMeasurement()) return false;

  const payload = buildGoogleAdsLeadEvent({
    adsId: GOOGLE_ADS_ID,
    conversionLabel: GOOGLE_ADS_LEAD_CONVERSION_LABEL,
    leadId,
    value,
    currency: "ARS",
  });
  if (!payload) return false;

  const storageKey = [
    GOOGLE_ADS_EVENT_STORAGE_PREFIX,
    payload.send_to,
    payload.transaction_id,
  ].join(":");
  if (wasLeadConversionSent(storageKey)) return false;

  const gtag = getGoogleTag();
  if (!gtag) return false;

  gtag("event", "conversion", payload);
  markLeadConversionAsSent(storageKey);
  return true;
};
