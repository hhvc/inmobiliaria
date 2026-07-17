import { Link } from "react-router-dom";

import SEO from "../../components/SEO";
import Login from "../../components/auth/Login";
import { useAuth } from "../../context/auth/useAuth";

const BENEFITS = [
    "Publicar inmuebles en el portal ONO Prop",
    "Tener página propia de inmobiliaria",
    "Conectar dominio personalizado",
    "Recibir consultas comerciales ordenadas",
    "Compartir inmuebles con colegas",
    "Generar textos para redes y portales",
    "Administrar usuarios de la inmobiliaria",
    "Construir una base comercial propia",
];

const STEPS = [
    {
        title: "Registrá tu usuario",
        text: "Ingresá con tu cuenta para asociarte a una inmobiliaria existente o crear una nueva.",
    },
    {
        title: "Vinculá o creá una inmobiliaria",
        text: "Podés solicitar acceso a una inmobiliaria ya registrada o dar de alta una nueva.",
    },
    {
        title: "Empezá a operar",
        text: "Cargá inmuebles, publicá en el portal, recibí consultas y usá la Red de colegas.",
    },
];

const InmobiliariasLandingPage = () => {
    const { user, activeInmobiliariaId } = useAuth();

    const userInmobiliarias = Array.isArray(user?.inmobiliarias)
        ? user.inmobiliarias
        : [];

    const hasLinkedInmobiliaria =
        Boolean(activeInmobiliariaId) || userInmobiliarias.length > 0;

    const siteUrl =
        import.meta.env.VITE_PUBLIC_SITE_URL || "https://onoprop.com";

    return (
        <main className="portal-home">
            <SEO
                title="ONO Prop para inmobiliarias | Publicá, administrá y colaborá"
                description="Sumá tu inmobiliaria a ONO Prop. Publicá inmuebles, creá tu sitio propio, recibí consultas y compartí propiedades con colegas."
                url={`${siteUrl}/inmobiliarias`}
                type="website"
                siteName="ONO Prop"
            />

            <section className="portal-hero">
                <div className="container">
                    <div className="row align-items-center g-5">
                        <div className="col-lg-7">
                            <div className="portal-eyebrow">Para inmobiliarias</div>

                            <h1 className="portal-hero-title mb-4">
                                Sumá tu inmobiliaria a ONO Prop.
                            </h1>

                            <p className="portal-hero-text mb-4">
                                Publicá propiedades, creá tu sitio propio, conectá tu dominio,
                                recibí consultas y compartí inmuebles con colegas desde una
                                misma plataforma.
                            </p>

                            <div className="d-flex flex-wrap gap-2">
                                {!user ? (
                                    <a href="#acceso" className="btn btn-primary btn-lg">
                                        Iniciar registro
                                    </a>
                                ) : hasLinkedInmobiliaria ? (
                                    <Link to="/admin/inmobiliaria" className="btn btn-primary btn-lg">
                                        Ir al panel
                                    </Link>
                                ) : (
                                    <a href="#opciones" className="btn btn-primary btn-lg">
                                        Continuar alta
                                    </a>
                                )}

                                <Link to="/inmuebles" className="btn btn-outline-dark btn-lg">
                                    Ver portal público
                                </Link>
                            </div>
                        </div>

                        <div className="col-lg-5">
                            <div className="portal-search-card card border-0 shadow-sm">
                                <div className="card-body p-4">
                                    <p className="text-uppercase text-muted small mb-1">
                                        Modelo operativo
                                    </p>

                                    <h2 className="h3 mb-3">
                                        Herramientas comerciales sin franquicia.
                                    </h2>

                                    <p className="text-muted mb-0">
                                        ONO Prop busca dar a inmobiliarias independientes
                                        herramientas de publicación, gestión, difusión y
                                        colaboración, sin exigirles adoptar una marca franquiciada.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="portal-section bg-white">
                <div className="container">
                    <div className="row g-4">
                        {BENEFITS.map((benefit) => (
                            <div className="col-md-6 col-lg-3" key={benefit}>
                                <div className="portal-feature-card h-100">
                                    <div className="portal-feature-icon">✓</div>
                                    <p className="fw-semibold mb-0">{benefit}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section className="portal-section">
                <div className="container">
                    <div className="row mb-4">
                        <div className="col-lg-8">
                            <p className="text-uppercase text-muted small mb-1">
                                Cómo empezar
                            </p>

                            <h2 className="portal-section-title">
                                Alta simple, operación inmediata y validación posterior.
                            </h2>

                            <p className="lead text-muted mb-0">
                                La inmobiliaria puede quedar operativa aunque todavía tenga
                                documentación pendiente. Mientras tanto, se mostrará como
                                pendiente de documentación para validar.
                            </p>
                        </div>
                    </div>

                    <div className="row g-4">
                        {STEPS.map((step, index) => (
                            <div className="col-md-4" key={step.title}>
                                <div className="card border-0 shadow-sm h-100">
                                    <div className="card-body p-4">
                                        <div className="portal-feature-icon mb-3">
                                            {String(index + 1).padStart(2, "0")}
                                        </div>

                                        <h3 className="h5">{step.title}</h3>
                                        <p className="text-muted mb-0">{step.text}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section id="acceso" className="portal-section bg-white">
                <div className="container">
                    {!user && (
                        <div className="row justify-content-center">
                            <div className="col-lg-7">
                                <div className="card border-0 shadow-sm">
                                    <div className="card-body p-4 p-lg-5">
                                        <p className="text-uppercase text-muted small mb-1">
                                            Acceso
                                        </p>

                                        <h2 className="h3 mb-3">
                                            Iniciá sesión o registrate para continuar.
                                        </h2>

                                        <p className="text-muted">
                                            Para dar de alta una inmobiliaria o solicitar vinculación
                                            a una existente, primero necesitamos identificar tu
                                            usuario.
                                        </p>

                                        <Login />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {user && hasLinkedInmobiliaria && (
                        <div className="card border-0 shadow-sm">
                            <div className="card-body p-4 p-lg-5">
                                <div className="row align-items-center g-4">
                                    <div className="col-lg-8">
                                        <p className="text-uppercase text-muted small mb-1">
                                            Usuario vinculado
                                        </p>

                                        <h2 className="h3 mb-3">
                                            Ya tenés una inmobiliaria asociada.
                                        </h2>

                                        <p className="text-muted mb-0">
                                            Podés ingresar al panel, cargar inmuebles, revisar
                                            consultas y usar la Red de colegas.
                                        </p>
                                    </div>

                                    <div className="col-lg-4 d-grid gap-2">
                                        <Link to="/admin/inmobiliaria" className="btn btn-primary">
                                            Ir al panel
                                        </Link>

                                        <Link
                                            to="/admin/inmuebles/nuevo"
                                            className="btn btn-outline-primary"
                                        >
                                            Cargar inmueble
                                        </Link>

                                        <Link
                                            to="/admin/red/inmuebles-compartidos"
                                            className="btn btn-outline-secondary"
                                        >
                                            Red de colegas
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {user && !hasLinkedInmobiliaria && (
                        <div id="opciones" className="row g-4">
                            <div className="col-12">
                                <div className="alert alert-info">
                                    <strong>Usuario identificado.</strong> Ahora podés solicitar
                                    vinculación a una inmobiliaria existente o iniciar el alta de
                                    una nueva inmobiliaria.
                                </div>
                            </div>

                            <div className="col-md-6">
                                <div className="card border-0 shadow-sm h-100">
                                    <div className="card-body p-4">
                                        <h2 className="h4 mb-3">
                                            Solicitar vinculación a inmobiliaria existente
                                        </h2>

                                        <p className="text-muted">
                                            Usá esta opción si la inmobiliaria ya fue creada en ONO
                                            Prop y necesitás que te habiliten como usuario.
                                        </p>

                                        <Link
                                            to="/inmobiliarias/vincular"
                                            className="btn btn-outline-primary"
                                        >
                                            Solicitar vinculación
                                        </Link>
                                    </div>
                                </div>
                            </div>

                            <div className="col-md-6">
                                <div className="card border-0 shadow-sm h-100">
                                    <div className="card-body p-4">
                                        <h2 className="h4 mb-3">Dar de alta nueva inmobiliaria</h2>

                                        <p className="text-muted">
                                            Creá una nueva inmobiliaria. Quedará operativa y con
                                            estado pendiente de documentación para validar hasta que
                                            completes la documentación.
                                        </p>

                                        <Link
                                            to="/inmobiliarias/alta"
                                            className="btn btn-primary"
                                        >
                                            Dar de alta inmobiliaria
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </section>
        </main>
    );
};

export default InmobiliariasLandingPage;