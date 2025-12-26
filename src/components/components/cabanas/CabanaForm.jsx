import { useRef } from "react";
import { useCabanaForm } from "../../../hooks/useCabanaForm";

const CabanaForm = ({
  cabanaExistente = null,
  onSave,
  onCancel,
  loading = false,
}) => {
  const fileInputRef = useRef();

  const {
    formData,
    errors,
    uploadingImages,
    loading: internalLoading,
    handleInputChange,
    handleFileUpload,
    handleSubmit,
    addCampoArray,
    removeCampoArray,
    updateCampoArray,
    removeImagen,
    addTemporada,
    removeTemporada,
    updateTemporada,
  } = useCabanaForm(cabanaExistente, onSave);

  const isSubmitting = loading || internalLoading;

  const handleFileInputChange = async (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    await handleFileUpload(files);

    // Limpiar el input de archivo
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Opciones para días de la semana
  const diasSemanaOptions = [
    { value: 0, label: "Domingo" },
    { value: 1, label: "Lunes" },
    { value: 2, label: "Martes" },
    { value: 3, label: "Miércoles" },
    { value: 4, label: "Jueves" },
    { value: 5, label: "Viernes" },
    { value: 6, label: "Sábado" },
  ];

  // Función para validar capacidades
  const validarCapacidades = () => {
    const maxAdultos = formData.capacidad?.maxAdultos || 0;
    const maxMenores = formData.capacidad?.maxMenores || 0;
    const maxPersonas = formData.capacidad?.maxPersonas || 0;

    if (maxPersonas > maxAdultos + maxMenores) {
      return `El máximo total de personas (${maxPersonas}) no puede ser mayor que la suma de adultos (${maxAdultos}) + menores (${maxMenores}) = ${
        maxAdultos + maxMenores
      }`;
    }

    if (maxPersonas < 1) {
      return "El máximo total de personas debe ser al menos 1";
    }

    if (maxAdultos < 1) {
      return "Debe haber al menos 1 adulto permitido";
    }

    return null;
  };

  // Manejar cambios en capacidades con validación
  const handleCapacidadChange = (field, value) => {
    const numValue = parseInt(value) || 0;

    // Actualizar el campo
    handleInputChange(`capacidad.${field}`, numValue);

    // Validar después del cambio
    const error = validarCapacidades();
    if (error) {
      // Podrías mostrar este error de alguna manera, por ahora solo console.log
      console.warn("Error de validación:", error);
    }
  };

  return (
    <div className="card mt-5">
      <div
        className={`card-header ${
          cabanaExistente ? "bg-warning" : "bg-primary"
        } text-white`}
      >
        <h5 className="mb-0">
          {cabanaExistente ? "✏️ Editar Cabaña" : "🏡 Nueva Cabaña"}
        </h5>
      </div>
      <div className="card-body">
        <form onSubmit={handleSubmit}>
          {/* Información Básica */}
          <div className="row">
            <div className="col-md-6">
              <div className="mb-3">
                <label className="form-label">
                  Nombre de la cabaña <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  className={`form-control ${
                    errors.nombre ? "is-invalid" : ""
                  }`}
                  value={formData.nombre}
                  onChange={(e) => handleInputChange("nombre", e.target.value)}
                  placeholder="Ej: Casa Aromillo"
                  required
                />
                {errors.nombre && (
                  <div className="invalid-feedback">{errors.nombre}</div>
                )}
              </div>

              <div className="mb-3">
                <label className="form-label">Descripción</label>
                <textarea
                  className="form-control"
                  value={formData.descripcion}
                  onChange={(e) =>
                    handleInputChange("descripcion", e.target.value)
                  }
                  rows="3"
                  placeholder="Describe las características especiales de la cabaña..."
                />
                <small className="form-text text-muted">
                  Esta descripción aparecerá en la página principal
                </small>
              </div>
            </div>

            <div className="col-md-6">
              <div className="row">
                <div className="col-md-6">
                  <div className="mb-3">
                    <label className="form-label">
                      Metros Cuadrados <span className="text-danger">*</span>
                    </label>
                    <input
                      type="number"
                      className={`form-control ${
                        errors.metrosCuadrados ? "is-invalid" : ""
                      }`}
                      value={formData.metrosCuadrados}
                      onChange={(e) =>
                        handleInputChange("metrosCuadrados", e.target.value)
                      }
                      min="1"
                      required
                    />
                    {errors.metrosCuadrados && (
                      <div className="invalid-feedback">
                        {errors.metrosCuadrados}
                      </div>
                    )}
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="mb-3">
                    <label className="form-label">
                      Dormitorios <span className="text-danger">*</span>
                    </label>
                    <input
                      type="number"
                      className={`form-control ${
                        errors.dormitorios ? "is-invalid" : ""
                      }`}
                      value={formData.dormitorios}
                      onChange={(e) =>
                        handleInputChange("dormitorios", e.target.value)
                      }
                      min="1"
                      required
                    />
                    {errors.dormitorios && (
                      <div className="invalid-feedback">
                        {errors.dormitorios}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label">
                  Orden de visualización <span className="text-danger">*</span>
                </label>
                <input
                  type="number"
                  className={`form-control ${errors.orden ? "is-invalid" : ""}`}
                  value={formData.orden}
                  onChange={(e) => handleInputChange("orden", e.target.value)}
                  min="0"
                  required
                />
                {errors.orden && (
                  <div className="invalid-feedback">{errors.orden}</div>
                )}
                <small className="form-text text-muted">
                  Menor número = se muestra primero
                </small>
              </div>
            </div>
          </div>

          {/* NUEVA: Configuración de Capacidades Detalladas */}
          <div className="mb-4">
            <div className="card bg-light">
              <div className="card-header bg-info text-white">
                <h6 className="mb-0">👥 Configuración de Capacidades</h6>
              </div>
              <div className="card-body">
                <div className="row">
                  <div className="col-md-4">
                    <div className="mb-3">
                      <label className="form-label fw-bold">
                        Máximo de Adultos <span className="text-danger">*</span>
                      </label>
                      <input
                        type="number"
                        className="form-control"
                        value={formData.capacidad?.maxAdultos || ""}
                        onChange={(e) =>
                          handleCapacidadChange("maxAdultos", e.target.value)
                        }
                        min="1"
                        max="20"
                        required
                      />
                      <small className="form-text text-muted">
                        Número máximo de adultos permitidos
                      </small>
                    </div>
                  </div>

                  <div className="col-md-4">
                    <div className="mb-3">
                      <label className="form-label fw-bold">
                        Máximo de Menores <span className="text-danger">*</span>
                      </label>
                      <input
                        type="number"
                        className="form-control"
                        value={formData.capacidad?.maxMenores || ""}
                        onChange={(e) =>
                          handleCapacidadChange("maxMenores", e.target.value)
                        }
                        min="0"
                        max="20"
                        required
                      />
                      <small className="form-text text-muted">
                        Número máximo de menores permitidos (3-12 años)
                      </small>
                    </div>
                  </div>

                  <div className="col-md-4">
                    <div className="mb-3">
                      <label className="form-label fw-bold">
                        Máximo Total de Personas{" "}
                        <span className="text-danger">*</span>
                      </label>
                      <input
                        type="number"
                        className="form-control"
                        value={formData.capacidad?.maxPersonas || ""}
                        onChange={(e) =>
                          handleCapacidadChange("maxPersonas", e.target.value)
                        }
                        min="1"
                        max="40"
                        required
                      />
                      <small className="form-text text-muted">
                        Máximo total: {formData.capacidad?.maxAdultos || 0}{" "}
                        adultos + {formData.capacidad?.maxMenores || 0} menores
                        =
                        <strong>
                          {" "}
                          {(formData.capacidad?.maxAdultos || 0) +
                            (formData.capacidad?.maxMenores || 0)}
                        </strong>
                      </small>
                    </div>
                  </div>
                </div>

                {/* Resumen de capacidades */}
                <div className="alert alert-info py-2 small">
                  <strong>📊 Resumen de Capacidades:</strong>
                  <br />• Máximo de adultos:{" "}
                  <strong>{formData.capacidad?.maxAdultos || 0}</strong>
                  <br />• Máximo de menores:{" "}
                  <strong>{formData.capacidad?.maxMenores || 0}</strong>
                  <br />• Máximo total de personas:{" "}
                  <strong>{formData.capacidad?.maxPersonas || 0}</strong>
                  <br />• Capacidad base (2 adultos incluidos):{" "}
                  <strong>2</strong> adultos
                </div>
              </div>
            </div>
          </div>

          {/* NUEVA: Configuración de Precios por Temporada */}
          <div className="mb-4">
            <div className="card bg-light">
              <div className="card-header bg-success text-white">
                <h6 className="mb-0">💰 Sistema de Precios por Temporada</h6>
              </div>
              <div className="card-body">
                {/* Precio Base */}
                <div className="row mb-4">
                  <div className="col-md-6">
                    <div className="mb-3">
                      <label className="form-label fw-bold">
                        Precio Base por Noche{" "}
                        <span className="text-danger">*</span>
                      </label>
                      <div className="input-group">
                        <span className="input-group-text">$</span>
                        <input
                          type="number"
                          step="0.01"
                          className={`form-control ${
                            errors.precioBase ? "is-invalid" : ""
                          }`}
                          value={formData.precios?.base || ""}
                          onChange={(e) =>
                            handleInputChange("precios.base", e.target.value)
                          }
                          min="0"
                          placeholder="Ej: 150"
                          required
                        />
                      </div>
                      {errors.precioBase && (
                        <div className="invalid-feedback d-block">
                          {errors.precioBase}
                        </div>
                      )}
                      <small className="form-text text-muted">
                        Precio estándar por noche (incluye 2 adultos). Las
                        temporadas se calculan como multiplicadores de este
                        precio.
                      </small>
                    </div>
                  </div>
                </div>

                {/* Precios Adicionales por Personas */}
                <div className="row mb-4">
                  <div className="col-md-4">
                    <div className="mb-3">
                      <label className="form-label fw-bold">
                        Precio Adicional por Adulto{" "}
                        <span className="text-danger">*</span>
                      </label>
                      <div className="input-group">
                        <span className="input-group-text">$</span>
                        <input
                          type="number"
                          className="form-control"
                          value={formData.precios?.adicionalAdulto || ""}
                          onChange={(e) =>
                            handleInputChange(
                              "precios.adicionalAdulto",
                              parseInt(e.target.value) || 0
                            )
                          }
                          min="0"
                          required
                        />
                      </div>
                      <small className="form-text text-muted">
                        Cargo adicional por cada adulto extra (más de 2)
                      </small>
                    </div>
                  </div>

                  <div className="col-md-4">
                    <div className="mb-3">
                      <label className="form-label fw-bold">
                        Precio Adicional por Menor{" "}
                        <span className="text-danger">*</span>
                      </label>
                      <div className="input-group">
                        <span className="input-group-text">$</span>
                        <input
                          type="number"
                          className="form-control"
                          value={formData.precios?.adicionalMenor || ""}
                          onChange={(e) =>
                            handleInputChange(
                              "precios.adicionalMenor",
                              parseInt(e.target.value) || 0
                            )
                          }
                          min="0"
                          required
                        />
                      </div>
                      <small className="form-text text-muted">
                        Cargo adicional por cada menor (3-12 años)
                      </small>
                    </div>
                  </div>

                  <div className="col-md-4">
                    <div className="mb-3">
                      <label className="form-label fw-bold">
                        Precio Adicional por Menor 3 años{" "}
                        <span className="text-danger">*</span>
                      </label>
                      <div className="input-group">
                        <span className="input-group-text">$</span>
                        <input
                          type="number"
                          className="form-control"
                          value={formData.precios?.adicionalMenor3 || ""}
                          onChange={(e) =>
                            handleInputChange(
                              "precios.adicionalMenor3",
                              parseInt(e.target.value) || 0
                            )
                          }
                          min="0"
                          required
                        />
                      </div>
                      <small className="form-text text-muted">
                        Cargo adicional por cada menor menor de 3 años
                      </small>
                    </div>
                  </div>
                </div>

                {/* Resumen de precios adicionales */}
                <div className="alert alert-warning py-2 small">
                  <strong>💡 Información de Precios Adicionales:</strong>
                  <br />• Precio base incluye: <strong>2 adultos</strong>
                  <br />• Adultos extra:{" "}
                  <strong>
                    +${formData.precios?.adicionalAdulto || 0}
                  </strong>{" "}
                  por adulto por noche
                  <br />• Menores (3-12 años):{" "}
                  <strong>+${formData.precios?.adicionalMenor || 0}</strong> por
                  menor por noche
                  <br />• Menores {"<"} 3 años:{" "}
                  <strong>+${formData.precios?.adicionalMenor3 || 0}</strong>{" "}
                  por menor por noche
                </div>

                {/* Temporadas */}
                <div className="mb-3">
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <label className="form-label fw-bold">
                      Temporadas Especiales
                    </label>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={addTemporada}
                    >
                      ➕ Agregar Temporada
                    </button>
                  </div>

                  {formData.precios?.temporadas?.map((temporada, index) => (
                    <div key={index} className="card mb-3 border-primary">
                      <div className="card-header bg-primary text-white py-2 d-flex justify-content-between align-items-center">
                        <span>Temporada {index + 1}</span>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() => removeTemporada(index)}
                        >
                          ✕ Eliminar
                        </button>
                      </div>
                      <div className="card-body">
                        <div className="row">
                          <div className="col-md-6">
                            <div className="mb-3">
                              <label className="form-label">
                                Nombre de la Temporada
                              </label>
                              <input
                                type="text"
                                className="form-control"
                                value={temporada.nombre}
                                onChange={(e) =>
                                  updateTemporada(
                                    index,
                                    "nombre",
                                    e.target.value
                                  )
                                }
                                placeholder="Ej: Temporada Alta Verano"
                              />
                            </div>
                          </div>
                          <div className="col-md-6">
                            <div className="mb-3">
                              <label className="form-label">Tipo</label>
                              <select
                                className="form-select"
                                value={temporada.tipo || "fechas"}
                                onChange={(e) =>
                                  updateTemporada(index, "tipo", e.target.value)
                                }
                              >
                                <option value="fechas">
                                  Por Fechas Específicas
                                </option>
                                <option value="diasSemana">
                                  Por Días de la Semana
                                </option>
                              </select>
                            </div>
                          </div>
                        </div>

                        <div className="row">
                          <div className="col-md-4">
                            <div className="mb-3">
                              <label className="form-label">
                                Multiplicador
                              </label>
                              <div className="input-group">
                                <input
                                  type="number"
                                  step="0.1"
                                  min="1"
                                  max="3"
                                  className="form-control"
                                  value={temporada.multiplicador || 1}
                                  onChange={(e) =>
                                    updateTemporada(
                                      index,
                                      "multiplicador",
                                      parseFloat(e.target.value)
                                    )
                                  }
                                  placeholder="1.5"
                                />
                                <span className="input-group-text">x</span>
                              </div>
                              <small className="form-text text-muted">
                                Ej: 1.5 = 150% del precio base
                              </small>
                            </div>
                          </div>

                          {/* Campos según el tipo de temporada */}
                          {temporada.tipo === "fechas" ? (
                            <>
                              <div className="col-md-4">
                                <div className="mb-3">
                                  <label className="form-label">
                                    Fecha Inicio
                                  </label>
                                  <input
                                    type="date"
                                    className="form-control"
                                    value={temporada.fechaInicio || ""}
                                    onChange={(e) =>
                                      updateTemporada(
                                        index,
                                        "fechaInicio",
                                        e.target.value
                                      )
                                    }
                                  />
                                </div>
                              </div>
                              <div className="col-md-4">
                                <div className="mb-3">
                                  <label className="form-label">
                                    Fecha Fin
                                  </label>
                                  <input
                                    type="date"
                                    className="form-control"
                                    value={temporada.fechaFin || ""}
                                    onChange={(e) =>
                                      updateTemporada(
                                        index,
                                        "fechaFin",
                                        e.target.value
                                      )
                                    }
                                  />
                                </div>
                              </div>
                            </>
                          ) : (
                            <div className="col-md-8">
                              <div className="mb-3">
                                <label className="form-label">
                                  Días de la Semana
                                </label>
                                <div className="d-flex flex-wrap gap-2">
                                  {diasSemanaOptions.map((dia) => (
                                    <div key={dia.value} className="form-check">
                                      <input
                                        type="checkbox"
                                        className="form-check-input"
                                        id={`temporada-${index}-dia-${dia.value}`}
                                        checked={
                                          temporada.diasSemana?.includes(
                                            dia.value
                                          ) || false
                                        }
                                        onChange={(e) => {
                                          const currentDias =
                                            temporada.diasSemana || [];
                                          let newDias;
                                          if (e.target.checked) {
                                            newDias = [
                                              ...currentDias,
                                              dia.value,
                                            ];
                                          } else {
                                            newDias = currentDias.filter(
                                              (d) => d !== dia.value
                                            );
                                          }
                                          updateTemporada(
                                            index,
                                            "diasSemana",
                                            newDias
                                          );
                                        }}
                                      />
                                      <label
                                        className="form-check-label small"
                                        htmlFor={`temporada-${index}-dia-${dia.value}`}
                                      >
                                        {dia.label}
                                      </label>
                                    </div>
                                  ))}
                                </div>
                                <small className="form-text text-muted">
                                  Selecciona los días que aplican para esta
                                  temporada
                                </small>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Resumen de la temporada */}
                        <div className="alert alert-info py-2 small">
                          <strong>Resumen:</strong>{" "}
                          {temporada.nombre || "Sin nombre"} - Multiplicador:{" "}
                          {temporada.multiplicador || 1}x = $
                          {(
                            (formData.precios?.base || 0) *
                            (temporada.multiplicador || 1)
                          ).toFixed(2)}{" "}
                          por noche
                          {temporada.tipo === "fechas" &&
                            temporada.fechaInicio &&
                            temporada.fechaFin && (
                              <span>
                                {" "}
                                | Aplica del {temporada.fechaInicio} al{" "}
                                {temporada.fechaFin}
                              </span>
                            )}
                          {temporada.tipo === "diasSemana" &&
                            temporada.diasSemana &&
                            temporada.diasSemana.length > 0 && (
                              <span>
                                {" "}
                                | Aplica los:{" "}
                                {temporada.diasSemana
                                  .map(
                                    (d) =>
                                      diasSemanaOptions.find(
                                        (opt) => opt.value === d
                                      )?.label
                                  )
                                  .join(", ")}
                              </span>
                            )}
                        </div>
                      </div>
                    </div>
                  ))}

                  {(!formData.precios?.temporadas ||
                    formData.precios.temporadas.length === 0) && (
                    <div className="text-center text-muted py-4">
                      <p>No hay temporadas configuradas</p>
                      <small>
                        Las temporadas te permiten establecer precios diferentes
                        según fechas específicas o días de la semana.
                      </small>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Características */}
          <div className="mb-3">
            <label className="form-label">Características</label>
            {formData.caracteristicas.map((caracteristica, index) => (
              <div key={index} className="input-group mb-2">
                <input
                  type="text"
                  className="form-control"
                  value={caracteristica}
                  onChange={(e) =>
                    updateCampoArray("caracteristicas", index, e.target.value)
                  }
                  placeholder="Ej: Vista al lago, Pileta, Cocina equipada, WiFi gratuito, etc."
                />
                <button
                  type="button"
                  className="btn btn-outline-danger"
                  onClick={() => removeCampoArray("caracteristicas", index)}
                  disabled={formData.caracteristicas.length === 1}
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              onClick={() => addCampoArray("caracteristicas")}
            >
              ➕ Agregar Característica
            </button>
          </div>

          {/* Imágenes */}
          <div className="mb-3">
            <label className="form-label">
              Imágenes <span className="text-danger">*</span>
            </label>

            {/* Subida de archivos */}
            <div className="mb-3">
              <label className="form-label fw-bold">
                Subir imágenes desde tu computadora:
              </label>
              <input
                type="file"
                ref={fileInputRef}
                className="form-control"
                multiple
                accept="image/*"
                onChange={handleFileInputChange}
                disabled={uploadingImages.length > 0}
              />
              <small className="form-text text-muted">
                Puedes seleccionar múltiples imágenes. Se redimensionarán
                automáticamente.
              </small>

              {uploadingImages.length > 0 && (
                <div className="mt-2">
                  <div
                    className="spinner-border spinner-border-sm me-2"
                    role="status"
                  ></div>
                  <small>Subiendo {uploadingImages.length} imagen(es)...</small>
                </div>
              )}
            </div>

            {/* URLs de imágenes existentes */}
            <label className="form-label">O ingresar URLs de imágenes:</label>
            {errors.imagenes && (
              <div className="alert alert-danger small">{errors.imagenes}</div>
            )}

            {formData.imagenes.map((imagen, index) => (
              <div key={index} className="input-group mb-2">
                <input
                  type="url"
                  className="form-control"
                  value={imagen}
                  onChange={(e) =>
                    updateCampoArray("imagenes", index, e.target.value)
                  }
                  placeholder="https://ejemplo.com/imagen.jpg"
                />
                <button
                  type="button"
                  className="btn btn-outline-danger"
                  onClick={() => removeImagen(index)}
                  disabled={formData.imagenes.length === 1}
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              onClick={() => addCampoArray("imagenes")}
            >
              ➕ Agregar URL de Imagen
            </button>

            {/* Vista previa de imágenes */}
            {formData.imagenes.filter((img) => img.trim() !== "").length >
              0 && (
              <div className="mt-3">
                <label className="form-label">Vista previa de imágenes:</label>
                <div className="row">
                  {formData.imagenes
                    .filter((img) => img.trim() !== "")
                    .map((imagen, index) => (
                      <div key={index} className="col-md-3 mb-2">
                        <div className="card">
                          <img
                            src={imagen}
                            className="card-img-top"
                            alt={`Vista previa ${index + 1}`}
                            style={{ height: "100px", objectFit: "cover" }}
                            onError={(e) => {
                              e.target.src =
                                "https://via.placeholder.com/150x100?text=Error+Imagen";
                            }}
                          />
                          <div className="card-body p-2">
                            <small className="text-muted">
                              Imagen {index + 1}
                            </small>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>

          {/* Opciones */}
          <div className="mb-4">
            <div className="row">
              <div className="col-md-6">
                <div className="form-check form-switch mb-2">
                  <input
                    type="checkbox"
                    className="form-check-input"
                    checked={formData.disponible}
                    onChange={(e) =>
                      handleInputChange("disponible", e.target.checked)
                    }
                    id="disponibleSwitch"
                  />
                  <label
                    className="form-check-label"
                    htmlFor="disponibleSwitch"
                  >
                    ✅ Disponible para reservas
                  </label>
                </div>
              </div>
              <div className="col-md-6">
                <div className="form-check form-switch mb-2">
                  <input
                    type="checkbox"
                    className="form-check-input"
                    checked={formData.destacada}
                    onChange={(e) =>
                      handleInputChange("destacada", e.target.checked)
                    }
                    id="destacadaSwitch"
                  />
                  <label className="form-check-label" htmlFor="destacadaSwitch">
                    ⭐ Cabaña destacada
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Botones de acción */}
          <div className="d-flex gap-2 flex-wrap">
            <button
              type="submit"
              className="btn btn-success"
              disabled={isSubmitting || uploadingImages.length > 0}
            >
              {isSubmitting ? (
                <>
                  <span
                    className="spinner-border spinner-border-sm me-2"
                    role="status"
                  ></span>
                  Guardando...
                </>
              ) : cabanaExistente ? (
                "💾 Actualizar Cabaña"
              ) : (
                "🏡 Crear Cabaña"
              )}
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={onCancel}
              disabled={isSubmitting || uploadingImages.length > 0}
            >
              ❌ Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CabanaForm;
