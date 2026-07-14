import { useContext } from "react";
import {
  OPERACIONES_OPCIONES,
  TIPOS_INMUEBLE_OPCIONES,
} from "../utils/inmuebleSchema";

import { INMUEBLE_ESTADOS_ARRAY } from "../../domain/inmueble/inmueble.constants";
import { AuthContext } from "../../context/auth/AuthContext";

import { useInmuebleImages } from "../hooks/useInmuebleImages";
import InmuebleGallery from "./InmuebleGallery";

const InmuebleForm = ({
  values = {},
  errors = {},
  loading = false,
  initialLoading = false,
  isEditMode = false,
  handleChange,
  handleNestedChange,
  handleSubmit,
  inmuebleId = null,
  inmobiliariaId = null,
}) => {
  const { user, activeInmobiliariaId } = useContext(AuthContext);

  const imageManager = useInmuebleImages(values?.images ?? []);

  const {
    images,
    addImages,
    reorderImages,
    loading: imagesLoading,
    error: imagesError,
  } = imageManager;

  const removeImage = imageManager.removeImage;

  if (initialLoading) {
    return <div className="text-center py-5">Cargando inmueble...</div>;
  }

  const userInmobiliarias = Array.isArray(user?.inmobiliarias)
    ? user.inmobiliarias
    : [];

  const selectedInmobiliariaId =
    values?.inmobiliariaId || inmobiliariaId || activeInmobiliariaId || "";

  const puedeCambiarInmobiliaria =
    userInmobiliarias.length > 1 &&
    (user?.role === "root" || user?.role === "admin");

  const onSubmit = (e) => {
    e.preventDefault();

    const finalInmobiliariaId =
      values?.inmobiliariaId || inmobiliariaId || activeInmobiliariaId;

    handleSubmit({
      ...values,

      // En creación todavía no subimos imágenes desde este formulario.
      // En edición, images viene del hook.
      images: isEditMode ? images : values?.images || [],

      // 🔑 Compatibilidad + dominio
      inmobiliariaId: finalInmobiliariaId,
      ownerInmobiliariaId: values?.ownerInmobiliariaId || finalInmobiliariaId,

      // 🤝 Compartir / soft delete
      sharedWith: values?.sharedWith || {},
      deleted: values?.deleted ?? false,

      // Estado seguro
      estado: values?.estado || "activo",

      // Publicación en portal público
      publicarEnPortal: Boolean(values?.publicarEnPortal),
      noIndex: Boolean(values?.noIndex),
    });
  };

  return (
    <form onSubmit={onSubmit}>
      {/* =========================
          Inmobiliaria
         ========================= */}
      {puedeCambiarInmobiliaria ? (
        <div className="card mb-4">
          <div className="card-header fw-semibold">Inmobiliaria</div>
          <div className="card-body">
            <select
              className="form-select"
              name="inmobiliariaId"
              value={selectedInmobiliariaId}
              onChange={handleChange}
            >
              <option value="" disabled>
                Seleccionar inmobiliaria
              </option>

              {userInmobiliarias.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : (
        <input
          type="hidden"
          name="inmobiliariaId"
          value={selectedInmobiliariaId}
          readOnly
        />
      )}

      {/* =========================
          Información básica
         ========================= */}
      <div className="card mb-4">
        <div className="card-header fw-semibold">Información básica</div>
        <div className="card-body row g-3">
          <div className="col-12">
            <label className="form-label">Título *</label>
            <input
              type="text"
              name="titulo"
              className={`form-control ${errors.titulo ? "is-invalid" : ""}`}
              value={values?.titulo || ""}
              onChange={handleChange}
            />
            {errors.titulo && (
              <div className="invalid-feedback">{errors.titulo}</div>
            )}
          </div>

          <div className="col-12">
            <label className="form-label">Descripción</label>
            <textarea
              name="descripcion"
              className="form-control"
              rows={3}
              value={values?.descripcion || ""}
              onChange={handleChange}
            />
          </div>
        </div>
      </div>

      {/* =========================
          Clasificación
         ========================= */}
      <div className="card mb-4">
        <div className="card-header fw-semibold">Clasificación</div>
        <div className="card-body row g-3">
          <div className="col-md-6">
            <label className="form-label">Tipo *</label>
            <select
              name="tipo"
              className={`form-select ${errors.tipo ? "is-invalid" : ""}`}
              value={values?.tipo || ""}
              onChange={handleChange}
            >
              <option value="">Seleccionar</option>
              {TIPOS_INMUEBLE_OPCIONES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
            {errors.tipo && (
              <div className="invalid-feedback">{errors.tipo}</div>
            )}
          </div>

          <div className="col-md-6">
            <label className="form-label">Operación *</label>
            <select
              name="operacion"
              className={`form-select ${errors.operacion ? "is-invalid" : ""}`}
              value={values?.operacion || ""}
              onChange={handleChange}
            >
              <option value="">Seleccionar</option>
              {OPERACIONES_OPCIONES.map((op) => (
                <option key={op.id} value={op.id}>
                  {op.label}
                </option>
              ))}
            </select>
            {errors.operacion && (
              <div className="invalid-feedback">{errors.operacion}</div>
            )}
          </div>
        </div>
      </div>

      {/* =========================
          Precio
         ========================= */}
      {values?.operacion !== "tasacion" && (
        <div className="card mb-4">
          <div className="card-header fw-semibold">Precio</div>
          <div className="card-body row g-3">
            <div className="col-md-4">
              <label className="form-label">Precio *</label>
              <input
                type="number"
                name="precio"
                className={`form-control ${errors.precio ? "is-invalid" : ""}`}
                value={values?.precio || ""}
                onChange={handleChange}
              />
              {errors.precio && (
                <div className="invalid-feedback">{errors.precio}</div>
              )}
            </div>

            <div className="col-md-4">
              <label className="form-label">Moneda</label>
              <select
                name="moneda"
                className="form-select"
                value={values?.moneda || "USD"}
                onChange={handleChange}
              >
                <option value="USD">USD</option>
                <option value="ARS">ARS</option>
              </select>
            </div>

            <div className="col-md-4">
              <label className="form-label">Expensas</label>
              <input
                type="number"
                name="expensas"
                className="form-control"
                value={values?.expensas || ""}
                onChange={handleChange}
              />
            </div>
          </div>
        </div>
      )}

      {/* =========================
          Ubicación
         ========================= */}
      <div className="card mb-4">
        <div className="card-header fw-semibold">Ubicación</div>
        <div className="card-body row g-3">
          <div className="col-md-4">
            <label className="form-label">Calle</label>
            <input
              className="form-control"
              value={values?.direccion?.calle || ""}
              onChange={(e) =>
                handleNestedChange("direccion", "calle", e.target.value)
              }
            />
          </div>

          <div className="col-md-2">
            <label className="form-label">Número</label>
            <input
              className="form-control"
              value={values?.direccion?.numero || ""}
              onChange={(e) =>
                handleNestedChange("direccion", "numero", e.target.value)
              }
            />
          </div>

          <div className="col-md-3">
            <label className="form-label">Barrio</label>
            <input
              className="form-control"
              value={values?.direccion?.barrio || ""}
              onChange={(e) =>
                handleNestedChange("direccion", "barrio", e.target.value)
              }
            />
          </div>

          <div className="col-md-3">
            <label className="form-label">Ciudad *</label>
            <input
              className={`form-control ${errors.ciudad ? "is-invalid" : ""}`}
              value={values?.direccion?.ciudad || ""}
              onChange={(e) =>
                handleNestedChange("direccion", "ciudad", e.target.value)
              }
            />
            {errors.ciudad && (
              <div className="invalid-feedback">{errors.ciudad}</div>
            )}
          </div>
        </div>
      </div>

      {/* =========================
          Imágenes
         ========================= */}
      <div className="card mb-4">
        <div className="card-header fw-semibold">Imágenes</div>
        <div className="card-body">
          {isEditMode && inmuebleId ? (
            <InmuebleGallery
              images={images}
              onAddImages={addImages}
              onRemoveImage={(image) => {
                if (typeof removeImage !== "function") {
                  console.error(
                    "removeImage no está disponible en useInmuebleImages. API recibida:",
                    imageManager,
                  );
                  return;
                }

                removeImage({
                  image,
                  inmuebleId,
                  inmobiliariaId: selectedInmobiliariaId,
                });
              }}
              onReorderImages={(fromIndex, toIndex) =>
                reorderImages({
                  fromIndex,
                  toIndex,
                  inmuebleId,
                  inmobiliariaId: selectedInmobiliariaId,
                })
              }
              loading={imagesLoading}
              error={imagesError}
              inmuebleId={inmuebleId}
              inmobiliariaId={selectedInmobiliariaId}
            />
          ) : (
            <div className="alert alert-info mb-0">
              Primero creá el inmueble. Después vas a poder cargar y ordenar las
              imágenes desde la edición.
            </div>
          )}
        </div>
      </div>

      {/* =========================
    Publicación
   ========================= */}
      <div className="card mb-4">
        <div className="card-header fw-semibold">Publicación</div>
        <div className="card-body row g-3 align-items-end">
          <div className="col-md-4">
            <label className="form-label">Estado *</label>
            <select
              name="estado"
              className={`form-select ${errors.estado ? "is-invalid" : ""}`}
              value={values?.estado || "activo"}
              onChange={handleChange}
            >
              {INMUEBLE_ESTADOS_ARRAY.map((estado) => (
                <option key={estado} value={estado}>
                  {estado.charAt(0).toUpperCase() + estado.slice(1)}
                </option>
              ))}
            </select>
            {errors.estado && (
              <div className="invalid-feedback">{errors.estado}</div>
            )}
          </div>

          <div className="col-md-4">
            <div className="form-check mt-4">
              <input
                className="form-check-input"
                type="checkbox"
                name="destacado"
                checked={Boolean(values?.destacado)}
                onChange={handleChange}
              />
              <label className="form-check-label">Destacado</label>
            </div>
          </div>

          <div className="col-md-4">
            <div className="form-check mt-4">
              <input
                className="form-check-input"
                type="checkbox"
                name="publicarEnPortal"
                checked={Boolean(values?.publicarEnPortal)}
                onChange={handleChange}
              />
              <label className="form-check-label">Publicar en portal</label>
            </div>
          </div>

          <div className="col-md-4">
            <div className="form-check mt-4">
              <input
                className="form-check-input"
                type="checkbox"
                name="noIndex"
                checked={Boolean(values?.noIndex)}
                onChange={handleChange}
              />
              <label className="form-check-label">No indexar en Google</label>
            </div>
          </div>

          {values?.noIndex && (
            <div className="col-12">
              <div className="alert alert-warning small mb-0">
                Esta publicación puede verse si está publicada en el portal, pero no
                será incluida en el sitemap y la ficha pública enviará la indicación
                <strong> noindex</strong> a los buscadores.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* =========================
          Acciones
         ========================= */}
      <div className="d-flex justify-content-end">
        <button
          type="submit"
          className="btn btn-primary px-4"
          disabled={loading || imagesLoading}
        >
          {loading
            ? "Guardando..."
            : isEditMode
              ? "Actualizar inmueble"
              : "Crear inmueble"}
        </button>
      </div>
    </form>
  );
};

export default InmuebleForm;