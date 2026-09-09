import assert from "node:assert/strict";
import test from "node:test";

import {
  buildConsortiumCollectionsCsv,
  buildConsortiumCollectionsDashboard,
  buildConsortiumInterestPreview,
  buildConsortiumPaymentAllocations,
  buildConsortiumPaymentAgreementSchedule,
  getConsortiumAgingBucket,
  getConsortiumDaysPastDue,
  normalizeConsortiumInterestPolicy,
} from "../src/consorcios/utils/consorcioCollections.helpers.js";

test("clasifica la mora por días completos", () => {
  assert.equal(getConsortiumDaysPastDue("2026-08-31", "2026-09-01"), 1);
  assert.equal(getConsortiumAgingBucket("2026-08-02", "2026-09-01"), "days_1_30");
  assert.equal(getConsortiumAgingBucket("2026-08-01", "2026-09-01"), "days_31_60");
  assert.equal(getConsortiumAgingBucket("2026-09-10", "2026-09-01"), "not_due");
});

test("consolida deuda, créditos y antigüedad por unidad", () => {
  const dashboard = buildConsortiumCollectionsDashboard({
    todayKey: "2026-09-01",
    units: [{ id: "u1", code: "1 A", ownerName: "Ana", creditBalanceMinor: 1000 }],
    obligations: [
      { id: "o1", unitId: "u1", dueDate: "2026-07-01", balanceMinor: 10000 },
      { id: "o2", unitId: "u1", dueDate: "2026-09-10", balanceMinor: 5000 },
      { id: "void", unitId: "u1", dueDate: "2026-01-01", balanceMinor: 9000, voided: true },
    ],
  });
  assert.equal(dashboard.summary.totalOutstandingMinor, 15000);
  assert.equal(dashboard.summary.overdueMinor, 10000);
  assert.equal(dashboard.summary.netExposureMinor, 14000);
  assert.equal(dashboard.unitRows[0].agingBucket, "days_61_90");
  assert.equal(dashboard.buckets.days_61_90.amountMinor, 10000);
});

test("distribuye cuotas sin perder centavos y respeta fin de mes", () => {
  const schedule = buildConsortiumPaymentAgreementSchedule({
    agreedAmountMinor: 10001,
    downPaymentMinor: 1000,
    installmentCount: 3,
    firstDueDate: "2026-01-31",
  });
  assert.deepEqual(schedule.map((item) => item.amountMinor), [3001, 3000, 3000]);
  assert.deepEqual(schedule.map((item) => item.dueDate), [
    "2026-01-31", "2026-02-28", "2026-03-31",
  ]);
  assert.equal(schedule.reduce((sum, item) => sum + item.amountMinor, 0), 9001);
});

test("imputa un cobro por antigüedad y conserva el excedente como crédito", () => {
  const result = buildConsortiumPaymentAllocations({
    amountMinor: 18000,
    obligations: [
      { id: "new", periodId: "p2", periodKey: "2026-08", dueDate: "2026-08-10", balanceMinor: 10000 },
      { id: "old", periodId: "p1", periodKey: "2026-07", dueDate: "2026-07-10", balanceMinor: 5000 },
    ],
  });
  assert.deepEqual(result.allocations.map((item) => [item.obligationId, item.amountMinor]), [
    ["old", 5000],
    ["new", 10000],
  ]);
  assert.equal(result.appliedAmountMinor, 15000);
  assert.equal(result.creditAmountMinor, 3000);
});

test("respeta la selección manual de períodos", () => {
  const result = buildConsortiumPaymentAllocations({
    amountMinor: 4000,
    obligationIds: ["new"],
    obligations: [
      { id: "old", dueDate: "2026-07-10", balanceMinor: 5000 },
      { id: "new", dueDate: "2026-08-10", balanceMinor: 6000 },
    ],
  });
  assert.deepEqual(result.allocations.map((item) => item.obligationId), ["new"]);
  assert.equal(result.appliedAmountMinor, 4000);
  assert.equal(result.creditAmountMinor, 0);
});

test("normaliza una política de intereses con límites seguros", () => {
  assert.deepEqual(normalizeConsortiumInterestPolicy({
    enabled: true,
    annualRatePercent: 1200,
    calculationMode: "otro",
    graceDays: 900,
    retroactiveFromDueDate: true,
  }), {
    enabled: true,
    annualRatePercent: 1000,
    calculationMode: "simple",
    graceDays: 365,
    retroactiveFromDueDate: true,
  });
});

test("previsualiza interés simple diario luego del período de gracia", () => {
  const preview = buildConsortiumInterestPreview({
    cutoffDate: "2026-09-10",
    policy: {
      enabled: true,
      annualRatePercent: 36.5,
      calculationMode: "simple",
      graceDays: 5,
    },
    obligations: [{
      id: "o1",
      periodKey: "2026-08",
      dueDate: "2026-09-01",
      balanceMinor: 100000,
    }],
  });
  assert.equal(preview.items[0].graceEndsOn, "2026-09-06");
  assert.equal(preview.items[0].days, 4);
  assert.equal(preview.totalInterestMinor, 400);
});

test("permite cálculo retroactivo y evita repetir días ya liquidados", () => {
  const first = buildConsortiumInterestPreview({
    cutoffDate: "2026-09-10",
    policy: {
      enabled: true,
      annualRatePercent: 36.5,
      graceDays: 5,
      retroactiveFromDueDate: true,
    },
    obligations: [{ id: "o1", dueDate: "2026-09-01", balanceMinor: 100000 }],
  });
  assert.equal(first.items[0].days, 9);
  assert.equal(first.totalInterestMinor, 900);

  const subsequent = buildConsortiumInterestPreview({
    cutoffDate: "2026-09-10",
    policy: { enabled: true, annualRatePercent: 36.5 },
    obligations: [{
      id: "o1",
      dueDate: "2026-09-01",
      balanceMinor: 100000,
      interestAssessedThrough: "2026-09-08",
    }],
  });
  assert.equal(subsequent.items[0].days, 2);
  assert.equal(subsequent.totalInterestMinor, 200);
});

test("calcula capitalización diaria y deja en cero una política desactivada", () => {
  const compound = buildConsortiumInterestPreview({
    cutoffDate: "2026-09-03",
    policy: { enabled: true, annualRatePercent: 36.5, calculationMode: "compound" },
    obligations: [{ id: "o1", dueDate: "2026-09-01", balanceMinor: 100000 }],
  });
  assert.equal(compound.totalInterestMinor, 200);
  const disabled = buildConsortiumInterestPreview({
    cutoffDate: "2026-09-10",
    policy: { enabled: false, annualRatePercent: 36.5 },
    obligations: [{ id: "o1", dueDate: "2026-09-01", balanceMinor: 100000 }],
  });
  assert.equal(disabled.totalInterestMinor, 0);
});

test("exporta un CSV compatible con importes y textos", () => {
  const csv = buildConsortiumCollectionsCsv({
    rows: [{
      code: "1 A",
      ownerName: "=HYPERLINK(\"https://example.com\")",
      occupantName: "",
      email: "ana@example.com",
      phone: "",
      balanceMinor: 12345,
      overdueBalanceMinor: 12345,
      notDueBalanceMinor: 0,
      creditBalanceMinor: 0,
      netBalanceMinor: 12345,
      oldestDueDate: "2026-08-01",
      maxDaysPastDue: 31,
      agingBucket: "days_31_60",
    }],
  });
  assert.match(csv, /"1 A"/);
  assert.match(csv, /"'=HYPERLINK\(""https:\/\/example.com""\)"/);
  assert.match(csv, /"123.45"/);
  assert.match(csv, /"31 a 60 días"/);
});
