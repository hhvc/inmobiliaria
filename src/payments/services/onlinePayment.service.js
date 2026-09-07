import { getFunctions, httpsCallable } from "firebase/functions";

import app from "../../firebase/config";
import {
  createMercadoPagoCheckout,
} from "../../mercadopago/services/mercadoPago.service";
import { createSiroCheckout } from "../../siro/services/siro.service";

const functions = getFunctions(app, "southamerica-east1");

const resolveProvider = async (payload) => {
  try {
    const callable = httpsCallable(functions, "paymentResolveCheckoutProvider");
    const result = await callable(payload);
    return result.data?.provider || "mercadopago";
  } catch (error) {
    const message = error?.details?.message || error?.message ||
      "No se pudo determinar el medio de cobro.";
    throw new Error(
      message.replace(/^Firebase:\s*/i, "").replace(/\s*\([^)]*\)\.?$/, ""),
    );
  }
};

export const createOnlinePaymentCheckout = async (payload) => {
  const provider = await resolveProvider(payload);
  if (provider === "siro") return createSiroCheckout(payload);
  return createMercadoPagoCheckout(payload);
};

export const openOnlinePaymentCheckout = (initPoint) => {
  if (!initPoint) throw new Error("El proveedor no devolvió un enlace de pago.");
  window.location.assign(initPoint);
};

