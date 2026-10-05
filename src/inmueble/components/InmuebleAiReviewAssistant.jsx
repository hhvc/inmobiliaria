import {useMemo, useState} from "react";

import {
  recordInmuebleAiDraftOutcome,
  reviewInmuebleAiPublication,
} from "../services/inmuebleAi.service";

const AI_PROPERTY_DRAFT_ENABLED = String(
  import.meta.env.VITE_OPENAI_PROPERTY_DRAFT_ENABLED || "",
).toLowerCase() === "true";

const READINESS_LABELS = {
  ready: "Lista para una revisión final",
  needs_review: "Conviene revisar algunos datos",
  incomplete: "Faltan datos importantes",
};

const READINESS_TONES = {
  ready: "success",
  needs_review: "warning",
  incomplete: "danger",
};

const SEVERITY_TONES = {
  critical: "danger",
  warning: "warning",
  info: "secondary",
};

const SEVERITY_LABELS = {
  critical: "Importante",
  warning: "Revisar",
  info: "Sugerencia",
};

const SuggestionBox = ({label, value, actionLabel, onAction, onCopy}) => {
  if (!value) return null;

  return (
    <div className="border rounded-3 p-3 bg-white h-100">
      <div className="fw-semibold mb-2">{label}</div>
      <div className="small text-body-secondary" style={{whiteSpace: "pre-wrap"}}>
        {value}
      </div>
      <div className="d-flex flex-wrap gap-2 mt-3">
        {typeof onAction === "function" && (
          <button type="button" className="btn btn-sm btn-primary" onClick={onAction}>
            {actionLabel}
          </button>
        )}
        {typeof onCopy === "function" && (
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onCopy}>
            Copiar texto
          </button>
        )}
      </div>
    </div>
  );
};

const InmuebleAiReviewAssistant = ({
  property = {},
  inmobiliariaId = "",
  onApplySuggestions,
}) => {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [feedback, setFeedback] = useState("");
  const [feedbackSaving, setFeedbackSaving] = useState(false);
  const [appliedCount, setAppliedCount] = useState(0);

  const canReview = useMemo(() => [
    property?.titulo,
    property?.descripcion,
    property?.tipo,
    property?.operacion,
    property?.precio,
  ].filter((value) => value?.toString?.().trim()).length >= 2, [property]);

  if (!AI_PROPERTY_DRAFT_ENABLED) return null;

  const handleReview = async () => {
    try {
      setLoading(true);
      setError("");
      setMessage("");
      setFeedback("");
      setAppliedCount(0);
      const data = await reviewInmuebleAiPublication({
        property,
        inmobiliariaId,
      });
      setResult(data);
    } catch (requestError) {
      setResult(null);
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  const recordApplied = (count) => {
    const nextCount = appliedCount + count;
    setAppliedCount(nextCount);
    if (result?.generationId) {
      recordInmuebleAiDraftOutcome({
        generationId: result.generationId,
        applied: true,
        appliedFieldCount: nextCount,
      }).catch((outcomeError) => {
        console.warn("No se pudo registrar la aplicación de la revisión", outcomeError);
      });
    }
  };

  const applySuggestion = (suggestions, confirmation) => {
    if (typeof onApplySuggestions !== "function") return;
    const count = Object.values(suggestions).filter(Boolean).length;
    if (!count) return;
    onApplySuggestions(suggestions, {
      generationId: result?.generationId || "",
      approvedAt: new Date().toISOString(),
    });
    recordApplied(count);
    setMessage(confirmation);
  };

  const copyText = async (value, confirmation) => {
    try {
      await navigator.clipboard.writeText(value || "");
      setMessage(confirmation);
    } catch {
      setMessage("No pudimos copiar automáticamente. Seleccioná el texto y copialo manualmente.");
    }
  };

  const handleFeedback = async (rating) => {
    if (!result?.generationId || feedbackSaving) return;
    try {
      setFeedbackSaving(true);
      await recordInmuebleAiDraftOutcome({
        generationId: result.generationId,
        applied: appliedCount > 0,
        appliedFieldCount: appliedCount,
        rating,
      });
      setFeedback(rating);
      setMessage("Gracias. Tu valoración nos ayuda a mejorar la asistencia.");
    } catch {
      setMessage("No pudimos guardar la valoración, pero la revisión sigue disponible.");
    } finally {
      setFeedbackSaving(false);
    }
  };

  const review = result?.review;
  const suggestions = result?.suggestions || {};
  const readiness = review?.readiness || "incomplete";

  return (
    <section className="card mb-4 border-info-subtle">
      <div className="card-header bg-info-subtle d-flex flex-wrap gap-2 align-items-center justify-content-between">
        <span className="fw-semibold">Revisión inteligente de la publicación</span>
        <span className="badge text-bg-light border">No publica automáticamente</span>
      </div>
      <div className="card-body">
        <p className="mb-2">
          Revisá faltantes o contradicciones y prepará textos específicos para cada canal.
        </p>
        <p className="small text-muted mb-3">
          La IA no recibe la dirección exacta, coordenadas, contactos, datos del titular,
          instrucciones de visita ni notas internas. Vos decidís qué propuesta aplicar.
        </p>
        <button
          type="button"
          className="btn btn-outline-info"
          disabled={loading || !canReview}
          onClick={handleReview}
        >
          {loading ? "Revisando publicación..." : "Revisar publicación con IA"}
        </button>
        {!canReview && (
          <span className="small text-muted ms-2">
            Completá al menos dos datos principales para habilitar la revisión.
          </span>
        )}

        {error && <div className="alert alert-danger mt-3 mb-0">{error}</div>}

        {review && (
          <div className="mt-4">
            <div className="d-flex flex-wrap align-items-center gap-3 mb-3">
              <div className="display-6 fw-semibold mb-0">{review.score}/100</div>
              <div>
                <span className={`badge text-bg-${READINESS_TONES[readiness] || "secondary"}`}>
                  {READINESS_LABELS[readiness] || "Revisión completada"}
                </span>
                {Number.isFinite(result?.quota?.remainingAttempts) && (
                  <div className="small text-muted mt-1">
                    {result.quota.remainingAttempts} asistencias disponibles hoy
                  </div>
                )}
              </div>
            </div>

            {review.issues?.length > 0 && (
              <div className="mb-3">
                <h3 className="h6">Observaciones</h3>
                <div className="d-grid gap-2">
                  {review.issues.map((issue, index) => (
                    <div className="border rounded p-2 small" key={`${issue.field}-${index}`}>
                      <span className={`badge text-bg-${SEVERITY_TONES[issue.severity] || "secondary"} me-2`}>
                        {SEVERITY_LABELS[issue.severity] || "Dato"}
                      </span>
                      {issue.field && <strong>{issue.field}: </strong>}
                      {issue.message}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {review.missingFields?.length > 0 && (
              <div className="alert alert-warning py-2 small">
                <strong>Conviene completar:</strong> {review.missingFields.join(", ")}.
              </div>
            )}

            {review.contradictions?.length > 0 && (
              <div className="alert alert-danger py-2 small">
                <strong>Posibles contradicciones:</strong>
                <ul className="mb-0 mt-1">
                  {review.contradictions.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
            )}

            <h3 className="h5 mt-4">Textos propuestos</h3>
            <p className="small text-muted">
              Revisalos: la IA puede equivocarse y nunca reemplaza tu criterio profesional.
            </p>
            <div className="row g-3">
              <div className="col-lg-6">
                <SuggestionBox
                  label="Título para ONO Prop"
                  value={suggestions.title}
                  actionLabel="Usar este título"
                  onAction={() => applySuggestion(
                    {title: suggestions.title},
                    "Título aplicado. Revisalo antes de guardar.",
                  )}
                  onCopy={() => copyText(suggestions.title, "Título copiado.")}
                />
              </div>
              <div className="col-lg-6">
                <SuggestionBox
                  label="Descripción para ONO Prop"
                  value={suggestions.portalDescription}
                  actionLabel="Usar esta descripción"
                  onAction={() => applySuggestion(
                    {portalDescription: suggestions.portalDescription},
                    "Descripción aplicada. Revisala antes de guardar.",
                  )}
                  onCopy={() => copyText(
                    suggestions.portalDescription,
                    "Descripción de ONO Prop copiada.",
                  )}
                />
              </div>
              <div className="col-lg-6">
                <SuggestionBox
                  label="Texto para Instagram"
                  value={suggestions.instagramCaption}
                  actionLabel="Guardar para difusión"
                  onAction={() => applySuggestion(
                    {instagramCaption: suggestions.instagramCaption},
                    "Texto de Instagram incorporado al formulario. Guardá el inmueble para conservarlo.",
                  )}
                  onCopy={() => copyText(
                    suggestions.instagramCaption,
                    "Texto para Instagram copiado.",
                  )}
                />
              </div>
              <div className="col-lg-6">
                <SuggestionBox
                  label="Texto para Mercado Libre"
                  value={suggestions.mercadoLibreDescription}
                  actionLabel="Guardar para difusión"
                  onAction={() => applySuggestion(
                    {mercadoLibreDescription: suggestions.mercadoLibreDescription},
                    "Texto de Mercado Libre incorporado al formulario. Guardá el inmueble para conservarlo.",
                  )}
                  onCopy={() => copyText(
                    suggestions.mercadoLibreDescription,
                    "Texto para Mercado Libre copiado.",
                  )}
                />
              </div>
            </div>

            <div className="border-top mt-4 pt-3">
              <div className="small fw-semibold mb-2">¿La revisión te resultó útil?</div>
              <div className="d-flex flex-wrap gap-2">
                <button
                  type="button"
                  className={feedback === "useful" ? "btn btn-sm btn-success" : "btn btn-sm btn-outline-success"}
                  disabled={feedbackSaving}
                  onClick={() => handleFeedback("useful")}
                >
                  Sí, fue útil
                </button>
                <button
                  type="button"
                  className={feedback === "needs_improvement" ? "btn btn-sm btn-warning" : "btn btn-sm btn-outline-warning"}
                  disabled={feedbackSaving}
                  onClick={() => handleFeedback("needs_improvement")}
                >
                  Necesita mejorar
                </button>
              </div>
            </div>
          </div>
        )}

        {message && <div className="alert alert-success mt-3 mb-0">{message}</div>}
      </div>
    </section>
  );
};

export default InmuebleAiReviewAssistant;
