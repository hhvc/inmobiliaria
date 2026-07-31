import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
} from "firebase/storage";

import { storage } from "../../firebase/config";

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

const sanitizeName = (name = "imagen") =>
  name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-");

export const uploadEmprendimientoImages = async ({
  inmobiliariaId,
  emprendimientoId,
  files = [],
  startOrder = 0,
}) => {
  if (!inmobiliariaId || !emprendimientoId) {
    throw new Error("Faltan IDs para subir las imágenes");
  }

  const fileList = Array.from(files || []);
  const uploaded = [];

  for (let index = 0; index < fileList.length; index += 1) {
    const file = fileList[index];

    if (!ALLOWED_TYPES.includes(file.type)) {
      throw new Error(`La imagen ${file.name} debe ser JPG, PNG o WebP`);
    }

    if (file.size > MAX_IMAGE_SIZE) {
      throw new Error(`La imagen ${file.name} supera el máximo de 10 MB`);
    }

    const fileName = `${Date.now()}-${index}-${sanitizeName(file.name)}`;
    const storagePath = `emprendimientos/${inmobiliariaId}/${emprendimientoId}/${fileName}`;
    const imageRef = ref(storage, storagePath);

    await uploadBytes(imageRef, file, { contentType: file.type });
    const url = await getDownloadURL(imageRef);

    uploaded.push({
      url,
      storagePath,
      name: file.name,
      type: file.type,
      size: file.size,
      order: startOrder + index,
    });
  }

  return uploaded;
};

export const deleteEmprendimientoImages = async (images = []) => {
  await Promise.all(
    images
      .filter((image) => image?.storagePath)
      .map(async (image) => {
        try {
          await deleteObject(ref(storage, image.storagePath));
        } catch (error) {
          if (error?.code !== "storage/object-not-found") throw error;
        }
      }),
  );
};

