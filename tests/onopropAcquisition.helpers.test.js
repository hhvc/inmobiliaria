import assert from "node:assert/strict";
import test from "node:test";

import {
    aggregateAcquisitionRecords,
    buildAcquisitionSearchCsv,
} from "../src/analytics/utils/onopropAcquisition.helpers.js";

const counters = (values = {}) => ({
    searches: 0,
    zeroResultSearches: 0,
    resultsReturned: 0,
    propertyDetails: 0,
    startRequests: 0,
    detailViews: 0,
    favoriteAdds: 0,
    whatsappClicks: 0,
    emailClicks: 0,
    inquiries: 0,
    registrationsCompleted: 0,
    publicationStarts: 0,
    publicationsCompleted: 0,
    agencyOnboardingStarts: 0,
    agenciesCompleted: 0,
    appraisalRequestStarts: 0,
    appraisalRequestsCompleted: 0,
    commercialInterestStarts: 0,
    commercialLeadsSubmitted: 0,
    serviceContractsRequested: 0,
    serviceContractsActivated: 0,
    ...values,
});

test("agrega el embudo, búsquedas y oportunidades sin resultados", () => {
    const search = {
        operation: "venta",
        propertyType: "casa",
        location: "zona norte",
        locationScope: "auto",
        currency: "",
        minBedrooms: 2,
        hasFreeText: false,
    };
    const result = aggregateAcquisitionRecords([
        {
            dateKey: "2026-09-18",
            kind: "summary",
            counters: counters({
                searches: 4,
                zeroResultSearches: 1,
                resultsReturned: 12,
                detailViews: 2,
                whatsappClicks: 1,
                registrationsCompleted: 1,
                publicationStarts: 2,
                publicationsCompleted: 1,
            }),
        },
        {
            dateKey: "2026-09-18",
            kind: "search",
            search,
            counters: counters({ searches: 4, zeroResultSearches: 1, resultsReturned: 12 }),
        },
        {
            dateKey: "2026-09-18",
            kind: "goal",
            goal: "sumar_inmobiliaria",
            counters: counters({ startRequests: 2 }),
        },
        {
            dateKey: "2026-09-18",
            kind: "conversion",
            conversionType: "publication_completed",
            attributionContent: "publicar_inmueble",
            counters: counters({ publicationsCompleted: 1 }),
        },
    ]);

    assert.equal(result.summary.searches, 4);
    assert.equal(result.summary.averageResults, 3);
    assert.equal(result.summary.zeroResultRate, 25);
    assert.equal(result.summary.contacts, 1);
    assert.equal(result.zeroResultSearches.length, 1);
    assert.equal(result.goals[0].label, "Sumar una inmobiliaria");
    assert.equal(result.summary.registrationsCompleted, 1);
    assert.equal(result.summary.completedOutcomes, 1);
    assert.equal(result.conversions[0].label, "Solicitud de publicación enviada");
    assert.equal(result.conversions[0].goalLabel, "Publicar un inmueble");
    assert.match(buildAcquisitionSearchCsv(result.searches), /zona norte/);
});
