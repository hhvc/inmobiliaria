import assert from "node:assert/strict";
import test from "node:test";

import {
    applyConsortiumTemplate,
    buildConsortiumCommunicationId,
    getAutomaticConsortiumCommunication,
    normalizeConsortiumNotificationSettings,
    resolveConsortiumRecipients,
} from "./consortium.helpers.js";

test("resuelve titular, ocupante o ambos sin duplicar emails", () => {
    const unit = {
        ownerName: "Titular",
        ownerEmail: "PERSONA@EJEMPLO.COM",
        occupantName: "Ocupante",
        occupantEmail: "persona@ejemplo.com",
        notificationPreference: "both",
    };
    assert.deepEqual(resolveConsortiumRecipients(unit), [{
        email: "persona@ejemplo.com",
        role: "owner",
        name: "Titular",
    }]);
    assert.deepEqual(resolveConsortiumRecipients({
        ...unit,
        notificationPreference: "none",
    }), []);
});
test("detecta recordatorios previos y posteriores al vencimiento", () => {
    const settings = normalizeConsortiumNotificationSettings({
        enabled: true,
        preDueDays: [3],
        overdueDays: [1, 7],
    });
    assert.deepEqual(getAutomaticConsortiumCommunication({
        obligation: { dueDate: "2026-08-13", balanceMinor: 1000 },
        settings,
        todayDateKey: "2026-08-10",
    }), { kind: "before_due", offsetDays: 3 });
    assert.deepEqual(getAutomaticConsortiumCommunication({
        obligation: { dueDate: "2026-08-09", balanceMinor: 1000 },
        settings,
        todayDateKey: "2026-08-10",
    }), { kind: "overdue", offsetDays: 1 });
    assert.equal(getAutomaticConsortiumCommunication({
        obligation: { dueDate: "2026-08-09", balanceMinor: 0 },
        settings,
        todayDateKey: "2026-08-10",
    }), null);
});

test("genera plantillas e identificadores idempotentes", () => {
    assert.equal(
        applyConsortiumTemplate("{{consorcio}} · {{unidad}}", {
            consorcio: "Edificio Centro",
            unidad: "2 B",
        }),
        "Edificio Centro · 2 B",
    );
    const input = {
        obligationId: "periodo_unidad",
        kind: "overdue",
        offsetDays: 7,
        dateKey: "2026-08-10",
    };
    assert.equal(buildConsortiumCommunicationId(input), buildConsortiumCommunicationId(input));
});
