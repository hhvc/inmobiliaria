import test from "node:test";
import assert from "node:assert/strict";

import {
    buildPortalAlertSearchQuery,
    canonicalizePortalAlertFilters,
    hasMeaningfulPortalAlertFilters,
    normalizePortalAlertFilters,
    portalItemMatchesAlert,
} from "./portalDemand.helpers.js";

test("normaliza y limita los filtros recibidos", () => {
    assert.deepEqual(normalizePortalAlertFilters({
        tipo: " casa ",
        precioMin: "100000",
        piscina: true,
        datoPrivado: "no",
    }), {
        search: "",
        sourceType: "",
        operacion: "",
        tipo: "casa",
        ciudad: "",
        barrio: "",
        dormitoriosMin: "",
        banosMin: "",
        cocherasMin: "",
        superficieMin: "",
        precioMin: "100000",
        precioMax: "",
        piscina: "true",
        patio: "",
        jardin: "",
        aptoCredito: "",
        video: "",
        sortBy: "",
    });
});

test("el orden por sí solo no crea una alerta", () => {
    assert.equal(hasMeaningfulPortalAlertFilters({ sortBy: "recientes" }), false);
    assert.equal(hasMeaningfulPortalAlertFilters({ ciudad: "Córdoba" }), true);
});

test("evalúa coincidencias de ubicación, precio y características", () => {
    const item = {
        sourceType: "inmobiliaria",
        tipo: "casa",
        operacion: "venta",
        direccion: { ciudad: "Córdoba", barrio: "General Paz" },
        precio: 120000,
        dormitorios: 3,
        amenities: { piscina: true },
    };

    assert.equal(portalItemMatchesAlert(item, {
        tipo: "casa",
        ciudad: "Cordoba",
        dormitoriosMin: "2",
        precioMax: "150000",
        piscina: "true",
    }), true);
    assert.equal(portalItemMatchesAlert(item, { precioMax: "100000" }), false);
});

test("genera la URL pública sin incluir campos vacíos", () => {
    assert.equal(
        buildPortalAlertSearchQuery({ ciudad: "Córdoba", sortBy: "destacados" }),
        "ciudad=C%C3%B3rdoba",
    );
});

test("el orden no duplica una misma alerta", () => {
    assert.equal(
        canonicalizePortalAlertFilters({ ciudad: "Córdoba", sortBy: "precio_asc" }),
        canonicalizePortalAlertFilters({ ciudad: "Córdoba", sortBy: "recientes" }),
    );
});
