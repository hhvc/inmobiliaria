import assert from "node:assert/strict";
import test from "node:test";

import {
    buildMercadoLibreNotificationId,
    isSupportedMercadoLibreNotification,
    normalizeMercadoLibreLead,
    normalizeMercadoLibreLeadSearchResults,
    normalizeMercadoLibreNotification,
    parseMercadoLibreItemResource,
    parseMercadoLibreLeadResource,
} from "../functions/mercadolibre.notifications.helpers.js";

test("normaliza una notificación VIS Leads y elimina acciones repetidas", () => {
    const notification = normalizeMercadoLibreNotification({
        _id: "notification-1",
        application_id: 12345,
        user_id: 98765,
        topic: "VIS_LEADS",
        resource: "/vis/leads/lead-123",
        actions: ["whatsapp", "whatsapp", "CALL"],
        attempts: 2,
        sent: "2026-07-29T12:00:00.000Z",
    });

    assert.equal(notification.notificationId, "notification-1");
    assert.equal(notification.applicationId, "12345");
    assert.equal(notification.sellerId, "98765");
    assert.equal(notification.topic, "vis_leads");
    assert.deepEqual(notification.actions, ["whatsapp", "call"]);
    assert.equal(notification.attempts, 2);
    assert.equal(notification.sentAtMs, Date.parse("2026-07-29T12:00:00.000Z"));
});

test("acepta las dos variantes documentadas del recurso VIS Leads", () => {
    assert.deepEqual(
        parseMercadoLibreLeadResource("/vis/leads/lead-123"),
        {
            leadId: "lead-123",
            apiResource: "/vis/leads/lead-123",
        },
    );
    assert.deepEqual(
        parseMercadoLibreLeadResource("/vis_leads/lead-456"),
        {
            leadId: "lead-456",
            apiResource: "/vis/leads/lead-456",
        },
    );
});

test("valida únicamente notificaciones de items y VIS Leads soportadas", () => {
    assert.deepEqual(parseMercadoLibreItemResource("/items/MLA123456"), {
        itemId: "MLA123456",
        apiResource: "/items/MLA123456",
    });
    assert.equal(
        isSupportedMercadoLibreNotification({
            topic: "items",
            resource: "/items/MLA123456",
        }),
        true,
    );
    assert.equal(
        isSupportedMercadoLibreNotification({
            topic: "vis_leads",
            resource: "/vis/leads/lead-123",
        }),
        true,
    );
    assert.equal(
        isSupportedMercadoLibreNotification({
            topic: "questions",
            resource: "/questions/123",
        }),
        false,
    );
});

test("usa el identificador de Mercado Libre o un hash determinista", () => {
    assert.equal(
        buildMercadoLibreNotificationId({ _id: "meli-event-1" }),
        "meli-event-1",
    );

    const notification = {
        application_id: "123",
        user_id: "456",
        topic: "items",
        resource: "/items/MLA123",
        sent: "2026-07-29T12:00:00.000Z",
    };
    const firstHash = buildMercadoLibreNotificationId(notification);
    const secondHash = buildMercadoLibreNotificationId(notification);

    assert.equal(firstHash, secondHash);
    assert.match(firstHash, /^[a-f0-9]{64}$/);
});

test("normaliza datos de contacto de un lead individual", () => {
    const lead = normalizeMercadoLibreLead(
        {
            id: "lead-1",
            item_id: "MLA123",
            buyer_id: 789,
            external_id: 456,
            contact_type: "question",
            created_at: "2026-07-29T10:00:00Z",
            name: "Ana",
            email: "ana@example.com",
            phone: { number: "+54 351 555-0000" },
            status: "active",
        },
        {
            sellerId: "999",
            actions: ["question"],
        },
    );

    assert.equal(lead.leadId, "lead-1");
    assert.equal(lead.itemId, "MLA123");
    assert.equal(lead.buyerId, "789");
    assert.equal(lead.externalId, "456");
    assert.equal(lead.phone, "+54 351 555-0000");
    assert.equal(lead.contactType, "question");
    assert.equal(lead.sellerId, "999");
});

test("aplana la respuesta agrupada por interesados", () => {
    const leads = normalizeMercadoLibreLeadSearchResults(
        {
            results: [
                {
                    id: 101,
                    item_id: "MLA100",
                    name: "Comprador",
                    phone: "+54 351 111-1111",
                    leads: [
                        {
                            id: "lead-a",
                            contact_type: "whatsapp",
                            created_at: "2026-07-28T10:00:00Z",
                        },
                        {
                            id: "lead-b",
                            contact_type: "call",
                            created_at: "2026-07-29T10:00:00Z",
                        },
                    ],
                },
            ],
        },
        { sellerId: "999" },
    );

    assert.equal(leads.length, 2);
    assert.equal(leads[0].buyerId, "101");
    assert.equal(leads[0].itemId, "MLA100");
    assert.equal(leads[0].name, "Comprador");
    assert.equal(leads[1].contactType, "call");
});
