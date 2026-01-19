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
export const createInmueble = async (data) => {
  if (!data?.inmobiliariaId) {
    throw new Error("inmobiliariaId es requerido");
  }

  const ref = inmueblesCollection(data.inmobiliariaId);

  const docRef = await addDoc(ref, {
    ...data,
    deleted: false, // 🔒 soft delete future-proof
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return docRef.id;
};

/* =========================================================
   READ
   ========================================================= */

/**
 * Obtener inmueble por ID
 */
export const getInmuebleById = async (inmobiliariaId, inmuebleId) => {
  if (!inmobiliariaId || !inmuebleId) return null;

  const ref = doc(db, "inmobiliarias", inmobiliariaId, "inmuebles", inmuebleId);
  const snap = await getDoc(ref);

  if (!snap.exists()) return null;

  return {
    id: snap.id,
    ...snap.data(),
  };
};

/**
 * Listar inmuebles (panel admin)
 * ✔ filtros reales Firestore
 * ✔ paginación
 */
export const getInmueblesByInmobiliaria = async (
  inmobiliariaId,
  { estado, tipo, operacion, destacado, pageSize = 20, lastDoc = null } = {}
) => {
  if (!inmobiliariaId) return { data: [], lastDoc: null };

  const ref = inmueblesCollection(inmobiliariaId);

  const constraints = [where("deleted", "==", false)];

  if (estado) constraints.push(where("estado", "==", estado));
  if (tipo) constraints.push(where("tipo", "==", tipo));
  if (operacion) constraints.push(where("operacion", "==", operacion));
  if (destacado !== undefined) {
    constraints.push(where("destacado", "==", destacado));
  }

  // ⚠️ orderBy SIEMPRE después de where
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
 * Listado público
 * ✔ solo activos
 * ✔ destacados primero
 * ✔ paginación
 */
export const getPublicInmuebles = async (
  inmobiliariaId,
  { tipo, operacion, pageSize = 12, lastDoc = null } = {}
) => {
  if (!inmobiliariaId) return { data: [], lastDoc: null };

  const ref = inmueblesCollection(inmobiliariaId);

  const constraints = [
    where("deleted", "==", false),
    where("estado", "==", "activo"),
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
  if (!inmobiliariaId || !inmuebleId) {
    throw new Error("IDs requeridos");
  }

  const ref = doc(db, "inmobiliarias", inmobiliariaId, "inmuebles", inmuebleId);

  await updateDoc(ref, {
    ...data,
    updatedAt: serverTimestamp(),
  });
};

/**
 * Cambiar estado
 */
export const updateInmuebleEstado = async (
  inmobiliariaId,
  inmuebleId,
  estado
) => {
  if (!inmobiliariaId || !inmuebleId || !estado) {
    throw new Error("Parámetros inválidos");
  }

  const ref = doc(db, "inmobiliarias", inmobiliariaId, "inmuebles", inmuebleId);

  await updateDoc(ref, {
    estado,
    updatedAt: serverTimestamp(),
  });
};

/* =========================================================
   DELETE
   ========================================================= */

/**
 * Soft delete (recomendado)
 */
export const deleteInmueble = async (inmobiliariaId, inmuebleId) => {
  if (!inmobiliariaId || !inmuebleId) {
    throw new Error("IDs requeridos");
  }

  const ref = doc(db, "inmobiliarias", inmobiliariaId, "inmuebles", inmuebleId);

  await updateDoc(ref, {
    deleted: true,
    updatedAt: serverTimestamp(),
  });
};
