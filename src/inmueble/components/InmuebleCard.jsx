import { useState } from "react";
import PropTypes from "prop-types";
import { deleteInmuebleImage } from "@/services/inmuebles/deleteInmuebleImage";
import { updateInmuebleImagesOrder } from "@/services/inmuebles/updateInmuebleImagesOrder";

export default function InmuebleCard({ inmobiliariaId, inmueble }) {
  const [images, setImages] = useState(
    [...(inmueble.images || [])].sort((a, b) => a.order - b.order)
  );
  const [loading, setLoading] = useState(false);

  const handleDeleteImage = async (img) => {
    if (!window.confirm("¿Eliminar esta imagen?")) return;

    try {
      setLoading(true);

      // 1️⃣ Eliminar imagen (Storage + Firestore)
      await deleteInmuebleImage({
        inmobiliariaId,
        inmuebleId: inmueble.id,
        image: img,
      });

      // 2️⃣ Reordenar imágenes restantes
      const remainingImages = images
        .filter((i) => i.storagePath !== img.storagePath)
        .map((i, index) => ({
          ...i,
          order: index,
        }));

      setImages(remainingImages);

      // 3️⃣ Persistir nuevo orden en Firestore
      await updateInmuebleImagesOrder({
        inmobiliariaId,
        inmuebleId: inmueble.id,
        images: remainingImages,
      });
    } catch (error) {
      console.error("Error eliminando imagen:", error);
      alert("No se pudo eliminar la imagen");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card mb-4 shadow-sm">
      <div className="card-body">
        <h5 className="card-title">
          {inmueble.titulo || "Inmueble sin título"}
        </h5>

        <div className="row g-3 mt-2">
          {images.length === 0 && (
            <div className="col-12">
              <p className="text-muted mb-0">Sin imágenes cargadas</p>
            </div>
          )}

          {images.map((img) => (
            <div key={img.storagePath} className="col-6 col-md-4 col-lg-3">
              <div className="position-relative border rounded overflow-hidden">
                <img
                  src={img.url}
                  alt="Imagen del inmueble"
                  className="img-fluid"
                  style={{ aspectRatio: "4 / 3", objectFit: "cover" }}
                  loading="lazy"
                />

                <button
                  type="button"
                  className="btn btn-sm btn-danger position-absolute top-0 end-0 m-1"
                  onClick={() => handleDeleteImage(img)}
                  disabled={loading}
                  title="Eliminar imagen"
                >
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>

        {loading && (
          <div className="mt-3">
            <span className="spinner-border spinner-border-sm me-2" />
            Procesando…
          </div>
        )}
      </div>
    </div>
  );
}

InmuebleCard.propTypes = {
  inmobiliariaId: PropTypes.string.isRequired,
  inmueble: PropTypes.shape({
    id: PropTypes.string.isRequired,
    titulo: PropTypes.string,
    images: PropTypes.arrayOf(
      PropTypes.shape({
        url: PropTypes.string.isRequired,
        storagePath: PropTypes.string.isRequired,
        order: PropTypes.number.isRequired,
      })
    ),
  }).isRequired,
};
