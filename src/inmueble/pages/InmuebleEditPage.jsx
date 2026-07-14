import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import InmuebleForm from "../components/InmuebleForm";
import { getInmuebleById, updateInmueble } from "../services/inmueble.service";

import { useAuth } from "../../context/auth/useAuth";
import { canEditInmueble } from "../helpers/permissions";

/* =========================
   Valores iniciales
   ========================= */

const EMPTY_VALUES = {
  titulo: "",
  descripcion: "",
  tipo: "",
  operacion: "",
  precio: "",
  moneda: "USD",
  expensas: "",

  direccion: {
    calle: "",
    numero: "",
    barrio: "",
    ciudad: "",
  },

  superficie: {
    total: "",
    cubierta: "",
    descubierta: "",
  },

  ambientes: "",
  dormitorios: "",
  banos: "",
  cocheras: "",

  estado: "activo",
  destacado: false,
  publicarEnPortal: false,
  noIndex: false,
  images: [],

  inmobiliariaId: "",
  ownerInmobiliariaId: "",
  ownerId: "",

  sharedWith: {},
  deleted: false,
};

const InmuebleEditPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const { user, activeInmobiliariaId } = useAuth();

  const [inmueble, setInmueble] = useState(null);
  const [values, setValues] = useState(EMPTY_VALUES);
  const [errors, setErrors] = useState({});

  const [initialLoading, setInitialLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  /* =========================
     Cargar inmueble
     ========================= */

  useEffect(() => {
    const fetchInmueble = async () => {
      try {
        setInitialLoading(true);
        setError(null);

        if (!id) {
          throw new Error("ID de inmueble no recibido");
        }

        if (!user?.uid) {
          throw new Error("No se pudo determinar el usuario");
        }

        if (!activeInmobiliariaId) {
          throw new Error("No hay inmobiliaria activa seleccionada");
        }

        const data = await getInmuebleById(activeInmobiliariaId, id);

        if (!data) {
          throw new Error("El inmueble no existe");
        }

        if (!canEditInmueble(user, data)) {
          throw new Error("No tenés permisos para editar este inmueble");
        }

        const resolvedInmobiliariaId =
          data.inmobiliariaId ||
          data.ownerInmobiliariaId ||
          activeInmobiliariaId;

        const formattedValues = {
          ...EMPTY_VALUES,
          ...data,

          direccion: {
            ...EMPTY_VALUES.direccion,
            ...(data.direccion || {}),
          },

          superficie: {
            ...EMPTY_VALUES.superficie,
            ...(data.superficie || {}),
          },

          images: Array.isArray(data.images) ? data.images : [],

          inmobiliariaId: resolvedInmobiliariaId,
          ownerInmobiliariaId:
            data.ownerInmobiliariaId || resolvedInmobiliariaId,

          ownerId: data.ownerId || "",

          sharedWith:
            data.sharedWith && typeof data.sharedWith === "object"
              ? data.sharedWith
              : {},

          deleted: data.deleted ?? false,

          estado: data.estado || "activo",
          destacado: Boolean(data.destacado),
          publicarEnPortal: Boolean(data.publicarEnPortal),
          noIndex: Boolean(data.noIndex),
        };

        setInmueble({
          ...data,
          inmobiliariaId: resolvedInmobiliariaId,
          ownerInmobiliariaId:
            data.ownerInmobiliariaId || resolvedInmobiliariaId,
          destacado: Boolean(data.destacado),
          publicarEnPortal: Boolean(data.publicarEnPortal),
          noIndex: Boolean(data.noIndex),
        });

        setValues(formattedValues);
      } catch (err) {
        console.error("Error cargando inmueble:", err);

        if (err.code === "permission-denied") {
          setError("Acceso denegado");
        } else {
          setError(err.message || "Error al cargar el inmueble");
        }
      } finally {
        setInitialLoading(false);
      }
    };

    fetchInmueble();
  }, [id, user, activeInmobiliariaId]);

  /* =========================
     Handlers de formulario
     ========================= */

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    if (!name) return;

    // En edición NO movemos documentos entre subcolecciones.
    // Para cambiar de inmobiliaria habría que crear una operación específica.
    if (name === "inmobiliariaId") return;

    setValues((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));

    if (errors[name]) {
      setErrors((prev) => {
        const nextErrors = { ...prev };
        delete nextErrors[name];
        return nextErrors;
      });
    }
  };

  const handleNestedChange = (group, field, value) => {
    if (!group) return;

    if (!field) {
      setValues((prev) => ({
        ...prev,
        [group]: value,
      }));
      return;
    }

    setValues((prev) => ({
      ...prev,
      [group]: {
        ...(prev[group] || {}),
        [field]: value,
      },
    }));

    const errorKey = field ? `${group}.${field}` : group;

    if (errors[errorKey]) {
      setErrors((prev) => {
        const nextErrors = { ...prev };
        delete nextErrors[errorKey];
        return nextErrors;
      });
    }
  };

  /* =========================
     Validación mínima
     ========================= */

  const validate = (formValues) => {
    const nextErrors = {};

    if (!formValues.titulo?.trim()) {
      nextErrors.titulo = "El título es obligatorio";
    }

    if (!formValues.tipo?.trim()) {
      nextErrors.tipo = "El tipo es obligatorio";
    }

    if (!formValues.operacion?.trim()) {
      nextErrors.operacion = "La operación es obligatoria";
    }

    if (!formValues.direccion?.ciudad?.trim()) {
      nextErrors.ciudad = "La ciudad es obligatoria";
    }

    if (formValues.operacion !== "tasacion" && !formValues.precio) {
      nextErrors.precio = "El precio es obligatorio";
    }

    if (!formValues.estado?.trim()) {
      nextErrors.estado = "El estado es obligatorio";
    }

    return nextErrors;
  };

  /* =========================
     Guardar cambios
     ========================= */

  const handleUpdate = async (formValues) => {
    try {
      setSaving(true);
      setError(null);

      if (!id) {
        throw new Error("ID de inmueble no recibido");
      }

      if (!user?.uid) {
        throw new Error("No se pudo determinar el usuario");
      }

      if (!inmueble) {
        throw new Error("No hay inmueble cargado");
      }

      const currentInmobiliariaId =
        inmueble.inmobiliariaId ||
        inmueble.ownerInmobiliariaId ||
        activeInmobiliariaId;

      if (!currentInmobiliariaId) {
        throw new Error("No se pudo determinar la inmobiliaria del inmueble");
      }

      if (!canEditInmueble(user, inmueble)) {
        throw new Error("No tenés permisos para editar este inmueble");
      }

      const validationErrors = validate(formValues);
      setErrors(validationErrors);

      if (Object.keys(validationErrors).length > 0) {
        return;
      }

      const updatedInmueble = {
        ...formValues,

        // 🔒 Campos de dominio que no deben cambiar desde este formulario
        ownerId: inmueble.ownerId,
        createdBy: inmueble.createdBy || formValues.createdBy || null,

        inmobiliariaId: currentInmobiliariaId,
        ownerInmobiliariaId:
          inmueble.ownerInmobiliariaId || currentInmobiliariaId,

        images: Array.isArray(formValues.images) ? formValues.images : [],

        sharedWith:
          inmueble.sharedWith && typeof inmueble.sharedWith === "object"
            ? inmueble.sharedWith
            : {},

        deleted: inmueble.deleted ?? false,

        // Publicación
        estado: formValues.estado || "activo",
        destacado: Boolean(formValues?.destacado),
        publicarEnPortal: Boolean(formValues?.publicarEnPortal),
        noIndex: Boolean(formValues?.noIndex),
      };

      await updateInmueble(currentInmobiliariaId, id, updatedInmueble);

      console.log("✅ Inmueble actualizado:", id);

      navigate("/admin/inmuebles/listado");
    } catch (err) {
      console.error("Error actualizando inmueble:", err);

      if (err.code === "permission-denied") {
        setError("No tenés permisos para realizar esta acción");
      } else {
        setError(err.message || "Ocurrió un error al guardar los cambios");
      }
    } finally {
      setSaving(false);
    }
  };

  /* =========================
     Estados visuales
     ========================= */

  if (initialLoading) {
    return <p className="text-muted">Cargando inmueble...</p>;
  }

  if (error) {
    return (
      <section className="container py-4">
        <div className="alert alert-danger">{error}</div>

        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => navigate("/admin/inmuebles/listado")}
        >
          Volver al listado
        </button>
      </section>
    );
  }

  if (!inmueble) {
    return null;
  }

  /* =========================
     Render
     ========================= */

  return (
    <section className="container py-4">
      <header className="mb-4 d-flex justify-content-between align-items-center">
        <div>
          <h1 className="h3 mb-1">Editar inmueble</h1>
          <p className="text-muted mb-0">
            Modificá la información básica del inmueble
          </p>
        </div>

        <button
          type="button"
          className="btn btn-outline-secondary"
          onClick={() => navigate("/admin/inmuebles/listado")}
        >
          Volver
        </button>
      </header>

      <InmuebleForm
        key={inmueble.id || id}
        values={values}
        errors={errors}
        loading={saving}
        initialLoading={false}
        isEditMode={true}
        handleChange={handleChange}
        handleNestedChange={handleNestedChange}
        handleSubmit={handleUpdate}
        inmuebleId={id}
        inmobiliariaId={values.inmobiliariaId}
      />
    </section>
  );
};

export default InmuebleEditPage;