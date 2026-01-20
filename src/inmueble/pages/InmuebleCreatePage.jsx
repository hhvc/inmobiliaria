import { useState } from "react";
import { useNavigate } from "react-router-dom";

import InmuebleForm from "../components/InmuebleForm";
import { useAuth } from "../../context/auth/useAuth";
import { createInmueble } from "../services/inmueble.service";
import { canCreateInmueble } from "../helpers/permissions";

/* =========================
   Valores iniciales
   ========================= */

const INITIAL_VALUES = {
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

  destacado: false,

  // 🔑 CLAVE para evitar el crash
  images: [],
};

const InmuebleCreatePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [values, setValues] = useState(INITIAL_VALUES);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /* =========================
     Handlers de formulario
     ========================= */

  const handleChange = (e) => {
    const { name, value } = e.target;
    setValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleNestedChange = (group, field, value) => {
    if (!group) {
      setValues((prev) => ({ ...prev, [field]: value }));
      return;
    }

    setValues((prev) => ({
      ...prev,
      [group]: {
        ...prev[group],
        [field]: value,
      },
    }));
  };

  /* =========================
     Crear inmueble
     ========================= */

  const handleCreate = async (formValues) => {
    try {
      setLoading(true);
      setError(null);

      if (!user?.uid || !user?.inmobiliariaId) {
        throw new Error("No se pudo determinar el usuario o la inmobiliaria");
      }

      // 🔐 Permiso frontend (UX)
      if (!canCreateInmueble(user, user.inmobiliariaId)) {
        throw new Error("No tenés permisos para crear inmuebles");
      }

      const inmuebleData = {
        ...formValues,

        ownerId: user.uid,
        inmobiliariaId: user.inmobiliariaId,

        estado: "activo",

        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await createInmueble(inmuebleData);

      navigate("/inmuebles");
    } catch (err) {
      console.error("Error creando inmueble:", err);

      if (err.code === "permission-denied") {
        setError("No tenés permisos para realizar esta acción");
      } else {
        setError(err.message || "Ocurrió un error al crear el inmueble");
      }
    } finally {
      setLoading(false);
    }
  };

  /* =========================
     Render
     ========================= */

  return (
    <section className="page-container">
      <header className="page-header">
        <h1>Nuevo inmueble</h1>
        <p>Cargá la información básica para publicar el inmueble</p>
      </header>

      {error && <div className="error-box">{error}</div>}

      <InmuebleForm
        values={values}
        errors={{}}
        loading={loading}
        initialLoading={false}
        isEditMode={false}
        handleChange={handleChange}
        handleNestedChange={handleNestedChange}
        handleSubmit={handleCreate}
        inmuebleId={null}
        inmobiliariaId={user?.inmobiliariaId}
      />
    </section>
  );
};

export default InmuebleCreatePage;
