import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import {
  challengeConsortiumPenalty,
  confirmConsortiumPenalty,
  createConsortiumPenalty,
  getConsortiumPenalties,
  notifyConsortiumPenalty,
  ratifyConsortiumPenalty,
  voidConsortiumPenalty,
} from "../services/consorcio.service";
import { CONSORTIUM_DOCUMENT_ACCEPT } from "../utils/consorcio.constants";
import {
  formatConsortiumMoney,
  getConsortiumPenaltyAuthorityLabel,
  getConsortiumPenaltyStatus,
  getConsortiumPenaltyStatusLabel,
  getDefaultConsortiumDueDate,
  majorToMinor,
} from "../utils/consorcio.helpers";
import { isConsortiumDocumentFileValid } from "../utils/consorcioPortal.helpers";
import ConsortiumPrivateDocumentButton from "./ConsortiumPrivateDocumentButton";

const todayKey = () => new Date().toISOString().slice(0, 10);
const currentPeriodKey = () => todayKey().slice(0, 7);

const emptyPenaltyForm = (unitId = "", dueDay = 10) => ({
  unitId,
  infringementDate: todayKey(),
  resolutionDate: todayKey(),
  dueDate: getDefaultConsortiumDueDate(currentPeriodKey(), dueDay),
  description: "",
  ruleReference: "",
  authority: "assembly",
  authorityReference: "",
  evidenceNotes: "",
  amountMajor: "",
  file: null,
});

const ConsortiumPenaltiesPanel = ({
  inmobiliariaId,
  consortium,
  units = [],
  obligations = [],
  canManage = false,
  requestedUnitId = "",
  requestNonce = 0,
  onChanged,
}) => {
  const [penalties, setPenalties] = useState([]);
  const [form, setForm] = useState(() => emptyPenaltyForm("", consortium?.dueDay));
  const [showForm, setShowForm] = useState(false);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [operation, setOperation] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadPenalties = useCallback(async () => {
    if (!inmobiliariaId || !consortium?.id) return;
    try {
      const data = await getConsortiumPenalties(inmobiliariaId, { consortiumId: consortium.id });
      setPenalties(data);
    } catch (loadError) {
      setError(loadError.message || "No se pudieron cargar las multas.");
    }
  }, [consortium?.id, inmobiliariaId]);

  useEffect(() => { loadPenalties(); }, [loadPenalties]);

  useEffect(() => {
    if (!requestedUnitId) return;
    setForm(emptyPenaltyForm(requestedUnitId, consortium?.dueDay));
    setShowForm(true);
    setError("");
    setSuccess("");
    setTimeout(() => {
      document.getElementById("consortium-penalty-form")?.scrollIntoView({ behavior: "smooth" });
    }, 0);
  }, [consortium?.dueDay, requestNonce, requestedUnitId]);

  useEffect(() => {
    if (!form.resolutionDate) return;
    setForm((current) => ({
      ...current,
      dueDate: getDefaultConsortiumDueDate(
        current.resolutionDate.slice(0, 7),
        consortium?.dueDay,
      ),
    }));
  }, [consortium?.dueDay, form.resolutionDate]);

  const obligationsById = useMemo(
    () => new Map(obligations.map((item) => [item.id, item])),
    [obligations],
  );

  const refreshAll = async () => {
    await Promise.all([loadPenalties(), onChanged?.()]);
  };

  const resetMessages = () => {
    setError("");
    setSuccess("");
  };

  const openForm = (unitId = "") => {
    setForm(emptyPenaltyForm(unitId || units[0]?.id || "", consortium?.dueDay));
    setFileInputKey((current) => current + 1);
    setShowForm(true);
    resetMessages();
  };

  const submitPenalty = async (event) => {
    event.preventDefault();
    try {
      resetMessages();
      setOperation("create");
      if (form.file && !isConsortiumDocumentFileValid(form.file)) {
        throw new Error("El respaldo debe ser PDF, JPG, PNG o WEBP de hasta 10 MB.");
      }
      await createConsortiumPenalty({
        inmobiliariaId,
        consortiumId: consortium.id,
        value: {
          ...form,
          amountMinor: majorToMinor(form.amountMajor),
        },
        file: form.file,
      });
      setSuccess("Expediente de multa creado como borrador. Todavía no generó deuda.");
      setShowForm(false);
      setForm(emptyPenaltyForm("", consortium?.dueDay));
      setFileInputKey((current) => current + 1);
      await refreshAll();
    } catch (saveError) {
      setError(saveError.message || "No se pudo crear el expediente de multa.");
    } finally {
      setOperation("");
    }
  };

  const notifyPenalty = async (penalty) => {
    const notificationDate = window.prompt("Fecha de notificación (AAAA-MM-DD):", todayKey());
    if (!notificationDate) return;
    const notificationMethod = window.prompt("Medio de notificación (email, carta documento, entrega personal, etc.):", "Email");
    if (!notificationMethod) return;
    const defaultRecipient = penalty.unitSnapshot?.ownerName || penalty.unitSnapshot?.occupantName || "";
    const notificationRecipient = window.prompt("Persona notificada:", defaultRecipient);
    if (!notificationRecipient) return;
    try {
      resetMessages();
      setOperation(`notify-${penalty.id}`);
      await notifyConsortiumPenalty({
        inmobiliariaId,
        penaltyId: penalty.id,
        notificationDate,
        notificationMethod,
        notificationRecipient,
      });
      setSuccess("Multa marcada como notificada. Ya puede confirmarse el débito si no existe una impugnación pendiente.");
      await refreshAll();
    } catch (notifyError) {
      setError(notifyError.message || "No se pudo registrar la notificación.");
    } finally {
      setOperation("");
    }
  };

  const confirmPenalty = async (penalty) => {
    if (!window.confirm("¿Confirmar la sanción y generar el débito en la cuenta de la unidad?")) return;
    try {
      resetMessages();
      setOperation(`confirm-${penalty.id}`);
      await confirmConsortiumPenalty({ inmobiliariaId, penaltyId: penalty.id });
      setSuccess("Multa confirmada y débito individual generado.");
      await refreshAll();
    } catch (confirmError) {
      setError(confirmError.message || "No se pudo confirmar la multa.");
    } finally {
      setOperation("");
    }
  };

  const challengePenalty = async (penalty) => {
    const reason = window.prompt("Fundamento de la impugnación:");
    if (!reason) return;
    try {
      resetMessages();
      setOperation(`challenge-${penalty.id}`);
      await challengeConsortiumPenalty({ inmobiliariaId, penaltyId: penalty.id, reason });
      setSuccess("Impugnación registrada con trazabilidad.");
      await refreshAll();
    } catch (challengeError) {
      setError(challengeError.message || "No se pudo registrar la impugnación.");
    } finally {
      setOperation("");
    }
  };

  const ratifyPenalty = async (penalty) => {
    const reason = window.prompt("Fundamento de la ratificación:");
    if (!reason) return;
    try {
      resetMessages();
      setOperation(`ratify-${penalty.id}`);
      await ratifyConsortiumPenalty({ inmobiliariaId, penaltyId: penalty.id, reason });
      setSuccess("Multa ratificada. Se conservó el historial de la impugnación.");
      await refreshAll();
    } catch (ratifyError) {
      setError(ratifyError.message || "No se pudo ratificar la multa.");
    } finally {
      setOperation("");
    }
  };

  const voidPenalty = async (penalty) => {
    const reason = window.prompt("Fundamento de la anulación:");
    if (!reason) return;
    if (!window.confirm("La anulación quedará registrada y, si ya existe deuda sin pagos, generará el crédito inverso. ¿Continuar?")) return;
    try {
      resetMessages();
      setOperation(`void-${penalty.id}`);
      await voidConsortiumPenalty({ inmobiliariaId, penaltyId: penalty.id, reason });
      setSuccess("Multa anulada sin borrar el expediente ni sus movimientos.");
      await refreshAll();
    } catch (voidError) {
      setError(voidError.message || "No se pudo anular la multa.");
    } finally {
      setOperation("");
    }
  };

  return (
    <section className="card border-0 shadow-sm mb-4 consortium-section-anchor" id="multas">
      <div className="card-body p-4">
        <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
          <div><h2 className="h5 mb-1">Multas y penalidades</h2><p className="text-muted small mb-0">La creación del expediente no genera deuda. El débito nace después de registrar la notificación y confirmar la sanción.</p></div>
          {canManage && <button className="btn btn-outline-danger" type="button" onClick={() => openForm()}>Registrar multa</button>}
        </div>
        {error && <div className="alert alert-danger py-2">{error}</div>}
        {success && <div className="alert alert-success py-2">{success}</div>}

        {canManage && showForm && (
          <form id="consortium-penalty-form" className="rounded border border-danger-subtle bg-danger-subtle p-3 mb-4" onSubmit={submitPenalty}>
            <div className="d-flex justify-content-between align-items-center mb-3"><div><h3 className="h6 mb-1">Nuevo expediente de multa</h3><small className="text-muted">Todos los datos podrán ser consultados por las personas habilitadas para la unidad.</small></div><button className="btn btn-sm btn-link" type="button" onClick={() => setShowForm(false)}>Cancelar</button></div>
            <div className="row g-3">
              <div className="col-md-3"><label className="form-label">Unidad *</label><select className="form-select" value={form.unitId} onChange={(e) => setForm((c) => ({ ...c, unitId: e.target.value }))} required><option value="">Seleccionar...</option>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.code}</option>)}</select></div>
              <div className="col-md-3"><label className="form-label">Fecha de infracción *</label><input className="form-control" type="date" value={form.infringementDate} onChange={(e) => setForm((c) => ({ ...c, infringementDate: e.target.value }))} required /></div>
              <div className="col-md-3"><label className="form-label">Fecha de resolución *</label><input className="form-control" type="date" value={form.resolutionDate} onChange={(e) => setForm((c) => ({ ...c, resolutionDate: e.target.value }))} required /></div>
              <div className="col-md-3"><label className="form-label">Vencimiento *</label><input className="form-control" type="date" value={form.dueDate} onChange={(e) => setForm((c) => ({ ...c, dueDate: e.target.value }))} required /></div>
              <div className="col-md-4"><label className="form-label">Autoridad *</label><select className="form-select" value={form.authority} onChange={(e) => setForm((c) => ({ ...c, authority: e.target.value }))}><option value="assembly">Asamblea</option><option value="council">Consejo de propietarios</option><option value="administrator">Administración</option><option value="other">Otra autoridad</option></select></div>
              <div className="col-md-5"><label className="form-label">Acta / resolución de respaldo *</label><input className="form-control" placeholder="Ej. Acta 18, punto 4" value={form.authorityReference} onChange={(e) => setForm((c) => ({ ...c, authorityReference: e.target.value }))} required /></div>
              <div className="col-md-3"><label className="form-label">Importe *</label><input className="form-control" inputMode="decimal" placeholder="0,00" value={form.amountMajor} onChange={(e) => setForm((c) => ({ ...c, amountMajor: e.target.value }))} required /></div>
              <div className="col-12"><label className="form-label">Conducta sancionada *</label><textarea className="form-control" rows="2" value={form.description} onChange={(e) => setForm((c) => ({ ...c, description: e.target.value }))} required /></div>
              <div className="col-12"><label className="form-label">Norma o cláusula aplicable *</label><textarea className="form-control" rows="2" placeholder="Reglamento, artículo y texto relevante" value={form.ruleReference} onChange={(e) => setForm((c) => ({ ...c, ruleReference: e.target.value }))} required /></div>
              <div className="col-md-6"><label className="form-label">Notas sobre la evidencia</label><textarea className="form-control" rows="2" value={form.evidenceNotes} onChange={(e) => setForm((c) => ({ ...c, evidenceNotes: e.target.value }))} /></div>
              <div className="col-md-6"><label className="form-label">Acta, evidencia o respaldo</label><input key={fileInputKey} className="form-control" type="file" accept={CONSORTIUM_DOCUMENT_ACCEPT} onChange={(e) => setForm((c) => ({ ...c, file: e.target.files?.[0] || null }))} /><small className="text-muted">Opcional. PDF, JPG, PNG o WEBP de hasta 10 MB.</small></div>
              <div className="col-12 text-end"><button className="btn btn-danger" disabled={operation === "create"} type="submit">{operation === "create" ? "Creando..." : "Crear expediente en borrador"}</button></div>
            </div>
          </form>
        )}

        <div className="table-responsive">
          <table className="table table-hover align-middle">
            <thead><tr><th>Unidad</th><th>Resolución</th><th>Fundamento</th><th>Importe</th><th>Estado</th><th>Respaldo</th><th className="text-end">Acciones</th></tr></thead>
            <tbody>
              {penalties.map((penalty) => {
                const obligation = obligationsById.get(penalty.obligationId);
                const effectiveStatus = getConsortiumPenaltyStatus(penalty, obligation);
                const statusMeta = getConsortiumPenaltyStatusLabel(effectiveStatus);
                return <tr key={penalty.id}><td><strong>{penalty.unitSnapshot?.code || penalty.unitId}</strong><small className="d-block text-muted">{penalty.notificationRecipient || penalty.unitSnapshot?.ownerName || "Sin notificar"}</small></td><td>{penalty.resolutionDate}<small className="d-block text-muted">{getConsortiumPenaltyAuthorityLabel(penalty.authority)} · {penalty.authorityReference}</small></td><td><div>{penalty.description}</div><small className="text-muted">{penalty.ruleReference}</small>{penalty.challengeReason && <small className="d-block text-danger">Impugnación: {penalty.challengeReason}</small>}</td><td className="consortium-money fw-semibold">{formatConsortiumMoney(penalty.amountMinor, penalty.currency)}</td><td><span className={`badge ${statusMeta.badge}`}>{statusMeta.label}</span>{penalty.notificationDate && <small className="d-block text-muted">Notificada {penalty.notificationDate}</small>}</td><td><ConsortiumPrivateDocumentButton path={penalty.evidenceStoragePath} fileName={penalty.evidenceFileName} label="Ver" /></td><td className="text-end"><div className="d-flex flex-wrap justify-content-end gap-1">{penalty.obligationId && <Link className="btn btn-sm btn-outline-primary" to={`/admin/consorcios/${consortium.id}/liquidaciones/${penalty.obligationId}`}>Débito</Link>}{canManage && penalty.status === "draft" && <button className="btn btn-sm btn-outline-info" disabled={operation === `notify-${penalty.id}`} type="button" onClick={() => notifyPenalty(penalty)}>Notificar</button>}{canManage && penalty.status === "notified" && <button className="btn btn-sm btn-outline-danger" disabled={operation === `confirm-${penalty.id}`} type="button" onClick={() => confirmPenalty(penalty)}>Confirmar débito</button>}{canManage && ["notified", "confirmed"].includes(penalty.status) && <button className="btn btn-sm btn-outline-warning" disabled={operation === `challenge-${penalty.id}`} type="button" onClick={() => challengePenalty(penalty)}>Impugnar</button>}{canManage && penalty.status === "challenged" && <button className="btn btn-sm btn-outline-success" disabled={operation === `ratify-${penalty.id}`} type="button" onClick={() => ratifyPenalty(penalty)}>Ratificar</button>}{canManage && penalty.status !== "voided" && effectiveStatus !== "paid" && <button className="btn btn-sm btn-outline-dark" disabled={operation === `void-${penalty.id}`} type="button" onClick={() => voidPenalty(penalty)}>Anular</button>}</div></td></tr>;
              })}
              {!penalties.length && <tr><td className="text-center text-muted py-4" colSpan="7">No hay multas registradas.</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="small text-muted mb-0">La aplicación registra el circuito administrativo; la validez y exigibilidad de cada sanción dependen del reglamento y de la decisión respaldatoria del consorcio.</p>
      </div>
    </section>
  );
};

export default ConsortiumPenaltiesPanel;
