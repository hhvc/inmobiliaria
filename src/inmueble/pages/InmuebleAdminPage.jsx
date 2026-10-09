import { Link } from "react-router-dom";

import SEO from "../../components/SEO";

const ACTIONS = [
  {
    title: "Propiedades cargadas",
    description: "Filtrá, editá, duplicá, publicá y exportá las propiedades de la inmobiliaria activa.",
    to: "/admin/inmuebles/listado",
    cta: "Abrir listado",
    icon: "📋",
    color: "primary",
  },
  {
    title: "Nueva propiedad",
    description: "Creá la ficha técnica y comercial. Puede permanecer como borrador o sin publicar.",
    to: "/admin/inmuebles/nuevo",
    cta: "Cargar propiedad",
    icon: "➕",
    color: "success",
  },
  {
    title: "Importación masiva",
    description: "Incorporá varias propiedades mediante CSV y completá después la información faltante.",
    to: "/admin/inmuebles/importar",
    cta: "Importar CSV",
    icon: "⬆️",
    color: "info",
  },
  {
    title: "Vista pública",
    description: "Revisá cómo se muestran los avisos publicados en el portal ONO Prop.",
    to: "/inmuebles",
    cta: "Ver portal",
    icon: "👁️",
    color: "secondary",
  },
];

const InmuebleAdminPage = () => (
  <main className="container py-4">
    <SEO title="Administración de inmuebles | ONO Prop" noIndex />

    <header className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
      <div>
        <p className="text-uppercase text-muted small mb-1">Panel inmobiliario</p>
        <h1 className="h3 mb-1">Administración de inmuebles</h1>
        <p className="text-muted mb-0">
          Fichas, multimedia, estado comercial, publicación y difusión de cada propiedad.
        </p>
      </div>
      <div className="d-flex flex-wrap gap-2">
        <Link className="btn btn-outline-primary" to="/guias/administracion-inmuebles">
          Manual
        </Link>
        <Link className="btn btn-outline-success" to="/admin/alquileres">
          Ir a alquileres
        </Link>
        <Link className="btn btn-primary" to="/admin/inmuebles/nuevo">
          + Nueva propiedad
        </Link>
      </div>
    </header>

    <section className="alert alert-light border shadow-sm mb-4" aria-labelledby="module-scope-title">
      <div className="row g-3 align-items-stretch">
        <div className="col-lg-6">
          <div className="h-100 p-3 rounded bg-primary-subtle border border-primary-subtle">
            <p className="text-uppercase small fw-semibold text-primary mb-1">Este módulo</p>
            <h2 className="h5" id="module-scope-title">Gestiona la propiedad</h2>
            <p className="mb-0 small">
              Conserva su ficha y permite preparar su presencia comercial. La propiedad puede
              existir aunque no esté publicada ni tenga un contrato vigente.
            </p>
          </div>
        </div>
        <div className="col-lg-6">
          <div className="h-100 p-3 rounded bg-success-subtle border border-success-subtle">
            <p className="text-uppercase small fw-semibold text-success mb-1">Módulo relacionado</p>
            <h2 className="h5">Administración de alquileres</h2>
            <p className="mb-2 small">
              Gestiona contratos, locadores, locatarios, vencimientos, cobros, liquidaciones y
              facturación. Reutiliza la propiedad cargada aquí sin duplicar datos.
            </p>
            <Link className="small fw-semibold" to="/admin/alquileres/nuevo">
              Crear un contrato de alquiler →
            </Link>
          </div>
        </div>
      </div>
    </section>

    <section className="row g-4" aria-label="Acciones de administración de inmuebles">
      {ACTIONS.map((action) => (
        <article className="col-md-6 col-xl-3" key={action.title}>
          <div className="card h-100 border-0 shadow-sm">
            <div className="card-body p-4 d-flex flex-column">
              <div className="display-6 mb-3" aria-hidden="true">{action.icon}</div>
              <h2 className="h5">{action.title}</h2>
              <p className="text-muted small flex-grow-1">{action.description}</p>
              <Link className={`btn btn-${action.color}`} to={action.to}>{action.cta}</Link>
            </div>
          </div>
        </article>
      ))}
    </section>
  </main>
);

export default InmuebleAdminPage;
