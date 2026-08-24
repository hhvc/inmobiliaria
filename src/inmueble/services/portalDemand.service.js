import { getFunctions, httpsCallable } from "firebase/functions";

import app, { appCheckReadyPromise } from "../../firebase/config";

const functions = getFunctions(app, "southamerica-east1");

export const savePortalSearchAlert = async (payload) => {
    const appCheckResult = await appCheckReadyPromise;

    if (appCheckResult?.success === false) {
        throw new Error(
            "No pudimos validar la seguridad de la solicitud. Recargá la página e intentá nuevamente.",
        );
    }

    try {
        const callable = httpsCallable(functions, "portalSaveSearchAlert");
        const result = await callable(payload);
        return result.data;
    } catch (error) {
        const knownMessages = {
            "functions/resource-exhausted":
                "Alcanzaste el límite diario de búsquedas guardadas. Intentá mañana.",
            "functions/invalid-argument":
                "Revisá el email y elegí al menos un criterio de búsqueda.",
            "functions/failed-precondition":
                "Necesitamos tu consentimiento para enviarte las alertas.",
            "functions/unauthenticated":
                "No pudimos validar la solicitud. Recargá la página e intentá nuevamente.",
        };

        throw new Error(
            knownMessages[error?.code] ||
            error?.details?.message ||
            error?.message ||
            "No se pudo guardar la búsqueda.",
        );
    }
};
