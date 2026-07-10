import { Link } from "react-router-dom";

import Contact from "../components/Contact";
import Testimonials from "../components/Testimonials";

const HomePage = () => {
  return (
    <main id="page-top" className="portal-home">
      {/* =========================
          Hero principal
         ========================= */}
      <section className="portal-hero">
        <div className="container">
          <div className="row align-items-center g-5">
            <div className="col-lg-7">
              <div className="portal-eyebrow">
                Portal inmobiliario digital
              </div>

              <h1 className="portal-hero-title mb-4">
                Encontrá propiedades.
                <br />
                Compará opciones.
                <br />
                Contactá directo.
              </h1>

              <p className="portal-hero-text mb-4">
                LaDocTaProp conecta publicaciones inmobiliarias con consultas
                reales. Buscá inmuebles publicados por distintas inmobiliarias o
                ingresá al sitio propio de cada empresa.
              </p>

              <div className="d-flex flex-wrap gap-2 mb-4">
                <Link to="/inmuebles" className="btn btn-primary btn-lg">
                  Ver inmuebles
                </Link>

                <a href="#contact" className="btn btn-outline-dark btn-lg">
                  Publicar con nosotros
                </a>
              </div>

              <div className="row g-3">
                <div className="col-6 col-md-4">
                  <div className="portal-stat">
                    <div className="portal-stat-number">24/7</div>
                    <div className="small text-muted">Portal disponible</div>
                  </div>
                </div>

                <div className="col-6 col-md-4">
                  <div className="portal-stat">
                    <div className="portal-stat-number">100%</div>
                    <div className="small text-muted">Contacto directo</div>
                  </div>
                </div>

                <div className="col-12 col-md-4">
                  <div className="portal-stat">
                    <div className="portal-stat-number">CRM</div>
                    <div className="small text-muted">Consultas organizadas</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="col-lg-5">
              <div className="portal-search-card card">
                <div className="card-body p-4">
                  <p className="text-uppercase text-muted small mb-1">
                    Búsqueda rápida
                  </p>

                  <h2 className="h3 mb-3">Explorá el portal</h2>

                  <p className="text-muted">
                    Accedé al buscador general con filtros por operación, tipo,
                    ciudad, barrio, dormitorios y precio.
                  </p>

                  <div className="d-grid gap-2">
                    <Link to="/inmuebles" className="btn btn-primary">
                      Ir al buscador de inmuebles
                    </Link>

                    <a href="#para-inmobiliarias" className="btn btn-light">
                      Soy inmobiliaria
                    </a>
                  </div>

                  <hr />

                  <div className="small text-muted">
                    También podés compartir búsquedas filtradas por WhatsApp y
                    entrar a la ficha pública de cada inmueble.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================
          Beneficios para usuarios
         ========================= */}
      <section className="portal-section bg-white">
        <div className="container">
          <div className="row mb-4">
            <div className="col-lg-8">
              <p className="text-uppercase text-muted small mb-1">
                Para quienes buscan
              </p>

              <h2 className="portal-section-title">
                Una experiencia simple para encontrar propiedades.
              </h2>
            </div>
          </div>

          <div className="row g-4">
            <div className="col-md-4">
              <div className="portal-feature-card">
                <div className="portal-feature-icon">1</div>
                <h3 className="h5">Buscador claro</h3>
                <p className="text-muted mb-0">
                  Filtros útiles por operación, tipo, ubicación, precio y
                  características principales.
                </p>
              </div>
            </div>

            <div className="col-md-4">
              <div className="portal-feature-card">
                <div className="portal-feature-icon">2</div>
                <h3 className="h5">Ficha completa</h3>
                <p className="text-muted mb-0">
                  Cada inmueble tiene fotos, descripción, precio, ubicación,
                  contacto directo y botón de WhatsApp.
                </p>
              </div>
            </div>

            <div className="col-md-4">
              <div className="portal-feature-card">
                <div className="portal-feature-icon">3</div>
                <h3 className="h5">Links compartibles</h3>
                <p className="text-muted mb-0">
                  Compartí búsquedas o inmuebles puntuales por WhatsApp para
                  decidir más rápido.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================
          Para inmobiliarias
         ========================= */}
      <section id="para-inmobiliarias" className="portal-section">
        <div className="container">
          <div className="row align-items-center g-4">
            <div className="col-lg-6">
              <p className="text-uppercase text-muted small mb-1">
                Para inmobiliarias
              </p>

              <h2 className="portal-section-title">
                Un sitio propio conectado al portal general.
              </h2>

              <p className="lead text-muted">
                Cada inmobiliaria puede tener su landing pública con marca,
                WhatsApp, contacto, propiedades propias y dominio propio en una
                etapa posterior.
              </p>

              <div className="d-flex flex-wrap gap-2 mt-4">
                <a href="#contact" className="btn btn-primary">
                  Quiero publicar
                </a>

                <Link to="/inmuebles" className="btn btn-outline-secondary">
                  Ver portal
                </Link>
              </div>
            </div>

            <div className="col-lg-6">
              <div className="card border-0 shadow-sm">
                <div className="card-body p-4">
                  <h3 className="h4 mb-3">Qué incluye</h3>

                  <div className="row g-3">
                    <div className="col-sm-6">
                      <div className="p-3 rounded border bg-white h-100">
                        Sitio público por inmobiliaria
                      </div>
                    </div>

                    <div className="col-sm-6">
                      <div className="p-3 rounded border bg-white h-100">
                        Publicación de inmuebles
                      </div>
                    </div>

                    <div className="col-sm-6">
                      <div className="p-3 rounded border bg-white h-100">
                        Consultas organizadas
                      </div>
                    </div>

                    <div className="col-sm-6">
                      <div className="p-3 rounded border bg-white h-100">
                        WhatsApp y email integrados
                      </div>
                    </div>

                    <div className="col-sm-6">
                      <div className="p-3 rounded border bg-white h-100">
                        Exportación de leads
                      </div>
                    </div>

                    <div className="col-sm-6">
                      <div className="p-3 rounded border bg-white h-100">
                        Base lista para dominio propio
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
          CTA
         ========================= */}
      <section className="portal-section pt-0">
        <div className="container">
          <div className="portal-cta p-4 p-lg-5">
            <div className="row align-items-center g-4">
              <div className="col-lg-8">
                <h2 className="h1 fw-bold mb-3">
                  Publicá tus inmuebles en una plataforma preparada para vender.
                </h2>

                <p className="text-muted mb-0">
                  Portal general, sitio por inmobiliaria, consultas comerciales,
                  WhatsApp, email y gestión de leads.
                </p>
              </div>

              <div className="col-lg-4 text-lg-end">
                <a href="#contact" className="btn btn-light btn-lg">
                  Contactar
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