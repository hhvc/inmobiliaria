import assert from "node:assert/strict";
import test from "node:test";

import {
  buildConsortiumCashFlowCsv,
  buildConsortiumCashFlowProjection,
} from "../src/consorcios/utils/consorcioCashFlow.helpers.js";

const accounts = [
  { id: "bank", active: true, currency: "ARS", currentBalanceMinor: 500000 },
  { id: "usd", active: true, currency: "USD", currentBalanceMinor: 900000 },
];

test("proyecta tres escenarios sin mezclar monedas", () => {
  const projection = buildConsortiumCashFlowProjection({
    accounts,
    currency: "ARS",
    startDate: "2026-10-12",
    horizonDays: 30,
    scenarioRates: { conservative: 50, probable: 80, optimistic: 100 },
    unitObligations: [{
      id: "assessment",
      periodKey: "2026-10",
      currency: "ARS",
      balanceMinor: 1000000,
      dueDate: "2026-10-15",
      secondDueDate: "2026-10-25",
    }],
    supplierObligations: [{
      id: "invoice",
      currency: "ARS",
      balanceMinor: 600000,
      dueDate: "2026-10-20",
      supplierSnapshot: { name: "Proveedor" },
      concept: "Mantenimiento",
    }],
  });
  assert.equal(projection.startingBalanceMinor, 500000);
  assert.equal(projection.scenarios.length, 3);
  assert.equal(projection.scenarios.find((item) => item.id === "conservative").endingBalanceMinor, 400000);
  assert.equal(projection.scenarios.find((item) => item.id === "probable").endingBalanceMinor, 700000);
  assert.equal(projection.scenarios.find((item) => item.id === "optimistic").endingBalanceMinor, 900000);
});

test("completa meses futuros con el presupuesto aprobado sin duplicar lo emitido", () => {
  const categories = [{ id: "utilities", months: { "10": 1000000, "11": 1200000 } }];
  const projection = buildConsortiumCashFlowProjection({
    accounts: [{ active: true, currency: "ARS", currentBalanceMinor: 0 }],
    currency: "ARS",
    startDate: "2026-10-12",
    horizonDays: 60,
    dueDay: 10,
    scenarioRates: { probable: 80 },
    unitObligations: [{
      periodKey: "2026-10",
      currency: "ARS",
      balanceMinor: 500000,
      dueDate: "2026-10-15",
    }],
    supplierObligations: [{
      periodKey: "2026-10",
      currency: "ARS",
      amountMinor: 700000,
      balanceMinor: 700000,
      dueDate: "2026-10-20",
    }],
    budgets: [{ year: 2026, status: "approved", currency: "ARS", categories }],
  });
  const probable = projection.scenarios.find((item) => item.id === "probable");
  assert.equal(projection.budgetOutflowMinor, 1500000);
  assert.equal(projection.budgetReceivableMinor, 1200000);
  assert.equal(probable.inflowMinor, 1360000);
  assert.equal(probable.outflowMinor, 2200000);
  assert.equal(probable.endingBalanceMinor, -840000);
  assert.equal(probable.hasDeficit, true);
});

test("respeta una programación de pago y exporta el escenario seleccionado", () => {
  const projection = buildConsortiumCashFlowProjection({
    accounts,
    currency: "ARS",
    startDate: "2026-10-12",
    horizonDays: 30,
    supplierObligations: [{
      currency: "ARS",
      balanceMinor: 200000,
      dueDate: "2026-10-15",
      concept: "Seguro",
      paymentPlan: {
        status: "authorized",
        scheduledDate: "2026-10-28",
        amountMinor: 200000,
        remainingMinor: 200000,
      },
    }],
  });
  const probable = projection.scenarios.find((item) => item.id === "probable");
  assert.equal(probable.rows[0].date, "2026-10-28");
  const csv = buildConsortiumCashFlowCsv({ projection, scenarioId: "probable" });
  assert.match(csv, /Flujo de fondos proyectado/);
  assert.match(csv, /2026-10-28/);
});

test("separa el pago parcial programado del saldo restante", () => {
  const projection = buildConsortiumCashFlowProjection({
    accounts,
    currency: "ARS",
    startDate: "2026-10-12",
    horizonDays: 30,
    supplierObligations: [{
      currency: "ARS",
      balanceMinor: 500000,
      dueDate: "2026-10-20",
      concept: "Reparación",
      paymentPlan: {
        status: "authorized",
        scheduledDate: "2026-10-28",
        amountMinor: 200000,
        remainingMinor: 200000,
      },
    }],
  });
  const probable = projection.scenarios.find((item) => item.id === "probable");
  assert.equal(probable.rows.find((item) => item.date === "2026-10-20").outflowMinor, 300000);
  assert.equal(probable.rows.find((item) => item.date === "2026-10-28").outflowMinor, 200000);
  assert.equal(probable.outflowMinor, 500000);
});
