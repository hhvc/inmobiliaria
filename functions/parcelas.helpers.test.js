import assert from "node:assert/strict";
import test from "node:test";

import {
    buildIdecorPointQueryUrl,
    normalizeOccupancyFeature,
    normalizeParcelFeature,
} from "./parcelas.helpers.js";

test("buildIdecorPointQueryUrl arma una consulta espacial segura", () => {
    const value = buildIdecorPointQueryUrl({
        layer: "parcelas",
        latitude: -31.4167,
        longitude: -64.1833,
    });
    const url = new URL(value);

    assert.equal(url.searchParams.get("typeNames"), "idecor:parcelas");
    assert.equal(url.searchParams.get("srsName"), "EPSG:4326");
    assert.match(
        url.searchParams.get("CQL_FILTER"),
        /POINT\(-64\.1833 -31\.4167\)/,
    );
});

test("buildIdecorPointQueryUrl rechaza capas no autorizadas", () => {
    assert.throws(
        () => buildIdecorPointQueryUrl({
            layer: "otra_capa",
            latitude: -31.4,
            longitude: -64.1,
        }),
        /no permitida/,
    );
});

test("normalizeParcelFeature conserva ceros y normaliza campos", () => {
    const result = normalizeParcelFeature({
        id: "parcelas.10",
        geometry: {type: "MultiPolygon", coordinates: []},
        properties: {
            Nomenclatura: " 1101  ",
            Nro_Cuenta: 123456,
            Superficie_Tierra_Urbana: 300,
            Superficie_Mejoras: 0,
            Valuacion: 1500000,
        },
    });

    assert.equal(result.nomenclature, "1101");
    assert.equal(result.accountNumber, "123456");
    assert.equal(result.improvementsArea, 0);
    assert.equal(result.totalValuation, 1500000);
});

test("normalizeOccupancyFeature interpreta los campos FOS/FOT", () => {
    const result = normalizeOccupancyFeature({
        properties: {
            localidad: "Córdoba",
            ord: "Ordenanza 8256",
            zona: "I",
            fos: "80",
            fot: "2.5",
            altura_max: "23.5",
        },
    });

    assert.equal(result.fos, "80");
    assert.equal(result.fot, "2.5");
    assert.equal(result.maximumHeight, "23.5");
});
