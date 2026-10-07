import assert from "node:assert/strict";
import test from "node:test";

import {
  PWA_INSTALL_DISMISS_MS,
  isOnopropPwaHost,
  isStandalonePwa,
  shouldOfferPwaInstall,
} from "../src/pwa/pwa.helpers.js";

test("offers installation only on ONO Prop hosts", () => {
  assert.equal(isOnopropPwaHost("onoprop.com"), true);
  assert.equal(isOnopropPwaHost("WWW.ONOPROP.COM"), true);
  assert.equal(isOnopropPwaHost("signoinmobiliaria.com.ar"), false);
});

test("detects standalone display modes", () => {
  assert.equal(isStandalonePwa({displayModeStandalone: true}), true);
  assert.equal(isStandalonePwa({navigatorStandalone: true}), true);
  assert.equal(isStandalonePwa({}), false);
});

test("respects the installation dismissal cooldown", () => {
  const now = Date.UTC(2026, 9, 5);
  assert.equal(shouldOfferPwaInstall({dismissedAt: 0, now}), true);
  assert.equal(shouldOfferPwaInstall({dismissedAt: now - 1000, now}), false);
  assert.equal(shouldOfferPwaInstall({
    dismissedAt: now - PWA_INSTALL_DISMISS_MS,
    now,
  }), true);
});
