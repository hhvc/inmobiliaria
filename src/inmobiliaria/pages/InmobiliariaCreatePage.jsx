import { useState } from "react";
import { useNavigate } from "react-router-dom";
import InmobiliariaForm from "../components/InmobiliariaForm";
import {
  createInmobiliaria,
  updateInmobiliaria,
} from "../services/inmobiliaria.service";
import { uploadInmobiliariaImagesSimplified } from "../helpers/uploadInmobiliariaImages";

export default function InmobiliariaCreatePage() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (formData, images) => {
    try {
      setLoading(true);
      setError(null);

      console.log("Datos del formulario:", formData);
      console.log("Imágenes recibidas:", images);

      const inmobiliariaData = {
        nombre: formData.nombre,
        razonSocial: formData.razonSocial,
        cuit: formData.cuit,
        slug: formData.slug,
        activa: formData.activa,
        configuracion: {
          operacionesPermitidas:
            formData.configuracion?.operacionesPermitidas || [],
          tiposInmueblePermitidos:
            formData.configuracion?.tiposInmueblePermitidos || [],
          contacto: {
            email: formData.configuracion?.contacto?.email || "",
            telefono: formData.configuracion?.contacto?.telefono || "",
            whatsapp: formData.configuracion?.contacto?.whatsapp || "",
          },
        },
        branding: {},
        createdAt: formData.createdAt || new Date().toISOString(),
        updatedAt: formData.updatedAt || new Date().toISOString(),
      };

      const inmobiliariaId = await createInmobiliaria(inmobiliariaData);

      let branding = {};

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
        branding = await uploadInmobiliariaImagesSimplified(
          inmobiliariaId,
          imagesToUpload
        );
      }

      if (Object.keys(branding).length > 0) {
        await updateInmobiliaria(inmobiliariaId, {
          branding,
          updatedAt: new Date().toISOString(),
        });
      }

      alert("✅ Inmobiliaria creada correctamente");
      navigate("/admin/inmobiliarias");
    } catch (err) {
      console.error("Error creando inmobiliaria:", err);
      setError(err?.message || "Ocurrió un error al crear la inmobiliaria");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    navigate("/admin/inmobiliarias");
  };

  return (
    <div className="container py-4">
      <h3 className="mb-4">🏢 Nueva Inmobiliaria</h3>

      {error && (
        <div
          className="alert alert-danger alert-dismissible fade show"
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

      <InmobiliariaForm
        initialData={null}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        loading={loading}
      />
    </div>
  );
}
