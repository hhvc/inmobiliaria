import {getFunctions, httpsCallable} from "firebase/functions";

import app from "../../firebase/config";

const functions = getFunctions(app, "southamerica-east1");

export const getParcelAtPoint = async ({
  inmobiliariaId,
  latitude,
  longitude,
}) => {
  try {
    const callable = httpsCallable(functions, "parcelasGetAtPoint");
    const result = await callable({
      inmobiliariaId: inmobiliariaId || "",
      latitude,
      longitude,
    });
    return result.data;
  } catch (error) {
    const message = error?.details?.message || error?.message ||
      "No se pudo consultar la parcela.";
    throw new Error(message);
  }
};
