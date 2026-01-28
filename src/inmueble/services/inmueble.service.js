import { db } from "../../firebase/config";
import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  serverTimestamp,
} from "firebase/firestore";

import { validateInmuebleEstado } from "../../domain/inmueble/inmueble.validators";
import { assertInmobiliariaActiva } from "../../inmobiliaria/services/inmobiliaria.service";

/* =========================================================
   Helpers
   ========================================================= */

const inmueblesCollection = (inmobiliariaId) =>
  collection(db, "inmobiliarias", inmobiliariaId, "inmuebles");

/* =========================================================
   CREATE
   ========================================================= */

/**
 * Crear inmueble
 */
export const createInmueble = async (inmobiliariaId, data) => {
  console.log("🔥 createInmueble ejecutándose", inmobiliariaId, data);

  if (!inmobiliariaId) {
    throw new Error("inmobiliariaId es requerido");
  }

  if (!data || typeof data !== "object") {
    throw new Error("Datos del inmueble inválidos");
  }

  try {
    // 🚦 Dominio: inmobiliaria válida y activa
    await assertInmobiliariaActiva(inmobiliariaId);

    const ref = collection(db, "inmobiliarias", inmobiliariaId, "inmuebles");

    const docRef = await addDoc(ref, {
      ...data,

      // 🔑 Dominio híbrido
      ownerInmobiliariaId: inmobiliariaId,
      sharedWith: [],

      // 🧹 Estado
      deleted: false,

      // ⏱️ Timestamps
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    console.log("✅ Inmueble creado:", docRef.id);
    return docRef.id;
  } catch (error) {
    console.error("❌ Error en createInmueble:", error);
    throw error; // 🔥 nunca tragarse el error
  }
};

/* =========================================================
   READ
   ========================================================= */

/**
 * Obtener inmueble por ID
 */
export const getInmuebleById = async (inmuebleId) => {
  if (!inmuebleId) return null;

  const ref = doc(db, "inmuebles", inmuebleId);
  const snap = await getDoc(ref);

  if (!snap.exists()) return null;

  return {
    id: snap.id,
    ...snap.data(),
  };
};

/**
 * Listar inmuebles (panel admin)
 */
export const getInmueblesByInmobiliaria = async (
  inmobiliariaId,
  { estado, tipo, operacion, destacado, pageSize = 20, lastDoc = null } = {},
) => {
  if (!inmobiliariaId) return { data: [], lastDoc: null };

  const ref = inmueblesCollection();

  const constraints = [
    where("deleted", "==", false),
    where("ownerInmobiliariaId", "in", [inmobiliariaId]),
  ];

  // 🔎 Filtros
  if (estado) constraints.push(where("estado", "==", estado));
  if (tipo) constraints.push(where("tipo", "==", tipo));
  if (operacion) constraints.push(where("operacion", "==", operacion));
  if (destacado !== undefined) {
    constraints.push(where("destacado", "==", destacado));
  }

  constraints.push(orderBy("createdAt", "desc"));
  constraints.push(limit(pageSize));

  if (lastDoc) {
    constraints.push(startAfter(lastDoc));
  }

  const q = query(ref, ...constraints);
  const snap = await getDocs(q);

  return {
    data: snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })),
    lastDoc: snap.docs[snap.docs.length - 1] || null,
  };
};

/**
 * Listado público de inmuebles
 */
export const getPublicInmuebles = async (
  inmobiliariaId,
  { tipo, operacion, pageSize = 12, lastDoc = null } = {},
) => {
  if (!inmobiliariaId) return { data: [], lastDoc: null };

  const ref = inmueblesCollection();

  const constraints = [
    where("deleted", "==", false),
    where("estado", "==", "publicado"),
    where("ownerInmobiliariaId", "==", inmobiliariaId),
  ];

  if (tipo) constraints.push(where("tipo", "==", tipo));
  if (operacion) constraints.push(where("operacion", "==", operacion));

  constraints.push(orderBy("destacado", "desc"));
  constraints.push(orderBy("createdAt", "desc"));
  constraints.push(limit(pageSize));

  if (lastDoc) {
    constraints.push(startAfter(lastDoc));
  }

  const q = query(ref, ...constraints);
  const snap = await getDocs(q);

  return {
    data: snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })),
    lastDoc: snap.docs[snap.docs.length - 1] || null,
  };
};

/* =========================================================
   UPDATE
   ========================================================= */

export const updateInmueble = async (inmobiliariaId, inmuebleId, data) => {
  if (!inmobiliariaId) {
    throw new Error("inmobiliariaId es requerido");
  }

  if (!inmuebleId) {
    throw new Error("inmuebleId es requerido");
  }

  if (!data || typeof data !== "object") {
    throw new Error("Datos del inmueble inválidos");
  }

  try {
    // 🚦 Dominio
    await assertInmobiliariaActiva(inmobiliariaId);

    const ref = doc(db, "inmuebles", inmuebleId);

    await updateDoc(ref, {
      ...data,

      // 🔐 coherencia de dominio
      ownerInmobiliariaId: inmobiliariaId,

      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error en updateInmueble:", error);
    throw error;
  }
};

/**
 * Cambiar estado de un inmueble
 */
export const updateInmuebleEstado = async (
  inmobiliariaId,
  inmuebleId,
  estado,
) => {
  if (!inmobiliariaId || !inmuebleId) {
    throw new Error("IDs requeridos");
  }

  try {
    // 🚦 Dominio
    await assertInmobiliariaActiva(inmobiliariaId);

    const estadoValidado = validateInmuebleEstado(estado);

    const ref = doc(db, "inmuebles", inmuebleId);

    await updateDoc(ref, {
      estado: estadoValidado,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error en updateInmuebleEstado:", error);
    throw error;
  }
};

/* =========================================================
   DELETE
   ========================================================= */

/**
 * Soft delete de inmueble
 */
export const deleteInmueble = async (inmobiliariaId, inmuebleId) => {
  if (!inmobiliariaId || !inmuebleId) {
    throw new Error("IDs requeridos");
  }

  try {
    // 🚦 Dominio
    await assertInmobiliariaActiva(inmobiliariaId);

    const ref = doc(db, "inmuebles", inmuebleId);

    await updateDoc(ref, {
      deleted: true,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error en deleteInmueble:", error);
    throw error;
  }
};
