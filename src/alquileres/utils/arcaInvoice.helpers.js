const digits = (value = "") => value.toString().replace(/\D/g, "");

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
