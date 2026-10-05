import {useMemo, useState} from "react";

import {
  prepareInmuebleAiDraft,
  recordInmuebleAiDraftOutcome,
} from "../services/inmuebleAi.service";
import {
  getDefaultSelectedAiDraftFieldPaths,
  getAiDraftFieldLabel,
  getAiDraftFieldValue,
} from "../utils/inmuebleAiDraft.helpers";

const MIN_DESCRIPTION_LENGTH = 20;
const MAX_DESCRIPTION_LENGTH = 6000;
const AI_PROPERTY_DRAFT_ENABLED = String(
  import.meta.env.VITE_OPENAI_PROPERTY_DRAFT_ENABLED || "",
).toLowerCase() === "true";

const CONFIDENCE_LABELS = {
  high: "Alta confianza",
  medium: "Confianza media",
  low: "Requiere confirmación",
};

const CONFIDENCE_BADGES = {
  high: "text-bg-success",
  medium: "text-bg-primary",
  low: "text-bg-warning",
};

const formatDetectedValue = (value) => {
  if (typeof value === "boolean") return value ? "Sí" : "No";
  return value?.toString?.() || "";
};

const InmuebleAiAssistant = ({
  inmobiliariaId = "",
  onApplyDraft,
  previewFieldPaths = null,
  scrollTargetId = "inmueble-basic-info",
}) => {
  const [sourceText, setSourceText] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [preserveExisting, setPreserveExisting] = useState(true);
  const [appliedMessage, setAppliedMessage] = useState("");
  const [applicationSummary, setApplicationSummary] = useState(null);
  const [feedback, setFeedback] = useState("");
  const [feedbackSaving, setFeedbackSaving] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [selectedFieldPaths, setSelectedFieldPaths] = useState([]);

  const detectedItems = useMemo(() => {
    const visiblePaths = Array.isArray(previewFieldPaths)
      ? new Set(previewFieldPaths)
      : null;

    const assessmentByPath = new Map(
      (result?.fieldAssessments || []).map((item) => [item.path, item]),
    );

    return (result?.detectedFields || [])
      .filter((path) => !visiblePaths || visiblePaths.has(path))
      .map((path) => {
        const assessment = assessmentByPath.get(path) || {};
        return {
          path,
          label: getAiDraftFieldLabel(path),
          value: formatDetectedValue(getAiDraftFieldValue(result?.draft, path)),
          confidence: assessment.confidence || "medium",
          evidence: assessment.evidence || "",
        };
      })
      .filter((item) => item.value !== "");
  }, [previewFieldPaths, result]);

  const selectedFieldSet = useMemo(
    () => new Set(selectedFieldPaths),
    [selectedFieldPaths],
  );

  if (!AI_PROPERTY_DRAFT_ENABLED) return null;

  const handlePrepare = async () => {
    const normalizedText = sourceText.trim();
    if (normalizedText.length < MIN_DESCRIPTION_LENGTH) {
      setError("Contanos un poco más sobre el inmueble.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setAppliedMessage("");
      setApplicationSummary(null);
      setFeedback("");
      setFeedbackMessage("");
      const data = await prepareInmuebleAiDraft({
        sourceText: normalizedText,
        inmobiliariaId,
      });
      setResult(data);
      const defaultPaths = getDefaultSelectedAiDraftFieldPaths(data);
      const visiblePaths = Array.isArray(previewFieldPaths)
        ? new Set(previewFieldPaths)
        : null;
      setSelectedFieldPaths(
        defaultPaths.filter((path) => !visiblePaths || visiblePaths.has(path)),
      );
    } catch (requestError) {
      setResult(null);
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (!result?.draft || typeof onApplyDraft !== "function") return;
    if (selectedFieldPaths.length === 0) {
      setError("Seleccioná al menos un dato para aplicar al formulario.");
      return;
    }
    const summary = onApplyDraft({
      draft: result.draft,
      detectedFields: selectedFieldPaths,
      preserveExisting,
    });
    const appliedCount = Number(summary?.appliedCount || 0);
    const preservedCount = Number(summary?.preservedCount || 0);
    const preservedText = preservedCount > 0
      ? ` Se conservaron ${preservedCount} datos que ya habías cargado.`
      : "";

    setAppliedMessage(
      `Aplicamos ${appliedCount} datos al formulario.${preservedText} Revisalos antes de guardar.`,
    );
    setApplicationSummary({appliedCount, preservedCount});

    if (result.generationId) {
      recordInmuebleAiDraftOutcome({
        generationId: result.generationId,
        applied: true,
        appliedFieldCount: appliedCount,
        preservedFieldCount: preservedCount,
      }).catch((outcomeError) => {
        console.warn("No se pudo registrar la aplicación del borrador", outcomeError);
      });
    }

    window.setTimeout(() => {
      document.getElementById(scrollTargetId)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 80);
  };

  const handleFieldSelection = (path, checked) => {
    setSelectedFieldPaths((current) => checked
      ? Array.from(new Set([...current, path]))
      : current.filter((item) => item !== path));
    setError("");
  };

  const selectRecommendedFields = () => {
    setSelectedFieldPaths(
      detectedItems
        .filter((item) => item.confidence !== "low")
        .map((item) => item.path),
    );
  };

  const handleFeedback = async (rating) => {
    if (!result?.generationId || feedbackSaving) return;

    try {
      setFeedbackSaving(true);
      setFeedbackMessage("");
      await recordInmuebleAiDraftOutcome({
        generationId: result.generationId,
        applied: Boolean(applicationSummary),
        appliedFieldCount: applicationSummary?.appliedCount || 0,
        preservedFieldCount: applicationSummary?.preservedCount || 0,
        rating,
      });
      setFeedback(rating);
      setFeedbackMessage("Gracias. Tu respuesta nos ayuda a mejorar la carga asistida.");
    } catch {
      setFeedbackMessage("No pudimos guardar la valoración. El borrador sigue disponible.");
    } finally {
      setFeedbackSaving(false);
    }
  };

  return (
    <div className="card mb-4 border-primary-subtle">
      <div className="card-header bg-primary-subtle d-flex flex-wrap gap-2 align-items-center justify-content-between">
        <span className="fw-semibold">Carga asistida con IA</span>
        <span className="badge text-bg-light border">Prepara un borrador</span>
      </div>
      <div className="card-body">
        <p className="mb-2">
          Contanos el inmueble como se lo contarías a un cliente o pegá un aviso
          anterior. La IA completará solamente los datos que pueda identificar.
        </p>
        <p className="small text-muted mb-3">
          No incluyas DNI, CUIT, teléfonos, emails ni datos privados del titular.
          Nada se guarda ni se publica hasta que revises y envíes el formulario.
        </p>

        <label className="form-label" htmlFor="inmuebleAiSourceText">
          Descripción del inmueble
        </label>
        <textarea
          id="inmuebleAiSourceText"
          className="form-control"
          rows={5}
          maxLength={MAX_DESCRIPTION_LENGTH}
          value={sourceText}
          disabled={loading}
          placeholder="Ej.: Casa en venta en Argüello, Córdoba. Tiene 3 dormitorios, 2 baños, pileta, 180 m² cubiertos sobre terreno de 600 m². Precio USD 185.000..."
          onChange={(event) => {
            setSourceText(event.target.value);
            setResult(null);
            setSelectedFieldPaths([]);
            setError("");
            setAppliedMessage("");
            setApplicationSummary(null);
            setFeedback("");
            setFeedbackMessage("");
          }}
        />
        <div className="d-flex flex-wrap justify-content-between gap-2 mt-2">
          <span className="form-text mt-0">
            {sourceText.length.toLocaleString("es-AR")} de {MAX_DESCRIPTION_LENGTH.toLocaleString("es-AR")} caracteres
          </span>
          <button
            type="button"
            className="btn btn-primary"
            disabled={loading || sourceText.trim().length < MIN_DESCRIPTION_LENGTH}
            onClick={handlePrepare}
          >
            {loading ? "Preparando borrador..." : "Preparar borrador con IA"}
          </button>
        </div>

        {error && <div className="alert alert-danger mt-3 mb-0">{error}</div>}

        {result?.draft && (
          <div className="border rounded-3 p-3 mt-3 bg-light">
            <div className="d-flex flex-wrap gap-2 align-items-center justify-content-between mb-3">
              <div>
                <div className="fw-semibold">
                  Borrador listo: {detectedItems.length} datos identificados
                </div>
                <div className="small text-muted">
                  Elegí cuáles querés aplicar. Los datos dudosos quedan desmarcados.
                </div>
              </div>
              {Number.isFinite(result?.quota?.remainingAttempts) && (
                <span className="badge text-bg-secondary">
                  {result.quota.remainingAttempts} usos disponibles hoy
                </span>
              )}
            </div>

            <div className="d-flex flex-wrap gap-2 mb-3">
              <button
                type="button"
                className="btn btn-sm btn-outline-primary"
                onClick={selectRecommendedFields}
              >
                Seleccionar recomendados
              </button>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={() => setSelectedFieldPaths(
                  detectedItems.map((item) => item.path),
                )}
              >
                Seleccionar todos
              </button>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={() => setSelectedFieldPaths([])}
              >
                Quitar selección
              </button>
            </div>

            <div className="row g-2 mb-3">
              {detectedItems.map((item) => (
                <div className="col-md-6" key={item.path}>
                  <div className={`bg-white border rounded p-2 h-100 small ${
                    selectedFieldSet.has(item.path) ? "border-primary" : ""
                  }`}>
                    <div className="form-check">
                      <input
                        id={`ai-field-${item.path.replaceAll(".", "-")}`}
                        className="form-check-input"
                        type="checkbox"
                        checked={selectedFieldSet.has(item.path)}
                        onChange={(event) => handleFieldSelection(
                          item.path,
                          event.target.checked,
                        )}
                      />
                      <label
                        className="form-check-label w-100"
                        htmlFor={`ai-field-${item.path.replaceAll(".", "-")}`}
                      >
                        <span className="text-muted">{item.label}: </span>
                        <strong>{item.value}</strong>
                      </label>
                    </div>
                    <div className="d-flex flex-wrap gap-2 align-items-center mt-2 ms-4">
                      <span className={`badge ${
                        CONFIDENCE_BADGES[item.confidence] || "text-bg-secondary"
                      }`}>
                        {CONFIDENCE_LABELS[item.confidence] || "Revisar"}
                      </span>
                      {item.evidence && (
                        <span className="text-muted">
                          Detectado de: “{item.evidence}”
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {result.warnings?.length > 0 && (
              <div className="alert alert-warning py-2 small">
                <strong>Revisá:</strong>
                <ul className="mb-0 mt-1">
                  {result.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}

            {result.missingFields?.length > 0 && (
              <div className="small mb-3">
                <strong>Conviene completar también:</strong>{" "}
                {result.missingFields.join(", ")}.
              </div>
            )}

            <div className="form-check mb-3">
              <input
                id="preserveAiExistingValues"
                className="form-check-input"
                type="checkbox"
                checked={preserveExisting}
                onChange={(event) => setPreserveExisting(event.target.checked)}
              />
              <label
                className="form-check-label"
                htmlFor="preserveAiExistingValues"
              >
                Conservar los datos que ya cargué en el formulario
              </label>
            </div>

            <button
              type="button"
              className="btn btn-success"
              disabled={selectedFieldPaths.length === 0}
              onClick={handleApply}
            >
              Aplicar {selectedFieldPaths.length} datos al formulario
            </button>

            <div className="border-top mt-3 pt-3">
              <div className="small fw-semibold mb-2">
                ¿El borrador te resultó útil?
              </div>
              <div className="d-flex flex-wrap gap-2">
                <button
                  type="button"
                  className={feedback === "useful"
                    ? "btn btn-sm btn-success"
                    : "btn btn-sm btn-outline-success"}
                  disabled={feedbackSaving}
                  onClick={() => handleFeedback("useful")}
                >
                  Sí, fue útil
                </button>
                <button
                  type="button"
                  className={feedback === "needs_improvement"
                    ? "btn btn-sm btn-warning"
                    : "btn btn-sm btn-outline-warning"}
                  disabled={feedbackSaving}
                  onClick={() => handleFeedback("needs_improvement")}
                >
                  Necesita mejorar
                </button>
              </div>
              {feedbackMessage && (
                <div className="small text-muted mt-2">{feedbackMessage}</div>
              )}
            </div>
          </div>
        )}

        {appliedMessage && (
          <div className="alert alert-success mt-3 mb-0">{appliedMessage}</div>
        )}
      </div>
    </div>
  );
};

export default InmuebleAiAssistant;

