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

const COLLECTIONS = {
  consortiums: "condominiums",
  units: "condominium_units",
  periods: "condominium_periods",
  obligations: "condominium_obligations",
  payments: "condominium_payments",
  expenseDocuments: "condominium_expense_documents",
  paymentReports: "condominium_payment_reports",
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

const sanitizeUnit = (value = {}) => ({
  schemaVersion: 1,
  consortiumId: cleanText(value.consortiumId, 128),
  code: cleanText(value.code, 80),
  floor: cleanText(value.floor, 40),
  apartment: cleanText(value.apartment, 40),
  type: cleanText(value.type, 40) || "apartment",
  coefficient: Math.max(0, Number(value.coefficient) || 0),
  ownerName: cleanText(value.ownerName, 220),
  ownerTaxId: cleanText(value.ownerTaxId, 32),
  occupantName: cleanText(value.occupantName, 220),
  email: cleanText(value.email, 220),
  phone: cleanText(value.phone, 80),
  portalEmails: normalizeConsortiumEmails(value.portalEmails),
  notes: cleanText(value.notes, 2000),
  active: value.active !== false,
  deleted: false,
});

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
  const payload = sanitizeUnit(value);
  const errors = validateConsortiumUnit(payload);
  if (errors.length) throw new Error(errors.join(" "));
  const unitRef = agencyDoc(inmobiliariaId, "units", unitId);
  const unitSnapshot = await getDoc(unitRef);
  if (!unitSnapshot.exists()) throw new Error("La unidad no existe.");
  if (unitSnapshot.data().consortiumId !== payload.consortiumId) {
    throw new Error("No se puede trasladar una unidad a otro consorcio.");
  }
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
  const batch = writeBatch(db);
  batch.update(unitRef, unitData);
  batch.update(agencyDoc(inmobiliariaId, "consortiums", payload.consortiumId), {
    portalEmails: getAggregatedPortalEmails(currentUnits, { id: unitId, ...unitData }),
    updatedAt: serverTimestamp(),
    updatedBy: user.uid,
  });
  await batch.commit();
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
