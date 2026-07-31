import assert from "node:assert/strict";
import test from "node:test";

import {
    buildMercadoLibreLocationDefaults,
    buildMercadoLibreDraftPayload,
    findMercadoLibreOptionByName,
    validateMercadoLibreDraft,
} from "../src/inmueble/utils/mercadoLibreDistribution.helpers.js";

const validInmueble = {
    id: "inmueble-1",
    titulo: "Casa de prueba en Córdoba",
    descripcion:
        "Casa de prueba con ambientes amplios, patio, cochera y excelente ubicación.",
    tipo: "casa",
    operacion: "venta",
    precio: "125000.50",
    moneda: "USD",
    direccion: {
        calle: "San Martín",
        numero: "123",
        barrio: "Centro",
        ciudad: "Córdoba",
    },
    superficie: {
        cubierta: 90,
        total: 180,
    },
    caracteristicas: {
        ambientes: 4,
        dormitorios: 3,
        banos: 2,
        cocherasCantidad: 1,
    },
    images: [
        {
            url: "https://images.example.com/casa-1.jpg",
            order: 0,
        },
    ],
};

test("construye el payload inmobiliario con la estructura oficial", () => {
    const payload = buildMercadoLibreDraftPayload({
        inmueble: validInmueble,
        categoryId: "MLA401685",
        listingTypeId: "silver",
        publicUrl: "https://onoprop.com/inmueble/casa-prueba",
        mercadoLibreLocation: {
            stateId: "STATE-1",
            cityId: "CITY-1",
            neighborhoodId: "NEIGHBORHOOD-1",
            zipCode: "5000",
            latitude: -31.4167,
            longitude: -64.1833,
        },
        mercadoLibreContact: {
            name: "ONO Prop",
            email: "contacto@example.com",
            areaCode: "351",
            phone: "5555555",
        },
    });

    assert.equal(payload.category_id, "MLA401685");
    assert.equal(payload.listing_type_id, "silver");
    assert.equal(payload.buying_mode, "classified");
    assert.deepEqual(payload.channels, ["marketplace"]);
    assert.equal(payload.price, 125000.5);
    assert.equal(payload.location.city.id, "CITY-1");
    assert.equal(payload.location.latitude, -31.4167);
    assert.equal(payload.seller_contact.email, "contacto@example.com");
    assert.equal(payload.pictures.length, 1);
    assert.equal(
        payload.attributes.find((attribute) => attribute.id === "TOTAL_AREA")
            .value_name,
        "180 m²",
    );
    assert.equal("metadata" in payload, false);
});

test("bloquea categoría y precio faltantes", () => {
    const validation = validateMercadoLibreDraft({
        inmueble: {
            ...validInmueble,
            precio: "",
        },
        categoryId: "",
    });

    assert.equal(validation.isReady, false);
    assert.ok(
        validation.errors.some((error) => error.includes("category_id")),
    );
    assert.ok(validation.errors.some((error) => error.includes("precio")));
});

test("bloquea un inmueble sin imágenes", () => {
    const validation = validateMercadoLibreDraft({
        inmueble: {
            ...validInmueble,
            images: [],
        },
        categoryId: "MLA401685",
    });

    assert.equal(validation.isReady, false);
    assert.ok(validation.errors.some((error) => error.includes("fotos")));
});

test("precarga la dirección desde la ficha y conserva valores ya guardados", () => {
    const defaults = buildMercadoLibreLocationDefaults(validInmueble, {
        zipCode: "5000",
        stateId: "AR-X",
    });

    assert.equal(defaults.addressLine, "San Martín 123");
    assert.equal(defaults.zipCode, "5000");
    assert.equal(defaults.stateId, "AR-X");

    const savedAddress = buildMercadoLibreLocationDefaults(validInmueble, {
        addressLine: "Dirección reservada",
    });
    assert.equal(savedAddress.addressLine, "Dirección reservada");
});

test("encuentra ubicaciones ignorando mayúsculas y tildes", () => {
    const option = findMercadoLibreOptionByName(
        [
            { id: "AR-C", name: "Córdoba" },
            { id: "AR-S", name: "Santa Fe" },
        ],
        "cordoba",
    );

    assert.deepEqual(option, { id: "AR-C", name: "Córdoba" });
});
