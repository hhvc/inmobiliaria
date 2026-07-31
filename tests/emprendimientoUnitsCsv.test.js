import assert from "node:assert/strict";
import test from "node:test";

import {
  buildUnitCsvImportPreview,
  buildUnitCsvTemplate,
  detectUnitCsvDelimiter,
  parseUnitCsvRecords,
} from "../src/emprendimiento/utils/emprendimientoUnitsCsv.helpers.js";

test("genera una plantilla UTF-8 compatible con Excel", () => {
  const template = buildUnitCsvTemplate();

  assert.equal(template.charCodeAt(0), 0xfeff);
  assert.match(template, /codigo;tipo;tipologia/);
  assert.match(template, /72,5;venta;95000;USD/);
});

test("detecta separadores y respeta valores entre comillas", () => {
  const text = 'codigo;tipo;tipologia\r\n1A;departamento;"Dos; al frente"';

  assert.equal(detectUnitCsvDelimiter(text), ";");
  const parsed = parseUnitCsvRecords(text);
  assert.deepEqual(parsed.records[1].values, [
    "1A",
    "departamento",
    "Dos; al frente",
  ]);
});

test("crea nuevas unidades y actualiza existentes por código", () => {
  const preview = buildUnitCsvImportPreview(
    [
      "codigo;tipo;tipologia;superficie;operacion;precio;moneda;disponibilidad",
      "1A;Departamento;2 dormitorios;72,5;Venta;95.000;USD;Disponible",
      "2B;departamento;1 dormitorio;55;venta;80000;USD;reservada",
    ].join("\n"),
    [
      {
        id: "unit-1",
        unidadEmprendimiento: { codigo: "1a" },
      },
    ],
  );

  assert.deepEqual(preview.summary, {
    total: 2,
    create: 1,
    update: 1,
    invalid: 0,
  });
  assert.equal(preview.validRows[0].action, "update");
  assert.equal(preview.validRows[0].existingId, "unit-1");
  assert.equal(preview.validRows[0].row.superficie, 72.5);
  assert.equal(preview.validRows[0].row.precio, 95000);
  assert.equal(preview.validRows[1].action, "create");
});

test("rechaza códigos repetidos y valores fuera del catálogo", () => {
  const preview = buildUnitCsvImportPreview(
    [
      "codigo;tipo;operacion;moneda;disponibilidad",
      "A1;castillo;venta;EUR;disponible",
      "a1;departamento;permuta;USD;libre",
    ].join("\n"),
  );

  assert.equal(preview.summary.invalid, 2);
  assert.equal(preview.validRows.length, 0);
  assert.match(preview.rows[0].errors.codigo, /repetido/i);
  assert.match(preview.rows[0].errors.tipo, /inválido/i);
  assert.match(preview.rows[1].errors.operacion, /inválida/i);
});

test("informa encabezados obligatorios y comillas sin cerrar", () => {
  const preview = buildUnitCsvImportPreview('tipo;precio\ndepartamento;"95000');

  assert.ok(preview.globalErrors.some((error) => /codigo/i.test(error)));
  assert.ok(preview.globalErrors.some((error) => /comilla/i.test(error)));
  assert.equal(preview.validRows.length, 0);
});

test("rechaza números ilegibles, negativos o fraccionarios donde no corresponden", () => {
  const preview = buildUnitCsvImportPreview(
    [
      "codigo;tipo;ambientes;dormitorios;superficie;operacion;precio",
      "A1;departamento;2,5;dos;-10;venta;abc",
    ].join("\n"),
  );

  assert.equal(preview.summary.invalid, 1);
  assert.match(preview.rows[0].errors.ambientes, /entero/i);
  assert.match(preview.rows[0].errors.dormitorios, /inválido/i);
  assert.match(preview.rows[0].errors.superficie, /negativo/i);
  assert.match(preview.rows[0].errors.precio, /inválido/i);
});
