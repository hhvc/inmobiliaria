import { useState, useCallback, useEffect, useMemo } from "react";

const Gallery = () => {
  const [selectedImage, setSelectedImage] = useState(null);

  // Memorizar el array de imágenes
  const galleryImages = useMemo(
    () => [
      "/assets/img/fotos/Foto_1.jpg",
      "/assets/img/fotos/Foto_2.jpg",
      "/assets/img/fotos/Foto_3.jpg",
      "/assets/img/fotos/Foto_4.jpg",
      "/assets/img/fotos/Foto_5.jpg",
      "/assets/img/fotos/Foto_6.jpg",
      "/assets/img/fotos/Foto_7.jpg",
      "/assets/img/fotos/Foto_8.jpg",
      "/assets/img/fotos/Foto_9.jpg",
      "/assets/img/fotos/Foto_10.jpg",
      "/assets/img/fotos/Foto_11.jpg",
      "/assets/img/fotos/Foto_12.jpg",
      "/assets/img/fotos/Foto_13.jpg",
      "/assets/img/fotos/Foto_14.jpg",
      "/assets/img/fotos/Foto_15.jpg",
      "/assets/img/fotos/Foto_16.jpg",
    ],
    []
  );

  const openImageModal = (imageSrc) => {
    setSelectedImage(imageSrc);
  };

  const closeImageModal = () => {
    setSelectedImage(null);
  };

  const nextImage = useCallback(() => {
    const currentIndex = galleryImages.indexOf(selectedImage);
    const nextIndex = (currentIndex + 1) % galleryImages.length;
    setSelectedImage(galleryImages[nextIndex]);
  }, [galleryImages, selectedImage]);

  const prevImage = useCallback(() => {
    const currentIndex = galleryImages.indexOf(selectedImage);
    const prevIndex =
      (currentIndex - 1 + galleryImages.length) % galleryImages.length;
    setSelectedImage(galleryImages[prevIndex]);
  }, [galleryImages, selectedImage]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (selectedImage) {
        if (e.key === "Escape") {
          closeImageModal();
        } else if (e.key === "ArrowRight") {
          nextImage();
        } else if (e.key === "ArrowLeft") {
          prevImage();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedImage, nextImage, prevImage]);

  return (
    <>
      <section id="fotos" className="py-5">
        <div className="container">
          <div className="row text-center mb-4">
            <div className="col-lg-12">
              <h1>El lugar y sus momentos</h1>
              <p>¡Algunas fotos de lo que te espera!</p>
            </div>
          </div>
          <div className="row">
            {galleryImages.map((image, index) => (
              <div
                key={index}
                className="col-6 col-md-4 col-lg-3 mb-4"
                onClick={() => openImageModal(image)}
                style={{ cursor: "pointer" }}
              >
                <img
                  src={image}
                  alt={`Foto ${index + 1}`}
                  className="img-fluid rounded shadow-sm"
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {selectedImage && (
        <div
          className="modal fade show"
          style={{
            display: "block",
            backgroundColor: "rgba(0,0,0,0.9)",
          }}
          onClick={closeImageModal}
        >
          <div
            className="modal-dialog modal-lg modal-dialog-centered"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-content bg-transparent border-0">
              <div className="modal-body position-relative">
                <button
                  type="button"
                  className="btn-close btn-close-white position-absolute top-0 end-0 m-3"
                  onClick={closeImageModal}
                  aria-label="Cerrar"
                ></button>
                <img
                  src={selectedImage}
                  alt="Ampliada"
                  className="img-fluid w-100"
                  style={{ maxHeight: "90vh", objectFit: "contain" }}
                />
                <button
                  className="btn btn-dark position-absolute top-50 start-0 translate-middle-y"
                  onClick={prevImage}
                  style={{
                    width: "50px",
                    height: "50px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  ‹
                </button>
                <button
                  className="btn btn-dark position-absolute top-50 end-0 translate-middle-y"
                  onClick={nextImage}
                  style={{
                    width: "50px",
                    height: "50px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  ›
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Gallery;
