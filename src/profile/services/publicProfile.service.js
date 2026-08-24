import {
  doc,
  getDoc,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
} from "firebase/storage";
import { updateProfile } from "firebase/auth";

import { auth, db, storage } from "../../firebase/config";
import {
  normalizePublicProfile,
  validatePublicProfile,
} from "../utils/publicProfile.helpers";

const PUBLIC_PROFILES_COLLECTION = "public_profiles";
const MAX_PROFILE_PHOTO_SIZE = 5 * 1024 * 1024;
const ALLOWED_PROFILE_PHOTO_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export const validatePublicProfilePhoto = (file) => {
  if (!file) return;

  if (!ALLOWED_PROFILE_PHOTO_TYPES.has(file.type)) {
    throw new Error("La foto debe estar en formato JPG, PNG o WebP.");
  }

  if (file.size > MAX_PROFILE_PHOTO_SIZE) {
    throw new Error("La foto no puede superar los 5 MB.");
  }
};

const publicProfileRef = (userId) =>
  doc(db, PUBLIC_PROFILES_COLLECTION, userId);

export const getPublicProfileById = async (userId) => {
  if (!userId) return null;

  try {
    const snap = await getDoc(publicProfileRef(userId));

    if (!snap.exists()) return null;

    return normalizePublicProfile({
      uid: snap.id,
      ...snap.data(),
    });
  } catch (error) {
    if (error?.code === "permission-denied") return null;
    throw error;
  }
};

export const getMyPublicProfile = async () => {
  const currentUser = auth.currentUser;
  if (!currentUser?.uid) return null;

  return getPublicProfileById(currentUser.uid);
};

const uploadProfilePhoto = async (userId, file) => {
  validatePublicProfilePhoto(file);

  const path = `public-profiles/${userId}/avatar`;
  const storageRef = ref(storage, path);

  await uploadBytes(storageRef, file, {
    contentType: file.type,
    cacheControl: "public,max-age=3600",
  });

  return {
    photoURL: await getDownloadURL(storageRef),
    photoPath: path,
  };
};

export const saveMyPublicProfile = async (
  profile,
  { photoFile = null, removePhoto = false } = {},
) => {
  const currentUser = auth.currentUser;

  if (!currentUser?.uid) {
    throw new Error("Tenés que iniciar sesión para editar tu perfil.");
  }

  const userId = currentUser.uid;
  const existingProfile = await getMyPublicProfile();
  let normalized = normalizePublicProfile(profile, {
    uid: userId,
    displayName: currentUser.displayName || "",
    photoURL: currentUser.photoURL || "",
  });
  const validationErrors = validatePublicProfile(normalized);

  if (Object.keys(validationErrors).length > 0) {
    const error = new Error("Revisá los datos del perfil.");
    error.validationErrors = validationErrors;
    throw error;
  }

  if (photoFile) {
    const uploadedPhoto = await uploadProfilePhoto(userId, photoFile);
    normalized = {
      ...normalized,
      ...uploadedPhoto,
    };
  } else if (removePhoto) {
    normalized = {
      ...normalized,
      photoURL: "",
      photoPath: "",
    };
  }

  const profilePayload = {
    uid: userId,
    displayName: normalized.displayName,
    photoURL: normalized.photoURL,
    photoPath: normalized.photoPath,
    headline: normalized.headline,
    bio: normalized.bio,
    location: normalized.location,
    isPublic: normalized.isPublic,
    updatedAt: serverTimestamp(),
    ...(existingProfile ? {} : { createdAt: serverTimestamp() }),
  };

  const batch = writeBatch(db);
  batch.set(publicProfileRef(userId), profilePayload, { merge: true });
  batch.set(
    doc(db, "users", userId),
    {
      displayName: normalized.displayName,
      photoURL: normalized.photoURL,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
  await batch.commit();

  try {
    await updateProfile(currentUser, {
      displayName: normalized.displayName,
      photoURL: normalized.photoURL || null,
    });
  } catch (error) {
    console.warn("El perfil público se guardó, pero Auth no pudo sincronizarse:", error);
  }

  if (removePhoto && existingProfile?.photoPath) {
    try {
      await deleteObject(ref(storage, existingProfile.photoPath));
    } catch (error) {
      if (error?.code !== "storage/object-not-found") {
        console.warn("No se pudo eliminar la foto anterior del Storage:", error);
      }
    }
  }

  return normalized;
};
