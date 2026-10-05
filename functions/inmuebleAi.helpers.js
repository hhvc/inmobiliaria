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

const REVIEW_READINESS = ["ready", "needs_review", "incomplete"];
const REVIEW_SEVERITIES = ["info", "warning", "critical"];
const PHOTO_SCENES = [
    "exterior",
    "living",
    "cocina",
    "dormitorio",
    "bano",
    "amenity",
    "vista",
    "plano",
    "otro",
];
const PHOTO_QUALITIES = ["strong", "usable", "weak"];

export const PROPERTY_REVIEW_SCHEMA = strictObject({
    review: strictObject({
        score: {
            type: "integer",
            minimum: 0,
            maximum: 100,
            description: "Nivel de preparación comercial de la publicación.",
        },
        readiness: {
            type: "string",
            enum: REVIEW_READINESS,
        },
        issues: {
            type: "array",
            items: strictObject({
                severity: {
                    type: "string",
                    enum: REVIEW_SEVERITIES,
                },
                field: stringSchema("Campo o sección relacionada."),
                message: stringSchema("Observación concreta y accionable."),
            }),
        },
        missingFields: {
            type: "array",
            items: {type: "string"},
        },
        contradictions: {
            type: "array",
            items: {type: "string"},
        },
    }),
    suggestions: strictObject({
        title: stringSchema("Título comercial breve y verificable."),
        portalDescription: stringSchema(
            "Descripción profesional para la ficha pública de ONO Prop.",
        ),
        instagramCaption: stringSchema(
            "Texto breve para Instagram, sin datos de contacto inventados.",
        ),
        mercadoLibreDescription: stringSchema(
            "Descripción clara para Mercado Libre, sin markdown ni contactos.",
        ),
    }),
});

export const PROPERTY_IMAGE_REVIEW_SCHEMA = strictObject({
    coverIndex: {
        type: "integer",
        minimum: 0,
        maximum: 5,
    },
    orderedIndexes: {
        type: "array",
        items: {
            type: "integer",
            minimum: 0,
            maximum: 5,
        },
    },
    photos: {
        type: "array",
        items: strictObject({
            index: {
                type: "integer",
                minimum: 0,
                maximum: 5,
            },
            scene: {
                type: "string",
                enum: PHOTO_SCENES,
            },
            quality: {
                type: "string",
                enum: PHOTO_QUALITIES,
            },
            strengths: {
                type: "array",
                items: {type: "string"},
            },
            issues: {
                type: "array",
                items: {type: "string"},
            },
            privacyRisks: {
                type: "array",
                items: {type: "string"},
            },
            suggestedCaption: stringSchema(
                "Descripción objetiva y breve de la foto.",
            ),
        }),
    },
    coverageGaps: {
        type: "array",
        items: {type: "string"},
    },
    generalWarnings: {
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

const cleanPublicRecord = (value, allowedKeys) => Object.fromEntries(
    allowedKeys
        .filter((key) => value?.[key] === true)
        .map((key) => [key, true]),
);

const cleanPublicObject = (value, allowedKeys, maxLength = 160) =>
    Object.fromEntries(allowedKeys.map((key) => [
        key,
        typeof value?.[key] === "boolean" ?
            value[key] : cleanText(value?.[key]?.toString(), maxLength),
    ]));

const escapeRegularExpression = (value = "") => value.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&",
);

const redactKnownExactAddress = (description, address = {}) => {
    let value = redactPrivateContactDetails(description);
    const street = cleanText(address?.calle, 160);

    if (street.length >= 3) {
        value = value.replace(
            new RegExp(escapeRegularExpression(street), "gi"),
            "[ubicación exacta omitida]",
        );
    }

    return value;
};

export const sanitizePropertyReviewInput = (property = {}) => ({
    titulo: cleanText(property?.titulo, 160),
    descripcion: redactKnownExactAddress(
        property?.descripcion,
        property?.direccion,
    ).slice(0, 4000),
    tipo: cleanText(property?.tipo, 80),
    operacion: cleanText(property?.operacion, 80),
    precio: cleanText(property?.precio?.toString(), 80),
    moneda: cleanText(property?.moneda, 20),
    expensas: cleanText(property?.expensas?.toString(), 80),
    ubicacionAproximada: cleanPublicObject(property?.direccion, [
        "barrio",
        "ciudad",
        "provincia",
        "pais",
    ]),
    superficie: cleanPublicObject(property?.superficie, [
        "total",
        "cubierta",
        "semicubierta",
        "descubierta",
        "terreno",
    ]),
    caracteristicas: cleanPublicObject(property?.caracteristicas, [
        "ambientes",
        "dormitorios",
        "banos",
        "toilettes",
        "cocheras",
        "cocherasCantidad",
        "plantas",
        "antiguedad",
        "orientacion",
        "estadoConservacion",
        "piso",
        "departamento",
    ]),
    amenities: cleanPublicRecord(property?.amenities, AMENITY_KEYS),
    servicios: cleanPublicRecord(property?.servicios, SERVICE_KEYS),
    cantidadImagenes: Array.isArray(property?.images) ?
        property.images.filter((image) => image?.url).length : 0,
    cantidadVideos: Array.isArray(property?.videos) ?
        property.videos.filter((video) => video?.url || video?.sourceUrl).length : 0,
});

const sanitizeReviewIssue = (issue = {}) => ({
    severity: REVIEW_SEVERITIES.includes(issue?.severity) ?
        issue.severity : "info",
    field: cleanText(issue?.field, 100),
    message: cleanText(redactPrivateContactDetails(issue?.message), 320),
});

export const sanitizePropertyReviewResponse = (payload = {}) => {
    const numericScore = Math.round(Number(payload?.review?.score || 0));
    const readiness = REVIEW_READINESS.includes(payload?.review?.readiness) ?
        payload.review.readiness : "incomplete";

    return {
        review: {
            score: Number.isFinite(numericScore) ?
                Math.max(0, Math.min(100, numericScore)) : 0,
            readiness,
            issues: (Array.isArray(payload?.review?.issues) ?
                payload.review.issues : [])
                .map(sanitizeReviewIssue)
                .filter((issue) => issue.message)
                .slice(0, 20),
            missingFields: uniqueTextList(
                payload?.review?.missingFields,
                20,
                180,
            ),
            contradictions: uniqueTextList(
                payload?.review?.contradictions,
                20,
                240,
            ),
        },
        suggestions: {
            title: cleanText(
                redactPrivateContactDetails(payload?.suggestions?.title),
                120,
            ),
            portalDescription: cleanText(
                redactPrivateContactDetails(
                    payload?.suggestions?.portalDescription,
                ),
                3000,
            ),
            instagramCaption: cleanText(
                redactPrivateContactDetails(
                    payload?.suggestions?.instagramCaption,
                ),
                2200,
            ),
            mercadoLibreDescription: cleanText(
                redactPrivateContactDetails(
                    payload?.suggestions?.mercadoLibreDescription,
                ),
                3000,
            ),
        },
    };
};

export const sanitizePropertyImageUrls = (images = [], maxImages = 6) => (
    (Array.isArray(images) ? images : [])
        .map((image) => cleanText(
            typeof image === "string" ? image :
                image?.thumbnailUrl || image?.url,
            2000,
        ))
        .filter((url) => /^https:\/\/[^\s]+$/i.test(url))
        .slice(0, maxImages)
);

export const sanitizePropertyImageReviewResponse = (
    payload = {},
    imageCount = 0,
) => {
    const safeImageCount = Math.max(0, Math.min(6, Number(imageCount || 0)));
    const isValidIndex = (value) => Number.isInteger(Number(value)) &&
        Number(value) >= 0 && Number(value) < safeImageCount;
    const rawOrder = Array.isArray(payload?.orderedIndexes) ?
        payload.orderedIndexes : [];
    const orderedIndexes = Array.from(new Set(
        rawOrder.map(Number).filter(isValidIndex),
    ));
    for (let index = 0; index < safeImageCount; index += 1) {
        if (!orderedIndexes.includes(index)) orderedIndexes.push(index);
    }

    const rawCoverIndex = Number(payload?.coverIndex);
    const coverIndex = isValidIndex(rawCoverIndex) ?
        rawCoverIndex : orderedIndexes[0] || 0;
    const coverPosition = orderedIndexes.indexOf(coverIndex);
    if (coverPosition > 0) {
        orderedIndexes.splice(coverPosition, 1);
        orderedIndexes.unshift(coverIndex);
    }
    const photosByIndex = new Map();

    for (const photo of Array.isArray(payload?.photos) ? payload.photos : []) {
        const index = Number(photo?.index);
        if (!isValidIndex(index) || photosByIndex.has(index)) continue;
        photosByIndex.set(index, {
            index,
            scene: PHOTO_SCENES.includes(photo?.scene) ? photo.scene : "otro",
            quality: PHOTO_QUALITIES.includes(photo?.quality) ?
                photo.quality : "usable",
            strengths: uniqueTextList(photo?.strengths, 8, 160),
            issues: uniqueTextList(photo?.issues, 8, 180),
            privacyRisks: uniqueTextList(photo?.privacyRisks, 8, 180),
            suggestedCaption: cleanText(
                redactPrivateContactDetails(photo?.suggestedCaption),
                240,
            ),
        });
    }

    return {
        coverIndex,
        orderedIndexes,
        photos: [...photosByIndex.values()].sort(
            (left, right) => left.index - right.index,
        ),
        coverageGaps: uniqueTextList(payload?.coverageGaps, 12, 180),
        generalWarnings: uniqueTextList(payload?.generalWarnings, 12, 220),
    };
};

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

export const buildPropertyReviewInstructions = () => [
    "Sos un revisor de publicaciones inmobiliarias para ONO Prop, Argentina.",
    "Analizá únicamente los datos públicos estructurados que recibís.",
    "No inventes características, ubicación, superficies, precio, servicios ni condiciones.",
    "Detectá faltantes comercialmente relevantes y contradicciones internas concretas.",
    "No exijas dirección exacta: barrio, ciudad y provincia pueden ser suficientes para publicar.",
    "La puntuación mide preparación y claridad comercial, no el valor del inmueble.",
    "Redactá un título breve y una descripción profesional para ONO Prop.",
    "Prepará también un texto para Instagram y otro para Mercado Libre.",
    "Instagram puede usar emojis y pocos hashtags pertinentes; no uses exageraciones.",
    "No uses markdown en el título, la descripción del portal ni Mercado Libre.",
    "No incluyas nombres, teléfonos, emails, matrículas, CUIT, DNI, coordenadas ni dirección exacta.",
    "Si faltan datos esenciales, sugerí textos prudentes con lo efectivamente informado.",
].join(" ");

export const buildPropertyImageReviewInstructions = () => [
    "Sos un editor visual inmobiliario para ONO Prop, Argentina.",
    "Recibirás hasta seis fotos numeradas en el orden actual de una publicación.",
    "Analizá composición, luz, nitidez, utilidad comercial y cobertura de ambientes.",
    "Elegí una portada clara y atractiva sin afirmar características no visibles.",
    "Proponé un orden que empiece por la mejor vista general y luego muestre los espacios con variedad.",
    "No identifiques personas ni infieras identidad, origen, situación económica u otros datos sensibles.",
    "Marcá como riesgo de privacidad rostros visibles, matrículas de vehículos, documentos, fotos familiares, patentes o numeración domiciliaria legible.",
    "No recomiendes alterar estructuralmente el inmueble ni generar imágenes engañosas.",
    "Las leyendas deben ser objetivas, breves y basadas solo en lo visible.",
    "orderedIndexes debe contener todos los índices recibidos exactamente una vez.",
].join(" ");

