/**
 * Estados válidos de un inmueble
 * Fuente única de verdad (domain layer)
 */
export const INMUEBLE_ESTADOS = Object.freeze({
  ACTIVO: "activo",
  INACTIVO: "inactivo",
  PAUSADO: "pausado",
});

/**
 * Array utilitario (para selects, validaciones, etc.)
 */
export const INMUEBLE_ESTADOS_ARRAY = Object.freeze(
  Object.values(INMUEBLE_ESTADOS),
);
