import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { getInmobiliariaBySlug } from "../services/inmobiliaria.service";

export default function InmobiliariaPublicPage() {
  const { slug } = useParams();
  const [inmobiliaria, setInmobiliaria] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadInmobiliaria = useCallback(async () => {
    try {
      const data = await getInmobiliariaBySlug(slug);
      if (!data) {
        setError("Inmobiliaria no encontrada");
      } else {
        setInmobiliaria(data);
      }
    } catch (err) {
      setError("Error al cargar la inmobiliaria");
      console.error(err);
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
        <a href="/" className="btn btn-primary">
          Volver al inicio
        </a>
      </div>
    );
  }

  return (
    <div className="container py-5">
      <div className="row">
        <div className="col-md-4">
          {inmobiliaria.branding?.logo?.url && (
            <img
              src={inmobiliaria.branding.logo.url}
              alt={`Logo ${inmobiliaria.nombre}`}
              className="img-fluid rounded shadow mb-4"
              style={{ maxHeight: "200px", objectFit: "contain" }}
            />
          )}
        </div>
        <div className="col-md-8">
          <h1 className="display-4 mb-3">{inmobiliaria.nombre}</h1>
          {inmobiliaria.razonSocial && (
            <p className="lead">{inmobiliaria.razonSocial}</p>
          )}

          <div className="mb-4">
            <h5 className="border-bottom pb-2">Información de Contacto</h5>
            {inmobiliaria.configuracion?.contacto?.email && (
              <p>
                <strong>Email:</strong>{" "}
                <a href={`mailto:${inmobiliaria.configuracion.contacto.email}`}>
                  {inmobiliaria.configuracion.contacto.email}
                </a>
              </p>
            )}
            {inmobiliaria.configuracion?.contacto?.telefono && (
              <p>
                <strong>Teléfono:</strong>{" "}
                <a href={`tel:${inmobiliaria.configuracion.contacto.telefono}`}>
                  {inmobiliaria.configuracion.contacto.telefono}
                </a>
              </p>
            )}
            {inmobiliaria.configuracion?.contacto?.whatsapp && (
              <p>
                <strong>WhatsApp:</strong>{" "}
                <a
                  href={`https://wa.me/${inmobiliaria.configuracion.contacto.whatsapp.replace(
                    /\D/g,
                    ""
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {inmobiliaria.configuracion.contacto.whatsapp}
                </a>
              </p>
            )}
          </div>

          {inmobiliaria.configuracion?.operacionesPermitidas?.length > 0 && (
            <div className="mb-4">
              <h5 className="border-bottom pb-2">Operaciones</h5>
              <div className="d-flex flex-wrap gap-2">
                {inmobiliaria.configuracion.operacionesPermitidas.map(
                  (op, index) => (
                    <span key={index} className="badge bg-primary p-2">
                      {op}
                    </span>
                  )
                )}
              </div>
            </div>
          )}

          {inmobiliaria.configuracion?.tiposInmueblePermitidos?.length > 0 && (
            <div className="mb-4">
              <h5 className="border-bottom pb-2">Tipos de Inmuebles</h5>
              <div className="d-flex flex-wrap gap-2">
                {inmobiliaria.configuracion.tiposInmueblePermitidos.map(
                  (tipo, index) => (
                    <span key={index} className="badge bg-success p-2">
                      {tipo}
                    </span>
                  )
                )}
              </div>
            </div>
          )}

          {inmobiliaria.cuit && (
            <div className="mt-4 pt-4 border-top">
              <p className="text-muted">
                <small>
                  <strong>CUIT:</strong> {inmobiliaria.cuit}
                </small>
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Mostrar fondos si existen */}
      {inmobiliaria.branding?.backgrounds && (
        <div className="mt-5">
          <h4 className="mb-4">Galería</h4>
          <div className="row">
            {Object.entries(inmobiliaria.branding.backgrounds)
              // Método 1: Usar una función separada para el filter
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
                      style={{ height: "200px", objectFit: "cover" }}
                    />
                    <div className="card-body">
                      <h6 className="card-title text-capitalize">{key}</h6>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
