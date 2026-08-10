import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import SEO from "../../components/SEO";
import { useAuth } from "../../context/auth/useAuth";
import { useActiveInmobiliariaModules } from "../../inmobiliaria/hooks/useActiveInmobiliariaModules";
import ConsortiumExpenseDocumentsPanel from "../components/ConsortiumExpenseDocumentsPanel";
import ConsortiumPaymentReportsPanel from "../components/ConsortiumPaymentReportsPanel";
import {
  getInternalPermissions,
  getInternalRoleForInmobiliaria,
  isGlobalRoot,
} from "../../inmobiliaria/utils/inmobiliariaPermissions";
import {
  archiveConsortium,
  archiveConsortiumUnit,
  approveConsortiumPaymentReport,
  closeConsortiumPeriod,
  createConsortiumPeriod,
  createConsortiumUnit,
  getConsortiumById,
  getConsortiumExpenseDocuments,
  getConsortiumObligations,
  getConsortiumPaymentReports,
  getConsortiumPeriods,
  getConsortiumUnits,
  issueConsortiumPeriod,
  registerConsortiumPayment,
  rejectConsortiumPaymentReport,
  saveConsortiumPeriodExpenses,
  updateConsortiumUnit,
} from "../services/consorcio.service";
import {
  CONSORTIUM_DISTRIBUTION_MODES,
  CONSORTIUM_EXPENSE_CATEGORIES,
  CONSORTIUM_PAYMENT_METHODS,
  CONSORTIUM_UNIT_TYPES,
  getConsortiumPeriodStatus,
} from "../utils/consorcio.constants";
import {
  formatConsortiumMoney,
  getConsortiumObligationStatus,
  getConsortiumObligationStatusLabel,
  getConsortiumPeriodLabel,
  getDefaultConsortiumDueDate,
  majorToMinor,
  minorToMajorInput,
} from "../utils/consorcio.helpers";
import {
  createEmptyConsortiumExpense,
  createEmptyConsortiumUnit,
} from "../utils/consorcio.schema";
import "../consorcio.css";

const todayKey = () => new Date().toISOString().slice(0, 10);
const currentPeriodKey = () => todayKey().slice(0, 7);
const makeLocalId = () => globalThis.crypto?.randomUUID?.() || `expense_${Date.now()}_${Math.random()}`;

const ConsortiumDetailPage = () => {
  const { id: consortiumId = "" } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { activeInmobiliariaId, loading: agencyLoading } = useActiveInmobiliariaModules();
  const [consortium, setConsortium] = useState(null);
  const [units, setUnits] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [obligations, setObligations] = useState([]);
  const [expenseDocuments, setExpenseDocuments] = useState([]);
  const [paymentReports, setPaymentReports] = useState([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState("");
  const [periodExpenses, setPeriodExpenses] = useState([]);
  const [unitForm, setUnitForm] = useState(createEmptyConsortiumUnit);
  const [editingUnitId, setEditingUnitId] = useState("");
  const [expenseForm, setExpenseForm] = useState(() => ({
    ...createEmptyConsortiumExpense(),
    amountMajor: "",
  }));
  const [newPeriodKey, setNewPeriodKey] = useState(currentPeriodKey);
  const [newDueDate, setNewDueDate] = useState("");
  const [paymentForm, setPaymentForm] = useState({
    obligationId: "",
    amountMajor: "",
    date: todayKey(),
    method: "transfer",
    reference: "",
    notes: "",
  });
  const [loading, setLoading] = useState(true);
  const [operation, setOperation] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [lastPaymentId, setLastPaymentId] = useState("");

  const canManage = useMemo(() => {
    const role = getInternalRoleForInmobiliaria(user, activeInmobiliariaId);
    return getInternalPermissions(role, isGlobalRoot(user)).canManageConsortiums;
  }, [activeInmobiliariaId, user]);

  const load = useCallback(async () => {
    if (!activeInmobiliariaId || !consortiumId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError("");
      const [
        consortiumData,
        unitData,
        periodData,
        obligationData,
        expenseDocumentData,
        paymentReportData,
      ] = await Promise.all([
        getConsortiumById(activeInmobiliariaId, consortiumId),
        getConsortiumUnits(activeInmobiliariaId, consortiumId),
        getConsortiumPeriods(activeInmobiliariaId, consortiumId),
        getConsortiumObligations(activeInmobiliariaId, { consortiumId }),
        getConsortiumExpenseDocuments(activeInmobiliariaId, { consortiumId }),
        getConsortiumPaymentReports(activeInmobiliariaId, { consortiumId }),
      ]);
      if (!consortiumData) throw new Error("El consorcio no existe.");
      setConsortium(consortiumData);
      setUnits(unitData);
      setPeriods(periodData);
      setObligations(obligationData);
      setExpenseDocuments(expenseDocumentData);
      setPaymentReports(paymentReportData);
      setSelectedPeriodId((current) => (
        current && periodData.some((item) => item.id === current)
          ? current
          : periodData[0]?.id || ""
      ));
    } catch (loadError) {
      setError(loadError.message || "No se pudo cargar el consorcio.");
    } finally {
      setLoading(false);
    }
  }, [activeInmobiliariaId, consortiumId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!consortium) return;
    setNewDueDate(getDefaultConsortiumDueDate(newPeriodKey, consortium.dueDay));
  }, [consortium, newPeriodKey]);

  const selectedPeriod = useMemo(
    () => periods.find((item) => item.id === selectedPeriodId) || null,
    [periods, selectedPeriodId],
  );

  useEffect(() => {
    setPeriodExpenses(Array.isArray(selectedPeriod?.expenses) ? selectedPeriod.expenses : []);
    setPaymentForm((current) => ({ ...current, obligationId: "", amountMajor: "" }));
  }, [selectedPeriod]);

  const selectedObligations = useMemo(
    () => obligations.filter((item) => item.periodId === selectedPeriodId),
    [obligations, selectedPeriodId],
  );

  const selectedExpenseDocuments = useMemo(
    () => expenseDocuments.filter((item) => item.periodId === selectedPeriodId),
    [expenseDocuments, selectedPeriodId],
  );

  const activeUnits = useMemo(
    () => units.filter((item) => item.active !== false && item.deleted !== true),
    [units],
  );

  const totalCoefficient = useMemo(
    () => activeUnits.reduce((sum, unit) => sum + Number(unit.coefficient || 0), 0),
    [activeUnits],
  );

  const periodSummary = useMemo(() => ({
    total: selectedObligations.reduce((sum, item) => sum + Number(item.totalAmountMinor || 0), 0),
    paid: selectedObligations.reduce((sum, item) => sum + Number(item.paidAmountMinor || 0), 0),
    balance: selectedObligations.reduce((sum, item) => sum + Number(item.balanceMinor || 0), 0),
    overdue: selectedObligations.filter((item) => getConsortiumObligationStatus(item) === "overdue").length,
  }), [selectedObligations]);

  const resetMessages = () => {
    setError("");
    setSuccess("");
    setLastPaymentId("");
  };

  const resetUnitForm = () => {
    setEditingUnitId("");
    setUnitForm({ ...createEmptyConsortiumUnit(), consortiumId });
  };

  const submitUnit = async (event) => {
    event.preventDefault();
    try {
      resetMessages();
      setOperation("unit");
      if (editingUnitId) {
        await updateConsortiumUnit(activeInmobiliariaId, editingUnitId, { ...unitForm, consortiumId });
        setSuccess("Unidad actualizada.");
      } else {
        await createConsortiumUnit(activeInmobiliariaId, consortiumId, unitForm);
        setSuccess("Unidad creada.");
      }
      resetUnitForm();
      await load();
    } catch (saveError) {
      setError(saveError.message || "No se pudo guardar la unidad.");
    } finally {
      setOperation("");
    }
  };

  const editUnit = (unit) => {
    setEditingUnitId(unit.id);
    setUnitForm({ ...createEmptyConsortiumUnit(), ...unit });
    document.getElementById("consortium-unit-form")?.scrollIntoView({ behavior: "smooth" });
  };

  const removeUnit = async (unit) => {
    if (!window.confirm(`¿Archivar la unidad ${unit.code}? El historial emitido se conservará.`)) return;
    try {
      resetMessages();
      setOperation(`archive-unit-${unit.id}`);
      await archiveConsortiumUnit(activeInmobiliariaId, unit.id);
      setSuccess("Unidad archivada.");
      await load();
    } catch (removeError) {
      setError(removeError.message || "No se pudo archivar la unidad.");
    } finally {
      setOperation("");
    }
  };

  const createPeriod = async (event) => {
    event.preventDefault();
    try {
      resetMessages();
      setOperation("create-period");
      const periodId = await createConsortiumPeriod({
        inmobiliariaId: activeInmobiliariaId,
        consortiumId,
        periodKey: newPeriodKey,
        dueDate: newDueDate,
        currency: consortium.currency || "ARS",
      });
      setSelectedPeriodId(periodId);
      setSuccess("Liquidación mensual creada como borrador.");
      await load();
      setSelectedPeriodId(periodId);
    } catch (periodError) {
      setError(periodError.message || "No se pudo crear el período.");
    } finally {
      setOperation("");
    }
  };

  const addExpense = (event) => {
    event.preventDefault();
    resetMessages();
    const amountMinor = majorToMinor(expenseForm.amountMajor);
    if (!expenseForm.concept.trim() || amountMinor <= 0) {
      setError("Ingresá el concepto y un importe mayor a cero.");
      return;
    }
    if (expenseForm.distributionMode === "specific" && !expenseForm.specificUnitId) {
      setError("Seleccioná la unidad a la que corresponde el cargo.");
      return;
    }
    setPeriodExpenses((current) => [...current, {
      ...expenseForm,
      id: makeLocalId(),
      amountMinor,
    }]);
    setExpenseForm({ ...createEmptyConsortiumExpense(), amountMajor: "" });
  };

  const saveExpenses = async ({ showSuccess = true } = {}) => {
    if (!selectedPeriod) throw new Error("Seleccioná una liquidación.");
    await saveConsortiumPeriodExpenses({
      inmobiliariaId: activeInmobiliariaId,
      periodId: selectedPeriod.id,
      expenses: periodExpenses,
    });
    if (showSuccess) setSuccess("Gastos guardados en el borrador.");
  };

  const handleSaveExpenses = async () => {
    try {
      resetMessages();
      setOperation("save-expenses");
      await saveExpenses();
      await load();
    } catch (saveError) {
      setError(saveError.message || "No se pudieron guardar los gastos.");
    } finally {
      setOperation("");
    }
  };

  const issuePeriod = async () => {
    if (!window.confirm("Al emitir se generará la deuda de cada unidad y ya no podrás modificar los gastos. ¿Continuar?")) return;
    try {
      resetMessages();
      setOperation("issue-period");
      await saveExpenses({ showSuccess: false });
      const result = await issueConsortiumPeriod({
        inmobiliariaId: activeInmobiliariaId,
        periodId: selectedPeriod.id,
      });
      setSuccess(`Liquidación emitida para ${result.unitCount} unidades.`);
      await load();
    } catch (issueError) {
      setError(issueError.message || "No se pudo emitir la liquidación.");
    } finally {
      setOperation("");
    }
  };

  const selectPayment = (obligation) => {
    setPaymentForm({
      obligationId: obligation.id,
      amountMajor: minorToMajorInput(obligation.balanceMinor),
      date: todayKey(),
      method: "transfer",
      reference: "",
      notes: "",
    });
    document.getElementById("consortium-payment-form")?.scrollIntoView({ behavior: "smooth" });
  };

  const submitPayment = async (event) => {
    event.preventDefault();
    try {
      resetMessages();
      setOperation("payment");
      const paymentId = await registerConsortiumPayment({
        inmobiliariaId: activeInmobiliariaId,
        obligationId: paymentForm.obligationId,
        amountMinor: majorToMinor(paymentForm.amountMajor),
        date: paymentForm.date,
        method: paymentForm.method,
        reference: paymentForm.reference,
        notes: paymentForm.notes,
      });
      setLastPaymentId(paymentId);
      setSuccess("Cobro registrado. Ya podés abrir el recibo.");
      setPaymentForm((current) => ({ ...current, obligationId: "", amountMajor: "", reference: "", notes: "" }));
      await load();
    } catch (paymentError) {
      setError(paymentError.message || "No se pudo registrar el cobro.");
    } finally {
      setOperation("");
    }
  };

  const approvePaymentReport = async (report) => {
    if (!window.confirm(`¿Validar el pago informado por la unidad ${report.unitSnapshot?.code || report.unitId}? La deuda se actualizará inmediatamente.`)) return;
    try {
      resetMessages();
      setOperation(`approve-report-${report.id}`);
      const paymentId = await approveConsortiumPaymentReport({
        inmobiliariaId: activeInmobiliariaId,
        reportId: report.id,
      });
      setLastPaymentId(paymentId);
      setSuccess("Pago validado y aplicado a la cuenta corriente.");
      await load();
    } catch (approvalError) {
      setError(approvalError.message || "No se pudo validar el pago informado.");
    } finally {
      setOperation("");
    }
  };

  const rejectPaymentReport = async (report) => {
    const reason = window.prompt("Motivo del rechazo del pago informado:");
    if (!reason) return;
    try {
      resetMessages();
      setOperation(`reject-report-${report.id}`);
      await rejectConsortiumPaymentReport({
        inmobiliariaId: activeInmobiliariaId,
        reportId: report.id,
        reason,
      });
      setSuccess("Pago informado rechazado con trazabilidad.");
      await load();
    } catch (rejectionError) {
      setError(rejectionError.message || "No se pudo rechazar el pago informado.");
    } finally {
      setOperation("");
    }
  };

  const closePeriod = async () => {
    try {
      resetMessages();
      setOperation("close-period");
      await closeConsortiumPeriod({ inmobiliariaId: activeInmobiliariaId, periodId: selectedPeriod.id });
      setSuccess("Período cerrado sin saldos pendientes.");
      await load();
    } catch (closeError) {
      setError(closeError.message || "No se pudo cerrar el período.");
    } finally {
      setOperation("");
    }
  };

  const handleArchiveConsortium = async () => {
    if (!window.confirm("¿Archivar el consorcio? Los movimientos históricos se conservarán.")) return;
    try {
      setOperation("archive-consortium");
      await archiveConsortium(activeInmobiliariaId, consortiumId);
      navigate("/admin/consorcios");
    } catch (archiveError) {
      setError(archiveError.message || "No se pudo archivar el consorcio.");
    } finally {
      setOperation("");
    }
  };

  if (loading || agencyLoading) return <main className="container py-5 text-center">Cargando consorcio...</main>;
  if (!consortium) return <main className="container py-5"><div className="alert alert-danger">{error || "El consorcio no existe."}</div></main>;

  const periodState = getConsortiumPeriodStatus(selectedPeriod?.status);
  const draftTotal = periodExpenses.reduce((sum, item) => sum + Number(item.amountMinor || 0), 0);

  return (
    <main className="container py-4 consortium-workspace">
      <SEO title={`${consortium.name} | Consorcios | ONO Prop`} noIndex />
      <header className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
        <div>
          <Link className="text-decoration-none" to="/admin/consorcios">← Consorcios</Link>
          <h1 className="h3 mt-3 mb-1">{consortium.name}</h1>
          <p className="text-muted mb-0">{consortium.address}{consortium.city ? ` · ${consortium.city}` : ""}</p>
        </div>
        <div className="d-flex flex-wrap gap-2">
          {canManage && <Link className="btn btn-outline-secondary" to={`/admin/consorcios/${consortiumId}/editar`}>Editar consorcio</Link>}
          {canManage && consortium.status !== "archived" && (
            <button className="btn btn-outline-danger" type="button" disabled={Boolean(operation)} onClick={handleArchiveConsortium}>Archivar</button>
          )}
        </div>
      </header>

      {error && <div className="alert alert-danger">{error}</div>}
      {success && (
        <div className="alert alert-success d-flex flex-wrap justify-content-between align-items-center gap-2">
          <span>{success}</span>
          {lastPaymentId && (
            <Link className="btn btn-sm btn-success" to={`/admin/consorcios/${consortiumId}/recibos/${lastPaymentId}`}>Abrir recibo</Link>
          )}
        </div>
      )}
      {!canManage && <div className="alert alert-info">Tu rol permite consultar unidades, liquidaciones y cuentas corrientes, pero no registrar ni modificar movimientos.</div>}

      <section className="row g-3 mb-4">
        <div className="col-sm-6 col-xl-3"><div className="card border-0 shadow-sm h-100"><div className="card-body"><span className="small text-muted text-uppercase">Unidades activas</span><strong className="fs-4 d-block">{activeUnits.length}</strong></div></div></div>
        <div className="col-sm-6 col-xl-3"><div className="card border-0 shadow-sm h-100"><div className="card-body"><span className="small text-muted text-uppercase">Coeficientes</span><strong className="fs-4 d-block">{totalCoefficient.toLocaleString("es-AR", { maximumFractionDigits: 6 })}</strong><small className={Math.abs(totalCoefficient - 100) < 0.001 ? "text-success" : "text-warning"}>{Math.abs(totalCoefficient - 100) < 0.001 ? "Suman 100" : "Se normalizan al liquidar"}</small></div></div></div>
        <div className="col-sm-6 col-xl-3"><div className="card border-0 shadow-sm h-100"><div className="card-body"><span className="small text-muted text-uppercase">Saldo seleccionado</span><strong className="fs-4 d-block consortium-money">{formatConsortiumMoney(periodSummary.balance, consortium.currency)}</strong></div></div></div>
        <div className="col-sm-6 col-xl-3"><div className="card border-0 shadow-sm h-100"><div className="card-body"><span className="small text-muted text-uppercase">Vencidas</span><strong className="fs-4 d-block">{periodSummary.overdue}</strong></div></div></div>
      </section>

      <section className="card border-0 shadow-sm mb-4 consortium-section-anchor" id="unidades">
        <div className="card-body p-4">
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
            <div><h2 className="h5 mb-1">Unidades funcionales</h2><p className="text-muted small mb-0">El coeficiente se usa como peso relativo y no necesita sumar exactamente 100.</p></div>
            <span className="badge text-bg-light border">{activeUnits.length} activas</span>
          </div>
          <div className="table-responsive mb-4">
            <table className="table table-hover consortium-unit-table">
              <thead><tr><th>Unidad</th><th>Tipo</th><th>Coeficiente</th><th>Titular / ocupante</th><th>Contacto</th><th className="text-end">Acciones</th></tr></thead>
              <tbody>
                {activeUnits.map((unit) => (
                  <tr key={unit.id}>
                    <td><strong>{unit.code}</strong><div className="small text-muted">{[unit.floor && `Piso ${unit.floor}`, unit.apartment && `Dpto. ${unit.apartment}`].filter(Boolean).join(" · ")}</div></td>
                    <td>{CONSORTIUM_UNIT_TYPES.find((item) => item.id === unit.type)?.label || unit.type}</td>
                    <td>{Number(unit.coefficient || 0).toLocaleString("es-AR", { maximumFractionDigits: 6 })}</td>
                    <td><div>{unit.ownerName || "Titular no informado"}</div><small className="text-muted">{unit.occupantName || "Sin ocupante informado"}</small></td>
                    <td><div>{unit.email || ""}</div><small className="text-muted">{unit.phone || ""}</small>{Array.isArray(unit.portalEmails) && unit.portalEmails.length > 0 && <small className="d-block text-success">Portal: {unit.portalEmails.length} acceso(s)</small>}</td>
                    <td className="text-end">
                      <div className="btn-group btn-group-sm">
                        <Link className="btn btn-outline-success" to={`/admin/consorcios/${consortiumId}/unidades/${unit.id}/cuenta-corriente`}>Cuenta</Link>
                        {canManage && <button className="btn btn-outline-secondary" type="button" onClick={() => editUnit(unit)}>Editar</button>}
                        {canManage && <button className="btn btn-outline-danger" type="button" disabled={operation === `archive-unit-${unit.id}`} onClick={() => removeUnit(unit)}>Archivar</button>}
                      </div>
                    </td>
                  </tr>
                ))}
                {!activeUnits.length && <tr><td className="text-center text-muted py-4" colSpan="6">Cargá la primera unidad funcional.</td></tr>}
              </tbody>
            </table>
          </div>

          {canManage && <form id="consortium-unit-form" className="rounded border bg-light p-3" onSubmit={submitUnit}>
            <div className="d-flex justify-content-between align-items-center mb-3"><h3 className="h6 mb-0">{editingUnitId ? "Editar unidad" : "Agregar unidad"}</h3>{editingUnitId && <button className="btn btn-sm btn-link" type="button" onClick={resetUnitForm}>Cancelar edición</button>}</div>
            <div className="row g-3">
              <div className="col-md-3"><label className="form-label">Identificador *</label><input className="form-control" placeholder="Ej. 2 B" value={unitForm.code} onChange={(e) => setUnitForm((c) => ({ ...c, code: e.target.value }))} required /></div>
              <div className="col-md-2"><label className="form-label">Piso</label><input className="form-control" value={unitForm.floor} onChange={(e) => setUnitForm((c) => ({ ...c, floor: e.target.value }))} /></div>
              <div className="col-md-2"><label className="form-label">Departamento</label><input className="form-control" value={unitForm.apartment} onChange={(e) => setUnitForm((c) => ({ ...c, apartment: e.target.value }))} /></div>
              <div className="col-md-3"><label className="form-label">Tipo</label><select className="form-select" value={unitForm.type} onChange={(e) => setUnitForm((c) => ({ ...c, type: e.target.value }))}>{CONSORTIUM_UNIT_TYPES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></div>
              <div className="col-md-2"><label className="form-label">Coeficiente</label><input className="form-control" type="number" min="0" step="0.000001" value={unitForm.coefficient} onChange={(e) => setUnitForm((c) => ({ ...c, coefficient: e.target.value }))} /></div>
              <div className="col-md-4"><label className="form-label">Propietario / titular</label><input className="form-control" value={unitForm.ownerName} onChange={(e) => setUnitForm((c) => ({ ...c, ownerName: e.target.value }))} /></div>
              <div className="col-md-3"><label className="form-label">CUIT / DNI titular</label><input className="form-control" value={unitForm.ownerTaxId} onChange={(e) => setUnitForm((c) => ({ ...c, ownerTaxId: e.target.value }))} /></div>
              <div className="col-md-5"><label className="form-label">Ocupante</label><input className="form-control" value={unitForm.occupantName} onChange={(e) => setUnitForm((c) => ({ ...c, occupantName: e.target.value }))} /></div>
              <div className="col-md-4"><label className="form-label">Email</label><input className="form-control" type="email" value={unitForm.email} onChange={(e) => setUnitForm((c) => ({ ...c, email: e.target.value }))} /></div>
              <div className="col-md-4"><label className="form-label">Teléfono</label><input className="form-control" value={unitForm.phone} onChange={(e) => setUnitForm((c) => ({ ...c, phone: e.target.value }))} /></div>
              <div className="col-md-8"><label className="form-label">Emails habilitados para Mi consorcio</label><textarea className="form-control" rows="2" placeholder="Un email por línea" value={(unitForm.portalEmails || []).join("\n")} onChange={(e) => setUnitForm((c) => ({ ...c, portalEmails: e.target.value.split(/[\n,;]+/) }))} /><small className="text-muted">Deben coincidir con emails verificados de usuarios de ONO Prop.</small></div>
              <div className="col-md-4 d-flex align-items-end justify-content-end"><button className="btn btn-primary" disabled={operation === "unit"} type="submit">{operation === "unit" ? "Guardando..." : editingUnitId ? "Guardar cambios" : "Agregar unidad"}</button></div>
            </div>
          </form>}
        </div>
      </section>

      <section className="card border-0 shadow-sm mb-4 consortium-section-anchor" id="liquidaciones">
        <div className="card-body p-4">
          <h2 className="h5">Liquidaciones mensuales</h2>
          {canManage && <form className="row g-3 align-items-end mb-4" onSubmit={createPeriod}>
            <div className="col-md-4"><label className="form-label">Período a liquidar</label><input className="form-control" type="month" value={newPeriodKey} onChange={(e) => setNewPeriodKey(e.target.value)} required /></div>
            <div className="col-md-4"><label className="form-label">Vencimiento</label><input className="form-control" type="date" value={newDueDate} onChange={(e) => setNewDueDate(e.target.value)} required /></div>
            <div className="col-md-4"><button className="btn btn-outline-primary w-100" disabled={operation === "create-period"} type="submit">Crear borrador mensual</button></div>
          </form>}
          <div className="row g-3 align-items-end">
            <div className="col-lg-8"><label className="form-label" htmlFor="selected-consortium-period">Liquidación seleccionada</label><select id="selected-consortium-period" className="form-select" value={selectedPeriodId} onChange={(e) => setSelectedPeriodId(e.target.value)}><option value="">Seleccionar...</option>{periods.map((period) => <option key={period.id} value={period.id}>{getConsortiumPeriodLabel(period.periodKey)} · {getConsortiumPeriodStatus(period.status).label}</option>)}</select></div>
            {selectedPeriod && <div className="col-lg-4"><span className={`badge ${periodState.badge} me-2`}>{periodState.label}</span><span className="text-muted small">Vence {selectedPeriod.dueDate}</span></div>}
          </div>
        </div>
      </section>

      {canManage && selectedPeriod?.status === "draft" && (
        <section className="card border-0 shadow-sm mb-4">
          <div className="card-body p-4">
            <div className="d-flex flex-wrap justify-content-between gap-2 mb-3"><div><h2 className="h5 mb-1">Gastos del borrador</h2><p className="text-muted small mb-0">Cada gasto puede prorratearse por coeficiente, partes iguales o una unidad determinada.</p></div><strong className="consortium-money">Total: {formatConsortiumMoney(draftTotal, selectedPeriod.currency)}</strong></div>
            <div className="row g-4">
              <div className="col-lg-5">
                <form className="rounded border bg-light p-3" onSubmit={addExpense}>
                  <h3 className="h6">Agregar gasto</h3>
                  <div className="mb-3"><label className="form-label">Concepto *</label><input className="form-control" value={expenseForm.concept} onChange={(e) => setExpenseForm((c) => ({ ...c, concept: e.target.value }))} required /></div>
                  <div className="row g-3 mb-3"><div className="col-md-6"><label className="form-label">Tipo</label><select className="form-select" value={expenseForm.category} onChange={(e) => setExpenseForm((c) => ({ ...c, category: e.target.value }))}>{CONSORTIUM_EXPENSE_CATEGORIES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></div><div className="col-md-6"><label className="form-label">Importe</label><input className="form-control" inputMode="decimal" placeholder="0,00" value={expenseForm.amountMajor} onChange={(e) => setExpenseForm((c) => ({ ...c, amountMajor: e.target.value }))} required /></div></div>
                  <div className="mb-3"><label className="form-label">Distribución</label><select className="form-select" value={expenseForm.distributionMode} onChange={(e) => setExpenseForm((c) => ({ ...c, distributionMode: e.target.value, specificUnitId: "" }))}>{CONSORTIUM_DISTRIBUTION_MODES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></div>
                  {expenseForm.distributionMode === "specific" && <div className="mb-3"><label className="form-label">Unidad</label><select className="form-select" value={expenseForm.specificUnitId} onChange={(e) => setExpenseForm((c) => ({ ...c, specificUnitId: e.target.value }))}><option value="">Seleccionar...</option>{activeUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.code}</option>)}</select></div>}
                  <div className="mb-3"><label className="form-label">Notas</label><input className="form-control" value={expenseForm.notes} onChange={(e) => setExpenseForm((c) => ({ ...c, notes: e.target.value }))} /></div>
                  <button className="btn btn-outline-primary w-100" type="submit">Agregar al borrador</button>
                </form>
              </div>
              <div className="col-lg-7">
                <div className="list-group consortium-expense-list mb-3">
                  {periodExpenses.map((expense) => (
                    <div className="list-group-item" key={expense.id}>
                      <div className="d-flex justify-content-between gap-3"><div><strong>{expense.concept}</strong><div className="small text-muted">{CONSORTIUM_EXPENSE_CATEGORIES.find((item) => item.id === expense.category)?.label} · {CONSORTIUM_DISTRIBUTION_MODES.find((item) => item.id === expense.distributionMode)?.label}</div></div><div className="text-end"><strong className="consortium-money">{formatConsortiumMoney(expense.amountMinor, selectedPeriod.currency)}</strong><div><button className="btn btn-sm btn-link text-danger p-0" type="button" onClick={() => setPeriodExpenses((current) => current.filter((item) => item.id !== expense.id))}>Quitar</button></div></div></div>
                    </div>
                  ))}
                  {!periodExpenses.length && <div className="list-group-item text-center text-muted py-4">Todavía no hay gastos.</div>}
                </div>
                <div className="d-flex flex-wrap justify-content-end gap-2"><button className="btn btn-outline-secondary" disabled={Boolean(operation)} type="button" onClick={handleSaveExpenses}>Guardar borrador</button><button className="btn btn-primary" disabled={Boolean(operation) || !periodExpenses.length || !activeUnits.length} type="button" onClick={issuePeriod}>Emitir expensas</button></div>
              </div>
            </div>
          </div>
        </section>
      )}

      {selectedPeriod && (
        <ConsortiumExpenseDocumentsPanel
          inmobiliariaId={activeInmobiliariaId}
          consortiumId={consortiumId}
          period={selectedPeriod}
          expenses={selectedPeriod.status === "draft" ? periodExpenses : selectedPeriod.expenses || []}
          documents={selectedExpenseDocuments}
          canManage={canManage}
          beforeUpload={selectedPeriod.status === "draft" ? () => saveExpenses({ showSuccess: false }) : undefined}
          onChanged={load}
        />
      )}

      {selectedPeriod && selectedPeriod.status !== "draft" && (
        <section className="card border-0 shadow-sm mb-4">
          <div className="card-body p-4">
            <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3"><div><h2 className="h5 mb-1">Expensas emitidas · {getConsortiumPeriodLabel(selectedPeriod.periodKey)}</h2><p className="text-muted small mb-0">Total {formatConsortiumMoney(periodSummary.total, selectedPeriod.currency)} · cobrado {formatConsortiumMoney(periodSummary.paid, selectedPeriod.currency)} · saldo {formatConsortiumMoney(periodSummary.balance, selectedPeriod.currency)}</p></div>{canManage && selectedPeriod.status === "issued" && periodSummary.balance <= 0 && <button className="btn btn-outline-success" disabled={operation === "close-period"} type="button" onClick={closePeriod}>Cerrar período</button>}</div>
            <ConsortiumPaymentReportsPanel
              reports={paymentReports}
              periodId={selectedPeriod.id}
              canManage={canManage}
              operation={operation}
              onApprove={approvePaymentReport}
              onReject={rejectPaymentReport}
            />
            <div className="table-responsive">
              <table className="table table-hover">
                <thead><tr><th>Unidad</th><th>Ordinarias</th><th>Extraordinarias</th><th>Total</th><th>Cobrado</th><th>Saldo</th><th>Estado</th><th className="text-end">Acciones</th></tr></thead>
                <tbody>
                  {selectedObligations.map((obligation) => {
                    const status = getConsortiumObligationStatus(obligation);
                    const state = getConsortiumObligationStatusLabel(status);
                    return <tr key={obligation.id}><td><strong>{obligation.unitSnapshot?.code || obligation.unitId}</strong><div className="small text-muted">{obligation.unitSnapshot?.ownerName || obligation.unitSnapshot?.occupantName || "Sin responsable"}</div></td><td className="consortium-money">{formatConsortiumMoney(obligation.ordinaryMinor, obligation.currency)}</td><td className="consortium-money">{formatConsortiumMoney(obligation.extraordinaryMinor, obligation.currency)}</td><td className="consortium-money">{formatConsortiumMoney(obligation.totalAmountMinor, obligation.currency)}</td><td className="consortium-money">{formatConsortiumMoney(obligation.paidAmountMinor, obligation.currency)}</td><td className="consortium-money fw-semibold">{formatConsortiumMoney(obligation.balanceMinor, obligation.currency)}</td><td><span className={`badge ${state.badge}`}>{state.label}</span></td><td className="text-end"><div className="btn-group btn-group-sm"><Link className="btn btn-outline-primary" to={`/admin/consorcios/${consortiumId}/liquidaciones/${obligation.id}`}>Liquidación</Link><Link className="btn btn-outline-secondary" to={`/admin/consorcios/${consortiumId}/unidades/${obligation.unitId}/cuenta-corriente`}>Cuenta</Link>{canManage && Number(obligation.balanceMinor || 0) > 0 && selectedPeriod.status !== "closed" && <button className="btn btn-outline-success" type="button" onClick={() => selectPayment(obligation)}>Cobrar</button>}</div></td></tr>;
                  })}
                </tbody>
              </table>
            </div>

            {canManage && paymentForm.obligationId && (
              <form id="consortium-payment-form" className="rounded border bg-light p-3 mt-4" onSubmit={submitPayment}>
                <div className="d-flex justify-content-between align-items-center mb-3"><h3 className="h6 mb-0">Registrar cobro</h3><button className="btn btn-sm btn-link" type="button" onClick={() => setPaymentForm((c) => ({ ...c, obligationId: "" }))}>Cancelar</button></div>
                <div className="row g-3"><div className="col-md-3"><label className="form-label">Importe</label><input className="form-control" inputMode="decimal" value={paymentForm.amountMajor} onChange={(e) => setPaymentForm((c) => ({ ...c, amountMajor: e.target.value }))} required /></div><div className="col-md-3"><label className="form-label">Fecha</label><input className="form-control" type="date" value={paymentForm.date} onChange={(e) => setPaymentForm((c) => ({ ...c, date: e.target.value }))} required /></div><div className="col-md-3"><label className="form-label">Medio</label><select className="form-select" value={paymentForm.method} onChange={(e) => setPaymentForm((c) => ({ ...c, method: e.target.value }))}>{CONSORTIUM_PAYMENT_METHODS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></div><div className="col-md-3"><label className="form-label">Referencia</label><input className="form-control" value={paymentForm.reference} onChange={(e) => setPaymentForm((c) => ({ ...c, reference: e.target.value }))} /></div><div className="col-12"><label className="form-label">Observaciones</label><input className="form-control" value={paymentForm.notes} onChange={(e) => setPaymentForm((c) => ({ ...c, notes: e.target.value }))} /></div><div className="col-12 text-end"><button className="btn btn-success" disabled={operation === "payment"} type="submit">Confirmar cobro</button></div></div>
              </form>
            )}
          </div>
        </section>
      )}
    </main>
  );
};

export default ConsortiumDetailPage;
