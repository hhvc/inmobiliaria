import { useState } from "react";
import { Link, useLocation } from "react-router-dom";

import SEO from "../../components/SEO";
import { createCommercialLead } from "../../billing/services/billing.service";
import { buildCommercialSource } from "../../billing/utils/commercial.helpers";
import { buildAgencyPlansUrl } from "../utils/marketingCampaign.helpers";
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
    to: "/software-administracion-consorcios",
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

const DEMO_INTERESTS = [
  "Publicación y presencia digital",
  "Administración de alquileres",
  "Administración de consorcios",
  "Tasaciones y parcelas",
  "Integraciones y cobros",
  "Quiero conocer la plataforma completa",
];

const INITIAL_DEMO_FORM = {
  agencyName: "",
  contactName: "",
  email: "",
  phone: "",
  interest: "Quiero conocer la plataforma completa",
  website: "",
  consentAccepted: false,
};

const RealEstateSoftwareLandingPage = () => {
  const location = useLocation();
  const plansUrl = buildAgencyPlansUrl(location.search);
  const [form, setForm] = useState(INITIAL_DEMO_FORM);
  const [startedAtMs, setStartedAtMs] = useState(() => Date.now());
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
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

  const updateForm = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const submitDemo = async (event) => {
    event.preventDefault();
    if (!form.email.trim() && !form.phone.trim()) {
      setError("Dejanos un email o un teléfono para poder responderte.");
      return;
    }

    setSending(true);
    setError("");
    try {
      await createCommercialLead({
        ...form,
        countryCode: "AR",
        preferredContact: form.phone.trim() ? "whatsapp" : "email",
        message: `Interés principal: ${form.interest}`,
        startedAtMs,
        source: buildCommercialSource({
          href: window.location.href,
          pathname: location.pathname,
          search: location.search,
          referrer: document.referrer,
        }),
      });
      setSuccess(true);
      setForm(INITIAL_DEMO_FORM);
      setStartedAtMs(Date.now());
    } catch (submitError) {
      setError(submitError.message || "No pudimos enviar la solicitud. Reintentá en unos minutos.");
    } finally {
      setSending(false);
    }
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
                <a className="btn btn-light btn-lg" href="#solicitar-demo">
                  Solicitar demostración
                </a>
                <Link className="btn btn-outline-light btn-lg" to="/inmobiliarias/alta">
                  Crear mi inmobiliaria
                </Link>
              </div>
              <p className="small mt-3 mb-0 marketing-hero-note">
                Catálogo modular y contratación acompañada. No se generan cargos automáticos.
              </p>
            </div>

            <div className="col-lg-5">
              <div className="marketing-lead-card" id="solicitar-demo">
                <p className="marketing-eyebrow text-success">Demostración sin compromiso</p>
                <h2 className="h3 mb-2">Conversemos sobre tu inmobiliaria</h2>
                <p className="text-muted mb-4">
                  Contanos qué necesitás. Te contactaremos para coordinar una demostración enfocada.
                </p>
                {success ? (
                  <div className="alert alert-success mb-0" role="status">
                    <strong>Solicitud recibida.</strong> Te contactaremos para coordinar la demostración.
                  </div>
                ) : (
                  <form className="row g-3" onSubmit={submitDemo}>
                    <div className="col-12">
                      <label className="form-label" htmlFor="demoAgency">Inmobiliaria</label>
                      <input
                        autoComplete="organization"
                        className="form-control"
                        id="demoAgency"
                        onChange={(event) => updateForm("agencyName", event.target.value)}
                        required
                        value={form.agencyName}
                      />
                    </div>
                    <div className="col-12">
                      <label className="form-label" htmlFor="demoContact">Tu nombre</label>
                      <input
                        autoComplete="name"
                        className="form-control"
                        id="demoContact"
                        onChange={(event) => updateForm("contactName", event.target.value)}
                        required
                        value={form.contactName}
                      />
                    </div>
                    <div className="col-sm-6">
                      <label className="form-label" htmlFor="demoPhone">WhatsApp</label>
                      <input
                        autoComplete="tel"
                        className="form-control"
                        id="demoPhone"
                        onChange={(event) => updateForm("phone", event.target.value)}
                        type="tel"
                        value={form.phone}
                      />
                    </div>
                    <div className="col-sm-6">
                      <label className="form-label" htmlFor="demoEmail">Email</label>
                      <input
                        autoComplete="email"
                        className="form-control"
                        id="demoEmail"
                        onChange={(event) => updateForm("email", event.target.value)}
                        type="email"
                        value={form.email}
                      />
                    </div>
                    <div className="col-12 small text-muted">Indicá al menos uno de los dos medios de contacto.</div>
                    <div className="col-12">
                      <label className="form-label" htmlFor="demoInterest">¿Qué te interesa más?</label>
                      <select
                        className="form-select"
                        id="demoInterest"
                        onChange={(event) => updateForm("interest", event.target.value)}
                        value={form.interest}
                      >
                        {DEMO_INTERESTS.map((interest) => (
                          <option key={interest} value={interest}>{interest}</option>
                        ))}
                      </select>
                    </div>
                    <div className="visually-hidden" aria-hidden="true">
                      <label htmlFor="demoWebsite">Sitio web</label>
                      <input
                        autoComplete="off"
                        id="demoWebsite"
                        onChange={(event) => updateForm("website", event.target.value)}
                        tabIndex="-1"
                        value={form.website}
                      />
                    </div>
                    <div className="col-12">
                      <div className="form-check">
                        <input
                          checked={form.consentAccepted}
                          className="form-check-input"
                          id="demoConsent"
                          onChange={(event) => updateForm("consentAccepted", event.target.checked)}
                          required
                          type="checkbox"
                        />
                        <label className="form-check-label small" htmlFor="demoConsent">
                          Acepto que ONO Prop me contacte por esta solicitud y la{" "}
                          <Link to="/privacidad" target="_blank" rel="noopener noreferrer">Política de privacidad</Link>.
                        </label>
                      </div>
                    </div>
                    {error && <div className="col-12"><div className="alert alert-danger mb-0" role="alert">{error}</div></div>}
                    <div className="col-12 d-grid">
                      <button className="btn btn-success btn-lg" disabled={sending} type="submit">
                        {sending ? "Enviando..." : "Pedir demostración"}
                      </button>
                    </div>
                  </form>
                )}
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
                {solution.to && (
                  <Link className="btn btn-link px-0 mt-3" to={solution.to}>
                    Conocer este módulo
                  </Link>
                )}
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
            <a className="btn btn-primary btn-lg" href="#solicitar-demo">
              Pedir una demostración
            </a>
            <Link className="btn btn-outline-secondary" to={plansUrl}>
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
          <a className="btn btn-light btn-lg" href="#solicitar-demo">
            Solicitar contacto
          </a>
        </div>
      </section>
    </main>
  );
};

export default RealEstateSoftwareLandingPage;
