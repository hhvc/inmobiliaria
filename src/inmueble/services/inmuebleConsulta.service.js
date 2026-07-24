import {
    collection,
    addDoc,
    getDocs,
    updateDoc,
    doc,
    query,
    where,
    limit,
    serverTimestamp,
} from "firebase/firestore";

import { db } from "../../firebase/config";

const CONSULTAS_COLLECTION = "inmueble_consultas";

export const CONSULTA_ESTADOS = {
    NUEVA: "nueva",
    CONTACTADA: "contactada",
    VISITA: "visita",
    INTERESADA: "interesada",
    CERRADA: "cerrada",
    DESCARTADA: "descartada",
    ARCHIVADA: "archivada",
};

export const CONSULTA_ESTADOS_ARRAY = Object.values(CONSULTA_ESTADOS);

export const CONSULTA_ESTADO_LABELS = {
    [CONSULTA_ESTADOS.NUEVA]: "Nueva",
    [CONSULTA_ESTADOS.CONTACTADA]: "Contactada",
    [CONSULTA_ESTADOS.VISITA]: "Visita coordinada",
    [CONSULTA_ESTADOS.INTERESADA]: "Interesada",
    [CONSULTA_ESTADOS.CERRADA]: "Cerrada",
    [CONSULTA_ESTADOS.DESCARTADA]: "Descartada",
    [CONSULTA_ESTADOS.ARCHIVADA]: "Archivada",
};

const consultasCollection = () => collection(db, CONSULTAS_COLLECTION);

const consultaDoc = (consultaId) =>
    doc(db, CONSULTAS_COLLECTION, consultaId);

const cleanText = (value = "") => value.toString().trim();

const normalizeEmail = (value = "") => cleanText(value).toLowerCase();

const normalizePhone = (value = "") => cleanText(value);

const buildPageUrl = (slug) => {
    if (!slug) return "";

    if (typeof window === "undefined") {
        return `/inmueble/${slug}`;
    }

    return `${window.location.origin}/inmueble/${slug}`;
};

const sortConsultasByDateDesc = (consultas = []) => {
    return [...consultas].sort((a, b) => {
        const aTime =
            typeof a.createdAt?.toMillis === "function"
                ? a.createdAt.toMillis()
                : 0;

        const bTime =
            typeof b.createdAt?.toMillis === "function"
                ? b.createdAt.toMillis()
                : 0;

        return bTime - aTime;
    });
};

/* =========================================================
   CREATE PÚBLICO
   ========================================================= */

export const createInmuebleConsulta = async ({
    inmueble,
    nombre,
    email,
    telefono,
    mensaje,
}) => {
    if (!inmueble?.id) {
        throw new Error("No se pudo identificar el inmueble");
    }

    if (!inmueble?.inmobiliariaId) {
        throw new Error("No se pudo identificar la inmobiliaria");
    }

    const normalizedNombre = cleanText(nombre);
    const normalizedEmail = normalizeEmail(email);
    const normalizedTelefono = normalizePhone(telefono);
    const normalizedMensaje = cleanText(mensaje);

    if (!normalizedNombre) {
        throw new Error("El nombre es obligatorio");
    }

    if (!normalizedEmail && !normalizedTelefono) {
        throw new Error("Ingresá un email o un teléfono de contacto");
    }

    const consulta = {
        // Relación con inmueble
        inmuebleId: inmueble.id,
        inmuebleSlug: inmueble.slug || "",
        inmuebleTitulo: inmueble.titulo || "",
        inmuebleOperacion: inmueble.operacion || "",
        inmuebleTipo: inmueble.tipo || "",

        // Relación con inmobiliaria
        inmobiliariaId: inmueble.inmobiliariaId,
        ownerInmobiliariaId:
            inmueble.ownerInmobiliariaId || inmueble.inmobiliariaId,

        // Datos del interesado
        nombre: normalizedNombre,
        email: normalizedEmail,
        telefono: normalizedTelefono,
        mensaje: normalizedMensaje,

        // Origen
        source: "inmueble_public_page",
        pageUrl: buildPageUrl(inmueble.slug),

        // Gestión interna
        estado: "nueva",
        leida: false,
        archivada: false,

        // Timestamps
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    };

    const docRef = await addDoc(consultasCollection(), consulta);

    return docRef.id;
};

/* =========================================================
   READ ADMIN
   ========================================================= */

export const getConsultasByInmobiliaria = async (
    inmobiliariaId,
    { includeArchived = false, pageSize = 50 } = {},
) => {
    if (!inmobiliariaId) {
        return [];
    }

    const constraints = [
        where("inmobiliariaId", "==", inmobiliariaId),
        limit(pageSize),
    ];

    const q = query(consultasCollection(), ...constraints);
    const snap = await getDocs(q);

    const consultas = snap.docs
        .map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data(),
        }))
        .filter((consulta) =>
            includeArchived ? true : consulta.archivada !== true,
        );

    return sortConsultasByDateDesc(consultas);
};

/* =========================================================
   UPDATE ADMIN
   ========================================================= */

export const updateConsultaEstado = async (consultaId, estado) => {
    if (!consultaId) {
        throw new Error("consultaId es requerido");
    }

    if (!CONSULTA_ESTADOS_ARRAY.includes(estado)) {
        throw new Error("Estado de consulta inválido");
    }

    await updateDoc(consultaDoc(consultaId), {
        estado,
        leida: estado !== CONSULTA_ESTADOS.NUEVA,
        archivada: estado === CONSULTA_ESTADOS.ARCHIVADA,
        updatedAt: serverTimestamp(),
    });
};

export const markConsultaAsRead = async (consultaId) => {
    if (!consultaId) {
        throw new Error("consultaId es requerido");
    }

    await updateDoc(consultaDoc(consultaId), {
        leida: true,
        estado: CONSULTA_ESTADOS.CONTACTADA,
        updatedAt: serverTimestamp(),
    });
};

export const markConsultaAsUnread = async (consultaId) => {
    if (!consultaId) {
        throw new Error("consultaId es requerido");
    }

    await updateDoc(consultaDoc(consultaId), {
        leida: false,
        estado: CONSULTA_ESTADOS.NUEVA,
        updatedAt: serverTimestamp(),
    });
};

export const archiveConsulta = async (consultaId) => {
    if (!consultaId) {
        throw new Error("consultaId es requerido");
    }

    await updateDoc(consultaDoc(consultaId), {
        archivada: true,
        leida: true,
        estado: CONSULTA_ESTADOS.ARCHIVADA,
        updatedAt: serverTimestamp(),
    });
};

export const restoreConsulta = async (consultaId) => {
    if (!consultaId) {
        throw new Error("consultaId es requerido");
    }

    await updateDoc(consultaDoc(consultaId), {
        archivada: false,
        leida: true,
        estado: CONSULTA_ESTADOS.CONTACTADA,
        updatedAt: serverTimestamp(),
    });
};