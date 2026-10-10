const cleanText = (value = "", maxLength = 500) => value
  ?.toString?.()
  .trim()
  .replace(/\s+/g, " ")
  .slice(0, maxLength) || "";

const normalize = (value = "") => cleanText(value)
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-zA-Z0-9]/g, "")
  .toLowerCase();

const activeGroups = (groups = []) => (Array.isArray(groups) ? groups : [])
  .filter((group) => group.active !== false);

export const matchConsortiumCoefficientGroup = (hint = "", groups = []) => {
  const available = activeGroups(groups);
  const fallback = available.find((group) => group.id === "general") || available[0];
  const normalizedHint = normalize(hint);
  if (!normalizedHint) return fallback?.id || "general";
  const match = available.find((group) => {
    const id = normalize(group.id);
    const name = normalize(group.name);
    const terms = [id, name];
    if (name.length > 5 && name.endsWith("es")) terms.push(name.slice(0, -2));
    if (name.length > 4 && name.endsWith("s")) terms.push(name.slice(0, -1));
    return terms.some((term) => term && (
      normalizedHint === term
      || normalizedHint.includes(term)
      || term.includes(normalizedHint)
    ));
  });
  return match?.id || fallback?.id || "general";
};

export const findConsortiumExpenseDocumentDuplicate = ({
  candidate = {},
  documents = [],
  batch = [],
} = {}) => {
  const sources = [
    ...(Array.isArray(documents) ? documents.filter((item) => item.voided !== true) : []),
    ...(Array.isArray(batch) ? batch.filter((item) => item.localId !== candidate.localId) : []),
  ];
  if (candidate.documentHash) {
    const exact = sources.find((item) => item.documentHash === candidate.documentHash);
    if (exact) return { type: "exact", match: exact };
  }
  const voucher = normalize(candidate.voucherNumber);
  if (!voucher) return null;
  const taxId = normalize(candidate.providerTaxId);
  const provider = normalize(candidate.providerName || candidate.provider);
  const possible = sources.find((item) => {
    if (normalize(item.voucherNumber) !== voucher) return false;
    const sameTaxId = taxId && normalize(item.providerTaxId) === taxId;
    const sameProvider = provider && normalize(item.providerName || item.provider) === provider;
    return sameTaxId || sameProvider;
  });
  return possible ? { type: "possible", match: possible } : null;
};

export const getConsortiumExpenseAiConfidenceMeta = (confidence = 0) => {
  const normalized = Math.min(1, Math.max(0, Number(confidence) || 0));
  if (normalized >= 0.8) return { label: "Confianza alta", className: "text-bg-success" };
  if (normalized >= 0.55) return { label: "Revisar datos", className: "text-bg-warning" };
  return { label: "Confianza baja", className: "text-bg-danger" };
};

export const buildConsortiumExpenseFromAiDraft = (draft = {}, {
  id,
  coefficientGroups = [],
} = {}) => {
  const requestedMode = ["coefficient", "equal"].includes(draft.distributionMode)
    ? draft.distributionMode
    : "coefficient";
  const provider = cleanText(draft.providerName, 220);
  const voucher = cleanText(draft.voucherNumber, 120);
  const notes = [
    cleanText(draft.notes, 500),
    provider ? `Proveedor: ${provider}` : "",
    voucher ? `Comprobante: ${voucher}` : "",
  ].filter(Boolean).join(" · ");
  return {
    id,
    concept: cleanText(draft.concept || draft.suggestedConcept, 220)
      || (provider ? `Gasto de ${provider}` : "Gasto a revisar"),
    category: draft.category === "extraordinary" ? "extraordinary" : "ordinary",
    distributionMode: requestedMode,
    coefficientGroupId: requestedMode === "coefficient"
      ? matchConsortiumCoefficientGroup(
        draft.coefficientGroupId || draft.coefficientGroupHint,
        coefficientGroups,
      )
      : "",
    specificUnitId: "",
    amountMinor: Math.max(0, Math.round(Number(draft.amountMinor) || 0)),
    notes: cleanText(notes, 1000),
  };
};

