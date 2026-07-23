import { useMemo } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

import {
  ACCEPTED_IMAGE_INPUT,
  INMUEBLE_MAX_IMAGES,
  MAX_IMAGE_SIZE_BYTES,
  MAX_IMAGE_HEIGHT,
  MAX_IMAGE_WIDTH,
  MIN_IMAGE_HEIGHT,
  MIN_IMAGE_WIDTH,
} from "../helpers/uploadInmuebleImages";

const bytesToMb = (bytes) => Math.round(bytes / 1024 / 1024);

const InmuebleGallery = ({
  images = [],

  onAddImages,
  onRemoveImage,
  onReorderImages,

  loading = false,
  error = null,
  inmuebleId,
  inmobiliariaId,
}) => {
  const sortedImages = useMemo(() => {
    return [...(images || [])].sort(
      (a, b) => (a.order ?? 0) - (b.order ?? 0),
    );
  }, [images]);

  const remainingImages = Math.max(
    INMUEBLE_MAX_IMAGES - sortedImages.length,
    0,
  );

  const canManageImages =
    Boolean(inmuebleId) &&
    Boolean(inmobiliariaId) &&
    typeof onAddImages === "function";

  const canAddImages = canManageImages && remainingImages > 0 && !loading;

  const requestReorder = ({ fromIndex, toIndex }) => {
    if (loading) return;
    if (typeof onReorderImages !== "function") return;
    if (fromIndex === toIndex) return;
    if (fromIndex < 0 || toIndex < 0) return;
    if (fromIndex >= sortedImages.length || toIndex >= sortedImages.length) {
      return;
    }

    onReorderImages({
      fromIndex,
      toIndex,
      inmuebleId,
      inmobiliariaId,
    });
  };

  const handleFileChange = (e) => {
    const files = e.target.files;

    if (!files || files.length === 0) return;

    if (sortedImages.length + files.length > INMUEBLE_MAX_IMAGES) {
      window.alert(
        `Podés cargar hasta ${INMUEBLE_MAX_IMAGES} imágenes por inmueble. Te quedan ${remainingImages} lugares disponibles.`,
      );
      e.target.value = "";
      return;
    }

    onAddImages({
      files,
      inmuebleId,
      inmobiliariaId,
    });

    e.target.value = "";
  };

  const handleDragEnd = (result) => {
    if (!result.destination) return;

    requestReorder({
      fromIndex: result.source.index,
      toIndex: result.destination.index,
    });
  };

  const handleRemoveImage = (image) => {
    if (typeof onRemoveImage !== "function") return;

    const ok = window.confirm("¿Eliminar esta imagen del inmueble?");

    if (!ok) return;

    onRemoveImage(image);
  };

  return (
    <section className="inmueble-gallery">
      <header className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3 mb-3">
        <div>
          <h3 className="h5 mb-1">Galería de imágenes</h3>

          <p className="text-muted mb-1">
            Arrastrá desde la manija ⋮⋮ para ordenar · La primera imagen será la
            portada
          </p>

          <p className="small text-muted mb-0">
            Hasta {INMUEBLE_MAX_IMAGES} imágenes · máximo{" "}
            {bytesToMb(MAX_IMAGE_SIZE_BYTES)} MB cada una · JPG, PNG, WEBP,
            GIF, BMP, HEIC/HEIF · resolución mínima {MIN_IMAGE_WIDTH} x{" "}
            {MIN_IMAGE_HEIGHT}px · máxima {MAX_IMAGE_WIDTH} x{" "}
            {MAX_IMAGE_HEIGHT}px.
          </p>

          <p className="small text-muted mb-0">
            ONO Prop guarda una versión optimizada para portales y una miniatura
            para listados.
          </p>
        </div>

        <div className="text-lg-end">
          <div className="small text-muted mb-2">
            {sortedImages.length}/{INMUEBLE_MAX_IMAGES} imágenes cargadas
          </div>

          <label
            className={`btn btn-sm ${canAddImages ? "btn-secondary" : "btn-outline-secondary disabled"
              } mb-0`}
          >
            {loading
              ? "Procesando..."
              : remainingImages > 0
                ? "Agregar imágenes"
                : "Límite alcanzado"}

            <input
              type="file"
              accept={ACCEPTED_IMAGE_INPUT}
              multiple
              hidden
              disabled={!canAddImages}
              onChange={handleFileChange}
            />
          </label>
        </div>
      </header>

      {!canManageImages && (
        <div className="alert alert-info">
          Guardá primero el inmueble para poder cargar imágenes.
        </div>
      )}

      {canManageImages && remainingImages === 0 && (
        <div className="alert alert-warning">
          Ya alcanzaste el máximo de {INMUEBLE_MAX_IMAGES} imágenes para este
          inmueble.
        </div>
      )}

      {error && <div className="alert alert-danger">{error}</div>}

      {sortedImages.length === 0 ? (
        <p className="text-muted mt-3">Todavía no hay imágenes cargadas.</p>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="inmueble-gallery" direction="vertical">
            {(provided) => (
              <div
                className="list-group"
                ref={provided.innerRef}
                {...provided.droppableProps}
              >
                {sortedImages.map((img, index) => {
                  const draggableId = String(
                    img.id || img.storagePath || img.url || `image-${index}`,
                  );

                  const previewUrl = img.thumbnailUrl || img.url;
                  const dimensions =
                    img.width && img.height
                      ? `${img.width} x ${img.height}px`
                      : "";

                  return (
                    <Draggable
                      key={draggableId}
                      draggableId={draggableId}
                      index={index}
                      isDragDisabled={loading}
                      disableInteractiveElementBlocking
                    >
                      {(dragProvided, snapshot) => (
                        <div
                          ref={dragProvided.innerRef}
                          {...dragProvided.draggableProps}
                          className={`list-group-item ${snapshot.isDragging ? "shadow" : ""
                            }`}
                          style={{
                            ...dragProvided.draggableProps.style,
                            userSelect: "none",
                          }}
                        >
                          <div className="d-flex align-items-center gap-3">
                            <span
                              className={`btn btn-light border ${loading ? "disabled" : ""}`}
                              title="Arrastrar para ordenar"
                              role="button"
                              tabIndex={0}
                              style={{
                                cursor: loading ? "not-allowed" : "grab",
                                touchAction: "none",
                                userSelect: "none",
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                minWidth: 42,
                                minHeight: 38,
                              }}
                              {...dragProvided.dragHandleProps}
                            >
                              ⋮⋮
                            </span>

                            <div
                              className="position-relative flex-shrink-0 border rounded overflow-hidden bg-light"
                              style={{ width: 120, height: 82 }}
                            >
                              <img
                                src={previewUrl}
                                alt={`Imagen ${index + 1}`}
                                draggable={false}
                                className="img-fluid"
                                style={{
                                  width: "100%",
                                  height: "100%",
                                  objectFit: "cover",
                                  display: "block",
                                  pointerEvents: "none",
                                }}
                                loading="lazy"
                              />

                              {index === 0 && (
                                <span className="badge bg-primary position-absolute top-0 start-0 m-1">
                                  Portada
                                </span>
                              )}
                            </div>

                            <div className="flex-grow-1 min-width-0">
                              <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
                                <strong>Imagen {index + 1}</strong>

                                {img.portalReady !== false ? (
                                  <span className="badge bg-success">
                                    Apta portales
                                  </span>
                                ) : (
                                  <span className="badge bg-warning text-dark">
                                    Revisar
                                  </span>
                                )}
                              </div>

                              <div className="small text-muted text-truncate">
                                {img.filename || img.name || "Sin nombre"}
                              </div>

                              {dimensions && (
                                <div className="small text-muted">
                                  {dimensions}
                                </div>
                              )}

                              {Array.isArray(img.qualityWarnings) &&
                                img.qualityWarnings.length > 0 && (
                                  <div className="small text-warning">
                                    {img.qualityWarnings[0]}
                                  </div>
                                )}
                            </div>

                            <div className="d-flex flex-column flex-sm-row gap-2">
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary"
                                disabled={loading || index === 0}
                                onClick={() =>
                                  requestReorder({
                                    fromIndex: index,
                                    toIndex: index - 1,
                                  })
                                }
                              >
                                ↑
                              </button>

                              <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary"
                                disabled={
                                  loading || index === sortedImages.length - 1
                                }
                                onClick={() =>
                                  requestReorder({
                                    fromIndex: index,
                                    toIndex: index + 1,
                                  })
                                }
                              >
                                ↓
                              </button>

                              <button
                                type="button"
                                className="btn btn-sm btn-outline-danger"
                                disabled={loading}
                                onClick={() => handleRemoveImage(img)}
                                title="Eliminar imagen"
                              >
                                Eliminar
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </Draggable>
                  );
                })}

                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      )}

      {loading && (
        <div className="mt-3 text-muted">
          <span className="spinner-border spinner-border-sm me-2" />
          Procesando imágenes...
        </div>
      )}
    </section>
  );
};

export default InmuebleGallery;