import { useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  createRectifiedTasacion,
  transitionTasacionState,
} from "../services/tasacion.service";
import { getTasacionEstado } from "../utils/tasacion.constants";

const TasacionWorkflowPanel = ({
  item,
  inmobiliariaId,
  inmobiliaria,
  canManage,
  onChanged,
}) => {
  const navigate = useNavigate();
  const [note, setNote] = useState("");
  const [recipient, setRecipient] = useState("");
  const [signatureConfirmed, setSignatureConfirmed] = useState(false);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const verificationCode = item.issuance?.verificationCode || "";
  const verificationUrl = verificationCode
    ? `${window.location.origin}/tasaciones/verificar/${verificationCode}`
    : "";

  const transition = async (toStatus) => {
    try {
      setBusy(toStatus);
      setError("");
      setMessage("");
      await transitionTasacionState({
        inmobiliariaId,
        tasacionId: item.id,
        toStatus,
        note,
        recipient,
        signatureConfirmed,
        inmobiliaria,
      });
      setNote("");
      setRecipient("");
      setSignatureConfirmed(false);
      setMessage(`La tasación pasó a ${getTasacionEstado(toStatus).label}.`);
      await onChanged?.();
    } catch (actionError) {
      setError(actionError.message || "No se pudo actualizar el expediente.");
    } finally {
      setBusy("");
    }
  };

  const issue = async () => {
    if (!window.confirm(
      "¿Confirmás la emisión? El contenido quedará inmutable y cualquier corrección requerirá una nueva versión.",
    )) return;
    await transition("emitida");
  };

  const rectify = async () => {
    if (!note.trim()) {
      setError("Describí el motivo de la nueva versión.");
      return;
    }
    try {
      setBusy("rectificar");
      setError("");
      const newId = await createRectifiedTasacion({
        inmobiliariaId,
        tasacionId: item.id,
        reason: note,
      });
      navigate(`/admin/tasaciones/${newId}/editar`);
    } catch (actionError) {
      setError(actionError.message || "No se pudo crear la nueva versión.");
      setBusy("");
    }
  };

  const copyVerificationLink = async () => {
    try {
      await navigator.clipboard.writeText(verificationUrl);
      setMessage("Enlace público de verificación copiado.");
    } catch {
      setError("No se pudo copiar el enlace. Podés seleccionarlo manualmente.");
    }
  };

  const needsNote = ["en_revision", "aprobada", "emitida", "entregada"].includes(
    item.estado,
  );

  return (
    <section className="card border-0 shadow-sm mb-4 no-print tasacion-workflow-panel">
      <div className="card-body p-4">
        <div className="d-flex flex-wrap justify-content-between gap-3 mb-3">
          <div>
            <p className="text-uppercase text-muted small mb-1">Circuito profesional</p>
            <h2 className="h5 mb-1">Revisión, emisión y entrega</h2>
            <p className="text-muted small mb-0">
              La emisión congela el contenido. Las correcciones posteriores crean una versión vinculada.
            </p>
          </div>
          <span className={`badge align-self-start ${getTasacionEstado(item.estado).badge}`}>
            {getTasacionEstado(item.estado).label}
          </span>
        </div>

        {item.review?.notes && (
          <div className="alert alert-warning py-2">
            <strong>Última observación:</strong> {item.review.notes}
          </div>
        )}
        {message && <div className="alert alert-success py-2">{message}</div>}
        {error && <div className="alert alert-danger py-2">{error}</div>}

        {verificationCode && (
          <div className="rounded border bg-light p-3 mb-3">
            <div className="small text-uppercase text-muted fw-semibold">Código de verificación</div>
            <div className="d-flex flex-wrap align-items-center gap-2 mt-1">
              <code className="fs-6">{verificationCode}</code>
              <button type="button" className="btn btn-sm btn-outline-primary" onClick={copyVerificationLink}>
                Copiar enlace público
              </button>
            </div>
            <div className="small text-break text-muted mt-1">{verificationUrl}</div>
          </div>
        )}

        {!canManage && (
          <div className="alert alert-light border mb-0">
            Tu rol permite consultar el informe, pero no cambiar su estado.
          </div>
        )}

        {canManage && needsNote && (
          <div className="row g-3 mb-3">
            {item.estado === "emitida" && (
              <div className="col-md-5">
                <label className="form-label" htmlFor="tasacion-delivery-recipient">Destinatario de la entrega</label>
                <input
                  id="tasacion-delivery-recipient"
                  className="form-control"
                  value={recipient}
                  onChange={(event) => setRecipient(event.target.value)}
                  placeholder="Cliente, entidad o correo"
                />
              </div>
            )}
            <div className={item.estado === "emitida" ? "col-md-7" : "col-12"}>
              <label className="form-label" htmlFor="tasacion-workflow-note">
                {item.estado === "en_revision" ? "Nota de revisión" : "Motivo u observaciones"}
              </label>
              <textarea
                id="tasacion-workflow-note"
                className="form-control"
                rows={2}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Queda incorporado al historial del expediente"
              />
            </div>
          </div>
        )}

        {canManage && item.estado === "en_revision" && (
          <div className="d-flex flex-wrap gap-2">
            <button type="button" className="btn btn-outline-danger" disabled={Boolean(busy)} onClick={() => transition("observada")}>
              Marcar observaciones
            </button>
            <button type="button" className="btn btn-success" disabled={Boolean(busy)} onClick={() => transition("aprobada")}>
              Aprobar revisión
            </button>
          </div>
        )}

        {canManage && item.estado === "aprobada" && (
          <>
            <div className="form-check mb-3">
              <input
                className="form-check-input"
                id="tasacion-signature-confirmed"
                type="checkbox"
                checked={signatureConfirmed}
                onChange={(event) => setSignatureConfirmed(event.target.checked)}
              />
              <label className="form-check-label" htmlFor="tasacion-signature-confirmed">
                Confirmo que el profesional identificado revisó y firmó el informe.
              </label>
            </div>
            <div className="d-flex flex-wrap gap-2">
              <button type="button" className="btn btn-outline-danger" disabled={Boolean(busy)} onClick={() => transition("observada")}>
                Devolver con observaciones
              </button>
              <button type="button" className="btn btn-primary" disabled={Boolean(busy) || !signatureConfirmed} onClick={issue}>
                Emitir versión inmutable
              </button>
            </div>
          </>
        )}

        {canManage && item.estado === "emitida" && (
          <div className="d-flex flex-wrap gap-2">
            <button type="button" className="btn btn-primary" disabled={Boolean(busy)} onClick={() => transition("entregada")}>
              Marcar como entregada
            </button>
            <button type="button" className="btn btn-outline-secondary" disabled={Boolean(busy)} onClick={rectify}>
              Crear nueva versión
            </button>
            <button type="button" className="btn btn-outline-danger" disabled={Boolean(busy)} onClick={() => transition("anulada")}>
              Anular informe
            </button>
          </div>
        )}

        {canManage && item.estado === "entregada" && (
          <div className="d-flex flex-wrap gap-2">
            <button type="button" className="btn btn-outline-secondary" disabled={Boolean(busy)} onClick={rectify}>
              Crear nueva versión
            </button>
            <button type="button" className="btn btn-outline-danger" disabled={Boolean(busy)} onClick={() => transition("anulada")}>
              Anular informe
            </button>
          </div>
        )}
      </div>
    </section>
  );
};

export default TasacionWorkflowPanel;
