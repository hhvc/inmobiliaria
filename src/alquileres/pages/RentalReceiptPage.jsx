import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import SEO from "../../components/SEO";
import { useActiveInmobiliariaModules } from "../../inmobiliaria/hooks/useActiveInmobiliariaModules";
import RentalReceiptCopies from "../components/RentalReceiptCopies";
import {
  getRentalContractById,
  getRentalObligations,
} from "../services/rental.service";
import { RENTAL_PAYMENT_METHODS } from "../utils/rental.constants";
import { formatRentalAmountInWords, formatRentalMoney } from "../utils/rental.helpers";
import "../rental.css";

const RentalReceiptPage = () => {
  const { id: contractId, obligationId, paymentId } = useParams();
  const { activeInmobiliariaId, activeInmobiliaria } = useActiveInmobiliariaModules();
  const [contract, setContract] = useState(null);
  const [obligation, setObligation] = useState(null);
  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!activeInmobiliariaId) return;
    try {
      const [contractData, obligations] = await Promise.all([
        getRentalContractById(activeInmobiliariaId, contractId),
        getRentalObligations(activeInmobiliariaId, contractId),
      ]);
      const obligationData = obligations.find((item) => item.id === obligationId);
      const paymentData = obligationData?.payments?.find((item) => item.id === paymentId);
      if (!contractData || !obligationData || !paymentData) throw new Error("No se encontró el recibo solicitado.");
      setContract(contractData);
      setObligation(obligationData);
      setPayment(paymentData);
    } catch (loadError) {
      setError(loadError.message || "No se pudo cargar el recibo.");
    } finally {
      setLoading(false);
    }
  }, [activeInmobiliariaId, contractId, obligationId, paymentId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <main className="container py-5 text-center">Cargando recibo...</main>;
  if (error) return <main className="container py-5"><div className="alert alert-danger">{error}</div></main>;

  const tenantNames = contract.partySnapshots?.tenants?.map((item) => item.name).join(", ");
  const locadorNames = contract.partySnapshots?.owners?.map((item) => item.name).join(", ");
  const method = RENTAL_PAYMENT_METHODS.find((item) => item.id === payment.method)?.label || payment.method;

  return (
    <main className="container py-4 rental-receipt-page">
      <SEO title={`Recibo ${payment.receiptNumber} | ONO Prop`} noIndex />
      <div className="rental-no-print d-flex justify-content-between gap-3 mb-4">
        <Link className="btn btn-outline-secondary" to={`/admin/alquileres/${contractId}`}>Volver al contrato</Link>
        <button type="button" className="btn btn-primary" onClick={() => window.print()}>Imprimir triplicado / guardar PDF</button>
      </div>
      <RentalReceiptCopies
        title="Recibo de pago del locatario"
        receiptNumber={payment.receiptNumber}
        dateLabel="Fecha de pago"
        date={payment.paidAt}
        agencyName={activeInmobiliaria?.nombre}
        footerText={`Comprobante emitido por el módulo de administración de ${activeInmobiliaria?.nombre || "la inmobiliaria"}. No reemplaza la factura ni la documentación fiscal que corresponda.`}
        signatureLabel="Firma y aclaración de la inmobiliaria"
      >
        {payment.voided && <div className="alert alert-danger"><strong>RECIBO ANULADO.</strong> {payment.voidReason || "Movimiento rectificado en el sistema."}</div>}
        <div className="rental-receipt-statement">
          <span className="rental-receipt-lead">Recibimos del <strong>locatario {tenantNames || "identificado en el contrato"}</strong> la suma de: </span>
          <strong className="rental-receipt-amount">
            {formatRentalAmountInWords(payment.amountMinor, contract.currency)}
          </strong>
        </div>
        <dl className="row my-4">
          <dt className="col-sm-4">Período imputado</dt><dd className="col-sm-8">{obligation.periodKey}</dd>
          <dt className="col-sm-4">Inmueble</dt><dd className="col-sm-8">{contract.inmuebleSnapshot?.title}<br /><span className="text-muted">{contract.inmuebleSnapshot?.address}</span></dd>
          <dt className="col-sm-4">Locador</dt><dd className="col-sm-8">{locadorNames || "No informado"}</dd>
          <dt className="col-sm-4">Locatario</dt><dd className="col-sm-8">{tenantNames || "No informado"}</dd>
          <dt className="col-sm-4">Medio de pago</dt><dd className="col-sm-8">{method}</dd>
          <dt className="col-sm-4">Referencia</dt><dd className="col-sm-8">{payment.reference || "Sin referencia"}</dd>
          <dt className="col-sm-4">Saldo del período después del pago</dt><dd className="col-sm-8">{formatRentalMoney(Math.max(0, obligation.totalAmountMinor - obligation.paidAmountMinor), contract.currency)}</dd>
        </dl>
        {payment.notes && <div className="alert alert-light border"><strong>Observaciones:</strong> {payment.notes}</div>}
      </RentalReceiptCopies>
    </main>
  );
};

export default RentalReceiptPage;
