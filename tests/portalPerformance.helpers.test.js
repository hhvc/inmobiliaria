import assert from "node:assert/strict";
import test from "node:test";

import {
    aggregatePerformanceRecords,
    buildPerformanceCsv,
    filterPerformanceRecords,
} from "../src/inmueble/utils/portalPerformance.helpers.js";

const records = [
    {
        dateKey: "2026-08-22",
        ownerAgencyId: "a",
        inmuebleId: "1",
        inmuebleTitle: "Casa Centro",
        inmuebleOperation: "venta",
        branchId: "centro",
        source: "search",
        promoted: true,
        counters: { detailViews: 10, whatsappClicks: 2, favoriteAdds: 1 },
    },
    {
        dateKey: "2026-08-23",
        ownerAgencyId: "a",
        inmuebleId: "1",
        inmuebleTitle: "Casa Centro",
        inmuebleOperation: "venta",
        branchId: "centro",
        source: "home",
        promoted: false,
        counters: { detailViews: 5, inquiries: 1 },
    },
];

test("filtra y agrega registros diarios", () => {
    assert.equal(filterPerformanceRecords(records, { promotion: "promoted" }).length, 1);
    const result = aggregatePerformanceRecords(records);
    assert.equal(result.summary.detailViews, 15);
    assert.equal(result.summary.contacts, 3);
    assert.equal(result.properties[0].conversionRate, 20);
    assert.equal(result.comparison.promoted.contacts, 2);
});

test("exporta el ranking en CSV compatible con Excel", () => {
    const result = aggregatePerformanceRecords(records);
    const csv = buildPerformanceCsv(result.properties);
    assert.match(csv, /^\uFEFF/);
    assert.match(csv, /Casa Centro/);
    assert.match(csv, /20\.00%/);
});
