import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytesResumable,
} from "firebase/storage";

import {
  appCheckReadyPromise,
  auth,
  storage,
} from "../../firebase/config";
import {
  normalizeInstagramReel,
  validateInstagramReelMetadata,
} from "../utils/instagramReels.helpers";

const readVideoMetadata = (file) =>
  new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement("video");
    const cleanup = () => {
      URL.revokeObjectURL(objectUrl);
      video.removeAttribute("src");
      video.load();
    };

    video.preload = "metadata";
    video.muted = true;
    video.onloadedmetadata = () => {
      const result = {
        duration: Number(video.duration || 0),
        width: Number(video.videoWidth || 0),
        height: Number(video.videoHeight || 0),
      };
      cleanup();
      resolve(result);
    };
    video.onerror = () => {
      cleanup();
      reject(
        new Error(
          "No se pudo leer el video. Convertí el archivo a MP4 con video H.264 y audio AAC.",
        ),
      );
    };
    video.src = objectUrl;
  });

const createReelId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `reel-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const sanitizeFileName = (fileName = "video.mp4") =>
  fileName
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .slice(-180);

export const uploadInstagramReel = async ({
  inmobiliariaId,
  inmuebleId,
  file,
  onProgress,
}) => {
  if (!inmobiliariaId || !inmuebleId || !file) {
    throw new Error("Faltan datos para subir el video.");
  }

  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("Tenés que iniciar sesión.");

  const metadata = await readVideoMetadata(file);
  const validationErrors = validateInstagramReelMetadata({
    name: file.name,
    contentType: file.type,
    size: file.size,
    ...metadata,
  });
  if (validationErrors.length > 0) {
    throw new Error(validationErrors.join(" "));
  }

  await appCheckReadyPromise;
  const id = createReelId();
  const safeName = sanitizeFileName(file.name);
  const resolvedContentType =
    file.type || (/\.mov$/i.test(file.name) ? "video/quicktime" : "video/mp4");
  const storagePath = `inmuebles/${inmobiliariaId}/${inmuebleId}/instagram/${id}-${safeName}`;
  const storageRef = ref(storage, storagePath);
  const uploadTask = uploadBytesResumable(storageRef, file, {
    contentType: resolvedContentType,
    customMetadata: {
      inmobiliariaId,
      inmuebleId,
      uploadedBy: currentUser.uid,
      purpose: "instagram-reel",
    },
  });

  await new Promise((resolve, reject) => {
    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const progress = snapshot.totalBytes
          ? Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)
          : 0;
        onProgress?.(progress);
      },
      reject,
      resolve,
    );
  });

  const url = await getDownloadURL(uploadTask.snapshot.ref);
  onProgress?.(100);
  return normalizeInstagramReel({
    id,
    url,
    storagePath,
    name: file.name,
    contentType: resolvedContentType,
    size: file.size,
    ...metadata,
    createdAt: new Date().toISOString(),
    uploadedBy: currentUser.uid,
  });
};

export const deleteInstagramReelFile = async ({
  inmobiliariaId,
  inmuebleId,
  storagePath,
}) => {
  const prefix = `inmuebles/${inmobiliariaId}/${inmuebleId}/instagram/`;
  if (!storagePath?.startsWith(prefix)) {
    throw new Error("La ruta del video no es válida.");
  }

  await appCheckReadyPromise;
  await deleteObject(ref(storage, storagePath));
};
