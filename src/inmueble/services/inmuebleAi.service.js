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

