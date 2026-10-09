import assert from "node:assert/strict";
import test from "node:test";

import {
  buildConsortiumUnitCsvImportPreview,
  buildConsortiumUnitCsvTemplate,
  detectConsortiumUnitCsvDelimiter,
  parseConsortiumUnitCsvRecords,
} from "../src/consorcios/utils/consorcioUnitsCsv.helpers.js";

test("genera una plantilla simple compatible con Excel", () => {
  const template = buildConsortiumUnitCsvTemplate();
  assert.equal(template.charCodeAt(0), 0xfeff);
  assert.match(template, /unidad;piso;departamento;tipo;coeficiente/);
  assert.match(template, /saldo_inicial/);
});

test("detecta separador y conserva campos entre comillas", () => {
  const source = 'unidad;titular\r\n1 A;"Pérez; Ana"';
  assert.equal(detectConsortiumUnitCsvDelimiter(source), ";");
  const parsed = parseConsortiumUnitCsvRecords(source);
  assert.deepEqual(parsed.records[1].values, ["1 A", "Pérez; Ana"]);
});

test("normaliza unidades y saldos deudores o a favor", () => {
  const preview = buildConsortiumUnitCsvImportPreview([
    "unidad;tipo;coeficiente;email_titular;saldo_inicial",
    "1 A;Departamento;5,25;ana@example.com;12.500,50",
    "PB Local;Local;3,10;local@example.com;-2.500",
  ].join("\n"));

  assert.deepEqual(preview.summary, {
    total: 2,
    valid: 2,
    invalid: 0,
    withBalance: 2,
  });
  assert.equal(preview.validRows[0].row.type, "apartment");
  assert.equal(preview.validRows[0].row.coefficient, 5.25);
  assert.equal(preview.validRows[0].row.openingBalanceMajor, 12500.5);
  assert.equal(preview.validRows[1].row.type, "commercial");
  assert.equal(preview.validRows[1].row.openingBalanceMajor, -2500);
});

test("rechaza duplicados, unidades existentes y emails inválidos", () => {
  const preview = buildConsortiumUnitCsvImportPreview([
    "unidad;email_titular",
    "1A;no-es-email",
    "1a;ana@example.com",
    "2B;otro@example.com",
  ].join("\n"), [{ id: "unit-2", code: "2b" }]);

  assert.equal(preview.summary.invalid, 3);
  assert.equal(preview.validRows.length, 0);
  assert.match(preview.rows[0].errors.code, /repetida/i);
  assert.match(preview.rows[0].errors.ownerEmail, /inválido/i);
  assert.match(preview.rows[2].errors.code, /ya existe/i);
});

test("informa archivo vacío, encabezado faltante y comilla abierta", () => {
  const empty = buildConsortiumUnitCsvImportPreview("");
  assert.match(empty.globalErrors[0], /vacío/i);

  const invalid = buildConsortiumUnitCsvImportPreview('tipo;coeficiente\ndepartamento;"5,2');
  assert.ok(invalid.globalErrors.some((message) => /unidad/i.test(message)));
  assert.ok(invalid.globalErrors.some((message) => /comilla/i.test(message)));
});
