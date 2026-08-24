import assert from "node:assert/strict";
import test from "node:test";

import {
    getDateRangeDays,
    getPortalPerformanceDateKey,
    isActivePortalPromotion,
    normalizePerformanceCounters,
    normalizePerformanceDateKey,
    normalizePerformanceSource,
} from "./portalPerformance.helpers.js";

test("normaliza fuentes desconocidas como acceso directo", () => {
    assert.equal(normalizePerformanceSource("map"), "map");
    assert.equal(normalizePerformanceSource("robot"), "direct");
});

test("valida fechas reales y calcula rangos inclusivos", () => {
    assert.equal(normalizePerformanceDateKey("2026-08-23"), "2026-08-23");
    assert.equal(normalizePerformanceDateKey("2026-02-30"), "");
    assert.equal(getDateRangeDays("2026-08-01", "2026-08-23"), 23);
    assert.equal(
        getPortalPerformanceDateKey(new Date("2026-08-24T01:30:00Z")),
        "2026-08-23",
    );
});

test("detecta promociones vigentes y destacados heredados", () => {
    const now = new Date("2026-08-23T12:00:00Z").getTime();
    assert.equal(isActivePortalPromotion({ destacado: true }, now), true);
    assert.equal(isActivePortalPromotion({
        promotion: {
            active: true,
            startsAt: "2026-08-01T00:00:00Z",
            endsAt: "2026-08-31T23:59:59Z",
        },
    }, now), true);
    assert.equal(isActivePortalPromotion({
        promotion: { active: true, endsAt: "2026-08-22T23:59:59Z" },
    }, now), false);
});

test("descarta contadores inválidos", () => {
    assert.deepEqual(normalizePerformanceCounters({
        detailViews: 3,
        favoriteAdds: -2,
        inquiries: "4",
    }), {
        detailViews: 3,
        favoriteAdds: 0,
        whatsappClicks: 0,
        emailClicks: 0,
        inquiries: 4,
    });
});
