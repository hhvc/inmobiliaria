import assert from "node:assert/strict";
import test from "node:test";

import {
    aggregateAiDraftEvents,
    estimateAiDraftCostUsd,
    getAiAnalyticsRangeDays,
    normalizeAiAnalyticsDateKey,
} from "./inmuebleAiAnalytics.helpers.js";

test("calcula costo estimado con las tarifas del modelo configurado", () => {
    assert.equal(estimateAiDraftCostUsd({
        inputTokens: 1000000,
        outputTokens: 1000000,
    }), 0.6);
});

test("valida el período del panel", () => {
    assert.equal(normalizeAiAnalyticsDateKey("2026-10-04"), "2026-10-04");
    assert.equal(normalizeAiAnalyticsDateKey("2026-02-30"), "");
    assert.equal(getAiAnalyticsRangeDays("2026-10-01", "2026-10-04"), 4);
});

test("agrega resultados sin conservar contenido del inmueble", () => {
    const analytics = aggregateAiDraftEvents([
        {
            dayKey: "2026-10-03",
            status: "success",
            inmobiliariaId: "agency-1",
            inputTokens: 1000,
            outputTokens: 500,
            latencyMs: 2000,
            applied: true,
            appliedFieldCount: 8,
            feedback: "useful",
            model: "gpt-6-luna",
            operationType: "review",
            sourceText: "este texto no debe devolverse",
        },
        {
            dayKey: "2026-10-04",
            status: "failure",
            inmobiliariaId: "",
            failureType: "rate_limit",
            latencyMs: 1000,
        },
    ]);

    assert.equal(analytics.summary.attempts, 2);
    assert.equal(analytics.summary.successes, 1);
    assert.equal(analytics.summary.failures, 1);
    assert.equal(analytics.summary.appliedDrafts, 1);
    assert.equal(analytics.summary.usefulRate, 1);
    assert.equal(analytics.summary.averageLatencyMs, 1500);
    assert.equal(analytics.agencies.length, 2);
    assert.equal(analytics.failures[0].type, "rate_limit");
    assert.equal(
        analytics.operations.find((item) => item.operationType === "review")
            .attempts,
        1,
    );
    assert.equal(
        analytics.operations.find((item) => item.operationType === "draft")
            .attempts,
        1,
    );
    assert.equal(JSON.stringify(analytics).includes("este texto"), false);
});

test("distingue las revisiones visuales de los borradores y textos", () => {
    const analytics = aggregateAiDraftEvents([{
        dayKey: "2026-10-05",
        status: "success",
        operationType: "image_review",
        inputTokens: 200,
        outputTokens: 50,
    }]);

    assert.equal(analytics.operations.length, 1);
    assert.equal(analytics.operations[0].operationType, "image_review");
    assert.equal(analytics.operations[0].attempts, 1);
});

