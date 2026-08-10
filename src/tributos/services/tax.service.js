import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";

import app, { auth, db } from "../../firebase/config";
import { assertInmobiliariaActiva } from "../../inmobiliaria/services/inmobiliaria.service";
import { getInmueblesByInmobiliaria } from "../../inmueble/services/inmueble.service";
import {
  normalizeTaxObject,
  normalizeTaxObligation,
  normalizeTaxNotificationSettings,
  validateTaxNotificationSettings,
  validateTaxObject,
  validateTaxObligation,
} from "../utils/tax.helpers";

const functions = getFunctions(app, "southamerica-east1");

const COLLECTIONS = {
  objects: "tax_objects",
  obligations: "tax_obligations",
  events: "tax_events",
  notifications: "tax_notifications",
  notificationSettings: "tax_notification_settings",
};

const agencyCollection = (inmobiliariaId, key) => (
  collection(db, "inmobiliarias", inmobiliariaId, COLLECTIONS[key])
);

const agencyDoc = (inmobiliariaId, key, id) => (
  doc(db, "inmobiliarias", inmobiliariaId, COLLECTIONS[key], id)
);

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

const withoutMetadata = (value = {}) => {
  const {
    id: _id,
    inmobiliariaId: _inmobiliariaId,
    ownerInmobiliariaId: _ownerInmobiliariaId,
    createdAt: _createdAt,
    createdBy: _createdBy,
    updatedAt: _updatedAt,
    updatedBy: _updatedBy,
    archivedAt: _archivedAt,
    ...payload
  } = value;
  return payload;
};

const eventPayload = ({ inmobiliariaId, entityType, entityId, action, user }) => ({
  schemaVersion: 1,
  inmobiliariaId,
  ownerInmobiliariaId: inmobiliariaId,
  entityType,
  entityId,
  action,
  actorId: user.uid,
  actorEmail: user.email || "",
  occurredAt: serverTimestamp(),
});

export const getTaxObjects = async (inmobiliariaId) => {
  if (!inmobiliariaId) return [];
  const snap = await getDocs(query(
    agencyCollection(inmobiliariaId, "objects"),
    orderBy("updatedAt", "desc"),
  ));
  return snap.docs.map((item) => ({ id: item.id, ...item.data() }));
};

export const getTaxObligations = async (inmobiliariaId) => {
  if (!inmobiliariaId) return [];
  const snap = await getDocs(agencyCollection(inmobiliariaId, "obligations"));
  return snap.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""));
};

export const getAllInmueblesForTax = async (inmobiliariaId) => {
  if (!inmobiliariaId) return [];
  const items = [];
  let lastDoc = null;
  let pages = 0;
  do {
    const result = await getInmueblesByInmobiliaria(inmobiliariaId, {
      pageSize: 200,
      lastDoc,
    });
    items.push(...(result?.data || []));
    lastDoc = result?.lastDoc || null;
    pages += 1;
  } while (lastDoc && pages < 20);
  return items.filter((item) => item.deleted !== true);
};

export const createTaxObject = async (inmobiliariaId, value) => {
  await assertAgency(inmobiliariaId);
  const user = currentUserOrThrow();
  const normalized = normalizeTaxObject(value);
  const errors = validateTaxObject(normalized);
  if (errors.length) throw new Error(errors.join(" "));
  const ref = doc(agencyCollection(inmobiliariaId, "objects"));
  const eventRef = doc(agencyCollection(inmobiliariaId, "events"));
  const batch = writeBatch(db);
  batch.set(ref, {
    ...withoutMetadata(normalized),
    inmobiliariaId,
    ownerInmobiliariaId: inmobiliariaId,
    createdAt: serverTimestamp(),
    createdBy: user.uid,
    updatedAt: serverTimestamp(),
    updatedBy: user.uid,
  });
  batch.set(eventRef, eventPayload({
    inmobiliariaId,
    entityType: "tax_object",
    entityId: ref.id,
    action: "created",
    user,
  }));
  await batch.commit();
  return ref.id;
};

export const updateTaxObject = async (inmobiliariaId, objectId, value) => {
  await assertAgency(inmobiliariaId);
  const user = currentUserOrThrow();
  const ref = agencyDoc(inmobiliariaId, "objects", objectId);
  const existing = await getDoc(ref);
  if (!existing.exists()) throw new Error("El objeto fiscal no existe.");
  const normalized = normalizeTaxObject(value);
  const errors = validateTaxObject(normalized);
  if (errors.length) throw new Error(errors.join(" "));
  const eventRef = doc(agencyCollection(inmobiliariaId, "events"));
  const batch = writeBatch(db);
  batch.update(ref, {
    ...withoutMetadata(normalized),
    inmobiliariaId,
    ownerInmobiliariaId: inmobiliariaId,
    updatedAt: serverTimestamp(),
    updatedBy: user.uid,
  });
  batch.set(eventRef, eventPayload({
    inmobiliariaId,
    entityType: "tax_object",
    entityId: objectId,
    action: "updated",
    user,
  }));
  await batch.commit();
};

export const archiveTaxObject = async (inmobiliariaId, objectId) => {
  await assertAgency(inmobiliariaId);
  const user = currentUserOrThrow();
  const eventRef = doc(agencyCollection(inmobiliariaId, "events"));
  const batch = writeBatch(db);
  batch.update(agencyDoc(inmobiliariaId, "objects", objectId), {
    status: "archived",
    archivedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedBy: user.uid,
  });
  batch.set(eventRef, eventPayload({
    inmobiliariaId,
    entityType: "tax_object",
    entityId: objectId,
    action: "archived",
    user,
  }));
  await batch.commit();
};

export const createTaxObligation = async (inmobiliariaId, value) => {
  await assertAgency(inmobiliariaId);
  const user = currentUserOrThrow();
  const taxObjectSnap = await getDoc(
    agencyDoc(inmobiliariaId, "objects", value.taxObjectId),
  );
  if (!taxObjectSnap.exists()) throw new Error("El objeto fiscal no existe.");
  const taxObject = { id: taxObjectSnap.id, ...taxObjectSnap.data() };
  const normalized = normalizeTaxObligation({
    ...value,
    providerId: taxObject.providerId,
    authorityName: taxObject.authority?.name,
    inmuebleId: taxObject.inmuebleId,
  });
  const errors = validateTaxObligation(normalized);
  if (errors.length) throw new Error(errors.join(" "));
  const ref = doc(agencyCollection(inmobiliariaId, "obligations"));
  const eventRef = doc(agencyCollection(inmobiliariaId, "events"));
  const batch = writeBatch(db);
  batch.set(ref, {
    ...withoutMetadata(normalized),
    inmobiliariaId,
    ownerInmobiliariaId: inmobiliariaId,
    createdAt: serverTimestamp(),
    createdBy: user.uid,
    updatedAt: serverTimestamp(),
    updatedBy: user.uid,
  });
  batch.set(eventRef, eventPayload({
    inmobiliariaId,
    entityType: "tax_obligation",
    entityId: ref.id,
    action: "created",
    user,
  }));
  await batch.commit();
  return ref.id;
};

export const updateTaxObligation = async (inmobiliariaId, obligationId, value) => {
  await assertAgency(inmobiliariaId);
  const user = currentUserOrThrow();
  const ref = agencyDoc(inmobiliariaId, "obligations", obligationId);
  const existing = await getDoc(ref);
  if (!existing.exists()) throw new Error("La obligación no existe.");
  const previous = existing.data();
  const normalized = normalizeTaxObligation({
    ...value,
    taxObjectId: previous.taxObjectId,
    providerId: previous.providerId,
    authorityName: previous.authorityName,
    inmuebleId: previous.inmuebleId,
  });
  const errors = validateTaxObligation(normalized);
  if (errors.length) throw new Error(errors.join(" "));
  const eventRef = doc(agencyCollection(inmobiliariaId, "events"));
  const batch = writeBatch(db);
  batch.update(ref, {
    ...withoutMetadata(normalized),
    inmobiliariaId,
    ownerInmobiliariaId: inmobiliariaId,
    updatedAt: serverTimestamp(),
    updatedBy: user.uid,
  });
  batch.set(eventRef, eventPayload({
    inmobiliariaId,
    entityType: "tax_obligation",
    entityId: obligationId,
    action: "updated",
    user,
  }));
  await batch.commit();
};

export const recordTaxPayment = async ({
  inmobiliariaId,
  obligationId,
  paidAt,
  reference = "",
  evidenceUrl = "",
}) => {
  await assertAgency(inmobiliariaId);
  const user = currentUserOrThrow();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(paidAt || "")) {
    throw new Error("Ingresá una fecha de pago válida.");
  }
  if (evidenceUrl && !/^https:\/\//i.test(evidenceUrl)) {
    throw new Error("La evidencia debe usar una URL HTTPS.");
  }
  const ref = agencyDoc(inmobiliariaId, "obligations", obligationId);
  const eventRef = doc(agencyCollection(inmobiliariaId, "events"));
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists()) throw new Error("La obligación no existe.");
    transaction.update(ref, {
      status: "paid",
      payment: {
        paidAt,
        reference: reference.toString().trim().slice(0, 220),
        evidenceUrl: evidenceUrl.toString().trim().slice(0, 1000),
      },
      updatedAt: serverTimestamp(),
      updatedBy: user.uid,
    });
    transaction.set(eventRef, eventPayload({
      inmobiliariaId,
      entityType: "tax_obligation",
      entityId: obligationId,
      action: "payment_recorded",
      user,
    }));
  });
};

export const setTaxObligationStatus = async (
  inmobiliariaId,
  obligationId,
  status,
) => {
  if (!["pending", "payment_pending", "disputed", "cancelled"].includes(status)) {
    throw new Error("Estado tributario inválido.");
  }
  await assertAgency(inmobiliariaId);
  const user = currentUserOrThrow();
  const eventRef = doc(agencyCollection(inmobiliariaId, "events"));
  const batch = writeBatch(db);
  batch.set(agencyDoc(inmobiliariaId, "obligations", obligationId), {
    status,
    updatedAt: serverTimestamp(),
    updatedBy: user.uid,
  }, { merge: true });
  batch.set(eventRef, eventPayload({
    inmobiliariaId,
    entityType: "tax_obligation",
    entityId: obligationId,
    action: `status_${status}`,
    user,
  }));
  await batch.commit();
};

export const getTaxNotificationSettings = async (inmobiliariaId) => {
  if (!inmobiliariaId) return normalizeTaxNotificationSettings();
  const snap = await getDoc(
    agencyDoc(inmobiliariaId, "notificationSettings", "default"),
  );
  return normalizeTaxNotificationSettings(snap.exists() ? snap.data() : {});
};

export const saveTaxNotificationSettings = async (inmobiliariaId, value) => {
  await assertAgency(inmobiliariaId);
  const user = currentUserOrThrow();
  const settings = normalizeTaxNotificationSettings(value);
  const errors = validateTaxNotificationSettings(settings);
  if (errors.length) throw new Error(errors.join(" "));

  const ref = agencyDoc(inmobiliariaId, "notificationSettings", "default");
  const existing = await getDoc(ref);
  const eventRef = doc(agencyCollection(inmobiliariaId, "events"));
  const batch = writeBatch(db);
  batch.set(ref, {
    schemaVersion: 1,
    inmobiliariaId,
    ownerInmobiliariaId: inmobiliariaId,
    ...settings,
    ...(existing.exists() ? {} : {
      createdAt: serverTimestamp(),
      createdBy: user.uid,
    }),
    updatedAt: serverTimestamp(),
    updatedBy: user.uid,
  }, { merge: true });
  batch.set(eventRef, eventPayload({
    inmobiliariaId,
    entityType: "tax_settings",
    entityId: "default",
    action: "notification_settings_updated",
    user,
  }));
  await batch.commit();
  return settings;
};

export const getTaxNotifications = async (inmobiliariaId, maxItems = 50) => {
  if (!inmobiliariaId) return [];
  const snap = await getDocs(query(
    agencyCollection(inmobiliariaId, "notifications"),
    orderBy("createdAt", "desc"),
    limit(Math.min(100, Math.max(1, Math.round(Number(maxItems) || 50)))),
  ));
  return snap.docs.map((item) => ({ id: item.id, ...item.data() }));
};

export const markTaxNotificationRead = async (inmobiliariaId, notificationId) => {
  await assertAgency(inmobiliariaId);
  const user = currentUserOrThrow();
  await updateDoc(agencyDoc(inmobiliariaId, "notifications", notificationId), {
    status: "read",
    readAt: serverTimestamp(),
    readBy: user.uid,
  });
};

export const runTaxDueAutomationNow = async (inmobiliariaId = "") => {
  try {
    const callable = httpsCallable(functions, "taxRunDueAutomation");
    const result = await callable({ inmobiliariaId });
    return result.data;
  } catch (error) {
    const message = error?.details?.message || error?.message ||
      "No se pudo ejecutar la automatización tributaria.";
    throw new Error(message.replace(/^Firebase:\s*/i, ""));
  }
};
