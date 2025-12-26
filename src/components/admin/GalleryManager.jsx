import { useRef } from "react";
import { useAuth } from "../../context/auth/useAuth";
import { useGalleryImages } from "../../hooks/useGalleryImages";

const GalleryManager = () => {
  const { user, hasRole } = useAuth();
  const {
    images,
    loading,
    uploading,
    error,
    uploadImages,
    deleteImage,
    loadImages,
  } = useGalleryImages();

  const fileInputRef = useRef();

  // Verificar permisos de administrador
  if (!hasRole("admin")) {
    return (
      <div className="container mt-4">
        <div className="alert alert-danger text-center">
          <h4>🚫 Acceso Denegado</h4>
          <p>No tienes permisos para acceder a esta sección.</p>
        </div>
      </div>
    );
  }

  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    try {
      await uploadImages(files);
      // Limpiar el input de archivo
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (err) {
      console.error("Error uploading files:", err);
    }
  };

  const handleDeleteImage = async (image) => {
    if (
      !window.confirm(
        `¿Estás seguro de que quieres eliminar la imagen "${image.name}"?`
      )
    ) {
      return;
    }

    try {
      await deleteImage(image.ref);
    } catch (err) {
      console.error("Error deleting image:", err);
    }
  };

  const handleDownloadImage = async (image) => {
    try {
      const response = await fetch(image.url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = image.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("Error downloading image:", err);
      alert("Error al descargar la imagen");
    }
  };

  return (
    <div className="container mt-4">
      <div className="row">
        <div className="col-12">
          <div className="d-flex justify-content-between align-items-center mb-4">
            <div>
              <h1>🖼️ Gestión de Galería</h1>
              <p className="text-muted mb-0">
                Administra las imágenes de la galería pública
              </p>
            </div>
            <div className="text-end">
              <small className="text-muted">
                Administrador:{" "}
                <strong>{user?.displayName || user?.email}</strong>
              </small>
            </div>
          </div>

          {/* Mostrar errores */}
          {error && (
            <div
              className="alert alert-danger alert-dismissible fade show"
              role="alert"
            >
              <strong>Error:</strong> {error}
              <button
                type="button"
                className="btn-close"
                onClick={() => loadImages()}
              ></button>
            </div>
          )}

          {/* Panel de subida de imágenes */}
          <div className="card mb-4">
            <div className="card-header bg-primary text-white">
              <h5 className="mb-0">📤 Subir Imágenes</h5>
            </div>
            <div className="card-body">
              <div className="mb-3">
                <label className="form-label fw-bold">
                  Seleccionar imágenes para subir:
                </label>
                <input
                  type="file"
                  ref={fileInputRef}
                  className="form-control"
                  multiple
                  accept="image/*"
                  onChange={handleFileUpload}
                  disabled={uploading}
                />
                <small className="form-text text-muted">
                  Puedes seleccionar múltiples imágenes. Se redimensionarán
                  automáticamente.
                </small>
              </div>

              {uploading && (
                <div className="alert alert-info">
                  <div
                    className="spinner-border spinner-border-sm me-2"
                    role="status"
                  ></div>
                  Subiendo imágenes...
                </div>
              )}
            </div>
          </div>

          {/* Lista de imágenes */}
          <div className="card">
            <div className="card-header bg-secondary text-white">
              <h5 className="mb-0">
                📷 Imágenes en la Galería ({images.length})
              </h5>
            </div>
            <div className="card-body">
              {loading ? (
                <div className="text-center py-4">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Cargando...</span>
                  </div>
                  <p className="mt-2">Cargando imágenes...</p>
                </div>
              ) : images.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-muted">No hay imágenes en la galería.</p>
                  <small className="text-muted">
                    Usa el panel de arriba para subir las primeras imágenes.
                  </small>
                </div>
              ) : (
                <div className="row">
                  {images.map((image, index) => (
                    <div key={image.name} className="col-md-6 col-lg-4 mb-4">
                      <div className="card h-100">
                        <img
                          src={image.url}
                          alt={`Imagen ${index + 1}`}
                          className="card-img-top"
                          style={{
                            height: "200px",
                            objectFit: "cover",
                          }}
                        />
                        <div className="card-body">
                          <h6
                            className="card-title text-truncate"
                            title={image.name}
                          >
                            {image.name}
                          </h6>
                          <small className="text-muted d-block mb-2">
                            {new URL(image.url).pathname.split("/").pop()}
                          </small>

                          <div className="btn-group w-100" role="group">
                            <button
                              type="button"
                              className="btn btn-outline-primary btn-sm"
                              onClick={() => handleDownloadImage(image)}
                              title="Descargar imagen"
                            >
                              ⬇️ Descargar
                            </button>
                            <button
                              type="button"
                              className="btn btn-outline-danger btn-sm"
                              onClick={() => handleDeleteImage(image)}
                              title="Eliminar imagen"
                            >
                              🗑️ Eliminar
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Información de uso */}
          <div className="alert alert-info mt-4">
            <h6>💡 Información:</h6>
            <ul className="mb-0">
              <li>
                Las imágenes se redimensionan automáticamente para optimizar el
                rendimiento
              </li>
              <li>Puedes subir múltiples imágenes a la vez</li>
              <li>
                Las imágenes se muestran en la galería pública inmediatamente
                después de subirlas
              </li>
              <li>
                Usa el botón "Descargar" para guardar una copia local de la
                imagen
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GalleryManager;
