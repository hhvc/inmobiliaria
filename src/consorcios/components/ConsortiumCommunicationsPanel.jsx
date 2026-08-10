import { useCallback, useEffect, useMemo, useState } from "react";

import {
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
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [loading, setLoading] = useState(true);
  const [operation, setOperation] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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
      const [settingsData, communicationData] = await Promise.all([
        getConsortiumNotificationSettings(inmobiliariaId, consortium.id),
        getConsortiumCommunications(inmobiliariaId, {
          consortiumId: consortium.id,
          periodId: period.id,
        }),
      ]);
      setSettings(settingsData);
      setCommunications(communicationData);
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
        settings,
      );
      setSettings(saved);
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
          <div className="mb-3"><h3 className="h6 mb-1">Plantilla de comunicación</h3><small className="text-muted">Los envíos de esta etapa son manuales y siempre requieren selección y confirmación.</small></div>
          <div className="alert alert-info py-2 small">Los recordatorios programados están preparados pero permanecen inactivos hasta habilitar expresamente el envío recurrente a terceros.</div>
          <div className="row g-3">
            <div className="col-md-8"><label className="form-label">Asunto</label><input className="form-control" value={settings.subjectTemplate} onChange={(event) => setSettings((current) => ({ ...current, subjectTemplate: event.target.value }))} /></div>
            <div className="col-md-4"><label className="form-label">Responder a</label><input className="form-control" type="email" value={settings.replyToEmail} onChange={(event) => setSettings((current) => ({ ...current, replyToEmail: event.target.value }))} placeholder="administracion@ejemplo.com" /></div>
            <div className="col-12"><label className="form-label">Mensaje inicial</label><textarea className="form-control" rows="2" value={settings.introText} onChange={(event) => setSettings((current) => ({ ...current, introText: event.target.value }))} /><small className="text-muted">Variables: {"{{consorcio}}"}, {"{{periodo}}"}, {"{{unidad}}"}, {"{{vencimiento}}"} y {"{{saldo}}"}.</small></div>
            <div className="col-12 text-end"><button className="btn btn-outline-primary" disabled={operation === "settings"} type="submit">{operation === "settings" ? "Guardando..." : "Guardar configuración"}</button></div>
          </div>
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
