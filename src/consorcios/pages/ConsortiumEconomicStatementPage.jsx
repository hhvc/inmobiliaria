import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";

import SEO from "../../components/SEO";
import { useAuth } from "../../context/auth/useAuth";
import { useActiveInmobiliariaModules } from "../../inmobiliaria/hooks/useActiveInmobiliariaModules";
import {
  getInternalPermissions,
  getInternalRoleForInmobiliaria,
  isGlobalRoot,
} from "../../inmobiliaria/utils/inmobiliariaPermissions";
import {
  closeConsortiumFinancialPeriod,
  getConsortiumById,
  getConsortiumFinancialClosures,
  getConsortiumObligations,
  getConsortiumPeriods,
  getConsortiumSupplierObligations,
  getConsortiumTreasuryAccounts,
  getConsortiumTreasuryMovements,
} from "../services/consorcio.service";
import {
  buildConsortiumEconomicStatement,
  buildConsortiumEconomicStatementCsv,
  formatConsortiumMoney,
  getConsortiumPeriodLabel,
} from "../utils/consorcio.helpers";
import "../consorcio.css";

const movementSourceLabels = {
  opening_balance: "Saldo inicial",
  consortium_collection: "Cobro de expensas",
  consortium_collection_reversal: "Anulación de cobro",
  supplier_payment: "Pago a proveedor",
  supplier_payment_reversal: "Anulación de pago",
  manual_movement: "Movimiento manual",
  account_transfer: "Transferencia entre cuentas",
};

const formatDate = (value = "") => {
  if (!value) return "—";
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString("es-AR");
};

const formatTimestamp = (value) => {
  const milliseconds = value?.toMillis?.() || Number(value?.seconds || 0) * 1000;
  return milliseconds ? new Date(milliseconds).toLocaleString("es-AR") : "Fecha pendiente";
};

const financialSummaryKeys = [
  "openingBalanceMinor",
  "collectionsMinor",
  "otherInflowsMinor",
  "supplierPaymentsMinor",
  "otherOutflowsMinor",
  "closingBalanceMinor",
  "unitDebtMinor",
  "supplierDebtMinor",
  "reserveFundsMinor",
  "assessedMinor",
  "transferVolumeMinor",
  "movementCount",
];

const downloadCsv = (content, periodKey) => {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `estado-economico-${periodKey || "consorcio"}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const StatementRow = ({ label, value, currency, emphasis = false }) => (
  <tr className={emphasis ? "table-light fw-semibold" : ""}>
    <td>{label}</td>
    <td className="text-end consortium-money">{formatConsortiumMoney(value, currency)}</td>
  </tr>
);

const ConsortiumEconomicStatementPage = () => {
  const { id: consortiumId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { activeInmobiliariaId, loading: agencyLoading } = useActiveInmobiliariaModules();
  const { user } = useAuth();
  const [consortium, setConsortium] = useState(null);
  const [periods, setPeriods] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [movements, setMovements] = useState([]);
  const [unitObligations, setUnitObligations] = useState([]);
  const [supplierObligations, setSupplierObligations] = useState([]);
  const [closures, setClosures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [operation, setOperation] = useState("");

  const canManage = useMemo(() => {
    const role = getInternalRoleForInmobiliaria(user, activeInmobiliariaId);
    return getInternalPermissions(role, isGlobalRoot(user)).canManageConsortiums;
  }, [activeInmobiliariaId, user]);

  const load = useCallback(async () => {
    if (!activeInmobiliariaId || !consortiumId) return;
    try {
      setLoading(true);
      setError("");
      const [
        consortiumData,
        periodData,
        accountData,
        movementData,
        unitObligationData,
        supplierObligationData,
        closureData,
      ] = await Promise.all([
        getConsortiumById(activeInmobiliariaId, consortiumId),
        getConsortiumPeriods(activeInmobiliariaId, consortiumId),
        getConsortiumTreasuryAccounts(activeInmobiliariaId, consortiumId),
        getConsortiumTreasuryMovements(activeInmobiliariaId, consortiumId),
        getConsortiumObligations(activeInmobiliariaId, { consortiumId }),
        getConsortiumSupplierObligations(activeInmobiliariaId, {
          consortiumId,
          includeVoided: true,
        }),
        getConsortiumFinancialClosures(activeInmobiliariaId, { consortiumId }),
      ]);
      if (!consortiumData) throw new Error("El consorcio no existe.");
      setConsortium(consortiumData);
      setPeriods(periodData);
      setAccounts(accountData);
      setMovements(movementData);
      setUnitObligations(unitObligationData);
      setSupplierObligations(supplierObligationData);
      setClosures(closureData);
    } catch (loadError) {
      setError(loadError.message || "No se pudo preparar el estado económico.");
    } finally {
      setLoading(false);
    }
  }, [activeInmobiliariaId, consortiumId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!periods.length) return;
    const requestedPeriod = searchParams.get("period");
    if (!requestedPeriod || !periods.some((item) => item.periodKey === requestedPeriod)) {
      setSearchParams({ period: periods[0].periodKey }, { replace: true });
    }
  }, [periods, searchParams, setSearchParams]);

  const selectedPeriodKey = searchParams.get("period") || periods[0]?.periodKey || "";
  const selectedPeriod = periods.find((item) => item.periodKey === selectedPeriodKey) || null;
  const statement = useMemo(() => buildConsortiumEconomicStatement({
    period: selectedPeriod || {},
    movements,
    accounts,
    unitObligations,
    supplierObligations,
  }), [accounts, movements, selectedPeriod, supplierObligations, unitObligations]);
  const periodClosures = useMemo(() => closures
    .filter((item) => item.periodId === selectedPeriod?.id)
    .sort((first, second) => Number(second.version || 0) - Number(first.version || 0)), [
    closures,
    selectedPeriod?.id,
  ]);
  const latestClosure = periodClosures[0] || null;
  const statementChangedAfterClose = latestClosure
    ? financialSummaryKeys.some((key) => (
      Number(latestClosure.summary?.[key] || 0) !== Number(
        key === "movementCount" ? statement.movements.length : statement[key] || 0,
      )
    ))
    : false;

  const closeFinancialStatement = async () => {
    if (!selectedPeriod) return;
    const reason = latestClosure
      ? window.prompt("Explicá el motivo de la rectificación o nueva versión:")
      : window.confirm("¿Cerrar la primera versión de este estado económico? El registro quedará inalterable.")
        ? ""
        : null;
    if (reason === null || (latestClosure && !reason?.trim())) return;
    try {
      setOperation("close");
      setError("");
      setSuccess("");
      await closeConsortiumFinancialPeriod({
        inmobiliariaId: activeInmobiliariaId,
        consortiumId,
        periodId: selectedPeriod.id,
        reason: reason || "",
      });
      setSuccess(latestClosure
        ? "Rectificación cerrada en una nueva versión inalterable."
        : "Estado económico cerrado en su primera versión.");
      await load();
    } catch (closeError) {
      setError(closeError.message || "No se pudo cerrar el estado económico.");
    } finally {
      setOperation("");
    }
  };

  if (loading || agencyLoading) {
    return <main className="container py-5 text-center">Preparando estado económico...</main>;
  }
  if (error || !consortium) {
    return <main className="container py-5"><div className="alert alert-danger">{error || "El consorcio no existe."}</div></main>;
  }

  const currency = statement.currency || consortium.currency || "ARS";

  return (
    <main className="container py-4 consortium-economic-page">
      <SEO title={`Estado económico ${selectedPeriodKey} | ${consortium.name}`} noIndex />
      <header className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4 consortium-no-print">
        <div>
          <Link className="text-decoration-none" to={`/admin/consorcios/${consortiumId}#proveedores-tesoreria`}>← Volver al consorcio</Link>
          <h1 className="h3 mt-3 mb-1">Estado económico por período</h1>
          <p className="text-muted mb-0">{consortium.legalName || consortium.name}</p>
        </div>
        <div className="d-flex flex-wrap align-items-end gap-2">
          <div><label className="form-label small">Período</label><select className="form-select" value={selectedPeriodKey} onChange={(event) => setSearchParams({ period: event.target.value })}>{periods.map((period) => <option key={period.id} value={period.periodKey}>{getConsortiumPeriodLabel(period.periodKey)}</option>)}</select></div>
          <button className="btn btn-outline-secondary" disabled={!selectedPeriod} type="button" onClick={() => downloadCsv(buildConsortiumEconomicStatementCsv(statement), selectedPeriodKey)}>Exportar CSV</button>
          <button className="btn btn-primary" disabled={!selectedPeriod} type="button" onClick={() => window.print()}>Imprimir / guardar PDF</button>
          {canManage && <button className="btn btn-dark" disabled={!selectedPeriod || selectedPeriod.status === "draft" || operation === "close" || (latestClosure && !statementChangedAfterClose)} type="button" onClick={closeFinancialStatement}>{operation === "close" ? "Cerrando..." : latestClosure ? "Cerrar rectificación" : "Cerrar versión"}</button>}
        </div>
      </header>

      {error && <div className="alert alert-danger consortium-no-print">{error}</div>}
      {success && <div className="alert alert-success consortium-no-print">{success}</div>}
      {!selectedPeriod && <div className="alert alert-info">Creá una liquidación para generar estados económicos mensuales.</div>}

      {selectedPeriod && <article className="consortium-economic-sheet">
        <header className="border-bottom pb-3 mb-4">
          <p className="text-uppercase text-muted small mb-1">Estado económico y financiero</p>
          <h2 className="h3 mb-1">{consortium.legalName || consortium.name}</h2>
          <p className="mb-0">Período: <strong>{getConsortiumPeriodLabel(selectedPeriodKey)}</strong> · Moneda: {currency}</p>
          <small className="text-muted">Estado de liquidación: {selectedPeriod.status === "closed" ? "Cerrada" : selectedPeriod.status === "issued" ? "Emitida" : "Borrador"}</small>
          {latestClosure && <div className={`alert mt-3 mb-0 py-2 ${statementChangedAfterClose ? "alert-warning" : "alert-success"}`}><strong>Versión financiera {latestClosure.version}</strong> · {formatTimestamp(latestClosure.createdAt)}. {statementChangedAfterClose ? "Existen movimientos o saldos posteriores: corresponde cerrar una rectificación." : "La versión cerrada coincide con los datos actuales."}</div>}
        </header>

        <div className="row g-4 mb-4">
          <div className="col-lg-7"><h3 className="h6">Movimiento de fondos</h3><div className="table-responsive"><table className="table table-sm"><tbody><StatementRow label="Saldo inicial" value={statement.openingBalanceMinor} currency={currency} /><StatementRow label="Expensas cobradas" value={statement.collectionsMinor} currency={currency} /><StatementRow label="Otros ingresos" value={statement.otherInflowsMinor} currency={currency} /><StatementRow label="Pagos a proveedores" value={-statement.supplierPaymentsMinor} currency={currency} /><StatementRow label="Otros egresos" value={-statement.otherOutflowsMinor} currency={currency} /><StatementRow label="Saldo final" value={statement.closingBalanceMinor} currency={currency} emphasis /></tbody></table></div></div>
          <div className="col-lg-5"><h3 className="h6">Situación actual vinculada al período</h3><div className="table-responsive"><table className="table table-sm"><tbody><StatementRow label="Expensas emitidas" value={statement.assessedMinor} currency={currency} /><StatementRow label="Deuda de unidades" value={statement.unitDebtMinor} currency={currency} /><StatementRow label="Deuda con proveedores" value={statement.supplierDebtMinor} currency={currency} /><StatementRow label="Fondos de reserva actuales" value={statement.reserveFundsMinor} currency={currency} /></tbody></table></div><p className="small text-muted">Las deudas muestran el saldo actual de las obligaciones originadas en este período. Las transferencias internas, por {formatConsortiumMoney(statement.transferVolumeMinor, currency)}, no alteran el saldo total.</p></div>
        </div>

        <h3 className="h6">Movimientos del período</h3>
        <div className="table-responsive"><table className="table table-sm align-middle"><thead><tr><th>Fecha</th><th>Cuenta</th><th>Origen</th><th>Concepto</th><th className="text-end">Ingreso</th><th className="text-end">Egreso</th></tr></thead><tbody>{statement.movements.map((movement) => <tr key={movement.id}><td>{formatDate(movement.date)}</td><td>{movement.accountSnapshot?.name || "Cuenta"}</td><td>{movementSourceLabels[movement.source] || movement.source || "Movimiento"}</td><td>{movement.concept || "—"}</td><td className="text-end consortium-money text-success">{movement.direction === "inflow" ? formatConsortiumMoney(movement.amountMinor, movement.currency) : "—"}</td><td className="text-end consortium-money text-danger">{movement.direction === "outflow" ? formatConsortiumMoney(movement.amountMinor, movement.currency) : "—"}</td></tr>)}{!statement.movements.length && <tr><td className="text-center text-muted py-4" colSpan="6">No hay movimientos registrados en este período.</td></tr>}</tbody></table></div>

        {periodClosures.length > 0 && <><h3 className="h6 mt-4">Historial de cierres y rectificaciones</h3><div className="table-responsive"><table className="table table-sm align-middle"><thead><tr><th>Versión</th><th>Tipo</th><th>Fecha</th><th>Motivo</th><th className="text-end">Saldo final cerrado</th></tr></thead><tbody>{periodClosures.map((closure) => <tr key={closure.id}><td>{closure.version}</td><td>{closure.type === "rectification" ? "Rectificación" : "Cierre inicial"}</td><td>{formatTimestamp(closure.createdAt)}</td><td>{closure.reason || "—"}</td><td className="text-end consortium-money">{formatConsortiumMoney(closure.summary?.closingBalanceMinor, closure.currency || currency)}</td></tr>)}</tbody></table></div></>}

        <footer className="border-top pt-3 mt-4 small text-muted">Generado por ONO Prop el {new Date().toLocaleDateString("es-AR")}. Los saldos se reconstruyen a partir de movimientos auditables; las correcciones deben registrarse mediante movimientos compensatorios.</footer>
      </article>}
    </main>
  );
};

export default ConsortiumEconomicStatementPage;
