import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import SEO from "../../components/SEO";
import { useAuth } from "../../context/auth/useAuth";
import {
    getAllInmobiliarias,
    getInmobiliariasByRole,
} from "../services/inmobiliaria.service";

const DEFAULT_MODULES = ["inmuebles", "consultas"];

const DASHBOARD_SECTIONS = [
    {
        id: "daily",
        eyebrow: "Trabajo diario",
        title: "Operación de la inmobiliaria",
        description: "Las herramientas que más vas a usar para gestionar el negocio.",
    },
    {
        id: "network",
        eyebrow: "Colaboración",
        title: "Red y publicaciones compartidas",
        description: "Intercambiá oportunidades y administrá qué avisos muestra tu inmobiliaria.",
    },
    {
        id: "settings",
        eyebrow: "Administración",
        title: "Configuración y servicios",
        description: "Identidad, equipo, sucursales, dominios y relación comercial con ONO Prop.",
    },
];

const MODULE_CARDS = [
    {
        id: "inmuebles",
        section: "daily",
        title: "Inmuebles",
        description:
            "Crear, editar, publicar, compartir y difundir propiedades en el portal y las integraciones.",
        route: "/admin/inmuebles/listado",
        cta: "Administrar inmuebles",
        secondaryRoute: "/admin/inmuebles/nuevo",
        secondaryCta: "Cargar nuevo",
        icon: "🏠",
    },
    {
        id: "consultas",
        section: "daily",
        title: "Consultas y leads",
        description: "Responder las consultas recibidas desde las fichas públicas.",
        route: "/admin/inmuebles/consultas",
        cta: "Ver consultas",
        icon: "📩",
    },
    {
        id: "solicitudes-particulares",
        section: "daily",
        title: "Solicitudes particulares",
        description: "Revisar pedidos de propietarios que eligieron esta inmobiliaria.",
        route: "/admin/inmobiliaria/solicitudes-particulares",
        cta: "Ver solicitudes",
        icon: "🙋",
        requiredModules: ["consultas"],
    },
    {
        id: "performance",
        section: "daily",
        title: "Rendimiento de publicaciones",
        description: "Comparar visitas, favoritos, contactos y resultados de los avisos destacados.",
        route: "/admin/rendimiento",
        cta: "Ver rendimiento",
        icon: "📊",
        requiredModules: ["inmuebles"],
    },
    {
        id: "alquileres",
        section: "daily",
        title: "Administración de alquileres",
        description: "Gestionar contratos, vencimientos, cobros, gastos y liquidaciones.",
        route: "/admin/alquileres",
        cta: "Administrar alquileres",
        icon: "🔑",
    },
    {
        id: "consorcios",
        section: "daily",
        title: "Administración de consorcios",
        description: "Gestionar unidades, expensas, cobros y cuentas corrientes.",
        route: "/admin/consorcios",
        cta: "Administrar consorcios",
        icon: "🏙️",
    },
    {
        id: "tasaciones",
        section: "daily",
        title: "Tasaciones",
        description: "Crear expedientes, aplicar métodos de valuación y preparar informes.",
        route: "/admin/tasaciones",
        cta: "Administrar tasaciones",
        icon: "📐",
    },
    {
        id: "tributos",
        section: "daily",
        title: "Control tributario",
        description: "Controlar vencimientos y documentar pagos provinciales y municipales.",
        route: "/admin/tributos",
        cta: "Administrar tributos",
        icon: "🧾",
    },
    {
        id: "emprendimientos",
        section: "daily",
        title: "Emprendimientos",
        description: "Administrar edificios, loteos, desarrollos y sus unidades.",
        route: "/admin/emprendimientos",
        cta: "Administrar emprendimientos",
        icon: "🏗️",
        requiredModules: ["inmuebles"],
    },
    {
        id: "parcelas",
        section: "daily",
        title: "Parcelas y normativa urbana",
        description: "Consultar superficies, valuación fiscal, FOS, FOT y usos del suelo.",
        route: "/admin/inmobiliaria/parcelas",
        cta: "Consultar parcelas",
        icon: "🗺️",
    },
    {
        id: "network-properties",
        section: "network",
        title: "Red de colegas",
        description: "Consultar inmuebles compartidos por otras inmobiliarias de ONO Prop.",
        route: "/admin/red/inmuebles-compartidos",
        cta: "Explorar la red",
        icon: "🏘️",
        requiredModules: ["inmuebles"],
    },
    {
        id: "network-requests",
        section: "network",
        title: "Solicitudes de colaboración",
        description: "Gestionar pedidos relacionados con inmuebles compartidos en la red.",
        route: "/admin/red/solicitudes",
        cta: "Ver solicitudes",
        icon: "🔔",
        requiredModules: ["inmuebles"],
    },
    {
        id: "friends",
        section: "network",
        title: "Inmobiliarias amigas",
        description: "Crear grupos privados y definir con quién compartir avisos.",
        route: "/admin/inmobiliaria/amigas",
        cta: "Administrar grupos",
        icon: "🤝",
        alwaysAvailable: true,
    },
    {
        id: "shared-catalog",
        section: "network",
        title: "Catálogo de amigas",
        description: "Mostrar, ocultar, asignar o destacar avisos compartidos por amigas.",
        route: "/admin/inmobiliaria/catalogo-compartido",
        cta: "Abrir catálogo",
        icon: "🔁",
        alwaysAvailable: true,
    },
    {
        id: "branding",
        section: "settings",
        title: "Marca y página pública",
        description: "Actualizar logo, portada, contacto y datos comerciales.",
        route: "/admin/inmobiliaria/branding",
        cta: "Editar marca",
        icon: "🎨",
    },
    {
        id: "branches",
        section: "settings",
        title: "Sucursales",
        description: "Crear páginas de sucursal, asignar responsables y administrar sus datos.",
        route: "/admin/inmobiliaria/sucursales",
        cta: "Administrar sucursales",
        icon: "🏢",
        alwaysAvailable: true,
    },
    {
        id: "usuarios",
        section: "settings",
        title: "Usuarios y permisos",
        description: "Administrar usuarios vinculados, responsabilidades y accesos internos.",
        route: "/admin/inmobiliaria/usuarios",
        cta: "Gestionar usuarios",
        icon: "👥",
    },
    {
        id: "dominios",
        section: "settings",
        title: "Dominios propios",
        description: "Configurar los dominios públicos asociados a la inmobiliaria.",
        route: "/admin/inmobiliaria/dominios",
        cta: "Configurar dominios",
        icon: "🌐",
    },
    {
        id: "link-requests",
        section: "settings",
        title: "Solicitudes de vinculación",
        description: "Revisar usuarios que solicitaron vincularse con la inmobiliaria.",
        route: "/admin/inmobiliaria/vinculaciones",
        cta: "Revisar solicitudes",
        icon: "🔗",
        alwaysAvailable: true,
    },
    {
        id: "billing",
        section: "settings",
        title: "Cuenta corriente y servicios",
        description: "Contratar servicios, informar pagos, consultar saldos y créditos.",
        routeFactory: (inmobiliariaId) => (
            `/admin/inmobiliaria/cuenta-corriente?inmobiliariaId=${inmobiliariaId}`
        ),
        cta: "Abrir cuenta corriente",
        icon: "💳",
        alwaysAvailable: true,
    },
    {
        id: "payments",
        section: "settings",
        title: "Medios de cobro",
        description: "Configurar Mercado Pago, SIRO y asignar cobros a consorcios o contratos.",
        route: "/admin/pagos",
        cta: "Configurar cobros",
        icon: "💸",
        alwaysAvailable: true,
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
        isRoot: primaryRole === "root" || user?.role === "root" || roles.includes("root"),
        isAdmin: primaryRole === "admin" || user?.role === "admin" || roles.includes("admin"),
    };
};

const getStoredActiveInmobiliariaId = () => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem("activeInmobiliariaId") ||
        window.localStorage.getItem("inmobiliariaActivaId") ||
        window.localStorage.getItem("activeInmobiliaria") ||
        null;
};

const getInitialInmobiliariaId = ({ user, inmobiliarias, isRoot }) => {
    const storedId = getStoredActiveInmobiliariaId();
    if (storedId && inmobiliarias.some((item) => item.id === storedId)) return storedId;

    if (!isRoot && Array.isArray(user?.inmobiliarias)) {
        const firstAllowed = user.inmobiliarias.find((id) => (
            inmobiliarias.some((item) => item.id === id)
        ));
        if (firstAllowed) return firstAllowed;
    }

    return inmobiliarias[0]?.id || "";
};

const moduleIsAvailable = ({ module, subscribedModules, isRoot }) => {
    if (isRoot || module.alwaysAvailable) return true;
    if (Array.isArray(module.requiredModules) && module.requiredModules.length) {
        return module.requiredModules.some((moduleId) => subscribedModules.includes(moduleId));
    }
    return subscribedModules.includes(module.id);
};

const getModuleRoute = (module, inmobiliariaId) => (
    module.routeFactory ? module.routeFactory(inmobiliariaId) : module.route
);

const getVerificationStatus = (inmobiliaria) => {
    const estado = inmobiliaria?.verificacion?.estado || "pendiente_documentacion";
    const fallback = VERIFICATION_CONFIG.pendiente_documentacion;
    const config = VERIFICATION_CONFIG[estado] || fallback;
    return {
        estado,
        ...config,
        label: inmobiliaria?.verificacion?.estadoLabel || config.label,
    };
};

const hasBranding = (inmobiliaria) => Boolean(
    inmobiliaria?.branding?.logo?.url ||
    inmobiliaria?.branding?.backgrounds?.hero?.url ||
    inmobiliaria?.branding?.backgrounds?.principal?.url ||
    inmobiliaria?.branding?.backgrounds?.primary?.url,
);

const hasContact = (inmobiliaria) => {
    const contact = inmobiliaria?.configuracion?.contacto || {};
    return Boolean(contact.email || contact.telefono || contact.whatsapp);
};

const hasPublicDomain = (inmobiliaria) => (
    Array.isArray(inmobiliaria?.dominiosPublicos) && inmobiliaria.dominiosPublicos.length > 0
);

const getOnboardingItems = (inmobiliaria) => {
    const verification = getVerificationStatus(inmobiliaria);
    const publicUrl = inmobiliaria?.slug ? `/inmobiliaria/${inmobiliaria.slug}` : "";
    return [
        {
            id: "created",
            title: "Página pública creada",
            description: "La inmobiliaria ya tiene su espacio público en ONO Prop.",
            done: Boolean(inmobiliaria?.id),
            route: publicUrl,
            cta: "Ver página",
        },
        {
            id: "verification",
            title: "Documentación de validación",
            description: verification.help,
            done: verification.estado === "verificada",
            warning: verification.estado !== "verificada",
            route: "/admin/inmobiliaria/documentacion",
            cta: verification.estado === "verificada" ? "Ver documentación" : "Completar",
        },
        {
            id: "branding",
            title: "Marca y datos comerciales",
            description: "Logo, portada y medios de contacto públicos.",
            done: hasBranding(inmobiliaria) && hasContact(inmobiliaria),
            route: "/admin/inmobiliaria/branding",
            cta: "Editar marca",
        },
        {
            id: "domain",
            title: "Dominio propio",
            description: "Conectá el dominio de la inmobiliaria cuando lo necesites.",
            done: hasPublicDomain(inmobiliaria),
            route: "/admin/inmobiliaria/dominios",
            cta: "Configurar dominio",
            optional: true,
        },
    ];
};

const getOnboardingProgress = (items = []) => {
    const required = items.filter((item) => !item.optional);
    if (required.length === 0) return 0;
    return Math.round((required.filter((item) => item.done).length / required.length) * 100);
};

const OnboardingStatus = ({ item }) => {
    if (item.done) return <span className="badge text-bg-success">Listo</span>;
    if (item.warning) return <span className="badge text-bg-warning">Pendiente</span>;
    if (item.optional) return <span className="badge text-bg-light border">Opcional</span>;
    return <span className="badge text-bg-secondary">Pendiente</span>;
};

const ModuleCard = ({ module, inmobiliariaId, isRoot, subscribedModules }) => {
    const route = getModuleRoute(module, inmobiliariaId);
    const isIncluded = module.alwaysAvailable ||
        subscribedModules.includes(module.id) ||
        module.requiredModules?.some((id) => subscribedModules.includes(id));

    return (
        <article className="col-12 col-md-6 col-xl-4">
            <div className="card h-100 border-0 shadow-sm agency-dashboard-module-card">
                <div className="card-body p-4 d-flex flex-column">
                    <div className="d-flex align-items-start justify-content-between gap-3 mb-3">
                        <div className="agency-dashboard-module-icon" aria-hidden="true">
                            {module.icon}
                        </div>
                        {isRoot && !isIncluded && (
                            <span className="badge text-bg-light border">No suscripto</span>
                        )}
                    </div>

                    <h3 className="h5 mb-2">{module.title}</h3>
                    <p className="text-muted small mb-4">{module.description}</p>

                    <div className="mt-auto d-flex flex-wrap gap-2">
                        <Link to={route} className="btn btn-primary flex-grow-1">
                            {module.cta}
                        </Link>
                        {module.secondaryRoute && (
                            <Link to={module.secondaryRoute} className="btn btn-outline-primary">
                                {module.secondaryCta}
                            </Link>
                        )}
                    </div>
                </div>
            </div>
        </article>
    );
};

const InmobiliariaDashboardPage = () => {
    const { user } = useAuth();
    const [inmobiliarias, setInmobiliarias] = useState([]);
    const [activeInmobiliariaId, setActiveInmobiliariaId] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const { isRoot, isAdmin } = getRoleFlags(user);
    const siteUrl = import.meta.env.VITE_PUBLIC_SITE_URL || "https://onoprop.com";

    const activeInmobiliaria = useMemo(() => (
        inmobiliarias.find((item) => item.id === activeInmobiliariaId) || null
    ), [activeInmobiliariaId, inmobiliarias]);

    const subscribedModules = useMemo(() => {
        if (!activeInmobiliaria) return DEFAULT_MODULES;
        return Array.isArray(activeInmobiliaria.modulosSuscriptos)
            ? activeInmobiliaria.modulosSuscriptos
            : DEFAULT_MODULES;
    }, [activeInmobiliaria]);

    const sections = useMemo(() => {
        const visibleModules = MODULE_CARDS.filter((module) => moduleIsAvailable({
            module,
            subscribedModules,
            isRoot,
        }));
        return DASHBOARD_SECTIONS.map((section) => ({
            ...section,
            modules: visibleModules.filter((module) => module.section === section.id),
        })).filter((section) => section.modules.length > 0);
    }, [isRoot, subscribedModules]);

    const verification = useMemo(
        () => getVerificationStatus(activeInmobiliaria),
        [activeInmobiliaria],
    );
    const onboardingItems = useMemo(
        () => getOnboardingItems(activeInmobiliaria),
        [activeInmobiliaria],
    );
    const onboardingProgress = useMemo(
        () => getOnboardingProgress(onboardingItems),
        [onboardingItems],
    );
    const publicUrl = activeInmobiliaria?.slug
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
                setActiveInmobiliariaId(getInitialInmobiliariaId({
                    user,
                    inmobiliarias: data,
                    isRoot,
                }));
            } catch (err) {
                console.error("Error cargando dashboard de inmobiliaria:", err);
                setError("No se pudo cargar el panel de inmobiliaria.");
            } finally {
                setLoading(false);
            }
        };

        if (isRoot || isAdmin) loadInmobiliarias();
        else setLoading(false);
    }, [isAdmin, isRoot, user]);

    const handleActiveInmobiliariaChange = (event) => {
        const nextId = event.target.value;
        setActiveInmobiliariaId(nextId);
        if (typeof window !== "undefined") {
            window.localStorage.setItem("activeInmobiliariaId", nextId);
            window.dispatchEvent(new CustomEvent("onoprop:activeInmobiliariaChanged", {
                detail: { inmobiliariaId: nextId },
            }));
        }
    };

    if (!isRoot && !isAdmin) {
        return (
            <main className="container py-5">
                <SEO
                    title="Acceso restringido | ONO Prop"
                    description="Sección disponible para administradores de inmobiliarias."
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
                <div className="spinner-border text-primary" />
                <p className="text-muted mt-3">Cargando panel de inmobiliaria...</p>
            </main>
        );
    }

    return (
        <main className="agency-dashboard py-4 py-lg-5">
            <SEO
                title="Panel de inmobiliaria | ONO Prop"
                description="Herramientas de operación, colaboración y configuración de la inmobiliaria."
                url={`${siteUrl}/admin/inmobiliaria`}
                type="website"
                siteName="ONO Prop"
                noIndex
            />

            <div className="container">
                <header className="agency-dashboard-hero mb-4">
                    <div className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-4">
                        <div>
                            <p className="agency-dashboard-eyebrow mb-2">Panel de inmobiliaria</p>
                            <h1 className="display-6 fw-bold mb-2">
                                {activeInmobiliaria?.nombre || "Administración inmobiliaria"}
                            </h1>
                            <p className="mb-0 text-white-50">
                                Todo lo necesario para operar y hacer crecer la inmobiliaria.
                            </p>
                        </div>
                        <div className="d-flex flex-wrap align-items-center gap-2">
                            {activeInmobiliaria && (
                                <span className={`badge ${verification.badge}`}>
                                    {verification.label}
                                </span>
                            )}
                            {isRoot && <span className="badge text-bg-light">ROOT</span>}
                            {publicUrl && (
                                <Link to={publicUrl} className="btn btn-light btn-sm">
                                    Ver página pública
                                </Link>
                            )}
                        </div>
                    </div>
                </header>

                {error && <div className="alert alert-danger">{error}</div>}
                {inmobiliarias.length === 0 && (
                    <div className="alert alert-info">No hay inmobiliarias disponibles para este usuario.</div>
                )}

                {inmobiliarias.length > 0 && (
                    <>
                        <section className="card border-0 shadow-sm agency-dashboard-selector mb-5">
                            <div className="card-body p-3 p-lg-4">
                                <div className="row g-3 align-items-center">
                                    <div className="col-lg-7">
                                        <label className="form-label fw-semibold" htmlFor="active-agency">
                                            Inmobiliaria activa
                                        </label>
                                        <select
                                            id="active-agency"
                                            className="form-select form-select-lg"
                                            value={activeInmobiliariaId}
                                            onChange={handleActiveInmobiliariaChange}
                                        >
                                            {inmobiliarias.map((item) => (
                                                <option key={item.id} value={item.id}>
                                                    {item.nombre}{item.slug ? ` /${item.slug}` : ""}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="col-lg-5">
                                        <div className="agency-dashboard-module-summary">
                                            <span className="small text-muted d-block">Servicios habilitados</span>
                                            <strong>{subscribedModules.length} módulos activos</strong>
                                            {!isRoot && (
                                                <span className="small text-muted d-block mt-1">
                                                    Solo ves inmobiliarias asignadas a tu usuario.
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {sections.map((section) => (
                            <section className="agency-dashboard-section mb-5" key={section.id}>
                                <div className="mb-3 mb-lg-4">
                                    <p className="agency-dashboard-section-eyebrow mb-1">{section.eyebrow}</p>
                                    <h2 className="h3 mb-1">{section.title}</h2>
                                    <p className="text-muted mb-0">{section.description}</p>
                                </div>
                                <div className="row g-4">
                                    {section.modules.map((module) => (
                                        <ModuleCard
                                            key={module.id}
                                            module={module}
                                            inmobiliariaId={activeInmobiliariaId}
                                            isRoot={isRoot}
                                            subscribedModules={subscribedModules}
                                        />
                                    ))}
                                </div>
                            </section>
                        ))}

                        {isRoot && (
                            <section className="card border-0 shadow-sm agency-dashboard-root-card mb-5">
                                <div className="card-body p-4">
                                    <div className="row align-items-center g-4">
                                        <div className="col-lg-7">
                                            <p className="agency-dashboard-section-eyebrow mb-1">Administración ROOT</p>
                                            <h2 className="h4 mb-2">Control general de ONO Prop</h2>
                                            <p className="text-muted mb-0">
                                                Revisión y administración global, separada de la operación de esta inmobiliaria.
                                            </p>
                                        </div>
                                        <div className="col-lg-5 d-grid d-sm-flex justify-content-lg-end gap-2">
                                            <Link to="/admin/publicaciones/particulares" className="btn btn-primary">
                                                Solicitudes globales
                                            </Link>
                                            <Link to="/admin/inmobiliarias/verificacion" className="btn btn-outline-primary">
                                                Verificaciones
                                            </Link>
                                            <Link to="/admin/inmobiliarias" className="btn btn-outline-secondary">
                                                Inmobiliarias
                                            </Link>
                                        </div>
                                    </div>
                                </div>
                            </section>
                        )}

                        {activeInmobiliaria && (
                            <section className="card border-0 shadow-sm agency-dashboard-onboarding">
                                <div className="card-body p-4 p-lg-5">
                                    <div className="d-flex flex-column flex-lg-row justify-content-between gap-3 mb-3">
                                        <div>
                                            <p className="agency-dashboard-section-eyebrow mb-1">Puesta en marcha</p>
                                            <h2 className="h4 mb-2">Configuración inicial</h2>
                                            <p className="text-muted mb-0">
                                                Una guía de referencia para completar la presencia de la inmobiliaria.
                                            </p>
                                        </div>
                                        <div className="agency-dashboard-progress text-lg-end">
                                            <strong>{onboardingProgress}%</strong>
                                            <span>completado</span>
                                        </div>
                                    </div>

                                    <div
                                        className="progress mb-4"
                                        role="progressbar"
                                        aria-valuenow={onboardingProgress}
                                        aria-valuemin="0"
                                        aria-valuemax="100"
                                    >
                                        <div className="progress-bar" style={{ width: `${onboardingProgress}%` }} />
                                    </div>

                                    <div className="row g-3">
                                        {onboardingItems.map((item) => (
                                            <div className="col-12 col-lg-6" key={item.id}>
                                                <div className="agency-dashboard-onboarding-item h-100">
                                                    <div className="d-flex align-items-center gap-2 mb-2">
                                                        <h3 className="h6 mb-0">{item.title}</h3>
                                                        <OnboardingStatus item={item} />
                                                    </div>
                                                    <p className="text-muted small mb-3">{item.description}</p>
                                                    {item.route && (
                                                        <Link to={item.route} className="btn btn-sm btn-outline-primary">
                                                            {item.cta}
                                                        </Link>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </section>
                        )}
                    </>
                )}
            </div>
        </main>
    );
};

export default InmobiliariaDashboardPage;
