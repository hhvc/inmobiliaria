import {
  createInmueble,
  getInmuebleById,
  getInmueblesByInmobiliaria,
  updateInmueble,
} from "../../inmueble/services/inmueble.service";
import {
  buildInmuebleDraftFromTasacion,
  linkTasacionToDraft,
} from "../utils/tasacionInmueble.helpers";

export const getAllInmueblesForTasacion = async (inmobiliariaId) => {
  if (!inmobiliariaId) return [];

  const items = [];
  let cursor = null;
  let pages = 0;

  do {
    const result = await getInmueblesByInmobiliaria(inmobiliariaId, {
      pageSize: 200,
      lastDoc: cursor,
    });

    items.push(...(result?.data || []));
    cursor = result?.lastDoc || null;
    pages += 1;
  } while (cursor && pages < 20);

  return items;
};

export const getInmuebleForTasacion = (inmobiliariaId, inmuebleId) =>
  getInmuebleById(inmobiliariaId, inmuebleId);

const isEditableTasacionDraft = (inmueble, tasacionId) =>
  inmueble?.sourceType === "tasacion" &&
  inmueble?.sourceTasacionId === tasacionId &&
  inmueble?.managedFromTasacion === true &&
  inmueble?.estado === "inactivo" &&
  inmueble?.publicarEnPortal !== true;

export const ensureTasacionDraftInmueble = async ({
  inmobiliariaId,
  tasacionId,
  tasacion,
  knownInmuebles = [],
}) => {
  if (tasacion?.propertyLink?.mode !== "new") {
    return { tasacion, inmueble: null, created: false, synced: false };
  }

  let inmuebleId = tasacion.propertyLink?.inmuebleId || "";
  if (!inmuebleId) {
    inmuebleId =
      knownInmuebles.find(
        (item) =>
          item.sourceType === "tasacion" &&
          item.sourceTasacionId === tasacionId &&
          item.deleted !== true,
      )?.id || "";
  }

  // Revalidar antes de crear evita duplicados si el inmueble llegó a guardarse
  // pero falló la actualización posterior de la tasación o intervino otra sesión.
  if (!inmuebleId) {
    const refreshedInmuebles = await getAllInmueblesForTasacion(inmobiliariaId);
    inmuebleId =
      refreshedInmuebles.find(
        (item) =>
          item.sourceType === "tasacion" &&
          item.sourceTasacionId === tasacionId &&
          item.deleted !== true,
      )?.id || "";
  }

  let inmueble = inmuebleId
    ? await getInmuebleById(inmobiliariaId, inmuebleId)
    : null;
  const draftPayload = buildInmuebleDraftFromTasacion(tasacion, { tasacionId });

  if (!inmueble) {
    const created = await createInmueble(inmobiliariaId, draftPayload);
    inmueble = { ...draftPayload, ...created };
    return {
      tasacion: linkTasacionToDraft(tasacion, inmueble),
      inmueble,
      created: true,
      synced: false,
    };
  }

  const linkedTasacion = linkTasacionToDraft(tasacion, inmueble);
  if (
    tasacion.propertyLink?.syncDraft !== false &&
    isEditableTasacionDraft(inmueble, tasacionId)
  ) {
    const synchronized = {
      ...inmueble,
      ...draftPayload,
      slug: inmueble.slug,
      images: Array.isArray(inmueble.images) ? inmueble.images : [],
      videos: Array.isArray(inmueble.videos) ? inmueble.videos : [],
      sharing: inmueble.sharing || draftPayload.sharing,
      sharedWith: inmueble.sharedWith || {},
      estado: "inactivo",
      destacado: false,
      publicarEnPortal: false,
      noIndex: true,
    };
    await updateInmueble(inmobiliariaId, inmueble.id, synchronized);
    inmueble = synchronized;
    return {
      tasacion: linkedTasacion,
      inmueble,
      created: false,
      synced: true,
    };
  }

  return {
    tasacion: {
      ...linkedTasacion,
      propertyLink: {
        ...linkedTasacion.propertyLink,
        syncDraft: false,
      },
    },
    inmueble,
    created: false,
    synced: false,
  };
};
