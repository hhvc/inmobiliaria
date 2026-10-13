import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

import {
  authorizeConsortiumSupplierPayment,
  archiveConsortiumSupplier,
  archiveConsortiumTreasuryAccount,
  cancelConsortiumSupplierPaymentPlan,
  createConsortiumSupplierObligation,
  createConsortiumTreasuryReconciliation,
  createConsortiumTreasuryAccount,
  downloadPrivateConsortiumDocument,
  getConsortiumSupplierObligations,
  getConsortiumSupplierPayments,
  getConsortiumSuppliers,
  getConsortiumTreasuryAccounts,
  getConsortiumTreasuryMovements,
  getConsortiumTreasuryReconciliations,
  registerConsortiumTreasuryMovement,
  registerConsortiumSupplierPayment,
  scheduleConsortiumSupplierPayment,
  saveConsortiumSupplier,
  updateConsortiumSupplierObligation,
  transferConsortiumTreasuryFunds,
  voidConsortiumSupplierObligation,
  voidConsortiumSupplierPayment,
  voidConsortiumTreasuryReconciliation,
} from "../services/consorcio.service";
import {
  CONSORTIUM_DOCUMENT_ACCEPT,
  CONSORTIUM_PAYMENT_METHODS,
  CONSORTIUM_SUPPLIER_CATEGORIES,
  CONSORTIUM_TREASURY_ACCOUNT_TYPES,
  getConsortiumSupplierCategory,
  getConsortiumSupplierObligationState,
  getConsortiumTreasuryAccountType,
} from "../utils/consorcio.constants";
import {
  buildConsortiumSupplierObligationsCsv,
  filterConsortiumSupplierObligations,
  formatConsortiumMoney,
  getConsortiumSupplierObligationStatus,
  getConsortiumTreasuryBookBalance,
  getConsortiumTreasurySummary,
  majorToMinor,
  minorToMajorInput,
} from "../utils/consorcio.helpers";
import {
  createEmptyConsortiumSupplier,
  createEmptyConsortiumSupplierObligation,
  createEmptyConsortiumTreasuryAccount,
  createEmptyConsortiumTreasuryMovement,
  createEmptyConsortiumTreasuryReconciliation,
  createEmptyConsortiumTreasuryTransfer,
} from "../utils/consorcio.schema";
import {
  buildConsortiumPayableDraftFromDocument,
  buildConsortiumSupplierDraftFromDocument,
  findConsortiumSupplierForDocument,
  getConsortiumSupplierPaymentAgenda,
  getConsortiumSupplierPaymentPlanMeta,
} from "../utils/consorcioTreasury.helpers";

const todayKey = () => new Date().toISOString().slice(0, 10);
const thisMonth = () => todayKey().slice(0, 7);
const formatDate = (value = "") => {
  if (!value) return "—";
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString("es-AR");
};

const emptySupplierForm = (consortiumId) => ({
  ...createEmptyConsortiumSupplier(),
  consortiumId,
});

const emptyAccountForm = (consortiumId, currency) => ({
  ...createEmptyConsortiumTreasuryAccount(),
  consortiumId,
  currency,
  openingBalanceMajor: "",
});

const emptyObligationForm = (consortiumId, currency) => ({
  ...createEmptyConsortiumSupplierObligation(),
  consortiumId,
  currency,
  amountMajor: "",
  expenseLink: "",
  file: null,
});

const emptyPaymentForm = () => ({
  obligationId: "",
  accountId: "",
  amountMajor: "",
  date: todayKey(),
  method: "transfer",
  reference: "",
  notes: "",
  file: null,
});

const emptyPaymentPlanForm = () => ({
  obligationId: "",
  accountId: "",
  amountMajor: "",
  scheduledDate: todayKey(),
  method: "transfer",
  reference: "",
  notes: "",
});

const emptyMovementForm = (consortiumId) => ({
  ...createEmptyConsortiumTreasuryMovement(),
  consortiumId,
  amountMajor: "",
  file: null,
});

const emptyTransferForm = (consortiumId) => ({
  ...createEmptyConsortiumTreasuryTransfer(),
  consortiumId,
  amountMajor: "",
});

const emptyReconciliationForm = (consortiumId) => ({
  ...createEmptyConsortiumTreasuryReconciliation(),
  consortiumId,
  statementBalanceMajor: "",
  file: null,
});

const voucherLabels = {
  invoice: "Factura",
  receipt: "Recibo",
  budget: "Presupuesto",
  other: "Otro comprobante",
  no_data: "Sin datos",
};

const movementSourceLabels = {
  opening_balance: "Saldo inicial",
  consortium_collection: "Cobro de expensas",
  consortium_collection_reversal: "Anulación de cobro",
  mercadopago_deduction: "Deducciones Mercado Pago",
  mercadopago_reversal: "Devolución / contracargo MP",
  supplier_payment: "Pago a proveedor",
  supplier_payment_reversal: "Anulación de pago",
  manual_movement: "Movimiento manual",
  bank_statement_review: "Extracto bancario",
  account_transfer: "Transferencia",
};

const ConsortiumTreasuryPanel = ({
  inmobiliariaId,
  consortium,
  periods = [],
  canManage = false,
  refreshKey = 0,
  payableRequest = null,
  onAccountsChanged,
  onObligationsChanged,
  onReconciliationsChanged,
  onSuppliersChanged,
}) => {
  const consortiumId = consortium?.id || "";
  const currency = consortium?.currency || "ARS";
  const [activeView, setActiveView] = useState("obligations");
  const [suppliers, setSuppliers] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [obligations, setObligations] = useState([]);
  const [payments, setPayments] = useState([]);
  const [movements, setMovements] = useState([]);
  const [reconciliations, setReconciliations] = useState([]);
  const [supplierForm, setSupplierForm] = useState(() => emptySupplierForm(consortiumId));
  const [editingSupplierId, setEditingSupplierId] = useState("");
  const [accountForm, setAccountForm] = useState(() => emptyAccountForm(consortiumId, currency));
  const [obligationForm, setObligationForm] = useState(() => emptyObligationForm(consortiumId, currency));
  const [editingObligationId, setEditingObligationId] = useState("");
  const [paymentForm, setPaymentForm] = useState(emptyPaymentForm);
  const [paymentPlanForm, setPaymentPlanForm] = useState(emptyPaymentPlanForm);
  const [movementForm, setMovementForm] = useState(() => emptyMovementForm(consortiumId));
  const [transferForm, setTransferForm] = useState(() => emptyTransferForm(consortiumId));
  const [reconciliationForm, setReconciliationForm] = useState(() => (
    emptyReconciliationForm(consortiumId)
  ));
  const [showObligationForm, setShowObligationForm] = useState(false);
  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [pendingPayableDraft, setPendingPayableDraft] = useState(null);
  const [treasuryAction, setTreasuryAction] = useState("");
  const [obligationStatusFilter, setObligationStatusFilter] = useState("open");
  const [obligationSearch, setObligationSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [operation, setOperation] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [payableWarning, setPayableWarning] = useState("");
  const supplierFormRef = useRef(null);
  const obligationFormRef = useRef(null);
  const paymentFormRef = useRef(null);
  const paymentPlanFormRef = useRef(null);
  const accountFormRef = useRef(null);
  const treasuryActionFormRef = useRef(null);
  const processedPayableRequestRef = useRef("");

  const load = useCallback(async () => {
    if (!inmobiliariaId || !consortiumId) return;
    try {
      setLoading(true);
      const [
        supplierData,
        accountData,
        obligationData,
        paymentData,
        movementData,
        reconciliationData,
      ] = await Promise.all([
        getConsortiumSuppliers(inmobiliariaId, consortiumId),
        getConsortiumTreasuryAccounts(inmobiliariaId, consortiumId),
        getConsortiumSupplierObligations(inmobiliariaId, { consortiumId, includeVoided: true }),
        getConsortiumSupplierPayments(inmobiliariaId, { consortiumId, includeVoided: true }),
        getConsortiumTreasuryMovements(inmobiliariaId, consortiumId),
        getConsortiumTreasuryReconciliations(inmobiliariaId, consortiumId),
      ]);
      setSuppliers(supplierData);
      onSuppliersChanged?.(supplierData);
      setAccounts(accountData);
      onAccountsChanged?.(accountData);
      setObligations(obligationData);
      onObligationsChanged?.(obligationData);
      setPayments(paymentData);
      setMovements(movementData);
      setReconciliations(reconciliationData);
      onReconciliationsChanged?.(reconciliationData);
    } catch (loadError) {
      setError(loadError.message || "No se pudo cargar proveedores y tesorería.");
    } finally {
      setLoading(false);
    }
  }, [consortiumId, inmobiliariaId, onAccountsChanged, onObligationsChanged, onReconciliationsChanged, onSuppliersChanged]);

  useEffect(() => { load(); }, [load, refreshKey]);
  useEffect(() => {
    setSupplierForm(emptySupplierForm(consortiumId));
    setAccountForm(emptyAccountForm(consortiumId, currency));
    setObligationForm(emptyObligationForm(consortiumId, currency));
    setPaymentForm(emptyPaymentForm());
    setPaymentPlanForm(emptyPaymentPlanForm());
    setMovementForm(emptyMovementForm(consortiumId));
    setTransferForm(emptyTransferForm(consortiumId));
    setReconciliationForm(emptyReconciliationForm(consortiumId));
  }, [consortiumId, currency]);

  const activeSuppliers = useMemo(
    () => suppliers.filter((item) => item.active !== false && item.deleted !== true),
    [suppliers],
  );
  const activeAccounts = useMemo(
    () => accounts.filter((item) => item.active !== false && item.deleted !== true),
    [accounts],
  );
  const availableExpenses = useMemo(() => periods.flatMap((period) => (
    Array.isArray(period.expenses) ? period.expenses.map((expense) => ({
      ...expense,
      periodId: period.id,
      periodKey: period.periodKey,
      periodCurrency: period.currency || currency,
      link: `${period.id}::${expense.id}`,
      linked: obligations.some((item) => (
        item.voided !== true && item.periodId === period.id && item.expenseId === expense.id
      )),
    })) : []
  )), [currency, obligations, periods]);

  useEffect(() => {
    const requestKey = payableRequest?.nonce?.toString?.() || "";
    if (!requestKey || loading || processedPayableRequestRef.current === requestKey) return;
    processedPayableRequestRef.current = requestKey;
    const document = payableRequest.document || {};
    setActiveView("obligations");
    setShowSupplierForm(false);
    setShowObligationForm(false);
    setEditingSupplierId("");
    setEditingObligationId("");
    setPendingPayableDraft(null);
    setError("");
    setPayableWarning("");
    if (payableRequest.obligationId) {
      setObligationStatusFilter("all");
      setObligationSearch(document.voucherNumber || document.provider || document.expenseConcept || "");
      setSuccess("El gasto ya tiene una cuenta a pagar activa. Se mostró en el listado.");
      return;
    }
    const link = document.periodId && document.expenseId
      ? `${document.periodId}::${document.expenseId}` : "";
    const expense = availableExpenses.find((item) => item.link === link);
    if (!expense) {
      setError("No se encontró el gasto vinculado al comprobante. Actualizá la liquidación y reintentá.");
      return;
    }
    if (expense.linked) {
      setError("Ese gasto ya tiene una cuenta a pagar activa y no puede duplicarse.");
      return;
    }
    const supplierMatch = findConsortiumSupplierForDocument(document, suppliers);
    const draft = buildConsortiumPayableDraftFromDocument({
      consortiumId,
      document,
      expense,
      supplierId: supplierMatch.supplier?.id || "",
      currency,
    });
    const warningParts = [];
    const documentTotalMinor = Math.max(0, Number(document.documentTotalMinor) || 0);
    if (documentTotalMinor && documentTotalMinor !== Number(expense.amountMinor || 0)) {
      warningParts.push(`El comprobante informa ${formatConsortiumMoney(documentTotalMinor, document.currency || draft.currency)} y el gasto liquidado ${formatConsortiumMoney(expense.amountMinor, draft.currency)}.`);
    }
    if (
      document.currency
      && document.currency !== "UNKNOWN"
      && document.currency !== draft.currency
    ) {
      warningParts.push(`La moneda leída (${document.currency}) difiere de la liquidación (${draft.currency}); se conservó el importe del gasto.`);
    }
    setPayableWarning(warningParts.join(" "));
    if (supplierMatch.supplier) {
      setObligationForm({ ...emptyObligationForm(consortiumId, currency), ...draft });
      setShowObligationForm(true);
      setSuccess(`Proveedor reconocido por ${supplierMatch.matchType === "tax_id" ? "CUIT" : "nombre"}. Revisá los datos y confirmá la cuenta a pagar.`);
      focusForm(obligationFormRef);
      return;
    }
    setPendingPayableDraft(draft);
    setSupplierForm(buildConsortiumSupplierDraftFromDocument({ consortiumId, document }));
    setActiveView("suppliers");
    setShowSupplierForm(true);
    setSuccess("El proveedor todavía no está en el padrón. Revisá sus datos y crealo para continuar; la cuenta a pagar no se registrará hasta tu confirmación.");
    focusForm(supplierFormRef);
  }, [availableExpenses, consortiumId, currency, loading, payableRequest, suppliers]);

  const pendingMinor = useMemo(() => obligations
    .filter((item) => item.voided !== true)
    .reduce((sum, item) => sum + Math.max(0, Number(item.balanceMinor) || 0), 0), [obligations]);
  const overdueCount = useMemo(() => obligations.filter(
    (item) => getConsortiumSupplierObligationStatus(item) === "overdue",
  ).length, [obligations]);
  const paidThisMonthMinor = useMemo(() => payments
    .filter((item) => item.voided !== true && item.date?.startsWith(thisMonth()))
    .reduce((sum, item) => sum + Number(item.amountMinor || 0), 0), [payments]);
  const treasurySummary = useMemo(
    () => getConsortiumTreasurySummary({ accounts, movements }),
    [accounts, movements],
  );
  const visibleObligations = useMemo(() => filterConsortiumSupplierObligations(
    obligations,
    { status: obligationStatusFilter, search: obligationSearch },
  ), [obligationSearch, obligationStatusFilter, obligations]);
  const paymentAgenda = useMemo(
    () => getConsortiumSupplierPaymentAgenda(obligations),
    [obligations],
  );
  const paymentAgendaMinor = useMemo(() => paymentAgenda.reduce(
    (sum, item) => sum + Math.max(0, Number(item.plan.remainingMinor ?? item.plan.amountMinor) || 0),
    0,
  ), [paymentAgenda]);
  const selectedPaymentPlanObligation = useMemo(
    () => obligations.find((item) => item.id === paymentPlanForm.obligationId) || null,
    [obligations, paymentPlanForm.obligationId],
  );
  const selectedPaymentObligation = useMemo(
    () => obligations.find((item) => item.id === paymentForm.obligationId) || null,
    [obligations, paymentForm.obligationId],
  );
  const paymentPlanAccounts = useMemo(() => activeAccounts.filter((item) => (
    !selectedPaymentPlanObligation || item.currency === selectedPaymentPlanObligation.currency
  )), [activeAccounts, selectedPaymentPlanObligation]);
  const paymentAccounts = useMemo(() => activeAccounts.filter((item) => (
    !selectedPaymentObligation || item.currency === selectedPaymentObligation.currency
  )), [activeAccounts, selectedPaymentObligation]);
  const reconciliationBookBalance = useMemo(() => getConsortiumTreasuryBookBalance({
    accountId: reconciliationForm.accountId,
    movements,
    dateKey: reconciliationForm.statementDate,
  }), [movements, reconciliationForm.accountId, reconciliationForm.statementDate]);
  const hasReconciliationBalance = reconciliationForm.statementBalanceMajor
    .toString()
    .trim() !== "";
  const reconciliationDifference = hasReconciliationBalance
    ? majorToMinor(reconciliationForm.statementBalanceMajor) - reconciliationBookBalance
    : null;

  const clearMessages = () => { setError(""); setSuccess(""); setPayableWarning(""); };

  const focusForm = (formRef) => {
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      formRef.current?.querySelector("input, select, textarea")?.focus({ preventScroll: true });
    }));
  };

  const openNewSupplier = () => {
    clearMessages();
    setPendingPayableDraft(null);
    setEditingSupplierId("");
    setSupplierForm(emptySupplierForm(consortiumId));
    setShowSupplierForm(true);
    focusForm(supplierFormRef);
  };

  const openNewObligation = () => {
    clearMessages();
    setPendingPayableDraft(null);
    setEditingObligationId("");
    setObligationForm(emptyObligationForm(consortiumId, currency));
    setShowObligationForm(true);
    focusForm(obligationFormRef);
  };

  const openNewAccount = () => {
    clearMessages();
    setAccountForm(emptyAccountForm(consortiumId, currency));
    setShowAccountForm(true);
    focusForm(accountFormRef);
  };

  const openTreasuryAction = (action) => {
    clearMessages();
    setTreasuryAction(action);
    if (action === "movement") setMovementForm(emptyMovementForm(consortiumId));
    if (action === "transfer") setTransferForm(emptyTransferForm(consortiumId));
    if (action === "reconciliation") {
      setReconciliationForm(emptyReconciliationForm(consortiumId));
    }
    focusForm(treasuryActionFormRef);
  };

  const exportObligations = () => {
    const content = buildConsortiumSupplierObligationsCsv(visibleObligations);
    const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `cuentas-a-pagar-${todayKey()}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const submitMovement = async (event) => {
    event.preventDefault();
    try {
      clearMessages();
      setOperation("manual-movement");
      await registerConsortiumTreasuryMovement({
        inmobiliariaId,
        ...movementForm,
        amountMinor: majorToMinor(movementForm.amountMajor),
      });
      setMovementForm(emptyMovementForm(consortiumId));
      setTreasuryAction("");
      setSuccess("Movimiento registrado con trazabilidad.");
      await load();
    } catch (saveError) {
      setError(saveError.message || "No se pudo registrar el movimiento.");
    } finally {
      setOperation("");
    }
  };

  const submitTransfer = async (event) => {
    event.preventDefault();
    try {
      clearMessages();
      setOperation("transfer");
      await transferConsortiumTreasuryFunds({
        inmobiliariaId,
        ...transferForm,
        amountMinor: majorToMinor(transferForm.amountMajor),
      });
      setTransferForm(emptyTransferForm(consortiumId));
      setTreasuryAction("");
      setSuccess("Transferencia aplicada a ambas cuentas sin modificar los fondos totales.");
      await load();
    } catch (saveError) {
      setError(saveError.message || "No se pudo registrar la transferencia.");
    } finally {
      setOperation("");
    }
  };

  const submitReconciliation = async (event) => {
    event.preventDefault();
    if (!reconciliationForm.accountId
      || !reconciliationForm.statementDate
      || !hasReconciliationBalance) {
      setError("Seleccioná la cuenta e ingresá la fecha y el saldo informado.");
      return;
    }
    try {
      clearMessages();
      setOperation("reconciliation");
      await createConsortiumTreasuryReconciliation({
        inmobiliariaId,
        ...reconciliationForm,
        statementBalanceMinor: majorToMinor(reconciliationForm.statementBalanceMajor),
      });
      setReconciliationForm(emptyReconciliationForm(consortiumId));
      setTreasuryAction("");
      setSuccess(reconciliationDifference === 0
        ? "Conciliación registrada sin diferencias."
        : "Control registrado con una diferencia pendiente de regularización.");
      await load();
    } catch (saveError) {
      setError(saveError.message || "No se pudo registrar la conciliación.");
    } finally {
      setOperation("");
    }
  };

  const voidReconciliation = async (reconciliation) => {
    const reason = window.prompt("Motivo de la anulación de la conciliación:");
    if (!reason) return;
    try {
      clearMessages();
      setOperation(`void-reconciliation-${reconciliation.id}`);
      await voidConsortiumTreasuryReconciliation({
        inmobiliariaId,
        reconciliationId: reconciliation.id,
        reason,
      });
      setSuccess("Conciliación anulada; el registro permanece en el historial.");
      await load();
    } catch (saveError) {
      setError(saveError.message || "No se pudo anular la conciliación.");
    } finally {
      setOperation("");
    }
  };

  const submitSupplier = async (event) => {
    event.preventDefault();
    const payableWarningBeforeSave = payableWarning;
    try {
      clearMessages();
      setOperation("supplier");
      const savedSupplierId = await saveConsortiumSupplier({
        inmobiliariaId,
        supplierId: editingSupplierId,
        value: supplierForm,
      });
      const continuePayable = !editingSupplierId && pendingPayableDraft;
      setSupplierForm(emptySupplierForm(consortiumId));
      setEditingSupplierId("");
      setShowSupplierForm(false);
      await load();
      if (continuePayable) {
        setActiveView("obligations");
        setObligationForm({
          ...emptyObligationForm(consortiumId, currency),
          ...continuePayable,
          supplierId: savedSupplierId,
        });
        setPendingPayableDraft(null);
        setShowObligationForm(true);
        setPayableWarning(payableWarningBeforeSave);
        setSuccess("Proveedor creado. Revisá y confirmá la cuenta a pagar; todavía no se registró ninguna obligación.");
        focusForm(obligationFormRef);
      } else {
        setSuccess(editingSupplierId ? "Proveedor actualizado." : "Proveedor incorporado al padrón.");
      }
    } catch (saveError) {
      setError(saveError.message || "No se pudo guardar el proveedor.");
    } finally {
      setOperation("");
    }
  };

  const editSupplier = (supplier) => {
    clearMessages();
    setEditingSupplierId(supplier.id);
    setSupplierForm({ ...emptySupplierForm(consortiumId), ...supplier });
    setShowSupplierForm(true);
    focusForm(supplierFormRef);
  };

  const archiveSupplier = async (supplier) => {
    if (!window.confirm(`¿Archivar a ${supplier.name}? Las obligaciones históricas se conservarán.`)) return;
    try {
      clearMessages();
      setOperation(`archive-supplier-${supplier.id}`);
      await archiveConsortiumSupplier({ inmobiliariaId, supplierId: supplier.id });
      setSuccess("Proveedor archivado.");
      await load();
    } catch (archiveError) {
      setError(archiveError.message || "No se pudo archivar el proveedor.");
    } finally {
      setOperation("");
    }
  };

  const submitAccount = async (event) => {
    event.preventDefault();
    try {
      clearMessages();
      setOperation("account");
      await createConsortiumTreasuryAccount({
        inmobiliariaId,
        consortiumId,
        name: accountForm.name,
        type: accountForm.type,
        currency: accountForm.currency,
        openingBalanceMinor: majorToMinor(accountForm.openingBalanceMajor),
        notes: accountForm.notes,
      });
      setAccountForm(emptyAccountForm(consortiumId, currency));
      setShowAccountForm(false);
      setSuccess("Cuenta de tesorería creada con su saldo inicial.");
      await load();
    } catch (saveError) {
      setError(saveError.message || "No se pudo crear la cuenta.");
    } finally {
      setOperation("");
    }
  };

  const archiveAccount = async (account) => {
    if (!window.confirm(`¿Archivar ${account.name}?`)) return;
    try {
      clearMessages();
      setOperation(`archive-account-${account.id}`);
      await archiveConsortiumTreasuryAccount({ inmobiliariaId, accountId: account.id });
      setSuccess("Cuenta archivada.");
      await load();
    } catch (archiveError) {
      setError(archiveError.message || "No se pudo archivar la cuenta.");
    } finally {
      setOperation("");
    }
  };

  const selectExpense = (link) => {
    const expense = availableExpenses.find((item) => item.link === link);
    setObligationForm((current) => ({
      ...current,
      expenseLink: link,
      periodId: expense?.periodId || "",
      expenseId: expense?.id || "",
      concept: expense?.concept || current.concept,
      amountMajor: expense ? minorToMajorInput(expense.amountMinor) : current.amountMajor,
      currency: expense?.periodCurrency || current.currency,
    }));
  };

  const submitObligation = async (event) => {
    event.preventDefault();
    try {
      clearMessages();
      setOperation("obligation");
      const value = { ...obligationForm, amountMinor: majorToMinor(obligationForm.amountMajor) };
      if (editingObligationId) {
        await updateConsortiumSupplierObligation({
          inmobiliariaId,
          obligationId: editingObligationId,
          value,
        });
      } else {
        await createConsortiumSupplierObligation({ inmobiliariaId, ...value });
      }
      setObligationForm(emptyObligationForm(consortiumId, currency));
      setEditingObligationId("");
      setShowObligationForm(false);
      setSuccess(editingObligationId ? "Obligación actualizada." : "Obligación registrada en cuentas a pagar.");
      await load();
    } catch (saveError) {
      setError(saveError.message || "No se pudo guardar la obligación.");
    } finally {
      setOperation("");
    }
  };

  const editObligation = (obligation) => {
    clearMessages();
    setEditingObligationId(obligation.id);
    setObligationForm({
      ...emptyObligationForm(consortiumId, currency),
      ...obligation,
      amountMajor: minorToMajorInput(obligation.amountMinor),
      expenseLink: obligation.periodId && obligation.expenseId
        ? `${obligation.periodId}::${obligation.expenseId}` : "",
      file: null,
    });
    setShowObligationForm(true);
    focusForm(obligationFormRef);
  };

  const voidObligation = async (obligation) => {
    const reason = window.prompt("Motivo de la anulación de la obligación:");
    if (!reason) return;
    try {
      clearMessages();
      setOperation(`void-obligation-${obligation.id}`);
      await voidConsortiumSupplierObligation({ inmobiliariaId, obligationId: obligation.id, reason });
      setSuccess("Obligación anulada con trazabilidad.");
      await load();
    } catch (voidError) {
      setError(voidError.message || "No se pudo anular la obligación.");
    } finally {
      setOperation("");
    }
  };

  const openPaymentPlan = (obligation) => {
    clearMessages();
    setPaymentForm(emptyPaymentForm());
    const plan = obligation.paymentPlan || {};
    const hasActivePlan = ["scheduled", "authorized", "partial"].includes(plan.status);
    const sameCurrencyAccount = activeAccounts.find((item) => (
      item.id === plan.accountId && item.currency === obligation.currency
    )) || activeAccounts.find((item) => item.currency === obligation.currency);
    const defaultDate = obligation.dueDate && obligation.dueDate > todayKey()
      ? obligation.dueDate : todayKey();
    setPaymentPlanForm({
      ...emptyPaymentPlanForm(),
      obligationId: obligation.id,
      accountId: sameCurrencyAccount?.id || "",
      amountMajor: minorToMajorInput(
        hasActivePlan
          ? (plan.remainingMinor ?? plan.amountMinor ?? obligation.balanceMinor)
          : obligation.balanceMinor,
      ),
      scheduledDate: hasActivePlan && plan.scheduledDate >= todayKey()
        ? plan.scheduledDate : defaultDate,
      method: hasActivePlan ? (plan.method || "transfer") : "transfer",
      reference: hasActivePlan ? (plan.reference || "") : "",
      notes: hasActivePlan ? (plan.notes || "") : "",
    });
    focusForm(paymentPlanFormRef);
  };

  const submitPaymentPlan = async (event) => {
    event.preventDefault();
    try {
      clearMessages();
      setOperation("payment-plan");
      await scheduleConsortiumSupplierPayment({
        inmobiliariaId,
        ...paymentPlanForm,
        amountMinor: majorToMinor(paymentPlanForm.amountMajor),
      });
      setPaymentPlanForm(emptyPaymentPlanForm());
      setSuccess("Pago incorporado a la agenda. Quedó pendiente de autorización y todavía no mueve fondos.");
      await load();
    } catch (saveError) {
      setError(saveError.message || "No se pudo programar el pago.");
    } finally {
      setOperation("");
    }
  };

  const authorizePaymentPlan = async (obligation) => {
    const plan = obligation.paymentPlan || {};
    const message = `¿Autorizar el pago de ${formatConsortiumMoney(plan.amountMinor, obligation.currency)} a ${obligation.supplierSnapshot?.name || "este proveedor"} para el ${formatDate(plan.scheduledDate)}?\n\nEsta autorización no transfiere ni descuenta fondos.`;
    if (!window.confirm(message)) return;
    try {
      clearMessages();
      setOperation(`authorize-payment-plan-${obligation.id}`);
      await authorizeConsortiumSupplierPayment({ inmobiliariaId, obligationId: obligation.id });
      setSuccess("Pago autorizado. Sigue pendiente de ejecución y no se movieron fondos.");
      await load();
    } catch (saveError) {
      setError(saveError.message || "No se pudo autorizar el pago.");
    } finally {
      setOperation("");
    }
  };

  const cancelPaymentPlan = async (obligation) => {
    const reason = window.prompt("Motivo de la cancelación de la programación:");
    if (!reason) return;
    try {
      clearMessages();
      setOperation(`cancel-payment-plan-${obligation.id}`);
      await cancelConsortiumSupplierPaymentPlan({
        inmobiliariaId,
        obligationId: obligation.id,
        reason,
      });
      setPaymentPlanForm(emptyPaymentPlanForm());
      setSuccess("Programación cancelada. La obligación continúa pendiente y no se movieron fondos.");
      await load();
    } catch (saveError) {
      setError(saveError.message || "No se pudo cancelar la programación.");
    } finally {
      setOperation("");
    }
  };

  const startPayment = (obligation) => {
    clearMessages();
    setPaymentPlanForm(emptyPaymentPlanForm());
    const plan = obligation.paymentPlan || {};
    const authorizedPlan = ["authorized", "partial"].includes(plan.status) ? plan : null;
    const sameCurrencyAccount = activeAccounts.find((item) => (
      item.id === authorizedPlan?.accountId && item.currency === obligation.currency
    )) || activeAccounts.find((item) => item.currency === obligation.currency);
    setPaymentForm({
      ...emptyPaymentForm(),
      obligationId: obligation.id,
      accountId: sameCurrencyAccount?.id || "",
      amountMajor: minorToMajorInput(
        authorizedPlan
          ? (authorizedPlan.remainingMinor ?? authorizedPlan.amountMinor ?? obligation.balanceMinor)
          : obligation.balanceMinor,
      ),
      method: authorizedPlan?.method || "transfer",
      reference: authorizedPlan?.reference || "",
      notes: authorizedPlan?.notes || "",
    });
    focusForm(paymentFormRef);
  };

  const submitPayment = async (event) => {
    event.preventDefault();
    try {
      clearMessages();
      setOperation("payment");
      await registerConsortiumSupplierPayment({
        inmobiliariaId,
        ...paymentForm,
        amountMinor: majorToMinor(paymentForm.amountMajor),
      });
      setPaymentForm(emptyPaymentForm());
      setSuccess("Pago aplicado a la obligación y a tesorería.");
      await load();
    } catch (saveError) {
      setError(saveError.message || "No se pudo registrar el pago.");
    } finally {
      setOperation("");
    }
  };

  const voidPayment = async (payment) => {
    const reason = window.prompt("Motivo de la anulación del pago:");
    if (!reason) return;
    try {
      clearMessages();
      setOperation(`void-payment-${payment.id}`);
      await voidConsortiumSupplierPayment({ inmobiliariaId, paymentId: payment.id, reason });
      setSuccess("Pago anulado. El saldo volvió a la cuenta y a la obligación.");
      await load();
    } catch (voidError) {
      setError(voidError.message || "No se pudo anular el pago.");
    } finally {
      setOperation("");
    }
  };

  const downloadDocument = async (path, name) => {
    try {
      clearMessages();
      setOperation(`download-${path}`);
      await downloadPrivateConsortiumDocument({ path, fileName: name });
    } catch (downloadError) {
      setError(downloadError.message || "No se pudo descargar el comprobante.");
    } finally {
      setOperation("");
    }
  };

  return (
    <section className="card border-0 shadow-sm mb-4 consortium-section-anchor" id="proveedores-tesoreria">
      <div className="card-body p-4">
        <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
          <div>
            <span className="badge text-bg-light border mb-2">Gestión financiera</span>
            <h2 className="h5 mb-1">Proveedores, gastos y tesorería</h2>
            <p className="text-muted small mb-0">Controlá cuentas a pagar y cada salida de caja o banco sin duplicar los gastos liquidados.</p>
          </div>
          <div className="btn-group btn-group-sm" role="group" aria-label="Secciones de proveedores y tesorería">
            <button className={`btn ${activeView === "obligations" ? "btn-primary" : "btn-outline-primary"}`} type="button" onClick={() => setActiveView("obligations")}>Cuentas a pagar</button>
            <button className={`btn ${activeView === "suppliers" ? "btn-primary" : "btn-outline-primary"}`} type="button" onClick={() => setActiveView("suppliers")}>Proveedores</button>
            <button className={`btn ${activeView === "treasury" ? "btn-primary" : "btn-outline-primary"}`} type="button" onClick={() => setActiveView("treasury")}>Tesorería</button>
          </div>
        </div>

        {error && <div className="alert alert-danger">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}
        {payableWarning && <div className="alert alert-warning"><strong>Revisá el importe.</strong> {payableWarning}</div>}
        {loading && <div className="text-center text-muted py-4">Cargando gestión financiera...</div>}

        {!loading && <>
          <div className="row g-3 mb-4 consortium-treasury-summary">
            <div className="col-sm-6 col-xl-3"><div className="rounded border p-3 h-100"><small className="text-muted d-block">Fondos disponibles</small><strong className="consortium-money fs-5">{formatConsortiumMoney(treasurySummary.availableMinor, currency)}</strong></div></div>
            <div className="col-sm-6 col-xl-3"><div className="rounded border p-3 h-100"><small className="text-muted d-block">Cuentas a pagar</small><strong className="consortium-money fs-5">{formatConsortiumMoney(pendingMinor, currency)}</strong></div></div>
            <div className="col-sm-6 col-xl-3"><div className="rounded border p-3 h-100"><small className="text-muted d-block">Obligaciones vencidas</small><strong className="fs-5">{overdueCount}</strong></div></div>
            <div className="col-sm-6 col-xl-3"><div className="rounded border p-3 h-100"><small className="text-muted d-block">Pagado este mes</small><strong className="consortium-money fs-5">{formatConsortiumMoney(paidThisMonthMinor, currency)}</strong></div></div>
          </div>

          {activeView === "suppliers" && <div>
            <div className="d-flex justify-content-between align-items-center gap-2 mb-3"><div><h3 className="h6 mb-1">Padrón de proveedores</h3><small className="text-muted">Los datos quedan disponibles para futuras liquidaciones y pagos.</small></div>{canManage && <button className="btn btn-sm btn-outline-primary" type="button" onClick={openNewSupplier}>Agregar proveedor</button>}</div>
            {canManage && showSupplierForm && <form ref={supplierFormRef} className="rounded border bg-light p-3 mb-4" onSubmit={submitSupplier}>
              <div className="row g-3"><div className="col-md-4"><label className="form-label">Nombre habitual *</label><input className="form-control" value={supplierForm.name} onChange={(event) => setSupplierForm((current) => ({ ...current, name: event.target.value }))} required /></div><div className="col-md-4"><label className="form-label">Razón social</label><input className="form-control" value={supplierForm.legalName} onChange={(event) => setSupplierForm((current) => ({ ...current, legalName: event.target.value }))} /></div><div className="col-md-4"><label className="form-label">CUIT / documento</label><input className="form-control" value={supplierForm.taxId} onChange={(event) => setSupplierForm((current) => ({ ...current, taxId: event.target.value }))} /></div><div className="col-md-4"><label className="form-label">Rubro</label><select className="form-select" value={supplierForm.category} onChange={(event) => setSupplierForm((current) => ({ ...current, category: event.target.value }))}>{CONSORTIUM_SUPPLIER_CATEGORIES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></div><div className="col-md-4"><label className="form-label">Email</label><input className="form-control" type="email" value={supplierForm.email} onChange={(event) => setSupplierForm((current) => ({ ...current, email: event.target.value }))} /></div><div className="col-md-4"><label className="form-label">Teléfono</label><input className="form-control" value={supplierForm.phone} onChange={(event) => setSupplierForm((current) => ({ ...current, phone: event.target.value }))} /></div><div className="col-md-6"><label className="form-label">Domicilio</label><input className="form-control" value={supplierForm.address} onChange={(event) => setSupplierForm((current) => ({ ...current, address: event.target.value }))} /></div><div className="col-md-6"><label className="form-label">CBU / alias</label><input className="form-control" value={supplierForm.bankAccount} onChange={(event) => setSupplierForm((current) => ({ ...current, bankAccount: event.target.value }))} /></div><div className="col-12"><label className="form-label">Notas</label><input className="form-control" value={supplierForm.notes} onChange={(event) => setSupplierForm((current) => ({ ...current, notes: event.target.value }))} /></div><div className="col-12 d-flex justify-content-end gap-2"><button className="btn btn-outline-secondary" type="button" onClick={() => { setShowSupplierForm(false); setPendingPayableDraft(null); }}>Cancelar</button><button className="btn btn-primary" disabled={operation === "supplier"} type="submit">{operation === "supplier" ? "Guardando..." : editingSupplierId ? "Guardar cambios" : pendingPayableDraft ? "Crear y continuar" : "Crear proveedor"}</button></div></div>
            </form>}
            <div className="table-responsive"><table className="table table-hover align-middle"><thead><tr><th>Proveedor</th><th>Rubro</th><th>Contacto</th><th>Datos de pago</th><th>Estado</th><th className="text-end">Acciones</th></tr></thead><tbody>{suppliers.map((supplier) => <tr key={supplier.id}><td><strong>{supplier.name}</strong><small className="d-block text-muted">{supplier.legalName || supplier.taxId || "Sin datos fiscales"}</small></td><td>{getConsortiumSupplierCategory(supplier.category).label}</td><td>{supplier.email || supplier.phone || "—"}</td><td>{supplier.bankAccount || "—"}</td><td><span className={`badge ${supplier.active !== false ? "text-bg-success" : "text-bg-secondary"}`}>{supplier.active !== false ? "Activo" : "Archivado"}</span></td><td className="text-end">{canManage && supplier.active !== false && <div className="btn-group btn-group-sm"><button className="btn btn-outline-secondary" type="button" onClick={() => editSupplier(supplier)}>Editar</button><button className="btn btn-outline-danger" disabled={operation === `archive-supplier-${supplier.id}`} type="button" onClick={() => archiveSupplier(supplier)}>Archivar</button></div>}</td></tr>)}{!suppliers.length && <tr><td className="text-center text-muted py-4" colSpan="6">Todavía no hay proveedores cargados.</td></tr>}</tbody></table></div>
          </div>}

          {activeView === "obligations" && <div>
            <div className="d-flex justify-content-between align-items-center gap-2 mb-3"><div><h3 className="h6 mb-1">Cuentas a pagar</h3><small className="text-muted">Vinculá un gasto liquidado o registrá una obligación independiente.</small></div>{canManage && <button className="btn btn-sm btn-outline-primary" disabled={!activeSuppliers.length} type="button" onClick={openNewObligation}>Nueva obligación</button>}</div>
            {canManage && !activeSuppliers.length && <div className="alert alert-info small">Primero cargá al menos un proveedor desde la pestaña Proveedores.</div>}
            {canManage && showObligationForm && <form ref={obligationFormRef} className="rounded border bg-light p-3 mb-4" onSubmit={submitObligation}>
              <div className="row g-3"><div className="col-md-4"><label className="form-label">Proveedor *</label><select className="form-select" value={obligationForm.supplierId} onChange={(event) => setObligationForm((current) => ({ ...current, supplierId: event.target.value }))} required><option value="">Seleccionar...</option>{activeSuppliers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div><div className="col-md-8"><label className="form-label">Gasto de una liquidación</label><select className="form-select" disabled={Boolean(obligationForm.expenseDocumentId)} value={obligationForm.expenseLink} onChange={(event) => selectExpense(event.target.value)}><option value="">Obligación independiente</option>{availableExpenses.map((item) => <option key={item.link} value={item.link} disabled={item.linked && item.link !== obligationForm.expenseLink}>{item.periodKey} · {item.concept}{item.linked && item.link !== obligationForm.expenseLink ? " · ya vinculado" : ""}</option>)}</select></div><div className="col-md-6"><label className="form-label">Concepto *</label><input className="form-control" value={obligationForm.concept} onChange={(event) => setObligationForm((current) => ({ ...current, concept: event.target.value }))} required /></div><div className="col-md-3"><label className="form-label">Tipo de comprobante</label><select className="form-select" value={obligationForm.voucherType} onChange={(event) => setObligationForm((current) => ({ ...current, voucherType: event.target.value }))}>{Object.entries(voucherLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></div><div className="col-md-3"><label className="form-label">Número</label><input className="form-control" value={obligationForm.voucherNumber} onChange={(event) => setObligationForm((current) => ({ ...current, voucherNumber: event.target.value }))} /></div><div className="col-md-3"><label className="form-label">Fecha *</label><input className="form-control" type="date" value={obligationForm.issueDate} onChange={(event) => setObligationForm((current) => ({ ...current, issueDate: event.target.value }))} required /></div><div className="col-md-3"><label className="form-label">Vencimiento *</label><input className="form-control" type="date" value={obligationForm.dueDate} onChange={(event) => setObligationForm((current) => ({ ...current, dueDate: event.target.value }))} required /></div><div className="col-md-3"><label className="form-label">Importe *</label><input className="form-control" inputMode="decimal" value={obligationForm.amountMajor} onChange={(event) => setObligationForm((current) => ({ ...current, amountMajor: event.target.value }))} required /></div><div className="col-md-3"><label className="form-label">Moneda</label><input className="form-control" value={obligationForm.currency} readOnly /></div>{!editingObligationId && obligationForm.expenseDocumentId && <div className="col-md-6"><div className="alert alert-success py-2 mb-0"><strong>Comprobante vinculado.</strong><small className="d-block">Se reutilizará el archivo ya archivado en la liquidación.</small></div></div>}{!editingObligationId && !obligationForm.expenseDocumentId && <div className="col-md-6"><label className="form-label">Comprobante adjunto</label><input className="form-control" type="file" accept={CONSORTIUM_DOCUMENT_ACCEPT} onChange={(event) => setObligationForm((current) => ({ ...current, file: event.target.files?.[0] || null }))} /></div>}<div className={editingObligationId ? "col-12" : "col-md-6"}><label className="form-label">Notas</label><input className="form-control" value={obligationForm.notes} onChange={(event) => setObligationForm((current) => ({ ...current, notes: event.target.value }))} /></div><div className="col-12 d-flex justify-content-end gap-2"><button className="btn btn-outline-secondary" type="button" onClick={() => setShowObligationForm(false)}>Cancelar</button><button className="btn btn-primary" disabled={operation === "obligation"} type="submit">{operation === "obligation" ? "Guardando..." : editingObligationId ? "Guardar cambios" : "Registrar obligación"}</button></div></div>
            </form>}
            <div className="row g-2 align-items-end mb-3"><div className="col-md-5"><label className="form-label small">Buscar</label><input className="form-control form-control-sm" placeholder="Proveedor, CUIT, concepto o comprobante" value={obligationSearch} onChange={(event) => setObligationSearch(event.target.value)} /></div><div className="col-md-3"><label className="form-label small">Estado</label><select className="form-select form-select-sm" value={obligationStatusFilter} onChange={(event) => setObligationStatusFilter(event.target.value)}><option value="open">Pendientes de pago</option><option value="overdue">Vencidas</option><option value="partial">Con pago parcial</option><option value="paid">Pagadas</option><option value="voided">Anuladas</option><option value="all">Todas</option></select></div><div className="col-md-2"><button className="btn btn-sm btn-outline-secondary w-100" disabled={!visibleObligations.length} type="button" onClick={exportObligations}>Exportar CSV</button></div><div className="col-md-2 text-md-end"><small className="text-muted">{visibleObligations.length} de {obligations.length}</small></div></div>
            {canManage && obligations.some((item) => item.voided !== true && Number(item.balanceMinor || 0) > 0) && !activeAccounts.length && <div className="alert alert-warning small">Para registrar pagos, creá primero una caja o cuenta bancaria desde la pestaña Tesorería.</div>}
            <div className="rounded border bg-light p-3 mb-3">
              <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
                <div><h4 className="h6 mb-0">Agenda de pagos</h4><small className="text-muted">Programar y autorizar no mueve fondos. El egreso se registra recién al confirmar el pago.</small></div>
                <div className="text-end"><strong>{paymentAgenda.length}</strong><small className="d-block text-muted">{formatConsortiumMoney(paymentAgendaMinor, currency)} {paymentAgenda.length === 1 ? "programado" : "programados"}</small></div>
              </div>
              {paymentAgenda.length ? <>
                <div className="d-grid gap-2 d-md-none">{paymentAgenda.map(({ obligation, plan, meta }) => <article className="rounded border bg-white p-3" key={`agenda-mobile-${obligation.id}`}><div className="d-flex justify-content-between align-items-start gap-2"><div><strong className="d-block">{obligation.supplierSnapshot?.name || "Proveedor"}</strong><small className="text-muted">{obligation.concept}</small></div><span className={`badge ${meta.badge}`}>{meta.label}</span></div><div className="row g-2 mt-2 small"><div className="col-6"><span className="text-muted d-block">Fecha</span>{formatDate(plan.scheduledDate)}</div><div className="col-6"><span className="text-muted d-block">Cuenta</span>{plan.accountSnapshot?.name || "Cuenta"}</div><div className="col-12"><span className="text-muted d-block">Importe pendiente</span><strong className="consortium-money">{formatConsortiumMoney(plan.remainingMinor ?? plan.amountMinor, obligation.currency)}</strong></div></div></article>)}</div>
                <div className="table-responsive d-none d-md-block"><table className="table table-sm align-middle mb-0"><thead><tr><th>Fecha</th><th>Proveedor</th><th>Cuenta</th><th>Importe pendiente</th><th>Autorización</th></tr></thead><tbody>{paymentAgenda.map(({ obligation, plan, meta }) => <tr key={`agenda-${obligation.id}`}><td>{formatDate(plan.scheduledDate)}</td><td>{obligation.supplierSnapshot?.name || "Proveedor"}<small className="d-block text-muted">{obligation.concept}</small></td><td>{plan.accountSnapshot?.name || "Cuenta"}</td><td className="consortium-money">{formatConsortiumMoney(plan.remainingMinor ?? plan.amountMinor, obligation.currency)}</td><td><span className={`badge ${meta.badge}`}>{meta.label}</span></td></tr>)}</tbody></table></div>
              </> : <div className="text-muted small">Todavía no hay pagos programados. Podés crear uno desde la acción Programar de cada obligación.</div>}
            </div>
            {canManage && paymentPlanForm.obligationId && <form ref={paymentPlanFormRef} className="rounded border border-primary bg-primary-subtle p-3 mb-3" onSubmit={submitPaymentPlan}>
              <div className="d-flex justify-content-between align-items-center mb-3"><div><h4 className="h6 mb-0">Programar pago a proveedor</h4><small className="text-muted">{selectedPaymentPlanObligation?.supplierSnapshot?.name || "Proveedor"} · {selectedPaymentPlanObligation?.concept || "Obligación"}. Requiere autorización posterior.</small></div><button className="btn btn-sm btn-link" type="button" onClick={() => setPaymentPlanForm(emptyPaymentPlanForm())}>Cancelar</button></div>
              <div className="row g-3">
                <div className="col-md-3"><label className="form-label">Cuenta prevista *</label><select className="form-select" value={paymentPlanForm.accountId} onChange={(event) => setPaymentPlanForm((current) => ({ ...current, accountId: event.target.value }))} required><option value="">Seleccionar...</option>{paymentPlanAccounts.map((item) => <option key={item.id} value={item.id}>{item.name} · {formatConsortiumMoney(item.currentBalanceMinor, item.currency)}</option>)}</select></div>
                <div className="col-md-2"><label className="form-label">Importe *</label><input className="form-control" inputMode="decimal" value={paymentPlanForm.amountMajor} onChange={(event) => setPaymentPlanForm((current) => ({ ...current, amountMajor: event.target.value }))} required /></div>
                <div className="col-md-2"><label className="form-label">Fecha prevista *</label><input className="form-control" type="date" min={todayKey()} value={paymentPlanForm.scheduledDate} onChange={(event) => setPaymentPlanForm((current) => ({ ...current, scheduledDate: event.target.value }))} required /></div>
                <div className="col-md-2"><label className="form-label">Medio</label><select className="form-select" value={paymentPlanForm.method} onChange={(event) => setPaymentPlanForm((current) => ({ ...current, method: event.target.value }))}>{CONSORTIUM_PAYMENT_METHODS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></div>
                <div className="col-md-3"><label className="form-label">Referencia</label><input className="form-control" value={paymentPlanForm.reference} onChange={(event) => setPaymentPlanForm((current) => ({ ...current, reference: event.target.value }))} /></div>
                <div className="col-md-9"><label className="form-label">Notas</label><input className="form-control" value={paymentPlanForm.notes} onChange={(event) => setPaymentPlanForm((current) => ({ ...current, notes: event.target.value }))} /></div>
                <div className="col-md-3 d-flex align-items-end"><button className="btn btn-primary w-100" disabled={operation === "payment-plan"} type="submit">{operation === "payment-plan" ? "Programando..." : "Guardar en agenda"}</button></div>
              </div>
            </form>}
            <div className="table-responsive">
              <table className="table table-hover align-middle">
                <thead><tr><th>Proveedor / concepto</th><th>Comprobante</th><th>Vencimiento</th><th>Total</th><th>Pagado</th><th>Saldo</th><th>Agenda</th><th>Estado</th><th className="text-end">Acciones</th></tr></thead>
                <tbody>
                  {visibleObligations.map((obligation) => {
                    const status = getConsortiumSupplierObligationStatus(obligation);
                    const state = getConsortiumSupplierObligationState(status);
                    const planMeta = getConsortiumSupplierPaymentPlanMeta(obligation);
                    const plan = obligation.paymentPlan || {};
                    const hasBalance = Number(obligation.balanceMinor || 0) > 0;
                    const canExecutePlan = ["authorized", "partial"].includes(plan.status);
                    return (
                      <tr className={obligation.voided ? "text-muted" : ""} key={obligation.id}>
                        <td><strong>{obligation.supplierSnapshot?.name || "Proveedor"}</strong><small className="d-block text-muted">{obligation.concept}</small>{obligation.periodKey && <small className="d-block text-primary">Liquidación {obligation.periodKey}</small>}</td>
                        <td>{voucherLabels[obligation.voucherType] || "Comprobante"}<small className="d-block text-muted">{obligation.voucherNumber || "Sin número"}</small></td>
                        <td>{formatDate(obligation.dueDate)}</td>
                        <td className="consortium-money">{formatConsortiumMoney(obligation.amountMinor, obligation.currency)}</td>
                        <td className="consortium-money">{formatConsortiumMoney(obligation.paidAmountMinor, obligation.currency)}</td>
                        <td className="consortium-money fw-semibold">{formatConsortiumMoney(obligation.balanceMinor, obligation.currency)}</td>
                        <td>{planMeta ? <><span className={`badge ${planMeta.badge}`}>{planMeta.label}</span><small className="d-block text-muted mt-1">{formatDate(plan.scheduledDate)} · {formatConsortiumMoney(plan.remainingMinor ?? plan.amountMinor, obligation.currency)}</small></> : <span className="text-muted small">Sin programar</span>}</td>
                        <td><span className={`badge ${state.badge}`}>{state.label}</span></td>
                        <td className="text-end">
                          <div className="d-flex flex-wrap justify-content-end gap-1">
                            {obligation.documentStoragePath && <button className="btn btn-sm btn-outline-secondary" type="button" onClick={() => downloadDocument(obligation.documentStoragePath, obligation.documentFileName)}>Comprobante</button>}
                            {canManage && !obligation.voided && Number(obligation.paidAmountMinor || 0) === 0 && !planMeta && <button className="btn btn-sm btn-outline-secondary" type="button" onClick={() => editObligation(obligation)}>Editar</button>}
                            {canManage && !obligation.voided && hasBalance && <button className="btn btn-sm btn-outline-primary" disabled={!activeAccounts.length} type="button" onClick={() => openPaymentPlan(obligation)}>{planMeta ? "Reprogramar" : "Programar"}</button>}
                            {canManage && plan.status === "scheduled" && <button className="btn btn-sm btn-primary" disabled={operation === `authorize-payment-plan-${obligation.id}`} type="button" onClick={() => authorizePaymentPlan(obligation)}>Autorizar</button>}
                            {canManage && !obligation.voided && hasBalance && plan.status !== "scheduled" && <button className="btn btn-sm btn-outline-success" disabled={!activeAccounts.length} type="button" onClick={() => startPayment(obligation)}>{canExecutePlan ? "Registrar pago" : "Pagar ahora"}</button>}
                            {canManage && planMeta && <button className="btn btn-sm btn-outline-danger" disabled={operation === `cancel-payment-plan-${obligation.id}`} type="button" onClick={() => cancelPaymentPlan(obligation)}>Cancelar agenda</button>}
                            {canManage && !obligation.voided && Number(obligation.paidAmountMinor || 0) === 0 && !planMeta && <button className="btn btn-sm btn-outline-danger" type="button" onClick={() => voidObligation(obligation)}>Anular</button>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {!visibleObligations.length && <tr><td className="text-center text-muted py-4" colSpan="9">{obligations.length ? "No hay obligaciones que coincidan con los filtros." : "Todavía no hay obligaciones a proveedores."}</td></tr>}
                </tbody>
              </table>
            </div>
            {canManage && paymentForm.obligationId && <form ref={paymentFormRef} className="rounded border border-success bg-success-subtle p-3 mt-3" onSubmit={submitPayment}>
              <div className="d-flex justify-content-between align-items-center mb-3"><div><h4 className="h6 mb-0">Registrar pago a proveedor</h4><small className="text-muted">{selectedPaymentObligation?.supplierSnapshot?.name || "Proveedor"} · Esta confirmación sí descontará fondos de la cuenta.</small></div><button className="btn btn-sm btn-link" type="button" onClick={() => setPaymentForm(emptyPaymentForm())}>Cancelar</button></div>
              <div className="row g-3">
                <div className="col-md-3"><label className="form-label">Cuenta de origen *</label><select className="form-select" value={paymentForm.accountId} onChange={(event) => setPaymentForm((current) => ({ ...current, accountId: event.target.value }))} required><option value="">Seleccionar...</option>{paymentAccounts.map((item) => <option key={item.id} value={item.id}>{item.name} · {formatConsortiumMoney(item.currentBalanceMinor, item.currency)}</option>)}</select></div>
                <div className="col-md-2"><label className="form-label">Importe *</label><input className="form-control" inputMode="decimal" value={paymentForm.amountMajor} onChange={(event) => setPaymentForm((current) => ({ ...current, amountMajor: event.target.value }))} required /></div>
                <div className="col-md-2"><label className="form-label">Fecha *</label><input className="form-control" type="date" max={todayKey()} value={paymentForm.date} onChange={(event) => setPaymentForm((current) => ({ ...current, date: event.target.value }))} required /></div>
                <div className="col-md-2"><label className="form-label">Medio</label><select className="form-select" value={paymentForm.method} onChange={(event) => setPaymentForm((current) => ({ ...current, method: event.target.value }))}>{CONSORTIUM_PAYMENT_METHODS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></div>
                <div className="col-md-3"><label className="form-label">Referencia</label><input className="form-control" value={paymentForm.reference} onChange={(event) => setPaymentForm((current) => ({ ...current, reference: event.target.value }))} /></div>
                <div className="col-md-6"><label className="form-label">Comprobante de pago</label><input className="form-control" type="file" accept={CONSORTIUM_DOCUMENT_ACCEPT} onChange={(event) => setPaymentForm((current) => ({ ...current, file: event.target.files?.[0] || null }))} /></div>
                <div className="col-md-4"><label className="form-label">Notas</label><input className="form-control" value={paymentForm.notes} onChange={(event) => setPaymentForm((current) => ({ ...current, notes: event.target.value }))} /></div>
                <div className="col-md-2 d-flex align-items-end"><button className="btn btn-success w-100" disabled={operation === "payment"} type="submit">{operation === "payment" ? "Registrando..." : "Confirmar egreso"}</button></div>
              </div>
            </form>}
          </div>}

          {activeView === "treasury" && <div>
            <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-3">
              <div><h3 className="h6 mb-1">Cajas y cuentas bancarias</h3><small className="text-muted">El saldo cambia únicamente mediante movimientos registrados.</small></div>
              <div className="d-flex flex-wrap gap-2">
                <Link className="btn btn-sm btn-outline-dark" to={`/admin/consorcios/${consortiumId}/estado-economico`}>Estado económico</Link>
                <Link className="btn btn-sm btn-outline-success" to={`/admin/consorcios/${consortiumId}/conciliacion-bancaria`}>Conciliación asistida</Link>
                {canManage && <><button className="btn btn-sm btn-outline-primary" disabled={!activeAccounts.length} type="button" onClick={() => openTreasuryAction("movement")}>Nuevo movimiento</button><button className="btn btn-sm btn-outline-primary" disabled={activeAccounts.length < 2} type="button" onClick={() => openTreasuryAction("transfer")}>Transferir</button><button className="btn btn-sm btn-outline-primary" disabled={!activeAccounts.length} type="button" onClick={() => openTreasuryAction("reconciliation")}>Conciliar</button><button className="btn btn-sm btn-primary" type="button" onClick={openNewAccount}>Nueva cuenta</button></>}
              </div>
            </div>

            {canManage && showAccountForm && <form ref={accountFormRef} className="rounded border bg-light p-3 mb-4" onSubmit={submitAccount}><div className="row g-3"><div className="col-md-4"><label className="form-label">Nombre *</label><input className="form-control" placeholder="Ej. Banco Nación CC" value={accountForm.name} onChange={(event) => setAccountForm((current) => ({ ...current, name: event.target.value }))} required /></div><div className="col-md-3"><label className="form-label">Tipo</label><select className="form-select" value={accountForm.type} onChange={(event) => setAccountForm((current) => ({ ...current, type: event.target.value }))}>{CONSORTIUM_TREASURY_ACCOUNT_TYPES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></div><div className="col-md-2"><label className="form-label">Moneda</label><input className="form-control" value={accountForm.currency} readOnly /></div><div className="col-md-3"><label className="form-label">Saldo inicial</label><input className="form-control" inputMode="decimal" placeholder="0,00" value={accountForm.openingBalanceMajor} onChange={(event) => setAccountForm((current) => ({ ...current, openingBalanceMajor: event.target.value }))} /></div><div className="col-md-9"><label className="form-label">Notas</label><input className="form-control" value={accountForm.notes} onChange={(event) => setAccountForm((current) => ({ ...current, notes: event.target.value }))} /></div><div className="col-md-3 d-flex align-items-end"><button className="btn btn-primary w-100" disabled={operation === "account"} type="submit">Crear cuenta</button></div></div></form>}

            {canManage && treasuryAction === "movement" && <form ref={treasuryActionFormRef} className="rounded border bg-light p-3 mb-4" onSubmit={submitMovement}><div className="d-flex justify-content-between mb-3"><div><h4 className="h6 mb-0">Movimiento manual</h4><small className="text-muted">Usalo para ingresos o egresos que no provengan de expensas ni pagos a proveedores.</small></div><button className="btn-close" type="button" aria-label="Cerrar" onClick={() => setTreasuryAction("")} /></div><div className="row g-3"><div className="col-md-4"><label className="form-label">Cuenta *</label><select className="form-select" value={movementForm.accountId} onChange={(event) => setMovementForm((current) => ({ ...current, accountId: event.target.value }))} required><option value="">Seleccionar...</option>{activeAccounts.map((account) => <option key={account.id} value={account.id}>{account.name} · {formatConsortiumMoney(account.currentBalanceMinor, account.currency)}</option>)}</select></div><div className="col-md-2"><label className="form-label">Tipo</label><select className="form-select" value={movementForm.direction} onChange={(event) => setMovementForm((current) => ({ ...current, direction: event.target.value }))}><option value="inflow">Ingreso</option><option value="outflow">Egreso</option></select></div><div className="col-md-3"><label className="form-label">Importe *</label><input className="form-control" inputMode="decimal" value={movementForm.amountMajor} onChange={(event) => setMovementForm((current) => ({ ...current, amountMajor: event.target.value }))} required /></div><div className="col-md-3"><label className="form-label">Fecha *</label><input className="form-control" type="date" max={todayKey()} value={movementForm.date} onChange={(event) => setMovementForm((current) => ({ ...current, date: event.target.value }))} required /></div><div className="col-md-6"><label className="form-label">Concepto *</label><input className="form-control" value={movementForm.concept} onChange={(event) => setMovementForm((current) => ({ ...current, concept: event.target.value }))} required /></div><div className="col-md-6"><label className="form-label">Referencia</label><input className="form-control" value={movementForm.reference} onChange={(event) => setMovementForm((current) => ({ ...current, reference: event.target.value }))} /></div><div className="col-md-8"><label className="form-label">Motivo y respaldo *</label><textarea className="form-control" rows="2" value={movementForm.reason} onChange={(event) => setMovementForm((current) => ({ ...current, reason: event.target.value }))} required /></div><div className="col-md-4"><label className="form-label">Comprobante</label><input className="form-control" type="file" accept={CONSORTIUM_DOCUMENT_ACCEPT} onChange={(event) => setMovementForm((current) => ({ ...current, file: event.target.files?.[0] || null }))} /></div><div className="col-12 text-end"><button className="btn btn-primary" disabled={operation === "manual-movement"} type="submit">{operation === "manual-movement" ? "Registrando..." : "Registrar movimiento"}</button></div></div></form>}

            {canManage && treasuryAction === "transfer" && <form ref={treasuryActionFormRef} className="rounded border bg-light p-3 mb-4" onSubmit={submitTransfer}><div className="d-flex justify-content-between mb-3"><div><h4 className="h6 mb-0">Transferencia entre cuentas</h4><small className="text-muted">Genera un egreso y un ingreso vinculados; los fondos totales no cambian.</small></div><button className="btn-close" type="button" aria-label="Cerrar" onClick={() => setTreasuryAction("")} /></div><div className="row g-3"><div className="col-md-4"><label className="form-label">Cuenta de origen *</label><select className="form-select" value={transferForm.fromAccountId} onChange={(event) => setTransferForm((current) => ({ ...current, fromAccountId: event.target.value }))} required><option value="">Seleccionar...</option>{activeAccounts.map((account) => <option key={account.id} value={account.id}>{account.name} · {formatConsortiumMoney(account.currentBalanceMinor, account.currency)}</option>)}</select></div><div className="col-md-4"><label className="form-label">Cuenta de destino *</label><select className="form-select" value={transferForm.toAccountId} onChange={(event) => setTransferForm((current) => ({ ...current, toAccountId: event.target.value }))} required><option value="">Seleccionar...</option>{activeAccounts.filter((account) => account.id !== transferForm.fromAccountId).map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></div><div className="col-md-2"><label className="form-label">Importe *</label><input className="form-control" inputMode="decimal" value={transferForm.amountMajor} onChange={(event) => setTransferForm((current) => ({ ...current, amountMajor: event.target.value }))} required /></div><div className="col-md-2"><label className="form-label">Fecha *</label><input className="form-control" type="date" max={todayKey()} value={transferForm.date} onChange={(event) => setTransferForm((current) => ({ ...current, date: event.target.value }))} required /></div><div className="col-md-6"><label className="form-label">Referencia</label><input className="form-control" value={transferForm.reference} onChange={(event) => setTransferForm((current) => ({ ...current, reference: event.target.value }))} /></div><div className="col-md-6"><label className="form-label">Observaciones</label><input className="form-control" value={transferForm.notes} onChange={(event) => setTransferForm((current) => ({ ...current, notes: event.target.value }))} /></div><div className="col-12 text-end"><button className="btn btn-primary" disabled={operation === "transfer"} type="submit">{operation === "transfer" ? "Transfiriendo..." : "Confirmar transferencia"}</button></div></div></form>}

            {canManage && treasuryAction === "reconciliation" && <form ref={treasuryActionFormRef} className="rounded border bg-light p-3 mb-4" onSubmit={submitReconciliation}><div className="d-flex justify-content-between mb-3"><div><h4 className="h6 mb-0">Conciliación de saldo</h4><small className="text-muted">Compará el saldo del extracto o arqueo con el saldo reconstruido por movimientos.</small></div><button className="btn-close" type="button" aria-label="Cerrar" onClick={() => setTreasuryAction("")} /></div><div className="row g-3"><div className="col-md-4"><label className="form-label">Cuenta *</label><select className="form-select" value={reconciliationForm.accountId} onChange={(event) => setReconciliationForm((current) => ({ ...current, accountId: event.target.value }))} required><option value="">Seleccionar...</option>{activeAccounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></div><div className="col-md-3"><label className="form-label">Fecha del extracto / arqueo *</label><input className="form-control" type="date" max={todayKey()} value={reconciliationForm.statementDate} onChange={(event) => setReconciliationForm((current) => ({ ...current, statementDate: event.target.value }))} required /></div><div className="col-md-3"><label className="form-label">Saldo informado *</label><input className="form-control" inputMode="decimal" value={reconciliationForm.statementBalanceMajor} onChange={(event) => setReconciliationForm((current) => ({ ...current, statementBalanceMajor: event.target.value }))} required /></div><div className="col-md-2"><label className="form-label">Diferencia</label><div className={`form-control bg-white consortium-money ${reconciliationDifference === null ? "text-muted" : reconciliationDifference === 0 ? "text-success" : "text-danger"}`}>{reconciliationDifference === null ? "—" : formatConsortiumMoney(reconciliationDifference, currency)}</div></div><div className="col-md-4"><small className="text-muted d-block">Saldo según sistema</small><strong className="consortium-money">{formatConsortiumMoney(reconciliationBookBalance, currency)}</strong></div><div className="col-md-4"><label className="form-label">Extracto o arqueo</label><input className="form-control" type="file" accept={CONSORTIUM_DOCUMENT_ACCEPT} onChange={(event) => setReconciliationForm((current) => ({ ...current, file: event.target.files?.[0] || null }))} /></div><div className="col-md-4"><label className="form-label">Observaciones</label><input className="form-control" value={reconciliationForm.notes} onChange={(event) => setReconciliationForm((current) => ({ ...current, notes: event.target.value }))} /></div><div className="col-12"><div className={`alert py-2 mb-0 ${reconciliationDifference === null ? "alert-info" : reconciliationDifference === 0 ? "alert-success" : "alert-warning"}`}>{reconciliationDifference === null ? "Ingresá el saldo informado para calcular la diferencia." : reconciliationDifference === 0 ? "Los saldos coinciden." : "La diferencia quedará registrada. Corregila mediante un movimiento con su correspondiente justificación."}</div></div><div className="col-12 text-end"><button className="btn btn-primary" disabled={!reconciliationForm.accountId || !reconciliationForm.statementDate || !hasReconciliationBalance || operation === "reconciliation"} type="submit">{operation === "reconciliation" ? "Guardando..." : "Guardar control"}</button></div></div></form>}

            <div className="row g-3 mb-4">{accounts.map((account) => <div className="col-md-6 col-xl-4" key={account.id}><div className={`rounded border p-3 h-100 ${account.active === false ? "bg-light text-muted" : ""}`}><div className="d-flex justify-content-between gap-2"><div><strong>{account.name}</strong><small className="d-block text-muted">{getConsortiumTreasuryAccountType(account.type).label}</small></div><span className={`badge ${account.active !== false ? "text-bg-success" : "text-bg-secondary"}`}>{account.active !== false ? "Activa" : "Archivada"}</span></div><strong className="consortium-money fs-5 d-block mt-3">{formatConsortiumMoney(account.currentBalanceMinor, account.currency)}</strong>{canManage && account.active !== false && <button className="btn btn-sm btn-link text-danger px-0 mt-2" disabled={operation === `archive-account-${account.id}`} type="button" onClick={() => archiveAccount(account)}>Archivar cuenta</button>}</div></div>)}{!accounts.length && <div className="col-12"><div className="text-center text-muted border rounded py-4">Creá una caja o cuenta bancaria para comenzar a registrar pagos.</div></div>}</div>

            <h3 className="h6">Últimos movimientos</h3>
            <div className="table-responsive mb-4"><table className="table table-sm align-middle"><thead><tr><th>Fecha</th><th>Cuenta</th><th>Origen</th><th>Concepto</th><th>Referencia</th><th className="text-end">Ingreso</th><th className="text-end">Egreso</th><th className="text-end">Respaldo</th></tr></thead><tbody>{movements.slice(0, 50).map((movement) => <tr key={movement.id}><td>{formatDate(movement.date)}</td><td>{movement.accountSnapshot?.name || "Cuenta"}</td><td><small>{movementSourceLabels[movement.source] || movement.source || "Movimiento"}</small></td><td>{movement.concept}</td><td>{movement.reference || "—"}</td><td className="text-end consortium-money text-success">{movement.direction === "inflow" ? formatConsortiumMoney(movement.amountMinor, movement.currency) : "—"}</td><td className="text-end consortium-money text-danger">{movement.direction === "outflow" ? formatConsortiumMoney(movement.amountMinor, movement.currency) : "—"}</td><td className="text-end">{movement.evidenceStoragePath ? <button className="btn btn-sm btn-outline-secondary" type="button" onClick={() => downloadDocument(movement.evidenceStoragePath, movement.evidenceFileName)}>Ver</button> : "—"}</td></tr>)}{!movements.length && <tr><td className="text-center text-muted py-4" colSpan="8">Todavía no hay movimientos de tesorería.</td></tr>}</tbody></table></div>

            <h3 className="h6">Conciliaciones y controles de saldo</h3>
            <div className="table-responsive mb-4"><table className="table table-sm align-middle"><thead><tr><th>Fecha</th><th>Cuenta</th><th>Saldo informado</th><th>Saldo del sistema</th><th>Diferencia</th><th>Estado</th><th className="text-end">Acciones</th></tr></thead><tbody>{reconciliations.map((item) => <tr className={item.voided ? "text-muted" : ""} key={item.id}><td>{formatDate(item.statementDate)}</td><td>{item.accountSnapshot?.name || "Cuenta"}</td><td className="consortium-money">{formatConsortiumMoney(item.statementBalanceMinor, item.currency)}</td><td className="consortium-money">{formatConsortiumMoney(item.bookBalanceMinor, item.currency)}</td><td className={`consortium-money ${Number(item.differenceMinor || 0) === 0 ? "text-success" : "text-danger"}`}>{formatConsortiumMoney(item.differenceMinor, item.currency)}</td><td><span className={`badge ${item.voided ? "text-bg-secondary" : item.status === "matched" ? "text-bg-success" : "text-bg-warning"}`}>{item.voided ? "Anulada" : item.status === "matched" ? "Conciliada" : "Con diferencia"}</span></td><td className="text-end"><div className="btn-group btn-group-sm">{item.statementStoragePath && <button className="btn btn-outline-secondary" type="button" onClick={() => downloadDocument(item.statementStoragePath, item.statementFileName)}>Extracto</button>}{canManage && !item.voided && <button className="btn btn-outline-danger" disabled={operation === `void-reconciliation-${item.id}`} type="button" onClick={() => voidReconciliation(item)}>Anular</button>}</div></td></tr>)}{!reconciliations.length && <tr><td className="text-center text-muted py-4" colSpan="7">Todavía no hay conciliaciones registradas.</td></tr>}</tbody></table></div>

            <h3 className="h6">Pagos a proveedores</h3><div className="table-responsive"><table className="table table-sm align-middle"><thead><tr><th>Fecha</th><th>Proveedor</th><th>Cuenta</th><th>Referencia</th><th>Importe</th><th>Estado</th><th className="text-end">Acciones</th></tr></thead><tbody>{payments.map((payment) => <tr className={payment.voided ? "text-muted" : ""} key={payment.id}><td>{formatDate(payment.date)}</td><td>{payment.supplierSnapshot?.name || "Proveedor"}</td><td>{payment.accountSnapshot?.name || "Cuenta"}</td><td>{payment.reference || "—"}</td><td className="consortium-money">{formatConsortiumMoney(payment.amountMinor, payment.currency)}</td><td><span className={`badge ${payment.voided ? "text-bg-secondary" : "text-bg-success"}`}>{payment.voided ? "Anulado" : "Aplicado"}</span></td><td className="text-end"><div className="btn-group btn-group-sm">{payment.proofStoragePath && <button className="btn btn-outline-secondary" type="button" onClick={() => downloadDocument(payment.proofStoragePath, payment.proofFileName)}>Comprobante</button>}{canManage && !payment.voided && <button className="btn btn-outline-danger" disabled={operation === `void-payment-${payment.id}`} type="button" onClick={() => voidPayment(payment)}>Anular</button>}</div></td></tr>)}{!payments.length && <tr><td className="text-center text-muted py-4" colSpan="7">Todavía no hay pagos a proveedores.</td></tr>}</tbody></table></div>
          </div>}
        </>}
      </div>
    </section>
  );
};

export default ConsortiumTreasuryPanel;
