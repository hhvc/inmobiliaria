import assert from "node:assert/strict";
import test from "node:test";

import {
    buildAcquisitionSearchLabel,
    getAcquisitionRangeDays,
    isOnopropMcpAttribution,
    normalizeAcquisitionAttribution,
    normalizeAcquisitionCounters,
    normalizeAcquisitionConversionType,
    normalizeAcquisitionDateKey,
    normalizeAcquisitionGoal,
    normalizeAcquisitionSearch,
} from "./onopropAcquisition.helpers.js";

test("normaliza búsquedas sin conservar el texto libre", () => {
    const normalized = normalizeAcquisitionSearch({
        query: "  cerca del lago con vista  ",
        operation: "VENTA",
        property_type: "Casa",
        location: " Villa Parque Síquiman ",
        location_scope: "city",
        min_bedrooms: 2,
    });

    assert.deepEqual(normalized, {
        operation: "venta",
        propertyType: "casa",
        location: "villa parque síquiman",
        locationScope: "city",
        currency: "",
        minBedrooms: 2,
        hasFreeText: true,
    });
    assert.equal(Object.hasOwn(normalized, "query"), false);
    assert.match(buildAcquisitionSearchLabel(normalized), /villa parque síquiman/);
});

test("valida atribuciones y conversiones del conector de ChatGPT", () => {
    const attribution = normalizeAcquisitionAttribution({
        source: " ChatGPT ",
        medium: "PLUGIN",
        campaign: "ONOProp_MCP",
        content: "Publicar_Inmueble",
        email: "no-debe-guardarse@example.com",
    });

    assert.deepEqual(attribution, {
        source: "chatgpt",
        medium: "plugin",
        campaign: "onoprop_mcp",
        content: "publicar_inmueble",
    });
    assert.equal(isOnopropMcpAttribution(attribution), true);
    assert.equal(isOnopropMcpAttribution({ source: "google" }), false);
    assert.equal(
        normalizeAcquisitionConversionType("publication_completed"),
        "publication_completed",
    );
    assert.equal(normalizeAcquisitionConversionType("evento_desconocido"), "");

    const counters = normalizeAcquisitionCounters({
        registrationsCompleted: 2,
        publicationsCompleted: 1,
        serviceContractsActivated: 1,
    });
    assert.equal(counters.registrationsCompleted, 2);
    assert.equal(counters.publicationsCompleted, 1);
    assert.equal(counters.serviceContractsActivated, 1);
});

test("normaliza metas y contadores permitidos", () => {
    assert.equal(normalizeAcquisitionGoal("solicitar_tasacion"), "solicitar_tasacion");
    assert.equal(normalizeAcquisitionGoal("desconocida"), "todas_las_opciones");

    const counters = normalizeAcquisitionCounters({
        searches: 4.4,
        zeroResultSearches: 2,
        propertyDetails: -1,
        ignored: 90,
    });
    assert.equal(counters.searches, 4);
    assert.equal(counters.zeroResultSearches, 2);
    assert.equal(counters.propertyDetails, 0);
    assert.equal(Object.hasOwn(counters, "ignored"), false);
});

test("valida períodos diarios de adquisición", () => {
    assert.equal(normalizeAcquisitionDateKey("2026-09-18"), "2026-09-18");
    assert.equal(normalizeAcquisitionDateKey("2026-02-31"), "");
    assert.equal(getAcquisitionRangeDays("2026-09-01", "2026-09-18"), 18);
});
