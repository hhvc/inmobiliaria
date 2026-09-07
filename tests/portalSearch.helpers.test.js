import assert from "node:assert/strict";
import test from "node:test";

import {
    PORTAL_INITIAL_FILTERS,
    getPortalFiltersFromSearchParams,
    getPortalSearchParamsFromFilters,
    hasAdvancedPortalFilters,
    hasMeaningfulPortalSearch,
    matchesPortalTextSearch,
    mergePortalItems,
    requiresCompletePortalDataset,
} from "../src/inmueble/utils/portalSearch.helpers.js";

test("serializa únicamente filtros activos y omite el orden por defecto", () => {
    const params = getPortalSearchParamsFromFilters({
        ...PORTAL_INITIAL_FILTERS,
        search: "  Nueva Córdoba  ",
        operacion: "venta",
    });

    assert.equal(params.toString(), "search=Nueva+C%C3%B3rdoba&operacion=venta");
});

test("recupera filtros desde una URL preservando los valores por defecto", () => {
    const filters = getPortalFiltersFromSearchParams(
        new URLSearchParams("tipo=casa&precioMax=150000"),
    );

    assert.equal(filters.tipo, "casa");
    assert.equal(filters.precioMax, "150000");
    assert.equal(filters.sortBy, "destacados");
    assert.equal(filters.search, "");
});

test("detecta solamente filtros avanzados activos", () => {
    assert.equal(hasAdvancedPortalFilters(PORTAL_INITIAL_FILTERS), false);
    assert.equal(
        hasAdvancedPortalFilters({ ...PORTAL_INITIAL_FILTERS, operacion: "venta" }),
        false,
    );
    assert.equal(
        hasAdvancedPortalFilters({ ...PORTAL_INITIAL_FILTERS, dormitoriosMin: "2" }),
        true,
    );
});

test("acumula páginas sin duplicar publicaciones", () => {
    const merged = mergePortalItems(
        [
            { id: "a", sourceType: "inmobiliaria", titulo: "Anterior" },
            { id: "b", sourceType: "particular" },
        ],
        [
            { id: "a", sourceType: "inmobiliaria", titulo: "Actualizado" },
            { id: "a", sourceType: "particular", titulo: "Otro origen" },
        ],
    );

    assert.equal(merged.length, 3);
    assert.equal(merged[0].titulo, "Actualizado");
    assert.equal(merged[2].sourceType, "particular");
});

test("ignora el orden cuando decide si una búsqueda tiene criterios", () => {
    assert.equal(hasMeaningfulPortalSearch({ sortBy: "recientes" }), false);
    assert.equal(hasMeaningfulPortalSearch({ tipo: "casa" }), true);
});

test("busca localidades sin depender de tildes ni del formato de dirección", () => {
    assert.equal(
        matchesPortalTextSearch(
            { direccion: { localidad: "Villa Parque Síquiman" } },
            "siquiman",
        ),
        true,
    );
    assert.equal(
        matchesPortalTextSearch(
            { localidad: "Villa Parque Siquiman" },
            "síquiman",
        ),
        true,
    );
    assert.equal(
        matchesPortalTextSearch(
            { direccion: { ciudad: "Villa Carlos Paz" } },
            "síquiman",
        ),
        false,
    );
});

test("carga el conjunto completo cuando un filtro se resuelve en el cliente", () => {
    assert.equal(requiresCompletePortalDataset(PORTAL_INITIAL_FILTERS), false);
    assert.equal(
        requiresCompletePortalDataset({
            ...PORTAL_INITIAL_FILTERS,
            search: "síquiman",
        }),
        true,
    );
    assert.equal(
        requiresCompletePortalDataset({
            ...PORTAL_INITIAL_FILTERS,
            operacion: "alquiler_temporal",
        }),
        false,
    );
});
