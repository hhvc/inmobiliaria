import { TASACION_STEPS } from "./tasacion.constants.js";
import { validateTasacionStep } from "./tasacionSchema.js";

export const TASACION_EDITABLE_STATES = Object.freeze([
  "borrador",
  "observada",
]);

export const TASACION_WORKFLOW_TRANSITIONS = Object.freeze({
  borrador: ["en_revision"],
  observada: ["en_revision"],
  en_revision: ["observada", "aprobada"],
  aprobada: ["observada", "emitida"],
  emitida: ["entregada", "anulada"],
  entregada: ["anulada"],
  anulada: [],
});

const compactText = (value = "", maxLength = 500) =>
  value.toString().trim().replace(/\s+/g, " ").slice(0, maxLength);

export const canEditTasacion = (status = "borrador") =>
  TASACION_EDITABLE_STATES.includes(status);

export const getAllowedTasacionTransitions = (status = "borrador") =>
  TASACION_WORKFLOW_TRANSITIONS[status] || [];

export const canTransitionTasacion = (fromStatus, toStatus) =>
  getAllowedTasacionTransitions(fromStatus).includes(toStatus);

export const validateTasacionForReview = (tasacion = {}) =>
  Array.from(
    new Set(
      TASACION_STEPS.flatMap((step) =>
        validateTasacionStep(tasacion, step.id),
      ),
    ),
  );

export const validateTasacionForIssuance = (tasacion = {}) => {
  const errors = validateTasacionForReview(tasacion);
  const appraiser = tasacion.scope?.appraiser || {};

  if (!compactText(appraiser.name)) {
    errors.push("Identificá al profesional responsable del informe.");
  }
  if (
    tasacion.scope?.reportType !== "estimacion_comercial"
    && !compactText(appraiser.license)
  ) {
    errors.push("Ingresá la matrícula del profesional responsable.");
  }
  if (tasacion.review?.signatureConfirmed !== true) {
    errors.push("Confirmá que el informe fue revisado y firmado por el profesional.");
  }

  return Array.from(new Set(errors));
};

export const createTasacionVerificationCode = ({
  date = new Date(),
  randomUUID = globalThis.crypto?.randomUUID?.bind(globalThis.crypto),
} = {}) => {
  const year = Number.isNaN(date.getTime()) ? new Date().getFullYear() : date.getFullYear();
  const randomValue = randomUUID
    ? randomUUID().replace(/-/g, "")
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  return `ONO-${year}-${randomValue.slice(0, 12).toUpperCase()}`;
};

export const createTasacionWorkflowEvent = ({
  type,
  fromStatus = "",
  toStatus = "",
  note = "",
  userId = "",
  occurredAt = new Date().toISOString(),
} = {}) => ({
  type: compactText(type, 80),
  fromStatus: compactText(fromStatus, 40),
  toStatus: compactText(toStatus, 40),
  note: compactText(note, 1000),
  userId: compactText(userId, 128),
  occurredAt,
});

export const getTasacionVersionLabel = (tasacion = {}) => {
  const versionNumber = Math.max(
    1,
    Number(tasacion.versioning?.versionNumber) || 1,
  );
  return `Versión ${versionNumber}`;
};
