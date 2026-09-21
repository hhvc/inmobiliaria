import assert from "node:assert/strict";
import test from "node:test";

import { buildAgencyPlansUrl } from "../src/marketing/utils/marketingCampaign.helpers.js";

test("el enlace a planes conserva los UTM del reel", () => {
  const url = buildAgencyPlansUrl(
    "?utm_source=instagram&utm_medium=organic_social&utm_campaign=reel_plataforma_inmobiliarias&utm_content=perfil",
  );
  const parsed = new URL(url, "https://onoprop.com");

  assert.equal(parsed.pathname, "/planes");
  assert.equal(parsed.searchParams.get("origen"), "software-para-inmobiliarias");
  assert.equal(parsed.searchParams.get("utm_source"), "instagram");
  assert.equal(parsed.searchParams.get("utm_campaign"), "reel_plataforma_inmobiliarias");
  assert.equal(parsed.searchParams.get("utm_content"), "perfil");
});

test("el enlace a planes no copia parámetros ajenos a la campaña", () => {
  const url = buildAgencyPlansUrl("?email=privado%40ejemplo.com&origen=externo");
  const parsed = new URL(url, "https://onoprop.com");

  assert.equal(parsed.searchParams.get("origen"), "software-para-inmobiliarias");
  assert.equal(parsed.searchParams.has("email"), false);
  assert.equal(parsed.searchParams.has("utm_source"), false);
});
