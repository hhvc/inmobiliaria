export const INTERNAL_ROLES = {
    ADMIN: "admin",
    EDITOR: "editor",
    VIEWER: "viewer",
};

export const INTERNAL_ROLE_LABELS = {
    admin: "Administrador",
    editor: "Editor",
    viewer: "Solo lectura",
};

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

export const hasGlobalRole = (user, role) => {
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

export const isGlobalRoot = (user) => {
    return hasGlobalRole(user, "root");
};

export const isGlobalAdmin = (user) => {
    return hasGlobalRole(user, "admin");
};

export const userHasInmobiliaria = (user, inmobiliariaId) => {
    if (!user || !inmobiliariaId) return false;

    if (user.activeInmobiliariaId === inmobiliariaId) {
        return true;
    }

    if (!Array.isArray(user.inmobiliarias)) {
        return false;
    }

    return user.inmobiliarias.includes(inmobiliariaId);
};

export const getInternalRoleForInmobiliaria = (user, inmobiliariaId) => {
    if (!user || !inmobiliariaId) return INTERNAL_ROLES.VIEWER;

    if (isGlobalRoot(user)) {
        return INTERNAL_ROLES.ADMIN;
    }

    const belongsToInmobiliaria = userHasInmobiliaria(user, inmobiliariaId);

    /**
     * Este fallback es clave:
     * Firestore permite operar a un admin global que pertenece a la inmobiliaria.
     * Por eso el frontend no debe bloquearlo como viewer aunque falte o falle
     * inmobiliariaRoles[inmobiliariaId].
     */
    if (isGlobalAdmin(user) && belongsToInmobiliaria) {
        return INTERNAL_ROLES.ADMIN;
    }

    const rolesMap =
        user.inmobiliariaRoles && typeof user.inmobiliariaRoles === "object"
            ? user.inmobiliariaRoles
            : {};

    const explicitRole = normalizeRole(rolesMap[inmobiliariaId] || "");

    if (
        explicitRole === INTERNAL_ROLES.ADMIN ||
        explicitRole === INTERNAL_ROLES.EDITOR ||
        explicitRole === INTERNAL_ROLES.VIEWER
    ) {
        return explicitRole;
    }

    if (belongsToInmobiliaria) {
        return INTERNAL_ROLES.VIEWER;
    }

    return INTERNAL_ROLES.VIEWER;
};

export const isInternalAdmin = (role) => role === INTERNAL_ROLES.ADMIN;

export const isInternalEditor = (role) =>
    role === INTERNAL_ROLES.ADMIN || role === INTERNAL_ROLES.EDITOR;

export const isInternalViewer = (role) =>
    role === INTERNAL_ROLES.ADMIN ||
    role === INTERNAL_ROLES.EDITOR ||
    role === INTERNAL_ROLES.VIEWER;

export const getInternalPermissions = (role, isRoot = false) => {
    if (isRoot) {
        return {
            canViewInmuebles: true,
            canCreateInmuebles: true,
            canEditInmuebles: true,
            canViewConsultas: true,
            canManageConsultas: true,
            canManageBranding: true,
            canManageDomains: true,
            canManageUsers: true,
        };
    }

    if (role === INTERNAL_ROLES.ADMIN) {
        return {
            canViewInmuebles: true,
            canCreateInmuebles: true,
            canEditInmuebles: true,
            canViewConsultas: true,
            canManageConsultas: true,
            canManageBranding: true,
            canManageDomains: true,
            canManageUsers: true,
        };
    }

    if (role === INTERNAL_ROLES.EDITOR) {
        return {
            canViewInmuebles: true,
            canCreateInmuebles: true,
            canEditInmuebles: true,
            canViewConsultas: true,
            canManageConsultas: true,
            canManageBranding: false,
            canManageDomains: false,
            canManageUsers: false,
        };
    }

    return {
        canViewInmuebles: true,
        canCreateInmuebles: false,
        canEditInmuebles: false,
        canViewConsultas: true,
        canManageConsultas: false,
        canManageBranding: false,
        canManageDomains: false,
        canManageUsers: false,
    };
};