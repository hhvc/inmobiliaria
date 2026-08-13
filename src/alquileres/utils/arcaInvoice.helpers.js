const digits = (value = "") => value.toString().replace(/\D/g, "");

export const isArcaProductionTestFresh = (profile = {}, nowMs = Date.now()) => {
  const checkedAt = new Date(profile.lastProductionTest?.checkedAt || 0).getTime();
  return profile.lastProductionTest?.configuredPointAvailable === true
    && digits(profile.lastProductionTest?.issuerCuit) === digits(profile.issuerCuit)
    && Number(profile.lastProductionTest?.pointOfSale) === Number(profile.pointOfSale)
    && Number(profile.lastProductionTest?.voucherType) === Number(profile.voucherType || 11)
    && Number.isFinite(checkedAt)
    && checkedAt >= nowMs - (24 * 60 * 60 * 1000)
    && checkedAt <= nowMs + (5 * 60 * 1000);
};

export const isArcaProductionPreviewFresh = (preview = {}, nowMs = Date.now()) => {
  if (["pending_reconciliation", "authorizing"].includes(preview.status)) return true;
  const observedAt = new Date(preview.sequenceObservedAt || 0).getTime();
  const age = nowMs - observedAt;
  return Number.isFinite(observedAt) && age >= -(5 * 60 * 1000) && age <= (15 * 60 * 1000);
};

export const buildArcaQrData = (draft = {}) => {
  if (draft.status !== "authorized" || !digits(draft.cae)) {
    throw new Error("El comprobante todavía no tiene un CAE autorizado.");
  }

  return {
    ver: 1,
    fecha: draft.voucherDate || draft.invoiceDate,
    cuit: Number(digits(draft.issuerCuit)),
    ptoVta: Number(draft.pointOfSale),
    tipoCmp: Number(draft.voucherType),
    nroCmp: Number(draft.voucherNumber),
    importe: Math.round(Number(draft.amountMinor || 0)) / 100,
    moneda: "PES",
    ctz: 1,
    tipoDocRec: Number(draft.recipient?.documentType),
    nroDocRec: Number(digits(draft.recipient?.documentNumber) || 0),
    tipoCodAut: "E",
    codAut: Number(digits(draft.cae)),
  };
};

export const buildArcaQrUrl = (draft = {}) => {
  const payload = JSON.stringify(buildArcaQrData(draft));
  const base64 = globalThis.btoa(payload);
  return `https://www.arca.gob.ar/fe/qr/?p=${encodeURIComponent(base64)}`;
};

export const formatArcaVoucherNumber = (pointOfSale, voucherNumber) => (
  `${String(Number(pointOfSale) || 0).padStart(5, "0")}-` +
  String(Number(voucherNumber) || 0).padStart(8, "0")
);

export const getArcaDocumentLabel = (documentType) => ({
  80: "CUIT",
  96: "DNI",
  99: "Consumidor final",
}[Number(documentType)] || `Documento ${documentType}`);
