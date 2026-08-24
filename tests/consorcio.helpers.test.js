import assert from "node:assert/strict";
import test from "node:test";

import {
  buildConsortiumEconomicStatement,
  buildConsortiumEconomicStatementCsv,
  buildConsortiumMonthlyCloseChecklist,
  buildConsortiumSupplierObligationsCsv,
  buildConsortiumLiquidationLines,
  calculateConsortiumAssessments,
  filterConsortiumSupplierObligations,
  getConsortiumAccountingPeriodLabel,
  getConsortiumAccountSummary,
  getConsortiumClaimReference,
  getConsortiumLiquidationNumber,
  getConsortiumObligationStatus,
  getConsortiumPenaltyStatus,
  getConsortiumPenaltyStatusLabel,
  getConsortiumSupplierObligationStatus,
  getConsortiumTreasuryBookBalance,
  getConsortiumTreasurySummary,
  getDefaultConsortiumDueDate,
  majorToMinor,
  isConsortiumClaimOpen,
  validateConsortiumUnit,
} from "../src/consorcios/utils/consorcio.helpers.js";
import {
  getPaymentReportStatus,
  isConsortiumDocumentFileValid,
  normalizeConsortiumEmails,
} from "../src/consorcios/utils/consorcioPortal.helpers.js";
import { getConsortiumCommunicationType } from "../src/consorcios/utils/consorcio.constants.js";

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

test("habilita el cierre mensual cuando los controles críticos están resueltos", () => {
  const checklist = buildConsortiumMonthlyCloseChecklist({
    period: {
      id: "period-1",
      periodKey: "2026-07",
      status: "issued",
      expenses: [{ id: "expense-1", concept: "Limpieza", amountMinor: 100000 }],
    },
    units: [{ id: "unit-1", active: true }],
    obligations: [{ id: "obligation-1", periodId: "period-1", unitId: "unit-1", balanceMinor: 0 }],
    expenseDocuments: [{ id: "document-1", periodId: "period-1", expenseId: "expense-1", voided: false }],
    paymentReports: [],
    treasuryAccounts: [{ id: "account-1", active: true }],
    treasuryReconciliations: [{ accountId: "account-1", statementDate: "2026-07-31", differenceMinor: 0, voided: false }],
    supplierObligations: [{ periodId: "period-1", expenseId: "expense-1", balanceMinor: 0, voided: false }],
    financialClosures: [{ periodId: "period-1", version: 1 }],
  });
  assert.equal(checklist.canClose, true);
  assert.equal(checklist.blockers.length, 0);
  assert.equal(checklist.warnings.length, 0);
  assert.equal(checklist.summary.okCount, checklist.items.length);
});

test("mantiene deudas y faltantes documentales como advertencias sin impedir el cierre", () => {
  const checklist = buildConsortiumMonthlyCloseChecklist({
    period: {
      id: "period-2",
      periodKey: "2026-08",
      status: "issued",
      expenses: [{ id: "expense-1", concept: "Seguro", amountMinor: 250000 }],
    },
    units: [{ id: "unit-1", active: true }],
    obligations: [{ id: "obligation-1", periodId: "period-2", unitId: "unit-1", balanceMinor: 90000 }],
  });
  assert.equal(checklist.canClose, true);
  assert.equal(checklist.blockers.length, 0);
  assert.equal(checklist.summary.unitDebtMinor, 90000);
  assert.equal(checklist.warnings.some((item) => item.code === "unit_debt_outstanding"), true);
  assert.equal(checklist.warnings.some((item) => item.code === "expenses_without_documents"), true);
  assert.equal(checklist.warnings.some((item) => item.code === "no_treasury_accounts"), true);
});

test("bloquea el cierre si la liquidación no está emitida o hay pagos sin revisar", () => {
  const draftChecklist = buildConsortiumMonthlyCloseChecklist({
    period: { id: "draft-1", periodKey: "2026-08", status: "draft" },
  });
  assert.equal(draftChecklist.canClose, false);
  assert.equal(draftChecklist.blockers.some((item) => item.code === "period_not_issued"), true);

  const pendingPaymentChecklist = buildConsortiumMonthlyCloseChecklist({
    period: { id: "period-3", periodKey: "2026-08", status: "issued" },
    obligations: [{ id: "obligation-1", periodId: "period-3", unitId: "unit-1", balanceMinor: 1000 }],
    paymentReports: [{ periodId: "period-3", status: "pending" }],
  });
  assert.equal(pendingPaymentChecklist.canClose, false);
  assert.equal(pendingPaymentChecklist.blockers.some((item) => item.code === "pending_payment_reports"), true);
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

test("valida las fechas de vigencia del titular y ocupante", () => {
  assert.deepEqual(validateConsortiumUnit({
    code: "2 B",
    coefficient: 12.5,
    ownerSince: "2026-08-01",
    occupantSince: "2025-02-28",
  }), []);
  assert.deepEqual(validateConsortiumUnit({
    code: "2 B",
    ownerSince: "2026-02-30",
    occupantSince: "31/07/2026",
  }), [
    "La fecha de inicio del titular no es válida.",
    "La fecha de inicio del ocupante no es válida.",
  ]);
});

test("deriva estados de cuentas a pagar sin ocultar pagos parciales", () => {
  assert.equal(getConsortiumSupplierObligationStatus({
    balanceMinor: 10000,
    paidAmountMinor: 0,
    dueDate: "2026-08-20",
  }, "2026-08-21"), "overdue");
  assert.equal(getConsortiumSupplierObligationStatus({
    balanceMinor: 5000,
    paidAmountMinor: 5000,
    dueDate: "2026-08-20",
  }, "2026-08-21"), "partial_overdue");
  assert.equal(getConsortiumSupplierObligationStatus({
    balanceMinor: 0,
    paidAmountMinor: 10000,
  }), "paid");
  assert.equal(getConsortiumSupplierObligationStatus({
    balanceMinor: 10000,
    voided: true,
  }), "voided");
});

test("filtra cuentas a pagar por estado y búsqueda sin distinguir acentos", () => {
  const obligations = [
    {
      id: "electricidad",
      supplierSnapshot: { name: "Eléctrica Córdoba", taxId: "30-11111111-1" },
      concept: "Reparación tablero",
      voucherNumber: "A-10",
      dueDate: "2026-08-20",
      amountMinor: 100000,
      paidAmountMinor: 25000,
      balanceMinor: 75000,
    },
    {
      id: "seguro",
      supplierSnapshot: { name: "Seguros SA" },
      concept: "Póliza anual",
      dueDate: "2026-09-10",
      amountMinor: 50000,
      paidAmountMinor: 50000,
      balanceMinor: 0,
    },
  ];
  assert.deepEqual(filterConsortiumSupplierObligations(obligations, {
    status: "overdue",
    search: "electrica cordoba",
    dateKey: "2026-08-21",
  }).map((item) => item.id), ["electricidad"]);
  assert.deepEqual(filterConsortiumSupplierObligations(obligations, {
    status: "paid",
    dateKey: "2026-08-21",
  }).map((item) => item.id), ["seguro"]);
});

test("exporta cuentas a pagar en CSV compatible con Excel y protege fórmulas", () => {
  const csv = buildConsortiumSupplierObligationsCsv([{
    supplierSnapshot: { name: "=Proveedor riesgoso", taxId: "30-11111111-1" },
    concept: "Mantenimiento",
    voucherType: "invoice",
    voucherNumber: "FC 1",
    issueDate: "2026-08-01",
    dueDate: "2026-08-15",
    amountMinor: 125050,
    paidAmountMinor: 25050,
    balanceMinor: 100000,
    currency: "ARS",
  }], "2026-08-21");
  assert.equal(csv.startsWith("\uFEFF"), true);
  assert.match(csv, /"'=Proveedor riesgoso"/u);
  assert.match(csv, /"1250,50"/u);
  assert.match(csv, /"Vencida con pago parcial"/u);
});

test("resume tesorería con cuentas activas y movimientos auditables", () => {
  assert.deepEqual(getConsortiumTreasurySummary({
    accounts: [
      { currentBalanceMinor: 80000, active: true },
      { currentBalanceMinor: 20000, active: true },
      { currentBalanceMinor: 90000, active: false },
    ],
    movements: [
      { direction: "inflow", amountMinor: 150000 },
      { direction: "outflow", amountMinor: 50000 },
      { direction: "outflow", amountMinor: 30000, voided: true },
    ],
  }), {
    availableMinor: 100000,
    inflowMinor: 150000,
    outflowMinor: 50000,
  });
});

test("reconstruye el saldo de una cuenta a la fecha sin movimientos anulados", () => {
  assert.equal(getConsortiumTreasuryBookBalance({
    accountId: "bank",
    dateKey: "2026-08-15",
    movements: [
      { accountId: "bank", direction: "inflow", amountMinor: 100000, date: "2026-07-01" },
      { accountId: "bank", direction: "outflow", amountMinor: 25000, date: "2026-08-10" },
      { accountId: "bank", direction: "inflow", amountMinor: 50000, date: "2026-08-20" },
      { accountId: "cash", direction: "inflow", amountMinor: 90000, date: "2026-08-01" },
      { accountId: "bank", direction: "outflow", amountMinor: 10000, date: "2026-08-11", voided: true },
    ],
  }), 75000);
});

test("genera el estado económico sin inflar ingresos y egresos por transferencias", () => {
  const statement = buildConsortiumEconomicStatement({
    period: { periodKey: "2026-08", currency: "ARS", totalExpensesMinor: 80000 },
    accounts: [{ type: "reserve", currentBalanceMinor: 30000, active: true }],
    movements: [
      { id: "opening", direction: "inflow", amountMinor: 100000, date: "2026-07-01", source: "opening_balance" },
      { id: "collection", direction: "inflow", amountMinor: 60000, date: "2026-08-02", source: "consortium_collection" },
      { id: "collection-reversal", direction: "outflow", amountMinor: 10000, date: "2026-08-03", source: "consortium_collection_reversal" },
      { id: "other-in", direction: "inflow", amountMinor: 5000, date: "2026-08-04", source: "manual_movement" },
      { id: "supplier", direction: "outflow", amountMinor: 30000, date: "2026-08-05", source: "supplier_payment" },
      { id: "supplier-reversal", direction: "inflow", amountMinor: 5000, date: "2026-08-06", source: "supplier_payment_reversal" },
      { id: "other-out", direction: "outflow", amountMinor: 4000, date: "2026-08-07", source: "manual_movement" },
      { id: "transfer-out", direction: "outflow", amountMinor: 10000, date: "2026-08-08", source: "account_transfer" },
      { id: "transfer-in", direction: "inflow", amountMinor: 10000, date: "2026-08-08", source: "account_transfer" },
    ],
    unitObligations: [
      { periodKey: "2026-08", balanceMinor: 20000 },
      { periodKey: "2026-07", balanceMinor: 90000 },
    ],
    supplierObligations: [
      { periodKey: "2026-08", balanceMinor: 15000 },
      { periodKey: "", issueDate: "2026-08-12", balanceMinor: 5000 },
    ],
  });
  assert.deepEqual({
    opening: statement.openingBalanceMinor,
    collections: statement.collectionsMinor,
    otherInflows: statement.otherInflowsMinor,
    supplierPayments: statement.supplierPaymentsMinor,
    otherOutflows: statement.otherOutflowsMinor,
    closing: statement.closingBalanceMinor,
    unitDebt: statement.unitDebtMinor,
    supplierDebt: statement.supplierDebtMinor,
    reserve: statement.reserveFundsMinor,
    transfers: statement.transferVolumeMinor,
  }, {
    opening: 100000,
    collections: 50000,
    otherInflows: 5000,
    supplierPayments: 25000,
    otherOutflows: 4000,
    closing: 126000,
    unitDebt: 20000,
    supplierDebt: 20000,
    reserve: 30000,
    transfers: 10000,
  });
  const csv = buildConsortiumEconomicStatementCsv(statement);
  assert.equal(csv.startsWith("\uFEFF"), true);
  assert.match(csv, /"Saldo final";"1260,00"/u);
});

test("genera referencias estables y distingue reclamos activos", () => {
  assert.equal(getConsortiumClaimReference({
    id: "abcDEF123456",
    createdDate: "2026-08-24",
  }), "MSG-20260824-123456");
  assert.equal(isConsortiumClaimOpen({ status: "in_progress" }), true);
  assert.equal(isConsortiumClaimOpen({ status: "resolved" }), false);
  assert.equal(isConsortiumClaimOpen({ status: "closed" }), false);
});

test("clasifica mensajes y conserva los registros anteriores como reclamos", () => {
  assert.equal(getConsortiumCommunicationType("notice").label, "Denuncia o aviso");
  assert.equal(getConsortiumCommunicationType("request").label, "Solicitud");
  assert.equal(getConsortiumCommunicationType().label, "Reclamo");
});
