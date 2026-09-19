import { getFunctions, httpsCallable } from "firebase/functions";

import app from "../../firebase/config";

const functions = getFunctions(app, "southamerica-east1");

export const getOnopropAcquisitionDashboard = async ({ dateFrom, dateTo }) => {
    try {
        const callable = httpsCallable(functions, "onopropGetAcquisitionDashboard");
        const result = await callable({ dateFrom, dateTo });
        return result.data;
    } catch (error) {
        const knownMessages = {
            "functions/unauthenticated": "Iniciá sesión para consultar la adquisición.",
            "functions/permission-denied":
                "Solo la administración ROOT puede consultar estas métricas.",
            "functions/invalid-argument": "Revisá el período seleccionado.",
        };
        throw new Error(
            knownMessages[error?.code] ||
            error?.details?.message ||
            error?.message ||
            "No se pudo cargar la adquisición.",
        );
    }
};
