import assert from "node:assert/strict";
import test from "node:test";

import {
  buildArgentinaMobileE164,
  isEmailVerificationPending,
  isFreshPasswordAccount,
  normalizeArgentinaMobileDigits,
} from "../src/context/auth/auth.helpers.js";

const passwordUser = {
  emailVerified: false,
  providerData: [{ providerId: "password" }],
  metadata: {
    creationTime: "2026-08-08T12:00:00.000Z",
    lastSignInTime: "2026-08-08T12:00:01.000Z",
  },
};

test("reconoce únicamente altas recientes con contraseña", () => {
  assert.equal(isFreshPasswordAccount(passwordUser), true);
  assert.equal(isFreshPasswordAccount({
    ...passwordUser,
    providerData: [{ providerId: "google.com" }],
  }), false);
});
test("solo exige validación cuando el perfil nuevo tiene la marca", () => {
  assert.equal(isEmailVerificationPending(passwordUser, {}), false);
  assert.equal(isEmailVerificationPending(passwordUser, {
    emailVerificationRequired: true,
  }), true);
  assert.equal(isEmailVerificationPending({
    ...passwordUser,
    emailVerified: true,
  }, { emailVerificationRequired: true }), false);
});

test("normaliza celulares argentinos en formato E.164", () => {
  assert.equal(normalizeArgentinaMobileDigits("(351) 547-8785"), "3515478785");
  assert.equal(buildArgentinaMobileE164("351 547 8785"), "+5493515478785");
  assert.equal(buildArgentinaMobileE164("351547"), "");
});
