import assert from "node:assert/strict";
import test from "node:test";

import {
  buildArcaVoucherCenterCsv,
  buildArcaVoucherCenterRows,
  filterArcaVoucherCenterRows,
  summarizeArcaVoucherCenterRows,
} from "../src/alquileres/utils/arcaVoucherCenter.helpers.js";

const fixture = () => buildArcaVoucherCenterRows({
  profiles: [{id: "irene", issuerCuit: "23262883264", issuerLegalName: "Irene Cáceres"}],
  contracts: [{
    id: "contract-1",
    inmuebleSnapshot: {address: "Av. Siempre Viva 742"},
  }],
  documents: [
    {
      id: "invoice-1",
      contractId: "contract-1",
      issuerProfileId: "irene",
      issuerCuit: "23262883264",
      voucherType: 11,
      pointOfSale: 3,
      voucherNumber: 1,
      voucherDate: "2026-08-15",
      status: "authorized",
      cae: "12345678901234",
      amountMinor: 100000,
      recipient: {name: "Analía Frigo", documentNumber: "27551918"},
    },
    {
      id: "credit-1",
      contractId: "contract-1",
      issuerProfileId: "irene",
      voucherType: 13,
      pointOfSale: 3,
      voucherNumber: 1,
      voucherDate: "2026-08-16",
      status: "authorized",
      cae: "99999999999999",
      amountMinor: 25000,
      recipient: {name: "Analía Frigo", documentNumber: "27551918"},
      associatedVoucher: {previewId: "invoice-1", pointOfSale: 3, voucherNumber: 1},
    },
    {
      id: "preview-1",
      contractId: "contract-1",
      issuerProfileId: "irene",
      voucherType: 11,
      pointOfSale: 3,
      proposedVoucherNumber: 2,
      invoiceDate: "2026-08-17",
      status: "prepared",
      amountMinor: 50000,
      recipient: {name: "Otro cliente", documentNumber: "11111111"},
    },
  ],
});

test("relaciona facturas, notas de crédito y contratos", () => {
  const rows = fixture();
  const invoice = rows.find((item) => item.id === "invoice-1");
  const creditNote = rows.find((item) => item.id === "credit-1");
  assert.equal(invoice.relatedCreditNotesCount, 1);
  assert.equal(invoice.authorizedCreditsMinor, 25000);
  assert.equal(creditNote.associatedVoucherNumber, "00003-00000001");
  assert.equal(invoice.contractLabel, "Av. Siempre Viva 742");
});

test("filtra y calcula importes netos autorizados", () => {
  const rows = fixture();
  assert.equal(filterArcaVoucherCenterRows(rows, {search: "analia"}).length, 2);
  assert.equal(filterArcaVoucherCenterRows(rows, {kind: "credit_note"}).length, 1);
  assert.equal(filterArcaVoucherCenterRows(rows, {status: "preview"}).length, 1);
  assert.deepEqual(summarizeArcaVoucherCenterRows(rows), {
    authorizedCount: 2,
    invoiceCount: 1,
    creditNoteCount: 1,
    invoicedMinor: 100000,
    creditedMinor: 25000,
    netMinor: 75000,
    actionRequiredCount: 1,
  });
});

test("exporta un CSV compatible con Excel", () => {
  const csv = buildArcaVoucherCenterCsv(fixture());
  assert.equal(csv.startsWith("\uFEFF"), true);
  assert.match(csv, /"Nota de Crédito C"/u);
  assert.match(csv, /"1000,00"/u);
  assert.equal(csv.includes("PRIVATE KEY"), false);
});
