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

const INITIAL_FILTERS = {
  search: "",
  estado: "",
  tipo: "",
  operacion: "",
  destacado: false,
};

const getCoverImage = (inmueble) => {
  if (!Array.isArray(inmueble?.images)) return null;

  return [...inmueble.images]
    .filter((img) => img?.url)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))[0];
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

const buildPublicUrl = (slug) => {
  if (!slug) return null;
  return `/inmueble/${slug}`;
};

const InmuebleListPage = () => {
  const navigate = useNavigate();
  const { user, activeInmobiliariaId } = useAuth();

  const [inmuebles, setInmuebles] = useState([]);
  const [lastDoc, setLastDoc] = useState(null);

  const [filters, setFilters] = useState(INITIAL_FILTERS);

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);

  const [deletingId, setDeletingId] = useState(null);
  const [togglingDestacadoId, setTogglingDestacadoId] = useState(null);
  const [togglingPortalId, setTogglingPortalId] = useState(null);

  /* =========================================================
     Fetch inmuebles
     ========================================================= */

  const fetchInmuebles = useCallback(
    async ({ append = false, cursor = null } = {}) => {
      if (!user?.uid) {
        setInmuebles([]);
        setLastDoc(null);
        setLoading(false);
        return;
      }

      if (!activeInmobiliariaId) {
        setInmuebles([]);
        setLastDoc(null);
        setLoading(false);
        setError("No hay inmobiliaria activa seleccionada");
        return;
      }

      try {
        append ? setLoadingMore(true) : setLoading(true);
        setError(null);

        const result = await getInmueblesByInmobiliaria(activeInmobiliariaId, {
          ...filters,
          pageSize: PAGE_SIZE,
          lastDoc: append ? cursor : null,
        });

        const data = Array.isArray(result) ? result : result?.data || [];
        const newLastDoc = Array.isArray(result)
          ? null
          : result?.lastDoc || null;

        setInmuebles((prev) => (append ? [...prev, ...data] : data));
        setLastDoc(newLastDoc);
      } catch (err) {
        console.error("Error cargando inmuebles:", err);
        setError(err.message || "Error al cargar los inmuebles");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [user?.uid, activeInmobiliariaId, filters],
  );

  /* =========================================================
     Re-fetch al cambiar filtros / inmobiliaria activa
     ========================================================= */

  useEffect(() => {
    setLastDoc(null);
    fetchInmuebles({ append: false, cursor: null });
  }, [fetchInmuebles]);

  /* =========================================================
     Acciones
     ========================================================= */

  const handleEdit = (id) => {
    navigate(`/admin/inmuebles/${id}/editar`);
  };

  const handleDelete = async (id) => {
    if (!activeInmobiliariaId) {
      alert("No hay inmobiliaria activa seleccionada");
      return;
    }

    if (!window.confirm("¿Eliminar este inmueble?")) return;

    try {
      setDeletingId(id);

      await deleteInmueble(activeInmobiliariaId, id);

      setInmuebles((prev) => prev.filter((i) => i.id !== id));
    } catch (err) {
      console.error("Error eliminando inmueble:", err);
      alert(err.message || "No se pudo eliminar el inmueble");
    } finally {
      setDeletingId(null);
    }
  };

  const toggleDestacado = async (inmueble) => {
    if (!activeInmobiliariaId) {
      alert("No hay inmobiliaria activa seleccionada");
      return;
    }

    try {
      setTogglingDestacadoId(inmueble.id);

      const nuevoValor = !inmueble.destacado;

      const updatedPayload = {
        ...inmueble,
        destacado: nuevoValor,
      };

      await updateInmueble(activeInmobiliariaId, inmueble.id, updatedPayload);

      setInmuebles((prev) =>
        prev.map((i) =>
          i.id === inmueble.id ? { ...i, destacado: nuevoValor } : i,
        ),
      );
    } catch (err) {
      console.error("Error toggle destacado:", err);
      alert(err.message || "No se pudo actualizar el destacado");
    } finally {
      setTogglingDestacadoId(null);
    }
  };

  const togglePublicarEnPortal = async (inmueble) => {
    if (!activeInmobiliariaId) {
      alert("No hay inmobiliaria activa seleccionada");
      return;
    }

    try {
      setTogglingPortalId(inmueble.id);

      const nuevoValor = !inmueble.publicarEnPortal;

      const updatedPayload = {
        ...inmueble,
        publicarEnPortal: nuevoValor,
      };

      await updateInmueble(activeInmobiliariaId, inmueble.id, updatedPayload);

      setInmuebles((prev) =>
        prev.map((i) =>
          i.id === inmueble.id
            ? { ...i, publicarEnPortal: nuevoValor }
            : i,
        ),
      );
    } catch (err) {
      console.error("Error toggle publicar en portal:", err);
      alert(err.message || "No se pudo actualizar la publicación en portal");
    } finally {
      setTogglingPortalId(null);
    }
  };

  const handleResetFilters = () => {
    setFilters(INITIAL_FILTERS);
    setLastDoc(null);
  };

  const handleLoadMore = () => {
    fetchInmuebles({
      append: true,
      cursor: lastDoc,
    });
  };

  /* =========================================================
     Render
     ========================================================= */

  if (loading) return <p>Cargando inmuebles...</p>;

  if (error) {
    return (
      <section className="page-container">
        <div className="error-box">{error}</div>
      </section>
    );
  }

  return (
    <section className="page-container">
      <header className="page-header">
        <div>
          <h1>Inmuebles</h1>
          <p className="text-muted mb-0">
            Administración de inmuebles de la inmobiliaria activa
          </p>
        </div>

        <button
          type="button"
          className="btn-primary"
          onClick={() => navigate("/admin/inmuebles/nuevo")}
          disabled={!activeInmobiliariaId}
        >
          + Nuevo Inmueble
        </button>
      </header>

      {/* ================= Filtros ================= */}

      <InmuebleFilters
        filters={filters}
        onChange={setFilters}
        onReset={handleResetFilters}
        loading={loading || loadingMore}
      />

      {/* ================= Listado ================= */}

      {inmuebles.length === 0 ? (
        <p>No hay inmuebles cargados.</p>
      ) : (
        <>
          <div className="inmueble-list">
            {inmuebles.map((inmueble) => {
              const coverImage = getCoverImage(inmueble);
              const publicUrl = buildPublicUrl(inmueble.slug);
              const isPublicado = inmueble.publicarEnPortal === true;

              return (
                <article key={inmueble.id} className="inmueble-card">
                  {/* 🖼️ Miniatura */}
                  <div className="inmueble-thumb">
                    {coverImage ? (
                      <img
                        src={coverImage.url}
                        alt={inmueble.titulo || "Inmueble"}
                        loading="lazy"
                      />
                    ) : (
                      <div className="thumb-placeholder">Sin imagen</div>
                    )}
                  </div>

                  <div className="inmueble-info">
                    <h3>
                      {inmueble.titulo || "Inmueble sin título"}{" "}
                      {inmueble.destacado && (
                        <span className="badge-destacado">★</span>
                      )}
                    </h3>

                    <p className="muted">
                      {inmueble.direccion?.ciudad || "Sin ciudad"}
                      {inmueble.direccion?.barrio
                        ? ` · ${inmueble.direccion.barrio}`
                        : ""}
                    </p>

                    <p>
                      {inmueble.operacion || "Sin operación"} ·{" "}
                      {inmueble.tipo || "Sin tipo"}
                    </p>

                    <strong>{formatPrice(inmueble)}</strong>

                    <div className="mt-2 d-flex flex-wrap gap-2">
                      <span
                        className={
                          inmueble.estado === "activo"
                            ? "badge bg-success"
                            : "badge bg-secondary"
                        }
                      >
                        Estado: {inmueble.estado || "sin estado"}
                      </span>

                      <span
                        className={
                          isPublicado ? "badge bg-primary" : "badge bg-light text-dark"
                        }
                      >
                        Portal: {isPublicado ? "Publicado" : "No publicado"}
                      </span>

                      {inmueble.destacado && (
                        <span className="badge bg-warning text-dark">
                          Destacado
                        </span>
                      )}
                    </div>

                    {inmueble.slug && (
                      <p className="small text-muted mt-2 mb-0">
                        <strong>Slug:</strong> {inmueble.slug}
                      </p>
                    )}
                  </div>

                  <div className="inmueble-actions">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => handleEdit(inmueble.id)}
                    >
                      Editar
                    </button>

                    <button
                      type="button"
                      className="btn-outline"
                      onClick={() => navigate(`/admin/inmuebles/${inmueble.id}/preview`)}
                    >
                      Vista previa
                    </button>

                    {isPublicado && publicUrl && (
                      <a
                        href={publicUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-outline"
                      >
                        Ver publicación
                      </a>
                    )}

                    <button
                      type="button"
                      className="btn-outline"
                      disabled={togglingPortalId === inmueble.id}
                      onClick={() => togglePublicarEnPortal(inmueble)}
                    >
                      {togglingPortalId === inmueble.id
                        ? "Actualizando..."
                        : isPublicado
                          ? "Despublicar"
                          : "Publicar"}
                    </button>

                    <button
                      type="button"
                      className="btn-outline"
                      disabled={togglingDestacadoId === inmueble.id}
                      onClick={() => toggleDestacado(inmueble)}
                    >
                      {togglingDestacadoId === inmueble.id
                        ? "Actualizando..."
                        : inmueble.destacado
                          ? "Quitar destacado"
                          : "Destacar"}
                    </button>

                    <button
                      type="button"
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
                type="button"
                className="btn-secondary"
                disabled={loadingMore}
                onClick={handleLoadMore}
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