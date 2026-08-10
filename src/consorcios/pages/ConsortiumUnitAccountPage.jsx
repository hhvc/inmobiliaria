import { useEffect, useMemo, useState } from "react";
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
  getConsortiumById,
  getConsortiumObligations,
  getConsortiumPayments,
  getConsortiumUnits,
  voidConsortiumPayment,
} from "../services/consorcio.service";
import {
  formatConsortiumMoney,
  getConsortiumObligationStatus,
  getConsortiumObligationStatusLabel,
  getConsortiumPeriodLabel,
} from "../utils/consorcio.helpers";
import "../consorcio.css";

const ConsortiumUnitAccountPage = () => {
  const { id: consortiumId = "", unitId = "" } = useParams();
  const { user } = useAuth();
  const { activeInmobiliariaId, loading: agencyLoading } = useActiveInmobiliariaModules();
  const [consortium, setConsortium] = useState(null);
  const [unit, setUnit] = useState(null);
  const [obligations, setObligations] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [working, setWorking] = useState("");

  const canManage = useMemo(() => {
    const role = getInternalRoleForInmobiliaria(user, activeInmobiliariaId);
    return getInternalPermissions(role, isGlobalRoot(user)).canManageConsortiums;
  }, [activeInmobiliariaId, user]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!activeInmobiliariaId) return;
      try {
        setLoading(true);
        setError("");
        const [consortiumData, units, obligationData, paymentData] = await Promise.all([
          getConsortiumById(activeInmobiliariaId, consortiumId),
          getConsortiumUnits(activeInmobiliariaId, consortiumId),
          getConsortiumObligations(activeInmobiliariaId, { consortiumId, unitId }),
          getConsortiumPayments(activeInmobiliariaId, { consortiumId, unitId, includeVoided: true }),
        ]);
        if (!mounted) return;
        setConsortium(consortiumData);
        setUnit(units.find((item) => item.id === unitId) || obligationData[0]?.unitSnapshot || null);
        setObligations(obligationData);
        setPayments(paymentData);
      } catch (loadError) {
        if (mounted) setError(loadError.message || "No se pudo cargar la cuenta corriente.");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [activeInmobiliariaId, consortiumId, unitId]);

  const currency = consortium?.currency || obligations[0]?.currency || "ARS";
  const activePayments = useMemo(
    () => payments.filter((item) => item.voided !== true),
    [payments],
  );
  const summary = useMemo(() => ({
    charges: obligations.reduce((sum, item) => sum + Number(item.totalAmountMinor || 0), 0),
    payments: activePayments.reduce((sum, item) => sum + Number(item.amountMinor || 0), 0),
    balance: obligations.reduce((sum, item) => sum + Number(item.balanceMinor || 0), 0),
  }), [activePayments, obligations]);

  const voidPayment = async (payment) => {
    const reason = window.prompt("Motivo de la anulación del cobro:");
    if (!reason?.trim()) return;
    try {
      setWorking(payment.id);
      setError("");
      setSuccess("");
      await voidConsortiumPayment({
        inmobiliariaId: activeInmobiliariaId,
        paymentId: payment.id,
        reason,
      });
      setPayments((current) => current.map((item) => (
        item.id === payment.id ? { ...item, voided: true, voidReason: reason.trim() } : item
      )));
      setObligations((current) => current.map((item) => (
        item.id === payment.obligationId
          ? {
            ...item,
            paidAmountMinor: Math.max(0, Number(item.paidAmountMinor || 0) - Number(payment.amountMinor || 0)),
            balanceMinor: Math.min(
              Number(item.totalAmountMinor || 0),
              Number(item.balanceMinor || 0) + Number(payment.amountMinor || 0),
            ),
          }
          : item
      )));
      setSuccess("Cobro anulado y saldo recalculado. El movimiento se conserva en el historial.");
    } catch (voidError) {
      setError(voidError.message || "No se pudo anular el cobro.");
    } finally {
      setWorking("");
    }
  };

  if (loading || agencyLoading) return <main className="container py-5 text-center">Cargando cuenta corriente...</main>;

  return (
    <main className="container py-4 consortium-workspace consortium-account-page">
      <SEO title={`Cuenta corriente ${unit?.code || "unidad"} | ONO Prop`} noIndex />
      <header className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4 consortium-no-print">
        <div>
          <Link className="text-decoration-none" to={`/admin/consorcios/${consortiumId}`}>← Volver al consorcio</Link>
          <h1 className="h3 mt-3 mb-1">Cuenta corriente · Unidad {unit?.code || unitId}</h1>
          <p className="text-muted mb-0">{consortium?.name || "Consorcio"} · {unit?.ownerName || unit?.occupantName || "Responsable no informado"}</p>
        </div>
        <button className="btn btn-outline-primary" type="button" onClick={() => window.print()}>Imprimir / guardar PDF</button>
      </header>
      {error && <div className="alert alert-danger">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <section className="card border-0 shadow-sm consortium-account-card">
        <div className="card-body p-4">
          <div className="d-none d-print-block mb-4">
            <h1 className="h4">Cuenta corriente · Unidad {unit?.code || unitId}</h1>
            <p>{consortium?.name} · {consortium?.address}</p>
          </div>
          <div className="row g-3 mb-4">
            <div className="col-md-4"><div className="rounded bg-light p-3 h-100"><small className="text-muted text-uppercase">Expensas emitidas</small><strong className="fs-5 d-block consortium-money">{formatConsortiumMoney(summary.charges, currency)}</strong></div></div>
            <div className="col-md-4"><div className="rounded bg-light p-3 h-100"><small className="text-muted text-uppercase">Cobros registrados</small><strong className="fs-5 d-block text-success consortium-money">{formatConsortiumMoney(summary.payments, currency)}</strong></div></div>
            <div className="col-md-4"><div className="rounded bg-light p-3 h-100"><small className="text-muted text-uppercase">Saldo</small><strong className={`fs-5 d-block consortium-money ${summary.balance > 0 ? "text-danger" : "text-success"}`}>{formatConsortiumMoney(summary.balance, currency)}</strong></div></div>
          </div>

          <h2 className="h5">Expensas por período</h2>
          <div className="table-responsive mb-4">
            <table className="table table-sm consortium-account-table">
              <thead><tr><th>Período</th><th>Vencimiento</th><th>Total</th><th>Cobrado</th><th>Saldo</th><th>Estado</th></tr></thead>
              <tbody>
                {obligations.map((obligation) => {
                  const status = getConsortiumObligationStatus(obligation);
                  const state = getConsortiumObligationStatusLabel(status);
                  return <tr key={obligation.id}><td><Link to={`/admin/consorcios/${consortiumId}/liquidaciones/${obligation.id}`}>{getConsortiumPeriodLabel(obligation.periodKey)}</Link></td><td>{obligation.dueDate}</td><td className="consortium-money">{formatConsortiumMoney(obligation.totalAmountMinor, obligation.currency)}</td><td className="consortium-money">{formatConsortiumMoney(obligation.paidAmountMinor, obligation.currency)}</td><td className="consortium-money fw-semibold">{formatConsortiumMoney(obligation.balanceMinor, obligation.currency)}</td><td><span className={`badge ${state.badge}`}>{state.label}</span></td></tr>;
                })}
                {!obligations.length && <tr><td className="text-center text-muted py-4" colSpan="6">No hay expensas emitidas para esta unidad.</td></tr>}
              </tbody>
            </table>
          </div>

          <h2 className="h5">Cobros</h2>
          <div className="table-responsive">
            <table className="table table-sm">
              <thead><tr><th>Fecha</th><th>Período</th><th>Medio</th><th>Referencia</th><th className="text-end">Importe</th><th className="consortium-no-print text-end">Recibo</th></tr></thead>
              <tbody>
                {payments.map((payment) => <tr className={payment.voided ? "text-muted" : ""} key={payment.id}><td>{payment.date}</td><td>{getConsortiumPeriodLabel(payment.periodKey)}</td><td>{payment.method}</td><td>{payment.voided ? <><span className="badge text-bg-dark">Anulado</span><small className="d-block">{payment.voidReason}</small></> : payment.reference || "—"}</td><td className={`text-end consortium-money ${payment.voided ? "text-decoration-line-through" : ""}`}>{formatConsortiumMoney(payment.amountMinor, payment.currency)}</td><td className="consortium-no-print text-end"><div className="btn-group btn-group-sm"><Link className="btn btn-outline-secondary" to={`/admin/consorcios/${consortiumId}/recibos/${payment.id}`}>Ver</Link>{canManage && !payment.voided && <button className="btn btn-outline-danger" disabled={working === payment.id} type="button" onClick={() => voidPayment(payment)}>Anular</button>}</div></td></tr>)}
                {!payments.length && <tr><td className="text-center text-muted py-4" colSpan="6">Todavía no hay cobros registrados.</td></tr>}
              </tbody>
            </table>
          </div>
          <p className="small text-muted mt-4 mb-0">Documento de gestión interna. Los movimientos anulados no integran este estado de cuenta.</p>
        </div>
      </section>
    </main>
  );
};

export default ConsortiumUnitAccountPage;
