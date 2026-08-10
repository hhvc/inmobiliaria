const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const normalizeConsortiumEmails = (value) => {
  const rawValues = Array.isArray(value)
    ? value
    : String(value || "").split(/[\n,;]+/);

  return [...new Set(rawValues
    .map((item) => String(item || "").trim().toLowerCase())
    .filter((item) => EMAIL_PATTERN.test(item)))];
};

export const isConsortiumDocumentFileValid = (file, maxSize = 10 * 1024 * 1024) => {
  if (!file) return false;
  const validTypes = [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
  ];
  return validTypes.includes(file.type) && Number(file.size || 0) > 0 && file.size <= maxSize;
};

export const safeConsortiumFileName = (name = "comprobante") => String(name)
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-zA-Z0-9._-]+/g, "-")
  .replace(/^-+|-+$/g, "")
  .slice(0, 120) || "comprobante";

export const getPaymentReportStatus = (status = "pending") => ({
  pending: { label: "Pendiente de validación", badge: "text-bg-warning" },
  approved: { label: "Aprobado", badge: "text-bg-success" },
  rejected: { label: "Rechazado", badge: "text-bg-danger" },
}[status] || { label: "Pendiente de validación", badge: "text-bg-warning" });
