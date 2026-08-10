import assert from "node:assert/strict";
import test from "node:test";

import {
    buildOmiFeatureUrl,
    extractCookieHeader,
    lonLatToWebMercator,
    normalizeOmiBounds,
    normalizeOmiCollection,
    normalizeOmiFeature,
    webMercatorToLonLat,
} from "./omi.helpers.js";

test("convierte coordenadas entre WGS84 y Web Mercator", () => {
    const source = [-64.1888, -31.4201];
    const projected = lonLatToWebMercator(...source);
    const restored = webMercatorToLonLat(...projected);

    assert.ok(Math.abs(restored[0] - source[0]) < 0.000001);
    assert.ok(Math.abs(restored[1] - source[1]) < 0.000001);
});

test("normaliza límites WGS84 y evita consultas demasiado amplias", () => {
    const bounds = normalizeOmiBounds({
        west: -64.25,
        south: -31.48,
        east: -64.10,
        north: -31.32,
    });

    assert.ok(bounds.minX < bounds.maxX);
    assert.ok(bounds.minY < bounds.maxY);
    assert.throws(
        () => normalizeOmiBounds({
            west: -65,
            south: -32,
            east: -63,
            north: -30,
        }),
        /100 km/,
    );
});

test("construye una consulta WFS acotada", () => {
    const url = buildOmiFeatureUrl({
        bounds: {
            minX: -7153250,
            minY: -3681263,
            maxX: -7139110,
            maxY: -3672472,
        },
        limit: 5,
    });

    assert.equal(url.searchParams.get("request"), "GetFeature");
    assert.equal(url.searchParams.get("outputFormat"), "application/json");
    assert.equal(url.searchParams.get("maxFeatures"), "5");
    assert.match(url.searchParams.get("bbox"), /^-7153250,/);
});

test("extrae cookies de sesión sin conservar atributos", () => {
    const cookie = extractCookieHeader([
        "PHPSESSID=abc123; path=/; HttpOnly; SameSite=Lax",
        "other=value; Expires=Wed, 21 Oct 2026 07:28:00 GMT",
    ]);

    assert.equal(cookie, "PHPSESSID=abc123; other=value");
});

test("normaliza antecedentes y omite datos sensibles del cargador", () => {
    const normalized = normalizeOmiFeature({
        type: "Feature",
        id: "Observatorio.1",
        geometry: {
            type: "Point",
            coordinates: [-7147998.5744, -3679570.3288],
        },
        properties: {
            id: 1,
            Usuario: "identificador-privado",
            Observaciones: "Texto libre con un teléfono privado",
            Fuente: "https://example.com/aviso\nPersona y teléfono",
            ReferenciasUbicacion: "Calle 123",
            Valor: 104000,
            SuperficieLoteUrbano: 249,
            SuperficieConstruida: 125,
            Luz: 1,
            Gas: 0,
        },
    });

    assert.equal(normalized.id, "1");
    assert.equal(normalized.sourceUrl, "https://example.com/aviso");
    assert.equal(normalized.address, "Calle 123");
    assert.equal(normalized.surfaces.urbanLand, 249);
    assert.equal(normalized.services.electricity, true);
    assert.equal(normalized.services.gas, false);
    assert.equal("Usuario" in normalized, false);
    assert.equal("Observaciones" in normalized, false);
    assert.equal(JSON.stringify(normalized).includes("privado"), false);
});

test("valida la colección antes de entregarla a la aplicación", () => {
    const result = normalizeOmiCollection({
        type: "FeatureCollection",
        features: [],
        numberMatched: 20,
        timeStamp: "2026-08-06T12:00:00Z",
    });

    assert.equal(result.returned, 0);
    assert.equal(result.providerMatched, 20);
    assert.throws(() => normalizeOmiCollection({ features: [] }), /inesperada/);
});
