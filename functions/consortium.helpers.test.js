import assert from "node:assert/strict";
import test from "node:test";

import {
    applyConsortiumTemplate,
    buildConsortiumAutomationPreview,
    buildConsortiumCommunicationId,
    buildConsortiumManagedMessages,
    buildConsortiumPortalUnit,
    getAutomaticConsortiumCommunication,
    normalizeConsortiumNotificationSettings,
    resolveConsortiumRecipients,
    resolveEffectiveConsortiumNotificationSettings,
} from "./consortium.helpers.js";

test("limita los datos de una unidad expuestos al portal del consorcista", () => {
    const result = buildConsortiumPortalUnit("unidad-1", {
        inmobiliariaId: "inmo-1",
        consortiumId: "consorcio-1",
        consortiumName: "Edificio Centro",
        consortiumAddress: "Av. Siempre Viva 123",
        consortiumCurrency: "ARS",
        code: "1 A",
        portalAccessRole: "owner",
        coefficient: 12.5,
        creditBalanceMinor: 2500.4,
        ownerTaxId: "20-00000000-0",
        ownerEmail: "privado@example.com",
        portalEmails: ["privado@example.com"],
        notes: "Información interna",
    });
    assert.deepEqual(result, {
        id: "unidad-1",
        inmobiliariaId: "inmo-1",
        consortiumId: "consorcio-1",
        consortiumName: "Edificio Centro",
        consortiumAddress: "Av. Siempre Viva 123",
        consortiumCurrency: "ARS",
        code: "1 A",
        floor: "",
        apartment: "",
        type: "apartment",
        portalAccessRole: "owner",
        coefficient: 12.5,
        creditBalanceMinor: 2500,
    });
    assert.equal(Object.hasOwn(result, "ownerTaxId"), false);
    assert.equal(Object.hasOwn(result, "portalEmails"), false);
    assert.equal(Object.hasOwn(result, "notes"), false);
});

test("anonimiza las gestiones compartidas con propietarios", () => {
    const result = buildConsortiumManagedMessages({
        claims: [{
            id: "casoABC123456",
            createdDate: "2026-08-24",
            title: "Juan de la unidad 3 informó una pérdida",
            description: "La informó una persona identificada.",
            submittedByEmail: "privado@example.com",
            unitId: "unidad-1",
            communicationType: "notice",
            category: "plumbing",
            priority: "high",
            status: "resolved",
            portalVisible: true,
            featuredInPortal: true,
            lastActivityAtIso: "2026-08-25T10:00:00.000Z",
        }],
        events: [{
            claimId: "casoABC123456",
            type: "status_update",
            previousStatus: "in_review",
            status: "resolved",
            message: "Incluye una explicación privada.",
            createdAtIso: "2026-08-25T10:00:00.000Z",
        }],
    });
    assert.equal(result[0].reference, "MSG-20260824-123456");
    assert.equal(result[0].title, "Gestión sobre Agua y plomería");
    assert.equal(result[0].featured, true);
    assert.deepEqual(result[0].statusHistory, [{
        previousStatus: "in_review",
        status: "resolved",
        createdAtIso: "2026-08-25T10:00:00.000Z",
    }]);
    assert.equal(Object.hasOwn(result[0], "description"), false);
    assert.equal(Object.hasOwn(result[0], "submittedByEmail"), false);
    assert.equal(Object.hasOwn(result[0], "unitId"), false);
});

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

test("previsualiza acciones y detecta unidades sin destinatarios", () => {
    const preview = buildConsortiumAutomationPreview({
        todayDateKey: "2026-08-13",
        settings: {
            enabled: true,
            automationAuthorized: true,
            preDueDays: [1],
            overdueDays: [2],
        },
        units: [{
            id: "u1",
            code: "1 A",
            ownerEmail: "titular@example.com",
            notificationPreference: "owner",
        }, {
            id: "u2",
            code: "2 B",
            notificationPreference: "occupant",
        }, {
            id: "u3",
            code: "3 C",
            notificationAutomationMode: "disabled",
        }],
        obligations: [{
            id: "o1",
            unitId: "u1",
            dueDate: "2026-08-14",
            balanceMinor: 1000,
        }, {
            id: "o2",
            unitId: "u2",
            dueDate: "2026-08-11",
            balanceMinor: 2000,
        }, {
            id: "o3",
            unitId: "u3",
            dueDate: "2026-08-14",
            balanceMinor: 3000,
        }],
    });
    assert.equal(preview.summary.ready, 1);
    assert.equal(preview.summary.missingRecipients, 1);
    assert.equal(preview.summary.incompleteUnits, 1);
    assert.equal(preview.summary.excludedUnits, 1);
    assert.equal(preview.entries[0].action.kind, "before_due");
    assert.equal(preview.entries[1].action.kind, "overdue");
});
