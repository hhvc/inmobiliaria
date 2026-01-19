import { useState, useCallback, useMemo } from "react";
import { uploadInmuebleImages } from "../helpers/uploadInmuebleImages";
import { trashInmuebleImage } from "../helpers/trashInmuebleImage";
import { deleteInmuebleImagesBatch } from "../helpers/deleteInmuebleImagesBatch";
import { updateInmuebleImagesOrder } from "../helpers/updateInmuebleImagesOrder";

const MAX_IMAGES = 15;

/**
 * Imagen:
 * {
 *   url: string,
 *   storagePath: string,
 *   order: number,
 *   deleted?: boolean,
 *   deletedAt?: Date
 * }
 */

export const useInmuebleImages = (initialImages = []) => {
  /* =========================================================
   * State
   * ========================================================= */

  const [images, setImages] = useState(() =>
    [...initialImages].sort((a, b) => a.order - b.order)
  );

  const [selected, setSelected] = useState([]); // storagePath[]
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /* =========================================================
   * Upload
   * ========================================================= */

  const addImages = useCallback(
    async ({ files, inmuebleId, inmobiliariaId }) => {
      if (!files?.length) return;

      const activeImages = images.filter((img) => !img.deleted);

      if (activeImages.length + files.length > MAX_IMAGES) {
        setError(`Máximo ${MAX_IMAGES} imágenes permitidas`);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const startOrder = activeImages.length;

        const uploaded = await uploadInmuebleImages({
          files,
          inmuebleId,
          inmobiliariaId,
          startOrder,
        });

        setImages((prev) =>
          [...prev, ...uploaded].map((img, i) => ({ ...img, order: i }))
        );
      } catch (err) {
        console.error(err);
        setError("No se pudieron subir las imágenes");
      } finally {
        setLoading(false);
      }
    },
    [images]
  );

  /* =========================================================
   * Selección múltiple
   * ========================================================= */

  const toggleSelect = useCallback((storagePath) => {
    setSelected((prev) =>
      prev.includes(storagePath)
        ? prev.filter((p) => p !== storagePath)
        : [...prev, storagePath]
    );
  }, []);

  const clearSelection = useCallback(() => {
    setSelected([]);
  }, []);

  /* =========================================================
   * Papelera (soft delete)
   * ========================================================= */

  const trashImage = useCallback(
    async ({ index, inmuebleId, inmobiliariaId }) => {
      const img = images[index];
      if (!img) return;

      const snapshot = [...images];

      const updated = images.map((i, idx) =>
        idx === index ? { ...i, deleted: true, deletedAt: new Date() } : i
      );

      setImages(updated);

      try {
        await trashInmuebleImage({
          inmobiliariaId,
          inmuebleId,
          images: updated,
        });
      } catch (err) {
        console.error(err);
        setImages(snapshot);
      }
    },
    [images]
  );

  const restoreImage = useCallback(
    async ({ storagePath, inmuebleId, inmobiliariaId }) => {
      const snapshot = [...images];

      const restored = images
        .map((img) =>
          img.storagePath === storagePath
            ? { ...img, deleted: false, deletedAt: null }
            : img
        )
        .filter((img) => !img.deleted)
        .map((img, index) => ({ ...img, order: index }))
        .concat(images.filter((img) => img.deleted));

      setImages(restored);

      try {
        await updateInmuebleImagesOrder({
          inmobiliariaId,
          inmuebleId,
          images: restored,
        });
      } catch (err) {
        console.error(err);
        setImages(snapshot);
      }
    },
    [images]
  );

  /* =========================================================
   * Batch delete definitivo
   * ========================================================= */

  const deleteSelectedImages = useCallback(
    async ({ inmuebleId, inmobiliariaId }) => {
      const toDelete = images.filter(
        (img) => img.deleted && selected.includes(img.storagePath)
      );

      if (!toDelete.length) return;

      const snapshot = [...images];

      const remaining = images
        .filter((img) => !selected.includes(img.storagePath))
        .map((img, index) => ({ ...img, order: index }));

      setImages(remaining);
      clearSelection();

      try {
        setLoading(true);
        await deleteInmuebleImagesBatch({
          inmobiliariaId,
          inmuebleId,
          imagesToDelete: toDelete,
        });
      } catch (err) {
        console.error(err);
        setImages(snapshot);
      } finally {
        setLoading(false);
      }
    },
    [images, selected, clearSelection]
  );

  /* =========================================================
   * Drag & Drop + persistencia
   * ========================================================= */

  const reorderImages = useCallback(
    async ({ fromIndex, toIndex, inmuebleId, inmobiliariaId }) => {
      const snapshot = [...images];

      const active = images.filter((i) => !i.deleted);
      const trashed = images.filter((i) => i.deleted);

      const reordered = [...active];
      const [moved] = reordered.splice(fromIndex, 1);
      reordered.splice(toIndex, 0, moved);

      const updated = [
        ...reordered.map((img, i) => ({ ...img, order: i })),
        ...trashed,
      ];

      setImages(updated);

      try {
        await updateInmuebleImagesOrder({
          inmobiliariaId,
          inmuebleId,
          images: updated,
        });
      } catch (err) {
        console.error(err);
        setImages(snapshot);
      }
    },
    [images]
  );

  /* =========================================================
   * Helpers derivados
   * ========================================================= */

  const activeImages = useMemo(
    () => images.filter((img) => !img.deleted),
    [images]
  );

  const trashedImages = useMemo(
    () => images.filter((img) => img.deleted),
    [images]
  );

  const coverImage = useMemo(() => activeImages[0] || null, [activeImages]);
  const hasReachedLimit = activeImages.length >= MAX_IMAGES;

  /* =========================================================
   * API
   * ========================================================= */

  return {
    images,
    activeImages,
    trashedImages,

    selected,
    toggleSelect,
    clearSelection,

    coverImage,
    hasReachedLimit,

    loading,
    error,

    addImages,

    trashImage,
    restoreImage,

    deleteSelectedImages,

    reorderImages,
  };
};
