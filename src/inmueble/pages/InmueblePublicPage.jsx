import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { getInmuebleById } from "../services/inmueble.service";
import { useAuth } from "../../context/auth/useAuth";
import { canReadInmueble } from "../helpers/permissions";

const InmueblePublicPage = () => {
  const { id } = useParams();
  const { user } = useAuth();

  const [inmueble, setInmueble] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchInmueble = async () => {
      try {
        setLoading(true);
        setError(null);

        const data = await getInmuebleById(id);

        if (!data) {
          setError("El inmueble no existe");
          return;
        }

        // 🔐 Permisos alineados con Firestore Rules
        if (!canReadInmueble(user, data)) {
          setError("No tenés permisos para ver este inmueble");
          return;
        }

        setInmueble(data);
      } catch (err) {
        console.error("Error cargando inmueble público:", err);

        if (err.code === "permission-denied") {
          setError("Acceso denegado");
        } else {
          setError("No se pudo cargar el inmueble");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchInmueble();
  }, [id, user]);

  if (loading) {
    return <p>Cargando inmueble...</p>;
  }

  if (error) {
    return <div className="error-box">{error}</div>;
  }

  if (!inmueble) {
    return null;
  }

  return (
    <article className="inmueble-public-page">
      {/* =========================
          Header
         ========================= */}
      <header className="inmueble-header">
        <h1>{inmueble.titulo}</h1>

        {inmueble.direccion?.ciudad && (
          <p className="inmueble-ubicacion">
            {[
              inmueble.direccion.calle,
              inmueble.direccion.numero,
              inmueble.direccion.barrio,
              inmueble.direccion.ciudad,
            ]
              .filter(Boolean)
              .join(", ")}
          </p>
        )}
      </header>

      {/* =========================
          Galería
         ========================= */}
      {Array.isArray(inmueble.images) && inmueble.images.length > 0 && (
        <section className="inmueble-gallery">
          {inmueble.images.map((img, index) => (
            <img
              key={img.id || index}
              src={img.url}
              alt={`${inmueble.titulo} - imagen ${index + 1}`}
              loading="lazy"
            />
          ))}
        </section>
      )}

      {/* =========================
          Información principal
         ========================= */}
      <section className="inmueble-main">
        <div className="inmueble-info">
          <p>
            <strong>Operación:</strong> {inmueble.operacion}
          </p>

          <p>
            <strong>Tipo:</strong> {inmueble.tipo}
          </p>

          <p>
            <strong>Precio:</strong>{" "}
            {inmueble.precio
              ? `${inmueble.moneda || "USD"} ${inmueble.precio.toLocaleString(
                  "es-AR"
                )}`
              : "Consultar"}
          </p>

          {inmueble.expensas > 0 && (
            <p>
              <strong>Expensas:</strong> $
              {inmueble.expensas.toLocaleString("es-AR")}
            </p>
          )}
        </div>

        {inmueble.descripcion && (
          <div className="inmueble-descripcion">
            <h2>Descripción</h2>
            <p>{inmueble.descripcion}</p>
          </div>
        )}
      </section>

      {/* =========================
          Contacto
         ========================= */}
      <section className="inmueble-contacto">
        <h2>Contacto</h2>
        <p>
          ¿Te interesa este inmueble? Comunicate con la inmobiliaria para más
          información.
        </p>

        {/* Placeholder → luego conectar con inmobiliaria */}
        <button type="button">Consultar</button>
      </section>
    </article>
  );
};

export default InmueblePublicPage;
