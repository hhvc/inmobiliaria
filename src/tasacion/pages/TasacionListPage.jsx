import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import SEO from "../../components/SEO";
import { useActiveInmobiliariaModules } from "../../inmobiliaria/hooks/useActiveInmobiliariaModules";
import {
  duplicateTasacion,
  getTasacionesByInmobiliaria,
  softDeleteTasacion,
} from "../services/tasacion.service";
import {
  getTasacionEstado,
  TASACION_TIPOS_INFORME,
} from "../utils/tasacion.constants";
import { formatTasacionMoney, getTasacionProgress } from "../utils/tasacion.helpers";
import {
  canEditTasacion,
  getTasacionVersionLabel,
} from "../utils/tasacionWorkflow.helpers";
import "../tasacion.css";

const formatDate = (value) => {
  if (!value) return "Sin fecha";
  const date = value?.toDate ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? "Sin fecha" : date.toLocaleDateString("es-AR");
};

const daysSince = (value) => {
  if (!value) return null;
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return Math.floor((Date.now() - date.getTime()) / 86400000);
};

const TasacionListPage = () => {
  const navigate = useNavigate();
  const { activeInmobiliariaId, activeInmobiliaria, loading: agencyLoading } =
    useActiveInmobiliariaModules();
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [reportType, setReportType] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
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
      setItems(await getTasacionesByInmobiliaria(activeInmobiliariaId));
    } catch (loadError) {
      setError(loadError.message || "No se pudieron cargar las tasaciones.");
    } finally {
      setLoading(false);
    }
  }, [activeInmobiliariaId]);

  useEffect(() => {
    load();
  }, [load]);

  const visibleItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter((item) => {
      if (status && item.estado !== status) return false;
      if (reportType && item.scope?.reportType !== reportType) return false;
      const valuationDate = item.scope?.valuationDate || "";
      if (dateFrom && valuationDate && valuationDate < dateFrom) return false;
      if (dateTo && valuationDate && valuationDate > dateTo) return false;
      if (!term) return true;
      const haystack = [
        item.scope?.clientName,
        item.scope?.ownerName,
        item.inspection?.address?.street,
        item.inspection?.address?.city,
        item.subject?.typology,
        item.scope?.appraiser?.name,
        item.scope?.appraiser?.license,
        item.issuance?.verificationCode,
      ].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(term);
    });
  }, [dateFrom, dateTo, items, reportType, search, status]);

  const summary = useMemo(() => ({
    total: items.length,
    drafts: items.filter((item) => ["borrador", "observada"].includes(item.estado)).length,
    review: items.filter((item) => ["en_revision", "aprobada"].includes(item.estado)).length,
    issued: items.filter((item) => ["emitida", "entregada"].includes(item.estado)).length,
  }), [items]);

  const duplicate = async (item) => {
    try {
      setWorkingId(item.id);
      const newId = await duplicateTasacion(activeInmobiliariaId, item.id);
      navigate(`/admin/tasaciones/${newId}/editar`);
    } catch (actionError) {
      window.alert(actionError.message || "No se pudo duplicar la tasación.");
    } finally {
      setWorkingId("");
    }
  };

  const remove = async (item) => {
    if (!window.confirm(`¿Enviar la tasación de “${item.scope?.clientName || "Sin cliente"}” a la papelera?`)) return;
    try {
      setWorkingId(item.id);
      await softDeleteTasacion(activeInmobiliariaId, item.id);
      setItems((current) => current.filter((entry) => entry.id !== item.id));
    } catch (actionError) {
      window.alert(actionError.message || "No se pudo eliminar la tasación.");
    } finally {
      setWorkingId("");
    }
  };

  return (
    <main className="container py-4 tasacion-workspace">
      <SEO title="Tasaciones | ONO Prop" noIndex />
      <header className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
        <div>
          <p className="text-uppercase text-muted small mb-1">Panel inmobiliario</p>
          <h1 className="h3 mb-1">Tasaciones</h1>
          <p className="text-muted mb-0">{activeInmobiliaria?.nombre || "Inmobiliaria activa"} · expedientes y estimaciones técnicas.</p>
        </div>
        <div className="d-flex gap-2">
          <Link className="btn btn-outline-secondary" to="/admin/inmobiliaria">Panel</Link>
          <Link className="btn btn-primary" to="/admin/tasaciones/nueva">+ Nueva tasación</Link>
        </div>
      </header>

      <div className="alert alert-light border small">
        Los borradores y sus documentos legales son privados de la inmobiliaria. El informe generado
        no se considera emitido ni firmado mientras no complete el circuito profesional correspondiente.
      </div>

      <section className="row g-3 mb-4" aria-label="Resumen de tasaciones">
        {[
          ["Total", summary.total, "border-primary"],
          ["En preparación", summary.drafts, "border-secondary"],
          ["En revisión", summary.review, "border-warning"],
          ["Vigentes", summary.issued, "border-success"],
        ].map(([label, value, className]) => (
          <div className="col-6 col-lg-3" key={label}>
            <div className={`card h-100 shadow-sm border-start border-4 ${className}`}>
              <div className="card-body py-3">
                <div className="small text-uppercase text-muted">{label}</div>
                <strong className="fs-4">{value}</strong>
              </div>
            </div>
          </div>
        ))}
      </section>

      <section className="card border-0 shadow-sm mb-4">
        <div className="card-body row g-3">
          <div className="col-lg-5">
            <label className="form-label" htmlFor="searchTasaciones">Buscar</label>
            <input id="searchTasaciones" type="search" className="form-control" placeholder="Cliente, titular, calle, ciudad o tipología..." value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
          <div className="col-sm-6 col-lg-3">
            <label className="form-label" htmlFor="statusTasaciones">Estado</label>
            <select id="statusTasaciones" className="form-select" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">Todos</option>
              <option value="borrador">Borrador</option>
              <option value="en_revision">En revisión</option>
              <option value="observada">Observada</option>
              <option value="aprobada">Aprobada</option>
              <option value="emitida">Emitida</option>
              <option value="entregada">Entregada</option>
              <option value="anulada">Anulada</option>
            </select>
          </div>
          <div className="col-sm-6 col-lg-4">
            <label className="form-label" htmlFor="reportTypeTasaciones">Tipo de informe</label>
            <select id="reportTypeTasaciones" className="form-select" value={reportType} onChange={(event) => setReportType(event.target.value)}>
              <option value="">Todos</option>
              {TASACION_TIPOS_INFORME.map((option) => (
                <option value={option.id} key={option.id}>{option.label}</option>
              ))}
            </select>
          </div>
          <div className="col-sm-6 col-lg-3">
            <label className="form-label" htmlFor="dateFromTasaciones">Valuación desde</label>
            <input id="dateFromTasaciones" type="date" className="form-control" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
          </div>
          <div className="col-sm-6 col-lg-3">
            <label className="form-label" htmlFor="dateToTasaciones">Valuación hasta</label>
            <input id="dateToTasaciones" type="date" className="form-control" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
          </div>
          <div className="col-lg-6 d-flex align-items-end">
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={() => { setSearch(""); setStatus(""); setReportType(""); setDateFrom(""); setDateTo(""); }}
            >
              Limpiar filtros
            </button>
          </div>
        </div>
      </section>

      {error && <div className="alert alert-danger">{error}</div>}
      {(loading || agencyLoading) && <div className="text-center py-5">Cargando tasaciones...</div>}

      {!loading && !agencyLoading && !error && visibleItems.length === 0 && (
        <section className="card border-0 shadow-sm">
          <div className="card-body p-5 text-center">
            <div className="display-5 mb-3">📏</div>
            <h2 className="h5">Todavía no hay tasaciones</h2>
            <p className="text-muted">Creá un expediente y completá el relevamiento en cinco etapas.</p>
            <Link className="btn btn-primary" to="/admin/tasaciones/nueva">Crear la primera</Link>
          </div>
        </section>
      )}

      <div className="vstack gap-3">
        {visibleItems.map((item) => {
          const state = getTasacionEstado(item.estado);
          const progress = getTasacionProgress(item);
          const currency = item.scope?.currency || "USD";
          const value = item.conclusion?.adoptedMarketValue;
          const busy = workingId === item.id;
          const valuationAge = daysSince(item.scope?.valuationDate);
          const requiresValidityReview = ["emitida", "entregada"].includes(item.estado)
            && valuationAge !== null
            && valuationAge > 180;
          const address = [
            item.inspection?.address?.street,
            item.inspection?.address?.number,
            item.inspection?.address?.city,
          ].filter(Boolean).join(" · ");

          return (
            <article className="card border-0 shadow-sm" key={item.id}>
              <div className="card-body p-4">
                <div className="row g-3 align-items-center">
                  <div className="col-lg-7">
                    <div className="d-flex flex-wrap gap-2 mb-2">
                      <span className={`badge ${state.badge}`}>{state.label}</span>
                      <span className="badge text-bg-light border text-dark">{item.subject?.typology || "Sin tipología"}</span>
                      <span className="badge text-bg-light border text-dark">Valuación {formatDate(item.scope?.valuationDate)}</span>
                      <span className="badge text-bg-light border text-dark">{getTasacionVersionLabel(item)}</span>
                      {canEditTasacion(item.estado) && progress.completed < progress.total && (
                        <span className="badge text-bg-warning">Datos incompletos</span>
                      )}
                      {requiresValidityReview && (
                        <span className="badge text-bg-warning">Revisar vigencia</span>
                      )}
                    </div>
                    <h2 className="h5 mb-1">{item.scope?.clientName || "Cliente sin identificar"}</h2>
                    <p className="text-muted mb-2">{address || "Ubicación pendiente"}</p>
                    <div className="row g-2 small">
                      <div className="col-sm-5"><strong>Valor adoptado:</strong> {Number(value) > 0 ? formatTasacionMoney(value, currency) : "Pendiente"}</div>
                      <div className="col-sm-4"><strong>Actualizada:</strong> {formatDate(item.updatedAt)}</div>
                      {item.scope?.appraiser?.name && <div className="col-sm-5"><strong>Profesional:</strong> {item.scope.appraiser.name}</div>}
                      {item.issuance?.verificationCode && <div className="col-12"><strong>Código:</strong> <code>{item.issuance.verificationCode}</code></div>}
                    </div>
                    <div className="progress mt-3" style={{ height: 8 }} aria-label={`Avance ${progress.percent}%`}>
                      <div className="progress-bar" style={{ width: `${progress.percent}%` }} />
                    </div>
                    <small className="text-muted">{progress.completed} de {progress.total} etapas con datos mínimos</small>
                  </div>
                  <div className="col-lg-5">
                    <div className="d-flex flex-wrap justify-content-lg-end gap-2">
                      {canEditTasacion(item.estado) && <Link className="btn btn-sm btn-primary" to={`/admin/tasaciones/${item.id}/editar`}>Editar</Link>}
                      <Link className="btn btn-sm btn-outline-primary" to={`/admin/tasaciones/${item.id}/informe`}>Informe</Link>
                      <button type="button" className="btn btn-sm btn-outline-secondary" disabled={busy} onClick={() => duplicate(item)}>Duplicar</button>
                      {canEditTasacion(item.estado) && (
                        <button type="button" className="btn btn-sm btn-outline-danger" disabled={busy} onClick={() => remove(item)}>Eliminar</button>
                      )}
                    </div>
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

export default TasacionListPage;
