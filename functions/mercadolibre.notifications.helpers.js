import crypto from "node:crypto";

const cleanValue = (value = "", maxLength = 500) => {
    return value === null || value === undefined
        ? ""
        : value.toString().trim().slice(0, maxLength);
};

const cleanAction = (value = "") => {
    return cleanValue(value, 80).toLowerCase();
};

const getPhoneValue = (phone) => {
    if (!phone || typeof phone !== "object") return cleanValue(phone, 100);

    const areaCodeAndNumber = [
        phone.area_code || phone.areaCode,
        phone.number,
    ].filter(Boolean).join(" ");

    return cleanValue(
        phone.full_number ||
        phone.phone ||
        phone.value ||
        areaCodeAndNumber ||
        phone.number,
        100,
    );
};

export const normalizeMercadoLibreNotification = (notification = {}) => {
    const actions = Array.isArray(notification.actions)
        ? [...new Set(notification.actions.map(cleanAction).filter(Boolean))]
        : [];
    const sentAtMs = Date.parse(notification.sent || "");
    const receivedAtMs = Date.parse(
        notification.received || notification.recieved || "",
    );

    return {
        notificationId: cleanValue(notification._id || notification.id, 200),
        applicationId: cleanValue(notification.application_id, 100),
        sellerId: cleanValue(notification.user_id, 100),
        topic: cleanValue(notification.topic, 80).toLowerCase(),
        resource: cleanValue(notification.resource, 300),
        actions,
        attempts: Number.isFinite(Number(notification.attempts))
            ? Number(notification.attempts)
            : 0,
        sentAtMs: Number.isFinite(sentAtMs) ? sentAtMs : null,
        receivedAtMs: Number.isFinite(receivedAtMs) ? receivedAtMs : null,
    };
};

export const buildMercadoLibreNotificationId = (notification = {}) => {
    const normalized = normalizeMercadoLibreNotification(notification);
    const explicitId = normalized.notificationId;

    if (explicitId && !explicitId.includes("/")) {
        return explicitId.slice(0, 200);
    }

    return crypto
        .createHash("sha256")
        .update(JSON.stringify({
            applicationId: normalized.applicationId,
            sellerId: normalized.sellerId,
            topic: normalized.topic,
            resource: normalized.resource,
            actions: normalized.actions,
            sentAtMs: normalized.sentAtMs,
        }))
        .digest("hex");
};

export const parseMercadoLibreItemResource = (resource = "") => {
    const match = cleanValue(resource, 300).match(/^\/items\/(ML[A-Z]\d+)$/);
    if (!match) return null;

    return {
        itemId: match[1],
        apiResource: `/items/${match[1]}`,
    };
};

export const parseMercadoLibreLeadResource = (resource = "") => {
    const match = cleanValue(resource, 300).match(
        /^\/(?:vis\/leads|vis_leads)\/([A-Za-z0-9-]+)$/,
    );
    if (!match) return null;

    return {
        leadId: match[1],
        apiResource: `/vis/leads/${match[1]}`,
    };
};

export const isSupportedMercadoLibreNotification = (notification = {}) => {
    const normalized = normalizeMercadoLibreNotification(notification);

    if (normalized.topic === "items") {
        return Boolean(parseMercadoLibreItemResource(normalized.resource));
    }

    if (normalized.topic === "vis_leads") {
        return Boolean(parseMercadoLibreLeadResource(normalized.resource));
    }

    return false;
};

export const normalizeMercadoLibreLead = (
    lead = {},
    { leadId = "", sellerId = "", actions = [] } = {},
) => {
    const createdAtMs = Date.parse(
        lead.created_at || lead.date_created || lead.createdAt || "",
    );
    const normalizedActions = Array.isArray(actions)
        ? [...new Set(actions.map(cleanAction).filter(Boolean))]
        : [];
    const contactType = cleanValue(
        lead.contact_type ||
        lead.channel ||
        normalizedActions[0] ||
        "",
        80,
    ).toLowerCase();
    const buyer = lead.buyer && typeof lead.buyer === "object"
        ? lead.buyer
        : {};

    return {
        leadId: cleanValue(lead.id || lead.uuid || leadId, 200),
        sellerId: cleanValue(sellerId, 100),
        itemId: cleanValue(lead.item_id, 80),
        buyerId: cleanValue(lead.buyer_id || buyer.id, 100),
        externalId: cleanValue(lead.external_id, 200),
        contactType,
        actions: normalizedActions,
        status: cleanValue(lead.status, 80),
        subStatus: cleanValue(lead.sub_status, 80),
        name: cleanValue(lead.name || buyer.name, 300),
        email: cleanValue(lead.email || buyer.email, 300),
        phone: getPhoneValue(lead.phone || buyer.phone),
        createdAtMs: Number.isFinite(createdAtMs) ? createdAtMs : null,
    };
};

export const normalizeMercadoLibreLeadSearchResults = (
    response = {},
    { sellerId = "" } = {},
) => {
    if (!Array.isArray(response.results)) return [];

    return response.results.flatMap((buyer = {}) => {
        const leads = Array.isArray(buyer.leads) ? buyer.leads : [];

        return leads.map((lead) => normalizeMercadoLibreLead(
            {
                ...lead,
                item_id: lead.item_id || buyer.item_id,
                buyer_id: lead.buyer_id || buyer.id,
                name: lead.name || buyer.name,
                email: lead.email || buyer.email,
                phone: lead.phone || buyer.phone,
            },
            { sellerId },
        ));
    });
};
