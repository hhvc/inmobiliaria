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
  ownerPortalEmails: [],
  occupantPortalEmails: [],
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
  notificationAutomationMode: "inherit",
  notificationSendOnIssue: false,
  notificationPreDueDays: [3],
  notificationOverdueDays: [1, 7, 15],
  email: "",
  phone: "",
  manualOwnerPortalEmails: [],
  manualPortalEmails: [],
  ownerPortalEmails: [],
  occupantPortalEmails: [],
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

export const createEmptyConsortiumSupplier = () => ({
  schemaVersion: 1,
  consortiumId: "",
  name: "",
  legalName: "",
  taxId: "",
  category: "maintenance",
  email: "",
  phone: "",
  address: "",
  bankAccount: "",
  notes: "",
  active: true,
  deleted: false,
});

export const createEmptyConsortiumTreasuryAccount = () => ({
  schemaVersion: 1,
  consortiumId: "",
  name: "",
  type: "bank",
  currency: "ARS",
  openingBalanceMinor: 0,
  currentBalanceMinor: 0,
  notes: "",
  active: true,
  deleted: false,
});

export const createEmptyConsortiumTreasuryMovement = () => ({
  consortiumId: "",
  accountId: "",
  direction: "inflow",
  amountMinor: 0,
  date: today(),
  concept: "",
  reason: "",
  reference: "",
});

export const createEmptyConsortiumTreasuryTransfer = () => ({
  consortiumId: "",
  fromAccountId: "",
  toAccountId: "",
  amountMinor: 0,
  date: today(),
  concept: "Transferencia entre cuentas",
  reference: "",
  notes: "",
});

export const createEmptyConsortiumTreasuryReconciliation = () => ({
  consortiumId: "",
  accountId: "",
  statementDate: today(),
  statementBalanceMinor: 0,
  notes: "",
});

export const createEmptyConsortiumSupplierObligation = () => ({
  schemaVersion: 1,
  consortiumId: "",
  supplierId: "",
  concept: "",
  voucherType: "invoice",
  voucherNumber: "",
  issueDate: today(),
  dueDate: today(),
  currency: "ARS",
  amountMinor: 0,
  paidAmountMinor: 0,
  balanceMinor: 0,
  periodId: "",
  expenseId: "",
  notes: "",
  status: "pending",
  voided: false,
  deleted: false,
});
