import { useState } from "react";
import { useNavigate } from "react-router-dom";

import InmuebleForm from "../components/InmuebleForm";
import { useAuth } from "../../context/auth/useAuth";
import { createInmueble } from "../services/inmueble.service";
import { canCreateInmueble } from "../helpers/permissions";

const InmuebleCreatePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleCreate = async (formValues) => {
    try {
      setLoading(true);
      setError(null);

      if (!user?.uid || !user?.inmobiliariaId) {
        throw new Error("No se pudo determinar el usuario o la inmobiliaria");
      }

      // 🔐 Permiso frontend (UX, no seguridad)
      if (!canCreateInmueble(user, user.inmobiliariaId)) {
        throw new Error("No tenés permisos para crear inmuebles");
      }

      const inmuebleData = {
        ...formValues,

        // 🔐 Asociación
        ownerId: user.uid,
        inmobiliariaId: user.inmobiliariaId,

        // 📌 Estado inicial
        estado: "activo",

        // 🕒 Timestamps
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

  return (
    <section className="page-container">
      <header className="page-header">
        <h1>Nuevo inmueble</h1>
        <p>Cargá la información básica para publicar el inmueble</p>
      </header>

      {error && <div className="error-box">{error}</div>}

      <InmuebleForm
        onSubmit={handleCreate}
        loading={loading}
        isEditMode={false}
      />
    </section>
  );
};

export default InmuebleCreatePage;
