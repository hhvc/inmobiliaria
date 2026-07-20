import {
  getBlob,
  getDownloadURL,
  ref,
  uploadBytes,
} from "firebase/storage";

import { storage } from "../../firebase/config";

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

const createImageId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const sanitizeFileName = (fileName = "imagen") => {
  return (
    fileName
      .toString()
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 90) || "imagen.jpg"
  );
};

const getFileExtension = (fileName = "") => {
  const ext = fileName.split(".").pop()?.toLowerCase();

  return ext || "jpg";
};

const ensureImageBlob = (blob, imageName = "imagen") => {
  if (!blob) {
    throw new Error(`No se pudo leer la imagen "${imageName}".`);
  }

  if (blob.size > MAX_IMAGE_SIZE_BYTES) {
    throw new Error(`La imagen "${imageName}" supera el máximo de 10 MB.`);
  }

  if (blob.type && !blob.type.startsWith("image/")) {
    throw new Error(`El archivo "${imageName}" no es una imagen válida.`);
  }
};

const downloadSourceImageAsBlob = async (image) => {
  const imageName = image?.filename || image?.name || "imagen";

  if (image?.storagePath) {
    const sourceRef = ref(storage, image.storagePath);
    const blob = await getBlob(sourceRef);
    ensureImageBlob(blob, imageName);
    return blob;
  }

  if (!image?.url) {
    throw new Error(`La imagen "${imageName}" no tiene URL ni storagePath.`);
  }

  const response = await fetch(image.url);

  if (!response.ok) {
    throw new Error(`No se pudo descargar la imagen "${imageName}".`);
  }

  const blob = await response.blob();
  ensureImageBlob(blob, imageName);

  return blob;
};

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

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      throw new Error("Una de las imágenes supera el máximo permitido de 10 MB");
    }

    const ext = getFileExtension(file.name);
    const imageId = createImageId();
    const fileName = `${Date.now()}-${index}-${imageId}.${ext}`;
    const storagePath = `inmuebles/${inmobiliariaId}/${inmuebleId}/${fileName}`;

    const storageRef = ref(storage, storagePath);

    await uploadBytes(storageRef, file, {
      contentType: file.type || "image/jpeg",
    });

    const url = await getDownloadURL(storageRef);

    return {
      id: imageId,
      url,
      storagePath,
      order: baseOrder + index,
      filename: file.name || fileName,
      name: file.name || fileName,
      size: file.size || 0,
      type: file.type || "image/jpeg",
      contentType: file.type || "image/jpeg",
      createdAt: new Date().toISOString(),
    };
  });

  return Promise.all(uploads);
};

/**
 * Copia imágenes cargadas en una solicitud particular hacia
 * la carpeta pública/operativa del inmueble.
 *
 * Origen:
 * /particular_publication_requests/{requestId}/{userId}/{fileName}
 *
 * Destino:
 * /inmuebles/{inmobiliariaId}/{inmuebleId}/{fileName}
 */
export const copyPublicationRequestImagesToInmueble = async ({
  images = [],
  inmuebleId,
  inmobiliariaId,
  startOrder = 0,
}) => {
  if (!inmuebleId || !inmobiliariaId) {
    throw new Error("Faltan IDs para copiar imágenes al inmueble");
  }

  const sourceImages = Array.isArray(images)
    ? images
      .filter((image) => image?.url || image?.storagePath)
      .sort((a, b) => {
        const orderA = Number.isFinite(Number(a.order))
          ? Number(a.order)
          : 0;
        const orderB = Number.isFinite(Number(b.order))
          ? Number(b.order)
          : 0;

        return orderA - orderB;
      })
    : [];

  if (sourceImages.length === 0) {
    return [];
  }

  const uploads = sourceImages.map(async (image, index) => {
    const imageId = createImageId();
    const originalName =
      image.filename || image.name || `solicitud-${index + 1}.jpg`;
    const safeName = sanitizeFileName(originalName);
    const ext = getFileExtension(safeName);
    const fileName = `${Date.now()}-${index}-${imageId}.${ext}`;
    const storagePath = `inmuebles/${inmobiliariaId}/${inmuebleId}/${fileName}`;

    const blob = await downloadSourceImageAsBlob(image);
    const contentType =
      image.contentType || image.type || blob.type || "image/jpeg";

    const destinationRef = ref(storage, storagePath);

    await uploadBytes(destinationRef, blob, {
      contentType,
      customMetadata: {
        source: "particular_publication_request",
        sourceStoragePath: image.storagePath || "",
      },
    });

    const url = await getDownloadURL(destinationRef);

    return {
      id: imageId,
      url,
      storagePath,
      order: startOrder + index,
      filename: originalName,
      name: originalName,
      size: blob.size || image.size || 0,
      type: contentType,
      contentType,
      createdAt: new Date().toISOString(),
      copiedFrom: image.storagePath || image.url || "",
    };
  });

  return Promise.all(uploads);
};