import React, { useState, useMemo } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

/**
 * props esperadas:
 * - images
 * - trashedImages
 * - loading
 * - error
 * - inmuebleId
 * - inmobiliariaId
 *
 * - onAddImages
 * - onReorderImages
 * - onTrashImagesBatch
 * - onDeleteImagesBatch
 * - onRestoreImagesBatch
 */
const InmuebleGallery = ({
  images = [],
  trashedImages = [],

  onAddImages,
  onReorderImages,
  onTrashImagesBatch,
  onDeleteImagesBatch,
  onRestoreImagesBatch,

  loading = false,
  error = null,
  inmuebleId,
  inmobiliariaId,
}) => {
  /* =========================================================
   * State
   * ========================================================= */

  const [selected, setSelected] = useState([]);
  const [view, setView] = useState("gallery"); // gallery | trash

  const currentImages = useMemo(() => {
    return view === "gallery" ? images : trashedImages;
  }, [view, images, trashedImages]);

  /* =========================================================
   * Upload
   * ========================================================= */

  const handleFileChange = (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    onAddImages({
      files,
      inmuebleId,
      inmobiliariaId,
    });

    e.target.value = null;
  };

  /* =========================================================
   * Selection
   * ========================================================= */

  const toggleSelect = (index) => {
    setSelected((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  };

  const clearSelection = () => setSelected([]);

  const allSelected = useMemo(() => {
    if (currentImages.length === 0) return false;
    return selected.length === currentImages.length;
  }, [selected, currentImages]);

  const toggleSelectAll = () => {
    if (allSelected) {
      clearSelection();
    } else {
      setSelected(currentImages.map((_, i) => i));
    }
  };

  const hasSelection = selected.length > 0;

  /* =========================================================
   * Drag & Drop (solo galería)
   * ========================================================= */

  const handleDragEnd = (result) => {
    if (view !== "gallery") return;
    if (!result.destination) return;

    const from = result.source.index;
    const to = result.destination.index;

    if (from === to) return;

    onReorderImages(from, to);
  };

  /* =========================================================
   * Batch actions
   * ========================================================= */

  const handleTrash = () => {
    onTrashImagesBatch({
      indexes: selected,
      inmuebleId,
      inmobiliariaId,
    });
    clearSelection();
  };

  const handleDelete = () => {
    if (
      !window.confirm("¿Eliminar definitivamente las imágenes seleccionadas?")
    )
      return;

    onDeleteImagesBatch({
      indexes: selected,
      inmuebleId,
      inmobiliariaId,
    });
    clearSelection();
  };

  const handleRestore = () => {
    onRestoreImagesBatch({
      indexes: selected,
      inmuebleId,
      inmobiliariaId,
    });
    clearSelection();
  };

  /* =========================================================
   * Render
   * ========================================================= */

  return (
    <section className="inmueble-gallery">
      <header className="gallery-header d-flex justify-content-between align-items-center mb-3">
        <div>
          <h3 className="mb-1">Galería de imágenes</h3>
          <p className="text-muted mb-0">
            Arrastrá para ordenar · Máx. 15 imágenes
          </p>
        </div>

        <div className="btn-group">
          <button
            className={`btn btn-sm ${
              view === "gallery" ? "btn-primary" : "btn-outline-primary"
            }`}
            onClick={() => {
              setView("gallery");
              clearSelection();
            }}
          >
            Galería
          </button>

          <button
            className={`btn btn-sm ${
              view === "trash" ? "btn-danger" : "btn-outline-danger"
            }`}
            onClick={() => {
              setView("trash");
              clearSelection();
            }}
          >
            Papelera
          </button>
        </div>
      </header>

      {/* ================= Actions ================= */}

      {view === "gallery" && (
        <div className="d-flex justify-content-between align-items-center mb-2">
          <label className="btn btn-secondary btn-sm mb-0">
            {loading ? "Subiendo..." : "Agregar imágenes"}
            <input
              type="file"
              accept="image/*"
              multiple
              hidden
              disabled={loading}
              onChange={handleFileChange}
            />
          </label>

          {currentImages.length > 0 && (
            <div className="form-check">
              <input
                className="form-check-input"
                type="checkbox"
                id="selectAllImages"
                checked={allSelected}
                onChange={toggleSelectAll}
              />
              <label className="form-check-label" htmlFor="selectAllImages">
                Seleccionar todas
              </label>
            </div>
          )}
        </div>
      )}

      {hasSelection && (
        <div className="alert alert-light d-flex gap-2 align-items-center">
          <strong>{selected.length}</strong> seleccionadas
          {view === "gallery" && (
            <button className="btn btn-warning btn-sm" onClick={handleTrash}>
              Enviar a papelera
            </button>
          )}
          {view === "trash" && (
            <>
              <button
                className="btn btn-success btn-sm"
                onClick={handleRestore}
              >
                Restaurar
              </button>

              <button className="btn btn-danger btn-sm" onClick={handleDelete}>
                Eliminar definitivo
              </button>
            </>
          )}
          <button
            className="btn btn-outline-secondary btn-sm ms-auto"
            onClick={clearSelection}
          >
            Cancelar
          </button>
        </div>
      )}

      {error && <div className="alert alert-danger">{error}</div>}

      {currentImages.length === 0 && (
        <p className="text-muted mt-3">
          {view === "gallery"
            ? "Todavía no hay imágenes cargadas"
            : "La papelera está vacía"}
        </p>
      )}

      {/* ================= Grid ================= */}

      {currentImages.length > 0 && (
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="gallery" direction="horizontal">
            {(provided) => (
              <div
                className="gallery-grid d-flex flex-wrap gap-2"
                ref={provided.innerRef}
                {...provided.droppableProps}
              >
                {currentImages.map((img, index) => {
                  const draggableId =
                    img.id || img.storagePath || `${img.url}-${index}`;

                  const content = (
                    <div className="gallery-item position-relative">
                      <input
                        type="checkbox"
                        className="form-check-input position-absolute"
                        style={{ top: 8, left: 8 }}
                        checked={selected.includes(index)}
                        onChange={() => toggleSelect(index)}
                      />

                      <img
                        src={img.url}
                        alt={`Imagen ${index + 1}`}
                        loading="lazy"
                      />

                      {view === "gallery" && index === 0 && (
                        <span className="gallery-badge">Portada</span>
                      )}
                    </div>
                  );

                  if (view === "trash") {
                    return <div key={draggableId}>{content}</div>;
                  }

                  return (
                    <Draggable
                      key={draggableId}
                      draggableId={draggableId}
                      index={index}
                    >
                      {(provided) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                        >
                          {content}
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
    </section>
  );
};

export default InmuebleGallery;
