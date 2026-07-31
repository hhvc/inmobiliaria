import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPublicUnitConsultationMessage,
  filterPublicUnits,
  getConfiguredPublicUnits,
  getPublicUnitFilterOptions,
  getPublicUnitSummary,
} from "../src/emprendimiento/utils/emprendimientoPublicUnits.helpers.js";

const UNITS = [
  {
    id: "1",
    moneda: "USD",
    precio: 90000,
    superficie: { total: 55 },
    caracteristicas: { dormitorios: 1 },
    unidadEmprendimiento: {
      codigo: "1A",
      tipologia: "1 dormitorio",
      disponibilidad: "disponible",
    },
  },
  {
    id: "2",
    moneda: "USD",
    precio: 120000,
    superficie: { total: 75 },
    caracteristicas: { dormitorios: 2 },
    unidadEmprendimiento: {
      codigo: "2B",
      tipologia: "2 dormitorios",
      disponibilidad: "reservada",
    },
  },
  {
    id: "3",
    moneda: "USD",
    precio: 130000,
    superficie: { total: 80 },
    caracteristicas: { dormitorios: 2 },
    unidadEmprendimiento: {
      codigo: "3C",
      tipologia: "2 dormitorios",
      disponibilidad: "vendida",
    },
  },
];

test("oculta vendidas según la configuración pública", () => {
  assert.deepEqual(
    getConfiguredPublicUnits(UNITS).map((unit) => unit.id),
    ["1", "2"],
  );
  assert.equal(getConfiguredPublicUnits(UNITS, { showSold: true }).length, 3);
});

test("resume disponibilidad, superficies y precios mínimos", () => {
  const summary = getPublicUnitSummary(UNITS);
  assert.equal(summary.total, 3);
  assert.equal(summary.disponible, 1);
  assert.equal(summary.reservada, 1);
  assert.equal(summary.vendida, 1);
  assert.equal(summary.minPrices.USD, 90000);
  assert.equal(summary.minSurface, 55);
  assert.equal(summary.maxSurface, 80);
});

test("filtra por tipología, dormitorios, superficie, precio y estado", () => {
  const filtered = filterPublicUnits(UNITS, {
    tipologia: "2 dormitorios",
    dormitorios: "2",
    superficieMin: "70",
    moneda: "USD",
    precioMax: "125000",
    disponibilidad: "reservada",
  });

  assert.deepEqual(filtered.map((unit) => unit.id), ["2"]);
});

test("genera opciones únicas y un mensaje con referencia de unidad", () => {
  const options = getPublicUnitFilterOptions(UNITS);
  assert.deepEqual(options.bedrooms, ["1", "2"]);
  assert.deepEqual(options.currencies, ["USD"]);
  assert.match(
    buildPublicUnitConsultationMessage({
      developmentName: "Altos del Centro",
      unit: UNITS[1],
    }),
    /unidad 2B.*Altos del Centro/,
  );
});
