import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";

import { db, auth } from "../../firebase/config";

/**
 * 🔹 Colección principal
 */
const COLLECTION_NAME = "inmobiliarias";
const inmobiliariasRef = collection(db, COLLECTION_NAME);

/**
 * 🏢 Crear inmobiliaria con nueva estructura
 */
export async function createInmobiliaria(data) {
  const currentUser = auth.currentUser;
  if (!currentUser?.uid) {
    throw new Error("Usuario no autenticado");
  }

  // Validar datos requeridos
  if (!data.nombre || !data.slug || !data.cuit) {
    throw new Error("Faltan campos requeridos: nombre, slug o cuit");
  }

  // Estructura principal con todos los campos nuevos
  const payload = {
    // Información básica
    nombre: data.nombre.trim(),
    razonSocial: data.razonSocial?.trim() || "",
    cuit: data.cuit.trim(),
    slug: data.slug.trim(),
    activa: data.activa !== undefined ? data.activa : true,

    // Configuración
    configuracion: {
      operacionesPermitidas: data.configuracion?.operacionesPermitidas || [],
      tiposInmueblePermitidos:
        data.configuracion?.tiposInmueblePermitidos || [],
      contacto: {
        email: data.configuracion?.contacto?.email?.trim() || "",
        telefono: data.configuracion?.contacto?.telefono?.trim() || "",
        whatsapp: data.configuracion?.contacto?.whatsapp?.trim() || "",
      },
    },

    // Branding (se actualizará más tarde con las imágenes)
    branding: data.branding || {},

    // Auditoría y seguridad
    admins: [currentUser.uid],
    createdBy: currentUser.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    const docRef = await addDoc(inmobiliariasRef, payload);
    console.log(`✅ Inmobiliaria creada con ID: ${docRef.id}`);
    return docRef.id;
  } catch (error) {
    console.error("❌ Error al crear inmobiliaria:", error);
    throw new Error(`No se pudo crear la inmobiliaria: ${error.message}`);
  }
}

/**
 * ✏️ Actualizar inmobiliaria (parcial o completa)
 */
export async function updateInmobiliaria(id, data) {
  if (!id) throw new Error("ID de inmobiliaria requerido");

  const currentUser = auth.currentUser;
  if (!currentUser?.uid) {
    throw new Error("Usuario no autenticado");
  }

  const ref = doc(db, COLLECTION_NAME, id);

  // Verificar que el usuario sea admin de esta inmobiliaria
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    throw new Error("Inmobiliaria no encontrada");
  }

  const inmobiliariaData = snap.data();
  if (
    !inmobiliariaData.admins?.includes(currentUser.uid) &&
    currentUser.role !== "root"
  ) {
    throw new Error("No tienes permiso para editar esta inmobiliaria");
  }

  // Preparar payload para actualización
  const updateData = {
    ...data,
    updatedAt: serverTimestamp(),
    updatedBy: currentUser.uid,
  };

  // Si se está actualizando configuracion, hacer merge profundo
  if (data.configuracion && inmobiliariaData.configuracion) {
    updateData.configuracion = {
      ...inmobiliariaData.configuracion,
      ...data.configuracion,
      contacto: {
        ...inmobiliariaData.configuracion?.contacto,
        ...data.configuracion?.contacto,
      },
    };
  }

  try {
    await updateDoc(ref, updateData);
    console.log(`✅ Inmobiliaria ${id} actualizada correctamente`);
  } catch (error) {
    console.error("❌ Error al actualizar inmobiliaria:", error);
    throw new Error(`No se pudo actualizar la inmobiliaria: ${error.message}`);
  }
}

/**
 * 🔍 Obtener inmobiliaria por ID
 */
export async function getInmobiliariaById(id) {
  if (!id) throw new Error("ID de inmobiliaria requerido");

  const ref = doc(db, COLLECTION_NAME, id);
  const snap = await getDoc(ref);

  if (!snap.exists()) return null;

  const data = snap.data();

  // Convertir timestamps de Firebase a fechas legibles
  return {
    id: snap.id,
    ...data,
    createdAt: data.createdAt?.toDate() || null,
    updatedAt: data.updatedAt?.toDate() || null,
  };
}

/**
 * 🔍 Obtener inmobiliaria por Slug
 */
export async function getInmobiliariaBySlug(slug) {
  if (!slug) throw new Error("Slug requerido");

  const q = query(inmobiliariasRef, where("slug", "==", slug.trim()));
  const snapshot = await getDocs(q);

  if (snapshot.empty) return null;

  const doc = snapshot.docs[0];
  const data = doc.data();

  return {
    id: doc.id,
    ...data,
    createdAt: data.createdAt?.toDate() || null,
    updatedAt: data.updatedAt?.toDate() || null,
  };
}

/**
 * 📋 Listar todas las inmobiliarias (para usuarios root)
 */
export async function getAllInmobiliarias() {
  const currentUser = auth.currentUser;
  if (!currentUser?.uid) {
    throw new Error("Usuario no autenticado");
  }

  // Solo usuarios root pueden ver todas las inmobiliarias
  // En una implementación real, verificarías el rol del usuario
  const q = query(inmobiliariasRef);
  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      createdAt: data.createdAt?.toDate() || null,
      updatedAt: data.updatedAt?.toDate() || null,
    };
  });
}

/**
 * 📋 Listar inmobiliarias según rol (manteniendo compatibilidad)
 */
export async function getInmobiliariasByRole(user) {
  if (!user?.uid) throw new Error("Usuario no autenticado");

  let q;

  if (user.role === "root") {
    q = query(inmobiliariasRef);
  } else if (user.role === "admin") {
    q = query(inmobiliariasRef, where("admins", "array-contains", user.uid));
  } else {
    // futuros roles → no ven nada
    return [];
  }

  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      createdAt: data.createdAt?.toDate() || null,
      updatedAt: data.updatedAt?.toDate() || null,
    };
  });
}

/**
 * 🗑️ Eliminar inmobiliaria (hard delete)
 */
export async function deleteInmobiliaria(id) {
  if (!id) throw new Error("ID de inmobiliaria requerido");

  const currentUser = auth.currentUser;
  if (!currentUser?.uid) {
    throw new Error("Usuario no autenticado");
  }

  // Verificar permisos antes de eliminar
  const ref = doc(db, COLLECTION_NAME, id);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    throw new Error("Inmobiliaria no encontrada");
  }

  const inmobiliariaData = snap.data();
  if (
    !inmobiliariaData.admins?.includes(currentUser.uid) &&
    currentUser.role !== "root"
  ) {
    throw new Error("No tienes permiso para eliminar esta inmobiliaria");
  }

  await deleteDoc(ref);
  console.log(`🗑️ Inmobiliaria ${id} eliminada`);
}

/**
 * 👥 Agregar admin a inmobiliaria
 */
export async function addAdminToInmobiliaria(inmobiliariaId, userId) {
  const ref = doc(db, COLLECTION_NAME, inmobiliariaId);
  const snap = await getDoc(ref);

  if (!snap.exists()) throw new Error("Inmobiliaria no encontrada");

  const data = snap.data();
  const admins = new Set(data.admins || []);
  admins.add(userId);

  await updateDoc(ref, {
    admins: Array.from(admins),
    updatedAt: serverTimestamp(),
  });
}

/**
 * 👤 Quitar admin de inmobiliaria
 */
export async function removeAdminFromInmobiliaria(inmobiliariaId, userId) {
  const ref = doc(db, COLLECTION_NAME, inmobiliariaId);
  const snap = await getDoc(ref);

  if (!snap.exists()) throw new Error("Inmobiliaria no encontrada");

  const admins = (snap.data().admins || []).filter((uid) => uid !== userId);

  await updateDoc(ref, {
    admins,
    updatedAt: serverTimestamp(),
  });
}

/**
 * 📉 Baja lógica de inmobiliaria (soft delete)
 */
export async function bajaInmobiliaria(id) {
  if (!id) throw new Error("ID de inmobiliaria requerido");

  const currentUser = auth.currentUser;
  if (!currentUser?.uid) {
    throw new Error("Usuario no autenticado");
  }

  const ref = doc(db, COLLECTION_NAME, id);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    throw new Error("Inmobiliaria no encontrada");
  }

  const inmobiliariaData = snap.data();
  if (
    !inmobiliariaData.admins?.includes(currentUser.uid) &&
    currentUser.role !== "root"
  ) {
    throw new Error("No tienes permiso para desactivar esta inmobiliaria");
  }

  await updateDoc(ref, {
    activa: false,
    updatedAt: serverTimestamp(),
    updatedBy: currentUser.uid,
  });
}

/**
 * 📈 Activar inmobiliaria
 */
export async function activarInmobiliaria(id) {
  if (!id) throw new Error("ID de inmobiliaria requerido");

  const currentUser = auth.currentUser;
  if (!currentUser?.uid) {
    throw new Error("Usuario no autenticado");
  }

  const ref = doc(db, COLLECTION_NAME, id);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    throw new Error("Inmobiliaria no encontrada");
  }

  const inmobiliariaData = snap.data();
  if (
    !inmobiliariaData.admins?.includes(currentUser.uid) &&
    currentUser.role !== "root"
  ) {
    throw new Error("No tienes permiso para activar esta inmobiliaria");
  }

  await updateDoc(ref, {
    activa: true,
    updatedAt: serverTimestamp(),
    updatedBy: currentUser.uid,
  });
}

/**
 * 🔍 Verificar si un slug ya existe
 */
export async function checkSlugExists(slug, excludeId = null) {
  if (!slug) return false;

  const q = query(inmobiliariasRef, where("slug", "==", slug.trim()));
  const snapshot = await getDocs(q);

  if (snapshot.empty) return false;

  // Si se está editando, excluir el documento actual
  if (excludeId) {
    const doc = snapshot.docs.find((doc) => doc.id !== excludeId);
    return !!doc;
  }

  return true;
}
