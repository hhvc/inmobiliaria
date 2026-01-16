import { useState } from "react";
import { useInmobiliariaForm } from "../hooks/useInmobiliariaForm";
import { validateImageFile } from "../../utils/imageUtils";
import ImageCropModal from "../../components/common/ImageCropModal";

// Función slugify
const slugify = (text = "") =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const IMAGE_RULES = {
  logo: {
    maxSizeMB: 2,
    minWidth: 200,
    minHeight: 200,
    ratio: 1,
  },
  background: {
    maxSizeMB: 5,
    minWidth: 1280,
    minHeight: 720,
    ratio: 16 / 9,
  },
};

const OPERACIONES_OPCIONES = [
  { id: "venta", label: "Venta" },
  { id: "alquiler", label: "Alquiler" },
  { id: "alquiler_temporal", label: "Alquiler Temporal" },
  { id: "compra", label: "Compra" },
  { id: "tasacion", label: "Tasación" },
];

const TIPOS_INMUEBLE_OPCIONES = [
  { id: "casa", label: "Casa" },
  { id: "departamento", label: "Departamento" },
  { id: "terreno", label: "Terreno" },
  { id: "local", label: "Local" },
  { id: "oficina", label: "Oficina" },
  { id: "cochera", label: "Cochera" },
  { id: "deposito", label: "Depósito" },
  { id: "quinta", label: "Quinta" },
  { id: "campo", label: "Campo" },
];

const validateImageAdvanced = async (file, rules) => {
  validateImageFile(file);

  const img = new Image();
  img.src = URL.createObjectURL(file);

  await new Promise((res) => (img.onload = res));

  if (img.width < rules.minWidth || img.height < rules.minHeight) {
    throw new Error(`Resolución mínima ${rules.minWidth}x${rules.minHeight}px`);
  }

  if (rules.ratio) {
    const ratio = img.width / img.height;
    if (Math.abs(ratio - rules.ratio) > 0.05) {
      throw new Error("Relación de aspecto incorrecta");
    }
  }
};

const InmobiliariaForm = ({
  initialData = null,
  onSubmit,
  onCancel,
  loading = false,
}) => {
  const { formData, isEditMode, updateField, submit, toggleArrayItem } =
    useInmobiliariaForm({
      inmobiliariaExistente: initialData,
    });

  const [imageErrors, setImageErrors] = useState({});
  const [cropState, setCropState] = useState(null);

  // Manejar cambio de nombre con generación automática de slug
  const handleNombreChange = (e) => {
    const newNombre = e.target.value;
    updateField("nombre", newNombre);

    // Generar slug automático solo en modo creación
    if (
      !isEditMode &&
      (!formData.slug || formData.slug === slugify(formData.nombre))
    ) {
      const newSlug = slugify(newNombre);
      updateField("slug", newSlug);
    }
  };

  const handleCropConfirm = (blob) => {
    const preview = URL.createObjectURL(blob);

    updateField(cropState.path, {
      file: new File([blob], "cropped.jpg", { type: "image/jpeg" }),
      preview,
    });

    setCropState(null);
  };

  const handleImageChange = async (path, file, type) => {
    if (!file) return;

    try {
      const rules = type === "logo" ? IMAGE_RULES.logo : IMAGE_RULES.background;

      await validateImageAdvanced(file, rules);

      const preview = URL.createObjectURL(file);

      setCropState({
        src: preview,
        path,
        aspect: type === "logo" ? 1 : 16 / 9,
      });

      setImageErrors((prev) => ({ ...prev, [path]: null }));
    } catch (err) {
      setImageErrors((prev) => ({
        ...prev,
        [path]: err.message,
      }));
    }
  };

  const handleImageRemove = (path) => {
    updateField(path, null);
    setImageErrors((prev) => ({ ...prev, [path]: null }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (typeof onSubmit !== "function") {
      console.error("Error: onSubmit no es una función válida");
      return;
    }

    try {
      await submit(async (payload, images) => {
        await onSubmit(payload, images);
      });
    } catch (error) {
      console.error("Error al enviar el formulario:", error);
    }
  };

  const renderImagePreview = (image, onRemove, style = {}) => {
    if (!image) return null;

    const src = image.preview || image.url;
    if (!src) return null;

    return (
      <div className="mt-2 position-relative">
        <img
          src={src}
          alt="preview"
          className="rounded w-100"
          style={{ maxHeight: 180, objectFit: "cover", ...style }}
        />
        <button
          type="button"
          className="btn btn-sm btn-danger position-absolute top-0 end-0 m-2"
          onClick={onRemove}
        >
          ✕
        </button>
      </div>
    );
  };

  return (
    <>
      <form onSubmit={handleSubmit}>
        <div className="card shadow-sm">
          <div className="card-body">
            <h5 className="mb-4">
              {isEditMode ? "Editar Inmobiliaria" : "Nueva Inmobiliaria"}
            </h5>

            <div className="mb-5">
              <h6 className="border-bottom pb-2 mb-3">Información Básica</h6>

              <div className="row">
                <div className="col-md-6 mb-3">
                  <label className="form-label">
                    Nombre de la Inmobiliaria *
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.nombre || ""}
                    onChange={handleNombreChange}
                    required
                  />
                </div>

                <div className="col-md-6 mb-3">
                  <label className="form-label">Razón Social *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.razonSocial || ""}
                    onChange={(e) => updateField("razonSocial", e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="row">
                <div className="col-md-6 mb-3">
                  <label className="form-label">CUIT *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.cuit || ""}
                    onChange={(e) => updateField("cuit", e.target.value)}
                    placeholder="20-12345678-9"
                    required
                  />
                </div>

                <div className="col-md-6 mb-3">
                  <label className="form-label">Slug (URL amigable) *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.slug || ""}
                    onChange={(e) => updateField("slug", e.target.value)}
                    placeholder="mi-inmobiliaria"
                    required
                  />
                  <div className="form-text">
                    {!isEditMode &&
                      "Se genera automáticamente desde el nombre si está vacío"}
                  </div>
                </div>
              </div>
            </div>

            <div className="mb-5">
              <h6 className="border-bottom pb-2 mb-3">Configuración</h6>

              <div className="row">
                <div className="col-md-6 mb-4">
                  <label className="form-label mb-3">
                    Operaciones Permitidas *
                  </label>
                  <div className="border rounded p-3">
                    {OPERACIONES_OPCIONES.map((op) => (
                      <div className="form-check" key={op.id}>
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id={`op-${op.id}`}
                          checked={(
                            formData?.configuracion?.operacionesPermitidas || []
                          ).includes(op.label)}
                          onChange={() =>
                            toggleArrayItem(
                              "configuracion.operacionesPermitidas",
                              op.label
                            )
                          }
                        />
                        <label
                          className="form-check-label"
                          htmlFor={`op-${op.id}`}
                        >
                          {op.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="col-md-6 mb-4">
                  <label className="form-label mb-3">
                    Tipos de Inmueble Permitidos *
                  </label>
                  <div className="border rounded p-3">
                    {TIPOS_INMUEBLE_OPCIONES.map((tipo) => (
                      <div className="form-check" key={tipo.id}>
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id={`tipo-${tipo.id}`}
                          checked={(
                            formData?.configuracion?.tiposInmueblePermitidos ||
                            []
                          ).includes(tipo.label)}
                          onChange={() =>
                            toggleArrayItem(
                              "configuracion.tiposInmueblePermitidos",
                              tipo.label
                            )
                          }
                        />
                        <label
                          className="form-check-label"
                          htmlFor={`tipo-${tipo.id}`}
                        >
                          {tipo.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="mb-5">
              <h6 className="border-bottom pb-2 mb-3">Contacto</h6>

              <div className="row">
                <div className="col-md-6 mb-3">
                  <label className="form-label">Email de Contacto *</label>
                  <input
                    type="email"
                    className="form-control"
                    value={formData?.configuracion?.contacto?.email || ""}
                    onChange={(e) =>
                      updateField(
                        "configuracion.contacto.email",
                        e.target.value
                      )
                    }
                    required
                  />
                </div>

                <div className="col-md-6 mb-3">
                  <label className="form-label">Teléfono</label>
                  <input
                    type="tel"
                    className="form-control"
                    value={formData?.configuracion?.contacto?.telefono || ""}
                    onChange={(e) =>
                      updateField(
                        "configuracion.contacto.telefono",
                        e.target.value
                      )
                    }
                  />
                </div>
              </div>

              <div className="row">
                <div className="col-md-6 mb-3">
                  <label className="form-label">WhatsApp</label>
                  <input
                    type="tel"
                    className="form-control"
                    value={formData?.configuracion?.contacto?.whatsapp || ""}
                    onChange={(e) =>
                      updateField(
                        "configuracion.contacto.whatsapp",
                        e.target.value
                      )
                    }
                    placeholder="+5491112345678"
                  />
                </div>
              </div>
            </div>

            <div className="mb-5">
              <h6 className="border-bottom pb-2 mb-3">Branding</h6>

              <div className="mb-3">
                <label className="form-label">Logo</label>
                <input
                  type="file"
                  className="form-control"
                  accept="image/*"
                  onChange={(e) =>
                    handleImageChange(
                      "branding.logo",
                      e.target.files[0],
                      "logo"
                    )
                  }
                />
                {imageErrors["branding.logo"] && (
                  <div className="text-danger small mt-1">
                    {imageErrors["branding.logo"]}
                  </div>
                )}
                {renderImagePreview(
                  formData.branding?.logo,
                  () => handleImageRemove("branding.logo"),
                  { maxHeight: 80, objectFit: "contain" }
                )}
              </div>

              {[
                { key: "primary", label: "Fondo principal" },
                { key: "secondary", label: "Fondo secundario" },
                { key: "tertiary", label: "Fondo terciario" },
              ].map(({ key, label }) => {
                const path = `branding.backgrounds.${key}`;
                return (
                  <div className="mb-3" key={key}>
                    <label className="form-label">{label}</label>
                    <input
                      type="file"
                      className="form-control"
                      accept="image/*"
                      onChange={(e) =>
                        handleImageChange(path, e.target.files[0], "background")
                      }
                    />
                    {imageErrors[path] && (
                      <div className="text-danger small mt-1">
                        {imageErrors[path]}
                      </div>
                    )}
                    {renderImagePreview(
                      formData.branding?.backgrounds?.[key],
                      () => handleImageRemove(path)
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mb-4">
              <h6 className="border-bottom pb-2 mb-3">Estado</h6>

              <div className="form-check form-switch mb-3">
                <input
                  className="form-check-input"
                  type="checkbox"
                  role="switch"
                  id="activaSwitch"
                  checked={formData.activa || false}
                  onChange={(e) => updateField("activa", e.target.checked)}
                />
                <label className="form-check-label" htmlFor="activaSwitch">
                  Inmobiliaria activa
                </label>
              </div>

              {isEditMode && formData.createdAt && (
                <div className="text-muted small">
                  <div>
                    Creación: {new Date(formData.createdAt).toLocaleString()}
                  </div>
                  {formData.updatedAt && (
                    <div>
                      Última actualización:{" "}
                      {new Date(formData.updatedAt).toLocaleString()}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="d-flex justify-content-end gap-2 mt-4">
              {onCancel && (
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={onCancel}
                  disabled={loading}
                >
                  Cancelar
                </button>
              )}
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
              >
                {loading
                  ? "Guardando..."
                  : isEditMode
                  ? "Guardar cambios"
                  : "Crear inmobiliaria"}
              </button>
            </div>
          </div>
        </div>
      </form>

      {cropState && (
        <ImageCropModal
          src={cropState.src}
          aspect={cropState.aspect}
          onCancel={() => setCropState(null)}
          onConfirm={handleCropConfirm}
        />
      )}
    </>
  );
};

export default InmobiliariaForm;
