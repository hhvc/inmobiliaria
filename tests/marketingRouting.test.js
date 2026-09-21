import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const hosting = JSON.parse(readFileSync(new URL("../firebase.json", import.meta.url), "utf8")).hosting;

test("la URL corta de la demo redirige a la única página comercial", () => {
  assert.deepEqual(hosting.redirects.find((rule) => rule.regex === "^/demo/?$"), {
    regex: "^/demo/?$",
    destination: "/software-para-inmobiliarias",
    type: 301,
  });
  assert.equal(hosting.rewrites.some((rule) => rule.source === "/demo"), false);
});
