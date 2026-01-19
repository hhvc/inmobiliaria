import { db } from "../../firebase/config";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { getStorage, ref, deleteObject } from "firebase/storage";

/**
 * 🔥 Delete definitivo (batch) de imágenes de un inmueble
 *
 * ✔ Elimina físicamente de Firebase Storage
 * ✔ Actualiza Firestore removiendo las imágenes
 * ✔ Recalcula el order
 *
 * @param {Object} params
 * @param {string} params.inmobiliariaId
 * @param {string} params.inmuebleId
 * @param {Array}  params.images           Array completo de imágenes actuales
 * @param {Array}  params.selectedIndexes  Índices seleccionados para borrar
 */
export const deleteInmuebleImagesBatch = async ({
  inmobiliariaId,
  inmuebleId,
  images,
  selectedIndexes = [],
}) => {
  if (!inmobiliariaId || !inmuebleId) {
    throw new Error("IDs requeridos");
  }

  if (!Array.isArray(images)) {
    throw new Error("images debe ser un array");
  }

  if (!Array.isArray(selectedIndexes) || selectedIndexes.length === 0) {
    return; // nada que borrar
  }

  const storage = getStorage();

  // 🔹 Imágenes a borrar
  const imagesToDelete = selectedIndexes.map((i) => images[i]).filter(Boolean);

  // 🔹 Imágenes que quedan
  const remainingImages = images
    .filter((_, index) => !selectedIndexes.includes(index))
    .map((img, index) => ({
      url: img.url,
      storagePath: img.storagePath,
      order: index,
    }));

  /* =========================================================
     1️⃣ Borrar de Storage (en paralelo)
     ========================================================= */

  await Promise.all(
    imagesToDelete.map((img) => {
      if (!img?.storagePath) return Promise.resolve();

      const fileRef = ref(storage, img.storagePath);
      return deleteObject(fileRef).catch((err) => {
        console.warn("No se pudo borrar:", img.storagePath, err);
      });
    })
  );

  /* =========================================================
     2️⃣ Persistir Firestore
     ========================================================= */

  const inmuebleRef = doc(
    db,
    "inmobiliarias",
    inmobiliariaId,
    "inmuebles",
    inmuebleId
  );

  await updateDoc(inmuebleRef, {
    images: remainingImages,
    updatedAt: serverTimestamp(),
  });
};
