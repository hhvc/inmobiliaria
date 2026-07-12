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

const getLocationLabel = (inmueble) => {
  const ciudad = inmueble?.direccion?.ciudad || inmueble?.ciudad || "";
  const barrio = inmueble?.direccion?.barrio || inmueble?.barrio || "";

  if (ciudad && barrio) return `${ciudad} · ${barrio}`;
  if (ciudad) return ciudad;
  if (barrio) return barrio;

  return "Sin ubicación cargada";
};

const getOperationTypeLabel = (inmueble) => {
  const operacion = inmueble?.operacion || "Sin operación";
  const tipo = inmueble?.tipo || "Sin tipo";

  return `${operacion} · ${tipo}`;
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

  const handlePreview = (id) => {
    navigate(`/admin/inmuebles/${id}/preview`);
  };

  const handleMarketing = (id) => {
    navigate(`/admin/inmuebles/${id}/marketing`);
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

  if (loading) {
    return (
      <main className="container py-5 text-center">
        <div className="spinner-border" />
        <p className="text-muted mt-3">Cargando inmuebles...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="container py-5">
        <div className="alert alert-danger">{error}</div>

        <button
          type="button"
          className="btn btn-outline-primary"
          onClick={() => fetchInmuebles({ append: false, cursor: null })}
        >
          Reintentar
        </button>
      </main>
    );
  }

  return (
    <main className="container py-4">
      <header className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
        <div>
          <p className="text-uppercase text-muted small mb-1">
            Panel de inmuebles
          </p>

          <h1 className="h3 mb-1">Inmuebles</h1>

          <p className="text-muted mb-0">
            Administración de publicaciones de la inmobiliaria activa.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={() => navigate("/admin/inmuebles/nuevo")}
          disabled={!activeInmobiliariaId}
        >
          + Nuevo inmueble
        </button>
      </header>

      <section className="card border-0 shadow-sm mb-4">
        <div className="card-body p-4">
          <InmuebleFilters
            filters={filters}
            onChange={setFilters}
            onReset={handleResetFilters}
            loading={loading || loadingMore}
          />
        </div>
      </section>

      {inmuebles.length === 0 ? (
        <section className="card border-0 shadow-sm">
          <div className="card-body p-5 text-center">
            <div className="display-6 mb-3">🏠</div>

            <h2 className="h5">No hay inmuebles cargados</h2>

            <p className="text-muted mb-4">
              Creá tu primera publicación para comenzar a mostrar propiedades en
              el portal.
            </p>

            <button
              type="button"
              className="btn btn-primary"
              onClick={() => navigate("/admin/inmuebles/nuevo")}
              disabled={!activeInmobiliariaId}
            >
              + Nuevo inmueble
            </button>
          </div>
        </section>
      ) : (
        <>
          <section className="vstack gap-3">
            {inmuebles.map((inmueble) => {
              const coverImage = getCoverImage(inmueble);
              const publicUrl = buildPublicUrl(inmueble.slug);
              const isPublicado = inmueble.publicarEnPortal === true;
              const isActivo = inmueble.estado === "activo";
              const updatingPortal = togglingPortalId === inmueble.id;
              const updatingDestacado = togglingDestacadoId === inmueble.id;
              const deleting = deletingId === inmueble.id;

              return (
                <article
                  key={inmueble.id}
                  className="card border-0 shadow-sm overflow-hidden"
                >
                  <div className="row g-0">
                    <div className="col-md-3 col-lg-2">
                      {coverImage ? (
                        <img
                          src={coverImage.url}
                          alt={inmueble.titulo || "Inmueble"}
                          loading="lazy"
                          className="w-100 h-100"
                          style={{
                            minHeight: 190,
                            objectFit: "cover",
                          }}
                        />
                      ) : (
                        <div
                          className="bg-light text-muted d-flex align-items-center justify-content-center h-100"
                          style={{ minHeight: 190 }}
                        >
                          Sin imagen
                        </div>
                      )}
                    </div>

                    <div className="col-md-6 col-lg-7">
                      <div className="card-body p-4">
                        <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
                          <span
                            className={`badge ${isActivo ? "text-bg-success" : "text-bg-secondary"
                              }`}
                          >
                            {inmueble.estado || "sin estado"}
                          </span>

                          <span
                            className={`badge ${isPublicado
                              ? "text-bg-primary"
                              : "text-bg-light border text-dark"
                              }`}
                          >
                            {isPublicado ? "Publicado en portal" : "No publicado"}
                          </span>

                          {inmueble.destacado && (
                            <span className="badge text-bg-warning">
                              ★ Destacado
                            </span>
                          )}
                        </div>

                        <h2 className="h5 mb-2">
                          {inmueble.titulo || "Inmueble sin título"}
                        </h2>

                        <p className="text-muted mb-2">
                          {getLocationLabel(inmueble)}
                        </p>

                        <p className="mb-2">{getOperationTypeLabel(inmueble)}</p>

                        <div className="h5 mb-3">{formatPrice(inmueble)}</div>

                        {inmueble.slug && (
                          <p className="small text-muted mb-0">
                            <strong>Slug:</strong> {inmueble.slug}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="col-md-3 col-lg-3 border-start bg-light">
                      <div className="card-body p-3 h-100 d-flex flex-column gap-2">
                        <button
                          type="button"
                          className="btn btn-primary btn-sm w-100"
                          onClick={() => handleEdit(inmueble.id)}
                        >
                          Editar
                        </button>

                        <button
                          type="button"
                          className="btn btn-outline-secondary btn-sm w-100"
                          onClick={() => handlePreview(inmueble.id)}
                        >
                          Vista previa
                        </button>

                        <button
                          type="button"
                          className="btn btn-outline-success btn-sm w-100"
                          onClick={() => handleMarketing(inmueble.id)}
                        >
                          Marketing
                        </button>

                        {isPublicado && publicUrl && (
                          <a
                            href={publicUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-outline-primary btn-sm w-100"
                          >
                            Ver publicación
                          </a>
                        )}

                        <hr className="my-2" />

                        <button
                          type="button"
                          className={`btn btn-sm w-100 ${isPublicado
                            ? "btn-outline-warning"
                            : "btn-outline-primary"
                            }`}
                          disabled={updatingPortal}
                          onClick={() => togglePublicarEnPortal(inmueble)}
                        >
                          {updatingPortal
                            ? "Actualizando..."
                            : isPublicado
                              ? "Despublicar"
                              : "Publicar"}
                        </button>

                        <button
                          type="button"
                          className="btn btn-outline-warning btn-sm w-100"
                          disabled={updatingDestacado}
                          onClick={() => toggleDestacado(inmueble)}
                        >
                          {updatingDestacado
                            ? "Actualizando..."
                            : inmueble.destacado
                              ? "Quitar destacado"
                              : "Destacar"}
                        </button>

                        <div className="mt-auto">
                          <button
                            type="button"
                            className="btn btn-outline-danger btn-sm w-100"
                            disabled={deleting}
                            onClick={() => handleDelete(inmueble.id)}
                          >
                            {deleting ? "Eliminando..." : "Eliminar"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </section>

          {lastDoc && (
            <div className="text-center mt-4">
              <button
                type="button"
                className="btn btn-outline-primary"
                disabled={loadingMore}
                onClick={handleLoadMore}
              >
                {loadingMore ? "Cargando..." : "Cargar más"}
              </button>
            </div>
          )}
        </>
      )}
    </main>
  );
};

export default InmuebleListPage;