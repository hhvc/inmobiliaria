import test from "node:test";
import assert from "node:assert/strict";

import {
  buildConsortiumBudgetComparison,
  buildConsortiumBudgetFromPeriods,
  buildConsortiumBudgetUnitProjection,
  createConsortiumBudgetCategories,
  getDefaultConsortiumBudgetYear,
  normalizeConsortiumBudget,
} from "../src/consorcios/utils/consorcioBudget.helpers.js";

test("propone el año siguiente desde octubre", () => {
  assert.equal(getDefaultConsortiumBudgetYear(new Date(2026, 9, 11)), 2027);
  assert.equal(getDefaultConsortiumBudgetYear(new Date(2026, 8, 30)), 2026);
});

test("normaliza un presupuesto anual completo y oculta borradores a propietarios", () => {
  const normalized = normalizeConsortiumBudget({
    year: 2027,
    status: "draft",
    ownerVisible: true,
    categories: [{ id: "utilities", months: { "01": 12345, "02": -50 } }],
  });
  assert.equal(normalized.categories.length, 9);
  assert.equal(normalized.categories.find((item) => item.id === "utilities").months["01"], 12345);
  assert.equal(normalized.categories.find((item) => item.id === "utilities").months["02"], 0);
  assert.equal(normalized.ownerVisible, false);
});

test("copia los gastos ejecutados de un ejercicio al presupuesto siguiente", () => {
  const budget = buildConsortiumBudgetFromPeriods({
    periods: [{
      periodKey: "2026-08",
      status: "closed",
      expenses: [
        { category: "ordinary", budgetCategory: "utilities", amountMinor: 150000 },
        { category: "extraordinary", amountMinor: 80000 },
        { category: "ordinary", amountMinor: 20000 },
      ],
    }],
    sourceYear: 2026,
    targetYear: 2027,
  });
  assert.equal(budget.categories.find((item) => item.id === "utilities").months["08"], 150000);
  assert.equal(budget.categories.find((item) => item.id === "extraordinary").months["08"], 80000);
  assert.equal(budget.categories.find((item) => item.id === "other").months["08"], 20000);
});

test("compara presupuesto con liquidaciones emitidas e ignora borradores", () => {
  const categories = createConsortiumBudgetCategories();
  categories.find((item) => item.id === "utilities").months["01"] = 100000;
  const comparison = buildConsortiumBudgetComparison({
    budget: { year: 2027, alertThresholdPercent: 10, categories },
    periods: [
      { periodKey: "2027-01", status: "issued", expenses: [{ budgetCategory: "utilities", amountMinor: 120000 }] },
      { periodKey: "2027-02", status: "draft", expenses: [{ budgetCategory: "utilities", amountMinor: 900000 }] },
      { periodKey: "2027-01", status: "issued", source: "penalty", expenses: [{ amountMinor: 700000 }] },
    ],
  });
  const utilities = comparison.categoryRows.find((item) => item.id === "utilities");
  assert.equal(comparison.plannedMinor, 100000);
  assert.equal(comparison.actualMinor, 120000);
  assert.equal(utilities.varianceMinor, 20000);
  assert.equal(utilities.overThreshold, true);
});

test("proyecta el presupuesto mensual por coeficientes de las unidades", () => {
  const categories = createConsortiumBudgetCategories();
  categories.find((item) => item.id === "maintenance").months["03"] = 100000;
  const projection = buildConsortiumBudgetUnitProjection({
    budget: { year: 2027, categories },
    monthId: "03",
    units: [
      { id: "a", active: true, coefficient: 60, coefficients: { general: 60 }, code: "1" },
      { id: "b", active: true, coefficient: 40, coefficients: { general: 40 }, code: "2" },
    ],
  });
  assert.equal(projection.totalAssessedMinor, 100000);
  assert.equal(projection.assessments.find((item) => item.unitId === "a").totalAmountMinor, 60000);
  assert.equal(projection.assessments.find((item) => item.unitId === "b").totalAmountMinor, 40000);
});
