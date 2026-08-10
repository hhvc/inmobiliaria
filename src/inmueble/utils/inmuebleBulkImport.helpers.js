import {
  OPERACIONES_IDS,
  TIPOS_INMUEBLE_IDS,
} from "./inmuebleSchema";
import { normalizeInmuebleVideos } from "./inmuebleVideos.helpers";
import { INMUEBLE_ESTADOS_ARRAY } from "../../domain/inmueble/inmueble.constants";
import {
  DEFAULT_AMENITIES,
  DEFAULT_CARACTERISTICAS,
  DEFAULT_MEDIDAS,
  DEFAULT_SERVICIOS,
  DEFAULT_SUPERFICIE,
} from "./inmuebleDetailsSchema";

export const INMUEBLE_BULK_IMPORT_COLUMNS = [
  "titulo",
  "descripcion",
  "operacion",
  "tipo",
  "estado",
  "precio",
  "moneda",
  "expensas",
  "calle",
  "numero",
  "barrio",
  "ciudad",
  "provincia",
  "pais",
  "latitud",
  "longitud",
  "precision_mapa",
  "superficie_total",
  "superficie_cubierta",
  "superficie_semicubierta",
  "superficie_descubierta",
  "superficie_terreno",
  "frente",
  "fondo",
  "ambientes",
  "dormitorios",
  "banos",
  "toilettes",
  "cocheras",
  "cocheras_cantidad",
  "antiguedad",
  "patio",
  "jardin",
  "piscina",
  "parrilla",
  "balcon",
  "terraza",
  "lavadero",
  "seguridad",
  "ascensor",
  "apto_credito",
  "apto_mascotas",
  "agua",
  "luz",
  "gas",
  "cloacas",
  "internet",
  "pavimento",
  "publicar_en_portal",
  "destacado",
  "no_index",
  "imagenes",
  "imagen1",
  "imagen2",
  "imagen3",
  "videos",
  "video1",
  "video2",
];

export const INMUEBLE_BULK_IMPORT_TEMPLATE_ROW = {
  titulo: "Casa de ejemplo en barrio General Paz",
  descripcion:
    "Casa de ejemplo con living comedor, cocina integrada, patio y cochera. Editar o borrar esta fila antes de importar.",
  operacion: "venta",
  tipo: "casa",
  estado: "activo",
  precio: "120000",
  moneda: "USD",
  expensas: "",
  calle: "",
  numero: "",
  barrio: "General Paz",
  ciudad: "Córdoba",
  provincia: "Córdoba",
  pais: "Argentina",
  latitud: "",
  longitud: "",
  precision_mapa: "precisa",
  superficie_total: "180",
  superficie_cubierta: "120",
  superficie_semicubierta: "",
  superficie_descubierta: "60",
  superficie_terreno: "",
  frente: "",
  fondo: "",
  ambientes: "4",
  dormitorios: "3",
  banos: "2",
  toilettes: "",
  cocheras: "si",
  cocheras_cantidad: "1",
  antiguedad: "",
  patio: "si",
  jardin: "",
  piscina: "",
  parrilla: "si",
  balcon: "",
  terraza: "",
  lavadero: "si",
  seguridad: "",
  ascensor: "",
  apto_credito: "",
  apto_mascotas: "",
  agua: "si",
  luz: "si",
  gas: "si",
  cloacas: "si",
  internet: "",
  pavimento: "si",
  publicar_en_portal: "no",
  destacado: "no",
  no_index: "no",
  imagenes: "https://example.com/foto-1.jpg|https://example.com/foto-2.jpg",
  imagen1: "",
  imagen2: "",
  imagen3: "",
  videos: "https://www.youtube.com/watch?v=xxxxxxxxxxx",
  video1: "",
  video2: "",
};

const HEADER_ALIASES = {
  titulo: "titulo",
  título: "titulo",
  descripcion: "descripcion",
  descripción: "descripcion",
  operacion: "operacion",
  operación: "operacion",
  tipo: "tipo",
  estado: "estado",
  precio: "precio",
  moneda: "moneda",
  expensas: "expensas",
  calle: "calle",
  numero: "numero",
  número: "numero",
  nro: "numero",
  barrio: "barrio",
  ciudad: "ciudad",
  provincia: "provincia",
  pais: "pais",
  país: "pais",
  latitud: "latitud",
  latitude: "latitud",
  longitud: "longitud",
  longitude: "longitud",
  precision_mapa: "precision_mapa",
  precisión_mapa: "precision_mapa",
  superficie_total: "superficie_total",
  sup_total: "superficie_total",
  superficie_cubierta: "superficie_cubierta",
  sup_cubierta: "superficie_cubierta",
  superficie_semicubierta: "superficie_semicubierta",
  superficie_descubierta: "superficie_descubierta",
  superficie_terreno: "superficie_terreno",
  terreno: "superficie_terreno",
  frente: "frente",
  fondo: "fondo",
  ambientes: "ambientes",
  dormitorios: "dormitorios",
  dorm: "dormitorios",
  banos: "banos",
  baños: "banos",
  banios: "banos",
  toilettes: "toilettes",
  cocheras: "cocheras",
  cochera: "cocheras",
  cocheras_cantidad: "cocheras_cantidad",
  cantidad_cocheras: "cocheras_cantidad",
  antiguedad: "antiguedad",
  antigüedad: "antiguedad",
  patio: "patio",
  jardin: "jardin",
  jardín: "jardin",
  piscina: "piscina",
  parrilla: "parrilla",
  balcon: "balcon",
  balcón: "balcon",
  terraza: "terraza",
  lavadero: "lavadero",
  seguridad: "seguridad",
  ascensor: "ascensor",
  apto_credito: "apto_credito",
  apto_crédito: "apto_credito",
  apto_mascotas: "apto_mascotas",
  agua: "agua",
  luz: "luz",
  gas: "gas",
  cloacas: "cloacas",
  internet: "internet",
  pavimento: "pavimento",
  publicar_en_portal: "publicar_en_portal",
  publicar: "publicar_en_portal",
  destacado: "destacado",
  no_index: "no_index",
  noindex: "no_index",
  imagenes: "imagenes",
  imágenes: "imagenes",
  fotos: "imagenes",
  imagen1: "imagen1",
  imagen2: "imagen2",
  imagen3: "imagen3",
  imagen4: "imagen4",
  imagen5: "imagen5",
  imagen6: "imagen6",
  imagen7: "imagen7",
  imagen8: "imagen8",
  imagen9: "imagen9",
  imagen10: "imagen10",
  videos: "videos",
  video1: "video1",
  video2: "video2",
  video3: "video3",
  video4: "video4",
  video5: "video5",
};

const BOOLEAN_TRUE_VALUES = new Set([
  "1",
  "s",
  "si",
  "sí",
  "true",
  "verdadero",
  "x",
  "yes",
]);

const BOOLEAN_FALSE_VALUES = new Set([
  "0",
  "n",
  "no",
  "false",
  "falso",
  "",
]);

const CSV_SEPARATOR = ";";
const MAX_EXTERNAL_IMAGES = 50;
const MAX_EXTERNAL_VIDEOS = 5;

const cleanText = (value = "") => value.toString().trim();

const normalizeKey = (value = "") =>
  cleanText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const normalizeHeader = (value = "") => {
  const raw = cleanText(value).toLowerCase();
  const normalized = normalizeKey(value);

  return HEADER_ALIASES[raw] || HEADER_ALIASES[normalized] || normalized;
};

const escapeCsvValue = (value = "") => {
  const normalized = value.toString().replace(/\r?\n|\r/g, " ").trim();

  return `"${normalized.replace(/"/g, '""')}"`;
};

const splitMultiValue = (value = "") => {
  return cleanText(value)
    .split(/[|,\n]/g)
    .map((item) => item.trim())
    .filter(Boolean);
};

const parseNumber = (value) => {
  const text = cleanText(value);

  if (!text) return "";

  const normalized = text
    .replace(/\s/g, "")
    .replace(/[$]/g, "")
    .replace(/USD|ARS|U\$S|US\$/gi, "")
    .replace(/\./g, "")
    .replace(/,/g, ".");

  const number = Number(normalized);

  return Number.isFinite(number) ? number : "";
};

const parseBoolean = (value, defaultValue = false) => {
  const normalized = cleanText(value).toLowerCase();

  if (BOOLEAN_TRUE_VALUES.has(normalized)) return true;
  if (BOOLEAN_FALSE_VALUES.has(normalized)) return false;

  return defaultValue;
};

const normalizeOption = (value, allowedValues, fallback = "") => {
  const normalized = normalizeKey(value);

  if (allowedValues.includes(normalized)) return normalized;

  return fallback;
};

const readImageUrls = (row = {}) => {
  const urls = [...splitMultiValue(row.imagenes)];

  for (let index = 1; index <= 50; index += 1) {
    urls.push(...splitMultiValue(row[`imagen${index}`]));
  }

  return [...new Set(urls)].slice(0, MAX_EXTERNAL_IMAGES);
};

const readVideoUrls = (row = {}) => {
  const urls = [...splitMultiValue(row.videos)];

  for (let index = 1; index <= 5; index += 1) {
    urls.push(...splitMultiValue(row[`video${index}`]));
  }

  return [...new Set(urls)].slice(0, MAX_EXTERNAL_VIDEOS);
};

const buildExternalImages = (row = {}) => {
  return readImageUrls(row).map((url, index) => ({
    id: `bulk-url-${index + 1}-${normalizeKey(url).slice(-18)}`,
    url,
    thumbnailUrl: url,
    storagePath: "",
    thumbnailPath: "",
    order: index,
    filename: `Imagen externa ${index + 1}`,
    name: `Imagen externa ${index + 1}`,
    source: "bulk_import_external_url",
    portalReady: true,
    qualityWarnings: [],
    createdAt: new Date().toISOString(),
  }));
};

const buildCsvRow = (row) =>
  INMUEBLE_BULK_IMPORT_COLUMNS.map((column) => escapeCsvValue(row[column] || ""));

export const buildInmuebleBulkImportTemplateCsv = () => {
  const rows = [
    INMUEBLE_BULK_IMPORT_COLUMNS.map(escapeCsvValue),
    buildCsvRow(INMUEBLE_BULK_IMPORT_TEMPLATE_ROW),
  ];

  return rows.map((row) => row.join(CSV_SEPARATOR)).join("\n");
};

export const downloadInmuebleBulkImportTemplate = () => {
  const csv = buildInmuebleBulkImportTemplateCsv();
  const blob = new Blob([`\uFEFF${csv}`], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "plantilla-carga-masiva-inmuebles.csv";
  link.click();

  URL.revokeObjectURL(url);
};

const detectDelimiter = (line = "") => {
  const semicolons = (line.match(/;/g) || []).length;
  const commas = (line.match(/,/g) || []).length;

  return semicolons >= commas ? ";" : ",";
};

const parseCsvRows = (text = "") => {
  const rows = [];
  let row = [];
  let value = "";
  let inQuotes = false;
  let delimiter = ";";
  let delimiterDetected = false;

  const normalizedText = text.replace(/^\uFEFF/, "");

  for (let index = 0; index < normalizedText.length; index += 1) {
    const char = normalizedText[index];
    const nextChar = normalizedText[index + 1];

    if (!delimiterDetected && char !== "\r" && char !== "\n") {
      const firstLine = normalizedText.split(/\r?\n/)[0] || "";
      delimiter = detectDelimiter(firstLine);
      delimiterDetected = true;
    }

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        value += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }

      continue;
    }

    if (char === delimiter && !inQuotes) {
      row.push(value);
      value = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }

      row.push(value);
      value = "";

      if (row.some((item) => cleanText(item))) {
        rows.push(row);
      }

      row = [];
      continue;
    }

    value += char;
  }

  row.push(value);

  if (row.some((item) => cleanText(item))) {
    rows.push(row);
  }

  return rows;
};

export const parseInmuebleBulkImportCsv = (text = "") => {
  const rows = parseCsvRows(text);

  if (rows.length === 0) {
    return [];
  }

  const headers = rows[0].map(normalizeHeader);

  return rows.slice(1).map((row, index) => {
    const raw = headers.reduce((acc, header, headerIndex) => {
      if (!header) return acc;

      acc[header] = cleanText(row[headerIndex] || "");
      return acc;
    }, {});

    return {
      rowNumber: index + 2,
      raw,
    };
  });
};

export const validateInmuebleBulkImportRow = (row = {}) => {
  const errors = [];
  const warnings = [];

  const titulo = cleanText(row.titulo);
  const descripcion = cleanText(row.descripcion);
  const operacion = normalizeOption(row.operacion, OPERACIONES_IDS);
  const tipo = normalizeOption(row.tipo, TIPOS_INMUEBLE_IDS);
  const estadoText = cleanText(row.estado);
  const estado = estadoText
    ? normalizeOption(estadoText, INMUEBLE_ESTADOS_ARRAY)
    : "activo";
  const precio = parseNumber(row.precio);
  const ciudad = cleanText(row.ciudad);
  const barrio = cleanText(row.barrio);
  const imageUrls = readImageUrls(row);

  if (titulo.length < 5) {
    errors.push("Título obligatorio, mínimo 5 caracteres");
  }

  if (!descripcion || descripcion.length < 20) {
    errors.push("Descripción obligatoria, mínimo 20 caracteres");
  }

  if (!operacion) {
    errors.push(`Operación inválida. Permitidas: ${OPERACIONES_IDS.join(", ")}`);
  }

  if (!tipo) {
    errors.push(`Tipo inválido. Permitidos: ${TIPOS_INMUEBLE_IDS.join(", ")}`);
  }

  if (!estado) {
    errors.push(
      `Estado inválido. Permitidos: ${INMUEBLE_ESTADOS_ARRAY.join(", ")}`,
    );
  }

  if (operacion !== "tasacion" && !precio) {
    errors.push("Precio obligatorio para venta/alquiler/alquiler temporal");
  }

  if (!ciudad && !barrio) {
    errors.push("Cargá al menos ciudad o barrio");
  }

  if (
    parseBoolean(row.publicar_en_portal, false) &&
    (!parseNumber(row.latitud) || !parseNumber(row.longitud))
  ) {
    errors.push(
      "Latitud y longitud son obligatorias para publicar en el portal",
    );
  }

  if (imageUrls.length === 0) {
    warnings.push("Sin imágenes externas cargadas");
  }

  if (!parseBoolean(row.publicar_en_portal, false)) {
    warnings.push("Se importará sin publicar en portal");
  }

  if (imageUrls.length > MAX_EXTERNAL_IMAGES) {
    warnings.push(`Se tomarán sólo las primeras ${MAX_EXTERNAL_IMAGES} imágenes`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
};

export const buildInmuebleBulkImportPayload = (
  row = {},
  { userId = "", inmobiliariaId = "" } = {},
) => {
  const operacion = normalizeOption(row.operacion, OPERACIONES_IDS, "venta");
  const tipo = normalizeOption(row.tipo, TIPOS_INMUEBLE_IDS, "casa");
  const estadoText = cleanText(row.estado);
  const estado = estadoText
    ? normalizeOption(estadoText, INMUEBLE_ESTADOS_ARRAY)
    : "activo";
  const publicarEnPortal = parseBoolean(row.publicar_en_portal, false);
  const cocherasCantidad = parseNumber(row.cocheras_cantidad);
  const hasCocheras = parseBoolean(row.cocheras, Boolean(cocherasCantidad));

  return {
    titulo: cleanText(row.titulo),
    descripcion: cleanText(row.descripcion),
    operacion,
    tipo,
    estado,

    precio: parseNumber(row.precio),
    moneda: cleanText(row.moneda).toUpperCase() || "USD",
    expensas: parseNumber(row.expensas),

    direccion: {
      calle: cleanText(row.calle),
      numero: cleanText(row.numero),
      barrio: cleanText(row.barrio),
      ciudad: cleanText(row.ciudad),
      provincia: cleanText(row.provincia) || "Córdoba",
      pais: cleanText(row.pais) || "Argentina",
      lat: parseNumber(row.latitud) || null,
      lng: parseNumber(row.longitud) || null,
      precisionMapa:
        cleanText(row.precision_mapa).toLowerCase() === "aproximada"
          ? "aproximada"
          : "precisa",
    },

    superficie: {
      ...DEFAULT_SUPERFICIE,
      total: parseNumber(row.superficie_total),
      cubierta: parseNumber(row.superficie_cubierta),
      semicubierta: parseNumber(row.superficie_semicubierta),
      descubierta: parseNumber(row.superficie_descubierta),
      terreno: parseNumber(row.superficie_terreno),
      frente: parseNumber(row.frente),
      fondo: parseNumber(row.fondo),
    },

    caracteristicas: {
      ...DEFAULT_CARACTERISTICAS,
      ambientes: parseNumber(row.ambientes),
      dormitorios: parseNumber(row.dormitorios),
      banos: parseNumber(row.banos),
      toilettes: parseNumber(row.toilettes),
      cocheras: hasCocheras,
      cocherasCantidad,
      antiguedad: parseNumber(row.antiguedad),
    },

    amenities: {
      ...DEFAULT_AMENITIES,
      patio: parseBoolean(row.patio),
      jardin: parseBoolean(row.jardin),
      piscina: parseBoolean(row.piscina),
      parrilla: parseBoolean(row.parrilla),
      balcon: parseBoolean(row.balcon),
      terraza: parseBoolean(row.terraza),
      lavadero: parseBoolean(row.lavadero),
      seguridad: parseBoolean(row.seguridad),
      ascensor: parseBoolean(row.ascensor),
      aptoCredito: parseBoolean(row.apto_credito),
      aptoMascotas: parseBoolean(row.apto_mascotas),
    },

    servicios: {
      ...DEFAULT_SERVICIOS,
      agua: parseBoolean(row.agua),
      luz: parseBoolean(row.luz),
      gas: parseBoolean(row.gas),
      cloacas: parseBoolean(row.cloacas),
      internet: parseBoolean(row.internet),
      pavimento: parseBoolean(row.pavimento),
    },

    medidas: {
      ...DEFAULT_MEDIDAS,
      frente: parseNumber(row.frente),
      fondo: parseNumber(row.fondo),
    },

    ambientes: parseNumber(row.ambientes),
    dormitorios: parseNumber(row.dormitorios),
    banos: parseNumber(row.banos),
    cocheras: cocherasCantidad || (hasCocheras ? 1 : ""),

    images: buildExternalImages(row),
    videos: normalizeInmuebleVideos(readVideoUrls(row)),

    destacado: parseBoolean(row.destacado, false),
    publicarEnPortal,
    noIndex: parseBoolean(row.no_index, false),

    inmobiliariaId,
    ownerInmobiliariaId: inmobiliariaId,
    ownerId: userId,
    createdBy: userId,

    sharedWith: {},
    deleted: false,

    sharing: {
      enabled: false,
      mode: "all_colleagues",
      allowColleagueContact: true,
      showExactAddressToColleagues: false,
      showOwnerDataToColleagues: false,
    },

    sourceType: "bulk_csv_import",
  };
};
