const PROPERTY_TYPES = [
    "",
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

const PROPERTY_OPERATIONS = [
    "",
    "venta",
    "alquiler",
    "alquiler_temporal",
    "compra",
    "tasacion",
];

const CURRENCIES = ["", "USD", "ARS"];

const CONSERVATION_STATES = [
    "",
    "a_estrenar",
    "excelente",
    "muy_bueno",
    "bueno",
    "regular",
    "a_refaccionar",
];

const ORIENTATIONS = [
    "",
    "norte",
    "sur",
    "este",
    "oeste",
    "noreste",
    "noroeste",
    "sureste",
    "suroeste",
];

const AMENITY_KEYS = [
    "piscina",
    "patio",
    "jardin",
    "quincho",
    "parrilla",
    "terraza",
    "balcon",
    "lavadero",
    "dependencia",
    "escritorio",
    "vestidor",
    "calefaccion",
    "aireAcondicionado",
    "seguridad",
    "alarma",
    "aptoCredito",
    "aptoMascotas",
    "amoblado",
    "ascensor",
    "aptoProfesional",
];

const SERVICE_KEYS = [
    "agua",
    "luz",
    "gas",
    "cloacas",
    "internet",
    "pavimento",
    "telefono",
];

const STRING_FIELD_PATHS = [
    "titulo",
    "descripcion",
    "tipo",
    "operacion",
    "precio",
    "moneda",
    "expensas",
    "direccion.calle",
    "direccion.numero",
    "direccion.barrio",
    "direccion.ciudad",
    "direccion.provincia",
    "direccion.pais",
    "superficie.total",
    "superficie.cubierta",
    "superficie.semicubierta",
    "superficie.descubierta",
    "superficie.terreno",
    "caracteristicas.ambientes",
    "caracteristicas.dormitorios",
    "caracteristicas.banos",
    "caracteristicas.toilettes",
    "caracteristicas.cocherasCantidad",
    "caracteristicas.plantas",
    "caracteristicas.antiguedad",
    "caracteristicas.orientacion",
    "caracteristicas.estadoConservacion",
    "caracteristicas.piso",
    "caracteristicas.departamento",
    "medidas.frente",
    "medidas.fondo",
    "medidas.alturaTecho",
    "medidas.hectareas",
];

const BOOLEAN_FIELD_PATHS = [
    "caracteristicas.cocheras",
    ...AMENITY_KEYS.map((key) => `amenities.${key}`),
    ...SERVICE_KEYS.map((key) => `servicios.${key}`),
];

export const AI_PROPERTY_FIELD_PATHS = new Set([
    ...STRING_FIELD_PATHS,
    ...BOOLEAN_FIELD_PATHS,
]);

const stringSchema = (description = "") => ({
    type: "string",
    description,
});

const booleanSchema = (description = "") => ({
    type: "boolean",
    description,
});

const strictObject = (properties) => ({
    type: "object",
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
});

const booleanProperties = (keys) => Object.fromEntries(
    keys.map((key) => [key, booleanSchema()]),
);

export const PROPERTY_DRAFT_SCHEMA = strictObject({
    draft: strictObject({
        titulo: stringSchema("Título comercial breve, claro y verificable."),
        descripcion: stringSchema(
            "Descripción profesional en español, sin inventar datos ni contactos.",
        ),
        tipo: {
            type: "string",
            enum: PROPERTY_TYPES,
        },
        operacion: {
            type: "string",
            enum: PROPERTY_OPERATIONS,
        },
        precio: stringSchema(
            "Importe numérico sin símbolos ni separadores de miles; vacío si falta.",
        ),
        moneda: {
            type: "string",
            enum: CURRENCIES,
        },
        expensas: stringSchema(
            "Importe numérico sin símbolos ni separadores de miles; vacío si falta.",
        ),
        direccion: strictObject({
            calle: stringSchema(),
            numero: stringSchema(),
            barrio: stringSchema(),
            ciudad: stringSchema(),
            provincia: stringSchema(),
            pais: stringSchema(),
        }),
        superficie: strictObject({
            total: stringSchema("Metros cuadrados."),
            cubierta: stringSchema("Metros cuadrados."),
            semicubierta: stringSchema("Metros cuadrados."),
            descubierta: stringSchema("Metros cuadrados."),
            terreno: stringSchema("Metros cuadrados."),
        }),
        caracteristicas: strictObject({
            ambientes: stringSchema(),
            dormitorios: stringSchema(),
            banos: stringSchema(),
            toilettes: stringSchema(),
            cocheras: booleanSchema(
                "Verdadero solo si se informó que tiene al menos una cochera.",
            ),
            cocherasCantidad: stringSchema(),
            plantas: stringSchema(),
            antiguedad: stringSchema("Años; 0 únicamente si se indicó a estrenar."),
            orientacion: {
                type: "string",
                enum: ORIENTATIONS,
            },
            estadoConservacion: {
                type: "string",
                enum: CONSERVATION_STATES,
            },
            piso: stringSchema(),
            departamento: stringSchema(),
        }),
        amenities: strictObject(booleanProperties(AMENITY_KEYS)),
        servicios: strictObject(booleanProperties(SERVICE_KEYS)),
        medidas: strictObject({
            frente: stringSchema("Metros."),
            fondo: stringSchema("Metros."),
            alturaTecho: stringSchema("Metros."),
            hectareas: stringSchema(),
        }),
    }),
    detectedFields: {
        type: "array",
        description: "Rutas exactas de campos respaldados por el texto.",
        items: {
            type: "string",
            enum: Array.from(AI_PROPERTY_FIELD_PATHS),
        },
    },
    missingFields: {
        type: "array",
        items: {type: "string"},
    },
    warnings: {
        type: "array",
        items: {type: "string"},
    },
});

const cleanText = (value, maxLength = 500) => (
    typeof value === "string" ? value.trim().slice(0, maxLength) : ""
);

export const redactPrivateContactDetails = (value = "") => cleanText(
    value,
    6000,
)
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, "[dato privado omitido]")
    .replace(
        /\b(?:tel[eé]fono|tel\.?|celular|whatsapp|wsp|dni|cuit|cuil|matr[ií]cula)\s*:?\s*[+\d][\d\s()./-]{5,}/gi,
        "[dato privado omitido]",
    );

const normalizeDecimal = (value) => {
    const raw = cleanText(value, 64).replace(/\s+/g, "");
    if (!raw) return "";

    let normalized = raw;
    if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(normalized)) {
        normalized = normalized.replace(/\./g, "").replace(",", ".");
    } else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(normalized)) {
        normalized = normalized.replace(/,/g, "");
    } else {
        normalized = normalized.replace(",", ".");
    }

    return /^\d+(\.\d+)?$/.test(normalized) ? normalized : "";
};

const stringValue = (value, maxLength = 160) => cleanText(value, maxLength);

const enumValue = (value, allowed) => (
    allowed.includes(value) ? value : ""
);

const boolRecord = (value, keys) => Object.fromEntries(
    keys.map((key) => [key, value?.[key] === true]),
);

const uniqueTextList = (value, maxItems = 20, maxLength = 180) => Array.from(
    new Set(
        (Array.isArray(value) ? value : [])
            .map((item) => cleanText(item, maxLength))
            .filter(Boolean),
    ),
).slice(0, maxItems);

const getPathValue = (source, path) => path.split(".").reduce(
    (value, key) => value?.[key],
    source,
);

const isSupportedDetectedValue = (draft, path) => {
    const value = getPathValue(draft, path);
    if (BOOLEAN_FIELD_PATHS.includes(path)) return typeof value === "boolean";
    return typeof value === "string" && value.trim().length > 0;
};

export const sanitizePropertyDraftResponse = (payload = {}) => {
    const raw = payload?.draft || {};
    const draft = {
        titulo: stringValue(redactPrivateContactDetails(raw.titulo), 120),
        descripcion: stringValue(
            redactPrivateContactDetails(raw.descripcion),
            2800,
        ),
        tipo: enumValue(raw.tipo, PROPERTY_TYPES),
        operacion: enumValue(raw.operacion, PROPERTY_OPERATIONS),
        precio: normalizeDecimal(raw.precio),
        moneda: enumValue(raw.moneda, CURRENCIES),
        expensas: normalizeDecimal(raw.expensas),
        direccion: {
            calle: stringValue(raw.direccion?.calle),
            numero: stringValue(raw.direccion?.numero, 40),
            barrio: stringValue(raw.direccion?.barrio),
            ciudad: stringValue(raw.direccion?.ciudad),
            provincia: stringValue(raw.direccion?.provincia),
            pais: stringValue(raw.direccion?.pais),
        },
        superficie: {
            total: normalizeDecimal(raw.superficie?.total),
            cubierta: normalizeDecimal(raw.superficie?.cubierta),
            semicubierta: normalizeDecimal(raw.superficie?.semicubierta),
            descubierta: normalizeDecimal(raw.superficie?.descubierta),
            terreno: normalizeDecimal(raw.superficie?.terreno),
        },
        caracteristicas: {
            ambientes: normalizeDecimal(raw.caracteristicas?.ambientes),
            dormitorios: normalizeDecimal(raw.caracteristicas?.dormitorios),
            banos: normalizeDecimal(raw.caracteristicas?.banos),
            toilettes: normalizeDecimal(raw.caracteristicas?.toilettes),
            cocheras: raw.caracteristicas?.cocheras === true,
            cocherasCantidad: normalizeDecimal(
                raw.caracteristicas?.cocherasCantidad,
            ),
            plantas: normalizeDecimal(raw.caracteristicas?.plantas),
            antiguedad: normalizeDecimal(raw.caracteristicas?.antiguedad),
            orientacion: enumValue(
                raw.caracteristicas?.orientacion,
                ORIENTATIONS,
            ),
            estadoConservacion: enumValue(
                raw.caracteristicas?.estadoConservacion,
                CONSERVATION_STATES,
            ),
            piso: stringValue(raw.caracteristicas?.piso, 40),
            departamento: stringValue(
                raw.caracteristicas?.departamento,
                40,
            ),
        },
        amenities: boolRecord(raw.amenities, AMENITY_KEYS),
        servicios: boolRecord(raw.servicios, SERVICE_KEYS),
        medidas: {
            frente: normalizeDecimal(raw.medidas?.frente),
            fondo: normalizeDecimal(raw.medidas?.fondo),
            alturaTecho: normalizeDecimal(raw.medidas?.alturaTecho),
            hectareas: normalizeDecimal(raw.medidas?.hectareas),
        },
    };

    const detectedFields = Array.from(new Set([
        ...uniqueTextList(payload.detectedFields, 80, 80),
        ...(draft.titulo ? ["titulo"] : []),
        ...(draft.descripcion ? ["descripcion"] : []),
    ])).filter((path) => (
        AI_PROPERTY_FIELD_PATHS.has(path) &&
        isSupportedDetectedValue(draft, path)
    ));

    return {
        draft,
        detectedFields,
        missingFields: uniqueTextList(payload.missingFields),
        warnings: uniqueTextList(payload.warnings),
    };
};

export const extractResponseOutputText = (response = {}) => {
    if (typeof response.output_text === "string" && response.output_text.trim()) {
        return response.output_text.trim();
    }

    for (const item of Array.isArray(response.output) ? response.output : []) {
        for (const content of Array.isArray(item?.content) ? item.content : []) {
            if (content?.type === "refusal" && content.refusal) {
                throw new Error("La solicitud no pudo ser procesada por la IA.");
            }
            if (content?.type === "output_text" && content.text) {
                return content.text.trim();
            }
        }
    }

    return "";
};

export const buildPropertyDraftInstructions = () => [
    "Sos un asistente de carga de inmuebles para ONO Prop, Argentina.",
    "Convertí el texto del usuario en un borrador estructurado en español.",
    "No inventes características, superficies, ubicación, precio ni servicios.",
    "Usá cadenas vacías y booleanos false cuando un dato no esté informado.",
    "Incluí en detectedFields solamente rutas respaldadas explícitamente por el texto,",
    "salvo titulo y descripcion, que podés redactar usando únicamente los datos informados.",
    "No incluyas nombres, teléfonos, emails, matrículas, CUIT, DNI ni instrucciones privadas.",
    "El título debe ser breve. La descripción debe ser profesional, clara y sin exageraciones.",
    "No uses markdown en titulo ni descripcion.",
    "En missingFields enumerá datos comercialmente importantes que falten.",
    "En warnings señalá contradicciones o ambigüedades que el usuario deba revisar.",
].join(" ");

