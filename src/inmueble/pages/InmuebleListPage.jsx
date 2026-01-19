import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";

import {
  getInmueblesByInmobiliaria,
  deleteInmueble,
  updateInmueble,
} from "../services/inmueble.service";

import { useAuth } from "../../context/auth/useAuth";
import InmuebleFilters from "../components/InmuebleFilters";

const PAGE_SIZE = 10;

const InmuebleListPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [inmuebles, setInmuebles] = useState([]);
  const [lastDoc, setLastDoc] = useState(null);

  const [filters, setFilters] = useState({
    estado: "",
    tipo: "",
    operacion: "",
  });

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);

  const [deletingId, setDeletingId] = useState(null);
  const [togglingId, setTogglingId] = useState(null);

  /* =========================================================
     Fetch inmuebles
     ========================================================= */

  const fetchInmuebles = useCallback(
    async ({ append = false } = {}) => {
      if (!user?.inmobiliariaId) return;

      try {
        append ? setLoadingMore(true) : setLoading(true);
        setError(null);

        const { data, lastDoc: newLastDoc } = await getInmueblesByInmobiliaria(
          user.inmobiliariaId,
          {
            ...filters,
            pageSize: PAGE_SIZE,
            lastDoc: append ? lastDoc : null,
          }
        );

        setInmuebles((prev) => (append ? [...prev, ...data] : data));
        setLastDoc(newLastDoc);
      } catch (err) {
        console.error("Error cargando inmuebles:", err);
        setError("Error al cargar los inmuebles");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [user?.inmobiliariaId, filters, lastDoc]
  );

  /* =========================================================
     Re-fetch al cambiar filtros / usuario
     ========================================================= */

  useEffect(() => {
    setLastDoc(null);
    fetchInmuebles({ append: false });
  }, [fetchInmuebles]);

  /* =========================================================
     Acciones
     ========================================================= */

  const handleEdit = (id) => {
    navigate(`/inmuebles/editar/${id}`);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("¿Eliminar este inmueble?")) return;

    try {
      setDeletingId(id);
      await deleteInmueble(user.inmobiliariaId, id);

      setInmuebles((prev) => prev.filter((i) => i.id !== id));
    } catch (err) {
      console.error("Error eliminando inmueble:", err);
      alert("No se pudo eliminar el inmueble");
    } finally {
      setDeletingId(null);
    }
  };

  const toggleDestacado = async (inmueble) => {
    try {
      setTogglingId(inmueble.id);

      const nuevoValor = !inmueble.destacado;

      await updateInmueble(user.inmobiliariaId, inmueble.id, {
        destacado: nuevoValor,
      });

      setInmuebles((prev) =>
        prev.map((i) =>
          i.id === inmueble.id ? { ...i, destacado: nuevoValor } : i
        )
      );
    } catch (err) {
      console.error("Error toggle destacado:", err);
      alert("No se pudo actualizar el destacado");
    } finally {
      setTogglingId(null);
    }
  };

  /* =========================================================
     Render
     ========================================================= */

  if (loading) return <p>Cargando inmuebles...</p>;
  if (error) return <div className="error-box">{error}</div>;

  return (
    <section className="page-container">
      <header className="page-header">
        <h1>Inmuebles</h1>

        <button
          className="btn-primary"
          onClick={() => navigate("/inmuebles/nuevo")}
        >
          + Nuevo Inmueble
        </button>
      </header>

      {/* ================= Filtros ================= */}

      <InmuebleFilters filters={filters} onChange={setFilters} />

      {/* ================= Listado ================= */}

      {inmuebles.length === 0 ? (
        <p>No hay inmuebles cargados.</p>
      ) : (
        <>
          <div className="inmueble-list">
            {inmuebles.map((inmueble) => {
              const thumbnail = inmueble.images?.[0]?.url;

              return (
                <article key={inmueble.id} className="inmueble-card">
                  {/* 🖼️ Miniatura */}
                  <div className="inmueble-thumb">
                    {thumbnail ? (
                      <img
                        src={thumbnail}
                        alt={inmueble.titulo}
                        loading="lazy"
                      />
                    ) : (
                      <div className="thumb-placeholder">Sin imagen</div>
                    )}
                  </div>

                  <div className="inmueble-info">
                    <h3>
                      {inmueble.titulo}{" "}
                      {inmueble.destacado && (
                        <span className="badge-destacado">★</span>
                      )}
                    </h3>

                    <p className="muted">
                      {inmueble.direccion?.ciudad},{" "}
                      {inmueble.direccion?.provincia}
                    </p>

                    <p>
                      {inmueble.operacion} · {inmueble.tipo}
                    </p>

                    <strong>
                      {inmueble.precio
                        ? `$${Number(inmueble.precio).toLocaleString("es-AR")}`
                        : "Consultar"}
                    </strong>
                  </div>

                  <div className="inmueble-actions">
                    <button
                      className="btn-secondary"
                      onClick={() => handleEdit(inmueble.id)}
                    >
                      Editar
                    </button>

                    <button
                      className="btn-outline"
                      disabled={togglingId === inmueble.id}
                      onClick={() => toggleDestacado(inmueble)}
                    >
                      {inmueble.destacado ? "Quitar destacado" : "Destacar"}
                    </button>

                    <button
                      className="btn-danger"
                      disabled={deletingId === inmueble.id}
                      onClick={() => handleDelete(inmueble.id)}
                    >
                      {deletingId === inmueble.id
                        ? "Eliminando..."
                        : "Eliminar"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>

          {lastDoc && (
            <div className="load-more">
              <button
                className="btn-secondary"
                disabled={loadingMore}
                onClick={() => fetchInmuebles({ append: true })}
              >
                {loadingMore ? "Cargando..." : "Cargar más"}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
};

export default InmuebleListPage;
