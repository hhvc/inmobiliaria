import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_TASACION_COMPARABLES,
  addMappedComparable,
  buildInmuebleMapPoint,
  buildOmiComparable,
  buildOmiMapPoint,
  calculateMapDistanceMeters,
  filterComparableMapPoints,
  getInmuebleCoordinates,
  normalizeMapPropertyType,
} from "../src/mapa/utils/mapa.helpers.js";
import { createEmptyComparable } from "../src/tasacion/utils/tasacionSchema.js";

test("normaliza coordenadas guardadas en la dirección del inmueble", () => {
  const coordinates = getInmuebleCoordinates({
    direccion: { lat: "-31.4201", lng: "-64.1888" },
  });

  assert.deepEqual(coordinates, {
    latitude: -31.4201,
    longitude: -64.1888,
  });
  assert.equal(getInmuebleCoordinates({ direccion: { lat: 200, lng: 10 } }), null);
});

test("reduce precisión de inmuebles en el mapa público", () => {
  const point = buildInmuebleMapPoint(
    {
      id: "inmueble-1",
      titulo: "Casa en venta",
      direccion: {
        lat: -31.420145,
        lng: -64.188845,
        calle: "Calle privada",
        numero: "123",
        barrio: "Centro",
        ciudad: "Córdoba",
      },
    },
    { publicView: true },
  );

  assert.deepEqual(point.position, [-31.42, -64.189]);
  assert.equal(point.address.includes("Calle privada"), false);
  assert.equal(point.address.includes("Centro"), true);
});

test("respeta la ubicación precisa elegida por quien publica", () => {
  const point = buildInmuebleMapPoint(
    {
      id: "inmueble-preciso",
      direccion: {
        lat: -31.420145,
        lng: -64.188845,
        calle: "San Martín",
        numero: "123",
        ciudad: "Córdoba",
        precisionMapa: "precisa",
      },
    },
    { publicView: true },
  );

  assert.deepEqual(point.position, [-31.420145, -64.188845]);
  assert.match(point.address, /San Martín 123/);
  assert.equal(point.mapPrecision, "precisa");
});

test("clasifica tipologías para los marcadores del mapa", () => {
  assert.equal(normalizeMapPropertyType("Departamento"), "departamento");
  assert.equal(normalizeMapPropertyType("PH"), "casa");
  assert.equal(normalizeMapPropertyType("Lote en esquina"), "terreno");
  assert.equal(normalizeMapPropertyType("Galpón / depósito"), "local");
  assert.equal(normalizeMapPropertyType("Consultorio"), "oficina");
  assert.equal(normalizeMapPropertyType("Campo rural"), "campo");
  assert.equal(normalizeMapPropertyType("Cochera"), "otro");
});

test("convierte un registro OMI en punto y antecedente editable", () => {
  const item = {
    id: "113276",
    geometry: { type: "Point", coordinates: [-64.18, -31.42] },
    address: "Poeta Lugones",
    value: 104000,
    valueDate: "08/2024",
    currencyTypeCode: 1,
    propertyTypeCode: 1,
    surfaces: { built: 125, urbanLand: 249 },
  };

  const subjectLocation = {latitude: -31.421, longitude: -64.181};
  const point = buildOmiMapPoint(item, {subjectLocation});
  const comparable = buildOmiComparable(item, {subjectLocation});

  assert.deepEqual(point.position, [-31.42, -64.18]);
  assert.equal(comparable.price, 104000);
  assert.equal(comparable.surfaces.cubierta, 125);
  assert.equal(comparable.surfaces.terreno, 249);
  assert.equal(comparable.externalSource.recordId, "113276");
  assert.equal(comparable.sourceSnapshot.price, 104000);
  assert.equal(comparable.sourceSnapshot.surfaces.cubierta, 125);
  assert.ok(comparable.sourceCapturedAt);
  assert.ok(comparable.distanceMeters > 0);
  assert.match(comparable.notes, /verificar equivalencia/i);
});

test("reemplaza un antecedente vacío y evita duplicados", () => {
  const source = [
    createEmptyComparable(),
    { ...createEmptyComparable(), source: "Manual", price: 50000 },
  ];
  const mapped = buildOmiComparable({
    id: "omi-1",
    value: 90000,
    surfaces: { built: 80 },
  });

  const first = addMappedComparable(source, mapped);
  const second = addMappedComparable(first.items, mapped);

  assert.equal(first.added, true);
  assert.equal(first.items.length, 2);
  assert.equal(first.items[0].externalSource.recordId, "omi-1");
  assert.equal(second.added, false);
  assert.equal(second.duplicate, true);
  assert.equal(second.items.length, 2);
});

test("calcula distancia y filtra antecedentes por fuente, superficie y radio", () => {
  const subject = {latitude: -31.42, longitude: -64.18};
  const nearbyDistance = calculateMapDistanceMeters(subject, {
    latitude: -31.421,
    longitude: -64.181,
  });
  const points = [
    {
      id: "own",
      kind: "inmueble",
      comparableType: "casa",
      operation: "venta",
      price: 100000,
      primarySurface: 120,
      distanceMeters: nearbyDistance,
      sourceDate: "2026-07-01",
      published: true,
    },
    {
      id: "omi",
      kind: "omi",
      comparableType: "omi:3",
      operation: "",
      price: 80000,
      primarySurface: 70,
      distanceMeters: 6000,
      sourceDate: "2024-08-01",
    },
  ];

  assert.ok(nearbyDistance > 0 && nearbyDistance < 1000);
  assert.deepEqual(
    filterComparableMapPoints(points, {
      source: "inmueble",
      minSurface: 100,
      maxDistanceKm: 2,
      dateFrom: "2026-01-01",
    }).map((item) => item.id),
    ["own"],
  );
});

test("impide agregar más de cinco antecedentes", () => {
  const full = Array.from({length: MAX_TASACION_COMPARABLES}, (_, index) => ({
    ...createEmptyComparable(),
    source: `Fuente ${index}`,
    price: 100000 + index,
    surfaces: {cubierta: 80},
  }));
  const result = addMappedComparable(
    full,
    buildOmiComparable({id: "omi-extra", value: 90000, surfaces: {built: 80}}),
  );

  assert.equal(result.added, false);
  assert.equal(result.limitReached, true);
  assert.equal(result.items.length, MAX_TASACION_COMPARABLES);
});
