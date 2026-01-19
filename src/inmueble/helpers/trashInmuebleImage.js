import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase/config";

/**
 * Mueve una imagen a la papelera (soft delete)
 * - NO borra de Storage
 * - Marca como trashed en Firestore
 */
export const trashInmuebleImage = async ({
  inmobiliariaId,
  inmuebleId,
  storagePath,
}) => {
  if (!inmobiliariaId || !inmuebleId || !storagePath) {
    throw new Error("Parámetros inválidos para trashInmuebleImage");
  }

  const ref = doc(db, "inmobiliarias", inmobiliariaId, "inmuebles", inmuebleId);

  await updateDoc(ref, {
    images: {
      [storagePath]: {
        trashed: true,
        trashedAt: serverTimestamp(),
      },
    },
    updatedAt: serverTimestamp(),
  });
};
