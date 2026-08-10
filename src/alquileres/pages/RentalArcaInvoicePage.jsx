import { useCallback, useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { Link, useParams } from "react-router-dom";

import SEO from "../../components/SEO";
import { useActiveInmobiliariaModules } from "../../inmobiliaria/hooks/useActiveInmobiliariaModules";
import {
  ARCA_RECEIVER_IVA_CONDITIONS,
  getArcaOverview,
} from "../services/arca.service";
import { getRentalContractById } from "../services/rental.service";
import {
  buildArcaQrUrl,
  formatArcaVoucherNumber,
  getArcaDocumentLabel,
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

const RentalArcaInvoicePage = () => {
  const { id: contractId, draftId } = useParams();
  const { activeInmobiliariaId } = useActiveInmobiliariaModules();
  const [contract, setContract] = useState(null);
  const [draft, setDraft] = useState(null);
  const [profile, setProfile] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [qrUrl, setQrUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
      setProfile(overview.profiles?.find(
        (item) => item.id === draftData.issuerProfileId,
      ) || null);
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

  return (
    <main className="container py-4 rental-receipt-page arca-invoice-page">
      <SEO title={`Factura C ${voucherNumber} | ONO Prop`} noIndex />
      <div className="rental-no-print d-flex flex-wrap justify-content-between gap-3 mb-4">
        <Link className="btn btn-outline-secondary" to={`/admin/alquileres/${contractId}`}>Volver al contrato</Link>
        <button type="button" className="btn btn-primary" onClick={() => window.print()}>Imprimir / guardar PDF</button>
      </div>
      {missingIssuerFields.length > 0 && (
        <div className="rental-no-print alert alert-warning">
          Antes de usar una representación fiscal real, completá en el perfil emisor: {missingIssuerFields.join(", ")}.
        </div>
      )}
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
          <div className="arca-voucher-letter"><strong>C</strong><small>Cód. 011</small></div>
          <section className="text-end">
            <p className="text-uppercase small mb-1">Original</p>
            <h2 className="h4 mb-2">Factura C</h2>
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
            <tfoot><tr><th className="text-end">Total</th><th className="text-end fs-5">{formatRentalMoney(draft.amountMinor, "ARS")}</th></tr></tfoot>
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
            <p className="small text-muted mb-0">{isProduction ? "Comprobante fiscal autorizado por ARCA Producción." : "Comprobante autorizado en el ambiente de homologación."}</p>
          </div>
        </footer>
        {!isProduction && <div className="arca-homologation-footer">HOMOLOGACIÓN · ESTE DOCUMENTO NO TIENE VALIDEZ FISCAL</div>}
      </article>
    </main>
  );
};

export default RentalArcaInvoicePage;
