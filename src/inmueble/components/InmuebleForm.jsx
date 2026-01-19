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

  // 🔹 nuevos props necesarios para galería
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
  } = useInmuebleImages(values.images || []);

  if (initialLoading) {
    return <p>Cargando inmueble...</p>;
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit({
          ...values,
          images,
        });
      }}
      className="inmueble-form"
    >
      {/* =========================
          Información básica
         ========================= */}
      <h2>Información básica</h2>

      <div>
        <label>Título *</label>
        <input
          type="text"
          name="titulo"
          value={values.titulo}
          onChange={handleChange}
        />
        {errors.titulo && <small>{errors.titulo}</small>}
      </div>

      <div>
        <label>Descripción</label>
        <textarea
          name="descripcion"
          value={values.descripcion}
          onChange={handleChange}
        />
      </div>

      {/* =========================
          Tipo y operación
         ========================= */}
      <h2>Clasificación</h2>

      <div>
        <label>Tipo de inmueble *</label>
        <select name="tipo" value={values.tipo} onChange={handleChange}>
          {TIPOS_INMUEBLE_OPCIONES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
        {errors.tipo && <small>{errors.tipo}</small>}
      </div>

      <div>
        <label>Operación *</label>
        <select
          name="operacion"
          value={values.operacion}
          onChange={handleChange}
        >
          {OPERACIONES_OPCIONES.map((op) => (
            <option key={op.id} value={op.id}>
              {op.label}
            </option>
          ))}
        </select>
        {errors.operacion && <small>{errors.operacion}</small>}
      </div>

      {/* =========================
          Precio
         ========================= */}
      {values.operacion !== "tasacion" && (
        <>
          <h2>Precio</h2>

          <div>
            <label>Precio *</label>
            <input
              type="number"
              name="precio"
              value={values.precio}
              onChange={handleChange}
            />
            {errors.precio && <small>{errors.precio}</small>}
          </div>

          <div>
            <label>Moneda</label>
            <select name="moneda" value={values.moneda} onChange={handleChange}>
              <option value="USD">USD</option>
              <option value="ARS">ARS</option>
            </select>
          </div>

          <div>
            <label>Expensas</label>
            <input
              type="number"
              name="expensas"
              value={values.expensas}
              onChange={handleChange}
            />
          </div>
        </>
      )}

      {/* =========================
          Ubicación
         ========================= */}
      <h2>Ubicación</h2>

      <div>
        <label>Calle</label>
        <input
          type="text"
          value={values.direccion.calle}
          onChange={(e) =>
            handleNestedChange("direccion", "calle", e.target.value)
          }
        />
      </div>

      <div>
        <label>Número</label>
        <input
          type="text"
          value={values.direccion.numero}
          onChange={(e) =>
            handleNestedChange("direccion", "numero", e.target.value)
          }
        />
      </div>

      <div>
        <label>Barrio</label>
        <input
          type="text"
          value={values.direccion.barrio}
          onChange={(e) =>
            handleNestedChange("direccion", "barrio", e.target.value)
          }
        />
      </div>

      <div>
        <label>Ciudad *</label>
        <input
          type="text"
          value={values.direccion.ciudad}
          onChange={(e) =>
            handleNestedChange("direccion", "ciudad", e.target.value)
          }
        />
        {errors.ciudad && <small>{errors.ciudad}</small>}
      </div>

      {/* =========================
          Superficie
         ========================= */}
      <h2>Superficie (m²)</h2>

      <div>
        <label>Total</label>
        <input
          type="number"
          value={values.superficie.total}
          onChange={(e) =>
            handleNestedChange("superficie", "total", e.target.value)
          }
        />
      </div>

      <div>
        <label>Cubierta</label>
        <input
          type="number"
          value={values.superficie.cubierta}
          onChange={(e) =>
            handleNestedChange("superficie", "cubierta", e.target.value)
          }
        />
      </div>

      <div>
        <label>Descubierta</label>
        <input
          type="number"
          value={values.superficie.descubierta}
          onChange={(e) =>
            handleNestedChange("superficie", "descubierta", e.target.value)
          }
        />
      </div>

      {/* =========================
          Ambientes
         ========================= */}
      <h2>Ambientes</h2>

      <div>
        <label>Ambientes</label>
        <input
          type="number"
          name="ambientes"
          value={values.ambientes}
          onChange={handleChange}
        />
      </div>

      <div>
        <label>Dormitorios</label>
        <input
          type="number"
          name="dormitorios"
          value={values.dormitorios}
          onChange={handleChange}
        />
      </div>

      <div>
        <label>Baños</label>
        <input
          type="number"
          name="banos"
          value={values.banos}
          onChange={handleChange}
        />
      </div>

      <div>
        <label>Cocheras</label>
        <input
          type="number"
          name="cocheras"
          value={values.cocheras}
          onChange={handleChange}
        />
      </div>

      {/* =========================
          Galería
         ========================= */}
      <h2>Imágenes</h2>

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

      {/* =========================
          Publicación
         ========================= */}
      <h2>Publicación</h2>

      <div>
        <label>
          <input
            type="checkbox"
            checked={values.destacado}
            onChange={(e) =>
              handleNestedChange("destacado", null, e.target.checked)
            }
          />
          Destacado
        </label>
      </div>

      {/* =========================
          Acciones
         ========================= */}
      <div style={{ marginTop: "2rem" }}>
        <button type="submit" disabled={loading}>
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
