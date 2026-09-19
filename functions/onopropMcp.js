import admin from "firebase-admin";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { onRequest } from "firebase-functions/v2/https";
import * as z from "zod/v4";

import {
    buildMcpPropertyDetail,
    filterAndRankMcpProperties,
    getOnopropStartOptions,
    mapAgencyListingForMcp,
    mapParticularListingForMcp,
    parseMcpPropertyId,
} from "./onopropMcp.helpers.js";
import {
    recordOnopropMcpPropertyDetail,
    recordOnopropMcpSearch,
    recordOnopropMcpStart,
} from "./onopropAcquisition.js";

if (!admin.apps.length) admin.initializeApp();

const db = admin.firestore();
const REGION = "southamerica-east1";
const SERVER_VERSION = "0.8.0";
const MAX_CANDIDATES_PER_SOURCE = 80;
const SEARCH_CACHE_TTL_MS = 30 * 1000;
const MAX_SEARCH_CACHE_ENTRIES = 50;
const searchCache = new Map();

const PROPERTY_OPERATIONS = ["venta", "alquiler", "alquiler_temporal"];
const PROPERTY_TYPES = [
    "casa",
    "departamento",
    "terreno",
    "local",
    "oficina",
    "cochera",
    "deposito",
    "quinta",
    "campo",
];

const SearchResultSchema = z.object({
    id: z.string(),
    title: z.string(),
    url: z.string(),
    operation: z.string(),
    operation_label: z.string(),
    property_type: z.string(),
    property_type_label: z.string(),
    location: z.string(),
    price: z.number().nullable(),
    currency: z.string(),
    bedrooms: z.number().nullable(),
    bathrooms: z.number().nullable(),
    parking_spaces: z.number().nullable(),
    total_area_m2: z.number().nullable(),
    source: z.enum(["inmobiliaria", "particular"]),
    publisher_name: z.string(),
    image_url: z.string(),
    summary: z.string(),
});

const PropertyDetailSchema = SearchResultSchema.extend({
    description: z.string(),
    text: z.string(),
});

const StartOptionSchema = z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    url: z.string(),
});

const summarizeDescription = (value, maxLength = 360) => {
    const text = String(value || "").replace(/\s+/g, " ").trim();
    if (text.length <= maxLength) return text;
    return `${text.slice(0, maxLength - 1).trimEnd()}…`;
};

const buildSearchSummary = (property = {}) => {
    const description = summarizeDescription(property.description);
    if (property.bedroom_match === "opportunity") {
        return [
            `Oportunidad por precio: ofrece ${property.bedrooms} dormitorios y no supera el mayor precio publicado entre las opciones de ${property.bedroom_target} dormitorios en ${property.currency}.`,
            description,
        ].filter(Boolean).join(" ");
    }
    if (property.bedroom_match === "alternative") {
        return [
            `Alternativa disponible: ofrece ${property.bedrooms} dormitorios porque no se encontraron opciones de exactamente ${property.bedroom_target}.`,
            description,
        ].filter(Boolean).join(" ");
    }
    return description;
};

const toSearchResult = (property = {}) => ({
    id: property.id,
    title: property.title,
    url: property.url,
    operation: property.operation,
    operation_label: property.operation_label,
    property_type: property.property_type,
    property_type_label: property.property_type_label,
    location: property.location,
    price: property.price,
    currency: property.currency,
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms,
    parking_spaces: property.parking_spaces,
    total_area_m2: property.total_area_m2,
    source: property.source,
    publisher_name: property.publisher_name,
    image_url: property.image_url,
    summary: buildSearchSummary(property),
});

const getAgencyIdFromSnapshot = (snapshot) => {
    const segments = snapshot.ref.path.split("/");
    const agencyIndex = segments.indexOf("inmobiliarias");
    return agencyIndex >= 0 ? segments[agencyIndex + 1] || "" : "";
};

const getCachedSearch = (cacheKey) => {
    const cached = searchCache.get(cacheKey);
    if (!cached || Date.now() - cached.createdAt > SEARCH_CACHE_TTL_MS) {
        searchCache.delete(cacheKey);
        return null;
    }
    return cached.value;
};

const setCachedSearch = (cacheKey, value) => {
    if (searchCache.size >= MAX_SEARCH_CACHE_ENTRIES) {
        const oldestKey = searchCache.keys().next().value;
        if (oldestKey) searchCache.delete(oldestKey);
    }
    searchCache.set(cacheKey, { createdAt: Date.now(), value });
};

const loadAgencyCandidates = async (filters = {}) => {
    const query = db.collectionGroup("inmuebles")
        .where("deleted", "==", false)
        .where("estado", "==", "activo")
        .where("publicarEnPortal", "==", true);

    let filteredQuery = query;
    if (filters.operation) {
        filteredQuery = filteredQuery.where("operacion", "==", filters.operation);
    }
    if (filters.property_type) {
        filteredQuery = filteredQuery.where("tipo", "==", filters.property_type);
    }

    const snapshot = await filteredQuery.limit(MAX_CANDIDATES_PER_SOURCE).get();
    return snapshot.docs.map((docSnapshot) => mapAgencyListingForMcp({
        id: docSnapshot.id,
        agencyId: getAgencyIdFromSnapshot(docSnapshot),
        listing: docSnapshot.data() || {},
    }));
};

const loadParticularCandidates = async (filters = {}) => {
    let query = db.collection("particular_publications")
        .where("publicationType", "==", "particular")
        .where("publicStatus", "==", "active")
        .where("moderationStatus", "==", "approved");

    if (filters.operation) {
        query = query.where("operacion", "==", filters.operation);
    }
    if (filters.property_type) {
        query = query.where("tipo", "==", filters.property_type);
    }

    const snapshot = await query
        .orderBy("createdAt", "desc")
        .limit(MAX_CANDIDATES_PER_SOURCE)
        .get();

    return snapshot.docs.map((docSnapshot) => mapParticularListingForMcp({
        id: docSnapshot.id,
        listing: docSnapshot.data() || {},
    }));
};

export const searchPublicPropertiesForMcp = async (filters = {}) => {
    const cacheKey = JSON.stringify(filters);
    const cached = getCachedSearch(cacheKey);
    if (cached) return cached;

    const includeAgencies = !filters.source || ["all", "inmobiliaria"].includes(
        filters.source,
    );
    const includeParticulars = !filters.source || ["all", "particular"].includes(
        filters.source,
    );
    const [agencyProperties, particularProperties] = await Promise.all([
        includeAgencies ? loadAgencyCandidates(filters) : Promise.resolve([]),
        includeParticulars ? loadParticularCandidates(filters) : Promise.resolve([]),
    ]);
    const results = filterAndRankMcpProperties(
        [...agencyProperties, ...particularProperties],
        filters,
    );

    setCachedSearch(cacheKey, results);
    return results;
};

const assertPublicAgencyProperty = (property = {}) => (
    property.deleted === false &&
    property.estado === "activo" &&
    property.publicarEnPortal === true
);

const assertPublicParticularProperty = (property = {}) => (
    property.publicationType === "particular" &&
    property.publicStatus === "active" &&
    property.moderationStatus === "approved"
);

export const getPublicPropertyForMcp = async (publicId) => {
    const parsedId = parseMcpPropertyId(publicId);
    if (!parsedId) throw new Error("El identificador de la publicación no es válido.");

    if (parsedId.source === "particular") {
        const snapshot = await db.collection("particular_publications")
            .doc(parsedId.propertyId)
            .get();
        const property = snapshot.data() || {};
        if (!snapshot.exists || !assertPublicParticularProperty(property)) {
            throw new Error("La publicación ya no está disponible en ONO Prop.");
        }
        return buildMcpPropertyDetail(mapParticularListingForMcp({
            id: snapshot.id,
            listing: property,
        }));
    }

    const [propertySnapshot, agencySnapshot] = await Promise.all([
        db.collection("inmobiliarias")
            .doc(parsedId.agencyId)
            .collection("inmuebles")
            .doc(parsedId.propertyId)
            .get(),
        db.collection("inmobiliarias").doc(parsedId.agencyId).get(),
    ]);
    const property = propertySnapshot.data() || {};
    if (!propertySnapshot.exists || !assertPublicAgencyProperty(property)) {
        throw new Error("La publicación ya no está disponible en ONO Prop.");
    }

    return buildMcpPropertyDetail(mapAgencyListingForMcp({
        id: propertySnapshot.id,
        agencyId: parsedId.agencyId,
        listing: property,
        agency: agencySnapshot.data() || {},
    }));
};

const asToolResponse = (structuredContent) => ({
    structuredContent,
    content: [
        {
            type: "text",
            text: JSON.stringify(structuredContent),
        },
    ],
});

export const createOnopropMcpServer = () => {
    const server = new McpServer(
        {
            name: "onoprop",
            version: SERVER_VERSION,
        },
        {
            instructions: "Usá ONO Prop para buscar inmuebles publicados y obtener fichas actualizadas. Cada resultado representa una ficha pública distinta: presentalos todos aunque parezcan unidades similares o el mismo inmueble ofrecido por más de una inmobiliaria. Podés señalar la similitud sin afirmar que son duplicados. Presentá siempre los campos url como enlaces. No agregues datos ausentes, borradores, autocorrecciones ni errores que la herramienta no haya informado. No muestres teléfonos ni emails: orientá al contacto mediante la ficha. Para publicar gratis, conocer servicios para inmobiliarias o solicitar una tasación profesional, usá onoprop.get_started.",
        },
    );

    server.registerTool(
        "onoprop.search_properties",
        {
            title: "Buscar inmuebles en ONO Prop",
            description: "Usá esta herramienta cuando la persona quiera encontrar inmuebles actualmente publicados en ONO Prop, incluidos alquileres temporales. Cada resultado tiene una ficha e identificador propios: no omitas resultados por compartir domicilio, precio o características. Interpretá 'Córdoba' como la ciudad de Córdoba; usá location_scope=province solo si la persona pide expresamente la provincia. Para una cantidad de dormitorios expresada sin 'al menos' ni 'o más', usá bedroom_search_mode=competitive: devuelve primero esa cantidad y luego oportunidades con más dormitorios que no superan el mayor precio de las coincidencias exactas en la misma moneda. No la uses para tasaciones, precios históricos ni información privada.",
            inputSchema: {
                query: z.string()
                    .max(200)
                    .optional()
                    .describe("Texto libre, por ejemplo: 'cerca del lago en Síquiman'."),
                operation: z.enum(PROPERTY_OPERATIONS)
                    .optional()
                    .describe("Operación: venta, alquiler o alquiler_temporal."),
                property_type: z.enum(PROPERTY_TYPES)
                    .optional()
                    .describe("Tipo de inmueble solicitado."),
                location: z.string()
                    .max(120)
                    .optional()
                    .describe("Nombre geográfico buscado. 'Córdoba' significa la ciudad; para toda la provincia usá Córdoba con location_scope=province."),
                location_scope: z.enum([
                    "auto",
                    "city",
                    "province",
                    "neighborhood",
                ])
                    .default("auto")
                    .describe("Alcance de location. Usá city para localidades o ciudades, province solo cuando se pida expresamente una provincia y neighborhood cuando se identifique un barrio. Auto también reconoce expresiones como 'Provincia de Córdoba'."),
                currency: z.enum(["ARS", "USD"])
                    .optional()
                    .describe("Moneda de los límites de precio. Indicála si usás min_price o max_price."),
                min_price: z.number()
                    .nonnegative()
                    .optional()
                    .describe("Precio mínimo publicado, expresado en currency."),
                max_price: z.number()
                    .nonnegative()
                    .optional()
                    .describe("Precio máximo publicado, expresado en currency."),
                min_bedrooms: z.number()
                    .int()
                    .nonnegative()
                    .max(50)
                    .optional()
                    .describe("Cantidad de dormitorios solicitada o mínima, según bedroom_search_mode."),
                bedroom_search_mode: z.enum(["competitive", "minimum"])
                    .default("competitive")
                    .describe("Usá competitive para '2 dormitorios': prioriza 2 y suma oportunidades más amplias con precio competitivo. Usá minimum solo si la persona dice 'al menos 2', '2 o más' o equivalente."),
                source: z.enum(["all", "inmobiliaria", "particular"])
                    .default("all")
                    .describe("Origen de la publicación. Usá all salvo que se pida uno."),
                sort: z.enum(["relevance", "recent", "price_asc", "price_desc"])
                    .default("relevance")
                    .describe("Orden deseado de los resultados."),
                limit: z.number()
                    .int()
                    .min(1)
                    .max(20)
                    .default(10)
                    .describe("Cantidad máxima de resultados, entre 1 y 20."),
            },
            outputSchema: {
                results: z.array(SearchResultSchema),
                count: z.number().int().nonnegative(),
            },
            annotations: {
                readOnlyHint: true,
                openWorldHint: false,
                destructiveHint: false,
            },
        },
        async (filters) => {
            const startedAt = Date.now();
            const properties = await searchPublicPropertiesForMcp(filters);
            const results = properties.map(toSearchResult);
            console.info("[ONO Prop MCP] search completed", {
                count: results.length,
                durationMs: Date.now() - startedAt,
            });
            await recordOnopropMcpSearch(filters, results.length);
            return asToolResponse(
                { results, count: results.length },
            );
        },
    );

    server.registerTool(
        "onoprop.get_property",
        {
            title: "Consultar una ficha de ONO Prop",
            description: "Usá esta herramienta para obtener los datos públicos actualizados de una publicación encontrada con onoprop.search_properties. Presentá el texto y el enlace de ficha devueltos. No devuelve teléfonos, emails ni datos administrativos; no inventes ni completes datos ausentes.",
            inputSchema: {
                property_id: z.string()
                    .min(1)
                    .max(400)
                    .describe("Identificador exacto devuelto por onoprop.search_properties."),
            },
            outputSchema: {
                property: PropertyDetailSchema,
            },
            annotations: {
                readOnlyHint: true,
                openWorldHint: false,
                destructiveHint: false,
            },
        },
        async ({ property_id: propertyId }) => {
            const property = await getPublicPropertyForMcp(propertyId);
            console.info("[ONO Prop MCP] property fetched", {
                source: property.source,
            });
            const structuredContent = {
                property: {
                    ...toSearchResult(property),
                    description: property.description,
                    text: property.text,
                },
            };
            await recordOnopropMcpPropertyDetail();
            return asToolResponse(structuredContent);
        },
    );

    server.registerTool(
        "onoprop.get_started",
        {
            title: "Empezar a usar ONO Prop",
            description: "Usá esta herramienta cuando una persona quiera publicar un inmueble gratis, incorporar su inmobiliaria, conocer el software y los servicios o solicitar una tasación profesional. Mostrá siempre el enlace devuelto. Solo informá un error si la herramienta devuelve un error; no crea cuentas ni envía datos.",
            inputSchema: {
                goal: z.enum([
                    "publicar_inmueble",
                    "sumar_inmobiliaria",
                    "contratar_software",
                    "solicitar_tasacion",
                ]).optional().describe("Objetivo principal de la persona. Omitilo para ver todas las opciones."),
            },
            outputSchema: {
                options: z.array(StartOptionSchema),
            },
            annotations: {
                readOnlyHint: true,
                openWorldHint: false,
                destructiveHint: false,
            },
        },
        async ({ goal }) => {
            const options = getOnopropStartOptions(goal);
            await recordOnopropMcpStart(goal);
            return asToolResponse(
                { options },
            );
        },
    );

    return server;
};

const setMcpCorsHeaders = (response) => {
    response.set("Access-Control-Allow-Origin", "*");
    response.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    response.set(
        "Access-Control-Allow-Headers",
        "Content-Type, Accept, MCP-Protocol-Version, MCP-Session-Id, Last-Event-ID",
    );
    response.set(
        "Access-Control-Expose-Headers",
        "MCP-Protocol-Version, MCP-Session-Id",
    );
};

export const handleOnopropMcpRequest = async (request, response) => {
    setMcpCorsHeaders(response);

    if (request.method === "OPTIONS") {
        response.status(204).end();
        return;
    }

    if (request.method !== "POST") {
        response.status(405).json({
            jsonrpc: "2.0",
            error: { code: -32000, message: "Method not allowed." },
            id: null,
        });
        return;
    }

    const server = createOnopropMcpServer();
    const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
    });

    response.on("close", () => {
        void transport.close();
        void server.close();
    });

    try {
        await server.connect(transport);
        await transport.handleRequest(request, response, request.body);
    } catch (error) {
        console.error("[ONO Prop MCP] request failed", {
            message: error instanceof Error ? error.message : "Unknown error",
        });
        if (!response.headersSent) {
            response.status(500).json({
                jsonrpc: "2.0",
                error: { code: -32603, message: "Internal server error" },
                id: null,
            });
        }
    }
};

export const onopropMcp = onRequest(
    {
        region: REGION,
        invoker: "public",
        timeoutSeconds: 60,
        memory: "512MiB",
        maxInstances: 5,
        cors: false,
    },
    handleOnopropMcpRequest,
);
