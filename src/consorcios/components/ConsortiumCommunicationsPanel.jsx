import { useCallback, useEffect, useMemo, useState } from "react";

import {
  getConsortiumCommunicationConsents,
  getConsortiumCommunications,
  getConsortiumNotificationSettings,
  saveConsortiumNotificationSettings,
  sendConsortiumCommunications,
} from "../services/consorcioCommunication.service";
import {
  getConsortiumCommunicationStatus,
  getConsortiumUnitNotificationRecipients,
  normalizeConsortiumNotificationSettings,
} from "../utils/consorcioNotification.helpers";

const formatTimestamp = (value) => {
  const millis = value?.toMillis?.() || Number(value?.seconds || 0) * 1000;
  if (!millis) return "Pendiente";
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" }).format(millis);
};

const communicationKindLabel = (item = {}) => ({
  manual: "Envío manual",
  issue: "Emisión automática",
  before_due: `Aviso ${item.offsetDays || 0} día(s) antes`,
  overdue: `Aviso de mora · ${item.offsetDays || 0} día(s)`,
}[item.kind] || "Comunicación");
const reminderDaysInput = (value) => (Array.isArray(value) ? value.join(", ") : value || "");

const ConsortiumCommunicationsPanel = ({
  inmobiliariaId,
  consortium,
  period,
  obligations = [],
  units = [],
  canManage = false,
}) => {
  const [settings, setSettings] = useState(() => normalizeConsortiumNotificationSettings());
  const [communications, setCommunications] = useState([]);
  const [consents, setConsents] = useState([]);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [loading, setLoading] = useState(true);
  const [operation, setOperation] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [authorizationAccepted, setAuthorizationAccepted] = useState(false);

  const unitMap = useMemo(() => new Map(units.map((unit) => [unit.id, unit])), [units]);
  const rows = useMemo(() => obligations.map((obligation) => {
    const unit = unitMap.get(obligation.unitId) || { id: obligation.unitId, ...obligation.unitSnapshot };
    return { obligation, unit, recipients: getConsortiumUnitNotificationRecipients(unit) };
  }), [obligations, unitMap]);

  const load = useCallback(async () => {
    if (!inmobiliariaId || !consortium?.id || !period?.id) return;
    try {
      setLoading(true);
      setError("");
      const [settingsData, communicationData, consentData] = await Promise.all([
        getConsortiumNotificationSettings(inmobiliariaId, consortium.id),
        getConsortiumCommunications(inmobiliariaId, {
          consortiumId: consortium.id,
          periodId: period.id,
        }),
        getConsortiumCommunicationConsents(inmobiliariaId, consortium.id),
      ]);
      setSettings(settingsData);
      setAuthorizationAccepted(false);
      setCommunications(communicationData);
      setConsents(consentData);
    } catch (loadError) {
      setError(loadError.message || "No se pudo cargar la configuración de comunicaciones.");
    } finally {
      setLoading(false);
    }
  }, [consortium?.id, inmobiliariaId, period?.id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    setSelectedIds(new Set(rows
      .filter((row) => row.recipients.length > 0)
      .map((row) => row.obligation.id)));
  }, [period?.id, rows]);

  const toggleRow = (obligationId) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(obligationId)) next.delete(obligationId);
      else next.add(obligationId);
      return next;
    });
  };

  const saveSettings = async (event) => {
    event.preventDefault();
    try {
      setOperation("settings");
      setError("");
      setSuccess("");
      const saved = await saveConsortiumNotificationSettings(
        inmobiliariaId,
        consortium.id,
        { ...settings, authorizationAccepted },
      );
      setSettings(saved);
      await load();
      setSuccess("Configuración de comunicaciones guardada.");
    } catch (saveError) {
      setError(saveError.message || "No se pudo guardar la configuración.");
    } finally {
      setOperation("");
    }
  };

  const sendSelected = async () => {
    const ids = [...selectedIds];
    if (!ids.length) {
      setError("Seleccioná al menos una liquidación con destinatario válido.");
      return;
    }
    if (!window.confirm(`Se generarán ${ids.length} email(s), uno por unidad seleccionada. ¿Continuar?`)) return;
    try {
      setOperation("send");
      setError("");
      setSuccess("");
      const result = await sendConsortiumCommunications(inmobiliariaId, ids);
      setSuccess(`${result.queued || 0} envío(s) en cola.${result.skipped ? ` ${result.skipped} omitido(s).` : ""}`);
      await load();
    } catch (sendError) {
      setError(sendError.message || "No se pudieron enviar las liquidaciones.");
    } finally {
      setOperation("");
    }
  };

  if (loading) return <section className="card border-0 shadow-sm mb-4"><div className="card-body p-4 text-muted">Cargando comunicaciones...</div></section>;

  return (
    <section className="card border-0 shadow-sm mb-4" id="comunicaciones-expensas">
      <div className="card-body p-4">
        <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
          <div><h2 className="h5 mb-1">Comunicación de expensas</h2><p className="small text-muted mb-0">Cada unidad recibe un email independiente con un enlace que exige iniciar sesión con un email autorizado.</p></div>
          <span className="badge text-bg-light border">{communications.length} registro(s) del período</span>
        </div>
        {error && <div className="alert alert-danger">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        {canManage && <form className="rounded border bg-light p-3 mb-4" onSubmit={saveSettings}>
          <div className="d-flex flex-wrap justify-content-between gap-2 mb-3"><div><h3 className="h6 mb-1">Automatización y plantilla</h3><small className="text-muted">La autorización se aplica únicamente a este consorcio.</small></div><div className="form-check form-switch"><input className="form-check-input" id={`consortium-auto-email-${consortium.id}`} type="checkbox" checked={settings.enabled} onChange={(event) => setSettings((current) => ({ ...current, enabled: event.target.checked }))} /><label className="form-check-label" htmlFor={`consortium-auto-email-${consortium.id}`}>Envíos automáticos</label></div></div>
          {settings.automationAuthorized && settings.enabled && <div className="alert alert-success py-2 small">Automatización autorizada{settings.authorizedByEmail ? ` por ${settings.authorizedByEmail}` : ""}. Podés revocarla desactivando el interruptor y guardando.</div>}
          {settings.automationAuthorized && !settings.enabled && <div className="alert alert-warning py-2 small">Al guardar se revocará la autorización automática de este consorcio.</div>}
          <div className="row g-3">
            <div className="col-md-4"><div className="form-check mt-md-4 pt-md-2"><input className="form-check-input" id={`consortium-send-issue-${consortium.id}`} type="checkbox" checked={settings.sendOnIssue} disabled={!settings.enabled} onChange={(event) => setSettings((current) => ({ ...current, sendOnIssue: event.target.checked }))} /><label className="form-check-label" htmlFor={`consortium-send-issue-${consortium.id}`}>Enviar al emitir una liquidación</label></div></div>
            <div className="col-md-4"><label className="form-label">Avisar antes del vencimiento</label><input className="form-control" value={reminderDaysInput(settings.preDueDays)} disabled={!settings.enabled} onChange={(event) => setSettings((current) => ({ ...current, preDueDays: event.target.value }))} placeholder="3" /><small className="text-muted">Días separados por coma; vacío desactiva.</small></div>
            <div className="col-md-4"><label className="form-label">Avisar después del vencimiento</label><input className="form-control" value={reminderDaysInput(settings.overdueDays)} disabled={!settings.enabled} onChange={(event) => setSettings((current) => ({ ...current, overdueDays: event.target.value }))} placeholder="1, 7, 15" /><small className="text-muted">Solo si continúa con saldo.</small></div>
            <div className="col-md-8"><label className="form-label">Asunto</label><input className="form-control" value={settings.subjectTemplate} onChange={(event) => setSettings((current) => ({ ...current, subjectTemplate: event.target.value }))} /></div>
            <div className="col-md-4"><label className="form-label">Responder a</label><input className="form-control" type="email" value={settings.replyToEmail} onChange={(event) => setSettings((current) => ({ ...current, replyToEmail: event.target.value }))} placeholder="administracion@ejemplo.com" /></div>
            <div className="col-12"><label className="form-label">Mensaje inicial</label><textarea className="form-control" rows="2" value={settings.introText} onChange={(event) => setSettings((current) => ({ ...current, introText: event.target.value }))} /><small className="text-muted">Variables: {"{{consorcio}}"}, {"{{periodo}}"}, {"{{unidad}}"}, {"{{vencimiento}}"} y {"{{saldo}}"}.</small></div>
            {settings.enabled && !settings.automationAuthorized && <div className="col-12"><div className="form-check rounded border border-primary bg-white p-3 ps-5"><input className="form-check-input" id={`consortium-automation-consent-${consortium.id}`} type="checkbox" checked={authorizationAccepted} onChange={(event) => setAuthorizationAccepted(event.target.checked)} required /><label className="form-check-label" htmlFor={`consortium-automation-consent-${consortium.id}`}><strong>Autorización del administrador.</strong> Confirmo que esta inmobiliaria autoriza a ONO Prop a enviar automáticamente las liquidaciones y recordatorios de este consorcio a los contactos configurados en cada unidad. Esta decisión y su eventual revocación quedarán auditadas.</label></div></div>}
            <div className="col-12 text-end"><button className="btn btn-outline-primary" disabled={operation === "settings"} type="submit">{operation === "settings" ? "Guardando..." : "Guardar configuración"}</button></div>
          </div>
          {consents.length > 0 && <details className="mt-3"><summary className="small fw-semibold">Historial de autorizaciones ({consents.length})</summary><div className="table-responsive mt-2"><table className="table table-sm mb-0"><thead><tr><th>Fecha</th><th>Acción</th><th>Administrador</th><th>Configuración registrada</th></tr></thead><tbody>{consents.map((consent) => <tr key={consent.id}><td>{formatTimestamp(consent.createdAt)}</td><td><span className={`badge ${consent.action === "authorized" ? "text-bg-success" : "text-bg-secondary"}`}>{consent.action === "authorized" ? "Autorizada" : "Revocada"}</span></td><td>{consent.actorEmail || consent.actorUid || "Administrador"}</td><td>{consent.settingsSnapshot?.sendOnIssue ? "Al emitir; " : ""}{(consent.settingsSnapshot?.preDueDays || []).length ? `${consent.settingsSnapshot.preDueDays.join(", ")} día(s) antes; ` : ""}{(consent.settingsSnapshot?.overdueDays || []).length ? `${consent.settingsSnapshot.overdueDays.join(", ")} día(s) después` : ""}</td></tr>)}</tbody></table></div></details>}
        </form>}

        <h3 className="h6">Previsualización de destinatarios · {period.periodKey}</h3>
        <div className="table-responsive mb-3">
          <table className="table table-sm align-middle">
            <thead><tr>{canManage && <th><span className="visually-hidden">Seleccionar</span></th>}<th>Unidad</th><th>Destinatarios</th><th>Vencimiento</th><th>Estado de contacto</th></tr></thead>
            <tbody>
              {rows.map(({ obligation, unit, recipients }) => <tr key={obligation.id}>{canManage && <td><input className="form-check-input" type="checkbox" checked={selectedIds.has(obligation.id)} disabled={!recipients.length || operation === "send"} onChange={() => toggleRow(obligation.id)} aria-label={`Seleccionar unidad ${unit.code || obligation.unitId}`} /></td>}<td><strong>{unit.code || obligation.unitId}</strong><small className="d-block text-muted">{unit.ownerName || unit.occupantName || "Sin responsable"}</small></td><td>{recipients.map((recipient) => <div key={`${recipient.role}_${recipient.email}`}><span className="badge text-bg-light border me-1">{recipient.role === "owner" ? "Titular" : "Ocupante"}</span>{recipient.email}</div>)}{!recipients.length && <span className="text-danger">Sin email para la preferencia elegida</span>}</td><td>{obligation.dueDate}</td><td>{recipients.length ? <span className="badge text-bg-success">Listo</span> : <span className="badge text-bg-warning">Revisar unidad</span>}</td></tr>)}
              {!rows.length && <tr><td className="text-center text-muted py-3" colSpan={canManage ? 5 : 4}>No hay liquidaciones para comunicar.</td></tr>}
            </tbody>
          </table>
        </div>
        {canManage && <div className="d-flex justify-content-end mb-4"><button className="btn btn-primary" type="button" disabled={operation === "send" || !selectedIds.size} onClick={sendSelected}>{operation === "send" ? "Generando envíos..." : `Enviar ${selectedIds.size} liquidación(es)`}</button></div>}

        <h3 className="h6">Historial del período</h3>
        <div className="table-responsive">
          <table className="table table-sm align-middle mb-0">
            <thead><tr><th>Fecha</th><th>Unidad</th><th>Tipo</th><th>Destinatarios</th><th>Resultado</th></tr></thead>
            <tbody>
              {communications.map((item) => { const status = getConsortiumCommunicationStatus(item.status); return <tr key={item.id}><td>{formatTimestamp(item.createdAt)}</td><td>{item.unitSnapshot?.code || item.unitId}</td><td>{communicationKindLabel(item)}</td><td>{(item.recipientSnapshot || []).map((recipient) => recipient.email).join(", ") || "—"}</td><td><span className={`badge ${status.badge}`}>{status.label}</span>{item.deliveryError && <small className="d-block text-danger">{item.deliveryError}</small>}</td></tr>; })}
              {!communications.length && <tr><td className="text-center text-muted py-3" colSpan="5">Todavía no se enviaron comunicaciones para este período.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};

export default ConsortiumCommunicationsPanel;
