import { useCallback, useEffect, useMemo, useState } from "react";

import SEO from "../../components/SEO";
import { useAuth } from "../../context/auth/useAuth";
import ConsortiumExpenseDocumentsPanel from "../components/ConsortiumExpenseDocumentsPanel";
import ConsortiumPrivateDocumentButton from "../components/ConsortiumPrivateDocumentButton";
import {
  getConsortiumExpenseDocuments,
  getConsortiumPaymentReports,
  getConsortiumPeriodById,
  getMyConsortiumUnits,
  getPortalUnitObligations,
  submitConsortiumPaymentReport,
} from "../services/consorcio.service";
import {
  CONSORTIUM_DOCUMENT_ACCEPT,
  CONSORTIUM_PAYMENT_METHODS,
} from "../utils/consorcio.constants";
import {
  formatConsortiumMoney,
  getConsortiumObligationStatus,
  getConsortiumObligationStatusLabel,
  getConsortiumPeriodLabel,
  majorToMinor,
  minorToMajorInput,
} from "../utils/consorcio.helpers";
import {
  getPaymentReportStatus,
  isConsortiumDocumentFileValid,
} from "../utils/consorcioPortal.helpers";
import "../consorcio.css";

const todayKey = () => new Date().toISOString().slice(0, 10);

const emptyReportForm = () => ({
  obligationId: "",
  amountMajor: "",
  date: todayKey(),
  method: "transfer",
  reference: "",
  notes: "",
  file: null,
});

const ConsortiumResidentPortalPage = () => {
  const { user } = useAuth();
  const [units, setUnits] = useState([]);
  const [selectedUnitId, setSelectedUnitId] = useState("");
  const [obligations, setObligations] = useState([]);
  const [reports, setReports] = useState([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [expenseDocuments, setExpenseDocuments] = useState([]);
  const [reportForm, setReportForm] = useState(emptyReportForm);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [operation, setOperation] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadUnits = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const data = await getMyConsortiumUnits();
      setUnits(data);
      setSelectedUnitId((current) => (
        current && data.some((item) => item.id === current) ? current : data[0]?.id || ""
      ));
    } catch (loadError) {
      setError(loadError.message || "No se pudieron cargar tus unidades.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUnits(); }, [loadUnits]);

  const selectedUnit = useMemo(
    () => units.find((item) => item.id === selectedUnitId) || null,
    [selectedUnitId, units],
  );

  const loadUnitDetails = useCallback(async () => {
    if (!selectedUnit) {
      setObligations([]);
      setReports([]);
      return;
    }
    try {
      setDetailLoading(true);
      setError("");
      const [obligationData, reportData] = await Promise.all([
        getPortalUnitObligations({
          inmobiliariaId: selectedUnit.inmobiliariaId,
          unitId: selectedUnit.id,
        }),
        getConsortiumPaymentReports(selectedUnit.inmobiliariaId, { unitId: selectedUnit.id }),
      ]);
      setObligations(obligationData);
      setReports(reportData);
      setSelectedPeriodId((current) => (
        current && obligationData.some((item) => item.periodId === current)
          ? current
          : obligationData[0]?.periodId || ""
      ));
    } catch (loadError) {
      setError(loadError.message || "No se pudo cargar la cuenta de la unidad.");
    } finally {
      setDetailLoading(false);
    }
  }, [selectedUnit]);

  useEffect(() => { loadUnitDetails(); }, [loadUnitDetails]);

  useEffect(() => {
    let mounted = true;
    const loadPeriod = async () => {
      if (!selectedUnit || !selectedPeriodId) {
        setSelectedPeriod(null);
        setExpenseDocuments([]);
        return;
      }
      try {
        const [periodData, documentData] = await Promise.all([
          getConsortiumPeriodById(selectedUnit.inmobiliariaId, selectedPeriodId),
          getConsortiumExpenseDocuments(selectedUnit.inmobiliariaId, { periodId: selectedPeriodId }),
        ]);
        if (mounted) {
          setSelectedPeriod(periodData);
          setExpenseDocuments(documentData);
        }
      } catch (loadError) {
        if (mounted) setError(loadError.message || "No se pudo cargar el detalle de la liquidación.");
      }
    };
    loadPeriod();
    return () => { mounted = false; };
  }, [selectedPeriodId, selectedUnit]);

  const totalBalance = useMemo(
    () => obligations.reduce((sum, item) => sum + Number(item.balanceMinor || 0), 0),
    [obligations],
  );

  const selectReport = (obligation) => {
    setError("");
    setSuccess("");
    setReportForm({
      ...emptyReportForm(),
      obligationId: obligation.id,
      amountMajor: minorToMajorInput(obligation.balanceMinor),
    });
    document.getElementById("consortium-resident-payment-report")?.scrollIntoView({ behavior: "smooth" });
  };

  const submitReport = async (event) => {
    event.preventDefault();
    if (!selectedUnit) return;
    try {
      setOperation("report");
      setError("");
      setSuccess("");
      if (!isConsortiumDocumentFileValid(reportForm.file)) {
        throw new Error("Adjuntá un PDF, JPG, PNG o WEBP de hasta 10 MB.");
      }
      await submitConsortiumPaymentReport({
        inmobiliariaId: selectedUnit.inmobiliariaId,
        consortiumId: selectedUnit.consortiumId,
        unitId: selectedUnit.id,
        obligationId: reportForm.obligationId,
        amountMinor: majorToMinor(reportForm.amountMajor),
        date: reportForm.date,
        method: reportForm.method,
        reference: reportForm.reference,
        notes: reportForm.notes,
        file: reportForm.file,
      });
      setReportForm(emptyReportForm());
      setFileInputKey((current) => current + 1);
      setSuccess("Pago informado. La administración debe validarlo antes de que se descuente del saldo.");
      await loadUnitDetails();
    } catch (reportError) {
      setError(reportError.message || "No se pudo informar el pago.");
    } finally {
      setOperation("");
    }
  };

  if (loading) return <main className="container py-5 text-center">Cargando Mi consorcio...</main>;

  return (
    <main className="container py-4 consortium-workspace">
      <SEO title="Mi consorcio | ONO Prop" noIndex />
      <header className="mb-4">
        <span className="badge text-bg-success mb-2">Portal del consorcista</span>
        <h1 className="h3 mb-1">Mi consorcio</h1>
        <p className="text-muted mb-0">Consultá expensas, comprobantes e informá pagos desde tu cuenta.</p>
      </header>

      {error && <div className="alert alert-danger">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {user?.emailVerified !== true && (
        <div className="alert alert-warning">Para proteger la información del consorcio necesitás verificar el email <strong>{user?.email}</strong>.</div>
      )}

      {user?.emailVerified === true && !units.length && (
        <section className="card border-0 shadow-sm"><div className="card-body p-5 text-center"><h2 className="h5">Todavía no tenés unidades habilitadas</h2><p className="text-muted mb-0">Pedile a la administración que habilite exactamente el email <strong>{user?.email}</strong> en la unidad correspondiente.</p></div></section>
      )}

      {selectedUnit && (
        <>
          <section className="card border-0 shadow-sm mb-4"><div className="card-body p-4"><div className="row g-3 align-items-end"><div className="col-lg-8"><label className="form-label">Unidad habilitada</label><select className="form-select" value={selectedUnitId} onChange={(event) => { setSelectedUnitId(event.target.value); setSelectedPeriodId(""); setReportForm(emptyReportForm()); }}>{units.map((unit) => <option key={`${unit.inmobiliariaId}_${unit.id}`} value={unit.id}>{unit.consortiumName || "Consorcio"} · Unidad {unit.code}</option>)}</select></div><div className="col-lg-4"><span className="small text-muted text-uppercase">Saldo total</span><strong className="fs-4 d-block consortium-money">{formatConsortiumMoney(totalBalance, selectedUnit.consortiumCurrency || "ARS")}</strong></div></div><div className="mt-3"><strong>{selectedUnit.consortiumName || "Consorcio"}</strong><div className="text-muted">{selectedUnit.consortiumAddress || "Domicilio no informado"} · Unidad {selectedUnit.code}</div></div></div></section>

          <section className="card border-0 shadow-sm mb-4"><div className="card-body p-4"><h2 className="h5">Estado de cuenta</h2>{detailLoading ? <p className="text-muted">Cargando movimientos...</p> : <div className="table-responsive"><table className="table table-hover align-middle"><thead><tr><th>Período</th><th>Vencimiento</th><th>Total</th><th>Pagado</th><th>Saldo</th><th>Estado</th><th className="text-end">Acciones</th></tr></thead><tbody>{obligations.map((obligation) => { const status = getConsortiumObligationStatus(obligation); const state = getConsortiumObligationStatusLabel(status); return <tr key={obligation.id}><td>{getConsortiumPeriodLabel(obligation.periodKey)}</td><td>{obligation.dueDate}</td><td className="consortium-money">{formatConsortiumMoney(obligation.totalAmountMinor, obligation.currency)}</td><td className="consortium-money">{formatConsortiumMoney(obligation.paidAmountMinor, obligation.currency)}</td><td className="consortium-money fw-semibold">{formatConsortiumMoney(obligation.balanceMinor, obligation.currency)}</td><td><span className={`badge ${state.badge}`}>{state.label}</span></td><td className="text-end"><div className="btn-group btn-group-sm"><button className="btn btn-outline-secondary" type="button" onClick={() => setSelectedPeriodId(obligation.periodId)}>Liquidación</button>{Number(obligation.balanceMinor || 0) > 0 && <button className="btn btn-success" type="button" onClick={() => selectReport(obligation)}>Informar pago</button>}</div></td></tr>; })}{!obligations.length && <tr><td className="text-center text-muted py-4" colSpan="7">Todavía no hay expensas emitidas.</td></tr>}</tbody></table></div>}</div></section>

          {selectedPeriod && <ConsortiumExpenseDocumentsPanel inmobiliariaId={selectedUnit.inmobiliariaId} consortiumId={selectedUnit.consortiumId} period={selectedPeriod} expenses={selectedPeriod.expenses || []} documents={expenseDocuments} />}

          {reportForm.obligationId && <section id="consortium-resident-payment-report" className="card border-success shadow-sm mb-4"><div className="card-body p-4"><h2 className="h5">Informar pago realizado</h2><div className="alert alert-info py-2">Este aviso no reemplaza el recibo ni cancela la deuda hasta que la administración valide el comprobante.</div><form onSubmit={submitReport}><div className="row g-3"><div className="col-md-3"><label className="form-label">Importe *</label><input className="form-control" inputMode="decimal" value={reportForm.amountMajor} onChange={(event) => setReportForm((current) => ({ ...current, amountMajor: event.target.value }))} required /></div><div className="col-md-3"><label className="form-label">Fecha del pago *</label><input className="form-control" type="date" value={reportForm.date} onChange={(event) => setReportForm((current) => ({ ...current, date: event.target.value }))} required /></div><div className="col-md-3"><label className="form-label">Medio</label><select className="form-select" value={reportForm.method} onChange={(event) => setReportForm((current) => ({ ...current, method: event.target.value }))}>{CONSORTIUM_PAYMENT_METHODS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></div><div className="col-md-3"><label className="form-label">Referencia</label><input className="form-control" value={reportForm.reference} onChange={(event) => setReportForm((current) => ({ ...current, reference: event.target.value }))} /></div><div className="col-md-6"><label className="form-label">Comprobante *</label><input key={fileInputKey} className="form-control" type="file" accept={CONSORTIUM_DOCUMENT_ACCEPT} onChange={(event) => setReportForm((current) => ({ ...current, file: event.target.files?.[0] || null }))} required /></div><div className="col-md-6"><label className="form-label">Observaciones</label><input className="form-control" value={reportForm.notes} onChange={(event) => setReportForm((current) => ({ ...current, notes: event.target.value }))} /></div><div className="col-12 d-flex justify-content-end gap-2"><button className="btn btn-outline-secondary" type="button" onClick={() => setReportForm(emptyReportForm())}>Cancelar</button><button className="btn btn-success" disabled={operation === "report"} type="submit">{operation === "report" ? "Enviando..." : "Enviar para validación"}</button></div></div></form></div></section>}

          <section className="card border-0 shadow-sm"><div className="card-body p-4"><h2 className="h5">Pagos informados</h2><div className="table-responsive"><table className="table table-sm align-middle"><thead><tr><th>Período</th><th>Fecha</th><th>Importe</th><th>Estado</th><th className="text-end">Comprobante</th></tr></thead><tbody>{reports.map((report) => { const state = getPaymentReportStatus(report.status); return <tr key={report.id}><td>{getConsortiumPeriodLabel(report.periodKey)}</td><td>{report.date}</td><td className="consortium-money">{formatConsortiumMoney(report.amountMinor, report.currency)}</td><td><span className={`badge ${state.badge}`}>{state.label}</span>{report.rejectionReason && <small className="d-block text-danger">{report.rejectionReason}</small>}</td><td className="text-end"><ConsortiumPrivateDocumentButton path={report.proofStoragePath} fileName={report.proofFileName} /></td></tr>; })}{!reports.length && <tr><td className="text-center text-muted py-4" colSpan="5">Todavía no informaste pagos.</td></tr>}</tbody></table></div></div></section>
        </>
      )}
    </main>
  );
};

export default ConsortiumResidentPortalPage;
