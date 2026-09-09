import { Link } from "react-router-dom";

import SEO from "../../components/SEO";
import "../marketing.css";

const SOLUTIONS = [
  {
    title: "Publicación y presencia digital",
    text: "Portal ONO Prop, página propia, dominio personalizado, red de colegas y difusión de inmuebles.",
  },
  {
    title: "Administración de alquileres",
    text: "Contratos, obligaciones, cobros, liquidaciones, cuentas corrientes y facturación electrónica con ARCA.",
  },
  {
    title: "Administración de consorcios",
    text: "Unidades, expensas, cobranzas, comunicaciones, documentación y portal para consorcistas.",
  },
  {
    title: "Tasaciones y parcelas",
    text: "Informes profesionales, antecedentes comparables, mapas y datos parcelarios para facilitar el análisis.",
  },
  {
    title: "Integraciones comerciales",
    text: "Mercado Libre, Instagram y Mercado Pago conectados a los circuitos de publicación y cobro.",
  },
  {
    title: "Trabajo en equipo",
    text: "Usuarios, sucursales, permisos, grupos de inmobiliarias amigas y catálogo compartido con marca blanca.",
  },
];

const RealEstateSoftwareLandingPage = () => {
  const siteUrl = import.meta.env.VITE_PUBLIC_SITE_URL || "https://onoprop.com";
  const canonicalUrl = `${siteUrl}/software-para-inmobiliarias`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "ONO Prop para inmobiliarias",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description:
      "Plataforma modular para publicar inmuebles y administrar alquileres, consorcios, tasaciones, cobranzas e integraciones.",
    url: canonicalUrl,
    publisher: {
      "@type": "Organization",
      name: "ONO Prop",
      url: siteUrl,
    },
  };

  return (
    <main className="marketing-page">
      <SEO
        title="Software para inmobiliarias | ONO Prop"
        description="Publicá inmuebles y administrá alquileres, consorcios, tasaciones, cobranzas, facturación e integraciones desde una plataforma modular para inmobiliarias."
        url={canonicalUrl}
        type="website"
        siteName="ONO Prop"
        jsonLd={jsonLd}
      />

      <section className="marketing-hero marketing-hero--agencies">
        <div className="container py-5">
          <div className="row align-items-center g-5 py-lg-4">
            <div className="col-lg-7">
              <p className="marketing-eyebrow">Software para inmobiliarias</p>
              <h1 className="display-4 fw-bold mb-4">
                Publicá, administrá y cobrá desde una sola plataforma.
              </h1>
              <p className="lead mb-4">
                Empezá con las herramientas que necesitás y sumá nuevos módulos a medida
                que crece tu operación, conservando tu identidad comercial.
              </p>
              <div className="d-flex flex-wrap gap-2">
                <Link
                  className="btn btn-light btn-lg"
                  to="/planes?origen=software-para-inmobiliarias#contacto-comercial"
                >
                  Solicitar demostración
                </Link>
                <Link className="btn btn-outline-light btn-lg" to="/inmobiliarias/alta">
                  Crear mi inmobiliaria
                </Link>
              </div>
              <p className="small mt-3 mb-0 marketing-hero-note">
                Catálogo modular y contratación acompañada. No se generan cargos automáticos.
              </p>
            </div>

            <div className="col-lg-5">
              <div className="marketing-summary-card">
                <p className="marketing-summary-kicker">Una base, distintos servicios</p>
                <h2 className="h3">Elegí qué resolver primero</h2>
                <ul className="marketing-check-list mb-0">
                  <li>Publicaciones y sitio propio</li>
                  <li>Alquileres y facturación ARCA</li>
                  <li>Consorcios y portal de residentes</li>
                  <li>Tasaciones, mapas y parcelas</li>
                  <li>Integraciones y medios de cobro</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="container py-5">
        <div className="text-center mx-auto marketing-heading mb-5">
          <p className="marketing-eyebrow text-primary">Plataforma modular</p>
          <h2 className="display-6 fw-bold">Herramientas conectadas con el trabajo real</h2>
          <p className="lead text-muted mb-0">
            La información se carga una vez y acompaña los distintos circuitos de la inmobiliaria.
          </p>
        </div>
        <div className="row g-4">
          {SOLUTIONS.map((solution, index) => (
            <div className="col-md-6 col-xl-4" key={solution.title}>
              <article className="marketing-card h-100">
                <span className="marketing-card-number">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="h4">{solution.title}</h3>
                <p className="text-muted mb-0">{solution.text}</p>
              </article>
            </div>
          ))}
        </div>
      </section>

      <section className="marketing-soft-section py-5">
        <div className="container py-lg-4">
          <div className="row g-5 align-items-center">
            <div className="col-lg-6">
              <p className="marketing-eyebrow text-primary">Sin perder tu marca</p>
              <h2 className="display-6 fw-bold">Tu inmobiliaria sigue siendo protagonista.</h2>
              <p className="lead text-muted">
                Configurá branding, sucursales, usuarios y dominio propio. Compartí catálogo
                con inmobiliarias amigas sin convertirte en franquicia ni diluir tu identidad.
              </p>
              <Link className="btn btn-outline-primary btn-lg" to="/inmobiliarias">
                Conocer el alta de inmobiliarias
              </Link>
            </div>
            <div className="col-lg-6">
              <div className="marketing-proof-grid">
                <div><strong>Modular</strong><span>Contratás según tu necesidad.</span></div>
                <div><strong>Multiusuario</strong><span>Roles y permisos por equipo.</span></div>
                <div><strong>Integrado</strong><span>Publicación, gestión y cobro.</span></div>
                <div><strong>Acompañado</strong><span>Configuración y soporte inicial.</span></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="container py-5">
        <div className="row g-4 align-items-center">
          <div className="col-lg-7">
            <p className="marketing-eyebrow text-primary">Próximo paso</p>
            <h2 className="display-6 fw-bold">Mostranos cómo trabaja tu inmobiliaria.</h2>
            <p className="lead text-muted mb-lg-0">
              Te ayudamos a elegir un primer circuito, configurarlo y evaluar el resultado
              antes de sumar nuevos servicios.
            </p>
          </div>
          <div className="col-lg-5 d-grid gap-2">
            <Link
              className="btn btn-primary btn-lg"
              to="/planes?origen=software-para-inmobiliarias#contacto-comercial"
            >
              Pedir una demostración
            </Link>
            <Link className="btn btn-outline-secondary" to="/planes">
              Ver planes y servicios
            </Link>
            <Link className="btn btn-link" to="/guias">
              Consultar guías públicas
            </Link>
          </div>
        </div>
      </section>

      <section className="marketing-final-cta">
        <div className="container py-5 text-center">
          <h2 className="display-6 fw-bold">Empezá por una necesidad concreta.</h2>
          <p className="lead mb-4">
            Publicaciones, alquileres, consorcios o tasaciones: armamos una demostración enfocada.
          </p>
          <Link
            className="btn btn-light btn-lg"
            to="/planes?origen=software-para-inmobiliarias#contacto-comercial"
          >
            Solicitar contacto
          </Link>
        </div>
      </section>
    </main>
  );
};

export default RealEstateSoftwareLandingPage;
