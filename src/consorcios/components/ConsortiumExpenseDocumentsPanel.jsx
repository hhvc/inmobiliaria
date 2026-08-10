import { useMemo, useState } from "react";

import {
  CONSORTIUM_DOCUMENT_ACCEPT,
} from "../utils/consorcio.constants";
import { isConsortiumDocumentFileValid } from "../utils/consorcioPortal.helpers";
import {
  uploadConsortiumExpenseDocument,
  voidConsortiumExpenseDocument,
} from "../services/consorcio.service";
import ConsortiumPrivateDocumentButton from "./ConsortiumPrivateDocumentButton";

const todayKey = () => new Date().toISOString().slice(0, 10);

const ConsortiumExpenseDocumentsPanel = ({
  inmobiliariaId,
  consortiumId,
  period,
  expenses = [],
  documents = [],
  canManage = false,
  beforeUpload,
  onChanged,
}) => {
  const [form, setForm] = useState({
    expenseId: "",
    provider: "",
    voucherNumber: "",
    documentDate: todayKey(),
    notes: "",
    file: null,
  });
  const [operation, setOperation] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const activeDocuments = useMemo(
    () => documents.filter((item) => item.voided !== true),
    [documents],
  );

  const submit = async (event) => {
    event.preventDefault();
    try {
      setError("");
      setSuccess("");
      if (!form.expenseId) throw new Error("Seleccioná el gasto respaldado.");
      if (!isConsortiumDocumentFileValid(form.file)) {
        throw new Error("Adjuntá un PDF, JPG, PNG o WEBP de hasta 10 MB.");
      }
      setOperation("upload");
      if (beforeUpload) await beforeUpload();
      await uploadConsortiumExpenseDocument({
        inmobiliariaId,
        consortiumId,
        periodId: period.id,
        expenseId: form.expenseId,
        file: form.file,
        provider: form.provider,
        voucherNumber: form.voucherNumber,
        documentDate: form.documentDate,
        notes: form.notes,
      });
      setForm({
        expenseId: "",
        provider: "",
        voucherNumber: "",
        documentDate: todayKey(),
        notes: "",
        file: null,
      });
      setSuccess("Comprobante incorporado a la liquidación.");
      await onChanged?.();
    } catch (uploadError) {
      setError(uploadError.message || "No se pudo adjuntar el comprobante.");
    } finally {
      setOperation("");
    }
  };

  const voidDocument = async (document) => {
    const reason = window.prompt("Motivo de la anulación del comprobante:");
    if (!reason) return;
    try {
      setOperation(`void-${document.id}`);
      setError("");
      await voidConsortiumExpenseDocument({ inmobiliariaId, documentId: document.id, reason });
      setSuccess("Comprobante anulado. El archivo permanece en el historial.");
      await onChanged?.();
    } catch (voidError) {
      setError(voidError.message || "No se pudo anular el comprobante.");
    } finally {
      setOperation("");
    }
  };

  if (!period) return null;

  return (
    <section className="card border-0 shadow-sm mb-4">
      <div className="card-body p-4">
        <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
          <div>
            <h2 className="h5 mb-1">Comprobantes de gastos</h2>
            <p className="text-muted small mb-0">Respaldo documental asociado a cada concepto de la liquidación.</p>
          </div>
          <span className="badge text-bg-light border">{activeDocuments.length} archivos</span>
        </div>

        {error && <div className="alert alert-danger py-2">{error}</div>}
        {success && <div className="alert alert-success py-2">{success}</div>}

        <div className="table-responsive mb-3">
          <table className="table table-sm align-middle">
            <thead><tr><th>Gasto</th><th>Proveedor / comprobante</th><th>Archivo</th><th>Estado</th><th className="text-end">Acciones</th></tr></thead>
            <tbody>
              {documents.map((document) => (
                <tr className={document.voided ? "text-muted" : ""} key={document.id}>
                  <td>{document.expenseConcept || document.expenseId}</td>
                  <td><div>{document.provider || "No informado"}</div><small className="text-muted">{[document.voucherNumber, document.documentDate].filter(Boolean).join(" · ") || "Sin datos adicionales"}</small></td>
                  <td>{document.originalFileName || document.fileName}</td>
                  <td>{document.voided ? <span className="badge text-bg-dark">Anulado</span> : <span className="badge text-bg-success">Vigente</span>}{document.voidReason && <small className="d-block">{document.voidReason}</small>}</td>
                  <td className="text-end"><div className="d-flex justify-content-end gap-2"><ConsortiumPrivateDocumentButton path={document.storagePath} fileName={document.originalFileName || document.fileName} />{canManage && !document.voided && <button className="btn btn-sm btn-outline-danger" disabled={operation === `void-${document.id}`} type="button" onClick={() => voidDocument(document)}>Anular</button>}</div></td>
                </tr>
              ))}
              {!documents.length && <tr><td className="text-center text-muted py-4" colSpan="5">No se adjuntaron comprobantes.</td></tr>}
            </tbody>
          </table>
        </div>

        {canManage && (
          <form className="rounded border bg-light p-3" onSubmit={submit}>
            <h3 className="h6">Adjuntar comprobante</h3>
            <div className="row g-3">
              <div className="col-lg-4"><label className="form-label">Gasto *</label><select className="form-select" value={form.expenseId} onChange={(event) => setForm((current) => ({ ...current, expenseId: event.target.value }))} required><option value="">Seleccionar...</option>{expenses.map((expense) => <option key={expense.id} value={expense.id}>{expense.concept}</option>)}</select></div>
              <div className="col-lg-4"><label className="form-label">Proveedor</label><input className="form-control" value={form.provider} onChange={(event) => setForm((current) => ({ ...current, provider: event.target.value }))} /></div>
              <div className="col-lg-2"><label className="form-label">N.º comprobante</label><input className="form-control" value={form.voucherNumber} onChange={(event) => setForm((current) => ({ ...current, voucherNumber: event.target.value }))} /></div>
              <div className="col-lg-2"><label className="form-label">Fecha</label><input className="form-control" type="date" value={form.documentDate} onChange={(event) => setForm((current) => ({ ...current, documentDate: event.target.value }))} /></div>
              <div className="col-lg-6"><label className="form-label">Archivo *</label><input className="form-control" type="file" accept={CONSORTIUM_DOCUMENT_ACCEPT} onChange={(event) => setForm((current) => ({ ...current, file: event.target.files?.[0] || null }))} required /></div>
              <div className="col-lg-4"><label className="form-label">Observaciones</label><input className="form-control" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} /></div>
              <div className="col-lg-2 d-flex align-items-end"><button className="btn btn-primary w-100" disabled={operation === "upload" || !expenses.length} type="submit">{operation === "upload" ? "Subiendo..." : "Adjuntar"}</button></div>
            </div>
          </form>
        )}
      </div>
    </section>
  );
};

export default ConsortiumExpenseDocumentsPanel;
