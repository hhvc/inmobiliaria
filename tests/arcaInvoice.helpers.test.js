import assert from "node:assert/strict";
import test from "node:test";

import {
  buildArcaQrData,
  buildArcaQrUrl,
  formatArcaVoucherNumber,
  isArcaProductionPreviewFresh,
  isArcaProductionTestFresh,
} from "../src/alquileres/utils/arcaInvoice.helpers.js";

const authorizedDraft = {
  status: "authorized",
  voucherDate: "2026-08-09",
  issuerCuit: "20-25300621-9",
  pointOfSale: 4,
  voucherType: 11,
  voucherNumber: 1,
  amountMinor: 100000000,
  recipient: {documentType: 96, documentNumber: "30111222"},
  cae: "86320746435135",
};

test("construye el contenido QR exigido para una Factura C", () => {
  assert.deepEqual(buildArcaQrData(authorizedDraft), {
    ver: 1,
    fecha: "2026-08-09",
    cuit: 20253006219,
    ptoVta: 4,
    tipoCmp: 11,
    nroCmp: 1,
    importe: 1000000,
    moneda: "PES",
    ctz: 1,
    tipoDocRec: 96,
    nroDocRec: 30111222,
    tipoCodAut: "E",
    codAut: 86320746435135,
  });
});

test("genera la URL oficial y formatea la numeración", () => {
  const url = new URL(buildArcaQrUrl(authorizedDraft));
  const decoded = JSON.parse(globalThis.atob(url.searchParams.get("p")));

  assert.equal(url.origin, "https://www.arca.gob.ar");
  assert.equal(decoded.codAut, 86320746435135);
  assert.equal(formatArcaVoucherNumber(4, 1), "00004-00000001");
});

test("no genera QR para un borrador sin autorización", () => {
  assert.throws(
    () => buildArcaQrData({...authorizedDraft, status: "draft", cae: ""}),
    /todavía no tiene un CAE/i,
  );
});

test("limita la vigencia de las validaciones productivas", () => {
  const now = Date.parse("2026-08-13T15:00:00.000Z");
  assert.equal(isArcaProductionTestFresh({
    issuerCuit: "20253006219",
    pointOfSale: 4,
    voucherType: 11,
    lastProductionTest: {
      configuredPointAvailable: true,
      issuerCuit: "20253006219",
      pointOfSale: 4,
      voucherType: 11,
      checkedAt: "2026-08-12T15:00:01.000Z",
    },
  }, now), true);
  assert.equal(isArcaProductionTestFresh({
    issuerCuit: "20253006219",
    pointOfSale: 4,
    voucherType: 11,
    lastProductionTest: {
      configuredPointAvailable: true,
      issuerCuit: "20253006219",
      pointOfSale: 4,
      voucherType: 11,
      checkedAt: "2026-08-12T14:59:59.000Z",
    },
  }, now), false);
  assert.equal(isArcaProductionTestFresh({
    issuerCuit: "20253006219",
    pointOfSale: 5,
    voucherType: 11,
    lastProductionTest: {
      configuredPointAvailable: true,
      issuerCuit: "20253006219",
      pointOfSale: 4,
      voucherType: 11,
      checkedAt: "2026-08-13T14:59:00.000Z",
    },
  }, now), false);
  assert.equal(isArcaProductionPreviewFresh({
    status: "production_preview",
    sequenceObservedAt: "2026-08-13T14:45:01.000Z",
  }, now), true);
  assert.equal(isArcaProductionPreviewFresh({
    status: "production_preview",
    sequenceObservedAt: "2026-08-13T14:44:59.000Z",
  }, now), false);
  assert.equal(isArcaProductionPreviewFresh({
    status: "pending_reconciliation",
    sequenceObservedAt: "2026-08-01T00:00:00.000Z",
  }, now), true);
});
