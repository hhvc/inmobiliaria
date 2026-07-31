import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import SEO from "../../components/SEO";
import { getPublicInmobiliariaById } from "../../inmobiliaria/services/inmobiliaria.service";
import { getPublicInmueblesByInmobiliaria } from "../../inmueble/services/inmueble.service";
import { createEmprendimientoConsulta } from "../../inmueble/services/inmuebleConsulta.service";
import { buildWhatsappRedirectUrl } from "../../utils/whatsappRedirect";
import { getPublicEmprendimientoBySlug } from "../services/emprendimiento.service";
import {
  getEmprendimientoStatusLabel,
  getEmprendimientoTypeLabel,
} from "../utils/emprendimientoSchema";

const INITIAL_CONSULTA = {
  nombre: "",
  email: "",
  telefono: "",
  mensaje: "",
};

const formatPrice = (item) => {
  if (!item?.precio) return "Consultar";
  const price = Number(item.precio);

  return `${item.moneda || "USD"} ${
    Number.isFinite(price) ? price.toLocaleString("es-AR") : item.precio
  }`;
};

const EmprendimientoPublicPage = () => {
  const { slug } = useParams();
  const [item, setItem] = useState(null);
  const [inmobiliaria, setInmobiliaria] = useState(null);
  const [units, setUnits] = useState([]);
  const [consulta, setConsulta] = useState(INITIAL_CONSULTA);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        setLoading(true);
        setError("");
        const development = await getPublicEmprendimientoBySlug(slug);

        if (!development) {
          throw new Error("No se encontró el emprendimiento publicado");
        }

        const [agency, inmuebleResult] = await Promise.all([
          getPublicInmobiliariaById(development.inmobiliariaId),
          getPublicInmueblesByInmobiliaria(development.inmobiliariaId, {
            pageSize: 100,
          }),
        ]);

        if (!active) return;
        setItem(development);
        setInmobiliaria(agency);
        setUnits(
          (inmuebleResult?.data || []).filter(
            (unit) => unit.emprendimientoId === development.id,
          ),
        );
      } catch (loadError) {
        if (active) {
          setError(loadError.message || "No se pudo cargar el emprendimiento");
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [slug]);

  const images = useMemo(
    () =>
      [...(item?.images || [])]
        .filter((image) => image?.url)
        .sort((a, b) => (a.order || 0) - (b.order || 0)),
    [item?.images],
  );

  const contact = inmobiliaria?.configuracion?.contacto || {};
  const whatsappUrl =
    contact.whatsapp && inmobiliaria?.slug
      ? buildWhatsappRedirectUrl({
          agencySlug: inmobiliaria.slug,
          source: "development-page",
        })
      : "";

  const submitConsulta = async (event) => {
    event.preventDefault();

    try {
      setSending(true);
      await createEmprendimientoConsulta({ emprendimiento: item, ...consulta });
      setConsulta(INITIAL_CONSULTA);
      setSent(true);
    } catch (submitError) {
      window.alert(submitError.message || "No se pudo enviar la consulta");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return <main className="container py-5 text-center">Cargando...</main>;
  }

  if (error || !item) {
    return (
      <main className="container py-5">
        <div className="alert alert-warning">
          {error || "Emprendimiento no disponible"}
        </div>
      </main>
    );
  }

  const location = [
    item.direccion?.barrio,
    item.direccion?.ciudad,
    item.direccion?.provincia,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <main>
      <SEO
        title={`${item.nombre} | ${inmobiliaria?.nombre || "ONO Prop"}`}
        description={`${getEmprendimientoTypeLabel(item.tipo)} en ${location}. ${
          item.descripcion
        }`.slice(0, 165)}
        image={images[0]?.url}
        noIndex={Boolean(item.noIndex)}
      />

      <section className="bg-dark text-white py-5">
        <div className="container py-4">
          <div className="d-flex flex-wrap gap-2 mb-3">
            <span className="badge text-bg-primary">
              {getEmprendimientoTypeLabel(item.tipo)}
            </span>
            <span className="badge text-bg-info">
              {getEmprendimientoStatusLabel(item.estadoObra)}
            </span>
            {item.destacado && (
              <span className="badge text-bg-warning">Destacado</span>
            )}
          </div>
          <h1 className="display-5 fw-bold">{item.nombre}</h1>
          <p className="lead mb-2">{location}</p>
          {item.desarrollista && (
            <p className="mb-0">Desarrolla: {item.desarrollista}</p>
          )}
        </div>
      </section>

      <section className="container py-5">
        {images.length > 0 && (
          <div className="row g-3 mb-5">
            {images.slice(0, 6).map((image, index) => (
              <div
                className={index === 0 ? "col-12 col-lg-8" : "col-6 col-lg-4"}
                key={image.storagePath || image.url}
              >
                <img
                  src={image.url}
                  alt={`${item.nombre} ${index + 1}`}
                  className="w-100 rounded shadow-sm"
                  style={{
                    height: index === 0 ? 430 : 205,
                    objectFit: "cover",
                  }}
                />
              </div>
            ))}
          </div>
        )}

        <div className="row g-4">
          <div className="col-lg-8">
            <h2 className="h3">Sobre el emprendimiento</h2>
            <p style={{ whiteSpace: "pre-line" }}>{item.descripcion}</p>

            <div className="card border-0 bg-light mb-4">
              <div className="card-body">
                <div className="d-flex justify-content-between mb-2">
                  <strong>Avance de obra</strong>
                  <span>{item.avanceObra || 0}%</span>
                </div>
                <div className="progress" style={{ height: 12 }}>
                  <div
                    className="progress-bar"
                    style={{ width: `${item.avanceObra || 0}%` }}
                  />
                </div>
                {item.fechaEntrega && (
                  <p className="small text-muted mt-3 mb-0">
                    Entrega estimada: {item.fechaEntrega}
                  </p>
                )}
              </div>
            </div>

            {(item.amenities?.length > 0 || item.servicios?.length > 0) && (
              <div className="row g-4 mb-4">
                {item.amenities?.length > 0 && (
                  <div className="col-md-6">
                    <h3 className="h5">Amenities</h3>
                    <ul>
                      {item.amenities.map((value) => (
                        <li key={value}>{value}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {item.servicios?.length > 0 && (
                  <div className="col-md-6">
                    <h3 className="h5">Servicios</h3>
                    <ul>
                      {item.servicios.map((value) => (
                        <li key={value}>{value}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {item.financiacion?.disponible && (
              <div className="alert alert-info">
                <h3 className="h5">Financiación disponible</h3>
                <p className="mb-1">
                  {[
                    item.financiacion.anticipo,
                    item.financiacion.cuotas,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {item.financiacion.descripcion && (
                  <p className="mb-0">{item.financiacion.descripcion}</p>
                )}
              </div>
            )}
          </div>

          <aside className="col-lg-4">
            <div
              className="card border-0 shadow-sm sticky-lg-top"
              style={{ top: 90 }}
            >
              <div className="card-body p-4">
                <h2 className="h5">Consultar por este proyecto</h2>
                {inmobiliaria?.nombre && (
                  <p className="text-muted small">
                    Publicado por {inmobiliaria.nombre}
                  </p>
                )}
                {sent && (
                  <div className="alert alert-success small">
                    Consulta enviada correctamente.
                  </div>
                )}
                <form onSubmit={submitConsulta} className="vstack gap-3">
                  <input
                    className="form-control"
                    placeholder="Nombre *"
                    value={consulta.nombre}
                    onChange={(event) =>
                      setConsulta((current) => ({
                        ...current,
                        nombre: event.target.value,
                      }))
                    }
                    required
                  />
                  <input
                    className="form-control"
                    type="email"
                    placeholder="Email"
                    value={consulta.email}
                    onChange={(event) =>
                      setConsulta((current) => ({
                        ...current,
                        email: event.target.value,
                      }))
                    }
                  />
                  <input
                    className="form-control"
                    placeholder="Teléfono / WhatsApp"
                    value={consulta.telefono}
                    onChange={(event) =>
                      setConsulta((current) => ({
                        ...current,
                        telefono: event.target.value,
                      }))
                    }
                  />
                  <textarea
                    className="form-control"
                    rows={4}
                    placeholder="Mensaje"
                    value={consulta.mensaje}
                    onChange={(event) =>
                      setConsulta((current) => ({
                        ...current,
                        mensaje: event.target.value,
                      }))
                    }
                  />
                  <button className="btn btn-primary" disabled={sending}>
                    {sending ? "Enviando..." : "Enviar consulta"}
                  </button>
                  {whatsappUrl && (
                    <a className="btn btn-outline-success" href={whatsappUrl}>
                      Consultar por WhatsApp
                    </a>
                  )}
                </form>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section className="bg-light py-5">
        <div className="container">
          <div className="d-flex justify-content-between align-items-center mb-4">
            <div>
              <p className="text-uppercase text-muted small mb-1">
                Disponibilidad
              </p>
              <h2 className="h3 mb-0">Unidades publicadas</h2>
            </div>
            <Link className="btn btn-outline-secondary" to="/inmuebles">
              Ver todos los inmuebles
            </Link>
          </div>

          {units.length === 0 ? (
            <div className="alert alert-light border">
              Consultá por las unidades disponibles de este emprendimiento.
            </div>
          ) : (
            <div className="row g-4">
              {units.map((unit) => {
                const cover = unit.images?.find((image) => image?.url);

                return (
                  <div className="col-md-6 col-xl-4" key={unit.id}>
                    <article className="card h-100 border-0 shadow-sm">
                      {cover?.url && (
                        <img
                          src={cover.url}
                          alt={unit.titulo}
                          className="card-img-top"
                          style={{ height: 210, objectFit: "cover" }}
                        />
                      )}
                      <div className="card-body d-flex flex-column">
                        <h3 className="h5">{unit.titulo}</h3>
                        {unit.unidadEmprendimiento?.codigo && (
                          <p className="small text-muted">
                            Unidad {unit.unidadEmprendimiento.codigo}
                          </p>
                        )}
                        <p className="fw-semibold">{formatPrice(unit)}</p>
                        <Link
                          className="btn btn-outline-primary mt-auto"
                          to={`/inmueble/${unit.slug}`}
                        >
                          Ver unidad
                        </Link>
                      </div>
                    </article>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </main>
  );
};

export default EmprendimientoPublicPage;

