import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "../../firebase/config";

/**
 * Sube imágenes de un inmueble a Firebase Storage.
 *
 * Ruta:
 * /inmuebles/{inmobiliariaId}/{inmuebleId}/{timestamp-index.ext}
 */
export const uploadInmuebleImages = async ({
  files,
  inmuebleId,
  inmobiliariaId,
  currentCount = 0,
  startOrder = 0,
}) => {
  if (!inmuebleId || !inmobiliariaId) {
    throw new Error("Faltan IDs para subir imágenes");
  }

  const filesArray = Array.from(files || []);

  if (filesArray.length === 0) {
    return [];
  }

  const baseOrder = Number.isFinite(startOrder) ? startOrder : currentCount;

  const uploads = filesArray.map(async (file, index) => {
    if (!file?.type?.startsWith("image/")) {
      throw new Error("Solo se permiten archivos de imagen");
    }

    const ext = file.name?.split(".").pop()?.toLowerCase() || "jpg";
    const fileName = `${Date.now()}-${index}.${ext}`;
    const storagePath = `inmuebles/${inmobiliariaId}/${inmuebleId}/${fileName}`;

    const storageRef = ref(storage, storagePath);

    await uploadBytes(storageRef, file);

    const url = await getDownloadURL(storageRef);

    return {
      url,
      storagePath,
      order: baseOrder + index,
      filename: file.name || fileName,
      size: file.size || 0,
      type: file.type || "image/jpeg",
      createdAt: new Date().toISOString(),
    };
  });

  return Promise.all(uploads);
};