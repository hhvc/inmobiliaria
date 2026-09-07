import { getFunctions, httpsCallable } from "firebase/functions";

import app from "../../firebase/config";

const functions = getFunctions(app, "southamerica-east1");

const callMercadoPago = async (name, payload = {}) => {
  try {
    const callable = httpsCallable(functions, name);
    const result = await callable(payload);
    return result.data;
  } catch (error) {
    const message = error?.details?.message || error?.message ||
      "No se pudo completar la operación con Mercado Pago.";
    const normalized = new Error(
      message.replace(/^Firebase:\s*/i, "").replace(/\s*\([^)]*\)\.?$/, ""),
    );
    normalized.code = error?.code || "";
    throw normalized;
  }
};

export const createMercadoPagoOperationId = (prefix = "mp") => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
};

export const getMercadoPagoConfiguration = (inmobiliariaId) => (
  callMercadoPago("mercadoPagoGetConfiguration", { inmobiliariaId })
);

export const startMercadoPagoOAuth = (payload) => (
  callMercadoPago("mercadoPagoAuthStart", payload)
);

export const connectMercadoPagoPlatform = () => (
  callMercadoPago("mercadoPagoConnectPlatform")
);

export const disconnectMercadoPago = (accountId) => (
  callMercadoPago("mercadoPagoDisconnect", { accountId })
);

export const saveMercadoPagoAssignment = (payload) => (
  callMercadoPago("mercadoPagoSaveAssignment", payload)
);

export const createMercadoPagoCheckout = (payload) => (
  callMercadoPago("mercadoPagoCreateCheckout", {
    ...payload,
    operationId: payload.operationId || createMercadoPagoOperationId("checkout"),
  })
);

export const getMercadoPagoOrderStatus = (
  orderId,
  statusToken,
  providerPaymentId = "",
) => (
  callMercadoPago("mercadoPagoGetOrderStatus", {
    orderId,
    statusToken,
    providerPaymentId,
  })
);

export const syncMercadoPagoOrder = (orderId) => (
  callMercadoPago("mercadoPagoSyncOrder", { orderId })
);

export const openMercadoPagoCheckout = (initPoint) => {
  if (!initPoint) throw new Error("Mercado Pago no devolvió un enlace de pago.");
  window.location.assign(initPoint);
};

export const copyMercadoPagoCheckout = async (initPoint) => {
  if (!initPoint) throw new Error("Mercado Pago no devolvió un enlace de pago.");
  await navigator.clipboard.writeText(initPoint);
};
