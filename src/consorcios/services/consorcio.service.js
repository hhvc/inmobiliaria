import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import {
  deleteObject,
  getBlob,
  ref as storageRef,
  uploadBytes,
} from "firebase/storage";
import { getFunctions, httpsCallable } from "firebase/functions";

import app, { auth, db, storage } from "../../firebase/config";
import { assertInmobiliariaActiva } from "../../inmobiliaria/services/inmobiliaria.service";
import {
  buildConsortiumEconomicStatement,
  buildConsortiumMonthlyCloseChecklist,
  calculateConsortiumAssessments,
  getConsortiumObligationStatus,
  getConsortiumTreasuryBookBalance,
  validateConsortium,
  validateConsortiumUnit,
} from "../utils/consorcio.helpers";
import {
  buildConsortiumPaymentAllocations,
  buildConsortiumPaymentAgreementSchedule,
} from "../utils/consorcioCollections.helpers";
import {
  isConsortiumDocumentFileValid,
  normalizeConsortiumEmails,
  safeConsortiumFileName,
} from "../utils/consorcioPortal.helpers";
import {
  normalizeConsortiumDeliveryPreference,
  normalizeConsortiumUnitAutomationMode,
  normalizeReminderDays,
} from "../utils/consorcioNotification.helpers";

const COLLECTIONS = {
  consortiums: "condominiums",
  units: "condominium_units",
  unitChanges: "condominium_unit_changes",
  communications: "condominium_communications",
  periods: "condominium_periods",
  obligations: "condominium_obligations",
  payments: "condominium_payments",
  expenseDocuments: "condominium_expense_documents",
  paymentReports: "condominium_payment_reports",
  adjustments: "condominium_adjustments",
  penalties: "condominium_penalties",
  suppliers: "condominium_suppliers",
  supplierObligations: "condominium_supplier_obligations",
  supplierPayments: "condominium_supplier_payments",
  treasuryAccounts: "condominium_treasury_accounts",
  treasuryMovements: "condominium_treasury_movements",
  treasuryReconciliations: "condominium_treasury_reconciliations",
  financialClosures: "condominium_financial_closures",
  claims: "condominium_claims",
  claimEvents: "condominium_claim_events",
  collectionActions: "condominium_collection_actions",
  paymentAgreements: "condominium_payment_agreements",
};

const functions = getFunctions(app, "southamerica-east1");

const agencyCollection = (inmobiliariaId, key) =>
  collection(db, "inmobiliarias", inmobiliariaId, COLLECTIONS[key]);

const agencyDoc = (inmobiliariaId, key, id) =>
  doc(db, "inmobiliarias", inmobiliariaId, COLLECTIONS[key], id);

const cleanText = (value = "", maxLength = 1000) =>
  value?.toString?.().trim().replace(/\s+/g, " ").slice(0, maxLength) || "";

const currentUserOrThrow = () => {
  const user = auth.currentUser;
  if (!user?.uid) throw new Error("Usuario no autenticado.");
  return user;
};

const assertAgency = async (inmobiliariaId) => {
  if (!inmobiliariaId) throw new Error("Seleccioná una inmobiliaria activa.");
  currentUserOrThrow();
  await assertInmobiliariaActiva(inmobiliariaId);
};

const timestampMillis = (value) =>
  value?.toMillis?.() || Number(value?.seconds || 0) * 1000 || 0;

const sortUpdatedDesc = (items) => [...items].sort(
  (a, b) => timestampMillis(b.updatedAt) - timestampMillis(a.updatedAt),
);

const sanitizeConsortium = (value = {}) => ({
  schemaVersion: 1,
  name: cleanText(value.name, 200),
  legalName: cleanText(value.legalName, 220),
  taxId: cleanText(value.taxId, 32),
  address: cleanText(value.address, 300),
  city: cleanText(value.city, 120),
  province: cleanText(value.province, 120),
  postalCode: cleanText(value.postalCode, 20),
  registration: cleanText(value.registration, 100),
  bankAccount: cleanText(value.bankAccount, 120),
  currency: cleanText(value.currency, 10) || "ARS",
  dueDay: Math.min(31, Math.max(1, Math.trunc(Number(value.dueDay) || 10))),
  notes: cleanText(value.notes, 4000),
  portalEmails: normalizeConsortiumEmails(value.portalEmails),
  status: value.status === "archived" ? "archived" : "active",
  deleted: false,
});

const sanitizeUnit = (value = {}) => {
  const notificationPreference = normalizeConsortiumDeliveryPreference(value.notificationPreference);
  const notificationAutomationMode = normalizeConsortiumUnitAutomationMode(
    value.notificationAutomationMode,
  );
  const ownerEmail = normalizeConsortiumEmails([value.ownerEmail])[0] || "";
  const occupantEmail = normalizeConsortiumEmails([value.occupantEmail])[0] || "";
  const manualOwnerPortalEmails = normalizeConsortiumEmails(value.manualOwnerPortalEmails);
  const ownerPortalEmails = normalizeConsortiumEmails([ownerEmail, ...manualOwnerPortalEmails]);
  const manualPortalEmails = normalizeConsortiumEmails(
    value.manualPortalEmails ?? value.portalEmails,
  ).filter((email) => !ownerPortalEmails.includes(email));
  const occupantPortalEmails = normalizeConsortiumEmails([
    occupantEmail,
    ...manualPortalEmails,
  ]).filter((email) => !ownerPortalEmails.includes(email));
  const unit = {
    schemaVersion: 1,
    consortiumId: cleanText(value.consortiumId, 128),
    code: cleanText(value.code, 80),
    floor: cleanText(value.floor, 40),
    apartment: cleanText(value.apartment, 40),
    type: cleanText(value.type, 40) || "apartment",
    coefficient: Math.max(0, Number(value.coefficient) || 0),
    ownerName: cleanText(value.ownerName, 220),
    ownerTaxId: cleanText(value.ownerTaxId, 32),
    ownerSince: cleanText(value.ownerSince, 10),
    ownerEmail,
    occupantName: cleanText(value.occupantName, 220),
    occupantSince: cleanText(value.occupantSince, 10),
    occupantEmail,
    notificationPreference,
    notificationAutomationMode,
    notificationSendOnIssue: value.notificationSendOnIssue === true,
    notificationPreDueDays: normalizeReminderDays(value.notificationPreDueDays, [3]),
    notificationOverdueDays: normalizeReminderDays(value.notificationOverdueDays, [1, 7, 15])
      .filter((item) => item > 0),
    email: cleanText(value.email, 220),
    phone: cleanText(value.phone, 80),
    manualOwnerPortalEmails,
    manualPortalEmails,
    ownerPortalEmails,
    occupantPortalEmails,
    portalEmails: [],
    creditBalanceMinor: Math.max(0, Math.round(Number(value.creditBalanceMinor) || 0)),
    notes: cleanText(value.notes, 2000),
    active: value.active !== false,
    deleted: false,
  };
  unit.portalEmails = normalizeConsortiumEmails([
    ...ownerPortalEmails,
    ...occupantPortalEmails,
  ]);
  return unit;
};

const UNIT_AUDIT_FIELDS = [
  "code",
  "floor",
  "apartment",
  "type",
  "coefficient",
  "ownerName",
  "ownerTaxId",
  "ownerSince",
  "ownerEmail",
  "occupantName",
  "occupantSince",
  "occupantEmail",
  "notificationPreference",
  "notificationAutomationMode",
  "notificationSendOnIssue",
  "notificationPreDueDays",
  "notificationOverdueDays",
  "email",
  "phone",
  "manualOwnerPortalEmails",
  "manualPortalEmails",
  "ownerPortalEmails",
  "occupantPortalEmails",
  "portalEmails",
  "notes",
  "active",
];

const unitAuditSnapshot = (unit = {}) => Object.fromEntries(
  UNIT_AUDIT_FIELDS.map((field) => [
    field,
    Array.isArray(unit[field]) ? [...unit[field]] : (unit[field] ?? ""),
  ]),
);

const auditValuesEqual = (left, right) => JSON.stringify(left) === JSON.stringify(right);

const hasValidDateKey = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return false;
  const parsed = new Date(`${value}T12:00:00`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

const requireEffectiveDate = (value, label) => {
  const normalized = cleanText(value, 10);
  if (!hasValidDateKey(normalized)) throw new Error(`Ingresá la fecha efectiva del cambio de ${label}.`);
  if (normalized > new Date().toISOString().slice(0, 10)) {
    throw new Error(`La fecha efectiva del cambio de ${label} no puede ser futura.`);
  }
  return normalized;
};

const getUnitPortalEmailsByRole = (unit = {}, field = "portalEmails") => {
  if (Array.isArray(unit[field])) return unit[field];
  if (field === "ownerPortalEmails") {
    return [unit.ownerEmail, ...(unit.manualOwnerPortalEmails || [])];
  }
  if (field === "occupantPortalEmails") {
    return [unit.occupantEmail, ...(unit.manualPortalEmails || [])];
  }
  return unit.portalEmails || [];
};

const getAggregatedPortalEmails = (
  units,
  replacement = null,
  field = "portalEmails",
) => normalizeConsortiumEmails(
  units.flatMap((unit) => {
    if (replacement && unit.id === replacement.id) {
      return getUnitPortalEmailsByRole(replacement, field);
    }
    if (unit.deleted === true || unit.active === false) return [];
    return getUnitPortalEmailsByRole(unit, field);
  }).concat(
    replacement && !units.some((unit) => unit.id === replacement.id)
      ? getUnitPortalEmailsByRole(replacement, field)
      : [],
  ),
);

const sanitizeExpense = (value = {}, fallbackId = "") => ({
  id: cleanText(value.id || fallbackId, 128),
  concept: cleanText(value.concept, 220),
  category: value.category === "extraordinary" ? "extraordinary" : "ordinary",
  distributionMode: ["coefficient", "equal", "specific"].includes(value.distributionMode)
    ? value.distributionMode
    : "coefficient",
  specificUnitId: cleanText(value.specificUnitId, 128),
  amountMinor: Math.max(0, Math.round(Number(value.amountMinor) || 0)),
  notes: cleanText(value.notes, 1000),
});

const sanitizePenalty = (value = {}) => ({
  unitId: cleanText(value.unitId, 128),
  infringementDate: cleanText(value.infringementDate, 10),
  resolutionDate: cleanText(value.resolutionDate, 10),
  dueDate: cleanText(value.dueDate, 10),
  description: cleanText(value.description, 2000),
  ruleReference: cleanText(value.ruleReference, 1000),
  authority: ["assembly", "council", "administrator", "other"].includes(value.authority)
    ? value.authority
    : "assembly",
  authorityReference: cleanText(value.authorityReference, 1000),
  evidenceNotes: cleanText(value.evidenceNotes, 2000),
  amountMinor: Math.max(0, Math.round(Number(value.amountMinor) || 0)),
});

const validatePenalty = (value = {}) => {
  if (!value.unitId) throw new Error("Seleccioná la unidad sancionada.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value.infringementDate)) throw new Error("Ingresá la fecha de la infracción.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value.resolutionDate)) throw new Error("Ingresá la fecha de la resolución.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value.dueDate)) throw new Error("Ingresá el vencimiento de la multa.");
  if (value.resolutionDate < value.infringementDate) {
    throw new Error("La resolución no puede ser anterior a la infracción.");
  }
  if (value.dueDate < value.resolutionDate) {
    throw new Error("El vencimiento no puede ser anterior a la resolución.");
  }
  if (!value.description) throw new Error("Describí la conducta sancionada.");
  if (!value.ruleReference) throw new Error("Indicá la norma o cláusula reglamentaria aplicable.");
  if (!value.authorityReference) throw new Error("Indicá el acta, resolución o antecedente que respalda la sanción.");
  if (!value.amountMinor) throw new Error("Ingresá un importe mayor a cero.");
};

const getPenaltyHistoryEntry = (status, userId, notes = "") => ({
  status,
  by: userId,
  atIso: new Date().toISOString(),
  notes: cleanText(notes, 1000),
});

export const getConsortiums = async (inmobiliariaId) => {
  if (!inmobiliariaId) return [];
  const snap = await getDocs(agencyCollection(inmobiliariaId, "consortiums"));
  return sortUpdatedDesc(snap.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .filter((item) => item.deleted !== true));
};

export const getConsortiumById = async (inmobiliariaId, consortiumId) => {
  if (!inmobiliariaId || !consortiumId) return null;
  const snap = await getDoc(agencyDoc(inmobiliariaId, "consortiums", consortiumId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

export const createConsortium = async (inmobiliariaId, value) => {
  await assertAgency(inmobiliariaId);
  const user = currentUserOrThrow();
  const payload = sanitizeConsortium(value);
  const errors = validateConsortium(payload);
  if (errors.length) throw new Error(errors.join(" "));
  const ref = doc(agencyCollection(inmobiliariaId, "consortiums"));
  await setDoc(ref, {
    ...payload,
    inmobiliariaId,
    ownerInmobiliariaId: inmobiliariaId,
    createdBy: user.uid,
    updatedBy: user.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
};

export const updateConsortium = async (inmobiliariaId, consortiumId, value) => {
  await assertAgency(inmobiliariaId);
  const user = currentUserOrThrow();
  const payload = sanitizeConsortium(value);
  const errors = validateConsortium(payload);
  if (errors.length) throw new Error(errors.join(" "));
  await updateDoc(agencyDoc(inmobiliariaId, "consortiums", consortiumId), {
    ...payload,
    inmobiliariaId,
    ownerInmobiliariaId: inmobiliariaId,
    updatedBy: user.uid,
    updatedAt: serverTimestamp(),
  });
};

export const archiveConsortium = async (inmobiliariaId, consortiumId) => {
  await assertAgency(inmobiliariaId);
  const user = currentUserOrThrow();
  await updateDoc(agencyDoc(inmobiliariaId, "consortiums", consortiumId), {
    status: "archived",
    archivedAt: serverTimestamp(),
    updatedBy: user.uid,
    updatedAt: serverTimestamp(),
  });
};

export const getConsortiumUnits = async (inmobiliariaId, consortiumId = "") => {
  if (!inmobiliariaId) return [];
  const snap = await getDocs(agencyCollection(inmobiliariaId, "units"));
  return snap.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .filter((item) => item.deleted !== true)
    .filter((item) => !consortiumId || item.consortiumId === consortiumId)
    .sort((a, b) => (a.code || "").localeCompare(b.code || "", "es", { numeric: true }));
};

export const getConsortiumUnitById = async (inmobiliariaId, unitId) => {
  if (!inmobiliariaId || !unitId) return null;
  const snap = await getDoc(agencyDoc(inmobiliariaId, "units", unitId));
  return snap.exists() && snap.data()?.deleted !== true
    ? { id: snap.id, ...snap.data() }
    : null;
};

export const getConsortiumUnitChanges = async (
  inmobiliariaId,
  { consortiumId = "", unitId = "" } = {},
) => {
  if (!inmobiliariaId) return [];
  const source = unitId
    ? query(agencyCollection(inmobiliariaId, "unitChanges"), where("unitId", "==", unitId))
    : agencyCollection(inmobiliariaId, "unitChanges");
  const snap = await getDocs(source);
  return snap.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .filter((item) => !consortiumId || item.consortiumId === consortiumId)
    .sort((a, b) => timestampMillis(b.createdAt) - timestampMillis(a.createdAt));
};

export const createConsortiumUnit = async (inmobiliariaId, consortiumId, value) => {
  await assertAgency(inmobiliariaId);
  const user = currentUserOrThrow();
  const payload = sanitizeUnit({ ...value, consortiumId });
  const errors = validateConsortiumUnit(payload);
  if (errors.length) throw new Error(errors.join(" "));
  const consortium = await getConsortiumById(inmobiliariaId, consortiumId);
  if (!consortium || consortium.deleted === true) throw new Error("El consorcio no existe.");
  const currentUnits = await getConsortiumUnits(inmobiliariaId, consortiumId);
  const ref = doc(agencyCollection(inmobiliariaId, "units"));
  const unitData = {
    ...payload,
    consortiumName: cleanText(consortium.name, 200),
    consortiumAddress: cleanText(consortium.address, 300),
    consortiumCurrency: cleanText(consortium.currency, 10) || "ARS",
    inmobiliariaId,
    ownerInmobiliariaId: inmobiliariaId,
    createdBy: user.uid,
    updatedBy: user.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const batch = writeBatch(db);
  batch.set(ref, unitData);
  batch.update(agencyDoc(inmobiliariaId, "consortiums", consortiumId), {
    portalEmails: getAggregatedPortalEmails(currentUnits, { id: ref.id, ...unitData }),
    ownerPortalEmails: getAggregatedPortalEmails(
      currentUnits,
      { id: ref.id, ...unitData },
      "ownerPortalEmails",
    ),
    occupantPortalEmails: getAggregatedPortalEmails(
      currentUnits,
      { id: ref.id, ...unitData },
      "occupantPortalEmails",
    ),
    updatedAt: serverTimestamp(),
    updatedBy: user.uid,
  });
  await batch.commit();
  return ref.id;
};

export const updateConsortiumUnit = async (inmobiliariaId, unitId, value) => {
  await assertAgency(inmobiliariaId);
  const user = currentUserOrThrow();
  const unitRef = agencyDoc(inmobiliariaId, "units", unitId);
  const unitSnapshot = await getDoc(unitRef);
  if (!unitSnapshot.exists()) throw new Error("La unidad no existe.");
  const currentUnit = unitSnapshot.data();
  const payload = sanitizeUnit(value);
  payload.creditBalanceMinor = Math.max(0, Math.round(Number(currentUnit.creditBalanceMinor) || 0));
  if (currentUnit.consortiumId !== payload.consortiumId) {
    throw new Error("No se puede trasladar una unidad a otro consorcio.");
  }

  const changeMetadata = value.changeMetadata || {};
  const reason = cleanText(changeMetadata.reason, 1000);
  if (!reason) throw new Error("Indicá el motivo de la edición para conservarlo en el historial.");

  const ownerIdentityChanged = (
    cleanText(currentUnit.ownerName, 220) !== payload.ownerName
    || cleanText(currentUnit.ownerTaxId, 32) !== payload.ownerTaxId
  );
  const occupantIdentityChanged = cleanText(currentUnit.occupantName, 220) !== payload.occupantName;
  const ownerChangeKind = changeMetadata.ownerChangeKind === "correction" ? "correction" : "replacement";
  const occupantChangeKind = changeMetadata.occupantChangeKind === "correction" ? "correction" : "replacement";
  let ownerEffectiveDate = "";
  let occupantEffectiveDate = "";

  payload.ownerSince = cleanText(currentUnit.ownerSince, 10);
  payload.occupantSince = cleanText(currentUnit.occupantSince, 10);
  if (ownerIdentityChanged && ownerChangeKind === "replacement") {
    ownerEffectiveDate = requireEffectiveDate(changeMetadata.ownerEffectiveDate, "titular");
    payload.ownerSince = ownerEffectiveDate;
  }
  if (occupantIdentityChanged && occupantChangeKind === "replacement") {
    occupantEffectiveDate = requireEffectiveDate(changeMetadata.occupantEffectiveDate, "ocupante");
    payload.occupantSince = occupantEffectiveDate;
  }

  const errors = validateConsortiumUnit(payload);
  if (errors.length) throw new Error(errors.join(" "));
  const consortium = await getConsortiumById(inmobiliariaId, payload.consortiumId);
  const currentUnits = await getConsortiumUnits(inmobiliariaId, payload.consortiumId);
  const unitData = {
    ...payload,
    consortiumName: cleanText(consortium?.name, 200),
    consortiumAddress: cleanText(consortium?.address, 300),
    consortiumCurrency: cleanText(consortium?.currency, 10) || "ARS",
    inmobiliariaId,
    ownerInmobiliariaId: inmobiliariaId,
    updatedBy: user.uid,
    updatedAt: serverTimestamp(),
  };
  const before = unitAuditSnapshot(currentUnit);
  const after = unitAuditSnapshot(unitData);
  const changedFields = UNIT_AUDIT_FIELDS.filter((field) => !auditValuesEqual(before[field], after[field]));
  if (!changedFields.length) throw new Error("No hay cambios para guardar.");
  const changeRef = doc(agencyCollection(inmobiliariaId, "unitChanges"));
  const batch = writeBatch(db);
  batch.update(unitRef, unitData);
  batch.update(agencyDoc(inmobiliariaId, "consortiums", payload.consortiumId), {
    portalEmails: getAggregatedPortalEmails(currentUnits, { id: unitId, ...unitData }),
    ownerPortalEmails: getAggregatedPortalEmails(
      currentUnits,
      { id: unitId, ...unitData },
      "ownerPortalEmails",
    ),
    occupantPortalEmails: getAggregatedPortalEmails(
      currentUnits,
      { id: unitId, ...unitData },
      "occupantPortalEmails",
    ),
    updatedAt: serverTimestamp(),
    updatedBy: user.uid,
  });
  batch.set(changeRef, {
    id: changeRef.id,
    schemaVersion: 1,
    inmobiliariaId,
    ownerInmobiliariaId: inmobiliariaId,
    consortiumId: payload.consortiumId,
    unitId,
    unitCodeBefore: before.code,
    unitCodeAfter: after.code,
    reason,
    changedFields,
    ownerIdentityChanged,
    ownerChangeKind: ownerIdentityChanged ? ownerChangeKind : "",
    ownerEffectiveDate,
    occupantIdentityChanged,
    occupantChangeKind: occupantIdentityChanged ? occupantChangeKind : "",
    occupantEffectiveDate,
    before,
    after,
    createdBy: user.uid,
    createdByName: cleanText(user.displayName, 220),
    createdByEmail: cleanText(user.email, 220),
    createdAt: serverTimestamp(),
  });
  await batch.commit();
  return changeRef.id;
};

export const archiveConsortiumUnit = async (inmobiliariaId, unitId) => {
  await assertAgency(inmobiliariaId);
  const user = currentUserOrThrow();
  const unitRef = agencyDoc(inmobiliariaId, "units", unitId);
  const unitSnapshot = await getDoc(unitRef);
  if (!unitSnapshot.exists()) throw new Error("La unidad no existe.");
  const consortiumId = unitSnapshot.data().consortiumId;
  const currentUnits = await getConsortiumUnits(inmobiliariaId, consortiumId);
  const archivedUnit = {
    ...unitSnapshot.data(),
    id: unitId,
    active: false,
    deleted: true,
    portalEmails: [],
    ownerPortalEmails: [],
    occupantPortalEmails: [],
  };
  const batch = writeBatch(db);
  batch.update(unitRef, {
    active: false,
    deleted: true,
    portalEmails: [],
    archivedAt: serverTimestamp(),
    updatedBy: user.uid,
    updatedAt: serverTimestamp(),
  });
  batch.update(agencyDoc(inmobiliariaId, "consortiums", consortiumId), {
    portalEmails: getAggregatedPortalEmails(currentUnits, archivedUnit),
    ownerPortalEmails: getAggregatedPortalEmails(
      currentUnits,
      archivedUnit,
      "ownerPortalEmails",
    ),
    occupantPortalEmails: getAggregatedPortalEmails(
      currentUnits,
      archivedUnit,
      "occupantPortalEmails",
    ),
    updatedAt: serverTimestamp(),
    updatedBy: user.uid,
  });
  await batch.commit();
};

export const getConsortiumPeriods = async (inmobiliariaId, consortiumId = "") => {
  if (!inmobiliariaId) return [];
  const baseCollection = agencyCollection(inmobiliariaId, "periods");
  const source = consortiumId
    ? query(baseCollection, where("consortiumId", "==", consortiumId))
    : baseCollection;
  const snap = await getDocs(source);
  return snap.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .filter((item) => item.deleted !== true)
    .filter((item) => !consortiumId || item.consortiumId === consortiumId)
    .sort((a, b) => (b.periodKey || "").localeCompare(a.periodKey || ""));
};

export const getConsortiumPeriodById = async (inmobiliariaId, periodId) => {
  if (!inmobiliariaId || !periodId) return null;
  const snap = await getDoc(agencyDoc(inmobiliariaId, "periods", periodId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

export const createConsortiumPeriod = async ({
  inmobiliariaId,
  consortiumId,
  periodKey,
  dueDate,
  currency = "ARS",
}) => {
  await assertAgency(inmobiliariaId);
  if (!/^\d{4}-\d{2}$/.test(periodKey || "")) throw new Error("Ingresá un período válido.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate || "")) throw new Error("Ingresá el vencimiento.");
  const user = currentUserOrThrow();
  const id = `${consortiumId}_${periodKey}`;
  const ref = agencyDoc(inmobiliariaId, "periods", id);
  const existing = await getDoc(ref);
  if (existing.exists() && existing.data().deleted !== true) {
    throw new Error("Ese período ya existe para el consorcio.");
  }
  await setDoc(ref, {
    id,
    schemaVersion: 1,
    consortiumId,
    periodKey,
    dueDate,
    currency,
    status: "draft",
    expenses: [],
    totalExpensesMinor: 0,
    issuedUnitCount: 0,
    deleted: false,
    inmobiliariaId,
    ownerInmobiliariaId: inmobiliariaId,
    createdBy: user.uid,
    updatedBy: user.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return id;
};

export const saveConsortiumPeriodExpenses = async ({ inmobiliariaId, periodId, expenses }) => {
  await assertAgency(inmobiliariaId);
  const user = currentUserOrThrow();
  const ref = agencyDoc(inmobiliariaId, "periods", periodId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("La liquidación no existe.");
  if (snap.data().status !== "draft") throw new Error("Una liquidación emitida ya no puede modificarse.");
  const normalized = (Array.isArray(expenses) ? expenses : [])
    .map((expense, index) => sanitizeExpense(expense, `${periodId}_${index + 1}`))
    .filter((expense) => expense.concept && expense.amountMinor > 0);
  const totalExpensesMinor = normalized.reduce((sum, expense) => sum + expense.amountMinor, 0);
  await updateDoc(ref, {
    expenses: normalized,
    totalExpensesMinor,
    updatedBy: user.uid,
    updatedAt: serverTimestamp(),
  });
};

export const issueConsortiumPeriod = async ({ inmobiliariaId, periodId }) => {
  await assertAgency(inmobiliariaId);
  const user = currentUserOrThrow();
  const period = await getConsortiumPeriodById(inmobiliariaId, periodId);
  if (!period) throw new Error("La liquidación no existe.");
  if (period.status !== "draft") throw new Error("La liquidación ya fue emitida.");
  if (!Array.isArray(period.expenses) || !period.expenses.length) {
    throw new Error("Cargá al menos un gasto antes de emitir.");
  }
  const units = await getConsortiumUnits(inmobiliariaId, period.consortiumId);
  const { assessments, totalExpensesMinor } = calculateConsortiumAssessments({
    units,
    expenses: period.expenses,
  });
  if (assessments.length > 400) {
    throw new Error("La liquidación supera el límite operativo de 400 unidades.");
  }
  const periodRef = agencyDoc(inmobiliariaId, "periods", periodId);
  await runTransaction(db, async (transaction) => {
    const latestPeriodSnapshot = await transaction.get(periodRef);
    if (!latestPeriodSnapshot.exists()) {
      throw new Error("El período ya no existe.");
    }
    if (latestPeriodSnapshot.data().status !== "draft") {
      throw new Error("El período ya fue emitido por otro operador.");
    }

    assessments.forEach((assessment) => {
      const id = `${periodId}_${assessment.unitId}`;
      transaction.set(agencyDoc(inmobiliariaId, "obligations", id), {
        ...assessment,
        id,
        consortiumId: period.consortiumId,
        periodId,
        periodKey: period.periodKey,
        dueDate: period.dueDate,
        currency: period.currency || "ARS",
        paidAmountMinor: 0,
        balanceMinor: assessment.totalAmountMinor,
        status: assessment.totalAmountMinor > 0 ? "pending" : "paid",
        paymentIds: [],
        inmobiliariaId,
        ownerInmobiliariaId: inmobiliariaId,
        createdBy: user.uid,
        updatedBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });
    transaction.update(periodRef, {
      status: "issued",
      totalExpensesMinor,
      issuedUnitCount: assessments.length,
      issuedAt: serverTimestamp(),
      issuedBy: user.uid,
      updatedAt: serverTimestamp(),
      updatedBy: user.uid,
    });
  });
  return { unitCount: assessments.length, totalExpensesMinor };
};

export const getConsortiumObligations = async (
  inmobiliariaId,
  { consortiumId = "", periodId = "", unitId = "" } = {},
) => {
  if (!inmobiliariaId) return [];
  const baseCollection = agencyCollection(inmobiliariaId, "obligations");
  const source = unitId
    ? query(baseCollection, where("unitId", "==", unitId))
    : consortiumId
      ? query(baseCollection, where("consortiumId", "==", consortiumId))
      : periodId
        ? query(baseCollection, where("periodId", "==", periodId))
        : baseCollection;
  const snap = await getDocs(source);
  return snap.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .filter((item) => !consortiumId || item.consortiumId === consortiumId)
    .filter((item) => !periodId || item.periodId === periodId)
    .filter((item) => !unitId || item.unitId === unitId)
    .sort((a, b) => (b.periodKey || "").localeCompare(a.periodKey || ""));
};

export const getConsortiumObligationById = async (inmobiliariaId, obligationId) => {
  if (!inmobiliariaId || !obligationId) return null;
  const snap = await getDoc(agencyDoc(inmobiliariaId, "obligations", obligationId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

export const getConsortiumAdjustments = async (
  inmobiliariaId,
  { consortiumId = "", obligationId = "", unitId = "" } = {},
) => {
  if (!inmobiliariaId) return [];
  const source = unitId
    ? query(agencyCollection(inmobiliariaId, "adjustments"), where("unitId", "==", unitId))
    : agencyCollection(inmobiliariaId, "adjustments");
  const snap = await getDocs(source);
  return snap.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .filter((item) => !consortiumId || item.consortiumId === consortiumId)
    .filter((item) => !obligationId || item.obligationId === obligationId)
    .sort((a, b) => (
      (b.effectiveDate || "").localeCompare(a.effectiveDate || "")
      || timestampMillis(b.createdAt) - timestampMillis(a.createdAt)
    ));
};

const getUnitAuditSnapshot = (unit = {}) => ({
  code: cleanText(unit.code, 80),
  floor: cleanText(unit.floor, 40),
  apartment: cleanText(unit.apartment, 40),
  ownerName: cleanText(unit.ownerName, 220),
  occupantName: cleanText(unit.occupantName, 220),
  coefficient: Math.max(0, Number(unit.coefficient) || 0),
});

export const recordConsortiumOpeningBalance = async ({
  inmobiliariaId,
  consortiumId,
  unitId,
  type,
  amountMinor,
  effectiveDate,
  periodKey,
  dueDate,
  reason,
}) => {
  await assertAgency(inmobiliariaId);
  const user = currentUserOrThrow();
  const amount = Math.max(0, Math.round(Number(amountMinor) || 0));
  const normalizedReason = cleanText(reason, 1000);
  if (!unitId) throw new Error("Seleccioná una unidad.");
  if (!amount) throw new Error("Ingresá un importe mayor a cero.");
  if (!["debit", "credit"].includes(type)) throw new Error("Seleccioná el tipo de saldo inicial.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate || "")) throw new Error("Ingresá la fecha del saldo inicial.");
  if (!normalizedReason) throw new Error("Ingresá el origen o motivo del saldo inicial.");
  if (type === "debit" && !/^\d{4}-\d{2}$/.test(periodKey || "")) {
    throw new Error("Ingresá el período al que corresponde la deuda.");
  }
  if (type === "debit" && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate || "")) {
    throw new Error("Ingresá el vencimiento del saldo deudor.");
  }

  const adjustmentRef = doc(agencyCollection(inmobiliariaId, "adjustments"));
  const unitRef = agencyDoc(inmobiliariaId, "units", unitId);
  const periodId = type === "debit" ? `opening_${consortiumId}_${periodKey}` : "";
  const periodRef = periodId ? agencyDoc(inmobiliariaId, "periods", periodId) : null;
  const obligationId = periodId ? `${periodId}_${unitId}` : "";
  const obligationRef = obligationId
    ? agencyDoc(inmobiliariaId, "obligations", obligationId)
    : null;

  await runTransaction(db, async (transaction) => {
    const unitSnapshot = await transaction.get(unitRef);
    if (!unitSnapshot.exists()) throw new Error("La unidad no existe.");
    const unit = unitSnapshot.data();
    if (unit.consortiumId !== consortiumId || unit.deleted === true) {
      throw new Error("La unidad no pertenece al consorcio activo.");
    }
    const auditUnit = getUnitAuditSnapshot(unit);

    if (type === "credit") {
      const previousCreditMinor = Math.max(0, Number(unit.creditBalanceMinor) || 0);
      const nextCreditMinor = previousCreditMinor + amount;
      transaction.update(unitRef, {
        creditBalanceMinor: nextCreditMinor,
        updatedBy: user.uid,
        updatedAt: serverTimestamp(),
      });
      transaction.set(adjustmentRef, {
        id: adjustmentRef.id,
        schemaVersion: 1,
        type: "opening_credit",
        direction: "credit",
        consortiumId,
        unitId,
        unitSnapshot: auditUnit,
        obligationId: "",
        periodId: "",
        periodKey: effectiveDate.slice(0, 7),
        currency: unit.consortiumCurrency || "ARS",
        amountMinor: amount,
        effectiveDate,
        dueDate: "",
        reason: normalizedReason,
        previousCreditMinor,
        nextCreditMinor,
        inmobiliariaId,
        ownerInmobiliariaId: inmobiliariaId,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
      });
      return;
    }

    const [periodSnapshot, obligationSnapshot] = await Promise.all([
      transaction.get(periodRef),
      transaction.get(obligationRef),
    ]);
    const period = periodSnapshot.exists() ? periodSnapshot.data() : null;
    if (period && (period.consortiumId !== consortiumId || period.source !== "opening_balance")) {
      throw new Error("El período reservado para saldos iniciales contiene datos incompatibles.");
    }
    const obligation = obligationSnapshot.exists() ? obligationSnapshot.data() : null;
    const previousTotalMinor = Math.max(0, Number(obligation?.totalAmountMinor) || 0);
    const previousBalanceMinor = Math.max(0, Number(obligation?.balanceMinor) || 0);
    const nextTotalMinor = previousTotalMinor + amount;
    const paidAmountMinor = Math.max(0, Number(obligation?.paidAmountMinor) || 0);
    const nextBalanceMinor = Math.max(0, nextTotalMinor - paidAmountMinor);
    const expenseLine = {
      id: adjustmentRef.id,
      concept: `Saldo inicial: ${normalizedReason}`,
      category: "ordinary",
      distributionMode: "specific",
      specificUnitId: unitId,
      amountMinor: amount,
      notes: `Fecha de origen: ${effectiveDate}`,
    };
    const breakdownLine = {
      expenseId: adjustmentRef.id,
      concept: expenseLine.concept,
      category: "ordinary",
      distributionMode: "specific",
      amountMinor: amount,
      source: "opening_balance",
    };

    if (period) {
      transaction.update(periodRef, {
        status: "issued",
        expenses: [...(Array.isArray(period.expenses) ? period.expenses : []), expenseLine],
        totalExpensesMinor: Math.max(0, Number(period.totalExpensesMinor) || 0) + amount,
        issuedUnitCount: Math.max(0, Number(period.issuedUnitCount) || 0) + (obligation ? 0 : 1),
        updatedAt: serverTimestamp(),
        updatedBy: user.uid,
      });
    } else {
      transaction.set(periodRef, {
        id: periodId,
        schemaVersion: 1,
        consortiumId,
        periodKey,
        dueDate,
        currency: unit.consortiumCurrency || "ARS",
        status: "issued",
        source: "opening_balance",
        expenses: [expenseLine],
        totalExpensesMinor: amount,
        issuedUnitCount: 1,
        deleted: false,
        inmobiliariaId,
        ownerInmobiliariaId: inmobiliariaId,
        createdBy: user.uid,
        updatedBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        issuedAt: serverTimestamp(),
        issuedBy: user.uid,
      });
    }

    if (obligation) {
      transaction.update(obligationRef, {
        ordinaryMinor: Math.max(0, Number(obligation.ordinaryMinor) || 0) + amount,
        totalAmountMinor: nextTotalMinor,
        balanceMinor: nextBalanceMinor,
        status: getConsortiumObligationStatus({ ...obligation, balanceMinor: nextBalanceMinor }),
        breakdown: [...(Array.isArray(obligation.breakdown) ? obligation.breakdown : []), breakdownLine],
        adjustmentIds: [...(Array.isArray(obligation.adjustmentIds) ? obligation.adjustmentIds : []), adjustmentRef.id],
        updatedBy: user.uid,
        updatedAt: serverTimestamp(),
      });
    } else {
      transaction.set(obligationRef, {
        id: obligationId,
        schemaVersion: 1,
        source: "opening_balance",
        unitId,
        unitSnapshot: auditUnit,
        ordinaryMinor: amount,
        extraordinaryMinor: 0,
        totalAmountMinor: amount,
        paidAmountMinor: 0,
        balanceMinor: amount,
        status: getConsortiumObligationStatus({ balanceMinor: amount, dueDate }),
        breakdown: [breakdownLine],
        paymentIds: [],
        adjustmentIds: [adjustmentRef.id],
        consortiumId,
        periodId,
        periodKey,
        dueDate,
        currency: unit.consortiumCurrency || "ARS",
        inmobiliariaId,
        ownerInmobiliariaId: inmobiliariaId,
        createdBy: user.uid,
        updatedBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    transaction.set(adjustmentRef, {
      id: adjustmentRef.id,
      schemaVersion: 1,
      type: "opening_debit",
      direction: "debit",
      category: "ordinary",
      consortiumId,
      unitId,
      unitSnapshot: auditUnit,
      obligationId,
      periodId,
      periodKey,
      currency: unit.consortiumCurrency || "ARS",
      amountMinor: amount,
      effectiveDate,
      dueDate,
      reason: normalizedReason,
      previousTotalMinor,
      nextTotalMinor,
      previousBalanceMinor,
      nextBalanceMinor,
      inmobiliariaId,
      ownerInmobiliariaId: inmobiliariaId,
      createdBy: user.uid,
      createdAt: serverTimestamp(),
    });
  });
  return { adjustmentId: adjustmentRef.id, periodId, obligationId };
};

export const adjustConsortiumObligation = async ({
  inmobiliariaId,
  obligationId,
  type,
  category = "ordinary",
  amountMinor,
  effectiveDate,
  reason,
}) => {
  await assertAgency(inmobiliariaId);
  const user = currentUserOrThrow();
  const amount = Math.max(0, Math.round(Number(amountMinor) || 0));
  const normalizedReason = cleanText(reason, 1000);
  if (!["debit", "credit"].includes(type)) throw new Error("Seleccioná débito o crédito.");
  if (!["ordinary", "extraordinary"].includes(category)) throw new Error("Seleccioná el tipo de expensa.");
  if (!amount) throw new Error("Ingresá un importe mayor a cero.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate || "")) throw new Error("Ingresá la fecha del ajuste.");
  if (!normalizedReason) throw new Error("Ingresá el motivo del ajuste.");

  const adjustmentRef = doc(agencyCollection(inmobiliariaId, "adjustments"));
  const obligationRef = agencyDoc(inmobiliariaId, "obligations", obligationId);
  await runTransaction(db, async (transaction) => {
    const obligationSnapshot = await transaction.get(obligationRef);
    if (!obligationSnapshot.exists()) throw new Error("La expensa no existe.");
    const obligation = obligationSnapshot.data();
    const periodRef = agencyDoc(inmobiliariaId, "periods", obligation.periodId);
    const periodSnapshot = await transaction.get(periodRef);
    if (!periodSnapshot.exists() || periodSnapshot.data().status === "draft") {
      throw new Error("Solo se pueden ajustar liquidaciones emitidas.");
    }
    const period = periodSnapshot.data();
    const categoryField = category === "extraordinary" ? "extraordinaryMinor" : "ordinaryMinor";
    const categoryAmountMinor = Math.max(0, Number(obligation[categoryField]) || 0);
    const previousTotalMinor = Math.max(0, Number(obligation.totalAmountMinor) || 0);
    const previousBalanceMinor = Math.max(0, Number(obligation.balanceMinor) || 0);
    const paidAmountMinor = Math.max(0, Number(obligation.paidAmountMinor) || 0);
    if (type === "credit" && amount > previousBalanceMinor) {
      throw new Error("La nota de crédito no puede superar el saldo pendiente. Registrá el excedente como saldo inicial a favor.");
    }
    if (type === "credit" && amount > categoryAmountMinor) {
      throw new Error("La nota de crédito supera el importe disponible en el tipo de expensa seleccionado.");
    }
    const signedAmount = type === "debit" ? amount : -amount;
    const nextCategoryMinor = categoryAmountMinor + signedAmount;
    const nextTotalMinor = previousTotalMinor + signedAmount;
    const nextBalanceMinor = Math.max(0, nextTotalMinor - paidAmountMinor);
    const nextStatus = getConsortiumObligationStatus({
      ...obligation,
      balanceMinor: nextBalanceMinor,
      paidAmountMinor,
    });
    const obligationUpdate = {
      [categoryField]: nextCategoryMinor,
      totalAmountMinor: nextTotalMinor,
      balanceMinor: nextBalanceMinor,
      status: nextStatus,
      breakdown: [...(Array.isArray(obligation.breakdown) ? obligation.breakdown : []), {
        expenseId: adjustmentRef.id,
        concept: `${type === "debit" ? "Nota de débito" : "Nota de crédito"}: ${normalizedReason}`,
        category,
        distributionMode: "specific",
        amountMinor: signedAmount,
        source: "rectification",
      }],
      adjustmentIds: [...(Array.isArray(obligation.adjustmentIds) ? obligation.adjustmentIds : []), adjustmentRef.id],
      updatedBy: user.uid,
      updatedAt: serverTimestamp(),
    };
    if (!Number.isFinite(Number(obligation.originalTotalAmountMinor))) {
      obligationUpdate.originalTotalAmountMinor = previousTotalMinor;
      obligationUpdate.originalOrdinaryMinor = Math.max(0, Number(obligation.ordinaryMinor) || 0);
      obligationUpdate.originalExtraordinaryMinor = Math.max(0, Number(obligation.extraordinaryMinor) || 0);
      obligationUpdate.originalBreakdown = Array.isArray(obligation.breakdown) ? obligation.breakdown : [];
    }
    transaction.update(obligationRef, obligationUpdate);
    const previousAdjustmentNetMinor = Number(period.adjustmentNetMinor) || 0;
    const adjustmentNetMinor = previousAdjustmentNetMinor + signedAmount;
    const periodUpdate = {
      status: type === "debit" && period.status === "closed" ? "issued" : period.status,
      adjustmentNetMinor,
      adjustedTotalExpensesMinor: Math.max(0, Number(period.totalExpensesMinor) || 0) + adjustmentNetMinor,
      updatedBy: user.uid,
      updatedAt: serverTimestamp(),
    };
    if (type === "debit" && period.status === "closed") {
      periodUpdate.reopenedAt = serverTimestamp();
      periodUpdate.reopenedBy = user.uid;
      periodUpdate.reopenReason = normalizedReason;
    }
    transaction.update(periodRef, periodUpdate);
    transaction.set(adjustmentRef, {
      id: adjustmentRef.id,
      schemaVersion: 1,
      type: type === "debit" ? "rectification_debit" : "rectification_credit",
      direction: type,
      category,
      consortiumId: obligation.consortiumId,
      unitId: obligation.unitId,
      unitSnapshot: obligation.unitSnapshot || {},
      obligationId,
      periodId: obligation.periodId,
      periodKey: obligation.periodKey,
      source: obligation.source || "monthly_assessment",
      currency: obligation.currency || "ARS",
      amountMinor: amount,
      effectiveDate,
      dueDate: obligation.dueDate || "",
      reason: normalizedReason,
      previousTotalMinor,
      nextTotalMinor,
      previousBalanceMinor,
      nextBalanceMinor,
      inmobiliariaId,
      ownerInmobiliariaId: inmobiliariaId,
      createdBy: user.uid,
      createdAt: serverTimestamp(),
    });
  });
  return adjustmentRef.id;
};

export const getConsortiumPayments = async (
  inmobiliariaId,
  { consortiumId = "", obligationId = "", unitId = "", includeVoided = false } = {},
) => {
  if (!inmobiliariaId) return [];
  const snap = await getDocs(agencyCollection(inmobiliariaId, "payments"));
  return snap.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .filter((item) => includeVoided || item.voided !== true)
    .filter((item) => !consortiumId || item.consortiumId === consortiumId)
    .filter((item) => !obligationId || item.obligationId === obligationId)
    .filter((item) => !unitId || item.unitId === unitId)
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
};

export const getConsortiumPaymentById = async (inmobiliariaId, paymentId) => {
  if (!inmobiliariaId || !paymentId) return null;
  const snap = await getDoc(agencyDoc(inmobiliariaId, "payments", paymentId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

export const registerConsortiumAccountPayment = async ({
  inmobiliariaId,
  consortiumId,
  unitId,
  amountMinor,
  obligationIds = [],
  date,
  method,
  reference = "",
  notes = "",
  treasuryAccountId = "",
}) => {
  await assertAgency(inmobiliariaId);
  const user = currentUserOrThrow();
  const amount = Math.max(0, Math.round(Number(amountMinor) || 0));
  if (!amount) throw new Error("Ingresá un importe mayor a cero.");
  if (!hasValidDateKey(date)) throw new Error("Ingresá la fecha del cobro.");
  const requestedIds = [...new Set(
    (Array.isArray(obligationIds) ? obligationIds : []).map((item) => cleanText(item, 128)),
  )].filter(Boolean);
  const knownObligations = await getConsortiumObligations(inmobiliariaId, {
    consortiumId,
    unitId,
  });
  if (knownObligations.length > 200) {
    throw new Error("La cuenta tiene demasiados períodos para imputar en una sola operación.");
  }
  const obligationRefs = knownObligations.map((item) => (
    agencyDoc(inmobiliariaId, "obligations", item.id)
  ));
  const unitRef = agencyDoc(inmobiliariaId, "units", unitId);
  const treasuryAccountRef = treasuryAccountId
    ? agencyDoc(inmobiliariaId, "treasuryAccounts", treasuryAccountId)
    : null;
  const paymentRef = doc(agencyCollection(inmobiliariaId, "payments"));
  const movementRef = treasuryAccountId
    ? doc(agencyCollection(inmobiliariaId, "treasuryMovements"))
    : null;

  await runTransaction(db, async (transaction) => {
    const snapshots = await Promise.all([
      transaction.get(unitRef),
      ...obligationRefs.map((ref) => transaction.get(ref)),
      ...(treasuryAccountRef ? [transaction.get(treasuryAccountRef)] : []),
    ]);
    const unitSnap = snapshots[0];
    if (!unitSnap.exists() || unitSnap.data()?.deleted === true ||
      unitSnap.data()?.consortiumId !== consortiumId) {
      throw new Error("La unidad no pertenece al consorcio.");
    }
    const unit = unitSnap.data() || {};
    const freshObligations = snapshots.slice(1, 1 + obligationRefs.length)
      .map((snap) => ({ id: snap.id, ...(snap.data() || {}) }))
      .filter((item) => item.consortiumId === consortiumId && item.unitId === unitId);
    const openObligations = freshObligations.filter((item) => (
      item.voided !== true && Number(item.balanceMinor || 0) > 0
    ));
    const openIds = new Set(openObligations.map((item) => item.id));
    if (requestedIds.some((id) => !openIds.has(id))) {
      throw new Error("Una de las expensas seleccionadas ya no tiene saldo disponible.");
    }
    const currency = openObligations[0]?.currency || unit.currency || "ARS";
    if (openObligations.some((item) => (item.currency || "ARS") !== currency)) {
      throw new Error("No se pueden imputar en un mismo cobro obligaciones de monedas distintas.");
    }
    const allocation = buildConsortiumPaymentAllocations({
      amountMinor: amount,
      obligations: openObligations,
      obligationIds: requestedIds,
    });
    if (allocation.creditAmountMinor > 0 && requestedIds.length &&
      allocation.allocations.length < openObligations.length) {
      throw new Error("Para registrar un excedente como saldo a favor, seleccioná todos los períodos pendientes.");
    }
    let treasuryAccount = null;
    if (treasuryAccountRef) {
      const accountSnap = snapshots.at(-1);
      if (!accountSnap?.exists() || accountSnap.data()?.active === false) {
        throw new Error("La cuenta de tesorería no está disponible.");
      }
      treasuryAccount = accountSnap.data();
      if (treasuryAccount.consortiumId !== consortiumId) {
        throw new Error("La cuenta pertenece a otro consorcio.");
      }
      if ((treasuryAccount.currency || "ARS") !== currency) {
        throw new Error("La moneda de la cuenta no coincide con el cobro.");
      }
    }
    const allocationById = new Map(
      allocation.allocations.map((item) => [item.obligationId, item]),
    );
    freshObligations.forEach((obligation) => {
      const item = allocationById.get(obligation.id);
      if (!item) return;
      const paidAmountMinor = Math.max(0, Number(obligation.paidAmountMinor) || 0)
        + item.amountMinor;
      const balanceMinor = Math.max(0, Number(obligation.totalAmountMinor || 0) - paidAmountMinor);
      transaction.update(agencyDoc(inmobiliariaId, "obligations", obligation.id), {
        paidAmountMinor,
        balanceMinor,
        status: balanceMinor <= 0 ? "paid" : getConsortiumObligationStatus({
          ...obligation,
          paidAmountMinor,
          balanceMinor,
        }),
        paymentIds: [
          ...(Array.isArray(obligation.paymentIds) ? obligation.paymentIds : []),
          paymentRef.id,
        ],
        updatedBy: user.uid,
        updatedAt: serverTimestamp(),
      });
    });
    if (allocation.creditAmountMinor > 0) {
      transaction.update(unitRef, {
        creditBalanceMinor: Math.max(0, Number(unit.creditBalanceMinor) || 0)
          + allocation.creditAmountMinor,
        updatedBy: user.uid,
        updatedAt: serverTimestamp(),
      });
    }
    const primaryAllocation = allocation.allocations[0] || {};
    const periodKeys = [...new Set(allocation.allocations.map((item) => item.periodKey).filter(Boolean))];
    transaction.set(paymentRef, {
      id: paymentRef.id,
      schemaVersion: 2,
      obligationId: primaryAllocation.obligationId || "",
      consortiumId,
      periodId: primaryAllocation.periodId || "",
      periodKey: primaryAllocation.periodKey || "",
      periodKeys,
      source: allocation.allocations.length === 1 && !allocation.creditAmountMinor
        ? primaryAllocation.source : "account_payment",
      allocationMode: requestedIds.length ? "selected" : "oldest_due",
      allocations: allocation.allocations,
      appliedAmountMinor: allocation.appliedAmountMinor,
      creditAmountMinor: allocation.creditAmountMinor,
      unitId,
      unitSnapshot: {
        code: cleanText(unit.code, 80),
        ownerName: cleanText(unit.ownerName, 220),
        occupantName: cleanText(unit.occupantName, 220),
      },
      currency,
      amountMinor: amount,
      date,
      method: cleanText(method, 40) || "transfer",
      reference: cleanText(reference, 220),
      notes: cleanText(notes, 1000),
      treasuryAccountId: treasuryAccountId || "",
      treasuryMovementId: movementRef?.id || "",
      voided: false,
      inmobiliariaId,
      ownerInmobiliariaId: inmobiliariaId,
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    if (treasuryAccount && treasuryAccountRef && movementRef) {
      transaction.set(movementRef, {
        id: movementRef.id,
        schemaVersion: 1,
        inmobiliariaId,
        ownerInmobiliariaId: inmobiliariaId,
        consortiumId,
        accountId: treasuryAccountId,
        accountSnapshot: {
          name: treasuryAccount.name || "",
          type: treasuryAccount.type || "bank",
        },
        source: "consortium_collection",
        sourceId: paymentRef.id,
        direction: "inflow",
        amountMinor: amount,
        currency,
        date,
        concept: `Cobro de expensas · Unidad ${unit.code || unitId}`,
        reference: cleanText(reference, 220),
        voided: false,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
      });
      transaction.update(treasuryAccountRef, {
        currentBalanceMinor: Math.max(0, Number(treasuryAccount.currentBalanceMinor) || 0) + amount,
        updatedBy: user.uid,
        updatedAt: serverTimestamp(),
      });
    }
  });
  return paymentRef.id;
};

export const registerConsortiumPayment = async ({
  inmobiliariaId,
  obligationId,
  amountMinor,
  date,
  method,
  reference = "",
  notes = "",
  treasuryAccountId = "",
}) => {
  await assertAgency(inmobiliariaId);
  const user = currentUserOrThrow();
  const amount = Math.max(0, Math.round(Number(amountMinor) || 0));
  if (!amount) throw new Error("Ingresá un importe mayor a cero.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) throw new Error("Ingresá la fecha del cobro.");
  const obligationRef = agencyDoc(inmobiliariaId, "obligations", obligationId);
  const paymentRef = doc(agencyCollection(inmobiliariaId, "payments"));
  const movementRef = treasuryAccountId
    ? doc(agencyCollection(inmobiliariaId, "treasuryMovements"))
    : null;
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(obligationRef);
    if (!snap.exists()) throw new Error("La expensa no existe.");
    const obligation = snap.data();
    const balance = Math.max(0, Number(obligation.balanceMinor) || 0);
    if (amount > balance) throw new Error("El cobro no puede superar el saldo de la unidad.");
    const paidAmountMinor = Math.max(0, Number(obligation.paidAmountMinor) || 0) + amount;
    const balanceMinor = Math.max(0, Number(obligation.totalAmountMinor) - paidAmountMinor);
    let treasuryAccount = null;
    let treasuryAccountRef = null;
    if (treasuryAccountId) {
      treasuryAccountRef = agencyDoc(inmobiliariaId, "treasuryAccounts", treasuryAccountId);
      const accountSnap = await transaction.get(treasuryAccountRef);
      if (!accountSnap.exists() || accountSnap.data().active === false) {
        throw new Error("La cuenta de tesorería no está disponible.");
      }
      treasuryAccount = accountSnap.data();
      if (treasuryAccount.consortiumId !== obligation.consortiumId) {
        throw new Error("La cuenta pertenece a otro consorcio.");
      }
      if ((treasuryAccount.currency || "ARS") !== (obligation.currency || "ARS")) {
        throw new Error("La moneda de la cuenta no coincide con el cobro.");
      }
    }
    const payment = {
      id: paymentRef.id,
      obligationId,
      consortiumId: obligation.consortiumId,
      periodId: obligation.periodId,
      periodKey: obligation.periodKey,
      source: obligation.source || "monthly_assessment",
      unitId: obligation.unitId,
      unitSnapshot: obligation.unitSnapshot || {},
      currency: obligation.currency || "ARS",
      amountMinor: amount,
      date,
      method: cleanText(method, 40) || "transfer",
      reference: cleanText(reference, 220),
      notes: cleanText(notes, 1000),
      treasuryAccountId: treasuryAccountId || "",
      treasuryMovementId: movementRef?.id || "",
      voided: false,
      inmobiliariaId,
      ownerInmobiliariaId: inmobiliariaId,
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    transaction.set(paymentRef, payment);
    if (treasuryAccount && treasuryAccountRef && movementRef) {
      const accountSnapshot = {
        name: treasuryAccount.name || "",
        type: treasuryAccount.type || "bank",
      };
      transaction.set(movementRef, {
        id: movementRef.id,
        schemaVersion: 1,
        inmobiliariaId,
        ownerInmobiliariaId: inmobiliariaId,
        consortiumId: obligation.consortiumId,
        accountId: treasuryAccountId,
        accountSnapshot,
        source: "consortium_collection",
        sourceId: paymentRef.id,
        direction: "inflow",
        amountMinor: amount,
        currency: obligation.currency || "ARS",
        date,
        concept: `Cobro de expensas · Unidad ${obligation.unitSnapshot?.code || obligation.unitId}`,
        reference: cleanText(reference, 220),
        voided: false,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
      });
      transaction.update(treasuryAccountRef, {
        currentBalanceMinor: Math.max(0, Number(treasuryAccount.currentBalanceMinor) || 0) + amount,
        updatedBy: user.uid,
        updatedAt: serverTimestamp(),
      });
    }
    transaction.update(obligationRef, {
      paidAmountMinor,
      balanceMinor,
      status: balanceMinor <= 0 ? "paid" : getConsortiumObligationStatus({
        ...obligation,
        paidAmountMinor,
        balanceMinor,
      }),
      paymentIds: [...(Array.isArray(obligation.paymentIds) ? obligation.paymentIds : []), paymentRef.id],
      updatedBy: user.uid,
      updatedAt: serverTimestamp(),
    });
  });
  return paymentRef.id;
};

export const voidConsortiumPayment = async ({ inmobiliariaId, paymentId, reason }) => {
  await assertAgency(inmobiliariaId);
  const user = currentUserOrThrow();
  const voidReason = cleanText(reason, 500);
  if (!voidReason) throw new Error("Ingresá el motivo de la anulación.");
  const paymentRef = agencyDoc(inmobiliariaId, "payments", paymentId);
  const reversalRef = doc(agencyCollection(inmobiliariaId, "treasuryMovements"));
  await runTransaction(db, async (transaction) => {
    const paymentSnap = await transaction.get(paymentRef);
    if (!paymentSnap.exists()) throw new Error("El cobro no existe.");
    const payment = paymentSnap.data();
    if (payment.voided === true) throw new Error("El cobro ya está anulado.");
    const allocations = Array.isArray(payment.allocations) && payment.allocations.length
      ? payment.allocations
      : payment.obligationId
        ? [{ obligationId: payment.obligationId, amountMinor: payment.amountMinor }]
        : [];
    const obligationRefs = allocations.map((item) => (
      agencyDoc(inmobiliariaId, "obligations", item.obligationId)
    ));
    const unitRef = Number(payment.creditAmountMinor || 0) > 0
      ? agencyDoc(inmobiliariaId, "units", payment.unitId)
      : null;
    const treasuryAccountRef = payment.treasuryAccountId
      ? agencyDoc(inmobiliariaId, "treasuryAccounts", payment.treasuryAccountId)
      : null;
    const relatedSnapshots = await Promise.all([
      ...obligationRefs.map((ref) => transaction.get(ref)),
      ...(unitRef ? [transaction.get(unitRef)] : []),
      ...(treasuryAccountRef ? [transaction.get(treasuryAccountRef)] : []),
    ]);
    const obligationSnapshots = relatedSnapshots.slice(0, obligationRefs.length);
    if (obligationSnapshots.some((snap) => !snap.exists())) {
      throw new Error("Una expensa relacionada con el cobro ya no existe.");
    }
    const unitSnapshotIndex = obligationRefs.length;
    const unitSnap = unitRef ? relatedSnapshots[unitSnapshotIndex] : null;
    const treasurySnapshotIndex = obligationRefs.length + (unitRef ? 1 : 0);
    const treasurySnap = treasuryAccountRef
      ? relatedSnapshots[treasurySnapshotIndex]
      : null;
    if (unitRef && (!unitSnap?.exists() ||
      Number(unitSnap.data()?.creditBalanceMinor || 0) < Number(payment.creditAmountMinor || 0))) {
      throw new Error("El saldo a favor generado por este cobro ya fue utilizado y no puede anularse.");
    }
    const treasuryAccount = treasurySnap?.exists() ? treasurySnap.data() : null;
    if (treasuryAccountRef && !treasuryAccount) {
      throw new Error("La cuenta de tesorería asociada no existe.");
    }
    if (treasuryAccount &&
      Number(treasuryAccount.currentBalanceMinor || 0) < Number(payment.amountMinor || 0)) {
      throw new Error("La cuenta no tiene saldo suficiente para revertir este cobro.");
    }
    transaction.update(paymentRef, {
      voided: true,
      voidReason,
      voidedAt: serverTimestamp(),
      voidedBy: user.uid,
      treasuryReversalMovementId: treasuryAccount ? reversalRef.id : "",
      updatedAt: serverTimestamp(),
    });
    obligationSnapshots.forEach((snap, index) => {
      const obligation = snap.data();
      const allocatedMinor = Math.max(0, Number(allocations[index]?.amountMinor) || 0);
      const paidAmountMinor = Math.max(
        0,
        Number(obligation.paidAmountMinor || 0) - allocatedMinor,
      );
      const balanceMinor = Math.max(
        0,
        Number(obligation.totalAmountMinor || 0) - paidAmountMinor,
      );
      transaction.update(obligationRefs[index], {
        paidAmountMinor,
        balanceMinor,
        status: getConsortiumObligationStatus({
          ...obligation,
          paidAmountMinor,
          balanceMinor,
        }),
        updatedBy: user.uid,
        updatedAt: serverTimestamp(),
      });
    });
    if (unitRef && unitSnap) {
      transaction.update(unitRef, {
        creditBalanceMinor: Math.max(
          0,
          Number(unitSnap.data()?.creditBalanceMinor || 0)
            - Number(payment.creditAmountMinor || 0),
        ),
        updatedBy: user.uid,
        updatedAt: serverTimestamp(),
      });
    }
    if (treasuryAccount && treasuryAccountRef) {
      transaction.set(reversalRef, {
        id: reversalRef.id,
        schemaVersion: 1,
        inmobiliariaId,
        ownerInmobiliariaId: inmobiliariaId,
        consortiumId: payment.consortiumId,
        accountId: payment.treasuryAccountId,
        accountSnapshot: {
          name: treasuryAccount.name || "",
          type: treasuryAccount.type || "bank",
        },
        source: "consortium_collection_reversal",
        sourceId: paymentId,
        reversesMovementId: payment.treasuryMovementId || "",
        direction: "outflow",
        amountMinor: Number(payment.amountMinor || 0),
        currency: payment.currency || "ARS",
        date: new Date().toISOString().slice(0, 10),
        concept: `Anulación de cobro · Unidad ${payment.unitSnapshot?.code || payment.unitId}`,
        reference: voidReason,
        voided: false,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
      });
      transaction.update(treasuryAccountRef, {
        currentBalanceMinor: Number(treasuryAccount.currentBalanceMinor || 0)
          - Number(payment.amountMinor || 0),
        updatedBy: user.uid,
        updatedAt: serverTimestamp(),
      });
    }
  });
};

export const getConsortiumMonthlyCloseChecklist = async ({
  inmobiliariaId,
  consortiumId,
  periodId,
}) => {
  await assertAgency(inmobiliariaId);
  const period = await getConsortiumPeriodById(inmobiliariaId, periodId);
  if (!period || period.consortiumId !== consortiumId) {
    throw new Error("La liquidación no existe o pertenece a otro consorcio.");
  }
  const [
    units,
    obligations,
    expenseDocuments,
    paymentReports,
    treasuryAccounts,
    treasuryReconciliations,
    supplierObligations,
    financialClosures,
  ] = await Promise.all([
    getConsortiumUnits(inmobiliariaId, consortiumId),
    getConsortiumObligations(inmobiliariaId, { periodId }),
    getConsortiumExpenseDocuments(inmobiliariaId, { periodId }),
    getConsortiumPaymentReports(inmobiliariaId, { consortiumId }),
    getConsortiumTreasuryAccounts(inmobiliariaId, consortiumId),
    getConsortiumTreasuryReconciliations(inmobiliariaId, consortiumId),
    getConsortiumSupplierObligations(inmobiliariaId, {
      consortiumId,
      includeVoided: true,
    }),
    getConsortiumFinancialClosures(inmobiliariaId, { consortiumId, periodId }),
  ]);
  return buildConsortiumMonthlyCloseChecklist({
    period,
    units,
    obligations,
    expenseDocuments,
    paymentReports,
    treasuryAccounts,
    treasuryReconciliations,
    supplierObligations,
    financialClosures,
  });
};

export const closeConsortiumPeriod = async ({
  inmobiliariaId,
  consortiumId,
  periodId,
  acknowledgeWarnings = false,
  reviewedWarningSignatures = [],
  note = "",
}) => {
  await assertAgency(inmobiliariaId);
  const user = currentUserOrThrow();
  const checklist = await getConsortiumMonthlyCloseChecklist({
    inmobiliariaId,
    consortiumId,
    periodId,
  });
  if (checklist.periodStatus === "closed") throw new Error("El período ya está cerrado.");
  if (checklist.blockers.length) {
    throw new Error(`Resolvé antes del cierre: ${checklist.blockers.map((item) => item.title).join("; ")}.`);
  }
  const reviewedWarningSignatureSet = new Set(
    (Array.isArray(reviewedWarningSignatures) ? reviewedWarningSignatures : [])
      .map((item) => cleanText(item, 180))
      .filter(Boolean),
  );
  const unseenWarnings = checklist.warnings.filter(
    (item) => !reviewedWarningSignatureSet.has(
      `${item.code}:${item.count}:${item.amountMinor}`,
    ),
  );
  if (checklist.warnings.length && acknowledgeWarnings !== true) {
    throw new Error("Revisá y aceptá las advertencias antes de confirmar el cierre.");
  }
  if (unseenWarnings.length) {
    throw new Error("Los datos cambiaron desde la última revisión. Actualizá el control antes de cerrar.");
  }
  await updateDoc(agencyDoc(inmobiliariaId, "periods", periodId), {
    status: "closed",
    closedAt: serverTimestamp(),
    closedBy: user.uid,
    closedByEmail: cleanText(user.email || "", 220).toLowerCase(),
    closeReview: {
      schemaVersion: checklist.schemaVersion,
      periodKey: checklist.periodKey,
      summary: checklist.summary,
      warningCodes: checklist.warnings.map((item) => item.code),
      items: checklist.items.map((item) => ({
        code: item.code,
        status: item.status,
        title: item.title,
        detail: item.detail,
        count: item.count,
        amountMinor: item.amountMinor,
      })),
      note: cleanText(note, 2000),
      acknowledgedWarnings: checklist.warnings.length > 0,
      checkedAt: serverTimestamp(),
      checkedBy: user.uid,
    },
    updatedAt: serverTimestamp(),
    updatedBy: user.uid,
  });
  return checklist;
};

const validateConsortiumFileOrThrow = (file) => {
  if (!isConsortiumDocumentFileValid(file)) {
    throw new Error("Adjuntá un PDF, JPG, PNG o WEBP de hasta 10 MB.");
  }
};

const uploadPrivateFile = async ({ file, path, metadata = {} }) => {
  validateConsortiumFileOrThrow(file);
  const targetRef = storageRef(storage, path);
  await uploadBytes(targetRef, file, {
    contentType: file.type,
    customMetadata: metadata,
  });
  return path;
};

export const downloadPrivateConsortiumDocument = async ({ path, fileName }) => {
  if (!path) throw new Error("El archivo no está disponible.");
  const blob = await getBlob(storageRef(storage, path));
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = safeConsortiumFileName(fileName || "comprobante");
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  globalThis.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const getConsortiumPenalties = async (
  inmobiliariaId,
  { consortiumId = "", unitId = "", portalOnly = false } = {},
) => {
  if (!inmobiliariaId) return [];
  const source = unitId && portalOnly
    ? query(
      agencyCollection(inmobiliariaId, "penalties"),
      where("unitId", "==", unitId),
      where("portalVisible", "==", true),
    )
    : unitId
      ? query(agencyCollection(inmobiliariaId, "penalties"), where("unitId", "==", unitId))
    : agencyCollection(inmobiliariaId, "penalties");
  const snap = await getDocs(source);
  return snap.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .filter((item) => !consortiumId || item.consortiumId === consortiumId)
    .sort((a, b) => (
      (b.resolutionDate || "").localeCompare(a.resolutionDate || "")
      || timestampMillis(b.createdAt) - timestampMillis(a.createdAt)
    ));
};

export const createConsortiumPenalty = async ({
  inmobiliariaId,
  consortiumId,
  value,
  file = null,
}) => {
  await assertAgency(inmobiliariaId);
  const user = currentUserOrThrow();
  const payload = sanitizePenalty(value);
  validatePenalty(payload);
  if (file) validateConsortiumFileOrThrow(file);
  const [unitSnapshot, consortiumSnapshot] = await Promise.all([
    getDoc(agencyDoc(inmobiliariaId, "units", payload.unitId)),
    getDoc(agencyDoc(inmobiliariaId, "consortiums", consortiumId)),
  ]);
  if (!unitSnapshot.exists() || unitSnapshot.data().consortiumId !== consortiumId) {
    throw new Error("La unidad no pertenece al consorcio activo.");
  }
  if (!consortiumSnapshot.exists()) throw new Error("El consorcio no existe.");
  const unit = unitSnapshot.data();
  const consortium = consortiumSnapshot.data();
  const penaltyRef = doc(agencyCollection(inmobiliariaId, "penalties"));
  const safeName = file ? safeConsortiumFileName(file.name) : "";
  const evidenceStoragePath = file
    ? `consorcios/${inmobiliariaId}/${consortiumId}/penalties/${payload.unitId}/${penaltyRef.id}/${safeName}`
    : "";
  if (file) {
    await uploadPrivateFile({
      file,
      path: evidenceStoragePath,
      metadata: {
        inmobiliariaId,
        consortiumId,
        unitId: payload.unitId,
        penaltyId: penaltyRef.id,
        uploadedBy: user.uid,
      },
    });
  }
  try {
    await setDoc(penaltyRef, {
      id: penaltyRef.id,
      schemaVersion: 1,
      ...payload,
      periodKey: payload.resolutionDate.slice(0, 7),
      currency: cleanText(consortium.currency, 10) || unit.consortiumCurrency || "ARS",
      consortiumId,
      unitSnapshot: getUnitAuditSnapshot(unit),
      status: "draft",
      portalVisible: false,
      statusHistory: [getPenaltyHistoryEntry("draft", user.uid, "Expediente creado")],
      notificationDate: "",
      notificationMethod: "",
      notificationRecipient: "",
      obligationId: "",
      periodId: "",
      adjustmentId: "",
      evidenceStoragePath,
      evidenceFileName: safeName,
      evidenceContentType: file?.type || "",
      evidenceSize: Number(file?.size || 0),
      inmobiliariaId,
      ownerInmobiliariaId: inmobiliariaId,
      createdBy: user.uid,
      updatedBy: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    if (evidenceStoragePath) {
      await deleteObject(storageRef(storage, evidenceStoragePath)).catch(() => {});
    }
    throw error;
  }
  return penaltyRef.id;
};

export const notifyConsortiumPenalty = async ({
  inmobiliariaId,
  penaltyId,
  notificationDate,
  notificationMethod,
  notificationRecipient,
}) => {
  await assertAgency(inmobiliariaId);
  const user = currentUserOrThrow();
  const date = cleanText(notificationDate, 10);
  const method = cleanText(notificationMethod, 120);
  const recipient = cleanText(notificationRecipient, 220);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Ingresá la fecha de notificación.");
  if (!method) throw new Error("Indicá el medio de notificación.");
  if (!recipient) throw new Error("Indicá la persona notificada.");
  const penaltyRef = agencyDoc(inmobiliariaId, "penalties", penaltyId);
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(penaltyRef);
    if (!snapshot.exists()) throw new Error("La multa no existe.");
    const penalty = snapshot.data();
    if (penalty.status !== "draft") throw new Error("Solo se puede notificar un expediente en borrador.");
    if (date < penalty.resolutionDate) throw new Error("La notificación no puede ser anterior a la resolución.");
    transaction.update(penaltyRef, {
      status: "notified",
      portalVisible: true,
      notificationDate: date,
      notificationMethod: method,
      notificationRecipient: recipient,
      statusHistory: [...(Array.isArray(penalty.statusHistory) ? penalty.statusHistory : []),
        getPenaltyHistoryEntry("notified", user.uid, `${method} a ${recipient}`)],
      notifiedAt: serverTimestamp(),
      notifiedBy: user.uid,
      updatedAt: serverTimestamp(),
      updatedBy: user.uid,
    });
  });
};

export const challengeConsortiumPenalty = async ({ inmobiliariaId, penaltyId, reason }) => {
  await assertAgency(inmobiliariaId);
  const user = currentUserOrThrow();
  const normalizedReason = cleanText(reason, 2000);
  if (!normalizedReason) throw new Error("Ingresá el motivo de la impugnación.");
  const penaltyRef = agencyDoc(inmobiliariaId, "penalties", penaltyId);
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(penaltyRef);
    if (!snapshot.exists()) throw new Error("La multa no existe.");
    const penalty = snapshot.data();
    if (!["notified", "confirmed"].includes(penalty.status)) {
      throw new Error("La multa no se encuentra en un estado impugnable.");
    }
    transaction.update(penaltyRef, {
      status: "challenged",
      statusBeforeChallenge: penalty.status,
      challengeReason: normalizedReason,
      challengedAt: serverTimestamp(),
      challengedBy: user.uid,
      statusHistory: [...(Array.isArray(penalty.statusHistory) ? penalty.statusHistory : []),
        getPenaltyHistoryEntry("challenged", user.uid, normalizedReason)],
      updatedAt: serverTimestamp(),
      updatedBy: user.uid,
    });
  });
};

export const ratifyConsortiumPenalty = async ({ inmobiliariaId, penaltyId, reason }) => {
  await assertAgency(inmobiliariaId);
  const user = currentUserOrThrow();
  const normalizedReason = cleanText(reason, 2000);
  if (!normalizedReason) throw new Error("Ingresá el fundamento de la ratificación.");
  const penaltyRef = agencyDoc(inmobiliariaId, "penalties", penaltyId);
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(penaltyRef);
    if (!snapshot.exists()) throw new Error("La multa no existe.");
    const penalty = snapshot.data();
    if (penalty.status !== "challenged") throw new Error("La multa no se encuentra impugnada.");
    const nextStatus = penalty.obligationId ? "confirmed" : "notified";
    transaction.update(penaltyRef, {
      status: nextStatus,
      ratificationReason: normalizedReason,
      ratifiedAt: serverTimestamp(),
      ratifiedBy: user.uid,
      statusHistory: [...(Array.isArray(penalty.statusHistory) ? penalty.statusHistory : []),
        getPenaltyHistoryEntry(nextStatus, user.uid, `Ratificada: ${normalizedReason}`)],
      updatedAt: serverTimestamp(),
      updatedBy: user.uid,
    });
  });
};

export const confirmConsortiumPenalty = async ({ inmobiliariaId, penaltyId }) => {
  await assertAgency(inmobiliariaId);
  const user = currentUserOrThrow();
  const penaltyRef = agencyDoc(inmobiliariaId, "penalties", penaltyId);
  const periodId = `penalty_${penaltyId}`;
  const periodRef = agencyDoc(inmobiliariaId, "periods", periodId);
  const adjustmentRef = doc(agencyCollection(inmobiliariaId, "adjustments"));
  let obligationId = "";
  await runTransaction(db, async (transaction) => {
    const penaltySnapshot = await transaction.get(penaltyRef);
    if (!penaltySnapshot.exists()) throw new Error("La multa no existe.");
    const penalty = penaltySnapshot.data();
    if (penalty.status !== "notified") {
      throw new Error("La multa debe estar notificada y sin impugnación pendiente antes de generar el débito.");
    }
    const unitRef = agencyDoc(inmobiliariaId, "units", penalty.unitId);
    obligationId = `${periodId}_${penalty.unitId}`;
    const obligationRef = agencyDoc(inmobiliariaId, "obligations", obligationId);
    const [unitSnapshot, periodSnapshot, obligationSnapshot] = await Promise.all([
      transaction.get(unitRef),
      transaction.get(periodRef),
      transaction.get(obligationRef),
    ]);
    if (!unitSnapshot.exists() || unitSnapshot.data().consortiumId !== penalty.consortiumId) {
      throw new Error("La unidad asociada ya no está disponible.");
    }
    if (periodSnapshot.exists() || obligationSnapshot.exists()) {
      throw new Error("La multa ya tiene un débito contable asociado.");
    }
    const amount = Math.max(0, Number(penalty.amountMinor) || 0);
    const unitAudit = getUnitAuditSnapshot(unitSnapshot.data());
    const expense = {
      id: penaltyId,
      concept: cleanText(`Multa: ${penalty.description}`, 220),
      category: "penalty",
      distributionMode: "specific",
      specificUnitId: penalty.unitId,
      amountMinor: amount,
      notes: penalty.ruleReference || "",
    };
    transaction.set(periodRef, {
      id: periodId,
      schemaVersion: 1,
      consortiumId: penalty.consortiumId,
      periodKey: penalty.periodKey,
      dueDate: penalty.dueDate,
      currency: penalty.currency || "ARS",
      status: "issued",
      source: "penalty",
      penaltyId,
      expenses: [expense],
      totalExpensesMinor: amount,
      issuedUnitCount: 1,
      deleted: false,
      inmobiliariaId,
      ownerInmobiliariaId: inmobiliariaId,
      createdBy: user.uid,
      updatedBy: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      issuedAt: serverTimestamp(),
      issuedBy: user.uid,
    });
    transaction.set(obligationRef, {
      id: obligationId,
      schemaVersion: 1,
      source: "penalty",
      penaltyId,
      unitId: penalty.unitId,
      unitSnapshot: unitAudit,
      ordinaryMinor: 0,
      extraordinaryMinor: 0,
      penaltyMinor: amount,
      totalAmountMinor: amount,
      paidAmountMinor: 0,
      balanceMinor: amount,
      status: getConsortiumObligationStatus({ balanceMinor: amount, dueDate: penalty.dueDate }),
      breakdown: [{
        expenseId: penaltyId,
        concept: expense.concept,
        category: "penalty",
        distributionMode: "specific",
        amountMinor: amount,
        source: "penalty",
      }],
      paymentIds: [],
      adjustmentIds: [adjustmentRef.id],
      consortiumId: penalty.consortiumId,
      periodId,
      periodKey: penalty.periodKey,
      dueDate: penalty.dueDate,
      currency: penalty.currency || "ARS",
      inmobiliariaId,
      ownerInmobiliariaId: inmobiliariaId,
      createdBy: user.uid,
      updatedBy: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    transaction.set(adjustmentRef, {
      id: adjustmentRef.id,
      schemaVersion: 1,
      type: "penalty_debit",
      direction: "debit",
      category: "penalty",
      penaltyId,
      consortiumId: penalty.consortiumId,
      unitId: penalty.unitId,
      unitSnapshot: unitAudit,
      obligationId,
      periodId,
      periodKey: penalty.periodKey,
      source: "penalty",
      currency: penalty.currency || "ARS",
      amountMinor: amount,
      effectiveDate: penalty.resolutionDate,
      dueDate: penalty.dueDate,
      reason: penalty.description,
      previousTotalMinor: 0,
      nextTotalMinor: amount,
      previousBalanceMinor: 0,
      nextBalanceMinor: amount,
      inmobiliariaId,
      ownerInmobiliariaId: inmobiliariaId,
      createdBy: user.uid,
      createdAt: serverTimestamp(),
    });
    transaction.update(penaltyRef, {
      status: "confirmed",
      periodId,
      obligationId,
      adjustmentId: adjustmentRef.id,
      confirmedAt: serverTimestamp(),
      confirmedBy: user.uid,
      statusHistory: [...(Array.isArray(penalty.statusHistory) ? penalty.statusHistory : []),
        getPenaltyHistoryEntry("confirmed", user.uid, "Débito contable generado")],
      updatedAt: serverTimestamp(),
      updatedBy: user.uid,
    });
  });
  return { periodId, obligationId, adjustmentId: adjustmentRef.id };
};

export const voidConsortiumPenalty = async ({ inmobiliariaId, penaltyId, reason }) => {
  await assertAgency(inmobiliariaId);
  const user = currentUserOrThrow();
  const normalizedReason = cleanText(reason, 2000);
  if (!normalizedReason) throw new Error("Ingresá el fundamento de la anulación.");
  const penaltyRef = agencyDoc(inmobiliariaId, "penalties", penaltyId);
  const adjustmentRef = doc(agencyCollection(inmobiliariaId, "adjustments"));
  await runTransaction(db, async (transaction) => {
    const penaltySnapshot = await transaction.get(penaltyRef);
    if (!penaltySnapshot.exists()) throw new Error("La multa no existe.");
    const penalty = penaltySnapshot.data();
    if (penalty.status === "voided") throw new Error("La multa ya está anulada.");
    if (!penalty.obligationId) {
      transaction.update(penaltyRef, {
        status: "voided",
        voidReason: normalizedReason,
        voidedAt: serverTimestamp(),
        voidedBy: user.uid,
        statusHistory: [...(Array.isArray(penalty.statusHistory) ? penalty.statusHistory : []),
          getPenaltyHistoryEntry("voided", user.uid, normalizedReason)],
        updatedAt: serverTimestamp(),
        updatedBy: user.uid,
      });
      return;
    }
    const obligationRef = agencyDoc(inmobiliariaId, "obligations", penalty.obligationId);
    const periodRef = agencyDoc(inmobiliariaId, "periods", penalty.periodId);
    const [obligationSnapshot, periodSnapshot] = await Promise.all([
      transaction.get(obligationRef),
      transaction.get(periodRef),
    ]);
    if (!obligationSnapshot.exists() || !periodSnapshot.exists()) {
      throw new Error("No se pudo reconstruir el débito de la multa.");
    }
    const obligation = obligationSnapshot.data();
    const amount = Math.max(0, Number(penalty.amountMinor) || 0);
    const previousBalanceMinor = Math.max(0, Number(obligation.balanceMinor) || 0);
    if (amount > previousBalanceMinor) {
      throw new Error("La multa tiene pagos aplicados. Primero revisá la cobranza y registrá el crédito correspondiente en la cuenta de la unidad.");
    }
    const previousTotalMinor = Math.max(0, Number(obligation.totalAmountMinor) || 0);
    const nextTotalMinor = Math.max(0, previousTotalMinor - amount);
    const nextBalanceMinor = Math.max(0, nextTotalMinor - Number(obligation.paidAmountMinor || 0));
    transaction.update(obligationRef, {
      penaltyMinor: Math.max(0, Number(obligation.penaltyMinor) || 0) - amount,
      totalAmountMinor: nextTotalMinor,
      balanceMinor: nextBalanceMinor,
      status: getConsortiumObligationStatus({ ...obligation, balanceMinor: nextBalanceMinor }),
      voided: true,
      voidReason: normalizedReason,
      breakdown: [...(Array.isArray(obligation.breakdown) ? obligation.breakdown : []), {
        expenseId: adjustmentRef.id,
        concept: `Anulación de multa: ${normalizedReason}`,
        category: "penalty",
        distributionMode: "specific",
        amountMinor: -amount,
        source: "penalty_void",
      }],
      adjustmentIds: [...(Array.isArray(obligation.adjustmentIds) ? obligation.adjustmentIds : []), adjustmentRef.id],
      updatedBy: user.uid,
      updatedAt: serverTimestamp(),
    });
    transaction.update(periodRef, {
      status: nextBalanceMinor <= 0 ? "closed" : "issued",
      adjustmentNetMinor: -amount,
      adjustedTotalExpensesMinor: nextTotalMinor,
      closedAt: nextBalanceMinor <= 0 ? serverTimestamp() : null,
      closedBy: nextBalanceMinor <= 0 ? user.uid : "",
      updatedBy: user.uid,
      updatedAt: serverTimestamp(),
    });
    transaction.set(adjustmentRef, {
      id: adjustmentRef.id,
      schemaVersion: 1,
      type: "penalty_credit",
      direction: "credit",
      category: "penalty",
      penaltyId,
      consortiumId: penalty.consortiumId,
      unitId: penalty.unitId,
      unitSnapshot: penalty.unitSnapshot || obligation.unitSnapshot || {},
      obligationId: penalty.obligationId,
      periodId: penalty.periodId,
      periodKey: penalty.periodKey,
      source: "penalty",
      currency: penalty.currency || "ARS",
      amountMinor: amount,
      effectiveDate: new Date().toISOString().slice(0, 10),
      dueDate: penalty.dueDate,
      reason: normalizedReason,
      previousTotalMinor,
      nextTotalMinor,
      previousBalanceMinor,
      nextBalanceMinor,
      inmobiliariaId,
      ownerInmobiliariaId: inmobiliariaId,
      createdBy: user.uid,
      createdAt: serverTimestamp(),
    });
    transaction.update(penaltyRef, {
      status: "voided",
      reversalAdjustmentId: adjustmentRef.id,
      voidReason: normalizedReason,
      voidedAt: serverTimestamp(),
      voidedBy: user.uid,
      statusHistory: [...(Array.isArray(penalty.statusHistory) ? penalty.statusHistory : []),
        getPenaltyHistoryEntry("voided", user.uid, normalizedReason)],
      updatedAt: serverTimestamp(),
      updatedBy: user.uid,
    });
  });
};

export const getConsortiumExpenseDocuments = async (
  inmobiliariaId,
  { consortiumId = "", periodId = "" } = {},
) => {
  if (!inmobiliariaId) return [];
  const source = periodId
    ? query(agencyCollection(inmobiliariaId, "expenseDocuments"), where("periodId", "==", periodId))
    : consortiumId
      ? query(agencyCollection(inmobiliariaId, "expenseDocuments"), where("consortiumId", "==", consortiumId))
      : agencyCollection(inmobiliariaId, "expenseDocuments");
  const snap = await getDocs(source);
  return sortUpdatedDesc(snap.docs.map((item) => ({ id: item.id, ...item.data() })));
};

export const uploadConsortiumExpenseDocument = async ({
  inmobiliariaId,
  consortiumId,
  periodId,
  expenseId,
  file,
  provider = "",
  voucherNumber = "",
  documentDate = "",
  notes = "",
}) => {
  await assertAgency(inmobiliariaId);
  validateConsortiumFileOrThrow(file);
  const user = currentUserOrThrow();
  const period = await getConsortiumPeriodById(inmobiliariaId, periodId);
  if (!period || period.consortiumId !== consortiumId) throw new Error("La liquidación no existe.");
  const expense = (Array.isArray(period.expenses) ? period.expenses : [])
    .find((item) => item.id === expenseId);
  if (!expense) throw new Error("Guardá el gasto antes de adjuntar su comprobante.");

  const documentRef = doc(agencyCollection(inmobiliariaId, "expenseDocuments"));
  const safeName = safeConsortiumFileName(file.name);
  const path = `consorcios/${inmobiliariaId}/${consortiumId}/expenses/${periodId}/${expenseId}/${documentRef.id}/${safeName}`;
  await uploadPrivateFile({
    file,
    path,
    metadata: { inmobiliariaId, consortiumId, periodId, expenseId, uploadedBy: user.uid },
  });
  try {
    await setDoc(documentRef, {
      id: documentRef.id,
      schemaVersion: 1,
      inmobiliariaId,
      ownerInmobiliariaId: inmobiliariaId,
      consortiumId,
      periodId,
      periodKey: period.periodKey,
      expenseId,
      expenseConcept: cleanText(expense.concept, 220),
      provider: cleanText(provider, 220),
      voucherNumber: cleanText(voucherNumber, 120),
      documentDate: /^\d{4}-\d{2}-\d{2}$/.test(documentDate) ? documentDate : "",
      notes: cleanText(notes, 1000),
      fileName: safeName,
      originalFileName: cleanText(file.name, 220),
      storagePath: path,
      contentType: file.type,
      size: Number(file.size || 0),
      voided: false,
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    await deleteObject(storageRef(storage, path)).catch(() => {});
    throw error;
  }
  return documentRef.id;
};

export const voidConsortiumExpenseDocument = async ({ inmobiliariaId, documentId, reason }) => {
  await assertAgency(inmobiliariaId);
  const user = currentUserOrThrow();
  const voidReason = cleanText(reason, 500);
  if (!voidReason) throw new Error("Ingresá el motivo de la anulación.");
  await updateDoc(agencyDoc(inmobiliariaId, "expenseDocuments", documentId), {
    voided: true,
    voidReason,
    voidedAt: serverTimestamp(),
    voidedBy: user.uid,
    updatedAt: serverTimestamp(),
  });
};

const assertPortalUser = () => {
  const user = currentUserOrThrow();
  if (!user.email || user.emailVerified !== true) {
    throw new Error("Necesitás una dirección de email verificada para acceder al consorcio.");
  }
  return user;
};

export const getMyConsortiumUnits = async () => {
  const user = assertPortalUser();
  await user.getIdToken(true);
  const callable = httpsCallable(functions, "consortiumGetMyUnits", {
    timeout: 30000,
  });
  const result = await callable();
  const units = Array.isArray(result.data?.units) ? result.data.units : [];
  return units
    .filter((item) => item?.id && item.inmobiliariaId && item.consortiumId)
    .sort((a, b) => `${a.consortiumName} ${a.code}`.localeCompare(`${b.consortiumName} ${b.code}`, "es"));
};

export const getPortalUnitObligations = async ({ inmobiliariaId, unitId }) => {
  assertPortalUser();
  const snap = await getDocs(query(
    agencyCollection(inmobiliariaId, "obligations"),
    where("unitId", "==", unitId),
  ));
  return snap.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .sort((a, b) => (b.periodKey || "").localeCompare(a.periodKey || ""));
};

export const getConsortiumPaymentReports = async (
  inmobiliariaId,
  { consortiumId = "", unitId = "" } = {},
) => {
  if (!inmobiliariaId) return [];
  const source = unitId
    ? query(agencyCollection(inmobiliariaId, "paymentReports"), where("unitId", "==", unitId))
    : consortiumId
      ? query(agencyCollection(inmobiliariaId, "paymentReports"), where("consortiumId", "==", consortiumId))
      : agencyCollection(inmobiliariaId, "paymentReports");
  const snap = await getDocs(source);
  return sortUpdatedDesc(snap.docs.map((item) => ({ id: item.id, ...item.data() })));
};

export const submitConsortiumPaymentReport = async ({
  inmobiliariaId,
  consortiumId,
  unitId,
  obligationId,
  amountMinor,
  date,
  method,
  reference = "",
  notes = "",
  file,
}) => {
  const user = assertPortalUser();
  validateConsortiumFileOrThrow(file);
  const amount = Math.max(0, Math.round(Number(amountMinor) || 0));
  if (!amount) throw new Error("Ingresá un importe mayor a cero.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) throw new Error("Ingresá la fecha del pago.");
  const [unitSnapshot, obligationSnapshot] = await Promise.all([
    getDoc(agencyDoc(inmobiliariaId, "units", unitId)),
    getDoc(agencyDoc(inmobiliariaId, "obligations", obligationId)),
  ]);
  if (!unitSnapshot.exists() || !obligationSnapshot.exists()) throw new Error("La expensa no existe.");
  const unit = unitSnapshot.data();
  const obligation = obligationSnapshot.data();
  if (unit.consortiumId !== consortiumId || obligation.unitId !== unitId) {
    throw new Error("La unidad no coincide con la expensa informada.");
  }
  if (amount > Number(obligation.balanceMinor || 0)) {
    throw new Error("El importe informado no puede superar el saldo pendiente.");
  }

  const reportRef = doc(agencyCollection(inmobiliariaId, "paymentReports"));
  const safeName = safeConsortiumFileName(file.name);
  const path = `consorcios/${inmobiliariaId}/${consortiumId}/payment-reports/${unitId}/${reportRef.id}/${user.uid}/${safeName}`;
  await uploadPrivateFile({
    file,
    path,
    metadata: { inmobiliariaId, consortiumId, unitId, reportId: reportRef.id, uploadedBy: user.uid },
  });
  try {
    await setDoc(reportRef, {
      id: reportRef.id,
      schemaVersion: 1,
      inmobiliariaId,
      ownerInmobiliariaId: inmobiliariaId,
      consortiumId,
      unitId,
      obligationId,
      periodId: obligation.periodId,
      periodKey: obligation.periodKey,
      accountingSource: obligation.source || "monthly_assessment",
      unitSnapshot: obligation.unitSnapshot || { code: unit.code || "" },
      currency: obligation.currency || "ARS",
      amountMinor: amount,
      date,
      method: cleanText(method, 40) || "transfer",
      reference: cleanText(reference, 220),
      notes: cleanText(notes, 1000),
      status: "pending",
      proofStoragePath: path,
      proofFileName: safeName,
      proofContentType: file.type,
      proofSize: Number(file.size || 0),
      submittedBy: user.uid,
      submittedByEmail: user.email.trim().toLowerCase(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    await deleteObject(storageRef(storage, path)).catch(() => {});
    throw error;
  }
  return reportRef.id;
};

export const approveConsortiumPaymentReport = async ({ inmobiliariaId, reportId }) => {
  await assertAgency(inmobiliariaId);
  const user = currentUserOrThrow();
  const reportRef = agencyDoc(inmobiliariaId, "paymentReports", reportId);
  const paymentRef = agencyDoc(inmobiliariaId, "payments", `report_${reportId}`);
  await runTransaction(db, async (transaction) => {
    const reportSnapshot = await transaction.get(reportRef);
    if (!reportSnapshot.exists()) throw new Error("El pago informado no existe.");
    const report = reportSnapshot.data();
    if (report.status !== "pending") throw new Error("El pago informado ya fue revisado.");
    const obligationRef = agencyDoc(inmobiliariaId, "obligations", report.obligationId);
    const obligationSnapshot = await transaction.get(obligationRef);
    if (!obligationSnapshot.exists()) throw new Error("La expensa relacionada no existe.");
    const obligation = obligationSnapshot.data();
    if (
      obligation.unitId !== report.unitId
      || obligation.consortiumId !== report.consortiumId
      || obligation.periodId !== report.periodId
    ) {
      throw new Error("El pago informado no coincide con la expensa relacionada.");
    }
    const amount = Number(report.amountMinor || 0);
    const balance = Math.max(0, Number(obligation.balanceMinor || 0));
    if (!amount || amount > balance) {
      throw new Error("El importe informado ya no coincide con el saldo pendiente.");
    }
    const paidAmountMinor = Math.max(0, Number(obligation.paidAmountMinor || 0)) + amount;
    const balanceMinor = Math.max(0, Number(obligation.totalAmountMinor || 0) - paidAmountMinor);
    transaction.set(paymentRef, {
      id: paymentRef.id,
      obligationId: report.obligationId,
      consortiumId: report.consortiumId,
      periodId: report.periodId,
      periodKey: report.periodKey,
      accountingSource: report.accountingSource || obligation.source || "monthly_assessment",
      unitId: report.unitId,
      unitSnapshot: report.unitSnapshot || obligation.unitSnapshot || {},
      currency: report.currency || obligation.currency || "ARS",
      amountMinor: amount,
      date: report.date,
      method: report.method || "transfer",
      reference: report.reference || "",
      notes: report.notes || "",
      source: "portal_report",
      reportId,
      proofStoragePath: report.proofStoragePath,
      proofFileName: report.proofFileName,
      reportedBy: report.submittedBy,
      reportedByEmail: report.submittedByEmail,
      voided: false,
      inmobiliariaId,
      ownerInmobiliariaId: inmobiliariaId,
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    transaction.update(obligationRef, {
      paidAmountMinor,
      balanceMinor,
      status: balanceMinor <= 0 ? "paid" : getConsortiumObligationStatus({
        ...obligation,
        paidAmountMinor,
        balanceMinor,
      }),
      paymentIds: [...(Array.isArray(obligation.paymentIds) ? obligation.paymentIds : []), paymentRef.id],
      updatedBy: user.uid,
      updatedAt: serverTimestamp(),
    });
    transaction.update(reportRef, {
      status: "approved",
      linkedPaymentId: paymentRef.id,
      reviewedBy: user.uid,
      reviewedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
  return paymentRef.id;
};

export const rejectConsortiumPaymentReport = async ({ inmobiliariaId, reportId, reason }) => {
  await assertAgency(inmobiliariaId);
  const user = currentUserOrThrow();
  const rejectionReason = cleanText(reason, 500);
  if (!rejectionReason) throw new Error("Ingresá el motivo del rechazo.");
  const reportRef = agencyDoc(inmobiliariaId, "paymentReports", reportId);
  await runTransaction(db, async (transaction) => {
    const reportSnapshot = await transaction.get(reportRef);
    if (!reportSnapshot.exists()) throw new Error("El pago informado no existe.");
    if (reportSnapshot.data().status !== "pending") {
      throw new Error("El pago informado ya fue revisado.");
    }
    transaction.update(reportRef, {
      status: "rejected",
      rejectionReason,
      reviewedBy: user.uid,
      reviewedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
};

const validDateOrThrow = (value, label) => {
  const normalized = cleanText(value, 10);
  const parsed = new Date(`${normalized}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)
    || Number.isNaN(parsed.getTime())
    || parsed.toISOString().slice(0, 10) !== normalized) {
    throw new Error(`Ingresá ${label}.`);
  }
  return normalized;
};

const sanitizeSupplier = (value = {}) => ({
  schemaVersion: 1,
  consortiumId: cleanText(value.consortiumId, 128),
  name: cleanText(value.name, 220),
  legalName: cleanText(value.legalName, 220),
  taxId: cleanText(value.taxId, 32),
  category: ["maintenance", "utilities", "professional", "insurance", "staff", "taxes", "other"]
    .includes(value.category) ? value.category : "other",
  email: cleanText(value.email, 220).toLowerCase(),
  phone: cleanText(value.phone, 80),
  address: cleanText(value.address, 300),
  bankAccount: cleanText(value.bankAccount, 180),
  notes: cleanText(value.notes, 2000),
  active: value.active !== false,
  deleted: false,
});

export const getConsortiumSuppliers = async (inmobiliariaId, consortiumId = "") => {
  if (!inmobiliariaId) return [];
  const baseCollection = agencyCollection(inmobiliariaId, "suppliers");
  const source = consortiumId
    ? query(baseCollection, where("consortiumId", "==", consortiumId))
    : baseCollection;
  const snap = await getDocs(source);
  return sortUpdatedDesc(snap.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .filter((item) => !consortiumId || item.consortiumId === consortiumId));
};

export const saveConsortiumSupplier = async ({ inmobiliariaId, supplierId = "", value }) => {
  await assertAgency(inmobiliariaId);
  const user = currentUserOrThrow();
  const normalized = sanitizeSupplier(value);
  if (!normalized.consortiumId) throw new Error("El proveedor debe pertenecer a un consorcio.");
  if (!normalized.name) throw new Error("Ingresá el nombre del proveedor.");
  const consortium = await getConsortiumById(inmobiliariaId, normalized.consortiumId);
  if (!consortium) throw new Error("El consorcio no existe.");
  if (supplierId) {
    const targetRef = agencyDoc(inmobiliariaId, "suppliers", supplierId);
    const current = await getDoc(targetRef);
    if (!current.exists() || current.data().consortiumId !== normalized.consortiumId) {
      throw new Error("El proveedor no existe.");
    }
    await updateDoc(targetRef, {
      ...normalized,
      inmobiliariaId,
      ownerInmobiliariaId: inmobiliariaId,
      updatedBy: user.uid,
      updatedAt: serverTimestamp(),
    });
    return supplierId;
  }
  const targetRef = doc(agencyCollection(inmobiliariaId, "suppliers"));
  await setDoc(targetRef, {
    ...normalized,
    id: targetRef.id,
    inmobiliariaId,
    ownerInmobiliariaId: inmobiliariaId,
    createdBy: user.uid,
    createdAt: serverTimestamp(),
    updatedBy: user.uid,
    updatedAt: serverTimestamp(),
  });
  return targetRef.id;
};

export const archiveConsortiumSupplier = async ({ inmobiliariaId, supplierId }) => {
  await assertAgency(inmobiliariaId);
  const user = currentUserOrThrow();
  await updateDoc(agencyDoc(inmobiliariaId, "suppliers", supplierId), {
    active: false,
    archivedBy: user.uid,
    archivedAt: serverTimestamp(),
    updatedBy: user.uid,
    updatedAt: serverTimestamp(),
  });
};

export const getConsortiumTreasuryAccounts = async (inmobiliariaId, consortiumId = "") => {
  if (!inmobiliariaId) return [];
  const baseCollection = agencyCollection(inmobiliariaId, "treasuryAccounts");
  const source = consortiumId
    ? query(baseCollection, where("consortiumId", "==", consortiumId))
    : baseCollection;
  const snap = await getDocs(source);
  return sortUpdatedDesc(snap.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .filter((item) => !consortiumId || item.consortiumId === consortiumId));
};

export const createConsortiumTreasuryAccount = async ({
  inmobiliariaId,
  consortiumId,
  name,
  type = "bank",
  currency = "ARS",
  openingBalanceMinor = 0,
  notes = "",
}) => {
  await assertAgency(inmobiliariaId);
  const user = currentUserOrThrow();
  const accountName = cleanText(name, 180);
  const openingBalance = Math.max(0, Math.round(Number(openingBalanceMinor) || 0));
  if (!accountName) throw new Error("Ingresá el nombre de la caja o cuenta.");
  const consortium = await getConsortiumById(inmobiliariaId, consortiumId);
  if (!consortium) throw new Error("El consorcio no existe.");
  const accountRef = doc(agencyCollection(inmobiliariaId, "treasuryAccounts"));
  const movementRef = doc(agencyCollection(inmobiliariaId, "treasuryMovements"));
  const now = serverTimestamp();
  const account = {
    id: accountRef.id,
    schemaVersion: 1,
    inmobiliariaId,
    ownerInmobiliariaId: inmobiliariaId,
    consortiumId,
    name: accountName,
    type: ["bank", "cash", "wallet", "reserve", "other"].includes(type) ? type : "bank",
    currency: cleanText(currency, 10) || consortium.currency || "ARS",
    openingBalanceMinor: openingBalance,
    currentBalanceMinor: openingBalance,
    notes: cleanText(notes, 1000),
    active: true,
    deleted: false,
    createdBy: user.uid,
    createdAt: now,
    updatedBy: user.uid,
    updatedAt: now,
  };
  const batch = writeBatch(db);
  batch.set(accountRef, account);
  if (openingBalance > 0) {
    batch.set(movementRef, {
      id: movementRef.id,
      schemaVersion: 1,
      inmobiliariaId,
      ownerInmobiliariaId: inmobiliariaId,
      consortiumId,
      accountId: accountRef.id,
      accountSnapshot: { name: account.name, type: account.type },
      source: "opening_balance",
      sourceId: accountRef.id,
      direction: "inflow",
      amountMinor: openingBalance,
      currency: account.currency,
      date: new Date().toISOString().slice(0, 10),
      concept: "Saldo inicial de tesorería",
      reference: "",
      voided: false,
      createdBy: user.uid,
      createdAt: now,
    });
  }
  await batch.commit();
  return accountRef.id;
};

export const archiveConsortiumTreasuryAccount = async ({ inmobiliariaId, accountId }) => {
  await assertAgency(inmobiliariaId);
  const user = currentUserOrThrow();
  const accountRef = agencyDoc(inmobiliariaId, "treasuryAccounts", accountId);
  const account = await getDoc(accountRef);
  if (!account.exists()) throw new Error("La cuenta no existe.");
  if (Number(account.data().currentBalanceMinor || 0) !== 0) {
    throw new Error("La cuenta debe quedar en cero antes de archivarla.");
  }
  await updateDoc(accountRef, {
    active: false,
    archivedBy: user.uid,
    archivedAt: serverTimestamp(),
    updatedBy: user.uid,
    updatedAt: serverTimestamp(),
  });
};

export const getConsortiumSupplierObligations = async (
  inmobiliariaId,
  { consortiumId = "", supplierId = "", includeVoided = false } = {},
) => {
  if (!inmobiliariaId) return [];
  const baseCollection = agencyCollection(inmobiliariaId, "supplierObligations");
  const source = consortiumId
    ? query(baseCollection, where("consortiumId", "==", consortiumId))
    : supplierId
      ? query(baseCollection, where("supplierId", "==", supplierId))
      : baseCollection;
  const snap = await getDocs(source);
  return sortUpdatedDesc(snap.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .filter((item) => includeVoided || item.voided !== true)
    .filter((item) => !consortiumId || item.consortiumId === consortiumId)
    .filter((item) => !supplierId || item.supplierId === supplierId));
};

const validateSupplierObligationLink = async ({
  inmobiliariaId,
  consortiumId,
  periodId,
  expenseId,
  ignoredObligationId = "",
}) => {
  if (!periodId && !expenseId) return { period: null, expense: null };
  if (!periodId || !expenseId) throw new Error("Seleccioná un gasto completo de una liquidación.");
  const period = await getConsortiumPeriodById(inmobiliariaId, periodId);
  if (!period || period.consortiumId !== consortiumId) throw new Error("La liquidación vinculada no existe.");
  const expense = (Array.isArray(period.expenses) ? period.expenses : [])
    .find((item) => item.id === expenseId);
  if (!expense) throw new Error("El gasto vinculado no existe.");
  const obligations = await getConsortiumSupplierObligations(
    inmobiliariaId,
    { consortiumId, includeVoided: true },
  );
  if (obligations.some((item) => (
    item.id !== ignoredObligationId
    && item.voided !== true
    && item.periodId === periodId
    && item.expenseId === expenseId
  ))) throw new Error("Ese gasto ya tiene una obligación a proveedor.");
  return { period, expense };
};

export const createConsortiumSupplierObligation = async ({
  inmobiliariaId,
  consortiumId,
  supplierId,
  concept,
  voucherType = "invoice",
  voucherNumber = "",
  issueDate,
  dueDate,
  currency = "ARS",
  amountMinor,
  periodId = "",
  expenseId = "",
  notes = "",
  file = null,
}) => {
  await assertAgency(inmobiliariaId);
  const user = currentUserOrThrow();
  const amount = Math.max(0, Math.round(Number(amountMinor) || 0));
  const normalizedConcept = cleanText(concept, 220);
  if (!normalizedConcept) throw new Error("Ingresá el concepto de la obligación.");
  if (!amount) throw new Error("Ingresá un importe mayor a cero.");
  const normalizedIssueDate = validDateOrThrow(issueDate, "la fecha del comprobante");
  const normalizedDueDate = validDateOrThrow(dueDate, "el vencimiento");
  if (normalizedDueDate < normalizedIssueDate) {
    throw new Error("El vencimiento no puede ser anterior a la fecha del comprobante.");
  }
  const supplierSnap = await getDoc(agencyDoc(inmobiliariaId, "suppliers", supplierId));
  if (!supplierSnap.exists() || supplierSnap.data().consortiumId !== consortiumId) {
    throw new Error("Seleccioná un proveedor válido.");
  }
  const { period, expense } = await validateSupplierObligationLink({
    inmobiliariaId, consortiumId, periodId, expenseId,
  });
  const normalizedCurrency = cleanText(currency, 10) || "ARS";
  if (period && normalizedCurrency !== (period.currency || "ARS")) {
    throw new Error("La moneda de la obligación debe coincidir con la liquidación vinculada.");
  }
  const obligationRef = doc(agencyCollection(inmobiliariaId, "supplierObligations"));
  let document = {};
  if (file) {
    validateConsortiumFileOrThrow(file);
    const safeName = safeConsortiumFileName(file.name);
    const path = `consorcios/${inmobiliariaId}/${consortiumId}/supplier-obligations/${obligationRef.id}/${safeName}`;
    await uploadPrivateFile({
      file,
      path,
      metadata: { inmobiliariaId, consortiumId, obligationId: obligationRef.id, uploadedBy: user.uid },
    });
    document = {
      documentStoragePath: path,
      documentFileName: safeName,
      documentContentType: file.type,
      documentSize: Number(file.size || 0),
    };
  }
  try {
    await setDoc(obligationRef, {
      id: obligationRef.id,
      schemaVersion: 1,
      inmobiliariaId,
      ownerInmobiliariaId: inmobiliariaId,
      consortiumId,
      supplierId,
      supplierSnapshot: {
        name: supplierSnap.data().name || "",
        legalName: supplierSnap.data().legalName || "",
        taxId: supplierSnap.data().taxId || "",
      },
      concept: normalizedConcept,
      voucherType: ["invoice", "receipt", "budget", "other", "no_data"].includes(voucherType)
        ? voucherType : "invoice",
      voucherNumber: cleanText(voucherNumber, 120),
      issueDate: normalizedIssueDate,
      dueDate: normalizedDueDate,
      currency: normalizedCurrency,
      amountMinor: amount,
      paidAmountMinor: 0,
      balanceMinor: amount,
      periodId: periodId || "",
      periodKey: period?.periodKey || "",
      expenseId: expenseId || "",
      expenseSnapshot: expense ? { concept: expense.concept || "", amountMinor: expense.amountMinor || 0 } : {},
      notes: cleanText(notes, 2000),
      status: "pending",
      voided: false,
      deleted: false,
      ...document,
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      updatedBy: user.uid,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    if (document.documentStoragePath) {
      await deleteObject(storageRef(storage, document.documentStoragePath)).catch(() => {});
    }
    throw error;
  }
  return obligationRef.id;
};

export const updateConsortiumSupplierObligation = async ({ inmobiliariaId, obligationId, value }) => {
  await assertAgency(inmobiliariaId);
  const user = currentUserOrThrow();
  const targetRef = agencyDoc(inmobiliariaId, "supplierObligations", obligationId);
  const currentSnap = await getDoc(targetRef);
  if (!currentSnap.exists()) throw new Error("La obligación no existe.");
  const current = currentSnap.data();
  if (current.voided === true) throw new Error("La obligación está anulada.");
  if (Number(current.paidAmountMinor || 0) > 0) {
    throw new Error("Una obligación con pagos no puede editarse. Anulá el pago antes de corregirla.");
  }
  const amount = Math.max(0, Math.round(Number(value.amountMinor) || 0));
  const concept = cleanText(value.concept, 220);
  if (!concept || !amount) throw new Error("Ingresá concepto e importe mayor a cero.");
  const supplierSnap = await getDoc(agencyDoc(inmobiliariaId, "suppliers", value.supplierId));
  if (!supplierSnap.exists() || supplierSnap.data().consortiumId !== current.consortiumId) {
    throw new Error("Seleccioná un proveedor válido.");
  }
  const { period, expense } = await validateSupplierObligationLink({
    inmobiliariaId,
    consortiumId: current.consortiumId,
    periodId: value.periodId || "",
    expenseId: value.expenseId || "",
    ignoredObligationId: obligationId,
  });
  const normalizedIssueDate = validDateOrThrow(value.issueDate, "la fecha del comprobante");
  const normalizedDueDate = validDateOrThrow(value.dueDate, "el vencimiento");
  if (normalizedDueDate < normalizedIssueDate) {
    throw new Error("El vencimiento no puede ser anterior a la fecha del comprobante.");
  }
  const normalizedCurrency = cleanText(value.currency, 10) || current.currency || "ARS";
  if (period && normalizedCurrency !== (period.currency || "ARS")) {
    throw new Error("La moneda de la obligación debe coincidir con la liquidación vinculada.");
  }
  await updateDoc(targetRef, {
    supplierId: value.supplierId,
    supplierSnapshot: {
      name: supplierSnap.data().name || "",
      legalName: supplierSnap.data().legalName || "",
      taxId: supplierSnap.data().taxId || "",
    },
    concept,
    voucherType: ["invoice", "receipt", "budget", "other", "no_data"].includes(value.voucherType)
      ? value.voucherType : "invoice",
    voucherNumber: cleanText(value.voucherNumber, 120),
    issueDate: normalizedIssueDate,
    dueDate: normalizedDueDate,
    currency: normalizedCurrency,
    amountMinor: amount,
    balanceMinor: amount,
    periodId: value.periodId || "",
    periodKey: period?.periodKey || "",
    expenseId: value.expenseId || "",
    expenseSnapshot: expense ? { concept: expense.concept || "", amountMinor: expense.amountMinor || 0 } : {},
    notes: cleanText(value.notes, 2000),
    status: "pending",
    updatedBy: user.uid,
    updatedAt: serverTimestamp(),
  });
};

export const voidConsortiumSupplierObligation = async ({ inmobiliariaId, obligationId, reason }) => {
  await assertAgency(inmobiliariaId);
  const user = currentUserOrThrow();
  const voidReason = cleanText(reason, 500);
  if (!voidReason) throw new Error("Ingresá el motivo de la anulación.");
  const targetRef = agencyDoc(inmobiliariaId, "supplierObligations", obligationId);
  const current = await getDoc(targetRef);
  if (!current.exists()) throw new Error("La obligación no existe.");
  if (Number(current.data().paidAmountMinor || 0) > 0) {
    throw new Error("Anulá primero los pagos registrados para esta obligación.");
  }
  await updateDoc(targetRef, {
    status: "voided",
    voided: true,
    voidReason,
    voidedBy: user.uid,
    voidedAt: serverTimestamp(),
    updatedBy: user.uid,
    updatedAt: serverTimestamp(),
  });
};

export const getConsortiumSupplierPayments = async (
  inmobiliariaId,
  { consortiumId = "", obligationId = "", includeVoided = true } = {},
) => {
  if (!inmobiliariaId) return [];
  const baseCollection = agencyCollection(inmobiliariaId, "supplierPayments");
  const source = consortiumId
    ? query(baseCollection, where("consortiumId", "==", consortiumId))
    : obligationId
      ? query(baseCollection, where("obligationId", "==", obligationId))
      : baseCollection;
  const snap = await getDocs(source);
  return snap.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .filter((item) => includeVoided || item.voided !== true)
    .filter((item) => !consortiumId || item.consortiumId === consortiumId)
    .filter((item) => !obligationId || item.obligationId === obligationId)
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
};

export const getConsortiumTreasuryMovements = async (inmobiliariaId, consortiumId = "") => {
  if (!inmobiliariaId) return [];
  const baseCollection = agencyCollection(inmobiliariaId, "treasuryMovements");
  const source = consortiumId
    ? query(baseCollection, where("consortiumId", "==", consortiumId))
    : baseCollection;
  const snap = await getDocs(source);
  return snap.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .filter((item) => !consortiumId || item.consortiumId === consortiumId)
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
};

export const registerConsortiumTreasuryMovement = async ({
  inmobiliariaId,
  consortiumId,
  accountId,
  direction = "inflow",
  amountMinor,
  date,
  concept,
  reason,
  reference = "",
  file = null,
}) => {
  await assertAgency(inmobiliariaId);
  const user = currentUserOrThrow();
  const amount = Math.max(0, Math.round(Number(amountMinor) || 0));
  const movementDate = validDateOrThrow(date, "la fecha del movimiento");
  const normalizedConcept = cleanText(concept, 220);
  const normalizedReason = cleanText(reason, 1000);
  const normalizedDirection = direction === "outflow" ? "outflow" : "inflow";
  if (!amount) throw new Error("Ingresá un importe mayor a cero.");
  if (!normalizedConcept) throw new Error("Ingresá el concepto del movimiento.");
  if (!normalizedReason) throw new Error("Explicá el motivo del movimiento.");
  if (movementDate > new Date().toISOString().slice(0, 10)) {
    throw new Error("No se puede registrar un movimiento con fecha futura.");
  }
  const movementRef = doc(agencyCollection(inmobiliariaId, "treasuryMovements"));
  let evidence = {
    evidenceStoragePath: "",
    evidenceFileName: "",
    evidenceContentType: "",
    evidenceSize: 0,
  };
  if (file) {
    validateConsortiumFileOrThrow(file);
    const safeName = safeConsortiumFileName(file.name);
    const path = `consorcios/${inmobiliariaId}/${consortiumId}/treasury-movements/${movementRef.id}/${safeName}`;
    await uploadPrivateFile({
      file,
      path,
      metadata: { inmobiliariaId, consortiumId, movementId: movementRef.id, uploadedBy: user.uid },
    });
    evidence = {
      evidenceStoragePath: path,
      evidenceFileName: safeName,
      evidenceContentType: file.type,
      evidenceSize: Number(file.size || 0),
    };
  }
  try {
    await runTransaction(db, async (transaction) => {
      const accountRef = agencyDoc(inmobiliariaId, "treasuryAccounts", accountId);
      const accountSnapshot = await transaction.get(accountRef);
      if (!accountSnapshot.exists() || accountSnapshot.data().active === false) {
        throw new Error("La cuenta de tesorería no está disponible.");
      }
      const account = accountSnapshot.data();
      if (account.consortiumId !== consortiumId) throw new Error("La cuenta pertenece a otro consorcio.");
      const currentBalance = Math.max(0, Number(account.currentBalanceMinor) || 0);
      if (normalizedDirection === "outflow" && amount > currentBalance) {
        throw new Error("La cuenta seleccionada no tiene saldo suficiente.");
      }
      const nextBalance = normalizedDirection === "outflow"
        ? currentBalance - amount
        : currentBalance + amount;
      transaction.set(movementRef, {
        id: movementRef.id,
        schemaVersion: 1,
        inmobiliariaId,
        ownerInmobiliariaId: inmobiliariaId,
        consortiumId,
        accountId,
        accountSnapshot: { name: account.name || "", type: account.type || "bank" },
        source: "manual_movement",
        sourceId: movementRef.id,
        direction: normalizedDirection,
        amountMinor: amount,
        currency: account.currency || "ARS",
        date: movementDate,
        concept: normalizedConcept,
        reason: normalizedReason,
        reference: cleanText(reference, 220),
        voided: false,
        ...evidence,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
      });
      transaction.update(accountRef, {
        currentBalanceMinor: nextBalance,
        updatedBy: user.uid,
        updatedAt: serverTimestamp(),
      });
    });
  } catch (error) {
    if (evidence.evidenceStoragePath) {
      await deleteObject(storageRef(storage, evidence.evidenceStoragePath)).catch(() => {});
    }
    throw error;
  }
  return movementRef.id;
};

export const transferConsortiumTreasuryFunds = async ({
  inmobiliariaId,
  consortiumId,
  fromAccountId,
  toAccountId,
  amountMinor,
  date,
  concept = "Transferencia entre cuentas",
  reference = "",
  notes = "",
}) => {
  await assertAgency(inmobiliariaId);
  const user = currentUserOrThrow();
  const amount = Math.max(0, Math.round(Number(amountMinor) || 0));
  const transferDate = validDateOrThrow(date, "la fecha de la transferencia");
  if (!fromAccountId || !toAccountId || fromAccountId === toAccountId) {
    throw new Error("Seleccioná dos cuentas diferentes.");
  }
  if (!amount) throw new Error("Ingresá un importe mayor a cero.");
  if (transferDate > new Date().toISOString().slice(0, 10)) {
    throw new Error("No se puede registrar una transferencia con fecha futura.");
  }
  const outflowRef = doc(agencyCollection(inmobiliariaId, "treasuryMovements"));
  const inflowRef = doc(agencyCollection(inmobiliariaId, "treasuryMovements"));
  const transferId = outflowRef.id;
  await runTransaction(db, async (transaction) => {
    const fromRef = agencyDoc(inmobiliariaId, "treasuryAccounts", fromAccountId);
    const toRef = agencyDoc(inmobiliariaId, "treasuryAccounts", toAccountId);
    const [fromSnapshot, toSnapshot] = await Promise.all([
      transaction.get(fromRef),
      transaction.get(toRef),
    ]);
    if (!fromSnapshot.exists() || !toSnapshot.exists()
      || fromSnapshot.data().active === false || toSnapshot.data().active === false) {
      throw new Error("Alguna de las cuentas no está disponible.");
    }
    const fromAccount = fromSnapshot.data();
    const toAccount = toSnapshot.data();
    if (fromAccount.consortiumId !== consortiumId || toAccount.consortiumId !== consortiumId) {
      throw new Error("Las cuentas deben pertenecer al consorcio activo.");
    }
    if ((fromAccount.currency || "ARS") !== (toAccount.currency || "ARS")) {
      throw new Error("Las cuentas deben utilizar la misma moneda.");
    }
    const fromBalance = Math.max(0, Number(fromAccount.currentBalanceMinor) || 0);
    const toBalance = Math.max(0, Number(toAccount.currentBalanceMinor) || 0);
    if (amount > fromBalance) throw new Error("La cuenta de origen no tiene saldo suficiente.");
    const common = {
      schemaVersion: 1,
      inmobiliariaId,
      ownerInmobiliariaId: inmobiliariaId,
      consortiumId,
      source: "account_transfer",
      sourceId: transferId,
      transferId,
      amountMinor: amount,
      currency: fromAccount.currency || "ARS",
      date: transferDate,
      concept: cleanText(concept, 220) || "Transferencia entre cuentas",
      reference: cleanText(reference, 220),
      notes: cleanText(notes, 1000),
      voided: false,
      createdBy: user.uid,
      createdAt: serverTimestamp(),
    };
    transaction.set(outflowRef, {
      ...common,
      id: outflowRef.id,
      accountId: fromAccountId,
      accountSnapshot: { name: fromAccount.name || "", type: fromAccount.type || "bank" },
      counterpartAccountId: toAccountId,
      counterpartSnapshot: { name: toAccount.name || "", type: toAccount.type || "bank" },
      direction: "outflow",
    });
    transaction.set(inflowRef, {
      ...common,
      id: inflowRef.id,
      accountId: toAccountId,
      accountSnapshot: { name: toAccount.name || "", type: toAccount.type || "bank" },
      counterpartAccountId: fromAccountId,
      counterpartSnapshot: { name: fromAccount.name || "", type: fromAccount.type || "bank" },
      direction: "inflow",
    });
    transaction.update(fromRef, {
      currentBalanceMinor: fromBalance - amount,
      updatedBy: user.uid,
      updatedAt: serverTimestamp(),
    });
    transaction.update(toRef, {
      currentBalanceMinor: toBalance + amount,
      updatedBy: user.uid,
      updatedAt: serverTimestamp(),
    });
  });
  return transferId;
};

export const getConsortiumTreasuryReconciliations = async (
  inmobiliariaId,
  consortiumId = "",
) => {
  if (!inmobiliariaId) return [];
  const baseCollection = agencyCollection(inmobiliariaId, "treasuryReconciliations");
  const source = consortiumId
    ? query(baseCollection, where("consortiumId", "==", consortiumId))
    : baseCollection;
  const snapshot = await getDocs(source);
  return snapshot.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .sort((first, second) => (second.statementDate || "").localeCompare(
      first.statementDate || "",
    ));
};

export const createConsortiumTreasuryReconciliation = async ({
  inmobiliariaId,
  consortiumId,
  accountId,
  statementDate,
  statementBalanceMinor,
  notes = "",
  file = null,
}) => {
  await assertAgency(inmobiliariaId);
  const user = currentUserOrThrow();
  const normalizedDate = validDateOrThrow(statementDate, "la fecha de conciliación");
  const statementBalance = Math.round(Number(statementBalanceMinor) || 0);
  if (statementBalance < 0) throw new Error("El saldo informado no puede ser negativo.");
  if (normalizedDate > new Date().toISOString().slice(0, 10)) {
    throw new Error("No se puede conciliar una fecha futura.");
  }
  const accountSnapshot = await getDoc(agencyDoc(inmobiliariaId, "treasuryAccounts", accountId));
  if (!accountSnapshot.exists() || accountSnapshot.data().consortiumId !== consortiumId) {
    throw new Error("La cuenta no pertenece al consorcio activo.");
  }
  const movements = await getConsortiumTreasuryMovements(inmobiliariaId, consortiumId);
  const bookBalanceMinor = getConsortiumTreasuryBookBalance({
    accountId,
    movements,
    dateKey: normalizedDate,
  });
  const differenceMinor = statementBalance - bookBalanceMinor;
  const reconciliationRef = doc(agencyCollection(inmobiliariaId, "treasuryReconciliations"));
  let attachment = {
    statementStoragePath: "",
    statementFileName: "",
    statementContentType: "",
    statementSize: 0,
  };
  if (file) {
    validateConsortiumFileOrThrow(file);
    const safeName = safeConsortiumFileName(file.name);
    const path = `consorcios/${inmobiliariaId}/${consortiumId}/treasury-reconciliations/${reconciliationRef.id}/${safeName}`;
    await uploadPrivateFile({
      file,
      path,
      metadata: {
        inmobiliariaId,
        consortiumId,
        reconciliationId: reconciliationRef.id,
        uploadedBy: user.uid,
      },
    });
    attachment = {
      statementStoragePath: path,
      statementFileName: safeName,
      statementContentType: file.type,
      statementSize: Number(file.size || 0),
    };
  }
  try {
    await setDoc(reconciliationRef, {
      id: reconciliationRef.id,
      schemaVersion: 1,
      inmobiliariaId,
      ownerInmobiliariaId: inmobiliariaId,
      consortiumId,
      accountId,
      accountSnapshot: {
        name: accountSnapshot.data().name || "",
        type: accountSnapshot.data().type || "bank",
      },
      currency: accountSnapshot.data().currency || "ARS",
      statementDate: normalizedDate,
      statementBalanceMinor: statementBalance,
      bookBalanceMinor,
      differenceMinor,
      status: differenceMinor === 0 ? "matched" : "difference",
      notes: cleanText(notes, 2000),
      voided: false,
      ...attachment,
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    if (attachment.statementStoragePath) {
      await deleteObject(storageRef(storage, attachment.statementStoragePath)).catch(() => {});
    }
    throw error;
  }
  return reconciliationRef.id;
};

export const voidConsortiumTreasuryReconciliation = async ({
  inmobiliariaId,
  reconciliationId,
  reason,
}) => {
  await assertAgency(inmobiliariaId);
  const user = currentUserOrThrow();
  const voidReason = cleanText(reason, 500);
  if (!voidReason) throw new Error("Ingresá el motivo de la anulación.");
  await updateDoc(agencyDoc(
    inmobiliariaId,
    "treasuryReconciliations",
    reconciliationId,
  ), {
    voided: true,
    voidReason,
    voidedBy: user.uid,
    voidedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
};

export const getConsortiumFinancialClosures = async (
  inmobiliariaId,
  { consortiumId = "", periodId = "" } = {},
) => {
  if (!inmobiliariaId) return [];
  const baseCollection = agencyCollection(inmobiliariaId, "financialClosures");
  const source = consortiumId
    ? query(baseCollection, where("consortiumId", "==", consortiumId))
    : periodId
      ? query(baseCollection, where("periodId", "==", periodId))
      : baseCollection;
  const snapshot = await getDocs(source);
  return snapshot.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .filter((item) => !periodId || item.periodId === periodId)
    .sort((first, second) => Number(second.version || 0) - Number(first.version || 0));
};

export const closeConsortiumFinancialPeriod = async ({
  inmobiliariaId,
  consortiumId,
  periodId,
  reason = "",
}) => {
  await assertAgency(inmobiliariaId);
  const user = currentUserOrThrow();
  const [period, accounts, movements, unitObligations, supplierObligations, previous] = await Promise.all([
    getConsortiumPeriodById(inmobiliariaId, periodId),
    getConsortiumTreasuryAccounts(inmobiliariaId, consortiumId),
    getConsortiumTreasuryMovements(inmobiliariaId, consortiumId),
    getConsortiumObligations(inmobiliariaId, { consortiumId }),
    getConsortiumSupplierObligations(inmobiliariaId, { consortiumId, includeVoided: true }),
    getConsortiumFinancialClosures(inmobiliariaId, { consortiumId, periodId }),
  ]);
  if (!period || period.consortiumId !== consortiumId) throw new Error("La liquidación no existe.");
  if (period.status === "draft") throw new Error("Emití la liquidación antes de cerrar su estado económico.");
  const normalizedReason = cleanText(reason, 1000);
  if (previous.length && !normalizedReason) {
    throw new Error("Explicá el motivo de la nueva versión o rectificación.");
  }
  const statement = buildConsortiumEconomicStatement({
    period,
    accounts,
    movements,
    unitObligations,
    supplierObligations,
  });
  const summary = {
    openingBalanceMinor: statement.openingBalanceMinor,
    collectionsMinor: statement.collectionsMinor,
    otherInflowsMinor: statement.otherInflowsMinor,
    supplierPaymentsMinor: statement.supplierPaymentsMinor,
    otherOutflowsMinor: statement.otherOutflowsMinor,
    closingBalanceMinor: statement.closingBalanceMinor,
    unitDebtMinor: statement.unitDebtMinor,
    supplierDebtMinor: statement.supplierDebtMinor,
    reserveFundsMinor: statement.reserveFundsMinor,
    assessedMinor: statement.assessedMinor,
    transferVolumeMinor: statement.transferVolumeMinor,
    movementCount: statement.movements.length,
  };
  const latest = previous[0] || null;
  const summaryChanged = Object.entries(summary).some(([key, value]) => (
    Number(latest?.summary?.[key] || 0) !== Number(value || 0)
  ));
  if (latest && !summaryChanged) {
    throw new Error("El estado económico no cambió desde la última versión cerrada.");
  }
  const closureRef = doc(agencyCollection(inmobiliariaId, "financialClosures"));
  await setDoc(closureRef, {
    id: closureRef.id,
    schemaVersion: 1,
    inmobiliariaId,
    ownerInmobiliariaId: inmobiliariaId,
    consortiumId,
    periodId,
    periodKey: period.periodKey || "",
    currency: period.currency || "ARS",
    version: Number(latest?.version || 0) + 1,
    type: latest ? "rectification" : "initial_close",
    previousClosureId: latest?.id || "",
    reason: normalizedReason,
    summary,
    createdBy: user.uid,
    createdAt: serverTimestamp(),
  });
  return closureRef.id;
};

export const registerConsortiumSupplierPayment = async ({
  inmobiliariaId,
  obligationId,
  accountId,
  amountMinor,
  date,
  method = "transfer",
  reference = "",
  notes = "",
  file = null,
}) => {
  await assertAgency(inmobiliariaId);
  const user = currentUserOrThrow();
  const amount = Math.max(0, Math.round(Number(amountMinor) || 0));
  if (!amount) throw new Error("Ingresá un importe mayor a cero.");
  const paymentDate = validDateOrThrow(date, "la fecha del pago");
  if (paymentDate > new Date().toISOString().slice(0, 10)) {
    throw new Error("No se puede registrar como realizado un pago con fecha futura.");
  }
  const obligationPreflight = await getDoc(agencyDoc(inmobiliariaId, "supplierObligations", obligationId));
  if (!obligationPreflight.exists() || obligationPreflight.data().voided === true) {
    throw new Error("La obligación no está disponible.");
  }
  const paymentRef = doc(agencyCollection(inmobiliariaId, "supplierPayments"));
  const movementRef = doc(agencyCollection(inmobiliariaId, "treasuryMovements"));
  let proof = {
    proofStoragePath: "",
    proofFileName: "",
    proofContentType: "",
    proofSize: 0,
  };
  if (file) {
    validateConsortiumFileOrThrow(file);
    const safeName = safeConsortiumFileName(file.name);
    const path = `consorcios/${inmobiliariaId}/${obligationPreflight.data().consortiumId}/supplier-payments/${paymentRef.id}/${safeName}`;
    await uploadPrivateFile({
      file,
      path,
      metadata: { inmobiliariaId, paymentId: paymentRef.id, uploadedBy: user.uid },
    });
    proof = {
      proofStoragePath: path,
      proofFileName: safeName,
      proofContentType: file.type,
      proofSize: Number(file.size || 0),
    };
  }
  try {
    await runTransaction(db, async (transaction) => {
      const obligationRef = agencyDoc(inmobiliariaId, "supplierObligations", obligationId);
      const accountRef = agencyDoc(inmobiliariaId, "treasuryAccounts", accountId);
      const [obligationSnap, accountSnap] = await Promise.all([
        transaction.get(obligationRef),
        transaction.get(accountRef),
      ]);
      if (!obligationSnap.exists() || obligationSnap.data().voided === true) {
        throw new Error("La obligación no está disponible.");
      }
      if (!accountSnap.exists() || accountSnap.data().active === false) {
        throw new Error("La cuenta de tesorería no está disponible.");
      }
      const obligation = obligationSnap.data();
      const account = accountSnap.data();
      if (account.consortiumId !== obligation.consortiumId) {
        throw new Error("La cuenta y la obligación pertenecen a consorcios diferentes.");
      }
      if ((account.currency || "ARS") !== (obligation.currency || "ARS")) {
        throw new Error("La moneda de la cuenta no coincide con la obligación.");
      }
      const balance = Math.max(0, Number(obligation.balanceMinor) || 0);
      const available = Math.max(0, Number(account.currentBalanceMinor) || 0);
      if (amount > balance) throw new Error("El pago no puede superar el saldo de la obligación.");
      if (amount > available) throw new Error("La cuenta seleccionada no tiene saldo suficiente.");
      const paidAmountMinor = Math.max(0, Number(obligation.paidAmountMinor) || 0) + amount;
      const balanceMinor = Math.max(0, Number(obligation.amountMinor || 0) - paidAmountMinor);
      const currentBalanceMinor = available - amount;
      const payment = {
        id: paymentRef.id,
        schemaVersion: 1,
        inmobiliariaId,
        ownerInmobiliariaId: inmobiliariaId,
        consortiumId: obligation.consortiumId,
        obligationId,
        supplierId: obligation.supplierId,
        supplierSnapshot: obligation.supplierSnapshot || {},
        accountId,
        accountSnapshot: { name: account.name || "", type: account.type || "bank" },
        currency: obligation.currency || "ARS",
        amountMinor: amount,
        date: paymentDate,
        method: cleanText(method, 40) || "transfer",
        reference: cleanText(reference, 220),
        notes: cleanText(notes, 1000),
        movementId: movementRef.id,
        voided: false,
        ...proof,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      transaction.set(paymentRef, payment);
      transaction.set(movementRef, {
        id: movementRef.id,
        schemaVersion: 1,
        inmobiliariaId,
        ownerInmobiliariaId: inmobiliariaId,
        consortiumId: obligation.consortiumId,
        accountId,
        accountSnapshot: payment.accountSnapshot,
        source: "supplier_payment",
        sourceId: paymentRef.id,
        direction: "outflow",
        amountMinor: amount,
        currency: payment.currency,
        date: paymentDate,
        concept: `Pago a ${obligation.supplierSnapshot?.name || "proveedor"}: ${obligation.concept || ""}`,
        reference: payment.reference,
        voided: false,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
      });
      transaction.update(obligationRef, {
        paidAmountMinor,
        balanceMinor,
        status: balanceMinor <= 0 ? "paid" : "partial",
        paymentIds: [...(Array.isArray(obligation.paymentIds) ? obligation.paymentIds : []), paymentRef.id],
        updatedBy: user.uid,
        updatedAt: serverTimestamp(),
      });
      transaction.update(accountRef, {
        currentBalanceMinor,
        updatedBy: user.uid,
        updatedAt: serverTimestamp(),
      });
    });
  } catch (error) {
    if (proof.proofStoragePath) {
      await deleteObject(storageRef(storage, proof.proofStoragePath)).catch(() => {});
    }
    throw error;
  }
  return paymentRef.id;
};

export const voidConsortiumSupplierPayment = async ({ inmobiliariaId, paymentId, reason }) => {
  await assertAgency(inmobiliariaId);
  const user = currentUserOrThrow();
  const voidReason = cleanText(reason, 500);
  if (!voidReason) throw new Error("Ingresá el motivo de la anulación.");
  const paymentRef = agencyDoc(inmobiliariaId, "supplierPayments", paymentId);
  const reversalRef = doc(agencyCollection(inmobiliariaId, "treasuryMovements"));
  await runTransaction(db, async (transaction) => {
    const paymentSnap = await transaction.get(paymentRef);
    if (!paymentSnap.exists()) throw new Error("El pago no existe.");
    const payment = paymentSnap.data();
    if (payment.voided === true) throw new Error("El pago ya está anulado.");
    const obligationRef = agencyDoc(inmobiliariaId, "supplierObligations", payment.obligationId);
    const accountRef = agencyDoc(inmobiliariaId, "treasuryAccounts", payment.accountId);
    const [obligationSnap, accountSnap] = await Promise.all([
      transaction.get(obligationRef),
      transaction.get(accountRef),
    ]);
    if (!obligationSnap.exists() || !accountSnap.exists()) {
      throw new Error("No se pudo reconstruir el saldo del pago.");
    }
    const amount = Math.max(0, Number(payment.amountMinor) || 0);
    const obligation = obligationSnap.data();
    const account = accountSnap.data();
    const paidAmountMinor = Math.max(0, Number(obligation.paidAmountMinor || 0) - amount);
    const balanceMinor = Math.max(0, Number(obligation.amountMinor || 0) - paidAmountMinor);
    transaction.update(paymentRef, {
      voided: true,
      voidReason,
      reversalMovementId: reversalRef.id,
      voidedBy: user.uid,
      voidedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    transaction.set(reversalRef, {
      id: reversalRef.id,
      schemaVersion: 1,
      inmobiliariaId,
      ownerInmobiliariaId: inmobiliariaId,
      consortiumId: payment.consortiumId,
      accountId: payment.accountId,
      accountSnapshot: payment.accountSnapshot || {},
      source: "supplier_payment_reversal",
      sourceId: paymentId,
      reversesMovementId: payment.movementId || "",
      direction: "inflow",
      amountMinor: amount,
      currency: payment.currency || "ARS",
      date: new Date().toISOString().slice(0, 10),
      concept: `Anulación de pago a ${payment.supplierSnapshot?.name || "proveedor"}`,
      reference: voidReason,
      voided: false,
      createdBy: user.uid,
      createdAt: serverTimestamp(),
    });
    transaction.update(obligationRef, {
      paidAmountMinor,
      balanceMinor,
      status: paidAmountMinor > 0 ? "partial" : "pending",
      updatedBy: user.uid,
      updatedAt: serverTimestamp(),
    });
    transaction.update(accountRef, {
      currentBalanceMinor: Math.max(0, Number(account.currentBalanceMinor || 0)) + amount,
      updatedBy: user.uid,
      updatedAt: serverTimestamp(),
    });
  });
};

const CLAIM_STATUSES = [
  "open", "in_review", "scheduled", "in_progress", "resolved", "closed", "rejected",
];
const CLAIM_PRIORITIES = ["low", "normal", "high", "urgent"];
const CLAIM_COMMUNICATION_TYPES = ["notice", "request", "claim"];
const CLAIM_STATUS_LABELS = {
  open: "recibido",
  in_review: "en revisión",
  scheduled: "visita programada",
  in_progress: "en curso",
  resolved: "resuelto",
  closed: "cerrado",
  rejected: "no corresponde",
};
const CLAIM_PRIORITY_LABELS = {
  low: "baja",
  normal: "normal",
  high: "alta",
  urgent: "urgente",
};
const CLAIM_CATEGORIES = [
  "plumbing", "electricity", "gas", "elevator", "security", "cleaning",
  "common_area", "administration", "other",
];

const assertClaimPortalAccess = async ({ inmobiliariaId, unitId }) => {
  const user = assertPortalUser();
  const unitSnap = await getDoc(agencyDoc(inmobiliariaId, "units", unitId));
  const email = user.email.toLowerCase();
  if (!unitSnap.exists() || !(unitSnap.data().portalEmails || []).includes(email)) {
    throw new Error("No tenés acceso a la unidad seleccionada.");
  }
  return { user, unit: { id: unitSnap.id, ...unitSnap.data() } };
};

const claimAuthorName = (user) => cleanText(
  user.displayName || user.email?.split("@")[0] || "Usuario",
  160,
);

export const getConsortiumClaims = async (
  inmobiliariaId,
  { consortiumId = "", unitId = "", includeClosed = true } = {},
) => {
  if (!inmobiliariaId) return [];
  const source = unitId
    ? query(
      agencyCollection(inmobiliariaId, "claims"),
      where("unitId", "==", unitId),
      where("portalVisible", "==", true),
    )
    : agencyCollection(inmobiliariaId, "claims");
  const snap = await getDocs(source);
  return sortUpdatedDesc(snap.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .filter((item) => !consortiumId || item.consortiumId === consortiumId)
    .filter((item) => !unitId || item.unitId === unitId)
    .filter((item) => includeClosed || !["resolved", "closed", "rejected"].includes(item.status)));
};

export const getConsortiumClaimEvents = async (
  inmobiliariaId,
  { claimId = "", portalOnly = false } = {},
) => {
  if (!inmobiliariaId || !claimId) return [];
  const source = portalOnly
    ? query(
      agencyCollection(inmobiliariaId, "claimEvents"),
      where("claimId", "==", claimId),
      where("visibility", "==", "public"),
    )
    : query(agencyCollection(inmobiliariaId, "claimEvents"), where("claimId", "==", claimId));
  const snap = await getDocs(source);
  return snap.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .filter((item) => item.claimId === claimId)
    .filter((item) => !portalOnly || item.visibility === "public")
    .sort((a, b) => (a.createdAtIso || "").localeCompare(b.createdAtIso || ""));
};

export const createConsortiumClaim = async ({
  inmobiliariaId,
  consortiumId,
  unitId,
  title,
  description,
  communicationType = "request",
  category = "other",
  priority = "normal",
  location = "common_area",
  accessNotes = "",
  authorRole = "resident",
  file = null,
}) => {
  await assertAgency(inmobiliariaId);
  const access = authorRole === "resident"
    ? await assertClaimPortalAccess({ inmobiliariaId, unitId })
    : { user: currentUserOrThrow(), unit: null };
  const user = access.user;
  let unit = access.unit;
  if (!unit) {
    const unitSnap = await getDoc(agencyDoc(inmobiliariaId, "units", unitId));
    if (!unitSnap.exists()) throw new Error("La unidad no existe.");
    unit = { id: unitSnap.id, ...unitSnap.data() };
  }
  if (unit.consortiumId !== consortiumId) throw new Error("La unidad pertenece a otro consorcio.");
  const normalizedTitle = cleanText(title, 180);
  const normalizedDescription = cleanText(description, 4000);
  if (!normalizedTitle) throw new Error("Ingresá un título para el mensaje.");
  if (normalizedDescription.length < 10) throw new Error("Describí el problema con un poco más de detalle.");
  const normalizedCommunicationType = CLAIM_COMMUNICATION_TYPES.includes(communicationType)
    ? communicationType
    : "request";
  const claimRef = doc(agencyCollection(inmobiliariaId, "claims"));
  const eventRef = doc(agencyCollection(inmobiliariaId, "claimEvents"));
  const createdAtIso = new Date().toISOString();
  let attachment = {
    attachmentStoragePath: "",
    attachmentFileName: "",
    attachmentContentType: "",
    attachmentSize: 0,
  };
  if (file) {
    validateConsortiumFileOrThrow(file);
    const safeName = safeConsortiumFileName(file.name);
    const path = `consorcios/${inmobiliariaId}/${consortiumId}/claims/${unitId}/${claimRef.id}/initial/${safeName}`;
    await uploadPrivateFile({
      file,
      path,
      metadata: { inmobiliariaId, consortiumId, unitId, claimId: claimRef.id, uploadedBy: user.uid },
    });
    attachment = {
      attachmentStoragePath: path,
      attachmentFileName: safeName,
      attachmentContentType: file.type,
      attachmentSize: Number(file.size || 0),
    };
  }
  const normalizedRole = authorRole === "admin" ? "admin" : "resident";
  const authorName = claimAuthorName(user);
  const claim = {
    id: claimRef.id,
    schemaVersion: 1,
    inmobiliariaId,
    ownerInmobiliariaId: inmobiliariaId,
    consortiumId,
    unitId,
    unitSnapshot: {
      code: unit.code || "",
      ownerName: unit.ownerName || "",
      occupantName: unit.occupantName || "",
    },
    title: normalizedTitle,
    description: normalizedDescription,
    communicationType: normalizedCommunicationType,
    category: CLAIM_CATEGORIES.includes(category) ? category : "other",
    priority: CLAIM_PRIORITIES.includes(priority) ? priority : "normal",
    location: location === "unit" ? "unit" : "common_area",
    accessNotes: cleanText(accessNotes, 1000),
    status: "open",
    featuredInPortal: false,
    portalPublicTitle: "",
    assignedSupplierId: "",
    assignedSupplierSnapshot: {},
    scheduledDate: "",
    resolutionSummary: "",
    portalVisible: true,
    submittedBy: user.uid,
    submittedByEmail: user.email?.toLowerCase?.() || "",
    submittedByName: authorName,
    createdByType: normalizedRole,
    createdDate: createdAtIso.slice(0, 10),
    createdAtIso,
    lastActivityAtIso: createdAtIso,
    lastPublicMessage: "Mensaje recibido por la administración.",
    deleted: false,
    ...attachment,
    createdBy: user.uid,
    createdAt: serverTimestamp(),
    updatedBy: user.uid,
    updatedAt: serverTimestamp(),
  };
  const batch = writeBatch(db);
  batch.set(claimRef, claim);
  batch.set(eventRef, {
    id: eventRef.id,
    schemaVersion: 1,
    inmobiliariaId,
    ownerInmobiliariaId: inmobiliariaId,
    consortiumId,
    unitId,
    claimId: claimRef.id,
    type: "created",
    visibility: "public",
    message: "Mensaje recibido por la administración.",
    communicationType: normalizedCommunicationType,
    status: "open",
    authorRole: normalizedRole,
    authorId: user.uid,
    authorName,
    createdAtIso,
    attachmentStoragePath: "",
    attachmentFileName: "",
    createdAt: serverTimestamp(),
  });
  try {
    await batch.commit();
  } catch (error) {
    if (attachment.attachmentStoragePath) {
      await deleteObject(storageRef(storage, attachment.attachmentStoragePath)).catch(() => {});
    }
    throw error;
  }
  return claimRef.id;
};

export const updateConsortiumClaim = async ({
  inmobiliariaId,
  claimId,
  status,
  priority,
  assignedSupplierId = "",
  scheduledDate = "",
  resolutionSummary = "",
  featuredInPortal = false,
  portalPublicTitle = "",
}) => {
  await assertAgency(inmobiliariaId);
  const user = currentUserOrThrow();
  const claimRef = agencyDoc(inmobiliariaId, "claims", claimId);
  const claimSnap = await getDoc(claimRef);
  if (!claimSnap.exists()) throw new Error("El mensaje no existe.");
  const current = claimSnap.data();
  const normalizedStatus = CLAIM_STATUSES.includes(status) ? status : current.status || "open";
  const normalizedPriority = CLAIM_PRIORITIES.includes(priority) ? priority : current.priority || "normal";
  const normalizedScheduledDate = /^\d{4}-\d{2}-\d{2}$/.test(scheduledDate || "")
    ? scheduledDate : "";
  if (normalizedStatus === "scheduled" && !normalizedScheduledDate) {
    throw new Error("Ingresá la fecha programada para la visita o tarea.");
  }
  const normalizedResolution = cleanText(resolutionSummary, 2000);
  const normalizedFeatured = featuredInPortal === true;
  const normalizedPortalPublicTitle = cleanText(portalPublicTitle, 220);
  if (["resolved", "closed", "rejected"].includes(normalizedStatus) && !normalizedResolution) {
    throw new Error("Explicá cómo se resolvió o por qué se cerró el mensaje.");
  }
  let supplierSnapshot = {};
  if (assignedSupplierId) {
    const supplier = await getDoc(agencyDoc(inmobiliariaId, "suppliers", assignedSupplierId));
    if (!supplier.exists() || supplier.data().consortiumId !== current.consortiumId) {
      throw new Error("El proveedor asignado no pertenece a este consorcio.");
    }
    supplierSnapshot = {
      name: supplier.data().name || "",
      category: supplier.data().category || "other",
      phone: supplier.data().phone || "",
    };
  }
  const changes = [];
  if (normalizedStatus !== current.status) {
    changes.push(`Estado actualizado a ${CLAIM_STATUS_LABELS[normalizedStatus]}.`);
  }
  if (normalizedPriority !== current.priority) {
    changes.push(`Prioridad actualizada a ${CLAIM_PRIORITY_LABELS[normalizedPriority]}.`);
  }
  if (assignedSupplierId !== (current.assignedSupplierId || "")) {
    changes.push(assignedSupplierId
      ? `Proveedor asignado: ${supplierSnapshot.name}.`
      : "Se quitó el proveedor asignado.");
  }
  if (normalizedScheduledDate !== (current.scheduledDate || "")) {
    changes.push(normalizedScheduledDate
      ? `Intervención programada para el ${normalizedScheduledDate}.`
      : "Se retiró la fecha programada.");
  }
  if (normalizedResolution && normalizedResolution !== (current.resolutionSummary || "")) {
    changes.push(normalizedResolution);
  }
  if (normalizedFeatured !== (current.featuredInPortal === true)) {
    changes.push(normalizedFeatured
      ? "La gestión fue destacada en el tablero de propietarios."
      : "La gestión dejó de estar destacada en el tablero de propietarios.");
  }
  if (normalizedPortalPublicTitle !== (current.portalPublicTitle || "")) {
    changes.push("Se actualizó el título anonimizado del tablero de propietarios.");
  }
  if (!changes.length) throw new Error("No hay cambios para guardar.");
  const createdAtIso = new Date().toISOString();
  const eventRef = doc(agencyCollection(inmobiliariaId, "claimEvents"));
  const publicMessage = changes.join(" ");
  const batch = writeBatch(db);
  batch.update(claimRef, {
    status: normalizedStatus,
    priority: normalizedPriority,
    assignedSupplierId,
    assignedSupplierSnapshot: supplierSnapshot,
    scheduledDate: normalizedScheduledDate,
    resolutionSummary: normalizedResolution,
    featuredInPortal: normalizedFeatured,
    portalPublicTitle: normalizedPortalPublicTitle,
    lastActivityAtIso: createdAtIso,
    lastPublicMessage: publicMessage,
    resolvedAtIso: normalizedStatus === "resolved" ? createdAtIso : current.resolvedAtIso || "",
    closedAtIso: normalizedStatus === "closed" ? createdAtIso : current.closedAtIso || "",
    updatedBy: user.uid,
    updatedAt: serverTimestamp(),
  });
  batch.set(eventRef, {
    id: eventRef.id,
    schemaVersion: 1,
    inmobiliariaId,
    ownerInmobiliariaId: inmobiliariaId,
    consortiumId: current.consortiumId,
    unitId: current.unitId,
    claimId,
    type: normalizedStatus !== current.status ? "status_update" : "management_update",
    visibility: "public",
    message: publicMessage,
    previousStatus: current.status || "open",
    status: normalizedStatus,
    previousPriority: current.priority || "normal",
    priority: normalizedPriority,
    communicationType: current.communicationType || "claim",
    authorRole: "admin",
    authorId: user.uid,
    authorName: claimAuthorName(user),
    createdAtIso,
    attachmentStoragePath: "",
    attachmentFileName: "",
    createdAt: serverTimestamp(),
  });
  await batch.commit();
};

export const addConsortiumClaimMessage = async ({
  inmobiliariaId,
  claimId,
  message = "",
  visibility = "public",
  authorRole = "resident",
  file = null,
}) => {
  await assertAgency(inmobiliariaId);
  const claimRef = agencyDoc(inmobiliariaId, "claims", claimId);
  const claimSnap = await getDoc(claimRef);
  if (!claimSnap.exists()) throw new Error("El mensaje no existe.");
  const claim = claimSnap.data();
  const access = authorRole === "resident"
    ? await assertClaimPortalAccess({ inmobiliariaId, unitId: claim.unitId })
    : { user: currentUserOrThrow() };
  const user = access.user;
  const normalizedMessage = cleanText(message, 3000);
  if (!normalizedMessage && !file) throw new Error("Escribí un mensaje o adjuntá un archivo.");
  const eventRef = doc(agencyCollection(inmobiliariaId, "claimEvents"));
  const normalizedVisibility = visibility === "internal" ? "internal" : "public";
  const normalizedRole = authorRole === "admin" ? "admin" : "resident";
  let attachment = {
    attachmentStoragePath: "",
    attachmentFileName: "",
    attachmentContentType: "",
    attachmentSize: 0,
  };
  if (file) {
    validateConsortiumFileOrThrow(file);
    const safeName = safeConsortiumFileName(file.name);
    const path = `consorcios/${inmobiliariaId}/${claim.consortiumId}/claims/${claim.unitId}/${claimId}/events/${eventRef.id}/${safeName}`;
    await uploadPrivateFile({
      file,
      path,
      metadata: {
        inmobiliariaId,
        consortiumId: claim.consortiumId,
        unitId: claim.unitId,
        claimId,
        eventId: eventRef.id,
        uploadedBy: user.uid,
      },
    });
    attachment = {
      attachmentStoragePath: path,
      attachmentFileName: safeName,
      attachmentContentType: file.type,
      attachmentSize: Number(file.size || 0),
    };
  }
  const createdAtIso = new Date().toISOString();
  const batch = writeBatch(db);
  batch.set(eventRef, {
    id: eventRef.id,
    schemaVersion: 1,
    inmobiliariaId,
    ownerInmobiliariaId: inmobiliariaId,
    consortiumId: claim.consortiumId,
    unitId: claim.unitId,
    claimId,
    type: "message",
    visibility: normalizedVisibility,
    message: normalizedMessage || "Archivo adjunto.",
    communicationType: claim.communicationType || "claim",
    status: claim.status,
    authorRole: normalizedRole,
    authorId: user.uid,
    authorName: claimAuthorName(user),
    createdAtIso,
    ...attachment,
    createdAt: serverTimestamp(),
  });
  batch.update(claimRef, {
    lastActivityAtIso: createdAtIso,
    ...(normalizedVisibility === "public" ? {
      lastPublicMessage: normalizedMessage || "Se agregó un archivo al mensaje.",
    } : {}),
    updatedBy: user.uid,
    updatedAt: serverTimestamp(),
  });
  try {
    await batch.commit();
  } catch (error) {
    if (attachment.attachmentStoragePath) {
      await deleteObject(storageRef(storage, attachment.attachmentStoragePath)).catch(() => {});
    }
    throw error;
  }
  return eventRef.id;
};

const COLLECTION_ACTION_TYPES = new Set([
  "contact",
  "promise",
  "notice",
  "note",
  "agreement_created",
  "agreement_status",
]);

const COLLECTION_CHANNELS = new Set([
  "phone",
  "whatsapp",
  "email",
  "in_person",
  "letter",
  "system",
  "other",
]);

const collectionActorSnapshot = (user) => ({
  uid: user.uid,
  name: cleanText(user.displayName, 160),
  email: cleanText(user.email, 220),
});

export const getConsortiumCollectionActions = async (
  inmobiliariaId,
  { consortiumId = "", unitId = "" } = {},
) => {
  if (!inmobiliariaId) return [];
  const source = consortiumId
    ? query(
      agencyCollection(inmobiliariaId, "collectionActions"),
      where("consortiumId", "==", consortiumId),
    )
    : agencyCollection(inmobiliariaId, "collectionActions");
  const snap = await getDocs(source);
  return snap.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .filter((item) => !unitId || item.unitId === unitId)
    .sort((left, right) => (
      (right.occurredOn || "").localeCompare(left.occurredOn || "") ||
      timestampMillis(right.createdAt) - timestampMillis(left.createdAt)
    ));
};

export const recordConsortiumCollectionAction = async ({
  inmobiliariaId,
  consortiumId,
  unitId,
  type,
  channel = "other",
  occurredOn,
  outcome = "",
  notes = "",
  promiseAmountMinor = 0,
  promiseDueDate = "",
}) => {
  await assertAgency(inmobiliariaId);
  const user = currentUserOrThrow();
  const normalizedType = cleanText(type, 40);
  const normalizedChannel = cleanText(channel, 40);
  if (!COLLECTION_ACTION_TYPES.has(normalizedType) ||
    !COLLECTION_CHANNELS.has(normalizedChannel)) {
    throw new Error("El tipo o canal de la gestión no es válido.");
  }
  if (!hasValidDateKey(occurredOn)) throw new Error("Ingresá la fecha de la gestión.");
  if (normalizedType === "promise" &&
    (!(Number(promiseAmountMinor) > 0) || !hasValidDateKey(promiseDueDate))) {
    throw new Error("La promesa requiere importe y fecha comprometida.");
  }
  if (!cleanText(notes, 3000) && !cleanText(outcome, 500)) {
    throw new Error("Describí el resultado o las observaciones de la gestión.");
  }
  const unitSnap = await getDoc(agencyDoc(inmobiliariaId, "units", unitId));
  if (!unitSnap.exists() || unitSnap.data()?.consortiumId !== consortiumId ||
    unitSnap.data()?.deleted === true) {
    throw new Error("La unidad no pertenece al consorcio.");
  }
  const unit = unitSnap.data() || {};
  const ref = doc(agencyCollection(inmobiliariaId, "collectionActions"));
  await setDoc(ref, {
    id: ref.id,
    schemaVersion: 1,
    inmobiliariaId,
    ownerInmobiliariaId: inmobiliariaId,
    consortiumId,
    unitId,
    unitSnapshot: {
      code: cleanText(unit.code, 80),
      ownerName: cleanText(unit.ownerName, 220),
      occupantName: cleanText(unit.occupantName, 220),
    },
    type: normalizedType,
    channel: normalizedChannel,
    occurredOn,
    outcome: cleanText(outcome, 500),
    notes: cleanText(notes, 3000),
    promiseAmountMinor: normalizedType === "promise"
      ? Math.round(Number(promiseAmountMinor)) : 0,
    promiseDueDate: normalizedType === "promise" ? promiseDueDate : "",
    promiseStatus: normalizedType === "promise" ? "pending" : "",
    immutable: true,
    createdBy: user.uid,
    createdBySnapshot: collectionActorSnapshot(user),
    createdAt: serverTimestamp(),
  });
  return ref.id;
};

export const getConsortiumPaymentAgreements = async (
  inmobiliariaId,
  { consortiumId = "", unitId = "" } = {},
) => {
  if (!inmobiliariaId) return [];
  const source = consortiumId
    ? query(
      agencyCollection(inmobiliariaId, "paymentAgreements"),
      where("consortiumId", "==", consortiumId),
    )
    : agencyCollection(inmobiliariaId, "paymentAgreements");
  const snap = await getDocs(source);
  return snap.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .filter((item) => !unitId || item.unitId === unitId)
    .sort((left, right) => (
      (right.agreementDate || "").localeCompare(left.agreementDate || "") ||
      timestampMillis(right.createdAt) - timestampMillis(left.createdAt)
    ));
};

export const createConsortiumPaymentAgreement = async ({
  inmobiliariaId,
  consortiumId,
  unitId,
  obligationIds = [],
  agreementDate,
  agreedAmountMinor,
  downPaymentMinor = 0,
  installmentCount = 1,
  firstDueDate,
  notes = "",
}) => {
  await assertAgency(inmobiliariaId);
  const user = currentUserOrThrow();
  if (!hasValidDateKey(agreementDate) || !hasValidDateKey(firstDueDate)) {
    throw new Error("Revisá las fechas del convenio.");
  }
  const normalizedObligationIds = [...new Set(
    (Array.isArray(obligationIds) ? obligationIds : []).map((item) => cleanText(item, 128)),
  )].filter(Boolean);
  if (!normalizedObligationIds.length) {
    throw new Error("Seleccioná al menos una deuda para el convenio.");
  }
  const [unitSnap, ...obligationSnaps] = await Promise.all([
    getDoc(agencyDoc(inmobiliariaId, "units", unitId)),
    ...normalizedObligationIds.map((id) => (
      getDoc(agencyDoc(inmobiliariaId, "obligations", id))
    )),
  ]);
  if (!unitSnap.exists() || unitSnap.data()?.consortiumId !== consortiumId) {
    throw new Error("La unidad no pertenece al consorcio.");
  }
  const obligations = obligationSnaps.map((snap) => {
    if (!snap.exists() || snap.data()?.consortiumId !== consortiumId ||
      snap.data()?.unitId !== unitId || snap.data()?.voided === true ||
      !(Number(snap.data()?.balanceMinor) > 0)) {
      throw new Error("Una de las deudas seleccionadas ya no es válida.");
    }
    return { id: snap.id, ...snap.data() };
  });
  const originalDebtMinor = obligations.reduce(
    (sum, item) => sum + Math.max(0, Math.round(Number(item.balanceMinor) || 0)),
    0,
  );
  const agreed = Math.round(Number(agreedAmountMinor) || 0);
  const downPayment = Math.round(Number(downPaymentMinor) || 0);
  const count = Math.max(1, Math.min(60, Math.trunc(Number(installmentCount) || 1)));
  if (!(originalDebtMinor > 0)) throw new Error("Las deudas seleccionadas no tienen saldo.");
  if (!(agreed > 0) || downPayment < 0 || downPayment >= agreed) {
    throw new Error("Los importes del convenio no son válidos.");
  }
  const schedule = buildConsortiumPaymentAgreementSchedule({
    agreedAmountMinor: agreed,
    downPaymentMinor: downPayment,
    installmentCount: count,
    firstDueDate,
  });
  const unit = unitSnap.data() || {};
  const agreementRef = doc(agencyCollection(inmobiliariaId, "paymentAgreements"));
  const actionRef = doc(agencyCollection(inmobiliariaId, "collectionActions"));
  const actor = collectionActorSnapshot(user);
  const batch = writeBatch(db);
  batch.set(agreementRef, {
    id: agreementRef.id,
    schemaVersion: 1,
    inmobiliariaId,
    ownerInmobiliariaId: inmobiliariaId,
    consortiumId,
    unitId,
    unitSnapshot: {
      code: cleanText(unit.code, 80),
      ownerName: cleanText(unit.ownerName, 220),
      occupantName: cleanText(unit.occupantName, 220),
    },
    obligationIds: normalizedObligationIds,
    obligationSnapshots: obligations.map((item) => ({
      id: item.id,
      periodKey: cleanText(item.periodKey, 10),
      dueDate: cleanText(item.dueDate, 10),
      balanceMinor: Math.max(0, Math.round(Number(item.balanceMinor) || 0)),
    })),
    agreementDate,
    originalDebtMinor,
    agreedAmountMinor: agreed,
    discountMinor: Math.max(0, originalDebtMinor - agreed),
    surchargeMinor: Math.max(0, agreed - originalDebtMinor),
    downPaymentMinor: downPayment,
    financedAmountMinor: agreed - downPayment,
    installmentCount: count,
    firstDueDate,
    schedule,
    status: "active",
    notes: cleanText(notes, 3000),
    accountingEffect: "none_until_payment",
    createdBy: user.uid,
    createdBySnapshot: actor,
    createdAt: serverTimestamp(),
    updatedBy: user.uid,
    updatedAt: serverTimestamp(),
  });
  batch.set(actionRef, {
    id: actionRef.id,
    schemaVersion: 1,
    inmobiliariaId,
    ownerInmobiliariaId: inmobiliariaId,
    consortiumId,
    unitId,
    unitSnapshot: {
      code: cleanText(unit.code, 80),
      ownerName: cleanText(unit.ownerName, 220),
      occupantName: cleanText(unit.occupantName, 220),
    },
    type: "agreement_created",
    channel: "system",
    occurredOn: agreementDate,
    outcome: `Convenio ${agreementRef.id} creado`,
    notes: cleanText(notes, 3000),
    agreementId: agreementRef.id,
    promiseAmountMinor: agreed,
    promiseDueDate: firstDueDate,
    promiseStatus: "pending",
    immutable: true,
    createdBy: user.uid,
    createdBySnapshot: actor,
    createdAt: serverTimestamp(),
  });
  await batch.commit();
  return agreementRef.id;
};

export const updateConsortiumPaymentAgreementStatus = async ({
  inmobiliariaId,
  agreementId,
  status,
  reason = "",
}) => {
  await assertAgency(inmobiliariaId);
  const user = currentUserOrThrow();
  const normalizedStatus = cleanText(status, 40);
  if (!["active", "completed", "defaulted", "cancelled"].includes(normalizedStatus)) {
    throw new Error("El estado del convenio no es válido.");
  }
  const agreementRef = agencyDoc(inmobiliariaId, "paymentAgreements", agreementId);
  const agreementSnap = await getDoc(agreementRef);
  if (!agreementSnap.exists()) throw new Error("El convenio no existe.");
  const agreement = agreementSnap.data() || {};
  if (["defaulted", "cancelled"].includes(normalizedStatus) && !cleanText(reason, 1000)) {
    throw new Error("Indicá el motivo del cambio de estado.");
  }
  const actionRef = doc(agencyCollection(inmobiliariaId, "collectionActions"));
  const actor = collectionActorSnapshot(user);
  const today = new Date().toISOString().slice(0, 10);
  const batch = writeBatch(db);
  batch.update(agreementRef, {
    status: normalizedStatus,
    statusReason: cleanText(reason, 1000),
    statusChangedAt: serverTimestamp(),
    updatedBy: user.uid,
    updatedAt: serverTimestamp(),
  });
  batch.set(actionRef, {
    id: actionRef.id,
    schemaVersion: 1,
    inmobiliariaId,
    ownerInmobiliariaId: inmobiliariaId,
    consortiumId: agreement.consortiumId,
    unitId: agreement.unitId,
    unitSnapshot: agreement.unitSnapshot || {},
    type: "agreement_status",
    channel: "system",
    occurredOn: today,
    outcome: `Convenio ${agreementId}: ${normalizedStatus}`,
    notes: cleanText(reason, 1000),
    agreementId,
    promiseAmountMinor: 0,
    promiseDueDate: "",
    promiseStatus: "",
    immutable: true,
    createdBy: user.uid,
    createdBySnapshot: actor,
    createdAt: serverTimestamp(),
  });
  await batch.commit();
};
