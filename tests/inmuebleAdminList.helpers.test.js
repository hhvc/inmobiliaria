import test from "node:test";
import assert from "node:assert/strict";

import {
  buildAdminInmueblesCsv,
  filterAdminInmuebles,
  normalizeInmuebleSharing,
  sortAdminInmuebles,
} from "../src/inmueble/utils/inmuebleAdminList.helpers.js";

test("filtra el inventario por texto, tipo y estado sin depender de acentos", () => {
  const items = [
    {
      id: "1",
      titulo: "Casa en Córdoba",
      tipo: "casa",
      estado: "activo",
      direccion: { barrio: "Cerro de las Rosas" },
    },
    {
      id: "2",
      titulo: "Departamento céntrico",
      tipo: "departamento",
      estado: "borrador",
    },
  ];

  assert.deepEqual(
    filterAdminInmuebles(items, {
      search: "cordoba",
      tipo: "casa",
      estado: "activo",
    }).map((item) => item.id),
    ["1"],
  );
});

test("ordena por fechas de carga y modificación", () => {
  const items = [
    { id: "a", createdAt: { seconds: 10 }, updatedAt: { seconds: 40 } },
    { id: "b", createdAt: { seconds: 30 }, updatedAt: { seconds: 20 } },
    { id: "c" },
  ];

  assert.deepEqual(
    sortAdminInmuebles(items, "created_desc").map((item) => item.id),
    ["b", "a", "c"],
  );
  assert.deepEqual(
    sortAdminInmuebles(items, "updated_asc").map((item) => item.id),
    ["b", "a", "c"],
  );
});

test("ordena precios dentro de cada moneda y deja faltantes al final", () => {
  const items = [
    { id: "usd-high", moneda: "USD", precio: "120000" },
    { id: "ars", moneda: "ARS", precio: "1.000.000" },
    { id: "usd-low", moneda: "USD", precio: "90000" },
    { id: "missing", moneda: "USD", precio: "" },
  ];

  assert.deepEqual(
    sortAdminInmuebles(items, "price_asc").map((item) => item.id),
    ["ars", "usd-low", "usd-high", "missing"],
  );
});

test("normaliza la compartición combinada con red y grupos", () => {
  assert.deepEqual(
    normalizeInmuebleSharing({
      shareWithOnopropNetwork: false,
      friendGroupIds: ["grupo-1", "grupo-1"],
    }),
    {
      enabled: true,
      mode: "friend_groups",
      shareWithOnopropNetwork: false,
      friendGroupIds: ["grupo-1"],
    },
  );
});

test("exporta CSV compatible con Excel con grupos y protección de fórmulas", () => {
  const csv = buildAdminInmueblesCsv([
    {
      id: "1",
      titulo: "=HIPERVINCULO(\"sitio\")",
      tipo: "casa",
      operacion: "venta",
      precio: 100,
      moneda: "USD",
      estado: "activo",
      sucursalId: "s1",
      sharing: {
        shareWithOnopropNetwork: true,
        friendGroupIds: ["g1"],
      },
      slug: "casa-1",
    },
  ], {
    branchesById: { s1: { name: "Centro" } },
    friendGroupsById: { g1: { name: "Inmobiliarias Amigas" } },
    publicOrigin: "https://onoprop.com",
  });

  assert.equal(csv.startsWith("\uFEFF"), true);
  assert.match(csv, /Inmobiliarias Amigas/);
  assert.match(csv, /https:\/\/onoprop\.com\/inmueble\/casa-1/);
  assert.match(csv, /'=HIPERVINCULO/);
});
