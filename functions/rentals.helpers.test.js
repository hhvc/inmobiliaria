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

test("la automatización genera una sola obligación para una estadía temporal", () => {
    const obligations = buildAutomatedRentalObligations({
        contract: {
            ...contract,
            id: "temporary-1",
            contractType: "temporary",
            startDate: "2026-08-13",
            endDate: "2026-08-13",
            paymentDueDate: "2026-08-13",
            financial: {
                ...contract.financial,
                initialRentAmountMinor: 500,
            },
        },
        throughDate: "2026-08-13",
        todayDate: "2026-08-13",
    });
    assert.equal(obligations.length, 1);
    assert.equal(obligations[0].obligationType, "single_stay");
    assert.equal(obligations[0].serviceStartDate, "2026-08-13");
    assert.equal(obligations[0].serviceEndDate, "2026-08-13");
    assert.equal(obligations[0].dueDate, "2026-08-13");
    assert.equal(obligations[0].totalAmountMinor, 500);
});
