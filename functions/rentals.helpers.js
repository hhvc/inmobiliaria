const pad = (value) => value.toString().padStart(2, "0");
const round = (value) => Math.round(Number(value) || 0);

const parseDateKey = (value = "") => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
    if (!match) return null;
    const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1,
        Number(match[3]), 12));
    return Number.isNaN(date.getTime()) ? null : date;
};

const toDateKey = (value) => {
    const date = value instanceof Date ? value : parseDateKey(value);
    if (!date || Number.isNaN(date.getTime())) return "";
    return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
};

const addMonthsClamped = (dateKey, months) => {
    const date = parseDateKey(dateKey);
    if (!date) return "";
    const day = date.getUTCDate();
    const target = new Date(Date.UTC(date.getUTCFullYear(),
        date.getUTCMonth() + Number(months || 0), 1, 12));
    const lastDay = new Date(Date.UTC(target.getUTCFullYear(),
        target.getUTCMonth() + 1, 0, 12)).getUTCDate();
    target.setUTCDate(Math.min(day, lastDay));
    return toDateKey(target);
};

const getPeriodKey = (dateKey = "") => dateKey.slice(0, 7);

const monthsBetweenPeriods = (fromPeriod, toPeriod) => {
    const [fromYear, fromMonth] = fromPeriod.split("-").map(Number);
    const [toYear, toMonth] = toPeriod.split("-").map(Number);
    return (toYear - fromYear) * 12 + toMonth - fromMonth;
};

const getPeriodBounds = (periodKey) => {
    const match = /^(\d{4})-(\d{2})$/u.exec(periodKey || "");
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const lastDay = new Date(Date.UTC(year, month, 0, 12)).getUTCDate();
    return {
        startDate: `${year}-${pad(month)}-01`,
        endDate: `${year}-${pad(month)}-${pad(lastDay)}`,
    };
};

const getPeriodKeys = (contract, throughDate, limit = 120) => {
    const startPeriod = getPeriodKey(contract.startDate);
    if (contract.contractType === "temporary") {
        if (!/^\d{4}-\d{2}$/u.test(startPeriod) || contract.startDate > throughDate) return [];
        return [startPeriod];
    }
    const effectiveEnd = contract.endDate && contract.endDate < throughDate ?
        contract.endDate : throughDate;
    const endPeriod = getPeriodKey(effectiveEnd);
    if (!/^\d{4}-\d{2}$/u.test(startPeriod) || !/^\d{4}-\d{2}$/u.test(endPeriod)) return [];
    const count = monthsBetweenPeriods(startPeriod, endPeriod);
    if (count < 0) return [];
    return Array.from({length: Math.min(count + 1, limit)}, (_, index) =>
        getPeriodKey(addMonthsClamped(`${startPeriod}-01`, index)));
};

const resolveRent = (contract, periodKey) => {
    if (contract.contractType === "temporary") {
        return round(contract.financial?.initialRentAmountMinor ||
            contract.financial?.currentRentAmountMinor);
    }
    const schedule = (Array.isArray(contract.rentSchedule) ? contract.rentSchedule : [])
        .filter((item) => item?.effectiveFrom && Number(item.amountMinor) > 0)
        .filter((item) => getPeriodKey(item.effectiveFrom) <= periodKey)
        .sort((left, right) => left.effectiveFrom.localeCompare(right.effectiveFrom));
    const scheduled = schedule.at(-1);
    const financial = contract.financial || {};
    const initial = round(scheduled?.amountMinor ||
        financial.initialRentAmountMinor || financial.currentRentAmountMinor);
    const adjustment = financial.adjustment || {};
    if (adjustment.mode !== "fixed_percent") return initial;
    const frequency = Math.max(1, Number(adjustment.frequencyMonths) || 1);
    const percent = Math.max(0, Number(adjustment.fixedPercent) || 0);
    const baseDate = scheduled?.effectiveFrom || contract.startDate;
    const elapsed = Math.max(0, monthsBetweenPeriods(getPeriodKey(baseDate), periodKey));
    return round(initial * ((1 + percent / 100) ** Math.floor(elapsed / frequency)));
};

export const buildAutomatedRentalObligations = ({
    contract,
    throughDate,
    todayDate,
} = {}) => getPeriodKeys(contract || {}, throughDate, 120).map((periodKey) => {
    const bounds = getPeriodBounds(periodKey);
    const isTemporary = contract.contractType === "temporary";
    const dueDay = Math.min(Math.max(1, Number(contract.dueDay) || 10),
        Number(bounds.endDate.slice(-2)));
    const dueDate = isTemporary ? contract.paymentDueDate : `${periodKey}-${pad(dueDay)}`;
    const rentAmountMinor = resolveRent(contract, periodKey);
    return {
        schemaVersion: 2,
        contractId: contract.id || "",
        periodKey,
        obligationType: isTemporary ? "single_stay" : "monthly_rent",
        serviceStartDate: isTemporary ? contract.startDate :
            (bounds.startDate < contract.startDate ? contract.startDate : bounds.startDate),
        serviceEndDate: isTemporary ? contract.endDate :
            (contract.endDate && bounds.endDate > contract.endDate ?
                contract.endDate : bounds.endDate),
        dueDate,
        currency: contract.currency || "ARS",
        rentAmountMinor,
        otherChargesMinor: 0,
        discountAmountMinor: 0,
        discountReason: "",
        totalAmountMinor: rentAmountMinor,
        paidAmountMinor: 0,
        balanceMinor: rentAmountMinor,
        status: dueDate < todayDate ? "overdue" : "pending",
        payments: [],
        administrationFeeSnapshot: {...(contract.financial?.administrationFee || {})},
    };
});

export const addDaysToDateKey = (dateKey, days) => {
    const date = parseDateKey(dateKey);
    if (!date) return "";
    date.setUTCDate(date.getUTCDate() + Number(days || 0));
    return toDateKey(date);
};
