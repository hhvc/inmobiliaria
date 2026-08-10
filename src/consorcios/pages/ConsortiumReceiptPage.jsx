import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import SEO from "../../components/SEO";
import { useActiveInmobiliariaModules } from "../../inmobiliaria/hooks/useActiveInmobiliariaModules";
import { formatRentalAmountInWords } from "../../alquileres/utils/rental.helpers";
import {
  getConsortiumById,
  getConsortiumPaymentById,
} from "../services/consorcio.service";
import { CONSORTIUM_PAYMENT_METHODS } from "../utils/consorcio.constants";
import {
  formatConsortiumMoney,
  getConsortiumPeriodLabel,
} from "../utils/consorcio.helpers";
import "../consorcio.css";

const ReceiptCopy = ({ label, consortium, payment }) => {
  const responsible = payment.unitSnapshot?.ownerName
    || payment.unitSnapshot?.occupantName
    || "responsable de la unidad";
  const method = CONSORTIUM_PAYMENT_METHODS.find((item) => item.id === payment.method)?.label
    || payment.method;
  return (
    <section className="consortium-receipt-sheet mb-4">
      {payment.voided && <div className="alert alert-danger text-center fw-bold">RECIBO ANULADO · {payment.voidReason}</div>}
      <div className="d-flex justify-content-between gap-3 border-bottom pb-3 mb-4">
        <div><p className="text-uppercase text-muted small mb-1">Recibo de expensas</p><h2 className="h4 mb-1">{consortium.name}</h2><p className="mb-0">{consortium.address}</p></div>
        <div className="text-end"><span className="badge text-bg-light border text-dark">{label}</span><div className="mt-2"><strong>N.º interno</strong><br />{payment.id.slice(0, 12).toUpperCase()}</div></div>
      </div>
      <p>Recibí de <strong>{responsible}</strong>, correspondiente a la unidad <strong>{payment.unitSnapshot?.code || payment.unitId}</strong>, la suma de:</p>
      <div className="alert alert-success">
        <strong>{formatRentalAmountInWords(payment.amountMinor, payment.currency)}</strong>{" "}
        <span>({formatConsortiumMoney(payment.amountMinor, payment.currency)})</span>
      </div>
      <div className="row g-3 mt-2">
        <div className="col-md-6"><strong>Período:</strong> {getConsortiumPeriodLabel(payment.periodKey)}</div>
        <div className="col-md-6"><strong>Fecha de cobro:</strong> {payment.date}</div>
        <div className="col-md-6"><strong>Medio:</strong> {method}</div>
        <div className="col-md-6"><strong>Referencia:</strong> {payment.reference || "Sin referencia"}</div>
      </div>
      {payment.notes && <p className="mt-3"><strong>Observaciones:</strong> {payment.notes}</p>}
      <div className="row justify-content-end"><div className="col-7 col-md-5 text-center consortium-signature-line">Firma y aclaración del administrador</div></div>
      <p className="small text-muted mt-5 mb-0">Comprobante de gestión emitido por ONO Prop. Conservá la documentación bancaria o fiscal que corresponda.</p>
    </section>
  );
};

const ConsortiumReceiptPage = () => {
  const { id: consortiumId = "", paymentId = "" } = useParams();
  const { activeInmobiliariaId, loading: agencyLoading } = useActiveInmobiliariaModules();
  const [consortium, setConsortium] = useState(null);
  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!activeInmobiliariaId) return;
      try {
        setLoading(true);
        const [consortiumData, paymentData] = await Promise.all([
          getConsortiumById(activeInmobiliariaId, consortiumId),
          getConsortiumPaymentById(activeInmobiliariaId, paymentId),
        ]);
        if (!consortiumData || !paymentData || paymentData.consortiumId !== consortiumId) {
          throw new Error("El recibo no existe para este consorcio.");
        }
        if (mounted) {
          setConsortium(consortiumData);
          setPayment(paymentData);
        }
      } catch (loadError) {
        if (mounted) setError(loadError.message || "No se pudo cargar el recibo.");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [activeInmobiliariaId, consortiumId, paymentId]);

  if (loading || agencyLoading) return <main className="container py-5 text-center">Cargando recibo...</main>;
  if (error || !payment || !consortium) return <main className="container py-5"><div className="alert alert-danger">{error || "Recibo no encontrado."}</div></main>;

  return (
    <main className="container py-4 consortium-receipt-page">
      <SEO title={`Recibo ${payment.periodKey} | ${consortium.name}`} noIndex />
      <div className="d-flex justify-content-between align-items-center gap-2 mb-4 consortium-no-print">
        <Link className="btn btn-outline-secondary" to={`/admin/consorcios/${consortiumId}`}>← Volver al consorcio</Link>
        <button className="btn btn-primary" type="button" onClick={() => window.print()}>Imprimir duplicado / guardar PDF</button>
      </div>
      <ReceiptCopy label="ORIGINAL · Unidad" consortium={consortium} payment={payment} />
      <ReceiptCopy label="DUPLICADO · Administración" consortium={consortium} payment={payment} />
    </main>
  );
};

export default ConsortiumReceiptPage;
