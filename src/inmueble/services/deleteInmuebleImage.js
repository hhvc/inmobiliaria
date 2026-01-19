import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { ref, deleteObject } from "firebase/storage";
import { db, storage } from "@/firebase/config";

/**
 * Elimina una imagen de un inmueble:
 * - Borra el archivo en Firebase Storage
 * - Remueve la imagen del array `images`
 * - Recalcula el orden
 *
 * @param {Object} params
 * @param {string} params.inmobiliariaId
 * @param {string} params.inmuebleId
 * @param {string} params.storagePath  Path del archivo en Storage
 */
export const deleteInmuebleImage = async ({
  inmobiliariaId,
  inmuebleId,
  storagePath,
}) => {
  if (!inmobiliariaId || !inmuebleId || !storagePath) {
    throw new Error("Parámetros incompletos para eliminar imagen");
  }

  const inmuebleRef = doc(
    db,
    "inmobiliarias",
    inmobiliariaId,
    "inmuebles",
    inmuebleId
  );

  // 1️⃣ Obtener inmueble actual
  const snap = await getDoc(inmuebleRef);

  if (!snap.exists()) {
    throw new Error("El inmueble no existe");
  }

  const data = snap.data();
  const images = Array.isArray(data.images) ? data.images : [];

  // 2️⃣ Filtrar imagen a eliminar
  const remainingImages = images.filter(
    (img) => img.storagePath !== storagePath
  );

  if (remainingImages.length === images.length) {
    console.warn("La imagen no estaba registrada en Firestore");
  }

  // 3️⃣ Reordenar imágenes restantes
  const reorderedImages = remainingImages.map((img, index) => ({
    url: img.url,
    storagePath: img.storagePath,
    order: index,
  }));

  // 4️⃣ Borrar archivo en Firebase Storage
  const fileRef = ref(storage, storagePath);
  await deleteObject(fileRef);

  // 5️⃣ Actualizar Firestore
  await updateDoc(inmuebleRef, {
    images: reorderedImages,
    updatedAt: serverTimestamp(),
  });
};
