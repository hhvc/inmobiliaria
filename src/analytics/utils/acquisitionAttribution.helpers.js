export const ACQUISITION_ATTRIBUTION_MAX_AGE_MS = 30 * 86400000;

const cleanText = (value = "", maxLength = 160) => value
    ?.toString()
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength) || "";

export const normalizeAcquisitionAttribution = (value = {}) => ({
    source: cleanText(value.source, 40).toLowerCase(),
    medium: cleanText(value.medium, 40).toLowerCase(),
    campaign: cleanText(value.campaign, 80).toLowerCase(),
    content: cleanText(value.content, 80).toLowerCase(),
    term: cleanText(value.term, 80).toLowerCase(),
    entryPath: cleanText(value.entryPath || "/", 240),
    attributionId: cleanText(value.attributionId, 120),
    capturedAt: Number(value.capturedAt || 0),
});

export const isOnopropMcpAttribution = (value = {}) => {
    const attribution = normalizeAcquisitionAttribution(value);
    return attribution.source === "chatgpt" &&
        attribution.medium === "plugin" &&
        attribution.campaign === "onoprop_mcp";
};

export const buildAcquisitionAttributionFromLocation = ({
    search = "",
    pathname = "/",
    attributionId = "",
    capturedAt = Date.now(),
} = {}) => {
    const params = new URLSearchParams(search);
    const attribution = normalizeAcquisitionAttribution({
        source: params.get("utm_source"),
        medium: params.get("utm_medium"),
        campaign: params.get("utm_campaign"),
        content: params.get("utm_content"),
        term: params.get("utm_term"),
        entryPath: pathname,
        attributionId,
        capturedAt,
    });
    return isOnopropMcpAttribution(attribution) ? attribution : null;
};

export const isAcquisitionAttributionActive = (
    value,
    now = Date.now(),
    maxAgeMs = ACQUISITION_ATTRIBUTION_MAX_AGE_MS,
) => {
    const attribution = normalizeAcquisitionAttribution(value);
    return isOnopropMcpAttribution(attribution) &&
        Boolean(attribution.attributionId) &&
        attribution.capturedAt > 0 &&
        now >= attribution.capturedAt &&
        now - attribution.capturedAt <= maxAgeMs;
};
