import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import InmuebleForm from "../components/InmuebleForm";
import InmuebleGallery from "../components/InmuebleGallery";

import { getInmuebleById, updateInmueble } from "../services/inmueble.service";

import { useInmuebleImages } from "../hooks/useInmuebleImages";

import { useAuth } from "../../context/auth/useAuth";
import { canEditInmueble } from "../helpers/permissions";

const InmuebleEditPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [inmueble, setInmueble] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  /* =========================
     Cargar inmueble
     ========================= */
  useEffect(() => {
    const fetchInmueble = async () => {
      try {
        setLoading(true);
        setError(null);

        if (!user) {
          setError("No se pudo determinar el usuario");
          return;
        }

        const data = await getInmuebleById(id);

        if (!data) {
          setError("El inmueble no existe");
          return;
        }

        // 🔐 Permisos frontend
        if (!canEditInmueble(user, data)) {
          setError("No tenés permisos para editar este inmueble");
          return;
        }

        setInmueble(data);
      } catch (err) {
        console.error("Error cargando inmueble:", err);

        if (err.code === "permission-denied") {
          setError("Acceso denegado");
        } else {
          setError("Error al cargar el inmueble");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchInmueble();
  }, [id, user]);

  /* =========================
     Hook de imágenes
     ========================= */
  const {
    images,
    trashedImages,

    loading: imagesLoading,
    error: imagesError,

    addImages,
    reorderImages,
    trashImagesBatch,
    restoreImagesBatch,
    deleteImagesBatch,
  } = useInmuebleImages(inmueble?.images || []);

  /* =========================
     Guardar cambios (form)
     ========================= */
  const handleUpdate = async (formValues) => {
    try {
      setSaving(true);
      setError(null);

      if (!inmueble) {
        throw new Error("No hay inmueble cargado");
      }

      if (!canEditInmueble(user, inmueble)) {
        throw new Error("No tenés permisos para editar este inmueble");
      }

      const updatedInmueble = {
        ...formValues,

        // 🔒 Asociaciones inmutables
        ownerId: inmueble.ownerId,
        inmobiliariaId: inmueble.inmobiliariaId,

        // 🕒 Timestamp
        updatedAt: new Date(),
      };

      await updateInmueble(id, updatedInmueble);

      navigate("/inmuebles");
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
     Estados de UI
     ========================= */
  if (loading) {
    return <p className="text-muted">Cargando inmueble...</p>;
  }

  if (error) {
    return <div className="alert alert-danger">{error}</div>;
  }

  if (!inmueble) {
    return null;
  }

  return (
    <section className="container py-4">
      {/* =====================
          Header
         ===================== */}
      <header className="mb-4">
        <h1 className="h3">Editar inmueble</h1>
        <p className="text-muted mb-0">
          Modificá la información y gestioná las imágenes
        </p>
      </header>

      {/* =====================
          Galería de imágenes
         ===================== */}
      <div className="mb-5">
        <h2 className="h5 mb-3">Imágenes</h2>

        <InmuebleGallery
          images={images}
          trashedImages={trashedImages}
          loading={imagesLoading}
          error={imagesError}
          inmuebleId={inmueble.id}
          inmobiliariaId={inmueble.inmobiliariaId}
          onAddImages={addImages}
          onReorderImages={reorderImages}
          onTrashImagesBatch={trashImagesBatch}
          onRestoreImagesBatch={restoreImagesBatch}
          onDeleteImagesBatch={deleteImagesBatch}
        />
      </div>

      {/* =====================
          Formulario
         ===================== */}
      <div>
        <h2 className="h5 mb-3">Datos del inmueble</h2>

        <InmuebleForm
          initialData={inmueble}
          onSubmit={handleUpdate}
          loading={saving}
          isEditMode={true}
        />
      </div>
    </section>
  );
};

export default InmuebleEditPage;
