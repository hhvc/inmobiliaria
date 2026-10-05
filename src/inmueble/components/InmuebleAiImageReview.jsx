import {useMemo, useState} from "react";

import {
  recordInmuebleAiDraftOutcome,
  reviewInmuebleAiImages,
} from "../services/inmuebleAi.service";

const AI_PROPERTY_DRAFT_ENABLED = String(
  import.meta.env.VITE_OPENAI_PROPERTY_DRAFT_ENABLED || "",
).toLowerCase() === "true";

const MAX_ANALYZED_IMAGES = 6;

const SCENE_LABELS = {
  exterior: "Exterior",
  living: "Living",
  cocina: "Cocina",
  dormitorio: "Dormitorio",
  bano: "Baño",
  amenity: "Amenity",
  vista: "Vista",
  plano: "Plano",
  otro: "Otro espacio",
};

const QUALITY_LABELS = {
  strong: "Muy buena",
  usable: "Utilizable",
  weak: "Conviene reemplazarla",
};

const QUALITY_TONES = {
  strong: "success",
  usable: "secondary",
  weak: "warning",
};

const getReviewableImages = (images = []) => (Array.isArray(images) ? images : [])
  .filter((image) => {
    const url = image?.thumbnailUrl || image?.url || "";
    return /^https:\/\/[^\s]+$/i.test(url);
  })
  .slice(0, MAX_ANALYZED_IMAGES);

const InmuebleAiImageReview = ({
  property = {},
  images = [],
  inmobiliariaId = "",
  onApplyOrder,
}) => {
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [feedback, setFeedback] = useState("");
  const [feedbackSaving, setFeedbackSaving] = useState(false);

  const reviewableImages = useMemo(
    () => getReviewableImages(images),
    [images],
  );

  if (!AI_PROPERTY_DRAFT_ENABLED || reviewableImages.length < 2) return null;

  const handleReview = async () => {
    if (!consent) {
      setError("Confirmá el envío de las fotos antes de iniciar el análisis.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setMessage("");
      setFeedback("");
      const data = await reviewInmuebleAiImages({
        property,
        images: reviewableImages,
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

  const handleApplyOrder = async () => {
    if (!result?.orderedIndexes?.length || typeof onApplyOrder !== "function") {
      return;
    }

    const orderedUrls = result.orderedIndexes
      .map((index) => reviewableImages[index]?.url)
      .filter(Boolean);
    try {
      setApplying(true);
      setError("");
      await onApplyOrder(orderedUrls);
      setMessage("Orden aplicado. La primera foto quedó como portada.");
      if (result.generationId) {
        await recordInmuebleAiDraftOutcome({
          generationId: result.generationId,
          applied: true,
          appliedFieldCount: orderedUrls.length,
        });
      }
    } catch (applyError) {
      setError(applyError.message || "No se pudo aplicar el orden sugerido.");
    } finally {
      setApplying(false);
    }
  };

  const handleFeedback = async (rating) => {
    if (!result?.generationId || feedbackSaving) return;
    try {
      setFeedbackSaving(true);
      await recordInmuebleAiDraftOutcome({
        generationId: result.generationId,
        rating,
      });
      setFeedback(rating);
      setMessage("Gracias. Tu valoración nos ayuda a mejorar el análisis visual.");
    } catch {
      setMessage("No pudimos guardar la valoración, pero el análisis sigue disponible.");
    } finally {
      setFeedbackSaving(false);
    }
  };

  const photosByIndex = new Map(
    (result?.photos || []).map((photo) => [photo.index, photo]),
  );

  return (
    <section className="border rounded-3 p-3 mt-4 bg-light">
      <div className="d-flex flex-wrap gap-2 align-items-center justify-content-between">
        <div>
          <h4 className="h6 mb-1">Asistente visual con IA</h4>
          <p className="small text-muted mb-0">
            Sugiere portada y orden comercial; nunca altera las fotos.
          </p>
        </div>
        <span className="badge text-bg-light border">
          Hasta {MAX_ANALYZED_IMAGES} fotos · detalle reducido
        </span>
      </div>

      <div className="form-check mt-3">
        <input
          id="ai-image-review-consent"
          className="form-check-input"
          type="checkbox"
          checked={consent}
          disabled={loading}
          onChange={(event) => {
            setConsent(event.target.checked);
            setError("");
          }}
        />
        <label className="form-check-label small" htmlFor="ai-image-review-consent">
          Autorizo enviar temporalmente estas {reviewableImages.length} fotos a
          OpenAI para analizarlas. Verifiqué que no contengan documentación ni
          datos personales que no deban compartirse.
        </label>
      </div>

      <button
        type="button"
        className="btn btn-sm btn-outline-info mt-3"
        disabled={loading || !consent}
        onClick={handleReview}
      >
        {loading ? "Analizando fotos..." : "Analizar portada y orden"}
      </button>

      {images.length > MAX_ANALYZED_IMAGES && (
        <div className="small text-muted mt-2">
          Se analizarán las primeras {MAX_ANALYZED_IMAGES}; las restantes conservarán su orden.
        </div>
      )}
      {error && <div className="alert alert-danger py-2 mt-3 mb-0">{error}</div>}

      {result && (
        <div className="mt-4">
          <div className="d-flex flex-wrap justify-content-between gap-2 mb-3">
            <strong>Orden sugerido</strong>
            {Number.isFinite(result?.quota?.remainingAttempts) && (
              <span className="small text-muted">
                {result.quota.remainingAttempts} análisis visuales disponibles hoy
              </span>
            )}
          </div>

          <div className="row g-3">
            {(result.orderedIndexes || []).map((imageIndex, position) => {
              const image = reviewableImages[imageIndex];
              const photo = photosByIndex.get(imageIndex) || {};
              if (!image) return null;

              return (
                <div className="col-md-6 col-xl-4" key={image.url}>
                  <div className="card h-100 border-0 shadow-sm">
                    <img
                      className="card-img-top"
                      src={image.thumbnailUrl || image.url}
                      alt={`Foto sugerida en posición ${position + 1}`}
                      style={{aspectRatio: "4 / 3", objectFit: "cover"}}
                    />
                    <div className="card-body p-3">
                      <div className="d-flex flex-wrap gap-2 mb-2">
                        <span className="badge text-bg-primary">#{position + 1}</span>
                        {position === 0 && <span className="badge text-bg-success">Portada</span>}
                        {photo.scene && (
                          <span className="badge text-bg-light border">
                            {SCENE_LABELS[photo.scene] || photo.scene}
                          </span>
                        )}
                        {photo.quality && (
                          <span className={`badge text-bg-${QUALITY_TONES[photo.quality] || "secondary"}`}>
                            {QUALITY_LABELS[photo.quality] || photo.quality}
                          </span>
                        )}
                      </div>
                      {photo.suggestedCaption && (
                        <p className="small mb-2">{photo.suggestedCaption}</p>
                      )}
                      {photo.issues?.length > 0 && (
                        <div className="small text-warning-emphasis">
                          <strong>Revisar:</strong> {photo.issues.join(" · ")}
                        </div>
                      )}
                      {photo.privacyRisks?.length > 0 && (
                        <div className="small text-danger mt-1">
                          <strong>Privacidad:</strong> {photo.privacyRisks.join(" · ")}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {result.coverageGaps?.length > 0 && (
            <div className="alert alert-warning py-2 mt-3 mb-0 small">
              <strong>Fotos que convendría agregar:</strong> {result.coverageGaps.join(" · ")}
            </div>
          )}
          {result.generalWarnings?.length > 0 && (
            <div className="alert alert-secondary py-2 mt-3 mb-0 small">
              {result.generalWarnings.join(" · ")}
            </div>
          )}

          <div className="d-flex flex-wrap gap-2 mt-3">
            <button
              type="button"
              className="btn btn-sm btn-success"
              disabled={applying}
              onClick={handleApplyOrder}
            >
              {applying ? "Aplicando..." : "Aplicar orden sugerido"}
            </button>
            <button
              type="button"
              className={feedback === "useful" ? "btn btn-sm btn-primary" : "btn btn-sm btn-outline-primary"}
              disabled={feedbackSaving}
              onClick={() => handleFeedback("useful")}
            >
              Fue útil
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
      )}

      {message && <div className="alert alert-success py-2 mt-3 mb-0">{message}</div>}
    </section>
  );
};

export default InmuebleAiImageReview;
