import assert from "node:assert/strict";
import test from "node:test";

import {
  buildConsortiumPayableDraftFromDocument,
  buildConsortiumSupplierDraftFromDocument,
  findConsortiumPayableForDocument,
  getConsortiumSupplierPaymentAgenda,
  getConsortiumSupplierPaymentPlanMeta,
  findConsortiumSupplierForDocument,
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
