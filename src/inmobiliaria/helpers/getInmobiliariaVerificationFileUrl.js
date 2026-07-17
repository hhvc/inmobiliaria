import { getDownloadURL, ref } from "firebase/storage";

import { storage } from "../../firebase/config";

export async function getInmobiliariaVerificationFileUrl(path) {
    if (!path) {
        throw new Error("Ruta de archivo requerida");
    }

    const fileRef = ref(storage, path);

    return getDownloadURL(fileRef);
}