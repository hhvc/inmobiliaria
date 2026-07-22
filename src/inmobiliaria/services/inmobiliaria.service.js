import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  limit,
  query,
  where,
  serverTimestamp,
  setDoc,
  arrayUnion,
  writeBatch,
} from "firebase/firestore";

import { db, auth } from "../../firebase/config";
import { setActiveInmobiliariaId } from "../../inmobiliaria/helpers/activeInmobiliaria.helper";

/**
 * 🔹 Colección principal
 */
const COLLECTION_NAME = "inmobiliarias";
const inmobiliariasRef = collection(db, COLLECTION_NAME);

const DEFAULT_SELF_SERVICE_MODULES = [
  "inmuebles",
  "consultas",
  "dominios",
  "branding",
  "usuarios",
];

const DEFAULT_VERIFICATION_STATUS = {
  estado: "pendiente_documentacion",
  estadoLabel: "Pendiente de documentación para validar",
  tipoPersona: "no_informado",
  cuit: "",
  razonSocial: "",
  requiereDocumentacion: true,
  documentacionCompleta: false,
  submittedAt: null,
  reviewedAt: null,
  reviewedBy: null,
  observaciones:
    "La inmobiliaria puede operar, pero debe presentar documentación para validar su identidad y situación fiscal.",
};

/**
 * 🔹 helpers internos
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

const normalizeText = (value = "") => value.toString().trim();

const normalizeCuit = (value = "") =>
  value
    .toString()
    .trim()
    .replace(/\D/g, "");

const normalizeSlug = (value = "") => {
  return value.toString().trim().toLowerCase();
};

const normalizeDomain = (value = "") => {
  return value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");
};

const normalizeDomainList = (domains = []) => {
  if (!Array.isArray(domains)) return [];

  return Array.from(
    new Set(domains.map(normalizeDomain).filter(Boolean)),
  );
};

const buildAdminList = (admins = [], currentUserId) => {
  const safeAdmins = Array.isArray(admins) ? admins : [];

  return Array.from(new Set([...safeAdmins, currentUserId].filter(Boolean)));
};

const buildDefaultVerificationData = (data = {}) => {
  const cuit = normalizeCuit(data.cuit);
  const razonSocial = normalizeText(data.razonSocial);

  return {
    ...DEFAULT_VERIFICATION_STATUS,
    tipoPersona: data.verificacion?.tipoPersona || "no_informado",
    cuit,
    razonSocial,
  };
};

const buildEmptyVerificationDocuments = () => ({
  constanciaArca: null,
  dniTitular: null,
  estatutoContratoSocial: null,
  dniApoderado: null,
  poderApoderado: null,
});

const mapInmobiliariaData = (docSnap) => {
  if (!docSnap?.exists?.()) return null;

  const data = docSnap.data();

  return {
    id: docSnap.id,
    ...data,
    nombre: data.nombre || "",
    slug: data.slug || "",
    razonSocial: data.razonSocial || "",
    cuit: data.cuit || "",
    branding: data.branding || {},
    configuracion: data.configuracion || {},
    dominiosPublicos: data.dominiosPublicos || [],
    modulosSuscriptos: data.modulosSuscriptos || [],
    verificacion: data.verificacion || buildDefaultVerificationData(data),
    documentacionVerificacion:
      data.documentacionVerificacion || buildEmptyVerificationDocuments(),
    createdAt: normalizeTimestamp(data.createdAt),
    updatedAt: normalizeTimestamp(data.updatedAt),
  };
};

/**
 * 🌐 Obtener inmobiliaria pública por dominio propio
 */
export async function getPublicInmobiliariaByDomain(hostname) {
  const cleanHostname = normalizeDomain(hostname);

  if (!cleanHostname) return null;

  const q = query(
    collection(db, COLLECTION_NAME),
    where("activa", "==", true),
    where("dominiosPublicos", "array-contains", cleanHostname),
    limit(1),
  );

  const snap = await getDocs(q);

  if (snap.empty) return null;

  return mapInmobiliariaData(snap.docs[0]);
}

/**
 * 🏢 Crear inmobiliaria con estructura extendida
 * 👉 Compatible con alta admin/root y alta autogestionada
 */
export async function createInmobiliaria(data) {
  const currentUser = auth.currentUser;

  if (!currentUser?.uid) {
    throw new Error("Usuario no autenticado");
  }

  const nombre = normalizeText(data.nombre);
  const slug = normalizeSlug(data.slug);
  const cuit = normalizeCuit(data.cuit);

  // Validar datos requeridos
  if (!nombre || !slug || !cuit) {
    throw new Error("Faltan campos requeridos: nombre, slug o cuit");
  }

  const payload = {
    // Información básica
    nombre,
    razonSocial: normalizeText(data.razonSocial),
    cuit,
    slug,
    activa: data.activa !== undefined ? data.activa : true,
    dominiosPublicos: normalizeDomainList(data.dominiosPublicos),

    // Módulos
    modulosSuscriptos: Array.isArray(data.modulosSuscriptos)
      ? data.modulosSuscriptos
      : [],

    // Verificación documental
    verificacion: data.verificacion || buildDefaultVerificationData(data),
    documentacionVerificacion:
      data.documentacionVerificacion || buildEmptyVerificationDocuments(),

    // SEO / visibilidad
    noIndex: data.noIndex === true,
    seo: data.seo || {},

    // Configuración
    configuracion: {
      ...(data.configuracion || {}),
      operacionesPermitidas:
        data.configuracion?.operacionesPermitidas || [],
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
    admins: buildAdminList(data.admins, currentUser.uid),
    createdBy: data.createdBy || currentUser.uid,
    createdByEmail: data.createdByEmail || currentUser.email || "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    const docRef = await addDoc(inmobiliariasRef, payload);

    // ✅ Setear inmobiliaria activa en helper local
    setActiveInmobiliariaId(docRef.id);

    console.log(`✅ Inmobiliaria creada y activada: ${docRef.id}`);
    return docRef.id;
  } catch (error) {
    console.error("❌ Error al crear inmobiliaria:", error);
    throw new Error(`No se pudo crear la inmobiliaria: ${error.message}`);
  }
}

/**
 * 🏢 Alta autogestionada de inmobiliaria
 * - Crea inmobiliaria activa
 * - La deja pendiente_documentacion
 * - Vincula al usuario actual como admin de esa inmobiliaria
 */
export async function createSelfRegisteredInmobiliaria(formData = {}) {
  const currentUser = auth.currentUser;

  if (!currentUser?.uid) {
    throw new Error("Tenés que iniciar sesión para dar de alta una inmobiliaria");
  }

  const userRef = doc(db, "users", currentUser.uid);
  const userSnap = await getDoc(userRef);
  const existingUserData = userSnap.exists() ? userSnap.data() : {};
  const existingRole = existingUserData.role || "";

  const inmobiliariaData = {
    ...formData,
    activa: true,
    modulosSuscriptos: DEFAULT_SELF_SERVICE_MODULES,
    createdBy: currentUser.uid,
    createdByEmail: currentUser.email || "",
    verificacion: buildDefaultVerificationData(formData),
    documentacionVerificacion: buildEmptyVerificationDocuments(),
    configuracion: {
      ...(formData.configuracion || {}),
      contacto: {
        email:
          formData.configuracion?.contacto?.email?.trim() ||
          currentUser.email ||
          "",
        telefono: formData.configuracion?.contacto?.telefono?.trim() || "",
        whatsapp: formData.configuracion?.contacto?.whatsapp?.trim() || "",
      },
    },
  };

  const inmobiliariaId = await createInmobiliaria(inmobiliariaData);

  const roleToWrite = existingRole === "root" ? "root" : "admin";

  await setDoc(
    userRef,
    {
      uid: currentUser.uid,
      email: currentUser.email || "",
      displayName: currentUser.displayName || "",
      role: roleToWrite,
      roles: arrayUnion("admin"),
      inmobiliarias: arrayUnion(inmobiliariaId),
      activeInmobiliariaId: inmobiliariaId,
      updatedAt: serverTimestamp(),
      ...(userSnap.exists() ? {} : { createdAt: serverTimestamp() }),
    },
    { merge: true },
  );

  await updateDoc(userRef, {
    [`inmobiliariaRoles.${inmobiliariaId}`]: "admin",
    updatedAt: serverTimestamp(),
  });

  setActiveInmobiliariaId(inmobiliariaId);

  return inmobiliariaId;
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

  // 👑 Detectar root
  let isRoot = false;
  const userRef = doc(db, "users", currentUser.uid);
  const userSnap = await getDoc(userRef);
  if (userSnap.exists() && userSnap.data().role === "root") {
    isRoot = true;
  }

  /**
   * 🔐 Validación de permisos (cliente)
   * - Admin de la inmobiliaria
   * - Root → bypass total
   */
  if (!isRoot && !inmobiliariaData.admins?.includes(currentUser.uid)) {
    throw new Error("No tienes permiso para editar esta inmobiliaria");
  }

  // Payload base
  const updateData = {
    ...data,
    updatedAt: serverTimestamp(),
    updatedBy: currentUser.uid,
  };

  if (data.nombre !== undefined) {
    updateData.nombre = normalizeText(data.nombre);
  }

  if (data.razonSocial !== undefined) {
    updateData.razonSocial = normalizeText(data.razonSocial);
  }

  if (data.cuit !== undefined) {
    updateData.cuit = normalizeCuit(data.cuit);
  }

  if (data.slug !== undefined) {
    updateData.slug = normalizeSlug(data.slug);
  }

  if (data.dominiosPublicos !== undefined) {
    updateData.dominiosPublicos = normalizeDomainList(data.dominiosPublicos);
  }

  if (data.modulosSuscriptos !== undefined) {
    updateData.modulosSuscriptos = Array.isArray(data.modulosSuscriptos)
      ? data.modulosSuscriptos
      : [];
  }

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

  /**
   * 🧠 Merge de verificación
   */
  if (data.verificacion && inmobiliariaData.verificacion) {
    updateData.verificacion = {
      ...inmobiliariaData.verificacion,
      ...data.verificacion,
    };
  }

  /**
   * 🧠 Merge de documentación de verificación
   */
  if (
    data.documentacionVerificacion &&
    inmobiliariaData.documentacionVerificacion
  ) {
    updateData.documentacionVerificacion = {
      ...inmobiliariaData.documentacionVerificacion,
      ...data.documentacionVerificacion,
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

  return mapInmobiliariaData(snap);
}

/**
 * 🔍 Obtener datos públicos mínimos de una inmobiliaria por ID
 *
 * Usado por fichas públicas de inmuebles para contacto/WhatsApp.
 */
export async function getPublicInmobiliariaById(id) {
  if (!id) return null;

  const ref = doc(db, COLLECTION_NAME, id);
  const snap = await getDoc(ref);

  if (!snap.exists()) return null;

  const data = snap.data();

  if (data.activa === false) {
    return null;
  }

  return {
    id: snap.id,
    nombre: data.nombre || "",
    slug: data.slug || "",
    razonSocial: data.razonSocial || "",
    cuit: data.cuit || "",
    branding: data.branding || {},
    verificacion: data.verificacion || buildDefaultVerificationData(data),
    configuracion: {
      ...data.configuracion,
      contacto: {
        email: data.configuracion?.contacto?.email || "",
        telefono: data.configuracion?.contacto?.telefono || "",
        whatsapp: data.configuracion?.contacto?.whatsapp || "",
      },
    },
    dominiosPublicos: data.dominiosPublicos || [],
  };
}

const getInmobiliariaLogoUrl = (inmobiliaria = {}) => {
  return (
    inmobiliaria.logoUrl ||
    inmobiliaria.logo ||
    inmobiliaria.branding?.logoUrl ||
    inmobiliaria.branding?.logo?.url ||
    inmobiliaria.branding?.logo ||
    inmobiliaria.branding?.isologoUrl ||
    ""
  );
};

export async function getInmobiliariaPublisherSnapshot(inmobiliariaId) {
  const inmobiliaria = await getPublicInmobiliariaById(inmobiliariaId);

  const fallbackName = "Inmobiliaria adherida";

  if (!inmobiliaria) {
    return {
      publisher: {
        type: "inmobiliaria",
        id: inmobiliariaId || "",
        name: fallbackName,
        slug: "",
        logoUrl: "",
        verified: false,
        profilePath: "",
        contact: {
          email: "",
          telefono: "",
          whatsapp: "",
        },
      },

      inmobiliariaNombre: fallbackName,
      inmobiliariaSlug: "",
      inmobiliariaLogoUrl: "",

      sourceLabel: fallbackName,
      sourceLogoUrl: "",
      sourceTypeLabel: "Inmobiliaria",
      sourceBadgeClass: "text-bg-primary",
    };
  }

  const name =
    inmobiliaria.nombre ||
    inmobiliaria.razonSocial ||
    fallbackName;

  const slug = inmobiliaria.slug || "";
  const logoUrl = getInmobiliariaLogoUrl(inmobiliaria);
  const verified = inmobiliaria.verificacion?.estado === "verificada";
  const profilePath = slug ? `/inmobiliaria/${slug}` : "";

  return {
    publisher: {
      type: "inmobiliaria",
      id: inmobiliaria.id || inmobiliariaId || "",
      name,
      slug,
      logoUrl,
      verified,
      profilePath,
      contact: {
        email: inmobiliaria.configuracion?.contacto?.email || "",
        telefono: inmobiliaria.configuracion?.contacto?.telefono || "",
        whatsapp: inmobiliaria.configuracion?.contacto?.whatsapp || "",
      },
    },

    inmobiliariaNombre: name,
    inmobiliariaSlug: slug,
    inmobiliariaLogoUrl: logoUrl,

    sourceLabel: name,
    sourceLogoUrl: logoUrl,
    sourceTypeLabel: "Inmobiliaria",
    sourceBadgeClass: "text-bg-primary",
  };
}

/**
 * 🔍 Obtener inmobiliaria pública por Slug
 */
export async function getInmobiliariaBySlug(slug) {
  const cleanSlug = normalizeSlug(slug);

  if (!cleanSlug) throw new Error("Slug requerido");

  const q = query(
    inmobiliariasRef,
    where("activa", "==", true),
    where("slug", "==", cleanSlug),
    limit(1),
  );

  const snapshot = await getDocs(q);

  if (snapshot.empty) return null;

  return mapInmobiliariaData(snapshot.docs[0]);
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

  return snapshot.docs.map((docSnap) => mapInmobiliariaData(docSnap));
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

    return snapshot.docs.map((docSnap) => mapInmobiliariaData(docSnap));
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

        return mapInmobiliariaData(snap);
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

  const normalizedSlug = normalizeSlug(slug);

  const q = query(inmobiliariasRef, where("slug", "==", normalizedSlug));

  const snapshot = await getDocs(q);

  if (snapshot.empty) return false;

  if (excludeId) {
    return snapshot.docs.some((docSnap) => docSnap.id !== excludeId);
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

  // 👑 Root bypass total
  const currentUser = auth.currentUser;
  if (currentUser?.uid) {
    const userRef = doc(db, "users", currentUser.uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists() && userSnap.data().role === "root") {
      return true;
    }
  }

  if (snap.data().activa === false) {
    throw new Error("La inmobiliaria está desactivada");
  }

  return true;
}

/* =========================================================
   SOLICITUDES DE VINCULACIÓN A INMOBILIARIA
   ========================================================= */

const inmobiliariaLinkRequestsRef = collection(
  db,
  "inmobiliaria_user_link_requests",
);

export async function getActiveInmobiliariasForLinkRequest() {
  const currentUser = auth.currentUser;

  if (!currentUser?.uid) {
    throw new Error("Tenés que iniciar sesión para buscar inmobiliarias");
  }

  const q = query(
    inmobiliariasRef,
    where("activa", "==", true),
    limit(100),
  );

  const snapshot = await getDocs(q);

  return snapshot.docs
    .map((docSnap) => mapInmobiliariaData(docSnap))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
}

export async function createInmobiliariaLinkRequest({
  inmobiliaria,
  requestedRole = "admin",
  mensaje = "",
}) {
  const currentUser = auth.currentUser;

  if (!currentUser?.uid) {
    throw new Error("Tenés que iniciar sesión para solicitar vinculación");
  }

  if (!inmobiliaria?.id) {
    throw new Error("Tenés que seleccionar una inmobiliaria");
  }

  const payload = {
    inmobiliariaId: inmobiliaria.id,
    inmobiliariaNombre: inmobiliaria.nombre || "",
    requesterUserId: currentUser.uid,
    requesterUserEmail: currentUser.email || "",
    requesterDisplayName: currentUser.displayName || "",
    requestedRole,
    mensaje: mensaje?.trim() || "",
    estado: "pendiente",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const docRef = await addDoc(inmobiliariaLinkRequestsRef, payload);

  return docRef.id;
}

/**
 * 📎 Actualizar documentación de validación de una inmobiliaria
 */
export async function updateInmobiliariaVerificationData(
  inmobiliariaId,
  {
    verificacion = {},
    documentacionVerificacion = {},
  } = {},
) {
  if (!inmobiliariaId) {
    throw new Error("ID de inmobiliaria requerido");
  }

  const currentUser = auth.currentUser;

  if (!currentUser?.uid) {
    throw new Error("Usuario no autenticado");
  }

  await updateInmobiliaria(inmobiliariaId, {
    verificacion: {
      ...verificacion,
      updatedAt: new Date().toISOString(),
      updatedBy: currentUser.uid,
    },
    documentacionVerificacion,
  });
}

/* =========================================================
   REVISIÓN ROOT DE VERIFICACIÓN DE INMOBILIARIAS
   ========================================================= */

const VERIFICATION_LABELS = {
  pendiente_documentacion: "Pendiente de documentación para validar",
  pendiente_revision: "Documentación en revisión",
  verificada: "Inmobiliaria verificada",
  observada: "Documentación observada",
  rechazada: "Verificación rechazada",
};

export async function getInmobiliariasForVerificationReview() {
  const currentUser = auth.currentUser;

  if (!currentUser?.uid) {
    throw new Error("Usuario no autenticado");
  }

  const inmobiliarias = await getAllInmobiliarias();

  return inmobiliarias
    .filter((inmobiliaria) => {
      const estado =
        inmobiliaria.verificacion?.estado || "pendiente_documentacion";

      return [
        "pendiente_documentacion",
        "pendiente_revision",
        "observada",
        "rechazada",
        "verificada",
      ].includes(estado);
    })
    .sort((a, b) => {
      const estadoA = a.verificacion?.estado || "pendiente_documentacion";
      const estadoB = b.verificacion?.estado || "pendiente_documentacion";

      const order = {
        pendiente_revision: 1,
        observada: 2,
        pendiente_documentacion: 3,
        rechazada: 4,
        verificada: 5,
      };

      return (order[estadoA] || 99) - (order[estadoB] || 99);
    });
}

export async function updateInmobiliariaVerificationReview(
  inmobiliariaId,
  {
    estado,
    observaciones = "",
  } = {},
) {
  if (!inmobiliariaId) {
    throw new Error("ID de inmobiliaria requerido");
  }

  const currentUser = auth.currentUser;

  if (!currentUser?.uid) {
    throw new Error("Usuario no autenticado");
  }

  const allowedEstados = ["verificada", "observada", "rechazada"];

  if (!allowedEstados.includes(estado)) {
    throw new Error("Estado de verificación inválido");
  }

  const current = await getInmobiliariaById(inmobiliariaId);

  if (!current) {
    throw new Error("Inmobiliaria no encontrada");
  }

  const now = new Date().toISOString();

  const nextVerification = {
    ...(current.verificacion || {}),
    estado,
    estadoLabel: VERIFICATION_LABELS[estado] || estado,
    reviewedAt: now,
    reviewedBy: currentUser.uid,
    reviewNote: observaciones?.trim() || "",
    updatedAt: now,
    updatedBy: currentUser.uid,
  };

  if (estado === "verificada") {
    nextVerification.documentacionCompleta = true;
    nextVerification.documentacionAprobada = true;
    nextVerification.requiereDocumentacion = false;
  }

  if (estado === "observada") {
    nextVerification.documentacionAprobada = false;
    nextVerification.requiereDocumentacion = true;
    nextVerification.observaciones =
      observaciones?.trim() ||
      "La documentación fue observada. Se requiere información adicional o correcciones.";
  }

  if (estado === "rechazada") {
    nextVerification.documentacionAprobada = false;
    nextVerification.requiereDocumentacion = true;
    nextVerification.observaciones =
      observaciones?.trim() ||
      "La verificación fue rechazada por el equipo de ONO Prop.";
  }

  await updateInmobiliaria(inmobiliariaId, {
    verificacion: nextVerification,
  });
}

/* =========================================================
   REVISIÓN DE SOLICITUDES DE VINCULACIÓN
   ========================================================= */

const LINK_REQUEST_STATUSES = [
  "pendiente",
  "aceptada",
  "rechazada",
  "cancelada",
];

const chunkArray = (items = [], size = 10) => {
  const chunks = [];

  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }

  return chunks;
};

const mapInmobiliariaLinkRequest = (docSnap) => {
  if (!docSnap?.exists?.()) return null;

  const data = docSnap.data();

  return {
    id: docSnap.id,
    ...data,
    createdAt: normalizeTimestamp(data.createdAt),
    updatedAt: normalizeTimestamp(data.updatedAt),
    reviewedAt: normalizeTimestamp(data.reviewedAt),
  };
};

export async function getInmobiliariaLinkRequestsForAdmin({
  estado = "pendiente",
} = {}) {
  const currentUser = auth.currentUser;

  if (!currentUser?.uid) {
    throw new Error("Usuario no autenticado");
  }

  const userRef = doc(db, "users", currentUser.uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    throw new Error("No se encontró el perfil del usuario");
  }

  const userData = userSnap.data();
  const isRootUser =
    userData.role === "root" ||
    userData.primaryRole === "root" ||
    (Array.isArray(userData.roles) && userData.roles.includes("root"));

  let docs = [];

  if (isRootUser) {
    const snap = await getDocs(inmobiliariaLinkRequestsRef);
    docs = snap.docs;
  } else {
    const inmoIds = Array.isArray(userData.inmobiliarias)
      ? userData.inmobiliarias.filter(Boolean)
      : [];

    if (inmoIds.length === 0) return [];

    const chunks = chunkArray(inmoIds, 10);

    const snapshots = await Promise.all(
      chunks.map((chunk) => {
        const q = query(
          inmobiliariaLinkRequestsRef,
          where("inmobiliariaId", "in", chunk),
        );

        return getDocs(q);
      }),
    );

    docs = snapshots.flatMap((snap) => snap.docs);
  }

  return docs
    .map((docSnap) => mapInmobiliariaLinkRequest(docSnap))
    .filter(Boolean)
    .filter((request) => {
      if (!estado) return true;
      return request.estado === estado;
    })
    .sort((a, b) => {
      const dateA = a.createdAt instanceof Date ? a.createdAt.getTime() : 0;
      const dateB = b.createdAt instanceof Date ? b.createdAt.getTime() : 0;

      return dateB - dateA;
    });
}

export async function reviewInmobiliariaLinkRequest(
  requestId,
  {
    estado,
    reviewNote = "",
  } = {},
) {
  if (!requestId) {
    throw new Error("ID de solicitud requerido");
  }

  if (!LINK_REQUEST_STATUSES.includes(estado)) {
    throw new Error("Estado de solicitud inválido");
  }

  const currentUser = auth.currentUser;

  if (!currentUser?.uid) {
    throw new Error("Usuario no autenticado");
  }

  const requestRef = doc(db, "inmobiliaria_user_link_requests", requestId);
  const requestSnap = await getDoc(requestRef);

  if (!requestSnap.exists()) {
    throw new Error("Solicitud no encontrada");
  }

  const requestData = requestSnap.data();

  if (requestData.estado !== "pendiente") {
    throw new Error("La solicitud ya fue revisada");
  }

  const batch = writeBatch(db);

  batch.update(requestRef, {
    estado,
    reviewedAt: serverTimestamp(),
    reviewedBy: currentUser.uid,
    reviewNote: reviewNote?.trim() || "",
    updatedAt: serverTimestamp(),
  });

  if (estado === "aceptada") {
    const requesterUserId = requestData.requesterUserId;
    const inmobiliariaId = requestData.inmobiliariaId;
    const requestedRole = requestData.requestedRole || "admin";

    if (!requesterUserId || !inmobiliariaId) {
      throw new Error("La solicitud no tiene usuario o inmobiliaria válidos");
    }

    const requesterUserRef = doc(db, "users", requesterUserId);
    const requesterUserSnap = await getDoc(requesterUserRef);

    if (!requesterUserSnap.exists()) {
      throw new Error("El usuario solicitante no tiene perfil creado");
    }

    const requesterUserData = requesterUserSnap.data();
    const currentRole = requesterUserData.role || "";
    const roleToWrite = currentRole === "root" ? "root" : "admin";

    batch.update(requesterUserRef, {
      role: roleToWrite,
      roles: arrayUnion("admin"),
      inmobiliarias: arrayUnion(inmobiliariaId),
      activeInmobiliariaId:
        requesterUserData.activeInmobiliariaId || inmobiliariaId,
      [`inmobiliariaRoles.${inmobiliariaId}`]: requestedRole,
      updatedAt: serverTimestamp(),
    });

    if (requestedRole === "admin") {
      const inmobiliariaRef = doc(db, COLLECTION_NAME, inmobiliariaId);

      batch.update(inmobiliariaRef, {
        admins: arrayUnion(requesterUserId),
        updatedAt: serverTimestamp(),
        updatedBy: currentUser.uid,
      });
    }
  }

  await batch.commit();
}