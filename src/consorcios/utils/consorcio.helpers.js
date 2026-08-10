const asNumber = (value) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const raw = value?.toString?.().trim().replace(/\s/g, "") || "";
  const lastComma = raw.lastIndexOf(",");
  const lastDot = raw.lastIndexOf(".");
  let normalized = raw;
  if (lastComma >= 0 && lastDot >= 0) {
    const decimalSeparator = lastComma > lastDot ? "," : ".";
    const thousandsSeparator = decimalSeparator === "," ? "." : ",";
    normalized = raw.split(thousandsSeparator).join("").replace(decimalSeparator, ".");
  } else if (lastComma >= 0) {
    normalized = raw.replace(/\./g, "").replace(",", ".");
  } else if (lastDot >= 0) {
    const decimals = raw.length - lastDot - 1;
    normalized = decimals > 0 && decimals <= 2 ? raw : raw.replace(/\./g, "");
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const majorToMinor = (value) => Math.round(asNumber(value) * 100);

export const minorToMajorInput = (value) => {
  const amount = Math.round(Number(value) || 0) / 100;
  return amount ? amount.toFixed(2).replace(".", ",") : "";
};

export const formatConsortiumMoney = (minor = 0, currency = "ARS") =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: currency === "ARS" ? "ARS" : currency,
    minimumFractionDigits: 2,
  }).format((Number(minor) || 0) / 100);

export const getConsortiumPeriodLabel = (periodKey = "") => {
  const match = /^(\d{4})-(\d{2})$/.exec(periodKey);
  if (!match) return periodKey || "Sin período";
  const date = new Date(Number(match[1]), Number(match[2]) - 1, 1);
  const label = new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric" }).format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
};

export const getDefaultConsortiumDueDate = (periodKey = "", dueDay = 10) => {
  const match = /^(\d{4})-(\d{2})$/.exec(periodKey);
  if (!match) return "";
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const nextMonth = new Date(year, monthIndex + 1, 1);
  const lastDay = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0).getDate();
  const day = Math.min(Math.max(1, Math.trunc(Number(dueDay) || 10)), lastDay);
  return [
    nextMonth.getFullYear(),
    String(nextMonth.getMonth() + 1).padStart(2, "0"),
    String(day).padStart(2, "0"),
  ].join("-");
};

const allocateExact = (amountMinor, weightedUnits) => {
  const amount = Math.max(0, Math.round(Number(amountMinor) || 0));
  const totalWeight = weightedUnits.reduce((sum, item) => sum + item.weight, 0);
  if (!weightedUnits.length || totalWeight <= 0) return new Map();
  const allocations = weightedUnits.map((item) => {
    const exact = amount * item.weight / totalWeight;
    const base = Math.floor(exact);
    return { ...item, amount: base, fraction: exact - base };
  });
  let remainder = amount - allocations.reduce((sum, item) => sum + item.amount, 0);
  allocations.sort((a, b) => b.fraction - a.fraction || a.unitId.localeCompare(b.unitId));
  for (let index = 0; remainder > 0; index = (index + 1) % allocations.length) {
    allocations[index].amount += 1;
    remainder -= 1;
  }
  return new Map(allocations.map((item) => [item.unitId, item.amount]));
};

export const validateConsortium = (value = {}) => {
  const errors = [];
  if (!value.name?.trim()) errors.push("Ingresá el nombre del consorcio.");
  if (!value.address?.trim()) errors.push("Ingresá el domicilio del consorcio.");
  if (Number(value.dueDay || 0) < 1 || Number(value.dueDay || 0) > 31) {
    errors.push("El día habitual de vencimiento debe estar entre 1 y 31.");
  }
  return errors;
};

export const validateConsortiumUnit = (value = {}) => {
  const errors = [];
  if (!value.code?.trim()) errors.push("Ingresá el identificador de la unidad.");
  if (Number(value.coefficient || 0) < 0) errors.push("El coeficiente no puede ser negativo.");
  return errors;
};

export const calculateConsortiumAssessments = ({ units = [], expenses = [] } = {}) => {
  const activeUnits = units.filter((unit) => unit.active !== false && unit.deleted !== true);
  if (!activeUnits.length) throw new Error("Cargá al menos una unidad activa antes de liquidar.");
  const results = new Map(activeUnits.map((unit) => [unit.id, {
    unitId: unit.id,
    unitSnapshot: {
      code: unit.code || "",
      floor: unit.floor || "",
      apartment: unit.apartment || "",
      ownerName: unit.ownerName || "",
      occupantName: unit.occupantName || "",
      coefficient: Number(unit.coefficient || 0),
    },
    ordinaryMinor: 0,
    extraordinaryMinor: 0,
    totalAmountMinor: 0,
    breakdown: [],
  }]));

  expenses.forEach((expense) => {
    const amountMinor = Math.max(0, Math.round(Number(expense.amountMinor) || 0));
    if (!expense.concept?.trim() || amountMinor <= 0) return;
    let weightedUnits;
    if (expense.distributionMode === "specific") {
      if (!results.has(expense.specificUnitId)) {
        throw new Error(`Seleccioná una unidad válida para ${expense.concept}.`);
      }
      weightedUnits = [{ unitId: expense.specificUnitId, weight: 1 }];
    } else if (expense.distributionMode === "equal") {
      weightedUnits = activeUnits.map((unit) => ({ unitId: unit.id, weight: 1 }));
    } else {
      weightedUnits = activeUnits
        .map((unit) => ({ unitId: unit.id, weight: Math.max(0, Number(unit.coefficient) || 0) }))
        .filter((item) => item.weight > 0);
      if (!weightedUnits.length) {
        throw new Error(`No hay coeficientes positivos para distribuir ${expense.concept}.`);
      }
    }
    const allocations = allocateExact(amountMinor, weightedUnits);
    allocations.forEach((allocatedMinor, unitId) => {
      const result = results.get(unitId);
      const category = expense.category === "extraordinary" ? "extraordinary" : "ordinary";
      if (category === "extraordinary") result.extraordinaryMinor += allocatedMinor;
      else result.ordinaryMinor += allocatedMinor;
      result.totalAmountMinor += allocatedMinor;
      result.breakdown.push({
        expenseId: expense.id || "",
        concept: expense.concept.trim(),
        category,
        distributionMode: expense.distributionMode || "coefficient",
        amountMinor: allocatedMinor,
      });
    });
  });

  const assessments = Array.from(results.values());
  const totalExpensesMinor = expenses.reduce(
    (sum, expense) => sum + Math.max(0, Math.round(Number(expense.amountMinor) || 0)),
    0,
  );
  const totalAssessedMinor = assessments.reduce((sum, item) => sum + item.totalAmountMinor, 0);
  if (totalAssessedMinor !== totalExpensesMinor) {
    throw new Error("La distribución no coincide con el total de gastos.");
  }
  return { assessments, totalExpensesMinor, totalAssessedMinor };
};

export const getConsortiumObligationStatus = (obligation = {}, todayKey = new Date().toISOString().slice(0, 10)) => {
  const balance = Math.max(0, Number(obligation.balanceMinor) || 0);
  const paid = Math.max(0, Number(obligation.paidAmountMinor) || 0);
  if (balance <= 0) return "paid";
  if (paid > 0) return obligation.dueDate && obligation.dueDate < todayKey ? "overdue" : "partial";
  return obligation.dueDate && obligation.dueDate < todayKey ? "overdue" : "pending";
};

export const getConsortiumObligationStatusLabel = (status = "pending") => ({
  pending: { label: "Pendiente", badge: "text-bg-secondary" },
  partial: { label: "Pago parcial", badge: "text-bg-warning" },
  overdue: { label: "Vencida", badge: "text-bg-danger" },
  paid: { label: "Pagada", badge: "text-bg-success" },
}[status] || { label: status, badge: "text-bg-light" });

export const getConsortiumExpenseCategoryLabel = (category = "ordinary") => (
  category === "extraordinary" ? "Extraordinaria" : "Ordinaria"
);

export const getConsortiumDistributionLabel = (mode = "coefficient") => ({
  coefficient: "Por coeficiente",
  equal: "Partes iguales",
  specific: "Unidad determinada",
}[mode] || mode || "Sin especificar");

export const getConsortiumLiquidationNumber = ({ periodKey = "", unitCode = "" } = {}) => {
  const period = periodKey.toString().replace(/\D/g, "").slice(0, 6) || "SFP";
  const unit = unitCode.toString().trim().toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "UNIDAD";
  return `LIQ-${period}-${unit}`;
};

export const buildConsortiumLiquidationLines = ({ period = {}, obligation = {} } = {}) => {
  const expenses = new Map(
    (Array.isArray(period.expenses) ? period.expenses : [])
      .map((expense) => [expense.id, expense]),
  );
  return (Array.isArray(obligation.breakdown) ? obligation.breakdown : []).map((line) => ({
    expenseId: line.expenseId || "",
    concept: line.concept || expenses.get(line.expenseId)?.concept || "Gasto",
    category: line.category === "extraordinary" ? "extraordinary" : "ordinary",
    distributionMode: line.distributionMode ||
      expenses.get(line.expenseId)?.distributionMode || "coefficient",
    expenseTotalMinor: Number(expenses.get(line.expenseId)?.amountMinor || 0),
    unitAmountMinor: Number(line.amountMinor || 0),
  }));
};
