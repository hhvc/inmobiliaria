import assert from "node:assert/strict";
import test from "node:test";

import {
  buildGoogleAdsLeadEvent,
  normalizeGoogleAdsConfig,
} from "../src/marketing/utils/googleAdsMeasurement.helpers.js";

test("valida el destino público de Google Ads", () => {
  assert.deepEqual(normalizeGoogleAdsConfig({
    adsId: "aw-18438651271",
    conversionLabel: "a9lLCIGR64EdEIf7ndhE",
  }), {
    adsId: "AW-18438651271",
    conversionLabel: "a9lLCIGR64EdEIf7ndhE",
  });

  assert.equal(normalizeGoogleAdsConfig({
    adsId: "G-G7863VJQMS",
    conversionLabel: "a9lLCIGR64EdEIf7ndhE",
  }), null);
});

test("construye una conversión sin datos personales y con id deduplicable", () => {
  assert.deepEqual(buildGoogleAdsLeadEvent({
    adsId: "AW-18438651271",
    conversionLabel: "a9lLCIGR64EdEIf7ndhE",
    leadId: "commercial-lead-123",
  }), {
    send_to: "AW-18438651271/a9lLCIGR64EdEIf7ndhE",
    value: 1,
    currency: "ARS",
    transaction_id: "commercial-lead-123",
  });
});

test("rechaza eventos sin identificador o con valores inválidos", () => {
  assert.equal(buildGoogleAdsLeadEvent({
    adsId: "AW-18438651271",
    conversionLabel: "a9lLCIGR64EdEIf7ndhE",
  }), null);

  assert.equal(buildGoogleAdsLeadEvent({
    adsId: "AW-18438651271",
    conversionLabel: "a9lLCIGR64EdEIf7ndhE",
    leadId: "lead-1",
    value: -1,
  }), null);
});
