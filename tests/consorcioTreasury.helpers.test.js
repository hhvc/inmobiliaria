import assert from "node:assert/strict";
import test from "node:test";

import {
  buildConsortiumBankStatementReviewCsv,
  buildConsortiumTreasuryMovementDraftFromStatementRow,
  buildConsortiumPayableDraftFromDocument,
  buildConsortiumSupplierDraftFromDocument,
  findConsortiumPayableForDocument,
  getConsortiumSupplierPaymentAgenda,
  getConsortiumSupplierPaymentPlanMeta,
  findConsortiumSupplierForDocument,
  matchConsortiumBankStatementRows,
  parseConsortiumBankStatementCsv,
} from "../src/consorcios/utils/consorcioTreasury.helpers.js";

test("prioriza la coincidencia exacta de proveedor por CUIT", () => {
  const result = findConsortiumSupplierForDocument({
    provider: "Otro nombre",
    providerTaxId: "20-25300621-9",
  }, [
    { id: "supplier-name", name: "Otro nombre", taxId: "30-00000000-1" },
    { id: "supplier-tax", name: "Héctor Vázquez", taxId: "20253006219" },
  ]);
  assert.equal(result.supplier.id, "supplier-tax");
  assert.equal(result.matchType, "tax_id");
});

test("puede identificar al proveedor por razón social normalizada", () => {
  const result = findConsortiumSupplierForDocument({ provider: "Energía Córdoba S.A." }, [
    { id: "supplier-1", name: "EPEC", legalName: "Energia Cordoba SA" },
  ]);
  assert.equal(result.supplier.id, "supplier-1");
  assert.equal(result.matchType, "name");
});

test("prepara la cuenta a pagar reutilizando el comprobante y el gasto", () => {
  const result = buildConsortiumPayableDraftFromDocument({
    consortiumId: "consortium-1",
    supplierId: "supplier-1",
    document: {
      id: "document-1",
      periodId: "period-1",
      expenseId: "expense-1",
      expenseConcept: "Servicio de limpieza",
      voucherType: "service_bill",
      voucherNumber: "0001-42",
      documentDate: "2026-10-01",
      dueDate: "2026-10-15",
      documentTotalMinor: 155000,
      cae: "123456",
      originalFileName: "factura.pdf",
    },
    expense: { id: "expense-1", amountMinor: 150000, periodCurrency: "ARS" },
  });
  assert.equal(result.supplierId, "supplier-1");
  assert.equal(result.expenseLink, "period-1::expense-1");
  assert.equal(result.expenseDocumentId, "document-1");
  assert.equal(result.amountMajor, "1550.00");
  assert.equal(result.voucherType, "invoice");
  assert.match(result.notes, /CAE 123456/);
});

test("precompleta un proveedor nuevo sin activarlo automáticamente en tesorería", () => {
  const result = buildConsortiumSupplierDraftFromDocument({
    consortiumId: "consortium-1",
    document: { provider: "Proveedor SA", providerTaxId: "30-12345678-9", aiAssisted: true },
  });
  assert.equal(result.name, "Proveedor SA");
  assert.equal(result.taxId, "30-12345678-9");
  assert.match(result.notes, /sugeridos/);
});

test("no mezcla el total del comprobante si su moneda difiere de la liquidación", () => {
  const result = buildConsortiumPayableDraftFromDocument({
    consortiumId: "consortium-1",
    document: {
      periodId: "period-1",
      expenseId: "expense-1",
      documentTotalMinor: 10000,
      currency: "USD",
    },
    expense: { id: "expense-1", amountMinor: 250000, periodCurrency: "ARS" },
  });
  assert.equal(result.currency, "ARS");
  assert.equal(result.amountMajor, "2500.00");
});

test("reconoce la obligación activa vinculada al gasto aunque provenga de otro documento", () => {
  const obligation = findConsortiumPayableForDocument({
    periodId: "period-1",
    expenseId: "expense-1",
  }, [
    { id: "voided", periodId: "period-1", expenseId: "expense-1", voided: true },
    { id: "active", periodId: "period-1", expenseId: "expense-1", voided: false },
  ]);
  assert.equal(obligation.id, "active");
});

test("distingue pagos programados pendientes, autorizados y vencidos", () => {
  assert.equal(getConsortiumSupplierPaymentPlanMeta({
    paymentPlan: { status: "scheduled", scheduledDate: "2026-10-15" },
  }, "2026-10-10").id, "scheduled");
  assert.equal(getConsortiumSupplierPaymentPlanMeta({
    paymentPlan: { status: "authorized", scheduledDate: "2026-10-10" },
  }, "2026-10-10").id, "due_today");
  assert.equal(getConsortiumSupplierPaymentPlanMeta({
    paymentPlan: { status: "authorized", scheduledDate: "2026-10-09" },
  }, "2026-10-10").id, "overdue");
});

test("ordena la agenda por fecha y omite programaciones finalizadas", () => {
  const agenda = getConsortiumSupplierPaymentAgenda([
    { id: "later", paymentPlan: { status: "authorized", scheduledDate: "2026-10-20" } },
    { id: "done", paymentPlan: { status: "executed", scheduledDate: "2026-10-01" } },
    { id: "first", paymentPlan: { status: "scheduled", scheduledDate: "2026-10-12" } },
  ], "2026-10-10");
  assert.deepEqual(agenda.map((item) => item.obligation.id), ["first", "later"]);
});

test("interpreta extractos CSV con importes argentinos y columnas separadas", () => {
  const result = parseConsortiumBankStatementCsv([
    "fecha;concepto;referencia;ingreso;egreso",
    "01/10/2026;Transferencia unidad 1;TRX-1;150.000,50;",
    "02/10/2026;Pago limpieza;OP-2;;85.000,00",
  ].join("\n"));
  assert.deepEqual(result.summary, {
    total: 2,
    valid: 2,
    invalid: 0,
    inflowsMinor: 15000050,
    outflowsMinor: 8500000,
  });
  assert.equal(result.validRows[0].date, "2026-10-01");
  assert.equal(result.validRows[1].direction, "outflow");
});

test("interpreta una columna de importe con signo y señala filas inválidas", () => {
  const result = parseConsortiumBankStatementCsv([
    "fecha,concepto,importe",
    "2026-10-01,Cobro,1200.50",
    "31/02/2026,Fecha imposible,-200",
  ].join("\n"));
  assert.equal(result.rows[0].direction, "inflow");
  assert.equal(result.rows[0].amountMinor, 120050);
  assert.equal(result.rows[1].direction, "outflow");
  assert.match(result.rows[1].errors.join(" "), /Fecha inválida/);
});

test("sugiere solo coincidencias bancarias exactas y no reutiliza movimientos", () => {
  const parsed = parseConsortiumBankStatementCsv([
    "fecha;concepto;referencia;ingreso;egreso",
    "01/10/2026;Expensas unidad 1;TRX-1;1500,00;",
    "01/10/2026;Otro cobro igual;;1500,00;",
  ].join("\n"));
  const matches = matchConsortiumBankStatementRows({
    rows: parsed.rows,
    accountId: "bank",
    currency: "ARS",
    movements: [{
      id: "movement-1",
      accountId: "bank",
      currency: "ARS",
      direction: "inflow",
      amountMinor: 150000,
      date: "2026-10-01",
      concept: "Cobro de expensas unidad 1",
      reference: "TRX-1",
    }],
  });
  assert.equal(matches[0].confidence, "high");
  assert.equal(matches[0].suggestedMovementId, "movement-1");
  assert.equal(matches[1].suggestedMovementId, "");
});

test("prepara un movimiento faltante con trazabilidad del extracto bancario", () => {
  const draft = buildConsortiumTreasuryMovementDraftFromStatementRow({
    consortiumId: "consortium-1",
    accountId: "bank-1",
    statementFileHash: "A1B2C3D4".repeat(8),
    row: {
      id: "line-7",
      lineNumber: 7,
      date: "2026-10-13",
      direction: "outflow",
      amountMinor: 850050,
      concept: "  Pago   limpieza  ",
      reference: " OP-77 ",
    },
  });
  assert.equal(draft.direction, "outflow");
  assert.equal(draft.amountMajor, "8500.50");
  assert.equal(draft.concept, "Pago limpieza");
  assert.equal(draft.reference, "OP-77");
  assert.equal(draft.statementFileHash, "a1b2c3d4".repeat(8));
  assert.match(draft.reason, /fila 7/);
  assert.match(draft.reason, /OP-77/);
});

test("exporta la revisión protegiendo fórmulas de planilla", () => {
  const csv = buildConsortiumBankStatementReviewCsv({
    rows: [{
      id: "line-1",
      date: "2026-10-01",
      concept: "=HIPERVINCULO()",
      reference: "TRX-1",
      direction: "inflow",
      amountMinor: 150000,
      errors: [],
    }],
    selections: { "line-1": "movement-1" },
  });
  assert.match(csv, /'=HIPERVINCULO/);
  assert.match(csv, /movement-1/);
});
