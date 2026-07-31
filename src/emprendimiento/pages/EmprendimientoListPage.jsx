import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import SEO from "../../components/SEO";
import { useAuth } from "../../context/auth/useAuth";
import {
  deleteEmprendimiento,
  getEmprendimientosByInmobiliaria,
  updateEmprendimiento,
} from "../services/emprendimiento.service";
import {
  getEmprendimientoStatusLabel,
  getEmprendimientoTypeLabel,
} from "../utils/emprendimientoSchema";

const EmprendimientoListPage = () => {
  const { activeInmobiliariaId } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!activeInmobiliariaId) {
      setItems([]);
      setLoading(false);
      setError("No hay una inmobiliaria activa seleccionada.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setItems(
        await getEmprendimientosByInmobiliaria(activeInmobiliariaId, { search }),
      );
    } catch (loadError) {
      setError(loadError.message || "No se pudieron cargar los emprendimientos");
    } finally {
      setLoading(false);
    }
  }, [activeInmobiliariaId, search]);

  useEffect(() => {
    load();
  }, [load]);

  const togglePortal = async (item) => {
    try {
      setWorkingId(item.id);
      await updateEmprendimiento(activeInmobiliariaId, item.id, {
        ...item,
        publicarEnPortal: !item.publicarEnPortal,
      });
      await load();
    } catch (actionError) {
      window.alert(actionError.message || "No se pudo actualizar");
    } finally {
      setWorkingId("");
    }
  };

  const remove = async (item) => {
    if (!window.confirm(`¿Enviar “${item.nombre}” a la papelera?`)) return;

    try {
      setWorkingId(item.id);
      await deleteEmprendimiento(activeInmobiliariaId, item.id);
      setItems((current) => current.filter((entry) => entry.id !== item.id));
    } catch (actionError) {
      window.alert(actionError.message || "No se pudo eliminar");
    } finally {
      setWorkingId("");
    }
  };

  return (
    <main className="container py-4">
      <SEO title="Administrar emprendimientos | ONO Prop" noIndex />

      <header className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
        <div>
          <p className="text-uppercase text-muted small mb-1">Panel inmobiliario</p>
          <h1 className="h3 mb-1">Emprendimientos</h1>
          <p className="text-muted mb-0">Edificios, loteos y desarrollos con sus unidades vinculadas.</p>
        </div>
        <div className="d-flex gap-2">
          <Link className="btn btn-outline-secondary" to="/admin/inmobiliaria">Panel</Link>
          <Link className="btn btn-primary" to="/admin/emprendimientos/nuevo">+ Nuevo emprendimiento</Link>
        </div>
      </header>

      <section className="card border-0 shadow-sm mb-4">
        <div className="card-body">
          <label className="form-label" htmlFor="searchEmprendimientos">Buscar</label>
          <input id="searchEmprendimientos" type="search" className="form-control" placeholder="Nombre, desarrollista, ciudad..." value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
      </section>

      {error && <div className="alert alert-danger">{error}</div>}
      {loading && <div className="text-center py-5">Cargando...</div>}

      {!loading && !error && items.length === 0 && (
        <section className="card border-0 shadow-sm">
          <div className="card-body p-5 text-center">
            <div className="display-5 mb-3">🏗️</div>
            <h2 className="h5">Todavía no hay emprendimientos</h2>
            <p className="text-muted">Creá el proyecto y después vinculá sus departamentos, lotes o locales.</p>
            <Link className="btn btn-primary" to="/admin/emprendimientos/nuevo">Crear el primero</Link>
          </div>
        </section>
      )}

      <div className="vstack gap-3">
        {items.map((item) => {
          const cover = [...(item.images || [])].sort((a, b) => (a.order || 0) - (b.order || 0))[0];
          const busy = workingId === item.id;

          return (
            <article className="card border-0 shadow-sm overflow-hidden" key={item.id}>
              <div className="row g-0">
                <div className="col-md-3">
                  {cover?.url ? (
                    <img src={cover.url} alt={item.nombre} className="w-100 h-100" style={{ minHeight: 210, objectFit: "cover" }} />
                  ) : (
                    <div className="bg-light text-muted h-100 d-flex align-items-center justify-content-center" style={{ minHeight: 210 }}>Sin imagen</div>
                  )}
                </div>
                <div className="col-md-6">
                  <div className="card-body p-4">
                    <div className="d-flex flex-wrap gap-2 mb-2">
                      <span className="badge text-bg-primary">{getEmprendimientoTypeLabel(item.tipo)}</span>
                      <span className="badge text-bg-info">{getEmprendimientoStatusLabel(item.estadoObra)}</span>
                      <span className={`badge ${item.publicarEnPortal ? "text-bg-success" : "text-bg-light border text-dark"}`}>
                        {item.publicarEnPortal ? "Publicado" : "No publicado"}
                      </span>
                      {item.destacado && <span className="badge text-bg-warning">★ Destacado</span>}
                    </div>
                    <h2 className="h5">{item.nombre}</h2>
                    <p className="text-muted mb-2">{[item.direccion?.barrio, item.direccion?.ciudad].filter(Boolean).join(" · ") || "Sin ubicación"}</p>
                    {item.desarrollista && <p className="mb-2"><strong>Desarrollista:</strong> {item.desarrollista}</p>}
                    <div className="progress" role="progressbar" aria-label="Avance de obra" aria-valuenow={item.avanceObra || 0} aria-valuemin="0" aria-valuemax="100">
                      <div className="progress-bar" style={{ width: `${item.avanceObra || 0}%` }}>{item.avanceObra || 0}%</div>
                    </div>
                  </div>
                </div>
                <div className="col-md-3 bg-light border-start">
                  <div className="card-body d-grid gap-2">
                    <button className="btn btn-primary btn-sm" type="button" onClick={() => navigate(`/admin/emprendimientos/${item.id}/editar`)}>Editar</button>
                    <button className="btn btn-outline-primary btn-sm" type="button" onClick={() => navigate(`/admin/emprendimientos/${item.id}/unidades`)}>Matriz de unidades</button>
                    <button
                      className="btn btn-outline-success btn-sm"
                      type="button"
                      onClick={() => {
                        const params = new URLSearchParams({
                          emprendimientoId: item.id,
                          emprendimientoNombre: item.nombre || "",
                          emprendimientoSlug: item.slug || "",
                        });
                        navigate(`/admin/inmuebles/nuevo?${params.toString()}`);
                      }}
                    >
                      + Crear unidad
                    </button>
                    {item.publicarEnPortal && item.slug && <Link className="btn btn-outline-secondary btn-sm" target="_blank" to={`/emprendimiento/${item.slug}`}>Ver ficha pública</Link>}
                    <button className="btn btn-outline-primary btn-sm" type="button" disabled={busy} onClick={() => togglePortal(item)}>{item.publicarEnPortal ? "Quitar del portal" : "Publicar en portal"}</button>
                    <button className="btn btn-outline-danger btn-sm" type="button" disabled={busy} onClick={() => remove(item)}>Eliminar</button>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </main>
  );
};

export default EmprendimientoListPage;
