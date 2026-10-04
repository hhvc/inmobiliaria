import assert from "node:assert/strict";
import test from "node:test";

import {mergeAiDraftIntoParticularPublication} from "../src/particular/utils/particularPublicationAi.helpers.js";

test("applies only fields supported by the particular publication form", () => {
  const result = mergeAiDraftIntoParticularPublication({
    values: {
      nombre: "Ana",
      telefono: "3510000000",
      email: "ana@example.com",
      operacion: "",
      tipo: "",
      ubicacion: "",
      descripcion: "",
      precioEstimado: "",
      targetType: "onoprop",
    },
    draft: {
      titulo: "Casa en venta",
      operacion: "venta",
      tipo: "casa",
      precio: "85000",
      moneda: "USD",
      descripcion: "Casa de tres dormitorios con patio.",
      direccion: {
        calle: "Siempreviva",
        numero: "742",
        barrio: "Argüello",
        ciudad: "Córdoba",
        provincia: "Córdoba",
      },
    },
    detectedFields: [
      "titulo",
      "operacion",
      "tipo",
      "precio",
      "moneda",
      "descripcion",
      "direccion.calle",
      "direccion.numero",
      "direccion.barrio",
      "direccion.ciudad",
      "direccion.provincia",
    ],
  });

  assert.equal(result.values.operacion, "venta");
  assert.equal(result.values.tipo, "casa");
  assert.equal(result.values.precioEstimado, "USD 85.000");
  assert.equal(result.values.ubicacion, "Argüello, Córdoba");
  assert.equal(result.values.descripcion, "Casa de tres dormitorios con patio.");
  assert.equal(result.values.nombre, "Ana");
  assert.equal(result.values.telefono, "3510000000");
  assert.equal(result.values.email, "ana@example.com");
  assert.equal(result.values.targetType, "onoprop");
  assert.equal(result.values.titulo, undefined);
  assert.equal(result.appliedCount, 5);
});

test("preserves information the particular already entered", () => {
  const result = mergeAiDraftIntoParticularPublication({
    values: {
      operacion: "alquiler",
      descripcion: "Descripción manual suficientemente completa.",
    },
    draft: {
      operacion: "venta",
      descripcion: "Descripción sugerida.",
    },
    detectedFields: ["operacion", "descripcion"],
    preserveExisting: true,
  });

  assert.equal(result.values.operacion, "alquiler");
  assert.equal(
    result.values.descripcion,
    "Descripción manual suficientemente completa.",
  );
  assert.equal(result.appliedCount, 0);
  assert.equal(result.preservedCount, 2);
});

test("maps types not present in the simple form to other", () => {
  const result = mergeAiDraftIntoParticularPublication({
    values: {tipo: ""},
    draft: {tipo: "quinta"},
    detectedFields: ["tipo"],
  });

  assert.equal(result.values.tipo, "otro");
  assert.equal(result.appliedCount, 1);
});

test("does not copy the exact street into the approximate location", () => {
  const result = mergeAiDraftIntoParticularPublication({
    values: {ubicacion: ""},
    draft: {
      direccion: {
        calle: "Caseros",
        numero: "805",
        ciudad: "Córdoba",
      },
    },
    detectedFields: [
      "direccion.calle",
      "direccion.numero",
      "direccion.ciudad",
    ],
  });

  assert.equal(result.values.ubicacion, "Córdoba");
  assert.equal(result.values.ubicacion.includes("Caseros"), false);
  assert.equal(result.values.ubicacion.includes("805"), false);
});

