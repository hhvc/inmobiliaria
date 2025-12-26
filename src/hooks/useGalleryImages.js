import { useState, useEffect, useCallback } from "react";
import {
  getStorage,
  ref,
  listAll,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { uploadMultipleImages } from "../utils/imageUtils";

export const useGalleryImages = () => {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  const storage = getStorage();
  const galleryFolder = "gallery";

  // Cargar imágenes de la galería - usamos useCallback para memoizar
  const loadImages = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const storageRef = ref(storage, galleryFolder);
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
    } catch (err) {
      console.error("Error loading gallery images:", err);
      setError("Error al cargar las imágenes de la galería");
    } finally {
      setLoading(false);
    }
  }, [storage]); // Dependencias: storage

  // Subir imágenes
  const uploadImages = async (files) => {
    try {
      setUploading(true);
      setError(null);

      const urls = await uploadMultipleImages(files, galleryFolder);

      // Recargar las imágenes después de subir
      await loadImages();

      return urls;
    } catch (err) {
      console.error("Error uploading images:", err);
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
      await deleteObject(imageRef);
      await loadImages(); // Recargar la lista
    } catch (err) {
      console.error("Error deleting image:", err);
      setError("Error al eliminar la imagen");
      throw err;
    }
  };

  // Cargar imágenes al montar el hook
  useEffect(() => {
    loadImages();
  }, [loadImages]); // Ahora loadImages es estable gracias a useCallback

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
