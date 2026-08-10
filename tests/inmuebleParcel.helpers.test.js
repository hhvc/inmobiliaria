import assert from "node:assert/strict";
import test from "node:test";

import {
  buildParcelSnapshot,
  getStoredParcelSummary,
  mergeParcelResultIntoInmueble,
} from "../src/inmueble/utils/inmuebleParcel.helpers.js";

const parcelResult = {
  provider: "IDECOR / Mapas Córdoba",
  queriedAt: "2026-08-06T12:00:00.000Z",
  location: {latitude: -31.4, longitude: -64.2},
  parcel: {
    nomenclature: "11-01-01-01-001-001",
    accountNumber: "123456",
    landAreaUrban: 300,
    improvementsArea: 155,
    totalValuation: 25000000,
  },
  urbanPlanning: {
    occupancy: {zone: "R2", fos: 0.6, fot: 1.5},
    subdivision: {minimumArea: 250},
    landUse: {dominantUse: "Residencial"},
  },
};

test("completa el terreno vacío y conserva la fuente parcelaria", () => {
  const merged = mergeParcelResultIntoInmueble({
    values: {tipo: "casa", superficie: {terreno: "", cubierta: "120"}},
    result: parcelResult,
  });

  assert.equal(merged.superficie.terreno, "300");
  assert.equal(merged.superficie.cubierta, "120");
  assert.deepEqual(merged.completedFields, ["superficie de terreno"]);
  assert.equal(
    merged.datosParcelarios.parcel.nomenclature,
    "11-01-01-01-001-001",
  );
});

test("no pisa la superficie informada manualmente", () => {
  const merged = mergeParcelResultIntoInmueble({
    values: {tipo: "terreno", superficie: {terreno: "287.5"}},
    result: parcelResult,
  });

  assert.equal(merged.superficie.terreno, "287.5");
  assert.deepEqual(merged.completedFields, []);
});

test("no aplica la superficie de la parcela a una unidad funcional", () => {
  const merged = mergeParcelResultIntoInmueble({
    values: {tipo: "departamento", superficie: {terreno: ""}},
    result: parcelResult,
  });

  assert.equal(merged.superficie.terreno, "");
  assert.deepEqual(merged.completedFields, []);
});

test("resume normativa y valuación guardadas", () => {
  const merged = mergeParcelResultIntoInmueble({
    values: {tipo: "casa", superficie: {}},
    result: parcelResult,
  });
  const summary = getStoredParcelSummary(merged.datosParcelarios);

  assert.equal(summary.zone, "R2");
  assert.equal(summary.fos, 0.6);
  assert.equal(summary.fot, 1.5);
  assert.equal(summary.permittedUse, "Residencial");
  assert.equal(summary.totalValuation, 25000000);
});

test("excluye la geometría GeoJSON del snapshot persistido", () => {
  const resultWithGeometry = {
    ...parcelResult,
    parcel: {
      ...parcelResult.parcel,
      geometry: {
        type: "Polygon",
        coordinates: [[
          [-64.2, -31.4],
          [-64.19, -31.4],
          [-64.2, -31.4],
        ]],
      },
    },
  };

  const snapshot = buildParcelSnapshot(resultWithGeometry);

  assert.equal(snapshot.parcel.geometry, undefined);
  assert.equal(snapshot.parcel.nomenclature, "11-01-01-01-001-001");
  assert.deepEqual(
    resultWithGeometry.parcel.geometry.coordinates[0][0],
    [-64.2, -31.4],
  );
});
