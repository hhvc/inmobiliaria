export const ACQUISITION_ATTRIBUTION_MAX_AGE_MS = 30 * 86400000;

const cleanText = (value = "", maxLength = 160) => value
    ?.toString()
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength) || "";

export const normalizeAcquisitionAttribution = (value = {}) => {
    const attribution = value ?? {};
    return {
        source: cleanText(attribution.source, 40).toLowerCase(),
        medium: cleanText(attribution.medium, 40).toLowerCase(),
        campaign: cleanText(attribution.campaign, 80).toLowerCase(),
        content: cleanText(attribution.content, 80).toLowerCase(),
        term: cleanText(attribution.term, 80).toLowerCase(),
        entryPath: cleanText(attribution.entryPath || "/", 240),
        attributionId: cleanText(attribution.attributionId, 120),
        capturedAt: Number(attribution.capturedAt || 0),
    };
};

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
