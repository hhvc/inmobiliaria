import { ref, uploadBytes } from "firebase/storage";

import { auth, storage } from "../../firebase/config";

const sanitizeFilename = (filename = "") => {
    return filename
        .toString()
        .trim()
        .replace(/\s+/g, "-")
        .replace(/[^\w.-]/g, "")
        .toLowerCase();
};

export async function uploadInmobiliariaVerificationFile({
    inmobiliariaId,
    documentKey,
    file,
}) {
    const currentUser = auth.currentUser;

    if (!currentUser?.uid) {
        throw new Error("Usuario no autenticado");
    }

    if (!inmobiliariaId) {
        throw new Error("ID de inmobiliaria requerido");
    }

    if (!documentKey) {
        throw new Error("Tipo de documento requerido");
    }

    if (!file) {
        throw new Error("Archivo requerido");
    }

    const safeFilename = sanitizeFilename(file.name || "documento");
    const timestamp = Date.now();

    const path = `inmobiliarias/${inmobiliariaId}/verificacion/${currentUser.uid}/${documentKey}-${timestamp}-${safeFilename}`;

    const storageRef = ref(storage, path);

    await uploadBytes(storageRef, file, {
        contentType: file.type || "application/octet-stream",
        customMetadata: {
            inmobiliariaId,
            documentKey,
            uploadedBy: currentUser.uid,
        },
    });

    return {
        path,
        filename: file.name || safeFilename,
        contentType: file.type || "",
        size: file.size || 0,
        uploadedAt: new Date().toISOString(),
        uploadedBy: currentUser.uid,
    };
}