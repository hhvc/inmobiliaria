import { useState } from "react";
import ReservationSystem from "../ReservationSystem";

const Cabana = ({ cabana }) => {
  const [showModal, setShowModal] = useState(false);
  const [showReservationModal, setShowReservationModal] = useState(false);
  const [currentImage, setCurrentImage] = useState(0);
  const [imageLoading, setImageLoading] = useState(true);
  const [imagesLoaded, setImagesLoaded] = useState({}); // Track loaded images

  const openModal = (index = 0) => {
    setCurrentImage(index);
    setShowModal(true);
    // Reset loading state when opening modal
    setImageLoading(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setCurrentImage(0);
  };

  const openReservationModal = () => {
    setShowReservationModal(true);
  };

  const closeReservationModal = () => {
    setShowReservationModal(false);
  };

  const nextImage = (e) => {
    e.stopPropagation();
    const nextIndex = (currentImage + 1) % cabana.imagenes.length;
    setCurrentImage(nextIndex);
    // If we haven't loaded this image before, set loading state
    if (!imagesLoaded[nextIndex]) {
      setImageLoading(true);
    }
  };

  const prevImage = (e) => {
    e.stopPropagation();
    const prevIndex =
      (currentImage - 1 + cabana.imagenes.length) % cabana.imagenes.length;
    setCurrentImage(prevIndex);
    // If we haven't loaded this image before, set loading state
    if (!imagesLoaded[prevIndex]) {
      setImageLoading(true);
    }
  };

  const handleImageLoad = () => {
    setImageLoading(false);
    // Mark this image as loaded
    setImagesLoaded((prev) => ({
      ...prev,
      [currentImage]: true,
    }));
  };

  const handleImageError = () => {
    setImageLoading(false);
    console.error("Error cargando la imagen:", cabana.imagenes[currentImage]);
  };

  // Navegación con teclado
  const handleKeyDown = (e) => {
    if (e.key === "Escape") {
      closeModal();
    } else if (e.key === "ArrowRight") {
      nextImage(e);
    } else if (e.key === "ArrowLeft") {
      prevImage(e);
    }
  };

  // Función para mostrar información de capacidad mejorada
  const renderCapacidadInfo = () => {
    // Compatibilidad con el formato antiguo y nuevo
    if (cabana.capacidad && typeof cabana.capacidad === "object") {
      // Nuevo formato con capacidades detalladas
      const { maxAdultos, maxMenores, maxPersonas } = cabana.capacidad;
      return (
        <>
          <li>
            👥 <strong>Capacidad:</strong> {maxPersonas} personas máximo
          </li>
          <li>
            🧑 <strong>Adultos:</strong> Hasta {maxAdultos}
          </li>
          <li>
            🧒 <strong>Menores:</strong> Hasta {maxMenores}
          </li>
        </>
      );
    } else {
      // Formato antiguo - solo número
      return <li>👥 Capacidad: {cabana.capacidad} personas</li>;
    }
  };

  // Función para mostrar información de precios mejorada
  const renderPrecioInfo = () => {
    const precios = cabana.precios || {};

    return (
      <div className="mt-2 p-2 bg-dark bg-opacity-25 rounded">
        <small>
          <strong>💵 Tarifas:</strong>
          <br />• Base: ${precios.base || 100} por noche (2 adultos incluidos)
          {precios.adicionalAdulto > 0 && (
            <>
              <br />• Adulto extra: +${precios.adicionalAdulto} por noche
            </>
          )}
          {precios.adicionalMenor > 0 && (
            <>
              <br />• Menor (3-12 años): +${precios.adicionalMenor} por noche
            </>
          )}
          {precios.adicionalMenor3 > 0 && (
            <>
              <br />• Menor {"<"} 3 años: +${precios.adicionalMenor3} por noche
            </>
          )}
        </small>
      </div>
    );
  };

  return (
    <>
      <div className="col-lg-4 col-md-6 mb-4">
        <div className="card h-100 shadow-sm bg-dark text-white">
          {/* Imagen principal con indicador de carga */}
          <div className="position-relative">
            <img
              src={cabana.imagenes[0]}
              className="card-img-top"
              alt={cabana.nombre}
              style={{
                height: "250px",
                objectFit: "cover",
                cursor: "pointer",
              }}
              onClick={() => openModal(0)}
            />
            {/* Badge de estado */}
            {cabana.disponible === false && (
              <div className="position-absolute top-0 end-0 m-2">
                <span className="badge bg-danger">NO DISPONIBLE</span>
              </div>
            )}
          </div>

          <div className="card-body d-flex flex-column">
            <h3 className="card-title h5">{cabana.nombre}</h3>
            <ul className="list-unstyled flex-grow-1">
              {renderCapacidadInfo()}
              <li>📐 {cabana.metrosCuadrados} m² cubiertos</li>
              <li>🛏️ {cabana.dormitorios} dormitorios</li>
              {cabana.caracteristicas.map((caracteristica, index) => (
                <li key={index}>✅ {caracteristica}</li>
              ))}
            </ul>

            {/* Información de precios */}
            {renderPrecioInfo()}

            <div className="mt-auto">
              <div className="d-flex gap-2 flex-wrap">
                {cabana.imagenes.length > 0 && (
                  <button
                    className="btn btn-info btn-sm"
                    onClick={() => openModal(0)}
                  >
                    📸 Ver fotos
                  </button>
                )}

                {/* Botón de reserva - Solo mostrar si está disponible */}
                {cabana.disponible !== false && (
                  <button
                    className="btn btn-success btn-sm"
                    onClick={openReservationModal}
                  >
                    📅 Simular Reserva
                  </button>
                )}

                <a href="#contact" className="btn btn-outline-light btn-sm">
                  💰 Consultar precio
                </a>
              </div>

              {/* Mostrar mensaje si no está disponible */}
              {cabana.disponible === false && (
                <div className="mt-2">
                  <small className="text-warning">
                    ⚠️ Actualmente no disponible para reservas
                  </small>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal de imágenes - CON INDICADOR DE CARGA */}
      {showModal && (
        <div
          className="modal fade show"
          style={{
            display: "block",
            backgroundColor: "rgba(0,0,0,0.9)",
          }}
          onClick={closeModal}
          onKeyDown={handleKeyDown}
          tabIndex={0}
        >
          <div
            className="modal-dialog modal-lg modal-dialog-centered"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-content bg-dark">
              <div className="modal-header border-0">
                <h5 className="modal-title text-white">{cabana.nombre}</h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={closeModal}
                ></button>
              </div>
              <div className="modal-body text-center position-relative">
                {/* Contenedor de imagen con indicador de carga */}
                <div
                  className="position-relative"
                  style={{ minHeight: "300px" }}
                >
                  {/* Indicador de carga */}
                  {imageLoading && (
                    <div className="position-absolute top-50 start-50 translate-middle">
                      <div className="spinner-border text-light" role="status">
                        <span className="visually-hidden">
                          Cargando imagen...
                        </span>
                      </div>
                      <div className="text-white mt-2 small">
                        Cargando imagen...
                      </div>
                    </div>
                  )}

                  {/* Imagen */}
                  <img
                    src={cabana.imagenes[currentImage]}
                    alt={`${cabana.nombre} ${currentImage + 1}`}
                    className="img-fluid rounded"
                    style={{
                      maxHeight: "70vh",
                      objectFit: "contain",
                      opacity: imageLoading ? 0.3 : 1, // Hacemos transparente mientras carga
                      transition: "opacity 0.3s ease-in-out",
                    }}
                    onLoad={handleImageLoad}
                    onError={handleImageError}
                  />
                </div>

                {/* Contador de imágenes */}
                <div className="text-white mt-3">
                  <small>
                    Imagen {currentImage + 1} de {cabana.imagenes.length}
                    {imageLoading && " - Cargando..."}
                  </small>
                </div>

                {/* Botones de navegación */}
                {cabana.imagenes.length > 1 && (
                  <div className="d-flex justify-content-between align-items-center mt-3">
                    <button
                      className="btn btn-outline-light"
                      onClick={prevImage}
                      disabled={imageLoading} // Deshabilitar mientras carga
                    >
                      ◀ Anterior
                    </button>

                    <button
                      className="btn btn-outline-light"
                      onClick={nextImage}
                      disabled={imageLoading} // Deshabilitar mientras carga
                    >
                      Siguiente ▶
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Reservas */}
      {showReservationModal && (
        <div
          className="modal fade show"
          style={{
            display: "block",
            backgroundColor: "rgba(0,0,0,0.8)",
          }}
          onClick={closeReservationModal}
        >
          <div
            className="modal-dialog modal-xl modal-dialog-centered"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-content">
              <div className="modal-header bg-primary text-white">
                <h5 className="modal-title">📅 Reservar {cabana.nombre}</h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={closeReservationModal}
                ></button>
              </div>
              <div className="modal-body">
                <ReservationSystem
                  cabana={cabana}
                  onClose={closeReservationModal}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Cabana;
