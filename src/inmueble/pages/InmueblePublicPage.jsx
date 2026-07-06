import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";

import { getPublicInmuebleBySlug } from "../services/inmueble.service";
import { createInmuebleConsulta } from "../services/inmuebleConsulta.service";

const INITIAL_CONSULTA = {
  nombre: "",
  email: "",
  telefono: "",
  mensaje: "",
};

const formatPrice = (inmueble) => {
  if (!inmueble?.precio) return "Consultar";

  const moneda = inmueble.moneda || "USD";
  const precio = Number(inmueble.precio);

  if (!Number.isFinite(precio)) {
    return `${moneda} ${inmueble.precio}`;
  }

  return `${moneda} ${precio.toLocaleString("es-AR")}`;
};

const formatNumber = (value) => {
  const number = Number(value);

  if (!Number.isFinite(number)) return value;

  return number.toLocaleString("es-AR");
};

const buildAddress = (direccion = {}) => {
  return [
    direccion.calle,
    direccion.numero,
    direccion.barrio,
    direccion.ciudad,
  ]
    .filter(Boolean)
    .join(", ");
};

const InmueblePublicPage = () => {
  const { slug } = useParams();

  const [inmueble, setInmueble] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [consultaValues, setConsultaValues] = useState(INITIAL_CONSULTA);
  const [consultaLoading, setConsultaLoading] = useState(false);
  const [consultaError, setConsultaError] = useState(null);
  const [consultaSuccess, setConsultaSuccess] = useState(false);

  const sortedImages = useMemo(() => {
    if (!Array.isArray(inmueble?.images)) return [];

    return [...inmueble.images]
      .filter((img) => img?.url)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [inmueble]);

  const coverImage = sortedImages[0] || null;

  const address = buildAddress(inmueble?.direccion);

  useEffect(() => {
    const fetchInmueble = async () => {
      try {
        setLoading(true);
        setError(null);

        if (!slug) {
          throw new Error("No se recibió el identificador del inmueble");
        }

        const data = await getPublicInmuebleBySlug(slug);

        if (!data) {
          setError("El inmueble no existe o ya no está publicado");
          return;
        }

        setInmueble(data);
      } catch (err) {
        console.error("Error cargando inmueble público:", err);

        if (err.code === "permission-denied") {
          setError("No se pudo acceder a este inmueble");
        } else {
          setError(err.message || "No se pudo cargar el inmueble");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchInmueble();
  }, [slug]);

  const handleConsultaChange = (e) => {
    const { name, value } = e.target;

    setConsultaValues((prev) => ({
      ...prev,
      [name]: value,
    }));

    setConsultaError(null);
    setConsultaSuccess(false);
  };

  const handleConsultaSubmit = async (e) => {
    e.preventDefault();

    try {
      setConsultaLoading(true);
      setConsultaError(null);
      setConsultaSuccess(false);

      await createInmuebleConsulta({
        inmueble,
        ...consultaValues,
      });

      setConsultaValues(INITIAL_CONSULTA);
      setConsultaSuccess(true);
    } catch (err) {
      console.error("Error enviando consulta:", err);

      if (err.code === "permission-denied") {
        setConsultaError(
          "No se pudo enviar la consulta por permisos de la base de datos.",
        );
      } else {
        setConsultaError(err.message || "No se pudo enviar la consulta");
      }
    } finally {
      setConsultaLoading(false);
    }
  };

  if (loading) {
    return (
      <main className="container py-5">
        <p className="text-muted">Cargando inmueble...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="container py-5">
        <div className="alert alert-warning mb-0">{error}</div>
      </main>
    );
  }

  if (!inmueble) {
    return null;
  }

  return (
    <main className="container py-4">
      {/* =========================
          Header
         ========================= */}
      <header className="mb-4">
        <div className="d-flex flex-wrap justify-content-between gap-3 align-items-start">
          <div>
            <p className="text-uppercase text-muted small mb-1">
              {inmueble.operacion || "Inmueble"}
              {inmueble.tipo ? ` · ${inmueble.tipo}` : ""}
            </p>

            <h1 className="h2 mb-2">{inmueble.titulo}</h1>

            {address && <p className="text-muted mb-0">{address}</p>}
          </div>

          <div className="text-md-end">
            <div className="h3 mb-1">{formatPrice(inmueble)}</div>

            {inmueble.expensas > 0 && (
              <div className="text-muted">
                Expensas: ${formatNumber(inmueble.expensas)}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* =========================
          Portada
         ========================= */}
      {coverImage && (
        <section className="mb-4">
          <img
            src={coverImage.url}
            alt={inmueble.titulo}
            className="img-fluid rounded w-100"
            style={{
              maxHeight: 520,
              objectFit: "cover",
            }}
          />
        </section>
      )}

      {/* =========================
          Galería secundaria
         ========================= */}
      {sortedImages.length > 1 && (
        <section className="mb-4">
          <div className="row g-3">
            {sortedImages.slice(1).map((img, index) => (
              <div className="col-6 col-md-3" key={img.storagePath || img.url}>
                <img
                  src={img.url}
                  alt={`${inmueble.titulo} - imagen ${index + 2}`}
                  className="img-fluid rounded w-100"
                  style={{
                    height: 160,
                    objectFit: "cover",
                  }}
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="row g-4">
        {/* =========================
            Información principal
           ========================= */}
        <section className="col-lg-8">
          <div className="card mb-4">
            <div className="card-header fw-semibold">Características</div>

            <div className="card-body">
              <div className="row g-3">
                {inmueble.superficie?.total && (
                  <div className="col-6 col-md-4">
                    <div className="text-muted small">Superficie total</div>
                    <div className="fw-semibold">
                      {formatNumber(inmueble.superficie.total)} m²
                    </div>
                  </div>
                )}

                {inmueble.superficie?.cubierta && (
                  <div className="col-6 col-md-4">
                    <div className="text-muted small">Superficie cubierta</div>
                    <div className="fw-semibold">
                      {formatNumber(inmueble.superficie.cubierta)} m²
                    </div>
                  </div>
                )}

                {inmueble.ambientes && (
                  <div className="col-6 col-md-4">
                    <div className="text-muted small">Ambientes</div>
                    <div className="fw-semibold">{inmueble.ambientes}</div>
                  </div>
                )}

                {inmueble.dormitorios && (
                  <div className="col-6 col-md-4">
                    <div className="text-muted small">Dormitorios</div>
                    <div className="fw-semibold">{inmueble.dormitorios}</div>
                  </div>
                )}

                {inmueble.banos && (
                  <div className="col-6 col-md-4">
                    <div className="text-muted small">Baños</div>
                    <div className="fw-semibold">{inmueble.banos}</div>
                  </div>
                )}

                {inmueble.cocheras && (
                  <div className="col-6 col-md-4">
                    <div className="text-muted small">Cocheras</div>
                    <div className="fw-semibold">{inmueble.cocheras}</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {inmueble.descripcion && (
            <div className="card">
              <div className="card-header fw-semibold">Descripción</div>

              <div className="card-body">
                <p className="mb-0" style={{ whiteSpace: "pre-line" }}>
                  {inmueble.descripcion}
                </p>
              </div>
            </div>
          )}
        </section>

        {/* =========================
            Contacto / consulta
           ========================= */}
        <aside className="col-lg-4">
          <div className="card sticky-top" style={{ top: 90 }}>
            <div className="card-header fw-semibold">Consultar inmueble</div>

            <div className="card-body">
              <p className="text-muted">
                Dejá tus datos y la inmobiliaria se pondrá en contacto para
                brindarte más información.
              </p>

              {consultaSuccess && (
                <div className="alert alert-success">
                  Consulta enviada correctamente. Gracias por contactarte.
                </div>
              )}

              {consultaError && (
                <div className="alert alert-danger">{consultaError}</div>
              )}

              <form onSubmit={handleConsultaSubmit}>
                <div className="mb-3">
                  <label className="form-label">Nombre *</label>
                  <input
                    type="text"
                    name="nombre"
                    className="form-control"
                    value={consultaValues.nombre}
                    onChange={handleConsultaChange}
                    disabled={consultaLoading}
                    required
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label">Email</label>
                  <input
                    type="email"
                    name="email"
                    className="form-control"
                    value={consultaValues.email}
                    onChange={handleConsultaChange}
                    disabled={consultaLoading}
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label">Teléfono / WhatsApp</label>
                  <input
                    type="tel"
                    name="telefono"
                    className="form-control"
                    value={consultaValues.telefono}
                    onChange={handleConsultaChange}
                    disabled={consultaLoading}
                  />
                  <div className="form-text">
                    Ingresá al menos un email o teléfono.
                  </div>
                </div>

                <div className="mb-3">
                  <label className="form-label">Mensaje</label>
                  <textarea
                    name="mensaje"
                    className="form-control"
                    rows={4}
                    value={consultaValues.mensaje}
                    onChange={handleConsultaChange}
                    disabled={consultaLoading}
                    placeholder="Hola, me interesa este inmueble..."
                  />
                </div>

                <button
                  type="submit"
                  className="btn btn-primary w-100"
                  disabled={consultaLoading}
                >
                  {consultaLoading ? "Enviando..." : "Enviar consulta"}
                </button>
              </form>

              <hr />

              <div className="small text-muted">
                Código interno: {inmueble.id}
              </div>

              {inmueble.inmobiliariaId && (
                <div className="small text-muted">
                  Inmobiliaria: {inmueble.inmobiliariaId}
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
};

export default InmueblePublicPage;