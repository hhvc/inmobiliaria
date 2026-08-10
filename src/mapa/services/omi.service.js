import { getFunctions, httpsCallable } from "firebase/functions";

import app from "../../firebase/config";

const functions = getFunctions(app, "southamerica-east1");

const callOmiFunction = async (name, payload = {}) => {
    try {
        const callable = httpsCallable(functions, name);
        const result = await callable(payload);
        return result.data;
    } catch (error) {
        const message = error?.details?.message || error?.message ||
            "No se pudo completar la operación con OMI.";
        const normalizedError = new Error(
            message.replace(/^Firebase:\s*/i, "")
                .replace(/\s*\([^)]*\)\.?$/, ""),
        );
        normalizedError.code = error?.code || "";
        normalizedError.details = error?.details || null;
        throw normalizedError;
    }
};

export const testOmiConnection = (inmobiliariaId = "") => {
    return callOmiFunction("omiTestConnection", {inmobiliariaId});
};

export const searchOmiComparables = ({
    bounds,
    crs = "EPSG:4326",
    limit = 50,
    inmobiliariaId = "",
}) => {
    return callOmiFunction("omiSearchComparables", {
        bounds,
        crs,
        limit,
        inmobiliariaId,
    });
};
