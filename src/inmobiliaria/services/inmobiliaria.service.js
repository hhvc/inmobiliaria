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
import { setActiveInmobiliariaId } from "../../inmobiliaria/helpers/activeInmobiliaria.helper";

/**
 * 🔹 helper interno
 */
const normalizeTimestamp = (value) => {
  if (!value) return null;

  // Firestore Timestamp
  if (typeof value.toDate === "function") {
    return value.toDate();
  }

  // JS Date
  if (value instanceof Date) {
    return value;
  }

  // ISO string o number
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? null : parsed;
};

/**
 * 🔹 Colección principal
 */
const COLLECTION_NAME = "inmobiliarias";
const inmobiliariasRef = collection(db, COLLECTION_NAME);

/**
 * 🏢 Crear inmobiliaria con nueva estructura
 * 👉 y dejarla como inmobiliaria activa
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

    // Branding
    branding: data.branding || {},

    // Seguridad / auditoría
    admins: [currentUser.uid],
    createdBy: currentUser.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    const docRef = await addDoc(inmobiliariasRef, payload);

    // ✅ Setear inmobiliaria activa
    setActiveInmobiliariaId(docRef.id);

    console.log(`✅ Inmobiliaria creada y activada: ${docRef.id}`);
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
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    throw new Error("Inmobiliaria no encontrada");
  }

  const inmobiliariaData = snap.data();

  /**
   * 🔐 Validación de permisos (cliente)
   * - Admin de la inmobiliaria
   * - Root lo valida Firestore Rules
   */
  if (!inmobiliariaData.admins?.includes(currentUser.uid)) {
    throw new Error("No tienes permiso para editar esta inmobiliaria");
  }

  // Payload base
  const updateData = {
    ...data,
    updatedAt: serverTimestamp(),
    updatedBy: currentUser.uid,
  };

  /**
   * 🧠 Merge profundo de configuración
   */
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

  return {
    id: snap.id,
    ...data,
    createdAt: normalizeTimestamp(data.createdAt),
    updatedAt: normalizeTimestamp(data.updatedAt),
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

  const docSnap = snapshot.docs[0];
  const data = docSnap.data();

  return {
    id: docSnap.id,
    ...data,
    createdAt: normalizeTimestamp(data.createdAt),
    updatedAt: normalizeTimestamp(data.updatedAt),
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

  const snapshot = await getDocs(inmobiliariasRef);

  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      ...data,
      createdAt: normalizeTimestamp(data.createdAt),
      updatedAt: normalizeTimestamp(data.updatedAt),
    };
  });
}

/**
 * 📋 Listar inmobiliarias según rol (manteniendo compatibilidad)
 */
export async function getInmobiliariasByRole(user) {
  if (!user?.uid) {
    throw new Error("Usuario no autenticado");
  }

  /* =========================
     ROOT → todas
     ========================= */
  if (user.role === "root") {
    const snapshot = await getDocs(inmobiliariasRef);

    return snapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        createdAt: normalizeTimestamp(data.createdAt),
        updatedAt: normalizeTimestamp(data.updatedAt),
      };
    });
  }

  /* =========================
     ADMIN → solo asignadas
     ========================= */
  if (user.role === "admin") {
    const inmoIds = user.inmobiliarias || [];
    if (inmoIds.length === 0) return [];

    const inmobiliarias = await Promise.all(
      inmoIds.map(async (inmoId) => {
        const ref = doc(db, COLLECTION_NAME, inmoId);
        const snap = await getDoc(ref);

        if (!snap.exists()) return null;

        const data = snap.data();
        return {
          id: snap.id,
          ...data,
          createdAt: normalizeTimestamp(data.createdAt),
          updatedAt: normalizeTimestamp(data.updatedAt),
        };
      }),
    );

    return inmobiliarias.filter(Boolean);
  }

  return [];
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

  if (currentUser.role !== "root") {
    throw new Error("Solo usuarios root pueden eliminar inmobiliarias");
  }

  const ref = doc(db, COLLECTION_NAME, id);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    throw new Error("Inmobiliaria no encontrada");
  }

  await deleteDoc(ref);

  console.log(`🗑️ Inmobiliaria ${id} eliminada definitivamente`);
}

/**
 * 👥 Agregar admin a inmobiliaria
 */
export async function addAdminToInmobiliaria(inmobiliariaId, userId) {
  if (!inmobiliariaId || !userId) {
    throw new Error("Faltan parámetros requeridos");
  }

  const currentUser = auth.currentUser;
  if (!currentUser?.uid) {
    throw new Error("Usuario no autenticado");
  }

  const ref = doc(db, COLLECTION_NAME, inmobiliariaId);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    throw new Error("Inmobiliaria no encontrada");
  }

  const data = snap.data();

  const isRoot = currentUser.role === "root";
  const isAdmin = data.admins?.includes(currentUser.uid);

  if (!isRoot && !isAdmin) {
    throw new Error("No tienes permiso para modificar los admins");
  }

  const admins = new Set(data.admins || []);
  admins.add(userId);

  await updateDoc(ref, {
    admins: Array.from(admins),
    updatedAt: serverTimestamp(),
    updatedBy: currentUser.uid,
  });

  console.log(`👥 Usuario ${userId} agregado como admin`);
}

/**
 * 👤 Quitar admin de inmobiliaria
 */
export async function removeAdminFromInmobiliaria(inmobiliariaId, userId) {
  if (!inmobiliariaId || !userId) {
    throw new Error("Faltan parámetros requeridos");
  }

  const currentUser = auth.currentUser;
  if (!currentUser?.uid) {
    throw new Error("Usuario no autenticado");
  }

  const ref = doc(db, COLLECTION_NAME, inmobiliariaId);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    throw new Error("Inmobiliaria no encontrada");
  }

  const data = snap.data();

  const isRoot = currentUser.role === "root";
  const isAdmin = data.admins?.includes(currentUser.uid);

  if (!isRoot && !isAdmin) {
    throw new Error("No tienes permiso para modificar los admins");
  }

  const currentAdmins = data.admins || [];

  if (!currentAdmins.includes(userId)) {
    return; // nada que hacer
  }

  if (currentAdmins.length <= 1) {
    throw new Error("La inmobiliaria debe tener al menos un administrador");
  }

  const admins = currentAdmins.filter((uid) => uid !== userId);

  await updateDoc(ref, {
    admins,
    updatedAt: serverTimestamp(),
    updatedBy: currentUser.uid,
  });

  console.log(`👤 Usuario ${userId} removido como admin`);
}

/**
 * 📉 Baja lógica de inmobiliaria (soft delete)
 */
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

  const data = snap.data();

  const isRoot = currentUser.role === "root";
  const isAdmin = data.admins?.includes(currentUser.uid);

  if (!isRoot && !isAdmin) {
    throw new Error("No tienes permiso para desactivar esta inmobiliaria");
  }

  // Evitar write innecesario
  if (data.activa === false) return;

  await updateDoc(ref, {
    activa: false,
    updatedAt: serverTimestamp(),
    updatedBy: currentUser.uid,
  });

  console.log(`📉 Inmobiliaria ${id} desactivada`);
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

  const data = snap.data();

  const isRoot = currentUser.role === "root";
  const isAdmin = data.admins?.includes(currentUser.uid);

  if (!isRoot && !isAdmin) {
    throw new Error("No tienes permiso para activar esta inmobiliaria");
  }

  // Evitar write innecesario
  if (data.activa === true) return;

  await updateDoc(ref, {
    activa: true,
    updatedAt: serverTimestamp(),
    updatedBy: currentUser.uid,
  });

  console.log(`📈 Inmobiliaria ${id} activada`);
}

/**
 * 🔍 Verificar si un slug ya existe
 */
export async function checkSlugExists(slug, excludeId = null) {
  if (!slug) return false;

  const currentUser = auth.currentUser;
  if (!currentUser?.uid) {
    throw new Error("Usuario no autenticado");
  }

  const normalizedSlug = slug.trim().toLowerCase();

  const q = query(inmobiliariasRef, where("slug", "==", normalizedSlug));

  const snapshot = await getDocs(q);

  if (snapshot.empty) return false;

  if (excludeId) {
    return snapshot.docs.some((doc) => doc.id !== excludeId);
  }

  return true;
}

/**
 * 🚦 Verifica que la inmobiliaria exista y esté activa
 * Lanza error si no es válida
 */
export async function assertInmobiliariaActiva(id) {
  if (!id) {
    throw new Error("Inmobiliaria no seleccionada");
  }

  const ref = doc(db, COLLECTION_NAME, id);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    throw new Error("La inmobiliaria no existe");
  }

  if (snap.data().activa === false) {
    throw new Error("La inmobiliaria está desactivada");
  }

  return true;
}
