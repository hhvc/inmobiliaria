import { normalizeConsortiumBudget } from "./consorcioBudget.helpers.js";
import { normalizeConsortiumPaymentPolicy } from "./consorcio.helpers.js";

export const CONSORTIUM_CASH_FLOW_SCENARIOS = [
  { id: "conservative", label: "Conservador", defaultCollectionPercent: 60 },
  { id: "probable", label: "Probable", defaultCollectionPercent: 80 },
  { id: "optimistic", label: "Optimista", defaultCollectionPercent: 100 },
];

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const asMinor = (value) => Math.max(0, Math.round(Number(value) || 0));
const clampPercent = (value, fallback) => Math.min(
  100,
  Math.max(0, Number.isFinite(Number(value)) ? Number(value) : fallback),
);

const dateFromKey = (value) => (
  datePattern.test(value || "") ? new Date(`${value}T12:00:00Z`) : null
);

export const addConsortiumCashFlowDays = (dateKey, days) => {
  const date = dateFromKey(dateKey);
  if (!date) return "";
  date.setUTCDate(date.getUTCDate() + Math.trunc(Number(days) || 0));
  return date.toISOString().slice(0, 10);
};

const lastDayOfMonth = (year, month) => new Date(Date.UTC(year, month, 0)).getUTCDate();

const dateForMonthDay = (monthKey, preferredDay) => {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey || "");
  if (!match) return "";
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Math.min(
    lastDayOfMonth(year, month),
    Math.max(1, Math.trunc(Number(preferredDay) || 10)),
  );
  return `${match[1]}-${match[2]}-${String(day).padStart(2, "0")}`;
};

const monthKeysBetween = (startDate, endDate) => {
  const start = dateFromKey(startDate);
  const end = dateFromKey(endDate);
  if (!start || !end || start > end) return [];
  const result = [];
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1, 12));
  while (cursor <= end) {
    result.push(cursor.toISOString().slice(0, 7));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return result;
};

const withinRange = (dateKey, startDate, endDate) => (
  datePattern.test(dateKey || "") && dateKey >= startDate && dateKey <= endDate
);

const clampProjectionDate = (dateKey, startDate) => (
  !datePattern.test(dateKey || "") || dateKey < startDate ? startDate : dateKey
);

const scenarioCollectionDate = (obligation, scenarioId, startDate) => {
  const preferred = scenarioId === "optimistic"
    ? obligation.earlyPaymentDate || obligation.dueDate
    : scenarioId === "conservative"
      ? obligation.secondDueDate || obligation.dueDate
      : obligation.dueDate;
  return clampProjectionDate(preferred, startDate);
};

const scenarioBudgetCollectionTerms = ({
  monthKey,
  dueDay,
  scenarioId,
  startDate,
  amountMinor,
  paymentPolicy,
}) => {
  const dueDate = dateForMonthDay(monthKey, dueDay);
  const policy = normalizeConsortiumPaymentPolicy(paymentPolicy);
  if (scenarioId === "optimistic" && policy.earlyPaymentEnabled) {
    return {
      date: clampProjectionDate(
        addConsortiumCashFlowDays(dueDate, -policy.earlyPaymentDaysBefore),
        startDate,
      ),
      amountMinor: Math.max(0, Math.round(
        asMinor(amountMinor) * (1 - policy.earlyPaymentDiscountPercent / 100),
      )),
    };
  }
  if (scenarioId === "conservative" && policy.secondDueEnabled) {
    return {
      date: clampProjectionDate(
        addConsortiumCashFlowDays(dueDate, policy.secondDueDaysAfter),
        startDate,
      ),
      amountMinor: Math.round(
        asMinor(amountMinor) * (1 + policy.secondDueSurchargePercent / 100),
      ),
    };
  }
  return {
    date: clampProjectionDate(dueDate, startDate),
    amountMinor: asMinor(amountMinor),
  };
};

const activePaymentPlan = (obligation = {}) => {
  const plan = obligation.paymentPlan || {};
  return ["scheduled", "authorized", "partial"].includes(plan.status) ? plan : null;
};

const supplierProjectionDate = (obligation, startDate) => {
  const plan = activePaymentPlan(obligation);
  return clampProjectionDate(plan?.scheduledDate || obligation.dueDate, startDate);
};

const supplierProjectionEvents = (obligation, startDate) => {
  const balanceMinor = asMinor(obligation.balanceMinor);
  const plan = activePaymentPlan(obligation);
  const baseLabel = `${obligation.supplierSnapshot?.name || "Proveedor"}: ${obligation.concept || "Cuenta a pagar"}`;
  if (!plan) return [{
    date: supplierProjectionDate(obligation, startDate),
    direction: "outflow",
    amountMinor: balanceMinor,
    label: baseLabel,
    source: "supplier_payable",
  }];
  const scheduledMinor = Math.min(
    balanceMinor,
    asMinor(plan.remainingMinor ?? plan.amountMinor),
  );
  const remainingMinor = Math.max(0, balanceMinor - scheduledMinor);
  return [
    scheduledMinor > 0 && {
      date: supplierProjectionDate(obligation, startDate),
      direction: "outflow",
      amountMinor: scheduledMinor,
      label: `Pago programado · ${baseLabel}`,
      source: "scheduled_payable",
    },
    remainingMinor > 0 && {
      date: clampProjectionDate(obligation.dueDate, startDate),
      direction: "outflow",
      amountMinor: remainingMinor,
      label: `Saldo no programado · ${baseLabel}`,
      source: "supplier_payable",
    },
  ].filter(Boolean);
};

const approvedBudgetsByYear = (budgets, currency) => new Map(
  (Array.isArray(budgets) ? budgets : [])
    .filter((item) => item?.status === "approved" && (item.currency || "ARS") === currency)
    .map((item) => {
      const normalized = normalizeConsortiumBudget(item);
      return [normalized.year, normalized];
    }),
);

const plannedForMonth = (budgetsByYear, monthKey) => {
  const year = Number(monthKey.slice(0, 4));
  const monthId = monthKey.slice(5, 7);
  const budget = budgetsByYear.get(year);
  if (!budget) return { available: false, amountMinor: 0 };
  return {
    available: true,
    amountMinor: budget.categories.reduce(
      (sum, category) => sum + asMinor(category.months?.[monthId]),
      0,
    ),
  };
};

const recognizedSupplierAmountByMonth = (supplierObligations, currency) => {
  const result = new Map();
  (Array.isArray(supplierObligations) ? supplierObligations : [])
    .filter((item) => item.voided !== true && (item.currency || "ARS") === currency)
    .forEach((item) => {
      const monthKey = /^\d{4}-\d{2}$/.test(item.periodKey || "")
        ? item.periodKey : item.dueDate?.slice?.(0, 7);
      if (!/^\d{4}-\d{2}$/.test(monthKey || "")) return;
      result.set(monthKey, (result.get(monthKey) || 0) + asMinor(item.amountMinor));
    });
  return result;
};

const issuedUnitMonths = (unitObligations, currency) => new Set(
  (Array.isArray(unitObligations) ? unitObligations : [])
    .filter((item) => item.voided !== true && (item.currency || "ARS") === currency)
    .map((item) => item.periodKey)
    .filter((value) => /^\d{4}-\d{2}$/.test(value || "")),
);

const aggregateEvents = ({ events, startingBalanceMinor }) => {
  const days = new Map();
  events.forEach((event) => {
    const current = days.get(event.date) || {
      date: event.date,
      inflowMinor: 0,
      outflowMinor: 0,
      details: [],
    };
    if (event.direction === "inflow") current.inflowMinor += asMinor(event.amountMinor);
    else current.outflowMinor += asMinor(event.amountMinor);
    current.details.push({
      direction: event.direction,
      label: event.label,
      amountMinor: asMinor(event.amountMinor),
      source: event.source,
    });
    days.set(event.date, current);
  });
  let balanceMinor = startingBalanceMinor;
  let minimumBalanceMinor = startingBalanceMinor;
  let minimumBalanceDate = "";
  const rows = [...days.values()]
    .sort((left, right) => left.date.localeCompare(right.date))
    .map((row) => {
      balanceMinor += row.inflowMinor - row.outflowMinor;
      if (balanceMinor < minimumBalanceMinor) {
        minimumBalanceMinor = balanceMinor;
        minimumBalanceDate = row.date;
      }
      return { ...row, balanceMinor };
    });
  return { rows, endingBalanceMinor: balanceMinor, minimumBalanceMinor, minimumBalanceDate };
};

export const buildConsortiumCashFlowProjection = ({
  accounts = [],
  unitObligations = [],
  supplierObligations = [],
  budgets = [],
  currency = "ARS",
  startDate = new Date().toISOString().slice(0, 10),
  horizonDays = 90,
  dueDay = 10,
  paymentPolicy = {},
  scenarioRates = {},
} = {}) => {
  const safeStartDate = datePattern.test(startDate || "")
    ? startDate : new Date().toISOString().slice(0, 10);
  const safeHorizonDays = [30, 60, 90].includes(Number(horizonDays))
    ? Number(horizonDays) : 90;
  const endDate = addConsortiumCashFlowDays(safeStartDate, safeHorizonDays);
  const activeAccounts = (Array.isArray(accounts) ? accounts : []).filter((item) => (
    item.active !== false
    && item.deleted !== true
    && (item.currency || "ARS") === currency
  ));
  const startingBalanceMinor = activeAccounts.reduce(
    (sum, item) => sum + Math.round(Number(item.currentBalanceMinor) || 0),
    0,
  );
  const openReceivables = (Array.isArray(unitObligations) ? unitObligations : []).filter((item) => (
    item.voided !== true
    && (item.currency || "ARS") === currency
    && asMinor(item.balanceMinor) > 0
  ));
  const openPayables = (Array.isArray(supplierObligations) ? supplierObligations : []).filter((item) => (
    item.voided !== true
    && (item.currency || "ARS") === currency
    && asMinor(item.balanceMinor) > 0
  ));
  const budgetsByYear = approvedBudgetsByYear(budgets, currency);
  const recognizedByMonth = recognizedSupplierAmountByMonth(supplierObligations, currency);
  const monthsWithIssuedAssessments = issuedUnitMonths(unitObligations, currency);
  const monthKeys = monthKeysBetween(safeStartDate, endDate);
  const missingBudgetYears = [...new Set(monthKeys
    .map((monthKey) => Number(monthKey.slice(0, 4)))
    .filter((year) => !budgetsByYear.has(year)))];

  const commonOutflows = openPayables
    .flatMap((obligation) => supplierProjectionEvents(obligation, safeStartDate))
    .filter((event) => withinRange(event.date, safeStartDate, endDate));

  let budgetOutflowMinor = 0;
  let budgetReceivableMinor = 0;
  monthKeys.forEach((monthKey) => {
    const planned = plannedForMonth(budgetsByYear, monthKey);
    if (!planned.available || planned.amountMinor <= 0) return;
    const recognizedMinor = recognizedByMonth.get(monthKey) || 0;
    const unregisteredMinor = Math.max(0, planned.amountMinor - recognizedMinor);
    if (unregisteredMinor > 0) {
      const date = clampProjectionDate(dateForMonthDay(monthKey, 15), safeStartDate);
      if (withinRange(date, safeStartDate, endDate)) {
        commonOutflows.push({
          date,
          direction: "outflow",
          amountMinor: unregisteredMinor,
          label: `Gastos presupuestados aún no registrados · ${monthKey}`,
          source: "budget_payable",
        });
        budgetOutflowMinor += unregisteredMinor;
      }
    }
    if (!monthsWithIssuedAssessments.has(monthKey)) budgetReceivableMinor += planned.amountMinor;
  });

  const scenarios = CONSORTIUM_CASH_FLOW_SCENARIOS.map((definition) => {
    const collectionPercent = clampPercent(
      scenarioRates[definition.id],
      definition.defaultCollectionPercent,
    );
    const inflows = openReceivables.map((obligation) => ({
      date: scenarioCollectionDate(obligation, definition.id, safeStartDate),
      direction: "inflow",
      amountMinor: Math.round(asMinor(obligation.balanceMinor) * collectionPercent / 100),
      label: `Cobro esperado · ${obligation.periodKey || "Expensas pendientes"}`,
      source: "unit_receivable",
    })).filter((event) => event.amountMinor > 0 && withinRange(
      event.date,
      safeStartDate,
      endDate,
    ));
    monthKeys.forEach((monthKey) => {
      const planned = plannedForMonth(budgetsByYear, monthKey);
      if (!planned.available || planned.amountMinor <= 0 || monthsWithIssuedAssessments.has(monthKey)) {
        return;
      }
      const collectionTerms = scenarioBudgetCollectionTerms({
        monthKey,
        dueDay,
        scenarioId: definition.id,
        startDate: safeStartDate,
        amountMinor: planned.amountMinor,
        paymentPolicy,
      });
      if (!withinRange(collectionTerms.date, safeStartDate, endDate)) return;
      inflows.push({
        date: collectionTerms.date,
        direction: "inflow",
        amountMinor: Math.round(collectionTerms.amountMinor * collectionPercent / 100),
        label: `Expensas futuras estimadas por presupuesto · ${monthKey}`,
        source: "budget_receivable",
      });
    });
    const totals = aggregateEvents({
      events: [...inflows, ...commonOutflows],
      startingBalanceMinor,
    });
    return {
      ...definition,
      collectionPercent,
      ...totals,
      inflowMinor: inflows.reduce((sum, event) => sum + event.amountMinor, 0),
      outflowMinor: commonOutflows.reduce((sum, event) => sum + event.amountMinor, 0),
      hasDeficit: totals.minimumBalanceMinor < 0,
    };
  });

  return {
    currency,
    startDate: safeStartDate,
    endDate,
    horizonDays: safeHorizonDays,
    startingBalanceMinor,
    activeAccountCount: activeAccounts.length,
    openReceivableMinor: openReceivables.reduce((sum, item) => sum + asMinor(item.balanceMinor), 0),
    openPayableMinor: openPayables.reduce((sum, item) => sum + asMinor(item.balanceMinor), 0),
    budgetOutflowMinor,
    budgetReceivableMinor,
    missingBudgetYears,
    scenarios,
  };
};

const csvCell = (value) => {
  const text = value?.toString?.() || "";
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
};

const csvMoney = (value) => (Math.round(Number(value) || 0) / 100)
  .toFixed(2)
  .replace(".", ",");

export const buildConsortiumCashFlowCsv = ({ projection, scenarioId = "probable" } = {}) => {
  const scenario = projection?.scenarios?.find((item) => item.id === scenarioId);
  if (!projection || !scenario) return "";
  const rows = [
    ["Flujo de fondos proyectado", `${projection.startDate} a ${projection.endDate}`],
    ["Escenario", scenario.label],
    ["Cobranza estimada", `${scenario.collectionPercent}%`],
    ["Saldo inicial", csvMoney(projection.startingBalanceMinor), projection.currency],
    [],
    ["Fecha", "Conceptos", "Ingresos", "Egresos", "Saldo proyectado", "Moneda"],
    ...scenario.rows.map((row) => [
      row.date,
      row.details.map((item) => item.label).join(" | "),
      csvMoney(row.inflowMinor),
      csvMoney(row.outflowMinor),
      csvMoney(row.balanceMinor),
      projection.currency,
    ]),
  ];
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(";")).join("\n")}`;
};
