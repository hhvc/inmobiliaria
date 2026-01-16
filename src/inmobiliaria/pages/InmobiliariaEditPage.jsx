import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import InmobiliariaForm from "../components/InmobiliariaForm";
import {
  getInmobiliariaById,
  updateInmobiliaria,
} from "../services/inmobiliaria.service";
import { uploadInmobiliariaImages } from "../helpers/uploadInmobiliariaImages";

export default function InmobiliariaEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [inmobiliaria, setInmobiliaria] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  /* ===============================
     1️⃣ Cargar inmobiliaria
     =============================== */
  useEffect(() => {
    const fetchInmobiliaria = async () => {
      try {
        setLoading(true);
        const data = await getInmobiliariaById(id);

        if (!data) {
          throw new Error("La inmobiliaria no existe");
        }

        // Asegurarse de que la estructura sea compatible con el formulario
        const formattedData = {
          ...data,
          // Asegurar que configuracion tenga la estructura correcta
          configuracion: {
            operacionesPermitidas:
              data.configuracion?.operacionesPermitidas || [],
            tiposInmueblePermitidos:
              data.configuracion?.tiposInmueblePermitidos || [],
            contacto: {
              email: data.configuracion?.contacto?.email || "",
              telefono: data.configuracion?.contacto?.telefono || "",
              whatsapp: data.configuracion?.contacto?.whatsapp || "",
            },
          },
          // Asegurar que branding tenga la estructura correcta
          branding: {
            logo: data.branding?.logo || null,
            backgrounds: {
              primary: data.branding?.backgrounds?.primary || null,
              secondary: data.branding?.backgrounds?.secondary || null,
              tertiary: data.branding?.backgrounds?.tertiary || null,
            },
          },
        };

        setInmobiliaria(formattedData);
      } catch (err) {
        console.error(err);
        setError(err.message || "Error al cargar la inmobiliaria");
      } finally {
        setLoading(false);
      }
    };

    fetchInmobiliaria();
  }, [id]);

  /* ===============================
     2️⃣ Submit edición - Actualizado para nueva estructura
     =============================== */
  const handleSubmit = async (payload, images) => {
    try {
      setSaving(true);
      setError(null);

      console.log("Datos para actualizar:", payload);
      console.log("Imágenes para subir:", images);

      /* -------------------------------
         Actualizar datos base (sin imágenes)
         ------------------------------- */
      await updateInmobiliaria(id, {
        ...payload,
        updatedAt: new Date().toISOString(),
      });

      /* -------------------------------
         Subir / reemplazar imágenes si existen
         ------------------------------- */
      let brandingUpdates = {};

      // Usar encadenamiento opcional para evitar errores
      const imagesToUpload = {
        logo: images?.logo?.file || null,
        backgrounds: {
          primary: images?.backgrounds?.primary?.file || null,
          secondary: images?.backgrounds?.secondary?.file || null,
          tertiary: images?.backgrounds?.tertiary?.file || null,
        },
      };

      const hasImages =
        imagesToUpload.logo ||
        imagesToUpload.backgrounds?.primary ||
        imagesToUpload.backgrounds?.secondary ||
        imagesToUpload.backgrounds?.tertiary;

      if (hasImages) {
        // Subir nuevas imágenes
        brandingUpdates = await uploadInmobiliariaImages(id, imagesToUpload);

        // Preservar URLs de imágenes existentes si no se están subiendo nuevas
        if (inmobiliaria?.branding) {
          if (!imagesToUpload.logo && inmobiliaria.branding.logo) {
            brandingUpdates.logo = inmobiliaria.branding.logo;
          }
          if (
            !imagesToUpload.backgrounds?.primary &&
            inmobiliaria.branding.backgrounds?.primary
          ) {
            brandingUpdates.backgrounds = {
              ...brandingUpdates.backgrounds,
              primary: inmobiliaria.branding.backgrounds.primary,
            };
          }
          if (
            !imagesToUpload.backgrounds?.secondary &&
            inmobiliaria.branding.backgrounds?.secondary
          ) {
            brandingUpdates.backgrounds = {
              ...brandingUpdates.backgrounds,
              secondary: inmobiliaria.branding.backgrounds.secondary,
            };
          }
          if (
            !imagesToUpload.backgrounds?.tertiary &&
            inmobiliaria.branding.backgrounds?.tertiary
          ) {
            brandingUpdates.backgrounds = {
              ...brandingUpdates.backgrounds,
              tertiary: inmobiliaria.branding.backgrounds.tertiary,
            };
          }
        }

        // Actualizar branding con las nuevas imágenes
        if (Object.keys(brandingUpdates).length > 0) {
          await updateInmobiliaria(id, {
            branding: brandingUpdates,
            updatedAt: new Date().toISOString(),
          });
        }
      }

      alert("✅ Inmobiliaria actualizada correctamente");
      navigate("/admin/inmobiliarias");
    } catch (err) {
      console.error("Error actualizando inmobiliaria:", err);
      setError(err?.message || "Error al actualizar la inmobiliaria");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    navigate("/admin/inmobiliarias");
  };

  /* ===============================
     Estados visuales
     =============================== */

  if (loading) {
    return (
      <div className="container py-5">
        <div className="d-flex justify-content-center">
          <div className="spinner-border" role="status">
            <span className="visually-hidden">Cargando...</span>
          </div>
          <span className="ms-3">Cargando inmobiliaria...</span>
        </div>
      </div>
    );
  }

  if (error && !inmobiliaria) {
    return (
      <div className="container py-5">
        <div
          className="alert alert-danger alert-dismissible fade show"
          role="alert"
        >
          <strong>Error:</strong> {error}
          <button
            type="button"
            className="btn-close"
            onClick={() => setError(null)}
          ></button>
        </div>
        <button
          className="btn btn-secondary mt-3"
          onClick={() => navigate("/admin/inmobiliarias")}
        >
          ← Volver a la lista
        </button>
      </div>
    );
  }

  if (!inmobiliaria) {
    return (
      <div className="container py-5">
        <div className="alert alert-warning">
          <strong>Atención:</strong> No se encontró la inmobiliaria solicitada.
        </div>
        <button
          className="btn btn-primary mt-3"
          onClick={() => navigate("/admin/inmobiliarias")}
        >
          ← Volver a la lista
        </button>
      </div>
    );
  }

  /* ===============================
     Render
     =============================== */

  return (
    <div className="container py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h3>✏️ Editar Inmobiliaria</h3>
        <button
          className="btn btn-outline-secondary"
          onClick={() => navigate("/admin/inmobiliarias")}
        >
          ← Volver
        </button>
      </div>

      {error && (
        <div
          className="alert alert-danger alert-dismissible fade show mb-4"
          role="alert"
        >
          {error}
          <button
            type="button"
            className="btn-close"
            onClick={() => setError(null)}
          ></button>
        </div>
      )}

      <div className="card mb-4">
        <div className="card-body">
          <div className="row">
            <div className="col-md-6">
              <p>
                <strong>ID:</strong> {id}
              </p>
            </div>
            <div className="col-md-6">
              <p>
                <strong>Slug:</strong> {inmobiliaria.slug}
              </p>
            </div>
          </div>
          {inmobiliaria.createdAt && (
            <p className="text-muted small">
              <strong>Creación:</strong>{" "}
              {new Date(inmobiliaria.createdAt).toLocaleString()}
            </p>
          )}
        </div>
      </div>

      <InmobiliariaForm
        initialData={inmobiliaria}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        loading={saving}
      />
    </div>
  );
}
