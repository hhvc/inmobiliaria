import {
  createInmueble,
  getInmueblesByInmobiliaria,
  updateInmueble,
} from "../../inmueble/services/inmueble.service";
import {
  applyUnitRowToInmueble,
  buildUnitInmueblePayload,
} from "../utils/emprendimientoUnits.helpers";

export const getAllInmueblesForUnitMatrix = async (inmobiliariaId) => {
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

export const linkInmueblesToEmprendimiento = async ({
  inmobiliariaId,
  emprendimiento,
  inmuebles,
}) => {
  for (const inmueble of inmuebles) {
    await updateInmueble(inmobiliariaId, inmueble.id, {
      ...inmueble,
      emprendimientoId: emprendimiento.id,
      emprendimientoNombre: emprendimiento.nombre || "",
      emprendimientoSlug: emprendimiento.slug || "",
      unidadEmprendimiento: {
        codigo: inmueble.unidadEmprendimiento?.codigo || "",
        tipologia: inmueble.unidadEmprendimiento?.tipologia || "",
        piso:
          inmueble.unidadEmprendimiento?.piso ||
          inmueble.caracteristicas?.piso ||
          "",
        disponibilidad:
          inmueble.unidadEmprendimiento?.disponibilidad || "disponible",
      },
    });
  }
};

export const unlinkInmuebleFromEmprendimiento = async ({
  inmobiliariaId,
  inmueble,
}) => {
  await updateInmueble(inmobiliariaId, inmueble.id, {
    ...inmueble,
    emprendimientoId: "",
    emprendimientoNombre: "",
    emprendimientoSlug: "",
    unidadEmprendimiento: {
      codigo: "",
      tipologia: "",
      piso: "",
      disponibilidad: "disponible",
    },
  });
};

export const updateEmprendimientoUnits = async ({
  inmobiliariaId,
  emprendimiento,
  units,
  rowsById,
}) => {
  for (const inmueble of units) {
    const row = rowsById[inmueble.id];
    if (!row) continue;

    await updateInmueble(
      inmobiliariaId,
      inmueble.id,
      applyUnitRowToInmueble({ inmueble, row, emprendimiento }),
    );
  }
};

export const createEmprendimientoUnits = async ({
  inmobiliariaId,
  emprendimiento,
  rows,
}) => {
  const created = [];

  for (const row of rows) {
    const payload = buildUnitInmueblePayload({
      row,
      emprendimiento,
      inmobiliariaId,
    });
    created.push(await createInmueble(inmobiliariaId, payload));
  }

  return created;
};

