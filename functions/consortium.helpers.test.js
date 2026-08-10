import assert from "node:assert/strict";
import test from "node:test";

import {
    applyConsortiumTemplate,
    buildConsortiumCommunicationId,
    getAutomaticConsortiumCommunication,
    normalizeConsortiumNotificationSettings,
    resolveConsortiumRecipients,
    resolveEffectiveConsortiumNotificationSettings,
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
        automationAuthorized: true,
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

test("bloquea cualquier automatización de unidad sin consentimiento del consorcio", () => {
    const settings = resolveEffectiveConsortiumNotificationSettings({
        enabled: true,
        automationAuthorized: false,
    }, {
        notificationAutomationMode: "custom",
        notificationSendOnIssue: true,
        notificationPreDueDays: [5],
    });
    assert.equal(settings.enabled, false);
    assert.equal(settings.unitMode, "custom");
});

test("aplica configuración personalizada y exclusión por unidad", () => {
    const base = {
        enabled: true,
        automationAuthorized: true,
        sendOnIssue: true,
        preDueDays: [3],
        overdueDays: [1, 7],
    };
    const custom = resolveEffectiveConsortiumNotificationSettings(base, {
        notificationAutomationMode: "custom",
        notificationSendOnIssue: false,
        notificationPreDueDays: [5],
        notificationOverdueDays: [10],
    });
    assert.equal(custom.enabled, true);
    assert.equal(custom.sendOnIssue, false);
    assert.deepEqual(custom.preDueDays, [5]);
    assert.deepEqual(custom.overdueDays, [10]);
    assert.equal(resolveEffectiveConsortiumNotificationSettings(base, {
        notificationAutomationMode: "disabled",
    }).enabled, false);
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
