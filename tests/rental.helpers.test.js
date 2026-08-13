import assert from "node:assert/strict";
import test from "node:test";

import {
  addMonthsClamped,
  buildRentalOwnerAccountStatement,
  buildRentalObligation,
  calculateRentalSettlement,
  formatRentalAmountInWords,
  formatRentalMoney,
  getContractPeriodKeys,
  getObligationStatus,
  hasRentalObligationActivity,
  isRentalObligationWithinContract,
  majorToMinor,
  resolveRentForPeriod,
  syncRentalObligationFromContract,
  validateRentalContract,
} from "../src/alquileres/utils/rental.helpers.js";
import { normalizeRentalContract } from "../src/alquileres/utils/rentalSchema.js";

const contract = normalizeRentalContract({
  id: "contract-1",
  inmuebleId: "property-1",
  partyIds: { owners: ["owner-1"], tenants: ["tenant-1"], guarantors: [] },
  startDate: "2026-01-31",
  endDate: "2026-12-31",
  currency: "ARS",
  dueDay: 10,
  financial: {
    initialRentAmountMinor: 10000000,
    currentRentAmountMinor: 10000000,
    adjustment: { mode: "fixed_percent", frequencyMonths: 3, fixedPercent: 10 },
    administrationFee: { percent: 8, fixedAmountMinor: 0 },
  },
  rentSchedule: [{ effectiveFrom: "2026-01-31", amountMinor: 10000000 }],
});

test("normaliza importes argentinos a centavos", () => {
  assert.equal(majorToMinor("100.000,50"), 10000050);
  assert.equal(majorToMinor("100000.50"), 10000050);
});

test("no presenta una moneda contractual genérica como pesos", () => {
  assert.match(formatRentalMoney(125050, "OTHER"), /moneda pactada/);
  assert.doesNotMatch(formatRentalMoney(125050, "OTHER"), /\$/);
});

test("expresa los importes de recibos en letras mayúsculas y conserva la cifra entre paréntesis", () => {
  const formatted = formatRentalAmountInWords(150000000, "ARS");
  assert.match(formatted, /^PESOS UN MILLÓN QUINIENTOS MIL \(/u);
  assert.match(formatted, /1\.500\.000,00\)$/u);
});

test("antepone la moneda también en importes que son millones exactos", () => {
  assert.match(formatRentalAmountInWords(200000000, "ARS"), /^PESOS DOS MILLONES \(/u);
});

test("suma meses sin desbordar el último día", () => {
  assert.equal(addMonthsClamped("2026-01-31", 1), "2026-02-28");
  assert.equal(addMonthsClamped("2026-01-31", 2), "2026-03-31");
});

test("genera períodos mensuales dentro de la vigencia", () => {
  assert.deepEqual(
    getContractPeriodKeys(contract, { throughDate: "2026-04-15" }),
    ["2026-01", "2026-02", "2026-03", "2026-04"],
  );
});

test("un alquiler temporal de un día genera una única obligación con fechas exactas", () => {
  const temporary = normalizeRentalContract({
    ...contract,
    id: "temporary-1",
    contractType: "temporary",
    startDate: "2026-08-13",
    endDate: "2026-08-13",
    paymentDueDate: "2026-08-13",
    dueDay: 0,
    financial: {
      ...contract.financial,
      initialRentAmountMinor: 500,
      currentRentAmountMinor: 500,
      adjustment: { mode: "index", indexName: "" },
    },
  });
  assert.deepEqual(
    getContractPeriodKeys(temporary, { throughDate: "2026-08-13" }),
    ["2026-08"],
  );
  const obligation = buildRentalObligation(
    temporary,
    "2026-08",
    new Date("2026-08-13T12:00:00Z"),
  );
  assert.equal(obligation.obligationType, "single_stay");
  assert.equal(obligation.serviceStartDate, "2026-08-13");
  assert.equal(obligation.serviceEndDate, "2026-08-13");
  assert.equal(obligation.dueDate, "2026-08-13");
  assert.equal(obligation.totalAmountMinor, 500);
  assert.deepEqual(validateRentalContract(temporary), []);
});

test("una estadía temporal que cruza de mes conserva una sola obligación", () => {
  const temporary = normalizeRentalContract({
    ...contract,
    contractType: "temporary",
    startDate: "2026-08-30",
    endDate: "2026-09-02",
    paymentDueDate: "2026-08-25",
  });
  assert.deepEqual(
    getContractPeriodKeys(temporary, { throughDate: "2026-09-02" }),
    ["2026-08"],
  );
  assert.equal(isRentalObligationWithinContract({ periodKey: "2026-08" }, temporary), true);
  assert.equal(isRentalObligationWithinContract({ periodKey: "2026-09" }, temporary), false);
});

test("detecta obligaciones que quedaron fuera de una vigencia editada", () => {
  assert.equal(isRentalObligationWithinContract({ periodKey: "2026-04" }, contract), true);
  assert.equal(isRentalObligationWithinContract({ periodKey: "2025-12" }, contract), false);
  assert.equal(isRentalObligationWithinContract({ periodKey: "2027-01" }, contract), false);
  assert.equal(isRentalObligationWithinContract({ periodKey: "inválido" }, contract), false);
});

test("capitaliza el porcentaje fijo solo en cada frecuencia pactada", () => {
  assert.equal(resolveRentForPeriod(contract, "2026-03"), 10000000);
  assert.equal(resolveRentForPeriod(contract, "2026-04"), 11000000);
  assert.equal(resolveRentForPeriod(contract, "2026-07"), 12100000);
});

test("crea una obligación reproducible y detecta mora", () => {
  const obligation = buildRentalObligation(contract, "2026-04", new Date("2026-04-11T12:00:00Z"));
  assert.equal(obligation.dueDate, "2026-04-10");
  assert.equal(obligation.totalAmountMinor, 11000000);
  assert.equal(obligation.status, "overdue");
  assert.equal(getObligationStatus({ ...obligation, paidAmountMinor: 5000000 }, "2026-04-11"), "overdue");
});

test("sincroniza fechas e importe de obligaciones impagas al editar el contrato", () => {
  const current = {
    ...buildRentalObligation(contract, "2026-04", new Date("2026-04-11T12:00:00Z")),
    otherChargesMinor: 250000,
    totalAmountMinor: 11250000,
    balanceMinor: 11250000,
  };
  const revisedContract = normalizeRentalContract({
    ...contract,
    dueDay: 15,
    financial: {
      ...contract.financial,
      initialRentAmountMinor: 8000000,
      currentRentAmountMinor: 8000000,
      adjustment: { mode: "none" },
    },
    rentSchedule: [{ effectiveFrom: "2026-01-31", amountMinor: 8000000 }],
  });
  const result = syncRentalObligationFromContract(
    current,
    revisedContract,
    new Date("2026-04-16T12:00:00Z"),
  );
  assert.equal(result.updated, true);
  assert.equal(result.obligation.dueDate, "2026-04-15");
  assert.equal(result.obligation.rentAmountMinor, 8000000);
  assert.equal(result.obligation.totalAmountMinor, 8250000);
  assert.equal(result.obligation.status, "overdue");
});

test("no reescribe obligaciones que ya tienen pagos", () => {
  const current = {
    ...buildRentalObligation(contract, "2026-04"),
    paidAmountMinor: 1000000,
    payments: [{ id: "payment-1" }],
  };
  const result = syncRentalObligationFromContract(current, {
    ...contract,
    dueDay: 20,
  });
  assert.equal(result.updated, false);
  assert.equal(result.reason, "has_payments");
  assert.equal(result.obligation.dueDate, "2026-04-10");
});

test("un cierre fuera de gestión elimina el saldo operativo sin simular una cobranza", () => {
  const obligation = {
    ...buildRentalObligation(contract, "2026-04"),
    paidAmountMinor: 0,
    externalClosure: {
      closed: true,
      reason: "pre_management",
      amountMinor: 11000000,
    },
  };
  assert.equal(getObligationStatus(obligation), "closed_external");
  assert.equal(hasRentalObligationActivity(obligation), true);
  const result = syncRentalObligationFromContract(obligation, {
    ...contract,
    dueDay: 20,
  });
  assert.equal(result.updated, false);
  assert.equal(result.reason, "has_external_activity");
  assert.equal(result.obligation.paidAmountMinor, 0);
});

test("una factura externa bloquea la resincronización del período", () => {
  const obligation = {
    ...buildRentalObligation(contract, "2026-04"),
    externalInvoice: {
      registered: true,
      voucherType: "factura_c",
      pointOfSale: 4,
      voucherNumber: 25,
    },
  };
  assert.equal(hasRentalObligationActivity(obligation), true);
  const result = syncRentalObligationFromContract(obligation, contract);
  assert.equal(result.updated, false);
  assert.equal(result.reason, "has_external_activity");
});

test("liquida cobro menos honorarios y gastos del propietario", () => {
  const settlement = calculateRentalSettlement({
    contract,
    obligation: {
      paidAmountMinor: 10000000,
      administrationFeeSnapshot: { percent: 8, fixedAmountMinor: 0 },
    },
    expenses: [
      { amountMinor: 1000000, allocatedTo: "owner" },
      { amountMinor: 500000, allocatedTo: "tenant" },
    ],
  });
  assert.equal(settlement.administrationFeeMinor, 800000);
  assert.equal(settlement.ownerExpensesMinor, 1000000);
  assert.equal(settlement.netOwnerAmountMinor, 8200000);
});

test("genera la cuenta corriente del locador y concilia una liquidación confirmada", () => {
  const statement = buildRentalOwnerAccountStatement({
    obligations: [{
      id: "obligation-1",
      periodKey: "2026-07",
      payments: [{ id: "payment-1", paidAt: "2026-07-10", amountMinor: 10000000, receiptNumber: "REC-1" }],
    }],
    expenses: [{
      id: "expense-1",
      periodKey: "2026-07",
      date: "2026-07-10",
      concept: "Reparación",
      allocatedTo: "owner",
      amountMinor: 1000000,
    }],
    settlements: [{
      id: "settlement-1",
      periodKey: "2026-07",
      settledAt: "2026-07-10",
      paidAt: "2026-07-11",
      status: "received",
      administrationFeeMinor: 800000,
      netOwnerAmountMinor: 8200000,
    }],
  });
  assert.equal(statement.totalCreditMinor, 10000000);
  assert.equal(statement.totalDebitMinor, 10000000);
  assert.equal(statement.balanceMinor, 0);
  assert.equal(statement.movements.at(-1).concept, "Pago al locador · recepción confirmada");
});

test("la cuenta corriente excluye cobros anulados sin borrar su trazabilidad", () => {
  const statement = buildRentalOwnerAccountStatement({
    obligations: [{
      id: "obligation-voided",
      contractId: "contract-1",
      periodKey: "2026-08",
      payments: [
        { id: "payment-valid", paidAt: "2026-08-10", amountMinor: 500000 },
        { id: "payment-voided", paidAt: "2026-08-11", amountMinor: 300000, voided: true, voidReason: "Carga duplicada" },
      ],
    }],
  });
  assert.equal(statement.totalCreditMinor, 500000);
  assert.equal(statement.movements.length, 1);
});

test("valida las partes, la vigencia y la modalidad de actualización", () => {
  assert.deepEqual(validateRentalContract(contract), []);
  const invalid = normalizeRentalContract({
    startDate: "2026-12-01",
    endDate: "2026-01-01",
    financial: { adjustment: { mode: "index", indexName: "" } },
  });
  const errors = validateRentalContract(invalid);
  assert.ok(errors.some((message) => message.includes("inmueble")));
  assert.ok(errors.some((message) => message.includes("índice")));
  assert.ok(errors.some((message) => message.includes("finalización")));
});

test("un alquiler temporal exige una fecha exacta de vencimiento", () => {
  const invalid = normalizeRentalContract({
    ...contract,
    contractType: "temporary",
    paymentDueDate: "",
  });
  const errors = validateRentalContract(invalid);
  assert.ok(errors.some((message) => message.includes("vencimiento del pago")));
});
