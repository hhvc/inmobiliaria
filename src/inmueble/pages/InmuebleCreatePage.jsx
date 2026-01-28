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
  images: [],
};

const InmuebleCreatePage = () => {
  const navigate = useNavigate();
  const { user, activeInmobiliariaId } = useAuth();

  const [values, setValues] = useState(INITIAL_VALUES);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /* =========================
     Handlers
     ========================= */

  const handleChange = (e) => {
    const { name, value } = e.target;
    setValues((prev) => ({ ...prev, [name]: value }));
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

  /* =========================
     Crear inmueble
     ========================= */

  const handleCreate = async (formValues) => {
    console.log("HANDLE CREATE EJECUTADO", formValues);

    try {
      setLoading(true);
      setError(null);

      if (!user?.uid || !activeInmobiliariaId) {
        throw new Error(
          "No se pudo determinar el usuario o la inmobiliaria activa",
        );
      }

      if (!canCreateInmueble(user, activeInmobiliariaId)) {
        throw new Error("No tenés permisos para crear inmuebles");
      }

      const inmuebleData = {
        ...formValues,

        // 🔑 Dominio
        ownerId: user.uid,
        ownerInmobiliariaId: activeInmobiliariaId,

        // Estado inicial
        estado: "activo",
      };

      await createInmueble(activeInmobiliariaId, inmuebleData);

      navigate("/admin/inmuebles");
    } catch (err) {
      console.error("Error creando inmueble:", err);
      setError(err.message || "Ocurrió un error al crear el inmueble");
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
        isEditMode={false}
        handleChange={handleChange}
        handleNestedChange={handleNestedChange}
        handleSubmit={handleCreate}
        inmuebleId={null}
        inmobiliariaId={activeInmobiliariaId}
      />
    </section>
  );
};

export default InmuebleCreatePage;
