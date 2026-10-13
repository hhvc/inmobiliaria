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

const normalizeExpenseSignatureText = (value = "") => value
  ?.toString?.()
  .trim()
  .replace(/\s+/g, " ")
  .toLocaleLowerCase("es-AR") || "";

export const getConsortiumExpenseIdentity = (expense = {}) => [
  normalizeExpenseSignatureText(expense.concept),
  expense.category === "extraordinary" ? "extraordinary" : "ordinary",
  ["coefficient", "equal", "specific"].includes(expense.distributionMode)
    ? expense.distributionMode
    : "coefficient",
  expense.coefficientGroupId || "general",
  expense.specificUnitId || "",
].join("|");

export const getConsortiumExpenseSignature = (expense = {}) => [
  getConsortiumExpenseIdentity(expense),
  Math.max(0, Math.round(Number(expense.amountMinor) || 0)),
  normalizeExpenseSignatureText(expense.notes),
].join("|");

export const mergeConsortiumDraftExpenses = ({
  current = [],
  incoming = [],
  createId = (_, index) => `expense_${Date.now()}_${index + 1}`,
  replaceMatching = false,
} = {}) => {
  const merged = [...(Array.isArray(current) ? current : [])];
  const signatures = new Set(merged.map(getConsortiumExpenseSignature));
  const identities = new Map(merged.map((item, index) => [getConsortiumExpenseIdentity(item), index]));
  let addedCount = 0;
  let updatedCount = 0;

  (Array.isArray(incoming) ? incoming : []).forEach((expense, index) => {
    const normalized = {
      id: createId(expense, index),
      concept: expense.concept?.toString?.().trim() || "",
      category: expense.category === "extraordinary" ? "extraordinary" : "ordinary",
      distributionMode: ["coefficient", "equal", "specific"].includes(expense.distributionMode)
        ? expense.distributionMode
        : "coefficient",
      coefficientGroupId: expense.coefficientGroupId || "general",
      specificUnitId: expense.specificUnitId || "",
      amountMinor: Math.max(0, Math.round(Number(expense.amountMinor) || 0)),
      notes: expense.notes?.toString?.().trim() || "",
    };
    if (!normalized.concept || normalized.amountMinor <= 0) return;
    const signature = getConsortiumExpenseSignature(normalized);
    if (signatures.has(signature)) return;
    const identity = getConsortiumExpenseIdentity(normalized);
    if (identities.has(identity)) {
      if (replaceMatching) {
        const currentIndex = identities.get(identity);
        const currentExpense = merged[currentIndex];
        signatures.delete(getConsortiumExpenseSignature(currentExpense));
        merged[currentIndex] = { ...normalized, id: currentExpense.id };
        signatures.add(signature);
        updatedCount += 1;
      }
      return;
    }
    signatures.add(signature);
    identities.set(identity, merged.length);
    merged.push(normalized);
    addedCount += 1;
  });

  return { expenses: merged, addedCount, updatedCount };
};

export const getConsortiumPeriodLabel = (periodKey = "") => {
  const match = /^(\d{4})-(\d{2})$/.exec(periodKey);
  if (!match) return periodKey || "Sin período";
  const date = new Date(Number(match[1]), Number(match[2]) - 1, 1);
  const label = new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric" }).format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
};

export const getConsortiumAccountingPeriodLabel = ({
  periodKey = "",
  source = "",
  accountingSource = "",
  type = "",
} = {}) => (
  source === "opening_balance"
    || source === "opening_balance_migration"
    || accountingSource === "opening_balance"
    || type === "opening_debit"
    || type === "opening_credit"
    ? `Saldo inicial · ${getConsortiumPeriodLabel(periodKey)}`
    : source === "penalty"
      || accountingSource === "penalty"
      || type === "penalty_debit"
      || type === "penalty_credit"
      ? `Multa · ${getConsortiumPeriodLabel(periodKey)}`
      : getConsortiumPeriodLabel(periodKey)
);

export const getConsortiumAdjustmentTypeLabel = (type = "") => ({
  opening_debit: "Saldo inicial deudor",
  opening_credit: "Saldo inicial a favor",
  rectification_debit: "Nota de débito",
  rectification_credit: "Nota de crédito",
  penalty_debit: "Multa / penalidad",
  penalty_credit: "Anulación de multa",
  interest_debit: "Interés por mora",
}[type] || type || "Ajuste");

export const getConsortiumPenaltyAuthorityLabel = (authority = "") => ({
  assembly: "Asamblea",
  council: "Consejo de propietarios",
  administrator: "Administración",
  other: "Otra autoridad",
}[authority] || authority || "Sin informar");

export const getConsortiumPenaltyStatus = (penalty = {}, obligation = null) => {
  if (penalty.status === "confirmed" && obligation && Number(obligation.balanceMinor || 0) <= 0) {
    return "paid";
  }
  return penalty.status || "draft";
};

export const getConsortiumPenaltyStatusLabel = (status = "draft") => ({
  draft: { label: "Borrador", badge: "text-bg-secondary" },
  notified: { label: "Notificada", badge: "text-bg-info" },
  confirmed: { label: "Confirmada", badge: "text-bg-warning" },
  challenged: { label: "Impugnada", badge: "text-bg-danger" },
  voided: { label: "Anulada", badge: "text-bg-dark" },
  paid: { label: "Pagada", badge: "text-bg-success" },
}[status] || { label: status, badge: "text-bg-light" });

export const getConsortiumAccountSummary = ({
  obligations = [],
  payments = [],
  creditBalanceMinor = 0,
} = {}) => {
  const activePayments = payments.filter((item) => item.voided !== true);
  const charges = obligations.reduce(
    (sum, item) => sum + Math.max(0, Number(item.totalAmountMinor) || 0),
    0,
  );
  const collected = activePayments.reduce(
    (sum, item) => sum + Math.max(0, Number(item.amountMinor) || 0),
    0,
  );
  const debt = obligations.reduce(
    (sum, item) => sum + Math.max(0, Number(item.balanceMinor) || 0),
    0,
  );
  const credit = Math.max(0, Number(creditBalanceMinor) || 0);
  return {
    charges,
    payments: collected,
    debt,
    credit,
    balance: debt - credit,
  };
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

export const CONSORTIUM_DEFAULT_COEFFICIENT_GROUP = Object.freeze({
  id: "general",
  name: "Gastos generales",
  active: true,
});

export const normalizeConsortiumCoefficientGroups = (groups = []) => {
  const source = Array.isArray(groups) ? groups : [];
  const seen = new Set();
  const normalized = source.map((item, index) => {
    const rawId = `${item?.id || ""}`.trim().toLowerCase();
    const id = (index === 0 ? "general" : rawId)
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48);
    const name = `${item?.name || ""}`.trim().slice(0, 100);
    if (!id || !name || seen.has(id)) return null;
    seen.add(id);
    return { id, name, active: index === 0 ? true : item?.active !== false };
  }).filter(Boolean).slice(0, 8);
  if (!normalized.length || normalized[0].id !== "general") {
    return [
      { ...CONSORTIUM_DEFAULT_COEFFICIENT_GROUP },
      ...normalized.filter((item) => item.id !== "general").slice(0, 7),
    ];
  }
  return normalized;
};

export const getConsortiumUnitCoefficient = (unit = {}, groupId = "general") => {
  const selectedId = groupId || "general";
  const fromMap = Number(unit?.coefficients?.[selectedId]);
  if (Number.isFinite(fromMap) && fromMap >= 0) return fromMap;
  return selectedId === "general" ? Math.max(0, Number(unit.coefficient) || 0) : 0;
};

export const normalizeConsortiumPaymentPolicy = (value = {}) => ({
  earlyPaymentEnabled: value?.earlyPaymentEnabled === true,
  earlyPaymentDaysBefore: Math.min(60, Math.max(1, Math.trunc(Number(value?.earlyPaymentDaysBefore) || 5))),
  earlyPaymentDiscountPercent: Math.min(100, Math.max(0, Number(value?.earlyPaymentDiscountPercent) || 0)),
  secondDueEnabled: value?.secondDueEnabled === true,
  secondDueDaysAfter: Math.min(60, Math.max(1, Math.trunc(Number(value?.secondDueDaysAfter) || 10))),
  secondDueSurchargePercent: Math.min(1000, Math.max(0, Number(value?.secondDueSurchargePercent) || 0)),
});

export const addConsortiumDays = (dateKey = "", days = 0) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return "";
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + Math.trunc(Number(days) || 0));
  return date.toISOString().slice(0, 10);
};

export const getConsortiumPaymentSchedule = ({
  amountMinor = 0,
  dueDate = "",
  paymentPolicy = {},
  earlyPaymentDate = "",
  earlyPaymentDiscountPercent,
  secondDueDate = "",
  secondDueSurchargePercent,
} = {}) => {
  const baseAmountMinor = Math.max(0, Math.round(Number(amountMinor) || 0));
  const policy = normalizeConsortiumPaymentPolicy(paymentPolicy);
  const earlyEnabled = Boolean(earlyPaymentDate) || policy.earlyPaymentEnabled;
  const secondEnabled = Boolean(secondDueDate) || policy.secondDueEnabled;
  const earlyPercent = earlyPaymentDiscountPercent === undefined
    ? policy.earlyPaymentDiscountPercent
    : Math.min(100, Math.max(0, Number(earlyPaymentDiscountPercent) || 0));
  const secondPercent = secondDueSurchargePercent === undefined
    ? policy.secondDueSurchargePercent
    : Math.min(1000, Math.max(0, Number(secondDueSurchargePercent) || 0));
  const discountMinor = earlyEnabled ? Math.round(baseAmountMinor * earlyPercent / 100) : 0;
  const surchargeMinor = secondEnabled ? Math.round(baseAmountMinor * secondPercent / 100) : 0;
  return {
    baseAmountMinor,
    dueDate,
    dueAmountMinor: baseAmountMinor,
    earlyPaymentDate: earlyEnabled
      ? earlyPaymentDate || addConsortiumDays(dueDate, -policy.earlyPaymentDaysBefore)
      : "",
    earlyPaymentDiscountPercent: earlyEnabled ? earlyPercent : 0,
    earlyPaymentDiscountMinor: discountMinor,
    earlyPaymentAmountMinor: Math.max(0, baseAmountMinor - discountMinor),
    secondDueDate: secondEnabled
      ? secondDueDate || addConsortiumDays(dueDate, policy.secondDueDaysAfter)
      : "",
    secondDueSurchargePercent: secondEnabled ? secondPercent : 0,
    secondDueSurchargeMinor: surchargeMinor,
    secondDueAmountMinor: baseAmountMinor + surchargeMinor,
  };
};

export const getConsortiumScheduledAmountForDate = ({
  schedule = {},
  paymentDate = "",
} = {}) => {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(paymentDate) ? paymentDate : "";
  if (date && schedule.earlyPaymentDate && date <= schedule.earlyPaymentDate) {
    return Math.max(0, Math.round(Number(schedule.earlyPaymentAmountMinor) || 0));
  }
  if (date && schedule.secondDueDate && schedule.dueDate && date > schedule.dueDate) {
    return Math.max(0, Math.round(Number(schedule.secondDueAmountMinor) || 0));
  }
  return Math.max(0, Math.round(Number(schedule.dueAmountMinor) || 0));
};

export const getConsortiumPaymentTermAdjustment = ({
  obligation = {},
  paymentDate = "",
  paymentAmountMinor = 0,
} = {}) => {
  if (Number(obligation.paidAmountMinor || 0) > 0 || obligation.paymentTermAdjustment?.paymentId) {
    return { type: "", amountMinor: 0 };
  }
  const paymentAmount = Math.max(0, Math.round(Number(paymentAmountMinor) || 0));
  const baseAmount = Math.max(0, Math.round(Number(
    obligation.baseAmountMinor ?? obligation.totalAmountMinor,
  ) || 0));
  const schedule = getConsortiumPaymentSchedule({
    amountMinor: baseAmount,
    dueDate: obligation.dueDate,
    earlyPaymentDate: obligation.earlyPaymentDate,
    earlyPaymentDiscountPercent: obligation.earlyPaymentDiscountPercent,
    secondDueDate: obligation.secondDueDate,
    secondDueSurchargePercent: obligation.secondDueSurchargePercent,
  });
  if (schedule.earlyPaymentDate && paymentDate <= schedule.earlyPaymentDate
    && paymentAmount === schedule.earlyPaymentAmountMinor
    && schedule.earlyPaymentDiscountMinor > 0) {
    return { type: "early_payment_discount", amountMinor: -schedule.earlyPaymentDiscountMinor, schedule };
  }
  if (schedule.secondDueDate && paymentDate > schedule.dueDate
    && paymentAmount >= schedule.secondDueAmountMinor
    && schedule.secondDueSurchargeMinor > 0) {
    return { type: "second_due_surcharge", amountMinor: schedule.secondDueSurchargeMinor, schedule };
  }
  return { type: "", amountMinor: 0, schedule };
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
  if (value.interestPolicy?.enabled && Number(value.interestPolicy.annualRatePercent || 0) <= 0) {
    errors.push("Ingresá una TNA mayor a cero para aplicar intereses por mora.");
  }
  const paymentPolicy = normalizeConsortiumPaymentPolicy(value.paymentPolicy);
  if (paymentPolicy.earlyPaymentEnabled && paymentPolicy.earlyPaymentDiscountPercent <= 0) {
    errors.push("Ingresá un porcentaje de pronto pago mayor a cero.");
  }
  if (paymentPolicy.secondDueEnabled && paymentPolicy.secondDueSurchargePercent < 0) {
    errors.push("El recargo del segundo vencimiento no puede ser negativo.");
  }
  return errors;
};

export const validateConsortiumUnit = (value = {}) => {
  const errors = [];
  const isValidDateKey = (dateKey) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey || "");
    if (!match) return false;
    const parsed = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    return parsed.getUTCFullYear() === Number(match[1])
      && parsed.getUTCMonth() === Number(match[2]) - 1
      && parsed.getUTCDate() === Number(match[3]);
  };
  if (!value.code?.trim()) errors.push("Ingresá el identificador de la unidad.");
  if (Number(value.coefficient || 0) < 0) errors.push("El coeficiente no puede ser negativo.");
  if (value.ownerSince && !isValidDateKey(value.ownerSince)) {
    errors.push("La fecha de inicio del titular no es válida.");
  }
  if (value.occupantSince && !isValidDateKey(value.occupantSince)) {
    errors.push("La fecha de inicio del ocupante no es válida.");
  }
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
      coefficient: getConsortiumUnitCoefficient(unit, "general"),
      coefficients: { ...(unit.coefficients || {}), general: getConsortiumUnitCoefficient(unit, "general") },
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
      const coefficientGroupId = expense.coefficientGroupId || "general";
      weightedUnits = activeUnits
        .map((unit) => ({ unitId: unit.id, weight: getConsortiumUnitCoefficient(unit, coefficientGroupId) }))
        .filter((item) => item.weight > 0);
      if (!weightedUnits.length) {
        throw new Error(`No hay coeficientes positivos en el grupo elegido para distribuir ${expense.concept}.`);
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
        ...(expense.distributionMode === "coefficient" && expense.coefficientGroupId
          ? { coefficientGroupId: expense.coefficientGroupId }
          : {}),
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
  if (obligation.voided === true) return "voided";
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
  voided: { label: "Anulada", badge: "text-bg-dark" },
}[status] || { label: status, badge: "text-bg-light" });

export const getConsortiumSupplierObligationStatus = (
  obligation = {},
  dateKey = new Date().toISOString().slice(0, 10),
) => {
  if (obligation.voided === true || obligation.status === "voided") return "voided";
  if (Number(obligation.balanceMinor || 0) <= 0) return "paid";
  if (obligation.dueDate && obligation.dueDate < dateKey) {
    return Number(obligation.paidAmountMinor || 0) > 0 ? "partial_overdue" : "overdue";
  }
  if (Number(obligation.paidAmountMinor || 0) > 0) return "partial";
  return "pending";
};

const normalizeConsortiumSearchText = (value = "") => value
  .toString()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .trim();

export const filterConsortiumSupplierObligations = (
  obligations = [],
  { status = "open", search = "", dateKey = new Date().toISOString().slice(0, 10) } = {},
) => {
  const normalizedSearch = normalizeConsortiumSearchText(search);
  const matchesStatus = (obligation) => {
    const derivedStatus = getConsortiumSupplierObligationStatus(obligation, dateKey);
    if (status === "all") return true;
    if (status === "open") return ["pending", "partial", "overdue", "partial_overdue"]
      .includes(derivedStatus);
    if (status === "overdue") return ["overdue", "partial_overdue"].includes(derivedStatus);
    if (status === "partial") return ["partial", "partial_overdue"].includes(derivedStatus);
    return derivedStatus === status;
  };
  const matchesSearch = (obligation) => {
    if (!normalizedSearch) return true;
    const supplier = obligation.supplierSnapshot || {};
    return normalizeConsortiumSearchText([
      supplier.name,
      supplier.legalName,
      supplier.taxId,
      obligation.concept,
      obligation.voucherNumber,
      obligation.periodKey,
    ].filter(Boolean).join(" ")).includes(normalizedSearch);
  };
  return obligations
    .filter((obligation) => matchesStatus(obligation) && matchesSearch(obligation))
    .sort((first, second) => (first.dueDate || "9999-12-31")
      .localeCompare(second.dueDate || "9999-12-31")
      || (first.supplierSnapshot?.name || "").localeCompare(
        second.supplierSnapshot?.name || "",
        "es",
      ));
};

const protectConsortiumCsvValue = (value = "") => {
  const normalized = value?.toString?.() || "";
  return /^[=+\-@]/.test(normalized.trimStart()) ? `'${normalized}` : normalized;
};

const consortiumCsvCell = (value = "") => (
  `"${protectConsortiumCsvValue(value).replace(/"/g, '""')}"`
);

const consortiumCsvMoney = (minor = 0) => (
  (Math.round(Number(minor) || 0) / 100).toFixed(2).replace(".", ",")
);

export const buildConsortiumSupplierObligationsCsv = (
  obligations = [],
  dateKey = new Date().toISOString().slice(0, 10),
) => {
  const statusLabels = {
    pending: "Pendiente",
    overdue: "Vencida",
    partial: "Pago parcial",
    partial_overdue: "Vencida con pago parcial",
    paid: "Pagada",
    voided: "Anulada",
  };
  const rows = obligations.map((obligation) => {
    const supplier = obligation.supplierSnapshot || {};
    const status = getConsortiumSupplierObligationStatus(obligation, dateKey);
    return [
      supplier.name || "Proveedor",
      supplier.legalName || "",
      supplier.taxId || "",
      obligation.concept || "",
      obligation.voucherType || "",
      obligation.voucherNumber || "",
      obligation.issueDate || "",
      obligation.dueDate || "",
      obligation.periodKey || "",
      consortiumCsvMoney(obligation.amountMinor),
      consortiumCsvMoney(obligation.paidAmountMinor),
      consortiumCsvMoney(obligation.balanceMinor),
      obligation.currency || "ARS",
      statusLabels[status] || status,
      obligation.periodId && obligation.expenseId ? "Sí" : "No",
    ];
  });
  const headers = [
    "Proveedor",
    "Razón social",
    "CUIT / documento",
    "Concepto",
    "Tipo de comprobante",
    "Número",
    "Fecha",
    "Vencimiento",
    "Liquidación",
    "Total",
    "Pagado",
    "Saldo",
    "Moneda",
    "Estado",
    "Vinculada a gasto",
  ];
  return `\uFEFF${[headers, ...rows]
    .map((row) => row.map(consortiumCsvCell).join(";"))
    .join("\n")}`;
};

export const getConsortiumTreasurySummary = ({ accounts = [], movements = [] } = {}) => {
  const activeAccounts = accounts.filter((item) => item.active !== false && item.deleted !== true);
  const availableMinor = activeAccounts.reduce(
    (sum, item) => sum + Math.round(Number(item.currentBalanceMinor) || 0),
    0,
  );
  const validMovements = movements.filter((item) => item.voided !== true);
  const inflowMinor = validMovements
    .filter((item) => item.direction === "inflow")
    .reduce((sum, item) => sum + Math.max(0, Math.round(Number(item.amountMinor) || 0)), 0);
  const outflowMinor = validMovements
    .filter((item) => item.direction === "outflow")
    .reduce((sum, item) => sum + Math.max(0, Math.round(Number(item.amountMinor) || 0)), 0);
  return { availableMinor, inflowMinor, outflowMinor };
};

const consortiumMovementAmount = (movement = {}) => (
  Math.max(0, Math.round(Number(movement.amountMinor) || 0))
);

const consortiumMovementSignedAmount = (movement = {}) => (
  movement.direction === "outflow"
    ? -consortiumMovementAmount(movement)
    : consortiumMovementAmount(movement)
);

export const getConsortiumTreasuryBookBalance = ({
  accountId = "",
  movements = [],
  dateKey = new Date().toISOString().slice(0, 10),
} = {}) => movements
  .filter((movement) => (
    movement.voided !== true
    && (!accountId || movement.accountId === accountId)
    && (!dateKey || !movement.date || movement.date <= dateKey)
  ))
  .reduce((sum, movement) => sum + consortiumMovementSignedAmount(movement), 0);

const getConsortiumPeriodBounds = (periodKey = "") => {
  const match = /^(\d{4})-(\d{2})$/.exec(periodKey);
  if (!match) return { startDate: "", endDate: "" };
  const year = Number(match[1]);
  const month = Number(match[2]);
  const end = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  return { startDate: `${periodKey}-01`, endDate: end };
};

const createMonthlyCloseItem = ({
  code,
  status = "ok",
  title,
  detail,
  area = "liquidations",
  count = 0,
  amountMinor = 0,
}) => ({
  code,
  status,
  title,
  detail,
  area,
  count: Math.max(0, Math.round(Number(count) || 0)),
  amountMinor: Math.max(0, Math.round(Number(amountMinor) || 0)),
});

export const buildConsortiumMonthlyCloseChecklist = ({
  period = {},
  units = [],
  obligations = [],
  expenseDocuments = [],
  paymentReports = [],
  treasuryAccounts = [],
  treasuryReconciliations = [],
  supplierObligations = [],
  financialClosures = [],
} = {}) => {
  const periodId = period.id || "";
  const isMonthlyAssessment = !period.source;
  const periodObligations = obligations.filter((item) => (
    item.periodId === periodId && item.voided !== true
  ));
  const activeUnits = units.filter((item) => item.active !== false && item.deleted !== true);
  const activeDocuments = expenseDocuments.filter((item) => (
    item.periodId === periodId && item.voided !== true
  ));
  const pendingReports = paymentReports.filter((item) => (
    item.periodId === periodId && item.status === "pending"
  ));
  const currentSupplierObligations = supplierObligations.filter((item) => (
    item.periodId === periodId && item.voided !== true
  ));
  const currentClosures = financialClosures.filter((item) => item.periodId === periodId);
  const expenses = Array.isArray(period.expenses) ? period.expenses : [];
  const documentedExpenseIds = new Set(activeDocuments.map((item) => item.expenseId));
  const linkedSupplierExpenseIds = new Set(
    currentSupplierObligations.map((item) => item.expenseId).filter(Boolean),
  );
  const obligationUnitIds = new Set(periodObligations.map((item) => item.unitId));
  const missingUnitCount = isMonthlyAssessment
    ? activeUnits.filter((item) => !obligationUnitIds.has(item.id)).length
    : 0;
  const missingDocumentCount = isMonthlyAssessment
    ? expenses.filter((item) => !documentedExpenseIds.has(item.id)).length
    : 0;
  const missingSupplierLinkCount = isMonthlyAssessment
    ? expenses.filter((item) => !linkedSupplierExpenseIds.has(item.id)).length
    : 0;
  const unitDebtMinor = periodObligations.reduce(
    (sum, item) => sum + Math.max(0, Math.round(Number(item.balanceMinor) || 0)),
    0,
  );
  const supplierDebtMinor = currentSupplierObligations.reduce(
    (sum, item) => sum + Math.max(0, Math.round(Number(item.balanceMinor) || 0)),
    0,
  );
  const activeAccounts = treasuryAccounts.filter(
    (item) => item.active !== false && item.deleted !== true,
  );
  const { endDate } = getConsortiumPeriodBounds(period.periodKey || "");
  const validReconciliations = treasuryReconciliations.filter((item) => item.voided !== true);
  const latestReconciliationByAccount = new Map();
  validReconciliations.forEach((item) => {
    const current = latestReconciliationByAccount.get(item.accountId);
    if (!current || (item.statementDate || "") > (current.statementDate || "")) {
      latestReconciliationByAccount.set(item.accountId, item);
    }
  });
  const unreconciledAccounts = activeAccounts.filter((account) => {
    const reconciliation = latestReconciliationByAccount.get(account.id);
    return !reconciliation || (endDate && reconciliation.statementDate < endDate);
  });
  const accountsWithDifference = activeAccounts.filter((account) => {
    const reconciliation = latestReconciliationByAccount.get(account.id);
    return reconciliation && Number(reconciliation.differenceMinor || 0) !== 0;
  });
  const items = [];

  if (!periodId || period.status === "draft") {
    items.push(createMonthlyCloseItem({
      code: "period_not_issued",
      status: "blocker",
      title: "Liquidación sin emitir",
      detail: "Guardá los gastos y emití las expensas antes de iniciar el cierre mensual.",
    }));
  } else if (period.status === "closed") {
    items.push(createMonthlyCloseItem({
      code: "period_closed",
      title: "Período ya cerrado",
      detail: "El cierre mensual ya fue confirmado y permanece registrado en el historial.",
    }));
  } else {
    items.push(createMonthlyCloseItem({
      code: "period_issued",
      title: "Liquidación emitida",
      detail: "Las expensas fueron emitidas y ya no pueden alterarse como borrador.",
    }));
  }

  if (!periodObligations.length) {
    items.push(createMonthlyCloseItem({
      code: "missing_obligations",
      status: "blocker",
      title: "No hay obligaciones emitidas",
      detail: "El período no contiene cuentas individuales que permitan controlar saldos y cobranzas.",
    }));
  } else if (missingUnitCount > 0) {
    items.push(createMonthlyCloseItem({
      code: "units_without_assessment",
      status: "warning",
      title: "Unidades sin liquidación en este período",
      detail: `${missingUnitCount} unidad(es) activa(s) no tienen una obligación vinculada. Verificá si fueron incorporadas después de la emisión.`,
      count: missingUnitCount,
      area: "units",
    }));
  } else {
    items.push(createMonthlyCloseItem({
      code: "assessment_coverage",
      title: "Cobertura de unidades controlada",
      detail: `${periodObligations.length} cuenta(s) individual(es) integran la liquidación.`,
      count: periodObligations.length,
    }));
  }

  items.push(createMonthlyCloseItem(pendingReports.length > 0 ? {
    code: "pending_payment_reports",
    status: "blocker",
    title: "Pagos informados pendientes de revisión",
    detail: `Revisá ${pendingReports.length} pago(s) informado(s) antes de cerrar para no omitir cobranzas.`,
    count: pendingReports.length,
  } : {
    code: "payment_reports_reviewed",
    title: "Pagos informados revisados",
    detail: "No quedan comprobantes enviados por consorcistas pendientes de aprobación o rechazo.",
  }));

  if (isMonthlyAssessment && expenses.length > 0) {
    items.push(createMonthlyCloseItem(missingDocumentCount > 0 ? {
      code: "expenses_without_documents",
      status: "warning",
      title: "Gastos sin comprobante adjunto",
      detail: `${missingDocumentCount} de ${expenses.length} gasto(s) no tienen respaldo documental vigente.`,
      count: missingDocumentCount,
    } : {
      code: "expenses_documented",
      title: "Comprobantes de gastos completos",
      detail: `Los ${expenses.length} gasto(s) tienen al menos un archivo vigente.`,
      count: expenses.length,
    }));

    items.push(createMonthlyCloseItem(missingSupplierLinkCount > 0 ? {
      code: "expenses_without_supplier_obligation",
      status: "warning",
      title: "Gastos sin cuenta a pagar vinculada",
      detail: `${missingSupplierLinkCount} gasto(s) no están asociados a una obligación de proveedor.`,
      count: missingSupplierLinkCount,
      area: "treasury",
    } : {
      code: "supplier_links_complete",
      title: "Cuentas a pagar vinculadas",
      detail: "Los gastos del período están relacionados con sus obligaciones de proveedor.",
      count: expenses.length,
      area: "treasury",
    }));
  }

  items.push(createMonthlyCloseItem(unitDebtMinor > 0 ? {
    code: "unit_debt_outstanding",
    status: "warning",
    title: "Expensas pendientes de cobro",
    detail: "El período puede cerrarse: la deuda continuará vigente en las cuentas corrientes.",
    count: periodObligations.filter((item) => Number(item.balanceMinor || 0) > 0).length,
    amountMinor: unitDebtMinor,
  } : {
    code: "unit_debt_settled",
    title: "Cobranzas del período completas",
    detail: "No quedan saldos pendientes en las unidades alcanzadas por esta liquidación.",
  }));

  items.push(createMonthlyCloseItem(supplierDebtMinor > 0 ? {
    code: "supplier_debt_outstanding",
    status: "warning",
    title: "Cuentas a proveedores pendientes",
    detail: "Las obligaciones impagas seguirán disponibles en Tesorería después del cierre.",
    count: currentSupplierObligations.filter((item) => Number(item.balanceMinor || 0) > 0).length,
    amountMinor: supplierDebtMinor,
    area: "treasury",
  } : {
    code: "supplier_debt_settled",
    title: "Proveedores del período controlados",
    detail: currentSupplierObligations.length
      ? "No quedan saldos pendientes en las obligaciones vinculadas."
      : "No se registraron obligaciones de proveedores para este período.",
    area: "treasury",
  }));

  if (!activeAccounts.length) {
    items.push(createMonthlyCloseItem({
      code: "no_treasury_accounts",
      status: "warning",
      title: "Tesorería sin cuentas activas",
      detail: "No hay caja, banco o billetera configurada para contrastar los fondos del consorcio.",
      area: "treasury",
    }));
  } else if (unreconciledAccounts.length || accountsWithDifference.length) {
    const details = [];
    if (unreconciledAccounts.length) details.push(`${unreconciledAccounts.length} cuenta(s) sin conciliación al cierre del período`);
    if (accountsWithDifference.length) details.push(`${accountsWithDifference.length} cuenta(s) con diferencias`);
    items.push(createMonthlyCloseItem({
      code: "treasury_reconciliation_pending",
      status: "warning",
      title: "Conciliación de tesorería pendiente",
      detail: `${details.join(" y ")}.`,
      count: new Set([...unreconciledAccounts, ...accountsWithDifference].map((item) => item.id)).size,
      area: "treasury",
    }));
  } else {
    items.push(createMonthlyCloseItem({
      code: "treasury_reconciled",
      title: "Tesorería conciliada",
      detail: `${activeAccounts.length} cuenta(s) cuentan con un control sin diferencias.`,
      count: activeAccounts.length,
      area: "treasury",
    }));
  }

  items.push(createMonthlyCloseItem(currentClosures.length > 0 ? {
    code: "financial_statement_closed",
    title: "Estado económico versionado",
    detail: `Existe una versión financiera inalterable para este período.`,
    count: currentClosures.length,
    area: "economic_statement",
  } : {
    code: "financial_statement_pending",
    status: "warning",
    title: "Estado económico sin versión cerrada",
    detail: "Podés generar y versionar el estado económico antes o después de este cierre operativo.",
    area: "economic_statement",
  }));

  const blockers = items.filter((item) => item.status === "blocker");
  const warnings = items.filter((item) => item.status === "warning");
  return {
    schemaVersion: 1,
    periodId,
    periodKey: period.periodKey || "",
    periodStatus: period.status || "draft",
    canClose: period.status === "issued" && blockers.length === 0,
    items,
    blockers,
    warnings,
    summary: {
      blockerCount: blockers.length,
      warningCount: warnings.length,
      okCount: items.length - blockers.length - warnings.length,
      unitCount: activeUnits.length,
      obligationCount: periodObligations.length,
      expenseCount: expenses.length,
      expenseDocumentCount: activeDocuments.length,
      pendingPaymentReportCount: pendingReports.length,
      treasuryAccountCount: activeAccounts.length,
      unreconciledAccountCount: unreconciledAccounts.length,
      unitDebtMinor,
      supplierDebtMinor,
    },
  };
};

const sumConsortiumMovements = (movements = [], predicate = () => true) => movements
  .filter(predicate)
  .reduce((sum, movement) => sum + consortiumMovementAmount(movement), 0);

export const buildConsortiumEconomicStatement = ({
  period = {},
  movements = [],
  accounts = [],
  unitObligations = [],
  supplierObligations = [],
} = {}) => {
  const periodKey = period.periodKey || "";
  const { startDate, endDate } = getConsortiumPeriodBounds(periodKey);
  const validMovements = movements.filter((movement) => movement.voided !== true);
  const openingBalanceMinor = validMovements
    .filter((movement) => startDate && movement.date < startDate)
    .reduce((sum, movement) => sum + consortiumMovementSignedAmount(movement), 0);
  const periodMovements = validMovements.filter((movement) => (
    startDate && movement.date >= startDate && movement.date <= endDate
  ));
  const transferMovements = periodMovements.filter(
    (movement) => movement.source === "account_transfer",
  );
  const collectionsMinor = sumConsortiumMovements(periodMovements, (movement) => (
    movement.source === "consortium_collection" && movement.direction === "inflow"
  )) - sumConsortiumMovements(periodMovements, (movement) => (
    movement.source === "consortium_collection_reversal" && movement.direction === "outflow"
  ));
  const supplierPaymentsMinor = sumConsortiumMovements(periodMovements, (movement) => (
    movement.source === "supplier_payment" && movement.direction === "outflow"
  )) - sumConsortiumMovements(periodMovements, (movement) => (
    movement.source === "supplier_payment_reversal" && movement.direction === "inflow"
  ));
  const excludedSources = new Set([
    "account_transfer",
    "consortium_collection",
    "consortium_collection_reversal",
    "supplier_payment",
    "supplier_payment_reversal",
  ]);
  const otherInflowsMinor = sumConsortiumMovements(periodMovements, (movement) => (
    movement.direction === "inflow" && !excludedSources.has(movement.source)
  ));
  const otherOutflowsMinor = sumConsortiumMovements(periodMovements, (movement) => (
    movement.direction === "outflow" && !excludedSources.has(movement.source)
  ));
  const closingBalanceMinor = openingBalanceMinor
    + collectionsMinor
    + otherInflowsMinor
    - supplierPaymentsMinor
    - otherOutflowsMinor;
  const selectedUnitObligations = unitObligations.filter((obligation) => (
    obligation.voided !== true && obligation.periodKey === periodKey
  ));
  const selectedSupplierObligations = supplierObligations.filter((obligation) => (
    obligation.voided !== true
    && (obligation.periodKey === periodKey
      || (!obligation.periodKey && obligation.issueDate?.startsWith(periodKey)))
  ));
  const unitDebtMinor = selectedUnitObligations.reduce(
    (sum, obligation) => sum + Math.max(0, Number(obligation.balanceMinor) || 0),
    0,
  );
  const supplierDebtMinor = selectedSupplierObligations.reduce(
    (sum, obligation) => sum + Math.max(0, Number(obligation.balanceMinor) || 0),
    0,
  );
  const reserveFundsMinor = accounts
    .filter((account) => account.active !== false && account.type === "reserve")
    .reduce((sum, account) => sum + Math.max(0, Number(account.currentBalanceMinor) || 0), 0);
  return {
    periodKey,
    startDate,
    endDate,
    currency: period.currency || "ARS",
    openingBalanceMinor,
    collectionsMinor,
    otherInflowsMinor,
    supplierPaymentsMinor,
    otherOutflowsMinor,
    closingBalanceMinor,
    unitDebtMinor,
    supplierDebtMinor,
    reserveFundsMinor,
    assessedMinor: Math.max(0, Number(period.totalExpensesMinor) || 0),
    transferVolumeMinor: sumConsortiumMovements(
      transferMovements,
      (movement) => movement.direction === "outflow",
    ),
    movements: periodMovements,
  };
};

export const buildConsortiumEconomicStatementCsv = (statement = {}) => {
  const rows = [
    ["Período", statement.periodKey || ""],
    ["Moneda", statement.currency || "ARS"],
    ["Saldo inicial", consortiumCsvMoney(statement.openingBalanceMinor)],
    ["Expensas cobradas", consortiumCsvMoney(statement.collectionsMinor)],
    ["Otros ingresos", consortiumCsvMoney(statement.otherInflowsMinor)],
    ["Pagos a proveedores", consortiumCsvMoney(statement.supplierPaymentsMinor)],
    ["Otros egresos", consortiumCsvMoney(statement.otherOutflowsMinor)],
    ["Saldo final", consortiumCsvMoney(statement.closingBalanceMinor)],
    ["Deuda actual de unidades", consortiumCsvMoney(statement.unitDebtMinor)],
    ["Deuda actual con proveedores", consortiumCsvMoney(statement.supplierDebtMinor)],
    ["Fondos de reserva actuales", consortiumCsvMoney(statement.reserveFundsMinor)],
  ];
  return `\uFEFF${rows
    .map((row) => row.map(consortiumCsvCell).join(";"))
    .join("\n")}`;
};

export const getConsortiumClaimReference = (claim = {}) => {
  const date = (claim.createdDate || claim.createdAtIso || "")
    .toString()
    .replace(/\D/g, "")
    .slice(0, 8) || "SFECHA";
  const suffix = (claim.id || "")
    .toString()
    .replace(/[^a-z0-9]/gi, "")
    .slice(-6)
    .toUpperCase() || "NUEVO";
  return `MSG-${date}-${suffix}`;
};

export const isConsortiumClaimOpen = (claim = {}) => ![
  "resolved", "closed", "rejected",
].includes(claim.status);

export const buildConsortiumOperationalSummary = ({
  period = null,
  obligations = [],
  paymentReports = [],
  supplierObligations = [],
  claims = [],
  treasuryAccounts = [],
  treasuryReconciliations = [],
  dateKey = new Date().toISOString().slice(0, 10),
} = {}) => {
  const activeObligations = obligations.filter((item) => item.voided !== true);
  const periodObligations = period?.id
    ? activeObligations.filter((item) => item.periodId === period.id)
    : [];
  const periodBalanceMinor = periodObligations.reduce(
    (sum, item) => sum + Math.max(0, Number(item.balanceMinor) || 0),
    0,
  );
  const overdueObligations = activeObligations.filter(
    (item) => getConsortiumObligationStatus(item, dateKey) === "overdue",
  );
  const pendingReports = paymentReports.filter((item) => item.status === "pending");
  const openClaims = claims.filter(isConsortiumClaimOpen);
  const urgentClaims = openClaims.filter((item) => item.priority === "urgent");
  const supplierDueLimit = addConsortiumDays(dateKey, 7);
  const supplierDue = supplierObligations.filter((item) => (
    item.voided !== true
    && Number(item.balanceMinor || 0) > 0
    && item.dueDate
    && item.dueDate <= supplierDueLimit
  ));
  const activeAccounts = treasuryAccounts.filter((item) => (
    item.active !== false && item.deleted !== true
  ));
  const latestReconciliationByAccount = new Map();
  treasuryReconciliations.filter((item) => item.voided !== true).forEach((item) => {
    const current = latestReconciliationByAccount.get(item.accountId);
    if (!current || (item.statementDate || "") > (current.statementDate || "")) {
      latestReconciliationByAccount.set(item.accountId, item);
    }
  });
  const reconciliationIssues = activeAccounts.filter((account) => {
    const latest = latestReconciliationByAccount.get(account.id);
    return latest
      ? Number(latest.differenceMinor || 0) !== 0
      : Number(account.currentBalanceMinor || 0) !== 0;
  });
  const tasks = [];

  if (urgentClaims.length) tasks.push({
    id: "urgent_messages",
    tone: "danger",
    title: `${urgentClaims.length} mensaje(s) urgente(s)`,
    detail: "Revisá primero los avisos que requieren atención inmediata.",
    workspace: "messages",
  });
  if (pendingReports.length) tasks.push({
    id: "pending_payment_reports",
    tone: "danger",
    title: `${pendingReports.length} pago(s) informado(s) por revisar`,
    detail: "Aprobá o rechazá los comprobantes enviados por consorcistas.",
    workspace: "liquidations",
  });
  if (overdueObligations.length) tasks.push({
    id: "overdue_collections",
    tone: "warning",
    title: `${overdueObligations.length} deuda(s) vencida(s)`,
    detail: "Gestioná las cobranzas pendientes sin perder su antigüedad.",
    href: "collections",
    amountMinor: overdueObligations.reduce(
      (sum, item) => sum + Math.max(0, Number(item.balanceMinor) || 0),
      0,
    ),
  });
  if (supplierDue.length) tasks.push({
    id: "supplier_payments_due",
    tone: "warning",
    title: `${supplierDue.length} pago(s) a proveedor próximos o vencidos`,
    detail: "Revisá vencimientos y fondos antes de autorizar pagos.",
    workspace: "treasury",
    amountMinor: supplierDue.reduce(
      (sum, item) => sum + Math.max(0, Number(item.balanceMinor) || 0),
      0,
    ),
  });
  if (!period) tasks.push({
    id: "missing_period",
    tone: "primary",
    title: "Todavía no hay una liquidación mensual",
    detail: "Creá el primer borrador cuando tengas los gastos del período.",
    workspace: "liquidations",
  });
  if (period?.status === "draft") tasks.push({
    id: "period_draft",
    tone: "primary",
    title: "Liquidación mensual en borrador",
    detail: "Completá los gastos y emitila cuando esté revisada.",
    workspace: "liquidations",
  });
  if (reconciliationIssues.length) tasks.push({
    id: "reconciliation_issues",
    tone: "warning",
    title: `${reconciliationIssues.length} cuenta(s) por conciliar`,
    detail: "Hay saldos sin control o conciliaciones con diferencias.",
    href: "reconciliation",
  });
  if (!urgentClaims.length && openClaims.length) tasks.push({
    id: "open_messages",
    tone: "info",
    title: `${openClaims.length} mensaje(s) abierto(s)`,
    detail: "Consultas, solicitudes o reclamos que siguen en gestión.",
    workspace: "messages",
  });

  return {
    tasks: tasks.slice(0, 5),
    hiddenTaskCount: Math.max(0, tasks.length - 5),
    periodBalanceMinor,
    periodObligationCount: periodObligations.length,
    periodOverdueCount: periodObligations.filter(
      (item) => getConsortiumObligationStatus(item, dateKey) === "overdue",
    ).length,
    pendingPaymentReportCount: pendingReports.length,
    openClaimCount: openClaims.length,
  };
};

export const getConsortiumExpenseCategoryLabel = (category = "ordinary") => (
  category === "penalty"
    ? "Multa / penalidad"
    : category === "interest"
      ? "Interés por mora"
      : category === "payment_term"
        ? "Condición de pago"
    : category === "extraordinary" ? "Extraordinaria" : "Ordinaria"
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

export const buildConsortiumLiquidationLines = ({ period, obligation } = {}) => {
  const safePeriod = period || {};
  const safeObligation = obligation || {};
  const expenses = new Map(
    (Array.isArray(safePeriod.expenses) ? safePeriod.expenses : [])
      .map((expense) => [expense.id, expense]),
  );
  return (Array.isArray(safeObligation.breakdown) ? safeObligation.breakdown : []).map((line) => {
    const expense = expenses.get(line.expenseId);
    const unitAmountMinor = Number(line.amountMinor || 0);
    return {
      expenseId: line.expenseId || "",
      concept: line.concept || expense?.concept || "Gasto",
      category: line.category === "penalty"
        ? "penalty"
        : line.category === "interest"
          ? "interest"
          : line.category === "payment_term"
            ? "payment_term"
          : line.category === "extraordinary" ? "extraordinary" : "ordinary",
      distributionMode: line.distributionMode || expense?.distributionMode || "coefficient",
      ...(line.coefficientGroupId || expense?.coefficientGroupId
        ? { coefficientGroupId: line.coefficientGroupId || expense?.coefficientGroupId }
        : {}),
      expenseTotalMinor: expense ? Number(expense.amountMinor || 0) : Math.abs(unitAmountMinor),
      unitAmountMinor,
    };
  });
};
