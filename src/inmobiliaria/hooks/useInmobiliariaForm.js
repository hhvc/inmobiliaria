import { useEffect, useState } from "react";

/* ======================================================
   Utilidades
   ====================================================== */

const slugify = (text = "") =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const isValidCUIT = (cuit) => {
  // Validación básica de CUIT argentino - versión más permisiva
  // Primero verificar formato básico
  if (!cuit) return false;

  // Limpiar espacios y guiones
  const cleanCuit = cuit.toString().replace(/\s+/g, "").replace(/-/g, "");

  // Verificar que solo contenga números
  if (!/^\d{11}$/.test(cleanCuit)) {
    // Intentar validar con formato XX-XXXXXXXX-X
    const cuitRegex = /^\d{2}-\d{8}-\d{1}$/;
    return cuitRegex.test(cuit.trim());
  }

  return true; // Versión simplificada para desarrollo
};

/* ======================================================
   Estado inicial
   ====================================================== */

const emptyBranding = {
  logo: null,
  backgrounds: {
    primary: null,
    secondary: null,
    tertiary: null,
  },
};

const initialState = {
  nombre: "",
  razonSocial: "",
  cuit: "",
  slug: "",
  activa: true,
  configuracion: {
    operacionesPermitidas: [],
    tiposInmueblePermitidos: [],
    contacto: {
      email: "",
      telefono: "",
      whatsapp: "",
    },
  },
  branding: emptyBranding,
  createdAt: null,
  updatedAt: null,
};

/* ======================================================
   Hook principal
   ====================================================== */

export const useInmobiliariaForm = ({ inmobiliariaExistente = null } = {}) => {
  const isEditMode = Boolean(inmobiliariaExistente);

  const [formData, setFormData] = useState(initialState);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  /* -------------------- Init (edición) -------------------- */

  useEffect(() => {
    if (!inmobiliariaExistente) {
      return; // No hacer nada en modo creación
    }

    // Modo edición: cargar datos existentes
    const data = {
      nombre: inmobiliariaExistente.nombre || "",
      razonSocial: inmobiliariaExistente.razonSocial || "",
      cuit: inmobiliariaExistente.cuit || "",
      slug: inmobiliariaExistente.slug || "",
      activa: inmobiliariaExistente.activa ?? true,
      configuracion: {
        operacionesPermitidas:
          inmobiliariaExistente.configuracion?.operacionesPermitidas || [],
        tiposInmueblePermitidos:
          inmobiliariaExistente.configuracion?.tiposInmueblePermitidos || [],
        contacto: {
          email: inmobiliariaExistente.configuracion?.contacto?.email || "",
          telefono:
            inmobiliariaExistente.configuracion?.contacto?.telefono || "",
          whatsapp:
            inmobiliariaExistente.configuracion?.contacto?.whatsapp || "",
        },
      },
      branding: {
        logo: inmobiliariaExistente.branding?.logo || null,
        backgrounds: {
          primary: inmobiliariaExistente.branding?.backgrounds?.primary || null,
          secondary:
            inmobiliariaExistente.branding?.backgrounds?.secondary || null,
          tertiary:
            inmobiliariaExistente.branding?.backgrounds?.tertiary || null,
        },
      },
      createdAt: inmobiliariaExistente.createdAt || null,
      updatedAt: inmobiliariaExistente.updatedAt || null,
    };

    setFormData(data);
  }, [inmobiliariaExistente]);

  /* -------------------- Helpers -------------------- */

  const updateField = (path, value) => {
    setFormData((prev) => {
      const updated = JSON.parse(JSON.stringify(prev)); // Usar JSON.parse/stringify en lugar de structuredClone
      const keys = path.split(".");
      let ref = updated;

      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];

        if (i === keys.length - 1) {
          ref[key] = value;
        } else {
          if (ref[key] === undefined || ref[key] === null) {
            // Determinar el tipo de objeto a crear basado en el siguiente key
            if (keys[i + 1] === "contacto") {
              ref[key] = { contacto: {} };
            } else if (keys[i + 1] === "backgrounds") {
              ref[key] = { backgrounds: {} };
            } else {
              ref[key] = {};
            }
          }
          ref = ref[key];
        }
      }

      return updated;
    });

    // Marcar el campo como "touched"
    setTouched((prev) => ({
      ...prev,
      [path]: true,
    }));

    // Limpiar error si existe
    if (errors[path]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[path];
        return newErrors;
      });
    }
  };

  /* -------------------- Manejo de arrays (checkboxes) -------------------- */

  const toggleArrayItem = (path, value) => {
    const currentArray = getFieldValue(path) || [];
    const newArray = currentArray.includes(value)
      ? currentArray.filter((item) => item !== value)
      : [...currentArray, value];

    updateField(path, newArray);
  };

  /* -------------------- Obtener valor de campo -------------------- */

  const getFieldValue = (path) => {
    const keys = path.split(".");
    let value = formData;

    for (const key of keys) {
      if (value === null || value === undefined) return undefined;
      value = value[key];
    }

    return value;
  };

  /* -------------------- Validaciones -------------------- */

  const validateField = (path, value) => {
    const fieldName = path.split(".").pop();

    switch (fieldName) {
      case "nombre": {
        if (!value?.trim()) return "El nombre es obligatorio";
        if (value.length < 2)
          return "El nombre debe tener al menos 2 caracteres";
        if (value.length > 100) return "El nombre es demasiado largo";
        break;
      }

      case "razonSocial": {
        if (!value?.trim()) return "La razón social es obligatoria";
        if (value.length < 2)
          return "La razón social debe tener al menos 2 caracteres";
        if (value.length > 200) return "La razón social es demasiado larga";
        break;
      }

      case "cuit": {
        if (!value?.trim()) return "El CUIT es obligatorio";
        if (!isValidCUIT(value)) return "CUIT inválido. Formato: 00-00000000-0";
        break;
      }

      case "slug": {
        const trimmedSlug = value?.trim();
        if (!trimmedSlug) return "El slug es obligatorio";

        // Permitir slugs sin guiones (como "hvc")
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(trimmedSlug)) {
          return "Slug inválido. Solo letras minúsculas, números y guiones. Ejemplo: mi-inmobiliaria";
        }

        if (trimmedSlug.length < 2)
          return "El slug debe tener al menos 2 caracteres";
        if (trimmedSlug.length > 50) return "El slug es demasiado largo";
        break;
      }

      case "email": {
        if (!value?.trim()) return "El email es obligatorio";
        if (!isValidEmail(value)) return "Email inválido";
        break;
      }

      case "telefono": {
        if (value && value.trim() && !/^[\d\s+\-()]{6,20}$/.test(value)) {
          return "Teléfono inválido";
        }
        break;
      }

      case "whatsapp": {
        if (value && value.trim() && !/^[\d\s+\-()]{6,20}$/.test(value)) {
          return "WhatsApp inválido";
        }
        break;
      }

      case "operacionesPermitidas": {
        if (!Array.isArray(value) || value.length === 0) {
          return "Debe seleccionar al menos una operación";
        }
        break;
      }

      case "tiposInmueblePermitidos": {
        if (!Array.isArray(value) || value.length === 0) {
          return "Debe seleccionar al menos un tipo de inmueble";
        }
        break;
      }

      default: {
        break;
      }
    }

    return null;
  };

  const validate = () => {
    const newErrors = {};

    // Campos principales a validar
    const fieldsToValidate = [
      "nombre",
      "razonSocial",
      "cuit",
      "slug",
      "configuracion.operacionesPermitidas",
      "configuracion.tiposInmueblePermitidos",
      "configuracion.contacto.email",
    ];

    fieldsToValidate.forEach((path) => {
      const value = getFieldValue(path);
      const error = validateField(path, value);
      if (error) {
        newErrors[path] = error;
      }
    });

    // Mostrar errores en consola para debug
    if (Object.keys(newErrors).length > 0) {
      console.log("Errores de validación:", newErrors);
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /* -------------------- Submit handler -------------------- */

  const submit = async (callback) => {
    // Primero validar
    const isValid = validate();

    if (!isValid) {
      console.error("Errores de validación encontrados:", errors);
      throw new Error("Por favor, corrige los errores en el formulario");
    }

    // Preparar datos para enviar
    const payload = {
      ...formData,
      updatedAt: new Date().toISOString(),
    };

    // Si es creación, añadir createdAt
    if (!isEditMode && !payload.createdAt) {
      payload.createdAt = new Date().toISOString();
    }

    // Separar imágenes del payload principal
    const brandingImages = {
      logo: payload.branding?.logo || null,
      backgrounds: payload.branding?.backgrounds || {},
    };

    // Remover las imágenes del payload (se enviarán por separado)
    const { branding: _branding, ...payloadWithoutBranding } = payload;

    console.log("Enviando datos:", payloadWithoutBranding);
    console.log("Imágenes:", brandingImages);

    return await callback(payloadWithoutBranding, brandingImages);
  };

  /* -------------------- Reset form -------------------- */

  const resetForm = () => {
    setFormData(initialState);
    setErrors({});
    setTouched({});
  };

  /* -------------------- Generar slug desde nombre -------------------- */

  const generateSlugFromName = () => {
    if (formData.nombre) {
      const generatedSlug = slugify(formData.nombre);
      updateField("slug", generatedSlug);
    }
  };

  /* -------------------- Manejo de archivos -------------------- */

  const handleFileUpload = (path, file, preview) => {
    const fileData = {
      file,
      preview: preview || URL.createObjectURL(file),
      uploadedAt: new Date().toISOString(),
    };
    updateField(path, fileData);
  };

  const handleFileRemove = (path) => {
    updateField(path, null);
  };

  return {
    formData,
    errors,
    touched,
    isEditMode,
    updateField,
    toggleArrayItem,
    getFieldValue,
    validate,
    submit,
    resetForm,
    generateSlugFromName,
    handleFileUpload,
    handleFileRemove,
  };
};

// import { useEffect, useState } from "react";

// /* ======================================================
//    Utilidades
//    ====================================================== */

// const slugify = (text = "") =>
//   text
//     .toLowerCase()
//     .normalize("NFD")
//     .replace(/[\u0300-\u036f]/g, "")
//     .replace(/[^a-z0-9]+/g, "-")
//     .replace(/(^-|-$)+/g, "");

// const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// /* ======================================================
//    Estado inicial
//    ====================================================== */

// const emptyBranding = {
//   logo: { file: null, preview: null },
//   backgrounds: {
//     primary: { file: null, preview: null },
//     secondary: { file: null, preview: null },
//     tertiary: { file: null, preview: null },
//   },
// };

// const initialState = {
//   nombre: "",
//   slug: "",
//   contacto: {
//     email: "",
//     telefono: "",
//     whatsapp: "",
//   },
//   configuracion: {
//     tiposInmueblePermitidos: [],
//     operacionesPermitidas: [],
//   },
//   branding: emptyBranding,
//   activa: true,
// };

// /* ======================================================
//    Hook principal
//    ====================================================== */

// export const useInmobiliariaForm = (inmobiliariaExistente = null) => {
//   const isEdit = Boolean(inmobiliariaExistente);

//   const [formData, setFormData] = useState(initialState);
//   const [errors, setErrors] = useState({});

//   /* -------------------- Init (edición) -------------------- */

//   useEffect(() => {
//     if (!inmobiliariaExistente) return;

//     setFormData({
//       nombre: inmobiliariaExistente.nombre ?? "",
//       slug: inmobiliariaExistente.slug ?? "",
//       contacto: inmobiliariaExistente.contacto ?? initialState.contacto,
//       configuracion:
//         inmobiliariaExistente.configuracion ?? initialState.configuracion,
//       branding: {
//         logo: {
//           file: null,
//           preview: inmobiliariaExistente.branding?.logo ?? null,
//         },
//         backgrounds: {
//           primary: {
//             file: null,
//             preview:
//               inmobiliariaExistente.branding?.backgrounds?.primary ?? null,
//           },
//           secondary: {
//             file: null,
//             preview:
//               inmobiliariaExistente.branding?.backgrounds?.secondary ?? null,
//           },
//           tertiary: {
//             file: null,
//             preview:
//               inmobiliariaExistente.branding?.backgrounds?.tertiary ?? null,
//           },
//         },
//       },
//       activa: inmobiliariaExistente.activa ?? true,
//     });
//   }, [inmobiliariaExistente]);

//   /* -------------------- Auto-slug -------------------- */

//   useEffect(() => {
//     if (!isEdit && formData.nombre) {
//       setFormData((prev) => ({
//         ...prev,
//         slug: slugify(prev.nombre),
//       }));
//     }
//   }, [formData.nombre, isEdit]);

//   /* -------------------- Helpers -------------------- */

//   const updateField = (path, value) => {
//     setFormData((prev) => {
//       const updated = structuredClone(prev);
//       const keys = path.split(".");
//       let ref = updated;

//       keys.forEach((key, i) => {
//         if (i === keys.length - 1) {
//           ref[key] = value;
//         } else {
//           ref[key] ??= {};
//           ref = ref[key];
//         }
//       });

//       return updated;
//     });
//   };

//   /* -------------------- Validaciones -------------------- */

//   const validate = () => {
//     const newErrors = {};

//     if (!formData.nombre.trim()) {
//       newErrors.nombre = "El nombre es obligatorio";
//     }

//     if (!formData.contacto.email.trim()) {
//       newErrors.email = "El email es obligatorio";
//     } else if (!isValidEmail(formData.contacto.email)) {
//       newErrors.email = "Email inválido";
//     }

//     if (!formData.configuracion.tiposInmueblePermitidos.length) {
//       newErrors.tiposInmueblePermitidos =
//         "Debe seleccionar al menos un tipo de inmueble";
//     }

//     if (!formData.configuracion.operacionesPermitidas.length) {
//       newErrors.operacionesPermitidas =
//         "Debe seleccionar al menos una operación";
//     }

//     setErrors(newErrors);
//     return Object.keys(newErrors).length === 0;
//   };

//   /* -------------------- Reset (post-create) -------------------- */

//   const resetForm = () => {
//     setFormData(initialState);
//     setErrors({});
//   };

//   return {
//     formData,
//     errors,
//     isEdit,
//     updateField,
//     validate,
//     resetForm,
//   };
// };

// // src/Inmobiliaria/hooks/useInmobiliariaForm.js
// import { useEffect, useState } from "react";
// import {
//   collection,
//   doc,
//   getDocs,
//   query,
//   where,
//   addDoc,
//   updateDoc,
//   serverTimestamp,
// } from "firebase/firestore";
// import { db } from "../../firebase/config";

// /* ======================================================
//    Utilidades
//    ====================================================== */

// const slugify = (text = "") =>
//   text
//     .toLowerCase()
//     .normalize("NFD")
//     .replace(/[\u0300-\u036f]/g, "")
//     .replace(/[^a-z0-9]+/g, "-")
//     .replace(/(^-|-$)+/g, "");

// const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// /* ======================================================
//    Hook principal
//    ====================================================== */

// export const useInmobiliariaForm = (params) => {
//   // 🛡️ Blindaje total de parámetros
//   const {
//     inmobiliariaExistente = null,
//     currentUser = null,
//     onSave,
//   } = params ?? {};

//   const isEditMode = Boolean(inmobiliariaExistente);
//   const isRoot = currentUser?.role === "root";

//   /* -------------------- Estado -------------------- */

//   const [formData, setFormData] = useState({
//     nombre: "",
//     slug: "",
//     razonSocial: "",
//     cuit: "",
//     contacto: {
//       email: "",
//       telefono: "",
//       whatsapp: "",
//     },
//     configuracion: {
//       tiposInmueblePermitidos: [],
//       operacionesPermitidas: [],
//     },
//     estado: {
//       activa: true,
//     },
//   });

//   const [errors, setErrors] = useState({});
//   const [loading, setLoading] = useState(false);

//   /* -------------------- Init (modo edición) -------------------- */

//   useEffect(() => {
//     if (!inmobiliariaExistente) return;

//     setFormData({
//       nombre: inmobiliariaExistente.nombre ?? "",
//       slug: inmobiliariaExistente.slug ?? "",
//       razonSocial: inmobiliariaExistente.razonSocial ?? "",
//       cuit: inmobiliariaExistente.cuit ?? "",
//       contacto: inmobiliariaExistente.contacto ?? {
//         email: "",
//         telefono: "",
//         whatsapp: "",
//       },
//       configuracion: inmobiliariaExistente.configuracion ?? {
//         tiposInmueblePermitidos: [],
//         operacionesPermitidas: [],
//       },
//       estado: inmobiliariaExistente.estado ?? { activa: true },
//     });
//   }, [inmobiliariaExistente]);

//   /* -------------------- Auto-slug -------------------- */

//   useEffect(() => {
//     if (!isEditMode && formData.nombre) {
//       setFormData((prev) => ({
//         ...prev,
//         slug: slugify(prev.nombre),
//       }));
//     }
//   }, [formData.nombre, isEditMode]);

//   /* -------------------- Helpers -------------------- */

//   const updateField = (path, value) => {
//     setFormData((prev) => {
//       const updated = { ...prev };
//       const keys = path.split(".");
//       let ref = updated;

//       keys.forEach((key, index) => {
//         if (index === keys.length - 1) {
//           ref[key] = value;
//         } else {
//           ref[key] = { ...ref[key] };
//           ref = ref[key];
//         }
//       });

//       return updated;
//     });
//   };

//   const toggleArrayValue = (path, value) => {
//     setFormData((prev) => {
//       const updated = { ...prev };
//       const keys = path.split(".");
//       let ref = updated;

//       keys.forEach((key, index) => {
//         if (index === keys.length - 1) {
//           const arr = ref[key] ?? [];
//           ref[key] = arr.includes(value)
//             ? arr.filter((v) => v !== value)
//             : [...arr, value];
//         } else {
//           ref[key] = { ...ref[key] };
//           ref = ref[key];
//         }
//       });

//       return updated;
//     });
//   };

//   /* -------------------- Validaciones -------------------- */

//   const validate = async () => {
//     const newErrors = {};

//     if (!formData.nombre.trim()) {
//       newErrors.nombre = "El nombre es obligatorio";
//     }

//     if (!formData.contacto.email.trim()) {
//       newErrors.email = "El email es obligatorio";
//     } else if (!isValidEmail(formData.contacto.email)) {
//       newErrors.email = "Email inválido";
//     }

//     if (!formData.configuracion.tiposInmueblePermitidos.length) {
//       newErrors.tiposInmueblePermitidos =
//         "Debe seleccionar al menos un tipo de inmueble";
//     }

//     if (!formData.configuracion.operacionesPermitidas.length) {
//       newErrors.operacionesPermitidas =
//         "Debe seleccionar al menos una operación";
//     }

//     // Validación de slug único
//     if (!isEditMode || isRoot) {
//       const q = query(
//         collection(db, "inmobiliarias"),
//         where("slug", "==", formData.slug)
//       );

//       const snapshot = await getDocs(q);

//       if (!snapshot.empty) {
//         const existeOtro =
//           !isEditMode ||
//           snapshot.docs.some((d) => d.id !== inmobiliariaExistente?.id);

//         if (existeOtro) {
//           newErrors.slug = "Ya existe una inmobiliaria con este nombre";
//         }
//       }
//     }

//     setErrors(newErrors);
//     return Object.keys(newErrors).length === 0;
//   };

//   /* -------------------- Submit -------------------- */

//   const submit = async (onSubmit) => {
//     setLoading(true);

//     try {
//       const ok = await validate();
//       if (!ok) return;

//       const payload = {
//         nombre: formData.nombre.trim(),
//         slug: formData.slug.trim(),
//         razonSocial: formData.razonSocial.trim(),
//         cuit: formData.cuit.trim(),
//         contacto: formData.contacto,
//         configuracion: formData.configuracion,
//         estado: {
//           activa: formData.estado.activa,
//         },
//         updatedAt: serverTimestamp(),
//       };

//       if (onSubmit) {
//         await onSubmit(payload);
//       } else if (isEditMode) {
//         await updateDoc(
//           doc(db, "inmobiliarias", inmobiliariaExistente.id),
//           payload
//         );
//       } else {
//         await addDoc(collection(db, "inmobiliarias"), {
//           ...payload,
//           createdAt: serverTimestamp(),
//         });
//       }

//       onSave?.();
//     } catch (err) {
//       console.error("Error guardando inmobiliaria:", err);
//     } finally {
//       setLoading(false);
//     }
//   };

//   return {
//     formData,
//     errors,
//     loading,
//     isEditMode,
//     updateField,
//     toggleArrayValue,
//     submit,
//   };
// };
