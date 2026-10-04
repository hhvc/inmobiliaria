import assert from "node:assert/strict";
import test from "node:test";

import {
    extractResponseOutputText,
    PROPERTY_DRAFT_SCHEMA,
    redactPrivateContactDetails,
    sanitizePropertyDraftResponse,
} from "./inmuebleAi.helpers.js";

const baseDraft = {
    titulo: "Casa en venta en Argüello",
    descripcion: "Casa con pileta y tres dormitorios.",
    tipo: "casa",
    operacion: "venta",
    precio: "185.000",
    moneda: "USD",
    expensas: "",
    direccion: {
        calle: "",
        numero: "",
        barrio: "Argüello",
        ciudad: "Córdoba",
        provincia: "Córdoba",
        pais: "Argentina",
    },
    superficie: {
        total: "",
        cubierta: "180",
        semicubierta: "",
        descubierta: "",
        terreno: "600",
    },
    caracteristicas: {
        ambientes: "",
        dormitorios: "3",
        banos: "2",
        toilettes: "",
        cocheras: false,
        cocherasCantidad: "",
        plantas: "",
        antiguedad: "",
        orientacion: "",
        estadoConservacion: "muy_bueno",
        piso: "",
        departamento: "",
    },
    amenities: {
        piscina: true,
    },
    servicios: {},
    medidas: {
        frente: "",
        fondo: "",
        alturaTecho: "",
        hectareas: "",
    },
};

test("the property schema is strict at its root", () => {
    assert.equal(PROPERTY_DRAFT_SCHEMA.additionalProperties, false);
    assert.deepEqual(
        PROPERTY_DRAFT_SCHEMA.required,
        ["draft", "detectedFields", "missingFields", "warnings"],
    );
});

test("sanitizes numeric values and unsupported detected fields", () => {
    const result = sanitizePropertyDraftResponse({
        draft: baseDraft,
        detectedFields: [
            "tipo",
            "precio",
            "superficie.cubierta",
            "amenities.piscina",
            "private.ownerPhone",
        ],
        missingFields: ["Dirección exacta", "Dirección exacta"],
        warnings: ["Confirmar precio"],
    });

    assert.equal(result.draft.precio, "185000");
    assert.equal(result.draft.superficie.cubierta, "180");
    assert.equal(result.draft.amenities.piscina, true);
    assert.ok(result.detectedFields.includes("titulo"));
    assert.ok(result.detectedFields.includes("descripcion"));
    assert.ok(!result.detectedFields.includes("private.ownerPhone"));
    assert.deepEqual(result.missingFields, ["Dirección exacta"]);
});

test("redacts labelled contact details before sending or returning text", () => {
    const redacted = redactPrivateContactDetails(
        "WhatsApp: +54 9 351 555-1212 y email dueño@example.com",
    );

    assert.ok(!redacted.includes("351 555"));
    assert.ok(!redacted.includes("dueño@example.com"));
    assert.match(redacted, /dato privado omitido/);
});

test("extracts text from a raw Responses API payload", () => {
    const text = extractResponseOutputText({
        output: [{
            content: [{type: "output_text", text: "{\"draft\":{}}"}],
        }],
    });

    assert.equal(text, "{\"draft\":{}}");
});

