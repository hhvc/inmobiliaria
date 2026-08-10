import assert from "node:assert/strict";
import test from "node:test";

import {
    buildCommercialSource,
    buildCommercialWhatsappUrl,
    getCommercialLeadStatus,
} from "../src/billing/utils/commercial.helpers.js";

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
});
