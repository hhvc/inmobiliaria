import { useState, useEffect, useCallback } from "react";
import { Link, useParams } from "react-router-dom";

import { getInmobiliariaBySlug } from "../services/inmobiliaria.service";
import { getPublicInmueblesByInmobiliaria } from "../../inmueble/services/inmueble.service";

const formatPrice = (inmueble) => {
  if (!inmueble?.precio) return "Consultar";

  const moneda = inmueble.moneda || "USD";
  const precio = Number(inmueble.precio);

  if (!Number.isFinite(precio)) {
    return `${moneda} ${inmueble.precio}`;
  }

  return `${moneda} ${precio.toLocaleString("es-AR")}`;
};

const buildAddress = (direccion = {}) => {
  return [direccion.barrio, direccion.ciudad].filter(Boolean).join(", ");
};

const getCoverImage = (inmueble) => {
  if (!Array.isArray(inmueble?.images)) return null;

  return [...inmueble.images]
    .filter((img) => img?.url)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))[0];
};

const buildWhatsappUrl = (whatsapp) => {
  if (!whatsapp) return null;

  const cleanNumber = whatsapp.replace(/\D/g, "");

  if (!cleanNumber) return null;

  return `https://wa.me/${cleanNumber}`;
};

export default function InmobiliariaPublicPage() {
  const { slug } = useParams();

  const [inmobiliaria, setInmobiliaria] = useState(null);
  const [inmuebles, setInmuebles] = useState([]);

  const [loading, setLoading] = useState(true);
  const [inmueblesLoading, setInmueblesLoading] = useState(false);

  const [error, setError] = useState(null);
  const [inmueblesError, setInmueblesError] = useState(null);

  const loadInmobiliaria = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setInmueblesError(null);

      if (!slug) {
        throw new Error("No se recibió el identificador de la inmobiliaria");
      }

      const data = await getInmobiliariaBySlug(slug);

      if (!data) {
        setError("Inmobiliaria no encontrada");
        return;
      }

      setInmobiliaria(data);

      const inmobiliariaId = data.id || data.inmobiliariaId;

      if (!inmobiliariaId) {
        setInmuebles([]);
        setInmueblesError(
          "No se pudo determinar el ID de la inmobiliaria para cargar sus inmuebles.",
        );
        return;
      }

      try {
        setInmueblesLoading(true);

        const result = await getPublicInmueblesByInmobiliaria(inmobiliariaId, {
          pageSize: 24,
        });

        setInmuebles(Array.isArray(result?.data) ? result.data : []);
      } catch (err) {
        console.error("Error cargando inmuebles de la inmobiliaria:", err);

        if (err.code === "permission-denied") {
          setInmueblesError(
            "No se pudieron cargar los inmuebles publicados de esta inmobiliaria.",
          );
        } else {
          setInmueblesError(
            err.message || "Error al cargar los inmuebles publicados.",
          );
        }
      } finally {
        setInmueblesLoading(false);
      }
    } catch (err) {
      console.error("Error cargando inmobiliaria:", err);

      if (err.code === "permission-denied") {
        setError("No se pudo acceder a la inmobiliaria");
      } else {
        setError(err.message || "Error al cargar la inmobiliaria");
      }
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    loadInmobiliaria();
  }, [loadInmobiliaria]);

  if (loading) {
    return <div className="container py-5 text-center">Cargando...</div>;
  }

  if (error || !inmobiliaria) {
    return (
      <div className="container py-5">
        <div className="alert alert-danger">
          {error || "Inmobiliaria no encontrada"}
        </div>

        <Link to="/" className="btn btn-primary">
          Volver al inicio
        </Link>
      </div>
    );
  }

  const contacto = inmobiliaria.configuracion?.contacto || {};
  const whatsappUrl = buildWhatsappUrl(contacto.whatsapp);

  return (
    <main className="container py-5">
      {/* =========================
          Header inmobiliaria
         ========================= */}
      <section className="row mb-5">
        <div className="col-md-4">
          {inmobiliaria.branding?.logo?.url ? (
            <img
              src={inmobiliaria.branding.logo.url}
              alt={`Logo ${inmobiliaria.nombre}`}
              className="img-fluid rounded shadow mb-4"
              style={{ maxHeight: 200, objectFit: "contain" }}
            />
          ) : (
            <div
              className="bg-light rounded shadow-sm d-flex align-items-center justify-content-center text-muted mb-4"
              style={{ height: 200 }}
            >
              Sin logo
            </div>
          )}
        </div>

        <div className="col-md-8">
          <p className="text-uppercase text-muted small mb-1">Inmobiliaria</p>

          <h1 className="display-5 mb-3">{inmobiliaria.nombre}</h1>

          {inmobiliaria.razonSocial && (
            <p className="lead">{inmobiliaria.razonSocial}</p>
          )}

          <div className="mb-4">
            <h5 className="border-bottom pb-2">Información de contacto</h5>

            {contacto.email && (
              <p>
                <strong>Email:</strong>{" "}
                <a href={`mailto:${contacto.email}`}>{contacto.email}</a>
              </p>
            )}

            {contacto.telefono && (
              <p>
                <strong>Teléfono:</strong>{" "}
                <a href={`tel:${contacto.telefono}`}>{contacto.telefono}</a>
              </p>
            )}

            {contacto.whatsapp && (
              <p>
                <strong>WhatsApp:</strong>{" "}
                {whatsappUrl ? (
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {contacto.whatsapp}
                  </a>
                ) : (
                  contacto.whatsapp
                )}
              </p>
            )}
          </div>

          {inmobiliaria.configuracion?.operacionesPermitidas?.length > 0 && (
            <div className="mb-4">
              <h5 className="border-bottom pb-2">Operaciones</h5>

              <div className="d-flex flex-wrap gap-2">
                {inmobiliaria.configuracion.operacionesPermitidas.map(
                  (op, index) => (
                    <span key={`${op}-${index}`} className="badge bg-primary p-2">
                      {op}
                    </span>
                  ),
                )}
              </div>
            </div>
          )}

          {inmobiliaria.configuracion?.tiposInmueblePermitidos?.length > 0 && (
            <div className="mb-4">
              <h5 className="border-bottom pb-2">Tipos de inmuebles</h5>

              <div className="d-flex flex-wrap gap-2">
                {inmobiliaria.configuracion.tiposInmueblePermitidos.map(
                  (tipo, index) => (
                    <span
                      key={`${tipo}-${index}`}
                      className="badge bg-success p-2"
                    >
                      {tipo}
                    </span>
                  ),
                )}
              </div>
            </div>
          )}

          {inmobiliaria.cuit && (
            <div className="mt-4 pt-4 border-top">
              <p className="text-muted mb-0">
                <small>
                  <strong>CUIT:</strong> {inmobiliaria.cuit}
                </small>
              </p>
            </div>
          )}
        </div>
      </section>

      {/* =========================
          Inmuebles publicados
         ========================= */}
      <section className="mb-5">
        <div className="d-flex justify-content-between align-items-end gap-3 mb-4">
          <div>
            <p className="text-uppercase text-muted small mb-1">
              Propiedades publicadas
            </p>

            <h2 className="h3 mb-0">Inmuebles de {inmobiliaria.nombre}</h2>
          </div>

          <Link to="/inmuebles" className="btn btn-outline-secondary btn-sm">
            Ver portal completo
          </Link>
        </div>

        {inmueblesLoading && (
          <p className="text-muted">Cargando inmuebles publicados...</p>
        )}

        {inmueblesError && (
          <div className="alert alert-warning">{inmueblesError}</div>
        )}

        {!inmueblesLoading && !inmueblesError && inmuebles.length === 0 && (
          <div className="alert alert-info">
            Esta inmobiliaria todavía no tiene inmuebles publicados en el portal.
          </div>
        )}

        {!inmueblesLoading && !inmueblesError && inmuebles.length > 0 && (
          <div className="row g-4">
            {inmuebles.map((inmueble) => {
              const coverImage = getCoverImage(inmueble);
              const address = buildAddress(inmueble.direccion);
              const detailUrl = inmueble.slug
                ? `/inmueble/${inmueble.slug}`
                : null;

              return (
                <article
                  className="col-12 col-md-6 col-lg-4"
                  key={inmueble.id}
                >
                  <div className="card h-100 shadow-sm">
                    {coverImage ? (
                      <img
                        src={coverImage.url}
                        alt={inmueble.titulo}
                        className="card-img-top"
                        style={{
                          height: 220,
                          objectFit: "cover",
                        }}
                        loading="lazy"
                      />
                    ) : (
                      <div
                        className="bg-light d-flex align-items-center justify-content-center text-muted"
                        style={{ height: 220 }}
                      >
                        Sin imagen
                      </div>
                    )}

                    <div className="card-body d-flex flex-column">
                      <div className="d-flex justify-content-between gap-2 mb-2">
                        <span className="badge bg-secondary">
                          {inmueble.operacion || "Inmueble"}
                        </span>

                        {inmueble.destacado && (
                          <span className="badge bg-primary">Destacado</span>
                        )}
                      </div>

                      <h3 className="h5 card-title">{inmueble.titulo}</h3>

                      {address && (
                        <p className="text-muted small mb-2">{address}</p>
                      )}

                      <p className="h5 mb-3">{formatPrice(inmueble)}</p>

                      <div className="small text-muted mb-3">
                        {inmueble.tipo && <span>{inmueble.tipo}</span>}

                        {inmueble.ambientes && (
                          <span> · {inmueble.ambientes} amb.</span>
                        )}

                        {inmueble.dormitorios && (
                          <span> · {inmueble.dormitorios} dorm.</span>
                        )}
                      </div>

                      <div className="mt-auto">
                        {detailUrl ? (
                          <Link
                            to={detailUrl}
                            className="btn btn-outline-primary w-100"
                          >
                            Ver detalle
                          </Link>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-outline-secondary w-100"
                            disabled
                          >
                            Sin enlace público
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* =========================
          Galería institucional
         ========================= */}
      {inmobiliaria.branding?.backgrounds && (
        <section className="mt-5">
          <h2 className="h4 mb-4">Galería institucional</h2>

          <div className="row">
            {Object.entries(inmobiliaria.branding.backgrounds)
              .filter((entry) => {
                const bg = entry[1];
                return bg?.url;
              })
              .map(([key, bg]) => (
                <div key={key} className="col-md-4 mb-3">
                  <div className="card h-100">
                    <img
                      src={bg.url}
                      alt={`Fondo ${key} de ${inmobiliaria.nombre}`}
                      className="card-img-top"
                      style={{ height: 200, objectFit: "cover" }}
                    />

                    <div className="card-body">
                      <h3 className="h6 card-title text-capitalize">{key}</h3>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </section>
      )}
    </main>
  );
}