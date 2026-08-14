import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";

import { auth, db } from "../../firebase/config";
import { assertInmobiliariaActiva } from "../../inmobiliaria/services/inmobiliaria.service";
import {
  RENTAL_PAYMENT_METHODS,
  RENTAL_SETTLEMENT_RECEIPT_CONFIRMATION_METHODS,
} from "../utils/rental.constants";
import {
  buildRentalObligation,
  calculateRentalSettlement,
  getContractPeriodKeys,
  getNextAdjustmentDate,
  getObligationStatus,
  getPeriodKey,
  hasRentalObligationActivity,
  isRentalObligationWithinContract,
  syncRentalObligationFromContract,
  toDateKey,
  validateRentalContract,
} from "../utils/rental.helpers";
import {
  normalizeRentalContract,
  normalizeRentalParty,
} from "../utils/rentalSchema";

const AGENCY_COLLECTIONS = {
  people: "rental_people",
  contracts: "rental_contracts",
  obligations: "rental_obligations",
  expenses: "rental_expenses",
  settlements: "rental_settlements",
};

const rentalCollection = (inmobiliariaId, key) =>
  collection(db, "inmobiliarias", inmobiliariaId, AGENCY_COLLECTIONS[key]);

const rentalDoc = (inmobiliariaId, key, id) =>
  doc(db, "inmobiliarias", inmobiliariaId, AGENCY_COLLECTIONS[key], id);

const cleanText = (value = "", maxLength = 1000) =>
  value?.toString?.().trim().replace(/\s+/g, " ").slice(0, maxLength) || "";

const currentUserOrThrow = () => {
  const currentUser = auth.currentUser;
  if (!currentUser?.uid) throw new Error("Usuario no autenticado.");
  return currentUser;
};

const assertAgency = async (inmobiliariaId) => {
  if (!inmobiliariaId) throw new Error("Seleccioná una inmobiliaria activa.");
  currentUserOrThrow();
  await assertInmobiliariaActiva(inmobiliariaId);
};

const stripMetadata = (value = {}) => {
  const {
    id: _id,
    inmobiliariaId: _inmobiliariaId,
    ownerInmobiliariaId: _ownerInmobiliariaId,
    createdAt: _createdAt,
    createdBy: _createdBy,
    updatedAt: _updatedAt,
    updatedBy: _updatedBy,
    deletedAt: _deletedAt,
    ...payload
  } = value;
  return payload;
};

const partySnapshot = (party = {}) => ({
  id: cleanText(party.id, 128),
  name: cleanText(party.name, 200),
  taxId: cleanText(party.taxId, 32),
  documentType: cleanText(party.documentType, 20),
  ivaConditionId: Number(party.ivaConditionId || 5),
  email: cleanText(party.email, 220),
  phone: cleanText(party.phone, 80),
});

const sortTimestampDesc = (items) => [...items].sort((a, b) => {
  const aTime = a.updatedAt?.toMillis?.() || a.updatedAt?.seconds * 1000 || 0;
  const bTime = b.updatedAt?.toMillis?.() || b.updatedAt?.seconds * 1000 || 0;
  return bTime - aTime;
});

export const getRentalPeople = async (inmobiliariaId) => {
  if (!inmobiliariaId) return [];
  const snap = await getDocs(query(rentalCollection(inmobiliariaId, "people"), orderBy("updatedAt", "desc")));
  return snap.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .filter((item) => item.deleted !== true);
};

export const createRentalParty = async (inmobiliariaId, value) => {
  await assertAgency(inmobiliariaId);
  const currentUser = currentUserOrThrow();
  const normalized = normalizeRentalParty(value);
  if (!cleanText(normalized.name, 200)) throw new Error("Ingresá el nombre o razón social.");
  if (normalized.roles.length === 0) throw new Error("Seleccioná al menos un rol.");
  const ref = doc(rentalCollection(inmobiliariaId, "people"));
  await setDoc(ref, {
    ...stripMetadata(normalized),
    name: cleanText(normalized.name, 200),
    taxId: cleanText(normalized.taxId, 32),
    inmobiliariaId,
    ownerInmobiliariaId: inmobiliariaId,
    deleted: false,
    createdBy: currentUser.uid,
    updatedBy: currentUser.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
};

export const updateRentalParty = async (inmobiliariaId, partyId, value) => {
  await assertAgency(inmobiliariaId);
  const currentUser = currentUserOrThrow();
  const normalized = normalizeRentalParty(value);
  if (!cleanText(normalized.name, 200)) throw new Error("Ingresá el nombre o razón social.");
  if (normalized.roles.length === 0) throw new Error("Seleccioná al menos un rol.");
  await updateDoc(rentalDoc(inmobiliariaId, "people", partyId), {
    ...stripMetadata(normalized),
    name: cleanText(normalized.name, 200),
    taxId: cleanText(normalized.taxId, 32),
    inmobiliariaId,
    ownerInmobiliariaId: inmobiliariaId,
    updatedBy: currentUser.uid,
    updatedAt: serverTimestamp(),
  });
};

export const archiveRentalParty = async (inmobiliariaId, partyId) => {
  await assertAgency(inmobiliariaId);
  const currentUser = currentUserOrThrow();
  await updateDoc(rentalDoc(inmobiliariaId, "people", partyId), {
    active: false,
    deleted: true,
    deletedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedBy: currentUser.uid,
  });
};

const buildContractPartySnapshots = async (inmobiliariaId, partyIds) => {
  const allIds = Array.from(new Set([
    ...(partyIds.owners || []),
    ...(partyIds.tenants || []),
    ...(partyIds.guarantors || []),
  ]));
  const pairs = await Promise.all(allIds.map(async (id) => {
    const snap = await getDoc(rentalDoc(inmobiliariaId, "people", id));
    return [id, snap.exists() ? { id: snap.id, ...snap.data() } : null];
  }));
  const people = Object.fromEntries(pairs);
  const snapshots = (ids) => ids.map((id) => people[id]).filter(Boolean).map(partySnapshot);
  return {
    owners: snapshots(partyIds.owners || []),
    tenants: snapshots(partyIds.tenants || []),
    guarantors: snapshots(partyIds.guarantors || []),
  };
};

const sanitizeContract = async (inmobiliariaId, value) => {
  const contract = normalizeRentalContract(value);
  const errors = validateRentalContract(contract);
  if (errors.length) throw new Error(errors.join(" "));
  contract.inmuebleSnapshot = {
    title: cleanText(contract.inmuebleSnapshot?.title, 220),
    address: cleanText(contract.inmuebleSnapshot?.address, 300),
    propertyType: cleanText(contract.inmuebleSnapshot?.propertyType, 100),
  };
  contract.partySnapshots = await buildContractPartySnapshots(inmobiliariaId, contract.partyIds);
  contract.financial.currentRentAmountMinor = Number(
    contract.financial.currentRentAmountMinor || contract.financial.initialRentAmountMinor,
  );
  contract.financial.adjustment.nextAdjustmentDate = getNextAdjustmentDate(contract);
  return stripMetadata(contract);
};

export const createRentalContract = async (inmobiliariaId, value) => {
  await assertAgency(inmobiliariaId);
  const currentUser = currentUserOrThrow();
  const payload = await sanitizeContract(inmobiliariaId, value);
  const ref = doc(rentalCollection(inmobiliariaId, "contracts"));
  await setDoc(ref, {
    ...payload,
    status: payload.status === "active" ? "active" : "draft",
    inmobiliariaId,
    ownerInmobiliariaId: inmobiliariaId,
    deleted: false,
    createdBy: currentUser.uid,
    updatedBy: currentUser.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
};

export const updateRentalContract = async (inmobiliariaId, contractId, value) => {
  await assertAgency(inmobiliariaId);
  const currentUser = currentUserOrThrow();
  const ref = rentalDoc(inmobiliariaId, "contracts", contractId);
  const existing = await getDoc(ref);
  if (!existing.exists()) throw new Error("El contrato no existe.");
  const payload = await sanitizeContract(inmobiliariaId, value);
  const obligationsSnap = await getDocs(rentalCollection(inmobiliariaId, "obligations"));
  const obligations = obligationsSnap.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .filter((item) => item.contractId === contractId);
  const contractForSync = { id: contractId, ...payload };
  const batch = writeBatch(db);
  batch.update(ref, {
    ...payload,
    status: existing.data().status || payload.status,
    inmobiliariaId,
    ownerInmobiliariaId: inmobiliariaId,
    updatedBy: currentUser.uid,
    updatedAt: serverTimestamp(),
  });
  let synchronized = 0;
  let skippedWithPayments = 0;
  let voided = 0;
  obligations.forEach((current) => {
    const hasPayments = hasRentalObligationActivity(current);
    if (!isRentalObligationWithinContract(current, contractForSync)) {
      if (hasPayments) {
        skippedWithPayments += 1;
        batch.update(rentalDoc(inmobiliariaId, "obligations", current.id), {
          contractRevisionConflict: true,
          contractRevisionConflictReason: "period_outside_contract_with_activity",
          updatedBy: currentUser.uid,
          updatedAt: serverTimestamp(),
        });
        return;
      }
      batch.update(rentalDoc(inmobiliariaId, "obligations", current.id), {
        voided: true,
        status: "voided",
        voidReason: "period_outside_contract_after_revision",
        voidedAt: serverTimestamp(),
        voidedBy: currentUser.uid,
        contractRevisionConflict: false,
        updatedBy: currentUser.uid,
        updatedAt: serverTimestamp(),
      });
      voided += 1;
      return;
    }
    const result = syncRentalObligationFromContract(current, contractForSync);
    if (!result.updated) {
      if (result.reason === "has_payments") skippedWithPayments += 1;
      return;
    }
    const obligation = result.obligation;
    batch.update(rentalDoc(inmobiliariaId, "obligations", current.id), {
      schemaVersion: obligation.schemaVersion,
      obligationType: obligation.obligationType,
      serviceStartDate: obligation.serviceStartDate,
      serviceEndDate: obligation.serviceEndDate,
      dueDate: obligation.dueDate,
      currency: obligation.currency,
      rentAmountMinor: obligation.rentAmountMinor,
      otherChargesMinor: obligation.otherChargesMinor,
      discountAmountMinor: obligation.discountAmountMinor,
      discountReason: obligation.discountReason,
      totalAmountMinor: obligation.totalAmountMinor,
      paidAmountMinor: obligation.paidAmountMinor,
      balanceMinor: obligation.balanceMinor,
      administrationFeeSnapshot: obligation.administrationFeeSnapshot,
      status: obligation.status,
      voided: false,
      voidReason: "",
      voidedAt: null,
      contractRevisionConflict: false,
      contractRevisionConflictReason: "",
      contractRevisionSyncedAt: serverTimestamp(),
      updatedBy: currentUser.uid,
      updatedAt: serverTimestamp(),
    });
    synchronized += 1;
  });
  await batch.commit();
  return { synchronized, voided, skippedWithPayments };
};

export const getRentalContractById = async (inmobiliariaId, contractId) => {
  if (!inmobiliariaId || !contractId) return null;
  const snap = await getDoc(rentalDoc(inmobiliariaId, "contracts", contractId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

export const getRentalContracts = async (inmobiliariaId) => {
  if (!inmobiliariaId) return [];
  const snap = await getDocs(query(rentalCollection(inmobiliariaId, "contracts"), orderBy("updatedAt", "desc")));
  return snap.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .filter((item) => item.deleted !== true);
};

export const changeRentalContractStatus = async (inmobiliariaId, contractId, status) => {
  if (!["draft", "active", "ended", "cancelled"].includes(status)) {
    throw new Error("Estado contractual inválido.");
  }
  await assertAgency(inmobiliariaId);
  const currentUser = currentUserOrThrow();
  await updateDoc(rentalDoc(inmobiliariaId, "contracts", contractId), {
    status,
    statusChangedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedBy: currentUser.uid,
  });
};

export const archiveRentalContract = async (inmobiliariaId, contractId) => {
  await assertAgency(inmobiliariaId);
  const currentUser = currentUserOrThrow();
  await updateDoc(rentalDoc(inmobiliariaId, "contracts", contractId), {
    deleted: true,
    deletedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedBy: currentUser.uid,
  });
};

export const getRentalObligations = async (
  inmobiliariaId,
  contractId = "",
  { includeVoided = false } = {},
) => {
  if (!inmobiliariaId) return [];
  const snap = await getDocs(rentalCollection(inmobiliariaId, "obligations"));
  return snap.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .filter((item) => !contractId || item.contractId === contractId)
    .filter((item) => includeVoided || item.voided !== true)
    .sort((a, b) => b.periodKey.localeCompare(a.periodKey));
};

export const generateRentalObligations = async ({
  inmobiliariaId,
  contractId,
  throughDate = new Date().toISOString().slice(0, 10),
}) => {
  await assertAgency(inmobiliariaId);
  const currentUser = currentUserOrThrow();
  const contract = await getRentalContractById(inmobiliariaId, contractId);
  if (!contract) throw new Error("El contrato no existe.");
  const periods = getContractPeriodKeys(contract, { throughDate, limit: 120 });
  const existing = await getRentalObligations(
    inmobiliariaId,
    contractId,
    { includeVoided: true },
  );
  if (!periods.length && !existing.length) {
    throw new Error("No hay períodos contractuales para generar.");
  }
  const activeExisting = existing.filter((item) => item.voided !== true);
  const existingPeriods = new Set(activeExisting.map((item) => item.periodKey));
  const missingPeriods = periods.filter((periodKey) => !existingPeriods.has(periodKey));
  const batch = writeBatch(db);
  missingPeriods.forEach((periodKey) => {
    const obligation = buildRentalObligation(contract, periodKey);
    const id = `${contractId}_${periodKey}`;
    batch.set(rentalDoc(inmobiliariaId, "obligations", id), {
      ...obligation,
      id,
      inmobiliariaId,
      ownerInmobiliariaId: inmobiliariaId,
      createdBy: currentUser.uid,
      updatedBy: currentUser.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
  let synchronized = 0;
  let voided = 0;
  let skippedWithPayments = 0;
  existing.forEach((current) => {
    const hasPayments = hasRentalObligationActivity(current);
    if (!isRentalObligationWithinContract(current, contract)) {
      if (hasPayments) {
        skippedWithPayments += 1;
        return;
      }
      if (current.voided !== true) {
        batch.update(rentalDoc(inmobiliariaId, "obligations", current.id), {
          voided: true,
          status: "voided",
          voidReason: "period_outside_contract_after_revision",
          voidedAt: serverTimestamp(),
          voidedBy: currentUser.uid,
          updatedBy: currentUser.uid,
          updatedAt: serverTimestamp(),
        });
        voided += 1;
      }
      return;
    }
    if (current.voided === true || hasPayments) return;
    const result = syncRentalObligationFromContract(current, contract);
    if (!result.updated) return;
    const obligation = result.obligation;
    batch.update(rentalDoc(inmobiliariaId, "obligations", current.id), {
      schemaVersion: obligation.schemaVersion,
      obligationType: obligation.obligationType,
      serviceStartDate: obligation.serviceStartDate,
      serviceEndDate: obligation.serviceEndDate,
      dueDate: obligation.dueDate,
      currency: obligation.currency,
      rentAmountMinor: obligation.rentAmountMinor,
      otherChargesMinor: obligation.otherChargesMinor,
      discountAmountMinor: obligation.discountAmountMinor,
      discountReason: obligation.discountReason,
      totalAmountMinor: obligation.totalAmountMinor,
      paidAmountMinor: obligation.paidAmountMinor,
      balanceMinor: obligation.balanceMinor,
      administrationFeeSnapshot: obligation.administrationFeeSnapshot,
      status: obligation.status,
      contractRevisionSyncedAt: serverTimestamp(),
      updatedBy: currentUser.uid,
      updatedAt: serverTimestamp(),
    });
    synchronized += 1;
  });
  batch.update(rentalDoc(inmobiliariaId, "contracts", contractId), {
    obligationsGeneratedThrough: throughDate,
    updatedAt: serverTimestamp(),
    updatedBy: currentUser.uid,
  });
  await batch.commit();
  return {
    created: missingPeriods.length,
    periods: missingPeriods,
    synchronized,
    voided,
    skippedWithPayments,
  };
};

export const updateRentalObligationCharges = async ({
  inmobiliariaId,
  obligationId,
  otherChargesMinor = 0,
  discountAmountMinor = 0,
  discountReason = "",
}) => {
  await assertAgency(inmobiliariaId);
  const currentUser = currentUserOrThrow();
  const ref = rentalDoc(inmobiliariaId, "obligations", obligationId);
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists()) throw new Error("La obligación no existe.");
    const current = snap.data();
    if (current.externalClosure?.closed === true) {
      throw new Error("Reabrí el período antes de modificar sus cargos.");
    }
    const charges = Math.max(0, Math.round(Number(otherChargesMinor) || 0));
    const grossAmount = Math.max(0, Number(current.rentAmountMinor) || 0) + charges;
    const discount = Math.max(0, Math.round(Number(discountAmountMinor) || 0));
    const reason = cleanText(discountReason, 300);
    if (discount > grossAmount) {
      throw new Error("La bonificación no puede superar el importe de la estadía más sus cargos.");
    }
    if (discount > 0 && !reason) {
      throw new Error("Indicá el motivo de la bonificación.");
    }
    const total = grossAmount - discount;
    if (total < Number(current.paidAmountMinor || 0)) {
      throw new Error("La bonificación dejaría un total menor a los pagos ya registrados.");
    }
    const candidate = {
      ...current,
      otherChargesMinor: charges,
      discountAmountMinor: discount,
      totalAmountMinor: total,
    };
    transaction.update(ref, {
      otherChargesMinor: charges,
      discountAmountMinor: discount,
      discountReason: discount > 0 ? reason : "",
      discountUpdatedAt: Timestamp.now(),
      discountUpdatedBy: currentUser.uid,
      totalAmountMinor: total,
      balanceMinor: total - Number(current.paidAmountMinor || 0),
      status: getObligationStatus(candidate),
      updatedAt: Timestamp.now(),
      updatedBy: currentUser.uid,
    });
  });
};

export const recordRentalPayment = async ({
  inmobiliariaId,
  obligationId,
  amountMinor,
  paidAt,
  method = "transfer",
  reference = "",
  notes = "",
}) => {
  await assertAgency(inmobiliariaId);
  const currentUser = currentUserOrThrow();
  const amount = Math.round(Number(amountMinor) || 0);
  if (!(amount > 0)) throw new Error("Ingresá un importe de pago válido.");
  const paymentDate = toDateKey(paidAt) || new Date().toISOString().slice(0, 10);
  const ref = rentalDoc(inmobiliariaId, "obligations", obligationId);
  let createdPayment = null;

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists()) throw new Error("La obligación no existe.");
    const current = snap.data();
    if (current.externalClosure?.closed === true) {
      throw new Error("El período está cerrado fuera de gestión. Reabrilo antes de registrar pagos.");
    }
    const payments = Array.isArray(current.payments) ? current.payments : [];
    const balance = Math.max(0, Number(current.totalAmountMinor || 0) - Number(current.paidAmountMinor || 0));
    if (amount > balance) throw new Error("El pago supera el saldo pendiente.");
    const sequence = payments.length + 1;
    const paymentId = `${obligationId}_${sequence}`;
    createdPayment = {
      id: paymentId,
      receiptNumber: `REC-${obligationId.slice(0, 6).toUpperCase()}-${current.periodKey?.replace("-", "") || "PER"}-${sequence.toString().padStart(3, "0")}`,
      amountMinor: amount,
      paidAt: paymentDate,
      method,
      reference: cleanText(reference, 200),
      notes: cleanText(notes, 500),
      recordedBy: currentUser.uid,
      recordedByEmail: cleanText(currentUser.email, 220),
      recordedAt: Timestamp.now(),
    };
    const paidAmountMinor = Number(current.paidAmountMinor || 0) + amount;
    const candidate = { ...current, paidAmountMinor };
    transaction.update(ref, {
      payments: [...payments, createdPayment],
      paidAmountMinor,
      balanceMinor: Math.max(0, Number(current.totalAmountMinor || 0) - paidAmountMinor),
      status: getObligationStatus(candidate),
      lastPaymentAt: paymentDate,
      updatedAt: Timestamp.now(),
      updatedBy: currentUser.uid,
    });
  });
  return createdPayment;
};

export const voidRentalPayment = async ({
  inmobiliariaId,
  obligationId,
  paymentId,
  reason,
}) => {
  await assertAgency(inmobiliariaId);
  const currentUser = currentUserOrThrow();
  const correctionReason = cleanText(reason, 500);
  if (correctionReason.length < 4) throw new Error("Indicá el motivo de la anulación.");
  const obligationRef = rentalDoc(inmobiliariaId, "obligations", obligationId);
  await runTransaction(db, async (transaction) => {
    const obligationSnap = await transaction.get(obligationRef);
    if (!obligationSnap.exists()) throw new Error("La obligación no existe.");
    const current = obligationSnap.data();
    const payments = Array.isArray(current.payments) ? current.payments : [];
    const payment = payments.find((item) => item.id === paymentId);
    if (!payment) throw new Error("El pago no existe.");
    if (payment.voided === true) throw new Error("El pago ya fue anulado.");

    const settlementId = `${current.contractId}_${current.periodKey}`;
    const settlementRef = rentalDoc(inmobiliariaId, "settlements", settlementId);
    const settlementSnap = await transaction.get(settlementRef);
    const settlement = settlementSnap.data() || {};
    if (["paid", "received"].includes(settlement.status)) {
      throw new Error("Primero rectificá la recepción y anulá el pago al locador de esta liquidación.");
    }

    const correctedPayments = payments.map((item) => item.id === paymentId ? {
      ...item,
      voided: true,
      voidReason: correctionReason,
      voidedAt: Timestamp.now(),
      voidedBy: currentUser.uid,
      voidedByEmail: cleanText(currentUser.email, 220),
    } : item);
    const paidAmountMinor = correctedPayments
      .filter((item) => item.voided !== true)
      .reduce((sum, item) => sum + Number(item.amountMinor || 0), 0);
    const balanceMinor = Math.max(0, Number(current.totalAmountMinor || 0) - paidAmountMinor);
    transaction.update(obligationRef, {
      payments: correctedPayments,
      paidAmountMinor,
      balanceMinor,
      status: getObligationStatus({ ...current, payments: correctedPayments, paidAmountMinor, balanceMinor }),
      lastCorrectionAt: Timestamp.now(),
      lastCorrectionBy: currentUser.uid,
      updatedAt: Timestamp.now(),
      updatedBy: currentUser.uid,
    });
    if (settlementSnap.exists()) {
      transaction.update(settlementRef, {
        status: "needs_recalculation",
        staleReason: "tenant_payment_voided",
        staleAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        updatedBy: currentUser.uid,
      });
    }
  });
};

export const closeRentalObligationOutsideManagement = async ({
  inmobiliariaId,
  obligationId,
  reason,
  closedAt,
  notes = "",
}) => {
  await assertAgency(inmobiliariaId);
  const currentUser = currentUserOrThrow();
  const allowedReasons = ["pre_management", "paid_direct_to_owner", "managed_by_third_party", "other"];
  if (!allowedReasons.includes(reason)) throw new Error("Seleccioná el motivo del cierre externo.");
  const date = toDateKey(closedAt) || new Date().toISOString().slice(0, 10);
  const ref = rentalDoc(inmobiliariaId, "obligations", obligationId);
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists()) throw new Error("La obligación no existe.");
    const current = snap.data();
    if (current.externalClosure?.closed === true) {
      throw new Error("El período ya está cerrado fuera de gestión.");
    }
    const outstandingMinor = Math.max(
      0,
      Number(current.totalAmountMinor || 0) - Number(current.paidAmountMinor || 0),
    );
    transaction.update(ref, {
      externalClosure: {
        closed: true,
        reason,
        closedAt: date,
        amountMinor: outstandingMinor,
        notes: cleanText(notes, 500),
        recordedAt: Timestamp.now(),
        recordedBy: currentUser.uid,
        recordedByEmail: cleanText(currentUser.email, 220),
      },
      balanceMinor: 0,
      status: "closed_external",
      updatedAt: Timestamp.now(),
      updatedBy: currentUser.uid,
    });
  });
};

export const reopenRentalObligationOutsideManagement = async ({
  inmobiliariaId,
  obligationId,
}) => {
  await assertAgency(inmobiliariaId);
  const currentUser = currentUserOrThrow();
  const ref = rentalDoc(inmobiliariaId, "obligations", obligationId);
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists()) throw new Error("La obligación no existe.");
    const current = snap.data();
    if (current.externalClosure?.closed !== true) {
      throw new Error("El período no está cerrado fuera de gestión.");
    }
    const externalClosure = {
      ...current.externalClosure,
      closed: false,
      reopenedAt: Timestamp.now(),
      reopenedBy: currentUser.uid,
    };
    const balanceMinor = Math.max(
      0,
      Number(current.totalAmountMinor || 0) - Number(current.paidAmountMinor || 0),
    );
    transaction.update(ref, {
      externalClosure,
      balanceMinor,
      status: getObligationStatus({ ...current, externalClosure, balanceMinor }),
      updatedAt: Timestamp.now(),
      updatedBy: currentUser.uid,
    });
  });
};

export const markRentalObligationExternallyInvoiced = async ({
  inmobiliariaId,
  obligationId,
  voucherType,
  pointOfSale,
  voucherNumber,
  invoiceDate,
  amountMinor,
  cae = "",
  notes = "",
}) => {
  await assertAgency(inmobiliariaId);
  const currentUser = currentUserOrThrow();
  const allowedTypes = ["unknown", "factura_c", "factura_b", "factura_a", "otro"];
  if (!allowedTypes.includes(voucherType)) throw new Error("Seleccioná el tipo de comprobante.");
  const hasVoucherData = voucherType !== "unknown";
  const safePointOfSale = Math.max(0, Math.round(Number(pointOfSale) || 0));
  const safeVoucherNumber = Math.max(0, Math.round(Number(voucherNumber) || 0));
  const safeAmount = Math.max(0, Math.round(Number(amountMinor) || 0));
  const safeDate = toDateKey(invoiceDate);
  if (hasVoucherData && !(safePointOfSale > 0)) throw new Error("Ingresá el punto de venta del comprobante externo.");
  if (hasVoucherData && !(safeVoucherNumber > 0)) throw new Error("Ingresá el número del comprobante externo.");
  if (hasVoucherData && !(safeAmount > 0)) throw new Error("Ingresá el importe facturado externamente.");
  if (hasVoucherData && !safeDate) throw new Error("Ingresá la fecha del comprobante externo.");
  const ref = rentalDoc(inmobiliariaId, "obligations", obligationId);
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists()) throw new Error("La obligación no existe.");
    const current = snap.data();
    if (current.arcaProductionInvoice?.authorized === true) {
      throw new Error(
        "El período ya tiene un comprobante autorizado en ARCA Producción y no puede marcarse como facturado externamente.",
      );
    }
    transaction.update(ref, {
      externalInvoice: {
        registered: true,
        voucherType,
        pointOfSale: hasVoucherData ? safePointOfSale : 0,
        voucherNumber: hasVoucherData ? safeVoucherNumber : 0,
        invoiceDate: hasVoucherData ? safeDate : "",
        amountMinor: hasVoucherData ? safeAmount : 0,
        cae: hasVoucherData ? cleanText(cae, 30) : "",
        notes: cleanText(notes, 500),
        recordedAt: Timestamp.now(),
        recordedBy: currentUser.uid,
        recordedByEmail: cleanText(currentUser.email, 220),
      },
      updatedAt: Timestamp.now(),
      updatedBy: currentUser.uid,
    });
  });
};

export const unmarkRentalObligationExternallyInvoiced = async ({
  inmobiliariaId,
  obligationId,
}) => {
  await assertAgency(inmobiliariaId);
  const currentUser = currentUserOrThrow();
  const ref = rentalDoc(inmobiliariaId, "obligations", obligationId);
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists()) throw new Error("La obligación no existe.");
    const current = snap.data();
    if (current.arcaProductionInvoice?.authorized === true) {
      throw new Error(
        "El período tiene un comprobante autorizado en ARCA Producción y no admite esta reclasificación.",
      );
    }
    if (current.externalInvoice?.registered !== true) {
      throw new Error("El período no está marcado como facturado externamente.");
    }
    transaction.update(ref, {
      externalInvoice: {
        ...current.externalInvoice,
        registered: false,
        unregisteredAt: Timestamp.now(),
        unregisteredBy: currentUser.uid,
      },
      updatedAt: Timestamp.now(),
      updatedBy: currentUser.uid,
    });
  });
};

export const getRentalExpenses = async (inmobiliariaId, contractId = "") => {
  if (!inmobiliariaId) return [];
  const snap = await getDocs(rentalCollection(inmobiliariaId, "expenses"));
  return sortTimestampDesc(snap.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .filter((item) => item.deleted !== true && (!contractId || item.contractId === contractId)));
};

export const addRentalExpense = async (inmobiliariaId, value) => {
  await assertAgency(inmobiliariaId);
  const currentUser = currentUserOrThrow();
  if (!value.contractId) throw new Error("Seleccioná el contrato.");
  if (!(Number(value.amountMinor) > 0)) throw new Error("Ingresá el importe del gasto.");
  if (!cleanText(value.concept, 200)) throw new Error("Ingresá el concepto del gasto.");
  const ref = doc(rentalCollection(inmobiliariaId, "expenses"));
  await setDoc(ref, {
    contractId: value.contractId,
    periodKey: value.periodKey || getPeriodKey(value.date),
    date: toDateKey(value.date) || new Date().toISOString().slice(0, 10),
    concept: cleanText(value.concept, 200),
    amountMinor: Math.round(Number(value.amountMinor) || 0),
    allocatedTo: ["owner", "tenant", "agency"].includes(value.allocatedTo) ? value.allocatedTo : "owner",
    notes: cleanText(value.notes, 500),
    inmobiliariaId,
    ownerInmobiliariaId: inmobiliariaId,
    deleted: false,
    createdBy: currentUser.uid,
    updatedBy: currentUser.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
};

export const getRentalSettlements = async (inmobiliariaId, contractId = "") => {
  if (!inmobiliariaId) return [];
  const snap = await getDocs(rentalCollection(inmobiliariaId, "settlements"));
  return snap.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .filter((item) => !contractId || item.contractId === contractId)
    .sort((a, b) => b.periodKey.localeCompare(a.periodKey));
};

export const saveRentalSettlement = async ({
  inmobiliariaId,
  contract,
  obligation,
  expenses = [],
}) => {
  await assertAgency(inmobiliariaId);
  const currentUser = currentUserOrThrow();
  if (!contract?.id || !obligation?.id) throw new Error("Faltan datos para liquidar.");
  const calculation = calculateRentalSettlement({ contract, obligation, expenses });
  const id = `${contract.id}_${obligation.periodKey}`;
  const ref = rentalDoc(inmobiliariaId, "settlements", id);
  const previous = await getDoc(ref);
  const previousData = previous.exists() ? previous.data() : {};
  if (["paid", "received"].includes(previousData.status)) {
    throw new Error("La liquidación ya tiene un pago registrado y no puede recalcularse.");
  }
  await setDoc(ref, {
    id,
    contractId: contract.id,
    obligationId: obligation.id,
    periodKey: obligation.periodKey,
    currency: obligation.currency || contract.currency,
    ...calculation,
    expenseIds: expenses.filter((item) => item.allocatedTo === "owner").map((item) => item.id),
    status: "draft",
    staleReason: deleteField(),
    staleAt: deleteField(),
    paidAt: previousData.paidAt || "",
    settledAt: previousData.settledAt || new Date().toISOString().slice(0, 10),
    inmobiliariaId,
    ownerInmobiliariaId: inmobiliariaId,
    createdBy: previousData.createdBy || currentUser.uid,
    updatedBy: currentUser.uid,
    createdAt: previousData.createdAt || serverTimestamp(),
    updatedAt: serverTimestamp(),
  }, { merge: true });
  return { id, ...calculation };
};

export const markRentalSettlementPaid = async ({
  inmobiliariaId,
  settlementId,
  paidAt,
  method = "transfer",
  reference = "",
  notes = "",
}) => {
  await assertAgency(inmobiliariaId);
  const currentUser = currentUserOrThrow();
  const ref = rentalDoc(inmobiliariaId, "settlements", settlementId);
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists()) throw new Error("La liquidación no existe.");
    const settlement = snap.data();
    if (["paid", "received"].includes(settlement.status)) {
      throw new Error("El pago de esta liquidación ya fue registrado.");
    }
    const receiptNumber = settlement.receiptNumber
      || `RLOC-${settlementId.slice(0, 6).toUpperCase()}-${settlement.periodKey?.replace("-", "") || "PER"}`;
    transaction.update(ref, {
      status: "paid",
      paidAt: toDateKey(paidAt) || new Date().toISOString().slice(0, 10),
      paymentMethod: RENTAL_PAYMENT_METHODS.some((item) => item.id === method) ? method : "other",
      paymentReference: cleanText(reference, 200),
      paymentNotes: cleanText(notes, 500),
      receiptNumber,
      paidRecordedAt: Timestamp.now(),
      paidRecordedBy: currentUser.uid,
      paidRecordedByEmail: cleanText(currentUser.email, 220),
      updatedAt: Timestamp.now(),
      updatedBy: currentUser.uid,
    });
  });
};

export const confirmRentalSettlementReceived = async ({
  inmobiliariaId,
  settlementId,
  receivedAt,
  confirmationMethod = "signed_receipt",
  reference = "",
  notes = "",
}) => {
  await assertAgency(inmobiliariaId);
  const currentUser = currentUserOrThrow();
  const receivedDate = toDateKey(receivedAt);
  if (!receivedDate) throw new Error("Ingresá una fecha de recepción válida.");
  const method = RENTAL_SETTLEMENT_RECEIPT_CONFIRMATION_METHODS
    .some((item) => item.id === confirmationMethod)
    ? confirmationMethod
    : "other";
  const ref = rentalDoc(inmobiliariaId, "settlements", settlementId);
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists()) throw new Error("La liquidación no existe.");
    const settlement = snap.data();
    if (settlement.status === "received") {
      throw new Error("La recepción de esta liquidación ya fue confirmada.");
    }
    if (settlement.status !== "paid") {
      throw new Error("Primero registrá el pago al locador.");
    }
    transaction.update(ref, {
      status: "received",
      receivedAt: receivedDate,
      receiptConfirmationMethod: method,
      receiptConfirmationReference: cleanText(reference, 200),
      receiptConfirmationNotes: cleanText(notes, 500),
      receiptConfirmedAt: Timestamp.now(),
      receiptConfirmedBy: currentUser.uid,
      receiptConfirmedByEmail: cleanText(currentUser.email, 220),
      updatedAt: Timestamp.now(),
      updatedBy: currentUser.uid,
    });
  });
};

export const rectifyRentalSettlementReceipt = async ({
  inmobiliariaId,
  settlementId,
  reason,
}) => {
  await assertAgency(inmobiliariaId);
  const currentUser = currentUserOrThrow();
  const correctionReason = cleanText(reason, 500);
  if (correctionReason.length < 4) throw new Error("Indicá el motivo de la rectificación.");
  const ref = rentalDoc(inmobiliariaId, "settlements", settlementId);
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists()) throw new Error("La liquidación no existe.");
    const settlement = snap.data();
    if (settlement.status !== "received") {
      throw new Error("La recepción no se encuentra confirmada.");
    }
    const corrections = Array.isArray(settlement.receiptCorrections)
      ? settlement.receiptCorrections
      : [];
    transaction.update(ref, {
      status: "paid",
      receiptCorrections: [...corrections, {
        reason: correctionReason,
        previousReceivedAt: settlement.receivedAt || "",
        previousMethod: settlement.receiptConfirmationMethod || "",
        previousReference: settlement.receiptConfirmationReference || "",
        recordedAt: Timestamp.now(),
        recordedBy: currentUser.uid,
        recordedByEmail: cleanText(currentUser.email, 220),
      }],
      receivedAt: deleteField(),
      receiptConfirmationMethod: deleteField(),
      receiptConfirmationReference: deleteField(),
      receiptConfirmationNotes: deleteField(),
      receiptConfirmedAt: deleteField(),
      receiptConfirmedBy: deleteField(),
      receiptConfirmedByEmail: deleteField(),
      updatedAt: Timestamp.now(),
      updatedBy: currentUser.uid,
    });
  });
};

export const voidRentalSettlementPayment = async ({
  inmobiliariaId,
  settlementId,
  reason,
}) => {
  await assertAgency(inmobiliariaId);
  const currentUser = currentUserOrThrow();
  const correctionReason = cleanText(reason, 500);
  if (correctionReason.length < 4) throw new Error("Indicá el motivo de la anulación.");
  const ref = rentalDoc(inmobiliariaId, "settlements", settlementId);
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists()) throw new Error("La liquidación no existe.");
    const settlement = snap.data();
    if (settlement.status === "received") {
      throw new Error("Primero rectificá la confirmación de recepción.");
    }
    if (settlement.status !== "paid") {
      throw new Error("La liquidación no tiene un pago activo para anular.");
    }
    const corrections = Array.isArray(settlement.paymentCorrections)
      ? settlement.paymentCorrections
      : [];
    transaction.update(ref, {
      status: "draft",
      paymentCorrections: [...corrections, {
        reason: correctionReason,
        previousPaidAt: settlement.paidAt || "",
        previousMethod: settlement.paymentMethod || "",
        previousReference: settlement.paymentReference || "",
        previousNotes: settlement.paymentNotes || "",
        recordedAt: Timestamp.now(),
        recordedBy: currentUser.uid,
        recordedByEmail: cleanText(currentUser.email, 220),
      }],
      paidAt: deleteField(),
      paymentMethod: deleteField(),
      paymentReference: deleteField(),
      paymentNotes: deleteField(),
      paidRecordedAt: deleteField(),
      paidRecordedBy: deleteField(),
      paidRecordedByEmail: deleteField(),
      updatedAt: Timestamp.now(),
      updatedBy: currentUser.uid,
    });
  });
};

export const addRentalAdjustment = async ({
  inmobiliariaId,
  contractId,
  effectiveFrom,
  amountMinor,
  source = "manual",
  notes = "",
}) => {
  await assertAgency(inmobiliariaId);
  const currentUser = currentUserOrThrow();
  const amount = Math.round(Number(amountMinor) || 0);
  if (!(amount > 0)) throw new Error("Ingresá el nuevo importe del alquiler.");
  const effectiveDate = toDateKey(effectiveFrom);
  if (!effectiveDate) throw new Error("Ingresá la fecha de vigencia del ajuste.");
  const ref = rentalDoc(inmobiliariaId, "contracts", contractId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("El contrato no existe.");
  const contract = normalizeRentalContract({ id: snap.id, ...snap.data() });
  const schedule = contract.rentSchedule
    .filter((item) => item.effectiveFrom !== effectiveDate)
    .concat({
      effectiveFrom: effectiveDate,
      amountMinor: amount,
      source: cleanText(source, 100),
      notes: cleanText(notes, 500),
      recordedBy: currentUser.uid,
      recordedAt: new Date().toISOString(),
    })
    .sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
  const updatedContract = normalizeRentalContract({
    ...contract,
    rentSchedule: schedule,
    financial: {
      ...contract.financial,
      currentRentAmountMinor: amount,
      adjustment: {
        ...contract.financial.adjustment,
        nextAdjustmentDate: "",
      },
    },
  });
  await updateDoc(ref, {
    rentSchedule: schedule,
    "financial.currentRentAmountMinor": amount,
    "financial.adjustment.nextAdjustmentDate": getNextAdjustmentDate(updatedContract),
    updatedAt: serverTimestamp(),
    updatedBy: currentUser.uid,
  });
};
