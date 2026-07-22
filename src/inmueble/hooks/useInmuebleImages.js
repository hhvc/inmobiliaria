import { useState, useCallback, useMemo, useEffect } from "react";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { ref, deleteObject } from "firebase/storage";

import { db, storage } from "../../firebase/config";
import {
  INMUEBLE_MAX_IMAGES,
  uploadInmuebleImages,
} from "../helpers/uploadInmuebleImages";

const MAX_IMAGES = INMUEBLE_MAX_IMAGES;

const mapImage = (img, index) => ({
  id: img.id || img.storagePath || img.url || `image-${index}`,

  url: img.url,
  storagePath: img.storagePath || "",

  thumbnailUrl: img.thumbnailUrl || img.url,
  thumbnailPath: img.thumbnailPath || "",

  order: index,

  filename: img.filename || img.name || "",
  name: img.name || img.filename || "",
  size: img.size || 0,
  type: img.type || img.contentType || "",
  contentType: img.contentType || img.type || "",

  width: img.width || null,
  height: img.height || null,
  thumbnailWidth: img.thumbnailWidth || null,
  thumbnailHeight: img.thumbnailHeight || null,

  portalReady: img.portalReady !== false,
  qualityWarnings: Array.isArray(img.qualityWarnings)
    ? img.qualityWarnings
    : [],

  source: img.source || null,

  createdAt: img.createdAt || null,
  copiedFrom: img.copiedFrom || "",
});

const normalizeImages = (images = [], { sortByOrder = true } = {}) => {
  if (!Array.isArray(images)) return [];

  const validImages = [...images].filter((img) => img?.url);

  if (sortByOrder) {
    validImages.sort((a, b) => {
      const orderA = Number.isFinite(Number(a.order)) ? Number(a.order) : 0;
      const orderB = Number.isFinite(Number(b.order)) ? Number(b.order) : 0;

      return orderA - orderB;
    });
  }

  return validImages.map((img, index) => mapImage(img, index));
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

const deleteImageStorageObjects = async (image) => {
  const paths = [image?.storagePath, image?.thumbnailPath].filter(Boolean);

  await Promise.all(
    paths.map((path) =>
      deleteObject(ref(storage, path)).catch((err) => {
        console.warn("No se pudo eliminar archivo de Storage:", path, err);
      }),
    ),
  );
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
        setError(`Máximo ${MAX_IMAGES} imágenes permitidas por inmueble`);
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
          uploadedImages.map((img) => deleteImageStorageObjects(img)),
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

        await deleteImageStorageObjects(image);

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
      const safeFromIndex = Number(fromIndex);
      const safeToIndex = Number(toIndex);

      if (safeFromIndex === safeToIndex) return;

      if (!inmuebleId || !inmobiliariaId) {
        setError("Faltan IDs para reordenar imágenes");
        return;
      }

      if (
        !Number.isInteger(safeFromIndex) ||
        !Number.isInteger(safeToIndex) ||
        safeFromIndex < 0 ||
        safeToIndex < 0 ||
        safeFromIndex >= activeImages.length ||
        safeToIndex >= activeImages.length
      ) {
        setError("Índices inválidos para reordenar imágenes");
        return;
      }

      const snapshot = activeImages;

      try {
        setLoading(true);
        setError(null);

        const reordered = [...activeImages];
        const [moved] = reordered.splice(safeFromIndex, 1);
        reordered.splice(safeToIndex, 0, moved);

        // Importante:
        // acá NO ordenamos por order viejo, porque eso deshace el movimiento.
        // Reindexamos respetando el orden actual del array.
        const nextImages = normalizeImages(reordered, { sortByOrder: false });

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
    maxImages: MAX_IMAGES,

    loading,
    error,

    addImages,
    removeImage,
    reorderImages,
  };
};