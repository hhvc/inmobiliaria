import test from "node:test";
import assert from "node:assert/strict";

import {
    buildPortalFavoriteSnapshot,
    parsePortalFavorites,
    togglePortalFavorite,
} from "../src/inmueble/utils/portalFavorites.helpers.js";

test("buildPortalFavoriteSnapshot conserva solo los datos necesarios", () => {
    const snapshot = buildPortalFavoriteSnapshot({
        id: "abc",
        sourceType: "particular",
        titulo: "Casa en venta",
        ubicacion: "Córdoba",
        precio: 100000,
        moneda: "USD",
        images: [{ url: "https://example.com/casa.jpg" }],
        contact: { email: "privado@example.com" },
    }, new Date("2026-08-23T12:00:00.000Z"));

    assert.equal(snapshot.key, "particular:abc");
    assert.equal(snapshot.publicPath, "/particulares/abc");
    assert.equal(snapshot.priceLabel, "USD 100.000");
    assert.equal("contact" in snapshot, false);
});

test("togglePortalFavorite agrega y luego quita la misma publicación", () => {
    const item = { id: "123", titulo: "Departamento" };
    const added = togglePortalFavorite([], item);

    assert.equal(added.added, true);
    assert.equal(added.favorites.length, 1);

    const removed = togglePortalFavorite(added.favorites, item);
    assert.equal(removed.added, false);
    assert.equal(removed.favorites.length, 0);
});

test("parsePortalFavorites tolera almacenamiento inválido", () => {
    assert.deepEqual(parsePortalFavorites("{inválido"), []);
});
