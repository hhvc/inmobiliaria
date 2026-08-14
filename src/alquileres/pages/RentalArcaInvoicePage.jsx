import { useCallback, useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { Link, useParams } from "react-router-dom";

import SEO from "../../components/SEO";
import { useActiveInmobiliariaModules } from "../../inmobiliaria/hooks/useActiveInmobiliariaModules";
import {
  ARCA_RECEIVER_IVA_CONDITIONS,
  authorizeProductionRentalArcaPreview,
  emailAuthorizedArcaVoucher,
  getArcaOverview,
  prepareProductionRentalArcaCreditNotePreview,
} from "../services/arca.service";
import { getRentalContractById } from "../services/rental.service";
import {
  buildArcaQrUrl,
  formatArcaVoucherNumber,
  getArcaDocumentLabel,
  isArcaProductionPreviewFresh,
} from "../utils/arcaInvoice.helpers";
import { formatRentalMoney } from "../utils/rental.helpers";
import "../rental.css";

const IVA_LABELS = Object.fromEntries(
  ARCA_RECEIVER_IVA_CONDITIONS.map((item) => [item.id, item.label]),
);

const formatDate = (value = "") => {
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : value || "—";
};

const todayKey = () => new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Argentina/Buenos_Aires",
}).format(new Date());

const majorToMinor = (value) => Math.round(Number(
  String(value ?? "").trim().replace(/\./g, "").replace(",", "."),
) * 100) || 0;

const RentalArcaInvoicePage = () => {
  const { id: contractId, draftId } = useParams();
  const { activeInmobiliariaId } = useActiveInmobiliariaModules();
  const [contract, setContract] = useState(null);
  const [draft, setDraft] = useState(null);
  const [profile, setProfile] = useState(null);
  const [relatedCreditNotes, setRelatedCreditNotes] = useState([]);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [qrUrl, setQrUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [working, setWorking] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [creditNoteOpen, setCreditNoteOpen] = useState(false);
  const [creditNoteForm, setCreditNoteForm] = useState({
    amount: "",
    reason: "",
    invoiceDate: todayKey(),
  });

  const load = useCallback(async () => {
    if (!activeInmobiliariaId) return;
    try {
      setLoading(true);
      setError("");
      const [contractData, overview] = await Promise.all([
        getRentalContractById(activeInmobiliariaId, contractId),
        getArcaOverview(activeInmobiliariaId),
      ]);
      const draftData = overview.drafts?.find((item) => item.id === draftId)
        || overview.productionPreviews?.find((item) => item.id === draftId);
      if (!contractData || !draftData || draftData.contractId !== contractId) {
        throw new Error("No se encontró el comprobante solicitado.");
      }
      if (draftData.status !== "authorized" || !draftData.cae) {
        throw new Error("El comprobante todavía no fue autorizado por ARCA.");
      }
      setContract(contractData);
      setDraft(draftData);
      setRecipientEmail((current) => current
        || contractData.partySnapshots?.tenants?.find((party) => party.email)?.email
        || "");
      setProfile(overview.profiles?.find(
        (item) => item.id === draftData.issuerProfileId,
      ) || null);
      setRelatedCreditNotes((overview.productionPreviews || []).filter(
        (item) => item.associatedVoucher?.previewId === draftData.id,
      ));
    } catch (loadError) {
      setError(loadError.message || "No se pudo cargar el comprobante.");
    } finally {
      setLoading(false);
    }
  }, [activeInmobiliariaId, contractId, draftId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    let active = true;
    if (!draft) return undefined;
    try {
      const url = buildArcaQrUrl(draft);
      setQrUrl(url);
      QRCode.toDataURL(url, {
        width: 220,
        margin: 1,
        errorCorrectionLevel: "M",
      }).then((dataUrl) => {
        if (active) setQrDataUrl(dataUrl);
      }).catch(() => {
        if (active) setError("No se pudo generar el QR del comprobante.");
      });
    } catch (qrError) {
      setError(qrError.message || "No se pudo generar el QR del comprobante.");
    }
    return () => { active = false; };
  }, [draft]);

  const authorizedCreditMinor = useMemo(() => relatedCreditNotes
    .filter((item) => item.status === "authorized" && item.cae)
    .reduce((total, item) => total + Number(item.amountMinor || 0), 0), [relatedCreditNotes]);

  const prepareCreditNote = async (event) => {
    event.preventDefault();
    const amountMinor = majorToMinor(creditNoteForm.amount);
    const confirmed = window.confirm(
      "Se consultará ARCA para preparar la Nota de Crédito C. Todavía no se emitirá el comprobante. ¿Continuar?",
    );
    if (!confirmed) return;
    try {
      setWorking(true);
      setError("");
      setNotice("");
      await prepareProductionRentalArcaCreditNotePreview({
        inmobiliariaId: activeInmobiliariaId,
        invoicePreviewId: draft.id,
        amountMinor,
        reason: creditNoteForm.reason,
        invoiceDate: creditNoteForm.invoiceDate,
      });
      await load();
      setCreditNoteOpen(false);
      setCreditNoteForm({amount: "", reason: "", invoiceDate: todayKey()});
      setNotice("Vista previa de Nota de Crédito C preparada. No se solicitó CAE.");
    } catch (actionError) {
      setError(actionError.message || "No se pudo preparar la Nota de Crédito C.");
    } finally {
      setWorking(false);
    }
  };

  const authorizeCreditNote = async (creditNote) => {
    const confirmed = window.confirm(
      `ATENCIÓN: se solicitará un CAE REAL para una Nota de Crédito C por ${formatRentalMoney(creditNote.amountMinor, "ARS")}. Este comprobante tendrá validez fiscal. ¿Continuar?`,
    );
    if (!confirmed) return;
    const expected = creditNote.confirmationText
      || `EMITIR NC ${creditNote.pointOfSale}-${creditNote.proposedVoucherNumber}`;
    const confirmationText = window.prompt(
      `Escribí exactamente ${expected} para solicitar el CAE real:`,
      "",
    );
    if (confirmationText?.trim?.().toUpperCase() !== expected) {
      setError(`La emisión fue cancelada porque no se escribió ${expected}.`);
      return;
    }
    try {
      setWorking(true);
      setError("");
      setNotice("");
      await authorizeProductionRentalArcaPreview({
        inmobiliariaId: activeInmobiliariaId,
        previewId: creditNote.id,
        sequenceObservedAt: creditNote.sequenceObservedAt,
        confirmationText,
      });
      await load();
      setNotice("Nota de Crédito C autorizada por ARCA.");
    } catch (actionError) {
      setError(actionError.message || "No se pudo autorizar la Nota de Crédito C.");
      await load();
    } finally {
      setWorking(false);
    }
  };

  const sendByEmail = async (event) => {
    event.preventDefault();
    try {
      setWorking(true);
      setError("");
      setNotice("");
      await emailAuthorizedArcaVoucher({
        inmobiliariaId: activeInmobiliariaId,
        previewId: draft.id,
        recipientEmail,
      });
      setEmailOpen(false);
      setNotice(`El comprobante quedó listo para enviarse a ${recipientEmail}.`);
    } catch (actionError) {
      setError(actionError.message || "No se pudo enviar el comprobante por email.");
    } finally {
      setWorking(false);
    }
  };

  const issuer = useMemo(() => {
    if (!draft) return {};
    return draft.issuerSnapshot || {
      legalName: profile?.issuerLegalName || profile?.name || "",
      tradeName: profile?.issuerTradeName || "",
      commercialAddress: profile?.commercialAddress || "",
      grossIncomeNumber: profile?.grossIncomeNumber || "",
      activityStartDate: profile?.activityStartDate || "",
      ivaConditionId: Number(profile?.issuerIvaConditionId || 6),
    };
  }, [draft, profile]);

  const missingIssuerFields = useMemo(() => ([
    ["apellido y nombre / razón social", issuer.legalName],
    ["domicilio comercial", issuer.commercialAddress],
    ["Ingresos Brutos", issuer.grossIncomeNumber],
    ["inicio de actividades", issuer.activityStartDate],
  ].filter(([, value]) => !value).map(([label]) => label)), [issuer]);

  if (loading) return <main className="container py-5 text-center">Cargando comprobante...</main>;
  if (error && !draft) return <main className="container py-5"><div className="alert alert-danger">{error}</div></main>;

  const voucherNumber = formatArcaVoucherNumber(draft.pointOfSale, draft.voucherNumber);
  const issuerIva = IVA_LABELS[Number(issuer.ivaConditionId)] || "Responsable Monotributo";
  const recipientIva = IVA_LABELS[Number(draft.recipient?.ivaConditionId)] || "No informada";
  const isProduction = draft.environment === "prod";
  const isCreditNote = Number(draft.voucherType) === 13;
  const voucherLabel = isCreditNote ? "Nota de Crédito C" : "Factura C";
  const remainingCreditMinor = Math.max(0, Number(draft.amountMinor) - authorizedCreditMinor);

  return (
    <main className="container py-4 rental-receipt-page arca-invoice-page">
      <SEO title={`${voucherLabel} ${voucherNumber} | ONO Prop`} noIndex />
      <div className="rental-no-print d-flex flex-wrap justify-content-between gap-3 mb-4">
        <Link className="btn btn-outline-secondary" to={`/admin/alquileres/${contractId}`}>Volver al contrato</Link>
        <div className="d-flex flex-wrap gap-2">
          {isProduction && (
            <button type="button" className="btn btn-outline-primary" onClick={() => setEmailOpen((value) => !value)}>
              Enviar PDF por email
            </button>
          )}
          <button type="button" className="btn btn-primary" onClick={() => window.print()}>Imprimir / guardar PDF</button>
        </div>
      </div>
      {emailOpen && (
        <form className="rental-no-print card border-0 shadow-sm mb-4" onSubmit={sendByEmail}>
          <div className="card-body d-flex flex-wrap align-items-end gap-3">
            <div className="flex-grow-1">
              <label className="form-label" htmlFor="arca-recipient-email">Email destinatario</label>
              <input
                id="arca-recipient-email"
                className="form-control"
                type="email"
                required
                autoComplete="email"
                value={recipientEmail}
                onChange={(event) => setRecipientEmail(event.target.value)}
                placeholder="cliente@ejemplo.com"
              />
            </div>
            <button className="btn btn-primary" disabled={working}>
              {working ? "Enviando..." : "Enviar comprobante"}
            </button>
            <button type="button" className="btn btn-outline-secondary" disabled={working} onClick={() => setEmailOpen(false)}>Cancelar</button>
          </div>
        </form>
      )}
      {missingIssuerFields.length > 0 && (
        <div className="rental-no-print alert alert-warning">
          Antes de usar una representación fiscal real, completá en el perfil emisor: {missingIssuerFields.join(", ")}.
        </div>
      )}
      {notice && <div className="rental-no-print alert alert-success">{notice}</div>}
      {error && <div className="rental-no-print alert alert-danger">{error}</div>}

      <article className="rental-receipt-sheet arca-invoice-sheet">
        {!isProduction && <div className="arca-homologation-banner">HOMOLOGACIÓN · SIN VALIDEZ FISCAL</div>}
        <header className="arca-invoice-header">
          <section>
            {issuer.tradeName && <p className="text-uppercase text-muted small mb-1">{issuer.tradeName}</p>}
            <h1 className="h4 mb-2">{issuer.legalName || profile?.name || "Emisor sin completar"}</h1>
            <p className="small mb-1"><strong>Domicilio comercial:</strong> {issuer.commercialAddress || "Pendiente de configuración"}</p>
            <p className="small mb-0"><strong>Condición frente al IVA:</strong> {issuerIva}</p>
          </section>
          <div className="arca-voucher-letter"><strong>C</strong><small>Cód. {isCreditNote ? "013" : "011"}</small></div>
          <section className="text-end">
            <p className="text-uppercase small mb-1">Original</p>
            <h2 className="h4 mb-2">{voucherLabel}</h2>
            <p className="mb-1"><strong>N.º {voucherNumber}</strong></p>
            <p className="small mb-0"><strong>Fecha:</strong> {formatDate(draft.voucherDate || draft.invoiceDate)}</p>
          </section>
        </header>

        <section className="row g-2 small border-top border-bottom py-3 my-3">
          <div className="col-md-6"><strong>CUIT:</strong> {draft.issuerCuit}</div>
          <div className="col-md-6"><strong>Ingresos Brutos:</strong> {issuer.grossIncomeNumber || "Pendiente de configuración"}</div>
          <div className="col-md-6"><strong>Inicio de actividades:</strong> {formatDate(issuer.activityStartDate)}</div>
          <div className="col-md-6"><strong>Concepto:</strong> Servicios</div>
        </section>

        <section className="row g-2 small mb-3">
          <div className="col-md-4"><strong>Servicio desde:</strong> {formatDate(draft.serviceFrom)}</div>
          <div className="col-md-4"><strong>Servicio hasta:</strong> {formatDate(draft.serviceTo)}</div>
          <div className="col-md-4"><strong>Vencimiento de pago:</strong> {formatDate(draft.paymentDueDate)}</div>
        </section>

        {isCreditNote && (
          <section className="alert alert-light border small mb-3">
            <strong>Comprobante asociado:</strong>{" "}
            Factura C {formatArcaVoucherNumber(
              draft.associatedVoucher?.pointOfSale,
              draft.associatedVoucher?.voucherNumber,
            )} · {formatDate(draft.associatedVoucher?.voucherDate)}
            <span className="d-block mt-1"><strong>Motivo:</strong> {draft.reason}</span>
          </section>
        )}

        <section className="arca-recipient-box small mb-4">
          <div><strong>Cliente:</strong> {draft.recipient?.name}</div>
          <div><strong>{getArcaDocumentLabel(draft.recipient?.documentType)}:</strong> {draft.recipient?.documentNumber}</div>
          <div><strong>Domicilio:</strong> {draft.recipient?.address || "NR"}</div>
          <div><strong>Condición frente al IVA:</strong> {recipientIva}</div>
        </section>

        <div className="table-responsive">
          <table className="table arca-invoice-table">
            <thead><tr><th>Descripción</th><th className="text-end">Importe</th></tr></thead>
            <tbody><tr><td>{draft.description || `Alquiler período ${draft.periodKey}`}<small className="d-block text-muted">{contract.inmuebleSnapshot?.address}</small></td><td className="text-end">{formatRentalMoney(draft.amountMinor, "ARS")}</td></tr></tbody>
            <tfoot><tr><th className="text-end">{isCreditNote ? "Total acreditado" : "Total"}</th><th className="text-end fs-5">{formatRentalMoney(draft.amountMinor, "ARS")}</th></tr></tfoot>
          </table>
        </div>

        <footer className="arca-invoice-footer mt-5 pt-4 border-top">
          <div className="arca-qr-box">
            {qrDataUrl && <a href={qrUrl} target="_blank" rel="noreferrer"><img src={qrDataUrl} alt="QR de verificación ARCA" /></a>}
            <strong>ARCA</strong>
          </div>
          <div className="text-end">
            <p className="mb-1"><strong>CAE:</strong> {draft.cae}</p>
            <p className="mb-1"><strong>Vencimiento CAE:</strong> {formatDate(draft.caeExpirationDate)}</p>
            <p className="small text-muted mb-0">{isProduction ? "Comprobante fiscal autorizado por ARCA." : "Comprobante de prueba sin validez fiscal."}</p>
          </div>
        </footer>
        {!isProduction && <div className="arca-homologation-footer">HOMOLOGACIÓN · ESTE DOCUMENTO NO TIENE VALIDEZ FISCAL</div>}
      </article>

      {isProduction && !isCreditNote && (
        <section className="rental-no-print card border-0 shadow-sm mt-4">
          <div className="card-body p-4">
            <div className="d-flex flex-wrap justify-content-between align-items-start gap-3">
              <div>
                <h2 className="h5 mb-1">Ajustes mediante Nota de Crédito C</h2>
                <p className="text-muted small mb-0">
                  Facturado: {formatRentalMoney(draft.amountMinor, "ARS")} · acreditado: {formatRentalMoney(authorizedCreditMinor, "ARS")} · saldo acreditable: {formatRentalMoney(remainingCreditMinor, "ARS")}.
                </p>
              </div>
              {remainingCreditMinor > 0 && (
                <button type="button" className="btn btn-outline-danger" onClick={() => setCreditNoteOpen((value) => !value)}>
                  {creditNoteOpen ? "Cancelar" : "Preparar Nota de Crédito"}
                </button>
              )}
            </div>

            {creditNoteOpen && (
              <form className="border rounded-3 p-3 mt-3" onSubmit={prepareCreditNote}>
                <div className="alert alert-warning small py-2">
                  Preparar permite revisar todos los datos antes de emitir. El comprobante fiscal se genera recién cuando confirmás la emisión.
                </div>
                <div className="row g-3">
                  <div className="col-md-3">
                    <label className="form-label">Importe a acreditar</label>
                    <input className="form-control" required inputMode="decimal" value={creditNoteForm.amount} onChange={(event) => setCreditNoteForm({...creditNoteForm, amount: event.target.value})} />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label">Fecha</label>
                    <input className="form-control" type="date" required value={creditNoteForm.invoiceDate} onChange={(event) => setCreditNoteForm({...creditNoteForm, invoiceDate: event.target.value})} />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Motivo</label>
                    <input className="form-control" required minLength="10" maxLength="300" value={creditNoteForm.reason} onChange={(event) => setCreditNoteForm({...creditNoteForm, reason: event.target.value})} placeholder="Ej.: Anulación total por error en el importe" />
                  </div>
                  <div className="col-12 text-end">
                    <button className="btn btn-danger" disabled={working}>{working ? "Preparando..." : "Preparar vista previa"}</button>
                  </div>
                </div>
              </form>
            )}

            {relatedCreditNotes.length > 0 && (
              <div className="table-responsive mt-4">
                <table className="table table-sm align-middle">
                  <thead><tr><th>Nota de crédito</th><th>Motivo</th><th>Importe</th><th>Estado</th><th className="text-end">Acción</th></tr></thead>
                  <tbody>{relatedCreditNotes.map((creditNote) => {
                    const requiresRefresh = creditNote.status === "rejected"
                      || !isArcaProductionPreviewFresh(creditNote);
                    return (
                    <tr key={creditNote.id}>
                      <td>{creditNote.status === "authorized" ? formatArcaVoucherNumber(creditNote.pointOfSale, creditNote.voucherNumber) : `Estimada ${creditNote.pointOfSale}-${creditNote.proposedVoucherNumber}`}</td>
                      <td>{creditNote.reason}</td>
                      <td>{formatRentalMoney(creditNote.amountMinor, "ARS")}</td>
                      <td>{creditNote.status === "authorized" ? "Autorizada" : creditNote.status === "rejected" ? "Rechazada" : "Vista previa"}</td>
                      <td className="text-end">
                        {creditNote.status === "authorized" ? (
                          <Link className="btn btn-sm btn-outline-success" to={`/admin/alquileres/${contractId}/comprobantes/${creditNote.id}`}>Ver comprobante</Link>
                        ) : requiresRefresh ? (
                          <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => {
                            setCreditNoteForm({
                              amount: (Number(creditNote.amountMinor || 0) / 100).toFixed(2),
                              reason: creditNote.reason || "",
                              invoiceDate: todayKey(),
                            });
                            setCreditNoteOpen(true);
                          }}>Revisar y actualizar</button>
                        ) : (
                          <button type="button" className="btn btn-sm btn-danger" disabled={working} onClick={() => authorizeCreditNote(creditNote)}>
                            {creditNote.status === "pending_reconciliation" ? "Reconciliar" : "Emitir NC real"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );})}</tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}
    </main>
  );
};

export default RentalArcaInvoicePage;
