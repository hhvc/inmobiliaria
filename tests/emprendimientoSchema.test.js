import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeEmprendimiento,
  normalizeStringList,
  validateEmprendimiento,
} from "../src/emprendimiento/utils/emprendimientoSchema.js";

test("normaliza listas separadas por líneas y elimina duplicados", () => {
  assert.deepEqual(normalizeStringList("Piscina\nSUM\nPiscina, Seguridad"), [
    "Piscina",
    "SUM",
    "Seguridad",
  ]);
});

test("limita el avance de obra al rango de 0 a 100", () => {
  assert.equal(normalizeEmprendimiento({ avanceObra: 140 }).avanceObra, 100);
  assert.equal(normalizeEmprendimiento({ avanceObra: -5 }).avanceObra, 0);
});

test("valida los campos mínimos del emprendimiento", () => {
  const errors = validateEmprendimiento({
    inmobiliariaId: "inmo-1",
    nombre: "Altos del Centro",
    descripcion: "Proyecto residencial con unidades y espacios comunes.",
    tipo: "edificio",
    estadoObra: "en_construccion",
    estado: "activo",
    direccion: { ciudad: "Córdoba" },
  });

  assert.deepEqual(errors, {});
});

test("rechaza un emprendimiento incompleto", () => {
  const errors = validateEmprendimiento({ nombre: "A" });

  assert.ok(errors.inmobiliariaId);
  assert.ok(errors.nombre);
  assert.ok(errors.descripcion);
  assert.ok(errors.ciudad);
});

