import { useState } from "react";
import { useNavigate } from "react-router-dom";

import InmobiliariaForm from "../components/InmobiliariaForm";
import {
  createInmobiliaria,
  updateInmobiliaria,
} from "../services/inmobiliaria.service";
import { uploadInmobiliariaImagesSimplified } from "../helpers/uploadInmobiliariaImages";

const normalizeText = (value = "") => value.toString().trim();

const normalizeCuit = (value = "") =>
  value
    .toString()
    .trim()
    .replace(/\D/g, "");

const buildInitialVerificationData = (formData = {}) => {
  const cuit = normalizeCuit(formData.cuit);
  const razonSocial = normalizeText(formData.razonSocial);

  return {
    estado: "pendiente_documentacion",
    estadoLabel: "Pendiente de documentación para validar",

    tipoPersona: formData.verificacion?.tipoPersona || "no_informado",

    cuit,
    razonSocial,

    requiereDocumentacion: true,
    documentacionCompleta: false,

    submittedAt: null,
    reviewedAt: null,
    reviewedBy: null,

    observaciones:
      "La inmobiliaria fue creada y puede operar, pero aún debe presentar documentación para validar su identidad y situación fiscal.",
  };
};

const buildInitialVerificationDocuments = () => {
  return {
    constanciaArca: null,
    dniTitular: null,
    estatutoContratoSocial: null,
    dniApoderado: null,
    poderApoderado: null,
  };
};

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

      const now = new Date().toISOString();

      const inmobiliariaData = {
        nombre: normalizeText(formData.nombre),
        razonSocial: normalizeText(formData.razonSocial),
        cuit: normalizeCuit(formData.cuit),
        slug: normalizeText(formData.slug),

        /*
          La inmobiliaria queda funcional.
          La verificación documental corre por separado.
        */
        activa: formData.activa ?? true,

        verificacion: buildInitialVerificationData(formData),
        documentacionVerificacion: buildInitialVerificationDocuments(),

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

        createdAt: formData.createdAt || now,
        updatedAt: formData.updatedAt || now,
      };

      const inmobiliariaId = await createInmobiliaria(inmobiliariaData);

      let branding = {};

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
          imagesToUpload,
        );
      }

      if (Object.keys(branding).length > 0) {
        await updateInmobiliaria(inmobiliariaId, {
          branding,
          updatedAt: new Date().toISOString(),
        });
      }

      alert(
        "✅ Inmobiliaria creada correctamente. Queda operativa, pero pendiente de documentación para validar.",
      );

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

      <div className="alert alert-info">
        <strong>Alta operativa con verificación posterior.</strong> La
        inmobiliaria podrá operar y cargar inmuebles, pero figurará como{" "}
        <strong>pendiente de documentación para validar</strong> hasta que se
        presente y revise la documentación correspondiente.
      </div>

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
            aria-label="Cerrar"
          />
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