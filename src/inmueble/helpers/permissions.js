/**
 * Helpers de permisos para Inmuebles
 * Deben reflejar EXACTAMENTE la lógica de Firestore Rules
 */

/* ============================
   Roles
   ============================ */

export const hasRole = (user, role) => {
  if (!user) return false;

  // Nuevo esquema
  if (Array.isArray(user.roles)) {
    return user.roles.includes(role);
  }

  // Fallback legacy
  return user.role === role;
};

export const isRoot = (user) => hasRole(user, "root");
export const isAdmin = (user) => hasRole(user, "admin");

/* ============================
   Inmobiliarias
   ============================ */

export const userHasInmobiliaria = (user, inmobiliariaId) => {
  if (!user || !inmobiliariaId) return false;
  if (!Array.isArray(user.inmobiliarias)) return false;

  return user.inmobiliarias.includes(inmobiliariaId);
};

/* ============================
   Inmuebles
   ============================ */

export const isOwner = (user, inmueble) => {
  if (!user || !inmueble) return false;
  return inmueble.ownerId === user.uid;
};

export const isPublicInmueble = (inmueble) => {
  return inmueble?.estado === "activo";
};

/* ============================
   Permisos de lectura
   ============================ */

export const canReadInmueble = (user, inmueble) => {
  if (!inmueble) return false;

  if (isPublicInmueble(inmueble)) return true;
  if (isRoot(user)) return true;

  if (isAdmin(user)) {
    return userHasInmobiliaria(user, inmueble.inmobiliariaId);
  }

  return isOwner(user, inmueble);
};

/* ============================
   Permisos de creación
   ============================ */

export const canCreateInmueble = (user, inmobiliariaId) => {
  if (!user) return false;

  if (isRoot(user)) return true;

  if (isAdmin(user)) {
    return userHasInmobiliaria(user, inmobiliariaId);
  }

  return false;
};

/* ============================
   Permisos de edición
   ============================ */

export const canEditInmueble = (user, inmueble) => {
  if (!user || !inmueble) return false;

  if (isRoot(user)) return true;

  if (isAdmin(user)) {
    return userHasInmobiliaria(user, inmueble.inmobiliariaId);
  }

  return isOwner(user, inmueble);
};

/* ============================
   Permisos de borrado
   ============================ */

export const canDeleteInmueble = (user, inmueble) => {
  if (!user || !inmueble) return false;

  if (isRoot(user)) return true;

  return isAdmin(user) && userHasInmobiliaria(user, inmueble.inmobiliariaId);
};
