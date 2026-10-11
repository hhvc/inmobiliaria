import { calculateConsortiumAssessments } from "./consorcio.helpers.js";

export const CONSORTIUM_BUDGET_MONTHS = [
  { id: "01", shortLabel: "Ene", label: "Enero" },
  { id: "02", shortLabel: "Feb", label: "Febrero" },
  { id: "03", shortLabel: "Mar", label: "Marzo" },
  { id: "04", shortLabel: "Abr", label: "Abril" },
  { id: "05", shortLabel: "May", label: "Mayo" },
  { id: "06", shortLabel: "Jun", label: "Junio" },
  { id: "07", shortLabel: "Jul", label: "Julio" },
  { id: "08", shortLabel: "Ago", label: "Agosto" },
  { id: "09", shortLabel: "Sep", label: "Septiembre" },
  { id: "10", shortLabel: "Oct", label: "Octubre" },
  { id: "11", shortLabel: "Nov", label: "Noviembre" },
  { id: "12", shortLabel: "Dic", label: "Diciembre" },
];

export const CONSORTIUM_BUDGET_CATEGORIES = [
  { id: "staff", label: "Personal y cargas sociales", expenseClass: "ordinary" },
  { id: "utilities", label: "Servicios públicos", expenseClass: "ordinary" },
  { id: "maintenance", label: "Mantenimiento y reparaciones", expenseClass: "ordinary" },
  { id: "professional", label: "Administración y servicios profesionales", expenseClass: "ordinary" },
  { id: "insurance", label: "Seguros", expenseClass: "ordinary" },
  { id: "taxes", label: "Impuestos y tasas", expenseClass: "ordinary" },
  { id: "extraordinary", label: "Gastos extraordinarios", expenseClass: "extraordinary" },
  { id: "reserve", label: "Fondo de reserva", expenseClass: "ordinary" },
  { id: "other", label: "Otros gastos ordinarios", expenseClass: "ordinary" },
];

const categoryIds = new Set(CONSORTIUM_BUDGET_CATEGORIES.map((item) => item.id));
const monthIds = new Set(CONSORTIUM_BUDGET_MONTHS.map((item) => item.id));
const asMinor = (value) => Math.max(0, Math.round(Number(value) || 0));
const isBudgetActualPeriod = (period = {}, year) => (
  period.deleted !== true
  && ["issued", "closed"].includes(period.status)
  && (!period.source || period.source === "monthly_assessment")
  && period.periodKey?.startsWith?.(`${year}-`)
);

const normalizeGroupId = (value) => (
  /^[a-z0-9_-]{1,48}$/i.test(value?.toString?.().trim() || "")
    ? value.toString().trim()
    : "general"
);

const emptyMonths = () => Object.fromEntries(
  CONSORTIUM_BUDGET_MONTHS.map((month) => [month.id, 0]),
);

export const getDefaultConsortiumBudgetYear = (date = new Date()) => (
  date.getMonth() >= 9 ? date.getFullYear() + 1 : date.getFullYear()
);

export const createConsortiumBudgetCategories = (coefficientGroupId = "general") => (
  CONSORTIUM_BUDGET_CATEGORIES.map((category) => ({
    ...category,
    coefficientGroupId: normalizeGroupId(coefficientGroupId),
    months: emptyMonths(),
  }))
);

export const normalizeConsortiumBudget = (value = {}) => {
  const sourceCategories = new Map(
    (Array.isArray(value.categories) ? value.categories : [])
      .filter((item) => categoryIds.has(item?.id))
      .map((item) => [item.id, item]),
  );
  const categories = CONSORTIUM_BUDGET_CATEGORIES.map((definition) => {
    const source = sourceCategories.get(definition.id) || {};
    return {
      ...definition,
      coefficientGroupId: normalizeGroupId(source.coefficientGroupId),
      months: Object.fromEntries(CONSORTIUM_BUDGET_MONTHS.map((month) => [
        month.id,
        asMinor(source.months?.[month.id]),
      ])),
    };
  });
  const year = Math.min(2100, Math.max(2000, Math.trunc(Number(value.year) || new Date().getFullYear())));
  return {
    schemaVersion: 1,
    year,
    currency: value.currency?.toString?.().trim().slice(0, 10) || "ARS",
    status: value.status === "approved" ? "approved" : "draft",
    ownerVisible: value.status === "approved" && value.ownerVisible === true,
    alertThresholdPercent: Math.min(500, Math.max(0, Number(value.alertThresholdPercent) || 10)),
    notes: value.notes?.toString?.().trim().slice(0, 4000) || "",
    categories,
  };
};

export const getConsortiumBudgetCategoryId = (expense = {}) => {
  if (expense.category === "extraordinary") return "extraordinary";
  return categoryIds.has(expense.budgetCategory) ? expense.budgetCategory : "other";
};

export const buildConsortiumBudgetFromPeriods = ({
  periods = [],
  targetYear,
  sourceYear,
  currency = "ARS",
  coefficientGroupId = "general",
} = {}) => {
  const budget = normalizeConsortiumBudget({
    year: targetYear,
    currency,
    categories: createConsortiumBudgetCategories(coefficientGroupId),
  });
  periods
    .filter((period) => isBudgetActualPeriod(period, sourceYear))
    .forEach((period) => {
      const monthId = period.periodKey?.slice?.(5, 7);
      if (!monthIds.has(monthId)) return;
      (Array.isArray(period.expenses) ? period.expenses : []).forEach((expense) => {
        const categoryId = getConsortiumBudgetCategoryId(expense);
        const row = budget.categories.find((item) => item.id === categoryId);
        if (row) row.months[monthId] += asMinor(expense.amountMinor);
      });
    });
  return budget;
};

export const buildConsortiumBudgetComparison = ({ budget = {}, periods = [] } = {}) => {
  const normalized = normalizeConsortiumBudget(budget);
  const actualByCategory = Object.fromEntries(normalized.categories.map((item) => [
    item.id,
    emptyMonths(),
  ]));
  periods
    .filter((period) => isBudgetActualPeriod(period, normalized.year))
    .forEach((period) => {
      const monthId = period.periodKey?.slice?.(5, 7);
      if (!monthIds.has(monthId)) return;
      (Array.isArray(period.expenses) ? period.expenses : []).forEach((expense) => {
        const categoryId = getConsortiumBudgetCategoryId(expense);
        actualByCategory[categoryId][monthId] += asMinor(expense.amountMinor);
      });
    });

  const classify = (plannedMinor, actualMinor) => {
    const varianceMinor = actualMinor - plannedMinor;
    const variancePercent = plannedMinor > 0 ? (varianceMinor / plannedMinor) * 100 : null;
    const overThreshold = actualMinor > plannedMinor && (
      plannedMinor === 0 || variancePercent > normalized.alertThresholdPercent
    );
    return { varianceMinor, variancePercent, overThreshold };
  };

  const categoryRows = normalized.categories.map((category) => {
    const plannedMinor = Object.values(category.months).reduce((sum, amount) => sum + amount, 0);
    const actualMinor = Object.values(actualByCategory[category.id]).reduce(
      (sum, amount) => sum + amount,
      0,
    );
    return {
      ...category,
      plannedMinor,
      actualMinor,
      ...classify(plannedMinor, actualMinor),
      actualMonths: actualByCategory[category.id],
    };
  });
  const monthRows = CONSORTIUM_BUDGET_MONTHS.map((month) => {
    const plannedMinor = normalized.categories.reduce(
      (sum, category) => sum + category.months[month.id],
      0,
    );
    const actualMinor = normalized.categories.reduce(
      (sum, category) => sum + actualByCategory[category.id][month.id],
      0,
    );
    return { ...month, plannedMinor, actualMinor, ...classify(plannedMinor, actualMinor) };
  });
  const plannedMinor = categoryRows.reduce((sum, item) => sum + item.plannedMinor, 0);
  const actualMinor = categoryRows.reduce((sum, item) => sum + item.actualMinor, 0);
  return {
    budget: normalized,
    categoryRows,
    monthRows,
    plannedMinor,
    actualMinor,
    ...classify(plannedMinor, actualMinor),
  };
};

export const buildConsortiumBudgetUnitProjection = ({ budget = {}, units = [], monthId = "01" } = {}) => {
  const normalized = normalizeConsortiumBudget(budget);
  const expenses = normalized.categories
    .map((category) => ({
      id: `budget_${normalized.year}_${monthId}_${category.id}`,
      concept: category.label,
      category: category.expenseClass === "extraordinary" ? "extraordinary" : "ordinary",
      distributionMode: "coefficient",
      coefficientGroupId: category.coefficientGroupId || "general",
      amountMinor: asMinor(category.months?.[monthId]),
    }))
    .filter((item) => item.amountMinor > 0);
  if (!expenses.length || !units.length) return { assessments: [], totalExpensesMinor: 0, totalAssessedMinor: 0 };
  return calculateConsortiumAssessments({ units, expenses });
};

const csvCell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;

export const buildConsortiumBudgetCsv = (comparison = {}) => {
  const currency = comparison.budget?.currency || "ARS";
  const rows = [
    ["Presupuesto", comparison.budget?.year || "", currency],
    ["Rubro", ...CONSORTIUM_BUDGET_MONTHS.map((month) => month.shortLabel), "Anual", "Ejecutado", "Desvío"],
    ...(comparison.categoryRows || []).map((category) => [
      category.label,
      ...CONSORTIUM_BUDGET_MONTHS.map((month) => (category.months[month.id] / 100).toFixed(2)),
      (category.plannedMinor / 100).toFixed(2),
      (category.actualMinor / 100).toFixed(2),
      (category.varianceMinor / 100).toFixed(2),
    ]),
  ];
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(";")).join("\n")}`;
};
