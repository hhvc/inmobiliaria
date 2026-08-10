import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import SEO from "../../components/SEO";
import { useActiveInmobiliariaModules } from "../../inmobiliaria/hooks/useActiveInmobiliariaModules";
import {
  getRentalContractById,
  getRentalExpenses,
  getRentalObligations,
  getRentalSettlements,
} from "../services/rental.service";
import {
  buildRentalOwnerAccountStatement,
  formatRentalMoney,
} from "../utils/rental.helpers";
import "../rental.css";

const todayLabel = () => new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
}).format(new Date());

const RentalOwnerAccountPage = () => {
  const { id: contractId } = useParams();
  const { activeInmobiliariaId, activeInmobiliaria } = useActiveInmobiliariaModules();
  const [contract, setContract] = useState(null);
  const [obligations, setObligations] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!activeInmobiliariaId || !contractId) return;
    try {
      setLoading(true);
      setError("");
      const [contractData, obligationData, expenseData, settlementData] = await Promise.all([
        getRentalContractById(activeInmobiliariaId, contractId),
        getRentalObligations(activeInmobiliariaId, contractId),
        getRentalExpenses(activeInmobiliariaId, contractId),
        getRentalSettlements(activeInmobiliariaId, contractId),
      ]);
      if (!contractData) throw new Error("No se encontró el contrato.");
      setContract(contractData);
      setObligations(obligationData);
      setExpenses(expenseData);
      setSettlements(settlementData);
    } catch (loadError) {
      setError(loadError.message || "No se pudo generar la cuenta corriente.");
    } finally {
      setLoading(false);
    }
  }, [activeInmobiliariaId, contractId]);

  useEffect(() => { load(); }, [load]);

  const statement = useMemo(() => buildRentalOwnerAccountStatement({
    obligations,
    settlements,
    expenses,
  }), [expenses, obligations, settlements]);

  if (loading) return <main className="container py-5 text-center">Generando cuenta corriente...</main>;
  if (!contract) return <main className="container py-5"><div className="alert alert-danger">{error || "Contrato no disponible."}</div></main>;

  const currency = contract.currency || "ARS";
  const locadorNames = contract.partySnapshots?.owners?.map((item) => item.name).join(", ") || "Locador no informado";
  const balanceLabel = statement.balanceMinor >= 0
    ? "Saldo a favor del locador"
    : "Saldo a favor de la inmobiliaria";

  return (
    <main className="container py-4 rental-account-page">
      <SEO title={`Cuenta corriente · ${locadorNames} | ONO Prop`} noIndex />

      <div className="rental-no-print d-flex flex-wrap justify-content-between gap-3 mb-4">
        <Link className="btn btn-outline-secondary" to={`/admin/alquileres/${contractId}`}>Volver al contrato</Link>
        <button type="button" className="btn btn-primary" onClick={() => window.print()}>Imprimir / guardar PDF</button>
      </div>

      {error && <div className="alert alert-danger rental-no-print">{error}</div>}

      <article className="card border-0 shadow-sm rental-account-card">
        <div className="card-body p-4 p-lg-5">
          <header className="border-bottom pb-3 mb-4">
            <div className="d-flex flex-wrap justify-content-between gap-3">
              <div>
                <p className="text-uppercase text-muted small mb-1">Administración de alquileres</p>
                <h1 className="h3 mb-1">Cuenta corriente del locador</h1>
                <p className="mb-0"><strong>{locadorNames}</strong></p>
              </div>
              <div className="text-md-end small">
                <div><strong>{activeInmobiliaria?.nombre || "Inmobiliaria"}</strong></div>
                <div>Emitida el {todayLabel()}</div>
                <div>Moneda: {currency}</div>
              </div>
            </div>
          </header>

          <section className="mb-4">
            <h2 className="h6 text-uppercase text-muted">Contrato administrado</h2>
            <div className="row g-2 small">
              <div className="col-md-6"><strong>Inmueble:</strong> {contract.inmuebleSnapshot?.title || "Sin título"}</div>
              <div className="col-md-6"><strong>Dirección:</strong> {contract.inmuebleSnapshot?.address || "Sin dirección"}</div>
              <div className="col-md-6"><strong>Locatario:</strong> {contract.partySnapshots?.tenants?.map((item) => item.name).join(", ") || "Sin informar"}</div>
              <div className="col-md-6"><strong>Vigencia:</strong> {contract.startDate} a {contract.endDate}</div>
            </div>
          </section>

          <section className="row g-3 mb-4" aria-label="Resumen de cuenta corriente">
            <div className="col-md-4"><div className="border rounded p-3 h-100"><small className="text-uppercase text-muted">Créditos del locador</small><strong className="d-block fs-5 text-success">{formatRentalMoney(statement.totalCreditMinor, currency)}</strong></div></div>
            <div className="col-md-4"><div className="border rounded p-3 h-100"><small className="text-uppercase text-muted">Débitos y pagos</small><strong className="d-block fs-5 text-danger">{formatRentalMoney(statement.totalDebitMinor, currency)}</strong></div></div>
            <div className="col-md-4"><div className="border rounded p-3 h-100"><small className="text-uppercase text-muted">{balanceLabel}</small><strong className={`d-block fs-5 ${statement.balanceMinor > 0 ? "text-warning" : "text-success"}`}>{formatRentalMoney(Math.abs(statement.balanceMinor), currency)}</strong></div></div>
          </section>

          <section>
            <div className="table-responsive">
              <table className="table table-sm align-middle rental-account-table">
                <thead>
                  <tr><th>Fecha</th><th>Período</th><th>Concepto</th><th className="text-end">Crédito</th><th className="text-end">Débito</th><th className="text-end">Saldo</th></tr>
                </thead>
                <tbody>
                  {statement.movements.map((movement) => (
                    <tr key={movement.id}>
                      <td>{movement.date || "Sin fecha"}</td>
                      <td>{movement.periodKey || "—"}</td>
                      <td>{movement.concept}</td>
                      <td className="text-end text-success">{movement.creditMinor ? formatRentalMoney(movement.creditMinor, currency) : "—"}</td>
                      <td className="text-end text-danger">{movement.debitMinor ? formatRentalMoney(movement.debitMinor, currency) : "—"}</td>
                      <td className={`text-end fw-semibold ${movement.balanceMinor < 0 ? "text-danger" : ""}`}>{formatRentalMoney(movement.balanceMinor, currency)}</td>
                    </tr>
                  ))}
                  {statement.movements.length === 0 && <tr><td className="text-center text-muted py-4" colSpan="6">Todavía no hay movimientos para mostrar.</td></tr>}
                </tbody>
                <tfoot>
                  <tr className="fw-bold"><td colSpan="3">Totales</td><td className="text-end">{formatRentalMoney(statement.totalCreditMinor, currency)}</td><td className="text-end">{formatRentalMoney(statement.totalDebitMinor, currency)}</td><td className="text-end">{formatRentalMoney(statement.balanceMinor, currency)}</td></tr>
                </tfoot>
              </table>
            </div>
          </section>

          <div className="small text-muted border-top pt-3 mt-4">
            Los créditos representan cobros administrados a favor del locador. Los débitos comprenden honorarios, gastos a su cargo y pagos realizados. Un pago con recepción pendiente reduce el saldo porque el dinero ya salió de la inmobiliaria, pero conserva esa advertencia hasta su confirmación.
          </div>
        </div>
      </article>
    </main>
  );
};

export default RentalOwnerAccountPage;
