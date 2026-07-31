import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDuplicateInmuebleTitle,
  buildInmuebleDuplicateValues,
} from "../src/inmueble/utils/inmuebleDuplicate.helpers.js";

test("marca claramente el título de una copia", () => {
  assert.equal(
    buildDuplicateInmuebleTitle("Casa con jardín"),
    "Casa con jardín (copia)",
  );
});

test("precarga el contenido sin copiar identidad ni visibilidad", () => {
  const duplicate = buildInmuebleDuplicateValues({
    source: {
      id: "inmueble-original",
      titulo: "Departamento 2B",
      descripcion: "Descripción original",
      tipo: "departamento",
      operacion: "venta",
      precio: 120000,
      publicarEnPortal: true,
      destacado: true,
      images: [{ url: "https://example.com/original.jpg" }],
      videos: [{ url: "https://example.com/video" }],
      emprendimientoId: "emp-1",
      unidadEmprendimiento: { codigo: "2B", piso: "2" },
      sharing: { enabled: true, mode: "all_colleagues" },
      networkData: { ownerName: "Propietario" },
    },
    inmobiliariaId: "inmo-1",
  });

  assert.equal(duplicate.titulo, "Departamento 2B (copia)");
  assert.equal(duplicate.descripcion, "Descripción original");
  assert.equal(duplicate.inmobiliariaId, "inmo-1");
  assert.equal(duplicate.publicarEnPortal, false);
  assert.equal(duplicate.destacado, false);
  assert.equal(duplicate.noIndex, true);
  assert.equal(duplicate.images.length, 0);
  assert.equal(duplicate.videos.length, 1);
  assert.equal(duplicate.emprendimientoId, "emp-1");
  assert.equal(duplicate.unidadEmprendimiento.codigo, "2B copia");
  assert.equal(duplicate.sharing.enabled, false);
  assert.equal(duplicate.networkData.ownerName, "Propietario");
  assert.equal(duplicate.sourceType, "duplicate");
  assert.equal(duplicate.duplicatedFromInmuebleId, "inmueble-original");
  assert.equal("id" in duplicate, false);
  assert.equal("slug" in duplicate, false);
});
