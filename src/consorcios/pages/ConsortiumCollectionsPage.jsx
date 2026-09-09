import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";

import SEO from "../../components/SEO";
import { useAuth } from "../../context/auth/useAuth";
import { useActiveInmobiliariaModules } from "../../inmobiliaria/hooks/useActiveInmobiliariaModules";
import {
  getInternalPermissions,
  getInternalRoleForInmobiliaria,
  isGlobalRoot,
} from "../../inmobiliaria/utils/inmobiliariaPermissions";
import {
  assessConsortiumInterests,
  createConsortiumPaymentAgreement,
  getConsortiumById,
  getConsortiumCollectionActions,
  getConsortiumObligations,
  getConsortiumPaymentAgreements,
  getConsortiumTreasuryAccounts,
  getConsortiumUnits,
  registerConsortiumAccountPayment,
  recordConsortiumCollectionAction,
  updateConsortiumPaymentAgreementStatus,
} from "../services/consorcio.service";
import {
  formatConsortiumMoney,
  majorToMinor,
  minorToMajorInput,
} from "../utils/consorcio.helpers";
import {
  buildConsortiumCollectionsCsv,
  buildConsortiumCollectionsDashboard,
  buildConsortiumInterestPreview,
  buildConsortiumPaymentAgreementSchedule,
  CONSORTIUM_AGING_LABELS,
} from "../utils/consorcioCollections.helpers";
import { CONSORTIUM_PAYMENT_METHODS } from "../utils/consorcio.constants";
import "../consorcio.css";

const todayKey = () => new Date().toISOString().slice(0, 10);

const addDays = (dateKey, days) => {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const formatDate = (value = "") => {
  if (!value) return "—";
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("es-AR");
};

const formatTimestamp = (value) => {
  const millis = value?.toMillis?.() || Number(value?.seconds || 0) * 1000;
  return millis ? new Date(millis).toLocaleString("es-AR") : "Registro pendiente";
};

const actionTypeLabels = {
  contact: "Contacto",
  promise: "Promesa de pago",
  notice: "Intimación / aviso",
  note: "Nota interna",
  agreement_created: "Convenio creado",
  agreement_status: "Cambio de convenio",
};

const channelLabels = {
  phone: "Teléfono",
  whatsapp: "WhatsApp",
  email: "Email",
  in_person: "Presencial",
  letter: "Carta / documento",
  system: "Sistema",
  other: "Otro",
};

const agreementStatusLabels = {
  active: "Vigente",
  completed: "Cumplido",
  defaulted: "Incumplido",
  cancelled: "Cancelado",
};

const downloadCsv = (content, consortiumName = "consorcio") => {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `cobranzas-${consortiumName.toLowerCase().replace(/[^a-z0-9]+/gi, "-")}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

const ConsortiumCollectionsPage = () => {
  const { id: consortiumId = "" } = useParams();
  const { user } = useAuth();
  const { activeInmobiliariaId, loading: agencyLoading } = useActiveInmobiliariaModules();
  const detailRef = useRef(null);
  const [consortium, setConsortium] = useState(null);
  const [units, setUnits] = useState([]);
  const [obligations, setObligations] = useState([]);
  const [actions, setActions] = useState([]);
  const [agreements, setAgreements] = useState([]);
  const [treasuryAccounts, setTreasuryAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [operation, setOperation] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [agingFilter, setAgingFilter] = useState("all");
  const [managementFilter, setManagementFilter] = useState("all");
  const [sortBy, setSortBy] = useState("overdue");
  const [selectedUnitId, setSelectedUnitId] = useState("");
  const [selectedObligationIds, setSelectedObligationIds] = useState([]);
  const [lastPaymentId, setLastPaymentId] = useState("");
  const [interestCutoffDate, setInterestCutoffDate] = useState(todayKey);
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    date: todayKey(),
    method: "transfer",
    treasuryAccountId: "",
    reference: "",
    notes: "",
  });
  const [actionForm, setActionForm] = useState({
    type: "contact",
    channel: "phone",
    occurredOn: todayKey(),
    outcome: "",
    notes: "",
    promiseAmount: "",
    promiseDueDate: addDays(todayKey(), 7),
  });
  const [agreementForm, setAgreementForm] = useState({
    agreementDate: todayKey(),
    agreedAmount: "",
    downPayment: "0",
    installmentCount: "3",
    firstDueDate: addDays(todayKey(), 7),
    notes: "",
  });

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
        unitData,
        obligationData,
        actionData,
        agreementData,
        treasuryAccountData,
      ] =
        await Promise.all([
          getConsortiumById(activeInmobiliariaId, consortiumId),
          getConsortiumUnits(activeInmobiliariaId, consortiumId),
          getConsortiumObligations(activeInmobiliariaId, { consortiumId }),
          getConsortiumCollectionActions(activeInmobiliariaId, { consortiumId }),
          getConsortiumPaymentAgreements(activeInmobiliariaId, { consortiumId }),
          getConsortiumTreasuryAccounts(activeInmobiliariaId, consortiumId),
        ]);
      if (!consortiumData) throw new Error("El consorcio no existe.");
      setConsortium(consortiumData);
      setUnits(unitData);
      setObligations(obligationData);
      setActions(actionData);
      setAgreements(agreementData);
      setTreasuryAccounts(treasuryAccountData);
    } catch (loadError) {
      setError(loadError.message || "No se pudo preparar el tablero de cobranzas.");
    } finally {
      setLoading(false);
    }
  }, [activeInmobiliariaId, consortiumId]);

  useEffect(() => { load(); }, [load]);

  const dashboard = useMemo(() => buildConsortiumCollectionsDashboard({
    units,
    obligations,
    todayKey: todayKey(),
  }), [obligations, units]);

  const latestActionByUnit = useMemo(() => {
    const result = new Map();
    actions.forEach((item) => {
      if (!result.has(item.unitId)) result.set(item.unitId, item);
    });
    return result;
  }, [actions]);

  const activeAgreementByUnit = useMemo(() => {
    const result = new Map();
    agreements.filter((item) => item.status === "active").forEach((item) => {
      if (!result.has(item.unitId)) result.set(item.unitId, item);
    });
    return result;
  }, [agreements]);

  const rows = useMemo(() => dashboard.unitRows.map((row) => ({
    ...row,
    latestAction: latestActionByUnit.get(row.unitId) || null,
    activeAgreement: activeAgreementByUnit.get(row.unitId) || null,
  })), [activeAgreementByUnit, dashboard.unitRows, latestActionByUnit]);

  const visibleRows = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("es");
    return rows.filter((row) => {
      const matchesSearch = !needle || [
        row.code, row.ownerName, row.occupantName, row.email, row.phone,
      ].some((value) => `${value || ""}`.toLocaleLowerCase("es").includes(needle));
      const matchesAging = agingFilter === "all"
        || (agingFilter === "overdue" && row.overdueBalanceMinor > 0)
        || row.agingBucket === agingFilter;
      const matchesManagement = managementFilter === "all"
        || (managementFilter === "without_action" && !row.latestAction)
        || (managementFilter === "promise" && row.latestAction?.type === "promise")
        || (managementFilter === "agreement" && Boolean(row.activeAgreement));
      return matchesSearch && matchesAging && matchesManagement;
    }).sort((left, right) => {
      if (sortBy === "balance") return right.balanceMinor - left.balanceMinor;
      if (sortBy === "days") return right.maxDaysPastDue - left.maxDaysPastDue;
      if (sortBy === "unit") return left.code.localeCompare(right.code, "es", { numeric: true });
      return right.overdueBalanceMinor - left.overdueBalanceMinor
        || right.balanceMinor - left.balanceMinor;
    });
  }, [agingFilter, managementFilter, rows, search, sortBy]);

  const selectedRow = rows.find((item) => item.unitId === selectedUnitId) || null;
  const selectedUnit = units.find((item) => item.id === selectedUnitId) || null;
  const selectedActions = actions.filter((item) => item.unitId === selectedUnitId);
  const selectedAgreements = agreements.filter((item) => item.unitId === selectedUnitId);
  const selectedObligations = obligations
    .filter((item) => item.unitId === selectedUnitId && item.voided !== true && Number(item.balanceMinor) > 0)
    .sort((left, right) => (left.dueDate || "").localeCompare(right.dueDate || ""));
  const currency = consortium?.currency || "ARS";
  const selectedDebtMinor = selectedObligations
    .filter((item) => selectedObligationIds.includes(item.id))
    .reduce((sum, item) => sum + Number(item.balanceMinor || 0), 0);
  const interestPreview = useMemo(() => buildConsortiumInterestPreview({
    obligations: selectedObligations.filter((item) => selectedObligationIds.includes(item.id)),
    policy: consortium?.interestPolicy,
    cutoffDate: interestCutoffDate,
  }), [consortium?.interestPolicy, interestCutoffDate, selectedObligationIds, selectedObligations]);
  const agreementPreview = useMemo(() => buildConsortiumPaymentAgreementSchedule({
    agreedAmountMinor: majorToMinor(agreementForm.agreedAmount),
    downPaymentMinor: majorToMinor(agreementForm.downPayment),
    installmentCount: agreementForm.installmentCount,
    firstDueDate: agreementForm.firstDueDate,
  }), [agreementForm]);

  const selectUnit = (row) => {
    setSelectedUnitId(row.unitId);
    setSelectedObligationIds(row.obligationIds);
    setAgreementForm((current) => ({
      ...current,
      agreedAmount: minorToMajorInput(row.balanceMinor),
      downPayment: "0",
    }));
    setPaymentForm((current) => ({
      ...current,
      amount: minorToMajorInput(row.netBalanceMinor || row.balanceMinor),
    }));
    setError("");
    setSuccess("");
    window.setTimeout(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  };

  const handlePaymentSubmit = async (event) => {
    event.preventDefault();
    if (!selectedUnitId) return;
    try {
      setOperation("payment");
      setError("");
      setSuccess("");
      const paymentId = await registerConsortiumAccountPayment({
        inmobiliariaId: activeInmobiliariaId,
        consortiumId,
        unitId: selectedUnitId,
        amountMinor: majorToMinor(paymentForm.amount),
        obligationIds: selectedObligationIds,
        date: paymentForm.date,
        method: paymentForm.method,
        treasuryAccountId: paymentForm.treasuryAccountId,
        reference: paymentForm.reference,
        notes: paymentForm.notes,
      });
      setLastPaymentId(paymentId);
      setSelectedObligationIds([]);
      setPaymentForm((current) => ({
        ...current,
        amount: "",
        reference: "",
        notes: "",
      }));
      setSuccess("Cobro registrado e imputado. El recibo detalla cada período alcanzado.");
      await load();
    } catch (paymentError) {
      setError(paymentError.message || "No se pudo registrar el cobro.");
    } finally {
      setOperation("");
    }
  };

  const handleActionSubmit = async (event) => {
    event.preventDefault();
    if (!selectedUnitId) return;
    try {
      setOperation("action");
      setError("");
      setSuccess("");
      await recordConsortiumCollectionAction({
        inmobiliariaId: activeInmobiliariaId,
        consortiumId,
        unitId: selectedUnitId,
        type: actionForm.type,
        channel: actionForm.channel,
        occurredOn: actionForm.occurredOn,
        outcome: actionForm.outcome,
        notes: actionForm.notes,
        promiseAmountMinor: majorToMinor(actionForm.promiseAmount),
        promiseDueDate: actionForm.promiseDueDate,
      });
      setActionForm((current) => ({ ...current, outcome: "", notes: "", promiseAmount: "" }));
      setSuccess("La gestión quedó registrada en el historial de la unidad.");
      await load();
    } catch (actionError) {
      setError(actionError.message || "No se pudo registrar la gestión.");
    } finally {
      setOperation("");
    }
  };

  const handleInterestSubmit = async (event) => {
    event.preventDefault();
    if (!interestPreview.totalInterestMinor || !selectedObligationIds.length) return;
    const confirmed = window.confirm(
      `Se generarán ${formatConsortiumMoney(interestPreview.totalInterestMinor, currency)} `
      + `de intereses en ${interestPreview.chargeableItems.length} obligación(es). ¿Confirmar?`,
    );
    if (!confirmed) return;
    try {
      setOperation("interest");
      setError("");
      setSuccess("");
      const result = await assessConsortiumInterests({
        inmobiliariaId: activeInmobiliariaId,
        consortiumId,
        obligationIds: selectedObligationIds,
        cutoffDate: interestCutoffDate,
      });
      setSuccess(
        `Se generaron ${formatConsortiumMoney(result.totalInterestMinor, currency)} `
        + `de intereses en ${result.count} obligación(es).`,
      );
      await load();
    } catch (interestError) {
      setError(interestError.message || "No se pudieron liquidar los intereses.");
    } finally {
      setOperation("");
    }
  };

  const handleAgreementSubmit = async (event) => {
    event.preventDefault();
    try {
      setOperation("agreement");
      setError("");
      setSuccess("");
      await createConsortiumPaymentAgreement({
        inmobiliariaId: activeInmobiliariaId,
        consortiumId,
        unitId: selectedUnitId,
        obligationIds: selectedObligationIds,
        agreementDate: agreementForm.agreementDate,
        agreedAmountMinor: majorToMinor(agreementForm.agreedAmount),
        downPaymentMinor: majorToMinor(agreementForm.downPayment),
        installmentCount: agreementForm.installmentCount,
        firstDueDate: agreementForm.firstDueDate,
        notes: agreementForm.notes,
      });
      setSuccess("Convenio registrado. Las deudas originales siguen abiertas hasta imputar pagos reales.");
      setAgreementForm((current) => ({ ...current, notes: "" }));
      await load();
    } catch (agreementError) {
      setError(agreementError.message || "No se pudo registrar el convenio.");
    } finally {
      setOperation("");
    }
  };

  const changeAgreementStatus = async (agreement, status) => {
    let reason = "";
    if (["defaulted", "cancelled"].includes(status)) {
      reason = window.prompt("Indicá el motivo del cambio de estado:", "")?.trim() || "";
      if (!reason) return;
    }
    try {
      setOperation(`status-${agreement.id}`);
      setError("");
      await updateConsortiumPaymentAgreementStatus({
        inmobiliariaId: activeInmobiliariaId,
        agreementId: agreement.id,
        status,
        reason,
      });
      setSuccess(`El convenio quedó marcado como ${agreementStatusLabels[status].toLowerCase()}.`);
      await load();
    } catch (statusError) {
      setError(statusError.message || "No se pudo actualizar el convenio.");
    } finally {
      setOperation("");
    }
  };

  if (agencyLoading || loading) return <main className="container py-5"><p>Cargando cobranzas…</p></main>;
  if (!consortium) return <main className="container py-5"><div className="alert alert-danger">{error || "No se encontró el consorcio."}</div></main>;

  return (
    <main className="container py-4 consortium-collections-page">
      <SEO title={`Cobranzas · ${consortium.name} | ONO Prop`} noIndex />
      <header className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
        <div>
          <Link className="text-decoration-none" to={`/admin/consorcios/${consortiumId}`}>← Volver al consorcio</Link>
          <h1 className="h3 mt-3 mb-1">Cobranzas</h1>
          <p className="text-muted mb-0">{consortium.name} · seguimiento de saldos y gestiones por unidad</p>
        </div>
        <div className="d-flex flex-wrap gap-2">
          <a className="btn btn-outline-primary" href="/guias/administracion-consorcios#cobranzas">Ver manual</a>
          <button
            className="btn btn-outline-success"
            type="button"
            disabled={!visibleRows.length}
            onClick={() => downloadCsv(buildConsortiumCollectionsCsv({ rows: visibleRows, currency }), consortium.name)}
          >
            Exportar vista CSV
          </button>
        </div>
      </header>

      {error && <div className="alert alert-danger">{error}</div>}
      {success && <div className="alert alert-success d-flex flex-wrap justify-content-between align-items-center gap-2"><span>{success}</span>{lastPaymentId && <Link className="btn btn-sm btn-success" to={`/admin/consorcios/${consortiumId}/recibos/${lastPaymentId}`}>Abrir recibo</Link>}</div>}
      {!canManage && <div className="alert alert-info">Tu rol permite consultar el tablero y los antecedentes, pero no registrar gestiones ni convenios.</div>}

      <section className={`alert ${interestPreview.policy.enabled ? "alert-light border" : "alert-warning"} d-flex flex-wrap justify-content-between align-items-center gap-3`}>
        <div>
          <strong className="d-block">Política de mora</strong>
          {interestPreview.policy.enabled
            ? <span>TNA {interestPreview.policy.annualRatePercent.toLocaleString("es-AR")}% · {interestPreview.policy.calculationMode === "compound" ? "capitalización diaria" : "interés simple diario"} · {interestPreview.policy.graceDays ? `${interestPreview.policy.graceDays} días de gracia` : "sin días de gracia"}</span>
            : <span>No se generan intereses mientras la política esté desactivada.</span>}
        </div>
        {canManage && <Link className="btn btn-sm btn-outline-primary" to={`/admin/consorcios/${consortiumId}/editar`}>Configurar</Link>}
      </section>

      <section className="row g-3 mb-4">
        <div className="col-sm-6 col-xl-3"><div className="card border-0 shadow-sm h-100"><div className="card-body"><span className="small text-muted text-uppercase">Exposición neta</span><strong className="fs-4 d-block consortium-money">{formatConsortiumMoney(dashboard.summary.netExposureMinor, currency)}</strong><small className="text-muted">Descontando créditos disponibles</small></div></div></div>
        <div className="col-sm-6 col-xl-3"><div className="card border-0 shadow-sm h-100"><div className="card-body"><span className="small text-muted text-uppercase">Deuda vencida</span><strong className="fs-4 d-block consortium-money text-danger">{formatConsortiumMoney(dashboard.summary.overdueMinor, currency)}</strong><small className="text-muted">{dashboard.summary.overdueUnitCount} unidades en mora</small></div></div></div>
        <div className="col-sm-6 col-xl-3"><div className="card border-0 shadow-sm h-100"><div className="card-body"><span className="small text-muted text-uppercase">A vencer</span><strong className="fs-4 d-block consortium-money">{formatConsortiumMoney(dashboard.summary.notDueMinor, currency)}</strong><small className="text-muted">Obligaciones aún no vencidas</small></div></div></div>
        <div className="col-sm-6 col-xl-3"><div className="card border-0 shadow-sm h-100"><div className="card-body"><span className="small text-muted text-uppercase">Convenios vigentes</span><strong className="fs-4 d-block">{agreements.filter((item) => item.status === "active").length}</strong><small className="text-muted">{dashboard.summary.debtorUnitCount} unidades con saldo</small></div></div></div>
      </section>

      <section className="card border-0 shadow-sm mb-4">
        <div className="card-body">
          <div className="row g-3 align-items-end mb-4">
            <div className="col-lg-4">
              <label className="form-label" htmlFor="collections-search">Buscar unidad o persona</label>
              <input id="collections-search" className="form-control" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Unidad, titular, ocupante, email…" />
            </div>
            <div className="col-md-4 col-lg-3">
              <label className="form-label" htmlFor="collections-aging">Antigüedad</label>
              <select id="collections-aging" className="form-select" value={agingFilter} onChange={(event) => setAgingFilter(event.target.value)}>
                <option value="all">Todas</option>
                <option value="overdue">Solo vencidas</option>
                {Object.entries(CONSORTIUM_AGING_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
            </div>
            <div className="col-md-4 col-lg-3">
              <label className="form-label" htmlFor="collections-management">Seguimiento</label>
              <select id="collections-management" className="form-select" value={managementFilter} onChange={(event) => setManagementFilter(event.target.value)}>
                <option value="all">Todos</option>
                <option value="without_action">Sin gestión registrada</option>
                <option value="promise">Última gestión: promesa</option>
                <option value="agreement">Con convenio vigente</option>
              </select>
            </div>
            <div className="col-md-4 col-lg-2">
              <label className="form-label" htmlFor="collections-sort">Ordenar</label>
              <select id="collections-sort" className="form-select" value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                <option value="overdue">Mayor mora</option>
                <option value="balance">Mayor saldo</option>
                <option value="days">Más días</option>
                <option value="unit">Unidad</option>
              </select>
            </div>
          </div>

          <div className="row g-2 mb-4">
            {Object.values(dashboard.buckets).map((bucket) => (
              <div className="col-6 col-lg" key={bucket.key}>
                <button className={`consortium-aging-card w-100 text-start ${agingFilter === bucket.key ? "active" : ""}`} type="button" onClick={() => setAgingFilter(bucket.key)}>
                  <span>{bucket.label}</span>
                  <strong className="consortium-money">{formatConsortiumMoney(bucket.amountMinor, currency)}</strong>
                  <small>{bucket.obligationCount} obligaciones</small>
                </button>
              </div>
            ))}
          </div>

          <div className="table-responsive">
            <table className="table align-middle mb-0 consortium-collections-table">
              <thead><tr><th>Unidad</th><th>Responsable</th><th>Antigüedad</th><th className="text-end">Saldo</th><th>Última gestión</th><th className="text-end">Acción</th></tr></thead>
              <tbody>
                {visibleRows.map((row) => (
                  <tr key={row.unitId} className={selectedUnitId === row.unitId ? "table-primary" : ""}>
                    <td><strong>{row.code}</strong>{row.activeAgreement && <span className="badge text-bg-info d-block mt-1">Convenio vigente</span>}</td>
                    <td><span className="d-block">{row.ownerName || row.occupantName || "Sin informar"}</span><small className="text-muted">{row.email || row.phone || "Sin contacto"}</small></td>
                    <td>{row.maxDaysPastDue > 0 ? <><span className="d-block text-danger fw-semibold">{row.maxDaysPastDue} días</span><small>{CONSORTIUM_AGING_LABELS[row.agingBucket]}</small></> : <span className="text-muted">A vencer</span>}</td>
                    <td className="text-end"><strong className="consortium-money">{formatConsortiumMoney(row.balanceMinor, currency)}</strong>{row.overdueBalanceMinor > 0 && <small className="d-block text-danger">Vencido: {formatConsortiumMoney(row.overdueBalanceMinor, currency)}</small>}</td>
                    <td>{row.latestAction ? <><span className="d-block">{actionTypeLabels[row.latestAction.type] || row.latestAction.type}</span><small className="text-muted">{formatDate(row.latestAction.occurredOn)}</small></> : <span className="text-muted">Sin gestión</span>}</td>
                    <td className="text-end"><button className="btn btn-sm btn-outline-primary" type="button" onClick={() => selectUnit(row)}>Ver ficha</button></td>
                  </tr>
                ))}
                {!visibleRows.length && <tr><td colSpan="6" className="text-center text-muted py-4">No hay saldos que coincidan con los filtros.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {selectedRow && (
        <section ref={detailRef} className="card border-0 shadow-sm consortium-collection-detail mb-4">
          <div className="card-header bg-white d-flex flex-wrap justify-content-between align-items-center gap-2 py-3">
            <div><h2 className="h5 mb-1">Ficha de cobranza · Unidad {selectedRow.code}</h2><span className="text-muted">{selectedUnit?.ownerName || selectedUnit?.occupantName || "Responsable sin informar"}</span></div>
            <Link className="btn btn-sm btn-outline-secondary" to={`/admin/consorcios/${consortiumId}/unidades/${selectedUnitId}/cuenta-corriente`}>Abrir cuenta corriente</Link>
          </div>
          <div className="card-body">
            <div className="row g-4">
              <div className="col-xl-7">
                <h3 className="h6">Obligaciones abiertas</h3>
                <div className="table-responsive mb-4"><table className="table table-sm align-middle"><thead><tr><th></th><th>Período</th><th>Vencimiento</th><th>Interés liquidado</th><th className="text-end">Saldo</th></tr></thead><tbody>{selectedObligations.map((item) => <tr key={item.id}><td>{canManage && <input className="form-check-input" type="checkbox" checked={selectedObligationIds.includes(item.id)} onChange={(event) => setSelectedObligationIds((current) => event.target.checked ? [...new Set([...current, item.id])] : current.filter((id) => id !== item.id))} aria-label={`Seleccionar deuda ${item.periodKey}`} />}</td><td>{item.periodKey || "Sin período"}</td><td>{formatDate(item.dueDate)}{interestPreview.policy.enabled && interestPreview.policy.graceDays > 0 && <small className="d-block text-muted">Gracia: {formatDate(addDays(item.dueDate, interestPreview.policy.graceDays))}</small>}</td><td>{Number(item.interestMinor || 0) > 0 ? <><span className="consortium-money">{formatConsortiumMoney(item.interestMinor, currency)}</span><small className="d-block text-muted">hasta {formatDate(item.interestAssessedThrough)}</small></> : <span className="text-muted">—</span>}</td><td className="text-end consortium-money">{formatConsortiumMoney(item.balanceMinor, currency)}</td></tr>)}</tbody><tfoot><tr className="fw-semibold"><td colSpan="4">Deuda seleccionada</td><td className="text-end consortium-money">{formatConsortiumMoney(selectedDebtMinor, currency)}</td></tr></tfoot></table></div>

                <h3 className="h6">Historial de gestiones</h3>
                <div className="consortium-collection-timeline">
                  {selectedActions.map((item) => <article className="border-start ps-3 pb-3" key={item.id}><div className="d-flex flex-wrap justify-content-between gap-2"><strong>{actionTypeLabels[item.type] || item.type}</strong><small className="text-muted">{formatDate(item.occurredOn)} · {channelLabels[item.channel] || item.channel}</small></div>{item.outcome && <p className="mb-1">{item.outcome}</p>}{item.notes && <p className="small text-muted mb-1">{item.notes}</p>}{item.type === "promise" && <small>Compromiso: {formatConsortiumMoney(item.promiseAmountMinor, currency)} para el {formatDate(item.promiseDueDate)}</small>}<small className="d-block text-muted">Registrado por {item.createdBySnapshot?.name || item.createdBySnapshot?.email || "usuario"} · {formatTimestamp(item.createdAt)}</small></article>)}
                  {!selectedActions.length && <p className="text-muted">Todavía no hay gestiones registradas.</p>}
                </div>
              </div>

              <div className="col-xl-5">
                {canManage && <form className="border border-success rounded-3 p-3 mb-4" onSubmit={handlePaymentSubmit}>
                  <div className="d-flex justify-content-between align-items-start gap-2 mb-2"><div><h3 className="h6 mb-1">Registrar cobro</h3><p className="small text-muted mb-0">Se imputa por vencimiento entre los períodos seleccionados, aunque estén cerrados.</p></div><button className="btn btn-sm btn-link" type="button" onClick={() => setPaymentForm((current) => ({ ...current, amount: minorToMajorInput(selectedDebtMinor) }))}>Usar deuda</button></div>
                  <div className="row g-2">
                    <div className="col-md-6"><label className="form-label">Importe recibido</label><input className="form-control" type="number" min="0.01" step="0.01" required value={paymentForm.amount} onChange={(event) => setPaymentForm((current) => ({ ...current, amount: event.target.value }))} /></div>
                    <div className="col-md-6"><label className="form-label">Fecha</label><input className="form-control" type="date" required value={paymentForm.date} onChange={(event) => setPaymentForm((current) => ({ ...current, date: event.target.value }))} /></div>
                    <div className="col-md-6"><label className="form-label">Medio</label><select className="form-select" value={paymentForm.method} onChange={(event) => setPaymentForm((current) => ({ ...current, method: event.target.value }))}>{CONSORTIUM_PAYMENT_METHODS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></div>
                    <div className="col-md-6"><label className="form-label">Ingresar fondos en</label><select className="form-select" value={paymentForm.treasuryAccountId} onChange={(event) => setPaymentForm((current) => ({ ...current, treasuryAccountId: event.target.value }))}><option value="">No afectar tesorería</option>{treasuryAccounts.filter((item) => item.active !== false).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
                    <div className="col-12"><label className="form-label">Referencia</label><input className="form-control" maxLength="220" value={paymentForm.reference} onChange={(event) => setPaymentForm((current) => ({ ...current, reference: event.target.value }))} /></div>
                    <div className="col-12"><label className="form-label">Observaciones</label><textarea className="form-control" rows="2" maxLength="1000" value={paymentForm.notes} onChange={(event) => setPaymentForm((current) => ({ ...current, notes: event.target.value }))} /></div>
                  </div>
                  {majorToMinor(paymentForm.amount) > selectedDebtMinor && <div className="alert alert-info py-2 small my-3">El excedente de {formatConsortiumMoney(majorToMinor(paymentForm.amount) - selectedDebtMinor, currency)} quedará como saldo a favor. Para hacerlo, deben estar seleccionados todos los períodos pendientes.</div>}
                  <button className="btn btn-success w-100 mt-3" type="submit" disabled={Boolean(operation) || !selectedObligationIds.length}>{operation === "payment" ? "Registrando…" : "Confirmar cobro e imputación"}</button>
                </form>}

                {canManage && interestPreview.policy.enabled && <form className="border border-warning rounded-3 p-3 mb-4" onSubmit={handleInterestSubmit}>
                  <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3"><div><h3 className="h6 mb-1">Liquidar intereses</h3><p className="small text-muted mb-0">La vista previa usa el saldo vigente. Nada se registra hasta confirmar.</p></div><strong className="consortium-money text-danger">{formatConsortiumMoney(interestPreview.totalInterestMinor, currency)}</strong></div>
                  <label className="form-label" htmlFor="interest-cutoff-date">Calcular hasta</label>
                  <input id="interest-cutoff-date" className="form-control mb-3" type="date" max={todayKey()} required value={interestCutoffDate} onChange={(event) => setInterestCutoffDate(event.target.value)} />
                  {interestPreview.items.length > 0 && <div className="table-responsive"><table className="table table-sm"><thead><tr><th>Período</th><th className="text-end">Días</th><th className="text-end">Interés</th></tr></thead><tbody>{interestPreview.items.map((item) => <tr key={item.obligationId}><td>{item.periodKey || "Sin período"}<small className="d-block text-muted">desde {formatDate(item.calculationFrom)}</small></td><td className="text-end">{item.days}</td><td className="text-end consortium-money">{formatConsortiumMoney(item.interestMinor, currency)}</td></tr>)}</tbody></table></div>}
                  {!selectedObligationIds.length && <p className="small text-muted">Seleccioná uno o más períodos de la tabla para ver el cálculo.</p>}
                  {selectedObligationIds.length > 0 && !interestPreview.totalInterestMinor && <div className="alert alert-light border py-2 small">No hay intereses nuevos para la fecha elegida.</div>}
                  <button className="btn btn-warning w-100" type="submit" disabled={Boolean(operation) || !interestPreview.totalInterestMinor}>{operation === "interest" ? "Generando…" : "Confirmar débitos de interés"}</button>
                </form>}

                {canManage && <form className="border rounded-3 p-3 mb-4" onSubmit={handleActionSubmit}>
                  <h3 className="h6">Registrar gestión</h3>
                  <div className="row g-2">
                    <div className="col-md-6"><label className="form-label">Tipo</label><select className="form-select" value={actionForm.type} onChange={(event) => setActionForm((current) => ({ ...current, type: event.target.value }))}><option value="contact">Contacto</option><option value="promise">Promesa de pago</option><option value="notice">Intimación / aviso</option><option value="note">Nota interna</option></select></div>
                    <div className="col-md-6"><label className="form-label">Canal</label><select className="form-select" value={actionForm.channel} onChange={(event) => setActionForm((current) => ({ ...current, channel: event.target.value }))}>{Object.entries(channelLabels).filter(([key]) => key !== "system").map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>
                    <div className="col-12"><label className="form-label">Fecha</label><input className="form-control" type="date" required value={actionForm.occurredOn} onChange={(event) => setActionForm((current) => ({ ...current, occurredOn: event.target.value }))} /></div>
                    {actionForm.type === "promise" && <><div className="col-md-6"><label className="form-label">Importe prometido</label><input className="form-control" type="number" min="0.01" step="0.01" required value={actionForm.promiseAmount} onChange={(event) => setActionForm((current) => ({ ...current, promiseAmount: event.target.value }))} /></div><div className="col-md-6"><label className="form-label">Fecha comprometida</label><input className="form-control" type="date" required value={actionForm.promiseDueDate} onChange={(event) => setActionForm((current) => ({ ...current, promiseDueDate: event.target.value }))} /></div></>}
                    <div className="col-12"><label className="form-label">Resultado</label><input className="form-control" maxLength="500" value={actionForm.outcome} onChange={(event) => setActionForm((current) => ({ ...current, outcome: event.target.value }))} placeholder="Ej.: respondió y solicitó detalle" /></div>
                    <div className="col-12"><label className="form-label">Observaciones</label><textarea className="form-control" rows="3" maxLength="3000" value={actionForm.notes} onChange={(event) => setActionForm((current) => ({ ...current, notes: event.target.value }))} /></div>
                    <div className="col-12"><button className="btn btn-primary w-100" type="submit" disabled={Boolean(operation)}>{operation === "action" ? "Guardando…" : "Guardar gestión"}</button></div>
                  </div>
                </form>}

                <div className="border rounded-3 p-3 mb-4">
                  <h3 className="h6">Convenios de pago</h3>
                  {selectedAgreements.map((item) => <article className="border-bottom pb-3 mb-3" key={item.id}><div className="d-flex justify-content-between gap-2"><strong>{formatConsortiumMoney(item.agreedAmountMinor, currency)}</strong><span className={`badge ${item.status === "active" ? "text-bg-info" : "text-bg-secondary"}`}>{agreementStatusLabels[item.status] || item.status}</span></div><small className="text-muted">{item.installmentCount} cuotas · desde {formatDate(item.firstDueDate)}</small>{item.notes && <p className="small mb-1 mt-2">{item.notes}</p>}<ol className="small mt-2 mb-2">{(item.schedule || []).map((installment) => <li key={installment.number}>{formatDate(installment.dueDate)} · {formatConsortiumMoney(installment.amountMinor, currency)}</li>)}</ol>{canManage && item.status === "active" && <div className="d-flex flex-wrap gap-1"><button className="btn btn-sm btn-outline-success" type="button" disabled={Boolean(operation)} onClick={() => changeAgreementStatus(item, "completed")}>Marcar cumplido</button><button className="btn btn-sm btn-outline-danger" type="button" disabled={Boolean(operation)} onClick={() => changeAgreementStatus(item, "defaulted")}>Incumplido</button><button className="btn btn-sm btn-outline-secondary" type="button" disabled={Boolean(operation)} onClick={() => changeAgreementStatus(item, "cancelled")}>Cancelar</button></div>}</article>)}
                  {!selectedAgreements.length && <p className="text-muted small mb-0">No hay convenios registrados.</p>}
                </div>

                {canManage && <form className="border rounded-3 p-3" onSubmit={handleAgreementSubmit}>
                  <h3 className="h6">Crear convenio</h3>
                  <p className="small text-muted">El convenio documenta la gestión, pero no cancela ni reemplaza saldos. La cuenta corriente cambia únicamente cuando se registra un pago real.</p>
                  <div className="row g-2">
                    <div className="col-md-6"><label className="form-label">Fecha</label><input className="form-control" type="date" required value={agreementForm.agreementDate} onChange={(event) => setAgreementForm((current) => ({ ...current, agreementDate: event.target.value }))} /></div>
                    <div className="col-md-6"><label className="form-label">Primer vencimiento</label><input className="form-control" type="date" required value={agreementForm.firstDueDate} onChange={(event) => setAgreementForm((current) => ({ ...current, firstDueDate: event.target.value }))} /></div>
                    <div className="col-md-6"><label className="form-label">Monto acordado</label><input className="form-control" type="number" min="0.01" step="0.01" required value={agreementForm.agreedAmount} onChange={(event) => setAgreementForm((current) => ({ ...current, agreedAmount: event.target.value }))} /></div>
                    <div className="col-md-6"><label className="form-label">Anticipo</label><input className="form-control" type="number" min="0" step="0.01" value={agreementForm.downPayment} onChange={(event) => setAgreementForm((current) => ({ ...current, downPayment: event.target.value }))} /></div>
                    <div className="col-12"><label className="form-label">Cantidad de cuotas</label><input className="form-control" type="number" min="1" max="60" required value={agreementForm.installmentCount} onChange={(event) => setAgreementForm((current) => ({ ...current, installmentCount: event.target.value }))} /></div>
                    <div className="col-12"><label className="form-label">Observaciones</label><textarea className="form-control" rows="2" value={agreementForm.notes} onChange={(event) => setAgreementForm((current) => ({ ...current, notes: event.target.value }))} /></div>
                  </div>
                  <div className="small bg-light rounded p-2 my-3"><strong>Plan:</strong> {agreementPreview.length} cuotas por un total de {formatConsortiumMoney(agreementPreview.reduce((sum, item) => sum + item.amountMinor, 0), currency)}.{selectedDebtMinor !== majorToMinor(agreementForm.agreedAmount) && <span className="d-block text-warning">La deuda seleccionada es {formatConsortiumMoney(selectedDebtMinor, currency)}; la diferencia quedará documentada como bonificación o recargo.</span>}</div>
                  <button className="btn btn-outline-primary w-100" type="submit" disabled={Boolean(operation) || !selectedObligationIds.length}>{operation === "agreement" ? "Creando…" : "Registrar convenio"}</button>
                </form>}
              </div>
            </div>
          </div>
        </section>
      )}
    </main>
  );
};

export default ConsortiumCollectionsPage;
