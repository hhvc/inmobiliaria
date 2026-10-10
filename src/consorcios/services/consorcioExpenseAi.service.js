import { getFunctions, httpsCallable } from "firebase/functions";

import app from "../../firebase/config";

const functions = getFunctions(app, "southamerica-east1");

export const CONSORTIUM_EXPENSE_AI_MAX_FILE_BYTES = 5 * 1024 * 1024;
export const CONSORTIUM_EXPENSE_AI_MAX_FILES = 5;

const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const getFriendlyError = (error) => {
  const knownMessages = {
    "functions/unauthenticated": "Iniciá sesión para usar la lectura asistida.",
    "functions/permission-denied": "No tenés permisos para preparar gastos de este consorcio.",
    "functions/resource-exhausted": "Alcanzaste el límite diario de comprobantes asistidos.",
    "functions/deadline-exceeded": "La lectura demoró demasiado. Volvé a intentarlo.",
    "functions/unavailable": "La lectura asistida no está disponible en este momento.",
  };
  if (knownMessages[error?.code]) return knownMessages[error.code];
  const message = error?.message || "";
  const colonIndex = message.indexOf(":");
  return (colonIndex >= 0 ? message.slice(colonIndex + 1) : message).trim()
    || "No pudimos leer el comprobante. Podés cargarlo manualmente.";
};

const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(new Error("No pudimos leer el archivo seleccionado."));
  reader.readAsDataURL(file);
});

export const validateConsortiumExpenseAiFile = (file) => {
  if (!file) return "Seleccioná un archivo.";
  if (!ALLOWED_TYPES.has(file.type)) return "Solo se admiten PDF, JPG, PNG o WEBP.";
  if (!Number(file.size) || file.size > CONSORTIUM_EXPENSE_AI_MAX_FILE_BYTES) {
    return "Cada archivo debe pesar hasta 5 MB.";
  }
  return "";
};

export const analyzeConsortiumExpenseDocument = async ({
  inmobiliariaId,
  consortiumId,
  periodId,
  file,
}) => {
  const validationError = validateConsortiumExpenseAiFile(file);
  if (validationError) throw new Error(validationError);
  try {
    const callable = httpsCallable(functions, "consortiumAnalyzeExpenseDocument", {
      timeout: 90000,
    });
    const dataUrl = await readFileAsDataUrl(file);
    const response = await callable({
      inmobiliariaId,
      consortiumId,
      periodId,
      fileName: file.name,
      contentType: file.type,
      dataUrl,
    });
    return response.data || {};
  } catch (error) {
    const friendlyError = new Error(getFriendlyError(error));
    friendlyError.code = error?.code || "";
    throw friendlyError;
  }
};

