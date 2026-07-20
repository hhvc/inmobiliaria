import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { useAuth } from "../../context/auth/useAuth";
import { useActiveInmobiliariaModules } from "../hooks/useActiveInmobiliariaModules";
import {
    getInternalPermissions,
    getInternalRoleForInmobiliaria,
    INTERNAL_ROLE_LABELS,
    isGlobalRoot,
} from "../utils/inmobiliariaPermissions";

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

const InmobiliariaInternalPermissionGuard = ({ permission, children }) => {
    const { user } = useAuth();
    const [searchParams] = useSearchParams();

    const { loading, activeInmobiliaria, activeInmobiliariaId } =
        useActiveInmobiliariaModules();

    const queryInmobiliariaId = searchParams.get("inmobiliariaId") || "";

    const permissionInmobiliariaId =
        queryInmobiliariaId || activeInmobiliariaId || "";

    const isRoot = isGlobalRoot(user);

    const internalRole = useMemo(() => {
        return getInternalRoleForInmobiliaria(user, permissionInmobiliariaId);
    }, [permissionInmobiliariaId, user]);

    const permissions = useMemo(() => {
        return getInternalPermissions(internalRole, isRoot);
    }, [internalRole, isRoot]);

    const permissionInmobiliariaName = useMemo(() => {
        if (
            activeInmobiliaria &&
            activeInmobiliariaId === permissionInmobiliariaId
        ) {
            return activeInmobiliaria.nombre || "la inmobiliaria activa";
        }

        if (queryInmobiliariaId) {
            return `la inmobiliaria seleccionada (${queryInmobiliariaId})`;
        }

        return activeInmobiliaria?.nombre || "la inmobiliaria activa";
    }, [
        activeInmobiliaria,
        activeInmobiliariaId,
        permissionInmobiliariaId,
        queryInmobiliariaId,
    ]);

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

    if (!permissionInmobiliariaId) {
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
                        Tu rol interno en <strong>{permissionInmobiliariaName}</strong> es{" "}
                        <strong>{INTERNAL_ROLE_LABELS[internalRole] || internalRole}</strong>.
                    </p>

                    <p className="mb-2">
                        Para esta acción necesitás permiso para{" "}
                        <strong>{PERMISSION_LABELS[permission] || permission}</strong>.
                    </p>

                    <hr />

                    <div className="small mb-0">
                        <div>
                            <strong>Inmobiliaria verificada:</strong>{" "}
                            {permissionInmobiliariaId}
                        </div>
                        <div>
                            <strong>Rol global:</strong>{" "}
                            {user?.primaryRole || user?.role || "sin rol"}
                        </div>
                        <div>
                            <strong>Roles:</strong>{" "}
                            {Array.isArray(user?.roles) ? user.roles.join(", ") : "sin roles"}
                        </div>
                    </div>
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