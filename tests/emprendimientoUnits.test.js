import assert from "node:assert/strict";
import test from "node:test";

import {
  applyUnitRowToInmueble,
  buildUnitInmueblePayload,
  duplicateUnitRow,
  normalizeUnitRow,
  validateUnitRows,
} from "../src/emprendimiento/utils/emprendimientoUnits.helpers.js";

const EMPRENDIMIENTO = {
  id: "emp-1",
  nombre: "Altos del Centro",
  slug: "altos-del-centro-emp-1",
  direccion: { ciudad: "Córdoba", provincia: "Córdoba" },
};

test("normaliza importes y superficies con coma decimal", () => {
  const row = normalizeUnitRow({ precio: "120000,50", superficie: "68,5" });
  assert.equal(row.precio, 120000.5);
  assert.equal(row.superficie, 68.5);
});

test("detecta códigos obligatorios y repetidos", () => {
  const errors = validateUnitRows([
    { codigo: "1A", tipo: "departamento", operacion: "venta" },
    { codigo: "1a", tipo: "departamento", operacion: "venta" },
    { codigo: "", tipo: "departamento", operacion: "venta" },
  ]);

  assert.equal(errors[0].codigo, "Código repetido");
  assert.equal(errors[1].codigo, "Código repetido");
  assert.equal(errors[2].codigo, "Código obligatorio");
});

test("crea un inmueble borrador vinculado al emprendimiento", () => {
  const payload = buildUnitInmueblePayload({
    row: {
      codigo: "2B",
      tipo: "departamento",
      operacion: "venta",
      precio: "95000",
      dormitorios: "2",
      superficie: "72",
    },
    emprendimiento: EMPRENDIMIENTO,
    inmobiliariaId: "inmo-1",
  });

  assert.equal(payload.emprendimientoId, "emp-1");
  assert.equal(payload.unidadEmprendimiento.codigo, "2B");
  assert.equal(payload.precio, 95000);
  assert.equal(payload.publicarEnPortal, false);
  assert.equal(payload.direccion.ciudad, "Córdoba");
});

test("aplica cambios de matriz sin eliminar otros datos del inmueble", () => {
  const updated = applyUnitRowToInmueble({
    inmueble: {
      id: "unit-1",
      titulo: "Unidad existente",
      images: [{ url: "https://example.com/image.jpg" }],
      superficie: { cubierta: 60 },
      caracteristicas: { banos: 1 },
    },
    row: {
      codigo: "PB-A",
      tipo: "local",
      operacion: "venta",
      superficie: 80,
      precio: 150000,
    },
    emprendimiento: EMPRENDIMIENTO,
  });

  assert.equal(updated.titulo, "Unidad existente");
  assert.equal(updated.images.length, 1);
  assert.equal(updated.superficie.cubierta, 60);
  assert.equal(updated.superficie.total, 80);
  assert.equal(updated.caracteristicas.banos, 1);
  assert.equal(updated.unidadEmprendimiento.codigo, "PB-A");
});

test("duplica una unidad como fila nueva y marca el código para revisión", () => {
  const duplicate = duplicateUnitRow(
    {
      rowId: "unit-1",
      codigo: "3C",
      tipo: "departamento",
      tipologia: "2 dormitorios",
      precio: "110000",
    },
    "draft-2",
  );

  assert.equal(duplicate.rowId, "draft-2");
  assert.equal(duplicate.codigo, "3C copia");
  assert.equal(duplicate.tipologia, "2 dormitorios");
  assert.equal(duplicate.precio, 110000);
});
