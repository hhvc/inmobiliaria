import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase/config";

/**
 * Actualiza y persiste el orden de las imágenes de un inmueble.
 *
 * ⚠️ Este helper:
 * - NO elimina imágenes
 * - NO toca Firebase Storage
 * - SOLO guarda el array ordenado en Firestore
 *
 * @param {Object} params
 * @param {string} params.inmobiliariaId
 * @param {string} params.inmuebleId
 * @param {Array}  params.images  [{ url, storagePath, order }]
 */
export const updateInmuebleImagesOrder = async ({
  inmobiliariaId,
  inmuebleId,
  images,
}) => {
  if (!inmobiliariaId || !inmuebleId) {
    throw new Error("IDs requeridos para actualizar imágenes");
  }

  if (!Array.isArray(images)) {
    throw new Error("images debe ser un array");
  }

  const ref = doc(db, "inmobiliarias", inmobiliariaId, "inmuebles", inmuebleId);

  // 🔒 Sanitizar + ordenar defensivamente
  const sanitizedImages = [...images]
    .sort((a, b) => a.order - b.order)
    .map((img, index) => {
      if (!img.url || !img.storagePath) {
        throw new Error("Imagen inválida: falta url o storagePath");
      }

      return {
        url: img.url,
        storagePath: img.storagePath,
        order: index,
      };
    });

  await updateDoc(ref, {
    images: sanitizedImages,
    updatedAt: serverTimestamp(),
  });
};
