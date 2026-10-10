const cleanText = (value = "", maxLength = 500) => String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);

const cleanDate = (value = "") => {
    const normalized = cleanText(value, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : "";
};

const toMinor = (value) => {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount <= 0) return 0;
    return Math.min(Number.MAX_SAFE_INTEGER, Math.round(amount * 100));
};

export const CONSORTIUM_EXPENSE_DOCUMENT_SCHEMA = {
    type: "object",
    additionalProperties: false,
    properties: {
        providerName: {type: "string"},
        providerTaxId: {type: "string"},
        recipientName: {type: "string"},
        recipientTaxId: {type: "string"},
        voucherType: {
            type: "string",
            enum: [
                "invoice",
                "receipt",
                "credit_note",
                "debit_note",
                "ticket",
                "service_bill",
                "other",
                "unknown",
            ],
        },
        voucherNumber: {type: "string"},
        issueDate: {type: "string"},
        dueDate: {type: "string"},
        currency: {type: "string", enum: ["ARS", "USD", "OTHER", "UNKNOWN"]},
        totalAmount: {type: "number"},
        netAmount: {type: "number"},
        taxAmount: {type: "number"},
        cae: {type: "string"},
        caeDueDate: {type: "string"},
        suggestedConcept: {type: "string"},
        suggestedCategory: {type: "string", enum: ["ordinary", "extraordinary"]},
        suggestedDistributionMode: {
            type: "string",
            enum: ["coefficient", "equal", "specific"],
        },
        suggestedCoefficientHint: {type: "string"},
        confidence: {type: "number"},
        warnings: {type: "array", items: {type: "string"}},
    },
    required: [
        "providerName",
        "providerTaxId",
        "recipientName",
        "recipientTaxId",
        "voucherType",
        "voucherNumber",
        "issueDate",
        "dueDate",
        "currency",
        "totalAmount",
        "netAmount",
        "taxAmount",
        "cae",
        "caeDueDate",
        "suggestedConcept",
        "suggestedCategory",
        "suggestedDistributionMode",
        "suggestedCoefficientHint",
        "confidence",
        "warnings",
    ],
};

export const buildConsortiumExpenseDocumentInstructions = () => [
    "Leé un único comprobante de gasto de un consorcio argentino.",
    "Extraé solamente información visible. No inventes CUIT, fechas, importes ni números.",
    "Si un dato no está presente, devolvé texto vacío o 0 según el tipo del campo.",
    "Las fechas deben usar AAAA-MM-DD. Los importes deben ser números positivos en unidades monetarias, sin símbolos ni separadores de miles.",
    "recipientName y recipientTaxId identifican al receptor o cliente del comprobante, no al emisor. Si no están visibles, devolvé texto vacío.",
    "totalAmount es el total final a pagar. netAmount es el neto gravado y taxAmount es el IVA total discriminado; pueden ser 0 si no están claramente informados.",
    "cae es el Código de Autorización Electrónico de ARCA y caeDueDate su vencimiento. No confundas CAE con el número de comprobante, CAI u otros códigos.",
    "Para facturas de servicios, expensas, mantenimiento o compras habituales sugerí ordinary. Usá extraordinary solo si el documento evidencia una obra o gasto excepcional.",
    "La distribución predeterminada es coefficient. Usá equal o specific únicamente cuando el comprobante lo justifique claramente.",
    "suggestedCoefficientHint debe ser una palabra o frase breve como general, ascensores o cocheras; no inventes un identificador técnico.",
    "confidence debe estar entre 0 y 1. Agregá advertencias concretas sobre datos borrosos, dudosos o ausentes.",
    "El resultado es una sugerencia para revisión humana y nunca una registración contable automática.",
].join("\n");

export const sanitizeConsortiumExpenseDocumentResult = (value = {}) => {
    const voucherTypes = new Set([
        "invoice", "receipt", "credit_note", "debit_note", "ticket",
        "service_bill", "other", "unknown",
    ]);
    const currencies = new Set(["ARS", "USD", "OTHER", "UNKNOWN"]);
    const distributionModes = new Set(["coefficient", "equal", "specific"]);
    const confidence = Number(value.confidence);

    return {
        providerName: cleanText(value.providerName, 220),
        providerTaxId: cleanText(value.providerTaxId, 32).replace(/[^0-9-]/g, ""),
        recipientName: cleanText(value.recipientName, 220),
        recipientTaxId: cleanText(value.recipientTaxId, 32).replace(/[^0-9-]/g, ""),
        voucherType: voucherTypes.has(value.voucherType) ? value.voucherType : "unknown",
        voucherNumber: cleanText(value.voucherNumber, 120),
        issueDate: cleanDate(value.issueDate),
        dueDate: cleanDate(value.dueDate),
        currency: currencies.has(value.currency) ? value.currency : "UNKNOWN",
        totalAmountMinor: toMinor(value.totalAmount),
        netAmountMinor: toMinor(value.netAmount),
        taxAmountMinor: toMinor(value.taxAmount),
        cae: cleanText(value.cae, 30).replace(/\D/g, ""),
        caeDueDate: cleanDate(value.caeDueDate),
        suggestedConcept: cleanText(value.suggestedConcept, 220),
        suggestedCategory: value.suggestedCategory === "extraordinary" ?
            "extraordinary" : "ordinary",
        suggestedDistributionMode: distributionModes.has(value.suggestedDistributionMode) ?
            value.suggestedDistributionMode : "coefficient",
        suggestedCoefficientHint: cleanText(value.suggestedCoefficientHint, 80),
        confidence: Number.isFinite(confidence) ?
            Math.min(1, Math.max(0, confidence)) : 0,
        warnings: (Array.isArray(value.warnings) ? value.warnings : [])
            .map((item) => cleanText(item, 300))
            .filter(Boolean)
            .slice(0, 10),
    };
};

