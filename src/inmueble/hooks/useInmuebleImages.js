import { useState, useCallback, useMemo, useEffect } from "react";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { ref, deleteObject } from "firebase/storage";

import { db, storage } from "../../firebase/config";
import { uploadInmuebleImages } from "../helpers/uploadInmuebleImages";

const MAX_IMAGES = 15;

const normalizeImages = (images = []) => {
  if (!Array.isArray(images)) return [];

  return [...images]
    .filter((img) => img?.url)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((img, index) => ({
      url: img.url,
      storagePath: img.storagePath || "",
      order: index,
      filename: img.filename || "",
      size: img.size || 0,
      type: img.type || "",
      createdAt: img.createdAt || null,
    }));
};

const getInmuebleRef = (inmobiliariaId, inmuebleId) => {
  if (!inmobiliariaId || !inmuebleId) {
    throw new Error("IDs requeridos para actualizar imágenes");
  }

  return doc(db, "inmobiliarias", inmobiliariaId, "inmuebles", inmuebleId);
};

const persistImages = async ({ inmobiliariaId, inmuebleId, images }) => {
  const inmuebleRef = getInmuebleRef(inmobiliariaId, inmuebleId);

  await updateDoc(inmuebleRef, {
    images: normalizeImages(images),
    updatedAt: serverTimestamp(),
  });
};

export const useInmuebleImages = (initialImages = []) => {
  const [images, setImages] = useState(() => normalizeImages(initialImages));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setImages(normalizeImages(initialImages));
  }, [initialImages]);

  const activeImages = useMemo(() => normalizeImages(images), [images]);

  const coverImage = useMemo(() => activeImages[0] || null, [activeImages]);

  const hasReachedLimit = activeImages.length >= MAX_IMAGES;

  const addImages = useCallback(
    async ({ files, inmuebleId, inmobiliariaId }) => {
      const filesArray = Array.from(files || []);

      if (filesArray.length === 0) return;

      if (!inmuebleId || !inmobiliariaId) {
        setError("Faltan IDs para subir imágenes");
        return;
      }

      if (activeImages.length + filesArray.length > MAX_IMAGES) {
        setError(`Máximo ${MAX_IMAGES} imágenes permitidas`);
        return;
      }

      let uploadedImages = [];

      try {
        setLoading(true);
        setError(null);

        uploadedImages = await uploadInmuebleImages({
          files: filesArray,
          inmuebleId,
          inmobiliariaId,
          startOrder: activeImages.length,
        });

        const nextImages = normalizeImages([...activeImages, ...uploadedImages]);

        setImages(nextImages);

        await persistImages({
          inmobiliariaId,
          inmuebleId,
          images: nextImages,
        });
      } catch (err) {
        console.error("Error subiendo imágenes:", err);

        await Promise.all(
          uploadedImages.map((img) => {
            if (!img?.storagePath) return Promise.resolve();

            return deleteObject(ref(storage, img.storagePath)).catch(
              (deleteErr) => {
                console.warn(
                  "No se pudo limpiar imagen subida parcialmente:",
                  img.storagePath,
                  deleteErr,
                );
              },
            );
          }),
        );

        setError(err.message || "No se pudieron subir las imágenes");
      } finally {
        setLoading(false);
      }
    },
    [activeImages],
  );

  const removeImage = useCallback(
    async ({ image, inmuebleId, inmobiliariaId }) => {
      if (!image) return;

      if (!inmuebleId || !inmobiliariaId) {
        setError("Faltan IDs para eliminar la imagen");
        return;
      }

      const snapshot = activeImages;

      try {
        setLoading(true);
        setError(null);

        const nextImages = normalizeImages(
          activeImages.filter((img) => {
            if (image.storagePath) {
              return img.storagePath !== image.storagePath;
            }

            return img.url !== image.url;
          }),
        );

        setImages(nextImages);

        if (image.storagePath) {
          await deleteObject(ref(storage, image.storagePath)).catch((err) => {
            console.warn(
              "No se pudo eliminar la imagen de Storage:",
              image.storagePath,
              err,
            );
          });
        }

        await persistImages({
          inmobiliariaId,
          inmuebleId,
          images: nextImages,
        });
      } catch (err) {
        console.error("Error eliminando imagen:", err);
        setImages(snapshot);
        setError(err.message || "No se pudo eliminar la imagen");
      } finally {
        setLoading(false);
      }
    },
    [activeImages],
  );

  const reorderImages = useCallback(
    async ({ fromIndex, toIndex, inmuebleId, inmobiliariaId }) => {
      if (fromIndex === toIndex) return;

      if (!inmuebleId || !inmobiliariaId) {
        setError("Faltan IDs para reordenar imágenes");
        return;
      }

      if (
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= activeImages.length ||
        toIndex >= activeImages.length
      ) {
        return;
      }

      const snapshot = activeImages;

      try {
        setLoading(true);
        setError(null);

        const reordered = [...activeImages];
        const [moved] = reordered.splice(fromIndex, 1);
        reordered.splice(toIndex, 0, moved);

        const nextImages = normalizeImages(reordered);

        setImages(nextImages);

        await persistImages({
          inmobiliariaId,
          inmuebleId,
          images: nextImages,
        });
      } catch (err) {
        console.error("Error reordenando imágenes:", err);
        setImages(snapshot);
        setError(err.message || "No se pudo reordenar la galería");
      } finally {
        setLoading(false);
      }
    },
    [activeImages],
  );

  return {
    images: activeImages,
    activeImages,
    coverImage,
    hasReachedLimit,

    loading,
    error,

    addImages,
    removeImage,
    reorderImages,
  };
};