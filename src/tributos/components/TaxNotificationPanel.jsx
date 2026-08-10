import { useCallback, useEffect, useMemo, useState } from "react";

import {
  getTaxNotifications,
  getTaxNotificationSettings,
  markTaxNotificationRead,
  runTaxDueAutomationNow,
  saveTaxNotificationSettings,
} from "../services/tax.service";
import {
  TAX_NOTIFICATION_TYPE_LABELS,
  TAX_STATUS_BADGES,
} from "../utils/tax.constants";
import { formatTaxMoney } from "../utils/tax.helpers";

const formatCreatedAt = (value) => {
  const date = value?.toDate?.() || (value ? new Date(value) : null);
  if (!date || Number.isNaN(date.getTime())) return "Recién generada";
  return date.toLocaleString("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  });
};

const TaxNotificationPanel = ({
  inmobiliariaId,
  canManage,
  isRoot,
  userEmail = "",
  onAutomationRun,
}) => {
  const [settings, setSettings] = useState(null);
  const [recipientInput, setRecipientInput] = useState("");
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    if (!inmobiliariaId) return;
    try {
      setLoading(true);
      setError("");
      const [settingsData, notificationData] = await Promise.all([
        getTaxNotificationSettings(inmobiliariaId),
        getTaxNotifications(inmobiliariaId),
      ]);
      setSettings(settingsData);
      setRecipientInput(
        settingsData.recipientEmails.length > 0
          ? settingsData.recipientEmails.join(", ")
          : userEmail,
      );
      setNotifications(notificationData);
    } catch (loadError) {
      setError(loadError.message || "No se pudieron cargar las automatizaciones.");
    } finally {
      setLoading(false);
    }
  }, [inmobiliariaId, userEmail]);

  useEffect(() => {
    load();
  }, [load]);

  const unreadCount = useMemo(
    () => notifications.filter((item) => item.status !== "read").length,
    [notifications],
  );

  const updateSetting = (field, value) => {
    setSettings((current) => ({ ...current, [field]: value }));
  };

  const submitSettings = async (event) => {
    event.preventDefault();
    try {
      setSaving(true);
      setError("");
      setNotice("");
      const saved = await saveTaxNotificationSettings(inmobiliariaId, {
        ...settings,
        recipientEmails: recipientInput,
      });
      setSettings(saved);
      setRecipientInput(saved.recipientEmails.join(", "));
      setNotice("Configuración de avisos guardada.");
    } catch (saveError) {
      setError(saveError.message || "No se pudo guardar la configuración.");
    } finally {
      setSaving(false);
    }
  };

  const runNow = async () => {
    try {
      setRunning(true);
      setError("");
      setNotice("");
      const result = await runTaxDueAutomationNow(inmobiliariaId);
      setNotice(
        `Comprobación terminada: ${result.notificationsCreated || 0} aviso(s) nuevo(s)` +
        `${result.emailDigestsQueued ? " y resumen por correo en cola" : ""}.`,
      );
      await load();
      await onAutomationRun?.();
    } catch (runError) {
      setError(runError.message || "No se pudo ejecutar la comprobación.");
    } finally {
      setRunning(false);
    }
  };

  const markRead = async (notification) => {
    if (notification.status === "read") return;
    try {
      await markTaxNotificationRead(inmobiliariaId, notification.id);
      setNotifications((current) => current.map((item) => (
        item.id === notification.id ? { ...item, status: "read" } : item
      )));
    } catch (readError) {
      setError(readError.message || "No se pudo marcar el aviso como leído.");
    }
  };

  if (loading || !settings) {
    return (
      <section className="card border-0 shadow-sm mb-4">
        <div className="card-body text-center py-4">
          <div className="spinner-border spinner-border-sm me-2" />
          Cargando automatizaciones...
        </div>
      </section>
    );
  }

  return (
    <section className="card border-0 shadow-sm mb-4">
      <div className="card-body p-4">
        <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-3">
          <div>
            <p className="text-uppercase text-muted small mb-1">Automatización diaria</p>
            <h2 className="h5 mb-1">
              Vencimientos y avisos
              {unreadCount > 0 && (
                <span className="badge text-bg-danger ms-2">{unreadCount}</span>
              )}
            </h2>
            <p className="text-muted small mb-0">
              Comprobación diaria a las 06:30, hora de Argentina. Los reintentos no
              duplican avisos.
            </p>
          </div>
          {isRoot && (
            <button
              type="button"
              className="btn btn-outline-primary btn-sm"
              disabled={running || saving}
              onClick={runNow}
            >
              {running ? "Comprobando..." : "Ejecutar ahora"}
            </button>
          )}
        </div>

        {error && <div className="alert alert-danger py-2 small">{error}</div>}
        {notice && <div className="alert alert-success py-2 small">{notice}</div>}

        <form className="row g-3 mb-4" onSubmit={submitSettings}>
          <div className="col-md-4">
            <div className="form-check form-switch">
              <input
                id="taxAutomationEnabled"
                className="form-check-input"
                type="checkbox"
                checked={settings.enabled}
                disabled={!canManage}
                onChange={(event) => updateSetting("enabled", event.target.checked)}
              />
              <label className="form-check-label" htmlFor="taxAutomationEnabled">
                Automatización activa
              </label>
            </div>
          </div>
          <div className="col-md-4">
            <div className="form-check form-switch">
              <input
                id="taxOverdueAlert"
                className="form-check-input"
                type="checkbox"
                checked={settings.overdueAlert}
                disabled={!canManage || !settings.enabled}
                onChange={(event) => updateSetting("overdueAlert", event.target.checked)}
              />
              <label className="form-check-label" htmlFor="taxOverdueAlert">
                Alertar obligaciones vencidas
              </label>
            </div>
          </div>
          <div className="col-md-4">
            <div className="form-check form-switch">
              <input
                id="taxEmailEnabled"
                className="form-check-input"
                type="checkbox"
                checked={settings.emailEnabled}
                disabled={!canManage || !settings.enabled}
                onChange={(event) => updateSetting("emailEnabled", event.target.checked)}
              />
              <label className="form-check-label" htmlFor="taxEmailEnabled">
                Resumen diario por correo
              </label>
            </div>
          </div>

          <div className="col-lg-9">
            <label className="form-label" htmlFor="taxNotificationRecipients">
              Destinatarios del resumen
            </label>
            <input
              id="taxNotificationRecipients"
              className="form-control"
              type="text"
              placeholder="administracion@inmobiliaria.com, titular@inmobiliaria.com"
              value={recipientInput}
              disabled={!canManage || !settings.emailEnabled}
              onChange={(event) => setRecipientInput(event.target.value)}
            />
            <div className="form-text">
              Hasta 10 direcciones separadas por coma. Se envía un único correo diario.
            </div>
          </div>
          {canManage && (
            <div className="col-lg-3 d-flex align-items-end">
              <button
                className="btn btn-primary w-100"
                type="submit"
                disabled={saving || running}
              >
                {saving ? "Guardando..." : "Guardar avisos"}
              </button>
            </div>
          )}
        </form>

        <div className="d-flex justify-content-between align-items-center mb-2">
          <h3 className="h6 mb-0">Avisos recientes</h3>
          <span className="text-muted small">Últimos {notifications.length}</span>
        </div>

        {notifications.length === 0 ? (
          <div className="border rounded p-3 text-muted small">
            Todavía no hay avisos. Se crearán cuando coincida un vencimiento con los
            días configurados en cada objeto fiscal.
          </div>
        ) : (
          <div className="list-group list-group-flush border rounded">
            {notifications.map((notification) => (
              <button
                type="button"
                className={`list-group-item list-group-item-action text-start ${
                  notification.status !== "read" ? "bg-primary-subtle" : ""
                }`}
                key={notification.id}
                onClick={() => markRead(notification)}
              >
                <div className="d-flex flex-wrap justify-content-between gap-2">
                  <div>
                    <div className="d-flex flex-wrap align-items-center gap-2">
                      <strong>{notification.title}</strong>
                      <span className={`badge ${
                        notification.type === "tax_overdue"
                          ? TAX_STATUS_BADGES.overdue
                          : TAX_STATUS_BADGES.pending
                      }`}>
                        {TAX_NOTIFICATION_TYPE_LABELS[notification.type] || "Aviso"}
                      </span>
                    </div>
                    <div className="small mt-1">{notification.message}</div>
                    <div className="small text-muted mt-1">
                      Vencimiento {notification.dueDate} · {formatTaxMoney(
                        notification.amountMinor,
                        notification.currency,
                      )}
                      {notification.channels?.email?.status === "queued"
                        ? " · Resumen por correo en cola"
                        : ""}
                    </div>
                  </div>
                  <span className="small text-muted">
                    {formatCreatedAt(notification.createdAt)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default TaxNotificationPanel;
