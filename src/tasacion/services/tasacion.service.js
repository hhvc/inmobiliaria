import {
  collection,
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
} from "firebase/firestore";

import { auth, db } from "../../firebase/config";
import { assertInmobiliariaActiva } from "../../inmobiliaria/services/inmobiliaria.service";
import { calculateTasacion } from "../utils/tasacion.helpers";
import {
  createEmptyTasacion,
  normalizeTasacion,
} from "../utils/tasacionSchema";
import {
  canEditTasacion,
  canTransitionTasacion,
  createTasacionVerificationCode,
  createTasacionWorkflowEvent,
  validateTasacionForIssuance,
  validateTasacionForReview,
} from "../utils/tasacionWorkflow.helpers";

const tasacionesCollection = (inmobiliariaId) =>
  collection(db, "inmobiliarias", inmobiliariaId, "tasaciones");

const tasacionDoc = (inmobiliariaId, tasacionId) =>
  doc(db, "inmobiliarias", inmobiliariaId, "tasaciones", tasacionId);

const verificationDoc = (verificationCode) =>
  doc(db, "tasacion_verifications", verificationCode);

const cleanText = (value = "", maxLength = 1000) =>
  value.toString().trim().replace(/\s+/g, " ").slice(0, maxLength);

const sanitizeAgencySnapshot = (inmobiliaria = {}) => ({
  id: cleanText(inmobiliaria.id, 128),
  name: cleanText(inmobiliaria.nombre || inmobiliaria.razonSocial, 200),
  legalName: cleanText(inmobiliaria.razonSocial, 200),
  taxId: cleanText(inmobiliaria.cuit, 32),
  slug: cleanText(inmobiliaria.slug, 180),
  logoUrl: cleanText(
    inmobiliaria.branding?.logo?.url || inmobiliaria.branding?.logoUrl,
    1000,
  ),
  contact: {
    email: cleanText(inmobiliaria.configuracion?.contacto?.email, 220),
    phone: cleanText(inmobiliaria.configuracion?.contacto?.telefono, 80),
    whatsapp: cleanText(inmobiliaria.configuracion?.contacto?.whatsapp, 80),
  },
});

const transitionFieldFor = (status) => ({
  en_revision: "submittedAt",
  aprobada: "approvedAt",
  emitida: "issuedAt",
  entregada: "deliveredAt",
  anulada: "annulledAt",
}[status] || "");

const reviewForTransition = ({ current, toStatus, note, userId, occurredAt, signatureConfirmed }) => {
  if (toStatus === "en_revision") {
    return {
      ...current,
      status: "pendiente",
      notes: "",
      reviewedBy: "",
      reviewedAt: null,
      signatureConfirmed: false,
    };
  }
  if (toStatus === "observada") {
    return {
      ...current,
      status: "observada",
      notes: note,
      reviewedBy: userId,
      reviewedAt: occurredAt,
      signatureConfirmed: false,
    };
  }
  if (toStatus === "aprobada") {
    return {
      ...current,
      status: "aprobada",
      notes: note,
      reviewedBy: userId,
      reviewedAt: occurredAt,
      signatureConfirmed: false,
    };
  }
  if (toStatus === "emitida") {
    return {
      ...current,
      status: "aprobada",
      signatureConfirmed: signatureConfirmed === true,
    };
  }
  return current;
};

const sanitizeTasacion = (value = {}) => {
  const normalized = normalizeTasacion(value);
  const {
    id: _id,
    inmobiliariaId: _inmobiliariaId,
    ownerInmobiliariaId: _ownerInmobiliariaId,
    ownerId: _ownerId,
    createdBy: _createdBy,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    updatedBy: _updatedBy,
    calculationSnapshot: _calculationSnapshot,
    deleted: _deleted,
    deletedAt: _deletedAt,
    ...payload
  } = normalized;

  return payload;
};

export const createTasacion = async (inmobiliariaId, value) => {
  if (!inmobiliariaId) throw new Error("Seleccioná una inmobiliaria activa.");
  await assertInmobiliariaActiva(inmobiliariaId);

  const currentUser = auth.currentUser;
  if (!currentUser?.uid) throw new Error("Usuario no autenticado.");

  const payload = sanitizeTasacion(value);
  const calculationSnapshot = calculateTasacion(payload);
  const ref = doc(tasacionesCollection(inmobiliariaId));
  const nowIso = new Date().toISOString();
  const versioning = {
    seriesId: payload.versioning?.seriesId || ref.id,
    versionNumber: Math.max(1, Number(payload.versioning?.versionNumber) || 1),
    previousTasacionId: payload.versioning?.previousTasacionId || "",
    changeReason: cleanText(payload.versioning?.changeReason, 1000),
  };
  const workflow = {
    ...createEmptyTasacion().workflow,
    ...(payload.workflow || {}),
    events: [
      ...(Array.isArray(payload.workflow?.events) ? payload.workflow.events : []),
      createTasacionWorkflowEvent({
        type: versioning.previousTasacionId ? "version_created" : "created",
        toStatus: "borrador",
        note: versioning.changeReason,
        userId: currentUser.uid,
        occurredAt: nowIso,
      }),
    ],
  };

  await setDoc(ref, {
    ...payload,
    estado: "borrador",
    versioning,
    workflow,
    issuance: createEmptyTasacion().issuance,
    delivery: createEmptyTasacion().delivery,
    annulment: createEmptyTasacion().annulment,
    review: createEmptyTasacion().review,
    calculationSnapshot,
    inmobiliariaId,
    ownerInmobiliariaId: inmobiliariaId,
    ownerId: currentUser.uid,
    createdBy: currentUser.uid,
    updatedBy: currentUser.uid,
    deleted: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return ref.id;
};

export const updateTasacion = async (inmobiliariaId, tasacionId, value) => {
  if (!inmobiliariaId || !tasacionId) throw new Error("Faltan identificadores de la tasación.");
  await assertInmobiliariaActiva(inmobiliariaId);

  const currentUser = auth.currentUser;
  if (!currentUser?.uid) throw new Error("Usuario no autenticado.");

  const ref = tasacionDoc(inmobiliariaId, tasacionId);
  const existing = await getDoc(ref);
  if (!existing.exists()) throw new Error("La tasación no existe.");
  if (!canEditTasacion(existing.data().estado)) {
    throw new Error("Esta tasación no admite edición en su estado actual.");
  }

  const payload = sanitizeTasacion(value);
  const calculationSnapshot = calculateTasacion(payload);
  await updateDoc(ref, {
    ...payload,
    estado: existing.data().estado,
    versioning: existing.data().versioning || payload.versioning,
    workflow: existing.data().workflow || payload.workflow,
    issuance: existing.data().issuance || payload.issuance,
    delivery: existing.data().delivery || payload.delivery,
    annulment: existing.data().annulment || payload.annulment,
    review: existing.data().review || payload.review,
    calculationSnapshot,
    inmobiliariaId,
    ownerInmobiliariaId: inmobiliariaId,
    updatedBy: currentUser.uid,
    updatedAt: serverTimestamp(),
  });
};

export const getTasacionById = async (inmobiliariaId, tasacionId) => {
  if (!inmobiliariaId || !tasacionId) return null;
  const snap = await getDoc(tasacionDoc(inmobiliariaId, tasacionId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

export const getTasacionesByInmobiliaria = async (inmobiliariaId) => {
  if (!inmobiliariaId) return [];
  const snap = await getDocs(
    query(tasacionesCollection(inmobiliariaId), orderBy("updatedAt", "desc")),
  );
  return snap.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .filter((item) => item.deleted !== true);
};

export const softDeleteTasacion = async (inmobiliariaId, tasacionId) => {
  const currentUser = auth.currentUser;
  if (!currentUser?.uid) throw new Error("Usuario no autenticado.");
  const ref = tasacionDoc(inmobiliariaId, tasacionId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  if (!canEditTasacion(snap.data().estado)) {
    throw new Error("Solo los borradores y expedientes observados pueden eliminarse.");
  }
  await updateDoc(ref, {
    deleted: true,
    deletedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedBy: currentUser.uid,
  });
};

export const duplicateTasacion = async (inmobiliariaId, tasacionId) => {
  const source = await getTasacionById(inmobiliariaId, tasacionId);
  if (!source) throw new Error("No se encontró la tasación a duplicar.");
  const copy = normalizeTasacion(source);
  copy.estado = "borrador";
  copy.currentStep = 1;
  copy.scope.clientName = `${copy.scope.clientName || "Tasación"} · copia`;
  copy.scope.valuationDate = new Date().toISOString().slice(0, 10);
  if (copy.propertyLink?.mode === "new") {
    copy.propertyLink = {
      ...createEmptyTasacion().propertyLink,
      mode: "new",
      syncDraft: true,
    };
  }
  copy.review = {
    status: "pendiente",
    notes: "",
    reviewedBy: "",
    reviewedAt: null,
    signatureConfirmed: false,
  };
  copy.versioning = createEmptyTasacion().versioning;
  copy.workflow = createEmptyTasacion().workflow;
  copy.issuance = createEmptyTasacion().issuance;
  copy.delivery = createEmptyTasacion().delivery;
  copy.annulment = createEmptyTasacion().annulment;
  return createTasacion(inmobiliariaId, copy);
};

export const transitionTasacionState = async ({
  inmobiliariaId,
  tasacionId,
  toStatus,
  note = "",
  recipient = "",
  signatureConfirmed = false,
  inmobiliaria = null,
}) => {
  if (!inmobiliariaId || !tasacionId || !toStatus) {
    throw new Error("Faltan datos para actualizar el estado de la tasación.");
  }
  await assertInmobiliariaActiva(inmobiliariaId);

  const currentUser = auth.currentUser;
  if (!currentUser?.uid) throw new Error("Usuario no autenticado.");

  const ref = tasacionDoc(inmobiliariaId, tasacionId);
  const cleanNote = cleanText(note, 1000);
  const cleanRecipient = cleanText(recipient, 250);
  const verificationCode = toStatus === "emitida"
    ? createTasacionVerificationCode()
    : "";

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists()) throw new Error("La tasación no existe.");

    const currentData = snap.data();
    const fromStatus = currentData.estado || "borrador";
    if (!canTransitionTasacion(fromStatus, toStatus)) {
      throw new Error(`No se puede pasar de ${fromStatus} a ${toStatus}.`);
    }
    if (toStatus === "observada" && !cleanNote) {
      throw new Error("Ingresá el motivo de la observación.");
    }
    if (toStatus === "anulada" && !cleanNote) {
      throw new Error("Ingresá el motivo de la anulación.");
    }

    const normalized = normalizeTasacion(currentData);
    const now = Timestamp.now();
    const occurredAt = now.toDate().toISOString();
    const review = reviewForTransition({
      current: normalized.review,
      toStatus,
      note: cleanNote,
      userId: currentUser.uid,
      occurredAt,
      signatureConfirmed,
    });
    const candidate = { ...normalized, review };

    if (["en_revision", "aprobada"].includes(toStatus)) {
      const errors = validateTasacionForReview(candidate);
      if (errors.length) throw new Error(errors.join(" "));
    }
    if (toStatus === "emitida") {
      const errors = validateTasacionForIssuance(candidate);
      if (errors.length) throw new Error(errors.join(" "));
    }

    const workflowField = transitionFieldFor(toStatus);
    const workflow = {
      ...normalized.workflow,
      ...(workflowField ? { [workflowField]: now } : {}),
      events: [
        ...(normalized.workflow?.events || []),
        createTasacionWorkflowEvent({
          type: `status_${toStatus}`,
          fromStatus,
          toStatus,
          note: cleanNote || cleanRecipient,
          userId: currentUser.uid,
          occurredAt,
        }),
      ],
    };
    const updates = {
      estado: toStatus,
      review,
      workflow,
      updatedAt: now,
      updatedBy: currentUser.uid,
    };

    if (toStatus === "emitida") {
      const agencySnapshot = sanitizeAgencySnapshot({
        ...(inmobiliaria || {}),
        id: inmobiliariaId,
      });
      const versionNumber = Math.max(
        1,
        Number(normalized.versioning?.versionNumber) || 1,
      );
      updates.issuance = {
        verificationCode,
        issuedBy: currentUser.uid,
        agencySnapshot,
      };
      updates.calculationSnapshot = calculateTasacion(candidate);
      transaction.set(verificationDoc(verificationCode), {
        code: verificationCode,
        tasacionId,
        inmobiliariaId,
        agencyName: agencySnapshot.name,
        reportType: normalized.scope.reportType,
        typology: normalized.subject.typology,
        city: cleanText(normalized.inspection.address?.city, 120),
        valuationDate: normalized.scope.valuationDate,
        versionNumber,
        status: "emitida",
        issuedAt: now,
        updatedAt: now,
      });
    }

    if (toStatus === "entregada") {
      updates.delivery = { recipient: cleanRecipient, notes: cleanNote };
    }
    if (toStatus === "anulada") {
      updates.annulment = { reason: cleanNote };
    }

    const existingCode = currentData.issuance?.verificationCode;
    if (["entregada", "anulada"].includes(toStatus) && existingCode) {
      transaction.update(verificationDoc(existingCode), {
        status: toStatus,
        updatedAt: now,
      });
    }

    transaction.update(ref, updates);
  });
};

export const createRectifiedTasacion = async ({
  inmobiliariaId,
  tasacionId,
  reason,
}) => {
  const cleanReason = cleanText(reason, 1000);
  if (!cleanReason) throw new Error("Ingresá el motivo de la nueva versión.");

  const source = await getTasacionById(inmobiliariaId, tasacionId);
  if (!source) throw new Error("No se encontró la tasación de origen.");
  if (!["emitida", "entregada", "anulada"].includes(source.estado)) {
    throw new Error("Solo se rectifican informes emitidos, entregados o anulados.");
  }

  const copy = normalizeTasacion(source);
  copy.estado = "borrador";
  copy.currentStep = 1;
  copy.scope.valuationDate = new Date().toISOString().slice(0, 10);
  copy.versioning = {
    seriesId: source.versioning?.seriesId || source.id,
    versionNumber: Math.max(1, Number(source.versioning?.versionNumber) || 1) + 1,
    previousTasacionId: source.id,
    changeReason: cleanReason,
  };
  copy.workflow = createEmptyTasacion().workflow;
  copy.review = createEmptyTasacion().review;
  copy.issuance = createEmptyTasacion().issuance;
  copy.delivery = createEmptyTasacion().delivery;
  copy.annulment = createEmptyTasacion().annulment;
  return createTasacion(inmobiliariaId, copy);
};

export const getTasacionVerificationByCode = async (verificationCode) => {
  const code = cleanText(verificationCode, 80).toUpperCase();
  if (!code) return null;
  const snap = await getDoc(verificationDoc(code));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};
