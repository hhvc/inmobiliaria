import { useState, useEffect, useCallback, useMemo } from "react";
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

const getCurrentInmobiliariaUrl = (slug) => {
  if (!slug) return "";

  if (typeof window === "undefined") {
    return `/inmobiliaria/${slug}`;
  }

  return `${window.location.origin}/inmobiliaria/${slug}`;
};

const buildWhatsappUrl = ({ whatsapp, inmobiliaria, slug }) => {
  if (!whatsapp) return null;

  const cleanNumber = whatsapp.toString().replace(/\D/g, "");

  if (!cleanNumber) return null;

  const pageUrl = getCurrentInmobiliariaUrl(slug);

  const message = [
    `Hola, quiero consultar por las propiedades de ${inmobiliaria?.nombre || "la inmobiliaria"}.`,
    pageUrl ? `Link: ${pageUrl}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return `https://wa.me/${cleanNumber}?text=${encodeURIComponent(message)}`;
};

const INITIAL_FILTERS = {
  search: "",
  operacion: "",
  tipo: "",
};

const normalizeText = (value = "") => {
  return value
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
};

const getUniqueOptions = (items, getter) => {
  const values = items
    .map(getter)
    .filter(Boolean)
    .map((value) => value.toString().trim())
    .filter(Boolean);

  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
};

const inmuebleMatchesFilters = (inmueble, filters) => {
  const normalizedSearch = normalizeText(filters.search);

  if (normalizedSearch) {
    const searchableText = [
      inmueble.titulo,
      inmueble.descripcion,
      inmueble.operacion,
      inmueble.tipo,
      inmueble.direccion?.barrio,
      inmueble.direccion?.ciudad,
    ]
      .filter(Boolean)
      .join(" ");

    if (!normalizeText(searchableText).includes(normalizedSearch)) {
      return false;
    }
  }

  if (filters.operacion && inmueble.operacion !== filters.operacion) {
    return false;
  }

  if (filters.tipo && inmueble.tipo !== filters.tipo) {
    return false;
  }

  return true;
};

export default function InmobiliariaPublicPage() {
  const { slug } = useParams();

  const [inmobiliaria, setInmobiliaria] = useState(null);
  const [inmuebles, setInmuebles] = useState([]);
  const [filters, setFilters] = useState(INITIAL_FILTERS);

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

  const operacionesDisponibles = useMemo(() => {
    return getUniqueOptions(inmuebles, (inmueble) => inmueble.operacion);
  }, [inmuebles]);

  const tiposDisponibles = useMemo(() => {
    return getUniqueOptions(inmuebles, (inmueble) => inmueble.tipo);
  }, [inmuebles]);

  const filteredInmuebles = useMemo(() => {
    return inmuebles.filter((inmueble) =>
      inmuebleMatchesFilters(inmueble, filters),
    );
  }, [inmuebles, filters]);

  const activeFiltersCount = useMemo(() => {
    return Object.values(filters).filter(Boolean).length;
  }, [filters]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;

    setFilters((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleClearFilters = () => {
    setFilters(INITIAL_FILTERS);
  };

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
  const whatsappUrl = buildWhatsappUrl({
    whatsapp: contacto.whatsapp,
    inmobiliaria,
    slug,
  });

  const totalInmuebles = inmuebles.length;
  const totalDestacados = inmuebles.filter((inmueble) => inmueble.destacado).length;

  const operacionesPermitidas =
    inmobiliaria.configuracion?.operacionesPermitidas || [];

  const tiposPermitidos =
    inmobiliaria.configuracion?.tiposInmueblePermitidos || [];

  const operacionesTexto =
    operacionesPermitidas.length > 0
      ? operacionesPermitidas.join(", ")
      : "venta, alquiler y tasaciones";

  const tiposTexto =
    tiposPermitidos.length > 0
      ? tiposPermitidos.slice(0, 4).join(", ")
      : "casas, departamentos, terrenos y locales";

  return (
    <main className="container py-5">
      {/* =========================
    Hero comercial inmobiliaria
   ========================= */}
      <section className="mb-5">
        <div className="card border-0 shadow-sm overflow-hidden">
          <div className="row g-0 align-items-stretch">
            <div className="col-lg-5 bg-light d-flex align-items-center justify-content-center p-4">
              {inmobiliaria.branding?.logo?.url ? (
                <img
                  src={inmobiliaria.branding.logo.url}
                  alt={`Logo ${inmobiliaria.nombre}`}
                  className="img-fluid"
                  style={{
                    maxHeight: 260,
                    objectFit: "contain",
                  }}
                />
              ) : (
                <div
                  className="rounded bg-white border d-flex align-items-center justify-content-center text-muted w-100"
                  style={{ minHeight: 260 }}
                >
                  {inmobiliaria.nombre}
                </div>
              )}
            </div>

            <div className="col-lg-7">
              <div className="card-body p-4 p-lg-5">
                <p className="text-uppercase text-muted small mb-2">
                  Inmobiliaria destacada
                </p>

                <h1 className="display-5 fw-semibold mb-3">
                  {inmobiliaria.nombre}
                </h1>

                <p className="lead text-muted mb-4">
                  Encontrá propiedades publicadas por {inmobiliaria.nombre}. Operamos
                  en {operacionesTexto} con opciones de {tiposTexto}.
                </p>

                {inmobiliaria.razonSocial && (
                  <p className="text-muted mb-4">{inmobiliaria.razonSocial}</p>
                )}

                <div className="row g-3 mb-4">
                  <div className="col-6 col-md-4">
                    <div className="border rounded p-3 h-100">
                      <div className="h4 mb-0">{totalInmuebles}</div>
                      <div className="small text-muted">Publicaciones</div>
                    </div>
                  </div>

                  <div className="col-6 col-md-4">
                    <div className="border rounded p-3 h-100">
                      <div className="h4 mb-0">{totalDestacados}</div>
                      <div className="small text-muted">Destacadas</div>
                    </div>
                  </div>

                  <div className="col-12 col-md-4">
                    <div className="border rounded p-3 h-100">
                      <div className="h4 mb-0">{operacionesPermitidas.length || "3+"}</div>
                      <div className="small text-muted">Operaciones</div>
                    </div>
                  </div>
                </div>

                <div className="d-flex flex-wrap gap-2">
                  {whatsappUrl && (
                    <a
                      href={whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-success"
                    >
                      Consultar por WhatsApp
                    </a>
                  )}

                  <a href="#inmuebles-publicados" className="btn btn-primary">
                    Ver inmuebles
                  </a>

                  <Link to="/inmuebles" className="btn btn-outline-secondary">
                    Ver portal completo
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================
    Contacto y especialidades
   ========================= */}
      <section id="contacto" className="mb-5">
        <div className="row g-4">
          <div className="col-lg-5">
            <div className="card h-100 shadow-sm">
              <div className="card-body">
                <h2 className="h5 mb-3">Contacto directo</h2>

                {contacto.email && (
                  <p className="mb-2">
                    <strong>Email:</strong>{" "}
                    <a href={`mailto:${contacto.email}`}>{contacto.email}</a>
                  </p>
                )}

                {contacto.telefono && (
                  <p className="mb-2">
                    <strong>Teléfono:</strong>{" "}
                    <a href={`tel:${contacto.telefono}`}>{contacto.telefono}</a>
                  </p>
                )}

                {contacto.whatsapp && (
                  <p className="mb-3">
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

                {whatsappUrl && (
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-success w-100"
                  >
                    Escribir por WhatsApp
                  </a>
                )}

                {!contacto.email && !contacto.telefono && !contacto.whatsapp && (
                  <p className="text-muted mb-0">
                    Esta inmobiliaria todavía no cargó datos de contacto públicos.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="col-lg-7">
            <div className="card h-100 shadow-sm">
              <div className="card-body">
                <h2 className="h5 mb-3">Qué podés encontrar</h2>

                {operacionesPermitidas.length > 0 && (
                  <div className="mb-3">
                    <div className="small text-muted mb-2">Operaciones</div>

                    <div className="d-flex flex-wrap gap-2">
                      {operacionesPermitidas.map((op, index) => (
                        <span key={`${op}-${index}`} className="badge text-bg-primary">
                          {op}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {tiposPermitidos.length > 0 && (
                  <div>
                    <div className="small text-muted mb-2">Tipos de inmuebles</div>

                    <div className="d-flex flex-wrap gap-2">
                      {tiposPermitidos.map((tipo, index) => (
                        <span
                          key={`${tipo}-${index}`}
                          className="badge text-bg-success"
                        >
                          {tipo}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {operacionesPermitidas.length === 0 && tiposPermitidos.length === 0 && (
                  <p className="text-muted mb-0">
                    Consultá las propiedades disponibles y las oportunidades activas
                    de esta inmobiliaria.
                  </p>
                )}

                {inmobiliaria.cuit && (
                  <p className="text-muted small mb-0 mt-4 pt-3 border-top">
                    <strong>CUIT:</strong> {inmobiliaria.cuit}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================
          Inmuebles publicados
         ========================= */}
      <section id="inmuebles-publicados" className="mb-5">
        <div className="d-flex flex-wrap justify-content-between align-items-end gap-3 mb-4">
          <div>
            <p className="text-uppercase text-muted small mb-1">
              Propiedades publicadas
            </p>

            <h2 className="h3 mb-1">Inmuebles de {inmobiliaria.nombre}</h2>

            <p className="text-muted mb-0">
              {filteredInmuebles.length} resultado
              {filteredInmuebles.length === 1 ? "" : "s"} disponible
              {filteredInmuebles.length === 1 ? "" : "s"}
            </p>
          </div>

          <Link to="/inmuebles" className="btn btn-outline-secondary btn-sm">
            Ver portal completo
          </Link>
        </div>

        <div className="card mb-4">
          <div className="card-body">
            <div className="row g-3 align-items-end">
              <div className="col-12 col-lg-5">
                <label className="form-label">Buscar dentro de esta inmobiliaria</label>
                <input
                  type="search"
                  name="search"
                  className="form-control"
                  placeholder="Título, barrio, ciudad, tipo..."
                  value={filters.search}
                  onChange={handleFilterChange}
                />
              </div>

              <div className="col-6 col-lg-3">
                <label className="form-label">Operación</label>
                <select
                  name="operacion"
                  className="form-select"
                  value={filters.operacion}
                  onChange={handleFilterChange}
                >
                  <option value="">Todas</option>
                  {operacionesDisponibles.map((operacion) => (
                    <option key={operacion} value={operacion}>
                      {operacion}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-6 col-lg-3">
                <label className="form-label">Tipo</label>
                <select
                  name="tipo"
                  className="form-select"
                  value={filters.tipo}
                  onChange={handleFilterChange}
                >
                  <option value="">Todos</option>
                  {tiposDisponibles.map((tipo) => (
                    <option key={tipo} value={tipo}>
                      {tipo}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-12 col-lg-1 d-grid">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={handleClearFilters}
                  disabled={activeFiltersCount === 0}
                >
                  Limpiar
                </button>
              </div>
            </div>
          </div>
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

        {!inmueblesLoading &&
          !inmueblesError &&
          inmuebles.length > 0 &&
          filteredInmuebles.length === 0 && (
            <div className="alert alert-info">
              No encontramos inmuebles con esos filtros dentro de esta inmobiliaria.
            </div>
          )}

        {!inmueblesLoading && !inmueblesError && filteredInmuebles.length > 0 && (
          <div className="row g-4">
            {filteredInmuebles.map((inmueble) => {
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