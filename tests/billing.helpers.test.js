import assert from "node:assert/strict";
import test from "node:test";

import {
    addBillingIntervalMs,
    applyContractDiscount,
    buildBillingSchedules,
    buildBillingPeriodKey,
    buildFifoPaymentAllocation,
    buildInitialBillingCatalog,
    calculateDailyMoratoryInterestMinor,
    calculateInitialMoratoryInterestByDailyBaseMinor,
    calculateInitialMoratoryInterestMinor,
    calculatePaymentDueDateKey,
    catalogPricingRequiresQuote,
    findTnaForDate,
    getPromotionEligibilityError,
    getNextBillingAtMs,
    normalizeBillingCode,
    normalizePromotionCode,
    normalizePricingComponents,
    resolveContractFinancialTerms,
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
    const parcels = catalog.find(
        (item) => item.id === "consulta-parcelaria-profesional",
    );
    const appraisal = catalog.find((item) => item.id === "modulo-tasaciones");

    assert.equal(catalog.length, 7);
    assert.equal(domain.pricing.length, 2);
    assert.equal(domain.benefits[0].quantity, 10);
    assert.equal(highlight.allowQuantity, true);
    assert.equal(highlight.pricing[0].amountMinor, 100000);
    assert.deepEqual(parcels.moduleGrants, ["parcelas"]);
    assert.equal(parcels.pricing[0].quoteRequired, true);
    assert.deepEqual(appraisal.moduleGrants, ["tasaciones", "parcelas"]);
    assert.equal(appraisal.pricing[0].recurrence, "monthly");
});

test("calcula vencimiento inclusivo según los días acordados", () => {
    assert.equal(calculatePaymentDueDateKey("2026-07-01", 15), "2026-07-15");
    assert.equal(calculatePaymentDueDateKey("2026-07-01", 1), "2026-07-01");
});

test("usa la última TNA vigente para cada fecha", () => {
    const rates = [
        { effectiveDateKey: "2026-07-10", tnaMillionths: 40000000 },
        { effectiveDateKey: "2026-07-01", tnaMillionths: 36500000 },
    ];
    assert.equal(findTnaForDate(rates, "2026-07-09").tnaMillionths, 36500000);
    assert.equal(findTnaForDate(rates, "2026-07-15").tnaMillionths, 40000000);
    assert.equal(findTnaForDate(rates, "2026-06-30"), null);
});

test("liquida el primer interés simple y luego capitaliza a diario", () => {
    const principal = 10000000;
    const fifteenDays = Array(15).fill(36500000);
    const initialInterest = calculateInitialMoratoryInterestMinor(
        principal,
        fifteenDays,
    );
    assert.equal(initialInterest, 150000);
    assert.equal(
        calculateDailyMoratoryInterestMinor(principal + initialInterest, 36500000),
        10150,
    );
});

test("el primer interés respeta pagos parciales realizados durante el período", () => {
    assert.equal(calculateInitialMoratoryInterestByDailyBaseMinor([
        { baseMinor: 100000, tnaMillionths: 36500000 },
        { baseMinor: 50000, tnaMillionths: 36500000 },
    ]), 150);
});

test("aplica porcentaje y luego monto fijo sin producir importes negativos", () => {
    const result = applyContractDiscount({
        grossAmountMinor: 1000000,
        currency: "ARS",
        obligationDateKey: "2026-07-01",
        discount: {
            percentageBasisPoints: 1000,
            fixedAmountMinor: 200000,
            fixedCurrency: "ARS",
            startsOn: "2026-01-01",
        },
    });
    assert.deepEqual(result, {
        grossAmountMinor: 1000000,
        percentageDiscountMinor: 100000,
        fixedDiscountMinor: 200000,
        netAmountMinor: 700000,
    });

    assert.equal(applyContractDiscount({
        grossAmountMinor: 100000,
        currency: "ARS",
        obligationDateKey: "2026-07-01",
        discount: {
            percentageBasisPoints: 5000,
            fixedAmountMinor: 999999,
            fixedCurrency: "ARS",
        },
    }).netAmountMinor, 0);
});

test("imputa pagos por vencimiento, primero a interés y luego a capital", () => {
    const result = buildFifoPaymentAllocation([
        {
            id: "newer",
            dueDateKey: "2026-08-15",
            principalOutstandingMinor: 50000,
            interestOutstandingMinor: 0,
        },
        {
            id: "older",
            dueDateKey: "2026-07-15",
            principalOutstandingMinor: 100000,
            interestOutstandingMinor: 10000,
        },
    ], 130000);

    assert.deepEqual(result, {
        allocations: [
            {
                obligationId: "older",
                interestPaidMinor: 10000,
                principalPaidMinor: 100000,
            },
            {
                obligationId: "newer",
                interestPaidMinor: 0,
                principalPaidMinor: 20000,
            },
        ],
        allocatedMinor: 130000,
        unallocatedMinor: 0,
    });
});

test("normaliza códigos promocionales para una búsqueda inequívoca", () => {
    assert.equal(normalizePromotionCode("  promo ágil-10  "), "PROMOAGIL-10");
    assert.equal(normalizePromotionCode("PROMO/INVALIDA"), "PROMOINVALIDA");
});

test("valida vigencia, alcance y límites de una promoción", () => {
    const promotion = {
        active: true,
        validFrom: "2026-08-01",
        validUntil: "2026-08-31",
        catalogItemIds: ["instagram-propio"],
        maxRedemptions: 10,
        maxRedemptionsPerAgency: 1,
    };
    assert.equal(getPromotionEligibilityError({
        promotion,
        dateKey: "2026-08-05",
        catalogItemId: "instagram-propio",
    }), "");
    assert.equal(getPromotionEligibilityError({
        promotion,
        dateKey: "2026-09-01",
        catalogItemId: "instagram-propio",
    }), "expired");
    assert.equal(getPromotionEligibilityError({
        promotion,
        dateKey: "2026-08-05",
        catalogItemId: "mercadolibre-propio",
    }), "not_applicable");
    assert.equal(getPromotionEligibilityError({
        promotion,
        dateKey: "2026-08-05",
        catalogItemId: "instagram-propio",
        agencyRedeemed: 1,
    }), "agency_limit");
});

test("aplica enmiendas financieras solo desde su fecha de vigencia", () => {
    const contract = {
        pricing: [{
            id: "abono",
            label: "Abono mensual",
            recurrence: "monthly",
            currency: "ARS",
            amountMinor: 1000000,
        }],
        discount: {},
        financialAmendments: [{
            id: "amendment-1",
            effectiveDateKey: "2026-09-01",
            pricing: [{
                id: "abono",
                label: "Abono mensual",
                recurrence: "monthly",
                currency: "ARS",
                amountMinor: 2000000,
            }],
            discount: {
                percentageBasisPoints: 5000,
                fixedAmountMinor: 0,
                fixedCurrency: "ARS",
                startsOn: "2026-09-01",
                endsOn: "",
            },
        }],
    };

    const august = resolveContractFinancialTerms(contract, "2026-08-31");
    assert.equal(august.pricing[0].amountMinor, 1000000);
    assert.equal(august.discount.percentageBasisPoints, 0);

    const september = resolveContractFinancialTerms(contract, "2026-09-01");
    assert.equal(september.pricing[0].amountMinor, 2000000);
    assert.equal(september.discount.percentageBasisPoints, 5000);
    assert.equal(september.amendment.id, "amendment-1");
});
