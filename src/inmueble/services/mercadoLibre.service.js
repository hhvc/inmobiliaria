import { getFunctions, httpsCallable } from "firebase/functions";

import app from "../../firebase/config";

const functions = getFunctions(app, "southamerica-east1");

const callMercadoLibreFunction = async (name, payload = {}) => {
    try {
        const callable = httpsCallable(functions, name);
        const result = await callable(payload);
        return result.data;
    } catch (error) {
        const message =
            error?.details?.message ||
            error?.message ||
            "No se pudo completar la operación con Mercado Libre.";

        const normalizedError = new Error(
            message.replace(/^Firebase:\s*/i, "").replace(/\s*\([^)]*\)\.?$/, ""),
        );
        normalizedError.code = error?.code || "";
        normalizedError.details = error?.details || null;
        throw normalizedError;
    }
};

export const getMercadoLibreConnectionStatus = (inmobiliariaId) => {
    return callMercadoLibreFunction("mercadoLibreConnectionStatus", {
        inmobiliariaId,
    });
};

export const startMercadoLibreAuthorization = (inmobiliariaId) => {
    return callMercadoLibreFunction("mercadoLibreAuthStart", {
        inmobiliariaId,
    });
};

export const disconnectMercadoLibre = (inmobiliariaId) => {
    return callMercadoLibreFunction("mercadoLibreDisconnect", {
        inmobiliariaId,
    });
};

export const getMercadoLibreDistribution = (
    inmobiliariaId,
    inmuebleId,
) => {
    return callMercadoLibreFunction("mercadoLibreGetDistribution", {
        inmobiliariaId,
        inmuebleId,
    });
};

export const saveMercadoLibreSettings = ({
    inmobiliariaId,
    inmuebleId,
    settings,
}) => {
    return callMercadoLibreFunction("mercadoLibreSaveSettings", {
        inmobiliariaId,
        inmuebleId,
        settings,
    });
};

export const getMercadoLibreCategoryDetails = ({
    inmobiliariaId,
    categoryId,
}) => {
    return callMercadoLibreFunction("mercadoLibreGetCategoryDetails", {
        inmobiliariaId,
        categoryId,
    });
};

export const getMercadoLibreLocationOptions = ({
    inmobiliariaId,
    level,
    locationId,
}) => {
    return callMercadoLibreFunction("mercadoLibreGetLocationOptions", {
        inmobiliariaId,
        level,
        locationId,
    });
};

export const validateMercadoLibreItem = ({
    inmobiliariaId,
    inmuebleId,
    settings,
}) => {
    return callMercadoLibreFunction("mercadoLibreValidateItem", {
        inmobiliariaId,
        inmuebleId,
        settings,
    });
};

export const publishMercadoLibreItem = ({
    inmobiliariaId,
    inmuebleId,
    settings,
}) => {
    return callMercadoLibreFunction("mercadoLibrePublishItem", {
        inmobiliariaId,
        inmuebleId,
        settings,
    });
};

export const updateMercadoLibreItem = ({
    inmobiliariaId,
    inmuebleId,
    settings,
}) => {
    return callMercadoLibreFunction("mercadoLibreUpdateItem", {
        inmobiliariaId,
        inmuebleId,
        settings,
    });
};

export const changeMercadoLibreItemStatus = ({
    inmobiliariaId,
    inmuebleId,
    status,
}) => {
    return callMercadoLibreFunction("mercadoLibreChangeItemStatus", {
        inmobiliariaId,
        inmuebleId,
        status,
    });
};

export const syncMercadoLibreItemStatus = ({
    inmobiliariaId,
    inmuebleId,
}) => {
    return callMercadoLibreFunction("mercadoLibreSyncItemStatus", {
        inmobiliariaId,
        inmuebleId,
    });
};

export const getMercadoLibreLeads = ({
    inmobiliariaId,
    managementStatus = "",
    contactType = "",
    inmuebleId = "",
    limit = 100,
}) => {
    return callMercadoLibreFunction("mercadoLibreGetLeads", {
        inmobiliariaId,
        managementStatus,
        contactType,
        inmuebleId,
        limit,
    });
};

export const syncMercadoLibreLeads = (inmobiliariaId) => {
    return callMercadoLibreFunction("mercadoLibreSyncLeads", {
        inmobiliariaId,
    });
};

export const updateMercadoLibreLeadStatus = ({
    inmobiliariaId,
    leadId,
    managementStatus,
    managementNote = "",
}) => {
    return callMercadoLibreFunction("mercadoLibreUpdateLeadStatus", {
        inmobiliariaId,
        leadId,
        managementStatus,
        managementNote,
    });
};

export const answerMercadoLibreQuestion = ({
    inmobiliariaId,
    leadId,
    answerText,
}) => {
    return callMercadoLibreFunction("mercadoLibreAnswerQuestion", {
        inmobiliariaId,
        leadId,
        answerText,
    });
};
