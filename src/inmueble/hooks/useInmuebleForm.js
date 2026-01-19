import { useEffect, useState } from "react";
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

/**
 * Hook principal para crear / editar Inmuebles
 */
export const useInmuebleForm = ({
  inmobiliariaId,
  inmuebleId = null,
  onSuccess,
}) => {
  const isEditMode = Boolean(inmuebleId);

  const [values, setValues] = useState(inmuebleInitialValues);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(isEditMode);

  /* =========================================================
     Cargar inmueble en modo edición
     ========================================================= */

  useEffect(() => {
    if (!isEditMode) return;
    if (!inmobiliariaId || !inmuebleId) return;

    const fetchInmueble = async () => {
      try {
        const inmueble = await getInmuebleById(inmobiliariaId, inmuebleId);

        if (inmueble) {
          setValues({
            ...inmuebleInitialValues,
            ...inmueble,
          });
        }
      } catch (error) {
        console.error("Error cargando inmueble:", error);
      } finally {
        setInitialLoading(false);
      }
    };

    fetchInmueble();
  }, [inmobiliariaId, inmuebleId, isEditMode]);

  /* =========================================================
     Handlers
     ========================================================= */

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    setValues((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleNestedChange = (group, field, value) => {
    setValues((prev) => ({
      ...prev,
      [group]: {
        ...prev[group],
        [field]: value,
      },
    }));
  };

  const setFieldValue = (field, value) => {
    setValues((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  /* =========================================================
     Submit
     ========================================================= */

  const handleSubmit = async () => {
    const validationErrors = validateInmueble(values);
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      return false;
    }

    setLoading(true);

    try {
      const normalizedData = normalizeInmuebleData(values);

      if (isEditMode) {
        await updateInmueble(inmobiliariaId, inmuebleId, normalizedData);
      } else {
        await createInmueble(inmobiliariaId, normalizedData);
      }

      if (onSuccess) onSuccess();
      return true;
    } catch (error) {
      console.error("Error guardando inmueble:", error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  /* =========================================================
     Helpers
     ========================================================= */

  const resetForm = () => {
    setValues(inmuebleInitialValues);
    setErrors({});
  };

  return {
    // Estado
    values,
    errors,
    loading,
    initialLoading,
    isEditMode,

    // Acciones
    handleChange,
    handleNestedChange,
    setFieldValue,
    handleSubmit,
    resetForm,
    setValues,
    setErrors,
  };
};
