const digitsOnly = (value = "") => value.toString().replace(/\D/g, "");

export const normalizeWhatsAppPhone = (value = "") => {
  let digits = digitsOnly(value);
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = digits.slice(1);
  if (digits.startsWith("549")) return digits;
  if (digits.startsWith("54") && digits.length === 12) {
    return `549${digits.slice(2)}`;
  }
  if (digits.length === 10) return `549${digits}`;
  return digits;
};

export const isValidWhatsAppPhone = (value = "") => {
  const phone = normalizeWhatsAppPhone(value);
  return phone.length >= 10 && phone.length <= 15;
};

export const buildArcaWhatsAppMessage = ({
  voucherLabel = "Comprobante",
  voucherNumber = "",
  issuerName = "",
} = {}) => [
  `Te envío ${voucherLabel}${voucherNumber ? ` N.º ${voucherNumber}` : ""}`,
  issuerName ? `emitido por ${issuerName}.` : "",
  "El PDF adjunto contiene el CAE y el código QR de verificación de ARCA.",
].filter(Boolean).join(" ");

export const buildArcaWhatsAppUrl = ({phone = "", message = ""} = {}) => {
  const normalizedPhone = normalizeWhatsAppPhone(phone);
  const recipient = normalizedPhone ? `/${normalizedPhone}` : "";
  return `https://wa.me${recipient}?text=${encodeURIComponent(message)}`;
};
