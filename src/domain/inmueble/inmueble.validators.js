import { INMUEBLE_ESTADOS_ARRAY } from "./inmueble.constants";

/**
 * Normaliza y valida estado de inmueble
 */
export const validateInmuebleEstado = (estado) => {
  if (typeof estado !== "string") {
    throw new Error("El estado debe ser un string");
  }

  const normalized = estado.trim().toLowerCase();

  if (!INMUEBLE_ESTADOS_ARRAY.includes(normalized)) {
    throw new Error(
      `Estado inválido. Permitidos: ${INMUEBLE_ESTADOS_ARRAY.join(", ")}`,
    );
  }

  return normalized;
};
