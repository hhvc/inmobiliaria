/* =========================================================
   Diccionario ampliado de datos del inmueble
   ONO Prop - Portal + CRM + Red de colegas
   ========================================================= */

/*
  Criterio:
  - Mantener compatibilidad con campos planos actuales:
    ambientes, dormitorios, banos, cocheras, superficie.total, etc.
  - Agregar estructura nueva más robusta:
    caracteristicas, amenities, servicios, medidas, publicacionCalidad.
  - No obligar a completar todo para guardar.
  - Usar estos datos para mejorar filtros, tarjetas, calidad de publicación
    y futuras integraciones CRM / Red.
*/

export const DEFAULT_SUPERFICIE = {
    total: "",
    cubierta: "",
    semicubierta: "",
    descubierta: "",
    terreno: "",
    frente: "",
    fondo: "",
};

export const DEFAULT_CARACTERISTICAS = {
    ambientes: "",
    dormitorios: "",
    banos: "",
    toilettes: "",
    cocheras: false,
    cocherasCantidad: "",
    plantas: "",
    antiguedad: "",
    orientacion: "",
    estadoConservacion: "",
    piso: "",
    departamento: "",
};

export const DEFAULT_AMENITIES = {
    piscina: false,
    patio: false,
    jardin: false,
    quincho: false,
    parrilla: false,
    terraza: false,
    balcon: false,
    lavadero: false,
    dependencia: false,
    escritorio: false,
    vestidor: false,
    calefaccion: false,
    aireAcondicionado: false,
    seguridad: false,
    alarma: false,
    aptoCredito: false,
    aptoMascotas: false,
    amoblado: false,
    ascensor: false,
    aptoProfesional: false,
};

export const DEFAULT_SERVICIOS = {
    agua: false,
    luz: false,
    gas: false,
    cloacas: false,
    internet: false,
    pavimento: false,
    telefono: false,
};

export const DEFAULT_MEDIDAS = {
    frente: "",
    fondo: "",
    alturaTecho: "",
    hectareas: "",
};

export const ESTADOS_CONSERVACION = [
    { id: "", label: "Sin especificar" },
    { id: "a_estrenar", label: "A estrenar" },
    { id: "excelente", label: "Excelente" },
    { id: "muy_bueno", label: "Muy bueno" },
    { id: "bueno", label: "Bueno" },
    { id: "regular", label: "Regular" },
    { id: "a_refaccionar", label: "A refaccionar" },
];

export const ORIENTACIONES = [
    { id: "", label: "Sin especificar" },
    { id: "norte", label: "Norte" },
    { id: "sur", label: "Sur" },
    { id: "este", label: "Este" },
    { id: "oeste", label: "Oeste" },
    { id: "noreste", label: "Noreste" },
    { id: "noroeste", label: "Noroeste" },
    { id: "sureste", label: "Sureste" },
    { id: "suroeste", label: "Suroeste" },
];

export const AMENITIES_LABELS = {
    piscina: "Piscina",
    patio: "Patio",
    jardin: "Jardín",
    quincho: "Quincho",
    parrilla: "Parrilla",
    terraza: "Terraza",
    balcon: "Balcón",
    lavadero: "Lavadero",
    dependencia: "Dependencia",
    escritorio: "Escritorio",
    vestidor: "Vestidor",
    calefaccion: "Calefacción",
    aireAcondicionado: "Aire acondicionado",
    seguridad: "Seguridad",
    alarma: "Alarma",
    aptoCredito: "Apto crédito",
    aptoMascotas: "Apto mascotas",
    amoblado: "Amoblado",
    ascensor: "Ascensor",
    aptoProfesional: "Apto profesional",
};

export const SERVICIOS_LABELS = {
    agua: "Agua",
    luz: "Luz",
    gas: "Gas",
    cloacas: "Cloacas",
    internet: "Internet",
    pavimento: "Pavimento",
    telefono: "Teléfono",
};

export const AMENITIES_BY_TIPO = {
    casa: [
        "piscina",
        "patio",
        "jardin",
        "quincho",
        "parrilla",
        "terraza",
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
    ],

    departamento: [
        "balcon",
        "terraza",
        "lavadero",
        "dependencia",
        "escritorio",
        "vestidor",
        "calefaccion",
        "aireAcondicionado",
        "seguridad",
        "alarma",
        "ascensor",
        "piscina",
        "parrilla",
        "aptoCredito",
        "aptoMascotas",
        "amoblado",
        "aptoProfesional",
    ],

    terreno: ["aptoCredito"],

    local: [
        "seguridad",
        "alarma",
        "aireAcondicionado",
        "calefaccion",
        "aptoProfesional",
    ],

    oficina: [
        "seguridad",
        "alarma",
        "aireAcondicionado",
        "calefaccion",
        "ascensor",
        "aptoProfesional",
    ],

    cochera: ["seguridad"],

    deposito: ["seguridad", "alarma"],

    quinta: [
        "piscina",
        "patio",
        "jardin",
        "quincho",
        "parrilla",
        "terraza",
        "lavadero",
        "calefaccion",
        "aireAcondicionado",
        "alarma",
        "aptoCredito",
    ],

    campo: [],
};

export const SERVICIOS_BY_TIPO = {
    terreno: ["agua", "luz", "gas", "cloacas", "internet", "pavimento"],
    campo: ["agua", "luz", "gas", "internet"],
    casa: ["agua", "luz", "gas", "cloacas", "internet", "pavimento"],
    quinta: ["agua", "luz", "gas", "internet", "pavimento"],
    local: ["agua", "luz", "gas", "cloacas", "internet", "telefono"],
    oficina: ["agua", "luz", "gas", "cloacas", "internet", "telefono"],
    deposito: ["agua", "luz", "gas", "internet", "pavimento"],
};

export const TIPOS_CON_DORMITORIOS = [
    "casa",
    "departamento",
    "quinta",
    "campo",
];

export const TIPOS_CON_AMBIENTES = [
    "casa",
    "departamento",
    "quinta",
    "oficina",
    "local",
];

export const TIPOS_CON_EXPENSAS = [
    "departamento",
    "oficina",
    "local",
    "cochera",
];

export const TIPOS_CON_SUPERFICIE_TERRENO = [
    "casa",
    "quinta",
    "campo",
    "terreno",
];

export const TIPOS_CON_MEDIDAS_LOTE = [
    "terreno",
    "campo",
    "quinta",
];

export const TIPOS_CON_PISO_DEPTO = [
    "departamento",
    "oficina",
];

const normalizeBoolean = (value) => Boolean(value);

export const normalizeNumericText = (value = "") => {
    const cleanValue = value?.toString?.().trim?.() || "";

    if (!cleanValue) return "";

    return cleanValue.replace(",", ".");
};

export const normalizeSuperficie = (superficie = {}) => {
    return {
        ...DEFAULT_SUPERFICIE,
        ...(superficie || {}),
        total: normalizeNumericText(superficie?.total),
        cubierta: normalizeNumericText(superficie?.cubierta),
        semicubierta: normalizeNumericText(superficie?.semicubierta),
        descubierta: normalizeNumericText(superficie?.descubierta),
        terreno: normalizeNumericText(superficie?.terreno),
        frente: normalizeNumericText(superficie?.frente),
        fondo: normalizeNumericText(superficie?.fondo),
    };
};

export const normalizeCaracteristicas = ({
    values = {},
    caracteristicas = {},
} = {}) => {
    const merged = {
        ...DEFAULT_CARACTERISTICAS,
        ...(caracteristicas || {}),
    };

    return {
        ...merged,

        ambientes: normalizeNumericText(
            merged.ambientes || values.ambientes || "",
        ),

        dormitorios: normalizeNumericText(
            merged.dormitorios || values.dormitorios || "",
        ),

        banos: normalizeNumericText(
            merged.banos || values.banos || values.banios || "",
        ),

        toilettes: normalizeNumericText(merged.toilettes || ""),
        plantas: normalizeNumericText(merged.plantas || ""),
        antiguedad: normalizeNumericText(merged.antiguedad || ""),

        cocheras: normalizeBoolean(
            merged.cocheras || values.cocheras || merged.cocherasCantidad,
        ),

        cocherasCantidad: normalizeNumericText(
            merged.cocherasCantidad || values.cocheras || "",
        ),

        orientacion: merged.orientacion || "",
        estadoConservacion: merged.estadoConservacion || "",
        piso: normalizeNumericText(merged.piso || ""),
        departamento: merged.departamento || "",
    };
};

export const normalizeAmenities = (amenities = {}) => {
    return Object.keys(DEFAULT_AMENITIES).reduce((acc, key) => {
        acc[key] = Boolean(amenities?.[key]);
        return acc;
    }, {});
};

export const normalizeServicios = (servicios = {}) => {
    return Object.keys(DEFAULT_SERVICIOS).reduce((acc, key) => {
        acc[key] = Boolean(servicios?.[key]);
        return acc;
    }, {});
};

export const normalizeMedidas = (medidas = {}) => {
    return {
        ...DEFAULT_MEDIDAS,
        ...(medidas || {}),
        frente: normalizeNumericText(medidas?.frente),
        fondo: normalizeNumericText(medidas?.fondo),
        alturaTecho: normalizeNumericText(medidas?.alturaTecho),
        hectareas: normalizeNumericText(medidas?.hectareas),
    };
};

export const normalizeInmuebleDetails = (values = {}) => {
    const superficie = normalizeSuperficie(values.superficie || {});
    const caracteristicas = normalizeCaracteristicas({
        values,
        caracteristicas: values.caracteristicas || {},
    });

    return {
        superficie,
        caracteristicas,
        amenities: normalizeAmenities(values.amenities || {}),
        servicios: normalizeServicios(values.servicios || {}),
        medidas: normalizeMedidas(values.medidas || {}),

        /*
          Compatibilidad con campos planos actuales.
          Esto permite que cards/filtros viejos sigan funcionando mientras
          migramos progresivamente a caracteristicas.*
        */
        ambientes: caracteristicas.ambientes,
        dormitorios: caracteristicas.dormitorios,
        banos: caracteristicas.banos,
        cocheras: caracteristicas.cocherasCantidad,
    };
};

export const getAmenitiesForTipo = (tipo = "") => {
    return AMENITIES_BY_TIPO[tipo] || Object.keys(DEFAULT_AMENITIES);
};

export const getServiciosForTipo = (tipo = "") => {
    return SERVICIOS_BY_TIPO[tipo] || [];
};

export const shouldShowDormitorios = (tipo = "") =>
    TIPOS_CON_DORMITORIOS.includes(tipo);

export const shouldShowAmbientes = (tipo = "") =>
    TIPOS_CON_AMBIENTES.includes(tipo);

export const shouldShowExpensas = (tipo = "") =>
    TIPOS_CON_EXPENSAS.includes(tipo);

export const shouldShowSuperficieTerreno = (tipo = "") =>
    TIPOS_CON_SUPERFICIE_TERRENO.includes(tipo);

export const shouldShowMedidasLote = (tipo = "") =>
    TIPOS_CON_MEDIDAS_LOTE.includes(tipo);

export const shouldShowPisoDepartamento = (tipo = "") =>
    TIPOS_CON_PISO_DEPTO.includes(tipo);

export const getPublicationQuality = (inmueble = {}) => {
    const missingFields = [];

    const hasImages =
        Array.isArray(inmueble.images) &&
        inmueble.images.some((image) => image?.url);

    const superficie = inmueble.superficie || {};
    const caracteristicas = inmueble.caracteristicas || {};

    if (!inmueble.titulo?.trim?.()) missingFields.push("Título");
    if (!inmueble.tipo) missingFields.push("Tipo");
    if (!inmueble.operacion) missingFields.push("Operación");
    if (!inmueble.direccion?.ciudad) missingFields.push("Ciudad");
    if (!hasImages) missingFields.push("Fotos");

    if (inmueble.operacion !== "tasacion" && !inmueble.precio) {
        missingFields.push("Precio");
    }

    if (
        ["casa", "departamento", "quinta"].includes(inmueble.tipo) &&
        !caracteristicas.dormitorios &&
        !inmueble.dormitorios
    ) {
        missingFields.push("Dormitorios");
    }

    if (
        ["casa", "departamento", "quinta", "local", "oficina"].includes(
            inmueble.tipo,
        ) &&
        !caracteristicas.banos &&
        !inmueble.banos
    ) {
        missingFields.push("Baños");
    }

    if (
        ["casa", "departamento", "quinta", "local", "oficina"].includes(
            inmueble.tipo,
        ) &&
        !superficie.cubierta &&
        !superficie.total
    ) {
        missingFields.push("Superficie");
    }

    const score = Math.max(0, 100 - missingFields.length * 12);

    let status = "destacada";

    if (score < 50) {
        status = "incompleta";
    } else if (score < 75) {
        status = "basica";
    } else if (score < 90) {
        status = "buena";
    }

    return {
        score,
        status,
        missingFields,
    };
};