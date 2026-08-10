import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeTaxNotificationEmails,
  normalizeTaxNotificationSettings,
  normalizeTaxObject,
  normalizeTaxObligation,
  resolveTaxObligationStatus,
  summarizeTaxPortfolio,
  taxMajorToMinor,
  validateTaxObject,
  validateTaxObligation,
} from "../src/tributos/utils/tax.helpers.js";

const validObject = {
  providerId: "municipalidad_cordoba",
  identifierType: "cadastral_designation",
  identifier: "11-22-333-444",
  inmuebleId: "inmueble-1",
  inmuebleSnapshot: {
    title: "Casa Centro",
    address: "San Martín 100",
  },
};

test("normaliza el objeto fiscal con snapshot jurisdiccional", () => {
  const item = normalizeTaxObject(validObject);
  assert.equal(item.authority.name, "Municipalidad de Córdoba");
  assert.equal(item.jurisdiction.level, "municipal");
  assert.equal(item.taxType, "municipal_property");
  assert.deepEqual(validateTaxObject(item), []);
});

test("exige inmueble, identificador y URLs oficiales seguras", () => {
  const errors = validateTaxObject({
    ...validObject,
    inmuebleId: "",
    identifier: "",
    officialPortalUrl: "http://sitio-inseguro.test",
  }).join(" ");
  assert.match(errors, /inmueble/i);
  assert.match(errors, /designación catastral/i);
  assert.match(errors, /HTTPS/i);
});

test("calcula importes en centavos con formato argentino", () => {
  assert.equal(taxMajorToMinor("10.500,25"), 1050025);
  assert.equal(taxMajorToMinor(1000.5), 100050);
});

test("deriva pendiente o vencida sin pisar estados de gestión", () => {
  const base = { dueDate: "2026-08-10", status: "pending" };
  assert.equal(resolveTaxObligationStatus(base, "2026-08-09"), "pending");
  assert.equal(resolveTaxObligationStatus(base, "2026-08-11"), "overdue");
  assert.equal(resolveTaxObligationStatus({ ...base, status: "disputed" }, "2026-08-11"), "disputed");
});

test("valida una obligación manual completa", () => {
  const item = normalizeTaxObligation({
    taxObjectId: "object-1",
    concept: "Cuota inmobiliaria municipal",
    periodKey: "2026-08",
    dueDate: "2026-08-10",
    amountMinor: 250000,
    officialPaymentUrl: "https://pagosmuni.cordoba.gob.ar/",
  }, "2026-08-01");
  assert.deepEqual(validateTaxObligation(item), []);
  assert.equal(item.status, "pending");
});

test("resume objetos, deuda vencida y próximos vencimientos", () => {
  const summary = summarizeTaxPortfolio(
    [{ status: "active" }, { status: "archived" }],
    [
      { status: "pending", dueDate: "2026-08-15", amountMinor: 10000 },
      { status: "pending", dueDate: "2026-07-15", amountMinor: 20000 },
      { status: "paid", dueDate: "2026-07-01", amountMinor: 30000 },
    ],
    "2026-08-01",
  );
  assert.deepEqual(summary, {
    activeObjects: 1,
    pending: 1,
    overdue: 1,
    dueSoon: 1,
    outstandingAmountMinor: 30000,
  });
});

test("normaliza la configuración de alertas y exige destinatarios al activar email", () => {
  const settings = normalizeTaxNotificationSettings({
    emailEnabled: true,
    recipientEmails: "ADMIN@ONO.COM, inválido, admin@ono.com",
  });
  assert.deepEqual(settings.recipientEmails, ["admin@ono.com"]);
  assert.deepEqual(
    normalizeTaxNotificationEmails("uno@ono.com, DOS@ONO.COM"),
    ["uno@ono.com", "dos@ono.com"],
  );
  assert.equal(normalizeTaxNotificationSettings({}).emailEnabled, false);
});
