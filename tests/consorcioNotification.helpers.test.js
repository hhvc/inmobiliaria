import assert from "node:assert/strict";
import test from "node:test";

import {
  getEffectiveConsortiumNotificationSettings,
  getConsortiumUnitNotificationRecipients,
  normalizeConsortiumNotificationSettings,
  normalizeReminderDays,
} from "../src/consorcios/utils/consorcioNotification.helpers.js";

test("resuelve destinatarios según titular, ocupante o ambos", () => {
  const unit = {
    ownerName: "Ana",
    ownerEmail: "ANA@EJEMPLO.COM",
    occupantName: "Juan",
    occupantEmail: "juan@ejemplo.com",
    notificationPreference: "both",
  };
  assert.deepEqual(getConsortiumUnitNotificationRecipients(unit), [
    { email: "ana@ejemplo.com", role: "owner", name: "Ana" },
    { email: "juan@ejemplo.com", role: "occupant", name: "Juan" },
  ]);
  assert.deepEqual(getConsortiumUnitNotificationRecipients({
    ...unit,
    notificationPreference: "none",
  }), []);
});
test("normaliza días de recordatorio y permite desactivarlos", () => {
  assert.deepEqual(normalizeReminderDays("7, 1, 7, 400, texto"), [1, 7]);
  assert.deepEqual(normalizeReminderDays("", [3]), []);
  assert.deepEqual(normalizeReminderDays(undefined, [3]), [3]);
});

test("normaliza plantilla y email de respuesta", () => {
  assert.deepEqual(normalizeConsortiumNotificationSettings({
    enabled: true,
    sendOnIssue: true,
    preDueDays: "5",
    overdueDays: "1, 10",
    replyToEmail: "ADMIN@EJEMPLO.COM",
    subjectTemplate: "  Expensas {{unidad}}  ",
    introText: " Mensaje de prueba ",
  }), {
    enabled: true,
    automationAuthorized: false,
    sendOnIssue: true,
    preDueDays: [5],
    overdueDays: [1, 10],
    replyToEmail: "admin@ejemplo.com",
    subjectTemplate: "Expensas {{unidad}}",
    introText: "Mensaje de prueba",
  });
});

test("una unidad no puede activar envíos sin autorización del consorcio", () => {
  const result = getEffectiveConsortiumNotificationSettings({
    enabled: true,
    automationAuthorized: false,
    sendOnIssue: true,
  }, {
    notificationAutomationMode: "custom",
    notificationSendOnIssue: true,
  });
  assert.equal(result.enabled, false);
  assert.equal(result.unitMode, "custom");
});

test("la unidad puede heredar, personalizar o excluir automatizaciones autorizadas", () => {
  const settings = {
    enabled: true,
    automationAuthorized: true,
    sendOnIssue: true,
    preDueDays: [3],
    overdueDays: [1, 7],
  };
  assert.equal(getEffectiveConsortiumNotificationSettings(settings, {}).enabled, true);
  assert.deepEqual(getEffectiveConsortiumNotificationSettings(settings, {
    notificationAutomationMode: "custom",
    notificationSendOnIssue: false,
    notificationPreDueDays: [5],
    notificationOverdueDays: [10],
  }).preDueDays, [5]);
  assert.equal(getEffectiveConsortiumNotificationSettings(settings, {
    notificationAutomationMode: "disabled",
  }).enabled, false);
});
