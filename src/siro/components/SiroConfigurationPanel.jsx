import { useCallback, useEffect, useMemo, useState } from "react";

import {
  disableSiroAssignment,
  getSiroConfiguration,
  saveSiroAssignment,
  syncSiroOrder,
  testSiroHomologation,
} from "../services/siro.service";

const STATUS_LABEL = {
  creating: ["Creando", "text-bg-secondary"],
  pending: ["Pendiente", "text-bg-warning"],
  in_process: ["En proceso", "text-bg-info"],
  approved: ["Aprobado en prueba", "text-bg-success"],
  rejected: ["Rechazado", "text-bg-danger"],
  cancelled: ["Cancelado", "text-bg-secondary"],
  expired: ["Vencido", "text-bg-dark"],
  creation_failed: ["No iniciado", "text-bg-danger"],
};

const formatMoney = (minor, currency = "ARS") => new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency,
}).format(Number(minor || 0) / 100);

const SiroConfigurationPanel = ({
  inmobiliariaId,
  consortiums = [],
  treasuryAccounts = [],
  isRoot = false,
}) => {
  const [configuration, setConfiguration] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [operation, setOperation] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    if (!inmobiliariaId) return;
    try {
      setLoading(true);
      setError("");
      const data = await getSiroConfiguration(inmobiliariaId);
      setConfiguration(data);
      setDrafts(Object.fromEntries((data.assignments || []).map((item) => [
        item.targetId,
        {
          agreementId: item.agreementId || "",
          treasuryAccountId: item.treasuryAccountId || "",
        },
      ])));
    } catch (loadError) {
      setError(loadError.message || "No se pudo cargar la configuración de SIRO.");
    } finally {
      setLoading(false);
    }
  }, [inmobiliariaId]);

  useEffect(() => { load(); }, [load]);

  const assignmentsByConsortium = useMemo(() => new Map(
    (configuration?.assignments || []).map((item) => [item.targetId, item]),
  ), [configuration]);

  const testConnection = async () => {
    try {
      setOperation("test");
      setError("");
      setNotice("");
      const result = await testSiroHomologation(inmobiliariaId);
      setNotice(`SIRO respondió correctamente. Convenios disponibles: ${
        result.agreements?.length || 0}.`);
      await load();
    } catch (testError) {
      setError(testError.message || "No se pudo probar SIRO.");
    } finally {
      setOperation("");
    }
  };

  const save = async (consortiumId) => {
    const draft = drafts[consortiumId] || {};
    if (!draft.agreementId) {
      setError("Seleccioná un convenio SIRO.");
      return;
    }
    try {
      setOperation(`save-${consortiumId}`);
      setError("");
      setNotice("");
      await saveSiroAssignment({
        inmobiliariaId,
        targetType: "consortium",
        targetId: consortiumId,
        agreementId: draft.agreementId,
        treasuryAccountId: draft.treasuryAccountId || "",
      });
      setNotice("SIRO quedó habilitado como medio preferido para este consorcio.");
      await load();
    } catch (saveError) {
      setError(saveError.message || "No se pudo asignar SIRO.");
    } finally {
      setOperation("");
    }
  };

  const disable = async (consortiumId) => {
    try {
      setOperation(`disable-${consortiumId}`);
      setError("");
      await disableSiroAssignment({
        inmobiliariaId,
        targetType: "consortium",
        targetId: consortiumId,
      });
      setNotice("SIRO fue deshabilitado. Los cobros volverán a Mercado Pago si está configurado.");
      await load();
    } catch (disableError) {
      setError(disableError.message || "No se pudo deshabilitar SIRO.");
    } finally {
      setOperation("");
    }
  };

  return (
    <section className="card border-0 shadow-sm mb-4">
      <div className="card-body p-4">
        <div className="d-flex flex-wrap justify-content-between gap-3 mb-3">
          <div>
            <span className="badge text-bg-warning mb-2">Homologación</span>
            <h2 className="h4 mb-1">Banco Roela · SIRO</h2>
            <p className="text-muted mb-0">Probá convenios e intenciones de pago sin alterar cuentas corrientes reales.</p>
          </div>
          {isRoot && <button className="btn btn-outline-primary align-self-start" type="button" disabled={operation === "test"} onClick={testConnection}>
            {operation === "test" ? "Probando..." : configuration?.connected ? "Volver a probar" : "Probar conexión"}
          </button>}
        </div>

        {error && <div className="alert alert-danger">{error}</div>}
        {notice && <div className="alert alert-success">{notice}</div>}
        {loading ? <div className="text-center py-4"><div className="spinner-border text-primary" /></div> : <>
          {!isRoot && <div className="alert alert-info">La prueba de SIRO es administrada por ONO Prop. La inmobiliaria podrá configurar sus convenios cuando habilitemos Producción.</div>}
          <div className={`alert ${configuration?.connected ? "alert-success" : "alert-secondary"}`}>
            <strong>{configuration?.connected ? "Conexión de prueba disponible." : "Conexión todavía no probada."}</strong>
            {configuration?.lastTestAt && <span className="ms-2 small">Última prueba: {new Date(configuration.lastTestAt).toLocaleString("es-AR")}</span>}
            {configuration?.lastError && <small className="d-block mt-1">{configuration.lastError}</small>}
          </div>

          {configuration?.connected && !configuration?.agreements?.length && <div className="alert alert-warning">SIRO autenticó correctamente, pero no devolvió convenios activos.</div>}

          <div className="table-responsive">
            <table className="table align-middle">
              <thead><tr><th>Consorcio</th><th>Convenio SIRO</th><th>Cuenta de tesorería</th><th className="text-end">Acciones</th></tr></thead>
              <tbody>
                {consortiums.map((item) => {
                  const assignment = assignmentsByConsortium.get(item.id);
                  const draft = drafts[item.id] || {
                    agreementId: assignment?.agreementId || configuration?.agreements?.[0]?.id || "",
                    treasuryAccountId: assignment?.treasuryAccountId || "",
                  };
                  const updateDraft = (value) => setDrafts((previous) => ({
                    ...previous,
                    [item.id]: { ...draft, ...value },
                  }));
                  return <tr key={item.id}>
                    <td><strong>{item.name}</strong><small className="d-block text-muted">{item.address}</small>{assignment?.active && <span className="badge text-bg-success mt-1">SIRO preferido</span>}</td>
                    <td><select className="form-select form-select-sm" value={draft.agreementId} onChange={(event) => updateDraft({ agreementId: event.target.value })} disabled={!configuration?.connected}><option value="">Seleccionar convenio</option>{(configuration?.agreements || []).map((agreement) => <option key={agreement.id} value={agreement.id}>{agreement.name} · {agreement.id}</option>)}</select></td>
                    <td><select className="form-select form-select-sm" value={draft.treasuryAccountId} onChange={(event) => updateDraft({ treasuryAccountId: event.target.value })}><option value="">Sin imputar a tesorería</option>{treasuryAccounts.filter((account) => account.consortiumId === item.id).map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></td>
                    <td className="text-end">{isRoot ? <div className="btn-group btn-group-sm"><button className="btn btn-primary" type="button" disabled={!configuration?.connected || !draft.agreementId || operation === `save-${item.id}`} onClick={() => save(item.id)}>{operation === `save-${item.id}` ? "Guardando..." : assignment?.active ? "Actualizar" : "Habilitar SIRO"}</button>{assignment?.active && <button className="btn btn-outline-danger" type="button" disabled={operation === `disable-${item.id}`} onClick={() => disable(item.id)}>Deshabilitar</button>}</div> : <span className="text-muted small">Gestionado por ONO Prop</span>}</td>
                  </tr>;
                })}
                {!consortiums.length && <tr><td colSpan="4" className="text-center text-muted py-4">No hay consorcios activos.</td></tr>}
              </tbody>
            </table>
          </div>

          <div className="border-top pt-4 mt-3">
            <div className="d-flex flex-wrap justify-content-between gap-2"><div><h3 className="h5 mb-1">Pruebas recientes</h3><p className="text-muted small">Una aprobación de homologación queda registrada, pero no cancela la deuda real.</p></div><button className="btn btn-outline-secondary btn-sm align-self-start" type="button" onClick={load}>Actualizar</button></div>
            <div className="table-responsive"><table className="table table-sm align-middle"><thead><tr><th>Fecha</th><th>Concepto</th><th>Importe</th><th>Estado</th><th /></tr></thead><tbody>{(configuration?.orders || []).map((order) => { const status = STATUS_LABEL[order.status] || [order.status, "text-bg-secondary"]; return <tr key={order.id}><td>{order.createdAt ? new Date(order.createdAt).toLocaleString("es-AR") : "—"}</td><td>{order.title}</td><td>{formatMoney(order.amountMinor, order.currency)}</td><td><span className={`badge ${status[1]}`}>{status[0]}</span>{order.needsReview && <small className="d-block text-danger">{order.reviewReason}</small>}</td><td className="text-end"><button className="btn btn-outline-primary btn-sm" type="button" disabled={operation === `sync-${order.id}`} onClick={async () => { try { setOperation(`sync-${order.id}`); await syncSiroOrder(order.id); await load(); } catch (syncError) { setError(syncError.message); } finally { setOperation(""); } }}>Sincronizar</button></td></tr>; })}{!configuration?.orders?.length && <tr><td colSpan="5" className="text-center text-muted py-3">Todavía no hay intenciones SIRO.</td></tr>}</tbody></table></div>
          </div>
        </>}
      </div>
    </section>
  );
};

export default SiroConfigurationPanel;
