import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import SEO from "../../components/SEO";
import { useActiveInmobiliariaModules } from "../../inmobiliaria/hooks/useActiveInmobiliariaModules";
import RentalReceiptCopies from "../components/RentalReceiptCopies";
import {
  getRentalContractById,
  getRentalObligations,
  getRentalSettlements,
} from "../services/rental.service";
import { RENTAL_PAYMENT_METHODS } from "../utils/rental.constants";
import { formatRentalAmountInWords, formatRentalMoney } from "../utils/rental.helpers";
import "../rental.css";

const SETTLEMENT_RECEIPT_COPIES = [
  { id: "original", label: "ORIGINAL", destination: "Locador" },
  { id: "duplicate", label: "DUPLICADO", destination: "Inmobiliaria" },
];

const RentalSettlementReceiptPage = () => {
  const { id: contractId, settlementId } = useParams();
  const { activeInmobiliariaId, activeInmobiliaria } = useActiveInmobiliariaModules();
  const [contract, setContract] = useState(null);
  const [obligation, setObligation] = useState(null);
  const [settlement, setSettlement] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!activeInmobiliariaId) return;
    try {
      const [contractData, obligations, settlements] = await Promise.all([
        getRentalContractById(activeInmobiliariaId, contractId),
        getRentalObligations(activeInmobiliariaId, contractId),
        getRentalSettlements(activeInmobiliariaId, contractId),
      ]);
      const settlementData = settlements.find((item) => item.id === settlementId);
      const obligationData = obligations.find((item) => item.id === settlementData?.obligationId);
      if (!contractData || !settlementData || !obligationData || !["paid", "received"].includes(settlementData.status)) {
        throw new Error("No se encontró una liquidación pagada para emitir el recibo.");
      }
      setContract(contractData);
      setObligation(obligationData);
      setSettlement(settlementData);
    } catch (loadError) {
      setError(loadError.message || "No se pudo cargar el recibo del locador.");
    } finally {
      setLoading(false);
    }
  }, [activeInmobiliariaId, contractId, settlementId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <main className="container py-5 text-center">Cargando recibo del locador...</main>;
  if (error) return <main className="container py-5"><div className="alert alert-danger">{error}</div></main>;

  const locadorNames = contract.partySnapshots?.owners?.map((item) => item.name).join(", ");
  const locatarioNames = contract.partySnapshots?.tenants?.map((item) => item.name).join(", ");
  const method = RENTAL_PAYMENT_METHODS.find((item) => item.id === settlement.paymentMethod)?.label
    || settlement.paymentMethod
    || "No informado";
  const receiptNumber = settlement.receiptNumber
    || `RLOC-${settlement.id.slice(0, 8).toUpperCase()}-${settlement.periodKey?.replace("-", "")}`;

  return (
    <main className="container py-4 rental-receipt-page">
      <SEO title={`Recibo ${receiptNumber} | ONO Prop`} noIndex />
      <div className="rental-no-print d-flex justify-content-between gap-3 mb-4">
        <Link className="btn btn-outline-secondary" to={`/admin/alquileres/${contractId}`}>Volver al contrato</Link>
        <button type="button" className="btn btn-primary" onClick={() => window.print()}>Imprimir duplicado / guardar PDF</button>
      </div>
      <RentalReceiptCopies
        title="Recibo de liquidación al locador"
        receiptNumber={receiptNumber}
        dateLabel="Fecha de pago"
        date={settlement.paidAt}
        agencyName={activeInmobiliaria?.nombre}
        footerText={`Constancia de pago de la liquidación administrada por ${activeInmobiliaria?.nombre || "la inmobiliaria"}. No reemplaza la documentación fiscal que corresponda.`}
        signatureLabel="Firma y aclaración del locador"
        copies={SETTLEMENT_RECEIPT_COPIES}
      >
        <div className="rental-receipt-statement">
          <span className="rental-receipt-lead"><strong>{locadorNames || "El locador identificado en el contrato"}</strong> declara recibir de <strong>{activeInmobiliaria?.nombre || "la inmobiliaria"}</strong> la suma de: </span>
          <strong className="rental-receipt-amount">
            {formatRentalAmountInWords(settlement.netOwnerAmountMinor, contract.currency)}
          </strong>
        </div>
        <dl className="row my-4">
          <dt className="col-sm-4">Período liquidado</dt><dd className="col-sm-8">{obligation.periodKey}</dd>
          <dt className="col-sm-4">Inmueble locado</dt><dd className="col-sm-8">{contract.inmuebleSnapshot?.title}<br /><span className="text-muted">{contract.inmuebleSnapshot?.address}</span></dd>
          <dt className="col-sm-4">Locador</dt><dd className="col-sm-8">{locadorNames || "No informado"}</dd>
          <dt className="col-sm-4">Locatario</dt><dd className="col-sm-8">{locatarioNames || "No informado"}</dd>
          <dt className="col-sm-4">Cobros imputados</dt><dd className="col-sm-8">{formatRentalMoney(settlement.collectedMinor, contract.currency)}</dd>
          <dt className="col-sm-4">Honorarios de administración</dt><dd className="col-sm-8">{formatRentalMoney(settlement.administrationFeeMinor, contract.currency)}</dd>
          <dt className="col-sm-4">Gastos a cargo del locador</dt><dd className="col-sm-8">{formatRentalMoney(settlement.ownerExpensesMinor, contract.currency)}</dd>
          <dt className="col-sm-4">Medio de pago</dt><dd className="col-sm-8">{method}</dd>
          <dt className="col-sm-4">Referencia</dt><dd className="col-sm-8">{settlement.paymentReference || "Sin referencia"}</dd>
        </dl>
        {settlement.paymentNotes && <div className="alert alert-light border"><strong>Observaciones:</strong> {settlement.paymentNotes}</div>}
      </RentalReceiptCopies>
    </main>
  );
};

export default RentalSettlementReceiptPage;
