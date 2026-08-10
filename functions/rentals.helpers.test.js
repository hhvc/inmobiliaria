import assert from "node:assert/strict";
import test from "node:test";

import {
    addDaysToDateKey,
    buildAutomatedRentalObligations,
} from "./rentals.helpers.js";

const contract = {
    id: "contract-1",
    startDate: "2026-01-31",
    endDate: "2026-12-31",
    currency: "ARS",
    dueDay: 10,
    financial: {
        initialRentAmountMinor: 10000000,
        adjustment: {mode: "fixed_percent", frequencyMonths: 3, fixedPercent: 10},
        administrationFee: {percent: 8, fixedAmountMinor: 0},
    },
    rentSchedule: [{effectiveFrom: "2026-01-31", amountMinor: 10000000}],
};

test("la automatización crea períodos determinísticos hasta la fecha indicada", () => {
    const obligations = buildAutomatedRentalObligations({
        contract,
        throughDate: "2026-04-15",
        todayDate: "2026-02-01",
    });
    assert.deepEqual(obligations.map((item) => item.periodKey), [
        "2026-01", "2026-02", "2026-03", "2026-04",
    ]);
    assert.equal(obligations.at(-1).rentAmountMinor, 11000000);
    assert.equal(obligations[0].serviceStartDate, "2026-01-31");
});

test("la fecha de horizonte puede extenderse sin desbordar meses", () => {
    assert.equal(addDaysToDateKey("2026-12-20", 45), "2027-02-03");
});
