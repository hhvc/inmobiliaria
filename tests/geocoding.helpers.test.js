import assert from "node:assert/strict";
import test from "node:test";

import {
  buildGeorefSearchUrl,
  mapGeorefCandidates,
} from "../src/mapa/services/geocoding.service.js";

test("arma una búsqueda estructurada de Georef", () => {
  const url = buildGeorefSearchUrl(
    "Av. Colón 500, Centro, Córdoba, Córdoba, Argentina",
    {
      street: "Av. Colón",
      number: "500",
      locality: "Córdoba",
      province: "Córdoba",
    },
  );

  assert.equal(url.searchParams.get("direccion"), "Av. Colón 500");
  assert.equal(url.searchParams.get("localidad"), "Córdoba");
  assert.equal(url.searchParams.get("provincia"), "Córdoba");
  assert.equal(url.searchParams.get("max"), "5");
});

test("interpreta localidad y provincia de una dirección libre", () => {
  const url = buildGeorefSearchUrl(
    "San Martín 100, Villa Carlos Paz, Córdoba, Argentina",
  );

  assert.equal(url.searchParams.get("direccion"), "San Martín 100");
  assert.equal(url.searchParams.get("localidad"), "Villa Carlos Paz");
  assert.equal(url.searchParams.get("provincia"), "Córdoba");
});

test("normaliza resultados y descarta direcciones sin coordenadas", () => {
  const candidates = mapGeorefCandidates({
    direcciones: [
      {
        altura: { value: 500, valor: 500 },
        calle: { id: "140140100002060", nombre: "AV COLON" },
        localidad_censal: { nombre: "Córdoba" },
        provincia: { nombre: "Córdoba" },
        nomenclatura: "AV COLON 500, Córdoba, Capital, Córdoba",
        ubicacion: { lat: -31.411629297, lon: -64.189803317 },
      },
      {
        calle: { id: "sin-coordenadas" },
        nomenclatura: "Dirección sin punto",
        ubicacion: { lat: null, lon: null },
      },
    ],
  });

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].source, "georef_argentina");
  assert.equal(candidates[0].provider, "Georef Argentina");
  assert.equal(candidates[0].precision, "address");
  assert.equal(candidates[0].latitude, -31.411629297);
  assert.equal(candidates[0].longitude, -64.189803317);
});
