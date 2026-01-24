const ACTIVE_INMOBILIARIA_KEY = "activeInmobiliariaId";

/**
 * Guarda la inmobiliaria activa
 */
export const setActiveInmobiliariaId = (inmobiliariaId) => {
  if (!inmobiliariaId || typeof inmobiliariaId !== "string") return;
  localStorage.setItem(ACTIVE_INMOBILIARIA_KEY, inmobiliariaId);
};

/**
 * Obtiene la inmobiliaria activa
 */
export const getActiveInmobiliariaId = () => {
  const value = localStorage.getItem(ACTIVE_INMOBILIARIA_KEY);
  return value || null;
};

/**
 * Limpia la inmobiliaria activa (logout, cambio de usuario, etc.)
 */
export const clearActiveInmobiliariaId = () => {
  localStorage.removeItem(ACTIVE_INMOBILIARIA_KEY);
};

/**
 * Valida que la inmobiliaria activa pertenezca al usuario
 * (muy importante para evitar estados rotos)
 */
export const validateActiveInmobiliariaId = (user) => {
  if (!user?.inmobiliarias?.length) {
    clearActiveInmobiliariaId();
    return null;
  }

  const storedId = getActiveInmobiliariaId();

  if (storedId && user.inmobiliarias.includes(storedId)) {
    return storedId;
  }

  // fallback: primera inmobiliaria asignada
  const fallbackId = user.inmobiliarias[0];
  setActiveInmobiliariaId(fallbackId);
  return fallbackId;
};
