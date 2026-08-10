import assert from "node:assert/strict";
import test from "node:test";

import {
  buildConsortiumLiquidationLines,
  calculateConsortiumAssessments,
  getConsortiumAccountingPeriodLabel,
  getConsortiumAccountSummary,
  getConsortiumLiquidationNumber,
  getConsortiumObligationStatus,
  getConsortiumPenaltyStatus,
  getConsortiumPenaltyStatusLabel,
  getDefaultConsortiumDueDate,
  majorToMinor,
} from "../src/consorcios/utils/consorcio.helpers.js";
import {
  getPaymentReportStatus,
  isConsortiumDocumentFileValid,
  normalizeConsortiumEmails,
} from "../src/consorcios/utils/consorcioPortal.helpers.js";

const units = [
  { id: "a", code: "1 A", coefficient: 60, active: true },
  { id: "b", code: "1 B", coefficient: 40, active: true },
];

test("prorratea por coeficiente sin perder centavos", () => {
  const result = calculateConsortiumAssessments({
    units,
    expenses: [{
      id: "e1",
      concept: "Limpieza",
      category: "ordinary",
      distributionMode: "coefficient",
      amountMinor: 10001,
    }],
  });
  assert.equal(result.totalAssessedMinor, 10001);
  assert.equal(result.assessments.find((item) => item.unitId === "a").totalAmountMinor, 6001);
  assert.equal(result.assessments.find((item) => item.unitId === "b").totalAmountMinor, 4000);
});

test("reconstruye las líneas de una liquidación desde su snapshot", () => {
  const lines = buildConsortiumLiquidationLines({
    period: { expenses: [{ id: "e1", concept: "Limpieza", amountMinor: 120000 }] },
    obligation: { breakdown: [{ expenseId: "e1", category: "ordinary", distributionMode: "coefficient", amountMinor: 30000 }] },
  });
  assert.deepEqual(lines, [{
    expenseId: "e1",
    concept: "Limpieza",
    category: "ordinary",
    distributionMode: "coefficient",
    expenseTotalMinor: 120000,
    unitAmountMinor: 30000,
  }]);
  assert.equal(getConsortiumLiquidationNumber({ periodKey: "2026-08", unitCode: "2º A" }), "LIQ-202608-2-A");
});

test("distingue saldos iniciales y calcula el saldo neto con créditos", () => {
  assert.equal(
    getConsortiumAccountingPeriodLabel({ periodKey: "2026-07", source: "opening_balance" }),
    "Saldo inicial · Julio de 2026",
  );
  assert.deepEqual(getConsortiumAccountSummary({
    obligations: [{ totalAmountMinor: 120000, balanceMinor: 70000 }],
    payments: [
      { amountMinor: 50000, voided: false },
      { amountMinor: 10000, voided: true },
    ],
    creditBalanceMinor: 20000,
  }), {
    charges: 120000,
    payments: 50000,
    debt: 70000,
    credit: 20000,
    balance: 50000,
  });
});

test("deriva el estado pagado de una multa sin perder su expediente", () => {
  assert.equal(
    getConsortiumPenaltyStatus({ status: "confirmed" }, { balanceMinor: 0 }),
    "paid",
  );
  assert.equal(
    getConsortiumPenaltyStatus({ status: "challenged" }, { balanceMinor: 0 }),
    "challenged",
  );
  assert.equal(getConsortiumPenaltyStatusLabel("challenged").label, "Impugnada");
});

test("expone una rectificación específica aun si no integra los gastos originales", () => {
  const lines = buildConsortiumLiquidationLines({
    period: { expenses: [] },
    obligation: { breakdown: [{
      expenseId: "ajuste-1",
      concept: "Nota de crédito: diferencia de medición",
      category: "ordinary",
      distributionMode: "specific",
      amountMinor: -2500,
    }] },
  });
  assert.equal(lines[0].expenseTotalMinor, 2500);
  assert.equal(lines[0].unitAmountMinor, -2500);
});

test("combina partes iguales y un cargo particular", () => {
  const result = calculateConsortiumAssessments({
    units,
    expenses: [
      {
        id: "e1",
        concept: "Seguro",
        category: "ordinary",
        distributionMode: "equal",
        amountMinor: 10000,
      },
      {
        id: "e2",
        concept: "Llave extraviada",
        category: "extraordinary",
        distributionMode: "specific",
        specificUnitId: "b",
        amountMinor: 2500,
      },
    ],
  });
  assert.equal(result.assessments.find((item) => item.unitId === "a").totalAmountMinor, 5000);
  assert.equal(result.assessments.find((item) => item.unitId === "b").totalAmountMinor, 7500);
  assert.equal(result.totalAssessedMinor, 12500);
});

test("vence el mes siguiente respetando el día configurado", () => {
  assert.equal(getDefaultConsortiumDueDate("2026-12", 10), "2027-01-10");
  assert.equal(getDefaultConsortiumDueDate("2026-01", 31), "2026-02-28");
});

test("normaliza importes y estados operativos", () => {
  assert.equal(majorToMinor("1.234,56"), 123456);
  assert.equal(majorToMinor("1234.56"), 123456);
  assert.equal(getConsortiumObligationStatus({ balanceMinor: 100, dueDate: "2026-08-01" }, "2026-08-02"), "overdue");
  assert.equal(getConsortiumObligationStatus({ balanceMinor: 0, dueDate: "2026-08-01" }, "2026-08-02"), "paid");
  assert.equal(getConsortiumObligationStatus({ balanceMinor: 0, voided: true }, "2026-08-02"), "voided");
});

test("normaliza y deduplica los accesos por email", () => {
  assert.deepEqual(
    normalizeConsortiumEmails(" Persona@Ejemplo.com\npersona@ejemplo.com;otra@ejemplo.com "),
    ["persona@ejemplo.com", "otra@ejemplo.com"],
  );
  assert.deepEqual(normalizeConsortiumEmails("sin-email, usuario@dominio"), []);
});

test("valida comprobantes y expone estados de revisión", () => {
  assert.equal(isConsortiumDocumentFileValid({ type: "application/pdf", size: 1024 }), true);
  assert.equal(isConsortiumDocumentFileValid({ type: "text/plain", size: 1024 }), false);
  assert.equal(isConsortiumDocumentFileValid({ type: "image/png", size: 11 * 1024 * 1024 }), false);
  assert.equal(getPaymentReportStatus("approved").label, "Aprobado");
});
