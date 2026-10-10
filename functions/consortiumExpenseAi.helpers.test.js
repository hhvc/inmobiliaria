import assert from "node:assert/strict";
import test from "node:test";

import {
    buildConsortiumExpenseDocumentInstructions,
    CONSORTIUM_EXPENSE_DOCUMENT_SCHEMA,
    sanitizeConsortiumExpenseDocumentResult,
} from "./consortiumExpenseAi.helpers.js";

test("define una salida estricta y recuerda la revisión humana", () => {
    assert.equal(CONSORTIUM_EXPENSE_DOCUMENT_SCHEMA.additionalProperties, false);
    assert.equal(
        CONSORTIUM_EXPENSE_DOCUMENT_SCHEMA.required.length,
        Object.keys(CONSORTIUM_EXPENSE_DOCUMENT_SCHEMA.properties).length,
    );
    assert.match(buildConsortiumExpenseDocumentInstructions(), /revisión humana/i);
});

test("normaliza el comprobante sin aceptar campos o importes inseguros", () => {
    const result = sanitizeConsortiumExpenseDocumentResult({
        providerName: "  Servicios   Córdoba SA ",
        providerTaxId: "CUIT 30-12345678-9",
        voucherType: "invoice",
        voucherNumber: "A 0001-00000123",
        issueDate: "2026-10-08",
        dueDate: "08/11/2026",
        currency: "ARS",
        totalAmount: 1234.56,
        netAmount: -1,
        taxAmount: 214.2,
        suggestedConcept: "Mantenimiento de ascensores",
        suggestedCategory: "ordinary",
        suggestedDistributionMode: "coefficient",
        suggestedCoefficientHint: "ascensores",
        confidence: 4,
        warnings: [" Revisar fecha ", "", null],
    });
    assert.equal(result.providerName, "Servicios Córdoba SA");
    assert.equal(result.providerTaxId, "30-12345678-9");
    assert.equal(result.issueDate, "2026-10-08");
    assert.equal(result.dueDate, "");
    assert.equal(result.totalAmountMinor, 123456);
    assert.equal(result.netAmountMinor, 0);
    assert.equal(result.confidence, 1);
    assert.deepEqual(result.warnings, ["Revisar fecha"]);
});

