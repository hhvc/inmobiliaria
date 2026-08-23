import test from "node:test";
import assert from "node:assert/strict";

import {
  buildAgencyPropertyPath,
  buildSharedPublicationId,
  canBranchManageInmueble,
  isActivePromotion,
  normalizeAgencySlug,
} from "../src/inmobiliaria/utils/agencyNetwork.helpers.js";

test("normaliza slugs de sucursales", () => {
  assert.equal(normalizeAgencySlug(" Córdoba Norte / Nueva "), "cordoba-norte-nueva");
});

test("genera una clave local estable para una publicación amiga", () => {
  assert.equal(buildSharedPublicationId("agencia-1", "inmueble-2"), "agencia-1_inmueble-2");
});

test("arma rutas de marca blanca para central y sucursal", () => {
  const inmueble = { slug: "casa-centro" };
  assert.equal(
    buildAgencyPropertyPath({ agencySlug: "demo", inmueble }),
    "/inmobiliaria/demo/inmueble/casa-centro",
  );
  assert.equal(
    buildAgencyPropertyPath({ agencySlug: "demo", branchSlug: "norte", inmueble }),
    "/inmobiliaria/demo/norte/inmueble/casa-centro",
  );
});

test("el responsable solo administra inmuebles de sus sucursales", () => {
  assert.equal(canBranchManageInmueble({
    role: "branch_manager", assignedBranchIds: ["norte"], inmueble: { sucursalId: "norte" },
  }), true);
  assert.equal(canBranchManageInmueble({
    role: "branch_manager", assignedBranchIds: ["norte"], inmueble: { sucursalId: "centro" },
  }), false);
  assert.equal(canBranchManageInmueble({
    role: "admin", assignedBranchIds: [], inmueble: { sucursalId: "centro" },
  }), true);
});

test("solo considera vigente un destaque local no vencido", () => {
  assert.equal(isActivePromotion({ active: true, endsAt: 2000 }, 1000), true);
  assert.equal(isActivePromotion({ active: true, endsAt: 500 }, 1000), false);
  assert.equal(isActivePromotion({ active: false, endsAt: 2000 }, 1000), false);
});
