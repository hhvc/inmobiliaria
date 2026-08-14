import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import SEO from "../../components/SEO";
import { useAuth } from "../../context/auth/useAuth";
import { useActiveInmobiliariaModules } from "../../inmobiliaria/hooks/useActiveInmobiliariaModules";
import {
  getInternalPermissions,
  getInternalRoleForInmobiliaria,
  isGlobalRoot,
} from "../../inmobiliaria/utils/inmobiliariaPermissions";
import {
  addRentalAdjustment,
  addRentalExpense,
  archiveRentalContract,
  changeRentalContractStatus,
  closeRentalObligationOutsideManagement,
  confirmRentalSettlementReceived,
  generateRentalObligations,
  getRentalContractById,
  getRentalExpenses,
  getRentalObligations,
  getRentalPeople,
  getRentalSettlements,
  markRentalSettlementPaid,
  recordRentalPayment,
  rectifyRentalSettlementReceipt,
  reopenRentalObligationOutsideManagement,
  saveRentalSettlement,
  updateRentalObligationCharges,
  voidRentalPayment,
  voidRentalSettlementPayment,
} from "../services/rental.service";
import {
  RENTAL_CONTRACT_STATUSES,
  RENTAL_EXTERNAL_CLOSURE_REASONS,
  RENTAL_EXPENSE_ALLOCATIONS,
  RENTAL_PAYMENT_METHODS,
  RENTAL_SETTLEMENT_RECEIPT_CONFIRMATION_METHODS,
  getRentalContractStatus,
} from "../utils/rental.constants";
import {
  calculateRentalSettlement,
  formatRentalMoney,
  getNextAdjustmentDate,
  getObligationStatus,
  majorToMinor,
  minorToMajorInput,
} from "../utils/rental.helpers";
import { createEmptyRentalExpense } from "../utils/rentalSchema";
import RentalArcaPanel from "../components/RentalArcaPanel";
import "../rental.css";

const todayKey = () => new Date().toISOString().slice(0, 10);

const OBLIGATION_LABELS = {
  pending: ["Pendiente", "text-bg-warning"],
  partial: ["Pago parcial", "text-bg-info"],
  overdue: ["Vencida", "text-bg-danger"],
  paid: ["Pagada", "text-bg-success"],
  closed_external: ["Cancelación externa", "text-bg-dark"],
};

const SETTLEMENT_LABELS = {
  draft: ["Liquidación preparada", "text-bg-secondary"],
  needs_recalculation: ["Requiere recálculo", "text-bg-danger"],
  paid: ["Pago registrado · recepción pendiente", "text-bg-warning"],
  received: ["Recepción confirmada por el locador", "text-bg-success"],
};

const RentalContractDetailPage = () => {
  const { id: contractId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { activeInmobiliariaId, activeInmobiliaria } = useActiveInmobiliariaModules();
  const [contract, setContract] = useState(null);
  const [obligations, setObligations] = useState([]);
  const [people, setPeople] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [throughDate, setThroughDate] = useState(todayKey);
  const [paymentObligationId, setPaymentObligationId] = useState("");
  const [payment, setPayment] = useState({ amount: "", paidAt: todayKey(), method: "transfer", reference: "", notes: "" });
  const [externalClosureObligationId, setExternalClosureObligationId] = useState("");
  const [externalClosure, setExternalClosure] = useState({ reason: "pre_management", closedAt: todayKey(), notes: "" });
  const [settlementPaymentId, setSettlementPaymentId] = useState("");
  const [settlementPayment, setSettlementPayment] = useState({ paidAt: todayKey(), method: "transfer", reference: "", notes: "" });
  const [settlementReceiptId, setSettlementReceiptId] = useState("");
  const [settlementReceipt, setSettlementReceipt] = useState({ receivedAt: todayKey(), confirmationMethod: "signed_receipt", reference: "", notes: "" });
  const [expense, setExpense] = useState(createEmptyRentalExpense);
  const [adjustment, setAdjustment] = useState({ effectiveFrom: todayKey(), amount: "", notes: "" });
  const [chargeDrafts, setChargeDrafts] = useState({});
  const [discountDrafts, setDiscountDrafts] = useState({});

  const canManage = useMemo(() => {
    const role = getInternalRoleForInmobiliaria(user, activeInmobiliariaId);
    return getInternalPermissions(role, isGlobalRoot(user)).canManageRentals;
  }, [activeInmobiliariaId, user]);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!activeInmobiliariaId || !contractId) return;
    try {
      if (!silent) setLoading(true);
      setError("");
      const [contractData, obligationData, peopleData, expenseData, settlementData] = await Promise.all([
        getRentalContractById(activeInmobiliariaId, contractId),
        getRentalObligations(activeInmobiliariaId, contractId),
        getRentalPeople(activeInmobiliariaId),
        getRentalExpenses(activeInmobiliariaId, contractId),
        getRentalSettlements(activeInmobiliariaId, contractId),
      ]);
      if (!contractData) throw new Error("No se encontró el contrato.");
      setContract(contractData);
      setObligations(obligationData);
      setPeople(peopleData);
      setExpenses(expenseData);
      setSettlements(settlementData);
      setExpense((current) => ({
        ...current,
        contractId,
        periodKey: contractData.contractType === "temporary"
          ? obligationData[0]?.periodKey || contractData.startDate?.slice(0, 7) || ""
          : current.periodKey || todayKey().slice(0, 7),
      }));
    } catch (loadError) {
      setError(loadError.message || "No se pudo cargar el contrato.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [activeInmobiliariaId, contractId]);

  useEffect(() => { load(); }, [load]);

  const runAction = async (callback, successMessage) => {
    try {
      setWorking(true);
      setError("");
      setNotice("");
      await callback();
      await load();
      setNotice(successMessage);
    } catch (actionError) {
      setError(actionError.message || "No se pudo completar la operación.");
    } finally {
      setWorking(false);
    }
  };

  const registerPayment = async (event) => {
    event.preventDefault();
    await runAction(async () => {
      await recordRentalPayment({
        inmobiliariaId: activeInmobiliariaId,
        obligationId: paymentObligationId,
        amountMinor: majorToMinor(payment.amount),
        paidAt: payment.paidAt,
        method: payment.method,
        reference: payment.reference,
        notes: payment.notes,
      });
      setPaymentObligationId("");
      setPayment({ amount: "", paidAt: todayKey(), method: "transfer", reference: "", notes: "" });
    }, "Pago registrado y recibo disponible.");
  };

  const closeOutsideManagement = async (event) => {
    event.preventDefault();
    await runAction(async () => {
      await closeRentalObligationOutsideManagement({
        inmobiliariaId: activeInmobiliariaId,
        obligationId: externalClosureObligationId,
        ...externalClosure,
      });
      setExternalClosureObligationId("");
      setExternalClosure({ reason: "pre_management", closedAt: todayKey(), notes: "" });
    }, "Cancelación externa registrada. No se computó como cobranza de la inmobiliaria.");
  };

  const registerSettlementPayment = async (event) => {
    event.preventDefault();
    await runAction(async () => {
      await markRentalSettlementPaid({
        inmobiliariaId: activeInmobiliariaId,
        settlementId: settlementPaymentId,
        ...settlementPayment,
      });
      setSettlementPaymentId("");
      setSettlementPayment({ paidAt: todayKey(), method: "transfer", reference: "", notes: "" });
    }, "Pago al locador registrado y recibo disponible para firma.");
  };

  const confirmSettlementReceipt = async (event) => {
    event.preventDefault();
    await runAction(async () => {
      await confirmRentalSettlementReceived({
        inmobiliariaId: activeInmobiliariaId,
        settlementId: settlementReceiptId,
        ...settlementReceipt,
      });
      setSettlementReceiptId("");
      setSettlementReceipt({ receivedAt: todayKey(), confirmationMethod: "signed_receipt", reference: "", notes: "" });
    }, "Recepción del dinero confirmada. La cuenta corriente fue actualizada.");
  };

  const askCorrectionReason = (message) => {
    const reason = window.prompt(message, "");
    return reason?.trim?.() || "";
  };

  const voidTenantPayment = (obligationId, paymentId) => {
    const reason = askCorrectionReason("Indicá el motivo de la anulación del cobro. El movimiento se conservará en el historial:");
    if (!reason) return;
    runAction(() => voidRentalPayment({
      inmobiliariaId: activeInmobiliariaId,
      obligationId,
      paymentId,
      reason,
    }), "Cobro anulado con trazabilidad. Recalculá la liquidación si corresponde.");
  };

  const rectifySettlementReceipt = (settlementId) => {
    const reason = askCorrectionReason("Indicá el motivo para rectificar la recepción confirmada:");
    if (!reason) return;
    runAction(() => rectifyRentalSettlementReceipt({
      inmobiliariaId: activeInmobiliariaId,
      settlementId,
      reason,
    }), "Confirmación de recepción rectificada; el pago vuelve a quedar pendiente de confirmación.");
  };

  const voidSettlementPayment = (settlementId) => {
    const reason = askCorrectionReason("Indicá el motivo de la anulación del pago al locador:");
    if (!reason) return;
    runAction(() => voidRentalSettlementPayment({
      inmobiliariaId: activeInmobiliariaId,
      settlementId,
      reason,
    }), "Pago al locador anulado con trazabilidad. La liquidación vuelve a borrador.");
  };

  const saveExpense = async (event) => {
    event.preventDefault();
    await runAction(async () => {
      await addRentalExpense(activeInmobiliariaId, {
        ...expense,
        amountMinor: majorToMinor(expense.amount),
      });
      setExpense({ ...createEmptyRentalExpense(), contractId, periodKey: expense.periodKey });
    }, "Gasto registrado.");
  };

  const saveAdjustment = async (event) => {
    event.preventDefault();
    await runAction(async () => {
      await addRentalAdjustment({
        inmobiliariaId: activeInmobiliariaId,
        contractId,
        effectiveFrom: adjustment.effectiveFrom,
        amountMinor: majorToMinor(adjustment.amount),
        notes: adjustment.notes,
      });
      setAdjustment({ effectiveFrom: todayKey(), amount: "", notes: "" });
    }, "Nuevo importe contractual registrado.");
  };

  const settlementFor = (obligation) => settlements.find((item) => item.obligationId === obligation.id);
  const expensesFor = (periodKey) => expenses.filter((item) => item.periodKey === periodKey);

  const saveSettlement = (obligation) => runAction(
    () => saveRentalSettlement({
      inmobiliariaId: activeInmobiliariaId,
      contract,
      obligation,
      expenses: expensesFor(obligation.periodKey),
    }),
    "Liquidación calculada y guardada.",
  );

  if (loading) return <main className="container py-5 text-center">Cargando gestión contractual...</main>;
  if (!contract) return <main className="container py-5"><div className="alert alert-danger">{error || "Contrato no disponible."}</div></main>;

  const state = getRentalContractStatus(contract.status);
  const nextAdjustment = getNextAdjustmentDate(contract);
  const totalBalance = obligations.reduce((sum, item) => sum + Number(item.balanceMinor || 0), 0);

  return (
    <main className="container py-4 rental-workspace">
      <SEO title={`${contract.inmuebleSnapshot?.title || "Contrato"} | Alquileres`} noIndex />
      <header className="d-flex flex-wrap justify-content-between gap-3 mb-4">
        <div>
          <div className="d-flex flex-wrap gap-2 mb-2"><span className={`badge ${state.badge}`}>{state.label}</span><span className="badge text-bg-light border text-dark">{contract.currency}</span></div>
          <h1 className="h3 mb-1">{contract.inmuebleSnapshot?.title || "Contrato de alquiler"}</h1>
          <p className="text-muted mb-0">{contract.inmuebleSnapshot?.address || "Sin dirección"} · {activeInmobiliaria?.nombre}</p>
        </div>
        <div className="d-flex flex-wrap gap-2 align-self-start">
          <Link className="btn btn-outline-secondary" to="/admin/alquileres">Volver</Link>
          <Link className="btn btn-outline-success" to={`/admin/alquileres/${contractId}/cuenta-corriente`}>Cuenta corriente</Link>
          {canManage && <Link className="btn btn-outline-primary" to={`/admin/alquileres/${contractId}/editar`}>Editar contrato</Link>}
        </div>
      </header>

      {error && <div className="alert alert-danger">{error}</div>}
      {notice && <div className="alert alert-success">{notice}</div>}

      {canManage && (
        <RentalArcaPanel
          inmobiliariaId={activeInmobiliariaId}
          contract={contract}
          obligations={obligations}
          people={people}
          onObligationsChanged={() => load({ silent: true })}
        />
      )}
      {!canManage && <div className="alert alert-info">Tu rol permite consultar el contrato, pero no registrar movimientos.</div>}

      <section className="row g-3 mb-4">
        <div className="col-sm-6 col-xl-3"><div className="card border-0 shadow-sm h-100"><div className="card-body"><small className="text-uppercase text-muted">{contract.contractType === "temporary" ? "Importe de la estadía" : "Alquiler actual"}</small><strong className="fs-4 d-block">{formatRentalMoney(contract.financial?.currentRentAmountMinor, contract.currency)}</strong></div></div></div>
        <div className="col-sm-6 col-xl-3"><div className="card border-0 shadow-sm h-100"><div className="card-body"><small className="text-uppercase text-muted">Saldo registrado</small><strong className={`fs-4 d-block ${totalBalance > 0 ? "text-danger" : "text-success"}`}>{formatRentalMoney(totalBalance, contract.currency)}</strong></div></div></div>
        <div className="col-sm-6 col-xl-3"><div className="card border-0 shadow-sm h-100"><div className="card-body"><small className="text-uppercase text-muted">{contract.contractType === "temporary" ? "Modalidad" : "Próximo ajuste"}</small><strong className="fs-5 d-block">{contract.contractType === "temporary" ? "Alquiler temporal" : nextAdjustment || "Manual"}</strong><small className="text-muted">{contract.contractType === "temporary" ? "Obligación única" : contract.financial?.adjustment?.indexName || contract.financial?.adjustment?.mode}</small></div></div></div>
        <div className="col-sm-6 col-xl-3"><div className="card border-0 shadow-sm h-100"><div className="card-body"><small className="text-uppercase text-muted">Vigencia</small><strong className="fs-6 d-block">{contract.startDate} a {contract.endDate}</strong><small className="text-muted">{contract.contractType === "temporary" ? `Vence el ${contract.paymentDueDate}` : `Vence cada día ${contract.dueDay}`}</small></div></div></div>
      </section>

      <section className="card border-0 shadow-sm mb-4">
        <div className="card-body p-4">
          <div className="row g-4">
            <div className="col-lg-7">
              <h2 className="h5">Partes y condiciones</h2>
              <dl className="row small mb-0">
                <dt className="col-sm-3">Locador</dt><dd className="col-sm-9">{contract.partySnapshots?.owners?.map((item) => item.name).join(", ") || "Sin informar"}</dd>
                <dt className="col-sm-3">Locatario</dt><dd className="col-sm-9">{contract.partySnapshots?.tenants?.map((item) => item.name).join(", ") || "Sin informar"}</dd>
                <dt className="col-sm-3">Garantes</dt><dd className="col-sm-9">{contract.partySnapshots?.guarantors?.map((item) => item.name).join(", ") || "Sin garantes registrados"}</dd>
                <dt className="col-sm-3">Mora</dt><dd className="col-sm-9">{contract.lateFeeNotes || "Sin detalle adicional"}</dd>
              </dl>
            </div>
            {canManage && <div className="col-lg-5">
              <h2 className="h5">Estado contractual</h2>
              <div className="input-group">
                <select className="form-select" value={contract.status} onChange={(event) => setContract({ ...contract, status: event.target.value })}>{RENTAL_CONTRACT_STATUSES.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}</select>
                <button className="btn btn-outline-primary" type="button" disabled={working} onClick={() => runAction(() => changeRentalContractStatus(activeInmobiliariaId, contractId, contract.status), "Estado actualizado.")}>Aplicar</button>
              </div>
              {contract.documentUrl && <a className="btn btn-sm btn-link px-0 mt-2" href={contract.documentUrl} target="_blank" rel="noreferrer">Abrir contrato digitalizado</a>}
            </div>}
          </div>
        </div>
      </section>

      {canManage && <section className="row g-4 mb-4">
        <div className={contract.contractType === "temporary" ? "col-12" : "col-lg-6"}>
          <form className="card border-0 shadow-sm h-100" onSubmit={(event) => { event.preventDefault(); runAction(() => generateRentalObligations({ inmobiliariaId: activeInmobiliariaId, contractId, throughDate: contract.contractType === "temporary" ? contract.endDate : throughDate }), contract.contractType === "temporary" ? "Obligación única actualizada." : "Obligaciones actualizadas sin duplicar períodos."); }}>
            <div className="card-body p-4"><h2 className="h5">{contract.contractType === "temporary" ? "Obligación de la estadía" : "Generar obligaciones"}</h2><p className="text-muted small">{contract.contractType === "temporary" ? "Generá o sincronizá la única obligación sin duplicarla." : "Completá meses futuros o regenerá con seguridad: los existentes no se duplican."}</p>{contract.contractType === "temporary" ? <button className="btn btn-primary" disabled={working}>Generar o sincronizar</button> : <div className="input-group"><input className="form-control" type="date" value={throughDate} onChange={(event) => setThroughDate(event.target.value)} /><button className="btn btn-primary" disabled={working}>Generar hasta fecha</button></div>}</div>
          </form>
        </div>
        {contract.contractType !== "temporary" && <div className="col-lg-6">
          <form className="card border-0 shadow-sm h-100" onSubmit={saveAdjustment}>
            <div className="card-body p-4"><h2 className="h5">Confirmar nuevo alquiler</h2><div className="row g-2"><div className="col-sm-4"><input aria-label="Vigencia del ajuste" className="form-control" type="date" required value={adjustment.effectiveFrom} onChange={(event) => setAdjustment({ ...adjustment, effectiveFrom: event.target.value })} /></div><div className="col-sm-4"><input aria-label="Nuevo importe" className="form-control" inputMode="decimal" placeholder="Nuevo importe" required value={adjustment.amount} onChange={(event) => setAdjustment({ ...adjustment, amount: event.target.value })} /></div><div className="col-sm-4"><button className="btn btn-primary w-100" disabled={working}>Registrar</button></div><div className="col-12"><input aria-label="Notas del ajuste" className="form-control" placeholder="Índice, fuente o nota de cálculo" value={adjustment.notes} onChange={(event) => setAdjustment({ ...adjustment, notes: event.target.value })} /></div></div></div>
          </form>
        </div>}
      </section>}

      <section className="card border-0 shadow-sm mb-4">
        <div className="card-body p-4">
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3"><div><h2 className="h5 mb-1">{contract.contractType === "temporary" ? "Estadía, bonificaciones y cobros" : "Obligaciones y cobros"}</h2><p className="text-muted small mb-0">{contract.contractType === "temporary" ? "Importe total de la estadía, bonificaciones, cargos y pagos recibidos." : "Pagos parciales, cargos adicionales, recibos y liquidaciones."}</p></div><span className="badge text-bg-light border text-dark">{obligations.length} {contract.contractType === "temporary" ? "obligación" : "períodos"}</span></div>
          {obligations.length === 0 && <div className="alert alert-light border mb-0">Todavía no se generaron obligaciones.</div>}
          <div className="vstack gap-3">
            {obligations.map((obligation) => {
              const status = getObligationStatus(obligation);
              const [label, badge] = OBLIGATION_LABELS[status] || OBLIGATION_LABELS.pending;
              const settlement = settlementFor(obligation);
              const periodExpenses = expensesFor(obligation.periodKey);
              const settlementPreview = calculateRentalSettlement({ contract, obligation, expenses: periodExpenses });
              const discountDraft = discountDrafts[obligation.id] || {};
              const grossAmountMinor = Number(obligation.rentAmountMinor || 0)
                + Number(obligation.otherChargesMinor || 0);
              return (
                <article className="border rounded-3 p-3" key={obligation.id}>
                  <div className="row g-3 align-items-start">
                    <div className="col-lg-3"><div className="d-flex gap-2 mb-2"><strong>{contract.contractType === "temporary" ? "Estadía única" : obligation.periodKey}</strong><span className={`badge ${badge}`}>{label}</span></div><small className="d-block text-muted">Vence {obligation.dueDate}</small><small className="d-block text-muted">Servicio {obligation.serviceStartDate} a {obligation.serviceEndDate}</small></div>
                    <div className="col-lg-3 small"><div>Importe base: {formatRentalMoney(obligation.rentAmountMinor, contract.currency)}</div>{Number(obligation.otherChargesMinor || 0) > 0 && <div>Cargos: {formatRentalMoney(obligation.otherChargesMinor, contract.currency)}</div>}{Number(obligation.discountAmountMinor || 0) > 0 && <div className="text-success">Bonificación: −{formatRentalMoney(obligation.discountAmountMinor, contract.currency)}<small className="d-block">{obligation.discountReason}</small></div>}<div>Total: <strong>{formatRentalMoney(obligation.totalAmountMinor, contract.currency)}</strong></div><div>Cobrado por la inmobiliaria: {formatRentalMoney(obligation.paidAmountMinor, contract.currency)}</div>{obligation.externalClosure?.closed && <div>Cerrado fuera de gestión: {formatRentalMoney(obligation.externalClosure.amountMinor, contract.currency)}</div>}<div>Saldo operativo: <strong className={obligation.balanceMinor > 0 ? "text-danger" : "text-success"}>{formatRentalMoney(obligation.balanceMinor, contract.currency)}</strong></div></div>
                    <div className="col-lg-3 small"><div>Neto locador: <strong>{formatRentalMoney(settlementPreview.netOwnerAmountMinor, contract.currency)}</strong></div><div>Honorarios: {formatRentalMoney(settlementPreview.administrationFeeMinor, contract.currency)}</div><div>Gastos locador: {formatRentalMoney(settlementPreview.ownerExpensesMinor, contract.currency)}</div>{settlement && <div className="mt-2"><span className={`badge ${SETTLEMENT_LABELS[settlement.status]?.[1] || SETTLEMENT_LABELS.draft[1]}`}>{SETTLEMENT_LABELS[settlement.status]?.[0] || SETTLEMENT_LABELS.draft[0]}</span></div>}</div>
                    <div className="col-lg-3 d-flex flex-wrap justify-content-lg-end gap-2">
                      {canManage && !obligation.externalClosure?.closed && obligation.balanceMinor > 0 && <button type="button" className="btn btn-sm btn-primary" onClick={() => { setPaymentObligationId(obligation.id); setPayment((current) => ({ ...current, amount: minorToMajorInput(obligation.balanceMinor) })); }}>Registrar pago</button>}
                      {canManage && !obligation.externalClosure?.closed && obligation.balanceMinor > 0 && <button type="button" className="btn btn-sm btn-outline-dark" onClick={() => { setExternalClosureObligationId(obligation.id); setExternalClosure({ reason: "pre_management", closedAt: todayKey(), notes: "" }); }}>Cancelación externa</button>}
                      {canManage && obligation.externalClosure?.closed && <button type="button" className="btn btn-sm btn-outline-secondary" disabled={working} onClick={() => runAction(() => reopenRentalObligationOutsideManagement({ inmobiliariaId: activeInmobiliariaId, obligationId: obligation.id }), "Período reabierto. El saldo pendiente volvió a la gestión.")}>Reabrir período</button>}
                      {canManage && !obligation.externalClosure?.closed && obligation.paidAmountMinor > 0 && (!settlement || !["paid", "received"].includes(settlement.status)) && <button type="button" className="btn btn-sm btn-outline-primary" disabled={working} onClick={() => saveSettlement(obligation)}>{settlement ? "Recalcular" : "Liquidar"}</button>}
                      {canManage && settlement && !settlement.status?.startsWith?.("needs_") && !["paid", "received"].includes(settlement.status) && <button type="button" className="btn btn-sm btn-outline-success" disabled={working} onClick={() => { setSettlementPaymentId(settlement.id); setSettlementPayment({ paidAt: todayKey(), method: "transfer", reference: "", notes: "" }); }}>Registrar pago al locador</button>}
                      {["paid", "received"].includes(settlement?.status) && <Link className="btn btn-sm btn-outline-success" to={`/admin/alquileres/${contractId}/liquidaciones/${settlement.id}/recibo`}>Recibo locador</Link>}
                      {canManage && settlement?.status === "paid" && <button type="button" className="btn btn-sm btn-success" disabled={working} onClick={() => { setSettlementReceiptId(settlement.id); setSettlementReceipt({ receivedAt: todayKey(), confirmationMethod: "signed_receipt", reference: settlement.receiptNumber || "", notes: "" }); }}>Confirmar recepción</button>}
                      {canManage && settlement?.status === "paid" && <button type="button" className="btn btn-sm btn-outline-danger" disabled={working} onClick={() => voidSettlementPayment(settlement.id)}>Anular pago al locador</button>}
                      {canManage && settlement?.status === "received" && <button type="button" className="btn btn-sm btn-outline-danger" disabled={working} onClick={() => rectifySettlementReceipt(settlement.id)}>Rectificar recepción</button>}
                    </div>
                  </div>
                  {obligation.externalClosure?.closed && <div className="alert alert-light border small py-2 mt-3 mb-0"><strong>Cancelación externa:</strong> {RENTAL_EXTERNAL_CLOSURE_REASONS.find((item) => item.id === obligation.externalClosure.reason)?.label || obligation.externalClosure.reason} · {obligation.externalClosure.closedAt}.{obligation.externalClosure.notes ? ` ${obligation.externalClosure.notes}` : ""} Este importe no integra las cobranzas ni las liquidaciones de la inmobiliaria.</div>}
                  {canManage && !obligation.externalClosure?.closed && <div className="row g-2 align-items-end border-top mt-3 pt-3"><div className="col-sm-6 col-lg-2"><label className="form-label small" htmlFor={`charge-${obligation.id}`}>Cargos adicionales</label><input id={`charge-${obligation.id}`} className="form-control form-control-sm" inputMode="decimal" value={chargeDrafts[obligation.id] ?? minorToMajorInput(obligation.otherChargesMinor)} onChange={(event) => setChargeDrafts({ ...chargeDrafts, [obligation.id]: event.target.value })} /></div><div className="col-sm-6 col-lg-2"><label className="form-label small" htmlFor={`discount-${obligation.id}`}>Bonificación</label><input id={`discount-${obligation.id}`} className="form-control form-control-sm" inputMode="decimal" value={discountDraft.amount ?? minorToMajorInput(obligation.discountAmountMinor)} onChange={(event) => setDiscountDrafts({ ...discountDrafts, [obligation.id]: { ...discountDraft, amount: event.target.value } })} /></div><div className="col-lg-4"><label className="form-label small" htmlFor={`discount-reason-${obligation.id}`}>Motivo de la bonificación</label><input id={`discount-reason-${obligation.id}`} className="form-control form-control-sm" maxLength="300" placeholder="Ej.: atención comercial de lanzamiento" value={discountDraft.reason ?? obligation.discountReason ?? ""} onChange={(event) => setDiscountDrafts({ ...discountDrafts, [obligation.id]: { ...discountDraft, reason: event.target.value } })} /></div><div className="col-sm-6 col-lg-2"><button type="button" className="btn btn-sm btn-outline-success w-100" disabled={working} onClick={() => setDiscountDrafts({ ...discountDrafts, [obligation.id]: { ...discountDraft, amount: minorToMajorInput(grossAmountMinor) } })}>Bonificar total</button></div><div className="col-sm-6 col-lg-2"><button type="button" className="btn btn-sm btn-outline-secondary w-100" disabled={working} onClick={() => runAction(() => updateRentalObligationCharges({ inmobiliariaId: activeInmobiliariaId, obligationId: obligation.id, otherChargesMinor: majorToMinor(chargeDrafts[obligation.id] ?? minorToMajorInput(obligation.otherChargesMinor)), discountAmountMinor: majorToMinor(discountDraft.amount ?? minorToMajorInput(obligation.discountAmountMinor)), discountReason: discountDraft.reason ?? obligation.discountReason ?? "" }), "Cargos y bonificación actualizados.")}>Guardar ajustes</button></div></div>}
                  {obligation.payments?.length > 0 && <div className="table-responsive mt-3"><table className="table table-sm align-middle mb-0"><thead><tr><th>Recibo</th><th>Fecha</th><th>Método</th><th>Importe</th><th>Estado</th><th></th></tr></thead><tbody>{obligation.payments.map((item) => <tr className={item.voided ? "text-muted" : ""} key={item.id}><td>{item.receiptNumber}</td><td>{item.paidAt}</td><td>{RENTAL_PAYMENT_METHODS.find((method) => method.id === item.method)?.label || item.method}</td><td className={item.voided ? "text-decoration-line-through" : ""}>{formatRentalMoney(item.amountMinor, contract.currency)}</td><td>{item.voided ? <><span className="badge text-bg-dark">Anulado</span><small className="d-block">{item.voidReason}</small></> : <span className="badge text-bg-success">Activo</span>}</td><td className="text-end">{!item.voided && <Link className="btn btn-sm btn-link" to={`/admin/alquileres/${contractId}/recibos/${obligation.id}/${item.id}`}>Ver recibo</Link>}{canManage && !item.voided && <button type="button" className="btn btn-sm btn-link text-danger" disabled={working} onClick={() => voidTenantPayment(obligation.id, item.id)}>Anular cobro</button>}</td></tr>)}</tbody></table></div>}
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {canManage && externalClosureObligationId && <form className="card border-dark shadow-sm mb-4" onSubmit={closeOutsideManagement}><div className="card-body p-4"><div className="d-flex justify-content-between gap-3"><div><h2 className="h5 mb-1">Registro interno de cancelación externa</h2><p className="small text-muted">Deja el saldo operativo en cero sin afirmar que la inmobiliaria recibió el dinero ni generar recibo, honorario o liquidación.</p></div><button type="button" className="btn-close" aria-label="Cerrar" onClick={() => setExternalClosureObligationId("")} /></div><div className="row g-3"><div className="col-lg-5"><label className="form-label" htmlFor="externalClosureReason">Motivo</label><select id="externalClosureReason" className="form-select" value={externalClosure.reason} onChange={(event) => setExternalClosure({ ...externalClosure, reason: event.target.value })}>{RENTAL_EXTERNAL_CLOSURE_REASONS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></div><div className="col-lg-3"><label className="form-label" htmlFor="externalClosureDate">Fecha informada</label><input id="externalClosureDate" className="form-control" type="date" required value={externalClosure.closedAt} onChange={(event) => setExternalClosure({ ...externalClosure, closedAt: event.target.value })} /></div><div className="col-lg-4"><label className="form-label" htmlFor="externalClosureNotes">Referencia / observaciones</label><input id="externalClosureNotes" className="form-control" value={externalClosure.notes} onChange={(event) => setExternalClosure({ ...externalClosure, notes: event.target.value })} /></div><div className="col-12 text-end"><button className="btn btn-dark" disabled={working}>{working ? "Guardando..." : "Registrar cancelación externa"}</button></div></div></div></form>}

      {canManage && paymentObligationId && <form className="card border-primary shadow-sm mb-4" onSubmit={registerPayment}><div className="card-body p-4"><div className="d-flex justify-content-between gap-3"><h2 className="h5">Registrar pago</h2><button type="button" className="btn-close" aria-label="Cerrar" onClick={() => setPaymentObligationId("")} /></div><div className="row g-3"><div className="col-md-3"><label className="form-label" htmlFor="paymentAmount">Importe</label><input id="paymentAmount" className="form-control" inputMode="decimal" required value={payment.amount} onChange={(event) => setPayment({ ...payment, amount: event.target.value })} /></div><div className="col-md-3"><label className="form-label" htmlFor="paymentDate">Fecha</label><input id="paymentDate" className="form-control" type="date" required value={payment.paidAt} onChange={(event) => setPayment({ ...payment, paidAt: event.target.value })} /></div><div className="col-md-3"><label className="form-label" htmlFor="paymentMethod">Método</label><select id="paymentMethod" className="form-select" value={payment.method} onChange={(event) => setPayment({ ...payment, method: event.target.value })}>{RENTAL_PAYMENT_METHODS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></div><div className="col-md-3"><label className="form-label" htmlFor="paymentReference">Referencia</label><input id="paymentReference" className="form-control" value={payment.reference} onChange={(event) => setPayment({ ...payment, reference: event.target.value })} /></div><div className="col-12"><label className="form-label" htmlFor="paymentNotes">Notas</label><input id="paymentNotes" className="form-control" value={payment.notes} onChange={(event) => setPayment({ ...payment, notes: event.target.value })} /></div><div className="col-12 text-end"><button className="btn btn-primary" disabled={working}>Confirmar pago</button></div></div></div></form>}

      {canManage && settlementPaymentId && <form className="card border-success shadow-sm mb-4" onSubmit={registerSettlementPayment}><div className="card-body p-4"><div className="d-flex justify-content-between gap-3"><div><h2 className="h5 mb-1">Registrar pago de la liquidación al locador</h2><p className="small text-muted mb-0">Al confirmar se habilitará el recibo por duplicado para firma. El estado quedará pendiente hasta confirmar su recepción.</p></div><button type="button" className="btn-close" aria-label="Cerrar" onClick={() => setSettlementPaymentId("")} /></div><div className="row g-3 mt-1"><div className="col-md-3"><label className="form-label" htmlFor="settlementPaidAt">Fecha de pago</label><input id="settlementPaidAt" className="form-control" type="date" required value={settlementPayment.paidAt} onChange={(event) => setSettlementPayment({ ...settlementPayment, paidAt: event.target.value })} /></div><div className="col-md-3"><label className="form-label" htmlFor="settlementPaymentMethod">Medio de pago</label><select id="settlementPaymentMethod" className="form-select" value={settlementPayment.method} onChange={(event) => setSettlementPayment({ ...settlementPayment, method: event.target.value })}>{RENTAL_PAYMENT_METHODS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></div><div className="col-md-6"><label className="form-label" htmlFor="settlementPaymentReference">Referencia</label><input id="settlementPaymentReference" className="form-control" value={settlementPayment.reference} onChange={(event) => setSettlementPayment({ ...settlementPayment, reference: event.target.value })} /></div><div className="col-12"><label className="form-label" htmlFor="settlementPaymentNotes">Observaciones</label><input id="settlementPaymentNotes" className="form-control" value={settlementPayment.notes} onChange={(event) => setSettlementPayment({ ...settlementPayment, notes: event.target.value })} /></div><div className="col-12 text-end"><button className="btn btn-success" disabled={working}>{working ? "Guardando..." : "Confirmar pago y generar recibo"}</button></div></div></div></form>}

      {canManage && settlementReceiptId && <form className="card border-success shadow-sm mb-4" onSubmit={confirmSettlementReceipt}><div className="card-body p-4"><div className="d-flex justify-content-between gap-3"><div><h2 className="h5 mb-1">Confirmar recepción por el locador</h2><p className="small text-muted mb-0">Registrá la fecha y el respaldo mediante el cual se confirmó que el locador recibió el dinero.</p></div><button type="button" className="btn-close" aria-label="Cerrar" onClick={() => setSettlementReceiptId("")} /></div><div className="row g-3 mt-1"><div className="col-md-3"><label className="form-label" htmlFor="settlementReceivedAt">Fecha de recepción</label><input id="settlementReceivedAt" className="form-control" type="date" required value={settlementReceipt.receivedAt} onChange={(event) => setSettlementReceipt({ ...settlementReceipt, receivedAt: event.target.value })} /></div><div className="col-md-4"><label className="form-label" htmlFor="settlementConfirmationMethod">Medio de confirmación</label><select id="settlementConfirmationMethod" className="form-select" value={settlementReceipt.confirmationMethod} onChange={(event) => setSettlementReceipt({ ...settlementReceipt, confirmationMethod: event.target.value })}>{RENTAL_SETTLEMENT_RECEIPT_CONFIRMATION_METHODS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></div><div className="col-md-5"><label className="form-label" htmlFor="settlementConfirmationReference">Referencia / comprobante</label><input id="settlementConfirmationReference" className="form-control" value={settlementReceipt.reference} onChange={(event) => setSettlementReceipt({ ...settlementReceipt, reference: event.target.value })} /></div><div className="col-12"><label className="form-label" htmlFor="settlementConfirmationNotes">Observaciones</label><input id="settlementConfirmationNotes" className="form-control" value={settlementReceipt.notes} onChange={(event) => setSettlementReceipt({ ...settlementReceipt, notes: event.target.value })} /></div><div className="col-12 text-end"><button className="btn btn-success" disabled={working}>{working ? "Guardando..." : "Confirmar recepción del dinero"}</button></div></div></div></form>}

      <section className="row g-4 mb-4">
        {canManage && <div className="col-lg-5"><form className="card border-0 shadow-sm h-100" onSubmit={saveExpense}><div className="card-body p-4"><h2 className="h5">{contract.contractType === "temporary" ? "Registrar gasto de la estadía" : "Registrar gasto"}</h2><div className="row g-3">{contract.contractType === "temporary" ? <div className="col-sm-6"><label className="form-label">Imputación</label><input className="form-control" value="Estadía completa" disabled /></div> : <div className="col-sm-6"><label className="form-label" htmlFor="expensePeriod">Período</label><input id="expensePeriod" className="form-control" type="month" required value={expense.periodKey} onChange={(event) => setExpense({ ...expense, periodKey: event.target.value })} /></div>}<div className="col-sm-6"><label className="form-label" htmlFor="expenseDate">Fecha</label><input id="expenseDate" className="form-control" type="date" required value={expense.date} onChange={(event) => setExpense({ ...expense, date: event.target.value })} /></div><div className="col-12"><label className="form-label" htmlFor="expenseConcept">Concepto</label><input id="expenseConcept" className="form-control" required value={expense.concept} onChange={(event) => setExpense({ ...expense, concept: event.target.value })} /></div><div className="col-sm-6"><label className="form-label" htmlFor="expenseAmount">Importe</label><input id="expenseAmount" className="form-control" inputMode="decimal" required value={expense.amount || ""} onChange={(event) => setExpense({ ...expense, amount: event.target.value })} /></div><div className="col-sm-6"><label className="form-label" htmlFor="expenseAllocation">A cargo de</label><select id="expenseAllocation" className="form-select" value={expense.allocatedTo} onChange={(event) => setExpense({ ...expense, allocatedTo: event.target.value })}>{RENTAL_EXPENSE_ALLOCATIONS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></div><div className="col-12"><button className="btn btn-primary" disabled={working}>Guardar gasto</button></div></div></div></form></div>}
        <div className={canManage ? "col-lg-7" : "col-12"}><section className="card border-0 shadow-sm h-100"><div className="card-body p-4"><h2 className="h5">Gastos registrados</h2>{expenses.length === 0 ? <p className="text-muted mb-0">Sin gastos registrados.</p> : <div className="table-responsive"><table className="table table-sm"><thead><tr><th>{contract.contractType === "temporary" ? "Imputación" : "Período"}</th><th>Concepto</th><th>A cargo de</th><th>Importe</th></tr></thead><tbody>{expenses.map((item) => <tr key={item.id}><td>{contract.contractType === "temporary" ? "Estadía" : item.periodKey}</td><td>{item.concept}</td><td>{RENTAL_EXPENSE_ALLOCATIONS.find((option) => option.id === item.allocatedTo)?.label}</td><td>{formatRentalMoney(item.amountMinor, contract.currency)}</td></tr>)}</tbody></table></div>}</div></section></div>
      </section>

      {canManage && <section className="card border-danger mb-4"><div className="card-body p-4 d-flex flex-wrap justify-content-between gap-3"><div><h2 className="h6 text-danger">Archivar contrato</h2><p className="small text-muted mb-0">No elimina obligaciones ni recibos: conserva la trazabilidad administrativa.</p></div><button type="button" className="btn btn-outline-danger" onClick={() => { if (window.confirm("¿Archivar este contrato?")) runAction(async () => { await archiveRentalContract(activeInmobiliariaId, contractId); navigate("/admin/alquileres"); }, ""); }}>Archivar</button></div></section>}
    </main>
  );
};

export default RentalContractDetailPage;
