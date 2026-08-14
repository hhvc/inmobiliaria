import assert from "node:assert/strict";
import {Buffer} from "node:buffer";
import test from "node:test";

import {
    buildArcaPdfQrUrl,
    buildArcaVoucherPdf,
    buildArcaVoucherPdfFilename,
} from "./arcaPdf.helpers.js";

const voucher = {
    status: "authorized",
    environment: "prod",
    voucherType: 11,
    voucherDate: "2026-08-14",
    invoiceDate: "2026-08-14",
    issuerCuit: "20123456786",
    pointOfSale: 4,
    voucherNumber: 1,
    amountMinor: 500,
    serviceFrom: "2026-08-13",
    serviceTo: "2026-08-13",
    paymentDueDate: "2026-08-13",
    description: "Estadía temporaria de un día",
    cae: "86320746435135",
    caeExpirationDate: "2026-08-24",
    recipient: {
        name: "CLIENTE DE PRUEBA",
        documentType: 96,
        documentNumber: "12345678",
        ivaConditionId: 5,
        address: "Córdoba",
    },
    issuerSnapshot: {
        legalName: "EMISOR DE PRUEBA",
        tradeName: "Empresa de prueba",
        commercialAddress: "Córdoba",
        grossIncomeNumber: "Monotributo Unificado Córdoba",
        activityStartDate: "2025-01-01",
        ivaConditionId: 6,
    },
};

test("genera un QR fiscal con los datos del comprobante autorizado", () => {
    const url = new URL(buildArcaPdfQrUrl(voucher));
    const payload = JSON.parse(Buffer.from(url.searchParams.get("p"), "base64").toString("utf8"));
    assert.equal(payload.ptoVta, 4);
    assert.equal(payload.nroCmp, 1);
    assert.equal(payload.importe, 5);
    assert.equal(payload.nroDocRec, 12345678);
});

test("genera una representación PDF de una sola página", async () => {
    const pdf = await buildArcaVoucherPdf({
        voucher,
        profile: {},
        contract: {inmuebleSnapshot: {address: "Córdoba"}},
    });
    assert.equal(pdf.subarray(0, 4).toString("ascii"), "%PDF");
    assert.ok(pdf.length > 3000);
    const pageObjects = pdf.toString("latin1").match(/\/Type \/Page\b/gu) || [];
    assert.equal(pageObjects.length, 1);
});

test("distingue el nombre de archivo de factura y nota de crédito", () => {
    assert.equal(buildArcaVoucherPdfFilename(voucher), "factura-c-00004-00000001.pdf");
    assert.equal(
        buildArcaVoucherPdfFilename({...voucher, voucherType: 13}),
        "nota-credito-c-00004-00000001.pdf",
    );
});
