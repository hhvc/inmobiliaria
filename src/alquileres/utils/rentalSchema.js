const today = () => new Date().toISOString().slice(0, 10);

export const createEmptyRentalParty = () => ({
  schemaVersion: 1,
  roles: [],
  personType: "individual",
  name: "",
  taxId: "",
  documentType: "DNI",
  ivaConditionId: 5,
  email: "",
  phone: "",
  address: "",
  bankAccount: "",
  notes: "",
  active: true,
});

export const createEmptyRentalContract = () => ({
  schemaVersion: 1,
  status: "draft",
  inmuebleId: "",
  inmuebleSnapshot: {
    title: "",
    address: "",
    propertyType: "",
  },
  partyIds: {
    owners: [],
    tenants: [],
    guarantors: [],
  },
  partySnapshots: {
    owners: [],
    tenants: [],
    guarantors: [],
  },
  startDate: today(),
  endDate: "",
  signedAt: today(),
  currency: "ARS",
  otherCurrency: "",
  dueDay: 10,
  depositAmountMinor: 0,
  financial: {
    initialRentAmountMinor: 0,
    currentRentAmountMinor: 0,
    adjustment: {
      mode: "manual",
      frequencyMonths: 3,
      fixedPercent: 0,
      indexName: "",
      formula: "",
      nextAdjustmentDate: "",
    },
    administrationFee: {
      percent: 0,
      fixedAmountMinor: 0,
    },
  },
  rentSchedule: [],
  servicesIncluded: "",
  lateFeeNotes: "",
  contractNotes: "",
  documentUrl: "",
  deleted: false,
});

export const createEmptyRentalExpense = () => ({
  contractId: "",
  periodKey: "",
  date: today(),
  concept: "",
  amountMinor: 0,
  allocatedTo: "owner",
  notes: "",
  deleted: false,
});

const merge = (base, value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return base;
  return Object.entries(base).reduce((result, [key, defaultValue]) => ({
    ...result,
    [key]: defaultValue && typeof defaultValue === "object" && !Array.isArray(defaultValue)
      ? merge(defaultValue, value[key])
      : value[key] ?? defaultValue,
  }), { ...value });
};

const array = (value) => Array.from(new Set(
  (Array.isArray(value) ? value : []).map((item) => item?.toString?.().trim()).filter(Boolean),
));

export const normalizeRentalParty = (value = {}) => ({
  ...merge(createEmptyRentalParty(), value),
  roles: array(value.roles),
  ivaConditionId: Number(value.ivaConditionId || 5),
  active: value.active !== false,
});

export const normalizeRentalContract = (value = {}) => {
  const normalized = merge(createEmptyRentalContract(), value);
  normalized.partyIds = {
    owners: array(value.partyIds?.owners),
    tenants: array(value.partyIds?.tenants),
    guarantors: array(value.partyIds?.guarantors),
  };
  normalized.partySnapshots = {
    owners: Array.isArray(value.partySnapshots?.owners) ? value.partySnapshots.owners : [],
    tenants: Array.isArray(value.partySnapshots?.tenants) ? value.partySnapshots.tenants : [],
    guarantors: Array.isArray(value.partySnapshots?.guarantors) ? value.partySnapshots.guarantors : [],
  };
  normalized.rentSchedule = (Array.isArray(value.rentSchedule)
    ? value.rentSchedule
    : []).filter((item) => item?.effectiveFrom && Number(item?.amountMinor) > 0);
  normalized.deleted = value.deleted === true;
  return normalized;
};
