import {
  createInmueble,
  getInmueblesByInmobiliaria,
  updateInmueble,
} from "../../inmueble/services/inmueble.service";
import {
  applyUnitRowToInmueble,
  buildUnitInmueblePayload,
  validateUnitRows,
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

export const importEmprendimientoUnits = async ({
  inmobiliariaId,
  emprendimiento,
  existingUnits = [],
  importRows = [],
}) => {
  const rows = importRows.map((item) => item.row);
  const validationErrors = validateUnitRows(rows);

  if (Object.keys(validationErrors).length > 0) {
    throw new Error("La importación contiene unidades inválidas o repetidas.");
  }

  const existingById = new Map(existingUnits.map((unit) => [unit.id, unit]));
  const results = [];

  for (const item of importRows) {
    try {
      if (!["create", "update"].includes(item.action)) {
        throw new Error("La acción de importación no es válida");
      }

      if (item.action === "update") {
        const inmueble = existingById.get(item.existingId);
        if (!inmueble || inmueble.emprendimientoId !== emprendimiento?.id) {
          throw new Error("La unidad existente ya no pertenece al emprendimiento");
        }

        await updateInmueble(
          inmobiliariaId,
          inmueble.id,
          applyUnitRowToInmueble({
            inmueble,
            row: item.row,
            emprendimiento,
          }),
        );
        results.push({
          lineNumber: item.lineNumber,
          codigo: item.row.codigo,
          action: "update",
          status: "success",
          inmuebleId: inmueble.id,
        });
      } else {
        const payload = buildUnitInmueblePayload({
          row: item.row,
          emprendimiento,
          inmobiliariaId,
        });
        const created = await createInmueble(inmobiliariaId, payload);
        results.push({
          lineNumber: item.lineNumber,
          codigo: item.row.codigo,
          action: "create",
          status: "success",
          inmuebleId: created.id,
        });
      }
    } catch (error) {
      results.push({
        lineNumber: item.lineNumber,
        codigo: item.row.codigo,
        action: item.action,
        status: "failed",
        error: error.message || "No se pudo guardar la unidad",
      });
    }
  }

  return {
    created: results.filter(
      (item) => item.status === "success" && item.action === "create",
    ).length,
    updated: results.filter(
      (item) => item.status === "success" && item.action === "update",
    ).length,
    failed: results.filter((item) => item.status === "failed").length,
    results,
  };
};
