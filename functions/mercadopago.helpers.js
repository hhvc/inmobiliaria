import crypto from "node:crypto";
import { Buffer } from "node:buffer";

export const cleanMercadoPagoText = (value = "", maxLength = 500) => (
    value?.toString?.().trim().slice(0, maxLength) || ""
);

export const normalizeMercadoPagoCurrency = (value = "ARS") => {
    return cleanMercadoPagoText(value, 10).toUpperCase() || "ARS";
};

export const normalizeMercadoPagoAmountMinor = (value) => {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return null;
    return Math.round(amount);
};

export const mercadoPagoMinorToMajor = (value) => {
    return Number((Number(value || 0) / 100).toFixed(2));
};

const mercadoPagoMajorToMinor = (value) => {
    const amount = Number(value);
    return Number.isFinite(amount) ? Math.max(0, Math.round(amount * 100)) : 0;
};

export const getMercadoPagoPaymentCostSummary = (payment = {}) => {
    const transactionAmountMinor = mercadoPagoMajorToMinor(
        payment.transaction_amount,
    );
    const feeDetails = (Array.isArray(payment.fee_details)
        ? payment.fee_details : []).map((fee) => ({
        type: cleanMercadoPagoText(fee?.type, 80),
        amountMinor: mercadoPagoMajorToMinor(fee?.amount),
        feePayer: cleanMercadoPagoText(fee?.fee_payer, 80),
    }));
    const providerFeeMinor = feeDetails.reduce(
        (total, fee) => total + (
            !fee.feePayer || ["collector", "seller"].includes(fee.feePayer)
                ? fee.amountMinor
                : 0
        ),
        0,
    );
    const informedNetMinor = mercadoPagoMajorToMinor(
        payment.transaction_details?.net_received_amount,
    );
    const refundsTotalMinor = (Array.isArray(payment.refunds)
        ? payment.refunds : [])
        .filter((refund) => !refund?.status || refund.status === "approved")
        .reduce((total, refund) => (
            total + mercadoPagoMajorToMinor(refund?.amount)
        ), 0);
    const refundedAmountMinor = Math.max(
        mercadoPagoMajorToMinor(payment.transaction_amount_refunded),
        refundsTotalMinor,
    );
    const netReceivedAmountMinor = informedNetMinor || Math.max(
        0,
        transactionAmountMinor - providerFeeMinor,
    );
    return {
        transactionAmountMinor,
        providerFeeMinor,
        providerDeductionMinor: Math.max(
            0,
            transactionAmountMinor - netReceivedAmountMinor,
        ),
        netReceivedAmountMinor,
        refundedAmountMinor,
        feeDetails,
    };
};

export const getMercadoPagoReversalSummary = ({
    payment = {},
    orderAmountMinor = 0,
    previouslyReversedMinor = 0,
} = {}) => {
    const paymentSummary = getMercadoPagoPaymentCostSummary(payment);
    const orderAmount = Math.max(0, Math.round(Number(orderAmountMinor) || 0));
    const previous = Math.min(
        orderAmount,
        Math.max(0, Math.round(Number(previouslyReversedMinor) || 0)),
    );
    const providerStatus = cleanMercadoPagoText(payment.status, 60);
    const statusImpliesFullReversal = ["refunded", "charged_back"]
        .includes(providerStatus);
    const totalReversedAmountMinor = Math.min(
        orderAmount,
        Math.max(
            paymentSummary.refundedAmountMinor,
            statusImpliesFullReversal ? orderAmount : 0,
        ),
    );
    return {
        ...paymentSummary,
        totalReversedAmountMinor,
        reversalDeltaMinor: Math.max(0, totalReversedAmountMinor - previous),
        fullyReversed: orderAmount > 0 && totalReversedAmountMinor >= orderAmount,
    };
};

export const buildMercadoPagoAccountId = ({ ownerType, ownerId = "" }) => {
    if (ownerType === "platform") return "platform_onoprop";
    const safeOwnerId = cleanMercadoPagoText(ownerId, 128)
        .replace(/[^A-Za-z0-9_-]/g, "");
    if (!safeOwnerId) throw new Error("Falta el titular de la cuenta.");
    return `agency_${safeOwnerId}`;
};

export const buildMercadoPagoAssignmentId = ({
    targetType,
    inmobiliariaId,
    targetId,
}) => {
    const values = [targetType, inmobiliariaId, targetId].map((value) => (
        cleanMercadoPagoText(value, 128).replace(/[^A-Za-z0-9_-]/g, "")
    ));
    if (values.some((value) => !value)) {
        throw new Error("La asignación de Mercado Pago está incompleta.");
    }
    return values.join("_");
};

export const parseMercadoPagoSignature = (header = "") => {
    return cleanMercadoPagoText(header, 1000)
        .split(",")
        .reduce((result, part) => {
            const [rawKey, ...rawValue] = part.split("=");
            const key = rawKey?.trim?.().toLowerCase();
            if (key) result[key] = rawValue.join("=").trim();
            return result;
        }, {});
};

export const buildMercadoPagoSignatureManifest = ({
    dataId = "",
    requestId = "",
    timestamp = "",
}) => {
    const parts = [];
    const safeDataId = cleanMercadoPagoText(dataId, 300).toLowerCase();
    const safeRequestId = cleanMercadoPagoText(requestId, 300);
    const safeTimestamp = cleanMercadoPagoText(timestamp, 40);
    if (safeDataId) parts.push(`id:${safeDataId};`);
    if (safeRequestId) parts.push(`request-id:${safeRequestId};`);
    if (safeTimestamp) parts.push(`ts:${safeTimestamp};`);
    return parts.join("");
};

export const verifyMercadoPagoWebhookSignature = ({
    signatureHeader,
    requestId,
    dataId,
    secret,
    nowMs = Date.now(),
    maxAgeMs = 5 * 60 * 1000,
}) => {
    const signature = parseMercadoPagoSignature(signatureHeader);
    const timestamp = signature.ts || "";
    const receivedHash = signature.v1 || "";
    const timestampNumber = Number(timestamp);
    const timestampMs = timestampNumber >= 1e12
        ? timestampNumber
        : timestampNumber * 1000;
    if (!timestamp || !receivedHash || !Number.isFinite(timestampMs)) return false;
    if (Math.abs(nowMs - timestampMs) > maxAgeMs) return false;
    const manifest = buildMercadoPagoSignatureManifest({
        dataId,
        requestId,
        timestamp,
    });
    const expectedHash = crypto
        .createHmac("sha256", cleanMercadoPagoText(secret, 1000))
        .update(manifest)
        .digest("hex");
    const expected = Buffer.from(expectedHash, "utf8");
    const received = Buffer.from(receivedHash.toLowerCase(), "utf8");
    return expected.length === received.length &&
        crypto.timingSafeEqual(expected, received);
};

export const createMercadoPagoStatusToken = () => (
    crypto.randomBytes(24).toString("base64url")
);

export const hashMercadoPagoStatusToken = (token = "") => (
    crypto.createHash("sha256").update(token).digest("hex")
);

export const isMercadoPagoStatusTokenValid = (token, expectedHash) => {
    const actual = Buffer.from(hashMercadoPagoStatusToken(token), "utf8");
    const expected = Buffer.from(cleanMercadoPagoText(expectedHash, 128), "utf8");
    return actual.length === expected.length &&
        crypto.timingSafeEqual(actual, expected);
};
