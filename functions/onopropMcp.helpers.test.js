import assert from "node:assert/strict";
import test from "node:test";

import {
    buildMcpPropertyDetail,
    buildPublicLocation,
    filterAndRankMcpProperties,
    getOnopropStartOptions,
    mapAgencyListingForMcp,
    mapParticularListingForMcp,
    parseMcpPropertyId,
    redactMcpContactDetails,
} from "./onopropMcp.helpers.js";

const agencyProperty = mapAgencyListingForMcp({
    id: "property-1",
    agencyId: "agency-1",
    agency: { nombre: "Inmobiliaria Demo" },
    listing: {
        slug: "casa-villa-parque-siquiman-property-1",
        titulo: "Casa con pileta en Siquiman",
        descripcion: "Alquiler temporal cerca del lago.",
        operacion: "alquiler_temporal",
        tipo: "casa",
        precio: "150.000",
        moneda: "ARS",
        dormitorios: 2,
        banos: 1,
        direccion: {
            calle: "Ruta 38",
            numero: "100",
            barrio: "Centro",
            ciudad: "Villa Parque Síquiman",
            provincia: "Córdoba",
            precisionMapa: "aproximada",
        },
        superficie: { total: 400 },
        images: [{ url: "https://example.com/property.jpg", order: 0 }],
    },
});

test("la ubicación aproximada nunca expone calle ni número", () => {
    assert.equal(
        agencyProperty.location,
        "Centro, Villa Parque Síquiman, Córdoba",
    );
    assert.equal(agencyProperty.location.includes("Ruta 38"), false);
});

test("la búsqueda reconoce acentos, alquiler temporal y rangos de precio", () => {
    const anotherProperty = {
        ...agencyProperty,
        id: "agency:agency-1:property-2",
        title: "Departamento en venta en Córdoba",
        location: "Nueva Córdoba, Córdoba",
        operation: "venta",
        property_type: "departamento",
        price: 90000,
        currency: "USD",
    };
    const results = filterAndRankMcpProperties(
        [anotherProperty, agencyProperty],
        {
            query: "siquiman lago",
            operation: "alquiler_temporal",
            property_type: "casa",
            location: "Siquiman",
            currency: "ARS",
            max_price: 200000,
            limit: 10,
        },
    );

    assert.equal(results.length, 1);
    assert.equal(results[0].id, agencyProperty.id);
    assert.equal(results[0].price, 150000);
});

test("Córdoba busca la ciudad y la provincia requiere alcance explícito", () => {
    const makeProperty = (id, city) => mapAgencyListingForMcp({
        id,
        agencyId: "agency-1",
        agency: { nombre: "Inmobiliaria Demo" },
        listing: {
            titulo: `Departamento en ${city}`,
            descripcion: "Departamento publicado.",
            operacion: "venta",
            tipo: "departamento",
            precio: 100000,
            moneda: "USD",
            dormitorios: 2,
            direccion: {
                barrio: "Centro",
                ciudad: city,
                provincia: "Córdoba",
                precisionMapa: "aproximada",
            },
        },
    });
    const capital = makeProperty("capital", "Córdoba");
    const carlosPaz = makeProperty("carlos-paz", "Villa Carlos Paz");

    const cityResults = filterAndRankMcpProperties(
        [capital, carlosPaz],
        { location: "Córdoba", limit: 20 },
    );
    assert.deepEqual(cityResults.map((property) => property.id), [capital.id]);

    const provinceResults = filterAndRankMcpProperties(
        [capital, carlosPaz],
        { location: "Provincia de Córdoba", limit: 20 },
    );
    assert.deepEqual(
        new Set(provinceResults.map((property) => property.id)),
        new Set([capital.id, carlosPaz.id]),
    );
});

test("corrige Carlos Paz cuando fue cargado como barrio de Córdoba", () => {
    const property = mapAgencyListingForMcp({
        id: "carlos-paz-mislabeled",
        agencyId: "agency-1",
        listing: {
            titulo: "Vendo Dpto Centro de Carlos Paz 2 Dorm",
            descripcion: "Departamento céntrico en Villa Carlos Paz.",
            operacion: "venta",
            tipo: "departamento",
            precio: 145000,
            moneda: "USD",
            dormitorios: 2,
            direccion: {
                barrio: "Carlos Paz",
                ciudad: "Córdoba",
                provincia: "Córdoba",
                precisionMapa: "aproximada",
            },
        },
    });

    assert.equal(property.location_city, "Villa Carlos Paz");
    assert.equal(filterAndRankMcpProperties(
        [property],
        { location: "Córdoba", limit: 20 },
    ).length, 0);
    assert.equal(filterAndRankMcpProperties(
        [property],
        { location: "Provincia de Córdoba", limit: 20 },
    ).length, 1);
});

test("prioriza características actuales sobre campos históricos", () => {
    const result = mapAgencyListingForMcp({
        id: "property-current-features",
        agencyId: "agency-1",
        listing: {
            operacion: "venta",
            tipo: "departamento",
            dormitorios: 2,
            banos: 2,
            cocheras: 2,
            caracteristicas: {
                dormitorios: 1,
                banos: 1,
                cocherasCantidad: 1,
            },
        },
    });

    assert.equal(result.bedrooms, 1);
    assert.equal(result.bathrooms, 1);
    assert.equal(result.parking_spaces, 1);
});

test("conserva cada ficha aunque las unidades tengan los mismos datos", () => {
    const makeProperty = (id, title) => mapAgencyListingForMcp({
        id,
        agencyId: "agency-1",
        agency: { nombre: "Inmobiliaria Demo" },
        listing: {
            titulo: title,
            descripcion: "Unidad luminosa con balcón al frente.",
            operacion: "venta",
            tipo: "departamento",
            precio: 59000,
            moneda: "USD",
            dormitorios: 2,
            banos: 1,
            superficie: { total: 65 },
            direccion: {
                calle: "Avenida Patria",
                numero: "300",
                barrio: "Alto General Paz",
                ciudad: "Córdoba",
                provincia: "Córdoba",
                precisionMapa: "precisa",
            },
        },
    });
    const original = makeProperty("patria-original", "Departamento en Patria");
    const duplicate = makeProperty("patria-copy", "Departamento en Patria");
    const anotherUnit = makeProperty("patria-2b", "Departamento contrafrente");

    const results = filterAndRankMcpProperties(
        [original, duplicate, anotherUnit],
        { location: "Córdoba", limit: 20 },
    );

    assert.deepEqual(
        results.map((property) => property.id),
        [original.id, duplicate.id, anotherUnit.id],
    );
});

test("conserva fichas similares y solo evita repetir el mismo identificador", () => {
    const base = {
        id: "patria-complete",
        url: "https://onoprop.com/inmueble/patria-complete",
        title: "Vendo Dpto Av Patria 300 2 Dorm",
        description: "Departamento externo sobre Avenida Patria.",
        operation: "venta",
        property_type: "departamento",
        currency: "USD",
        price: 59000,
        bedrooms: 2,
        bathrooms: 1,
        total_area_m2: 65,
        publisher_name: "LaDoctaProp",
        location: "Alto General Paz, Córdoba, Córdoba",
        location_city: "Córdoba",
        location_province: "Córdoba",
        location_neighborhood: "Alto General Paz",
        updated_at_ms: 2,
    };
    const incompleteCopy = {
        ...base,
        id: "patria-incomplete",
        url: "https://onoprop.com/inmueble/patria-incomplete",
        description: "Amplio y luminoso, entre Catamarca y Lima.",
        location: "Córdoba, Córdoba",
        location_neighborhood: "",
        updated_at_ms: 1,
    };

    const results = filterAndRankMcpProperties(
        [base, incompleteCopy, base],
        { location: "Córdoba", limit: 20 },
    );

    assert.deepEqual(
        results.map((property) => property.id),
        [base.id, incompleteCopy.id],
    );
});

test("no prioriza publicaciones destacadas de pago", () => {
    const recent = {
        ...agencyProperty,
        id: "agency:agency-1:recent",
        featured: false,
        updated_at_ms: 20,
    };
    const paidFeatured = {
        ...agencyProperty,
        id: "agency:agency-1:paid-featured",
        featured: true,
        updated_at_ms: 10,
    };

    const results = filterAndRankMcpProperties(
        [paidFeatured, recent],
        { limit: 20 },
    );

    assert.deepEqual(
        results.map((property) => property.id),
        [recent.id, paidFeatured.id],
    );
});

test("los resultados particulares no incluyen datos privados de contacto", () => {
    const result = mapParticularListingForMcp({
        id: "particular-1",
        listing: {
            titulo: "Terreno en venta",
            operacion: "venta",
            tipo: "terreno",
            ubicacion: "La Calera, Córdoba",
            precioEstimado: "USD 25.000",
            contact: {
                email: "private@example.com",
                telefono: "3510000000",
            },
        },
    });

    assert.equal(result.price, 25000);
    assert.equal(Object.hasOwn(result, "contact"), false);
    assert.equal(JSON.stringify(result).includes("private@example.com"), false);
});

test("las descripciones públicas no entregan teléfonos, emails ni enlaces de WhatsApp", () => {
    const description = redactMcpContactDetails(
        "Contactá a Diego al +54 9 351 216-4909, diego@example.com o https://wa.me/5493512164909.",
    );

    assert.equal(description.includes("351 216-4909"), false);
    assert.equal(description.includes("diego@example.com"), false);
    assert.equal(description.includes("wa.me"), false);
    assert.match(description, /dato de contacto disponible en la ficha/);
});

test("los títulos públicos tampoco entregan teléfonos", () => {
    const result = mapAgencyListingForMcp({
        id: "property-title-phone",
        agencyId: "agency-1",
        listing: {
            titulo: "Vendo dos unidades en PH - 3513910444",
            operacion: "venta",
            tipo: "departamento",
        },
    });

    assert.equal(result.title.includes("3513910444"), false);
    assert.equal(result.title, "Vendo dos unidades en PH");
});

test("prioriza los dormitorios pedidos y agrega solo oportunidades competitivas", () => {
    const makeProperty = (id, bedrooms, price) => ({
        ...agencyProperty,
        id,
        url: `https://onoprop.com/inmueble/${id}`,
        bedrooms,
        price,
        currency: "USD",
        updated_at_ms: price,
    });
    const results = filterAndRankMcpProperties([
        makeProperty("exact-100", 2, 100000),
        makeProperty("exact-200", 2, 200000),
        makeProperty("opportunity-180", 3, 180000),
        makeProperty("too-expensive-210", 4, 210000),
    ], {
        min_bedrooms: 2,
        bedroom_search_mode: "competitive",
        sort: "price_asc",
        limit: 20,
    });

    assert.deepEqual(
        results.map((property) => property.id),
        ["exact-100", "exact-200", "opportunity-180"],
    );
    assert.equal(results[2].bedroom_match, "opportunity");
    assert.equal(results[2].bedroom_price_ceiling, 200000);
});

test("respeta todos los resultados cuando se solicitan dos dormitorios o más", () => {
    const properties = [2, 3, 4].map((bedrooms) => ({
        ...agencyProperty,
        id: `property-${bedrooms}`,
        url: `https://onoprop.com/inmueble/property-${bedrooms}`,
        bedrooms,
        price: bedrooms * 100000,
        currency: "USD",
    }));
    const results = filterAndRankMcpProperties(properties, {
        min_bedrooms: 2,
        bedroom_search_mode: "minimum",
        limit: 20,
    });

    assert.deepEqual(results.map((property) => property.bedrooms), [2, 3, 4]);
});

test("el identificador público permite recuperar ambos tipos de publicación", () => {
    assert.deepEqual(parseMcpPropertyId("agency:a1:p1"), {
        source: "agency",
        agencyId: "a1",
        propertyId: "p1",
    });
    assert.deepEqual(parseMcpPropertyId("particular:p2"), {
        source: "particular",
        propertyId: "p2",
    });
    assert.equal(parseMcpPropertyId("invalid"), null);
});

test("la ficha y las opciones comerciales devuelven URLs públicas", () => {
    const detail = buildMcpPropertyDetail(agencyProperty);
    assert.match(detail.text, /Ficha actualizada y contacto/);
    assert.match(detail.url, /^https:\/\/onoprop\.com\/inmueble\//);
    const detailUrl = new URL(detail.url);
    assert.equal(detailUrl.searchParams.get("utm_source"), "chatgpt");
    assert.equal(detailUrl.searchParams.get("utm_medium"), "plugin");
    assert.equal(detailUrl.searchParams.get("utm_campaign"), "onoprop_mcp");
    assert.equal(detailUrl.searchParams.get("utm_content"), "property_listing");

    const options = getOnopropStartOptions("publicar_inmueble");
    assert.equal(options.length, 1);
    const publishUrl = new URL(options[0].url);
    assert.equal(publishUrl.pathname, "/publicar-inmueble-gratis");
    assert.equal(publishUrl.searchParams.get("utm_content"), "publicar_inmueble");

    const appraisal = getOnopropStartOptions("solicitar_tasacion");
    assert.equal(appraisal.length, 1);
    const appraisalUrl = new URL(appraisal[0].url);
    assert.equal(appraisalUrl.pathname, "/contacto");
    assert.equal(appraisalUrl.searchParams.get("utm_content"), "solicitar_tasacion");
});

test("la ubicación precisa puede mostrar el domicilio publicado", () => {
    const location = buildPublicLocation({
        direccion: {
            calle: "San Martín",
            numero: "250",
            ciudad: "Córdoba",
            precisionMapa: "precisa",
        },
    });
    assert.equal(location, "San Martín, 250, Córdoba");
});
