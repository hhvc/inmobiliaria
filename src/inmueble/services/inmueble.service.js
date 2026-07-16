import { db, auth } from "../../firebase/config";
import {
  collection,
  collectionGroup,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  setDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  serverTimestamp,
} from "firebase/firestore";

import { validateInmuebleEstado } from "../../domain/inmueble/inmueble.validators";
import { assertInmobiliariaActiva } from "../../inmobiliaria/services/inmobiliaria.service";
import { getActiveInmobiliariaId } from "../../inmobiliaria/helpers/activeInmobiliaria.helper";

/* =========================================================
   Defaults Red de colegas
   ========================================================= */

const DEFAULT_SHARING = {
  enabled: false,
  mode: "all_colleagues",
  allowColleagueContact: true,
  showExactAddressToColleagues: false,
  showOwnerDataToColleagues: false,
};

const DEFAULT_NETWORK_DATA = {
  exactAddress: "",
  commissionShare: "",
  internalPrice: "",
  documentationStatus: "",
  visitInstructions: "",
  notesForColleagues: "",
  ownerName: "",
  ownerPhone: "",
};

/* =========================================================
   Helpers
   ========================================================= */

const inmueblesCollection = (inmobiliariaId) =>
  collection(db, "inmobiliarias", inmobiliariaId, "inmuebles");

const inmuebleDoc = (inmobiliariaId, inmuebleId) =>
  doc(db, "inmobiliarias", inmobiliariaId, "inmuebles", inmuebleId);

const inmuebleNetworkDataDoc = (inmobiliariaId, inmuebleId) =>
  doc(
    db,
    "inmobiliarias",
    inmobiliariaId,
    "inmuebles",
    inmuebleId,
    "private",
    "networkData",
  );

const resolveInmuebleIds = (
  inmobiliariaIdOrInmuebleId,
  maybeInmuebleId = null,
) => {
  if (maybeInmuebleId) {
    return {
      inmobiliariaId: inmobiliariaIdOrInmuebleId,
      inmuebleId: maybeInmuebleId,
    };
  }

  const activeInmobiliariaId = getActiveInmobiliariaId();

  if (!activeInmobiliariaId) {
    throw new Error("No hay inmobiliaria activa seleccionada");
  }

  return {
    inmobiliariaId: activeInmobiliariaId,
    inmuebleId: inmobiliariaIdOrInmuebleId,
  };
};

const normalizeSearchText = (value = "") =>
  value
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const createSlugBase = (value = "inmueble") => {
  const normalized = normalizeSearchText(value || "inmueble")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return normalized || "inmueble";
};

const buildInmuebleSlug = (titulo, inmuebleId) => {
  const base = createSlugBase(titulo);
  return `${base}-${inmuebleId}`;
};

const getInmobiliariaIdFromDocSnap = (docSnap) => {
  const data = docSnap.data();

  return (
    data.inmobiliariaId ||
    data.ownerInmobiliariaId ||
    docSnap.ref.parent.parent?.id ||
    ""
  );
};

const matchesSearch = (inmueble, search) => {
  const normalizedSearch = normalizeSearchText(search);

  if (!normalizedSearch) return true;

  const searchableText = normalizeSearchText(
    [
      inmueble.titulo,
      inmueble.descripcion,
      inmueble.tipo,
      inmueble.operacion,
      inmueble.direccion?.calle,
      inmueble.direccion?.numero,
      inmueble.direccion?.barrio,
      inmueble.direccion?.ciudad,
    ]
      .filter(Boolean)
      .join(" "),
  );

  return searchableText.includes(normalizedSearch);
};

const applyClientFilters = (inmuebles, filters = {}) => {
  const {
    search = "",
    estado = "",
    tipo = "",
    operacion = "",
    destacado = false,
    publicarEnPortal = null,
  } = filters;

  return inmuebles
    .filter((inmueble) => inmueble.deleted !== true)
    .filter((inmueble) => (estado ? inmueble.estado === estado : true))
    .filter((inmueble) => (tipo ? inmueble.tipo === tipo : true))
    .filter((inmueble) =>
      operacion ? inmueble.operacion === operacion : true,
    )
    .filter((inmueble) =>
      destacado === true ? inmueble.destacado === true : true,
    )
    .filter((inmueble) =>
      publicarEnPortal === null
        ? true
        : inmueble.publicarEnPortal === publicarEnPortal,
    )
    .filter((inmueble) => matchesSearch(inmueble, search));
};

const sortPublicInmuebles = (items = []) => {
  return [...items].sort((a, b) => {
    if (a.destacado !== b.destacado) {
      return a.destacado ? -1 : 1;
    }

    const aTime =
      typeof a.createdAt?.toMillis === "function" ? a.createdAt.toMillis() : 0;

    const bTime =
      typeof b.createdAt?.toMillis === "function" ? b.createdAt.toMillis() : 0;

    return bTime - aTime;
  });
};

const sanitizeUpdatePayload = (data = {}) => {
  const {
    id: _id,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    networkData: _networkData,
    ...payload
  } = data;

  return payload;
};

const resolvePublicListArgs = (
  inmobiliariaIdOrOptions = {},
  maybeOptions = {},
) => {
  // Compatibilidad con firma vieja:
  // getPublicInmuebles(inmobiliariaId, options)
  if (typeof inmobiliariaIdOrOptions === "string") {
    return {
      ...maybeOptions,
      inmobiliariaId: inmobiliariaIdOrOptions,
    };
  }

  // Firma nueva:
  // getPublicInmuebles(options)
  return {
    ...(inmobiliariaIdOrOptions || {}),
  };
};

/* =========================================================
   Helpers Red de colegas
   ========================================================= */

const normalizeSharing = (value = {}) => {
  return {
    ...DEFAULT_SHARING,
    ...value,
    enabled: Boolean(value.enabled),
    mode: value.mode || "all_colleagues",
    allowColleagueContact:
      value.allowColleagueContact === undefined
        ? true
        : Boolean(value.allowColleagueContact),
    showExactAddressToColleagues: Boolean(
      value.showExactAddressToColleagues,
    ),
    showOwnerDataToColleagues: Boolean(value.showOwnerDataToColleagues),
  };
};

const sanitizeNetworkData = ({ sharing, networkData }) => {
  const data = {
    ...DEFAULT_NETWORK_DATA,
    ...(networkData || {}),
  };

  return {
    exactAddress: sharing.showExactAddressToColleagues
      ? data.exactAddress || ""
      : "",

    commissionShare: data.commissionShare || "",
    internalPrice: data.internalPrice || "",
    documentationStatus: data.documentationStatus || "",
    visitInstructions: data.visitInstructions || "",
    notesForColleagues: data.notesForColleagues || "",

    ownerName: sharing.showOwnerDataToColleagues ? data.ownerName || "" : "",

    ownerPhone: sharing.showOwnerDataToColleagues ? data.ownerPhone || "" : "",
  };
};

const getInmuebleNetworkData = async (inmobiliariaId, inmuebleId) => {
  if (!inmobiliariaId || !inmuebleId) return null;

  const ref = inmuebleNetworkDataDoc(inmobiliariaId, inmuebleId);
  const snap = await getDoc(ref);

  if (!snap.exists()) return null;

  return snap.data();
};

const writeInmuebleNetworkData = async ({
  inmobiliariaId,
  inmuebleId,
  sharing,
  networkData,
}) => {
  if (!inmobiliariaId || !inmuebleId) {
    throw new Error("IDs requeridos para guardar información de red");
  }

  /*
    undefined = no tocar.
    null = borrar datos protegidos.
    object = crear/actualizar datos protegidos.
  */
  if (networkData === undefined) {
    return;
  }

  const ref = inmuebleNetworkDataDoc(inmobiliariaId, inmuebleId);

  if (networkData === null) {
    await deleteDoc(ref);
    return;
  }

  if (!networkData || typeof networkData !== "object") {
    throw new Error("Datos de red inválidos");
  }

  const existingSnap = await getDoc(ref);

  const payload = {
    ...sanitizeNetworkData({
      sharing,
      networkData,
    }),

    inmobiliariaId,
    inmuebleId,

    updatedAt: serverTimestamp(),
  };

  if (!existingSnap.exists()) {
    payload.createdAt = serverTimestamp();
  }

  await setDoc(ref, payload, {
    merge: true,
  });
};

/* =========================================================
   CREATE
   ========================================================= */

/**
 * Crear inmueble en:
 * /inmobiliarias/{inmobiliariaId}/inmuebles/{inmuebleId}
 *
 * Datos protegidos de red:
 * /inmobiliarias/{inmobiliariaId}/inmuebles/{inmuebleId}/private/networkData
 */
export const createInmueble = async (
  inmobiliariaId,
  data,
  { networkData } = {},
) => {
  console.log("🔥 createInmueble ejecutándose", inmobiliariaId, data);

  if (!inmobiliariaId) {
    throw new Error("inmobiliariaId es requerido");
  }

  if (!data || typeof data !== "object") {
    throw new Error("Datos del inmueble inválidos");
  }

  try {
    await assertInmobiliariaActiva(inmobiliariaId);

    const currentUser = auth.currentUser;

    const estadoValidado = validateInmuebleEstado(data.estado || "activo");
    const sharing = normalizeSharing(data.sharing || {});

    const publicPayload = sanitizeUpdatePayload(data);

    const docRef = await addDoc(inmueblesCollection(inmobiliariaId), {
      ...publicPayload,

      // 🔑 Dominio / compatibilidad
      inmobiliariaId,
      ownerInmobiliariaId: inmobiliariaId,

      // 👤 Auditoría
      ownerId: data.ownerId || currentUser?.uid || null,
      createdBy: data.createdBy || currentUser?.uid || null,

      // 🖼️ Imágenes
      images: Array.isArray(data.images) ? data.images : [],

      // 🤝 Compartir
      sharedWith:
        data.sharedWith && typeof data.sharedWith === "object"
          ? data.sharedWith
          : {},

      // 🤝 Red de colegas: solo configuración no sensible
      sharing,

      // 🧹 Estado interno
      estado: estadoValidado,
      deleted: false,

      // 🌐 Portal público
      destacado: Boolean(data.destacado),
      publicarEnPortal: Boolean(data.publicarEnPortal),
      noIndex: Boolean(data.noIndex),

      // ⏱️ Timestamps
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const slug = buildInmuebleSlug(data.titulo, docRef.id);

    await updateDoc(docRef, {
      slug,
      updatedAt: serverTimestamp(),
    });

    if (sharing.enabled && networkData) {
      await writeInmuebleNetworkData({
        inmobiliariaId,
        inmuebleId: docRef.id,
        sharing,
        networkData,
      });
    }

    console.log("✅ Inmueble creado:", docRef.id);
    return docRef.id;
  } catch (error) {
    console.error("❌ Error en createInmueble:", error);
    throw error;
  }
};

/* =========================================================
   READ ADMIN / PRIVADO
   ========================================================= */

/**
 * Obtener inmueble por ID.
 *
 * Acepta dos firmas:
 * - getInmuebleById(inmobiliariaId, inmuebleId)
 * - getInmuebleById(inmuebleId) usando la inmobiliaria activa
 *
 * En contexto admin también intenta cargar:
 * /private/networkData
 */
export const getInmuebleById = async (
  inmobiliariaIdOrInmuebleId,
  maybeInmuebleId = null,
) => {
  if (!inmobiliariaIdOrInmuebleId) return null;

  const { inmobiliariaId, inmuebleId } = resolveInmuebleIds(
    inmobiliariaIdOrInmuebleId,
    maybeInmuebleId,
  );

  const ref = inmuebleDoc(inmobiliariaId, inmuebleId);
  const snap = await getDoc(ref);

  if (!snap.exists()) return null;

  const data = snap.data();

  let networkData = null;

  try {
    networkData = await getInmuebleNetworkData(inmobiliariaId, inmuebleId);
  } catch (error) {
    console.warn(
      "No se pudo cargar la información de red del inmueble:",
      error,
    );
  }

  return {
    id: snap.id,
    inmobiliariaId,
    ...data,
    networkData: networkData || {},
  };
};

/**
 * Listar inmuebles del panel admin.
 *
 * Lee desde:
 * /inmobiliarias/{inmobiliariaId}/inmuebles
 *
 * No carga networkData para evitar traer datos protegidos
 * en listados masivos. Eso se carga en detalle/edición.
 */
export const getInmueblesByInmobiliaria = async (
  inmobiliariaId,
  {
    search = "",
    estado = "",
    tipo = "",
    operacion = "",
    destacado = false,
    pageSize = 20,
    lastDoc = null,
  } = {},
) => {
  if (!inmobiliariaId) {
    return { data: [], lastDoc: null };
  }

  const ref = inmueblesCollection(inmobiliariaId);

  const constraints = [orderBy("createdAt", "desc"), limit(pageSize)];

  if (lastDoc) {
    constraints.push(startAfter(lastDoc));
  }

  const q = query(ref, ...constraints);
  const snap = await getDocs(q);

  const rawData = snap.docs.map((docSnap) => ({
    id: docSnap.id,
    inmobiliariaId,
    ...docSnap.data(),
  }));

  const data = applyClientFilters(rawData, {
    search,
    estado,
    tipo,
    operacion,
    destacado,
  });

  return {
    data,
    lastDoc: snap.docs[snap.docs.length - 1] || null,
  };
};

/* =========================================================
   READ PÚBLICO / PORTAL
   ========================================================= */

/**
 * Listado público de inmuebles publicados en el portal.
 *
 * Firma nueva:
 * getPublicInmuebles({
 *   search,
 *   tipo,
 *   operacion,
 *   inmobiliariaId,
 *   pageSize,
 *   lastDoc
 * })
 *
 * Firma compatible anterior:
 * getPublicInmuebles(inmobiliariaId, options)
 *
 * Si NO se pasa inmobiliariaId, lee inmuebles publicados de todas
 * las inmobiliarias usando collectionGroup("inmuebles").
 */
export const getPublicInmuebles = async (
  inmobiliariaIdOrOptions = {},
  maybeOptions = {},
) => {
  const {
    search = "",
    tipo = "",
    operacion = "",
    inmobiliariaId = "",
    pageSize = 12,
    lastDoc = null,
  } = resolvePublicListArgs(inmobiliariaIdOrOptions, maybeOptions);

  const ref = inmobiliariaId
    ? inmueblesCollection(inmobiliariaId)
    : collectionGroup(db, "inmuebles");

  const constraints = [
    where("deleted", "==", false),
    where("estado", "==", "activo"),
    where("publicarEnPortal", "==", true),
  ];

  if (inmobiliariaId) {
    constraints.push(where("inmobiliariaId", "==", inmobiliariaId));
  }

  if (tipo) constraints.push(where("tipo", "==", tipo));
  if (operacion) constraints.push(where("operacion", "==", operacion));

  constraints.push(limit(pageSize));

  if (lastDoc) {
    constraints.push(startAfter(lastDoc));
  }

  const q = query(ref, ...constraints);
  const snap = await getDocs(q);

  const rawData = snap.docs.map((docSnap) => {
    const resolvedInmobiliariaId = getInmobiliariaIdFromDocSnap(docSnap);

    return {
      id: docSnap.id,
      inmobiliariaId: resolvedInmobiliariaId,
      ...docSnap.data(),
    };
  });

  const data = sortPublicInmuebles(
    applyClientFilters(rawData, {
      search,
      tipo,
      operacion,
      estado: "activo",
      publicarEnPortal: true,
    }),
  );

  return {
    data,
    lastDoc: snap.docs[snap.docs.length - 1] || null,
  };
};

/**
 * Alias semántico para listar inmuebles públicos de una inmobiliaria.
 */
export const getPublicInmueblesByInmobiliaria = async (
  inmobiliariaId,
  options = {},
) => {
  return getPublicInmuebles(inmobiliariaId, options);
};

/**
 * Obtener inmueble público por slug.
 *
 * Usado por:
 * /inmueble/:slug
 *
 * Nunca carga networkData.
 */
export const getPublicInmuebleBySlug = async (slug) => {
  if (!slug) return null;

  const ref = collectionGroup(db, "inmuebles");

  const q = query(
    ref,
    where("slug", "==", slug),
    where("deleted", "==", false),
    where("estado", "==", "activo"),
    where("publicarEnPortal", "==", true),
    limit(1),
  );

  const snap = await getDocs(q);

  if (snap.empty) return null;

  const docSnap = snap.docs[0];
  const resolvedInmobiliariaId = getInmobiliariaIdFromDocSnap(docSnap);

  return {
    id: docSnap.id,
    inmobiliariaId: resolvedInmobiliariaId,
    ...docSnap.data(),
  };
};

/* =========================================================
   UPDATE
   ========================================================= */

/**
 * Actualizar inmueble.
 *
 * Acepta tres firmas:
 * - updateInmueble(inmobiliariaId, inmuebleId, data, options)
 * - updateInmueble(inmobiliariaId, inmuebleId, data)
 * - updateInmueble(inmuebleId, data) usando la inmobiliaria activa
 *
 * options:
 * - networkData: undefined = no tocar
 * - networkData: null = borrar datos de red
 * - networkData: object = crear/actualizar datos de red
 */
export const updateInmueble = async (
  inmobiliariaIdOrInmuebleId,
  inmuebleIdOrData,
  maybeData = null,
  maybeOptions = {},
) => {
  let inmobiliariaId;
  let inmuebleId;
  let data;
  let options = maybeOptions || {};

  if (maybeData && typeof inmuebleIdOrData === "string") {
    inmobiliariaId = inmobiliariaIdOrInmuebleId;
    inmuebleId = inmuebleIdOrData;
    data = maybeData;
  } else {
    const resolved = resolveInmuebleIds(inmobiliariaIdOrInmuebleId);
    inmobiliariaId = resolved.inmobiliariaId;
    inmuebleId = resolved.inmuebleId;
    data = inmuebleIdOrData;
    options = maybeData || {};
  }

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
    await assertInmobiliariaActiva(inmobiliariaId);

    const payload = sanitizeUpdatePayload(data);
    const sharing = normalizeSharing(payload.sharing || {});

    if (payload.estado) {
      payload.estado = validateInmuebleEstado(payload.estado);
    }

    if (!payload.slug) {
      payload.slug = buildInmuebleSlug(payload.titulo, inmuebleId);
    }

    payload.destacado = Boolean(payload.destacado);
    payload.publicarEnPortal = Boolean(payload.publicarEnPortal);
    payload.noIndex = Boolean(payload.noIndex);
    payload.images = Array.isArray(payload.images) ? payload.images : [];
    payload.sharing = sharing;

    const ref = inmuebleDoc(inmobiliariaId, inmuebleId);

    await updateDoc(ref, {
      ...payload,

      // 🔑 Mantener coherencia con el path
      inmobiliariaId,
      ownerInmobiliariaId: inmobiliariaId,

      updatedAt: serverTimestamp(),
    });

    if (Object.prototype.hasOwnProperty.call(options, "networkData")) {
      await writeInmuebleNetworkData({
        inmobiliariaId,
        inmuebleId,
        sharing,
        networkData: options.networkData,
      });
    }

    console.log("✅ Inmueble actualizado:", inmuebleId);
  } catch (error) {
    console.error("❌ Error en updateInmueble:", error);
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
    await assertInmobiliariaActiva(inmobiliariaId);

    const estadoValidado = validateInmuebleEstado(estado);

    const ref = inmuebleDoc(inmobiliariaId, inmuebleId);

    await updateDoc(ref, {
      estado: estadoValidado,
      updatedAt: serverTimestamp(),
    });

    console.log("✅ Estado de inmueble actualizado:", inmuebleId);
  } catch (error) {
    console.error("❌ Error en updateInmuebleEstado:", error);
    throw error;
  }
};

/* =========================================================
   DELETE
   ========================================================= */

/**
 * Soft delete de inmueble.
 *
 * No borra físicamente el documento.
 */
export const deleteInmueble = async (inmobiliariaId, inmuebleId) => {
  if (!inmobiliariaId || !inmuebleId) {
    throw new Error("IDs requeridos");
  }

  try {
    await assertInmobiliariaActiva(inmobiliariaId);

    const ref = inmuebleDoc(inmobiliariaId, inmuebleId);

    await updateDoc(ref, {
      deleted: true,
      deletedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    console.log("🗑️ Inmueble enviado a papelera:", inmuebleId);
  } catch (error) {
    console.error("❌ Error en deleteInmueble:", error);
    throw error;
  }
};

/* =========================================================
   RED DE COLEGAS
   ========================================================= */

/**
 * Listar inmuebles compartidos en la Red de colegas.
 *
 * Lee documentos públicos compartidos desde collectionGroup("inmuebles")
 * y luego intenta cargar /private/networkData para cada inmueble.
 */
export const getNetworkSharedInmuebles = async ({
  search = "",
  tipo = "",
  operacion = "",
  pageSize = 50,
  excludeInmobiliariaIds = [],
} = {}) => {
  const ref = collectionGroup(db, "inmuebles");

  const constraints = [
    where("deleted", "==", false),
    where("estado", "==", "activo"),
    where("sharing.enabled", "==", true),
    where("sharing.mode", "==", "all_colleagues"),
    limit(pageSize),
  ];

  if (tipo) {
    constraints.push(where("tipo", "==", tipo));
  }

  if (operacion) {
    constraints.push(where("operacion", "==", operacion));
  }

  const q = query(ref, ...constraints);
  const snap = await getDocs(q);

  const rawItems = await Promise.all(
    snap.docs.map(async (docSnap) => {
      const resolvedInmobiliariaId = getInmobiliariaIdFromDocSnap(docSnap);
      const data = docSnap.data();

      let networkData = {};

      try {
        networkData =
          (await getInmuebleNetworkData(resolvedInmobiliariaId, docSnap.id)) ||
          {};
      } catch (error) {
        console.warn(
          "No se pudo cargar networkData del inmueble compartido:",
          error,
        );
      }

      return {
        id: docSnap.id,
        inmobiliariaId: resolvedInmobiliariaId,
        ...data,
        networkData,
      };
    }),
  );

  const excludedIds = Array.isArray(excludeInmobiliariaIds)
    ? excludeInmobiliariaIds
    : [];

  const filteredItems = rawItems.filter((item) => {
    if (excludedIds.includes(item.inmobiliariaId)) {
      return false;
    }

    return true;
  });

  const data = sortPublicInmuebles(
    applyClientFilters(filteredItems, {
      search,
      tipo,
      operacion,
      estado: "activo",
    }),
  );

  return {
    data,
    lastDoc: null,
  };
};

/**
 * Obtener un inmueble compartido específico para la ficha detalle
 * de Red de colegas.
 */
export const getNetworkSharedInmuebleById = async (
  inmobiliariaId,
  inmuebleId,
) => {
  if (!inmobiliariaId || !inmuebleId) {
    throw new Error("IDs requeridos");
  }

  const ref = inmuebleDoc(inmobiliariaId, inmuebleId);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    return null;
  }

  const data = snap.data();

  const isShared =
    data.deleted === false &&
    data.estado === "activo" &&
    data.sharing?.enabled === true &&
    data.sharing?.mode === "all_colleagues";

  if (!isShared) {
    return null;
  }

  let networkData = {};

  try {
    networkData =
      (await getInmuebleNetworkData(inmobiliariaId, inmuebleId)) || {};
  } catch (error) {
    console.warn(
      "No se pudo cargar networkData del inmueble compartido:",
      error,
    );
  }

  return {
    id: snap.id,
    inmobiliariaId,
    ...data,
    networkData,
  };
};

/* =========================================================
   SOLICITUDES DE COLABORACIÓN
   ========================================================= */

const networkRequestsCollection = () =>
  collection(db, "inmueble_network_requests");

export const createNetworkCollaborationRequest = async ({
  inmueble,
  requesterInmobiliariaId,
  mensaje = "",
}) => {
  if (!inmueble?.id || !inmueble?.inmobiliariaId) {
    throw new Error("Inmueble inválido");
  }

  if (!requesterInmobiliariaId) {
    throw new Error("No se pudo determinar la inmobiliaria solicitante");
  }

  const currentUser = auth.currentUser;

  if (!currentUser?.uid) {
    throw new Error("Tenés que iniciar sesión para solicitar colaboración");
  }

  if (requesterInmobiliariaId === inmueble.inmobiliariaId) {
    throw new Error("No podés solicitar colaboración sobre un inmueble propio");
  }

  const payload = {
    inmuebleId: inmueble.id,
    inmuebleTitulo: inmueble.titulo || "",
    ownerInmobiliariaId: inmueble.inmobiliariaId,
    requesterInmobiliariaId,
    requesterUserId: currentUser.uid,
    requesterUserEmail: currentUser.email || "",
    mensaje: mensaje?.trim() || "",
    estado: "pendiente",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const docRef = await addDoc(networkRequestsCollection(), payload);

  return docRef.id;
};