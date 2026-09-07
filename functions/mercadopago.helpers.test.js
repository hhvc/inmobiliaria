import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";

import {
    buildMercadoPagoAccountId,
    buildMercadoPagoAssignmentId,
    buildMercadoPagoSignatureManifest,
    createMercadoPagoStatusToken,
    getMercadoPagoPaymentCostSummary,
    getMercadoPagoReversalSummary,
    hashMercadoPagoStatusToken,
    isMercadoPagoStatusTokenValid,
    verifyMercadoPagoWebhookSignature,
} from "./mercadopago.helpers.js";

test("construye identificadores estables por titular y destino", () => {
    assert.equal(buildMercadoPagoAccountId({ ownerType: "platform" }),
        "platform_onoprop");
    assert.equal(buildMercadoPagoAccountId({
        ownerType: "agency",
        ownerId: "abc-123",
    }), "agency_abc-123");
    assert.equal(buildMercadoPagoAssignmentId({
        targetType: "consortium",
        inmobiliariaId: "inmo1",
        targetId: "cons1",
    }), "consortium_inmo1_cons1");
});

test("valida la firma oficial de webhook y rechaza alteraciones", () => {
    const secret = "webhook-secret";
    const timestamp = "1787904000";
    const manifest = buildMercadoPagoSignatureManifest({
        dataId: "PAY-123",
        requestId: "request-1",
        timestamp,
    });
    const hash = crypto.createHmac("sha256", secret)
        .update(manifest).digest("hex");
    const input = {
        signatureHeader: `ts=${timestamp},v1=${hash}`,
        requestId: "request-1",
        dataId: "PAY-123",
        secret,
        nowMs: Number(timestamp) * 1000,
    };
    assert.equal(verifyMercadoPagoWebhookSignature(input), true);
    assert.equal(verifyMercadoPagoWebhookSignature({
        ...input,
        dataId: "PAY-999",
    }), false);
});

test("acepta timestamps de webhook expresados en milisegundos", () => {
    const secret = "webhook-secret";
    const timestamp = "1787904000123";
    const manifest = buildMercadoPagoSignatureManifest({
        dataId: "987654",
        requestId: "request-ms",
        timestamp,
    });
    const hash = crypto.createHmac("sha256", secret)
        .update(manifest).digest("hex");
    assert.equal(verifyMercadoPagoWebhookSignature({
        signatureHeader: `ts=${timestamp},v1=${hash}`,
        requestId: "request-ms",
        dataId: "987654",
        secret,
        nowMs: Number(timestamp),
    }), true);
});

test("protege el acceso público al estado de una orden", () => {
    const token = createMercadoPagoStatusToken();
    const hash = hashMercadoPagoStatusToken(token);
    assert.equal(isMercadoPagoStatusTokenValid(token, hash), true);
    assert.equal(isMercadoPagoStatusTokenValid(`${token}x`, hash), false);
});

test("resume la comisión y el neto informado por Mercado Pago", () => {
    assert.deepEqual(getMercadoPagoPaymentCostSummary({
        transaction_amount: 1000,
        transaction_details: { net_received_amount: 923.89 },
        fee_details: [{
            type: "mercadopago_fee",
            amount: 76.11,
            fee_payer: "collector",
        }, {
            type: "financing_fee",
            amount: 10,
            fee_payer: "payer",
        }],
    }), {
        transactionAmountMinor: 100000,
        providerFeeMinor: 7611,
        providerDeductionMinor: 7611,
        netReceivedAmountMinor: 92389,
        refundedAmountMinor: 0,
        feeDetails: [{
            type: "mercadopago_fee",
            amountMinor: 7611,
            feePayer: "collector",
        }, {
            type: "financing_fee",
            amountMinor: 1000,
            feePayer: "payer",
        }],
    });
});

test("calcula deducciones por el neto y devoluciones acumuladas", () => {
    const summary = getMercadoPagoPaymentCostSummary({
        transaction_amount: 1000,
        transaction_amount_refunded: 250,
        transaction_details: { net_received_amount: 900 },
        fee_details: [{
            type: "mercadopago_fee",
            amount: 70,
            fee_payer: "collector",
        }],
        refunds: [{ amount: 250, status: "approved" }],
    });
    assert.equal(summary.providerFeeMinor, 7000);
    assert.equal(summary.providerDeductionMinor, 10000);
    assert.equal(summary.refundedAmountMinor, 25000);
});

test("calcula solo el incremento pendiente de revertir", () => {
    assert.deepEqual(getMercadoPagoReversalSummary({
        payment: {
            status: "approved",
            transaction_amount: 1000,
            transaction_amount_refunded: 600,
        },
        orderAmountMinor: 100000,
        previouslyReversedMinor: 25000,
    }).reversalDeltaMinor, 35000);
    const chargeback = getMercadoPagoReversalSummary({
        payment: { status: "charged_back", transaction_amount: 1000 },
        orderAmountMinor: 100000,
    });
    assert.equal(chargeback.totalReversedAmountMinor, 100000);
    assert.equal(chargeback.fullyReversed, true);
});
