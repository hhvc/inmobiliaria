import { Link } from "react-router-dom";

import SEO from "../components/SEO";
import { GUIDE_CATALOG } from "./guideCatalog";
import "./guideLibrary.css";

const libraryJsonLd = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: "Guías y manuales de ONO Prop",
  url: "https://onoprop.com/guias",
  mainEntity: {
    "@type": "ItemList",
    itemListElement: GUIDE_CATALOG.map((guide, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: guide.title,
      url: `https://onoprop.com${guide.to}`,
    })),
  },
};

const GuideLibraryPage = () => (
  <main className="guide-library-page">
    <SEO
      title="Guías y manuales | ONO Prop"
      description="Manuales y guías prácticas para usar los módulos de ONO Prop, administrar alquileres y consorcios, y configurar integraciones."
      url="https://onoprop.com/guias"
      jsonLd={libraryJsonLd}
    />

    <section className="guide-library-hero">
      <div className="container py-5 py-lg-6">
        <p className="guide-library-eyebrow">Centro de ayuda ONO Prop</p>
        <h1>Guías para trabajar con seguridad y autonomía</h1>
        <p>Manuales operativos, configuraciones paso a paso y, próximamente, videos explicativos reunidos en un solo lugar.</p>
      </div>
    </section>

    <div className="container guide-library-content py-5">
      <header className="d-flex flex-wrap justify-content-between align-items-end gap-3 mb-4">
        <div><p className="guide-library-kicker">Biblioteca</p><h2 className="h3 mb-1">Recursos disponibles</h2><p className="text-muted mb-0">Elegí el módulo o la gestión que necesitás resolver.</p></div>
        <span className="badge rounded-pill text-bg-light border px-3 py-2">{GUIDE_CATALOG.length} recursos publicados</span>
      </header>

      <section className="guide-library-grid" aria-label="Guías publicadas">
        {GUIDE_CATALOG.map((guide) => (
          <article className="guide-library-card" key={guide.id}>
            <div className="guide-library-card-top">
              <span className="guide-library-icon" aria-hidden="true">{guide.icon}</span>
              <span className={`guide-library-type guide-library-type-${guide.type}`}>{guide.typeLabel}</span>
            </div>
            <div className="guide-library-card-body">
              <h2>{guide.title}</h2>
              <p>{guide.description}</p>
              <dl>
                <div><dt>Dirigido a</dt><dd>{guide.audience}</dd></div>
                <div><dt>Actualización</dt><dd>{guide.updatedLabel}</dd></div>
              </dl>
            </div>
            <footer>
              <span>{guide.durationLabel}</span>
              <Link className="btn btn-primary" to={guide.to}>Abrir {guide.type === "manual" ? "manual" : "guía"}</Link>
            </footer>
          </article>
        ))}
      </section>

      <aside className="guide-library-help mt-4">
        <div><strong>¿No encontraste lo que buscabas?</strong><p className="mb-0">Contanos qué tarea necesitás resolver. Las consultas frecuentes se convertirán en nuevas guías o videos.</p></div>
        <a className="btn btn-outline-primary" href="mailto:contacto@onoprop.com?subject=Sugerencia%20para%20el%20centro%20de%20ayuda">Sugerir un recurso</a>
      </aside>
    </div>
  </main>
);

export default GuideLibraryPage;

