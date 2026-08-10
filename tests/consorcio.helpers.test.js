import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateConsortiumAssessments,
  getConsortiumObligationStatus,
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
