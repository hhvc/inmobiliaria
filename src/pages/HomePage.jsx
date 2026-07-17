import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import SEO from "../components/SEO";
import Contact from "../components/Contact";
import Testimonials from "../components/Testimonials";

const OPERACIONES = [
  { id: "venta", label: "Comprar" },
  { id: "alquiler", label: "Alquilar" },
  { id: "alquiler_temporal", label: "Alquiler temporal" },
];

const TIPOS_INMUEBLE = [
  { id: "casa", label: "Casas", icon: "🏠" },
  { id: "departamento", label: "Departamentos", icon: "🏢" },
  { id: "terreno", label: "Terrenos", icon: "🌱" },
  { id: "local", label: "Locales", icon: "🏪" },
  { id: "oficina", label: "Oficinas", icon: "💼" },
  { id: "cochera", label: "Cocheras", icon: "🚗" },
];

const FEATURED_SEARCHES = [
  {
    title: "Propiedades en venta",
    text: "Casas, departamentos, terrenos y oportunidades comerciales.",
    to: "/inmuebles?operacion=venta",
  },
  {
    title: "Propiedades en alquiler",
    text: "Opciones para vivienda, oficinas, locales y alquiler temporal.",
    to: "/inmuebles?operacion=alquiler",
  },
  {
    title: "Inmobiliarias verificables",
    text: "Conocé quién publica y contactá de forma directa.",
    to: "/inmuebles",
  },
];

const PORTAL_ADVANTAGES = [
  {
    title: "Búsqueda simple",
    text: "Explorá publicaciones por operación, tipo de inmueble, ubicación y palabra clave.",
    icon: "🔎",
  },
  {
    title: "Contacto directo",
    text: "Consultá por WhatsApp o formulario desde cada ficha pública.",
    icon: "💬",
  },
  {
    title: "Fichas compartibles",
    text: "Cada inmueble tiene una página pública lista para enviar o guardar.",
    icon: "🔗",
  },
];

const AGENCY_ADVANTAGES = [
  "Publicar inmuebles en el portal",
  "Tener sitio propio de inmobiliaria",
  "Conectar dominio personalizado",
  "Gestionar consultas comerciales",
  "Compartir inmuebles con colegas",
  "Generar textos para redes y portales",
];

const HomePage = () => {
  const navigate = useNavigate();

  const [filters, setFilters] = useState({
    search: "",
    operacion: "",
    tipo: "",
  });

  const siteUrl =
    import.meta.env.VITE_PUBLIC_SITE_URL || "https://onoprop.com";

  const websiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "ONO Prop",
    url: siteUrl,
    potentialAction: {
      "@type": "SearchAction",
      target: `${siteUrl}/inmuebles?search={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFilters((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const buildSearchUrl = () => {
    const params = new URLSearchParams();

    if (filters.search.trim()) {
      params.set("search", filters.search.trim());
    }

    if (filters.operacion) {
      params.set("operacion", filters.operacion);
    }

    if (filters.tipo) {
      params.set("tipo", filters.tipo);
    }

    const query = params.toString();

    return query ? `/inmuebles?${query}` : "/inmuebles";
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    navigate(buildSearchUrl());
  };

  return (
    <main id="page-top" className="portal-home">
      <SEO
        title="ONO Prop | Portal inmobiliario para comprar, alquilar y publicar inmuebles"
        description="Buscá casas, departamentos, terrenos, locales y oficinas en ONO Prop. Publicá inmuebles como inmobiliaria, recibí consultas y compartí propiedades."
        url={siteUrl}
        type="website"
        siteName="ONO Prop"
        jsonLd={websiteJsonLd}
      />

      {/* =========================
          Hero buscador
         ========================= */}
      <section className="portal-hero">
        <div className="container">
          <div className="row align-items-center g-5">
            <div className="col-lg-7">
              <div className="portal-eyebrow">Portal inmobiliario</div>

              <h1 className="portal-hero-title mb-4">
                Encontrá propiedades.
                <br />
                Contactá directo.
                <br />
                Publicá fácil.
              </h1>

              <p className="portal-hero-text mb-4">
                ONO Prop reúne inmuebles publicados por inmobiliarias y permite
                buscar, consultar y compartir propiedades desde una experiencia
                simple, clara y orientada al contacto comercial.
              </p>

              <form
                className="portal-search-card card border-0 shadow-sm mb-4"
                onSubmit={handleSubmit}
                role="search"
              >
                <div className="card-body p-3 p-lg-4">
                  <div className="row g-3 align-items-end">
                    <div className="col-12 col-lg-5">
                      <label className="form-label">Qué estás buscando</label>
                      <input
                        type="search"
                        name="search"
                        className="form-control form-control-lg"
                        placeholder="Barrio, ciudad, tipo, palabra clave..."
                        value={filters.search}
                        onChange={handleChange}
                      />
                    </div>

                    <div className="col-6 col-lg-3">
                      <label className="form-label">Operación</label>
                      <select
                        name="operacion"
                        className="form-select form-select-lg"
                        value={filters.operacion}
                        onChange={handleChange}
                      >
                        <option value="">Todas</option>
                        {OPERACIONES.map((operacion) => (
                          <option key={operacion.id} value={operacion.id}>
                            {operacion.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-6 col-lg-2">
                      <label className="form-label">Tipo</label>
                      <select
                        name="tipo"
                        className="form-select form-select-lg"
                        value={filters.tipo}
                        onChange={handleChange}
                      >
                        <option value="">Todos</option>
                        {TIPOS_INMUEBLE.map((tipo) => (
                          <option key={tipo.id} value={tipo.id}>
                            {tipo.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-12 col-lg-2 d-grid">
                      <button type="submit" className="btn btn-primary btn-lg">
                        Buscar
                      </button>
                    </div>
                  </div>
                </div>
              </form>

              <div className="d-flex flex-wrap gap-2">
                <Link to="/inmuebles" className="btn btn-outline-dark">
                  Ver todos los inmuebles
                </Link>

                <Link to="/inmobiliarias" className="btn btn-primary">
                  Publicar inmueble
                </Link>
              </div>
            </div>

            <div className="col-lg-5">
              <div className="card border-0 shadow-sm overflow-hidden">
                <div className="card-body p-4 p-lg-5">
                  <p className="text-uppercase text-muted small mb-1">
                    Publicá en ONO Prop
                  </p>

                  <h2 className="h3 mb-3">
                    Publicaciones para inmobiliarias y, próximamente, para
                    particulares.
                  </h2>

                  <p className="text-muted">
                    Las inmobiliarias cuentan con herramientas comerciales,
                    sitio propio, dominio personalizado, consultas ordenadas y
                    Red de colegas.
                  </p>

                  <div className="d-grid gap-2 mb-3">
                    <Link to="/inmobiliarias" className="btn btn-primary">
                      Publicar como inmobiliaria
                    </Link>

                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      disabled
                      title="Próximamente"
                    >
                      Publicar como particular · Próximamente
                    </button>
                  </div>

                  <div className="alert alert-light border small mb-0">
                    Si sos particular, vas a poder publicar directamente más
                    adelante. Publicar mediante una inmobiliaria ofrece ventajas:
                    gestión profesional, seguimiento de consultas, difusión,
                    documentación comercial y colaboración con colegas.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================
          Accesos rápidos
         ========================= */}
      <section className="portal-section bg-white">
        <div className="container">
          <div className="row mb-4 align-items-end">
            <div className="col-lg-8">
              <p className="text-uppercase text-muted small mb-1">
                Explorá por tipo
              </p>

              <h2 className="portal-section-title mb-0">
                Buscá inmuebles según lo que necesitás.
              </h2>
            </div>

            <div className="col-lg-4 text-lg-end mt-3 mt-lg-0">
              <Link to="/inmuebles" className="btn btn-outline-primary">
                Ver portal completo
              </Link>
            </div>
          </div>

          <div className="row g-3">
            {TIPOS_INMUEBLE.map((tipo) => (
              <div className="col-6 col-md-4 col-lg-2" key={tipo.id}>
                <Link
                  to={`/inmuebles?tipo=${tipo.id}`}
                  className="text-decoration-none"
                >
                  <div className="portal-feature-card h-100 text-center">
                    <div className="portal-feature-icon mx-auto">
                      {tipo.icon}
                    </div>
                    <h3 className="h6 mb-0 text-dark">{tipo.label}</h3>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =========================
          Búsquedas destacadas
         ========================= */}
      <section className="portal-section">
        <div className="container">
          <div className="row mb-4">
            <div className="col-lg-8">
              <p className="text-uppercase text-muted small mb-1">
                Búsquedas frecuentes
              </p>

              <h2 className="portal-section-title">
                Un portal para comprar, alquilar y contactar.
              </h2>
            </div>
          </div>

          <div className="row g-4">
            {FEATURED_SEARCHES.map((item) => (
              <div className="col-md-4" key={item.title}>
                <Link to={item.to} className="text-decoration-none">
                  <div className="card border-0 shadow-sm h-100">
                    <div className="card-body p-4">
                      <h3 className="h5 text-dark">{item.title}</h3>
                      <p className="text-muted mb-4">{item.text}</p>
                      <span className="btn btn-outline-primary">
                        Explorar
                      </span>
                    </div>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =========================
          Ventajas del portal
         ========================= */}
      <section className="portal-section bg-white">
        <div className="container">
          <div className="row align-items-center g-4">
            <div className="col-lg-5">
              <p className="text-uppercase text-muted small mb-1">
                Experiencia para usuarios
              </p>

              <h2 className="portal-section-title">
                Fichas claras, contacto directo y publicaciones compartibles.
              </h2>

              <p className="lead text-muted">
                ONO Prop busca que cada publicación sea fácil de encontrar,
                entender, consultar y compartir. La persona interesada puede
                navegar el portal general o entrar al sitio de cada
                inmobiliaria.
              </p>

              <Link to="/inmuebles" className="btn btn-primary">
                Buscar inmuebles
              </Link>
            </div>

            <div className="col-lg-7">
              <div className="row g-4">
                {PORTAL_ADVANTAGES.map((feature) => (
                  <div className="col-md-4" key={feature.title}>
                    <div className="portal-feature-card h-100">
                      <div className="portal-feature-icon">
                        {feature.icon}
                      </div>

                      <h3 className="h5">{feature.title}</h3>
                      <p className="text-muted mb-0">{feature.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================
          Publicar
         ========================= */}
      <section className="portal-section">
        <div className="container">
          <div className="portal-cta p-4 p-lg-5">
            <div className="row align-items-center g-4">
              <div className="col-lg-7">
                <p className="text-uppercase text-muted small mb-1">
                  Publicá tu inmueble
                </p>

                <h2 className="h1 fw-bold mb-3">
                  Llegá a más personas con una publicación profesional.
                </h2>

                <p className="text-muted mb-0">
                  ONO Prop permite publicar propiedades en el portal, generar
                  fichas públicas y ordenar las consultas. Si sos inmobiliaria,
                  además podés tener sitio propio, dominio y herramientas de
                  colaboración.
                </p>
              </div>

              <div className="col-lg-5">
                <div className="card border-0 shadow-sm">
                  <div className="card-body p-4">
                    <h3 className="h5 mb-3">Elegí cómo querés publicar</h3>

                    <div className="d-grid gap-2">
                      <Link to="/inmobiliarias" className="btn btn-primary">
                        Publicar como inmobiliaria
                      </Link>

                      <button
                        type="button"
                        className="btn btn-outline-secondary"
                        disabled
                      >
                        Publicar como particular · Próximamente
                      </button>
                    </div>

                    <p className="text-muted small mt-3 mb-0">
                      Publicar como inmobiliaria habilita funciones avanzadas:
                      usuarios internos, sitio propio, consultas, Red de
                      colegas, branding y dominio personalizado.
                    </p>
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
      <section className="portal-section bg-white">
        <div className="container">
          <div className="row align-items-center g-4">
            <div className="col-lg-6">
              <p className="text-uppercase text-muted small mb-1">
                Para inmobiliarias
              </p>

              <h2 className="portal-section-title">
                Herramientas comerciales para operar mejor, sin modelo de
                franquicia.
              </h2>

              <p className="lead text-muted">
                ONO Prop ofrece herramientas operativas y comerciales para
                inmobiliarias independientes: publicación, gestión de consultas,
                sitios propios, branding, dominio y colaboración con colegas.
              </p>

              <div className="d-flex flex-wrap gap-2 mt-4">
                <Link to="/inmobiliarias" className="btn btn-primary">
                  Soy inmobiliaria
                </Link>

                <Link
                  to="/inmobiliaria/ladoctaprop"
                  className="btn btn-outline-secondary"
                >
                  Ver ejemplo
                </Link>
              </div>
            </div>

            <div className="col-lg-6">
              <div className="card border-0 shadow-sm">
                <div className="card-body p-4">
                  <h3 className="h4 mb-3">Qué obtiene una inmobiliaria</h3>

                  <div className="row g-3">
                    {AGENCY_ADVANTAGES.map((feature) => (
                      <div className="col-sm-6" key={feature}>
                        <div className="p-3 rounded border bg-white h-100">
                          {feature}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="alert alert-info small mt-4 mb-0">
                    Las inmobiliarias pueden quedar operativas mientras
                    completan su documentación de validación. Hasta entonces se
                    mostrará el estado correspondiente en su página pública.
                  </div>
                </div>
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