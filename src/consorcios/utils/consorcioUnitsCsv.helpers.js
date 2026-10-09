import { CONSORTIUM_UNIT_TYPES } from "./consorcio.constants.js";

export const CONSORTIUM_UNIT_CSV_MAX_ROWS = 200;

export const CONSORTIUM_UNIT_CSV_HEADERS = [
  "unidad",
  "piso",
  "departamento",
  "tipo",
  "coeficiente",
  "titular",
  "dni_cuit_titular",
  "email_titular",
  "ocupante",
  "email_ocupante",
  "telefono",
  "saldo_inicial",
];

const HEADER_ALIASES = {
  unidad: "code",
  codigo: "code",
  codigo_unidad: "code",
  piso: "floor",
  departamento: "apartment",
  depto: "apartment",
  tipo: "type",
  tipo_unidad: "type",
  coeficiente: "coefficient",
  porcentual: "coefficient",
  titular: "ownerName",
  propietario: "ownerName",
  dni_cuit_titular: "ownerTaxId",
  dni_titular: "ownerTaxId",
  cuit_titular: "ownerTaxId",
  email_titular: "ownerEmail",
  correo_titular: "ownerEmail",
  ocupante: "occupantName",
  inquilino: "occupantName",
  email_ocupante: "occupantEmail",
  correo_ocupante: "occupantEmail",
  telefono: "phone",
  celular: "phone",
  saldo_inicial: "openingBalanceMajor",
  saldo: "openingBalanceMajor",
};

const normalizeKey = (value = "") => value
  .toString()
  .trim()
  .toLowerCase()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-z0-9]+/g, "_")
  .replace(/^_+|_+$/g, "");

const TYPE_MAP = CONSORTIUM_UNIT_TYPES.reduce((map, item) => {
  map.set(normalizeKey(item.id), item.id);
  map.set(normalizeKey(item.label), item.id);
  return map;
}, new Map());

TYPE_MAP.set("dpto", "apartment");
TYPE_MAP.set("departamento", "apartment");
TYPE_MAP.set("local_comercial", "commercial");
TYPE_MAP.set("cochera", "garage");
TYPE_MAP.set("baulera", "storage");

const countDelimiter = (line, delimiter) => {
  let quoted = false;
  let count = 0;
  for (let index = 0; index < line.length; index += 1) {
    if (line[index] === '"') {
      if (quoted && line[index + 1] === '"') index += 1;
      else quoted = !quoted;
    } else if (!quoted && line[index] === delimiter) count += 1;
  }
  return count;
};

export const detectConsortiumUnitCsvDelimiter = (text = "") => {
  const firstLine = text.replace(/^\uFEFF/, "").split(/\r?\n/).find((line) => line.trim());
  if (!firstLine) return ";";
  return [";", "\t", ","]
    .map((delimiter) => ({ delimiter, count: countDelimiter(firstLine, delimiter) }))
    .sort((left, right) => right.count - left.count)[0].delimiter;
};

export const parseConsortiumUnitCsvRecords = (text = "", delimiter = "") => {
  const source = text.replace(/^\uFEFF/, "");
  const resolvedDelimiter = delimiter || detectConsortiumUnitCsvDelimiter(source);
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
      } else quoted = !quoted;
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
      if (record.some((value) => value.trim())) records.push({ values: record, lineNumber: recordLine });
      record = [];
      if (character === "\r" && source[index + 1] === "\n") index += 1;
      lineNumber += 1;
      recordLine = lineNumber;
      continue;
    }
    field += character;
  }
  record.push(field);
  if (record.some((value) => value.trim())) records.push({ values: record, lineNumber: recordLine });
  return { records, delimiter: resolvedDelimiter, unclosedQuote: quoted };
};

const normalizeDecimal = (value, { allowNegative = false } = {}) => {
  const raw = value?.toString?.().trim?.() || "";
  if (!raw) return { value: 0, valid: true };
  let clean = raw.replace(/\s/g, "").replace(/[^0-9,.-]/g, "");
  if (!/[0-9]/.test(clean)) return { value: 0, valid: false };
  const commaIndex = clean.lastIndexOf(",");
  const dotIndex = clean.lastIndexOf(".");
  if (commaIndex >= 0 && dotIndex >= 0) {
    const decimalSeparator = commaIndex > dotIndex ? "," : ".";
    clean = clean.replace(decimalSeparator === "," ? /\./g : /,/g, "");
    if (decimalSeparator === ",") clean = clean.replace(",", ".");
  } else if (commaIndex >= 0) {
    clean = clean.length - commaIndex - 1 === 3
      ? clean.replace(/,/g, "")
      : clean.replace(",", ".");
  } else if (dotIndex >= 0 && clean.length - dotIndex - 1 === 3) {
    clean = clean.replace(/\./g, "");
  }
  const number = Number(clean);
  return {
    value: Number.isFinite(number) ? number : 0,
    valid: Number.isFinite(number) && (allowNegative || number >= 0),
  };
};

const isValidEmail = (value = "") => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const buildHeaderMap = (rawHeaders = []) => {
  const headers = [];
  const errors = [];
  const usedFields = new Set();
  rawHeaders.forEach((header, index) => {
    const field = HEADER_ALIASES[normalizeKey(header)] || "";
    headers[index] = field;
    if (field && usedFields.has(field)) errors.push(`La columna “${header}” está repetida.`);
    if (field) usedFields.add(field);
  });
  if (!usedFields.has("code")) errors.push("Falta la columna obligatoria “unidad”.");
  return { headers, errors };
};

const rawRecordToObject = (values, headers) => headers.reduce((row, field, index) => {
  if (field) row[field] = values[index] ?? "";
  return row;
}, {});

const buildExistingCodeSet = (units = []) => new Set(units
  .filter((item) => item.deleted !== true)
  .map((item) => normalizeKey(item.code))
  .filter(Boolean));

const normalizeImportedRow = (raw = {}) => {
  const coefficient = normalizeDecimal(raw.coefficient);
  const openingBalance = normalizeDecimal(raw.openingBalanceMajor, { allowNegative: true });
  const typeKey = normalizeKey(raw.type || "departamento");
  const type = TYPE_MAP.get(typeKey) || "";
  const row = {
    code: raw.code?.toString?.().trim?.() || "",
    floor: raw.floor?.toString?.().trim?.() || "",
    apartment: raw.apartment?.toString?.().trim?.() || "",
    type: type || raw.type?.toString?.().trim?.() || "apartment",
    coefficient: coefficient.value,
    ownerName: raw.ownerName?.toString?.().trim?.() || "",
    ownerTaxId: raw.ownerTaxId?.toString?.().trim?.() || "",
    ownerEmail: raw.ownerEmail?.toString?.().trim?.().toLowerCase() || "",
    occupantName: raw.occupantName?.toString?.().trim?.() || "",
    occupantEmail: raw.occupantEmail?.toString?.().trim?.().toLowerCase() || "",
    phone: raw.phone?.toString?.().trim?.() || "",
    openingBalanceMajor: openingBalance.value,
  };
  const errors = {};
  if (!row.code) errors.code = "La unidad es obligatoria";
  if (!type) errors.type = "Tipo de unidad inválido";
  if (!coefficient.valid) errors.coefficient = "Coeficiente inválido";
  if (!openingBalance.valid) errors.openingBalanceMajor = "Saldo inicial inválido";
  if (!isValidEmail(row.ownerEmail)) errors.ownerEmail = "Email del titular inválido";
  if (!isValidEmail(row.occupantEmail)) errors.occupantEmail = "Email del ocupante inválido";
  return { row, errors };
};

export const buildConsortiumUnitCsvImportPreview = (text = "", existingUnits = []) => {
  const parsed = parseConsortiumUnitCsvRecords(text);
  if (!parsed.records.length) {
    return {
      rows: [],
      validRows: [],
      globalErrors: ["El archivo está vacío."],
      summary: { total: 0, valid: 0, invalid: 0, withBalance: 0 },
    };
  }
  const headerResult = buildHeaderMap(parsed.records[0].values);
  const globalErrors = [...headerResult.errors];
  if (parsed.unclosedQuote) globalErrors.push("El archivo contiene una comilla sin cerrar.");
  const dataRecords = parsed.records.slice(1);
  if (dataRecords.length > CONSORTIUM_UNIT_CSV_MAX_ROWS) {
    globalErrors.push(`El archivo tiene ${dataRecords.length} filas; el máximo es ${CONSORTIUM_UNIT_CSV_MAX_ROWS}.`);
  }
  const existingCodes = buildExistingCodeSet(existingUnits);
  const importedCodes = new Map();
  const rows = dataRecords.slice(0, CONSORTIUM_UNIT_CSV_MAX_ROWS).map((record) => {
    const normalized = normalizeImportedRow(rawRecordToObject(record.values, headerResult.headers));
    const codeKey = normalizeKey(normalized.row.code);
    const item = { ...normalized, lineNumber: record.lineNumber, action: "create" };
    if (codeKey && existingCodes.has(codeKey)) item.errors.code = "La unidad ya existe en este consorcio";
    if (codeKey && importedCodes.has(codeKey)) {
      const previous = importedCodes.get(codeKey);
      const message = `Unidad repetida en las filas ${previous.lineNumber} y ${record.lineNumber}`;
      previous.errors.code = message;
      previous.action = "invalid";
      item.errors.code = message;
    } else if (codeKey) importedCodes.set(codeKey, item);
    if (Object.keys(item.errors).length) item.action = "invalid";
    return item;
  });
  const validRows = globalErrors.length ? [] : rows.filter((item) => item.action === "create");
  const summary = rows.reduce((result, item) => {
    result.total += 1;
    result[item.action === "create" ? "valid" : "invalid"] += 1;
    if (item.action === "create" && item.row.openingBalanceMajor !== 0) result.withBalance += 1;
    return result;
  }, { total: 0, valid: 0, invalid: 0, withBalance: 0 });
  return { rows, validRows, globalErrors, summary, delimiter: parsed.delimiter };
};

const escapeCsvValue = (value) => {
  const text = value?.toString?.() || "";
  return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export const buildConsortiumUnitCsvTemplate = () => {
  const rows = [
    ["1 A", "1", "A", "departamento", "5,25", "Ana Pérez", "27123456", "ana@email.com", "", "", "3515550101", "12500"],
    ["PB Local", "PB", "", "local", "3,10", "Comercial SRL", "30712345678", "admin@comercial.com", "Juan López", "juan@email.com", "3515550102", "-2500"],
  ];
  return `\uFEFF${[CONSORTIUM_UNIT_CSV_HEADERS, ...rows]
    .map((row) => row.map(escapeCsvValue).join(";"))
    .join("\r\n")}\r\n`;
};
