import { logEvent } from "firebase/analytics";

import { analytics } from "../../firebase/config";

const CONSORTIUM_ITEM = Object.freeze({
  item_id: "consortium_administration",
  item_name: "Administración de Consorcios",
  item_category: "Software inmobiliario",
});

const safeLogEvent = (eventName, params = {}) => {
  if (!analytics) return false;

  try {
    logEvent(analytics, eventName, params);
    return true;
  } catch (error) {
    console.warn(`No se pudo registrar el evento ${eventName}:`, error);
    return false;
  }
};

export const trackConsortiumLandingView = () => {
  if (typeof window === "undefined") return false;

  const storageKey = "onoprop.marketing.consortium.view.v1";
  try {
    if (window.sessionStorage.getItem(storageKey)) return false;
    window.sessionStorage.setItem(storageKey, new Date().toISOString());
  } catch {
    // La medición es de mejor esfuerzo y nunca debe impedir ver la página.
  }

  return safeLogEvent("view_item", {
    currency: "ARS",
    value: 1000,
    items: [CONSORTIUM_ITEM],
  });
};

export const trackConsortiumCta = (cta) => safeLogEvent("select_content", {
  content_type: "consortium_marketing_cta",
  item_id: cta,
  module: CONSORTIUM_ITEM.item_id,
});

export const trackConsortiumContact = (method) => safeLogEvent("contact", {
  method,
  module: CONSORTIUM_ITEM.item_id,
});

export const trackConsortiumLead = () => safeLogEvent("generate_lead", {
  currency: "ARS",
  value: 1000,
  lead_type: "consortium_demo",
  module: CONSORTIUM_ITEM.item_id,
});

