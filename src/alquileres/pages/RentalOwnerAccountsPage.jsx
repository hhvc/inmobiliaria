import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import SEO from "../../components/SEO";
import { useActiveInmobiliariaModules } from "../../inmobiliaria/hooks/useActiveInmobiliariaModules";
import {
  getRentalContracts,
  getRentalExpenses,
  getRentalObligations,
  getRentalPeople,
  getRentalSettlements,
} from "../services/rental.service";
import {
  buildRentalOwnerAccountStatement,
  formatRentalMoney,
} from "../utils/rental.helpers";
import "../rental.css";

const RentalOwnerAccountsPage = () => {
  const { activeInmobiliariaId, activeInmobiliaria } = useActiveInmobiliariaModules();
  const [people, setPeople] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [obligations, setObligations] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [selectedOwnerId, setSelectedOwnerId] = useState("");
  const [selectedCurrency, setSelectedCurrency] = useState("ARS");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!activeInmobiliariaId) return;
    try {
      setLoading(true);
      setError("");
      const [peopleData, contractData, obligationData, expenseData, settlementData] = await Promise.all([
        getRentalPeople(activeInmobiliariaId),
        getRentalContracts(activeInmobiliariaId),
        getRentalObligations(activeInmobiliariaId),
        getRentalExpenses(activeInmobiliariaId),
        getRentalSettlements(activeInmobiliariaId),
      ]);
      setPeople(peopleData);
      setContracts(contractData);
      setObligations(obligationData);
      setExpenses(expenseData);
      setSettlements(settlementData);
      const firstOwner = peopleData.find((person) => person.roles?.includes("owner"));
      setSelectedOwnerId((current) => current || firstOwner?.id || "");
    } catch (loadError) {
      setError(loadError.message || "No se pudieron cargar las cuentas de locadores.");
    } finally {
      setLoading(false);
    }
  }, [activeInmobiliariaId]);

  useEffect(() => { load(); }, [load]);

  const owners = useMemo(() => people
    .filter((person) => person.roles?.includes("owner"))
    .sort((left, right) => left.name.localeCompare(right.name)), [people]);

  const ownerAccounts = useMemo(() => owners.map((owner) => {
    const ownerContracts = contracts.filter((contract) => contract.partyIds?.owners?.includes(owner.id));
    const currencies = Array.from(new Set(ownerContracts.map((contract) => contract.currency || "ARS"))).sort();
    const currencyAccounts = currencies.map((currency) => {
      const currencyContracts = ownerContracts.filter((contract) => (contract.currency || "ARS") === currency);
      const contractIds = new Set(currencyContracts.map((contract) => contract.id));
      return {
        currency,
        contracts: currencyContracts,
        statement: buildRentalOwnerAccountStatement({
          obligations: obligations.filter((item) => contractIds.has(item.contractId)),
          expenses: expenses.filter((item) => contractIds.has(item.contractId)),
          settlements: settlements.filter((item) => contractIds.has(item.contractId)),
        }),
      };
    });
    return { owner, contracts: ownerContracts, currencyAccounts };
  }), [contracts, expenses, obligations, owners, settlements]);

  const selectedAccount = ownerAccounts.find((item) => item.owner.id === selectedOwnerId)
    || ownerAccounts[0]
    || null;
  const contractMap = useMemo(() => new Map(contracts.map((contract) => [contract.id, contract])), [contracts]);
  const selectedCurrencyAccount = selectedAccount?.currencyAccounts.find((item) => item.currency === selectedCurrency)
    || selectedAccount?.currencyAccounts[0]
    || null;
  const pendingFunds = ownerAccounts.reduce((totals, account) => {
    account.currencyAccounts.forEach((item) => {
      totals[item.currency] = (totals[item.currency] || 0) + Math.max(0, item.statement.balanceMinor);
    });
    return totals;
  }, {});
  const pendingOwners = ownerAccounts.filter((account) => account.currencyAccounts
    .some((item) => item.statement.balanceMinor > 0)).length;
  const formatAccountAmounts = (account, field) => account.currencyAccounts
    .map((item) => formatRentalMoney(item.statement[field], item.currency))
    .join(" · ") || "—";

  useEffect(() => {
    if (!selectedAccount?.currencyAccounts.length) return;
    if (!selectedAccount.currencyAccounts.some((item) => item.currency === selectedCurrency)) {
      setSelectedCurrency(selectedAccount.currencyAccounts[0].currency);
    }
  }, [selectedAccount, selectedCurrency]);

  if (loading) return <main className="container py-5 text-center">Calculando fondos y cuentas de locadores...</main>;

  return (
    <main className="container py-4 rental-account-page rental-owner-accounts-page">
      <SEO title="Cuentas de locadores | ONO Prop" noIndex />

      <header className="rental-no-print d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
        <div>
          <p className="text-uppercase text-muted small mb-1">Administración de alquileres</p>
          <h1 className="h3 mb-1">Fondos pendientes y cuentas de locadores</h1>
          <p className="text-muted mb-0">{activeInmobiliaria?.nombre || "Inmobiliaria activa"} · vista consolidada de todos los contratos.</p>
        </div>
        <div className="d-flex flex-wrap gap-2">
          <Link className="btn btn-outline-secondary" to="/admin/alquileres">Volver</Link>
          <button type="button" className="btn btn-primary" disabled={!selectedAccount} onClick={() => window.print()}>Imprimir cuenta seleccionada</button>
        </div>
      </header>

      {error && <div className="alert alert-danger rental-no-print">{error}</div>}

      <section className="row g-3 mb-4 rental-no-print">
        <div className="col-md-4"><div className="card border-0 shadow-sm h-100"><div className="card-body"><small className="text-uppercase text-muted">Fondos pendientes de entrega</small>{Object.entries(pendingFunds).map(([currency, amount]) => <strong className="d-block fs-5 text-warning" key={currency}>{formatRentalMoney(amount, currency)}</strong>)}{Object.keys(pendingFunds).length === 0 && <strong className="d-block fs-4 text-success">Sin saldos</strong>}</div></div></div>
        <div className="col-md-4"><div className="card border-0 shadow-sm h-100"><div className="card-body"><small className="text-uppercase text-muted">Locadores con saldo pendiente</small><strong className="d-block fs-4">{pendingOwners}</strong></div></div></div>
        <div className="col-md-4"><div className="card border-0 shadow-sm h-100"><div className="card-body"><small className="text-uppercase text-muted">Locadores administrados</small><strong className="d-block fs-4">{ownerAccounts.length}</strong></div></div></div>
      </section>

      <section className="card border-0 shadow-sm mb-4 rental-no-print">
        <div className="card-body p-4">
          <div className="d-flex flex-wrap justify-content-between gap-3 mb-3">
            <div><h2 className="h5 mb-1">Resumen consolidado</h2><p className="small text-muted mb-0">El saldo positivo representa dinero pendiente de entrega al locador.</p></div>
            <div><label className="form-label visually-hidden" htmlFor="ownerAccountSelect">Locador</label><select id="ownerAccountSelect" className="form-select" value={selectedAccount?.owner.id || ""} onChange={(event) => setSelectedOwnerId(event.target.value)}><option value="">Seleccionar locador</option>{owners.map((owner) => <option value={owner.id} key={owner.id}>{owner.name}</option>)}</select></div>
          </div>
          <div className="table-responsive">
            <table className="table table-sm align-middle mb-0">
              <thead><tr><th>Locador</th><th>Contratos</th><th className="text-end">Créditos</th><th className="text-end">Débitos y pagos</th><th className="text-end">Saldo</th><th></th></tr></thead>
              <tbody>{ownerAccounts.map((account) => <tr key={account.owner.id}><td>{account.owner.name}</td><td>{account.contracts.length}</td><td className="text-end">{formatAccountAmounts(account, "totalCreditMinor")}</td><td className="text-end">{formatAccountAmounts(account, "totalDebitMinor")}</td><td className={`text-end fw-bold ${account.currencyAccounts.some((item) => item.statement.balanceMinor > 0) ? "text-warning" : "text-success"}`}>{formatAccountAmounts(account, "balanceMinor")}</td><td className="text-end"><button type="button" className="btn btn-sm btn-link" onClick={() => setSelectedOwnerId(account.owner.id)}>Ver detalle</button></td></tr>)}</tbody>
            </table>
          </div>
          {ownerAccounts.length === 0 && <div className="alert alert-light border mt-3 mb-0">Todavía no hay locadores con contratos administrados.</div>}
        </div>
      </section>

      {selectedAccount && selectedCurrencyAccount && (
        <article className="card border-0 shadow-sm rental-account-card">
          <div className="card-body p-4 p-lg-5">
            <header className="border-bottom pb-3 mb-4 d-flex flex-wrap justify-content-between gap-3">
              <div><p className="text-uppercase text-muted small mb-1">Cuenta corriente consolidada</p><h2 className="h3 mb-1">{selectedAccount.owner.name}</h2><p className="mb-0">{selectedAccount.contracts.length} contrato{selectedAccount.contracts.length === 1 ? "" : "s"} administrado{selectedAccount.contracts.length === 1 ? "" : "s"}</p></div>
              <div className="text-md-end"><strong>{activeInmobiliaria?.nombre || "Inmobiliaria"}</strong>{selectedAccount.currencyAccounts.length > 1 ? <div className="rental-no-print mt-2"><label className="form-label small mb-1" htmlFor="ownerCurrency">Moneda</label><select id="ownerCurrency" className="form-select form-select-sm" value={selectedCurrencyAccount.currency} onChange={(event) => setSelectedCurrency(event.target.value)}>{selectedAccount.currencyAccounts.map((item) => <option key={item.currency} value={item.currency}>{item.currency}</option>)}</select></div> : <div className="small text-muted">Moneda: {selectedCurrencyAccount.currency}</div>}</div>
            </header>

            <section className="row g-3 mb-4">
              <div className="col-md-4"><div className="border rounded p-3"><small className="text-uppercase text-muted">Créditos</small><strong className="d-block fs-5 text-success">{formatRentalMoney(selectedCurrencyAccount.statement.totalCreditMinor, selectedCurrencyAccount.currency)}</strong></div></div>
              <div className="col-md-4"><div className="border rounded p-3"><small className="text-uppercase text-muted">Débitos y pagos</small><strong className="d-block fs-5 text-danger">{formatRentalMoney(selectedCurrencyAccount.statement.totalDebitMinor, selectedCurrencyAccount.currency)}</strong></div></div>
              <div className="col-md-4"><div className="border rounded p-3"><small className="text-uppercase text-muted">Saldo del locador</small><strong className="d-block fs-5">{formatRentalMoney(selectedCurrencyAccount.statement.balanceMinor, selectedCurrencyAccount.currency)}</strong></div></div>
            </section>

            <div className="table-responsive">
              <table className="table table-sm align-middle rental-account-table">
                <thead><tr><th>Fecha</th><th>Período</th><th>Inmueble</th><th>Concepto</th><th className="text-end">Crédito</th><th className="text-end">Débito</th><th className="text-end">Saldo</th></tr></thead>
                <tbody>{selectedCurrencyAccount.statement.movements.map((movement) => { const movementContract = contractMap.get(movement.contractId); return <tr key={movement.id}><td>{movement.date || "Sin fecha"}</td><td>{movement.periodKey || "—"}</td><td>{movementContract?.inmuebleSnapshot?.address || movementContract?.inmuebleSnapshot?.title || "—"}</td><td>{movement.concept}</td><td className="text-end text-success">{movement.creditMinor ? formatRentalMoney(movement.creditMinor, selectedCurrencyAccount.currency) : "—"}</td><td className="text-end text-danger">{movement.debitMinor ? formatRentalMoney(movement.debitMinor, selectedCurrencyAccount.currency) : "—"}</td><td className="text-end fw-semibold">{formatRentalMoney(movement.balanceMinor, selectedCurrencyAccount.currency)}</td></tr>; })}</tbody>
                <tfoot><tr className="fw-bold"><td colSpan="4">Totales</td><td className="text-end">{formatRentalMoney(selectedCurrencyAccount.statement.totalCreditMinor, selectedCurrencyAccount.currency)}</td><td className="text-end">{formatRentalMoney(selectedCurrencyAccount.statement.totalDebitMinor, selectedCurrencyAccount.currency)}</td><td className="text-end">{formatRentalMoney(selectedCurrencyAccount.statement.balanceMinor, selectedCurrencyAccount.currency)}</td></tr></tfoot>
              </table>
            </div>
          </div>
        </article>
      )}
    </main>
  );
};

export default RentalOwnerAccountsPage;
