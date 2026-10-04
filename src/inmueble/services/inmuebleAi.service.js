import {getFunctions, httpsCallable} from "firebase/functions";

import app from "../../firebase/config";

const functions = getFunctions(app, "southamerica-east1");

const getFriendlyError = (error) => {
  const message = error?.message || "";
  const colonIndex = message.indexOf(":");
  const cleaned = colonIndex >= 0 ? message.slice(colonIndex + 1).trim() : message;

  return cleaned ||
    "No pudimos preparar el borrador. Podés continuar la carga manualmente.";
};

export const prepareInmuebleAiDraft = async ({
  sourceText,
  inmobiliariaId = "",
} = {}) => {
  try {
    const callable = httpsCallable(functions, "inmueblePrepareAiDraft", {
      timeout: 60000,
    });
    const response = await callable({sourceText, inmobiliariaId});
    return response.data || {};
  } catch (error) {
    const friendlyError = new Error(getFriendlyError(error));
    friendlyError.code = error?.code || "";
    throw friendlyError;
  }
};

export const recordInmuebleAiDraftOutcome = async ({
  generationId,
  applied = false,
  appliedFieldCount = 0,
  preservedFieldCount = 0,
  rating = "",
} = {}) => {
  const callable = httpsCallable(functions, "inmuebleRecordAiDraftOutcome", {
    timeout: 30000,
  });
  const response = await callable({
    generationId,
    applied,
    appliedFieldCount,
    preservedFieldCount,
    rating,
  });
  return response.data || {};
};

export const getInmuebleAiDraftDashboard = async ({
  dateFrom,
  dateTo,
} = {}) => {
  try {
    const callable = httpsCallable(functions, "inmuebleGetAiDraftDashboard", {
      timeout: 60000,
    });
    const response = await callable({dateFrom, dateTo});
    return response.data || {};
  } catch (error) {
    const knownMessages = {
      "functions/unauthenticated": "Iniciá sesión para consultar las métricas.",
      "functions/permission-denied":
        "Solo la administración ROOT puede consultar estas métricas.",
      "functions/invalid-argument": "Revisá el período seleccionado.",
    };
    throw new Error(knownMessages[error?.code] || getFriendlyError(error));
  }
};

