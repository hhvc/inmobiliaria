import { formatArcaVoucherNumber } from "./arcaInvoice.helpers.js";

export const ARCA_VOUCHER_CENTER_STATUS = {
  authorized: {label: "Autorizado", badge: "text-bg-success"},
  pending_reconciliation: {label: "Requiere conciliación", badge: "text-bg-warning"},
  rejected: {label: "Rechazado", badge: "text-bg-danger"},
  preview: {label: "Preparado", badge: "text-bg-info"},
};

const clean = (value = "") => value?.toString?.().trim?.() || "";
const normalized = (value = "") => clean(value)
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase();

const getStatus = (document = {}) => {
  if (document.status === "authorized" && document.cae) return "authorized";
  if (["authorizing", "pending_reconciliation"].includes(document.status)) {
    return "pending_reconciliation";
  }
  if (document.status === "rejected") return "rejected";
  return "preview";
};

const getDate = (document = {}) => clean(
  document.voucherDate || document.invoiceDate || document.updatedAt,
).slice(0, 10);

const getVoucherNumber = (document = {}) => {
  const number = document.status === "authorized"
    ? document.voucherNumber
    : document.proposedVoucherNumber;
  return Number(number) > 0
    ? formatArcaVoucherNumber(document.pointOfSale, number)
    : "Sin numeración";
};

export const buildArcaVoucherCenterRows = ({
  documents = [],
  contracts = [],
  profiles = [],
} = {}) => {
  const contractMap = new Map(contracts.map((item) => [item.id, item]));
  const profileMap = new Map(profiles.map((item) => [item.id, item]));
  const creditNotesByInvoice = new Map();
  documents.filter((item) => Number(item.voucherType) === 13).forEach((item) => {
    const invoiceId = clean(item.associatedVoucher?.previewId);
    if (!invoiceId) return;
    creditNotesByInvoice.set(invoiceId, [
      ...(creditNotesByInvoice.get(invoiceId) || []),
      item,
    ]);
  });

  return documents.map((document) => {
    const contract = contractMap.get(document.contractId) || {};
    const profile = profileMap.get(document.issuerProfileId) || {};
    const kind = Number(document.voucherType) === 13 ? "credit_note" : "invoice";
    const relatedCreditNotes = kind === "invoice"
      ? creditNotesByInvoice.get(document.id) || []
      : [];
    const authorizedCreditsMinor = relatedCreditNotes
      .filter((item) => item.status === "authorized" && item.cae)
      .reduce((sum, item) => sum + Number(item.amountMinor || 0), 0);
    const address = clean(contract.inmuebleSnapshot?.address);
    const propertyTitle = clean(contract.inmuebleSnapshot?.title);
    return {
      id: document.id,
      contractId: document.contractId,
      issuerProfileId: document.issuerProfileId,
      issuerCuit: clean(document.issuerCuit || profile.issuerCuit),
      issuerName: clean(
        document.issuerSnapshot?.legalName || profile.issuerLegalName || profile.name,
      ) || "Emisor no informado",
      recipientName: clean(document.recipient?.name) || "Receptor no informado",
      recipientDocument: clean(document.recipient?.documentNumber),
      kind,
      typeLabel: kind === "credit_note" ? "Nota de Crédito C" : "Factura C",
      status: getStatus(document),
      date: getDate(document),
      voucherNumber: getVoucherNumber(document),
      amountMinor: Number(document.amountMinor || 0),
      cae: clean(document.cae),
      description: clean(document.description),
      periodLabel: clean(document.periodKey) || [
        clean(document.serviceFrom),
        clean(document.serviceTo),
      ].filter(Boolean).join(" a "),
      contractLabel: address || propertyTitle || "Contrato sin inmueble informado",
      address,
      propertyTitle,
      associatedVoucherNumber: kind === "credit_note"
        ? formatArcaVoucherNumber(
          document.associatedVoucher?.pointOfSale,
          document.associatedVoucher?.voucherNumber,
        )
        : "",
      associatedPreviewId: clean(document.associatedVoucher?.previewId),
      relatedCreditNotesCount: relatedCreditNotes.length,
      authorizedCreditsMinor,
      rawStatus: clean(document.status),
    };
  }).sort((left, right) => (
    right.date.localeCompare(left.date) || right.voucherNumber.localeCompare(left.voucherNumber)
  ));
};

export const filterArcaVoucherCenterRows = (rows = [], filters = {}) => {
  const term = normalized(filters.search);
  return rows.filter((row) => {
    if (filters.kind && row.kind !== filters.kind) return false;
    if (filters.status && row.status !== filters.status) return false;
    if (filters.profileId && row.issuerProfileId !== filters.profileId) return false;
    if (filters.dateFrom && row.date < filters.dateFrom) return false;
    if (filters.dateTo && row.date > filters.dateTo) return false;
    if (!term) return true;
    return normalized([
      row.voucherNumber,
      row.typeLabel,
      row.issuerName,
      row.issuerCuit,
      row.recipientName,
      row.recipientDocument,
      row.contractLabel,
      row.periodLabel,
      row.cae,
    ].join(" ")).includes(term);
  });
};

export const summarizeArcaVoucherCenterRows = (rows = []) => {
  const authorized = rows.filter((row) => row.status === "authorized");
  const invoices = authorized.filter((row) => row.kind === "invoice");
  const creditNotes = authorized.filter((row) => row.kind === "credit_note");
  const invoicedMinor = invoices.reduce((sum, row) => sum + row.amountMinor, 0);
  const creditedMinor = creditNotes.reduce((sum, row) => sum + row.amountMinor, 0);
  return {
    authorizedCount: authorized.length,
    invoiceCount: invoices.length,
    creditNoteCount: creditNotes.length,
    invoicedMinor,
    creditedMinor,
    netMinor: invoicedMinor - creditedMinor,
    actionRequiredCount: rows.filter((row) => row.status !== "authorized").length,
  };
};

const csvCell = (value = "") => `"${clean(value).replace(/"/g, '""')}"`;
const csvMoney = (minor = 0) => (Number(minor || 0) / 100).toFixed(2).replace(".", ",");

export const buildArcaVoucherCenterCsv = (rows = []) => {
  const headers = [
    "Fecha",
    "Tipo",
    "Comprobante",
    "Estado",
    "Emisor",
    "CUIT emisor",
    "Receptor",
    "Documento receptor",
    "Contrato / inmueble",
    "Período / servicio",
    "Importe ARS",
    "CAE",
    "Comprobante asociado",
  ];
  const data = rows.map((row) => [
    row.date,
    row.typeLabel,
    row.voucherNumber,
    ARCA_VOUCHER_CENTER_STATUS[row.status]?.label || row.status,
    row.issuerName,
    row.issuerCuit,
    row.recipientName,
    row.recipientDocument,
    row.contractLabel,
    row.periodLabel,
    csvMoney(row.amountMinor),
    row.cae,
    row.associatedVoucherNumber,
  ]);
  return `\uFEFF${[headers, ...data]
    .map((record) => record.map(csvCell).join(";"))
    .join("\n")}`;
};
