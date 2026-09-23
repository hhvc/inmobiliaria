import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";

import SEO from "../../components/SEO";
import { createCommercialLead } from "../../billing/services/billing.service";
import { buildCommercialSource } from "../../billing/utils/commercial.helpers";
import {
  trackConsortiumContact,
  trackConsortiumCta,
  trackConsortiumLandingView,
  trackConsortiumLead,
} from "../services/marketingMeasurement.service";
import "../marketing.css";

const PROMOTIONAL_PRICE = "$1.000";
const ONOPROP_WHATSAPP_PARTS = ["54", "9", "351", "5478785"];

const BENEFITS = [
  {
    title: "Liquidaciones más claras",
    text: "Organizá expensas, gastos, comprobantes, débitos, créditos e intereses conservando el historial.",
  },
  {
    title: "Cobranzas y cuentas corrientes",
    text: "Registrá pagos, adjuntá comprobantes, emití recibos y controlá la deuda de cada unidad.",
  },
  {
    title: "Portal para consorcistas",
    text: "Propietarios y ocupantes consultan su información, informan pagos y se comunican con la administración.",
  },
  {
    title: "Información del edificio",
    text: "Centralizá pólizas, reglamentos, actas, emergencias, seguridad y documentación con visibilidad configurable.",
  },
  {
    title: "Comunicación controlada",
    text: "Configurá liquidaciones y recordatorios por consorcio y por unidad, siempre bajo autorización del administrador.",
  },
  {
    title: "Control económico",
    text: "Revisá tesorería, proveedores, conciliaciones, morosidad y cierre mensual desde un único circuito.",
  },
];

const INITIAL_FORM = {
  agencyName: "",
  contactName: "",
  city: "",
  unitCount: "",
  email: "",
  phone: "",
  website: "",
  consentAccepted: false,
};

const buildWhatsAppUrl = () => {
  const phone = ONOPROP_WHATSAPP_PARTS.join("");
  const message = "Hola, quiero conocer el módulo de Administración de Consorcios de ONO Prop.";
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
};

const ConsortiumSoftwareLandingPage = () => {
  const location = useLocation();
  const [form, setForm] = useState(INITIAL_FORM);
  const [startedAtMs, setStartedAtMs] = useState(() => Date.now());
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const siteUrl = import.meta.env.VITE_PUBLIC_SITE_URL || "https://onoprop.com";
  const canonicalUrl = `${siteUrl}/software-administracion-consorcios`;

  useEffect(() => {
    trackConsortiumLandingView();
  }, []);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Administración de Consorcios ONO Prop",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description:
      "Software para liquidar expensas, administrar cobranzas, cuentas corrientes, documentación y comunicación con consorcistas.",
    url: canonicalUrl,
    publisher: {
      "@type": "Organization",
      name: "ONO Prop",
      url: siteUrl,
    },
    offers: {
      "@type": "Offer",
      price: 1000,
      priceCurrency: "ARS",
      description: "Precio promocional por unidad funcional. Condiciones sujetas a confirmación antes de contratar.",
    },
  };

  const updateForm = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const openWhatsApp = () => {
    trackConsortiumCta("whatsapp");
    trackConsortiumContact("whatsapp");
    window.open(buildWhatsAppUrl(), "_blank", "noopener,noreferrer");
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
      const unitText = form.unitCount.trim()
        ? `Unidades funcionales aproximadas: ${form.unitCount.trim()}.`
        : "Cantidad de unidades todavía no informada.";
      await createCommercialLead({
        agencyName: form.agencyName,
        contactName: form.contactName,
        city: form.city,
        email: form.email,
        phone: form.phone,
        website: form.website,
        consentAccepted: form.consentAccepted,
        countryCode: "AR",
        propertyVolume: form.unitCount.trim()
          ? `${form.unitCount.trim()} unidades funcionales`
          : "",
        preferredContact: form.phone.trim() ? "whatsapp" : "email",
        message: `Interés principal: Administración de Consorcios. ${unitText}`,
        startedAtMs,
        source: buildCommercialSource({
          href: window.location.href,
          pathname: location.pathname,
          search: location.search,
          referrer: document.referrer,
        }),
      });
      trackConsortiumLead();
      setSuccess(true);
      setForm(INITIAL_FORM);
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
        title="Software para administración de consorcios | ONO Prop"
        description="Liquidá expensas, administrá cobranzas, cuentas corrientes, documentación y comunicación con consorcistas desde ONO Prop."
        url={canonicalUrl}
        type="website"
        siteName="ONO Prop"
        jsonLd={jsonLd}
      />

      <section className="marketing-hero marketing-hero--consortiums">
        <div className="container py-5">
          <div className="row align-items-center g-5 py-lg-4">
            <div className="col-lg-7">
              <p className="marketing-eyebrow">Administración de Consorcios</p>
              <h1 className="display-4 fw-bold mb-4">
                Menos tareas dispersas. Más control para administrar cada edificio.
              </h1>
              <p className="lead mb-4">
                Liquidaciones, cobranzas, cuentas corrientes, documentación y comunicación
                con consorcistas dentro de un mismo circuito, con acompañamiento inicial.
              </p>
              <div className="d-flex flex-wrap gap-2">
                <a
                  className="btn btn-light btn-lg"
                  href="#solicitar-demo-consorcios"
                  onClick={() => trackConsortiumCta("demo_form")}
                >
                  Solicitar demostración
                </a>
                <button className="btn btn-outline-light btn-lg" onClick={openWhatsApp} type="button">
                  Consultar por WhatsApp
                </button>
              </div>
              <p className="small mt-3 mb-0 marketing-hero-note">
                Probá el circuito con un primer consorcio. No se generan cargos automáticos.
              </p>
            </div>

            <div className="col-lg-5">
              <div className="marketing-summary-card marketing-consortium-price-card">
                <span className="marketing-summary-kicker">Precio promocional</span>
                <span className="marketing-summary-price">{PROMOTIONAL_PRICE}</span>
                <p className="lead mb-4">por unidad funcional</p>
                <ul className="marketing-check-list mb-4">
                  <li>Puesta en marcha acompañada</li>
                  <li>Portal para propietarios y ocupantes</li>
                  <li>Herramientas administrativas conectadas</li>
                </ul>
                <p className="small marketing-hero-note mb-0">
                  Promoción inicial. El alcance y las condiciones se confirman antes de contratar.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="container py-5">
        <div className="text-center mx-auto marketing-heading mb-5">
          <p className="marketing-eyebrow text-primary">Un circuito completo</p>
          <h2 className="display-6 fw-bold">Información organizada y trazable</h2>
          <p className="lead text-muted mb-0">
            Cada movimiento conserva su respaldo y queda conectado con la unidad, la liquidación
            y la cuenta corriente correspondiente.
          </p>
        </div>
        <div className="row g-4">
          {BENEFITS.map((benefit, index) => (
            <div className="col-md-6 col-xl-4" key={benefit.title}>
              <article className="marketing-card h-100">
                <span className="marketing-card-number">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="h4">{benefit.title}</h3>
                <p className="text-muted mb-0">{benefit.text}</p>
              </article>
            </div>
          ))}
        </div>
      </section>

      <section className="marketing-soft-section py-5">
        <div className="container py-lg-4">
          <div className="row g-5 align-items-start">
            <div className="col-lg-5">
              <p className="marketing-eyebrow text-primary">Piloto acompañado</p>
              <h2 className="display-6 fw-bold">Empezá con un consorcio real.</h2>
              <p className="lead text-muted">
                Revisamos juntos la configuración inicial, las unidades y el primer circuito
                mensual antes de que decidas ampliar el servicio.
              </p>
              <ol className="marketing-step-list">
                <li><span>1</span><p>Nos contás cómo administrás hoy.</p></li>
                <li><span>2</span><p>Configuramos un primer consorcio.</p></li>
                <li><span>3</span><p>Evaluás el resultado antes de contratar.</p></li>
              </ol>
              <div className="d-flex flex-wrap gap-2 mt-4">
                <Link className="btn btn-outline-primary" to="/guias/administracion-consorcios">
                  Ver manual público
                </Link>
                <Link className="btn btn-link" to="/software-para-inmobiliarias">
                  Conocer toda la plataforma
                </Link>
              </div>
            </div>

            <div className="col-lg-7">
              <div className="marketing-lead-card" id="solicitar-demo-consorcios">
                <p className="marketing-eyebrow text-success">Demostración sin compromiso</p>
                <h2 className="h3 mb-2">Contanos sobre el primer consorcio</h2>
                <p className="text-muted mb-4">
                  Te contactaremos para coordinar una demostración enfocada en tu operación.
                </p>
                {success ? (
                  <div className="alert alert-success mb-0" role="status">
                    <strong>Solicitud recibida.</strong> Te contactaremos para coordinar la demostración.
                  </div>
                ) : (
                  <form className="row g-3" onSubmit={submitDemo}>
                    <div className="col-md-6">
                      <label className="form-label" htmlFor="consortiumAgency">Administración o inmobiliaria</label>
                      <input
                        autoComplete="organization"
                        className="form-control"
                        id="consortiumAgency"
                        onChange={(event) => updateForm("agencyName", event.target.value)}
                        required
                        value={form.agencyName}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label" htmlFor="consortiumContact">Tu nombre</label>
                      <input
                        autoComplete="name"
                        className="form-control"
                        id="consortiumContact"
                        onChange={(event) => updateForm("contactName", event.target.value)}
                        required
                        value={form.contactName}
                      />
                    </div>
                    <div className="col-md-8">
                      <label className="form-label" htmlFor="consortiumCity">Ciudad</label>
                      <input
                        autoComplete="address-level2"
                        className="form-control"
                        id="consortiumCity"
                        onChange={(event) => updateForm("city", event.target.value)}
                        value={form.city}
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label" htmlFor="consortiumUnits">Unidades aproximadas</label>
                      <input
                        className="form-control"
                        id="consortiumUnits"
                        min="1"
                        onChange={(event) => updateForm("unitCount", event.target.value)}
                        type="number"
                        value={form.unitCount}
                      />
                    </div>
                    <div className="col-sm-6">
                      <label className="form-label" htmlFor="consortiumPhone">WhatsApp</label>
                      <input
                        autoComplete="tel"
                        className="form-control"
                        id="consortiumPhone"
                        onChange={(event) => updateForm("phone", event.target.value)}
                        type="tel"
                        value={form.phone}
                      />
                    </div>
                    <div className="col-sm-6">
                      <label className="form-label" htmlFor="consortiumEmail">Email</label>
                      <input
                        autoComplete="email"
                        className="form-control"
                        id="consortiumEmail"
                        onChange={(event) => updateForm("email", event.target.value)}
                        type="email"
                        value={form.email}
                      />
                    </div>
                    <div className="col-12 small text-muted">Indicá al menos uno de los dos medios de contacto.</div>
                    <div className="visually-hidden" aria-hidden="true">
                      <label htmlFor="consortiumWebsite">Sitio web</label>
                      <input
                        autoComplete="off"
                        id="consortiumWebsite"
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
                          id="consortiumConsent"
                          onChange={(event) => updateForm("consentAccepted", event.target.checked)}
                          required
                          type="checkbox"
                        />
                        <label className="form-check-label small" htmlFor="consortiumConsent">
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
        <div className="marketing-heading mx-auto text-center mb-4">
          <p className="marketing-eyebrow text-primary">Preguntas frecuentes</p>
          <h2 className="display-6 fw-bold">Antes de empezar</h2>
        </div>
        <div className="marketing-faq-list mx-auto marketing-consortium-faq">
          <details className="marketing-faq">
            <summary>¿La demostración genera algún cargo?</summary>
            <p>No. Primero revisamos tu necesidad y confirmamos expresamente alcance, precio y condiciones.</p>
          </details>
          <details className="marketing-faq">
            <summary>¿Puedo empezar con un solo consorcio?</summary>
            <p>Sí. El piloto está pensado para probar un circuito real antes de ampliar la implementación.</p>
          </details>
          <details className="marketing-faq">
            <summary>¿Los consorcistas tienen acceso propio?</summary>
            <p>Sí. Propietarios y ocupantes ingresan con los permisos y la información habilitados por la administración.</p>
          </details>
          <details className="marketing-faq">
            <summary>¿Reemplaza el criterio profesional del administrador?</summary>
            <p>No. ONO Prop organiza y documenta la gestión; el administrador conserva las decisiones y autorizaciones.</p>
          </details>
        </div>
      </section>

      <section className="marketing-final-cta">
        <div className="container py-5 text-center">
          <h2 className="display-6 fw-bold">Veamos juntos tu primer consorcio.</h2>
          <p className="lead mb-4">Una demostración concreta, sin compromiso ni cargos automáticos.</p>
          <a
            className="btn btn-light btn-lg"
            href="#solicitar-demo-consorcios"
            onClick={() => trackConsortiumCta("final_demo_form")}
          >
            Solicitar contacto
          </a>
        </div>
      </section>
    </main>
  );
};

export default ConsortiumSoftwareLandingPage;

