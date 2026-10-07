import assert from "node:assert/strict";
import test from "node:test";

import {
    buildCommercialFunnelMetrics,
    buildCommercialSource,
    buildCommercialWhatsappUrl,
    calculateCommercialUnitEconomics,
    commercialMoneyInputToMinor,
    getCommercialChecklistProgress,
    getCommercialOfferSummary,
    getCommercialQualification,
    getCommercialQualificationSummary,
    getCommercialLeadStatus,
    isConsortiumPilotLead,
} from "../src/billing/utils/commercial.helpers.js";
import {
    buildConsortiumQualificationData,
    buildConsortiumPilotLeadData,
    calculateConsortiumPilotEstimate,
    CONSORTIUM_PILOT_OFFER,
} from "../src/marketing/utils/consortiumPilotOffer.helpers.js";

test("conserva la atribución UTM del formulario comercial", () => {
    assert.deepEqual(buildCommercialSource({
        href: "https://onoprop.com/planes?utm_source=instagram&utm_campaign=lanzamiento",
        referrer: "https://instagram.com/",
    }), {
        path: "/planes",
        referrer: "https://instagram.com/",
        utmSource: "instagram",
        utmMedium: "",
        utmCampaign: "lanzamiento",
        utmContent: "",
        utmTerm: "",
    });
});

test("genera enlaces de WhatsApp seguros y reconoce estados", () => {
    assert.equal(
        buildCommercialWhatsappUrl("+54 9 351 555-1234", "Hola ONO Prop"),
        "https://wa.me/5493515551234?text=Hola%20ONO%20Prop",
    );
    assert.equal(getCommercialLeadStatus("won").label, "Ganado");
    assert.equal(getCommercialLeadStatus("pilot").label, "Piloto activo");
});

test("calcula el piloto por unidad respetando el mínimo mensual", () => {
    const small = calculateConsortiumPilotEstimate(12);
    assert.equal(small.estimatedMonthlyAmountMinor, 2000000);
    assert.equal(small.minimumApplied, true);

    const large = calculateConsortiumPilotEstimate(35);
    assert.equal(large.estimatedMonthlyAmountMinor, 3500000);
    assert.equal(large.minimumApplied, false);
    assert.deepEqual(buildConsortiumPilotLeadData({
        requestType: "pilot",
        unitCount: "35",
    }), {
        offerCode: CONSORTIUM_PILOT_OFFER.code,
        requestType: "pilot",
        unitCount: 35,
    });
});

test("identifica y resume una solicitud de piloto estructurada", () => {
    const lead = {
        commercialOffer: {
            code: CONSORTIUM_PILOT_OFFER.code,
            requestType: "pilot",
            unitCount: 24,
        },
    };
    assert.equal(isConsortiumPilotLead(lead), true);
    assert.equal(getCommercialOfferSummary(lead), "Piloto de 30 días · 24 unidades");
});

test("normaliza la calificación comercial del piloto", () => {
    assert.deepEqual(buildConsortiumQualificationData({
        consortiumCount: "3",
        currentManagementMethod: "spreadsheet",
        mainPain: "collections",
        startTiming: "within_30_days",
    }), {
        consortiumCount: 3,
        currentManagementMethod: "spreadsheet",
        mainPain: "collections",
        startTiming: "within_30_days",
    });
    assert.equal(buildConsortiumQualificationData({
        currentManagementMethod: "inventado",
    }).currentManagementMethod, "");

    const lead = {
        qualification: {
            consortiumCount: 3,
            currentManagementMethod: "spreadsheet",
            mainPain: "collections",
            startTiming: "within_30_days",
            score: 76,
            level: "high",
        },
    };
    assert.equal(getCommercialQualification(lead).label, "Alta prioridad");
    assert.equal(
        getCommercialQualificationSummary(lead),
        "3 consorcios · Planillas · Cobranzas y mora · Dentro de 30 días",
    );
});

test("calcula embudo, MRR y avance de puesta en marcha", () => {
    const leads = [
        {
            status: "new",
            qualification: { score: 75 },
            commercialOffer: { estimatedMonthlyAmountMinor: 2000000 },
        },
        {
            status: "demo",
            qualification: { score: 55 },
            commercialOffer: { estimatedMonthlyAmountMinor: 3000000 },
        },
        {
            status: "won",
            qualification: { score: 80 },
            commercialEconomics: { monthlyRevenueMinor: 4000000 },
        },
        { status: "lost", qualification: { score: 20 } },
    ];
    const metrics = buildCommercialFunnelMetrics(leads);
    assert.equal(metrics.total, 4);
    assert.equal(metrics.demos, 2);
    assert.equal(metrics.pilots, 1);
    assert.equal(metrics.highPriority, 2);
    assert.equal(metrics.estimatedOpenMrrMinor, 5000000);
    assert.equal(metrics.wonMrrMinor, 4000000);
    assert.equal(metrics.leadToDemoPercent, 50);
    assert.equal(metrics.leadToWonPercent, 25);

    const progress = getCommercialChecklistProgress({
        demoCompleted: true,
        consortiumSelected: true,
    });
    assert.equal(progress.completed, 2);
    assert.equal(progress.total, 7);
    assert.equal(progress.percent, 29);
});

test("estima margen y recuperación de una oportunidad", () => {
    const economics = calculateCommercialUnitEconomics({
        monthlyRevenueMinor: 5000000,
        monthlyCostMinor: 1500000,
        onboardingCostMinor: 3000000,
        setupFeeMinor: 1000000,
        acquisitionCostMinor: 1500000,
    });
    assert.equal(economics.monthlyGrossProfitMinor, 3500000);
    assert.equal(economics.grossMarginPercent, 70);
    assert.equal(economics.initialInvestmentMinor, 3500000);
    assert.equal(economics.paybackMonths, 1);
    assert.equal(commercialMoneyInputToMinor("49.900,50"), 0);
    assert.equal(commercialMoneyInputToMinor("49900,50"), 4990050);
});
