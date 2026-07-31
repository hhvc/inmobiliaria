import {
  addDoc,
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";

import { auth, db } from "../../firebase/config";
import {
  assertInmobiliariaActiva,
  getInmobiliariaPublisherSnapshot,
} from "../../inmobiliaria/services/inmobiliaria.service";
import { normalizeEmprendimiento } from "../utils/emprendimientoSchema";

const emprendimientosCollection = (inmobiliariaId) =>
  collection(db, "inmobiliarias", inmobiliariaId, "emprendimientos");

const emprendimientoDoc = (inmobiliariaId, emprendimientoId) =>
  doc(
    db,
    "inmobiliarias",
    inmobiliariaId,
    "emprendimientos",
    emprendimientoId,
  );

const normalizeSearchText = (value = "") =>
  value
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

export const createEmprendimientoSlug = (nombre = "emprendimiento", id = "") => {
  const base = normalizeSearchText(nombre)
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return `${base || "emprendimiento"}-${id}`;
};

const sanitizePayload = (data = {}) => {
  const {
    id: _id,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    deletedAt: _deletedAt,
    ...payload
  } = normalizeEmprendimiento(data);

  return payload;
};

const getInmobiliariaIdFromDoc = (docSnap) =>
  docSnap.data()?.inmobiliariaId || docSnap.ref.parent.parent?.id || "";

const matchesSearch = (emprendimiento, search) => {
  const needle = normalizeSearchText(search);
  if (!needle) return true;

  return normalizeSearchText(
    [
      emprendimiento.nombre,
      emprendimiento.descripcion,
      emprendimiento.desarrollista,
      emprendimiento.tipo,
      emprendimiento.estadoObra,
      emprendimiento.direccion?.barrio,
      emprendimiento.direccion?.ciudad,
    ]
      .filter(Boolean)
      .join(" "),
  ).includes(needle);
};

export const createEmprendimiento = async (inmobiliariaId, data) => {
  if (!inmobiliariaId) throw new Error("inmobiliariaId es requerido");

  await assertInmobiliariaActiva(inmobiliariaId);

  const publisher = await getInmobiliariaPublisherSnapshot(inmobiliariaId);
  const payload = sanitizePayload(data);
  const currentUser = auth.currentUser;

  const ref = await addDoc(emprendimientosCollection(inmobiliariaId), {
    ...payload,
    ...publisher,
    inmobiliariaId,
    ownerInmobiliariaId: inmobiliariaId,
    ownerId: currentUser?.uid || null,
    createdBy: currentUser?.uid || null,
    deleted: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const slug = createEmprendimientoSlug(payload.nombre, ref.id);
  await updateDoc(ref, { slug, updatedAt: serverTimestamp() });

  return { id: ref.id, slug };
};

export const updateEmprendimiento = async (
  inmobiliariaId,
  emprendimientoId,
  data,
) => {
  if (!inmobiliariaId || !emprendimientoId) {
    throw new Error("IDs requeridos para actualizar el emprendimiento");
  }

  await assertInmobiliariaActiva(inmobiliariaId);

  const publisher = await getInmobiliariaPublisherSnapshot(inmobiliariaId);
  const payload = sanitizePayload(data);

  await updateDoc(emprendimientoDoc(inmobiliariaId, emprendimientoId), {
    ...payload,
    ...publisher,
    slug:
      data.slug || createEmprendimientoSlug(payload.nombre, emprendimientoId),
    inmobiliariaId,
    ownerInmobiliariaId: inmobiliariaId,
    updatedAt: serverTimestamp(),
  });
};

export const getEmprendimientoById = async (
  inmobiliariaId,
  emprendimientoId,
) => {
  if (!inmobiliariaId || !emprendimientoId) return null;

  const snap = await getDoc(
    emprendimientoDoc(inmobiliariaId, emprendimientoId),
  );

  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

export const getEmprendimientosByInmobiliaria = async (
  inmobiliariaId,
  { search = "", includeDeleted = false } = {},
) => {
  if (!inmobiliariaId) return [];

  const snap = await getDocs(
    query(emprendimientosCollection(inmobiliariaId), orderBy("createdAt", "desc")),
  );

  return snap.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .filter((item) => (includeDeleted ? true : item.deleted !== true))
    .filter((item) => matchesSearch(item, search));
};

export const getPublicEmprendimientos = async ({
  inmobiliariaId = "",
  search = "",
  tipo = "",
  estadoObra = "",
  pageSize = 60,
} = {}) => {
  const ref = inmobiliariaId
    ? emprendimientosCollection(inmobiliariaId)
    : collectionGroup(db, "emprendimientos");

  const constraints = [
    where("deleted", "==", false),
    where("estado", "==", "activo"),
    where("publicarEnPortal", "==", true),
  ];

  if (inmobiliariaId) {
    constraints.push(where("inmobiliariaId", "==", inmobiliariaId));
  }

  constraints.push(limit(pageSize));
  const snap = await getDocs(query(ref, ...constraints));

  return snap.docs
    .map((item) => ({
      id: item.id,
      inmobiliariaId: getInmobiliariaIdFromDoc(item),
      ...item.data(),
    }))
    .filter((item) => (tipo ? item.tipo === tipo : true))
    .filter((item) => (estadoObra ? item.estadoObra === estadoObra : true))
    .filter((item) => matchesSearch(item, search))
    .sort((a, b) => Number(Boolean(b.destacado)) - Number(Boolean(a.destacado)));
};

export const getPublicEmprendimientosByInmobiliaria = (
  inmobiliariaId,
  options = {},
) => getPublicEmprendimientos({ ...options, inmobiliariaId });

export const getPublicEmprendimientoBySlug = async (slug) => {
  if (!slug) return null;

  const snap = await getDocs(
    query(
      collectionGroup(db, "emprendimientos"),
      where("slug", "==", slug),
      where("deleted", "==", false),
      where("estado", "==", "activo"),
      where("publicarEnPortal", "==", true),
      limit(1),
    ),
  );

  if (snap.empty) return null;
  const item = snap.docs[0];

  return {
    id: item.id,
    inmobiliariaId: getInmobiliariaIdFromDoc(item),
    ...item.data(),
  };
};

export const deleteEmprendimiento = async (
  inmobiliariaId,
  emprendimientoId,
) => {
  await assertInmobiliariaActiva(inmobiliariaId);

  await updateDoc(emprendimientoDoc(inmobiliariaId, emprendimientoId), {
    deleted: true,
    publicarEnPortal: false,
    deletedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
};

