import { useState, useCallback, useEffect } from "react";
import { useGalleryImages } from "../../hooks/useGalleryImages";

const DynamicGallery = () => {
  const [selectedImage, setSelectedImage] = useState(null);
  const { images, loading, error } = useGalleryImages();

  const openImageModal = (imageSrc) => {
    setSelectedImage(imageSrc);
  };

  const closeImageModal = () => {
    setSelectedImage(null);
  };

  const nextImage = useCallback(() => {
    if (!selectedImage || images.length === 0) return;

    const currentIndex = images.findIndex(
      (img) => img.url === selectedImage.url
    );
    const nextIndex = (currentIndex + 1) % images.length;
    setSelectedImage(images[nextIndex]);
  }, [images, selectedImage]);

  const prevImage = useCallback(() => {
    if (!selectedImage || images.length === 0) return;

    const currentIndex = images.findIndex(
      (img) => img.url === selectedImage.url
    );
    const prevIndex = (currentIndex - 1 + images.length) % images.length;
    setSelectedImage(images[prevIndex]);
  }, [images, selectedImage]);

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

  // Mostrar estados de carga y error
  if (loading) {
    return (
      <section id="fotos" className="py-5 bg-light">
        <div className="container">
          <div className="row text-center">
            <div className="col-12">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Cargando...</span>
              </div>
              <p className="mt-2">Cargando galería...</p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section id="fotos" className="py-5 bg-light">
        <div className="container">
          <div className="row text-center">
            <div className="col-12">
              <div className="alert alert-warning" role="alert">
                {error}
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <>
      <section id="fotos" className="py-5 bg-light">
        <div className="container">
          {/* Título Principal */}
          <div className="row text-center mb-5">
            <div className="col-lg-12">
              <h1 className="display-4 fw-bold text-primary mb-3">
                El lugar y sus momentos 🌅
              </h1>
              <p className="lead fs-5 text-muted max-w-800 mx-auto">
                Villa Parque Siquiman es un rincón mágico en Córdoba, rodeado de
                naturaleza, con vistas al lago San Roque y las Sierras Chicas.
                Un lugar ideal para desconectar, descansar y disfrutar de
                increíbles atardeceres en contacto con la vegetación autóctona.
                Cada momento aquí es especial: relax, aventuras y la belleza del
                paisaje te esperan.
              </p>
            </div>
          </div>

          {/* Sección de Actividades */}
          <div className="row mb-5">
            <div className="col-lg-6">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-body p-4">
                  <h2 className="h3 text-success fw-bold mb-3">
                    Actividades y recreación 🚣‍♀
                  </h2>
                  <h3 className="h5 text-muted mb-3">
                    Disfruta de la variedad de actividades que ofrece la región:
                  </h3>
                  <ul className="list-unstyled">
                    <li className="mb-2 d-flex align-items-start">
                      <span className="text-success me-2">🏖</span>
                      <span>Paseos por senderos y playas de arena natural</span>
                    </li>
                    <li className="mb-2 d-flex align-items-start">
                      <span className="text-success me-2">🌲💧</span>
                      <span>Excursiones a lagos, ríos y parques acuáticos</span>
                    </li>
                    <li className="mb-2 d-flex align-items-start">
                      <span className="text-success me-2">🏘</span>
                      <span>
                        Visitas culturales y pueblos turísticos cercanos
                      </span>
                    </li>
                    <li className="mb-2 d-flex align-items-start">
                      <span className="text-success me-2">🎢🎮</span>
                      <span>
                        Día en parques infantiles, karting y experiencias de
                        aventura para toda la familia
                      </span>
                    </li>
                    <li className="mb-2 d-flex align-items-start">
                      <span className="text-success me-2">🚗🏞</span>
                      <span>
                        Paseos en auto por las sierras, con paradas en miradores
                        y refugios de montaña
                      </span>
                    </li>
                    <li className="mb-0 d-flex align-items-start">
                      <span className="text-success me-2">✨</span>
                      <span className="fw-bold text-success">
                        ¡Cada día puede ser una aventura diferente!
                      </span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
            <div className="col-lg-6 mt-4 mt-lg-0">
              {/* Imagen representativa de actividades - se mostrará si hay imágenes */}
              {images.length > 0 && (
                <div className="card border-0 shadow-sm h-100">
                  <div
                    className="card-body p-0 rounded overflow-hidden"
                    style={{ cursor: "pointer" }}
                    onClick={() => openImageModal(images[0])}
                  >
                    <img
                      src={images[0].url}
                      alt="Actividades en Villa Parque Siquiman"
                      className="img-fluid w-100"
                      style={{ height: "300px", objectFit: "cover" }}
                    />
                    <div className="p-3 text-center">
                      <small className="text-muted">
                        Haz clic para ver más imágenes de las actividades
                      </small>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Sección de Cabañas y Villa Parque Siquiman */}
          <div className="row mb-5">
            <div className="col-lg-6 mb-4 mb-lg-0">
              <div className="card border-0 shadow-sm h-100 bg-warning bg-opacity-10">
                <div className="card-body p-4">
                  <h2 className="h3 text-warning fw-bold mb-3">
                    En las cabañas 🛎
                  </h2>
                  <p className="mb-0">
                    Nuestras cabañas ofrecen confort con vistas panorámicas,
                    rodeadas de vegetación y en un ambiente tranquilo. Perfectas
                    para descansar luego de un día de actividades. El entorno
                    natural promete momentos de paz, lectura y reuniones en
                    familia o con amigos.
                  </p>
                </div>
              </div>
            </div>
            <div className="col-lg-6">
              <div className="card border-0 shadow-sm h-100 bg-info bg-opacity-10">
                <div className="card-body p-4">
                  <h2 className="h3 text-info fw-bold mb-3">
                    En Villa Parque Siquiman 🌄
                  </h2>
                  <p className="mb-0">
                    El pueblo, en el corazón de Punilla, es el punto de partida
                    para explorar la región: desde paseos por la naturaleza,
                    visitas a pueblos cercanos como Carlos Paz, Cosquín, La
                    Falda, hasta actividades culturales y gastronómicas. Con un
                    entorno cálido y amigable, Villa Parque Siquiman invita a
                    vivir una experiencia única en contacto con la naturaleza,
                    la tranquilidad y la cultura.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Galería de Imágenes */}
          <div className="row text-center mb-4">
            <div className="col-lg-12">
              <h2 className="h1 text-primary mb-2">📸 Galería de Recuerdos</h2>
              <p className="text-muted fs-5">
                Descubre los momentos especiales que te esperan en Villa Parque
                Siquiman
              </p>
            </div>
          </div>

          {images.length === 0 ? (
            <div className="row text-center">
              <div className="col-12">
                <div className="alert alert-info">
                  No hay imágenes en la galería todavía.
                </div>
              </div>
            </div>
          ) : (
            <div className="row">
              {images.map((image, index) => (
                <div
                  key={image.name}
                  className="col-6 col-md-4 col-lg-3 mb-4"
                  onClick={() => openImageModal(image)}
                  style={{ cursor: "pointer" }}
                >
                  <div className="card border-0 shadow-sm h-100">
                    <img
                      src={image.url}
                      alt={`Villa Parque Siquiman ${index + 1}`}
                      className="card-img-top"
                      style={{
                        height: "200px",
                        objectFit: "cover",
                      }}
                      loading="lazy"
                    />
                    <div className="card-body p-2 text-center">
                      <small className="text-muted">Imagen {index + 1}</small>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Modal para imágenes (se mantiene igual) */}
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
                  style={{ zIndex: 1060 }}
                ></button>
                <img
                  src={selectedImage.url}
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
                    zIndex: 1060,
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
                    zIndex: 1060,
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

export default DynamicGallery;
