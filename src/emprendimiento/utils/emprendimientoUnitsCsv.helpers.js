import {
  OPERACIONES_OPCIONES,
  TIPOS_INMUEBLE_OPCIONES,
} from "../../inmueble/utils/inmuebleSchema.js";
import {
  UNIDAD_DISPONIBILIDADES,
  normalizeUnitRow,
} from "./emprendimientoUnits.helpers.js";

export const UNIT_CSV_HEADERS = [
  "codigo",
  "tipo",
  "tipologia",
  "piso",
  "ambientes",
  "dormitorios",
  "superficie",
  "operacion",
  "precio",
  "moneda",
  "disponibilidad",
];

export const UNIT_CSV_MAX_ROWS = 200;

const HEADER_ALIASES = {
  codigo: "codigo",
  unidad: "codigo",
  codigo_unidad: "codigo",
  unidad_codigo: "codigo",
  tipo: "tipo",
  tipo_inmueble: "tipo",
  tipologia: "tipologia",
  piso: "piso",
  ambientes: "ambientes",
  amb: "ambientes",
  dormitorios: "dormitorios",
  dorm: "dormitorios",
  superficie: "superficie",
  superficie_total: "superficie",
  superficie_m2: "superficie",
  m2: "superficie",
  operacion: "operacion",
  precio: "precio",
  moneda: "moneda",
  disponibilidad: "disponibilidad",
  estado: "disponibilidad",
};

const normalizeKey = (value = "") =>
  value
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const createOptionMap = (options) =>
  options.reduce((map, option) => {
    map.set(normalizeKey(option.id), option.id);
    map.set(normalizeKey(option.label), option.id);
    return map;
  }, new Map());

const TYPE_MAP = createOptionMap(TIPOS_INMUEBLE_OPCIONES);
const OPERATION_MAP = createOptionMap(
  OPERACIONES_OPCIONES.filter((item) =>
    ["venta", "alquiler", "alquiler_temporal"].includes(item.id),
  ),
);
const AVAILABILITY_MAP = createOptionMap(UNIDAD_DISPONIBILIDADES);

OPERATION_MAP.set("alquiler_temporario", "alquiler_temporal");
AVAILABILITY_MAP.set("no_disponible", "no_disponible");

const CURRENCY_MAP = new Map([
  ["usd", "USD"],
  ["us", "USD"],
  ["u_s", "USD"],
  ["dolar", "USD"],
  ["dolares", "USD"],
  ["ars", "ARS"],
  ["peso", "ARS"],
  ["pesos", "ARS"],
]);

const countDelimiter = (line, delimiter) => {
  let quoted = false;
  let count = 0;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (!quoted && character === delimiter) {
      count += 1;
    }
  }

  return count;
};

export const detectUnitCsvDelimiter = (text = "") => {
  const firstLine = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .find((line) => line.trim());

  if (!firstLine) return ";";

  return [";", "\t", ","]
    .map((delimiter) => ({
      delimiter,
      count: countDelimiter(firstLine, delimiter),
    }))
    .sort((left, right) => right.count - left.count)[0].delimiter;
};

export const parseUnitCsvRecords = (text = "", delimiter = "") => {
  const source = text.replace(/^\uFEFF/, "");
  const resolvedDelimiter = delimiter || detectUnitCsvDelimiter(source);
  const records = [];
  let record = [];
  let field = "";
  let quoted = false;
  let lineNumber = 1;
  let recordLine = 1;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];

    if (character === '"') {
      if (quoted && source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (!quoted && character === resolvedDelimiter) {
      record.push(field);
      field = "";
      continue;
    }

    if (!quoted && (character === "\n" || character === "\r")) {
      record.push(field);
      field = "";

      if (record.some((value) => value.trim())) {
        records.push({ values: record, lineNumber: recordLine });
      }

      record = [];
      if (character === "\r" && source[index + 1] === "\n") index += 1;
      lineNumber += 1;
      recordLine = lineNumber;
      continue;
    }

    field += character;
    if (character === "\n") lineNumber += 1;
  }

  record.push(field);
  if (record.some((value) => value.trim())) {
    records.push({ values: record, lineNumber: recordLine });
  }

  return { records, delimiter: resolvedDelimiter, unclosedQuote: quoted };
};

const normalizeDecimal = (value) => {
  const raw = value?.toString?.().trim?.() || "";
  if (!raw) return { value: "", valid: true };

  let clean = raw.replace(/\s/g, "").replace(/[^0-9,.-]/g, "");
  if (!/[0-9]/.test(clean)) return { value: "", valid: false };
  const commaIndex = clean.lastIndexOf(",");
  const dotIndex = clean.lastIndexOf(".");

  if (commaIndex >= 0 && dotIndex >= 0) {
    const decimalSeparator = commaIndex > dotIndex ? "," : ".";
    const thousandsSeparator = decimalSeparator === "," ? /\./g : /,/g;
    clean = clean.replace(thousandsSeparator, "");
    if (decimalSeparator === ",") clean = clean.replace(",", ".");
  } else if (commaIndex >= 0) {
    const decimals = clean.length - commaIndex - 1;
    clean = decimals === 3 ? clean.replace(/,/g, "") : clean.replace(",", ".");
  } else if (dotIndex >= 0) {
    const decimals = clean.length - dotIndex - 1;
    if (decimals === 3) clean = clean.replace(/\./g, "");
  }

  const number = Number(clean);
  return {
    value: Number.isFinite(number) ? number : "",
    valid: Number.isFinite(number),
  };
};

const normalizeEnum = (value, optionsMap, fallback = "") => {
  const key = normalizeKey(value);
  if (!key && fallback) return fallback;
  return optionsMap.get(key) || "";
};

const normalizeCurrency = (value) => {
  const key = normalizeKey(value || "USD");
  return CURRENCY_MAP.get(key) || "";
};

const getExistingUnitCode = (inmueble = {}) =>
  inmueble.unidadEmprendimiento?.codigo?.toString?.().trim?.() || "";

const buildExistingCodeMap = (existingUnits = []) => {
  const map = new Map();

  existingUnits.forEach((unit) => {
    const key = normalizeKey(getExistingUnitCode(unit));
    if (!key) return;
    const entries = map.get(key) || [];
    entries.push(unit);
    map.set(key, entries);
  });

  return map;
};

const buildHeaderMap = (rawHeaders = []) => {
  const headers = [];
  const errors = [];
  const usedFields = new Set();

  rawHeaders.forEach((header, index) => {
    const key = normalizeKey(header);
    const field = HEADER_ALIASES[key] || "";
    headers[index] = field;

    if (field && usedFields.has(field)) {
      errors.push(`La columna “${header}” está repetida.`);
    }
    if (field) usedFields.add(field);
  });

  if (!usedFields.has("codigo")) {
    errors.push("Falta la columna obligatoria “codigo”.");
  }

  return { headers, errors };
};

const rawRecordToObject = (values, headers) =>
  headers.reduce((row, field, index) => {
    if (field) row[field] = values[index] ?? "";
    return row;
  }, {});

const normalizeImportedRow = (rawRow) => {
  const errors = {};
  const tipo = normalizeEnum(rawRow.tipo, TYPE_MAP, "departamento");
  const operacion = normalizeEnum(rawRow.operacion, OPERATION_MAP, "venta");
  const disponibilidad = normalizeEnum(
    rawRow.disponibilidad,
    AVAILABILITY_MAP,
    "disponible",
  );
  const moneda = normalizeCurrency(rawRow.moneda);
  const numericFields = ["ambientes", "dormitorios", "superficie", "precio"];
  const numericValues = {};

  numericFields.forEach((field) => {
    const normalized = normalizeDecimal(rawRow[field]);
    numericValues[field] = normalized.value;
    if (!normalized.valid) errors[field] = `${field}: número inválido`;
    if (normalized.valid && normalized.value !== "" && normalized.value < 0) {
      errors[field] = `${field}: no puede ser negativo`;
    }
    if (
      normalized.valid &&
      normalized.value !== "" &&
      ["ambientes", "dormitorios"].includes(field) &&
      !Number.isInteger(normalized.value)
    ) {
      errors[field] = `${field}: debe ser un número entero`;
    }
  });

  if (!tipo) errors.tipo = "Tipo de inmueble inválido";
  if (!operacion) errors.operacion = "Operación inválida";
  if (!disponibilidad) errors.disponibilidad = "Disponibilidad inválida";
  if (!moneda) errors.moneda = "Moneda inválida; usá USD o ARS";

  const row = normalizeUnitRow({
    ...rawRow,
    ...numericValues,
    tipo: tipo || rawRow.tipo,
    operacion: operacion || rawRow.operacion,
    disponibilidad: disponibilidad || rawRow.disponibilidad,
    moneda: moneda || rawRow.moneda,
  });

  if (!row.codigo) errors.codigo = "Código obligatorio";

  return { row, errors };
};

export const buildUnitCsvImportPreview = (text = "", existingUnits = []) => {
  const parsed = parseUnitCsvRecords(text);
  const globalErrors = [];

  if (parsed.unclosedQuote) {
    globalErrors.push("El archivo contiene una comilla sin cerrar.");
  }

  if (parsed.records.length === 0) {
    return {
      rows: [],
      validRows: [],
      globalErrors: ["El archivo está vacío."],
      summary: { total: 0, create: 0, update: 0, invalid: 0 },
    };
  }

  const headerResult = buildHeaderMap(parsed.records[0].values);
  globalErrors.push(...headerResult.errors);
  const dataRecords = parsed.records.slice(1);

  if (dataRecords.length > UNIT_CSV_MAX_ROWS) {
    globalErrors.push(
      `El archivo tiene ${dataRecords.length} filas; el máximo es ${UNIT_CSV_MAX_ROWS}.`,
    );
  }

  const existingByCode = buildExistingCodeMap(existingUnits);
  const importedCodes = new Map();
  const rows = dataRecords.slice(0, UNIT_CSV_MAX_ROWS).map((record) => {
    const rawRow = rawRecordToObject(record.values, headerResult.headers);
    const normalized = normalizeImportedRow(rawRow);
    const codeKey = normalizeKey(normalized.row.codigo);
    const existingMatches = codeKey ? existingByCode.get(codeKey) || [] : [];
    const item = {
      lineNumber: record.lineNumber,
      raw: rawRow,
      row: normalized.row,
      errors: normalized.errors,
      action: "create",
      existingId: "",
    };

    if (codeKey) {
      const previous = importedCodes.get(codeKey);
      if (previous) {
        item.errors.codigo = `Código repetido en las filas ${previous.lineNumber} y ${record.lineNumber}`;
        previous.errors.codigo = item.errors.codigo;
      } else {
        importedCodes.set(codeKey, item);
      }
    }

    if (existingMatches.length > 1) {
      item.errors.codigo = "Más de una unidad existente utiliza este código";
    } else if (existingMatches.length === 1) {
      item.action = "update";
      item.existingId = existingMatches[0].id;
    }

    return item;
  });

  rows.forEach((item) => {
    if (Object.keys(item.errors).length > 0) item.action = "invalid";
  });

  const validRows = globalErrors.length
    ? []
    : rows.filter((item) => item.action !== "invalid");
  const summary = rows.reduce(
    (result, item) => {
      result.total += 1;
      result[item.action] += 1;
      return result;
    },
    { total: 0, create: 0, update: 0, invalid: 0 },
  );

  return { rows, validRows, globalErrors, summary, delimiter: parsed.delimiter };
};

const escapeCsvValue = (value) => {
  const text = value?.toString?.() || "";
  return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export const buildUnitCsvTemplate = () => {
  const exampleRows = [
    ["1A", "departamento", "2 dormitorios", "1", "3", "2", "72,5", "venta", "95000", "USD", "disponible"],
    ["PB-01", "local", "Local comercial", "PB", "1", "0", "48", "alquiler", "450000", "ARS", "reservada"],
  ];

  return `\uFEFF${[UNIT_CSV_HEADERS, ...exampleRows]
    .map((row) => row.map(escapeCsvValue).join(";"))
    .join("\r\n")}\r\n`;
};
