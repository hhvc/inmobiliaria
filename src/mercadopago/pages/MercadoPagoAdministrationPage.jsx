import { useCallback, useEffect, useMemo, useState } from "react";

import SEO from "../../components/SEO";
import { getRentalContracts } from "../../alquileres/services/rental.service";
import {
  getConsortiums,
  getConsortiumTreasuryAccounts,
} from "../../consorcios/services/consorcio.service";
import { useActiveInmobiliariaModules } from "../../inmobiliaria/hooks/useActiveInmobiliariaModules";
import SiroConfigurationPanel from "../../siro/components/SiroConfigurationPanel";
import {
  connectMercadoPagoPlatform,
  disconnectMercadoPago,
  getMercadoPagoConfiguration,
  saveMercadoPagoAssignment,
  startMercadoPagoOAuth,
  syncMercadoPagoOrder,
} from "../services/mercadoPago.service";

const ACCOUNT_LABEL = {
  platform: "Cuenta central ONO Prop",
  agency: "Cuenta propia de la inmobiliaria",
};

const ORDER_LABEL = {
  consortium_obligation: "Expensas",
  rental_obligation: "Alquiler",
  billing_account: "Cuenta corriente ONO Prop",
  billing_obligation: "Abono ONO Prop",
  donation: "Donación",
};

const STATUS_LABEL = {
  creating: ["Creando", "text-bg-secondary"],
  pending: ["Pendiente", "text-bg-warning"],
  in_process: ["En revisión", "text-bg-info"],
  approved: ["Aprobado", "text-bg-success"],
  partially_refunded: ["Devuelto parcialmente", "text-bg-warning"],
  refunded: ["Devuelto", "text-bg-dark"],
  charged_back: ["Contracargo", "text-bg-danger"],
  rejected: ["Rechazado", "text-bg-danger"],
  cancelled: ["Cancelado", "text-bg-secondary"],
  creation_failed: ["No iniciado", "text-bg-danger"],
};

const formatMoney = (minor, currency = "ARS") => new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency,
}).format(Number(minor || 0) / 100);

const MercadoPagoAdministrationPage = () => {
  const { activeInmobiliariaId, activeInmobiliaria, isRoot, loading: contextLoading } =
    useActiveInmobiliariaModules();
  const [configuration, setConfiguration] = useState(null);
  const [consortiums, setConsortiums] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [treasuryAccounts, setTreasuryAccounts] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [operation, setOperation] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    if (!activeInmobiliariaId) return;
    try {
      setLoading(true);
      setError("");
      const [config, consortiumData, contractData, treasuryData] = await Promise.all([
        getMercadoPagoConfiguration(activeInmobiliariaId),
        getConsortiums(activeInmobiliariaId),
        getRentalContracts(activeInmobiliariaId),
        getConsortiumTreasuryAccounts(activeInmobiliariaId),
      ]);
      setConfiguration(config);
      setConsortiums(consortiumData.filter((item) => item.status !== "archived"));
      setContracts(contractData.filter((item) => !["cancelled", "ended"].includes(item.status)));
      setTreasuryAccounts(treasuryData.filter((item) => item.active !== false));
      setDrafts(Object.fromEntries((config.assignments || []).map((item) => [item.id, {
        accountId: item.accountId,
        treasuryAccountId: item.treasuryAccountId || "",
      }])));
    } catch (loadError) {
      setError(loadError.message || "No se pudo cargar Mercado Pago.");
    } finally {
      setLoading(false);
    }
  }, [activeInmobiliariaId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const receiveOAuth = (event) => {
      if (event.origin !== window.location.origin && event.origin !== "https://onoprop.com") return;
      if (event.data?.type !== "onoprop:mercadopago-oauth") return;
      if (event.data.success) {
        setNotice("La cuenta quedó conectada.");
        load();
      }
    };
    window.addEventListener("message", receiveOAuth);
    return () => window.removeEventListener("message", receiveOAuth);
  }, [load]);

  const connectedAccounts = useMemo(
    () => (configuration?.accounts || []).filter((item) => item.connected),
    [configuration],
  );
  const assignmentsByTarget = useMemo(() => new Map(
    (configuration?.assignments || []).map((item) => [`${item.targetType}:${item.targetId}`, item]),
  ), [configuration]);

  const connect = async (ownerType) => {
    try {
      setOperation(`connect-${ownerType}`);
      setError("");
      setNotice("");
      if (ownerType === "platform") {
        const result = await connectMercadoPagoPlatform();
        const account = result?.account;
        setNotice(`Cuenta central conectada${account?.nickname ? ` · ${account.nickname}` : ""}.`);
        await load();
        return;
      }
      const result = await startMercadoPagoOAuth({
        ownerType,
        ownerId: ownerType === "agency" ? activeInmobiliariaId : "onoprop",
      });
      const popup = window.open(result.url, "onoprop-mercadopago", "width=620,height=760");
      if (!popup) throw new Error("El navegador bloqueó la ventana de Mercado Pago.");
    } catch (connectError) {
      setError(connectError.message || "No se pudo iniciar la conexión.");
    } finally {
      setOperation("");
    }
  };

  const disconnect = async (account) => {
    if (!window.confirm(`¿Desconectar ${ACCOUNT_LABEL[account.ownerType]}?`)) return;
    try {
      setOperation(`disconnect-${account.id}`);
      await disconnectMercadoPago(account.id);
      setNotice("Cuenta desconectada. Las asignaciones se conservan, pero no aceptarán pagos.");
      await load();
    } catch (disconnectError) {
      setError(disconnectError.message || "No se pudo desconectar la cuenta.");
    } finally {
      setOperation("");
    }
  };

  const saveAssignment = async ({ targetType, targetId, draft }) => {
    const assignmentId = `${targetType}_${activeInmobiliariaId}_${targetId}`;
    const current = draft || drafts[assignmentId] || {};
    if (!current.accountId) {
      setError("Seleccioná una cuenta conectada.");
      return;
    }
    try {
      setOperation(`assignment-${assignmentId}`);
      setError("");
      await saveMercadoPagoAssignment({
        inmobiliariaId: activeInmobiliariaId,
        targetType,
        targetId,
        accountId: current.accountId,
        treasuryAccountId: current.treasuryAccountId || "",
      });
      setNotice("Cuenta de cobro asignada correctamente.");
      await load();
    } catch (saveError) {
      setError(saveError.message || "No se pudo guardar la asignación.");
    } finally {
      setOperation("");
    }
  };

  const renderAccountSelect = (targetType, targetId, includeTreasury = false) => {
    const assignmentId = `${targetType}_${activeInmobiliariaId}_${targetId}`;
    const existing = assignmentsByTarget.get(`${targetType}:${targetId}`);
    const current = drafts[assignmentId] || {
      accountId: existing?.accountId || connectedAccounts[0]?.id || "",
      treasuryAccountId: existing?.treasuryAccountId || "",
    };
    const update = (value) => setDrafts((previous) => ({
      ...previous,
      [assignmentId]: { ...current, ...value },
    }));
    return <div className="d-flex flex-column flex-xl-row gap-2 justify-content-end">
      <select className="form-select form-select-sm" aria-label="Cuenta de Mercado Pago" value={current.accountId} onChange={(event) => update({ accountId: event.target.value })}>
        <option value="">Seleccionar cuenta</option>
        {connectedAccounts.map((account) => <option key={account.id} value={account.id}>{ACCOUNT_LABEL[account.ownerType]} · {account.nickname || account.email || account.mpUserId}</option>)}
      </select>
      {includeTreasury && <select className="form-select form-select-sm" aria-label="Cuenta de tesorería" value={current.treasuryAccountId} onChange={(event) => update({ treasuryAccountId: event.target.value })}>
        <option value="">Sin imputar a tesorería</option>
        {treasuryAccounts.filter((item) => item.consortiumId === targetId).map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
      </select>}
      <button className="btn btn-primary btn-sm text-nowrap" type="button" disabled={operation === `assignment-${assignmentId}` || !current.accountId} onClick={() => saveAssignment({ targetType, targetId, draft: current })}>{operation === `assignment-${assignmentId}` ? "Guardando..." : existing ? "Actualizar" : "Asignar"}</button>
    </div>;
  };

  if (contextLoading || loading) return <main className="container py-5 text-center"><div className="spinner-border text-primary" /><p className="text-muted mt-3">Cargando configuración de Mercado Pago...</p></main>;

  return (
    <main className="container py-4">
      <SEO title="Medios de cobro | Administración" noIndex />
      <header className="mb-4"><span className="badge text-bg-primary mb-2">Cobros online</span><h1 className="h2 mb-1">Medios de cobro</h1><p className="text-muted mb-0">Configurá Mercado Pago y SIRO para los consorcios o contratos de {activeInmobiliaria?.nombre || "la inmobiliaria"}.</p></header>
      {error && <div className="alert alert-danger">{error}</div>}
      {notice && <div className="alert alert-success">{notice}</div>}

      <div className="mb-3"><h2 className="h4 mb-1">Mercado Pago</h2><p className="text-muted small mb-0">Conexiones productivas y asignaciones vigentes.</p></div>
      <section className="row g-3 mb-4">
        {isRoot && <div className="col-lg-6"><div className="card border-0 shadow-sm h-100"><div className="card-body p-4"><h2 className="h5">Cuenta central ONO Prop</h2><p className="text-muted small">Recibe abonos, donaciones y los cobros piloto que asignes.</p>{configuration?.accounts?.find((item) => item.ownerType === "platform")?.connected ? (() => { const account = configuration.accounts.find((item) => item.ownerType === "platform"); return <><div className="alert alert-success py-2">Conectada · {account.nickname || account.email || account.mpUserId}</div><button className="btn btn-outline-danger btn-sm" type="button" onClick={() => disconnect(account)}>Desconectar</button></>; })() : <button className="btn btn-primary" type="button" disabled={operation === "connect-platform"} onClick={() => connect("platform")}>Conectar cuenta central</button>}</div></div></div>}
        <div className="col-lg-6"><div className="card border-0 shadow-sm h-100"><div className="card-body p-4"><h2 className="h5">Cuenta propia de la inmobiliaria</h2><p className="text-muted small">La inmobiliaria autoriza su cuenta sin compartir contraseñas ni credenciales.</p>{configuration?.accounts?.find((item) => item.ownerType === "agency")?.connected ? (() => { const account = configuration.accounts.find((item) => item.ownerType === "agency"); return <><div className="alert alert-success py-2">Conectada · {account.nickname || account.email || account.mpUserId}</div><button className="btn btn-outline-danger btn-sm" type="button" onClick={() => disconnect(account)}>Desconectar</button></>; })() : <button className="btn btn-outline-primary" type="button" disabled={operation === "connect-agency"} onClick={() => connect("agency")}>Conectar cuenta propia</button>}</div></div></div>
      </section>

      {!connectedAccounts.length && <div className="alert alert-warning">Conectá al menos una cuenta antes de asignar cobros.</div>}

      <section className="card border-0 shadow-sm mb-4"><div className="card-body p-4"><h2 className="h4">Consorcios · Mercado Pago</h2><p className="text-muted small">Cada consorcio puede cobrar en una cuenta distinta e imputar automáticamente el ingreso a una cuenta de tesorería.</p><div className="table-responsive"><table className="table align-middle"><thead><tr><th>Consorcio</th><th>Estado</th><th className="text-end">Cuenta receptora</th></tr></thead><tbody>{consortiums.map((item) => { const assigned = assignmentsByTarget.get(`consortium:${item.id}`); return <tr key={item.id}><td><strong>{item.name}</strong><small className="d-block text-muted">{item.address}</small></td><td>{assigned ? <span className="badge text-bg-success">Configurado</span> : <span className="badge text-bg-secondary">Sin configurar</span>}</td><td>{renderAccountSelect("consortium", item.id, true)}</td></tr>; })}{!consortiums.length && <tr><td colSpan="3" className="text-center text-muted py-4">No hay consorcios activos.</td></tr>}</tbody></table></div></div></section>

      <section className="card border-0 shadow-sm mb-4"><div className="card-body p-4"><h2 className="h4">Contratos de alquiler · Mercado Pago</h2><p className="text-muted small">La inmobiliaria podrá generar un enlace para que el locatario pague el saldo exacto.</p><div className="table-responsive"><table className="table align-middle"><thead><tr><th>Contrato</th><th>Estado</th><th className="text-end">Cuenta receptora</th></tr></thead><tbody>{contracts.map((item) => { const assigned = assignmentsByTarget.get(`rental_contract:${item.id}`); return <tr key={item.id}><td><strong>{item.inmuebleSnapshot?.title || "Contrato de alquiler"}</strong><small className="d-block text-muted">{item.inmuebleSnapshot?.address || item.id}</small></td><td>{assigned ? <span className="badge text-bg-success">Configurado</span> : <span className="badge text-bg-secondary">Sin configurar</span>}</td><td>{renderAccountSelect("rental_contract", item.id)}</td></tr>; })}{!contracts.length && <tr><td colSpan="3" className="text-center text-muted py-4">No hay contratos activos.</td></tr>}</tbody></table></div></div></section>

      <SiroConfigurationPanel inmobiliariaId={activeInmobiliariaId} consortiums={consortiums} treasuryAccounts={treasuryAccounts} isRoot={isRoot} />

      <section className="card border-0 shadow-sm"><div className="card-body p-4"><div className="d-flex flex-wrap justify-content-between gap-2"><div><h2 className="h4 mb-1">Conciliación reciente</h2><p className="text-muted small">Las notificaciones duplicadas se detectan y nunca generan dos cobros.</p></div><button className="btn btn-outline-secondary btn-sm align-self-start" type="button" onClick={load}>Actualizar</button></div><div className="table-responsive"><table className="table align-middle"><thead><tr><th>Fecha</th><th>Tipo</th><th>Concepto</th><th>Importe</th><th>Estado</th><th /></tr></thead><tbody>{(configuration?.orders || []).map((order) => { const state = STATUS_LABEL[order.status] || [order.status, "text-bg-secondary"]; return <tr key={order.id}><td className="small">{order.createdAt ? new Date(order.createdAt).toLocaleString("es-AR") : "—"}</td><td>{ORDER_LABEL[order.contextType] || order.contextType}</td><td>{order.title}</td><td>{formatMoney(order.amountMinor, order.currency)}{Number(order.providerDeductionMinor || order.providerFeeMinor || 0) > 0 && <small className="d-block text-muted">Deducciones MP: {formatMoney(order.providerDeductionMinor || order.providerFeeMinor, order.currency)} · Neto: {formatMoney(order.netReceivedAmountMinor, order.currency)}</small>}{Number(order.reversedAmountMinor || 0) > 0 && <small className="d-block text-danger">Revertido: {formatMoney(order.reversedAmountMinor, order.currency)}</small>}</td><td><span className={`badge ${state[1]}`}>{state[0]}</span>{order.needsReview && <small className="d-block text-danger">{order.reviewReason || "Requiere revisión"}</small>}</td><td className="text-end">{order.mpPaymentId && <button className="btn btn-outline-primary btn-sm" type="button" onClick={async () => { try { setOperation(`sync-${order.id}`); await syncMercadoPagoOrder(order.id); await load(); } catch (syncError) { setError(syncError.message); } finally { setOperation(""); } }} disabled={operation === `sync-${order.id}`}>Sincronizar</button>}</td></tr>; })}{!configuration?.orders?.length && <tr><td colSpan="6" className="text-center text-muted py-4">Todavía no hay pagos iniciados.</td></tr>}</tbody></table></div><p className="small text-muted mb-0">Webhook para configurar en Mercado Pago: <code>{configuration?.webhookUrl}</code></p></div></section>
    </main>
  );
};

export default MercadoPagoAdministrationPage;
