import { useMemo, useState } from "react";

import {
  analyzeConsortiumExpenseDocument,
  CONSORTIUM_EXPENSE_AI_MAX_FILES,
  validateConsortiumExpenseAiFile,
} from "../services/consorcioExpenseAi.service";
import {
  CONSORTIUM_DOCUMENT_ACCEPT,
  CONSORTIUM_EXPENSE_CATEGORIES,
  CONSORTIUM_DISTRIBUTION_MODES,
} from "../utils/consorcio.constants";
import {
  findConsortiumExpenseDocumentDuplicate,
  getConsortiumExpenseAiConfidenceMeta,
  matchConsortiumCoefficientGroup,
} from "../utils/consorcioExpenseAi.helpers";
import { majorToMinor, minorToMajorInput } from "../utils/consorcio.helpers";

const AI_ENABLED = /^(1|true|yes)$/i.test(String(
  import.meta.env.VITE_OPENAI_PROPERTY_DRAFT_ENABLED || "",
).trim());

const makeLocalId = () => globalThis.crypto?.randomUUID?.()
  || `ai_expense_${Date.now()}_${Math.random()}`;

const voucherTypes = [
  ["invoice", "Factura"],
  ["receipt", "Recibo"],
  ["credit_note", "Nota de crédito"],
  ["debit_note", "Nota de débito"],
  ["ticket", "Ticket"],
  ["service_bill", "Factura de servicio"],
  ["other", "Otro"],
  ["unknown", "Sin identificar"],
];

const buildDraft = ({
  file,
  result,
  documents,
  batch,
  coefficientGroups,
  periodCurrency,
}) => {
  const localId = makeLocalId();
  const candidate = {
    localId,
    file,
    providerName: result.providerName || "",
    providerTaxId: result.providerTaxId || "",
    voucherType: result.voucherType || "unknown",
    voucherNumber: result.voucherNumber || "",
    issueDate: result.issueDate || "",
    dueDate: result.dueDate || "",
    currency: ["ARS", "USD"].includes(result.currency) ? result.currency : periodCurrency,
    amountMinor: Number(result.totalAmountMinor || 0),
    amountMajor: minorToMajorInput(result.totalAmountMinor || 0),
    concept: result.suggestedConcept || "",
    category: result.suggestedCategory || "ordinary",
    distributionMode: result.suggestedDistributionMode === "equal" ? "equal" : "coefficient",
    coefficientGroupHint: result.suggestedCoefficientHint || "general",
    coefficientGroupId: matchConsortiumCoefficientGroup(
      result.suggestedCoefficientHint,
      coefficientGroups,
    ),
    notes: "",
    confidence: Number(result.confidence || 0),
    warnings: Array.isArray(result.warnings) ? result.warnings : [],
    documentHash: result.documentHash || "",
    generationId: result.generationId || "",
  };
  const duplicate = findConsortiumExpenseDocumentDuplicate({
    candidate,
    documents,
    batch,
  });
  return {
    ...candidate,
    selected: candidate.amountMinor > 0 && duplicate?.type !== "exact",
  };
};

const ConsortiumExpenseAiAssistant = ({
  inmobiliariaId,
  consortiumId,
  period,
  documents = [],
  coefficientGroups = [],
  disabled = false,
  onIncorporate,
}) => {
  const [files, setFiles] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [operation, setOperation] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [remainingAttempts, setRemainingAttempts] = useState(null);
  const [inputKey, setInputKey] = useState(0);

  const duplicateById = useMemo(() => {
    const result = new Map();
    const previousDrafts = [];
    drafts.forEach((draft) => {
      result.set(draft.localId, findConsortiumExpenseDocumentDuplicate({
        candidate: draft,
        documents,
        batch: previousDrafts,
      }));
      previousDrafts.push(draft);
    });
    return result;
  }, [documents, drafts]);

  const selectableDrafts = drafts.filter((draft) => (
    draft.selected
    && draft.concept.trim()
    && draft.amountMinor > 0
    && draft.currency === (period.currency || "ARS")
    && duplicateById.get(draft.localId)?.type !== "exact"
  ));

  const selectFiles = (event) => {
    const requested = Array.from(event.target.files || []);
    const selected = requested.slice(0, CONSORTIUM_EXPENSE_AI_MAX_FILES);
    const invalid = selected.find((file) => validateConsortiumExpenseAiFile(file));
    setError(invalid
      ? `${invalid.name}: ${validateConsortiumExpenseAiFile(invalid)}`
      : requested.length > CONSORTIUM_EXPENSE_AI_MAX_FILES
        ? `Podés analizar hasta ${CONSORTIUM_EXPENSE_AI_MAX_FILES} archivos por lote. Se seleccionaron solo los primeros ${CONSORTIUM_EXPENSE_AI_MAX_FILES}.`
        : "");
    setNotice("");
    setFiles(invalid ? [] : selected);
  };

  const analyze = async () => {
    if (!files.length) {
      setError("Seleccioná al menos un comprobante.");
      return;
    }
    setOperation("analyze");
    setError("");
    setNotice("");
    const next = [];
    const failures = [];
    for (const file of files) {
      try {
        const result = await analyzeConsortiumExpenseDocument({
          inmobiliariaId,
          consortiumId,
          periodId: period.id,
          file,
        });
        next.push(buildDraft({
          file,
          result,
          documents,
          batch: next,
          coefficientGroups,
          periodCurrency: period.currency || "ARS",
        }));
        if (Number.isFinite(Number(result.quota?.remainingAttempts))) {
          setRemainingAttempts(Number(result.quota.remainingAttempts));
        }
      } catch (readError) {
        failures.push(`${file.name}: ${readError.message}`);
      }
    }
    setDrafts(next);
    setFiles([]);
    setInputKey((current) => current + 1);
    if (failures.length) setError(failures.join(" "));
    if (next.length) {
      setNotice(`${next.length} comprobante(s) leído(s). Revisá todos los datos antes de incorporarlos.`);
    }
    setOperation("");
  };

  const updateDraft = (localId, patch) => {
    setDrafts((current) => current.map((item) => (
      item.localId === localId ? { ...item, ...patch } : item
    )));
  };

  const incorporate = async () => {
    if (!selectableDrafts.length) {
      setError("Seleccioná al menos un gasto válido para incorporar.");
      return;
    }
    try {
      setOperation("incorporate");
      setError("");
      setNotice("");
      const result = await onIncorporate?.(selectableDrafts);
      const failureCount = Number(result?.failures?.length || 0);
      setDrafts([]);
      setNotice(
        `${Number(result?.createdCount || selectableDrafts.length)} gasto(s) incorporado(s) y ${Number(result?.uploadedCount || 0)} comprobante(s) archivado(s).${failureCount ? ` ${failureCount} archivo(s) deberán adjuntarse manualmente.` : ""}`,
      );
    } catch (saveError) {
      setError(saveError.message || "No pudimos incorporar los gastos revisados.");
    } finally {
      setOperation("");
    }
  };

  if (!AI_ENABLED || !period || period.status !== "draft") return null;

  return (
    <div className="border rounded-3 p-3 mb-4 bg-body-tertiary">
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
        <div>
          <h3 className="h6 mb-1">Carga asistida de comprobantes</h3>
          <p className="small text-muted mb-0">Leé hasta {CONSORTIUM_EXPENSE_AI_MAX_FILES} PDF o imágenes y convertí los datos revisados en gastos del borrador.</p>
        </div>
        <span className="badge text-bg-primary">Asistencia con IA</span>
      </div>

      <div className="alert alert-info small py-2">
        Los archivos seleccionados se envían temporalmente a OpenAI para extraer datos. La IA puede equivocarse: no se registra ningún gasto hasta que lo revises, selecciones y confirmes.
      </div>
      {error && <div className="alert alert-danger small py-2">{error}</div>}
      {notice && <div className="alert alert-success small py-2">{notice}</div>}

      <div className="row g-2 align-items-end">
        <div className="col-lg-9">
          <label className="form-label">Comprobantes</label>
          <input
            key={inputKey}
            className="form-control"
            type="file"
            accept={CONSORTIUM_DOCUMENT_ACCEPT}
            multiple
            disabled={disabled || Boolean(operation)}
            onChange={selectFiles}
          />
          <small className="text-muted">PDF, JPG, PNG o WEBP · hasta 5 MB por archivo.</small>
        </div>
        <div className="col-lg-3">
          <button className="btn btn-outline-primary w-100" disabled={disabled || Boolean(operation) || !files.length} type="button" onClick={analyze}>
            {operation === "analyze" ? "Leyendo..." : `Leer ${files.length || ""} comprobante(s)`}
          </button>
        </div>
      </div>
      {remainingAttempts !== null && <p className="small text-muted mt-2 mb-0">Lecturas asistidas disponibles hoy: {remainingAttempts}.</p>}

      {drafts.length > 0 && (
        <div className="mt-4">
          {drafts.map((draft) => {
            const duplicate = duplicateById.get(draft.localId);
            const confidence = getConsortiumExpenseAiConfidenceMeta(draft.confidence);
            return (
              <article className="card border mb-3" key={draft.localId}>
                <div className="card-body">
                  <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
                    <div className="form-check">
                      <input
                        id={`ai-expense-${draft.localId}`}
                        className="form-check-input"
                        type="checkbox"
                        checked={draft.selected && duplicate?.type !== "exact"}
                        disabled={duplicate?.type === "exact"}
                        onChange={(event) => updateDraft(draft.localId, { selected: event.target.checked })}
                      />
                      <label className="form-check-label fw-semibold" htmlFor={`ai-expense-${draft.localId}`}>{draft.file.name}</label>
                    </div>
                    <span className={`badge ${confidence.className}`}>{confidence.label}</span>
                  </div>
                  {duplicate?.type === "exact" && <div className="alert alert-danger small py-2">Este mismo archivo ya fue incorporado. Se bloqueó para evitar una duplicación.</div>}
                  {duplicate?.type === "possible" && <div className="alert alert-warning small py-2">Posible duplicado: coincide el proveedor y número de comprobante. Podés incorporarlo si verificaste que es otro gasto.</div>}
                  {draft.currency !== (period.currency || "ARS") && <div className="alert alert-warning small py-2">La liquidación está expresada en {period.currency || "ARS"}. Revisá la conversión y el importe antes de seleccionar esa moneda para incorporar el gasto.</div>}
                  {draft.warnings.length > 0 && <div className="alert alert-warning small py-2"><strong>Revisar:</strong> {draft.warnings.join(" · ")}</div>}
                  <div className="row g-3">
                    <div className="col-lg-5"><label className="form-label">Concepto *</label><input className="form-control" value={draft.concept} onChange={(event) => updateDraft(draft.localId, { concept: event.target.value })} /></div>
                    <div className="col-sm-6 col-lg-3"><label className="form-label">Importe *</label><input className="form-control" inputMode="decimal" value={draft.amountMajor} onChange={(event) => updateDraft(draft.localId, { amountMajor: event.target.value, amountMinor: majorToMinor(event.target.value) })} /></div>
                    <div className="col-sm-6 col-lg-2"><label className="form-label">Moneda</label><select className="form-select" value={draft.currency} onChange={(event) => updateDraft(draft.localId, { currency: event.target.value })}><option value="ARS">ARS</option><option value="USD">USD</option></select></div>
                    <div className="col-lg-2"><label className="form-label">Categoría</label><select className="form-select" value={draft.category} onChange={(event) => updateDraft(draft.localId, { category: event.target.value })}>{CONSORTIUM_EXPENSE_CATEGORIES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></div>
                    <div className="col-lg-4"><label className="form-label">Proveedor</label><input className="form-control" value={draft.providerName} onChange={(event) => updateDraft(draft.localId, { providerName: event.target.value })} /></div>
                    <div className="col-sm-6 col-lg-2"><label className="form-label">CUIT</label><input className="form-control" value={draft.providerTaxId} onChange={(event) => updateDraft(draft.localId, { providerTaxId: event.target.value })} /></div>
                    <div className="col-sm-6 col-lg-2"><label className="form-label">Tipo</label><select className="form-select" value={draft.voucherType} onChange={(event) => updateDraft(draft.localId, { voucherType: event.target.value })}>{voucherTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
                    <div className="col-lg-2"><label className="form-label">N.º comprobante</label><input className="form-control" value={draft.voucherNumber} onChange={(event) => updateDraft(draft.localId, { voucherNumber: event.target.value })} /></div>
                    <div className="col-lg-2"><label className="form-label">Fecha</label><input className="form-control" type="date" value={draft.issueDate} onChange={(event) => updateDraft(draft.localId, { issueDate: event.target.value })} /></div>
                    <div className="col-lg-2"><label className="form-label">Vencimiento</label><input className="form-control" type="date" value={draft.dueDate} onChange={(event) => updateDraft(draft.localId, { dueDate: event.target.value })} /></div>
                    <div className="col-lg-3"><label className="form-label">Distribución</label><select className="form-select" value={draft.distributionMode} onChange={(event) => updateDraft(draft.localId, { distributionMode: event.target.value })}>{CONSORTIUM_DISTRIBUTION_MODES.filter((item) => item.id !== "specific").map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></div>
                    {draft.distributionMode === "coefficient" && <div className="col-lg-3"><label className="form-label">Grupo de coeficientes</label><select className="form-select" value={draft.coefficientGroupId} onChange={(event) => updateDraft(draft.localId, { coefficientGroupId: event.target.value, coefficientGroupHint: event.target.value })}>{coefficientGroups.filter((group) => group.active !== false).map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></div>}
                    <div className="col"><label className="form-label">Observaciones internas</label><input className="form-control" value={draft.notes} onChange={(event) => updateDraft(draft.localId, { notes: event.target.value })} /></div>
                  </div>
                </div>
              </article>
            );
          })}
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
            <button className="btn btn-link text-danger px-0" disabled={Boolean(operation)} type="button" onClick={() => setDrafts([])}>Descartar lecturas</button>
            <button className="btn btn-primary" disabled={disabled || Boolean(operation) || !selectableDrafts.length} type="button" onClick={incorporate}>
              {operation === "incorporate" ? "Incorporando..." : `Incorporar ${selectableDrafts.length} gasto(s) revisado(s)`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConsortiumExpenseAiAssistant;

