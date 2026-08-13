import { useCallback, useEffect, useMemo, useState } from "react";

import {
  getConsortiumCommunicationConsents,
  getConsortiumCommunications,
  getConsortiumNotificationSettings,
  previewConsortiumAutomation,
  runConsortiumAutomation,
  saveConsortiumNotificationSettings,
  sendConsortiumCommunications,
} from "../services/consorcioCommunication.service";
import {
  getConsortiumCommunicationStatus,
  getConsortiumUnitNotificationRecipients,
  normalizeConsortiumNotificationSettings,
} from "../utils/consorcioNotification.helpers";

const formatTimestamp = (value) => {
  const millis = Number.isFinite(Number(value))
    ? Number(value)
    : value?.toMillis?.() || Number(value?.seconds || value?._seconds || 0) * 1000;
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
const todayDateKey = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Argentina/Buenos_Aires",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  }).formatToParts(new Date());
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
};
const formatAutomationAmount = (amountMinor = 0, currency = "ARS") => {
  try {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: currency || "ARS",
    }).format(Number(amountMinor || 0) / 100);
  } catch {
    return `${currency || "ARS"} ${(Number(amountMinor || 0) / 100).toLocaleString("es-AR")}`;
  }
};
const automationActionLabel = (action = {}) => (action.kind === "before_due"
  ? `${action.offsetDays} día(s) antes`
  : `Mora de ${action.offsetDays} día(s)`);
const automationStatus = (status = "ready") => ({
  ready: { label: "Listo para enviar", badge: "text-bg-success" },
  already_queued: { label: "Ya generado", badge: "text-bg-secondary" },
  missing_recipients: { label: "Sin destinatario", badge: "text-bg-warning" },
}[status] || { label: status, badge: "text-bg-light" });
const automationTriggerLabel = (trigger = "scheduled") => ({
  scheduled: "Programada",
  agency_manual: "Manual · inmobiliaria",
  root_manual: "Manual · ONO Prop",
}[trigger] || trigger);

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
  const [previewDate, setPreviewDate] = useState(todayDateKey);
  const [automationPreview, setAutomationPreview] = useState(null);

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

  const loadAutomationPreview = useCallback(async (dateKey) => {
    if (!canManage || !inmobiliariaId || !consortium?.id) return;
    try {
      setOperation("preview");
      setError("");
      const result = await previewConsortiumAutomation(
        inmobiliariaId,
        consortium.id,
        dateKey,
      );
      setAutomationPreview(result);
    } catch (previewError) {
      setError(previewError.message || "No se pudo previsualizar la automatización.");
    } finally {
      setOperation("");
    }
  }, [canManage, consortium?.id, inmobiliariaId]);

  useEffect(() => {
    if (canManage) loadAutomationPreview(todayDateKey());
  }, [canManage, loadAutomationPreview]);

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
      await loadAutomationPreview(previewDate);
      setSuccess("Configuración de comunicaciones guardada.");
    } catch (saveError) {
      setError(saveError.message || "No se pudo guardar la configuración.");
    } finally {
      setOperation("");
    }
  };

  const runAutomation = async () => {
    const ready = Number(automationPreview?.summary?.ready || 0);
    if (!ready) return;
    if (!window.confirm(
      `Se generarán ${ready} recordatorio(s) previstos para hoy. ¿Continuar?`,
    )) return;
    try {
      setOperation("run-automation");
      setError("");
      setSuccess("");
      const result = await runConsortiumAutomation(inmobiliariaId, consortium.id);
      setSuccess(
        `Automatización ejecutada: ${result.queued || 0} envío(s) en cola, ` +
        `${result.skipped || 0} omitido(s) y ${result.failed || 0} fallido(s).`,
      );
      const today = todayDateKey();
      setPreviewDate(today);
      await Promise.all([load(), loadAutomationPreview(today)]);
    } catch (runError) {
      setError(runError.message || "No se pudo ejecutar la automatización.");
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

        {canManage && <section className="rounded border p-3 mb-4" aria-labelledby="automation-center-title">
          <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
            <div><h3 className="h6 mb-1" id="automation-center-title">Centro de automatizaciones</h3><small className="text-muted">La vista previa no envía emails. La ejecución real siempre utiliza la fecha argentina de hoy.</small></div>
            <div className="d-flex flex-wrap gap-2 align-items-end"><div><label className="form-label small mb-1" htmlFor={`automation-preview-date-${consortium.id}`}>Simular fecha</label><input className="form-control form-control-sm" id={`automation-preview-date-${consortium.id}`} type="date" value={previewDate} onChange={(event) => setPreviewDate(event.target.value)} /></div><button className="btn btn-sm btn-outline-primary" type="button" disabled={operation === "preview" || !previewDate} onClick={() => loadAutomationPreview(previewDate)}>{operation === "preview" ? "Calculando..." : "Previsualizar"}</button></div>
          </div>
          {automationPreview && <>
            <div className={`alert py-2 small ${automationPreview.automationEnabled ? "alert-success" : "alert-warning"}`}>{automationPreview.automationEnabled ? "Automatización autorizada y activa para este consorcio." : "La automatización no está activa: ninguna ejecución generará envíos."}{automationPreview.dateKey !== todayDateKey() && " Esta es una simulación histórica o futura; no puede ejecutarse."}</div>
            <div className="row g-2 mb-3">
              <div className="col-6 col-lg-2"><div className="border rounded p-2 h-100"><small className="text-muted d-block">Unidades activas</small><strong>{automationPreview.summary?.activeUnits || 0}</strong></div></div>
              <div className="col-6 col-lg-2"><div className="border rounded p-2 h-100"><small className="text-muted d-block">Acciones previstas</small><strong>{automationPreview.summary?.dueActions || 0}</strong></div></div>
              <div className="col-6 col-lg-2"><div className="border rounded p-2 h-100"><small className="text-muted d-block">Listas</small><strong className="text-success">{automationPreview.summary?.ready || 0}</strong></div></div>
              <div className="col-6 col-lg-2"><div className="border rounded p-2 h-100"><small className="text-muted d-block">Ya generadas</small><strong>{automationPreview.summary?.alreadyQueued || 0}</strong></div></div>
              <div className="col-6 col-lg-2"><div className="border rounded p-2 h-100"><small className="text-muted d-block">Sin contacto</small><strong className="text-warning">{automationPreview.summary?.incompleteUnits || 0}</strong></div></div>
              <div className="col-6 col-lg-2"><div className="border rounded p-2 h-100"><small className="text-muted d-block">Excluidas</small><strong>{automationPreview.summary?.excludedUnits || 0}</strong></div></div>
            </div>
            {(automationPreview.incompleteUnits || []).length > 0 && <div className="alert alert-warning py-2 small"><strong>Revisar destinatarios:</strong> {(automationPreview.incompleteUnits || []).slice(0, 20).map((unit) => unit.unitCode).join(", ")}{automationPreview.incompleteUnits.length > 20 ? ` y ${automationPreview.incompleteUnits.length - 20} más` : ""}.</div>}
            <div className="table-responsive mb-3"><table className="table table-sm align-middle"><thead><tr><th>Unidad</th><th>Acción</th><th>Vencimiento</th><th>Saldo</th><th>Destinatarios</th><th>Resultado previsto</th></tr></thead><tbody>{(automationPreview.actions || []).map((action) => { const status = automationStatus(action.status); return <tr key={`${action.obligationId}_${action.kind}_${action.offsetDays}`}><td><strong>{action.unitCode}</strong><small className="d-block text-muted">{action.periodKey || "Sin período"}</small></td><td>{automationActionLabel(action)}</td><td>{action.dueDate}</td><td>{formatAutomationAmount(action.balanceMinor, action.currency)}</td><td>{(action.recipients || []).map((recipient) => recipient.email).join(", ") || "—"}</td><td><span className={`badge ${status.badge}`}>{status.label}</span></td></tr>; })}{!(automationPreview.actions || []).length && <tr><td className="text-center text-muted py-3" colSpan="6">No hay recordatorios previstos para la fecha simulada.</td></tr>}</tbody></table></div>
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3"><small className="text-muted">La idempotencia impide generar dos veces el mismo aviso.</small><button className="btn btn-success" type="button" disabled={operation === "run-automation" || automationPreview.dateKey !== todayDateKey() || !automationPreview.automationEnabled || !Number(automationPreview.summary?.ready || 0)} onClick={runAutomation}>{operation === "run-automation" ? "Ejecutando..." : `Ejecutar ${automationPreview.summary?.ready || 0} envío(s) de hoy`}</button></div>
            <details><summary className="small fw-semibold">Últimas ejecuciones ({(automationPreview.runs || []).length})</summary><div className="table-responsive mt-2"><table className="table table-sm mb-0"><thead><tr><th>Fecha</th><th>Tipo</th><th>Resultado</th><th>Procesamiento</th></tr></thead><tbody>{(automationPreview.runs || []).map((run) => <tr key={run.id}><td>{formatTimestamp(run.createdAt)}<small className="d-block text-muted">Fecha operativa: {run.dateKey}</small></td><td>{automationTriggerLabel(run.trigger)}{run.actorEmail && <small className="d-block text-muted">{run.actorEmail}</small>}</td><td><span className={`badge ${run.status === "completed" ? "text-bg-success" : "text-bg-warning"}`}>{run.status === "completed" ? "Completada" : "Con observaciones"}</span></td><td>{run.summary?.queued || 0} enviados · {run.summary?.skipped || 0} omitidos · {run.summary?.failed || 0} fallidos</td></tr>)}{!(automationPreview.runs || []).length && <tr><td className="text-center text-muted py-2" colSpan="4">Todavía no hay ejecuciones registradas.</td></tr>}</tbody></table></div></details>
          </>}
        </section>}

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
