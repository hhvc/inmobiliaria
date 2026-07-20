/**
 * Helpers de permisos para Inmuebles.
 *
 * Criterio actual:
 * - Firestore permite crear/editar si el usuario es root.
 * - O si es admin global y pertenece a la inmobiliaria.
 *
 * Los roles internos por inmobiliaria se mantienen como dato útil de UI,
 * pero NO deben bloquear creación si las rules no los bloquean.
 */

/* ============================
   Normalización de roles
   ============================ */

const ROLE_ALIASES = {
  user: "usuario",
  usuario: "usuario",
  viewer: "viewer",
  lectura: "viewer",
  solo_lectura: "viewer",
  readonly: "viewer",
  editor: "editor",
  admin: "admin",
  root: "root",
};

const INTERNAL_ROLE_LABELS = {
  root: "Root",
  admin: "Administrador",
  editor: "Editor",
  viewer: "Solo lectura",
  usuario: "Usuario",
};

export const normalizeRole = (role = "") => {
  const value = role.toString().trim().toLowerCase();

  return ROLE_ALIASES[value] || value;
};

export const normalizeRoles = (roles = []) => {
  const source = Array.isArray(roles) ? roles : [];

  const normalized = source
    .map((role) => normalizeRole(role))
    .filter(Boolean);

  const unique = Array.from(new Set(normalized));

  return unique.length > 0 ? unique : ["usuario"];
};

/* ============================
   Roles globales
   ============================ */

export const hasRole = (user, role) => {
  if (!user) return false;

  const normalizedRole = normalizeRole(role);

  const roles = normalizeRoles(
    Array.isArray(user.roles)
      ? user.roles
      : user.role
        ? [user.role]
        : [],
  );

  const primaryRole = normalizeRole(user.primaryRole || user.role || "");

  return roles.includes(normalizedRole) || primaryRole === normalizedRole;
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

export const getUserInmobiliariaRole = (user, inmobiliariaId) => {
  if (!user || !inmobiliariaId) return "";

  if (isRoot(user)) return "root";

  const inmobiliariaRoles =
    user.inmobiliariaRoles && typeof user.inmobiliariaRoles === "object"
      ? user.inmobiliariaRoles
      : {};

  const explicitRole = normalizeRole(inmobiliariaRoles[inmobiliariaId] || "");

  if (explicitRole) return explicitRole;

  if (isAdmin(user) && userHasInmobiliaria(user, inmobiliariaId)) {
    return "admin";
  }

  if (userHasInmobiliaria(user, inmobiliariaId)) {
    return "viewer";
  }

  return "";
};

export const getUserInmobiliariaRoleLabel = (user, inmobiliariaId) => {
  const role = getUserInmobiliariaRole(user, inmobiliariaId);

  return INTERNAL_ROLE_LABELS[role] || "Sin permiso";
};

/* ============================
   Inmuebles
   ============================ */

export const isOwner = (user, inmueble) => {
  if (!user || !inmueble) return false;

  return inmueble.ownerId === user.uid;
};

export const isPublicInmueble = (inmueble) => {
  return (
    inmueble?.estado === "activo" &&
    inmueble?.deleted !== true &&
    inmueble?.publicarEnPortal === true
  );
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
  if (!user || !inmobiliariaId) return false;

  if (isRoot(user)) return true;

  return isAdmin(user) && userHasInmobiliaria(user, inmobiliariaId);
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

/* ============================
   Permisos auxiliares de UI
   ============================ */

export const canManageInmobiliaria = (user, inmobiliariaId) => {
  if (!user || !inmobiliariaId) return false;

  if (isRoot(user)) return true;

  return isAdmin(user) && userHasInmobiliaria(user, inmobiliariaId);
};

export const canManageInmueblesForInmobiliaria = (user, inmobiliariaId) => {
  return canCreateInmueble(user, inmobiliariaId);
};