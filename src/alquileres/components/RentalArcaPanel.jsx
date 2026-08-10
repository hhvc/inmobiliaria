import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

import {
  ARCA_RECEIVER_IVA_CONDITIONS,
  authorizeProductionRentalArcaPreview,
  authorizeRentalArcaDraft,
  createRentalArcaDraft,
  getArcaOverview,
  prepareProductionRentalArcaPreview,
  testArcaProductionConnection,
} from "../services/arca.service";
import {
  generateRentalObligations,
  markRentalObligationExternallyInvoiced,
  unmarkRentalObligationExternallyInvoiced,
} from "../services/rental.service";
import { RENTAL_EXTERNAL_VOUCHER_TYPES } from "../utils/rental.constants";
import {
  formatRentalMoney,
  getObligationStatus,
  isRentalObligationWithinContract,
  majorToMinor,
  minorToMajorInput,
} from "../utils/rental.helpers";

const todayKey = () => new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Argentina/Buenos_Aires",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());

const shiftDateKey = (dateKey, days) => {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days, 12));
  return date.toISOString().slice(0, 10);
};

const STATUS = {
  draft: ["Borrador", "text-bg-secondary"],
  authorizing: ["Autorizando", "text-bg-info"],
  pending_reconciliation: ["A reconciliar", "text-bg-warning"],
  rejected: ["Rechazado", "text-bg-danger"],
  authorized: ["Autorizado HOMO", "text-bg-success"],
};

const PRODUCTION_STATUS = {
  production_preview: ["Preparada para emisión", "text-bg-warning"],
  authorizing: ["Emitiendo en Producción", "text-bg-info"],
  pending_reconciliation: ["Respuesta a reconciliar", "text-bg-warning"],
  rejected: ["Rechazada en Producción", "text-bg-danger"],
  authorized: ["Autorizada en Producción", "text-bg-success"],
};

const PAYMENT_STATUS = {
  pending: ["Pendiente", "text-bg-warning"],
  partial: ["Pago parcial", "text-bg-info"],
  overdue: ["Vencido", "text-bg-danger"],
  paid: ["Pagado", "text-bg-success"],
  closed_external: ["Cancelación externa", "text-bg-dark"],
};

const isProductionTestFresh = (profile = {}) => {
  const checkedAt = new Date(profile.lastProductionTest?.checkedAt || 0).getTime();
  return profile.lastProductionTest?.configuredPointAvailable === true
    && Number.isFinite(checkedAt)
    && checkedAt >= Date.now() - (30 * 24 * 60 * 60 * 1000);
};

const inferDocumentType = (taxId = "") => {
  const digits = taxId.toString().replace(/\D/g, "");
  if (digits.length === 11) return 80;
  if (digits.length >= 7) return 96;
  return 99;
};

const RentalArcaPanel = ({
  inmobiliariaId,
  contract,
  obligations,
  people = [],
  onObligationsChanged,
}) => {
  const tenants = useMemo(() => {
    const tenantIds = Array.isArray(contract.partyIds?.tenants)
      ? contract.partyIds.tenants
      : [];
    const currentPeople = new Map(people.map((person) => [person.id, person]));
    const snapshots = new Map(
      (contract.partySnapshots?.tenants || []).map((person) => [person.id, person]),
    );
    return tenantIds.map((id) => currentPeople.get(id) || snapshots.get(id)).filter(Boolean);
  }, [contract, people]);
  const [overview, setOverview] = useState({ profiles: [], drafts: [] });
  const [selectedObligationId, setSelectedObligationId] = useState("");
  const [externalInvoiceObligationId, setExternalInvoiceObligationId] = useState("");
  const [externalInvoice, setExternalInvoice] = useState({
    voucherType: "factura_c",
    pointOfSale: "",
    voucherNumber: "",
    invoiceDate: todayKey(),
    amount: "",
    cae: "",
    notes: "",
  });
  const [form, setForm] = useState({
    profileId: "",
    tenantId: tenants[0]?.id || "",
    name: tenants[0]?.name || "",
    documentType: inferDocumentType(tenants[0]?.taxId),
    documentNumber: tenants[0]?.taxId || "",
    ivaConditionId: 5,
    invoiceDate: todayKey(),
    amount: "",
    serviceFrom: "",
    serviceTo: "",
    paymentDueDate: "",
    adjustmentReason: "",
    description: "",
  });
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const draftFormRef = useRef(null);
  const externalInvoiceFormRef = useRef(null);
  const staleObligations = useMemo(() => obligations.filter(
    (item) => !isRentalObligationWithinContract(item, contract),
  ), [contract, obligations]);

  const load = useCallback(async () => {
    if (!inmobiliariaId) return;
    try {
      setLoading(true);
      const data = await getArcaOverview(inmobiliariaId);
      setOverview(data);
      setForm((current) => ({
        ...current,
        profileId: data.profiles?.some((item) => item.id === current.profileId)
          ? current.profileId
          : data.profiles?.[0]?.id || "",
      }));
    } catch (loadError) {
      setError(loadError.message || "No se pudo cargar la integración ARCA.");
    } finally {
      setLoading(false);
    }
  }, [inmobiliariaId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!selectedObligationId) return;
    window.requestAnimationFrame(() => {
      draftFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [selectedObligationId]);

  useEffect(() => {
    if (!externalInvoiceObligationId) return;
    window.requestAnimationFrame(() => {
      externalInvoiceFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [externalInvoiceObligationId]);

  const reconcileContractPeriods = async () => {
    try {
      setWorking(true);
      setError("");
      setNotice("");
      const result = await generateRentalObligations({
        inmobiliariaId,
        contractId: contract.id,
        throughDate: todayKey(),
      });
      await onObligationsChanged?.();
      await load();
      setNotice(
        `Períodos sincronizados: ${result.synchronized || 0}. `
        + `Apartados por quedar fuera del contrato: ${result.voided || 0}. `
        + `${result.skippedWithPayments || 0} requieren revisión por tener pagos o actividad externa registrada.`,
      );
    } catch (actionError) {
      setError(actionError.message || "No se pudieron sincronizar los períodos contractuales.");
    } finally {
      setWorking(false);
    }
  };

  const selectTenant = (tenantId) => {
    const tenant = tenants.find((item) => item.id === tenantId) || {};
    setForm((current) => ({
      ...current,
      tenantId,
      name: tenant.name || "",
      documentType: inferDocumentType(tenant.taxId),
      documentNumber: tenant.taxId || "",
      ivaConditionId: Number(tenant.ivaConditionId || 5),
    }));
  };

  const selectObligation = (obligation) => {
    const draft = draftFor(obligation.id);
    const draftTenant = tenants.find((item) => item.id === draft?.recipient?.partyId);
    const tenant = draftTenant || tenants[0] || {};
    const reuseDraftRecipient = Boolean(draftTenant && draft?.status !== "rejected");
    const invoiceDate = draft?.status === "rejected"
      ? todayKey()
      : draft?.invoiceDate || todayKey();
    const storedDueDate = draft?.paymentDueDate || obligation.dueDate || "";
    const paymentDueDate = storedDueDate && storedDueDate >= invoiceDate
      ? storedDueDate
      : invoiceDate;
    setSelectedObligationId(obligation.id);
    setForm((current) => ({
      ...current,
      profileId: overview.profiles?.some((item) => item.id === draft?.issuerProfileId)
        ? draft.issuerProfileId
        : overview.profiles?.some((item) => item.id === current.profileId)
          ? current.profileId
          : overview.profiles?.[0]?.id || "",
      tenantId: reuseDraftRecipient ? draft.recipient.partyId : tenant.id || "",
      name: reuseDraftRecipient ? draft.recipient.name : tenant.name || "",
      documentType: Number(reuseDraftRecipient
        ? draft.recipient.documentType
        : inferDocumentType(tenant.taxId)),
      documentNumber: reuseDraftRecipient
        ? draft.recipient.documentNumber
        : tenant.taxId || "",
      ivaConditionId: Number(reuseDraftRecipient
        ? draft.recipient.ivaConditionId
        : tenant.ivaConditionId || 5),
      invoiceDate,
      amount: minorToMajorInput(draft?.amountMinor ?? obligation.totalAmountMinor),
      serviceFrom: draft?.serviceFrom || obligation.serviceStartDate || "",
      serviceTo: draft?.serviceTo || obligation.serviceEndDate || "",
      paymentDueDate,
      adjustmentReason: draft?.adjustmentReason || "",
      description: draft?.description || "",
    }));
  };

  const prepareDraft = async (event) => {
    event.preventDefault();
    try {
      setWorking(true);
      setError("");
      setNotice("");
      await createRentalArcaDraft({
        inmobiliariaId,
        contractId: contract.id,
        obligationId: selectedObligationId,
        profileId: form.profileId,
        tenantId: form.tenantId,
        invoiceDate: form.invoiceDate,
        amountMinor: majorToMinor(form.amount),
        serviceFrom: form.serviceFrom,
        serviceTo: form.serviceTo,
        paymentDueDate: form.paymentDueDate,
        adjustmentReason: form.adjustmentReason,
        description: form.description,
        recipient: {
          name: form.name,
          documentType: Number(form.documentType),
          documentNumber: form.documentNumber,
          ivaConditionId: Number(form.ivaConditionId),
        },
      });
      await load();
      setSelectedObligationId("");
      setNotice("Borrador fiscal validado. Todavía no fue enviado a ARCA.");
    } catch (actionError) {
      setError(actionError.message || "No se pudo preparar el borrador fiscal.");
    } finally {
      setWorking(false);
    }
  };

  const authorize = async (draft) => {
    const confirmed = window.confirm(
      "Se solicitará un CAE en HOMOLOGACIÓN. No es una factura fiscal de producción. ¿Continuar?",
    );
    if (!confirmed) return;
    try {
      setWorking(true);
      setError("");
      setNotice("");
      await authorizeRentalArcaDraft({ inmobiliariaId, draftId: draft.id });
      await load();
      setNotice("Comprobante autorizado por ARCA en homologación.");
    } catch (actionError) {
      setError(actionError.message || "No se pudo autorizar el comprobante.");
      await load();
    } finally {
      setWorking(false);
    }
  };

  const prepareProductionPreview = async (draft) => {
    const confirmed = window.confirm(
      "Se consultará Producción para obtener la numeración actual y generar una vista previa. No se solicitará CAE ni se reservará un número. ¿Continuar?",
    );
    if (!confirmed) return;
    try {
      setWorking(true);
      setError("");
      setNotice("");
      const profileId = draft.issuerProfileId || form.profileId;
      const profile = overview.profiles?.find((item) => item.id === profileId);
      let validationRefreshed = false;
      if (!isProductionTestFresh(profile)) {
        const testResult = await testArcaProductionConnection(profileId);
        if (testResult.configuredPointAvailable !== true) {
          throw new Error("ARCA Producción respondió, pero el punto de venta configurado no está disponible.");
        }
        validationRefreshed = true;
      }
      await prepareProductionRentalArcaPreview({
        inmobiliariaId,
        draftId: draft.id,
        profileId,
      });
      await load();
      setNotice(`${validationRefreshed ? "Conexión PROD validada. " : ""}Vista previa productiva actualizada. No se solicitó CAE ni se reservó numeración.`);
    } catch (actionError) {
      setError(actionError.message || "No se pudo preparar la vista previa productiva.");
      await load();
    } finally {
      setWorking(false);
    }
  };

  const authorizeProduction = async (preview) => {
    const confirmed = window.confirm(
      `ATENCIÓN: se solicitará un CAE REAL en ARCA Producción por ${formatRentalMoney(preview.amountMinor, "ARS")} para ${preview.recipient?.name}. El comprobante no podrá eliminarse. ¿Querés continuar?`,
    );
    if (!confirmed) return;
    const confirmationText = window.prompt(
      `Última confirmación: Factura C · PV ${preview.pointOfSale} · N.º estimado ${preview.proposedVoucherNumber}. Escribí exactamente ${preview.confirmationText || `EMITIR ${preview.pointOfSale}-${preview.proposedVoucherNumber}`} para solicitar el CAE real:`,
      "",
    );
    const expectedConfirmationText = preview.confirmationText
      || `EMITIR ${preview.pointOfSale}-${preview.proposedVoucherNumber}`;
    if (confirmationText?.trim?.().toUpperCase() !== expectedConfirmationText) {
      setError(`La emisión fue cancelada porque no se escribió ${expectedConfirmationText}.`);
      return;
    }
    try {
      setWorking(true);
      setError("");
      setNotice("");
      await authorizeProductionRentalArcaPreview({
        inmobiliariaId,
        previewId: preview.id,
        sequenceObservedAt: preview.sequenceObservedAt,
        confirmationText,
      });
      await load();
      setNotice("Factura autorizada por ARCA Producción. El CAE real quedó asociado al período.");
    } catch (actionError) {
      setError(actionError.message || "No se pudo autorizar la factura en ARCA Producción.");
      await load();
    } finally {
      setWorking(false);
    }
  };

  const selectExternalInvoice = (obligation) => {
    const stored = obligation.externalInvoice?.registered ? obligation.externalInvoice : {};
    setExternalInvoiceObligationId(obligation.id);
    setSelectedObligationId("");
    setExternalInvoice({
      voucherType: stored.voucherType || "factura_c",
      pointOfSale: stored.pointOfSale?.toString?.() || "",
      voucherNumber: stored.voucherNumber?.toString?.() || "",
      invoiceDate: stored.invoiceDate || todayKey(),
      amount: minorToMajorInput(stored.amountMinor ?? obligation.totalAmountMinor),
      cae: stored.cae || "",
      notes: stored.notes || "",
    });
  };

  const saveExternalInvoice = async (event) => {
    event.preventDefault();
    try {
      setWorking(true);
      setError("");
      setNotice("");
      await markRentalObligationExternallyInvoiced({
        inmobiliariaId,
        obligationId: externalInvoiceObligationId,
        ...externalInvoice,
        amountMinor: majorToMinor(externalInvoice.amount),
      });
      await onObligationsChanged?.();
      setExternalInvoiceObligationId("");
      setNotice("Comprobante externo registrado. El período ya no se ofrecerá para facturación ARCA desde ONO Prop.");
    } catch (actionError) {
      setError(actionError.message || "No se pudo registrar el comprobante externo.");
    } finally {
      setWorking(false);
    }
  };

  const removeExternalInvoice = async (obligation) => {
    if (!window.confirm("Se quitará la marca de facturación externa y el período volverá a estar disponible. ¿Continuar?")) return;
    try {
      setWorking(true);
      setError("");
      setNotice("");
      await unmarkRentalObligationExternallyInvoiced({
        inmobiliariaId,
        obligationId: obligation.id,
      });
      await onObligationsChanged?.();
      setExternalInvoiceObligationId("");
      setNotice("Marca de facturación externa retirada; se conservó su historial de auditoría.");
    } catch (actionError) {
      setError(actionError.message || "No se pudo retirar la marca de facturación externa.");
    } finally {
      setWorking(false);
    }
  };

  const draftFor = (obligationId) => overview.drafts?.find((item) => item.obligationId === obligationId);
  const contractProductionPreviews = overview.productionPreviews?.filter(
    (item) => item.contractId === contract.id,
  ) || [];
  const productionPreviewFor = (obligationId) => contractProductionPreviews.find(
    (item) => item.obligationId === obligationId,
  );
  const selectedObligation = obligations.find((item) => item.id === selectedObligationId);
  const externalInvoiceHasData = externalInvoice.voucherType !== "unknown";
  const hasFiscalAdjustments = Boolean(selectedObligation && (
    majorToMinor(form.amount) !== Number(selectedObligation.totalAmountMinor || 0)
    || form.serviceFrom !== (selectedObligation.serviceStartDate || "")
    || form.serviceTo !== (selectedObligation.serviceEndDate || "")
    || form.paymentDueDate !== (selectedObligation.dueDate || "")
  ));
  const resetDraftToContract = () => {
    if (!selectedObligation) return;
    const invoiceDate = todayKey();
    setForm((current) => ({
      ...current,
      invoiceDate,
      amount: minorToMajorInput(selectedObligation.totalAmountMinor),
      serviceFrom: selectedObligation.serviceStartDate || "",
      serviceTo: selectedObligation.serviceEndDate || "",
      paymentDueDate: selectedObligation.dueDate >= invoiceDate
        ? selectedObligation.dueDate
        : invoiceDate,
      adjustmentReason: "",
      description: `Alquiler ${selectedObligation.periodKey} · ${contract.inmuebleSnapshot?.address || "Inmueble"}`,
    }));
  };

  return (
    <section className="card border-0 shadow-sm mb-4">
      <div className="card-body p-4">
        <div className="d-flex flex-wrap justify-content-between gap-3 mb-3">
          <div>
            <p className="text-uppercase text-muted small mb-1">Integración fiscal</p>
            <h2 className="h5 mb-1">Comprobantes ARCA</h2>
            <p className="text-muted small mb-0">Borradores de homologación y emisión real controlada de Factura C en Producción.</p>
          </div>
          <span className="badge text-bg-primary align-self-start">HOMO + PROD</span>
        </div>

        {error && <div className="alert alert-danger">{error}</div>}
        {notice && <div className="alert alert-success">{notice}</div>}
        {staleObligations.length > 0 && (
          <div className="alert alert-warning d-flex flex-wrap justify-content-between align-items-center gap-3">
            <div><strong>Hay {staleObligations.length} períodos fuera de la vigencia actual.</strong><span className="d-block small">Se apartarán únicamente los que no tengan pagos; no se borra el historial.</span></div>
            <button type="button" className="btn btn-warning" disabled={working} onClick={reconcileContractPeriods}>Sincronizar períodos ahora</button>
          </div>
        )}
        {loading && <p className="text-muted mb-0">Cargando configuración fiscal...</p>}
        {!loading && overview.profiles?.length === 0 && (
          <div className="alert alert-light border mb-0">No hay un perfil fiscal activo para esta inmobiliaria. {overview.productionPreviewEnabled ? <Link to="/admin/arca">Revisar perfiles ARCA</Link> : "Solicitá su activación a ONO Prop"}.</div>
        )}

        {!loading && (
          <>
            <div className="table-responsive">
              <table className="table table-sm align-middle">
                <thead><tr><th>Período</th><th>Importe</th><th>Estado de cobro</th><th>Estado fiscal</th><th className="text-end">Acción</th></tr></thead>
                <tbody>
                  {obligations.map((obligation) => {
                    const draft = draftFor(obligation.id);
                    const productionPreview = productionPreviewFor(obligation.id);
                    const productionAuthorized = productionPreview?.status === "authorized" && productionPreview?.cae;
                    const productionProfileEnabled = overview.profiles?.find(
                      (item) => item.id === (draft?.issuerProfileId || form.profileId),
                    )?.productionIssuanceEnabled === true;
                    const [label, badge] = STATUS[draft?.status]
                      || (overview.profiles?.length > 0
                        ? ["Sin preparar", "text-bg-light text-dark border"]
                        : ["Sin perfil ARCA", "text-bg-light text-dark border"]);
                    const [paymentLabel, paymentBadge] = PAYMENT_STATUS[getObligationStatus(obligation)] || PAYMENT_STATUS.pending;
                    const canAuthorize = ["draft", "pending_reconciliation"].includes(draft?.status);
                    const externallyInvoiced = obligation.externalInvoice?.registered === true;
                    const closedOutsideManagement = obligation.externalClosure?.closed === true;
                    const externalVoucherLabel = RENTAL_EXTERNAL_VOUCHER_TYPES.find(
                      (item) => item.id === obligation.externalInvoice?.voucherType,
                    )?.label || "Comprobante";
                    return (
                      <tr key={obligation.id}>
                        <td>{obligation.periodKey}</td>
                        <td>{formatRentalMoney(draft?.amountMinor ?? obligation.totalAmountMinor, contract.currency)}{draft?.hasFiscalAdjustments && <small className="d-block text-muted">Obligación actual: {formatRentalMoney(obligation.totalAmountMinor, contract.currency)}</small>}</td>
                        <td><span className={`badge ${paymentBadge}`}>{paymentLabel}</span></td>
                        <td>{externallyInvoiced ? <><span className="badge text-bg-dark">{obligation.externalInvoice.voucherType === "unknown" ? "Gestión fiscal externa · sin datos" : "Facturado externamente"}</span>{obligation.externalInvoice.voucherType !== "unknown" && <small className="d-block text-muted mt-1">{externalVoucherLabel} {obligation.externalInvoice.pointOfSale}-{obligation.externalInvoice.voucherNumber} · {obligation.externalInvoice.invoiceDate}</small>}</> : closedOutsideManagement ? <><span className="badge text-bg-dark">Fuera de gestión</span><small className="d-block text-muted mt-1">Facturación no administrada por ONO Prop</small></> : productionAuthorized ? <><span className="badge text-bg-success">Autorizado PROD</span><small className="d-block text-success mt-1">CAE {productionPreview.cae} · N.º {productionPreview.pointOfSale}-{productionPreview.voucherNumber}</small></> : <><span className={`badge ${badge}`}>{label}</span>{draft?.cae && <small className="d-block text-muted mt-1">CAE HOMO {draft.cae} · N.º {draft.pointOfSale}-{draft.voucherNumber}</small>}{productionPreview && <small className="d-block text-success mt-1">PROD preparada · N.º estimado {productionPreview.pointOfSale}-{productionPreview.proposedVoucherNumber}</small>}</>}</td>
                        <td className="text-end">
                          {!productionAuthorized && !externallyInvoiced && !closedOutsideManagement && overview.profiles?.length > 0 && !draft?.cae && <button className="btn btn-sm btn-outline-primary" type="button" disabled={working} onClick={() => selectObligation(obligation)}>{draft ? "Revisar" : "Preparar"}</button>}
                          {!productionAuthorized && !externallyInvoiced && !closedOutsideManagement && draft && !draft.cae && canAuthorize && <button className="btn btn-sm btn-primary ms-2" type="button" disabled={working} onClick={() => authorize(draft)}>Solicitar CAE HOMO</button>}
                          {!externallyInvoiced && !closedOutsideManagement && draft?.cae && <Link className="btn btn-sm btn-outline-primary" to={`/admin/alquileres/${contract.id}/comprobantes/${draft.id}`}>Ver HOMO</Link>}
                          {!productionAuthorized && !externallyInvoiced && !closedOutsideManagement && overview.productionPreviewEnabled && productionProfileEnabled && draft && <button className="btn btn-sm btn-outline-success ms-2" type="button" disabled={working} onClick={() => prepareProductionPreview(draft)}>{productionPreview ? "Actualizar PROD" : "Preparar PROD"}</button>}
                          {productionAuthorized && <Link className="btn btn-sm btn-success ms-2" to={`/admin/alquileres/${contract.id}/comprobantes/${productionPreview.id}`}>Ver factura PROD</Link>}
                          {!productionAuthorized && !externallyInvoiced && <button className="btn btn-sm btn-outline-dark ms-2" type="button" disabled={working} onClick={() => selectExternalInvoice(obligation)}>Factura externa</button>}
                          {externallyInvoiced && <><button className="btn btn-sm btn-outline-secondary" type="button" disabled={working} onClick={() => selectExternalInvoice(obligation)}>Editar datos</button><button className="btn btn-sm btn-outline-danger ms-2" type="button" disabled={working} onClick={() => removeExternalInvoice(obligation)}>Quitar marca</button></>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {externalInvoiceObligationId && (
              <form ref={externalInvoiceFormRef} className="border border-dark rounded-3 p-3 mt-3" onSubmit={saveExternalInvoice}>
                <div className="d-flex flex-wrap justify-content-between gap-2 mb-3">
                  <div><h3 className="h6 mb-1">Gestión fiscal fuera de ONO Prop</h3><p className="small text-muted mb-0">Registra los datos disponibles y evita preparar o emitir nuevamente este período.</p></div>
                  <button type="button" className="btn-close" aria-label="Cerrar" onClick={() => setExternalInvoiceObligationId("")} />
                </div>
                <div className="row g-3">
                  <div className="col-sm-6 col-lg-3"><label className="form-label">Tipo</label><select className="form-select" value={externalInvoice.voucherType} onChange={(event) => { const voucherType = event.target.value; setExternalInvoice({ ...externalInvoice, voucherType, ...(voucherType === "unknown" ? { pointOfSale: "", voucherNumber: "", invoiceDate: "", amount: "", cae: "" } : {}) }); }}>{RENTAL_EXTERNAL_VOUCHER_TYPES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></div>
                  <div className="col-6 col-sm-3 col-lg-2"><label className="form-label">Punto de venta</label><input className="form-control" type="number" min="1" required={externalInvoiceHasData} disabled={!externalInvoiceHasData} value={externalInvoice.pointOfSale} onChange={(event) => setExternalInvoice({ ...externalInvoice, pointOfSale: event.target.value })} /></div>
                  <div className="col-6 col-sm-3 col-lg-2"><label className="form-label">Número</label><input className="form-control" type="number" min="1" required={externalInvoiceHasData} disabled={!externalInvoiceHasData} value={externalInvoice.voucherNumber} onChange={(event) => setExternalInvoice({ ...externalInvoice, voucherNumber: event.target.value })} /></div>
                  <div className="col-sm-6 col-lg-2"><label className="form-label">Fecha</label><input className="form-control" type="date" required={externalInvoiceHasData} disabled={!externalInvoiceHasData} value={externalInvoice.invoiceDate} onChange={(event) => setExternalInvoice({ ...externalInvoice, invoiceDate: event.target.value })} /></div>
                  <div className="col-sm-6 col-lg-3"><label className="form-label">Importe facturado</label><input className="form-control" inputMode="decimal" required={externalInvoiceHasData} disabled={!externalInvoiceHasData} value={externalInvoice.amount} onChange={(event) => setExternalInvoice({ ...externalInvoice, amount: event.target.value })} /></div>
                  <div className="col-md-4"><label className="form-label">CAE (opcional)</label><input className="form-control" inputMode="numeric" disabled={!externalInvoiceHasData} value={externalInvoice.cae} onChange={(event) => setExternalInvoice({ ...externalInvoice, cae: event.target.value })} /></div>
                  <div className="col-md-8"><label className="form-label">Notas / sistema de origen</label><input className="form-control" value={externalInvoice.notes} onChange={(event) => setExternalInvoice({ ...externalInvoice, notes: event.target.value })} /></div>
                  {!externalInvoiceHasData && <div className="col-12"><div className="alert alert-warning small py-2 mb-0">Se registrará que la gestión fiscal fue externa, pero que ONO Prop no dispone de los datos del comprobante.</div></div>}
                  <div className="col-12 text-end"><button className="btn btn-dark" disabled={working}>{working ? "Guardando..." : "Registrar gestión fiscal externa"}</button></div>
                </div>
              </form>
            )}

            {overview.productionPreviewEnabled && contractProductionPreviews.length > 0 && (
              <div className="mt-4">
                <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
                  <div>
                    <h3 className="h6 mb-1">Vistas previas de Producción</h3>
                    <p className="small text-muted mb-0">Revisá los datos y solicitá el CAE real únicamente cuando el comprobante corresponda.</p>
                  </div>
                  <span className="badge text-bg-danger">PRODUCCIÓN REAL</span>
                </div>
                {contractProductionPreviews.map((preview) => (
                  <article className="border border-success rounded-3 p-3 mb-3" key={preview.id}>
                    <div className="d-flex flex-wrap justify-content-between gap-3">
                      <div>
                        <strong>{preview.issuerSnapshot?.legalName}</strong>
                        <small className="d-block text-muted">CUIT {preview.issuerCuit} · Factura C · PV {preview.pointOfSale}</small>
                      </div>
                      <div className="text-end">
                        <span className={`badge ${PRODUCTION_STATUS[preview.status]?.[1] || "text-bg-secondary"}`}>{PRODUCTION_STATUS[preview.status]?.[0] || preview.status}</span>
                        <strong className="d-block mt-1">N.º {preview.status === "authorized" ? "autorizado" : "estimado"} {preview.pointOfSale}-{preview.voucherNumber || preview.proposedVoucherNumber}</strong>
                        {preview.status !== "authorized" && <small className="d-block text-muted">Último autorizado observado: {preview.lastAuthorizedVoucher || 0}</small>}
                      </div>
                    </div>
                    <div className="row g-2 small mt-2">
                      <div className="col-md-6"><strong>Receptor:</strong> {preview.recipient?.name} · {preview.recipient?.documentNumber}</div>
                      <div className="col-md-3"><strong>Período:</strong> {preview.periodKey}</div>
                      <div className="col-md-3"><strong>Total:</strong> {formatRentalMoney(preview.amountMinor, "ARS")}</div>
                      <div className="col-md-4"><strong>Comprobante:</strong> {preview.invoiceDate}</div>
                      <div className="col-md-4"><strong>Servicio:</strong> {preview.serviceFrom} a {preview.serviceTo}</div>
                      <div className="col-md-4"><strong>Vencimiento:</strong> {preview.paymentDueDate}</div>
                      <div className="col-12"><strong>Concepto interno:</strong> {preview.description}</div>
                      {preview.hasFiscalAdjustments && <div className="col-12 text-warning-emphasis"><strong>Excepción:</strong> {preview.adjustmentReason}</div>}
                    </div>
                    {preview.status === "authorized" ? <div className="alert alert-success small py-2 mt-3 mb-0 d-flex flex-wrap justify-content-between align-items-center gap-2"><span><strong>Factura fiscal autorizada.</strong> CAE {preview.cae} · vencimiento {preview.caeExpirationDate}.</span><Link className="btn btn-sm btn-success" to={`/admin/alquileres/${contract.id}/comprobantes/${preview.id}`}>Ver comprobante</Link></div> : overview.profiles?.find((item) => item.id === preview.issuerProfileId)?.productionIssuanceEnabled === true ? <div className="alert alert-danger small py-2 mt-3 mb-0 d-flex flex-wrap justify-content-between align-items-center gap-2"><span><strong>Emisión fiscal disponible.</strong> La numeración es estimada hasta que ARCA otorgue el CAE. Consultada el {new Date(preview.sequenceObservedAt).toLocaleString("es-AR")}.</span><button type="button" className="btn btn-sm btn-danger" disabled={working || preview.status === "authorizing"} onClick={() => authorizeProduction(preview)}>{preview.status === "pending_reconciliation" ? "Reconciliar emisión" : "Emitir factura real"}</button></div> : <div className="alert alert-warning small py-2 mt-3 mb-0 d-flex flex-wrap justify-content-between align-items-center gap-2"><span>La emisión real está deshabilitada para este perfil.</span><Link className="btn btn-sm btn-outline-dark" to="/admin/arca">Revisar perfil ARCA</Link></div>}
                  </article>
                ))}
              </div>
            )}

            {selectedObligationId && (
              <form ref={draftFormRef} className="border rounded-3 p-3 mt-3" onSubmit={prepareDraft}>
                <h3 className="h6">Datos del borrador fiscal</h3>
                {selectedObligation && (
                  <div className="alert alert-light border small py-2 d-flex flex-wrap justify-content-between align-items-center gap-2">
                    <span>
                      <strong>Obligación contractual del período:</strong>{" "}
                      {formatRentalMoney(selectedObligation.totalAmountMinor, contract.currency)} ·
                      {" "}servicio {selectedObligation.serviceStartDate} a {selectedObligation.serviceEndDate} ·
                      {" "}vencimiento {selectedObligation.dueDate}. Este importe no es un mínimo de facturación de ARCA.
                    </span>
                    <button type="button" className="btn btn-sm btn-outline-secondary" onClick={resetDraftToContract}>Restablecer desde el contrato</button>
                  </div>
                )}
                <div className="row g-3">
                  <div className="col-lg-4"><label className="form-label">Perfil emisor</label><select className="form-select" required value={form.profileId} onChange={(event) => setForm({ ...form, profileId: event.target.value })}>{overview.profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name} · CUIT {profile.issuerCuit} · PV {profile.pointOfSale}</option>)}</select></div>
                  <div className="col-lg-4"><label className="form-label">Locatario receptor</label><select className="form-select" required value={form.tenantId} onChange={(event) => selectTenant(event.target.value)}>{tenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.name}</option>)}</select></div>
                  <div className="col-lg-4"><label className="form-label">Fecha del comprobante</label><input className="form-control" type="date" required min={shiftDateKey(todayKey(), -10)} max={shiftDateKey(todayKey(), 10)} value={form.invoiceDate} onChange={(event) => setForm({ ...form, invoiceDate: event.target.value, paymentDueDate: form.paymentDueDate < event.target.value ? event.target.value : form.paymentDueDate })} /></div>
                  <div className="col-lg-4"><label className="form-label">Nombre / razón social</label><input className="form-control" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></div>
                  <div className="col-sm-4 col-lg-2"><label className="form-label">Documento</label><select className="form-select" value={form.documentType} onChange={(event) => setForm({ ...form, documentType: Number(event.target.value) })}><option value="80">CUIT</option><option value="96">DNI</option><option value="99">Sin identificar</option></select></div>
                  <div className="col-sm-8 col-lg-3"><label className="form-label">Número</label><input className="form-control" required value={form.documentNumber} onChange={(event) => setForm({ ...form, documentNumber: event.target.value })} /></div>
                  <div className="col-lg-3"><label className="form-label">Condición frente al IVA</label><select className="form-select" required value={form.ivaConditionId} onChange={(event) => setForm({ ...form, ivaConditionId: Number(event.target.value) })}>{ARCA_RECEIVER_IVA_CONDITIONS.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}</select></div>
                  <div className="col-sm-6 col-lg-3"><label className="form-label">Importe a facturar (ARS)</label><input className="form-control" inputMode="decimal" required value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} /></div>
                  <div className="col-sm-6 col-lg-3"><label className="form-label">Servicio desde</label><input className="form-control" type="date" required value={form.serviceFrom} onChange={(event) => setForm({ ...form, serviceFrom: event.target.value })} /></div>
                  <div className="col-sm-6 col-lg-3"><label className="form-label">Servicio hasta</label><input className="form-control" type="date" required value={form.serviceTo} onChange={(event) => setForm({ ...form, serviceTo: event.target.value })} /></div>
                  <div className="col-sm-6 col-lg-3"><label className="form-label">Vencimiento para el pago</label><input className="form-control" type="date" required min={form.invoiceDate} value={form.paymentDueDate} onChange={(event) => setForm({ ...form, paymentDueDate: event.target.value })} /></div>
                  {hasFiscalAdjustments && <div className="col-12"><label className="form-label">Motivo de la excepción *</label><input className="form-control" required maxLength="500" placeholder="Ej.: importe y vencimiento renegociados con el locatario" value={form.adjustmentReason} onChange={(event) => setForm({ ...form, adjustmentReason: event.target.value })} /><small className="text-muted">La obligación contractual no se modifica; esta explicación queda asociada al comprobante.</small></div>}
                  <div className="col-12"><label className="form-label">Descripción interna</label><input className="form-control" placeholder="Alquiler del período" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /><small className="text-muted">Se conserva para trazabilidad; WSFE Factura C no recibe el texto libre del concepto.</small></div>
                </div>
                <p className="small text-muted mt-3 mb-0">ARCA admite para servicios una fecha de comprobante comprendida entre 10 días antes y 10 días después de la solicitud. El vencimiento para el pago no puede ser anterior a esa fecha.</p>
                <div className="d-flex gap-2 mt-3"><button className="btn btn-outline-primary" disabled={working}>Validar y guardar borrador</button><button className="btn btn-link" type="button" onClick={() => setSelectedObligationId("")}>Cancelar</button></div>
              </form>
            )}
          </>
        )}
      </div>
    </section>
  );
};

export default RentalArcaPanel;
