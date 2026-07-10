import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../../context/auth/useAuth";
import {
    getAllInmobiliarias,
    getInmobiliariasByRole,
} from "../services/inmobiliaria.service";

const DEFAULT_MODULES = ["inmuebles", "consultas"];

const MODULE_CARDS = [
    {
        id: "inmuebles",
        title: "Inmuebles",
        description: "Crear, editar, publicar y administrar propiedades.",
        route: "/admin/inmuebles/listado",
        cta: "Administrar inmuebles",
        icon: "🏠",
    },
    {
        id: "consultas",
        title: "Consultas",
        description: "Gestionar leads recibidos desde fichas públicas.",
        route: "/admin/inmuebles/consultas",
        cta: "Ver consultas",
        icon: "📩",
    },
    {
        id: "dominios",
        title: "Dominios propios",
        description: "Configurar dominios públicos asociados a la inmobiliaria.",
        route: "/admin/inmobiliaria/dominios",
        cta: "Configurar dominios",
        icon: "🌐",
    },
    {
        id: "branding",
        title: "Branding",
        description: "Actualizar logo, portada, contacto y datos comerciales.",
        route: "/admin/inmobiliaria/branding",
        cta: "Editar marca",
        icon: "🎨",
    },
    {
        id: "usuarios",
        title: "Usuarios",
        description: "Administrar usuarios vinculados a la inmobiliaria.",
        route: "/admin/inmobiliaria/usuarios",
        cta: "Gestionar usuarios",
        icon: "👥",
    },
    {
        id: "reportes",
        title: "Reportes",
        description: "Métricas de publicaciones, consultas y rendimiento.",
        route: null,
        cta: "Próximamente",
        icon: "📊",
        comingSoon: true,
    },
];

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

const getInitialInmobiliariaId = ({ user, inmobiliarias, isRoot }) => {
    const storedId = getStoredActiveInmobiliariaId();

    if (storedId && inmobiliarias.some((inmo) => inmo.id === storedId)) {
        return storedId;
    }

    if (!isRoot && Array.isArray(user?.inmobiliarias)) {
        const firstAllowed = user.inmobiliarias.find((id) =>
            inmobiliarias.some((inmo) => inmo.id === id),
        );

        if (firstAllowed) return firstAllowed;
    }

    return inmobiliarias[0]?.id || "";
};

const getModuleRoute = (module, inmobiliariaId, isRoot) => {
    if (module.rootOnlyRoute && !isRoot) return null;

    if (module.routeFactory) {
        return module.routeFactory(inmobiliariaId);
    }

    return module.route;
};

const InmobiliariaDashboardPage = () => {
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
        if (!activeInmobiliaria) return DEFAULT_MODULES;

        return Array.isArray(activeInmobiliaria.modulosSuscriptos)
            ? activeInmobiliaria.modulosSuscriptos
            : DEFAULT_MODULES;
    }, [activeInmobiliaria]);

    const visibleModules = useMemo(() => {
        if (isRoot) return MODULE_CARDS;

        return MODULE_CARDS.filter((module) => subscribedModules.includes(module.id));
    }, [isRoot, subscribedModules]);

    useEffect(() => {
        const loadInmobiliarias = async () => {
            try {
                setLoading(true);
                setError(null);

                if (!user?.uid) {
                    setInmobiliarias([]);
                    return;
                }

                const data = isRoot
                    ? await getAllInmobiliarias()
                    : await getInmobiliariasByRole(user);

                setInmobiliarias(data);

                const initialId = getInitialInmobiliariaId({
                    user,
                    inmobiliarias: data,
                    isRoot,
                });

                setActiveInmobiliariaId(initialId);
            } catch (err) {
                console.error("Error cargando dashboard de inmobiliaria:", err);
                setError("No se pudo cargar el panel de inmobiliaria.");
            } finally {
                setLoading(false);
            }
        };

        if (isRoot || isAdmin) {
            loadInmobiliarias();
        } else {
            setLoading(false);
        }
    }, [isAdmin, isRoot, user]);

    const handleActiveInmobiliariaChange = (e) => {
        const nextId = e.target.value;

        setActiveInmobiliariaId(nextId);

        if (typeof window !== "undefined") {
            window.localStorage.setItem("activeInmobiliariaId", nextId);
        }
    };

    if (!isRoot && !isAdmin) {
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
                <p className="text-muted mt-3">Cargando panel de inmobiliaria...</p>
            </main>
        );
    }

    return (
        <main className="container py-4">
            <header className="mb-4">
                <div className="d-flex flex-wrap justify-content-between align-items-start gap-3">
                    <div>
                        <p className="text-uppercase text-muted small mb-1">
                            Panel de inmobiliaria
                        </p>

                        <h1 className="h3 mb-1">
                            {activeInmobiliaria?.nombre || "Administración inmobiliaria"}
                        </h1>

                        <p className="text-muted mb-0">
                            Accedé a las funcionalidades habilitadas para esta inmobiliaria.
                        </p>
                    </div>

                    {isRoot && <span className="badge text-bg-dark">ROOT</span>}
                </div>
            </header>

            {error && <div className="alert alert-danger">{error}</div>}

            {inmobiliarias.length === 0 && (
                <div className="alert alert-info">
                    No hay inmobiliarias disponibles para este usuario.
                </div>
            )}

            {inmobiliarias.length > 0 && (
                <>
                    <section className="card border-0 shadow-sm mb-4">
                        <div className="card-body p-4">
                            <div className="row g-3 align-items-end">
                                <div className="col-md-7">
                                    <label className="form-label">Inmobiliaria activa</label>
                                    <select
                                        className="form-select form-select-lg"
                                        value={activeInmobiliariaId}
                                        onChange={handleActiveInmobiliariaChange}
                                    >
                                        {inmobiliarias.map((inmobiliaria) => (
                                            <option key={inmobiliaria.id} value={inmobiliaria.id}>
                                                {inmobiliaria.nombre}
                                                {inmobiliaria.slug ? ` /${inmobiliaria.slug}` : ""}
                                            </option>
                                        ))}
                                    </select>

                                    {!isRoot && (
                                        <div className="form-text">
                                            Solo ves inmobiliarias asignadas a tu usuario.
                                        </div>
                                    )}
                                </div>

                                <div className="col-md-5">
                                    <div className="border rounded-3 p-3 bg-light">
                                        <div className="small text-muted mb-1">
                                            Módulos habilitados
                                        </div>

                                        <div className="d-flex flex-wrap gap-2">
                                            {subscribedModules.map((moduleId) => (
                                                <span
                                                    key={moduleId}
                                                    className="badge text-bg-primary"
                                                >
                                                    {moduleId}
                                                </span>
                                            ))}

                                            {subscribedModules.length === 0 && (
                                                <span className="text-muted">
                                                    Sin módulos habilitados.
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    <section className="row g-4">
                        {visibleModules.map((module) => {
                            const route = getModuleRoute(
                                module,
                                activeInmobiliariaId,
                                isRoot,
                            );

                            const disabled = module.comingSoon || !route;

                            return (
                                <article className="col-12 col-md-6 col-xl-4" key={module.id}>
                                    <div className="card h-100 border-0 shadow-sm">
                                        <div className="card-body p-4 d-flex flex-column">
                                            <div className="display-6 mb-3">{module.icon}</div>

                                            <h2 className="h5 mb-2">{module.title}</h2>

                                            <p className="text-muted">{module.description}</p>

                                            {isRoot && !subscribedModules.includes(module.id) && (
                                                <div className="alert alert-light border small py-2">
                                                    No suscripto para esta inmobiliaria. Root puede acceder
                                                    igual.
                                                </div>
                                            )}

                                            <div className="mt-auto d-grid">
                                                {disabled ? (
                                                    <button
                                                        type="button"
                                                        className="btn btn-outline-secondary"
                                                        disabled
                                                    >
                                                        {module.cta}
                                                    </button>
                                                ) : (
                                                    <Link to={route} className="btn btn-primary">
                                                        {module.cta}
                                                    </Link>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </article>
                            );
                        })}

                        {visibleModules.length === 0 && (
                            <div className="col-12">
                                <div className="alert alert-info">
                                    Esta inmobiliaria no tiene módulos habilitados.
                                </div>
                            </div>
                        )}
                    </section>
                </>
            )}
        </main>
    );
};

export default InmobiliariaDashboardPage;