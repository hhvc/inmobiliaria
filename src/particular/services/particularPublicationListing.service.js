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
    updateDoc,
    where,
} from "firebase/firestore";

import { auth, db } from "../../firebase/config";
import { normalizeInmuebleVideos } from "../../inmueble/utils/inmuebleVideos.helpers";

const REQUESTS_COLLECTION = "particular_publication_requests";
const PUBLICATIONS_COLLECTION = "particular_publications";

const particularPublicationsRef = collection(db, PUBLICATIONS_COLLECTION);

const PUBLIC_STATUSES = ["active", "paused", "deleted", "sold", "rented"];

const normalizeText = (value = "") => value.toString().trim();

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

const toFiniteNumber = (value, fallback = 0) => {
    const number = Number(value);

    return Number.isFinite(number) ? number : fallback;
};

const createLogId = () => {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
        return crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const createActivityLogEntry = ({
    type = "note",
    title = "",
    message = "",
    metadata = {},
} = {}) => {
    const currentUser = auth.currentUser;

    return {
        id: createLogId(),
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

const normalizeImages = (images = []) => {
    if (!Array.isArray(images)) return [];

    return images
        .map((image, index) => {
            const order = toFiniteNumber(image?.order, index);

            return {
                id: image?.id || `${index}`,
                url: image?.url || "",
                storagePath: image?.storagePath || "",

                thumbnailUrl: image?.thumbnailUrl || "",
                thumbnailPath: image?.thumbnailPath || "",

                order,

                name: image?.name || image?.filename || "",
                filename: image?.filename || image?.name || "",

                size: toFiniteNumber(image?.size, 0),
                type: image?.type || "",
                contentType: image?.contentType || image?.type || "",

                width: toFiniteNumber(image?.width, 0),
                height: toFiniteNumber(image?.height, 0),
                thumbnailWidth: toFiniteNumber(image?.thumbnailWidth, 0),
                thumbnailHeight: toFiniteNumber(image?.thumbnailHeight, 0),

                portalReady: image?.portalReady === true,
                qualityWarnings: Array.isArray(image?.qualityWarnings)
                    ? image.qualityWarnings
                    : [],

                source:
                    image?.source && typeof image.source === "object"
                        ? image.source
                        : null,

                copiedFrom: image?.copiedFrom || "",
                createdAt: image?.createdAt || "",
            };
        })
        .filter((image) => image.url || image.storagePath)
        .sort((a, b) => a.order - b.order)
        .map((image, index) => ({
            ...image,
            order: index,
        }));
};

const buildPublicationTitle = (requestData = {}) => {
    const operationLabel = {
        venta: "Venta",
        alquiler: "Alquiler",
        alquiler_temporal: "Alquiler temporal",
        tasacion: "Tasación",
    };

    const typeLabel = {
        casa: "casa",
        departamento: "departamento",
        terreno: "terreno",
        local: "local",
        oficina: "oficina",
        cochera: "cochera",
        campo: "campo",
        otro: "inmueble",
    };

    const operation =
        operationLabel[requestData.operacion] || normalizeText(requestData.operacion);
    const type = typeLabel[requestData.tipo] || normalizeText(requestData.tipo);
    const location = normalizeText(requestData.ubicacion);

    return [operation, type, location ? `en ${location}` : ""]
        .filter(Boolean)
        .join(" ");
};

const buildPublicPath = (publicationId) => {
    return `/particulares/${publicationId}`;
};

const mapParticularPublication = (docSnap) => {
    if (!docSnap?.exists?.()) return null;

    const data = docSnap.data();

    return {
        id: docSnap.id,
        ...data,
        images: normalizeImages(data.images),
        videos: normalizeInmuebleVideos(data.videos || []),
        createdAt: normalizeTimestamp(data.createdAt),
        updatedAt: normalizeTimestamp(data.updatedAt),
        approvedAt: normalizeTimestamp(data.approvedAt),
        statusUpdatedAt: normalizeTimestamp(data.statusUpdatedAt),
        pausedAt: normalizeTimestamp(data.pausedAt),
        deletedAt: normalizeTimestamp(data.deletedAt),
        soldAt: normalizeTimestamp(data.soldAt),
        rentedAt: normalizeTimestamp(data.rentedAt),
    };
};

export const approvePublicationRequestAsParticular = async (
    requestId,
    { internalNote = "" } = {},
) => {
    if (!requestId) {
        throw new Error("ID de solicitud requerido.");
    }

    const currentUser = auth.currentUser;

    if (!currentUser?.uid) {
        throw new Error("Usuario no autenticado.");
    }

    const requestRef = doc(db, REQUESTS_COLLECTION, requestId);
    const publicationRef = doc(particularPublicationsRef);
    const publicationPath = buildPublicPath(publicationRef.id);

    await runTransaction(db, async (transaction) => {
        const requestSnap = await transaction.get(requestRef);

        if (!requestSnap.exists()) {
            throw new Error("No se encontró la solicitud particular.");
        }

        const requestData = requestSnap.data();

        if (requestData.targetType !== "onoprop") {
            throw new Error(
                "Solo las solicitudes destinadas a ONO Prop pueden aprobarse como publicación particular.",
            );
        }

        if (requestData.particularPublicationId) {
            throw new Error("Esta solicitud ya fue aprobada como publicación particular.");
        }

        if (requestData.convertedInmuebleId) {
            throw new Error("Esta solicitud ya fue convertida en inmueble de inmobiliaria.");
        }

        if (requestData.conversionLockStatus === "processing") {
            throw new Error("Esta solicitud está en proceso de conversión.");
        }

        if (requestData.estado === "descartado") {
            throw new Error("No se puede aprobar una solicitud descartada.");
        }

        const titulo = buildPublicationTitle(requestData);
        const images = normalizeImages(requestData.images);
        const videos = normalizeInmuebleVideos(requestData.videos || []);

        const cleanNote =
            normalizeText(internalNote) ||
            `Solicitud aprobada como publicación particular: ${titulo}.`;

        transaction.set(publicationRef, {
            ownerUserId: requestData.requesterUserId || "",
            ownerEmail: requestData.requesterEmail || "",
            ownerDisplayName: requestData.requesterDisplayName || "",

            sourceRequestId: requestId,
            publicationType: "particular",

            titulo,
            operacion: requestData.operacion || "",
            tipo: requestData.tipo || "",
            ubicacion: requestData.ubicacion || "",
            descripcion: requestData.descripcion || "",
            precioEstimado: requestData.precioEstimado || "",

            images,
            videos,

            contact: {
                nombre: requestData.nombre || "",
                telefono: requestData.telefono || "",
                email: requestData.email || "",
            },

            publicStatus: "active",
            moderationStatus: "approved",
            moderationNote: cleanNote,
            pendingChanges: null,

            sourceTargetType: requestData.targetType || "onoprop",
            sourceValidationOwner: requestData.validationOwner || "onoprop",

            noIndex: false,

            activityLog: [
                createActivityLogEntry({
                    type: "approved",
                    title: "Publicación aprobada",
                    message: cleanNote,
                    metadata: {
                        sourceRequestId: requestId,
                        publicationId: publicationRef.id,
                        publicationPath,
                        imagesCount: images.length,
                        videosCount: videos.length,
                    },
                }),
            ],

            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            approvedAt: serverTimestamp(),
            approvedBy: currentUser.uid,
            statusUpdatedAt: serverTimestamp(),
            statusUpdatedBy: currentUser.uid,
        });

        transaction.update(requestRef, {
            estado: "cerrado",
            approvalMode: "particular_publication",
            particularPublicationId: publicationRef.id,
            particularPublicationPath: publicationPath,
            particularPublicationStatus: "active",
            particularPublicationApprovedAt: serverTimestamp(),
            particularPublicationApprovedBy: currentUser.uid,
            reviewedAt: serverTimestamp(),
            reviewedBy: currentUser.uid,
            internalNote: cleanNote,
            updatedAt: serverTimestamp(),
            activityLog: arrayUnion(
                createActivityLogEntry({
                    type: "particular_publication_approved",
                    title: "Publicación particular aprobada",
                    message: cleanNote,
                    metadata: {
                        publicationId: publicationRef.id,
                        publicationPath,
                        imagesCount: images.length,
                        videosCount: videos.length,
                    },
                }),
            ),
        });
    });

    return {
        id: publicationRef.id,
        path: publicationPath,
    };
};

export const getMyParticularPublications = async ({ pageSize = 50 } = {}) => {
    const currentUser = auth.currentUser;

    if (!currentUser?.uid) {
        throw new Error("Tenés que iniciar sesión para ver tus publicaciones.");
    }

    const q = query(
        particularPublicationsRef,
        where("ownerUserId", "==", currentUser.uid),
        limit(pageSize),
    );

    const snap = await getDocs(q);

    return snap.docs
        .map((docSnap) => mapParticularPublication(docSnap))
        .filter(Boolean)
        .sort((a, b) => {
            const dateA = a.createdAt instanceof Date ? a.createdAt.getTime() : 0;
            const dateB = b.createdAt instanceof Date ? b.createdAt.getTime() : 0;

            return dateB - dateA;
        });
};

export const getActiveParticularPublications = async ({ pageSize = 100 } = {}) => {
    const q = query(
        particularPublicationsRef,
        where("publicationType", "==", "particular"),
        where("publicStatus", "==", "active"),
        where("moderationStatus", "==", "approved"),
        orderBy("createdAt", "desc"),
        limit(pageSize),
    );

    const snap = await getDocs(q);

    return snap.docs
        .map((docSnap) => mapParticularPublication(docSnap))
        .filter(Boolean);
};

export const updateParticularPublicationPublicStatus = async (
    publicationId,
    publicStatus,
) => {
    if (!publicationId) {
        throw new Error("ID de publicación requerido.");
    }

    if (!PUBLIC_STATUSES.includes(publicStatus)) {
        throw new Error("Estado público inválido.");
    }

    const currentUser = auth.currentUser;

    if (!currentUser?.uid) {
        throw new Error("Usuario no autenticado.");
    }

    const publicationRef = doc(db, PUBLICATIONS_COLLECTION, publicationId);

    const statusDateFields = {
        paused: {
            pausedAt: serverTimestamp(),
            pausedBy: currentUser.uid,
        },
        deleted: {
            deletedAt: serverTimestamp(),
            deletedBy: currentUser.uid,
        },
        sold: {
            soldAt: serverTimestamp(),
            soldBy: currentUser.uid,
        },
        rented: {
            rentedAt: serverTimestamp(),
            rentedBy: currentUser.uid,
        },
    };

    await updateDoc(publicationRef, {
        publicStatus,
        ...(statusDateFields[publicStatus] || {}),
        statusUpdatedAt: serverTimestamp(),
        statusUpdatedBy: currentUser.uid,
        updatedAt: serverTimestamp(),
        activityLog: arrayUnion(
            createActivityLogEntry({
                type: "public_status_updated",
                title: "Estado público actualizado",
                message: `La publicación pasó a estado: ${publicStatus}.`,
                metadata: {
                    publicStatus,
                },
            }),
        ),
    });
};

export const getParticularPublicationById = async (publicationId) => {
    if (!publicationId) {
        throw new Error("ID de publicación requerido.");
    }

    const publicationRef = doc(db, PUBLICATIONS_COLLECTION, publicationId);
    const publicationSnap = await getDoc(publicationRef);

    if (!publicationSnap.exists()) {
        throw new Error("No se encontró la publicación particular.");
    }

    return mapParticularPublication(publicationSnap);
};