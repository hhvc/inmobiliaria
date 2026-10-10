import assert from "node:assert/strict";
import test from "node:test";

import {
  buildConsortiumExpenseFromAiDraft,
  findConsortiumExpenseDocumentDuplicate,
  matchConsortiumCoefficientGroup,
} from "../src/consorcios/utils/consorcioExpenseAi.helpers.js";

test("detecta un archivo idéntico por su hash", () => {
  const duplicate = findConsortiumExpenseDocumentDuplicate({
    candidate: { documentHash: "abc" },
    documents: [{ id: "doc-1", documentHash: "abc", voided: false }],
  });
  assert.equal(duplicate?.type, "exact");
  assert.equal(duplicate?.match?.id, "doc-1");
});

test("advierte un posible duplicado por proveedor y comprobante", () => {
  const duplicate = findConsortiumExpenseDocumentDuplicate({
    candidate: { providerName: "EPEC", voucherNumber: "0001-123" },
    documents: [{ provider: "Épec", voucherNumber: "0001123" }],
  });
  assert.equal(duplicate?.type, "possible");
});

test("relaciona la sugerencia con el grupo de coeficientes disponible", () => {
  const groups = [
    { id: "general", name: "Gastos generales", active: true },
    { id: "ascensores", name: "Ascensores", active: true },
  ];
  assert.equal(matchConsortiumCoefficientGroup("gasto de ascensor", groups), "ascensores");
  assert.equal(matchConsortiumCoefficientGroup("sin coincidencia", groups), "general");
});

test("convierte una lectura revisada en gasto sin asignar una unidad", () => {
  const expense = buildConsortiumExpenseFromAiDraft({
    concept: "Mantenimiento ascensor",
    amountMinor: 125000,
    category: "ordinary",
    distributionMode: "specific",
    coefficientGroupHint: "ascensores",
    providerName: "Proveedor SA",
    voucherNumber: "A-1",
  }, {
    id: "expense-1",
    coefficientGroups: [{ id: "ascensores", name: "Ascensores", active: true }],
  });
  assert.equal(expense.distributionMode, "coefficient");
  assert.equal(expense.coefficientGroupId, "ascensores");
  assert.equal(expense.amountMinor, 125000);
  assert.match(expense.notes, /Proveedor SA/);
});

