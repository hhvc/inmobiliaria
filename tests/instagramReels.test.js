import assert from "node:assert/strict";
import test from "node:test";

import {
  getInstagramReelAspectWarning,
  normalizeInstagramReels,
  validateInstagramReelMetadata,
} from "../src/inmueble/utils/instagramReels.helpers.js";

test("acepta un Reel MP4 vertical dentro de los límites", () => {
  assert.deepEqual(
    validateInstagramReelMetadata({
      name: "recorrido.mp4",
      contentType: "video/mp4",
      size: 25 * 1024 * 1024,
      duration: 60,
      width: 1080,
      height: 1920,
    }),
    [],
  );
});

test("rechaza formato, tamaño, duración y resolución inválidos", () => {
  const errors = validateInstagramReelMetadata({
    name: "recorrido.avi",
    contentType: "video/x-msvideo",
    size: 301 * 1024 * 1024,
    duration: 2,
    width: 3840,
    height: 2160,
  });

  assert.equal(errors.length, 4);
  assert.ok(errors.some((error) => /MP4 o MOV/i.test(error)));
  assert.ok(errors.some((error) => /300 MB/i.test(error)));
  assert.ok(errors.some((error) => /3 segundos/i.test(error)));
  assert.ok(errors.some((error) => /1920/i.test(error)));
});

test("normaliza y limita los videos asociados al inmueble", () => {
  const reels = normalizeInstagramReels(
    Array.from({ length: 7 }, (_, index) => ({
      id: `reel-${index}`,
      url: `https://example.com/${index}.mp4`,
      storagePath: `inmuebles/inmo/item/instagram/${index}.mp4`,
      duration: "30",
    })),
  );

  assert.equal(reels.length, 5);
  assert.equal(reels[0].duration, 30);
});

test("advierte cuando el video no tiene formato vertical 9:16", () => {
  assert.equal(
    getInstagramReelAspectWarning({ width: 1080, height: 1920 }),
    "",
  );
  assert.match(
    getInstagramReelAspectWarning({ width: 1920, height: 1080 }),
    /9:16/,
  );
});

