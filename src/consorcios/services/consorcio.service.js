import {
  collection,
  collectionGroup,
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

import { auth, db, storage } from "../../firebase/config";
import { assertInmobiliariaActiva } from "../../inmobiliaria/services/inmobiliaria.service";
import {
  calculateConsortiumAssessments,
  getConsortiumObligationStatus,
  validateConsortium,
  validateConsortiumUnit,
} from "../utils/consorcio.helpers";
import {
  isConsortiumDocumentFileValid,
  normalizeConsortiumEmails,
  safeConsortiumFileName,
} from "../utils/consorcioPortal.helpers";
import {
  getConsortiumUnitNotificationRecipients,
  normalizeConsortiumDeliveryPreference,
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
};

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
  const ownerEmail = normalizeConsortiumEmails([value.ownerEmail])[0] || "";
  const occupantEmail = normalizeConsortiumEmails([value.occupantEmail])[0] || "";
  const manualPortalEmails = normalizeConsortiumEmails(value.manualPortalEmails ?? value.portalEmails);
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
    email: cleanText(value.email, 220),
    phone: cleanText(value.phone, 80),
    manualPortalEmails,
    portalEmails: [],
    creditBalanceMinor: Math.max(0, Math.round(Number(value.creditBalanceMinor) || 0)),
    notes: cleanText(value.notes, 2000),
    active: value.active !== false,
    deleted: false,
  };
  unit.portalEmails = normalizeConsortiumEmails([
    ...manualPortalEmails,
    ...getConsortiumUnitNotificationRecipients(unit).map((item) => item.email),
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
  "email",
  "phone",
  "manualPortalEmails",
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

const getAggregatedPortalEmails = (units, replacement = null) => normalizeConsortiumEmails(
  units.flatMap((unit) => {
    if (replacement && unit.id === replacement.id) return replacement.portalEmails || [];
    if (unit.deleted === true || unit.active === false) return [];
    return unit.portalEmails || [];
  }).concat(
    replacement && !units.some((unit) => unit.id === replacement.id)
      ? replacement.portalEmails || []
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
    updatedAt: serverTimestamp(),
    updatedBy: user.uid,
  });
  await batch.commit();
};

export const getConsortiumPeriods = async (inmobiliariaId, consortiumId = "") => {
  if (!inmobiliariaId) return [];
  const snap = await getDocs(agencyCollection(inmobiliariaId, "periods"));
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
  const snap = await getDocs(agencyCollection(inmobiliariaId, "obligations"));
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

export const registerConsortiumPayment = async ({
  inmobiliariaId,
  obligationId,
  amountMinor,
  date,
  method,
  reference = "",
  notes = "",
}) => {
  await assertAgency(inmobiliariaId);
  const user = currentUserOrThrow();
  const amount = Math.max(0, Math.round(Number(amountMinor) || 0));
  if (!amount) throw new Error("Ingresá un importe mayor a cero.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) throw new Error("Ingresá la fecha del cobro.");
  const obligationRef = agencyDoc(inmobiliariaId, "obligations", obligationId);
  const paymentRef = doc(agencyCollection(inmobiliariaId, "payments"));
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(obligationRef);
    if (!snap.exists()) throw new Error("La expensa no existe.");
    const obligation = snap.data();
    const balance = Math.max(0, Number(obligation.balanceMinor) || 0);
    if (amount > balance) throw new Error("El cobro no puede superar el saldo de la unidad.");
    const paidAmountMinor = Math.max(0, Number(obligation.paidAmountMinor) || 0) + amount;
    const balanceMinor = Math.max(0, Number(obligation.totalAmountMinor) - paidAmountMinor);
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
      voided: false,
      inmobiliariaId,
      ownerInmobiliariaId: inmobiliariaId,
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    transaction.set(paymentRef, payment);
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
  await runTransaction(db, async (transaction) => {
    const paymentSnap = await transaction.get(paymentRef);
    if (!paymentSnap.exists()) throw new Error("El cobro no existe.");
    const payment = paymentSnap.data();
    if (payment.voided === true) throw new Error("El cobro ya está anulado.");
    const obligationRef = agencyDoc(inmobiliariaId, "obligations", payment.obligationId);
    const obligationSnap = await transaction.get(obligationRef);
    if (!obligationSnap.exists()) throw new Error("La expensa relacionada no existe.");
    const obligation = obligationSnap.data();
    const paidAmountMinor = Math.max(
      0,
      Number(obligation.paidAmountMinor || 0) - Number(payment.amountMinor || 0),
    );
    const balanceMinor = Math.max(0, Number(obligation.totalAmountMinor || 0) - paidAmountMinor);
    transaction.update(paymentRef, {
      voided: true,
      voidReason,
      voidedAt: serverTimestamp(),
      voidedBy: user.uid,
      updatedAt: serverTimestamp(),
    });
    transaction.update(obligationRef, {
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
};

export const closeConsortiumPeriod = async ({ inmobiliariaId, periodId }) => {
  await assertAgency(inmobiliariaId);
  const user = currentUserOrThrow();
  const obligations = await getConsortiumObligations(inmobiliariaId, { periodId });
  if (!obligations.length) throw new Error("La liquidación no tiene expensas emitidas.");
  if (obligations.some((item) => Number(item.balanceMinor || 0) > 0)) {
    throw new Error("No se puede cerrar mientras existan saldos pendientes.");
  }
  await updateDoc(agencyDoc(inmobiliariaId, "periods", periodId), {
    status: "closed",
    closedAt: serverTimestamp(),
    closedBy: user.uid,
    updatedAt: serverTimestamp(),
    updatedBy: user.uid,
  });
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
  const email = user.email.trim().toLowerCase();
  const snap = await getDocs(query(
    collectionGroup(db, COLLECTIONS.units),
    where("portalEmails", "array-contains", email),
  ));
  return snap.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .filter((item) => item.active !== false && item.deleted !== true)
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
