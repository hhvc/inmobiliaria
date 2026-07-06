import { useMemo } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

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

  const canManageImages =
    Boolean(inmuebleId) &&
    Boolean(inmobiliariaId) &&
    typeof onAddImages === "function";

  /* =========================================================
     Upload
     ========================================================= */

  const handleFileChange = (e) => {
    const files = e.target.files;

    if (!files || files.length === 0) return;

    onAddImages({
      files,
      inmuebleId,
      inmobiliariaId,
    });

    e.target.value = "";
  };

  /* =========================================================
     Drag & Drop
     ========================================================= */

  const handleDragEnd = (result) => {
    if (!result.destination) return;

    const fromIndex = result.source.index;
    const toIndex = result.destination.index;

    if (fromIndex === toIndex) return;

    if (typeof onReorderImages !== "function") return;

    onReorderImages(fromIndex, toIndex);
  };

  /* =========================================================
     Delete
     ========================================================= */

  const handleRemoveImage = (image) => {
    if (typeof onRemoveImage !== "function") return;

    const ok = window.confirm("¿Eliminar esta imagen del inmueble?");

    if (!ok) return;

    onRemoveImage(image);
  };

  /* =========================================================
     Render
     ========================================================= */

  return (
    <section className="inmueble-gallery">
      <header className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h3 className="h5 mb-1">Galería de imágenes</h3>
          <p className="text-muted mb-0">
            Arrastrá para ordenar · La primera imagen será la portada
          </p>
        </div>

        <label
          className={`btn btn-sm ${canManageImages ? "btn-secondary" : "btn-outline-secondary disabled"
            } mb-0`}
        >
          {loading ? "Procesando..." : "Agregar imágenes"}
          <input
            type="file"
            accept="image/*"
            multiple
            hidden
            disabled={!canManageImages || loading}
            onChange={handleFileChange}
          />
        </label>
      </header>

      {!canManageImages && (
        <div className="alert alert-info">
          Guardá primero el inmueble para poder cargar imágenes.
        </div>
      )}

      {error && <div className="alert alert-danger">{error}</div>}

      {sortedImages.length === 0 ? (
        <p className="text-muted mt-3">Todavía no hay imágenes cargadas.</p>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="inmueble-gallery" direction="horizontal">
            {(provided) => (
              <div
                className="d-flex flex-wrap gap-3"
                ref={provided.innerRef}
                {...provided.droppableProps}
              >
                {sortedImages.map((img, index) => {
                  const draggableId =
                    img.storagePath || img.url || `image-${index}`;

                  return (
                    <Draggable
                      key={draggableId}
                      draggableId={draggableId}
                      index={index}
                      isDragDisabled={loading}
                    >
                      {(dragProvided) => (
                        <div
                          ref={dragProvided.innerRef}
                          {...dragProvided.draggableProps}
                          {...dragProvided.dragHandleProps}
                          className="position-relative border rounded overflow-hidden"
                          style={{
                            width: 180,
                            minHeight: 130,
                            ...dragProvided.draggableProps.style,
                          }}
                        >
                          <img
                            src={img.url}
                            alt={`Imagen ${index + 1}`}
                            className="img-fluid"
                            style={{
                              width: "100%",
                              height: 130,
                              objectFit: "cover",
                              display: "block",
                            }}
                            loading="lazy"
                          />

                          {index === 0 && (
                            <span className="badge bg-primary position-absolute top-0 start-0 m-2">
                              Portada
                            </span>
                          )}

                          <button
                            type="button"
                            className="btn btn-sm btn-danger position-absolute top-0 end-0 m-2"
                            disabled={loading}
                            onClick={() => handleRemoveImage(img)}
                            title="Eliminar imagen"
                          >
                            ✕
                          </button>

                          <div className="small text-muted px-2 py-1 bg-light">
                            Orden: {index + 1}
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