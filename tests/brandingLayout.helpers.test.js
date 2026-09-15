import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_BRANDING_LAYOUT,
  getHeroMinHeight,
  normalizeBrandingLayout,
} from "../src/inmobiliaria/utils/brandingLayout.helpers.js";

test("mantiene el diseño público actual como valor predeterminado", () => {
  assert.deepEqual(normalizeBrandingLayout(), DEFAULT_BRANDING_LAYOUT);
  assert.equal(getHeroMinHeight(DEFAULT_BRANDING_LAYOUT.heroHeight), 480);
});

test("normaliza una personalización válida", () => {
  assert.deepEqual(
    normalizeBrandingLayout({
      layout: {
        heroHeight: "tall",
        heroImagePosition: "top",
        profileCardPosition: "left",
        heroTextAlignment: "center",
        profileCardStyle: "soft",
        heroOverlayOpacity: 0.6,
      },
    }),
    {
      heroHeight: "tall",
      heroImagePosition: "top",
      profileCardPosition: "left",
      heroTextAlignment: "center",
      profileCardStyle: "soft",
      heroOverlayOpacity: 0.6,
    },
  );
  assert.equal(getHeroMinHeight("tall"), 620);
});

test("descarta valores arbitrarios y conserva opciones seguras", () => {
  assert.deepEqual(
    normalizeBrandingLayout({
      heroOverlayOpacity: 9,
      layout: {
        heroHeight: "gigante",
        heroImagePosition: "100% 100%; color:red",
        profileCardPosition: "fixed",
      },
    }),
    DEFAULT_BRANDING_LAYOUT,
  );
});
