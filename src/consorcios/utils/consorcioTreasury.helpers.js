import { parseConsortiumUnitCsvRecords } from "./consorcioUnitsCsv.helpers.js";

const cleanText = (value = "", maxLength = 500) => value
  ?.toString?.()
  .trim()
  .replace(/\s+/g, " ")
  .slice(0, maxLength) || "";

const normalizeName = (value = "") => cleanText(value)
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-zA-Z0-9]/g, "")
  .toLowerCase();

const normalizeTaxId = (value = "") => cleanText(value).replace(/\D/g, "");

const voucherTypeForObligation = (value = "") => {
  if (value === "receipt") return "receipt";
  if (["invoice", "service_bill", "ticket"].includes(value)) return "invoice";
  return value === "unknown" ? "no_data" : "other";
};

export const findConsortiumSupplierForDocument = (document = {}, suppliers = []) => {
  const activeSuppliers = (Array.isArray(suppliers) ? suppliers : [])
    .filter((supplier) => supplier.active !== false && supplier.deleted !== true);
  const taxId = normalizeTaxId(document.providerTaxId);
  if (taxId) {
    const taxMatch = activeSuppliers.find(
      (supplier) => normalizeTaxId(supplier.taxId) === taxId,
    );
    if (taxMatch) return { supplier: taxMatch, matchType: "tax_id" };
  }
  const providerName = normalizeName(document.provider);
  if (!providerName) return { supplier: null, matchType: "none" };
  const nameMatch = activeSuppliers.find((supplier) => (
    [supplier.name, supplier.legalName].some((value) => normalizeName(value) === providerName)
  ));
  return nameMatch
    ? { supplier: nameMatch, matchType: "name" }
    : { supplier: null, matchType: "none" };
};

export const findConsortiumPayableForDocument = (document = {}, obligations = []) => (
  (Array.isArray(obligations) ? obligations : []).find((obligation) => (
    obligation.voided !== true
    && obligation.periodId === document.periodId
    && obligation.expenseId === document.expenseId
  )) || null
);

export const buildConsortiumPayableDraftFromDocument = ({
  consortiumId = "",
  document = {},
  expense = {},
  supplierId = "",
  currency = "ARS",
  today = new Date().toISOString().slice(0, 10),
} = {}) => {
  const issueDate = /^\d{4}-\d{2}-\d{2}$/.test(document.documentDate)
    ? document.documentDate : today;
  const dueDate = /^\d{4}-\d{2}-\d{2}$/.test(document.dueDate)
    ? document.dueDate : issueDate;
  const documentTotalMinor = Math.max(0, Math.round(Number(document.documentTotalMinor) || 0));
  const expenseAmountMinor = Math.max(0, Math.round(Number(expense.amountMinor) || 0));
  const obligationCurrency = cleanText(expense.periodCurrency || currency, 10) || "ARS";
  const documentCurrency = cleanText(document.currency, 10);
  const compatibleDocumentCurrency = !documentCurrency
    || documentCurrency === "UNKNOWN"
    || documentCurrency === obligationCurrency;
  const details = [
    document.expenseDocumentId || document.id
      ? `Comprobante archivado: ${document.originalFileName || document.fileName || document.id}`
      : "",
    document.cae ? `CAE ${document.cae}${document.caeDueDate ? ` (vence ${document.caeDueDate})` : ""}` : "",
    Number(document.documentNetMinor || 0) > 0
      ? `Neto ${(Number(document.documentNetMinor) / 100).toFixed(2)}` : "",
    Number(document.documentTaxMinor || 0) > 0
      ? `IVA ${(Number(document.documentTaxMinor) / 100).toFixed(2)}` : "",
    document.recipientName || document.recipientTaxId
      ? `Receptor: ${[document.recipientName, document.recipientTaxId].filter(Boolean).join(" · ")}` : "",
    document.notes,
  ].filter(Boolean).join(" · ");
  return {
    consortiumId,
    supplierId,
    concept: cleanText(document.expenseConcept || expense.concept, 220),
    voucherType: voucherTypeForObligation(document.voucherType),
    voucherNumber: cleanText(document.voucherNumber, 120),
    issueDate,
    dueDate,
    currency: obligationCurrency,
    amountMajor: ((compatibleDocumentCurrency && documentTotalMinor
      ? documentTotalMinor
      : expenseAmountMinor) / 100).toFixed(2),
    periodId: document.periodId || expense.periodId || "",
    expenseId: document.expenseId || expense.id || "",
    expenseLink: document.periodId && document.expenseId
      ? `${document.periodId}::${document.expenseId}` : "",
    expenseDocumentId: document.id || "",
    notes: cleanText(details, 2000),
    file: null,
  };
};

export const buildConsortiumSupplierDraftFromDocument = ({
  consortiumId = "",
  document = {},
} = {}) => ({
  consortiumId,
  name: cleanText(document.provider || "Proveedor a revisar", 220),
  legalName: cleanText(document.provider, 220),
  taxId: cleanText(document.providerTaxId, 32),
  category: "other",
  email: "",
  phone: "",
  address: "",
  bankAccount: "",
  notes: document.aiAssisted
    ? "Datos sugeridos a partir del comprobante. Revisados por la administración."
    : "Datos tomados del comprobante de gasto.",
  active: true,
  deleted: false,
});

export const getConsortiumSupplierPaymentPlanMeta = (
  obligation = {},
  dateKey = new Date().toISOString().slice(0, 10),
) => {
  const plan = obligation.paymentPlan || {};
  if (!plan.status || ["cancelled", "executed"].includes(plan.status)) return null;
  if (plan.status === "partial") {
    return { id: "partial", label: "Programación parcial", badge: "text-bg-warning" };
  }
  if (plan.status === "scheduled") {
    return { id: "scheduled", label: "Pendiente de autorización", badge: "text-bg-secondary" };
  }
  if (plan.status === "authorized" && plan.scheduledDate < dateKey) {
    return { id: "overdue", label: "Pago programado vencido", badge: "text-bg-danger" };
  }
  if (plan.status === "authorized" && plan.scheduledDate === dateKey) {
    return { id: "due_today", label: "Pagar hoy", badge: "text-bg-warning" };
  }
  if (plan.status === "authorized") {
    return { id: "authorized", label: "Pago autorizado", badge: "text-bg-primary" };
  }
  return { id: plan.status, label: plan.status, badge: "text-bg-light" };
};

export const getConsortiumSupplierPaymentAgenda = (
  obligations = [],
  dateKey = new Date().toISOString().slice(0, 10),
) => (Array.isArray(obligations) ? obligations : [])
  .map((obligation) => ({
    obligation,
    plan: obligation.paymentPlan || {},
    meta: getConsortiumSupplierPaymentPlanMeta(obligation, dateKey),
  }))
  .filter((item) => item.meta && item.obligation.voided !== true)
  .sort((left, right) => (
    (left.plan.scheduledDate || "9999-12-31").localeCompare(right.plan.scheduledDate || "9999-12-31")
    || (left.obligation.supplierSnapshot?.name || "").localeCompare(
      right.obligation.supplierSnapshot?.name || "",
      "es",
    )
  ));

export const CONSORTIUM_BANK_STATEMENT_MAX_ROWS = 500;

export const CONSORTIUM_BANK_STATEMENT_TEMPLATE = [
  "fecha;concepto;referencia;ingreso;egreso",
  "01/10/2026;Transferencia unidad 1;TRX-0001;150000,00;",
  "02/10/2026;Pago servicio de limpieza;OP-0002;;85000,00",
].join("\r\n");

const BANK_STATEMENT_HEADER_ALIASES = {
  fecha: "date",
  date: "date",
  fecha_movimiento: "date",
  concepto: "concept",
  descripcion: "concept",
  detalle: "concept",
  movimiento: "concept",
  referencia: "reference",
  reference: "reference",
  comprobante: "reference",
  id_operacion: "reference",
  ingreso: "inflow",
  ingresos: "inflow",
  credito: "inflow",
  creditos: "inflow",
  haber: "inflow",
  egreso: "outflow",
  egresos: "outflow",
  debito: "outflow",
  debitos: "outflow",
  debe: "outflow",
  importe: "amount",
  monto: "amount",
  amount: "amount",
  tipo: "direction",
  direccion: "direction",
  direction: "direction",
};

const normalizeCsvKey = (value = "") => cleanText(value, 120)
  .toLowerCase()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-z0-9]+/g, "_")
  .replace(/^_+|_+$/g, "");

const normalizeStatementDate = (value = "") => {
  const text = cleanText(value, 40);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const match = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.exec(text);
  if (!match) return "";
  const [, dayText, monthText, yearText] = match;
  const day = Number(dayText);
  const month = Number(monthText);
  const date = new Date(Date.UTC(Number(yearText), month - 1, day, 12));
  if (date.getUTCFullYear() !== Number(yearText)
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day) return "";
  return `${yearText}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};

const parseStatementAmount = (value) => {
  const raw = value?.toString?.().trim?.() || "";
  if (!raw) return { empty: true, valid: true, amountMinor: 0, negative: false };
  const parenthesized = /^\(.*\)$/.test(raw);
  let clean = raw.replace(/\s/g, "").replace(/[^0-9,.-]/g, "");
  if (!/[0-9]/.test(clean)) {
    return { empty: false, valid: false, amountMinor: 0, negative: false };
  }
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
  let amount = Number(clean);
  if (parenthesized && amount > 0) amount *= -1;
  return {
    empty: false,
    valid: Number.isFinite(amount),
    amountMinor: Number.isFinite(amount) ? Math.round(Math.abs(amount) * 100) : 0,
    negative: amount < 0,
  };
};

const statementDirection = (value = "") => {
  const normalized = normalizeCsvKey(value);
  if (["egreso", "debito", "debe", "salida", "outflow"].includes(normalized)) return "outflow";
  if (["ingreso", "credito", "haber", "entrada", "inflow"].includes(normalized)) return "inflow";
  return "";
};

const buildBankStatementHeaderMap = (values = []) => {
  const fields = [];
  const used = new Set();
  const errors = [];
  values.forEach((value, index) => {
    const field = BANK_STATEMENT_HEADER_ALIASES[normalizeCsvKey(value)] || "";
    fields[index] = field;
    if (field && used.has(field)) errors.push(`La columna “${value}” está repetida.`);
    if (field) used.add(field);
  });
  if (!used.has("date")) errors.push("Falta la columna obligatoria “fecha”.");
  if (!used.has("concept")) errors.push("Falta la columna obligatoria “concepto”.");
  if (!used.has("amount") && !used.has("inflow") && !used.has("outflow")) {
    errors.push("Falta “importe” o las columnas “ingreso” y “egreso”.");
  }
  return { fields, errors };
};

const csvRecordObject = (values, fields) => fields.reduce((result, field, index) => {
  if (field) result[field] = values[index] ?? "";
  return result;
}, {});

export const parseConsortiumBankStatementCsv = (text = "") => {
  const parsed = parseConsortiumUnitCsvRecords(text);
  if (!parsed.records.length) {
    return {
      rows: [],
      validRows: [],
      globalErrors: ["El archivo está vacío."],
      delimiter: parsed.delimiter,
      summary: { total: 0, valid: 0, invalid: 0, inflowsMinor: 0, outflowsMinor: 0 },
    };
  }
  const headerMap = buildBankStatementHeaderMap(parsed.records[0].values);
  const globalErrors = [...headerMap.errors];
  if (parsed.unclosedQuote) globalErrors.push("El archivo contiene una comilla sin cerrar.");
  const sourceRows = parsed.records.slice(1);
  if (sourceRows.length > CONSORTIUM_BANK_STATEMENT_MAX_ROWS) {
    globalErrors.push(
      `El archivo tiene ${sourceRows.length} movimientos; el máximo es ${CONSORTIUM_BANK_STATEMENT_MAX_ROWS}.`,
    );
  }
  const rows = sourceRows.slice(0, CONSORTIUM_BANK_STATEMENT_MAX_ROWS).map((record, index) => {
    const raw = csvRecordObject(record.values, headerMap.fields);
    const date = normalizeStatementDate(raw.date);
    const inflow = parseStatementAmount(raw.inflow);
    const outflow = parseStatementAmount(raw.outflow);
    const amount = parseStatementAmount(raw.amount);
    const errors = [];
    let direction = "";
    let amountMinor = 0;
    if (!date) errors.push("Fecha inválida");
    if (!cleanText(raw.concept, 220)) errors.push("Concepto vacío");
    if (!inflow.valid || !outflow.valid || !amount.valid) errors.push("Importe inválido");
    if (inflow.amountMinor > 0 && outflow.amountMinor > 0) {
      errors.push("La fila no puede tener ingreso y egreso a la vez");
    } else if (inflow.amountMinor > 0 || outflow.amountMinor > 0) {
      direction = inflow.amountMinor > 0 ? "inflow" : "outflow";
      amountMinor = inflow.amountMinor || outflow.amountMinor;
    } else if (!amount.empty && amount.valid && amount.amountMinor > 0) {
      direction = statementDirection(raw.direction) || (amount.negative ? "outflow" : "inflow");
      amountMinor = amount.amountMinor;
    }
    if (!direction || amountMinor <= 0) errors.push("Ingresá un importe distinto de cero");
    return {
      id: `statement-${index + 1}`,
      lineNumber: record.lineNumber,
      date,
      concept: cleanText(raw.concept, 220),
      reference: cleanText(raw.reference, 220),
      direction,
      amountMinor,
      errors,
    };
  });
  const validRows = rows.filter((row) => row.errors.length === 0);
  return {
    rows,
    validRows,
    globalErrors,
    delimiter: parsed.delimiter,
    summary: {
      total: rows.length,
      valid: validRows.length,
      invalid: rows.length - validRows.length,
      inflowsMinor: validRows.filter((row) => row.direction === "inflow")
        .reduce((sum, row) => sum + row.amountMinor, 0),
      outflowsMinor: validRows.filter((row) => row.direction === "outflow")
        .reduce((sum, row) => sum + row.amountMinor, 0),
    },
  };
};

const normalizedMatchText = (value = "") => cleanText(value, 500)
  .toLowerCase()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-z0-9]+/g, " ")
  .trim();

const dateDistance = (first = "", second = "") => {
  const firstDate = /^\d{4}-\d{2}-\d{2}$/.test(first) ? new Date(`${first}T12:00:00Z`) : null;
  const secondDate = /^\d{4}-\d{2}-\d{2}$/.test(second) ? new Date(`${second}T12:00:00Z`) : null;
  if (!firstDate || !secondDate) return 999;
  return Math.abs(Math.round((firstDate - secondDate) / 86400000));
};

const sharedTokenScore = (first = "", second = "") => {
  const firstTokens = new Set(normalizedMatchText(first).split(" ").filter((token) => token.length >= 3));
  const secondTokens = new Set(normalizedMatchText(second).split(" ").filter((token) => token.length >= 3));
  if (!firstTokens.size || !secondTokens.size) return 0;
  const shared = [...firstTokens].filter((token) => secondTokens.has(token)).length;
  return Math.min(15, Math.round((shared / Math.max(firstTokens.size, secondTokens.size)) * 15));
};

const scoreStatementMovement = (row, movement) => {
  if (movement.voided === true
    || movement.direction !== row.direction
    || Math.round(Number(movement.amountMinor) || 0) !== row.amountMinor) return null;
  let score = 45;
  const days = dateDistance(row.date, movement.date);
  if (days === 0) score += 35;
  else if (days === 1) score += 25;
  else if (days <= 3) score += 15;
  else if (days <= 7) score += 5;
  else return null;
  const rowReference = normalizedMatchText(row.reference);
  const movementReference = normalizedMatchText(movement.reference);
  if (rowReference && movementReference) {
    if (rowReference === movementReference) score += 20;
    else if (rowReference.includes(movementReference) || movementReference.includes(rowReference)) score += 12;
  }
  score += sharedTokenScore(row.concept, movement.concept);
  return { score: Math.min(100, score), days };
};

export const matchConsortiumBankStatementRows = ({
  rows = [],
  movements = [],
  accountId = "",
  currency = "ARS",
  excludedMovementIds = [],
} = {}) => {
  const excluded = new Set(excludedMovementIds);
  const suggested = new Set();
  const available = (Array.isArray(movements) ? movements : []).filter((movement) => (
    movement.accountId === accountId
    && (movement.currency || "ARS") === currency
    && movement.voided !== true
    && !excluded.has(movement.id)
  ));
  return (Array.isArray(rows) ? rows : []).map((row) => {
    if (row.errors?.length) return { ...row, candidates: [], suggestedMovementId: "", confidence: "none" };
    const candidates = available.map((movement) => {
      const result = scoreStatementMovement(row, movement);
      return result ? { movement, ...result } : null;
    }).filter(Boolean).sort((left, right) => right.score - left.score || left.days - right.days);
    const best = candidates.find((candidate) => !suggested.has(candidate.movement.id));
    const runnerUp = candidates.find((candidate) => candidate.movement.id !== best?.movement.id);
    const unambiguous = Boolean(best) && (!runnerUp || best.score - runnerUp.score >= 10);
    const confidence = best?.score >= 80 && unambiguous
      ? "high"
      : best?.score >= 60
        ? "medium"
        : best ? "low" : "none";
    const suggestedMovementId = confidence === "high" ? best.movement.id : "";
    if (suggestedMovementId) suggested.add(suggestedMovementId);
    return {
      ...row,
      candidates,
      suggestedMovementId,
      confidence,
    };
  });
};

export const buildConsortiumTreasuryMovementDraftFromStatementRow = ({
  row = {},
  accountId = "",
  consortiumId = "",
  statementFileHash = "",
} = {}) => {
  const lineNumber = Math.max(0, Math.round(Number(row.lineNumber) || 0));
  const amountMinor = Math.max(0, Math.round(Number(row.amountMinor) || 0));
  const reference = cleanText(row.reference, 220);
  const concept = cleanText(row.concept, 220)
    || `Movimiento bancario${lineNumber ? ` · fila ${lineNumber}` : ""}`;
  const traceLabel = [
    lineNumber ? `fila ${lineNumber}` : "fila sin número",
    reference ? `referencia ${reference}` : "",
  ].filter(Boolean).join(" · ");

  return {
    consortiumId: cleanText(consortiumId, 160),
    accountId: cleanText(accountId, 160),
    rowId: cleanText(row.id, 160),
    lineNumber,
    direction: row.direction === "outflow" ? "outflow" : "inflow",
    amountMinor,
    amountMajor: (amountMinor / 100).toFixed(2),
    date: /^\d{4}-\d{2}-\d{2}$/.test(row.date || "") ? row.date : "",
    concept,
    reference,
    reason: `Registrado durante la revisión del extracto bancario · ${traceLabel}.`,
    statementFileHash: cleanText(statementFileHash, 64)
      .toLowerCase()
      .replace(/[^a-f0-9]/g, ""),
  };
};

const csvCell = (value) => {
  const text = value?.toString?.() || "";
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
};

export const buildConsortiumBankStatementReviewCsv = ({ rows = [], selections = {} } = {}) => [
  ["Fecha", "Concepto", "Referencia", "Dirección", "Importe", "Movimiento vinculado", "Estado"]
    .map(csvCell).join(";"),
  ...(Array.isArray(rows) ? rows : []).map((row) => [
    row.date,
    row.concept,
    row.reference,
    row.direction === "outflow" ? "Egreso" : "Ingreso",
    (Number(row.amountMinor || 0) / 100).toFixed(2).replace(".", ","),
    selections[row.id] || "",
    row.errors?.length ? row.errors.join(" · ") : selections[row.id] ? "Conciliado" : "Pendiente",
  ].map(csvCell).join(";")),
].join("\r\n");
