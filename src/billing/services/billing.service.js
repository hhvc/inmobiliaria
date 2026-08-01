import { getFunctions, httpsCallable } from "firebase/functions";
import {
    deleteObject,
    getDownloadURL,
    ref,
    uploadBytesResumable,
} from "firebase/storage";

import app, {
    appCheckReadyPromise,
    auth,
    storage,
} from "../../firebase/config";

const functions = getFunctions(app, "southamerica-east1");

const callBillingFunction = async (name, payload = {}) => {
    try {
        const callable = httpsCallable(functions, name);
        const result = await callable(payload);
        return result.data;
    } catch (error) {
        const message =
            error?.details?.message ||
            error?.message ||
            "No se pudo completar la operación de cuenta corriente.";
        const normalized = new Error(
            message.replace(/^Firebase:\s*/i, "").replace(/\s*\([^)]*\)\.?$/, ""),
        );
        normalized.code = error?.code || "";
        throw normalized;
    }
};

export const getBillingAgencyOverview = (inmobiliariaId) => {
    return callBillingFunction("billingGetAgencyOverview", { inmobiliariaId });
};

export const getBillingAdminOverview = () => {
    return callBillingFunction("billingGetAdminOverview");
};

export const upsertBillingCatalogItem = ({ itemId = "", item }) => {
    return callBillingFunction("billingUpsertCatalogItem", { itemId, item });
};

export const seedInitialBillingCatalog = () => {
    return callBillingFunction("billingSeedInitialCatalog");
};

export const requestBillingContract = (payload) => {
    return callBillingFunction("billingRequestContract", payload);
};

export const quoteBillingContract = (payload) => {
    return callBillingFunction("billingSetContractQuote", payload);
};

export const acceptBillingContractQuote = (contractId) => {
    return callBillingFunction("billingAcceptContractQuote", {
        contractId,
        termsAccepted: true,
    });
};

export const rejectBillingContract = (payload) => {
    return callBillingFunction("billingRejectContract", payload);
};

export const approveBillingContract = (payload) => {
    return callBillingFunction("billingApproveContract", payload);
};

export const activateBillingContract = (payload) => {
    return callBillingFunction("billingActivateContract", payload);
};

export const requestBillingCancellation = (payload) => {
    return callBillingFunction("billingRequestCancellation", payload);
};

export const resolveBillingCancellation = (payload) => {
    return callBillingFunction("billingResolveCancellation", payload);
};

export const resolveBillingPaymentReport = (payload) => {
    return callBillingFunction("billingResolvePaymentReport", payload);
};

export const createBillingManualEntry = (payload) => {
    return callBillingFunction("billingCreateManualEntry", payload);
};

export const reverseBillingLedgerEntry = (payload) => {
    return callBillingFunction("billingReverseLedgerEntry", payload);
};

export const applyBillingHighlightCredits = (payload) => {
    return callBillingFunction("billingApplyHighlightCredits", payload);
};

export const getBillingPaymentProofUrl = async (proofPath) => {
    if (!proofPath) throw new Error("El pago no tiene un comprobante adjunto.");
    await appCheckReadyPromise;
    return getDownloadURL(ref(storage, proofPath));
};

const createReportId = () => {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return `payment-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
};

const sanitizeFileName = (fileName = "comprobante") => fileName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .slice(-180);

export const createBillingPaymentReport = async ({
    inmobiliariaId,
    amountMinor,
    currency,
    paidAt,
    paymentMethod,
    reference,
    note,
    file = null,
    onProgress,
}) => {
    const user = auth.currentUser;
    if (!user) throw new Error("Tenés que iniciar sesión.");
    const reportId = createReportId();
    let proofPath = "";
    let proofUrl = "";

    if (file) {
        const allowed = file.type === "application/pdf" || file.type.startsWith("image/");
        if (!allowed) throw new Error("El comprobante debe ser una imagen o un PDF.");
        if (file.size > 10 * 1024 * 1024) {
            throw new Error("El comprobante no puede superar los 10 MB.");
        }

        await appCheckReadyPromise;
        proofPath = `billing/${inmobiliariaId}/payment-proofs/${reportId}/${sanitizeFileName(file.name)}`;
        const storageRef = ref(storage, proofPath);
        const task = uploadBytesResumable(storageRef, file, {
            contentType: file.type,
            customMetadata: {
                inmobiliariaId,
                reportId,
                uploadedBy: user.uid,
                purpose: "billing-payment-proof",
            },
        });
        await new Promise((resolve, reject) => {
            task.on("state_changed", (snapshot) => {
                const progress = snapshot.totalBytes
                    ? Math.round(snapshot.bytesTransferred * 100 / snapshot.totalBytes)
                    : 0;
                onProgress?.(progress);
            }, reject, resolve);
        });
    }

    try {
        return await callBillingFunction("billingCreatePaymentReport", {
            reportId,
            inmobiliariaId,
            amountMinor,
            currency,
            paidAt,
            paymentMethod,
            reference,
            note,
            proofPath,
            proofUrl,
        });
    } catch (error) {
        if (proofPath) {
            try {
                await deleteObject(ref(storage, proofPath));
            } catch {
                // La limpieza es de mejor esfuerzo; el archivo huérfano queda inaccesible.
            }
        }
        throw error;
    }
};
