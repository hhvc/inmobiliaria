import {
  getBlob,
  getDownloadURL,
  ref,
  uploadBytes,
} from "firebase/storage";

import { storage } from "../../firebase/config";

export const INMUEBLE_MAX_IMAGES = 50;

export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

export const MIN_IMAGE_WIDTH = 1200;
export const MIN_IMAGE_HEIGHT = 675;

export const MAX_IMAGE_WIDTH = 6000;
export const MAX_IMAGE_HEIGHT = 6000;

const PORTAL_READY_MAX_WIDTH = 1920;
const PORTAL_READY_MAX_HEIGHT = 1920;

const THUMBNAIL_MAX_WIDTH = 640;
const THUMBNAIL_MAX_HEIGHT = 640;

const OUTPUT_CONTENT_TYPE = "image/jpeg";
const OUTPUT_EXTENSION = "jpg";
const PORTAL_READY_QUALITY = 0.86;
const THUMBNAIL_QUALITY = 0.78;

export const ACCEPTED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/bmp",
  "image/heic",
  "image/heif",
];

export const ACCEPTED_IMAGE_EXTENSIONS = [
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "bmp",
  "heic",
  "heif",
];

export const ACCEPTED_IMAGE_INPUT = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/bmp",
  "image/heic",
  "image/heif",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".bmp",
  ".heic",
  ".heif",
].join(",");

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

const isAllowedImage = ({ type = "", name = "" } = {}) => {
  const normalizedType = type.toLowerCase();
  const extension = getFileExtension(name);

  return (
    ACCEPTED_IMAGE_MIME_TYPES.includes(normalizedType) ||
    ACCEPTED_IMAGE_EXTENSIONS.includes(extension)
  );
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

const loadImageElement = (blob, imageName = "imagen") => {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(blob);
    const image = new Image();

    image.onload = () => {
      resolve({
        image,
        objectUrl,
        width: image.naturalWidth,
        height: image.naturalHeight,
      });
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(
        new Error(
          `No se pudo procesar la imagen "${imageName}". Si es HEIC/HEIF, convertí la foto a JPG/PNG/WEBP o agregamos conversión específica.`,
        ),
      );
    };

    image.src = objectUrl;
  });
};

const validateImageDimensions = ({ width, height, imageName }) => {
  if (!width || !height) {
    throw new Error(`No se pudo detectar la resolución de "${imageName}".`);
  }

  if (width < MIN_IMAGE_WIDTH || height < MIN_IMAGE_HEIGHT) {
    throw new Error(
      `La imagen "${imageName}" mide ${width} x ${height}px. El mínimo requerido es ${MIN_IMAGE_WIDTH} x ${MIN_IMAGE_HEIGHT}px.`,
    );
  }

  if (width > MAX_IMAGE_WIDTH || height > MAX_IMAGE_HEIGHT) {
    throw new Error(
      `La imagen "${imageName}" mide ${width} x ${height}px. El máximo permitido es ${MAX_IMAGE_WIDTH} x ${MAX_IMAGE_HEIGHT}px.`,
    );
  }
};

const getContainedSize = ({
  width,
  height,
  maxWidth,
  maxHeight,
  minWidth = 0,
  minHeight = 0,
}) => {
  const scale = Math.min(1, maxWidth / width, maxHeight / height);
  const nextWidth = Math.round(width * scale);
  const nextHeight = Math.round(height * scale);

  if (
    minWidth > 0 &&
    minHeight > 0 &&
    (nextWidth < minWidth || nextHeight < minHeight)
  ) {
    return {
      width,
      height,
      resized: false,
    };
  }

  return {
    width: nextWidth,
    height: nextHeight,
    resized: nextWidth !== width || nextHeight !== height,
  };
};

const drawImageToBlob = ({
  image,
  width,
  height,
  quality,
  contentType = OUTPUT_CONTENT_TYPE,
}) => {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");

    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");

    if (!context) {
      reject(new Error("No se pudo preparar la imagen para subir."));
      return;
    }

    context.drawImage(image, 0, 0, width, height);

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("No se pudo optimizar la imagen."));
          return;
        }

        resolve(blob);
      },
      contentType,
      quality,
    );
  });
};

const prepareImageForUpload = async ({ source, imageName }) => {
  ensureImageBlob(source, imageName);

  if (!isAllowedImage({ type: source.type, name: imageName })) {
    throw new Error(
      `Formato no permitido en "${imageName}". Usá JPG, JPEG, PNG, WEBP, GIF, BMP, HEIC o HEIF.`,
    );
  }

  const loadedImage = await loadImageElement(source, imageName);

  try {
    validateImageDimensions({
      width: loadedImage.width,
      height: loadedImage.height,
      imageName,
    });

    const portalReadySize = getContainedSize({
      width: loadedImage.width,
      height: loadedImage.height,
      maxWidth: PORTAL_READY_MAX_WIDTH,
      maxHeight: PORTAL_READY_MAX_HEIGHT,
      minWidth: MIN_IMAGE_WIDTH,
      minHeight: MIN_IMAGE_HEIGHT,
    });

    const thumbnailSize = getContainedSize({
      width: loadedImage.width,
      height: loadedImage.height,
      maxWidth: THUMBNAIL_MAX_WIDTH,
      maxHeight: THUMBNAIL_MAX_HEIGHT,
    });

    const portalBlob = await drawImageToBlob({
      image: loadedImage.image,
      width: portalReadySize.width,
      height: portalReadySize.height,
      quality: PORTAL_READY_QUALITY,
    });

    const thumbnailBlob = await drawImageToBlob({
      image: loadedImage.image,
      width: thumbnailSize.width,
      height: thumbnailSize.height,
      quality: THUMBNAIL_QUALITY,
    });

    return {
      portalBlob,
      thumbnailBlob,
      sourceWidth: loadedImage.width,
      sourceHeight: loadedImage.height,
      width: portalReadySize.width,
      height: portalReadySize.height,
      thumbnailWidth: thumbnailSize.width,
      thumbnailHeight: thumbnailSize.height,
      portalReady: true,
      qualityWarnings: [],
    };
  } finally {
    URL.revokeObjectURL(loadedImage.objectUrl);
  }
};

const uploadImageVersions = async ({
  source,
  originalName,
  inmuebleId,
  inmobiliariaId,
  index = 0,
  order = 0,
  customMetadata = {},
  extraImageData = {},
}) => {
  const imageId = createImageId();
  const safeOriginalName = sanitizeFileName(originalName || "imagen.jpg");
  const timestamp = Date.now();
  const baseFileName = `${timestamp}-${index}-${imageId}`;

  const storagePath = `inmuebles/${inmobiliariaId}/${inmuebleId}/${baseFileName}.${OUTPUT_EXTENSION}`;
  const thumbnailPath = `inmuebles/${inmobiliariaId}/${inmuebleId}/${baseFileName}-thumb.${OUTPUT_EXTENSION}`;

  const preparedImage = await prepareImageForUpload({
    source,
    imageName: originalName || safeOriginalName,
  });

  const imageRef = ref(storage, storagePath);
  const thumbnailRef = ref(storage, thumbnailPath);

  const sharedMetadata = {
    originalName: safeOriginalName,
    originalSizeBytes: String(source.size || 0),
    originalType: source.type || "",
    sourceWidth: String(preparedImage.sourceWidth || ""),
    sourceHeight: String(preparedImage.sourceHeight || ""),
    ...customMetadata,
  };

  await uploadBytes(imageRef, preparedImage.portalBlob, {
    contentType: OUTPUT_CONTENT_TYPE,
    customMetadata: {
      ...sharedMetadata,
      derivative: "portal-ready",
    },
  });

  await uploadBytes(thumbnailRef, preparedImage.thumbnailBlob, {
    contentType: OUTPUT_CONTENT_TYPE,
    customMetadata: {
      ...sharedMetadata,
      derivative: "thumbnail",
    },
  });

  const url = await getDownloadURL(imageRef);
  const thumbnailUrl = await getDownloadURL(thumbnailRef);

  return {
    id: imageId,

    url,
    storagePath,

    thumbnailUrl,
    thumbnailPath,

    order,
    filename: originalName || safeOriginalName,
    name: originalName || safeOriginalName,

    size: preparedImage.portalBlob.size || 0,
    type: OUTPUT_CONTENT_TYPE,
    contentType: OUTPUT_CONTENT_TYPE,

    width: preparedImage.width,
    height: preparedImage.height,

    thumbnailWidth: preparedImage.thumbnailWidth,
    thumbnailHeight: preparedImage.thumbnailHeight,

    portalReady: preparedImage.portalReady,
    qualityWarnings: preparedImage.qualityWarnings,

    source: {
      originalWidth: preparedImage.sourceWidth,
      originalHeight: preparedImage.sourceHeight,
      originalSizeBytes: source.size || 0,
      originalType: source.type || "",
      originalName: originalName || safeOriginalName,
    },

    createdAt: new Date().toISOString(),

    ...extraImageData,
  };
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
 * Guarda:
 * - imagen optimizada portal-ready
 * - miniatura
 *
 * No conserva el archivo original pesado en V1.
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
  const uploadedImages = [];

  for (let index = 0; index < filesArray.length; index += 1) {
    const file = filesArray[index];
    const originalName = file?.name || `imagen-${index + 1}.jpg`;

    if (!isAllowedImage({ type: file?.type, name: originalName })) {
      throw new Error(
        `Formato no permitido en "${originalName}". Usá JPG, JPEG, PNG, WEBP, GIF, BMP, HEIC o HEIF.`,
      );
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      throw new Error(
        `La imagen "${originalName}" supera el máximo permitido de 10 MB.`,
      );
    }

    const uploadedImage = await uploadImageVersions({
      source: file,
      originalName,
      inmuebleId,
      inmobiliariaId,
      index,
      order: baseOrder + index,
    });

    uploadedImages.push(uploadedImage);
  }

  return uploadedImages;
};

/**
 * Copia imágenes cargadas en una solicitud particular hacia
 * la carpeta pública/operativa del inmueble.
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

  const uploadedImages = [];

  for (let index = 0; index < sourceImages.length; index += 1) {
    const image = sourceImages[index];
    const originalName =
      image.filename || image.name || `solicitud-${index + 1}.jpg`;

    const blob = await downloadSourceImageAsBlob(image);

    const uploadedImage = await uploadImageVersions({
      source: blob,
      originalName,
      inmuebleId,
      inmobiliariaId,
      index,
      order: startOrder + index,
      customMetadata: {
        source: "particular_publication_request",
        sourceStoragePath: image.storagePath || "",
      },
      extraImageData: {
        copiedFrom: image.storagePath || image.url || "",
      },
    });

    uploadedImages.push(uploadedImage);
  }

  return uploadedImages;
};