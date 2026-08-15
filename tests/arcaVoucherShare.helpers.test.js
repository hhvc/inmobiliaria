import assert from "node:assert/strict";
import test from "node:test";

import {
  buildArcaWhatsAppMessage,
  buildArcaWhatsAppUrl,
  isValidWhatsAppPhone,
  normalizeWhatsAppPhone,
} from "../src/alquileres/utils/arcaVoucherShare.helpers.js";

test("normaliza celulares argentinos para WhatsApp", () => {
  assert.equal(normalizeWhatsAppPhone("351 547-8785"), "5493515478785");
  assert.equal(normalizeWhatsAppPhone("+54 9 351 547-8785"), "5493515478785");
  assert.equal(normalizeWhatsAppPhone("0054 9 351 5478785"), "5493515478785");
  assert.equal(isValidWhatsAppPhone("3515478785"), true);
  assert.equal(isValidWhatsAppPhone("123"), false);
});

test("genera el mensaje y la URL sin exponer un enlace público al PDF", () => {
  const message = buildArcaWhatsAppMessage({
    voucherLabel: "Nota de Crédito C",
    voucherNumber: "00003-00000002",
    issuerName: "IRENE BEATRIZ CACERES",
  });
  const url = buildArcaWhatsAppUrl({phone: "3515478785", message});
  assert.match(message, /Nota de Crédito C N.º 00003-00000002/u);
  assert.match(message, /IRENE BEATRIZ CACERES/u);
  assert.equal(message.includes("http"), false);
  assert.match(url, /^https:\/\/wa\.me\/5493515478785\?text=/u);
});
