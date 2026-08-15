import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import SEO from "../../components/SEO";
import { useActiveInmobiliariaModules } from "../../inmobiliaria/hooks/useActiveInmobiliariaModules";
import {
  getRentalContracts,
  getRentalObligations,
} from "../services/rental.service";
import { getRentalContractStatus } from "../utils/rental.constants";
import {
  formatRentalMoney,
  getNextAdjustmentDate,
  getObligationStatus,
} from "../utils/rental.helpers";
import "../rental.css";

const todayKey = () => new Date().toISOString().slice(0, 10);

const timestampToDate = (value) => {
  const date = value?.toDate ? value.toDate() : value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString("es-AR") : "Sin fecha";
};

const RentalManagementPage = () => {
  const { activeInmobiliariaId, activeInmobiliaria, loading: agencyLoading } =
    useActiveInmobiliariaModules();
  const [contracts, setContracts] = useState([]);
  const [obligations, setObligations] = useState([]);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!activeInmobiliariaId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError("");
      const [contractData, obligationData] = await Promise.all([
        getRentalContracts(activeInmobiliariaId),
        getRentalObligations(activeInmobiliariaId),
      ]);
      setContracts(contractData);
      setObligations(obligationData);
    } catch (loadError) {
      setError(loadError.message || "No se pudo cargar la administración de alquileres.");
    } finally {
      setLoading(false);
    }
  }, [activeInmobiliariaId]);

  useEffect(() => { load(); }, [load]);

  const visibleContracts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return contracts.filter((contract) => {
      if (status && contract.status !== status) return false;
      if (!term) return true;
      return [
        contract.inmuebleSnapshot?.title,
        contract.inmuebleSnapshot?.address,
        ...(contract.partySnapshots?.owners || []).map((party) => party.name),
        ...(contract.partySnapshots?.tenants || []).map((party) => party.name),
      ].filter(Boolean).join(" ").toLowerCase().includes(term);
    });
  }, [contracts, search, status]);

  const summary = useMemo(() => {
    const today = todayKey();
    const currentPeriod = today.slice(0, 7);
    const overdue = obligations.filter((item) => getObligationStatus(item, today) === "overdue");
    const collected = obligations
      .filter((item) => item.periodKey === currentPeriod)
      .reduce((sum, item) => sum + Number(item.paidAmountMinor || 0), 0);
    const dueSoonLimit = new Date();
    dueSoonLimit.setDate(dueSoonLimit.getDate() + 45);
    const dueSoonKey = dueSoonLimit.toISOString().slice(0, 10);
    return {
      active: contracts.filter((item) => item.status === "active").length,
      overdueCount: overdue.length,
      overdueMinor: overdue.reduce((sum, item) => sum + Number(item.balanceMinor || 0), 0),
      collected,
      adjustments: contracts.filter((item) => {
        if (item.status !== "active") return false;
        const next = getNextAdjustmentDate(item);
        return next && next >= today && next <= dueSoonKey;
      }).length,
    };
  }, [contracts, obligations]);

  return (
    <main className="container py-4 rental-workspace">
      <SEO title="Administración de alquileres | ONO Prop" noIndex />
      <header className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
        <div>
          <p className="text-uppercase text-muted small mb-1">Panel inmobiliario</p>
          <h1 className="h3 mb-1">Administración de alquileres</h1>
          <p className="text-muted mb-0">{activeInmobiliaria?.nombre || "Inmobiliaria activa"} · contratos, cobros y liquidaciones.</p>
        </div>
        <div className="d-flex flex-wrap gap-2">
          <Link className="btn btn-outline-primary" to="/admin/alquileres/comprobantes">Comprobantes ARCA</Link>
          <Link className="btn btn-outline-success" to="/admin/alquileres/cuentas-locadores">Cuentas de locadores</Link>
          <Link className="btn btn-outline-secondary" to="/admin/alquileres/personas">Personas</Link>
          <Link className="btn btn-primary" to="/admin/alquileres/nuevo">+ Nuevo contrato</Link>
        </div>
      </header>

      <section className="row g-3 mb-4" aria-label="Resumen de alquileres">
        {[
          ["Contratos activos", summary.active, "border-primary", ""],
          ["Obligaciones vencidas", summary.overdueCount, "border-danger", summary.overdueMinor ? formatRentalMoney(summary.overdueMinor) : "Sin saldo vencido"],
          ["Cobrado este período", formatRentalMoney(summary.collected), "border-success", "Pagos imputados"],
          ["Ajustes en 45 días", summary.adjustments, "border-warning", "Según cada contrato"],
        ].map(([label, value, border, hint]) => (
          <div className="col-sm-6 col-xl-3" key={label}>
            <div className={`card h-100 border-0 shadow-sm border-start border-4 ${border}`}>
              <div className="card-body">
                <div className="small text-uppercase text-muted">{label}</div>
                <strong className="fs-4 d-block">{value}</strong>
                {hint && <small className="text-muted">{hint}</small>}
              </div>
            </div>
          </div>
        ))}
      </section>

      <section className="card border-0 shadow-sm mb-4">
        <div className="card-body row g-3">
          <div className="col-lg-8">
            <label className="form-label" htmlFor="rentalSearch">Buscar contrato</label>
            <input id="rentalSearch" className="form-control" type="search" placeholder="Inmueble, dirección, locador o locatario..." value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
          <div className="col-lg-4">
            <label className="form-label" htmlFor="rentalStatus">Estado</label>
            <select id="rentalStatus" className="form-select" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">Todos</option>
              <option value="draft">Borrador</option>
              <option value="active">Activo</option>
              <option value="ended">Finalizado</option>
              <option value="cancelled">Rescindido</option>
            </select>
          </div>
        </div>
      </section>

      {error && <div className="alert alert-danger">{error}</div>}
      {(loading || agencyLoading) && <div className="text-center py-5">Cargando contratos...</div>}
      {!loading && !agencyLoading && !error && visibleContracts.length === 0 && (
        <section className="card border-0 shadow-sm">
          <div className="card-body p-5 text-center">
            <div className="display-5 mb-3">🔑</div>
            <h2 className="h5">Todavía no hay contratos</h2>
            <p className="text-muted">Primero registrá a las partes y después vinculá un inmueble.</p>
            <div className="d-flex justify-content-center gap-2">
              <Link className="btn btn-outline-primary" to="/admin/alquileres/personas">Registrar personas</Link>
              <Link className="btn btn-primary" to="/admin/alquileres/nuevo">Crear contrato</Link>
            </div>
          </div>
        </section>
      )}

      <div className="vstack gap-3">
        {visibleContracts.map((contract) => {
          const state = getRentalContractStatus(contract.status);
          const contractObligations = obligations.filter((item) => item.contractId === contract.id);
          const balance = contractObligations.reduce((sum, item) => sum + Number(item.balanceMinor || 0), 0);
          const overdue = contractObligations.filter((item) => getObligationStatus(item) === "overdue").length;
          return (
            <article className="card border-0 shadow-sm" key={contract.id}>
              <div className="card-body p-4">
                <div className="row g-3 align-items-center">
                  <div className="col-lg-8">
                    <div className="d-flex flex-wrap gap-2 mb-2">
                      <span className={`badge ${state.badge}`}>{state.label}</span>
                      {overdue > 0 && <span className="badge text-bg-danger">{overdue} vencida{overdue === 1 ? "" : "s"}</span>}
                      <span className="badge text-bg-light border text-dark">{contract.currency}</span>
                    </div>
                    <h2 className="h5 mb-1">{contract.inmuebleSnapshot?.title || "Inmueble sin título"}</h2>
                    <p className="text-muted mb-2">{contract.inmuebleSnapshot?.address || "Dirección no informada"}</p>
                    <div className="row small g-2">
                      <div className="col-md-6"><strong>Locatario:</strong> {contract.partySnapshots?.tenants?.map((item) => item.name).join(", ") || "Pendiente"}</div>
                      <div className="col-md-6"><strong>Locador:</strong> {contract.partySnapshots?.owners?.map((item) => item.name).join(", ") || "Pendiente"}</div>
                      <div className="col-md-6"><strong>Modalidad:</strong> {contract.contractType === "temporary" ? "Alquiler temporal" : "Alquiler recurrente"}</div>
                      <div className="col-md-6"><strong>Vigencia:</strong> {contract.startDate} a {contract.endDate}</div>
                      <div className="col-md-6"><strong>Saldo registrado:</strong> {formatRentalMoney(balance, contract.currency)}</div>
                      <div className="col-md-6"><strong>Última edición:</strong> {timestampToDate(contract.updatedAt)}</div>
                    </div>
                  </div>
                  <div className="col-lg-4 d-flex flex-wrap justify-content-lg-end gap-2">
                    <Link className="btn btn-primary" to={`/admin/alquileres/${contract.id}`}>Gestionar</Link>
                    <Link className="btn btn-outline-secondary" to={`/admin/alquileres/${contract.id}/editar`}>Editar contrato</Link>
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

export default RentalManagementPage;
