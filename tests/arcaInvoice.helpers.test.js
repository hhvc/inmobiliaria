import assert from "node:assert/strict";
import test from "node:test";

import {
  buildArcaQrData,
  buildArcaQrUrl,
  formatArcaVoucherNumber,
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
