// src/hooks/useGalleryImages.js
import { useState, useEffect, useCallback } from "react";
// Importa storage y la promesa desde TU configuración
import { storage, appCheckReadyPromise } from "../firebase/config";
import { ref, listAll, getDownloadURL, deleteObject } from "firebase/storage";
import { uploadMultipleImages } from "../utils/imageUtils";

// 🔥 Mueve las constantes inmutables FUERA del componente
const GALLERY_FOLDER = "gallery";

export const useGalleryImages = () => {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  // Cargar imágenes de la galería - usamos useCallback para memoizar
  const loadImages = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      console.log(
        "⏳ [useGalleryImages] Esperando a que App Check esté listo..."
      );
      await appCheckReadyPromise;
      console.log("✅ [useGalleryImages] App Check listo. Iniciando carga...");

      const storageRef = ref(storage, GALLERY_FOLDER); // Usa la constante externa
      const result = await listAll(storageRef);

      const urlPromises = result.items.map((itemRef) =>
        getDownloadURL(itemRef)
      );
      const urls = await Promise.all(urlPromises);

      // Crear array con metadata y URL
      const imagesData = result.items.map((itemRef, index) => ({
        url: urls[index],
        name: itemRef.name,
        fullPath: itemRef.fullPath,
        ref: itemRef,
      }));

      setImages(imagesData);
      console.log(
        `✅ [useGalleryImages] ${imagesData.length} imágenes cargadas.`
      );
    } catch (err) {
      console.error("❌ [useGalleryImages] Error cargando imágenes:", err);
      if (err.code === "storage/unauthorized") {
        setError(
          "Error de permisos. La verificación de seguridad de la aplicación falló. Recarga la página."
        );
      } else {
        setError("Error al cargar las imágenes de la galería");
      }
    } finally {
      setLoading(false);
    }
  }, []); // 🔥 Array de dependencias VACÍO: storage es constante importada, GALLERY_FOLDER es externa

  // Subir imágenes
  const uploadImages = async (files) => {
    try {
      setUploading(true);
      setError(null);

      // 🔥 Esperar a que App Check esté listo también para subidas
      await appCheckReadyPromise;

      // ⚠️ IMPORTANTE: Asegúrate de que `uploadMultipleImages` use la misma instancia de `storage`.
      const urls = await uploadMultipleImages(files, GALLERY_FOLDER);

      // Recargar las imágenes después de subir
      await loadImages();

      return urls;
    } catch (err) {
      console.error("❌ [useGalleryImages] Error subiendo imágenes:", err);
      setError("Error al subir las imágenes");
      throw err;
    } finally {
      setUploading(false);
    }
  };

  // Eliminar imagen
  const deleteImage = async (imageRef) => {
    try {
      setError(null);
      // 🔥 Esperar a que App Check esté listo también para eliminaciones
      await appCheckReadyPromise;
      await deleteObject(imageRef);
      await loadImages(); // Recargar la lista
    } catch (err) {
      console.error("❌ [useGalleryImages] Error eliminando imagen:", err);
      setError("Error al eliminar la imagen");
      throw err;
    }
  };

  // Cargar imágenes al montar el hook
  useEffect(() => {
    loadImages();
  }, [loadImages]); // loadImages es estable porque sus dependencias (vacías) no cambian

  return {
    images,
    loading,
    uploading,
    error,
    loadImages,
    uploadImages,
    deleteImage,
  };
};
