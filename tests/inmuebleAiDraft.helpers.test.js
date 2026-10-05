import assert from "node:assert/strict";
import test from "node:test";

import {
  getDefaultSelectedAiDraftFieldPaths,
  getAiDraftFieldLabel,
  mergeAiDraftIntoInmuebleValues,
} from "../src/inmueble/utils/inmuebleAiDraft.helpers.js";

test("applies only detected fields and keeps unrelated form data", () => {
  const result = mergeAiDraftIntoInmuebleValues({
    values: {
      titulo: "",
      descripcion: "",
      moneda: "USD",
      direccion: {provincia: "Córdoba", pais: "Argentina"},
      caracteristicas: {dormitorios: ""},
      sharing: {enabled: true},
    },
    draft: {
      titulo: "Casa en venta en Rosario",
      moneda: "ARS",
      direccion: {provincia: "Santa Fe", pais: "Argentina"},
      caracteristicas: {dormitorios: "3"},
    },
    detectedFields: [
      "titulo",
      "moneda",
      "direccion.provincia",
      "caracteristicas.dormitorios",
    ],
    preserveExisting: true,
  });

  assert.equal(result.values.titulo, "Casa en venta en Rosario");
  assert.equal(result.values.moneda, "ARS");
  assert.equal(result.values.direccion.provincia, "Santa Fe");
  assert.equal(result.values.caracteristicas.dormitorios, "3");
  assert.deepEqual(result.values.sharing, {enabled: true});
  assert.equal(result.appliedCount, 4);
});

test("preserves values manually entered by the user", () => {
  const result = mergeAiDraftIntoInmuebleValues({
    values: {
      titulo: "Mi título manual",
      caracteristicas: {dormitorios: "2"},
    },
    draft: {
      titulo: "Título sugerido",
      caracteristicas: {dormitorios: "3"},
    },
    detectedFields: ["titulo", "caracteristicas.dormitorios"],
    preserveExisting: true,
  });

  assert.equal(result.values.titulo, "Mi título manual");
  assert.equal(result.values.caracteristicas.dormitorios, "2");
  assert.equal(result.appliedCount, 0);
  assert.equal(result.preservedCount, 2);
});

test("marks the garage checkbox when a garage count is applied", () => {
  const result = mergeAiDraftIntoInmuebleValues({
    values: {caracteristicas: {cocheras: false, cocherasCantidad: ""}},
    draft: {caracteristicas: {cocherasCantidad: "2"}},
    detectedFields: ["caracteristicas.cocherasCantidad"],
  });

  assert.equal(result.values.caracteristicas.cocherasCantidad, "2");
  assert.equal(result.values.caracteristicas.cocheras, true);
});

test("returns readable field labels", () => {
  assert.equal(
    getAiDraftFieldLabel("caracteristicas.dormitorios"),
    "Características: Dormitorios",
  );
});

test("leaves low-confidence fields unselected by default", () => {
  const selected = getDefaultSelectedAiDraftFieldPaths({
    detectedFields: ["titulo", "precio", "direccion.barrio"],
    fieldAssessments: [
      {path: "titulo", confidence: "medium"},
      {path: "precio", confidence: "high"},
      {path: "direccion.barrio", confidence: "low"},
    ],
  });

  assert.deepEqual(selected, ["titulo", "precio"]);
});

