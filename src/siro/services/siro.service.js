import { getFunctions, httpsCallable } from "firebase/functions";

import app from "../../firebase/config";

const functions = getFunctions(app, "southamerica-east1");

const callSiro = async (name, payload = {}) => {
  try {
    const callable = httpsCallable(functions, name);
    const result = await callable(payload);
    return result.data;
  } catch (error) {
    const message = error?.details?.message || error?.message ||
      "No se pudo completar la operación con SIRO.";
    const normalized = new Error(
      message.replace(/^Firebase:\s*/i, "").replace(/\s*\([^)]*\)\.?$/, ""),
    );
    normalized.code = error?.code || "";
    throw normalized;
  }
};

export const getSiroConfiguration = (inmobiliariaId) => (
  callSiro("siroGetConfiguration", { inmobiliariaId })
);

export const testSiroHomologation = (inmobiliariaId) => (
  callSiro("siroTestHomologation", { inmobiliariaId })
);

export const saveSiroAssignment = (payload) => (
  callSiro("siroSaveAssignment", payload)
);

export const disableSiroAssignment = (payload) => (
  callSiro("siroDisableAssignment", payload)
);

export const createSiroCheckout = (payload) => (
  callSiro("siroCreateCheckout", payload)
);

export const getSiroOrderStatus = (orderId, statusToken) => (
  callSiro("siroGetOrderStatus", { orderId, statusToken })
);

export const syncSiroOrder = (orderId) => (
  callSiro("siroSyncOrder", { orderId })
);

