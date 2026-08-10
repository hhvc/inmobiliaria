import assert from "node:assert/strict";
import test from "node:test";

import {createEmptyTasacion} from
  "../src/tasacion/utils/tasacionSchema.js";
import {mergeParcelResultIntoTasacion} from
  "../src/tasacion/utils/tasacionParcel.helpers.js";

const result = {
  provider: "IDECOR / Mapas Córdoba",
  queriedAt: "2026-08-06T12:00:00.000Z",
  parcel: {
    nomenclature: "11-01-01-01-001-001",
    landAreaUrban: 300,
    totalValuation: 25000000,
  },
  urbanPlanning: {
    occupancy: {zone: "R2", fos: 0.6, fot: 1.5},
    subdivision: null,
    landUse: {dominantUse: "Residencial"},
  },
};

test("completa parcela y normativa vacías en una tasación de casa", () => {
  const source = createEmptyTasacion();
  source.subject.typology = "casa";
  const merged = mergeParcelResultIntoTasacion({tasacion: source, result});

  assert.equal(merged.tasacion.scope.cadastralNomenclature, "11-01-01-01-001-001");
  assert.equal(merged.tasacion.inspection.zoning.code, "R2");
  assert.equal(merged.tasacion.inspection.zoning.fos, 0.6);
  assert.equal(merged.tasacion.inspection.zoning.fot, 1.5);
  assert.equal(merged.tasacion.inspection.zoning.permittedUse, "Residencial");
  assert.equal(merged.tasacion.subject.surfaces.terreno, "300");
  assert.ok(merged.tasacion.inspection.parcelData.parcel);
});

test("preserva los criterios profesionales ingresados manualmente", () => {
  const source = createEmptyTasacion();
  source.subject.typology = "terreno";
  source.scope.cadastralNomenclature = "MANUAL";
  source.inspection.zoning = {
    code: "ZONA PROPIA",
    fos: "0.7",
    fot: "2",
    permittedUse: "Mixto",
  };
  source.subject.surfaces.terreno = "287.5";
  const merged = mergeParcelResultIntoTasacion({tasacion: source, result});

  assert.equal(merged.tasacion.scope.cadastralNomenclature, "MANUAL");
  assert.equal(merged.tasacion.inspection.zoning.code, "ZONA PROPIA");
  assert.equal(merged.tasacion.inspection.zoning.fos, "0.7");
  assert.equal(merged.tasacion.subject.surfaces.terreno, "287.5");
});

test("no asigna el terreno completo de la parcela a un departamento", () => {
  const source = createEmptyTasacion();
  source.subject.typology = "departamento";
  const merged = mergeParcelResultIntoTasacion({tasacion: source, result});

  assert.equal(merged.tasacion.subject.surfaces.terreno, "");
  assert.equal(merged.tasacion.scope.cadastralNomenclature, "11-01-01-01-001-001");
});
