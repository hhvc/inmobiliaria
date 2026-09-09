const DAY_MS = 24 * 60 * 60 * 1000;

const safeInteger = (value) => Math.max(0, Math.round(Number(value) || 0));

const parseDateKey = (value = "") => {
  const match = `${value}`.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return Number.isNaN(date.getTime()) ? null : date;
};

const dateDiffDays = (fromKey = "", toKey = "") => {
  const from = parseDateKey(fromKey);
  const to = parseDateKey(toKey);
  if (!from || !to) return 0;
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / DAY_MS));
};

const addDays = (dateKey = "", days = 0) => {
  const source = parseDateKey(dateKey);
  if (!source) return "";
  source.setUTCDate(source.getUTCDate() + Math.trunc(Number(days) || 0));
  return source.toISOString().slice(0, 10);
};

export const normalizeConsortiumInterestPolicy = (value = {}) => ({
  enabled: value?.enabled === true,
  annualRatePercent: Math.min(1000, Math.max(0, Number(value?.annualRatePercent) || 0)),
  calculationMode: value?.calculationMode === "compound" ? "compound" : "simple",
  graceDays: Math.min(365, Math.max(0, Math.trunc(Number(value?.graceDays) || 0))),
  retroactiveFromDueDate: value?.retroactiveFromDueDate === true,
});

export const buildConsortiumInterestPreview = ({
  obligations = [],
  obligationIds = [],
  policy = {},
  cutoffDate = new Date().toISOString().slice(0, 10),
} = {}) => {
  const normalizedPolicy = normalizeConsortiumInterestPolicy(policy);
  const selectedIds = new Set(
    (Array.isArray(obligationIds) ? obligationIds : []).filter(Boolean),
  );
  const annualRate = normalizedPolicy.annualRatePercent / 100;
  const dailyRate = annualRate / 365;
  const items = (Array.isArray(obligations) ? obligations : [])
    .filter((item) => item?.voided !== true && safeInteger(item?.balanceMinor) > 0)
    .filter((item) => !selectedIds.size || selectedIds.has(item.id))
    .map((obligation) => {
      const dueDate = obligation.dueDate || "";
      const graceEndsOn = addDays(dueDate, normalizedPolicy.graceDays);
      const previousCutoff = obligation.interestAssessedThrough || "";
      const firstCalculationFrom = normalizedPolicy.retroactiveFromDueDate
        && dateDiffDays(graceEndsOn, cutoffDate) > 0
        ? dueDate
        : graceEndsOn;
      const calculationFrom = previousCutoff && previousCutoff > firstCalculationFrom
        ? previousCutoff
        : firstCalculationFrom;
      const days = dateDiffDays(calculationFrom, cutoffDate);
      const balanceBeforeMinor = safeInteger(obligation.balanceMinor);
      const rawInterest = normalizedPolicy.calculationMode === "compound"
        ? balanceBeforeMinor * ((1 + dailyRate) ** days - 1)
        : balanceBeforeMinor * dailyRate * days;
      const interestMinor = normalizedPolicy.enabled && annualRate > 0 && days > 0
        ? Math.max(0, Math.round(rawInterest))
        : 0;
      return {
        obligationId: obligation.id || "",
        periodId: obligation.periodId || "",
        periodKey: obligation.periodKey || "",
        dueDate,
        graceEndsOn,
        calculationFrom,
        cutoffDate,
        days,
        balanceBeforeMinor,
        interestMinor,
        balanceAfterMinor: balanceBeforeMinor + interestMinor,
      };
    })
    .sort((left, right) => (
      (left.dueDate || "9999-12-31").localeCompare(right.dueDate || "9999-12-31")
      || left.obligationId.localeCompare(right.obligationId)
    ));
  return {
    policy: normalizedPolicy,
    cutoffDate,
    dailyRate,
    items,
    chargeableItems: items.filter((item) => item.interestMinor > 0),
    totalInterestMinor: items.reduce((sum, item) => sum + item.interestMinor, 0),
  };
};

export const getConsortiumDaysPastDue = (dueDate = "", todayKey = new Date().toISOString().slice(0, 10)) => {
  const due = parseDateKey(dueDate);
  const today = parseDateKey(todayKey);
  if (!due || !today || due >= today) return 0;
  return Math.floor((today.getTime() - due.getTime()) / DAY_MS);
};

export const getConsortiumAgingBucket = (dueDate = "", todayKey) => {
  const days = getConsortiumDaysPastDue(dueDate, todayKey);
  if (days <= 0) return "not_due";
  if (days <= 30) return "days_1_30";
  if (days <= 60) return "days_31_60";
  if (days <= 90) return "days_61_90";
  return "days_90_plus";
};

export const CONSORTIUM_AGING_LABELS = {
  not_due: "A vencer",
  days_1_30: "1 a 30 días",
  days_31_60: "31 a 60 días",
  days_61_90: "61 a 90 días",
  days_90_plus: "Más de 90 días",
};

export const buildConsortiumCollectionsDashboard = ({
  units = [],
  obligations = [],
  todayKey = new Date().toISOString().slice(0, 10),
} = {}) => {
  const activeObligations = obligations.filter((item) => (
    item?.voided !== true && safeInteger(item?.balanceMinor) > 0
  ));
  const buckets = Object.fromEntries(Object.keys(CONSORTIUM_AGING_LABELS).map((key) => [key, {
    key,
    label: CONSORTIUM_AGING_LABELS[key],
    amountMinor: 0,
    obligationCount: 0,
  }]));
  const rows = new Map(units.filter((item) => item.deleted !== true).map((unit) => [unit.id, {
    unitId: unit.id,
    code: unit.code || unit.id,
    ownerName: unit.ownerName || "",
    occupantName: unit.occupantName || "",
    email: unit.ownerEmail || unit.email || unit.occupantEmail || "",
    phone: unit.phone || "",
    active: unit.active !== false,
    creditBalanceMinor: safeInteger(unit.creditBalanceMinor),
    balanceMinor: 0,
    overdueBalanceMinor: 0,
    notDueBalanceMinor: 0,
    netBalanceMinor: 0,
    oldestDueDate: "",
    maxDaysPastDue: 0,
    agingBucket: "not_due",
    obligationCount: 0,
    overdueObligationCount: 0,
    obligationIds: [],
  }]));

  activeObligations.forEach((obligation) => {
    const amountMinor = safeInteger(obligation.balanceMinor);
    const bucket = getConsortiumAgingBucket(obligation.dueDate, todayKey);
    buckets[bucket].amountMinor += amountMinor;
    buckets[bucket].obligationCount += 1;
    const unitId = obligation.unitId || "unknown";
    const row = rows.get(unitId) || {
      unitId,
      code: obligation.unitSnapshot?.code || unitId,
      ownerName: obligation.unitSnapshot?.ownerName || "",
      occupantName: obligation.unitSnapshot?.occupantName || "",
      email: "",
      phone: "",
      active: true,
      creditBalanceMinor: 0,
      balanceMinor: 0,
      overdueBalanceMinor: 0,
      notDueBalanceMinor: 0,
      netBalanceMinor: 0,
      oldestDueDate: "",
      maxDaysPastDue: 0,
      agingBucket: "not_due",
      obligationCount: 0,
      overdueObligationCount: 0,
      obligationIds: [],
    };
    const daysPastDue = getConsortiumDaysPastDue(obligation.dueDate, todayKey);
    row.balanceMinor += amountMinor;
    row.obligationCount += 1;
    row.obligationIds.push(obligation.id);
    if (daysPastDue > 0) {
      row.overdueBalanceMinor += amountMinor;
      row.overdueObligationCount += 1;
      row.maxDaysPastDue = Math.max(row.maxDaysPastDue, daysPastDue);
      if (!row.oldestDueDate || obligation.dueDate < row.oldestDueDate) {
        row.oldestDueDate = obligation.dueDate || "";
      }
    } else {
      row.notDueBalanceMinor += amountMinor;
    }
    row.agingBucket = row.maxDaysPastDue > 0
      ? getConsortiumAgingBucket(row.oldestDueDate, todayKey)
      : "not_due";
    row.netBalanceMinor = Math.max(0, row.balanceMinor - row.creditBalanceMinor);
    rows.set(unitId, row);
  });

  const unitRows = [...rows.values()]
    .filter((row) => row.balanceMinor > 0)
    .map((row) => ({
      ...row,
      netBalanceMinor: Math.max(0, row.balanceMinor - row.creditBalanceMinor),
    }))
    .sort((left, right) => (
      right.overdueBalanceMinor - left.overdueBalanceMinor ||
      right.balanceMinor - left.balanceMinor ||
      left.code.localeCompare(right.code, "es", { numeric: true })
    ));
  const totalOutstandingMinor = unitRows.reduce((sum, row) => sum + row.balanceMinor, 0);
  const totalCreditsMinor = unitRows.reduce(
    (sum, row) => sum + Math.min(row.creditBalanceMinor, row.balanceMinor),
    0,
  );
  return {
    todayKey,
    buckets,
    unitRows,
    summary: {
      totalOutstandingMinor,
      overdueMinor: unitRows.reduce((sum, row) => sum + row.overdueBalanceMinor, 0),
      notDueMinor: unitRows.reduce((sum, row) => sum + row.notDueBalanceMinor, 0),
      totalCreditsMinor,
      netExposureMinor: Math.max(0, totalOutstandingMinor - totalCreditsMinor),
      debtorUnitCount: unitRows.length,
      overdueUnitCount: unitRows.filter((row) => row.overdueBalanceMinor > 0).length,
    },
  };
};

const addMonths = (dateKey, months) => {
  const source = parseDateKey(dateKey);
  if (!source) return "";
  const year = source.getUTCFullYear();
  const month = source.getUTCMonth() + months;
  const day = source.getUTCDate();
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(day, lastDay)))
    .toISOString().slice(0, 10);
};

export const buildConsortiumPaymentAgreementSchedule = ({
  agreedAmountMinor = 0,
  downPaymentMinor = 0,
  installmentCount = 1,
  firstDueDate = "",
} = {}) => {
  const agreed = safeInteger(agreedAmountMinor);
  const downPayment = Math.min(agreed, safeInteger(downPaymentMinor));
  const count = Math.max(1, Math.min(60, Math.trunc(Number(installmentCount) || 1)));
  const financed = agreed - downPayment;
  const base = Math.floor(financed / count);
  let remainder = financed - base * count;
  return Array.from({ length: count }, (_, index) => {
    const extra = remainder > 0 ? 1 : 0;
    remainder -= extra;
    return {
      number: index + 1,
      dueDate: addMonths(firstDueDate, index),
      amountMinor: base + extra,
      status: "pending",
      paidAmountMinor: 0,
    };
  });
};

export const buildConsortiumPaymentAllocations = ({
  amountMinor = 0,
  obligations = [],
  obligationIds = [],
} = {}) => {
  const amount = safeInteger(amountMinor);
  const requestedIds = new Set(
    (Array.isArray(obligationIds) ? obligationIds : []).filter(Boolean),
  );
  const candidates = (Array.isArray(obligations) ? obligations : [])
    .filter((item) => item?.voided !== true && safeInteger(item?.balanceMinor) > 0)
    .filter((item) => !requestedIds.size || requestedIds.has(item.id))
    .sort((left, right) => (
      (left.dueDate || "9999-12-31").localeCompare(right.dueDate || "9999-12-31")
      || (left.periodKey || "").localeCompare(right.periodKey || "")
      || (left.id || "").localeCompare(right.id || "")
    ));
  let remainingMinor = amount;
  const allocations = [];
  candidates.forEach((item) => {
    if (remainingMinor <= 0) return;
    const allocatedMinor = Math.min(remainingMinor, safeInteger(item.balanceMinor));
    if (!allocatedMinor) return;
    allocations.push({
      obligationId: item.id,
      periodId: item.periodId || "",
      periodKey: item.periodKey || "",
      source: item.source || "monthly_assessment",
      dueDate: item.dueDate || "",
      amountMinor: allocatedMinor,
    });
    remainingMinor -= allocatedMinor;
  });
  const selectedDebtMinor = candidates.reduce(
    (sum, item) => sum + safeInteger(item.balanceMinor),
    0,
  );
  return {
    allocations,
    selectedDebtMinor,
    appliedAmountMinor: amount - remainingMinor,
    creditAmountMinor: remainingMinor,
  };
};

const csvCell = (value) => {
  const text = `${value ?? ""}`;
  const safeText = /^[=+\-@]/.test(text.trimStart()) ? `'${text}` : text;
  return `"${safeText.replace(/"/g, '""')}"`;
};

export const buildConsortiumCollectionsCsv = ({ rows = [], currency = "ARS" } = {}) => {
  const headers = [
    "Unidad", "Titular", "Ocupante", "Email", "Teléfono", "Saldo total",
    "Saldo vencido", "A vencer", "Crédito disponible", "Exposición neta",
    "Vencimiento más antiguo", "Días de mora", "Tramo",
  ];
  const lines = rows.map((row) => [
    row.code,
    row.ownerName,
    row.occupantName,
    row.email,
    row.phone,
    (row.balanceMinor / 100).toFixed(2),
    (row.overdueBalanceMinor / 100).toFixed(2),
    (row.notDueBalanceMinor / 100).toFixed(2),
    (row.creditBalanceMinor / 100).toFixed(2),
    (row.netBalanceMinor / 100).toFixed(2),
    row.oldestDueDate,
    row.maxDaysPastDue,
    CONSORTIUM_AGING_LABELS[row.agingBucket] || row.agingBucket,
  ]);
  return `\uFEFFMoneda;${csvCell(currency)}\r\n${[
    headers,
    ...lines,
  ].map((line) => line.map(csvCell).join(";")).join("\r\n")}`;
};
