import { normalizeRentalContract } from "./rentalSchema.js";

const round = (value) => Math.round(Number(value) || 0);
const pad = (value) => value.toString().padStart(2, "0");

export const majorToMinor = (value) => {
  if (typeof value === "number") return Math.max(0, Math.round(value * 100));
  const text = value?.toString?.().trim().replace(/\s/g, "") || "";
  if (!text) return 0;
  const normalized = text.includes(",")
    ? text.replace(/\./g, "").replace(",", ".")
    : text;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed * 100)) : 0;
};

export const minorToMajor = (value) => round(value) / 100;

export const minorToMajorInput = (value) => {
  const amount = minorToMajor(value);
  return amount > 0 ? amount.toString() : "";
};

export const formatRentalMoney = (amountMinor, currency = "ARS") => {
  if (currency === "OTHER") {
    return `${new Intl.NumberFormat("es-AR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(minorToMajor(amountMinor))} (moneda pactada)`;
  }
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(minorToMajor(amountMinor));
};

const SPANISH_UNITS = [
  "cero", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve",
  "diez", "once", "doce", "trece", "catorce", "quince", "dieciséis", "diecisiete",
  "dieciocho", "diecinueve", "veinte", "veintiuno", "veintidós", "veintitrés",
  "veinticuatro", "veinticinco", "veintiséis", "veintisiete", "veintiocho", "veintinueve",
];

const SPANISH_HUNDREDS = {
  200: "doscientos",
  300: "trescientos",
  400: "cuatrocientos",
  500: "quinientos",
  600: "seiscientos",
  700: "setecientos",
  800: "ochocientos",
  900: "novecientos",
};

const apocopateSpanishNumber = (value = "") => value
  .replace(/veintiuno$/u, "veintiún")
  .replace(/ y uno$/u, " y un")
  .replace(/uno$/u, "un");

const spanishBelowThousand = (value) => {
  const number = Math.max(0, Math.floor(Number(value) || 0));
  if (number < 30) return SPANISH_UNITS[number];
  if (number < 100) {
    const tens = Math.floor(number / 10) * 10;
    const names = { 30: "treinta", 40: "cuarenta", 50: "cincuenta", 60: "sesenta", 70: "setenta", 80: "ochenta", 90: "noventa" };
    return number === tens ? names[tens] : `${names[tens]} y ${SPANISH_UNITS[number - tens]}`;
  }
  if (number === 100) return "cien";
  const hundreds = Math.floor(number / 100) * 100;
  const prefix = hundreds === 100 ? "ciento" : SPANISH_HUNDREDS[hundreds];
  const remainder = number - hundreds;
  return remainder ? `${prefix} ${spanishBelowThousand(remainder)}` : prefix;
};

const integerToSpanishWords = (value) => {
  const number = Math.max(0, Math.floor(Number(value) || 0));
  if (number < 1000) return spanishBelowThousand(number);
  if (number < 1000000) {
    const thousands = Math.floor(number / 1000);
    const remainder = number % 1000;
    const prefix = thousands === 1
      ? "mil"
      : `${apocopateSpanishNumber(integerToSpanishWords(thousands))} mil`;
    return remainder ? `${prefix} ${integerToSpanishWords(remainder)}` : prefix;
  }
  if (number < 1000000000000) {
    const millions = Math.floor(number / 1000000);
    const remainder = number % 1000000;
    const prefix = millions === 1
      ? "un millón"
      : `${apocopateSpanishNumber(integerToSpanishWords(millions))} millones`;
    return remainder ? `${prefix} ${integerToSpanishWords(remainder)}` : prefix;
  }
  return number.toLocaleString("es-AR");
};

export const formatRentalAmountInWords = (amountMinor, currency = "ARS") => {
  const safeMinor = Math.max(0, Math.round(Number(amountMinor) || 0));
  const integer = Math.floor(safeMinor / 100);
  const cents = safeMinor % 100;
  const currencyNames = {
    ARS: integer === 1 ? "peso" : "pesos",
    USD: integer === 1 ? "dólar estadounidense" : "dólares estadounidenses",
    EUR: integer === 1 ? "euro" : "euros",
    OTHER: integer === 1 ? "unidad de la moneda pactada" : "unidades de la moneda pactada",
  };
  const centsName = currency === "EUR"
    ? (cents === 1 ? "céntimo" : "céntimos")
    : (cents === 1 ? "centavo" : "centavos");
  const words = `${currencyNames[currency] || currencyNames.OTHER} ${apocopateSpanishNumber(integerToSpanishWords(integer))}`
    + (cents ? ` con ${apocopateSpanishNumber(integerToSpanishWords(cents))} ${centsName}` : "");
  return `${words.toLocaleUpperCase("es-AR")} (${formatRentalMoney(safeMinor, currency)})`;
};

export const parseDateKey = (value) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || "");
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12));
  return Number.isNaN(date.getTime()) ? null : date;
};

export const toDateKey = (value) => {
  const date = value instanceof Date ? value : parseDateKey(value);
  if (!date || Number.isNaN(date.getTime())) return "";
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
};

export const addMonthsClamped = (dateKey, months) => {
  const date = parseDateKey(dateKey);
  if (!date) return "";
  const day = date.getUTCDate();
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + Number(months || 0), 1, 12));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0, 12)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return toDateKey(target);
};

export const getPeriodKey = (dateKey) => (dateKey || "").slice(0, 7);

export const getPeriodBounds = (periodKey) => {
  const match = /^(\d{4})-(\d{2})$/.exec(periodKey || "");
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const lastDay = new Date(Date.UTC(year, month, 0, 12)).getUTCDate();
  return {
    startDate: `${year}-${pad(month)}-01`,
    endDate: `${year}-${pad(month)}-${pad(lastDay)}`,
  };
};

const monthsBetweenPeriods = (fromPeriod, toPeriod) => {
  const [fromYear, fromMonth] = fromPeriod.split("-").map(Number);
  const [toYear, toMonth] = toPeriod.split("-").map(Number);
  return (toYear - fromYear) * 12 + toMonth - fromMonth;
};

export const getContractPeriodKeys = (contractValue, { throughDate, limit = 120 } = {}) => {
  const contract = normalizeRentalContract(contractValue);
  const startPeriod = getPeriodKey(contract.startDate);
  const requestedEnd = throughDate || new Date().toISOString().slice(0, 10);
  const effectiveEnd = contract.endDate && contract.endDate < requestedEnd
    ? contract.endDate
    : requestedEnd;
  const endPeriod = getPeriodKey(effectiveEnd);
  if (!/^\d{4}-\d{2}$/.test(startPeriod) || !/^\d{4}-\d{2}$/.test(endPeriod)) return [];
  const count = monthsBetweenPeriods(startPeriod, endPeriod);
  if (count < 0) return [];
  return Array.from({ length: Math.min(count + 1, limit) }, (_, index) =>
    getPeriodKey(addMonthsClamped(`${startPeriod}-01`, index)),
  );
};

export const isRentalObligationWithinContract = (obligationValue, contractValue) => {
  const contract = normalizeRentalContract(contractValue);
  const periodKey = obligationValue?.periodKey || "";
  const startPeriod = getPeriodKey(contract.startDate);
  const endPeriod = getPeriodKey(contract.endDate);
  if (!/^\d{4}-\d{2}$/.test(periodKey) || !startPeriod) return false;
  return periodKey >= startPeriod && (!endPeriod || periodKey <= endPeriod);
};

export const resolveRentForPeriod = (contractValue, periodKey) => {
  const contract = normalizeRentalContract(contractValue);
  const schedule = [...contract.rentSchedule]
    .filter((item) => getPeriodKey(item.effectiveFrom) <= periodKey)
    .sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
  const scheduled = schedule[schedule.length - 1];
  const initial = round(
    scheduled?.amountMinor
      || contract.financial.initialRentAmountMinor
      || contract.financial.currentRentAmountMinor,
  );
  if (contract.financial.adjustment.mode !== "fixed_percent") return initial;

  const frequency = Math.max(1, Number(contract.financial.adjustment.frequencyMonths) || 1);
  const percent = Math.max(0, Number(contract.financial.adjustment.fixedPercent) || 0);
  const baseDate = scheduled?.effectiveFrom || contract.startDate;
  const elapsedMonths = Math.max(0, monthsBetweenPeriods(getPeriodKey(baseDate), periodKey));
  const adjustments = Math.floor(elapsedMonths / frequency);
  return round(initial * ((1 + percent / 100) ** adjustments));
};

export const getDueDateForPeriod = (periodKey, dueDay = 10) => {
  const bounds = getPeriodBounds(periodKey);
  if (!bounds) return "";
  const lastDay = Number(bounds.endDate.slice(-2));
  return `${periodKey}-${pad(Math.min(Math.max(1, Number(dueDay) || 10), lastDay))}`;
};

export const buildRentalObligation = (contractValue, periodKey, nowDate = new Date()) => {
  const contract = normalizeRentalContract(contractValue);
  const bounds = getPeriodBounds(periodKey);
  if (!bounds) throw new Error("Período inválido.");
  const rentAmountMinor = resolveRentForPeriod(contract, periodKey);
  const dueDate = getDueDateForPeriod(periodKey, contract.dueDay);
  const todayKey = toDateKey(nowDate);
  return {
    schemaVersion: 1,
    contractId: contract.id || "",
    periodKey,
    serviceStartDate: bounds.startDate < contract.startDate ? contract.startDate : bounds.startDate,
    serviceEndDate: contract.endDate && bounds.endDate > contract.endDate ? contract.endDate : bounds.endDate,
    dueDate,
    currency: contract.currency,
    rentAmountMinor,
    otherChargesMinor: 0,
    totalAmountMinor: rentAmountMinor,
    paidAmountMinor: 0,
    balanceMinor: rentAmountMinor,
    status: dueDate < todayKey ? "overdue" : "pending",
    payments: [],
    administrationFeeSnapshot: { ...contract.financial.administrationFee },
  };
};

export const syncRentalObligationFromContract = (
  obligationValue,
  contractValue,
  nowDate = new Date(),
) => {
  const current = obligationValue || {};
  if (current.externalClosure?.closed === true || current.externalInvoice?.registered === true) {
    return { obligation: current, updated: false, reason: "has_external_activity" };
  }
  const hasPayments = Number(current.paidAmountMinor || 0) > 0
    || (Array.isArray(current.payments) && current.payments.length > 0);
  if (hasPayments) {
    return { obligation: current, updated: false, reason: "has_payments" };
  }
  const rebuilt = buildRentalObligation(contractValue, current.periodKey, nowDate);
  const otherChargesMinor = Math.max(0, round(current.otherChargesMinor));
  const totalAmountMinor = rebuilt.rentAmountMinor + otherChargesMinor;
  const obligation = {
    ...current,
    serviceStartDate: rebuilt.serviceStartDate,
    serviceEndDate: rebuilt.serviceEndDate,
    dueDate: rebuilt.dueDate,
    currency: rebuilt.currency,
    rentAmountMinor: rebuilt.rentAmountMinor,
    otherChargesMinor,
    totalAmountMinor,
    paidAmountMinor: 0,
    balanceMinor: totalAmountMinor,
    administrationFeeSnapshot: rebuilt.administrationFeeSnapshot,
    status: getObligationStatus({
      ...current,
      ...rebuilt,
      otherChargesMinor,
      totalAmountMinor,
      paidAmountMinor: 0,
    }, toDateKey(nowDate)),
  };
  return { obligation, updated: true, reason: "synchronized" };
};

export const getObligationStatus = (obligation = {}, todayKey = new Date().toISOString().slice(0, 10)) => {
  if (obligation.externalClosure?.closed === true) return "closed_external";
  const balance = Math.max(0, round(obligation.totalAmountMinor) - round(obligation.paidAmountMinor));
  if (balance <= 0) return "paid";
  if (round(obligation.paidAmountMinor) > 0) return obligation.dueDate < todayKey ? "overdue" : "partial";
  return obligation.dueDate < todayKey ? "overdue" : "pending";
};

export const hasRentalObligationActivity = (obligation = {}) => (
  Number(obligation.paidAmountMinor || 0) > 0
  || (Array.isArray(obligation.payments) && obligation.payments.length > 0)
  || obligation.externalClosure?.closed === true
  || obligation.externalInvoice?.registered === true
);

export const calculateAdministrationFee = (collectedMinor, fee = {}) =>
  Math.min(
    round(collectedMinor),
    round(round(collectedMinor) * (Math.max(0, Number(fee.percent) || 0) / 100))
      + round(fee.fixedAmountMinor),
  );

export const calculateRentalSettlement = ({ contract, obligation, expenses = [] } = {}) => {
  const collectedMinor = round(obligation?.paidAmountMinor);
  const administrationFeeMinor = calculateAdministrationFee(
    collectedMinor,
    obligation?.administrationFeeSnapshot || contract?.financial?.administrationFee,
  );
  const ownerExpensesMinor = expenses
    .filter((item) => item.deleted !== true && item.allocatedTo === "owner")
    .reduce((sum, item) => sum + round(item.amountMinor), 0);
  return {
    collectedMinor,
    administrationFeeMinor,
    ownerExpensesMinor,
    netOwnerAmountMinor: Math.max(0, collectedMinor - administrationFeeMinor - ownerExpensesMinor),
  };
};

const accountMovementDate = (...values) => {
  for (const value of values) {
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/u.test(value)) {
      return value.slice(0, 10);
    }
    const date = value?.toDate ? value.toDate() : value instanceof Date ? value : null;
    if (date && !Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);
  }
  return "";
};

export const buildRentalOwnerAccountStatement = ({
  obligations = [],
  settlements = [],
  expenses = [],
} = {}) => {
  const movements = [];

  obligations.forEach((obligation) => {
    (obligation.payments || []).filter((payment) => payment.voided !== true).forEach((payment, index) => {
      const amountMinor = round(payment.amountMinor);
      if (amountMinor <= 0) return;
      movements.push({
        id: `payment-${obligation.id}-${payment.id || index}`,
        date: accountMovementDate(payment.paidAt, obligation.serviceStartDate, `${obligation.periodKey}-01`),
        periodKey: obligation.periodKey || "",
        contractId: obligation.contractId || "",
        concept: `Cobro al locatario${payment.receiptNumber ? ` · ${payment.receiptNumber}` : ""}`,
        creditMinor: amountMinor,
        debitMinor: 0,
        kind: "tenant_payment",
        order: 10,
      });
    });
  });

  expenses
    .filter((expense) => expense.deleted !== true && expense.allocatedTo === "owner")
    .forEach((expense, index) => {
      const amountMinor = round(expense.amountMinor);
      if (amountMinor <= 0) return;
      movements.push({
        id: `expense-${expense.id || index}`,
        date: accountMovementDate(expense.date, `${expense.periodKey}-01`),
        periodKey: expense.periodKey || "",
        contractId: expense.contractId || "",
        concept: `Gasto a cargo del locador · ${expense.concept || "Sin concepto"}`,
        creditMinor: 0,
        debitMinor: amountMinor,
        kind: "owner_expense",
        order: 20,
      });
    });

  settlements.forEach((settlement, index) => {
    const periodFallback = settlement.periodKey ? `${settlement.periodKey}-01` : "";
    const settlementDate = accountMovementDate(
      settlement.settledAt,
      settlement.createdAt,
      settlement.paidAt,
      periodFallback,
    );
    const feeMinor = round(settlement.administrationFeeMinor);
    if (feeMinor > 0) {
      movements.push({
        id: `fee-${settlement.id || index}`,
        date: settlementDate,
        periodKey: settlement.periodKey || "",
        contractId: settlement.contractId || "",
        concept: "Honorarios de administración",
        creditMinor: 0,
        debitMinor: feeMinor,
        kind: "administration_fee",
        order: 30,
      });
    }

    if (["paid", "received"].includes(settlement.status)) {
      const amountMinor = round(settlement.netOwnerAmountMinor);
      if (amountMinor <= 0) return;
      movements.push({
        id: `settlement-payment-${settlement.id || index}`,
        date: accountMovementDate(settlement.paidAt, settlementDate, periodFallback),
        periodKey: settlement.periodKey || "",
        contractId: settlement.contractId || "",
        concept: settlement.status === "received"
          ? "Pago al locador · recepción confirmada"
          : "Pago al locador · recepción pendiente",
        creditMinor: 0,
        debitMinor: amountMinor,
        kind: "owner_payment",
        status: settlement.status,
        order: 40,
      });
    }
  });

  movements.sort((left, right) => (
    (left.date || "9999-12-31").localeCompare(right.date || "9999-12-31")
    || left.order - right.order
    || left.id.localeCompare(right.id)
  ));

  let balanceMinor = 0;
  const detailedMovements = movements.map((movement) => {
    balanceMinor += round(movement.creditMinor) - round(movement.debitMinor);
    return { ...movement, balanceMinor };
  });
  const totalCreditMinor = detailedMovements.reduce((sum, item) => sum + round(item.creditMinor), 0);
  const totalDebitMinor = detailedMovements.reduce((sum, item) => sum + round(item.debitMinor), 0);

  return {
    movements: detailedMovements,
    totalCreditMinor,
    totalDebitMinor,
    balanceMinor: totalCreditMinor - totalDebitMinor,
  };
};

export const getNextAdjustmentDate = (contractValue) => {
  const contract = normalizeRentalContract(contractValue);
  if (contract.financial.adjustment.nextAdjustmentDate) {
    return contract.financial.adjustment.nextAdjustmentDate;
  }
  const latest = [...contract.rentSchedule].sort((a, b) =>
    a.effectiveFrom.localeCompare(b.effectiveFrom),
  ).at(-1);
  return addMonthsClamped(
    latest?.effectiveFrom || contract.startDate,
    Math.max(1, Number(contract.financial.adjustment.frequencyMonths) || 1),
  );
};

export const validateRentalContract = (value = {}) => {
  const contract = normalizeRentalContract(value);
  const errors = [];
  if (!contract.inmuebleId) errors.push("Seleccioná el inmueble administrado.");
  if (contract.partyIds.owners.length === 0) errors.push("Seleccioná al menos un locador.");
  if (contract.partyIds.tenants.length === 0) errors.push("Seleccioná al menos un locatario.");
  if (!parseDateKey(contract.startDate)) errors.push("Ingresá una fecha de inicio válida.");
  if (!parseDateKey(contract.endDate)) errors.push("Ingresá una fecha de finalización válida.");
  if (contract.endDate && contract.startDate && contract.endDate < contract.startDate) {
    errors.push("La finalización no puede ser anterior al inicio.");
  }
  if (!(round(contract.financial.initialRentAmountMinor) > 0)) {
    errors.push("Ingresá el alquiler inicial.");
  }
  if (!(Number(contract.dueDay) >= 1 && Number(contract.dueDay) <= 31)) {
    errors.push("El día de vencimiento debe estar entre 1 y 31.");
  }
  if (
    contract.financial.adjustment.mode === "fixed_percent"
    && !(Number(contract.financial.adjustment.fixedPercent) > 0)
  ) {
    errors.push("Ingresá el porcentaje fijo de actualización.");
  }
  if (
    contract.financial.adjustment.mode === "index"
    && !contract.financial.adjustment.indexName?.trim()
  ) {
    errors.push("Identificá el índice contractual.");
  }
  if (
    contract.financial.adjustment.mode === "formula"
    && !contract.financial.adjustment.formula?.trim()
  ) {
    errors.push("Documentá la fórmula contractual.");
  }
  return errors;
};
