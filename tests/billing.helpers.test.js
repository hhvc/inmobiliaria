import assert from "node:assert/strict";
import test from "node:test";

import {
    addBillingIntervalMs,
    buildBillingSchedules,
    buildBillingPeriodKey,
    buildInitialBillingCatalog,
    catalogPricingRequiresQuote,
    getNextBillingAtMs,
    normalizeBillingCode,
    normalizePricingComponents,
} from "../functions/billing.helpers.js";

test("normaliza códigos comerciales estables", () => {
    assert.equal(normalizeBillingCode(" Integración Instagram Propio "), "integracion-instagram-propio");
});

test("normaliza cargos fijos y cotizables en distintas frecuencias", () => {
    const pricing = normalizePricingComponents([
        {
            id: "alta",
            label: "Alta",
            recurrence: "once",
            currency: "ars",
            amountMinor: 5000000,
        },
        {
            id: "abono",
            recurrence: "monthly",
            currency: "USD",
            quoteRequired: true,
        },
    ]);

    assert.equal(pricing[0].currency, "ARS");
    assert.equal(pricing[0].amountMinor, 5000000);
    assert.equal(pricing[1].recurrence, "monthly");
    assert.equal(pricing[1].amountMinor, null);
    assert.equal(catalogPricingRequiresQuote(pricing), true);
});

test("calcula vencimientos sin desbordar el último día del mes", () => {
    const january31 = Date.UTC(2026, 0, 31, 12);
    const february = new Date(addBillingIntervalMs(january31, "monthly"));
    assert.equal(february.toISOString(), "2026-02-28T12:00:00.000Z");

    const nextYear = new Date(addBillingIntervalMs(january31, "annual"));
    assert.equal(nextYear.toISOString(), "2027-01-31T12:00:00.000Z");
});

test("obtiene la próxima fecha y una clave de período idempotente", () => {
    assert.equal(
        getNextBillingAtMs([
            { nextBillingAtMs: 2000 },
            { nextBillingAtMs: 1000 },
        ]),
        1000,
    );
    assert.equal(
        buildBillingPeriodKey(Date.UTC(2026, 6, 31), "monthly"),
        "monthly-20260731",
    );
});

test("agenda beneficios recurrentes aunque no tengan un cargo periódico", () => {
    const startAtMs = Date.UTC(2026, 6, 31, 12);
    const schedules = buildBillingSchedules({
        pricing: [{
            id: "alta",
            label: "Alta",
            recurrence: "once",
            amountMinor: 10000,
        }],
        benefits: [{
            id: "creditos",
            type: "highlight_credits",
            label: "Créditos mensuales",
            quantity: 10,
            grantMode: "recurring",
            recurrence: "monthly",
        }],
        startAtMs,
    });

    assert.equal(schedules.length, 1);
    assert.equal(schedules[0].componentId, "benefits-monthly");
    assert.equal(
        new Date(schedules[0].nextBillingAtMs).toISOString(),
        "2026-08-31T12:00:00.000Z",
    );
});

test("incluye un catálogo inicial coherente y editable", () => {
    const catalog = buildInitialBillingCatalog();
    const domain = catalog.find((item) => item.id === "dominio-propio");
    const highlight = catalog.find((item) => item.id === "destacado-24h");

    assert.equal(catalog.length, 5);
    assert.equal(domain.pricing.length, 2);
    assert.equal(domain.benefits[0].quantity, 10);
    assert.equal(highlight.allowQuantity, true);
    assert.equal(highlight.pricing[0].amountMinor, 100000);
});
