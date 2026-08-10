import assert from "node:assert/strict";
import test from "node:test";

import {
    addDaysToDateKey,
    buildTaxDueAlert,
    dateKeyInTimeZone,
    differenceInDateKeys,
    normalizeTaxNotificationEmails,
    normalizeTaxNotificationSettings,
} from "./tax.helpers.js";

const taxObject = {
    id: "object-1",
    inmuebleId: "property-1",
    inmuebleSnapshot: { title: "Casa Centro" },
    reminderDays: [15, 5, 1, 0],
    providerId: "municipalidad_cordoba",
};

const obligation = {
    id: "obligation-1",
    taxObjectId: "object-1",
    inmuebleId: "property-1",
    status: "pending",
    concept: "Contribución inmobiliaria",
    dueDate: "2026-08-20",
    amountMinor: 123456,
    currency: "ARS",
};

test("calcula fechas sin depender del horario de ejecución", () => {
    assert.equal(addDaysToDateKey("2026-08-20", 15), "2026-09-04");
    assert.equal(differenceInDateKeys("2026-08-05", "2026-08-20"), 15);
    assert.equal(dateKeyInTimeZone(Date.UTC(2026, 7, 9, 2, 30)), "2026-08-08");
});
test("normaliza destinatarios y deja el correo desactivado por defecto", () => {
    assert.deepEqual(
        normalizeTaxNotificationEmails("ADMIN@ONO.COM, inválido, admin@ono.com"),
        ["admin@ono.com"],
    );
    assert.equal(normalizeTaxNotificationSettings({}).emailEnabled, false);
});

test("genera recordatorios determinísticos en los días configurados", () => {
    const alert = buildTaxDueAlert({
        obligation,
        taxObject,
        todayDateKey: "2026-08-05",
    });
    assert.equal(alert.id, "obligation-1__due_15");
    assert.equal(alert.daysUntilDue, 15);
    assert.equal(alert.type, "tax_due_reminder");
});

test("genera un único tipo de alerta para obligaciones vencidas", () => {
    const alert = buildTaxDueAlert({
        obligation: { ...obligation, status: "overdue" },
        taxObject,
        todayDateKey: "2026-08-23",
    });
    assert.equal(alert.id, "obligation-1__overdue");
    assert.equal(alert.daysUntilDue, -3);
    assert.equal(alert.type, "tax_overdue");
});

test("ignora pagos informados y recordatorios no configurados", () => {
    assert.equal(buildTaxDueAlert({
        obligation: { ...obligation, status: "payment_pending" },
        taxObject,
        todayDateKey: "2026-08-05",
    }), null);
    assert.equal(buildTaxDueAlert({
        obligation,
        taxObject,
        todayDateKey: "2026-08-10",
    }), null);
});

test("permite desactivar las alertas vencidas o toda la automatización", () => {
    assert.equal(buildTaxDueAlert({
        obligation,
        taxObject,
        todayDateKey: "2026-08-23",
        settings: { overdueAlert: false },
    }), null);
    assert.equal(buildTaxDueAlert({
        obligation,
        taxObject,
        todayDateKey: "2026-08-05",
        settings: { enabled: false },
    }), null);
});
