import React from "react";
import {
  OPERACIONES_OPCIONES,
  TIPOS_INMUEBLE_OPCIONES,
} from "../utils/inmuebleSchema";

import { useInmuebleImages } from "../hooks/useInmuebleImages";
import InmuebleGallery from "./InmuebleGallery";

const InmuebleForm = ({
  values,
  errors,
  loading,
  initialLoading,
  isEditMode,
  handleChange,
  handleNestedChange,
  handleSubmit,
  inmuebleId,
  inmobiliariaId,
}) => {
  const {
    images,
    addImages,
    removeImage,
    reorderImages,
    loading: imagesLoading,
    error: imagesError,
  } = useInmuebleImages(values?.images ?? []);

  if (initialLoading) {
    return <div className="text-center py-5">Cargando inmueble...</div>;
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit({ ...values, images });
      }}
    >
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
              value={values.titulo}
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
              value={values.descripcion}
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
              value={values.tipo}
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
              value={values.operacion}
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
      {values.operacion !== "tasacion" && (
        <div className="card mb-4">
          <div className="card-header fw-semibold">Precio</div>
          <div className="card-body row g-3">
            <div className="col-md-4">
              <label className="form-label">Precio *</label>
              <input
                type="number"
                name="precio"
                className={`form-control ${errors.precio ? "is-invalid" : ""}`}
                value={values.precio}
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
                value={values.moneda}
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
                value={values.expensas}
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
              value={values.direccion.calle}
              onChange={(e) =>
                handleNestedChange("direccion", "calle", e.target.value)
              }
            />
          </div>

          <div className="col-md-2">
            <label className="form-label">Número</label>
            <input
              className="form-control"
              value={values.direccion.numero}
              onChange={(e) =>
                handleNestedChange("direccion", "numero", e.target.value)
              }
            />
          </div>

          <div className="col-md-3">
            <label className="form-label">Barrio</label>
            <input
              className="form-control"
              value={values.direccion.barrio}
              onChange={(e) =>
                handleNestedChange("direccion", "barrio", e.target.value)
              }
            />
          </div>

          <div className="col-md-3">
            <label className="form-label">Ciudad *</label>
            <input
              className={`form-control ${errors.ciudad ? "is-invalid" : ""}`}
              value={values.direccion.ciudad}
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
          <InmuebleGallery
            images={images}
            onAddImages={addImages}
            onRemoveImage={removeImage}
            onReorderImages={reorderImages}
            loading={imagesLoading}
            error={imagesError}
            inmuebleId={inmuebleId}
            inmobiliariaId={inmobiliariaId}
          />
        </div>
      </div>

      {/* =========================
          Publicación
         ========================= */}
      <div className="form-check mb-4">
        <input
          className="form-check-input"
          type="checkbox"
          checked={values.destacado}
          onChange={(e) =>
            handleNestedChange("destacado", null, e.target.checked)
          }
        />
        <label className="form-check-label">Destacado</label>
      </div>

      {/* =========================
          Acciones
         ========================= */}
      <div className="d-flex justify-content-end">
        <button
          type="submit"
          className="btn btn-primary px-4"
          disabled={loading}
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
