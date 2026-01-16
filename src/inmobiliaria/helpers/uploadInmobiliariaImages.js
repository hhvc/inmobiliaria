import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import app from "../../firebase/config";

const storage = getStorage(app);

export async function uploadInmobiliariaImages(
  inmobiliariaId,
  images = {},
  currentBranding = {}
) {
  if (!inmobiliariaId) {
    throw new Error("inmobiliariaId requerido");
  }

  const basePath = `inmobiliarias/${inmobiliariaId}`;
  const branding = { ...currentBranding };

  // Asegurar estructura de branding
  branding.backgrounds = branding.backgrounds || {};

  /* ======================================================
     Logo
     ====================================================== */

  if (images.logo !== undefined && images.logo !== null) {
    // Subir / reemplazar logo
    if (images.logo instanceof File) {
      // Si ya existe un logo, eliminarlo primero
      if (branding.logo?.path) {
        try {
          await deleteObject(ref(storage, branding.logo.path));
        } catch (error) {
          console.warn("No se pudo eliminar el logo anterior:", error);
        }
      }

      const ext = images.logo.name.split(".").pop() || "jpg";
      const path = `${basePath}/logo.${ext}`;
      const storageRef = ref(storage, path);

      await uploadBytes(storageRef, images.logo);
      const url = await getDownloadURL(storageRef);

      branding.logo = {
        url,
        path,
        filename: images.logo.name,
        size: images.logo.size,
        type: images.logo.type,
        updatedAt: new Date().toISOString(),
      };
    }
  } else if (images.logo === null && branding.logo?.path) {
    // Eliminar logo
    try {
      await deleteObject(ref(storage, branding.logo.path));
      delete branding.logo;
    } catch (error) {
      console.warn("No se pudo eliminar el logo:", error);
    }
  }

  /* ======================================================
     Backgrounds
     ====================================================== */

  // Procesar fondos si existen
  if (images.backgrounds) {
    // Asegurar que exista el objeto backgrounds
    branding.backgrounds = branding.backgrounds || {};

    const backgroundKeys = ["primary", "secondary", "tertiary"];

    for (const key of backgroundKeys) {
      const backgroundFile = images.backgrounds[key];

      // Verificar si se proporcionó un archivo para este fondo
      if (backgroundFile !== undefined && backgroundFile !== null) {
        if (backgroundFile instanceof File) {
          // Subir / reemplazar fondo
          const currentBg = branding.backgrounds[key];

          // Eliminar fondo anterior si existe
          if (currentBg?.path) {
            try {
              await deleteObject(ref(storage, currentBg.path));
            } catch (error) {
              console.warn(
                `No se pudo eliminar el fondo ${key} anterior:`,
                error
              );
            }
          }

          const ext = backgroundFile.name.split(".").pop() || "jpg";
          const path = `${basePath}/backgrounds/${key}.${ext}`;
          const storageRef = ref(storage, path);

          await uploadBytes(storageRef, backgroundFile);
          const url = await getDownloadURL(storageRef);

          branding.backgrounds[key] = {
            url,
            path,
            filename: backgroundFile.name,
            size: backgroundFile.size,
            type: backgroundFile.type,
            updatedAt: new Date().toISOString(),
          };
        }
      } else if (backgroundFile === null && branding.backgrounds[key]?.path) {
        // Eliminar fondo específico
        try {
          await deleteObject(ref(storage, branding.backgrounds[key].path));
          delete branding.backgrounds[key];
        } catch (error) {
          console.warn(`No se pudo eliminar el fondo ${key}:`, error);
        }
      }
    }

    // Si backgrounds está vacío después de procesar, mantenerlo como objeto vacío
    if (Object.keys(branding.backgrounds).length === 0) {
      branding.backgrounds = {};
    }
  }

  return branding;
}

// Versión alternativa simplificada si necesitas manejar solo las imágenes nuevas
export async function uploadInmobiliariaImagesSimplified(
  inmobiliariaId,
  images = {}
) {
  if (!inmobiliariaId) {
    throw new Error("inmobiliariaId requerido");
  }

  const basePath = `inmobiliarias/${inmobiliariaId}`;
  const branding = {
    backgrounds: {},
  };

  /* ======================================================
     Logo
     ====================================================== */

  if (images.logo && images.logo instanceof File) {
    const ext = images.logo.name.split(".").pop() || "jpg";
    const path = `${basePath}/logo.${ext}`;
    const storageRef = ref(storage, path);

    await uploadBytes(storageRef, images.logo);
    const url = await getDownloadURL(storageRef);

    branding.logo = {
      url,
      path,
      filename: images.logo.name,
      size: images.logo.size,
      type: images.logo.type,
      uploadedAt: new Date().toISOString(),
    };
  }

  /* ======================================================
     Backgrounds
     ====================================================== */

  if (images.backgrounds) {
    const backgroundKeys = ["primary", "secondary", "tertiary"];

    for (const key of backgroundKeys) {
      const backgroundFile = images.backgrounds[key];

      if (backgroundFile && backgroundFile instanceof File) {
        const ext = backgroundFile.name.split(".").pop() || "jpg";
        const path = `${basePath}/backgrounds/${key}.${ext}`;
        const storageRef = ref(storage, path);

        await uploadBytes(storageRef, backgroundFile);
        const url = await getDownloadURL(storageRef);

        branding.backgrounds[key] = {
          url,
          path,
          filename: backgroundFile.name,
          size: backgroundFile.size,
          type: backgroundFile.type,
          uploadedAt: new Date().toISOString(),
        };
      }
    }
  }

  return branding;
}
