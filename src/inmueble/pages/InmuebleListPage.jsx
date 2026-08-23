import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  AMENITIES_LABELS,
  getPublicationQuality,
} from "../utils/inmuebleDetailsSchema";

import {
  getAllInmueblesByInmobiliaria,
  deleteInmueble,
  updateInmueble,
  updateInmuebleSharing,
} from "../services/inmueble.service";

import { useAuth } from "../../context/auth/useAuth";
import InmuebleFilters from "../components/InmuebleFilters";
import InmuebleSharingQuickEdit from "../components/InmuebleSharingQuickEdit";
import { canDeleteInmueble, canEditInmueble } from "../helpers/permissions";
import {
  getAgencyFriendGroups,
  getInmobiliariaBranches,
} from "../../inmobiliaria/services/agencyNetwork.service";
import {
  buildAdminInmueblesCsv,
  filterAdminInmuebles,
  INMUEBLE_ADMIN_SORT_OPTIONS,
  normalizeInmuebleSharing,
  sortAdminInmuebles,
} from "../utils/inmuebleAdminList.helpers";


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

const formatAdminDate = (value) => {
  const date = typeof value?.toDate === "function"
    ? value.toDate()
    : value instanceof Date
      ? value
      : Number.isFinite(value?.seconds)
        ? new Date(value.seconds * 1000)
        : new Date(value || "");

  if (Number.isNaN(date.getTime())) return "Sin fecha";

  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
};

const getCaracteristicas = (inmueble = {}) => {
  return inmueble.caracteristicas && typeof inmueble.caracteristicas === "object"
    ? inmueble.caracteristicas
    : {};
};

const getSuperficie = (inmueble = {}) => {
  return inmueble.superficie && typeof inmueble.superficie === "object"
    ? inmueble.superficie
    : {};
};

const getAmenities = (inmueble = {}) => {
  return inmueble.amenities && typeof inmueble.amenities === "object"
    ? inmueble.amenities
    : {};
};

const getFeatureBadges = (inmueble = {}) => {
  const caracteristicas = getCaracteristicas(inmueble);
  const superficie = getSuperficie(inmueble);

  const dormitorios =
    caracteristicas.dormitorios || inmueble.dormitorios || "";

  const banos =
    caracteristicas.banos || inmueble.banos || inmueble.banios || "";

  const cocherasCantidad =
    caracteristicas.cocherasCantidad || inmueble.cocheras || "";

  const superficiePrincipal =
    superficie.cubierta ||
    superficie.total ||
    superficie.terreno ||
    "";

  const items = [];

  if (dormitorios) {
    items.push(`${dormitorios} dorm.`);
  }

  if (banos) {
    items.push(`${banos} baño${Number(banos) === 1 ? "" : "s"}`);
  }

  if (cocherasCantidad) {
    items.push(`${cocherasCantidad} coch.`);
  } else if (caracteristicas.cocheras) {
    items.push("Con cochera");
  }

  if (superficiePrincipal) {
    items.push(`${superficiePrincipal} m²`);
  }

  return items;
};

const getAmenityBadges = (inmueble = {}) => {
  const amenities = getAmenities(inmueble);

  return Object.entries(amenities)
    .filter(([, value]) => Boolean(value))
    .map(([key]) => AMENITIES_LABELS[key] || key)
    .slice(0, 5);
};

const getQualityBadgeClass = (status = "") => {
  const classes = {
    incompleta: "text-bg-danger",
    basica: "text-bg-warning",
    buena: "text-bg-info",
    destacada: "text-bg-success",
  };

  return classes[status] || "text-bg-secondary";
};

const getQualityLabel = (status = "") => {
  const labels = {
    incompleta: "Incompleta",
    basica: "Básica",
    buena: "Buena",
    destacada: "Destacada",
  };

  return labels[status] || "Sin evaluar";
};

const InmuebleListPage = () => {
  const navigate = useNavigate();
  const { user, activeInmobiliariaId } = useAuth();

  const [inmuebles, setInmuebles] = useState([]);
  const [branchesById, setBranchesById] = useState({});
  const [friendGroups, setFriendGroups] = useState([]);

  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [sortOption, setSortOption] = useState("created_desc");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [deletingId, setDeletingId] = useState(null);
  const [togglingDestacadoId, setTogglingDestacadoId] = useState(null);
  const [togglingPortalId, setTogglingPortalId] = useState(null);
  const [updatingSharingId, setUpdatingSharingId] = useState(null);

  const filteredAndSortedInmuebles = useMemo(() => sortAdminInmuebles(
    filterAdminInmuebles(inmuebles, filters),
    sortOption,
  ), [filters, inmuebles, sortOption]);

  const visibleInmuebles = useMemo(
    () => filteredAndSortedInmuebles.slice(0, visibleCount),
    [filteredAndSortedInmuebles, visibleCount],
  );

  const friendGroupsById = useMemo(
    () => Object.fromEntries(friendGroups.map((group) => [group.id, group])),
    [friendGroups],
  );

  const hasMore = visibleCount < filteredAndSortedInmuebles.length;

  /* =========================================================
     Fetch inmuebles
     ========================================================= */

  const fetchInmuebles = useCallback(
    async () => {
      if (!user?.uid) {
        setInmuebles([]);
        setLoading(false);
        return;
      }

      if (!activeInmobiliariaId) {
        setInmuebles([]);
        setLoading(false);
        setError("No hay inmobiliaria activa seleccionada");
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const data = await getAllInmueblesByInmobiliaria(activeInmobiliariaId);
        setInmuebles(data);
        setVisibleCount(PAGE_SIZE);
      } catch (err) {
        console.error("Error cargando inmuebles:", err);
        setError(err.message || "Error al cargar los inmuebles");
      } finally {
        setLoading(false);
      }
    },
    [user?.uid, activeInmobiliariaId],
  );

  /* =========================================================
     Re-fetch al cambiar filtros / inmobiliaria activa
     ========================================================= */

  useEffect(() => {
    fetchInmuebles();
  }, [fetchInmuebles]);

  useEffect(() => {
    if (!activeInmobiliariaId) return;
    Promise.all([
      getInmobiliariaBranches(activeInmobiliariaId),
      getAgencyFriendGroups(activeInmobiliariaId),
    ]).then(([branches, groups]) => {
      setBranchesById(Object.fromEntries(
        branches.map((item) => [item.id, item]),
      ));
      setFriendGroups(groups);
    }).catch(() => {
      setBranchesById({});
      setFriendGroups([]);
    });
  }, [activeInmobiliariaId]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [filters, sortOption]);

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

  const handleDistribution = (id) => {
    navigate(`/admin/inmuebles/${id}/difusion`);
  };

  const handleDuplicate = (id) => {
    const params = new URLSearchParams();
    params.set("duplicarId", id);

    if (activeInmobiliariaId) {
      params.set("inmobiliariaId", activeInmobiliariaId);
    }

    navigate(`/admin/inmuebles/nuevo?${params.toString()}`);
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

  const handleSharingChange = async (inmueble, nextSharing) => {
    if (!activeInmobiliariaId) {
      alert("No hay inmobiliaria activa seleccionada");
      return;
    }

    try {
      setUpdatingSharingId(inmueble.id);
      const sharing = await updateInmuebleSharing(
        activeInmobiliariaId,
        inmueble.id,
        nextSharing,
      );

      setInmuebles((prev) => prev.map((item) => (
        item.id === inmueble.id
          ? { ...item, sharing, updatedAt: new Date() }
          : item
      )));
    } catch (err) {
      console.error("Error actualizando compartición:", err);
      alert(err.message || "No se pudo actualizar la compartición del inmueble");
    } finally {
      setUpdatingSharingId(null);
    }
  };

  const handleResetFilters = () => {
    setFilters(INITIAL_FILTERS);
    setVisibleCount(PAGE_SIZE);
  };

  const handleLoadMore = () => {
    setVisibleCount((current) => current + PAGE_SIZE);
  };

  const handleExport = () => {
    if (filteredAndSortedInmuebles.length === 0) return;

    const csv = buildAdminInmueblesCsv(filteredAndSortedInmuebles, {
      branchesById,
      friendGroupsById,
      publicOrigin: window.location.origin,
    });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);

    link.href = url;
    link.download = `inmuebles-${date}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
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
          onClick={fetchInmuebles}
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

        <div className="d-flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-outline-success"
            onClick={() => navigate("/admin/inmuebles/leads/mercadolibre")}
            disabled={!activeInmobiliariaId}
          >
            Leads de Mercado Libre
          </button>

          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={handleExport}
            disabled={filteredAndSortedInmuebles.length === 0}
          >
            Exportar CSV
          </button>

          <button
            type="button"
            className="btn btn-outline-primary"
            onClick={() => navigate("/admin/inmuebles/importar")}
            disabled={!activeInmobiliariaId}
          >
            Importar CSV
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={() => navigate("/admin/inmuebles/nuevo")}
            disabled={!activeInmobiliariaId}
          >
            + Nuevo inmueble
          </button>
        </div>

      </header>

      <section className="card border-0 shadow-sm mb-4">
        <div className="card-body p-4">
          <InmuebleFilters
            filters={filters}
            onChange={setFilters}
            onReset={handleResetFilters}
            loading={loading}
          />

          <div className="row g-3 align-items-end border-top pt-3">
            <div className="col-12 col-md-6 col-lg-4">
              <label className="form-label" htmlFor="inmuebleSortOption">
                Ordenar listado
              </label>
              <select
                id="inmuebleSortOption"
                className="form-select"
                value={sortOption}
                onChange={(event) => setSortOption(event.target.value)}
              >
                {INMUEBLE_ADMIN_SORT_OPTIONS.map((option) => (
                  <option value={option.value} key={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-12 col-md-6 col-lg-8 d-flex flex-wrap align-items-center justify-content-md-end gap-2">
              <span className="text-muted small">
                {filteredAndSortedInmuebles.length} resultado
                {filteredAndSortedInmuebles.length === 1 ? "" : "s"}
                {inmuebles.length !== filteredAndSortedInmuebles.length
                  ? ` de ${inmuebles.length}`
                  : ""}
              </span>
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={handleExport}
                disabled={filteredAndSortedInmuebles.length === 0}
              >
                Exportar resultados
              </button>
            </div>
          </div>
        </div>
      </section>

      {filteredAndSortedInmuebles.length === 0 ? (
        <section className="card border-0 shadow-sm">
          <div className="card-body p-5 text-center">
            <div className="display-6 mb-3">🏠</div>

            <h2 className="h5">
              {inmuebles.length === 0
                ? "No hay inmuebles cargados"
                : "No hay inmuebles que coincidan con los filtros"}
            </h2>

            <p className="text-muted mb-4">
              {inmuebles.length === 0
                ? "Creá tu primera publicación para comenzar a mostrar propiedades en el portal."
                : "Modificá o limpiá los filtros para volver a ver el inventario."}
            </p>

            {inmuebles.length === 0 ? (
              <>
                <button
                  type="button"
                  className="btn btn-outline-primary me-2"
                  onClick={() => navigate("/admin/inmuebles/importar")}
                  disabled={!activeInmobiliariaId}
                >
                  Importar CSV
                </button>

                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => navigate("/admin/inmuebles/nuevo")}
                  disabled={!activeInmobiliariaId}
                >
                  + Nuevo inmueble
                </button>
              </>
            ) : (
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={handleResetFilters}
              >
                Limpiar filtros
              </button>
            )}
          </div>
        </section>
      ) : (
        <>
          <section className="vstack gap-3">
            {visibleInmuebles.map((inmueble) => {
              const coverImage = getCoverImage(inmueble);
              const publicUrl = buildPublicUrl(inmueble.slug);
              const isPublicado = inmueble.publicarEnPortal === true;
              const isActivo = inmueble.estado === "activo";
              const updatingPortal = togglingPortalId === inmueble.id;
              const updatingDestacado = togglingDestacadoId === inmueble.id;
              const updatingSharing = updatingSharingId === inmueble.id;
              const deleting = deletingId === inmueble.id;
              const canEditThis = canEditInmueble(user, inmueble);
              const canDeleteThis = canDeleteInmueble(user, inmueble);

              const featureBadges = getFeatureBadges(inmueble);
              const amenityBadges = getAmenityBadges(inmueble);
              const publicationQuality = getPublicationQuality(inmueble);
              const sharing = normalizeInmuebleSharing(inmueble.sharing || {});
              const sharedGroupNames = sharing.friendGroupIds.map(
                (groupId) => friendGroupsById[groupId]?.name || groupId,
              );

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

                          <span className={`badge ${getQualityBadgeClass(publicationQuality.status)}`}>
                            Calidad: {getQualityLabel(publicationQuality.status)} ·{" "}
                            {publicationQuality.score}/100
                          </span>

                          {inmueble.destacado && (
                            <span className="badge text-bg-warning">
                              ★ Destacado
                            </span>
                          )}

                          {inmueble.emprendimientoId && (
                            <span className="badge text-bg-info">
                              🏗️ {inmueble.emprendimientoNombre || "Unidad de emprendimiento"}
                            </span>
                          )}

                          {inmueble.sucursalId && (
                            <span className="badge text-bg-light border text-dark">
                              Sucursal: {branchesById[inmueble.sucursalId]?.name || inmueble.sucursalId}
                            </span>
                          )}

                          {sharing.shareWithOnopropNetwork && (
                            <span className="badge text-bg-success">
                              Compartido con red ONO Prop
                            </span>
                          )}

                          {sharedGroupNames.length > 0 && (
                            <span className="badge text-bg-info">
                              Amigas: {sharedGroupNames.join(", ")}
                            </span>
                          )}

                          {!sharing.enabled && (
                            <span className="badge text-bg-light border text-dark">
                              No compartido
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

                        {featureBadges.length > 0 && (
                          <div className="d-flex flex-wrap gap-2 mb-3">
                            {featureBadges.map((item) => (
                              <span className="badge text-bg-light border text-dark" key={item}>
                                {item}
                              </span>
                            ))}
                          </div>
                        )}

                        {amenityBadges.length > 0 && (
                          <div className="d-flex flex-wrap gap-2 mb-3">
                            {amenityBadges.map((item) => (
                              <span className="badge text-bg-secondary" key={item}>
                                {item}
                              </span>
                            ))}
                          </div>
                        )}

                        {publicationQuality.missingFields.length > 0 && (
                          <div className="alert alert-warning small py-2 mb-3">
                            <strong>Mejorar publicación:</strong>{" "}
                            faltan {publicationQuality.missingFields.join(", ")}.
                          </div>
                        )}

                        <InmuebleSharingQuickEdit
                          inmueble={inmueble}
                          friendGroups={friendGroups}
                          disabled={!canEditThis}
                          saving={updatingSharing}
                          onChange={(nextSharing) => handleSharingChange(
                            inmueble,
                            nextSharing,
                          )}
                        />

                        {inmueble.slug && (
                          <p className="small text-muted mt-3 mb-1">
                            <strong>Slug:</strong> {inmueble.slug}
                          </p>
                        )}

                        <p className="small text-muted mb-0">
                          <strong>Carga:</strong> {formatAdminDate(inmueble.createdAt)}
                          {" · "}
                          <strong>Última modificación:</strong>{" "}
                          {formatAdminDate(inmueble.updatedAt)}
                        </p>
                      </div>
                    </div>

                    <div className="col-md-3 col-lg-3 border-start bg-light">
                      <div className="card-body p-3 h-100 d-flex flex-column gap-2">
                        <button
                          type="button"
                          className="btn btn-primary btn-sm w-100"
                          onClick={() => handleEdit(inmueble.id)}
                          disabled={!canEditThis}
                        >
                          Editar
                        </button>

                        <button
                          type="button"
                          className="btn btn-outline-primary btn-sm w-100"
                          onClick={() => handleDuplicate(inmueble.id)}
                          disabled={!canEditThis}
                        >
                          Duplicar como borrador
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
                          disabled={!canEditThis}
                        >
                          Marketing
                        </button>

                        <button
                          type="button"
                          className="btn btn-outline-primary btn-sm w-100"
                          onClick={() => handleDistribution(inmueble.id)}
                          disabled={!canEditThis}
                        >
                          Difusión
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
                          disabled={updatingPortal || !canEditThis}
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
                          disabled={updatingDestacado || !canEditThis}
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
                            disabled={deleting || !canDeleteThis}
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

          {hasMore && (
            <div className="text-center mt-4">
              <button
                type="button"
                className="btn btn-outline-primary"
                onClick={handleLoadMore}
              >
                Cargar {Math.min(
                  PAGE_SIZE,
                  filteredAndSortedInmuebles.length - visibleCount,
                )} más
              </button>
            </div>
          )}
        </>
      )}
    </main>
  );
};

export default InmuebleListPage;
