import assert from "node:assert/strict";
import test from "node:test";

import {
    buildWhatsappDestinationUrl,
    buildWhatsappMessage,
    normalizeWhatsappAgencySlug,
    normalizeWhatsappContextText,
    normalizeWhatsappNumber,
} from "../functions/whatsapp.helpers.js";
import { buildWhatsappRedirectUrl } from "../src/utils/whatsappRedirect.js";

test("normaliza números argentinos para WhatsApp", () => {
    assert.equal(normalizeWhatsappNumber("+54 9 351 547-8785"), "5493515478785");
    assert.equal(normalizeWhatsappNumber("54 351 547-8785"), "5493515478785");
    assert.equal(normalizeWhatsappNumber("351 547-8785"), "5493515478785");
    assert.equal(normalizeWhatsappNumber("número inválido"), "");
});

test("acepta únicamente slugs seguros", () => {
    assert.equal(normalizeWhatsappAgencySlug(" LaDoctaProp "), "ladoctaprop");
    assert.equal(normalizeWhatsappAgencySlug("inmo-centro"), "inmo-centro");
    assert.equal(normalizeWhatsappAgencySlug("../secreto"), "");
});

test("construye mensajes diferenciados por destino", () => {
    assert.match(buildWhatsappMessage(), /ONO Prop/);
    assert.equal(
        buildWhatsappMessage({ agencyName: "La Docta Prop" }),
        "Hola, quiero consultar por las propiedades de La Docta Prop.",
    );
    assert.equal(
        buildWhatsappMessage({
            agencyName: "La Docta Prop",
            developmentName: "Altos del Centro",
            unitReference: "Unidad 2B",
        }),
        "Hola, quiero consultar por Unidad 2B del emprendimiento Altos del Centro publicado por La Docta Prop.",
    );
    assert.equal(
        normalizeWhatsappContextText("Unidad\n2B\t<script>", 20),
        "Unidad 2B <script>",
    );
});

test("construye una URL válida sin interpolar datos inseguros", () => {
    const url = buildWhatsappDestinationUrl({
        number: "3515478785",
        agencyName: "Inmobiliaria Centro",
    });

    assert.match(url, /^https:\/\/wa\.me\/5493515478785\?text=/);
    assert.match(decodeURIComponent(url), /Inmobiliaria Centro/);
    assert.equal(buildWhatsappDestinationUrl({ number: "123" }), "");
});

test("el frontend genera una ruta interna sin incluir el teléfono", () => {
    const url = buildWhatsappRedirectUrl({
        agencySlug: "ladoctaprop",
        source: "floating-button",
    });

    assert.equal(
        url,
        "/contacto/whatsapp?agency=ladoctaprop&source=floating-button",
    );
    assert.doesNotMatch(url, /\d{6,}/);
});

test("el frontend agrega contexto de unidad sin exponer el teléfono", () => {
    const url = buildWhatsappRedirectUrl({
        agencySlug: "ladoctaprop",
        source: "development-page",
        developmentName: "Altos del Centro",
        unitReference: "Unidad 2B",
    });

    assert.match(url, /development=Altos(?:\+|%20)del(?:\+|%20)Centro/);
    assert.match(url, /unit=Unidad(?:\+|%20)2B/);
    assert.doesNotMatch(url, /549351/);
});
