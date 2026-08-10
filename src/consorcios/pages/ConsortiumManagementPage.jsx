import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import SEO from "../../components/SEO";
import { useAuth } from "../../context/auth/useAuth";
import { useActiveInmobiliariaModules } from "../../inmobiliaria/hooks/useActiveInmobiliariaModules";
import {
  getInternalPermissions,
  getInternalRoleForInmobiliaria,
  isGlobalRoot,
} from "../../inmobiliaria/utils/inmobiliariaPermissions";
import {
  getConsortiumObligations,
  getConsortiums,
  getConsortiumUnits,
} from "../services/consorcio.service";
import {
  formatConsortiumMoney,
  getConsortiumObligationStatus,
} from "../utils/consorcio.helpers";
import { getConsortiumStatus } from "../utils/consorcio.constants";
import "../consorcio.css";

const currentPeriodKey = () => new Date().toISOString().slice(0, 7);

const ConsortiumManagementPage = () => {
  const { user } = useAuth();
  const { activeInmobiliariaId, activeInmobiliaria, loading: agencyLoading } =
    useActiveInmobiliariaModules();
  const [consortiums, setConsortiums] = useState([]);
  const [units, setUnits] = useState([]);
  const [obligations, setObligations] = useState([]);
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const canManage = useMemo(() => {
    const role = getInternalRoleForInmobiliaria(user, activeInmobiliariaId);
    return getInternalPermissions(role, isGlobalRoot(user)).canManageConsortiums;
  }, [activeInmobiliariaId, user]);

  const load = useCallback(async () => {
    if (!activeInmobiliariaId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError("");
      const [consortiumData, unitData, obligationData] = await Promise.all([
        getConsortiums(activeInmobiliariaId),
        getConsortiumUnits(activeInmobiliariaId),
        getConsortiumObligations(activeInmobiliariaId),
      ]);
      setConsortiums(consortiumData);
      setUnits(unitData);
      setObligations(obligationData);
    } catch (loadError) {
      setError(loadError.message || "No se pudo cargar la administración de consorcios.");
    } finally {
      setLoading(false);
    }
  }, [activeInmobiliariaId]);

  useEffect(() => { load(); }, [load]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return consortiums.filter((item) => {
      if (!showArchived && item.status === "archived") return false;
      if (!term) return true;
      return [item.name, item.legalName, item.taxId, item.address, item.city]
        .filter(Boolean).join(" ").toLowerCase().includes(term);
    });
  }, [consortiums, search, showArchived]);

  const summary = useMemo(() => {
    const current = currentPeriodKey();
    const active = consortiums.filter((item) => item.status !== "archived");
    const activeUnits = units.filter((item) => item.active !== false && item.deleted !== true);
    const overdue = obligations.filter((item) => getConsortiumObligationStatus(item) === "overdue");
    const currentBalance = obligations
      .filter((item) => item.periodKey === current)
      .reduce((sum, item) => sum + Number(item.balanceMinor || 0), 0);
    return {
      active: active.length,
      units: activeUnits.length,
      overdueCount: overdue.length,
      overdueMinor: overdue.reduce((sum, item) => sum + Number(item.balanceMinor || 0), 0),
      currentBalance,
    };
  }, [consortiums, obligations, units]);

  return (
    <main className="container py-4 consortium-workspace">
      <SEO title="Administración de consorcios | ONO Prop" noIndex />
      <header className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
        <div>
          <p className="text-uppercase text-muted small mb-1">Panel inmobiliario</p>
          <h1 className="h3 mb-1">Administración de consorcios</h1>
          <p className="text-muted mb-0">
            {activeInmobiliaria?.nombre || "Inmobiliaria activa"} · unidades, expensas, cobros y cuentas corrientes.
          </p>
        </div>
        {canManage && <Link className="btn btn-primary" to="/admin/consorcios/nuevo">+ Nuevo consorcio</Link>}
      </header>

      <section className="row g-3 mb-4" aria-label="Resumen de consorcios">
        {[
          ["Consorcios activos", summary.active, "border-primary", "En administración"],
          ["Unidades activas", summary.units, "border-info", "Total administrado"],
          ["Expensas vencidas", summary.overdueCount, "border-danger", formatConsortiumMoney(summary.overdueMinor)],
          ["Saldo del período", formatConsortiumMoney(summary.currentBalance), "border-warning", currentPeriodKey()],
        ].map(([label, value, border, hint]) => (
          <div className="col-sm-6 col-xl-3" key={label}>
            <div className={`card h-100 border-0 shadow-sm border-start border-4 ${border} consortium-summary-card`}>
              <div className="card-body">
                <div className="small text-uppercase text-muted">{label}</div>
                <strong className="fs-4 d-block">{value}</strong>
                <small className="text-muted">{hint}</small>
              </div>
            </div>
          </div>
        ))}
      </section>

      <section className="card border-0 shadow-sm mb-4">
        <div className="card-body row g-3 align-items-end">
          <div className="col-lg-9">
            <label className="form-label" htmlFor="consortium-search">Buscar consorcio</label>
            <input
              id="consortium-search"
              className="form-control"
              type="search"
              placeholder="Nombre, CUIT, domicilio o ciudad..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div className="col-lg-3">
            <div className="form-check form-switch mb-2">
              <input
                className="form-check-input"
                id="show-archived-consortiums"
                type="checkbox"
                checked={showArchived}
                onChange={(event) => setShowArchived(event.target.checked)}
              />
              <label className="form-check-label" htmlFor="show-archived-consortiums">Mostrar archivados</label>
            </div>
          </div>
        </div>
      </section>

      {error && <div className="alert alert-danger">{error}</div>}
      {(loading || agencyLoading) && <div className="text-center py-5">Cargando consorcios...</div>}
      {!loading && !agencyLoading && !error && visible.length === 0 && (
        <section className="card border-0 shadow-sm">
          <div className="card-body p-5 text-center">
            <div className="display-5 mb-3">🏢</div>
            <h2 className="h5">Todavía no hay consorcios</h2>
            <p className="text-muted">Creá el consorcio y luego cargá sus unidades funcionales.</p>
            {canManage && <Link className="btn btn-primary" to="/admin/consorcios/nuevo">Crear consorcio</Link>}
          </div>
        </section>
      )}

      <div className="vstack gap-3">
        {visible.map((consortium) => {
          const state = getConsortiumStatus(consortium.status);
          const consortiumUnits = units.filter((item) => item.consortiumId === consortium.id && item.active !== false);
          const debts = obligations.filter((item) => item.consortiumId === consortium.id);
          const balance = debts.reduce((sum, item) => sum + Number(item.balanceMinor || 0), 0);
          const overdue = debts.filter((item) => getConsortiumObligationStatus(item) === "overdue").length;
          return (
            <article className="card border-0 shadow-sm" key={consortium.id}>
              <div className="card-body p-4">
                <div className="row g-3 align-items-center">
                  <div className="col-lg-8">
                    <div className="d-flex flex-wrap gap-2 mb-2">
                      <span className={`badge ${state.badge}`}>{state.label}</span>
                      <span className="badge text-bg-light border text-dark">{consortiumUnits.length} unidades</span>
                      {overdue > 0 && <span className="badge text-bg-danger">{overdue} vencida{overdue === 1 ? "" : "s"}</span>}
                    </div>
                    <h2 className="h5 mb-1">{consortium.name}</h2>
                    <p className="text-muted mb-2">{consortium.address}{consortium.city ? ` · ${consortium.city}` : ""}</p>
                    <div className="small"><strong>Saldo registrado:</strong> {formatConsortiumMoney(balance, consortium.currency)}</div>
                  </div>
                  <div className="col-lg-4 d-flex flex-wrap justify-content-lg-end gap-2">
                    <Link className="btn btn-primary" to={`/admin/consorcios/${consortium.id}`}>Gestionar</Link>
                    {canManage && <Link className="btn btn-outline-secondary" to={`/admin/consorcios/${consortium.id}/editar`}>Editar</Link>}
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

export default ConsortiumManagementPage;
