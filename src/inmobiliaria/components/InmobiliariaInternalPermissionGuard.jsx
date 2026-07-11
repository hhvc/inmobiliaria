import { useMemo } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../../context/auth/useAuth";
import { useActiveInmobiliariaModules } from "../hooks/useActiveInmobiliariaModules";
import {
    getInternalPermissions,
    getInternalRoleForInmobiliaria,
    INTERNAL_ROLE_LABELS,
} from "../utils/inmobiliariaPermissions";

const getRoleFlags = (user) => {
    const roles = user?.roles || [];
    const primaryRole = user?.primaryRole || user?.role || "";

    return {
        isRoot:
            primaryRole === "root" ||
            user?.role === "root" ||
            roles.includes("root"),
    };
};

const PERMISSION_LABELS = {
    canViewInmuebles: "ver inmuebles",
    canCreateInmuebles: "crear inmuebles",
    canEditInmuebles: "editar inmuebles",
    canViewConsultas: "ver consultas",
    canManageConsultas: "gestionar consultas",
    canManageBranding: "gestionar branding",
    canManageDomains: "gestionar dominios",
    canManageUsers: "gestionar usuarios",
};

const InmobiliariaInternalPermissionGuard = ({
    permission,
    children,
}) => {
    const { user } = useAuth();

    const {
        loading,
        activeInmobiliaria,
        activeInmobiliariaId,
    } = useActiveInmobiliariaModules();

    const { isRoot } = getRoleFlags(user);

    const internalRole = useMemo(() => {
        return getInternalRoleForInmobiliaria(user, activeInmobiliariaId);
    }, [activeInmobiliariaId, user]);

    const permissions = useMemo(() => {
        return getInternalPermissions(internalRole, isRoot);
    }, [internalRole, isRoot]);

    if (isRoot) {
        return children;
    }

    if (loading) {
        return (
            <main className="container py-5 text-center">
                <div className="spinner-border" />
                <p className="text-muted mt-3">Verificando permisos internos...</p>
            </main>
        );
    }

    if (!activeInmobiliaria) {
        return (
            <main className="container py-5">
                <div className="alert alert-info">
                    No hay inmobiliaria activa para verificar permisos.
                </div>

                <Link to="/admin/inmobiliaria" className="btn btn-primary">
                    Volver al panel
                </Link>
            </main>
        );
    }

    if (!permissions[permission]) {
        return (
            <main className="container py-5">
                <div className="alert alert-warning">
                    <h1 className="h5">Permiso interno insuficiente</h1>

                    <p className="mb-2">
                        Tu rol interno en <strong>{activeInmobiliaria.nombre}</strong> es{" "}
                        <strong>{INTERNAL_ROLE_LABELS[internalRole] || internalRole}</strong>.
                    </p>

                    <p className="mb-0">
                        Para esta acción necesitás permiso para{" "}
                        <strong>{PERMISSION_LABELS[permission] || permission}</strong>.
                    </p>
                </div>

                <Link to="/admin/inmobiliaria" className="btn btn-primary">
                    Volver al panel
                </Link>
            </main>
        );
    }

    return children;
};

export default InmobiliariaInternalPermissionGuard;