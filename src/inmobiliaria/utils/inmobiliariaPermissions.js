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

export const getInternalRoleForInmobiliaria = (user, inmobiliariaId) => {
    if (!user || !inmobiliariaId) return INTERNAL_ROLES.VIEWER;

    const rolesMap = user.inmobiliariaRoles || {};

    return rolesMap[inmobiliariaId] || INTERNAL_ROLES.VIEWER;
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