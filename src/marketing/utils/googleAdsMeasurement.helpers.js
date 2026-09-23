const GOOGLE_ADS_ID_PATTERN = /^AW-\d+$/;
const GOOGLE_ADS_LABEL_PATTERN = /^[A-Za-z0-9_-]+$/;

const cleanText = (value = "", maxLength = 120) => value
  ?.toString()
  .trim()
  .slice(0, maxLength) || "";

export const normalizeGoogleAdsConfig = ({ adsId = "", conversionLabel = "" } = {}) => {
  const normalizedAdsId = cleanText(adsId, 40).toUpperCase();
  const normalizedConversionLabel = cleanText(conversionLabel, 100);

  if (!GOOGLE_ADS_ID_PATTERN.test(normalizedAdsId)) return null;
  if (!GOOGLE_ADS_LABEL_PATTERN.test(normalizedConversionLabel)) return null;

  return {
    adsId: normalizedAdsId,
    conversionLabel: normalizedConversionLabel,
  };
};

export const buildGoogleAdsLeadEvent = ({
  adsId = "",
  conversionLabel = "",
  leadId = "",
  value = 1,
  currency = "ARS",
} = {}) => {
  const config = normalizeGoogleAdsConfig({ adsId, conversionLabel });
  const transactionId = cleanText(leadId, 120);
  const normalizedValue = Number(value);
  const normalizedCurrency = cleanText(currency, 3).toUpperCase();

  if (!config || !transactionId) return null;
  if (!Number.isFinite(normalizedValue) || normalizedValue < 0) return null;
  if (!/^[A-Z]{3}$/.test(normalizedCurrency)) return null;

  return {
    send_to: `${config.adsId}/${config.conversionLabel}`,
    value: normalizedValue,
    currency: normalizedCurrency,
    transaction_id: transactionId,
  };
};
