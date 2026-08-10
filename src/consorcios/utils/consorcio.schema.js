const today = () => new Date().toISOString().slice(0, 10);

export const createEmptyConsortium = () => ({
  schemaVersion: 1,
  name: "",
  legalName: "",
  taxId: "",
  address: "",
  city: "Córdoba",
  province: "Córdoba",
  postalCode: "",
  registration: "",
  bankAccount: "",
  currency: "ARS",
  dueDay: 10,
  notes: "",
  portalEmails: [],
  status: "active",
  deleted: false,
});

export const createEmptyConsortiumUnit = () => ({
  schemaVersion: 1,
  consortiumId: "",
  code: "",
  floor: "",
  apartment: "",
  type: "apartment",
  coefficient: 0,
  ownerName: "",
  ownerTaxId: "",
  ownerSince: "",
  ownerEmail: "",
  occupantName: "",
  occupantSince: "",
  occupantEmail: "",
  notificationPreference: "owner",
  email: "",
  phone: "",
  manualPortalEmails: [],
  portalEmails: [],
  creditBalanceMinor: 0,
  notes: "",
  active: true,
  deleted: false,
});

export const createEmptyConsortiumExpense = () => ({
  id: "",
  concept: "",
  category: "ordinary",
  distributionMode: "coefficient",
  specificUnitId: "",
  amountMinor: 0,
  notes: "",
});

export const createEmptyConsortiumPeriod = () => ({
  schemaVersion: 1,
  consortiumId: "",
  periodKey: today().slice(0, 7),
  dueDate: "",
  currency: "ARS",
  status: "draft",
  expenses: [],
  totalExpensesMinor: 0,
  issuedUnitCount: 0,
  deleted: false,
});
