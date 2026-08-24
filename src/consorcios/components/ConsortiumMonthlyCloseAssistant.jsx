import { Link } from "react-router-dom";

import { formatConsortiumMoney } from "../utils/consorcio.helpers";

const checklistVisuals = {
  blocker: { badge: "text-bg-danger", icon: "×", label: "Bloquea el cierre", className: "border-danger-subtle bg-danger-subtle" },
  warning: { badge: "text-bg-warning", icon: "!", label: "Requiere revisión", className: "border-warning-subtle bg-warning-subtle" },
  ok: { badge: "text-bg-success", icon: "✓", label: "Correcto", className: "border-success-subtle bg-success-subtle" },
};

const ConsortiumMonthlyCloseAssistant = ({
  checklist,
  consortiumId,
  currency = "ARS",
  loading = false,
  operation = "",
  acknowledged = false,
  note = "",
  onAcknowledgedChange,
  onNoteChange,
  onClose,
  onConfirm,
  onNavigate,
  onRefresh,
}) => {
  const summary = checklist?.summary || {};
  const warnings = checklist?.warnings || [];
  const blockers = checklist?.blockers || [];
  const canConfirm = checklist?.canClose
    && blockers.length === 0
    && (!warnings.length || acknowledged);

  return (
    <section className="rounded border bg-light p-3 mt-4 consortium-monthly-close-assistant">
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-3">
        <div>
          <span className="badge text-bg-primary mb-2">Cierre asistido</span>
          <h3 className="h5 mb-1">Control mensual antes de cerrar</h3>
          <p className="text-muted small mb-0">ONO Prop vuelve a leer los datos del período y registra el resultado de esta revisión junto con el usuario responsable.</p>
        </div>
        <div className="d-flex gap-2">
          <button className="btn btn-sm btn-outline-primary" disabled={loading || Boolean(operation)} type="button" onClick={onRefresh}>{loading ? "Controlando..." : "Actualizar control"}</button>
          <button className="btn btn-sm btn-outline-secondary" disabled={Boolean(operation)} type="button" onClick={onClose}>Cerrar asistente</button>
        </div>
      </div>

      {loading && <div className="text-center text-muted py-5">Revisando liquidación, cobranzas, comprobantes y tesorería...</div>}

      {!loading && checklist && <>
        <div className="row g-2 mb-3">
          <div className="col-4"><div className="rounded border bg-white p-2 h-100"><small className="text-muted d-block">Controles correctos</small><strong className="fs-5 text-success">{summary.okCount || 0}</strong></div></div>
          <div className="col-4"><div className="rounded border bg-white p-2 h-100"><small className="text-muted d-block">Advertencias</small><strong className="fs-5 text-warning-emphasis">{summary.warningCount || 0}</strong></div></div>
          <div className="col-4"><div className="rounded border bg-white p-2 h-100"><small className="text-muted d-block">Bloqueos</small><strong className="fs-5 text-danger">{summary.blockerCount || 0}</strong></div></div>
        </div>

        {blockers.length > 0 && <div className="alert alert-danger py-2"><strong>El cierre todavía no es seguro.</strong> Resolvé los controles marcados en rojo y actualizá el diagnóstico.</div>}
        {!blockers.length && warnings.length > 0 && <div className="alert alert-warning py-2"><strong>El período puede cerrarse con advertencias.</strong> Las deudas y obligaciones pendientes continuarán vigentes después del cierre.</div>}
        {!blockers.length && !warnings.length && <div className="alert alert-success py-2"><strong>Todos los controles están correctos.</strong> El período está listo para cerrarse.</div>}

        <div className="vstack gap-2 mb-4">
          {checklist.items.map((item) => {
            const visual = checklistVisuals[item.status] || checklistVisuals.ok;
            return (
              <article className={`rounded border p-3 ${visual.className}`} key={item.code}>
                <div className="d-flex flex-wrap justify-content-between align-items-start gap-2">
                  <div className="d-flex gap-3">
                    <span className={`badge rounded-pill ${visual.badge} consortium-close-item-icon`}>{visual.icon}</span>
                    <div>
                      <strong className="d-block">{item.title}</strong>
                      <small className="text-muted d-block">{item.detail}</small>
                      {item.amountMinor > 0 && <strong className="consortium-money d-block mt-1">{formatConsortiumMoney(item.amountMinor, currency)}</strong>}
                    </div>
                  </div>
                  <div className="d-flex flex-wrap align-items-center justify-content-end gap-2">
                    <span className={`badge ${visual.badge}`}>{visual.label}</span>
                    {item.area === "treasury" && <button className="btn btn-sm btn-outline-dark" type="button" onClick={() => onNavigate?.("treasury")}>Ir a Tesorería</button>}
                    {item.area === "units" && <button className="btn btn-sm btn-outline-dark" type="button" onClick={() => onNavigate?.("units")}>Ver unidades</button>}
                    {item.area === "economic_statement" && <Link className="btn btn-sm btn-outline-dark" to={`/admin/consorcios/${consortiumId}/estado-economico?period=${encodeURIComponent(checklist.periodKey)}`}>Estado económico</Link>}
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        <div className="border-top pt-3">
          <div className="mb-3">
            <label className="form-label" htmlFor="consortium-close-note">Observación del responsable</label>
            <textarea id="consortium-close-note" className="form-control" rows="2" maxLength="2000" placeholder="Opcional. Ej.: queda pendiente conciliar la cuenta bancaria cuando llegue el extracto." value={note} onChange={(event) => onNoteChange?.(event.target.value)} />
          </div>
          {warnings.length > 0 && <div className="form-check mb-3"><input className="form-check-input" id="consortium-close-acknowledgement" type="checkbox" checked={acknowledged} onChange={(event) => onAcknowledgedChange?.(event.target.checked)} /><label className="form-check-label" htmlFor="consortium-close-acknowledgement">Revisé las advertencias y confirmo que las partidas pendientes continuarán en seguimiento.</label></div>}
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
            <small className="text-muted">El cierre no elimina deudas, cuentas a pagar ni trazabilidad. Solo confirma la revisión operativa del mes.</small>
            <button className="btn btn-dark" disabled={!canConfirm || operation === "close-period"} type="button" onClick={onConfirm}>{operation === "close-period" ? "Cerrando período..." : "Confirmar cierre mensual"}</button>
          </div>
        </div>
      </>}
    </section>
  );
};

export default ConsortiumMonthlyCloseAssistant;
