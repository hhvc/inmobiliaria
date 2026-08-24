import test from "node:test";
import assert from "node:assert/strict";

import {
  buildInmueblePublisherDescriptor,
  getPublicProfileInitials,
  normalizePublicProfile,
  resolveInmueblePublisherMode,
  validatePublicProfile,
} from "../src/profile/utils/publicProfile.helpers.js";

test("normaliza espacios sin eliminar los saltos útiles de la presentación", () => {
  const profile = normalizePublicProfile({
    uid: " user-1 ",
    displayName: "  Ana   Pérez ",
    headline: "  Asesora   inmobiliaria ",
    bio: "Primera línea.  \r\n\r\n\r\n Segunda línea.",
    isPublic: true,
  });

  assert.equal(profile.uid, "user-1");
  assert.equal(profile.displayName, "Ana Pérez");
  assert.equal(profile.headline, "Asesora inmobiliaria");
  assert.equal(profile.bio, "Primera línea.\n\n Segunda línea.");
});

test("valida nombre obligatorio y límites de contenido público", () => {
  const errors = validatePublicProfile({
    displayName: "A",
    headline: "x".repeat(141),
    bio: "x".repeat(1501),
    location: "x".repeat(101),
  });

  assert.deepEqual(Object.keys(errors).sort(), [
    "bio",
    "displayName",
    "headline",
    "location",
  ]);
});

test("genera iniciales legibles", () => {
  assert.equal(getPublicProfileInitials("Carlos Gómez"), "CG");
  assert.equal(getPublicProfileInitials("ONO"), "O");
  assert.equal(getPublicProfileInitials(""), "OP");
});

test("reconoce perfiles personales nuevos y heredados", () => {
  assert.equal(resolveInmueblePublisherMode({ publisherMode: "user" }), "user");
  assert.equal(
    resolveInmueblePublisherMode({ publisher: { type: "user" } }),
    "user",
  );
  assert.equal(resolveInmueblePublisherMode({ publisherMode: "agency" }), "agency");
  assert.equal(
    resolveInmueblePublisherMode({
      publisherMode: "agency",
      publisher: { type: "user" },
    }),
    "agency",
  );
});

test("la marca blanca fuerza el perfil de la inmobiliaria anfitriona", () => {
  const inmueble = {
    publisherMode: "user",
    publisherUserId: "user-1",
    publisher: { type: "user", id: "user-1", name: "Carlos" },
    inmobiliariaId: "agency-owner",
  };
  const agency = {
    id: "agency-host",
    nombre: "Inmobiliaria Amiga",
    slug: "inmobiliaria-amiga",
  };

  const personal = buildInmueblePublisherDescriptor({ inmueble, agency });
  const whiteLabel = buildInmueblePublisherDescriptor({
    inmueble,
    agency,
    forceAgency: true,
  });

  assert.equal(personal.type, "user");
  assert.equal(personal.name, "Carlos");
  assert.equal(whiteLabel.type, "agency");
  assert.equal(whiteLabel.id, "agency-host");
  assert.equal(whiteLabel.profilePath, "/inmobiliaria/inmobiliaria-amiga");
});
