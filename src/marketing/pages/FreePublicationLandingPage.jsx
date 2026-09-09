import { Link } from "react-router-dom";

import SEO from "../../components/SEO";
import "../marketing.css";

const BENEFITS = [
  {
    number: "01",
    title: "Publicación sin costo",
    text: "Cargá los datos principales, fotografías y videos sin pagar por enviar tu solicitud.",
  },
  {
    number: "02",
    title: "Contacto directo",
    text: "Cuando el aviso esté publicado, las personas interesadas podrán consultar por el inmueble.",
  },
  {
    number: "03",
    title: "Seguimiento online",
    text: "Consultá el estado de la solicitud y administrá tus publicaciones desde tu cuenta.",
  },
];

const STEPS = [
  "Creá una cuenta o iniciá sesión.",
  "Indicá operación, tipo, ubicación, precio y descripción.",
  "Agregá fotografías o videos y enviá la solicitud.",
  "ONO Prop o la inmobiliaria elegida revisará los datos antes de publicar.",
];

const FAQS = [
  {
    question: "¿Publicar realmente es gratis?",
    answer:
      "Sí. Enviar y mantener una publicación particular en el portal no tiene costo. Los servicios adicionales o destacados, si los elegís, se informan por separado.",
  },
  {
    question: "¿El inmueble se publica automáticamente?",
    answer:
      "No. Para cuidar la calidad del portal, primero revisamos la información y podemos contactarte para completar o validar datos.",
  },
  {
    question: "¿Puedo elegir una inmobiliaria?",
    answer:
      "Sí. Podés enviar la solicitud a ONO Prop o elegir una inmobiliaria activa de la plataforma para que la revise y te contacte.",
  },
];

const FreePublicationLandingPage = () => {
  const siteUrl = import.meta.env.VITE_PUBLIC_SITE_URL || "https://onoprop.com";
  const canonicalUrl = `${siteUrl}/publicar-inmueble-gratis`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: "Publicación gratuita de inmuebles en ONO Prop",
    description:
      "Servicio para solicitar gratuitamente la publicación de propiedades en venta, alquiler o alquiler temporal.",
    provider: {
      "@type": "Organization",
      name: "ONO Prop",
      url: siteUrl,
    },
    areaServed: {
      "@type": "Country",
      name: "Argentina",
    },
    offers: {
      "@type": "Offer",
      price: 0,
      priceCurrency: "ARS",
      url: canonicalUrl,
    },
  };

  return (
    <main className="marketing-page">
      <SEO
        title="Publicar un inmueble gratis | ONO Prop"
        description="Publicá gratis tu casa, departamento, terreno, local u oficina en ONO Prop. Cargá fotos y datos, elegí quién revisa el aviso y seguí la solicitud online."
        url={canonicalUrl}
        type="website"
        siteName="ONO Prop"
        jsonLd={jsonLd}
      />

      <section className="marketing-hero marketing-hero--owners">
        <div className="container py-5">
          <div className="row align-items-center g-5 py-lg-4">
            <div className="col-lg-7">
              <p className="marketing-eyebrow">Para propietarios y particulares</p>
              <h1 className="display-4 fw-bold mb-4">
                Publicá tu inmueble gratis y empezá a recibir consultas.
              </h1>
              <p className="lead mb-4">
                Cargá una propiedad en venta, alquiler o alquiler temporal. Vos elegís
                si la solicitud la revisa ONO Prop o una inmobiliaria adherida.
              </p>
              <div className="d-flex flex-wrap gap-2">
                <Link
                  className="btn btn-light btn-lg"
                  to="/publicar?origen=publicar-inmueble-gratis"
                >
                  Publicar gratis
                </Link>
                <Link className="btn btn-outline-light btn-lg" to="/inmuebles">
                  Ver inmuebles publicados
                </Link>
              </div>
              <p className="small mt-3 mb-0 marketing-hero-note">
                La solicitud se revisa antes de hacerse pública. No se generan cargos
                automáticos.
              </p>
            </div>

            <div className="col-lg-5">
              <div className="marketing-summary-card">
                <span className="marketing-summary-price">$0</span>
                <h2 className="h3">Publicación particular</h2>
                <ul className="marketing-check-list mb-0">
                  <li>Venta, alquiler y alquiler temporal</li>
                  <li>Hasta 50 fotografías y videos</li>
                  <li>Seguimiento de la solicitud</li>
                  <li>Posibilidad de elegir una inmobiliaria</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="container py-5">
        <div className="text-center mx-auto marketing-heading mb-5">
          <p className="marketing-eyebrow text-primary">Una publicación útil</p>
          <h2 className="display-6 fw-bold">Más simple para publicar y consultar</h2>
        </div>
        <div className="row g-4">
          {BENEFITS.map((benefit) => (
            <div className="col-md-4" key={benefit.title}>
              <article className="marketing-card h-100">
                <span className="marketing-card-number">{benefit.number}</span>
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
              <p className="marketing-eyebrow text-primary">Cómo funciona</p>
              <h2 className="display-6 fw-bold">Cuatro pasos para enviar tu propiedad</h2>
              <p className="lead text-muted">
                No necesitás completar una ficha técnica extensa para iniciar la solicitud.
                Si falta algún dato importante, te ayudaremos a completarlo.
              </p>
            </div>
            <div className="col-lg-7">
              <ol className="marketing-step-list">
                {STEPS.map((step, index) => (
                  <li key={step}>
                    <span>{index + 1}</span>
                    <p>{step}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </section>

      <section className="container py-5">
        <div className="row g-5">
          <div className="col-lg-5">
            <p className="marketing-eyebrow text-primary">Preguntas frecuentes</p>
            <h2 className="display-6 fw-bold">Antes de publicar</h2>
          </div>
          <div className="col-lg-7">
            <div className="marketing-faq-list">
              {FAQS.map((item, index) => (
                <details className="marketing-faq" key={item.question} open={index === 0}>
                  <summary>{item.question}</summary>
                  <p>{item.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="marketing-final-cta">
        <div className="container py-5 text-center">
          <h2 className="display-6 fw-bold">Tu próxima consulta empieza con una publicación.</h2>
          <p className="lead mb-4">Prepará las fotos y los datos principales. El alta es gratuita.</p>
          <Link
            className="btn btn-light btn-lg"
            to="/publicar?origen=publicar-inmueble-gratis"
          >
            Comenzar publicación
          </Link>
        </div>
      </section>
    </main>
  );
};

export default FreePublicationLandingPage;
