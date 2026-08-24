import assert from "node:assert/strict";
import test from "node:test";

import {
  createDefaultConsortiumPortalSections,
  isConsortiumPortalSectionVisibleTo,
  normalizeConsortiumPortalSections,
} from "../src/consorcios/utils/consorcioPortalInformation.constants.js";

test("mantiene las visibilidades obligatorias de cada bloque", () => {
  const normalized = normalizeConsortiumPortalSections({
    insurance: { enabled: true, visibility: "all" },
    evacuation: { enabled: true, visibility: "owners" },
    safety_report: { enabled: true, visibility: "all" },
  });
  assert.deepEqual(normalized.insurance, { enabled: true, visibility: "owners" });
  assert.deepEqual(normalized.evacuation, { enabled: true, visibility: "all" });
  assert.deepEqual(normalized.safety_report, { enabled: true, visibility: "all" });
});

test("solo expone a ocupantes los bloques configurados para todos", () => {
  assert.equal(isConsortiumPortalSectionVisibleTo({
    enabled: true,
    visibility: "owners",
  }, "occupant"), false);
  assert.equal(isConsortiumPortalSectionVisibleTo({
    enabled: true,
    visibility: "all",
  }, "occupant"), true);
  assert.equal(isConsortiumPortalSectionVisibleTo({
    enabled: true,
    visibility: "owners",
  }, "owner"), true);
});

test("los bloques nacen ocultos hasta decisión del administrador", () => {
  const defaults = createDefaultConsortiumPortalSections();
  assert.equal(Object.values(defaults).every((section) => section.enabled === false), true);
});
