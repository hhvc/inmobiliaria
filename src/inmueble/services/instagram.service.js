import { getFunctions, httpsCallable } from "firebase/functions";

import app from "../../firebase/config";

const functions = getFunctions(app, "southamerica-east1");

const callInstagramFunction = async (name, payload = {}) => {
    try {
        const callable = httpsCallable(functions, name);
        const result = await callable(payload);
        return result.data;
    } catch (error) {
        const message =
            error?.details?.message ||
            error?.message ||
            "No se pudo completar la operación con Instagram.";
        const normalizedError = new Error(
            message.replace(/^Firebase:\s*/i, "").replace(/\s*\([^)]*\)\.?$/, ""),
        );
        normalizedError.code = error?.code || "";
        normalizedError.details = error?.details || null;
        throw normalizedError;
    }
};

export const getInstagramConnectionStatus = (inmobiliariaId) => {
    return callInstagramFunction("instagramConnectionStatus", {
        inmobiliariaId,
    });
};

export const startInstagramAuthorization = ({
    inmobiliariaId,
    target,
    openerOrigin,
}) => {
    return callInstagramFunction("instagramAuthStart", {
        inmobiliariaId,
        target,
        openerOrigin,
    });
};

export const disconnectInstagram = ({ inmobiliariaId, target }) => {
    return callInstagramFunction("instagramDisconnect", {
        inmobiliariaId,
        target,
    });
};

export const getInstagramDistribution = ({
    inmobiliariaId,
    inmuebleId,
}) => {
    return callInstagramFunction("instagramGetDistribution", {
        inmobiliariaId,
        inmuebleId,
    });
};

export const publishInstagramAgencyMedia = ({
    inmobiliariaId,
    inmuebleId,
    caption,
    imageUrls,
}) => {
    return callInstagramFunction("instagramPublishAgencyMedia", {
        inmobiliariaId,
        inmuebleId,
        caption,
        imageUrls,
    });
};

export const submitOnopropInstagramPublication = ({
    inmobiliariaId,
    inmuebleId,
    caption,
    imageUrls,
}) => {
    return callInstagramFunction("instagramSubmitOnopropPublication", {
        inmobiliariaId,
        inmuebleId,
        caption,
        imageUrls,
    });
};

export const listOnopropInstagramRequests = (status = "pending") => {
    return callInstagramFunction("instagramListOnopropRequests", { status });
};

export const approveOnopropInstagramPublication = (requestId) => {
    return callInstagramFunction("instagramApproveOnopropPublication", {
        requestId,
    });
};

export const rejectOnopropInstagramPublication = ({
    requestId,
    rejectionReason = "",
}) => {
    return callInstagramFunction("instagramRejectOnopropPublication", {
        requestId,
        rejectionReason,
    });
};
