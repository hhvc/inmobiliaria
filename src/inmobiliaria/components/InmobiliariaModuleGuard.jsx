import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../../context/auth/useAuth";
import { getInmobiliariasByRole } from "../services/inmobiliaria.service";

const DEFAULT_MODULES = ["inmuebles", "consultas"];

const MODULE_LABELS = {
    inmuebles: "Inmuebles",
    consultas: "Consultas",
    dominios: "Dominios propios",
    branding: "Branding",
    usuarios: "Usuarios de inmobiliaria",
    reportes: "Reportes",
};

const getRoleFlags = (user) => {
    const roles = user?.roles || [];
    const primaryRole = user?.primaryRole || user?.role || "";

    return {
        isRoot:
            primaryRole === "root" ||
            user?.role === "root" ||
            roles.includes("root"),
        isAdmin:
            primaryRole === "admin" ||
            user?.role === "admin" ||
            roles.includes("admin"),
    };
};

const getStoredActiveInmobiliariaId = () => {
    if (typeof window === "undefined") return null;

    return (
        window.localStorage.getItem("activeInmobiliariaId") ||
        window.localStorage.getItem("inmobiliariaActivaId") ||
        window.localStorage.getItem("activeInmobiliaria") ||
        null
    );
};

const getModulesForInmobiliaria = (inmobiliaria) => {
    if (!inmobiliaria) return [];

    return Array.isArray(inmobiliaria.modulosSuscriptos)
        ? inmobiliaria.modulosSuscriptos
        : DEFAULT_MODULES;
};

const InmobiliariaModuleGuard = ({ moduleId, children }) => {
    const { user } = useAuth();

    const [inmobiliarias, setInmobiliarias] = useState([]);
    const [activeInmobiliariaId, setActiveInmobiliariaId] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const { isRoot, isAdmin } = getRoleFlags(user);

    const activeInmobiliaria = useMemo(() => {
        return inmobiliarias.find((inmo) => inmo.id === activeInmobiliariaId) || null;
    }, [activeInmobiliariaId, inmobiliarias]);

    const subscribedModules = useMemo(() => {
        return getModulesForInmobiliaria(activeInmobiliaria);
    }, [activeInmobiliaria]);

    const hasModule = useMemo(() => {
        if (isRoot) return true;

        return subscribedModules.includes(moduleId);
    }, [isRoot, moduleId, subscribedModules]);

    useEffect(() => {
        const loadInmobiliarias = async () => {
            try {
                setLoading(true);
                setError(null);

                if (!user?.uid) {
                    setInmobiliarias([]);
                    return;
                }

                if (isRoot) {
                    return;
                }

                const data = await getInmobiliariasByRole(user);
                const storedId = getStoredActiveInmobiliariaId();

                const initialId =
                    storedId && data.some((inmo) => inmo.id === storedId)
                        ? storedId
                        : data[0]?.id || "";

                setInmobiliarias(data);
                setActiveInmobiliariaId(initialId);
            } catch (err) {
                console.error("Error verificando módulo de inmobiliaria:", err);
                setError("No se pudieron verificar los permisos del módulo.");
            } finally {
                setLoading(false);
            }
        };

        if (isRoot) {
            setLoading(false);
            return;
        }

        if (isAdmin) {
            loadInmobiliarias();
        } else {
            setLoading(false);
        }
    }, [isAdmin, isRoot, user]);

    if (isRoot) {
        return children;
    }

    if (!isAdmin) {
        return (
            <main className="container py-5">
                <div className="alert alert-warning">
                    Esta sección está disponible para usuarios administradores.
                </div>
            </main>
        );
    }

    if (loading) {
        return (
            <main className="container py-5 text-center">
                <div className="spinner-border" />
                <p className="text-muted mt-3">Verificando permisos...</p>
            </main>
        );
    }

    if (error) {
        return (
            <main className="container py-5">
                <div className="alert alert-danger">{error}</div>
            </main>
        );
    }

    if (!activeInmobiliaria) {
        return (
            <main className="container py-5">
                <div className="alert alert-info">
                    No tenés inmobiliarias asignadas para acceder a este módulo.
                </div>

                <Link to="/admin/inmobiliaria" className="btn btn-primary">
                    Volver al panel
                </Link>
            </main>
        );
    }

    if (!hasModule) {
        return (
            <main className="container py-5">
                <div className="alert alert-warning">
                    <h1 className="h5">Módulo no habilitado</h1>

                    <p className="mb-2">
                        La inmobiliaria <strong>{activeInmobiliaria.nombre}</strong> no
                        tiene habilitado el módulo{" "}
                        <strong>{MODULE_LABELS[moduleId] || moduleId}</strong>.
                    </p>

                    <p className="mb-0">
                        Un usuario root puede habilitarlo desde Administración global.
                    </p>
                </div>

                <Link to="/admin/inmobiliaria" className="btn btn-primary">
                    Volver al panel de inmobiliaria
                </Link>
            </main>
        );
    }

    return children;
};

export default InmobiliariaModuleGuard;