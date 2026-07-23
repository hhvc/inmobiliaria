import {
    arrayUnion,
    collection,
    doc,
    getDoc,
    getDocs,
    limit,
    orderBy,
    query,
    runTransaction,
    serverTimestamp,
    setDoc,
    updateDoc,
    where,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";

import { auth, db, storage } from "../../firebase/config";
import { normalizeInmuebleVideos } from "../../inmueble/utils/inmuebleVideos.helpers";

const COLLECTION_NAME = "particular_publication_requests";

const publicationRequestsRef = collection(db, COLLECTION_NAME);
const inmobiliariasRef = collection(db, "inmobiliarias");

const MAX_IMAGES = 50;
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

const REQUEST_STATUSES = [
    "nuevo",
    "en_revision",
    "contactado",
    "derivado",
    "cerrado",
    "descartado",
];

const normalizeText = (value = "") => value.toString().trim();

const normalizePhone = (value = "") =>
    value.toString().trim().replace(/\s+/g, " ");

const normalizeTimestamp = (value) => {
    if (!value) return null;

    if (typeof value.toDate === "function") {
        return value.toDate();
    }

    if (value instanceof Date) {
        return value;
    }

    const parsed = new Date(value);

    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const createActivityLogEntry = ({
    type = "note",
    title = "",
    message = "",
    metadata = {},
} = {}) => {
    const currentUser = auth.currentUser;

    return {
        id: createImageId(),
        type,
        title: normalizeText(title),
        message: normalizeText(message),
        metadata,
        createdAt: new Date().toISOString(),
        createdBy: currentUser?.uid || "",
        createdByEmail: currentUser?.email || "",
        createdByName: currentUser?.displayName || "",
    };
};

const appendActivityLog = (entry) => {
    return arrayUnion(entry);
};

const createImageId = () => {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
        return crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const sanitizeFileName = (fileName = "imagen") => {
    return (
        fileName
            .toString()
            .trim()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-zA-Z0-9._-]/g, "-")
            .replace(/-+/g, "-")
            .slice(0, 90) || "imagen.jpg"
    );
};

const normalizeImageFiles = (files = []) => {
    if (!files) return [];

    return Array.from(files).filter(Boolean);
};

const validateImageFiles = (files = []) => {
    const imageFiles = normalizeImageFiles(files);

    if (imageFiles.length > MAX_IMAGES) {
        throw new Error(`Podés subir hasta ${MAX_IMAGES} fotos.`);
    }

    imageFiles.forEach((file) => {
        if (!file.type?.startsWith("image/")) {
            throw new Error(`El archivo "${file.name}" no es una imagen válida.`);
        }

        if (file.size > MAX_IMAGE_SIZE_BYTES) {
            throw new Error(
                `La imagen "${file.name}" supera el máximo permitido de 10 MB.`,
            );
        }
    });

    return imageFiles;
};

const uploadPublicationRequestImages = async ({
    requestId,
    userId,
    files = [],
}) => {
    const imageFiles = validateImageFiles(files);

    if (imageFiles.length === 0) return [];

    const uploads = imageFiles.map(async (file, index) => {
        const imageId = createImageId();
        const safeName = sanitizeFileName(file.name);
        const storagePath = `${COLLECTION_NAME}/${requestId}/${userId}/${String(
            index,
        ).padStart(2, "0")}-${imageId}-${safeName}`;

        const storageRef = ref(storage, storagePath);

        await uploadBytes(storageRef, file, {
            contentType: file.type || "image/jpeg",
            customMetadata: {
                requestId,
                uploaderUid: userId,
            },
        });

        const url = await getDownloadURL(storageRef);

        return {
            id: imageId,
            url,
            storagePath,
            order: index,
            name: file.name || safeName,
            size: file.size || 0,
            contentType: file.type || "",
        };
    });

    return Promise.all(uploads);
};

const normalizeImages = (images = []) => {
    if (!Array.isArray(images)) return [];

    return images
        .map((image, index) => ({
            id: image.id || `${index}`,
            url: image.url || "",
            storagePath: image.storagePath || "",
            order: Number.isFinite(Number(image.order)) ? Number(image.order) : index,
            name: image.name || "",
            size: Number.isFinite(Number(image.size)) ? Number(image.size) : 0,
            contentType: image.contentType || "",
        }))
        .filter((image) => image.url || image.storagePath)
        .sort((a, b) => a.order - b.order);
};

const mapPublicationRequest = (docSnap) => {
    if (!docSnap?.exists?.()) return null;

    const data = docSnap.data();

    return {
        id: docSnap.id,
        ...data,
        images: normalizeImages(data.images),
        videos: normalizeInmuebleVideos(data.videos || []),
        createdAt: normalizeTimestamp(data.createdAt),
        updatedAt: normalizeTimestamp(data.updatedAt),
        reviewedAt: normalizeTimestamp(data.reviewedAt),
        assignedAt: normalizeTimestamp(data.assignedAt),
        convertedAt: normalizeTimestamp(data.convertedAt),
    };
};

const mapTargetInmobiliaria = (docSnap) => {
    const data = docSnap.data();

    return {
        id: docSnap.id,
        nombre: data.nombre || "",
        razonSocial: data.razonSocial || "",
        slug: data.slug || "",
        cuit: data.cuit || "",
        activa: data.activa === true,
        verificacion: data.verificacion || {},
    };
};

export const getActiveInmobiliariasForPublicationRequest = async () => {
    const q = query(inmobiliariasRef, where("activa", "==", true), limit(100));
    const snap = await getDocs(q);

    return snap.docs
        .map((docSnap) => mapTargetInmobiliaria(docSnap))
        .filter((inmobiliaria) => inmobiliaria.activa)
        .sort((a, b) => a.nombre.localeCompare(b.nombre));
};

export const createParticularPublicationRequest = async (formData = {}) => {
    const currentUser = auth.currentUser;

    if (!currentUser?.uid) {
        throw new Error("Tenés que iniciar sesión para solicitar una publicación.");
    }

    const nombre = normalizeText(formData.nombre);
    const telefono = normalizePhone(formData.telefono);
    const email = normalizeText(formData.email).toLowerCase();
    const operacion = normalizeText(formData.operacion);
    const tipo = normalizeText(formData.tipo);
    const ubicacion = normalizeText(formData.ubicacion);
    const descripcion = normalizeText(formData.descripcion);
    const precioEstimado = normalizeText(formData.precioEstimado);

    const targetType = normalizeText(formData.targetType || "onoprop");
    const targetInmobiliariaId = normalizeText(formData.targetInmobiliariaId);
    const targetInmobiliariaNombre = normalizeText(
        formData.targetInmobiliariaNombre,
    );

    const imageFiles = validateImageFiles(formData.images || []);
    const videos = normalizeInmuebleVideos(formData.videos || []);

    if (!nombre) {
        throw new Error("Ingresá tu nombre.");
    }

    if (!telefono && !email) {
        throw new Error("Ingresá al menos un teléfono, WhatsApp o email.");
    }

    if (!operacion) {
        throw new Error("Seleccioná el tipo de operación.");
    }

    if (!tipo) {
        throw new Error("Seleccioná el tipo de inmueble.");
    }

    if (!ubicacion) {
        throw new Error("Indicá la ubicación aproximada del inmueble.");
    }

    if (!descripcion || descripcion.length < 20) {
        throw new Error("Agregá una descripción un poco más completa.");
    }

    if (!["onoprop", "inmobiliaria"].includes(targetType)) {
        throw new Error("Seleccioná quién querés que revise la publicación.");
    }

    if (targetType === "inmobiliaria" && !targetInmobiliariaId) {
        throw new Error("Seleccioná una inmobiliaria.");
    }

    const isTargetOnoProp = targetType === "onoprop";
    const requestRef = doc(publicationRequestsRef);
    const requestId = requestRef.id;

    const images = await uploadPublicationRequestImages({
        requestId,
        userId: currentUser.uid,
        files: imageFiles,
    });

    const payload = {
        requesterUserId: currentUser.uid,
        requesterEmail: currentUser.email || "",
        requesterDisplayName: currentUser.displayName || "",

        nombre,
        telefono,
        email,
        operacion,
        tipo,
        ubicacion,
        descripcion,
        precioEstimado,
        images,
        videos,

        targetType,
        targetInmobiliariaId: isTargetOnoProp ? "" : targetInmobiliariaId,
        targetInmobiliariaNombre: isTargetOnoProp
            ? "ONO Prop"
            : targetInmobiliariaNombre,

        assignedInmobiliariaId: isTargetOnoProp ? "" : targetInmobiliariaId,
        assignedInmobiliariaNombre: isTargetOnoProp ? "" : targetInmobiliariaNombre,
        assignedAt: isTargetOnoProp ? null : serverTimestamp(),
        assignedBy: isTargetOnoProp ? "" : currentUser.uid,

        validationOwner: isTargetOnoProp ? "onoprop" : "inmobiliaria",
        publicationMode: isTargetOnoProp ? "particular" : "inmobiliaria",

        billingStatus: "free",
        billingModel: "none",

        activityLog: [
            createActivityLogEntry({
                type: "created",
                title: "Solicitud creada",
                message: "El particular envió la solicitud de publicación.",
                metadata: {
                    targetType,
                    targetInmobiliariaId: isTargetOnoProp ? "" : targetInmobiliariaId,
                    imagesCount: images.length,
                    videosCount: videos.length,
                },
            }),
        ],

        estado: "nuevo",
        origen: "portal_publicar",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    };

    await setDoc(requestRef, payload);

    return requestId;
};

export const getParticularPublicationRequests = async ({
    estado = "nuevo",
    pageSize = 100,
} = {}) => {
    const q = query(
        publicationRequestsRef,
        orderBy("createdAt", "desc"),
        limit(pageSize),
    );

    const snap = await getDocs(q);

    return snap.docs
        .map((docSnap) => mapPublicationRequest(docSnap))
        .filter(Boolean)
        .filter((request) => {
            if (!estado) return true;

            return request.estado === estado;
        });
};

export const getMyParticularPublicationRequests = async ({
    pageSize = 50,
} = {}) => {
    const currentUser = auth.currentUser;

    if (!currentUser?.uid) {
        throw new Error("Tenés que iniciar sesión para ver tus solicitudes.");
    }

    const q = query(
        publicationRequestsRef,
        where("requesterUserId", "==", currentUser.uid),
        limit(pageSize),
    );

    const snap = await getDocs(q);

    return snap.docs
        .map((docSnap) => mapPublicationRequest(docSnap))
        .filter(Boolean)
        .sort((a, b) => {
            const dateA = a.createdAt instanceof Date ? a.createdAt.getTime() : 0;
            const dateB = b.createdAt instanceof Date ? b.createdAt.getTime() : 0;

            return dateB - dateA;
        });
};

export const updateParticularPublicationRequest = async (
    requestId,
    { estado, internalNote = "" } = {},
) => {
    if (!requestId) {
        throw new Error("ID de solicitud requerido.");
    }

    if (!REQUEST_STATUSES.includes(estado)) {
        throw new Error("Estado inválido.");
    }

    const currentUser = auth.currentUser;

    if (!currentUser?.uid) {
        throw new Error("Usuario no autenticado.");
    }

    const requestRef = doc(db, COLLECTION_NAME, requestId);

    await updateDoc(requestRef, {
        estado,
        internalNote: internalNote?.trim() || "",
        reviewedAt: serverTimestamp(),
        reviewedBy: currentUser.uid,
        updatedAt: serverTimestamp(),
        activityLog: appendActivityLog(
            createActivityLogEntry({
                type: "status_updated",
                title: "Estado actualizado",
                message: `La solicitud pasó a estado: ${estado}.`,
                metadata: {
                    estado,
                },
            }),
        ),
    });
};

const getCurrentUserActiveInmobiliariaId = async () => {
    const currentUser = auth.currentUser;

    if (!currentUser?.uid) {
        throw new Error("Usuario no autenticado.");
    }

    const userRef = doc(db, "users", currentUser.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
        throw new Error("No se encontró el perfil del usuario.");
    }

    const userData = userSnap.data();

    const inmobiliarias = Array.isArray(userData.inmobiliarias)
        ? userData.inmobiliarias
        : [];

    const activeInmobiliariaId =
        userData.activeInmobiliariaId || inmobiliarias[0] || "";

    if (!activeInmobiliariaId) {
        throw new Error("No tenés una inmobiliaria activa asignada.");
    }

    return activeInmobiliariaId;
};

export const getParticularPublicationRequestsForInmobiliaria = async ({
    estado = "nuevo",
    pageSize = 100,
} = {}) => {
    const activeInmobiliariaId = await getCurrentUserActiveInmobiliariaId();

    const q = query(
        publicationRequestsRef,
        where("targetType", "==", "inmobiliaria"),
        where("targetInmobiliariaId", "==", activeInmobiliariaId),
        limit(pageSize),
    );

    const snap = await getDocs(q);

    return snap.docs
        .map((docSnap) => mapPublicationRequest(docSnap))
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
};

export const getParticularPublicationRequestById = async (requestId) => {
    if (!requestId) {
        throw new Error("ID de solicitud requerido.");
    }

    const requestRef = doc(db, COLLECTION_NAME, requestId);
    const requestSnap = await getDoc(requestRef);

    if (!requestSnap.exists()) {
        throw new Error("No se encontró la solicitud particular.");
    }

    return mapPublicationRequest(requestSnap);
};

export const reserveParticularPublicationRequestConversion = async (
    requestId,
) => {
    if (!requestId) {
        throw new Error("ID de solicitud requerido.");
    }

    const currentUser = auth.currentUser;

    if (!currentUser?.uid) {
        throw new Error("Usuario no autenticado.");
    }

    const requestRef = doc(db, COLLECTION_NAME, requestId);

    await runTransaction(db, async (transaction) => {
        const requestSnap = await transaction.get(requestRef);

        if (!requestSnap.exists()) {
            throw new Error("No se encontró la solicitud particular.");
        }

        const data = requestSnap.data();

        if (data.convertedInmuebleId) {
            throw new Error(
                "Esta solicitud ya fue convertida en inmueble. No se puede convertir nuevamente.",
            );
        }

        if (data.conversionLockStatus === "processing") {
            throw new Error(
                "Esta solicitud ya está siendo convertida por otro usuario.",
            );
        }

        if (data.estado === "descartado") {
            throw new Error("No se puede convertir una solicitud descartada.");
        }

        transaction.update(requestRef, {
            conversionLockStatus: "processing",
            conversionStartedAt: serverTimestamp(),
            conversionStartedBy: currentUser.uid,
            activityLog: appendActivityLog(
                createActivityLogEntry({
                    type: "conversion_started",
                    title: "Conversión iniciada",
                    message: "Se reservó la solicitud para convertirla en inmueble.",
                }),
            ),
            conversionError: "",
            updatedAt: serverTimestamp(),
        });
    });
};

export const releaseParticularPublicationRequestConversion = async (
    requestId,
    { reason = "" } = {},
) => {
    if (!requestId) return;

    const currentUser = auth.currentUser;

    if (!currentUser?.uid) {
        throw new Error("Usuario no autenticado.");
    }

    const requestRef = doc(db, COLLECTION_NAME, requestId);

    await updateDoc(requestRef, {
        conversionLockStatus: "failed",
        conversionError:
            normalizeText(reason).slice(0, 500) ||
            "La conversión no pudo completarse.",
        conversionFailedAt: serverTimestamp(),
        conversionFailedBy: currentUser.uid,
        updatedAt: serverTimestamp(),
        activityLog: appendActivityLog(
            createActivityLogEntry({
                type: "conversion_failed",
                title: "Conversión fallida",
                message:
                    normalizeText(reason).slice(0, 500) ||
                    "La conversión no pudo completarse.",
            }),
        ),
    });
};

export const markParticularPublicationRequestAsConverted = async (
    requestId,
    {
        inmuebleId = "",
        inmobiliariaId = "",
        titulo = "",
        slug = "",
        editPath = "",
        previewPath = "",
        publicPath = "",
        internalNote = "",
    } = {},
) => {
    if (!requestId) {
        throw new Error("ID de solicitud requerido.");
    }

    const currentUser = auth.currentUser;

    if (!currentUser?.uid) {
        throw new Error("Usuario no autenticado.");
    }

    const safeInmuebleId = normalizeText(inmuebleId);
    const safeInmobiliariaId = normalizeText(inmobiliariaId);
    const safeTitle = normalizeText(titulo);
    const safeSlug = normalizeText(slug);

    const convertedEditPath =
        editPath ||
        (safeInmuebleId && safeInmobiliariaId
            ? `/admin/inmuebles/${safeInmuebleId}/editar?inmobiliariaId=${encodeURIComponent(
                safeInmobiliariaId,
            )}&fromParticularRequest=1&particularRequestId=${encodeURIComponent(
                requestId,
            )}`
            : "");

    const convertedPreviewPath =
        previewPath ||
        (safeInmuebleId && safeInmobiliariaId
            ? `/admin/inmuebles/${safeInmuebleId}/preview?inmobiliariaId=${encodeURIComponent(
                safeInmobiliariaId,
            )}`
            : "");

    const convertedPublicPath =
        publicPath || (safeSlug ? `/inmueble/${safeSlug}` : "");

    const requestRef = doc(db, COLLECTION_NAME, requestId);

    await runTransaction(db, async (transaction) => {
        const requestSnap = await transaction.get(requestRef);

        if (!requestSnap.exists()) {
            throw new Error("No se encontró la solicitud particular.");
        }

        const currentData = requestSnap.data();

        if (
            currentData.convertedInmuebleId &&
            currentData.convertedInmuebleId !== safeInmuebleId
        ) {
            throw new Error(
                "Esta solicitud ya fue convertida en otro inmueble.",
            );
        }

        transaction.update(requestRef, {
            estado: "cerrado",
            convertedInmuebleId: safeInmuebleId,
            convertedInmobiliariaId: safeInmobiliariaId,
            convertedTitle: safeTitle,
            convertedSlug: safeSlug,
            convertedEditPath,
            convertedPreviewPath,
            convertedPublicPath,
            conversionLockStatus: "converted",
            activityLog: appendActivityLog(
                createActivityLogEntry({
                    type: "converted",
                    title: "Solicitud convertida",
                    message:
                        internalNote ||
                        `Solicitud convertida en inmueble${safeTitle ? `: ${safeTitle}` : ""}.`,
                    metadata: {
                        inmuebleId: safeInmuebleId,
                        inmobiliariaId: safeInmobiliariaId,
                        slug: safeSlug,
                    },
                }),
            ),
            conversionCompletedAt: serverTimestamp(),
            convertedAt: serverTimestamp(),
            convertedBy: currentUser.uid,
            reviewedAt: serverTimestamp(),
            reviewedBy: currentUser.uid,
            internalNote:
                internalNote ||
                `Solicitud convertida en inmueble${safeTitle ? `: ${safeTitle}` : ""
                }.`,
            updatedAt: serverTimestamp(),
        });
    });
};

export const updateConvertedPublicationVisibility = async (
    requestId,
    {
        inmuebleId = "",
        inmobiliariaId = "",
        titulo = "",
        publicPath = "",
        visible = false,
    } = {},
) => {
    if (!requestId) {
        return;
    }

    const currentUser = auth.currentUser;

    if (!currentUser?.uid) {
        throw new Error("Usuario no autenticado.");
    }

    const safeInmuebleId = normalizeText(inmuebleId);
    const safeInmobiliariaId = normalizeText(inmobiliariaId);
    const safeTitle = normalizeText(titulo);
    const safePublicPath = normalizeText(publicPath);

    const requestRef = doc(db, COLLECTION_NAME, requestId);

    await updateDoc(requestRef, {
        convertedInmuebleId: safeInmuebleId,
        convertedInmobiliariaId: safeInmobiliariaId,
        convertedTitle: safeTitle,
        convertedPublicPath: safePublicPath,
        convertedPublicVisible: Boolean(visible),
        convertedPublicStatus: visible ? "published" : "draft",
        convertedPublishedAt: visible ? serverTimestamp() : null,
        activityLog: appendActivityLog(
            createActivityLogEntry({
                type: visible ? "publication_visible" : "publication_hidden",
                title: visible
                    ? "Publicación visible"
                    : "Publicación en revisión",
                message: visible
                    ? "La publicación quedó visible para el particular y el portal público."
                    : "La publicación quedó como borrador o en revisión.",
                metadata: {
                    inmuebleId: safeInmuebleId,
                    inmobiliariaId: safeInmobiliariaId,
                    publicPath: safePublicPath,
                },
            }),
        ),
        convertedVisibilityUpdatedAt: serverTimestamp(),
        convertedVisibilityUpdatedBy: currentUser.uid,
        updatedAt: serverTimestamp(),
    });
};

export const addParticularPublicationRequestInternalNote = async (
    requestId,
    { internalNote = "" } = {},
) => {
    if (!requestId) {
        throw new Error("ID de solicitud requerido.");
    }

    const cleanNote = normalizeText(internalNote);

    if (!cleanNote) {
        throw new Error("Escribí una nota antes de guardarla.");
    }

    const currentUser = auth.currentUser;

    if (!currentUser?.uid) {
        throw new Error("Usuario no autenticado.");
    }

    const requestRef = doc(db, COLLECTION_NAME, requestId);

    await updateDoc(requestRef, {
        internalNote: cleanNote,
        reviewedAt: serverTimestamp(),
        reviewedBy: currentUser.uid,
        updatedAt: serverTimestamp(),
        activityLog: appendActivityLog(
            createActivityLogEntry({
                type: "note",
                title: "Nota interna",
                message: cleanNote,
            }),
        ),
    });
};