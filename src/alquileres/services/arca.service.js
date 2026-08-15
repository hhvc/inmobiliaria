import { getFunctions, httpsCallable } from "firebase/functions";

import app from "../../firebase/config";

const functions = getFunctions(app, "southamerica-east1");

const FRIENDLY_ARCA_ERRORS = {
  "functions/permission-denied": "No tenés permisos para realizar esta operación fiscal.",
  "functions/unauthenticated": "Tu sesión venció. Volvé a ingresar para continuar.",
  "functions/unavailable": "ARCA no está disponible en este momento. Intentá nuevamente en unos minutos.",
  "functions/deadline-exceeded": "ARCA demoró demasiado en responder. Intentá nuevamente.",
  "functions/internal": "No pudimos completar la operación fiscal. Intentá nuevamente; si el problema continúa, contactá al soporte de ONO Prop.",
};

export const ARCA_RECEIVER_IVA_CONDITIONS = [
  { id: 1, label: "IVA Responsable Inscripto" },
  { id: 4, label: "IVA Sujeto Exento" },
  { id: 5, label: "Consumidor Final" },
  { id: 6, label: "Responsable Monotributo" },
  { id: 7, label: "Sujeto No Categorizado" },
  { id: 8, label: "Proveedor del Exterior" },
  { id: 9, label: "Cliente del Exterior" },
  { id: 10, label: "IVA Liberado – Ley 19.640" },
  { id: 13, label: "Monotributista Social" },
  { id: 15, label: "IVA No Alcanzado" },
  { id: 16, label: "Monotributo Trabajador Independiente Promovido" },
];

const callArcaFunction = async (name, payload = {}) => {
  try {
    const callable = httpsCallable(functions, name);
    const result = await callable(payload);
    return result.data;
  } catch (error) {
    const detailMessage = typeof error?.details === "string"
      ? error.details
      : error?.details?.message;
    const rawMessage = detailMessage || error?.message || "";
    const cleanedMessage = rawMessage
      .replace(/^Firebase:\s*/i, "")
      .replace(/\s*\(functions\/[^)]*\)\.?$/, "")
      .trim();
    const friendlyFallback = FRIENDLY_ARCA_ERRORS[error?.code]
      || "No se pudo completar la operación con ARCA. Intentá nuevamente.";
    const message = !cleanedMessage || /^(internal|unknown)$/i.test(cleanedMessage)
      ? friendlyFallback
      : cleanedMessage;
    const normalized = new Error(message);
    normalized.code = error?.code || "";
    throw normalized;
  }
};

export const emailAuthorizedArcaVoucher = (payload) => callArcaFunction(
  "arcaEmailAuthorizedVoucher",
  payload,
);

export const getAuthorizedArcaVoucherPdf = (payload) => callArcaFunction(
  "arcaGetAuthorizedVoucherPdf",
  payload,
);

export const getArcaOverview = (inmobiliariaId) => callArcaFunction(
  "arcaGetOverview",
  { inmobiliariaId },
);

export const getArcaAdminOverview = () => callArcaFunction("arcaGetAdminOverview");

export const getArcaRegistrationCertificate = (payload) => callArcaFunction(
  "arcaGetRegistrationCertificate",
  payload,
);

export const getArcaProductionRegistrationCertificate = (profileId) => callArcaFunction(
  "arcaGetProductionRegistrationCertificate",
  { profileId },
);

export const upsertArcaIssuerProfile = (payload) => callArcaFunction(
  "arcaUpsertIssuerProfile",
  payload,
);

export const testArcaHomologation = (profileId) => callArcaFunction(
  "arcaTestHomologation",
  { profileId },
);

export const testArcaProductionConnection = (profileId) => callArcaFunction(
  "arcaTestProductionConnection",
  { profileId },
);

export const createRentalArcaDraft = (payload) => callArcaFunction(
  "arcaCreateRentalInvoiceDraft",
  payload,
);

export const prepareProductionRentalArcaPreview = (payload) => callArcaFunction(
  "arcaPrepareProductionRentalInvoicePreview",
  payload,
);

export const prepareProductionRentalArcaCreditNotePreview = (payload) => callArcaFunction(
  "arcaPrepareProductionRentalCreditNotePreview",
  payload,
);

export const authorizeRentalArcaDraft = ({ inmobiliariaId, draftId }) => callArcaFunction(
  "arcaAuthorizeRentalInvoice",
  { inmobiliariaId, draftId, confirmHomologation: true },
);

export const authorizeProductionRentalArcaPreview = ({
  inmobiliariaId,
  previewId,
  sequenceObservedAt,
  confirmationText,
}) => callArcaFunction(
  "arcaAuthorizeProductionRentalInvoice",
  {
    inmobiliariaId,
    previewId,
    sequenceObservedAt,
    confirmationText,
    confirmProduction: true,
  },
);
