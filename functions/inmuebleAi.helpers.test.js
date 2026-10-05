import assert from "node:assert/strict";
import test from "node:test";

import {
    extractResponseOutputText,
    PROPERTY_DRAFT_SCHEMA,
    PROPERTY_IMAGE_REVIEW_SCHEMA,
    PROPERTY_REVIEW_SCHEMA,
    redactPrivateContactDetails,
    sanitizePropertyDraftResponse,
    sanitizePropertyImageReviewResponse,
    sanitizePropertyImageUrls,
    sanitizePropertyReviewInput,
    sanitizePropertyReviewResponse,
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

test("the review schema is strict and requires review and suggestions", () => {
    assert.equal(PROPERTY_REVIEW_SCHEMA.additionalProperties, false);
    assert.deepEqual(
        PROPERTY_REVIEW_SCHEMA.required,
        ["review", "suggestions"],
    );
    assert.equal(
        PROPERTY_REVIEW_SCHEMA.properties.review.additionalProperties,
        false,
    );
});

test("review input excludes private and exact location data", () => {
    const input = sanitizePropertyReviewInput({
        titulo: "Casa en venta",
        descripcion: "Casa en Caseros 805. Contactar a propietario@example.com",
        direccion: {
            calle: "Caseros",
            numero: "805",
            barrio: "Centro",
            ciudad: "Córdoba",
            provincia: "Córdoba",
            latitud: -31.4,
            longitud: -64.2,
        },
        networkData: {
            ownerName: "Nombre privado",
            ownerPhone: "3515551212",
            visitInstructions: "Llaves en portería",
        },
        images: [{url: "https://example.com/1.jpg"}, {}],
        videos: [{url: "https://example.com/video.mp4"}],
    });

    assert.equal(input.ubicacionAproximada.barrio, "Centro");
    assert.equal(input.cantidadImagenes, 1);
    assert.equal(input.cantidadVideos, 1);
    assert.equal(JSON.stringify(input).includes("Caseros"), false);
    assert.match(input.descripcion, /ubicación exacta omitida/);
    assert.equal(JSON.stringify(input).includes("Nombre privado"), false);
    assert.equal(JSON.stringify(input).includes("propietario@example.com"), false);
});

test("sanitizes review results and generated contact details", () => {
    const result = sanitizePropertyReviewResponse({
        review: {
            score: 115,
            readiness: "ready",
            issues: [{
                severity: "critical",
                field: "precio",
                message: "Confirmar por WhatsApp: +54 9 351 555-1212",
            }],
            missingFields: ["Superficie total", "Superficie total"],
            contradictions: ["Indica dos superficies diferentes"],
        },
        suggestions: {
            title: "Casa en venta",
            portalDescription: "Escribí a ventas@example.com",
            instagramCaption: "Casa con pileta #Cordoba",
            mercadoLibreDescription: "Casa con tres dormitorios.",
        },
    });

    assert.equal(result.review.score, 100);
    assert.equal(result.review.issues[0].severity, "critical");
    assert.equal(result.review.missingFields.length, 1);
    assert.equal(result.suggestions.title, "Casa en venta");
    assert.equal(result.suggestions.portalDescription.includes("ventas@"), false);
    assert.equal(result.review.issues[0].message.includes("351 555"), false);
});

test("the image review schema is strict", () => {
    assert.equal(PROPERTY_IMAGE_REVIEW_SCHEMA.additionalProperties, false);
    assert.deepEqual(PROPERTY_IMAGE_REVIEW_SCHEMA.required, [
        "coverIndex",
        "orderedIndexes",
        "photos",
        "coverageGaps",
        "generalWarnings",
    ]);
});

test("accepts only public HTTPS image URLs and limits the analysis", () => {
    const urls = sanitizePropertyImageUrls([
        {url: "https://images.example.com/1.jpg"},
        {thumbnailUrl: "https://images.example.com/2-thumb.jpg"},
        {url: "http://insecure.example.com/3.jpg"},
        {url: "file:///private/photo.jpg"},
        ...Array.from({length: 10}, (_, index) =>
            `https://images.example.com/${index + 4}.jpg`),
    ]);

    assert.equal(urls.length, 6);
    assert.equal(urls[1], "https://images.example.com/2-thumb.jpg");
    assert.equal(urls.some((url) => url.startsWith("http://")), false);
});

test("sanitizes visual analysis indexes and privacy warnings", () => {
    const result = sanitizePropertyImageReviewResponse({
        coverIndex: 9,
        orderedIndexes: [2, 2, 9],
        photos: [
            {
                index: 2,
                scene: "living",
                quality: "strong",
                strengths: ["Buena luz"],
                issues: [],
                privacyRisks: ["Rostro visible"],
                suggestedCaption: "Living amplio. WhatsApp: +54 9 351 555-1212",
            },
            {index: 7, scene: "otro", quality: "weak"},
        ],
        coverageGaps: ["Falta cocina", "Falta cocina"],
        generalWarnings: ["Revisar privacidad"],
    }, 3);

    assert.equal(result.coverIndex, 2);
    assert.deepEqual(result.orderedIndexes, [2, 0, 1]);
    assert.equal(result.photos.length, 1);
    assert.equal(result.photos[0].privacyRisks[0], "Rostro visible");
    assert.equal(result.photos[0].suggestedCaption.includes("351 555"), false);
    assert.deepEqual(result.coverageGaps, ["Falta cocina"]);
});

