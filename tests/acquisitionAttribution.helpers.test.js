import assert from "node:assert/strict";
import test from "node:test";

import {
    ACQUISITION_ATTRIBUTION_MAX_AGE_MS,
    buildAcquisitionAttributionFromLocation,
    isAcquisitionAttributionActive,
    normalizeAcquisitionAttribution,
} from "../src/analytics/utils/acquisitionAttribution.helpers.js";

test("una visita sin atribución guardada no impide iniciar el portal", () => {
    assert.equal(isAcquisitionAttributionActive(null), false);
    assert.equal(isAcquisitionAttributionActive(undefined), false);
    assert.equal(isAcquisitionAttributionActive("invalid"), false);
    assert.deepEqual(normalizeAcquisitionAttribution(null), {
        source: "",
        medium: "",
        campaign: "",
        content: "",
        term: "",
        entryPath: "/",
        attributionId: "",
        capturedAt: 0,
    });
});

test("captura únicamente la atribución UTM del conector ONO Prop", () => {
    const capturedAt = Date.UTC(2026, 8, 18, 12);
    const attribution = buildAcquisitionAttributionFromLocation({
        pathname: "/publicar-inmueble-gratis",
        search: "?utm_source=chatgpt&utm_medium=plugin&utm_campaign=onoprop_mcp&utm_content=publicar_inmueble",
        attributionId: "test-attribution",
        capturedAt,
    });

    assert.deepEqual(attribution, {
        source: "chatgpt",
        medium: "plugin",
        campaign: "onoprop_mcp",
        content: "publicar_inmueble",
        term: "",
        entryPath: "/publicar-inmueble-gratis",
        attributionId: "test-attribution",
        capturedAt,
    });
    assert.equal(isAcquisitionAttributionActive(attribution, capturedAt + 1000), true);
    assert.equal(
        isAcquisitionAttributionActive(
            attribution,
            capturedAt + ACQUISITION_ATTRIBUTION_MAX_AGE_MS + 1,
        ),
        false,
    );

    assert.equal(buildAcquisitionAttributionFromLocation({
        search: "?utm_source=google&utm_medium=cpc&utm_campaign=onoprop_mcp",
        attributionId: "ignored",
        capturedAt,
    }), null);
});
