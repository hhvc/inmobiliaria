import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import SEO from "../../components/SEO";
import { useActiveInmobiliariaModules } from "../../inmobiliaria/hooks/useActiveInmobiliariaModules";
import {
  MAX_TASACION_COMPARABLES,
  addMappedComparable,
  normalizeMapCoordinates,
} from "../../mapa/utils/mapa.helpers";
import {getParcelAtPoint} from "../../mapa/services/parcelas.service";
import {
  TasacionStepFive,
  TasacionStepFour,
  TasacionStepOne,
  TasacionStepThree,
  TasacionStepTwo,
} from "../components/TasacionFormSteps";
import {
  createTasacion,
  getTasacionById,
  transitionTasacionState,
  updateTasacion,
} from "../services/tasacion.service";
import {
  ensureTasacionDraftInmueble,
  getAllInmueblesForTasacion,
  getInmuebleForTasacion,
} from "../services/tasacionInmueble.service";
import { TASACION_STEPS } from "../utils/tasacion.constants";
import { calculateTasacion } from "../utils/tasacion.helpers";
import { applyInmuebleToTasacion } from "../utils/tasacionInmueble.helpers";
import {mergeParcelResultIntoTasacion} from
  "../utils/tasacionParcel.helpers";
import {
  createEmptyComparable,
  createEmptyTasacion,
  normalizeTasacion,
  validateTasacionStep,
} from "../utils/tasacionSchema";
import {
  canEditTasacion,
  validateTasacionForReview,
} from "../utils/tasacionWorkflow.helpers";
import "../tasacion.css";

const setNestedValue = (source, path, value) => {
  const keys = path.split(".");
  const result = { ...source };
  let cursor = result;

  keys.forEach((key, index) => {
    if (index === keys.length - 1) {
      cursor[key] = value;
      return;
    }

    cursor[key] = { ...(cursor[key] || {}) };
    cursor = cursor[key];
  });

  return result;
};

const TasacionFormPage = () => {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { activeInmobiliariaId, activeInmobiliaria, loading: agencyLoading } =
    useActiveInmobiliariaModules();
  const [tasacionId, setTasacionId] = useState(id);
  const [values, setValues] = useState(() => createEmptyTasacion());
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(Boolean(id));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [validationErrors, setValidationErrors] = useState([]);
  const [savedMessage, setSavedMessage] = useState("");
  const [inmuebles, setInmuebles] = useState([]);
  const [loadingInmuebles, setLoadingInmuebles] = useState(false);
  const [importingInmueble, setImportingInmueble] = useState(false);
  const [parcelLoading, setParcelLoading] = useState(false);
  const [parcelError, setParcelError] = useState("");
  const [parcelMessage, setParcelMessage] = useState("");
  const parcelRequestRef = useRef(0);
  const editable = canEditTasacion(values.estado);

  useEffect(() => {
    let mounted = true;

    const loadTasacion = async () => {
      if (!id || !activeInmobiliariaId) {
        if (mounted) setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");
        const item = await getTasacionById(activeInmobiliariaId, id);
        if (!item) throw new Error("No se encontró la tasación solicitada.");
        if (!mounted) return;
        const normalized = normalizeTasacion(item);
        setValues(normalized);
        setStep(Math.min(5, Math.max(1, Number(normalized.currentStep) || 1)));
        setTasacionId(id);
      } catch (loadError) {
        if (mounted) setError(loadError.message || "No se pudo cargar la tasación.");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadTasacion();
    return () => {
      mounted = false;
    };
  }, [activeInmobiliariaId, id]);

  useEffect(() => {
    let mounted = true;

    const loadInmuebles = async () => {
      if (!activeInmobiliariaId) {
        if (mounted) setInmuebles([]);
        return;
      }

      try {
        setLoadingInmuebles(true);
        const items = await getAllInmueblesForTasacion(activeInmobiliariaId);
        if (mounted) setInmuebles(items);
      } catch (loadError) {
        if (mounted) {
          setError(loadError.message || "No se pudo cargar el listado de inmuebles.");
        }
      } finally {
        if (mounted) setLoadingInmuebles(false);
      }
    };

    loadInmuebles();
    return () => {
      mounted = false;
    };
  }, [activeInmobiliariaId]);

  const calculation = useMemo(() => calculateTasacion(values), [values]);

  const queryTasacionParcel = useCallback(async (location) => {
    const coordinates = normalizeMapCoordinates(
      location?.latitude,
      location?.longitude,
    );
    if (!coordinates || !activeInmobiliariaId) return;

    const requestId = parcelRequestRef.current + 1;
    parcelRequestRef.current = requestId;
    try {
      setParcelLoading(true);
      setParcelError("");
      setParcelMessage("");
      const result = await getParcelAtPoint({
        inmobiliariaId: activeInmobiliariaId,
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
      });
      if (parcelRequestRef.current !== requestId) return;
      if (!result?.parcel) {
        setParcelError(
          "No encontramos una parcela en ese punto. Marcá dentro del lote, no sobre la calle.",
        );
        return;
      }
      setValues((current) =>
        mergeParcelResultIntoTasacion({tasacion: current, result}).tasacion,
      );
      setParcelMessage(
        "Datos parcelarios vinculados. Solo se completaron campos que estaban vacíos.",
      );
    } catch (queryError) {
      if (parcelRequestRef.current !== requestId) return;
      setParcelError(queryError.message || "No se pudo consultar la parcela.");
    } finally {
      if (parcelRequestRef.current === requestId) setParcelLoading(false);
    }
  }, [activeInmobiliariaId]);

  const handleTasacionLocationChange = useCallback((location) => {
    setValues((current) => ({
      ...current,
      inspection: {
        ...current.inspection,
        geolocation: {
          latitude: Number(location.latitude).toFixed(6),
          longitude: Number(location.longitude).toFixed(6),
        },
      },
    }));
    setSavedMessage("");
    queryTasacionParcel(location);
  }, [queryTasacionParcel]);

  const setValue = useCallback((path, value) => {
    setValues((current) => setNestedValue(current, path, value));
    setSavedMessage("");
  }, []);

  const setComparableValue = useCallback((index, path, value) => {
    setValues((current) => {
      const comparables = [...current.comparables];
      comparables[index] = setNestedValue(comparables[index], path, value);
      return { ...current, comparables };
    });
    setSavedMessage("");
  }, []);

  const addComparable = useCallback(() => {
    setValues((current) => ({
      ...current,
      comparables:
        current.comparables.length >= MAX_TASACION_COMPARABLES
          ? current.comparables
          : [
              ...current.comparables,
              {
                ...createEmptyComparable(),
                currency:
                  current.scope.currency === "OTRA"
                    ? current.scope.otherCurrency || ""
                    : current.scope.currency,
              },
            ],
    }));
  }, []);

  const removeComparable = useCallback((index) => {
    setValues((current) => ({
      ...current,
      comparables: current.comparables.filter((_, itemIndex) => itemIndex !== index),
    }));
  }, []);

  const addComparableFromMap = useCallback((comparable) => {
    let result = null;
    setValues((current) => {
      result = addMappedComparable(current.comparables, comparable);
      return result.added
        ? { ...current, comparables: result.items }
        : current;
    });
    window.setTimeout(() => {
      setSavedMessage(
        result?.limitReached
          ? "Ya alcanzaste el máximo de 5 antecedentes. Quitá uno para reemplazarlo."
          : result?.duplicate
            ? "Ese antecedente ya forma parte de la tasación."
            : "Antecedente incorporado desde el mapa. Confirmá moneda, vigencia y coeficientes.",
      );
    }, 0);
  }, []);

  const handleSelectInmueble = useCallback(
    async (selection) => {
      setSavedMessage("");
      setValidationErrors([]);

      if (!selection) {
        setValues((current) =>
          normalizeTasacion({
            ...current,
            propertyLink: createEmptyTasacion().propertyLink,
          }),
        );
        return;
      }

      if (selection === "__new__") {
        setValues((current) =>
          normalizeTasacion({
            ...current,
            propertyLink: {
              mode: "new",
              inmuebleId:
                current.propertyLink?.mode === "new"
                  ? current.propertyLink.inmuebleId || ""
                  : "",
              inmuebleTitle:
                current.propertyLink?.mode === "new"
                  ? current.propertyLink.inmuebleTitle || ""
                  : "",
              importedAt:
                current.propertyLink?.mode === "new"
                  ? current.propertyLink.importedAt || ""
                  : "",
              draftCreatedFromTasacion:
                current.propertyLink?.mode === "new" &&
                current.propertyLink.draftCreatedFromTasacion === true,
              syncDraft: true,
            },
          }),
        );
        return;
      }

      if (!activeInmobiliariaId) return;
      try {
        setImportingInmueble(true);
        setError("");
        const inmueble = await getInmuebleForTasacion(
          activeInmobiliariaId,
          selection,
        );
        if (!inmueble) throw new Error("No se encontró el inmueble seleccionado.");
        setValues((current) => applyInmuebleToTasacion(current, inmueble));
        setInmuebles((current) =>
          current.map((item) => (item.id === inmueble.id ? inmueble : item)),
        );
        setSavedMessage(
          "Datos del inmueble importados. Completá o corregí lo necesario para la tasación.",
        );
      } catch (importError) {
        setError(importError.message || "No se pudo importar el inmueble.");
      } finally {
        setImportingInmueble(false);
      }
    },
    [activeInmobiliariaId],
  );

  const persist = useCallback(
    async (nextValues, message = "Borrador guardado.") => {
      if (!activeInmobiliariaId) throw new Error("Seleccioná una inmobiliaria activa.");
      setSaving(true);
      setError("");

      try {
        let savedId = tasacionId;
        if (!savedId) {
          savedId = await createTasacion(activeInmobiliariaId, nextValues);
          setTasacionId(savedId);
          navigate(`/admin/tasaciones/${savedId}/editar`, { replace: true });
        }

        const linkage = await ensureTasacionDraftInmueble({
          inmobiliariaId: activeInmobiliariaId,
          tasacionId: savedId,
          tasacion: nextValues,
          knownInmuebles: inmuebles,
        });
        const linkedValues = normalizeTasacion(linkage.tasacion);

        await updateTasacion(activeInmobiliariaId, savedId, linkedValues);
        setValues(linkedValues);

        if (linkage.inmueble) {
          setInmuebles((current) => {
            const exists = current.some((item) => item.id === linkage.inmueble.id);
            return exists
              ? current.map((item) =>
                  item.id === linkage.inmueble.id ? linkage.inmueble : item,
                )
              : [linkage.inmueble, ...current];
          });
        }

        const linkedMessage = linkage.created
          ? `${message} También se creó el borrador no publicado del inmueble.`
          : linkage.synced
            ? `${message} El borrador del inmueble quedó sincronizado.`
            : message;
        setSavedMessage(linkedMessage);
        return savedId;
      } finally {
        setSaving(false);
      }
    },
    [activeInmobiliariaId, inmuebles, navigate, tasacionId],
  );

  const saveDraft = async () => {
    const nextValues = { ...values, currentStep: step };
    setValues(nextValues);
    try {
      await persist(nextValues);
    } catch (saveError) {
      setError(saveError.message || "No se pudo guardar el borrador.");
    }
  };

  const goToStep = async (nextStep) => {
    if (nextStep > step) {
      const errors = validateTasacionStep(values, step);
      if (errors.length) {
        setValidationErrors(errors);
        return;
      }
    }

    const normalizedStep = Math.min(5, Math.max(1, nextStep));
    const nextValues = { ...values, currentStep: normalizedStep };
    setValidationErrors([]);
    setValues(nextValues);
    setStep(normalizedStep);

    try {
      await persist(nextValues, `Etapa ${step} guardada.`);
    } catch (saveError) {
      setError(saveError.message || "No se pudo guardar el avance.");
    }
  };

  const sendToReview = async () => {
    const errors = validateTasacionForReview(values);
    if (errors.length) {
      setValidationErrors(Array.from(new Set(errors)));
      return;
    }

    const nextValues = { ...values, currentStep: 5 };
    setValues(nextValues);

    try {
      const savedId = await persist(nextValues, "Tasación lista para revisión.");
      await transitionTasacionState({
        inmobiliariaId: activeInmobiliariaId,
        tasacionId: savedId,
        toStatus: "en_revision",
        inmobiliaria: activeInmobiliaria,
      });
      navigate(`/admin/tasaciones/${savedId}/informe`);
    } catch (saveError) {
      setError(saveError.message || "No se pudo enviar a revisión.");
    }
  };

  const stepProps = {
    values,
    setValue,
    calculation,
    addComparable,
    removeComparable,
    setComparableValue,
    onAddMappedComparable: addComparableFromMap,
    inmuebles,
    loadingInmuebles,
    importingInmueble,
    onSelectInmueble: handleSelectInmueble,
    inmobiliariaId: activeInmobiliariaId,
    canAddComparable: values.comparables.length < MAX_TASACION_COMPARABLES,
    onTasacionLocationChange: handleTasacionLocationChange,
    onQueryTasacionParcel: () => queryTasacionParcel(
      values.inspection.geolocation,
    ),
    parcelLoading,
    parcelError,
    parcelMessage,
  };

  if (agencyLoading || loading) {
    return <main className="container py-5 text-center">Cargando tasación...</main>;
  }

  return (
    <main className="container py-4 tasacion-workspace">
      <SEO title={`${tasacionId ? "Editar" : "Nueva"} tasación | ONO Prop`} noIndex />

      <header className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
        <div>
          <p className="text-uppercase text-muted small mb-1">
            Tasaciones · {activeInmobiliaria?.nombre || "Inmobiliaria activa"}
          </p>
          <h1 className="h3 mb-1">{tasacionId ? "Editar tasación" : "Nueva tasación"}</h1>
          <p className="text-muted mb-0">Flujo técnico con trazabilidad de datos, supuestos y resultados.</p>
        </div>
        <div className="d-flex flex-wrap gap-2 no-print">
          <Link className="btn btn-outline-secondary" to="/admin/tasaciones">Listado</Link>
          {tasacionId && (
            <Link className="btn btn-outline-primary" to={`/admin/tasaciones/${tasacionId}/informe`}>
              Vista de informe
            </Link>
          )}
          <button type="button" className="btn btn-primary" disabled={saving || !editable} onClick={saveDraft}>
            {saving ? "Guardando..." : "Guardar borrador"}
          </button>
        </div>
      </header>

      <div className="alert alert-info small">
        El sistema asiste el cálculo y documenta criterios. Un informe profesional o hipotecario
        requiere revisión, identificación y firma del profesional competente, además de la
        aceptación de la entidad destinataria.
      </div>

      <nav className="tasacion-stepper card border-0 shadow-sm mb-4 no-print" aria-label="Etapas de la tasación">
        <div className="card-body d-flex flex-wrap gap-2">
          {TASACION_STEPS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`btn btn-sm ${step === item.id ? "btn-primary" : item.id < step ? "btn-outline-success" : "btn-outline-secondary"}`}
              onClick={() => goToStep(item.id)}
              disabled={saving || !editable}
            >
              {item.id}. {item.label}
            </button>
          ))}
        </div>
      </nav>

      {error && <div className="alert alert-danger">{error}</div>}
      {savedMessage && <div className="alert alert-success py-2">{savedMessage}</div>}
      {validationErrors.length > 0 && (
        <div className="alert alert-warning">
          <strong>Revisá estos datos antes de continuar:</strong>
          <ul className="mb-0 mt-2">
            {validationErrors.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
      )}

      {tasacionId && !editable && (
        <div className="alert alert-info">
          Este expediente está en estado <strong>{values.estado}</strong> y su contenido no se puede
          editar. Usá la vista de informe para revisar el circuito o crear una nueva versión.
        </div>
      )}

      <fieldset disabled={!editable} className="border-0 p-0 m-0">
        {step === 1 && <TasacionStepOne {...stepProps} />}
        {step === 2 && <TasacionStepTwo {...stepProps} />}
        {step === 3 && <TasacionStepThree {...stepProps} />}
        {step === 4 && <TasacionStepFour {...stepProps} />}
        {step === 5 && <TasacionStepFive {...stepProps} />}
      </fieldset>

      <footer className="d-flex flex-wrap justify-content-between gap-2 py-3 no-print">
        <button type="button" className="btn btn-outline-secondary" disabled={step === 1 || saving || !editable} onClick={() => goToStep(step - 1)}>
          Anterior
        </button>
        <div className="d-flex gap-2">
          {!editable ? (
            <Link className="btn btn-primary" to={`/admin/tasaciones/${tasacionId}/informe`}>
              Volver al informe
            </Link>
          ) : step < 5 ? (
            <button type="button" className="btn btn-primary" disabled={saving} onClick={() => goToStep(step + 1)}>
              Guardar y continuar
            </button>
          ) : (
            <button type="button" className="btn btn-success" disabled={saving} onClick={sendToReview}>
              Enviar a revisión y ver informe
            </button>
          )}
        </div>
      </footer>
    </main>
  );
};

export default TasacionFormPage;
