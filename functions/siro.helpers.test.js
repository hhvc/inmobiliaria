import assert from "node:assert/strict";
import test from "node:test";

import {
    buildSiroAssignmentId,
    buildSiroCpe,
    buildSiroCustomerCode,
    buildSiroReceiptNumber,
    createSiroPublicToken,
    extractSiroAgreements,
    hashSiroPublicToken,
    isSiroPublicTokenValid,
    normalizeSiroConcept,
    normalizeSiroPaymentStatus,
} from "./siro.helpers.js";

test("genera identificadores numéricos estables para CPE y comprobante", () => {
    const customerCode = buildSiroCustomerCode({
        inmobiliariaId: "agency-1",
        consortiumId: "consortium-1",
        unitId: "unit-1",
    });
    assert.match(customerCode, /^\d{9}$/);
    assert.equal(buildSiroCpe({ customerCode, agreementId: "5150058293" }).length, 19);
    const receipt = buildSiroReceiptNumber({
        obligationId: "obligation-1",
        periodKey: "2026-09",
    });
    assert.match(receipt, /^\d{20}$/);
    assert.equal(receipt.slice(-5), "00926");
});

test("normaliza textos y estados de SIRO", () => {
    assert.equal(normalizeSiroConcept("Expensas — Septiembre/2026"),
        "Expensas Septiembre 2026");
    assert.equal(normalizeSiroPaymentStatus({ Estado: "PROCESADA" }), "approved");
    assert.equal(normalizeSiroPaymentStatus({ Estado: "RECHAZADA" }), "rejected");
    assert.equal(normalizeSiroPaymentStatus({ PagoExitoso: true }), "approved");
});

test("protege el token público de consulta", () => {
    const token = createSiroPublicToken();
    const hash = hashSiroPublicToken(token);
    assert.equal(isSiroPublicTokenValid(token, hash), true);
    assert.equal(isSiroPublicTokenValid(`${token}x`, hash), false);
});

test("normaliza convenios aunque la API cambie el contenedor o el casing", () => {
    assert.deepEqual(extractSiroAgreements({ Convenios: [{
        NroEmpresa: "5150058293",
        RazonSocial: "Consorcio de prueba",
        CuitAdministrador: "20-25300621-9",
    }] }), [{
        id: "5150058293",
        name: "Consorcio de prueba",
        administratorCuit: "20253006219",
    }]);
    assert.equal(buildSiroAssignmentId({
        targetType: "consortium",
        inmobiliariaId: "agency-1",
        targetId: "building-1",
    }), "consortium_agency-1_building-1");
});

