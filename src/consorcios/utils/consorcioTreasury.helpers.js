const cleanText = (value = "", maxLength = 500) => value
  ?.toString?.()
  .trim()
  .replace(/\s+/g, " ")
  .slice(0, maxLength) || "";

const normalizeName = (value = "") => cleanText(value)
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-zA-Z0-9]/g, "")
  .toLowerCase();

const normalizeTaxId = (value = "") => cleanText(value).replace(/\D/g, "");

const voucherTypeForObligation = (value = "") => {
  if (value === "receipt") return "receipt";
  if (["invoice", "service_bill", "ticket"].includes(value)) return "invoice";
  return value === "unknown" ? "no_data" : "other";
};

export const findConsortiumSupplierForDocument = (document = {}, suppliers = []) => {
  const activeSuppliers = (Array.isArray(suppliers) ? suppliers : [])
    .filter((supplier) => supplier.active !== false && supplier.deleted !== true);
  const taxId = normalizeTaxId(document.providerTaxId);
  if (taxId) {
    const taxMatch = activeSuppliers.find(
      (supplier) => normalizeTaxId(supplier.taxId) === taxId,
    );
    if (taxMatch) return { supplier: taxMatch, matchType: "tax_id" };
  }
  const providerName = normalizeName(document.provider);
  if (!providerName) return { supplier: null, matchType: "none" };
  const nameMatch = activeSuppliers.find((supplier) => (
    [supplier.name, supplier.legalName].some((value) => normalizeName(value) === providerName)
  ));
  return nameMatch
    ? { supplier: nameMatch, matchType: "name" }
    : { supplier: null, matchType: "none" };
};

export const findConsortiumPayableForDocument = (document = {}, obligations = []) => (
  (Array.isArray(obligations) ? obligations : []).find((obligation) => (
    obligation.voided !== true
    && obligation.periodId === document.periodId
    && obligation.expenseId === document.expenseId
  )) || null
);

export const buildConsortiumPayableDraftFromDocument = ({
  consortiumId = "",
  document = {},
  expense = {},
  supplierId = "",
  currency = "ARS",
  today = new Date().toISOString().slice(0, 10),
} = {}) => {
  const issueDate = /^\d{4}-\d{2}-\d{2}$/.test(document.documentDate)
    ? document.documentDate : today;
  const dueDate = /^\d{4}-\d{2}-\d{2}$/.test(document.dueDate)
    ? document.dueDate : issueDate;
  const documentTotalMinor = Math.max(0, Math.round(Number(document.documentTotalMinor) || 0));
  const expenseAmountMinor = Math.max(0, Math.round(Number(expense.amountMinor) || 0));
  const obligationCurrency = cleanText(expense.periodCurrency || currency, 10) || "ARS";
  const documentCurrency = cleanText(document.currency, 10);
  const compatibleDocumentCurrency = !documentCurrency
    || documentCurrency === "UNKNOWN"
    || documentCurrency === obligationCurrency;
  const details = [
    document.expenseDocumentId || document.id
      ? `Comprobante archivado: ${document.originalFileName || document.fileName || document.id}`
      : "",
    document.cae ? `CAE ${document.cae}${document.caeDueDate ? ` (vence ${document.caeDueDate})` : ""}` : "",
    Number(document.documentNetMinor || 0) > 0
      ? `Neto ${(Number(document.documentNetMinor) / 100).toFixed(2)}` : "",
    Number(document.documentTaxMinor || 0) > 0
      ? `IVA ${(Number(document.documentTaxMinor) / 100).toFixed(2)}` : "",
    document.recipientName || document.recipientTaxId
      ? `Receptor: ${[document.recipientName, document.recipientTaxId].filter(Boolean).join(" · ")}` : "",
    document.notes,
  ].filter(Boolean).join(" · ");
  return {
    consortiumId,
    supplierId,
    concept: cleanText(document.expenseConcept || expense.concept, 220),
    voucherType: voucherTypeForObligation(document.voucherType),
    voucherNumber: cleanText(document.voucherNumber, 120),
    issueDate,
    dueDate,
    currency: obligationCurrency,
    amountMajor: ((compatibleDocumentCurrency && documentTotalMinor
      ? documentTotalMinor
      : expenseAmountMinor) / 100).toFixed(2),
    periodId: document.periodId || expense.periodId || "",
    expenseId: document.expenseId || expense.id || "",
    expenseLink: document.periodId && document.expenseId
      ? `${document.periodId}::${document.expenseId}` : "",
    expenseDocumentId: document.id || "",
    notes: cleanText(details, 2000),
    file: null,
  };
};

export const buildConsortiumSupplierDraftFromDocument = ({
  consortiumId = "",
  document = {},
} = {}) => ({
  consortiumId,
  name: cleanText(document.provider || "Proveedor a revisar", 220),
  legalName: cleanText(document.provider, 220),
  taxId: cleanText(document.providerTaxId, 32),
  category: "other",
  email: "",
  phone: "",
  address: "",
  bankAccount: "",
  notes: document.aiAssisted
    ? "Datos sugeridos a partir del comprobante. Revisados por la administración."
    : "Datos tomados del comprobante de gasto.",
  active: true,
  deleted: false,
});

export const getConsortiumSupplierPaymentPlanMeta = (
  obligation = {},
  dateKey = new Date().toISOString().slice(0, 10),
) => {
  const plan = obligation.paymentPlan || {};
  if (!plan.status || ["cancelled", "executed"].includes(plan.status)) return null;
  if (plan.status === "partial") {
    return { id: "partial", label: "Programación parcial", badge: "text-bg-warning" };
  }
  if (plan.status === "scheduled") {
    return { id: "scheduled", label: "Pendiente de autorización", badge: "text-bg-secondary" };
  }
  if (plan.status === "authorized" && plan.scheduledDate < dateKey) {
    return { id: "overdue", label: "Pago programado vencido", badge: "text-bg-danger" };
  }
  if (plan.status === "authorized" && plan.scheduledDate === dateKey) {
    return { id: "due_today", label: "Pagar hoy", badge: "text-bg-warning" };
  }
  if (plan.status === "authorized") {
    return { id: "authorized", label: "Pago autorizado", badge: "text-bg-primary" };
  }
  return { id: plan.status, label: plan.status, badge: "text-bg-light" };
};

export const getConsortiumSupplierPaymentAgenda = (
  obligations = [],
  dateKey = new Date().toISOString().slice(0, 10),
) => (Array.isArray(obligations) ? obligations : [])
  .map((obligation) => ({
    obligation,
    plan: obligation.paymentPlan || {},
    meta: getConsortiumSupplierPaymentPlanMeta(obligation, dateKey),
  }))
  .filter((item) => item.meta && item.obligation.voided !== true)
  .sort((left, right) => (
    (left.plan.scheduledDate || "9999-12-31").localeCompare(right.plan.scheduledDate || "9999-12-31")
    || (left.obligation.supplierSnapshot?.name || "").localeCompare(
      right.obligation.supplierSnapshot?.name || "",
      "es",
    )
  ));
