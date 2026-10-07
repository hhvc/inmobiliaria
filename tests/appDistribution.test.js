import assert from "node:assert/strict";
import test from "node:test";

import {
  allowsExternalDigitalCommerce,
  captureAppDistribution,
  isGooglePlayDistribution,
} from "../src/platform/appDistribution.js";

const createStorage = () => {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
  };
};

test("captures Google Play distribution from the TWA launch URL", () => {
  const storage = createStorage();
  assert.equal(captureAppDistribution({
    search: "?utm_source=google_play&app_distribution=google_play",
    storage,
  }), "google_play");
  assert.equal(isGooglePlayDistribution({ search: "", storage }), true);
});

test("keeps the web portal commerce flow unchanged", () => {
  const storage = createStorage();
  assert.equal(isGooglePlayDistribution({ search: "?utm_source=google", storage }), false);
  assert.equal(allowsExternalDigitalCommerce({ search: "", storage }), true);
});

test("blocks external digital commerce for the Google Play session", () => {
  const storage = createStorage();
  captureAppDistribution({ search: "?app_distribution=google_play", storage });
  assert.equal(allowsExternalDigitalCommerce({ search: "", storage }), false);
});
