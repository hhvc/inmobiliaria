import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import SEO from "../../components/SEO";
import { useActiveInmobiliariaModules } from "../../inmobiliaria/hooks/useActiveInmobiliariaModules";
import {
  getConsortiumBudgetPublication,
  getConsortiumById,
  getConsortiumObligations,
  getConsortiumSupplierObligations,
  getConsortiumTreasuryAccounts,
} from "../services/consorcio.service";
import {
  buildConsortiumCashFlowCsv,
  buildConsortiumCashFlowProjection,
  CONSORTIUM_CASH_FLOW_SCENARIOS,
} from "../utils/consorcioCashFlow.helpers";
import { formatConsortiumMoney, majorToMinor } from "../utils/consorcio.helpers";
import "../consorcio.css";

const todayKey = () => {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
};
const formatDate = (value = "") => {
  if (!value) return "—";
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString("es-AR");
};

const downloadCsv = (content, consortiumName) => {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `flujo-fondos-${consortiumName || "consorcio"}-${todayKey()}.csv`
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, "-");
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const scenarioTone = (scenario, minimumBalanceMinor) => {
  if (scenario.minimumBalanceMinor < 0) return "danger";
  if (scenario.minimumBalanceMinor < minimumBalanceMinor) return "warning";
  return "success";
};

const ConsortiumCashFlowPage = () => {
  const { id: consortiumId = "" } = useParams();
  const { activeInmobiliariaId, loading: agencyLoading } = useActiveInmobiliariaModules();
  const [consortium, setConsortium] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [unitObligations, setUnitObligations] = useState([]);
  const [supplierObligations, setSupplierObligations] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [horizonDays, setHorizonDays] = useState(90);
  const [selectedScenarioId, setSelectedScenarioId] = useState("probable");
  const [scenarioRates, setScenarioRates] = useState({
    conservative: 60,
    probable: 80,
    optimistic: 100,
  });
  const [minimumBalanceMajor, setMinimumBalanceMajor] = useState("0");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!activeInmobiliariaId || !consortiumId) return;
    try {
      setLoading(true);
      setError("");
      const startYear = Number(todayKey().slice(0, 4));
      const endYear = Number(new Date(`${todayKey()}T12:00:00Z`).getUTCFullYear()) + 1;
      const years = [...new Set([startYear, endYear])];
      const [
        consortiumData,
        accountData,
        unitObligationData,
        supplierObligationData,
        budgetData,
      ] = await Promise.all([
        getConsortiumById(activeInmobiliariaId, consortiumId),
        getConsortiumTreasuryAccounts(activeInmobiliariaId, consortiumId),
        getConsortiumObligations(activeInmobiliariaId, { consortiumId }),
        getConsortiumSupplierObligations(activeInmobiliariaId, {
          consortiumId,
          includeVoided: true,
        }),
        Promise.all(years.map((year) => getConsortiumBudgetPublication({
          inmobiliariaId: activeInmobiliariaId,
          consortiumId,
          year,
        }))),
      ]);
      if (!consortiumData) throw new Error("El consorcio no existe.");
      setConsortium(consortiumData);
      setAccounts(accountData);
      setUnitObligations(unitObligationData);
      setSupplierObligations(supplierObligationData);
      setBudgets(budgetData.filter(Boolean));
    } catch (loadError) {
      setError(loadError.message || "No se pudo preparar el flujo de fondos.");
    } finally {
      setLoading(false);
    }
  }, [activeInmobiliariaId, consortiumId]);

  useEffect(() => { load(); }, [load]);

  const projection = useMemo(() => buildConsortiumCashFlowProjection({
    accounts,
    unitObligations,
    supplierObligations,
    budgets,
    currency: consortium?.currency || "ARS",
    startDate: todayKey(),
    horizonDays,
    dueDay: consortium?.dueDay || 10,
    paymentPolicy: consortium?.paymentPolicy || {},
    scenarioRates,
  }), [
    accounts,
    budgets,
    consortium?.currency,
    consortium?.dueDay,
    consortium?.paymentPolicy,
    horizonDays,
    scenarioRates,
    supplierObligations,
    unitObligations,
  ]);
  const selectedScenario = projection.scenarios.find(
    (item) => item.id === selectedScenarioId,
  ) || projection.scenarios[1];
  const currency = projection.currency;
  const minimumBalanceMinor = majorToMinor(minimumBalanceMajor);
  const selectedTone = scenarioTone(selectedScenario, minimumBalanceMinor);

  if (loading || agencyLoading) {
    return <main className="container py-5 text-center">Preparando proyección financiera...</main>;
  }
  if (error || !consortium) {
    return <main className="container py-5"><div className="alert alert-danger">{error || "El consorcio no existe."}</div></main>;
  }

  return (
    <main className="container py-4 consortium-cash-flow-page">
      <SEO title={`Flujo de fondos | ${consortium.name}`} noIndex />
      <header className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
        <div>
          <Link className="text-decoration-none" to={`/admin/consorcios/${consortiumId}#proveedores-tesoreria`}>← Volver al consorcio</Link>
          <h1 className="h3 mt-3 mb-1">Flujo de fondos proyectado</h1>
          <p className="text-muted mb-0">{consortium.legalName || consortium.name} · decisiones anticipadas de caja y bancos</p>
        </div>
        <div className="d-flex flex-wrap gap-2">
          <Link className="btn btn-outline-primary" to={`/admin/consorcios/${consortiumId}/presupuesto`}>Presupuesto anual</Link>
          <Link className="btn btn-outline-primary" to={`/admin/consorcios/${consortiumId}/estado-economico`}>Estado económico</Link>
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => downloadCsv(buildConsortiumCashFlowCsv({
              projection,
              scenarioId: selectedScenario.id,
            }), consortium.name)}
          >
            Exportar proyección
          </button>
        </div>
      </header>

      <section className="card border-0 shadow-sm mb-4 consortium-no-print">
        <div className="card-body p-4">
          <div className="d-flex flex-wrap justify-content-between align-items-start gap-3">
            <div><h2 className="h5 mb-1">Supuestos de la simulación</h2><p className="small text-muted mb-0">Los cambios solo modifican esta vista; no alteran saldos, vencimientos ni liquidaciones.</p></div>
            <div className="btn-group" role="group" aria-label="Horizonte de proyección">
              {[30, 60, 90].map((days) => <button className={`btn ${horizonDays === days ? "btn-dark" : "btn-outline-dark"}`} key={days} type="button" onClick={() => setHorizonDays(days)}>{days} días</button>)}
            </div>
          </div>
          <div className="row g-3 mt-1">
            {CONSORTIUM_CASH_FLOW_SCENARIOS.map((scenario) => <div className="col-md-3" key={scenario.id}><label className="form-label">Cobranza {scenario.label.toLowerCase()}</label><div className="input-group"><input className="form-control" min="0" max="100" step="1" type="number" value={scenarioRates[scenario.id]} onChange={(event) => setScenarioRates((current) => ({ ...current, [scenario.id]: event.target.value }))} /><span className="input-group-text">%</span></div></div>)}
            <div className="col-md-3"><label className="form-label">Saldo mínimo deseado</label><div className="input-group"><span className="input-group-text">{currency}</span><input className="form-control" min="0" inputMode="decimal" value={minimumBalanceMajor} onChange={(event) => setMinimumBalanceMajor(event.target.value)} /></div></div>
          </div>
        </div>
      </section>

      <section className="row g-3 mb-4">
        <div className="col-sm-6 col-xl-3"><div className="card border-0 shadow-sm h-100"><div className="card-body"><span className="small text-muted text-uppercase">Saldo disponible hoy</span><strong className="fs-4 d-block consortium-money">{formatConsortiumMoney(projection.startingBalanceMinor, currency)}</strong><small className="text-muted">{projection.activeAccountCount} cuenta(s) activa(s)</small></div></div></div>
        {projection.scenarios.map((scenario) => {
          const tone = scenarioTone(scenario, minimumBalanceMinor);
          return <div className="col-sm-6 col-xl-3" key={scenario.id}><button className={`card border-0 shadow-sm h-100 w-100 text-start consortium-cash-flow-scenario ${selectedScenarioId === scenario.id ? "active" : ""}`} type="button" onClick={() => setSelectedScenarioId(scenario.id)}><div className="card-body"><div className="d-flex justify-content-between gap-2"><span className="small text-muted text-uppercase">{scenario.label}</span><span className={`badge text-bg-${tone}`}>{scenario.collectionPercent}%</span></div><strong className={`fs-4 d-block consortium-money text-${tone}`}>{formatConsortiumMoney(scenario.endingBalanceMinor, currency)}</strong><small className="text-muted">Saldo al {formatDate(projection.endDate)}</small></div></button></div>;
        })}
      </section>

      {!projection.activeAccountCount && <div className="alert alert-warning"><strong>No hay cuentas activas en {currency}.</strong> Configurá caja, banco o billetera desde Tesorería para obtener un saldo inicial confiable.</div>}
      {projection.missingBudgetYears.length > 0 && <div className="alert alert-info"><strong>Proyección parcial.</strong> No hay presupuesto aprobado para {projection.missingBudgetYears.join(", ")}. Se muestran igualmente expensas y cuentas a pagar ya registradas.</div>}
      {selectedScenario.minimumBalanceMinor < minimumBalanceMinor && <div className={`alert alert-${selectedTone}`}><strong>{selectedScenario.hasDeficit ? "Se proyecta falta de fondos." : "El saldo cae por debajo del mínimo deseado."}</strong> El punto más bajo sería {formatConsortiumMoney(selectedScenario.minimumBalanceMinor, currency)}{selectedScenario.minimumBalanceDate ? ` el ${formatDate(selectedScenario.minimumBalanceDate)}` : ""}.</div>}

      <section className="card border-0 shadow-sm mb-4">
        <div className="card-body p-4">
          <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-3">
            <div><h2 className="h5 mb-1">Escenario {selectedScenario.label.toLowerCase()}</h2><p className="small text-muted mb-0">Cobranza estimada del {selectedScenario.collectionPercent}% · horizonte hasta el {formatDate(projection.endDate)}</p></div>
            <div className="d-flex flex-wrap gap-3 small"><span><strong className="text-success">Ingresos:</strong> {formatConsortiumMoney(selectedScenario.inflowMinor, currency)}</span><span><strong className="text-danger">Egresos:</strong> {formatConsortiumMoney(selectedScenario.outflowMinor, currency)}</span></div>
          </div>
          <div className="table-responsive">
            <table className="table align-middle consortium-cash-flow-table mb-0">
              <thead><tr><th>Fecha</th><th>Conceptos incluidos</th><th className="text-end">Ingresos</th><th className="text-end">Egresos</th><th className="text-end">Saldo proyectado</th></tr></thead>
              <tbody>
                {selectedScenario.rows.map((row) => <tr className={row.balanceMinor < minimumBalanceMinor ? "table-warning" : ""} key={row.date}><td className="text-nowrap"><strong>{formatDate(row.date)}</strong></td><td>{row.details.map((detail, index) => <div className="small" key={`${detail.source}-${index}`}><span className={`me-1 ${detail.direction === "inflow" ? "text-success" : "text-danger"}`}>{detail.direction === "inflow" ? "↑" : "↓"}</span>{detail.label}</div>)}</td><td className="text-end consortium-money text-success">{row.inflowMinor ? formatConsortiumMoney(row.inflowMinor, currency) : "—"}</td><td className="text-end consortium-money text-danger">{row.outflowMinor ? formatConsortiumMoney(row.outflowMinor, currency) : "—"}</td><td className={`text-end consortium-money fw-semibold ${row.balanceMinor < 0 ? "text-danger" : ""}`}>{formatConsortiumMoney(row.balanceMinor, currency)}</td></tr>)}
                {!selectedScenario.rows.length && <tr><td className="text-center text-muted py-5" colSpan="5">No hay cobros ni pagos proyectados dentro del horizonte elegido.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="row g-3">
        <div className="col-lg-7"><div className="card border-0 shadow-sm h-100"><div className="card-body p-4"><h2 className="h5">Origen de la proyección</h2><div className="row g-3 mt-1"><div className="col-sm-6"><small className="text-muted d-block">Expensas pendientes registradas</small><strong className="consortium-money">{formatConsortiumMoney(projection.openReceivableMinor, currency)}</strong></div><div className="col-sm-6"><small className="text-muted d-block">Cuentas a pagar registradas</small><strong className="consortium-money">{formatConsortiumMoney(projection.openPayableMinor, currency)}</strong></div><div className="col-sm-6"><small className="text-muted d-block">Cobros futuros estimados por presupuesto</small><strong className="consortium-money">{formatConsortiumMoney(projection.budgetReceivableMinor, currency)}</strong></div><div className="col-sm-6"><small className="text-muted d-block">Gastos presupuestados aún no registrados</small><strong className="consortium-money">{formatConsortiumMoney(projection.budgetOutflowMinor, currency)}</strong></div></div></div></div></div>
        <div className="col-lg-5"><div className="card border-0 shadow-sm h-100"><div className="card-body p-4"><h2 className="h5">Cómo interpretar el resultado</h2><p className="small text-muted">Es una herramienta de previsión, no un asiento contable. Los cobros se ponderan por el porcentaje elegido; los pagos registrados se computan completos.</p><p className="small text-muted mb-0">El presupuesto completa meses que todavía no tienen liquidaciones o comprobantes. No incluye intereses ni recargos que aún no hayan sido registrados.</p></div></div></div>
      </section>
    </main>
  );
};

export default ConsortiumCashFlowPage;
