import assert from "node:assert/strict";
import test from "node:test";

import {
    buildCommercialSource,
    buildCommercialWhatsappUrl,
    getCommercialOfferSummary,
    getCommercialLeadStatus,
    isConsortiumPilotLead,
} from "../src/billing/utils/commercial.helpers.js";
import {
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
