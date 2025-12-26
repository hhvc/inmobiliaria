import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

// Función para redimensionar imagen
export const resizeImage = (file, maxWidth = 800, maxHeight = 600) => {
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();

    img.onload = () => {
      let { width, height } = img;

      // Calcular nuevas dimensiones manteniendo aspect ratio
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }
      if (height > maxHeight) {
        width = (width * maxHeight) / height;
        height = maxHeight;
      }

      canvas.width = width;
      canvas.height = height;

      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(resolve, file.type, 0.8);
    };

    img.src = URL.createObjectURL(file);
  });
};

// Subir imagen a Firebase Storage
export const uploadImage = async (file, storagePath = "cabanas") => {
  try {
    // Redimensionar imagen antes de subir
    const resizedBlob = await resizeImage(file);
    const timestamp = Date.now();
    const fileName = `${storagePath}/${timestamp}_${file.name}`;
    const storage = getStorage();
    const storageRef = ref(storage, fileName);

    await uploadBytes(storageRef, resizedBlob);
    const downloadURL = await getDownloadURL(storageRef);

    return downloadURL;
  } catch (error) {
    console.error("Error subiendo imagen:", error);
    throw new Error("Error al subir la imagen");
  }
};

// Subir múltiples imágenes
export const uploadMultipleImages = async (files, storagePath = "cabanas") => {
  try {
    const uploadPromises = files.map((file) => uploadImage(file, storagePath));
    const urls = await Promise.all(uploadPromises);
    return urls;
  } catch (error) {
    console.error("Error subiendo imágenes:", error);
    throw new Error("Error al subir las imágenes");
  }
};

// Validar tipos de archivo de imagen
export const validateImageFile = (file) => {
  const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
  const maxSize = 5 * 1024 * 1024; // 5MB

  if (!validTypes.includes(file.type)) {
    throw new Error("Tipo de archivo no válido. Use JPEG, PNG o WebP.");
  }

  if (file.size > maxSize) {
    throw new Error("El archivo es demasiado grande. Máximo 5MB.");
  }

  return true;
};
