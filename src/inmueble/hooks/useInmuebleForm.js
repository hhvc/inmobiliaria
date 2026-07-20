import { useEffect, useMemo, useState } from "react";
import {
  inmuebleInitialValues,
  normalizeInmuebleData,
  validateInmueble,
} from "../utils/inmuebleSchema";

import {
  createInmueble,
  getInmuebleById,
  updateInmueble,
} from "../services/inmueble.service";

const buildInitialValues = ({ inmobiliariaId, initialValues }) => ({
  ...inmuebleInitialValues,
  ...(initialValues || {}),
  inmobiliariaId:
    initialValues?.inmobiliariaId ||
    inmobiliariaId ||
    inmuebleInitialValues.inmobiliariaId ||
    "",
});

const getCreatedInmuebleId = (result) => {
  if (!result) return "";

  if (typeof result === "string") return result;

  return result.id || result.inmuebleId || result.docId || "";
};

/**
 * Hook principal para crear / editar inmuebles.
 *
 * Soporta:
 * - creación normal
 * - edición normal
 * - precarga desde fuentes externas, por ejemplo solicitudes particulares
 * - callbacks con datos del inmueble creado/editado
 */
export const useInmuebleForm = ({
  inmobiliariaId,
  inmuebleId = null,
  initialValues = null,
  createOptions = null,
  updateOptions = null,
  onSuccess,
  onError,
} = {}) => {
  const isEditMode = Boolean(inmuebleId);

  const initialFormValues = useMemo(() => {
    return buildInitialValues({
      inmobiliariaId,
      initialValues,
    });
  }, [inmobiliariaId, initialValues]);

  const [values, setValues] = useState(initialFormValues);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState("");
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(isEditMode);

  /* =========================================================
     Asegurar inmobiliariaId en values
     ========================================================= */

  useEffect(() => {
    if (!inmobiliariaId) return;

    setValues((prev) => {
      if (prev.inmobiliariaId === inmobiliariaId) {
        return prev;
      }

      return {
        ...prev,
        inmobiliariaId,
      };
    });
  }, [inmobiliariaId]);

  /* =========================================================
     Aplicar valores iniciales externos en modo creación
     ========================================================= */

  useEffect(() => {
    if (isEditMode) return;
    if (!initialValues) return;

    setValues((prev) => ({
      ...prev,
      ...initialValues,
      inmobiliariaId:
        initialValues.inmobiliariaId || prev.inmobiliariaId || inmobiliariaId,
    }));

    setErrors({});
    setSubmitError("");
  }, [initialValues, inmobiliariaId, isEditMode]);

  /* =========================================================
     Cargar inmueble en modo edición
     ========================================================= */

  useEffect(() => {
    if (!isEditMode) return;
    if (!inmobiliariaId || !inmuebleId) return;

    let isMounted = true;

    const fetchInmueble = async () => {
      try {
        setInitialLoading(true);

        const inmueble = await getInmuebleById(inmobiliariaId, inmuebleId);

        if (isMounted && inmueble) {
          setValues({
            ...inmuebleInitialValues,
            ...inmueble,
            inmobiliariaId,
          });
        }
      } catch (error) {
        console.error("Error cargando inmueble:", error);

        if (isMounted) {
          setSubmitError("No se pudo cargar el inmueble.");
          if (onError) onError(error);
        }
      } finally {
        if (isMounted) {
          setInitialLoading(false);
        }
      }
    };

    fetchInmueble();

    return () => {
      isMounted = false;
    };
  }, [inmobiliariaId, inmuebleId, isEditMode, onError]);

  /* =========================================================
     Handlers
     ========================================================= */

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    setValues((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));

    setErrors((prev) => ({
      ...prev,
      [name]: undefined,
    }));

    setSubmitError("");
  };

  const handleNestedChange = (group, field, value) => {
    setValues((prev) => ({
      ...prev,
      [group]: {
        ...(prev[group] || {}),
        [field]: value,
      },
    }));

    setErrors((prev) => ({
      ...prev,
      [group]: undefined,
    }));

    setSubmitError("");
  };

  const setFieldValue = (field, value) => {
    setValues((prev) => ({
      ...prev,
      [field]: value,
    }));

    setErrors((prev) => ({
      ...prev,
      [field]: undefined,
    }));

    setSubmitError("");
  };

  const setFieldsValue = (nextValues = {}) => {
    setValues((prev) => ({
      ...prev,
      ...nextValues,
    }));

    setSubmitError("");
  };

  const applyPrefillValues = (nextValues = {}) => {
    setValues((prev) => ({
      ...prev,
      ...nextValues,
      inmobiliariaId: nextValues.inmobiliariaId || prev.inmobiliariaId,
    }));

    setErrors({});
    setSubmitError("");
  };

  /* =========================================================
     Submit
     ========================================================= */

  const handleSubmit = async () => {
    setSubmitError("");

    const validationErrors = validateInmueble(values);
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      setSubmitError("Revisá los campos obligatorios antes de guardar.");
      return false;
    }

    if (!inmobiliariaId && !values.inmobiliariaId) {
      setSubmitError("No hay inmobiliaria activa para guardar el inmueble.");
      return false;
    }

    setLoading(true);

    try {
      const normalizedData = normalizeInmuebleData({
        ...values,
        inmobiliariaId: values.inmobiliariaId || inmobiliariaId,
      });

      let result = null;
      let createdInmuebleId = inmuebleId || "";

      if (isEditMode) {
        result = await updateInmueble(
          inmobiliariaId,
          inmuebleId,
          normalizedData,
          updateOptions || undefined,
        );
      } else {
        result = await createInmueble(
          inmobiliariaId || values.inmobiliariaId,
          normalizedData,
          createOptions || undefined,
        );

        createdInmuebleId = getCreatedInmuebleId(result);
      }

      if (onSuccess) {
        onSuccess({
          mode: isEditMode ? "edit" : "create",
          inmobiliariaId: inmobiliariaId || values.inmobiliariaId,
          inmuebleId: createdInmuebleId,
          result,
          data: normalizedData,
        });
      }

      return true;
    } catch (error) {
      console.error("Error guardando inmueble:", error);

      const message = error.message || "No se pudo guardar el inmueble.";
      setSubmitError(message);

      if (onError) onError(error);

      return false;
    } finally {
      setLoading(false);
    }
  };

  /* =========================================================
     Helpers
     ========================================================= */

  const resetForm = () => {
    setValues(
      buildInitialValues({
        inmobiliariaId,
        initialValues: null,
      }),
    );
    setErrors({});
    setSubmitError("");
  };

  return {
    // Estado
    values,
    errors,
    submitError,
    loading,
    initialLoading,
    isEditMode,

    // Acciones
    handleChange,
    handleNestedChange,
    setFieldValue,
    setFieldsValue,
    applyPrefillValues,
    handleSubmit,
    resetForm,
    setValues,
    setErrors,
    setSubmitError,
  };
};