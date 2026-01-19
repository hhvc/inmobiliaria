import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "../../firebase/config";

/**
 * Sube imágenes de un inmueble a Firebase Storage
 */
export const uploadInmuebleImages = async ({
  files,
  inmuebleId,
  inmobiliariaId,
  currentCount = 0,
}) => {
  if (!inmuebleId || !inmobiliariaId) {
    throw new Error("Faltan IDs para subir imágenes");
  }

  const uploads = Array.from(files).map(async (file, index) => {
    const imageIndex = currentCount + index;

    const storageRef = ref(
      storage,
      `inmuebles/${inmobiliariaId}/${inmuebleId}/${imageIndex}.jpg`
    );

    await uploadBytes(storageRef, file);

    const url = await getDownloadURL(storageRef);

    return {
      url,
      order: imageIndex,
      createdAt: new Date(),
    };
  });

  return Promise.all(uploads);
};
