import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import SEO from "../../components/SEO";
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
        id: "solicitudes-particulares",
        title: "Solicitudes particulares",
        description:
            "Revisar pedidos enviados por propietarios particulares a esta inmobiliaria.",
        route: "/admin/inmobiliaria/solicitudes-particulares",
        cta: "Ver solicitudes",
        icon: "🧾",
        requiredModules: ["consultas"],
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

const VERIFICATION_CONFIG = {
    pendiente_documentacion: {
        label: "Pendiente de documentación",
        badge: "text-bg-warning",
        help: "La inmobiliaria puede operar, pero todavía debe completar documentación para validar.",
    },
    pendiente_revision: {
        label: "Documentación en revisión",
        badge: "text-bg-info",
        help: "La documentación fue cargada y está pendiente de revisión.",
    },
    verificada: {
        label: "Verificada",
        badge: "text-bg-success",
        help: "La inmobiliaria fue validada correctamente.",
    },
    observada: {
        label: "Documentación observada",
        badge: "text-bg-warning",
        help: "Hay observaciones pendientes sobre la documentación presentada.",
    },
    rechazada: {
        label: "Verificación rechazada",
        badge: "text-bg-danger",
        help: "La verificación fue rechazada. Revisá las observaciones.",
    },
};

const getRoleFlags = (user) => {
    const roles = user?.roles || [];
    const primaryRole = user?.primaryRole || user?.role || "";

    return {
        isRoot:
            primaryRole === "root" || user?.role === "root" || roles.includes("root"),
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

const moduleIsAvailable = ({ module, subscribedModules, isRoot }) => {
    if (isRoot) return true;

    if (Array.isArray(module.requiredModules) && module.requiredModules.length) {
        return module.requiredModules.some((moduleId) =>
            subscribedModules.includes(moduleId),
        );
    }

    return subscribedModules.includes(module.id);
};

const getModuleRoute = (module, inmobiliariaId, isRoot) => {
    if (module.rootOnlyRoute && !isRoot) return null;

    if (module.routeFactory) {
        return module.routeFactory(inmobiliariaId);
    }

    return module.route;
};

const getVerificationStatus = (inmobiliaria) => {
    const estado =
        inmobiliaria?.verificacion?.estado || "pendiente_documentacion";

    return {
        estado,
        ...(VERIFICATION_CONFIG[estado] ||
            VERIFICATION_CONFIG.pendiente_documentacion),
        label:
            inmobiliaria?.verificacion?.estadoLabel ||
            VERIFICATION_CONFIG[estado]?.label ||
            VERIFICATION_CONFIG.pendiente_documentacion.label,
    };
};

const hasBranding = (inmobiliaria) => {
    return Boolean(
        inmobiliaria?.branding?.logo?.url ||
        inmobiliaria?.branding?.backgrounds?.hero?.url ||
        inmobiliaria?.branding?.backgrounds?.principal?.url ||
        inmobiliaria?.branding?.backgrounds?.primary?.url,
    );
};

const hasContact = (inmobiliaria) => {
    const contacto = inmobiliaria?.configuracion?.contacto || {};

    return Boolean(contacto.email || contacto.telefono || contacto.whatsapp);
};

const hasPublicDomain = (inmobiliaria) => {
    return (
        Array.isArray(inmobiliaria?.dominiosPublicos) &&
        inmobiliaria.dominiosPublicos.length > 0
    );
};

const getOnboardingItems = (inmobiliaria) => {
    const verificationStatus = getVerificationStatus(inmobiliaria);
    const publicUrl = inmobiliaria?.slug
        ? `/inmobiliaria/${inmobiliaria.slug}`
        : "";

    return [
        {
            id: "created",
            title: "Inmobiliaria creada",
            description: "El perfil de la inmobiliaria ya existe en ONO Prop.",
            done: Boolean(inmobiliaria?.id),
            route: publicUrl,
            cta: "Ver página pública",
        },
        {
            id: "verification",
            title: "Documentación de validación",
            description: verificationStatus.help,
            done: verificationStatus.estado === "verificada",
            warning: verificationStatus.estado !== "verificada",
            route: "/admin/inmobiliaria/documentacion",
            cta:
                verificationStatus.estado === "verificada"
                    ? "Ver documentación"
                    : "Completar documentación",
        },
        {
            id: "branding",
            title: "Branding y datos comerciales",
            description: "Logo, portada y datos de contacto públicos.",
            done: hasBranding(inmobiliaria) && hasContact(inmobiliaria),
            route: "/admin/inmobiliaria/branding",
            cta: "Editar branding",
        },
        {
            id: "first-property",
            title: "Primer inmueble",
            description: "Cargá una propiedad para empezar a publicar en el portal.",
            done: false,
            route: "/admin/inmuebles/nuevo",
            cta: "Cargar inmueble",
            optional: true,
        },
        {
            id: "particular-requests",
            title: "Solicitudes de particulares",
            description:
                "Revisá pedidos enviados por propietarios que eligieron esta inmobiliaria.",
            done: false,
            route: "/admin/inmobiliaria/solicitudes-particulares",
            cta: "Ver solicitudes",
            optional: true,
        },
        {
            id: "domain",
            title: "Dominio propio",
            description: "Opcional: conectá un dominio propio para tu inmobiliaria.",
            done: hasPublicDomain(inmobiliaria),
            route: "/admin/inmobiliaria/dominios",
            cta: "Configurar dominio",
            optional: true,
        },
    ];
};

const getOnboardingProgress = (items = []) => {
    const requiredItems = items.filter((item) => !item.optional);

    if (requiredItems.length === 0) return 0;

    const completed = requiredItems.filter((item) => item.done).length;

    return Math.round((completed / requiredItems.length) * 100);
};

const OnboardingStatusIcon = ({ item }) => {
    if (item.done) {
        return <span className="badge text-bg-success">Listo</span>;
    }

    if (item.warning) {
        return <span className="badge text-bg-warning">Pendiente</span>;
    }

    if (item.optional) {
        return <span className="badge text-bg-light border">Opcional</span>;
    }

    return <span className="badge text-bg-secondary">Pendiente</span>;
};

const InmobiliariaDashboardPage = () => {
    const { user } = useAuth();

    const [inmobiliarias, setInmobiliarias] = useState([]);
    const [activeInmobiliariaId, setActiveInmobiliariaId] = useState("");

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const { isRoot, isAdmin } = getRoleFlags(user);

    const siteUrl =
        import.meta.env.VITE_PUBLIC_SITE_URL || "https://onoprop.com";

    const activeInmobiliaria = useMemo(() => {
        return (
            inmobiliarias.find((inmo) => inmo.id === activeInmobiliariaId) || null
        );
    }, [activeInmobiliariaId, inmobiliarias]);

    const subscribedModules = useMemo(() => {
        if (!activeInmobiliaria) return DEFAULT_MODULES;

        return Array.isArray(activeInmobiliaria.modulosSuscriptos)
            ? activeInmobiliaria.modulosSuscriptos
            : DEFAULT_MODULES;
    }, [activeInmobiliaria]);

    const canUseInmuebles = useMemo(() => {
        return isRoot || subscribedModules.includes("inmuebles");
    }, [isRoot, subscribedModules]);

    const canUseConsultas = useMemo(() => {
        return isRoot || subscribedModules.includes("consultas");
    }, [isRoot, subscribedModules]);

    const visibleModules = useMemo(() => {
        return MODULE_CARDS.filter((module) =>
            moduleIsAvailable({
                module,
                subscribedModules,
                isRoot,
            }),
        );
    }, [isRoot, subscribedModules]);

    const verificationStatus = useMemo(() => {
        return getVerificationStatus(activeInmobiliaria);
    }, [activeInmobiliaria]);

    const onboardingItems = useMemo(() => {
        return getOnboardingItems(activeInmobiliaria);
    }, [activeInmobiliaria]);

    const onboardingProgress = useMemo(() => {
        return getOnboardingProgress(onboardingItems);
    }, [onboardingItems]);

    const publicInmobiliariaUrl = activeInmobiliaria?.slug
        ? `/inmobiliaria/${activeInmobiliaria.slug}`
        : "";

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
                <SEO
                    title="Acceso restringido | ONO Prop"
                    description="Sección disponible para usuarios administradores de inmobiliarias."
                    url={`${siteUrl}/admin/inmobiliaria`}
                    type="website"
                    siteName="ONO Prop"
                    noIndex
                />

                <div className="alert alert-warning">
                    Esta sección está disponible para usuarios administradores.
                </div>
            </main>
        );
    }

    if (loading) {
        return (
            <main className="container py-5 text-center">
                <SEO
                    title="Panel de inmobiliaria | ONO Prop"
                    description="Panel de administración de inmobiliarias en ONO Prop."
                    url={`${siteUrl}/admin/inmobiliaria`}
                    type="website"
                    siteName="ONO Prop"
                    noIndex
                />

                <div className="spinner-border" />
                <p className="text-muted mt-3">Cargando panel de inmobiliaria...</p>
            </main>
        );
    }

    return (
        <main className="container py-4">
            <SEO
                title="Panel de inmobiliaria | ONO Prop"
                description="Panel de administración de inmobiliarias, inmuebles, consultas, solicitudes particulares y configuración comercial."
                url={`${siteUrl}/admin/inmobiliaria`}
                type="website"
                siteName="ONO Prop"
                noIndex
            />

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

                    <div className="d-flex flex-wrap gap-2">
                        {activeInmobiliaria && (
                            <span className={`badge ${verificationStatus.badge}`}>
                                {verificationStatus.label}
                            </span>
                        )}

                        {isRoot && <span className="badge text-bg-dark">ROOT</span>}
                    </div>
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
                                                <span key={moduleId} className="badge text-bg-primary">
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

                    {activeInmobiliaria && (
                        <section className="row g-4 mb-4">
                            <div className="col-lg-7">
                                <div className="card h-100 border-0 shadow-sm">
                                    <div className="card-body p-4">
                                        <div className="d-flex flex-wrap justify-content-between gap-3 mb-3">
                                            <div>
                                                <p className="text-uppercase text-muted small mb-1">
                                                    Puesta en marcha
                                                </p>

                                                <h2 className="h5 mb-1">
                                                    Checklist de tu inmobiliaria
                                                </h2>

                                                <p className="text-muted mb-0">
                                                    Estos pasos ayudan a que tu inmobiliaria quede lista
                                                    para operar mejor dentro de ONO Prop.
                                                </p>
                                            </div>

                                            <div className="text-end">
                                                <div className="h4 mb-0">{onboardingProgress}%</div>
                                                <div className="small text-muted">avance básico</div>
                                            </div>
                                        </div>

                                        <div
                                            className="progress mb-4"
                                            role="progressbar"
                                            aria-valuenow={onboardingProgress}
                                            aria-valuemin="0"
                                            aria-valuemax="100"
                                        >
                                            <div
                                                className="progress-bar"
                                                style={{ width: `${onboardingProgress}%` }}
                                            />
                                        </div>

                                        <div className="d-flex flex-column gap-3">
                                            {onboardingItems.map((item) => (
                                                <div
                                                    key={item.id}
                                                    className="border rounded-3 p-3 d-flex flex-column flex-md-row justify-content-between gap-3"
                                                >
                                                    <div>
                                                        <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
                                                            <h3 className="h6 mb-0">{item.title}</h3>
                                                            <OnboardingStatusIcon item={item} />
                                                        </div>

                                                        <p className="text-muted small mb-0">
                                                            {item.description}
                                                        </p>
                                                    </div>

                                                    {item.route && (
                                                        <div className="align-self-md-center">
                                                            <Link
                                                                to={item.route}
                                                                className={
                                                                    item.done
                                                                        ? "btn btn-outline-primary btn-sm"
                                                                        : "btn btn-primary btn-sm"
                                                                }
                                                            >
                                                                {item.cta}
                                                            </Link>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="col-lg-5">
                                <div className="card h-100 border-0 shadow-sm">
                                    <div className="card-body p-4">
                                        <p className="text-uppercase text-muted small mb-1">
                                            Accesos rápidos
                                        </p>

                                        <h2 className="h5 mb-3">Operación diaria</h2>

                                        <div className="d-grid gap-2">
                                            {canUseInmuebles && (
                                                <>
                                                    <Link
                                                        to="/admin/inmuebles/nuevo"
                                                        className="btn btn-primary"
                                                    >
                                                        Cargar inmueble
                                                    </Link>

                                                    <Link
                                                        to="/admin/inmuebles/listado"
                                                        className="btn btn-outline-primary"
                                                    >
                                                        Ver mis inmuebles
                                                    </Link>
                                                </>
                                            )}

                                            {canUseConsultas && (
                                                <>
                                                    <Link
                                                        to="/admin/inmuebles/consultas"
                                                        className="btn btn-outline-primary"
                                                    >
                                                        Ver consultas
                                                    </Link>

                                                    <Link
                                                        to="/admin/inmobiliaria/solicitudes-particulares"
                                                        className="btn btn-outline-primary"
                                                    >
                                                        Solicitudes particulares
                                                    </Link>
                                                </>
                                            )}

                                            {canUseInmuebles && (
                                                <>
                                                    <Link
                                                        to="/admin/red/inmuebles-compartidos"
                                                        className="btn btn-outline-secondary"
                                                    >
                                                        Red de colegas
                                                    </Link>

                                                    <Link
                                                        to="/admin/red/solicitudes"
                                                        className="btn btn-outline-secondary"
                                                    >
                                                        Solicitudes de colaboración
                                                    </Link>
                                                </>
                                            )}

                                            <Link
                                                to="/admin/inmobiliaria/vinculaciones"
                                                className="btn btn-outline-secondary"
                                            >
                                                Solicitudes de vinculación
                                            </Link>

                                            {publicInmobiliariaUrl && (
                                                <Link to={publicInmobiliariaUrl} className="btn btn-light">
                                                    Ver página pública
                                                </Link>
                                            )}
                                        </div>

                                        {verificationStatus.estado !== "verificada" && (
                                            <div className="alert alert-warning small mt-4 mb-0">
                                                <strong>{verificationStatus.label}.</strong>{" "}
                                                {verificationStatus.help}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </section>
                    )}

                    {isRoot && (
                        <section className="card border-0 shadow-sm mb-4">
                            <div className="card-body p-4">
                                <div className="row align-items-center g-3">
                                    <div className="col-lg-8">
                                        <p className="text-uppercase text-muted small mb-1">
                                            Administración root
                                        </p>

                                        <h2 className="h5 mb-1">
                                            Control general de la plataforma
                                        </h2>

                                        <p className="text-muted mb-0">
                                            Accesos de revisión, alta y administración general de
                                            inmobiliarias y solicitudes particulares.
                                        </p>
                                    </div>

                                    <div className="col-lg-4 d-grid gap-2">
                                        <Link
                                            to="/admin/publicaciones/particulares"
                                            className="btn btn-primary"
                                        >
                                            Solicitudes particulares globales
                                        </Link>

                                        <Link
                                            to="/admin/inmobiliarias/verificacion"
                                            className="btn btn-outline-primary"
                                        >
                                            Revisar verificaciones
                                        </Link>

                                        <Link
                                            to="/admin/inmobiliarias"
                                            className="btn btn-outline-secondary"
                                        >
                                            Administrar inmobiliarias
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        </section>
                    )}

                    <section className="row g-4">
                        {visibleModules.map((module) => {
                            const route = getModuleRoute(module, activeInmobiliariaId, isRoot);
                            const disabled = module.comingSoon || !route;

                            return (
                                <article className="col-12 col-md-6 col-xl-4" key={module.id}>
                                    <div className="card h-100 border-0 shadow-sm">
                                        <div className="card-body p-4 d-flex flex-column">
                                            <div className="display-6 mb-3">{module.icon}</div>

                                            <h2 className="h5 mb-2">{module.title}</h2>

                                            <p className="text-muted">{module.description}</p>

                                            {isRoot &&
                                                !subscribedModules.includes(module.id) &&
                                                !module.requiredModules?.some((moduleId) =>
                                                    subscribedModules.includes(moduleId),
                                                ) && (
                                                    <div className="alert alert-light border small py-2">
                                                        No suscripto para esta inmobiliaria. Root puede
                                                        acceder igual.
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