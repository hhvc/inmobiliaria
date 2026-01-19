// al crear la papelerea de reciclaje, este helper quedó en desuso y se creó deleteInmuebleImagesBatch.
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { ref, deleteObject } from "firebase/storage";
import { db, storage } from "../../firebase/config";

/**
 * Elimina una imagen de un inmueble:
 * 1️⃣ Borra el archivo de Firebase Storage
 * 2️⃣ Actualiza Firestore (array images reordenado)
 *
 * @param {Object} params
 * @param {string} params.inmobiliariaId
 * @param {string} params.inmuebleId
 * @param {string} params.storagePath   Ruta completa en Storage
 */
export const deleteInmuebleImage = async ({
  inmobiliariaId,
  inmuebleId,
  storagePath,
}) => {
  if (!inmobiliariaId || !inmuebleId || !storagePath) {
    throw new Error("Parámetros requeridos para eliminar imagen");
  }

  const inmuebleRef = doc(
    db,
    "inmobiliarias",
    inmobiliariaId,
    "inmuebles",
    inmuebleId
  );

  /* =========================================================
   * 1️⃣ Obtener estado actual del inmueble
   * ========================================================= */

  const snap = await getDoc(inmuebleRef);

  if (!snap.exists()) {
    throw new Error("El inmueble no existe");
  }

  const data = snap.data();
  const currentImages = Array.isArray(data.images) ? data.images : [];

  /* =========================================================
   * 2️⃣ Filtrar imagen a eliminar y reordenar
   * ========================================================= */

  const updatedImages = currentImages
    .filter((img) => img.storagePath !== storagePath)
    .map((img, index) => ({
      ...img,
      order: index,
    }));

  /* =========================================================
   * 3️⃣ Borrar archivo en Firebase Storage
   * ========================================================= */

  const imageRef = ref(storage, storagePath);
  await deleteObject(imageRef);

  /* =========================================================
   * 4️⃣ Actualizar Firestore
   * ========================================================= */

  await updateDoc(inmuebleRef, {
    images: updatedImages,
    updatedAt: serverTimestamp(),
  });
};
