import { Link } from "react-router-dom";

import SEO from "../components/SEO";
import Contact from "../components/Contact";
import Testimonials from "../components/Testimonials";

const FEATURE_CARDS = [
  {
    title: "Portal general",
    text: "Un buscador público para mostrar propiedades de distintas inmobiliarias en un mismo lugar.",
    icon: "🏘️",
  },
  {
    title: "Sitio propio",
    text: "Cada inmobiliaria puede tener su propia página pública, marca, contacto, propiedades y dominio personalizado.",
    icon: "🌐",
  },
  {
    title: "Consultas ordenadas",
    text: "Los contactos recibidos desde las fichas públicas quedan organizados para dar seguimiento comercial.",
    icon: "📩",
  },
];

const AGENCY_FEATURES = [
  "Publicación de inmuebles",
  "Sitio público por inmobiliaria",
  "Dominio propio conectado",
  "WhatsApp y email integrados",
  "Consultas comerciales ordenadas",
  "Kit de publicación para redes y portales",
  "SEO y sitemap dinámico",
  "Panel de administración",
];

const STEPS = [
  {
    number: "01",
    title: "Cargá tus inmuebles",
    text: "Publicá propiedades con fotos, descripción, ubicación, precio, operación y datos comerciales.",
  },
  {
    number: "02",
    title: "Compartí y posicioná",
    text: "Usá links públicos, sitio propio, dominio personalizado, sitemap y textos listos para difusión.",
  },
  {
    number: "03",
    title: "Recibí consultas",
    text: "Centralizá los contactos recibidos por cada propiedad y ordená el seguimiento comercial.",
  },
];

const HomePage = () => {
  const siteUrl =
    import.meta.env.VITE_PUBLIC_SITE_URL || "https://onoprop.com";

  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "ONO Prop",
    url: siteUrl,
    description:
      "ONO Prop es una plataforma inmobiliaria para publicar propiedades, crear sitios propios para inmobiliarias y gestionar consultas comerciales.",
    sameAs: [],
  };

  return (
    <main id="page-top" className="portal-home">
      <SEO
        title="ONO Prop | Plataforma inmobiliaria para publicar y vender propiedades"
        description="ONO Prop es una plataforma inmobiliaria para publicar inmuebles, crear sitios propios para inmobiliarias, conectar dominios personalizados y gestionar consultas comerciales."
        url={siteUrl}
        type="website"
        siteName="ONO Prop"
        jsonLd={organizationJsonLd}
      />

      {/* =========================
          Hero principal
         ========================= */}
      <section className="portal-hero">
        <div className="container">
          <div className="row align-items-center g-5">
            <div className="col-lg-7">
              <div className="portal-eyebrow">
                Plataforma inmobiliaria digital
              </div>

              <h1 className="portal-hero-title mb-4">
                Publicá inmuebles.
                <br />
                Mostrá tu marca.
                <br />
                Recibí consultas.
              </h1>

              <p className="portal-hero-text mb-4">
                ONO Prop es una plataforma para inmobiliarias que necesitan un
                portal moderno, un sitio propio para su marca, dominio
                personalizado, fichas públicas de inmuebles y gestión de
                consultas comerciales.
              </p>

              <div className="d-flex flex-wrap gap-2 mb-4">
                <a href="#para-inmobiliarias" className="btn btn-primary btn-lg">
                  Soy inmobiliaria
                </a>

                <Link to="/inmuebles" className="btn btn-outline-dark btn-lg">
                  Ver inmuebles
                </Link>
              </div>

              <div className="row g-3">
                <div className="col-6 col-md-4">
                  <div className="portal-stat">
                    <div className="portal-stat-number">Web</div>
                    <div className="small text-muted">
                      Sitio propio por inmobiliaria
                    </div>
                  </div>
                </div>

                <div className="col-6 col-md-4">
                  <div className="portal-stat">
                    <div className="portal-stat-number">SEO</div>
                    <div className="small text-muted">
                      Publicaciones indexables
                    </div>
                  </div>
                </div>

                <div className="col-12 col-md-4">
                  <div className="portal-stat">
                    <div className="portal-stat-number">CRM</div>
                    <div className="small text-muted">
                      Consultas organizadas
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="col-lg-5">
              <div className="portal-search-card card border-0 shadow-sm">
                <div className="card-body p-4">
                  <p className="text-uppercase text-muted small mb-1">
                    Portal público
                  </p>

                  <h2 className="h3 mb-3">
                    Una vidriera digital para tus propiedades.
                  </h2>

                  <p className="text-muted">
                    ONO Prop combina portal general, sitio público por
                    inmobiliaria, fichas compartibles, consultas comerciales y
                    herramientas de difusión.
                  </p>

                  <div className="d-grid gap-2">
                    <Link to="/inmuebles" className="btn btn-primary">
                      Explorar propiedades
                    </Link>

                    <a href="#contact" className="btn btn-light">
                      Solicitar información
                    </a>
                  </div>

                  <hr />

                  <div className="small text-muted">
                    Ejemplo activo: una inmobiliaria puede operar con su dominio
                    propio y, al mismo tiempo, aparecer dentro del portal
                    general.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================
          Propuesta de valor
         ========================= */}
      <section className="portal-section bg-white">
        <div className="container">
          <div className="row mb-4">
            <div className="col-lg-8">
              <p className="text-uppercase text-muted small mb-1">
                Qué resuelve
              </p>

              <h2 className="portal-section-title">
                Una plataforma simple para ordenar la presencia digital
                inmobiliaria.
              </h2>

              <p className="lead text-muted mb-0">
                En lugar de tener publicaciones dispersas, links sueltos y
                consultas difíciles de seguir, ONO Prop centraliza la
                publicación, la difusión y el contacto comercial.
              </p>
            </div>
          </div>

          <div className="row g-4">
            {FEATURE_CARDS.map((feature) => (
              <div className="col-md-4" key={feature.title}>
                <div className="portal-feature-card h-100">
                  <div className="portal-feature-icon">{feature.icon}</div>
                  <h3 className="h5">{feature.title}</h3>
                  <p className="text-muted mb-0">{feature.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =========================
          Para quienes buscan
         ========================= */}
      <section className="portal-section">
        <div className="container">
          <div className="row align-items-center g-4">
            <div className="col-lg-6">
              <p className="text-uppercase text-muted small mb-1">
                Para quienes buscan propiedades
              </p>

              <h2 className="portal-section-title">
                Búsqueda clara, contacto directo y fichas compartibles.
              </h2>

              <p className="lead text-muted">
                Las personas que buscan inmuebles pueden explorar publicaciones,
                filtrar por operación, tipo, ubicación y precio, entrar a la
                ficha pública y contactar directamente a la inmobiliaria.
              </p>

              <div className="d-flex flex-wrap gap-2 mt-4">
                <Link to="/inmuebles" className="btn btn-primary">
                  Ver inmuebles publicados
                </Link>

                <a href="#para-inmobiliarias" className="btn btn-outline-secondary">
                  Soy inmobiliaria
                </a>
              </div>
            </div>

            <div className="col-lg-6">
              <div className="card border-0 shadow-sm">
                <div className="card-body p-4">
                  <h3 className="h4 mb-3">Experiencia del usuario</h3>

                  <div className="row g-3">
                    <div className="col-sm-6">
                      <div className="p-3 rounded border bg-white h-100">
                        Filtros por operación, tipo y ubicación
                      </div>
                    </div>

                    <div className="col-sm-6">
                      <div className="p-3 rounded border bg-white h-100">
                        Fichas públicas con fotos y descripción
                      </div>
                    </div>

                    <div className="col-sm-6">
                      <div className="p-3 rounded border bg-white h-100">
                        Botón de WhatsApp y formulario de consulta
                      </div>
                    </div>

                    <div className="col-sm-6">
                      <div className="p-3 rounded border bg-white h-100">
                        Links listos para compartir
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================
          Para inmobiliarias
         ========================= */}
      <section id="para-inmobiliarias" className="portal-section bg-white">
        <div className="container">
          <div className="row align-items-center g-4">
            <div className="col-lg-6">
              <p className="text-uppercase text-muted small mb-1">
                Para inmobiliarias
              </p>

              <h2 className="portal-section-title">
                Tu inmobiliaria con sitio propio, dominio y publicaciones
                conectadas al portal.
              </h2>

              <p className="lead text-muted">
                ONO Prop permite que cada inmobiliaria tenga su presencia
                digital independiente, sin perder la ventaja de pertenecer a un
                portal general. Ideal para inmobiliarias que quieren publicar,
                difundir y ordenar sus consultas desde un solo lugar.
              </p>

              <div className="d-flex flex-wrap gap-2 mt-4">
                <a href="#contact" className="btn btn-primary">
                  Quiero publicar
                </a>

                <Link
                  to="/inmobiliaria/ladoctaprop"
                  className="btn btn-outline-secondary"
                >
                  Ver ejemplo de inmobiliaria
                </Link>
              </div>
            </div>

            <div className="col-lg-6">
              <div className="card border-0 shadow-sm">
                <div className="card-body p-4">
                  <h3 className="h4 mb-3">Qué incluye</h3>

                  <div className="row g-3">
                    {AGENCY_FEATURES.map((feature) => (
                      <div className="col-sm-6" key={feature}>
                        <div className="p-3 rounded border bg-white h-100">
                          {feature}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================
          Cómo funciona
         ========================= */}
      <section className="portal-section">
        <div className="container">
          <div className="row mb-4">
            <div className="col-lg-8">
              <p className="text-uppercase text-muted small mb-1">
                Cómo funciona
              </p>

              <h2 className="portal-section-title">
                Del inmueble publicado a la consulta comercial.
              </h2>
            </div>
          </div>

          <div className="row g-4">
            {STEPS.map((step) => (
              <div className="col-md-4" key={step.number}>
                <div className="card border-0 shadow-sm h-100">
                  <div className="card-body p-4">
                    <div className="portal-feature-icon mb-3">{step.number}</div>
                    <h3 className="h5">{step.title}</h3>
                    <p className="text-muted mb-0">{step.text}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =========================
          CTA
         ========================= */}
      <section className="portal-section pt-0">
        <div className="container">
          <div className="portal-cta p-4 p-lg-5">
            <div className="row align-items-center g-4">
              <div className="col-lg-8">
                <h2 className="h1 fw-bold mb-3">
                  Convertí tus publicaciones en una vidriera inmobiliaria
                  profesional.
                </h2>

                <p className="text-muted mb-0">
                  ONO Prop reúne portal, sitio propio, dominio personalizado,
                  fichas públicas, difusión y consultas comerciales en una misma
                  plataforma.
                </p>
              </div>

              <div className="col-lg-4 text-lg-end">
                <a href="#contact" className="btn btn-light btn-lg">
                  Solicitar demo
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================
          Contacto y testimonios
         ========================= */}
      <section id="contact" className="bg-white">
        <Contact />
      </section>

      <section className="bg-white">
        <Testimonials />
      </section>
    </main>
  );
};

export default HomePage;