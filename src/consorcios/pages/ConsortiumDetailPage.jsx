import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import SEO from "../../components/SEO";
import { useAuth } from "../../context/auth/useAuth";
import { useActiveInmobiliariaModules } from "../../inmobiliaria/hooks/useActiveInmobiliariaModules";
import ConsortiumExpenseDocumentsPanel from "../components/ConsortiumExpenseDocumentsPanel";
import ConsortiumCommunicationsPanel from "../components/ConsortiumCommunicationsPanel";
import ConsortiumPaymentReportsPanel from "../components/ConsortiumPaymentReportsPanel";
import ConsortiumPenaltiesPanel from "../components/ConsortiumPenaltiesPanel";
import ConsortiumTreasuryPanel from "../components/ConsortiumTreasuryPanel";
import ConsortiumClaimsPanel from "../components/ConsortiumClaimsPanel";
import ConsortiumPortalInformationPanel from "../components/ConsortiumPortalInformationPanel";
import ConsortiumMonthlyCloseAssistant from "../components/ConsortiumMonthlyCloseAssistant";
import ConsortiumMonthlyLiquidationAssistant from "../components/ConsortiumMonthlyLiquidationAssistant";
import ConsortiumUnitsCsvImport from "../components/ConsortiumUnitsCsvImport";
import {
  getInternalPermissions,
  getInternalRoleForInmobiliaria,
  isGlobalRoot,
} from "../../inmobiliaria/utils/inmobiliariaPermissions";
import {
  adjustConsortiumObligation,
  archiveConsortium,
  archiveConsortiumUnit,
  approveConsortiumPaymentReport,
  closeConsortiumPeriod,
  createConsortiumPeriod,
  createConsortiumUnit,
  createConsortiumUnitsBulk,
  getConsortiumById,
  getConsortiumExpenseDocuments,
  getConsortiumMonthlyCloseChecklist,
  getConsortiumObligations,
  getConsortiumPaymentReports,
  getConsortiumPeriods,
  getConsortiumUnits,
  issueConsortiumPeriod,
  recordConsortiumOpeningBalance,
  registerConsortiumPayment,
  rejectConsortiumPaymentReport,
  saveConsortiumRecurringExpenses,
  saveConsortiumPeriodExpenses,
  uploadConsortiumExpenseDocument,
  updateConsortiumUnit,
} from "../services/consorcio.service";
import {
  CONSORTIUM_DISTRIBUTION_MODES,
  CONSORTIUM_EXPENSE_CATEGORIES,
  CONSORTIUM_PAYMENT_METHODS,
  CONSORTIUM_UNIT_TYPES,
  getConsortiumPeriodStatus,
} from "../utils/consorcio.constants";
import {
  formatConsortiumMoney,
  addConsortiumDays,
  getConsortiumAccountingPeriodLabel,
  getConsortiumExpenseIdentity,
  getConsortiumObligationStatus,
  getConsortiumObligationStatusLabel,
  getConsortiumPaymentSchedule,
  getConsortiumScheduledAmountForDate,
  getDefaultConsortiumDueDate,
  majorToMinor,
  mergeConsortiumDraftExpenses,
  minorToMajorInput,
} from "../utils/consorcio.helpers";
import {
  createEmptyConsortiumExpense,
  createEmptyConsortiumUnit,
} from "../utils/consorcio.schema";
import { getConsortiumUnitNotificationRecipients } from "../utils/consorcioNotification.helpers";
import { buildConsortiumExpenseFromAiDraft } from "../utils/consorcioExpenseAi.helpers";
import "../consorcio.css";

const todayKey = () => new Date().toISOString().slice(0, 10);
const currentPeriodKey = () => todayKey().slice(0, 7);
const makeLocalId = () => globalThis.crypto?.randomUUID?.() || `expense_${Date.now()}_${Math.random()}`;
const emptyOpeningBalanceForm = () => ({
  unitId: "",
  type: "debit",
  amountMajor: "",
  effectiveDate: todayKey(),
  periodKey: currentPeriodKey(),
  dueDate: "",
  reason: "",
});
const emptyAdjustmentForm = () => ({
  obligationId: "",
  type: "debit",
  category: "ordinary",
  amountMajor: "",
  effectiveDate: todayKey(),
  reason: "",
});
const emptyUnitChangeForm = () => ({
  reason: "",
  ownerChangeKind: "replacement",
  ownerEffectiveDate: todayKey(),
  occupantChangeKind: "replacement",
  occupantEffectiveDate: todayKey(),
});
const normalizedIdentity = (value) => value?.toString?.().trim() || "";
const reminderDaysInput = (value) => (Array.isArray(value) ? value.join(", ") : value || "");

const ConsortiumDetailPage = () => {
  const { id: consortiumId = "" } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { activeInmobiliariaId, loading: agencyLoading } = useActiveInmobiliariaModules();
  const [consortium, setConsortium] = useState(null);
  const [units, setUnits] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [obligations, setObligations] = useState([]);
  const [expenseDocuments, setExpenseDocuments] = useState([]);
  const [paymentReports, setPaymentReports] = useState([]);
  const [treasuryAccounts, setTreasuryAccounts] = useState([]);
  const [consortiumSuppliers, setConsortiumSuppliers] = useState([]);
  const [supplierObligations, setSupplierObligations] = useState([]);
  const [treasuryRefreshKey, setTreasuryRefreshKey] = useState(0);
  const [payableRequest, setPayableRequest] = useState(null);
  const [selectedPeriodId, setSelectedPeriodId] = useState("");
  const [periodExpenses, setPeriodExpenses] = useState([]);
  const [draftExpensesDirty, setDraftExpensesDirty] = useState(false);
  const [unitForm, setUnitForm] = useState(createEmptyConsortiumUnit);
  const [editingUnitId, setEditingUnitId] = useState("");
  const [unitChangeForm, setUnitChangeForm] = useState(emptyUnitChangeForm);
  const [activeWorkspace, setActiveWorkspace] = useState("liquidations");
  const [showUnitForm, setShowUnitForm] = useState(false);
  const [showUnitImport, setShowUnitImport] = useState(false);
  const [showOpeningBalanceForm, setShowOpeningBalanceForm] = useState(false);
  const [showCloseAssistant, setShowCloseAssistant] = useState(false);
  const [closeAssistantLoading, setCloseAssistantLoading] = useState(false);
  const [closeChecklist, setCloseChecklist] = useState(null);
  const [closeAcknowledged, setCloseAcknowledged] = useState(false);
  const [closeNote, setCloseNote] = useState("");
  const [expenseForm, setExpenseForm] = useState(() => ({
    ...createEmptyConsortiumExpense(),
    amountMajor: "",
  }));
  const [editingExpenseId, setEditingExpenseId] = useState("");
  const [newPeriodKey, setNewPeriodKey] = useState(currentPeriodKey);
  const [newDueDate, setNewDueDate] = useState("");
  const [newEarlyPaymentDate, setNewEarlyPaymentDate] = useState("");
  const [newEarlyPaymentDiscountPercent, setNewEarlyPaymentDiscountPercent] = useState(0);
  const [newSecondDueDate, setNewSecondDueDate] = useState("");
  const [newSecondDueSurchargePercent, setNewSecondDueSurchargePercent] = useState(0);
  const [paymentForm, setPaymentForm] = useState({
    obligationId: "",
    amountMajor: "",
    date: todayKey(),
    method: "transfer",
    reference: "",
    notes: "",
    treasuryAccountId: "",
  });
  const [openingBalanceForm, setOpeningBalanceForm] = useState(emptyOpeningBalanceForm);
  const [adjustmentForm, setAdjustmentForm] = useState(emptyAdjustmentForm);
  const [penaltyRequest, setPenaltyRequest] = useState({ unitId: "", nonce: 0 });
  const [loading, setLoading] = useState(true);
  const [operation, setOperation] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [lastPaymentId, setLastPaymentId] = useState("");

  const canManage = useMemo(() => {
    const role = getInternalRoleForInmobiliaria(user, activeInmobiliariaId);
    return getInternalPermissions(role, isGlobalRoot(user)).canManageConsortiums;
  }, [activeInmobiliariaId, user]);

  const load = useCallback(async () => {
    if (!activeInmobiliariaId || !consortiumId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError("");
      const [
        consortiumData,
        unitData,
        periodData,
        obligationData,
        expenseDocumentData,
        paymentReportData,
      ] = await Promise.all([
        getConsortiumById(activeInmobiliariaId, consortiumId),
        getConsortiumUnits(activeInmobiliariaId, consortiumId),
        getConsortiumPeriods(activeInmobiliariaId, consortiumId),
        getConsortiumObligations(activeInmobiliariaId, { consortiumId }),
        getConsortiumExpenseDocuments(activeInmobiliariaId, { consortiumId }),
        getConsortiumPaymentReports(activeInmobiliariaId, { consortiumId }),
      ]);
      if (!consortiumData) throw new Error("El consorcio no existe.");
      setConsortium(consortiumData);
      setUnits(unitData);
      setPeriods(periodData);
      setObligations(obligationData);
      setExpenseDocuments(expenseDocumentData);
      setPaymentReports(paymentReportData);
      setSelectedPeriodId((current) => (
        current && periodData.some((item) => item.id === current)
          ? current
          : periodData[0]?.id || ""
      ));
    } catch (loadError) {
      setError(loadError.message || "No se pudo cargar el consorcio.");
    } finally {
      setLoading(false);
    }
  }, [activeInmobiliariaId, consortiumId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!consortium) return;
    const dueDate = getDefaultConsortiumDueDate(newPeriodKey, consortium.dueDay);
    const policy = consortium.paymentPolicy || {};
    setNewDueDate(dueDate);
    setNewEarlyPaymentDate(policy.earlyPaymentEnabled
      ? addConsortiumDays(dueDate, -Number(policy.earlyPaymentDaysBefore || 5)) : "");
    setNewEarlyPaymentDiscountPercent(policy.earlyPaymentEnabled
      ? Number(policy.earlyPaymentDiscountPercent || 0) : 0);
    setNewSecondDueDate(policy.secondDueEnabled
      ? addConsortiumDays(dueDate, Number(policy.secondDueDaysAfter || 10)) : "");
    setNewSecondDueSurchargePercent(policy.secondDueEnabled
      ? Number(policy.secondDueSurchargePercent || 0) : 0);
  }, [consortium, newPeriodKey]);

  useEffect(() => {
    if (!consortium || openingBalanceForm.type !== "debit") return;
    setOpeningBalanceForm((current) => ({
      ...current,
      dueDate: getDefaultConsortiumDueDate(current.periodKey, consortium.dueDay),
    }));
  }, [consortium, openingBalanceForm.periodKey, openingBalanceForm.type]);

  const selectedPeriod = useMemo(
    () => periods.find((item) => item.id === selectedPeriodId) || null,
    [periods, selectedPeriodId],
  );

  useEffect(() => {
    setPeriodExpenses(Array.isArray(selectedPeriod?.expenses) ? selectedPeriod.expenses : []);
    setDraftExpensesDirty(false);
    setEditingExpenseId("");
    setExpenseForm({ ...createEmptyConsortiumExpense(), amountMajor: "" });
    setPaymentForm((current) => ({ ...current, obligationId: "", amountMajor: "" }));
    setAdjustmentForm(emptyAdjustmentForm());
    setShowCloseAssistant(false);
    setCloseChecklist(null);
    setCloseAcknowledged(false);
    setCloseNote("");
  }, [selectedPeriod]);

  const previousMonthlyPeriod = useMemo(() => {
    if (!selectedPeriod?.periodKey) return null;
    return periods
      .filter((item) => (
        item.id !== selectedPeriod.id
        && !item.source
        && item.periodKey < selectedPeriod.periodKey
        && Array.isArray(item.expenses)
        && item.expenses.length > 0
      ))
      .sort((left, right) => (right.periodKey || "").localeCompare(left.periodKey || ""))[0] || null;
  }, [periods, selectedPeriod]);

  const recurringExpenses = useMemo(
    () => (Array.isArray(consortium?.recurringExpenses) ? consortium.recurringExpenses : [])
      .filter((item) => item.active !== false),
    [consortium],
  );

  const selectedObligations = useMemo(
    () => obligations.filter((item) => item.periodId === selectedPeriodId),
    [obligations, selectedPeriodId],
  );

  const selectedExpenseDocuments = useMemo(
    () => expenseDocuments.filter((item) => item.periodId === selectedPeriodId),
    [expenseDocuments, selectedPeriodId],
  );

  const activeUnits = useMemo(
    () => units.filter((item) => item.active !== false && item.deleted !== true),
    [units],
  );
  const editingOriginalUnit = useMemo(
    () => units.find((item) => item.id === editingUnitId) || null,
    [editingUnitId, units],
  );
  const ownerIdentityEdited = Boolean(editingOriginalUnit) && (
    normalizedIdentity(editingOriginalUnit.ownerName) !== normalizedIdentity(unitForm.ownerName)
    || normalizedIdentity(editingOriginalUnit.ownerTaxId) !== normalizedIdentity(unitForm.ownerTaxId)
  );
  const occupantIdentityEdited = Boolean(editingOriginalUnit)
    && normalizedIdentity(editingOriginalUnit.occupantName) !== normalizedIdentity(unitForm.occupantName);

  const totalCoefficient = useMemo(
    () => activeUnits.reduce((sum, unit) => sum + Number(unit.coefficient || 0), 0),
    [activeUnits],
  );

  const periodSummary = useMemo(() => ({
    total: selectedObligations.reduce((sum, item) => sum + Number(item.totalAmountMinor || 0), 0),
    paid: selectedObligations.reduce((sum, item) => sum + Number(item.paidAmountMinor || 0), 0),
    balance: selectedObligations.reduce((sum, item) => sum + Number(item.balanceMinor || 0), 0),
    overdue: selectedObligations.filter((item) => getConsortiumObligationStatus(item) === "overdue").length,
  }), [selectedObligations]);
  const paymentObligation = useMemo(
    () => obligations.find((item) => item.id === paymentForm.obligationId) || null,
    [obligations, paymentForm.obligationId],
  );
  const paymentSchedule = useMemo(() => paymentObligation
    ? getConsortiumPaymentSchedule({
      amountMinor: paymentObligation.baseAmountMinor ?? paymentObligation.totalAmountMinor,
      dueDate: paymentObligation.dueDate,
      earlyPaymentDate: paymentObligation.earlyPaymentDate,
      earlyPaymentDiscountPercent: paymentObligation.earlyPaymentDiscountPercent,
      secondDueDate: paymentObligation.secondDueDate,
      secondDueSurchargePercent: paymentObligation.secondDueSurchargePercent,
    }) : null, [paymentObligation]);

  const resetMessages = () => {
    setError("");
    setSuccess("");
    setLastPaymentId("");
  };

  const resetUnitForm = () => {
    setEditingUnitId("");
    setUnitForm({ ...createEmptyConsortiumUnit(), consortiumId });
    setUnitChangeForm(emptyUnitChangeForm());
  };

  const openNewUnitForm = () => {
    resetMessages();
    resetUnitForm();
    setActiveWorkspace("units");
    setShowUnitImport(false);
    setShowUnitForm(true);
    setTimeout(() => {
      document.getElementById("consortium-unit-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  };

  const openUnitImport = () => {
    resetMessages();
    closeUnitForm();
    setActiveWorkspace("units");
    setShowUnitImport(true);
    setTimeout(() => {
      document.getElementById("consortium-unit-import")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  };

  const importUnits = async (rows, migration) => {
    try {
      resetMessages();
      setOperation("import-units");
      const created = await createConsortiumUnitsBulk(
        activeInmobiliariaId,
        consortiumId,
        rows.map((item) => item.row),
      );
      let balancesApplied = 0;
      let balanceFailed = 0;
      const balanceFailures = [];
      for (let index = 0; index < created.length; index += 1) {
        const signedBalanceMajor = Number(rows[index]?.row?.openingBalanceMajor || 0);
        if (!signedBalanceMajor) continue;
        try {
          await recordConsortiumOpeningBalance({
            inmobiliariaId: activeInmobiliariaId,
            consortiumId,
            unitId: created[index].id,
            type: signedBalanceMajor > 0 ? "debit" : "credit",
            amountMinor: Math.round(Math.abs(signedBalanceMajor) * 100),
            effectiveDate: migration.effectiveDate,
            periodKey: migration.periodKey,
            dueDate: migration.dueDate,
            reason: migration.reason,
          });
          balancesApplied += 1;
        } catch (balanceError) {
          console.error("Saldo inicial no importado", {
            unitId: created[index].id,
            error: balanceError,
          });
          balanceFailed += 1;
          balanceFailures.push({
            code: created[index].code,
            error: balanceError.message || "No se pudo registrar el saldo.",
          });
        }
      }
      setSuccess(`${created.length} unidad(es) importada(s).${balanceFailed ? " Revisá los saldos que no pudieron incorporarse." : " El padrón quedó listo para continuar."}`);
      const [unitData, periodData, obligationData] = await Promise.all([
        getConsortiumUnits(activeInmobiliariaId, consortiumId),
        getConsortiumPeriods(activeInmobiliariaId, consortiumId),
        getConsortiumObligations(activeInmobiliariaId, { consortiumId }),
      ]);
      setUnits(unitData);
      setPeriods(periodData);
      setObligations(obligationData);
      setSelectedPeriodId((current) => (
        current && periodData.some((item) => item.id === current)
          ? current
          : periodData[0]?.id || ""
      ));
      return {
        created: created.length,
        balancesApplied,
        balanceFailed,
        balanceFailures,
      };
    } catch (importError) {
      setError(importError.message || "No se pudo importar el padrón.");
      throw importError;
    } finally {
      setOperation("");
    }
  };

  const closeUnitForm = () => {
    resetUnitForm();
    setShowUnitForm(false);
  };

  const submitUnit = async (event) => {
    event.preventDefault();
    try {
      resetMessages();
      setOperation("unit");
      if (editingUnitId) {
        await updateConsortiumUnit(activeInmobiliariaId, editingUnitId, {
          ...unitForm,
          consortiumId,
          changeMetadata: unitChangeForm,
        });
        setSuccess("Unidad actualizada. El cambio quedó asentado en su historial.");
      } else {
        await createConsortiumUnit(activeInmobiliariaId, consortiumId, unitForm);
        setSuccess("Unidad creada.");
      }
      resetUnitForm();
      setShowUnitForm(false);
      await load();
    } catch (saveError) {
      setError(saveError.message || "No se pudo guardar la unidad.");
    } finally {
      setOperation("");
    }
  };

  const editUnit = (unit) => {
    const notificationEmails = new Set(
      getConsortiumUnitNotificationRecipients(unit).map((item) => item.email),
    );
    setEditingUnitId(unit.id);
    setUnitForm({
      ...createEmptyConsortiumUnit(),
      ...unit,
      ownerEmail: unit.ownerEmail || unit.email || "",
      email: unit.ownerEmail ? unit.email || "" : "",
      manualOwnerPortalEmails: Array.isArray(unit.manualOwnerPortalEmails)
        ? unit.manualOwnerPortalEmails
        : [],
      manualPortalEmails: Array.isArray(unit.manualPortalEmails)
        ? unit.manualPortalEmails
        : (unit.portalEmails || []).filter((email) => (
          !notificationEmails.has(email)
          && email !== unit.ownerEmail
          && email !== unit.occupantEmail
        )),
    });
    setUnitChangeForm(emptyUnitChangeForm());
    setActiveWorkspace("units");
    setShowUnitForm(true);
    setTimeout(() => {
      document.getElementById("consortium-unit-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  };

  const removeUnit = async (unit) => {
    if (!window.confirm(`¿Archivar la unidad ${unit.code}? El historial emitido se conservará.`)) return;
    try {
      resetMessages();
      setOperation(`archive-unit-${unit.id}`);
      await archiveConsortiumUnit(activeInmobiliariaId, unit.id);
      setSuccess("Unidad archivada.");
      await load();
    } catch (removeError) {
      setError(removeError.message || "No se pudo archivar la unidad.");
    } finally {
      setOperation("");
    }
  };

  const createPeriod = async (event) => {
    event.preventDefault();
    try {
      resetMessages();
      setOperation("create-period");
      const periodId = await createConsortiumPeriod({
        inmobiliariaId: activeInmobiliariaId,
        consortiumId,
        periodKey: newPeriodKey,
        dueDate: newDueDate,
        earlyPaymentDate: newEarlyPaymentDate,
        earlyPaymentDiscountPercent: newEarlyPaymentDiscountPercent,
        secondDueDate: newSecondDueDate,
        secondDueSurchargePercent: newSecondDueSurchargePercent,
        currency: consortium.currency || "ARS",
      });
      setSelectedPeriodId(periodId);
      setSuccess("Liquidación mensual creada como borrador.");
      await load();
      setSelectedPeriodId(periodId);
    } catch (periodError) {
      setError(periodError.message || "No se pudo crear el período.");
    } finally {
      setOperation("");
    }
  };

  const addExpense = (event) => {
    event.preventDefault();
    resetMessages();
    const amountMinor = majorToMinor(expenseForm.amountMajor);
    if (!expenseForm.concept.trim() || amountMinor <= 0) {
      setError("Ingresá el concepto y un importe mayor a cero.");
      return;
    }
    if (expenseForm.distributionMode === "specific" && !expenseForm.specificUnitId) {
      setError("Seleccioná la unidad a la que corresponde el cargo.");
      return;
    }
    const normalizedExpense = {
      ...expenseForm,
      id: editingExpenseId || makeLocalId(),
      amountMinor,
    };
    setPeriodExpenses((current) => editingExpenseId
      ? current.map((item) => (item.id === editingExpenseId ? normalizedExpense : item))
      : [...current, normalizedExpense]);
    setDraftExpensesDirty(true);
    setEditingExpenseId("");
    setExpenseForm({ ...createEmptyConsortiumExpense(), amountMajor: "" });
  };

  const editExpense = (expense) => {
    resetMessages();
    setEditingExpenseId(expense.id);
    setExpenseForm({
      ...createEmptyConsortiumExpense(),
      ...expense,
      amountMajor: minorToMajorInput(expense.amountMinor),
    });
    setTimeout(() => {
      document.getElementById("consortium-expense-form")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 0);
  };

  const cancelExpenseEdit = () => {
    setEditingExpenseId("");
    setExpenseForm({ ...createEmptyConsortiumExpense(), amountMajor: "" });
  };

  const removeExpense = (expenseId) => {
    setPeriodExpenses((current) => current.filter((item) => item.id !== expenseId));
    setDraftExpensesDirty(true);
    if (editingExpenseId === expenseId) cancelExpenseEdit();
  };

  const mergeExpensesIntoDraft = (incoming, sourceLabel, { replaceMatching = false } = {}) => {
    resetMessages();
    const result = mergeConsortiumDraftExpenses({
      current: periodExpenses,
      incoming,
      createId: makeLocalId,
      replaceMatching,
    });
    if (!result.addedCount && !result.updatedCount) {
      setSuccess(`Los gastos de ${sourceLabel} ya estaban incorporados en el borrador.`);
      return;
    }
    setPeriodExpenses(result.expenses);
    setDraftExpensesDirty(true);
    setSuccess(`${result.addedCount} gasto(s) incorporado(s)${result.updatedCount ? ` y ${result.updatedCount} actualizado(s)` : ""} desde ${sourceLabel}. Revisá los importes antes de guardar.`);
  };

  const applyPreviousPeriodExpenses = () => {
    if (!previousMonthlyPeriod) return;
    mergeExpensesIntoDraft(
      previousMonthlyPeriod.expenses || [],
      getConsortiumAccountingPeriodLabel(previousMonthlyPeriod),
    );
  };

  const applyRecurringExpenses = (selected) => {
    mergeExpensesIntoDraft(selected, "la lista recurrente", { replaceMatching: true });
  };

  const persistRecurringExpenses = async (nextRecurringExpenses, successMessage) => {
    try {
      resetMessages();
      setOperation("recurring-expenses");
      const normalized = await saveConsortiumRecurringExpenses({
        inmobiliariaId: activeInmobiliariaId,
        consortiumId,
        recurringExpenses: nextRecurringExpenses,
      });
      setConsortium((current) => ({ ...current, recurringExpenses: normalized }));
      setSuccess(successMessage);
    } catch (saveError) {
      setError(saveError.message || "No se pudieron actualizar los gastos recurrentes.");
    } finally {
      setOperation("");
    }
  };

  const saveDraftAsRecurring = async () => {
    if (!periodExpenses.length) {
      setError("Cargá al menos un gasto antes de guardarlo como recurrente.");
      return;
    }
    const templatesByIdentity = new Map(
      recurringExpenses.map((item, index) => [getConsortiumExpenseIdentity(item), { item, index }]),
    );
    const next = [...recurringExpenses];
    periodExpenses.forEach((expense) => {
      const identity = getConsortiumExpenseIdentity(expense);
      const existing = templatesByIdentity.get(identity);
      const template = {
        ...expense,
        id: existing?.item?.id || `recurring_${makeLocalId()}`,
        active: true,
      };
      if (existing) next[existing.index] = template;
      else {
        templatesByIdentity.set(identity, { item: template, index: next.length });
        next.push(template);
      }
    });
    await persistRecurringExpenses(next, "Gastos recurrentes actualizados con los importes de este borrador.");
  };

  const removeRecurringExpense = async (templateId) => {
    await persistRecurringExpenses(
      recurringExpenses.filter((item) => item.id !== templateId),
      "Gasto quitado de la lista recurrente.",
    );
  };

  const saveExpenses = async ({ showSuccess = true } = {}) => {
    if (!selectedPeriod) throw new Error("Seleccioná una liquidación.");
    await saveConsortiumPeriodExpenses({
      inmobiliariaId: activeInmobiliariaId,
      periodId: selectedPeriod.id,
      expenses: periodExpenses,
    });
    setDraftExpensesDirty(false);
    if (showSuccess) setSuccess("Gastos guardados en el borrador.");
  };

  const handleSaveExpenses = async () => {
    try {
      resetMessages();
      setOperation("save-expenses");
      await saveExpenses();
      await load();
    } catch (saveError) {
      setError(saveError.message || "No se pudieron guardar los gastos.");
    } finally {
      setOperation("");
    }
  };

  const incorporateAiExpenseDocuments = async (drafts = []) => {
    if (!selectedPeriod || selectedPeriod.status !== "draft") {
      throw new Error("La liquidación ya no admite nuevos gastos.");
    }
    const validDrafts = drafts.filter((draft) => (
      draft?.file && draft.concept?.trim() && Number(draft.amountMinor) > 0
    ));
    if (!validDrafts.length) throw new Error("No hay gastos revisados para incorporar.");
    resetMessages();
    setOperation("ai-expense-documents");
    try {
      const entries = validDrafts.map((draft) => {
        const expenseId = makeLocalId();
        return {
          draft,
          expense: buildConsortiumExpenseFromAiDraft(draft, {
            id: expenseId,
            coefficientGroups: consortium.coefficientGroups || [],
          }),
        };
      });
      const nextExpenses = [...periodExpenses, ...entries.map((entry) => entry.expense)];
      await saveConsortiumPeriodExpenses({
        inmobiliariaId: activeInmobiliariaId,
        periodId: selectedPeriod.id,
        expenses: nextExpenses,
      });
      setPeriodExpenses(nextExpenses);
      setDraftExpensesDirty(false);

      const failures = [];
      let uploadedCount = 0;
      for (const { draft, expense } of entries) {
        try {
          await uploadConsortiumExpenseDocument({
            inmobiliariaId: activeInmobiliariaId,
            consortiumId,
            periodId: selectedPeriod.id,
            expenseId: expense.id,
            file: draft.file,
            provider: draft.providerName,
            providerTaxId: draft.providerTaxId,
            recipientName: draft.recipientName,
            recipientTaxId: draft.recipientTaxId,
            voucherType: draft.voucherType,
            voucherNumber: draft.voucherNumber,
            documentDate: draft.issueDate,
            dueDate: draft.dueDate,
            currency: draft.currency,
            documentHash: draft.documentHash,
            documentTotalMinor: draft.amountMinor,
            documentNetMinor: draft.netAmountMinor,
            documentTaxMinor: draft.taxAmountMinor,
            cae: draft.cae,
            caeDueDate: draft.caeDueDate,
            aiAssisted: true,
            aiConfidence: draft.confidence,
            aiGenerationId: draft.generationId,
            notes: draft.notes,
          });
          uploadedCount += 1;
        } catch (uploadError) {
          failures.push({
            localId: draft.localId,
            fileName: draft.file.name,
            message: uploadError.message || "No se pudo archivar el archivo.",
          });
        }
      }
      await load();
      setSuccess(`${entries.length} gasto(s) revisado(s) incorporado(s) al borrador.${failures.length ? ` ${failures.length} comprobante(s) requieren adjuntarse manualmente.` : ""}`);
      return { createdCount: entries.length, uploadedCount, failures };
    } catch (saveError) {
      setError(saveError.message || "No se pudieron incorporar los comprobantes revisados.");
      throw saveError;
    } finally {
      setOperation("");
    }
  };

  const issuePeriod = async () => {
    if (!window.confirm("Al emitir se generará la deuda de cada unidad y ya no podrás modificar los gastos. ¿Continuar?")) return;
    try {
      resetMessages();
      setOperation("issue-period");
      await saveExpenses({ showSuccess: false });
      const result = await issueConsortiumPeriod({
        inmobiliariaId: activeInmobiliariaId,
        periodId: selectedPeriod.id,
      });
      setSuccess(`Liquidación emitida para ${result.unitCount} unidades.`);
      await load();
    } catch (issueError) {
      setError(issueError.message || "No se pudo emitir la liquidación.");
    } finally {
      setOperation("");
    }
  };

  const selectPayment = (obligation) => {
    const schedule = getConsortiumPaymentSchedule({
      amountMinor: obligation.baseAmountMinor ?? obligation.totalAmountMinor,
      dueDate: obligation.dueDate,
      earlyPaymentDate: obligation.earlyPaymentDate,
      earlyPaymentDiscountPercent: obligation.earlyPaymentDiscountPercent,
      secondDueDate: obligation.secondDueDate,
      secondDueSurchargePercent: obligation.secondDueSurchargePercent,
    });
    const today = todayKey();
    const suggestedAmount = getConsortiumScheduledAmountForDate({ schedule, paymentDate: today });
    setPaymentForm({
      obligationId: obligation.id,
      amountMajor: minorToMajorInput(suggestedAmount),
      date: todayKey(),
      method: "transfer",
      reference: "",
      notes: "",
      treasuryAccountId: treasuryAccounts.find((item) => (
        item.active !== false && item.currency === obligation.currency
      ))?.id || "",
    });
    document.getElementById("consortium-payment-form")?.scrollIntoView({ behavior: "smooth" });
  };

  const submitPayment = async (event) => {
    event.preventDefault();
    try {
      resetMessages();
      setOperation("payment");
      const paymentId = await registerConsortiumPayment({
        inmobiliariaId: activeInmobiliariaId,
        obligationId: paymentForm.obligationId,
        amountMinor: majorToMinor(paymentForm.amountMajor),
        date: paymentForm.date,
        method: paymentForm.method,
        reference: paymentForm.reference,
        notes: paymentForm.notes,
        treasuryAccountId: paymentForm.treasuryAccountId,
      });
      setLastPaymentId(paymentId);
      setSuccess("Cobro registrado. Ya podés abrir el recibo.");
      setPaymentForm((current) => ({ ...current, obligationId: "", amountMajor: "", reference: "", notes: "", treasuryAccountId: "" }));
      setTreasuryRefreshKey((current) => current + 1);
      await load();
    } catch (paymentError) {
      setError(paymentError.message || "No se pudo registrar el cobro.");
    } finally {
      setOperation("");
    }
  };

  const submitOpeningBalance = async (event) => {
    event.preventDefault();
    try {
      resetMessages();
      setOperation("opening-balance");
      const result = await recordConsortiumOpeningBalance({
        inmobiliariaId: activeInmobiliariaId,
        consortiumId,
        unitId: openingBalanceForm.unitId,
        type: openingBalanceForm.type,
        amountMinor: majorToMinor(openingBalanceForm.amountMajor),
        effectiveDate: openingBalanceForm.effectiveDate,
        periodKey: openingBalanceForm.periodKey,
        dueDate: openingBalanceForm.dueDate,
        reason: openingBalanceForm.reason,
      });
      setSuccess(openingBalanceForm.type === "debit"
        ? "Saldo inicial deudor registrado y disponible para cobranza."
        : "Saldo inicial a favor registrado en la cuenta de la unidad.");
      setOpeningBalanceForm({
        ...emptyOpeningBalanceForm(),
        dueDate: getDefaultConsortiumDueDate(currentPeriodKey(), consortium.dueDay),
      });
      setShowOpeningBalanceForm(false);
      await load();
      if (result.periodId) setSelectedPeriodId(result.periodId);
    } catch (openingError) {
      setError(openingError.message || "No se pudo registrar el saldo inicial.");
    } finally {
      setOperation("");
    }
  };

  const selectAdjustment = (obligation) => {
    resetMessages();
    setAdjustmentForm({
      ...emptyAdjustmentForm(),
      obligationId: obligation.id,
    });
    setTimeout(() => {
      document.getElementById("consortium-adjustment-form")?.scrollIntoView({ behavior: "smooth" });
    }, 0);
  };

  const submitAdjustment = async (event) => {
    event.preventDefault();
    try {
      resetMessages();
      setOperation("adjustment");
      await adjustConsortiumObligation({
        inmobiliariaId: activeInmobiliariaId,
        obligationId: adjustmentForm.obligationId,
        type: adjustmentForm.type,
        category: adjustmentForm.category,
        amountMinor: majorToMinor(adjustmentForm.amountMajor),
        effectiveDate: adjustmentForm.effectiveDate,
        reason: adjustmentForm.reason,
      });
      setSuccess(adjustmentForm.type === "debit"
        ? "Nota de débito registrada. Si el período estaba cerrado, quedó reabierto."
        : "Nota de crédito registrada y aplicada al saldo pendiente.");
      setAdjustmentForm(emptyAdjustmentForm());
      await load();
    } catch (adjustmentError) {
      setError(adjustmentError.message || "No se pudo registrar la rectificación.");
    } finally {
      setOperation("");
    }
  };

  const openPenaltyForUnit = (unitId) => {
    setActiveWorkspace("penalties");
    setPenaltyRequest({ unitId, nonce: Date.now() });
  };

  const approvePaymentReport = async (report) => {
    if (!window.confirm(`¿Validar el pago informado por la unidad ${report.unitSnapshot?.code || report.unitId}? La deuda se actualizará inmediatamente.`)) return;
    try {
      resetMessages();
      setOperation(`approve-report-${report.id}`);
      const paymentId = await approveConsortiumPaymentReport({
        inmobiliariaId: activeInmobiliariaId,
        reportId: report.id,
      });
      setLastPaymentId(paymentId);
      setSuccess("Pago validado y aplicado a la cuenta corriente.");
      await load();
    } catch (approvalError) {
      setError(approvalError.message || "No se pudo validar el pago informado.");
    } finally {
      setOperation("");
    }
  };

  const rejectPaymentReport = async (report) => {
    const reason = window.prompt("Motivo del rechazo del pago informado:");
    if (!reason) return;
    try {
      resetMessages();
      setOperation(`reject-report-${report.id}`);
      await rejectConsortiumPaymentReport({
        inmobiliariaId: activeInmobiliariaId,
        reportId: report.id,
        reason,
      });
      setSuccess("Pago informado rechazado con trazabilidad.");
      await load();
    } catch (rejectionError) {
      setError(rejectionError.message || "No se pudo rechazar el pago informado.");
    } finally {
      setOperation("");
    }
  };

  const refreshCloseChecklist = async () => {
    if (!selectedPeriod) return;
    try {
      setCloseAssistantLoading(true);
      setError("");
      const checklist = await getConsortiumMonthlyCloseChecklist({
        inmobiliariaId: activeInmobiliariaId,
        consortiumId,
        periodId: selectedPeriod.id,
      });
      setCloseChecklist(checklist);
      setCloseAcknowledged(false);
    } catch (checkError) {
      setCloseChecklist(null);
      setError(checkError.message || "No se pudo controlar el cierre mensual.");
    } finally {
      setCloseAssistantLoading(false);
    }
  };

  const openCloseAssistant = async () => {
    resetMessages();
    setShowCloseAssistant(true);
    setCloseNote("");
    setCloseAcknowledged(false);
    await refreshCloseChecklist();
    setTimeout(() => {
      document.getElementById("consortium-monthly-close")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  };

  const navigateFromCloseAssistant = (area) => {
    setShowCloseAssistant(false);
    setActiveWorkspace(area);
  };

  const prepareExpensePayable = (document, obligation = null) => {
    resetMessages();
    if (document?.periodId) setSelectedPeriodId(document.periodId);
    setActiveWorkspace("treasury");
    setPayableRequest({
      nonce: `${Date.now()}-${document?.id || "expense"}`,
      document,
      obligationId: obligation?.id || "",
    });
    setTimeout(() => {
      document?.id && globalThis.document
        ?.getElementById("proveedores-tesoreria")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  };

  const closePeriod = async () => {
    try {
      resetMessages();
      setOperation("close-period");
      await closeConsortiumPeriod({
        inmobiliariaId: activeInmobiliariaId,
        consortiumId,
        periodId: selectedPeriod.id,
        acknowledgeWarnings: closeAcknowledged,
        reviewedWarningSignatures: closeChecklist?.warnings?.map(
          (item) => `${item.code}:${item.count}:${item.amountMinor}`,
        ) || [],
        note: closeNote,
      });
      setShowCloseAssistant(false);
      setCloseChecklist(null);
      setSuccess("Cierre mensual confirmado. Las deudas y obligaciones pendientes continúan en sus cuentas corrientes.");
      await load();
    } catch (closeError) {
      setError(closeError.message || "No se pudo cerrar el período.");
    } finally {
      setOperation("");
    }
  };

  const handleArchiveConsortium = async () => {
    if (!window.confirm("¿Archivar el consorcio? Los movimientos históricos se conservarán.")) return;
    try {
      setOperation("archive-consortium");
      await archiveConsortium(activeInmobiliariaId, consortiumId);
      navigate("/admin/consorcios");
    } catch (archiveError) {
      setError(archiveError.message || "No se pudo archivar el consorcio.");
    } finally {
      setOperation("");
    }
  };

  if (loading || agencyLoading) return <main className="container py-5 text-center">Cargando consorcio...</main>;
  if (!consortium) return <main className="container py-5"><div className="alert alert-danger">{error || "El consorcio no existe."}</div></main>;

  const periodState = getConsortiumPeriodStatus(selectedPeriod?.status);
  const draftTotal = periodExpenses.reduce((sum, item) => sum + Number(item.amountMinor || 0), 0);
  const workspaceItems = [
    { id: "liquidations", label: "Liquidaciones", hint: "Expensas, cobros y comprobantes" },
    { id: "treasury", label: "Tesorería", hint: "Cuentas, proveedores y conciliación" },
    { id: "messages", label: "Mensajes", hint: "Consultas, avisos y reclamos" },
    { id: "penalties", label: "Multas", hint: "Débitos y seguimiento" },
    { id: "information", label: "Edificio", hint: "Información para consorcistas" },
    { id: "units", label: "Unidades", hint: "Padrón y configuración inicial" },
  ];

  return (
    <main className="container py-4 consortium-workspace">
      <SEO title={`${consortium.name} | Consorcios | ONO Prop`} noIndex />
      <header className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
        <div>
          <Link className="text-decoration-none" to="/admin/consorcios">← Consorcios</Link>
          <h1 className="h3 mt-3 mb-1">{consortium.name}</h1>
          <p className="text-muted mb-0">{consortium.address}{consortium.city ? ` · ${consortium.city}` : ""}</p>
        </div>
        <div className="d-flex flex-wrap gap-2">
          <Link className="btn btn-primary" to={`/admin/consorcios/${consortiumId}/cobranzas`}>Cobranzas</Link>
          <Link className="btn btn-outline-primary" to="/guias/administracion-consorcios">Manual</Link>
          {canManage && <Link className="btn btn-outline-secondary" to={`/admin/consorcios/${consortiumId}/editar`}>Editar consorcio</Link>}
          {canManage && consortium.status !== "archived" && (
            <button className="btn btn-outline-danger" type="button" disabled={Boolean(operation)} onClick={handleArchiveConsortium}>Archivar</button>
          )}
        </div>
      </header>

      {error && <div className="alert alert-danger">{error}</div>}
      {success && (
        <div className="alert alert-success d-flex flex-wrap justify-content-between align-items-center gap-2">
          <span>{success}</span>
          {lastPaymentId && (
            <Link className="btn btn-sm btn-success" to={`/admin/consorcios/${consortiumId}/recibos/${lastPaymentId}`}>Abrir recibo</Link>
          )}
        </div>
      )}
      {!canManage && <div className="alert alert-info">Tu rol permite consultar unidades, liquidaciones y cuentas corrientes, pero no registrar ni modificar movimientos.</div>}

      <section className="row g-3 mb-4">
        <div className="col-sm-6 col-xl-3"><div className="card border-0 shadow-sm h-100"><div className="card-body"><span className="small text-muted text-uppercase">Unidades activas</span><strong className="fs-4 d-block">{activeUnits.length}</strong></div></div></div>
        <div className="col-sm-6 col-xl-3"><div className="card border-0 shadow-sm h-100"><div className="card-body"><span className="small text-muted text-uppercase">Coeficientes</span><strong className="fs-4 d-block">{totalCoefficient.toLocaleString("es-AR", { maximumFractionDigits: 6 })}</strong><small className={Math.abs(totalCoefficient - 100) < 0.001 ? "text-success" : "text-warning"}>{Math.abs(totalCoefficient - 100) < 0.001 ? "Suman 100" : "Se normalizan al liquidar"}</small></div></div></div>
        <div className="col-sm-6 col-xl-3"><div className="card border-0 shadow-sm h-100"><div className="card-body"><span className="small text-muted text-uppercase">Saldo seleccionado</span><strong className="fs-4 d-block consortium-money">{formatConsortiumMoney(periodSummary.balance, consortium.currency)}</strong></div></div></div>
        <div className="col-sm-6 col-xl-3"><div className="card border-0 shadow-sm h-100"><div className="card-body"><span className="small text-muted text-uppercase">Vencidas</span><strong className="fs-4 d-block">{periodSummary.overdue}</strong></div></div></div>
      </section>

      <nav className="consortium-workspace-nav card border-0 shadow-sm mb-4" aria-label="Áreas de administración del consorcio">
        <div className="card-body p-2">
          <div className="nav nav-pills nav-fill gap-2" role="tablist">
            {workspaceItems.map((item) => (
              <button
                aria-selected={activeWorkspace === item.id}
                className={`nav-link text-start ${activeWorkspace === item.id ? "active" : ""}`}
                key={item.id}
                onClick={() => setActiveWorkspace(item.id)}
                role="tab"
                type="button"
              >
                <strong className="d-block">{item.label}</strong>
                <small className="d-block">{item.hint}</small>
              </button>
            ))}
          </div>
        </div>
      </nav>

      {activeWorkspace === "units" && <section className="card border-0 shadow-sm mb-4 consortium-section-anchor" id="unidades">
        <div className="card-body p-4">
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
            <div><h2 className="h5 mb-1">Padrón de unidades</h2><p className="text-muted small mb-0">Consultá cuentas y contactos. El alta y la edición se abren únicamente cuando las necesitás.</p></div>
            <div className="d-flex align-items-center gap-2">
              <span className="badge text-bg-light border">{activeUnits.length} activas</span>
              {canManage && <div className="btn-group btn-group-sm"><button className="btn btn-outline-primary" type="button" onClick={openUnitImport}>Importar planilla</button><button className="btn btn-primary" type="button" onClick={openNewUnitForm}>Agregar unidad</button></div>}
            </div>
          </div>
          {showUnitImport && canManage && <ConsortiumUnitsCsvImport
            units={activeUnits}
            working={operation === "import-units"}
            defaultDueDate={getDefaultConsortiumDueDate(currentPeriodKey(), consortium.dueDay)}
            onImport={importUnits}
            onClose={() => setShowUnitImport(false)}
          />}
          <div className={`table-responsive ${showUnitForm ? "mb-4" : ""}`}>
            <table className="table table-hover consortium-unit-table">
              <thead><tr><th>Unidad</th><th>Tipo</th><th>Coeficientes</th><th>Titular / ocupante</th><th>Contacto</th><th>Saldo a favor</th><th className="text-end">Acciones</th></tr></thead>
              <tbody>
                {activeUnits.map((unit) => (
                  <tr key={unit.id}>
                    <td><strong>{unit.code}</strong><div className="small text-muted">{[unit.floor && `Piso ${unit.floor}`, unit.apartment && `Dpto. ${unit.apartment}`].filter(Boolean).join(" · ")}</div></td>
                    <td>{CONSORTIUM_UNIT_TYPES.find((item) => item.id === unit.type)?.label || unit.type}</td>
                    <td><div>General: {Number(unit.coefficient || 0).toLocaleString("es-AR", { maximumFractionDigits: 6 })}</div>{(consortium.coefficientGroups || []).filter((group) => group.active !== false && group.id !== "general" && Number(unit.coefficients?.[group.id] || 0) > 0).map((group) => <small className="d-block text-muted" key={group.id}>{group.name}: {Number(unit.coefficients?.[group.id] || 0).toLocaleString("es-AR", { maximumFractionDigits: 6 })}</small>)}</td>
                    <td><div>{unit.ownerName || "Titular no informado"}</div>{unit.ownerSince && <small className="d-block text-muted">Titular desde {unit.ownerSince}</small>}<small className="d-block text-muted">{unit.occupantName || "Sin ocupante informado"}</small>{unit.occupantSince && <small className="d-block text-muted">Ocupante desde {unit.occupantSince}</small>}</td>
                    <td><div>{unit.ownerEmail || unit.email || ""}</div>{unit.occupantEmail && <small className="d-block">Ocupante: {unit.occupantEmail}</small>}<small className="d-block text-muted">{unit.phone || ""}</small>{Array.isArray(unit.portalEmails) && unit.portalEmails.length > 0 && <small className="d-block text-success">Portal: {unit.portalEmails.length} acceso(s)</small>}<small className="d-block text-muted">Automatización: {{ inherit: "hereda consorcio", custom: "personalizada", disabled: "excluida" }[unit.notificationAutomationMode] || "hereda consorcio"}</small></td>
                    <td className="consortium-money text-success">{formatConsortiumMoney(unit.creditBalanceMinor, consortium.currency)}</td>
                    <td className="text-end">
                      <div className="btn-group btn-group-sm">
                        <Link className="btn btn-outline-success" to={`/admin/consorcios/${consortiumId}/unidades/${unit.id}/cuenta-corriente`}>Cuenta</Link>
                        {canManage && <button className="btn btn-outline-danger" type="button" onClick={() => openPenaltyForUnit(unit.id)}>Multa</button>}
                        {canManage && <button className="btn btn-outline-secondary" type="button" onClick={() => editUnit(unit)}>Editar</button>}
                        {canManage && <button className="btn btn-outline-danger" type="button" disabled={operation === `archive-unit-${unit.id}`} onClick={() => removeUnit(unit)}>Archivar</button>}
                      </div>
                    </td>
                  </tr>
                ))}
                {!activeUnits.length && <tr><td className="text-center text-muted py-4" colSpan="7">Todavía no hay unidades cargadas.{canManage && <button className="btn btn-sm btn-link" type="button" onClick={openNewUnitForm}>Cargar la primera</button>}</td></tr>}
              </tbody>
            </table>
          </div>

          {canManage && showUnitForm && <form id="consortium-unit-form" className="rounded border bg-light p-3 consortium-section-anchor" onSubmit={submitUnit}>
            <div className="d-flex justify-content-between align-items-center mb-3"><div><h3 className="h6 mb-1">{editingUnitId ? "Editar unidad" : "Agregar unidad"}</h3><small className="text-muted">Configuración administrativa, contactos y accesos al portal.</small></div><button className="btn btn-sm btn-outline-secondary" type="button" onClick={closeUnitForm}>Cerrar</button></div>
            <div className="row g-3">
              <div className="col-md-3"><label className="form-label">Identificador *</label><input className="form-control" placeholder="Ej. 2 B" value={unitForm.code} onChange={(e) => setUnitForm((c) => ({ ...c, code: e.target.value }))} required /></div>
              <div className="col-md-2"><label className="form-label">Piso</label><input className="form-control" value={unitForm.floor} onChange={(e) => setUnitForm((c) => ({ ...c, floor: e.target.value }))} /></div>
              <div className="col-md-2"><label className="form-label">Departamento</label><input className="form-control" value={unitForm.apartment} onChange={(e) => setUnitForm((c) => ({ ...c, apartment: e.target.value }))} /></div>
              <div className="col-md-3"><label className="form-label">Tipo</label><select className="form-select" value={unitForm.type} onChange={(e) => setUnitForm((c) => ({ ...c, type: e.target.value }))}>{CONSORTIUM_UNIT_TYPES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></div>
              <div className="col-md-2"><label className="form-label">Coef. general</label><input className="form-control" type="number" min="0" step="0.000001" value={unitForm.coefficient} onChange={(e) => setUnitForm((c) => ({ ...c, coefficient: e.target.value, coefficients: { ...(c.coefficients || {}), general: e.target.value } }))} /></div>
              {(consortium.coefficientGroups || []).filter((group) => group.active !== false && group.id !== "general").map((group) => <div className="col-md-2" key={group.id}><label className="form-label">{group.name}</label><input className="form-control" type="number" min="0" step="0.000001" value={unitForm.coefficients?.[group.id] ?? ""} onChange={(e) => setUnitForm((c) => ({ ...c, coefficients: { ...(c.coefficients || {}), [group.id]: e.target.value } }))} /></div>)}
              <div className="col-md-4"><label className="form-label">Propietario / titular</label><input className="form-control" value={unitForm.ownerName} onChange={(e) => setUnitForm((c) => ({ ...c, ownerName: e.target.value }))} /></div>
              <div className="col-md-3"><label className="form-label">CUIT / DNI titular</label><input className="form-control" value={unitForm.ownerTaxId} onChange={(e) => setUnitForm((c) => ({ ...c, ownerTaxId: e.target.value }))} /></div>
              <div className="col-md-5"><label className="form-label">Ocupante</label><input className="form-control" value={unitForm.occupantName} onChange={(e) => setUnitForm((c) => ({ ...c, occupantName: e.target.value }))} /></div>
              {!editingUnitId && <><div className="col-md-4"><label className="form-label">Titular desde</label><input className="form-control" type="date" max={todayKey()} value={unitForm.ownerSince || ""} onChange={(e) => setUnitForm((c) => ({ ...c, ownerSince: e.target.value }))} /><small className="text-muted">Opcional, si se conoce.</small></div><div className="col-md-4"><label className="form-label">Ocupante desde</label><input className="form-control" type="date" max={todayKey()} value={unitForm.occupantSince || ""} onChange={(e) => setUnitForm((c) => ({ ...c, occupantSince: e.target.value }))} /><small className="text-muted">Opcional, si se conoce.</small></div></>}
              {editingUnitId && <div className="col-12"><div className="alert alert-warning mb-0"><strong>Esta edición quedará asentada.</strong> Se conservarán los datos anteriores, los nuevos, el motivo, la fecha y el usuario que realiza el cambio.</div></div>}
              {editingUnitId && ownerIdentityEdited && <><div className="col-md-6"><label className="form-label">Naturaleza del cambio de titular *</label><select className="form-select" value={unitChangeForm.ownerChangeKind} onChange={(e) => setUnitChangeForm((c) => ({ ...c, ownerChangeKind: e.target.value }))}><option value="replacement">Cambio real de titular</option><option value="correction">Corrección de datos del mismo titular</option></select></div>{unitChangeForm.ownerChangeKind === "replacement" && <div className="col-md-6"><label className="form-label">Nuevo titular desde *</label><input className="form-control" type="date" max={todayKey()} value={unitChangeForm.ownerEffectiveDate} onChange={(e) => setUnitChangeForm((c) => ({ ...c, ownerEffectiveDate: e.target.value }))} required /></div>}</>}
              {editingUnitId && occupantIdentityEdited && <><div className="col-md-6"><label className="form-label">Naturaleza del cambio de ocupante *</label><select className="form-select" value={unitChangeForm.occupantChangeKind} onChange={(e) => setUnitChangeForm((c) => ({ ...c, occupantChangeKind: e.target.value }))}><option value="replacement">Cambio real de ocupante</option><option value="correction">Corrección de datos del mismo ocupante</option></select></div>{unitChangeForm.occupantChangeKind === "replacement" && <div className="col-md-6"><label className="form-label">Nuevo ocupante desde *</label><input className="form-control" type="date" max={todayKey()} value={unitChangeForm.occupantEffectiveDate} onChange={(e) => setUnitChangeForm((c) => ({ ...c, occupantEffectiveDate: e.target.value }))} required /></div>}</>}
              {editingUnitId && ((ownerIdentityEdited && unitChangeForm.ownerChangeKind === "replacement") || (occupantIdentityEdited && unitChangeForm.occupantChangeKind === "replacement")) && <div className="col-12"><small className="text-danger">Verificá también los emails y la preferencia de envío: al guardar se revocarán de esta unidad los accesos anteriores que no permanezcan como accesos adicionales.</small></div>}
              <div className="col-md-4"><label className="form-label">Email del titular</label><input className="form-control" type="email" value={unitForm.ownerEmail || ""} onChange={(e) => setUnitForm((c) => ({ ...c, ownerEmail: e.target.value }))} /></div>
              <div className="col-md-4"><label className="form-label">Email del ocupante</label><input className="form-control" type="email" value={unitForm.occupantEmail || ""} onChange={(e) => setUnitForm((c) => ({ ...c, occupantEmail: e.target.value }))} /></div>
              <div className="col-md-4"><label className="form-label">Enviar liquidaciones a</label><select className="form-select" value={unitForm.notificationPreference || "owner"} onChange={(e) => setUnitForm((c) => ({ ...c, notificationPreference: e.target.value }))}><option value="owner">Titular</option><option value="occupant">Ocupante</option><option value="both">Titular y ocupante</option><option value="none">No enviar por email</option></select></div>
              <div className="col-md-4"><label className="form-label">Automatización de esta unidad</label><select className="form-select" value={unitForm.notificationAutomationMode || "inherit"} onChange={(e) => setUnitForm((c) => ({ ...c, notificationAutomationMode: e.target.value }))}><option value="inherit">Heredar del consorcio</option><option value="custom">Configuración personalizada</option><option value="disabled">Excluir de automatizaciones</option></select><small className="text-muted">Nunca puede activarse si el consorcio no está autorizado.</small></div>
              {unitForm.notificationAutomationMode === "custom" && <><div className="col-md-4"><div className="form-check mt-md-4 pt-md-2"><input className="form-check-input" id="unit-send-on-issue" type="checkbox" checked={unitForm.notificationSendOnIssue === true} onChange={(e) => setUnitForm((c) => ({ ...c, notificationSendOnIssue: e.target.checked }))} /><label className="form-check-label" htmlFor="unit-send-on-issue">Enviar al emitir</label></div></div><div className="col-md-4"><label className="form-label">Avisos previos</label><input className="form-control" value={reminderDaysInput(unitForm.notificationPreDueDays)} onChange={(e) => setUnitForm((c) => ({ ...c, notificationPreDueDays: e.target.value }))} placeholder="3" /><small className="text-muted">Días antes; vacío desactiva.</small></div><div className="col-md-4"><label className="form-label">Avisos de mora</label><input className="form-control" value={reminderDaysInput(unitForm.notificationOverdueDays)} onChange={(e) => setUnitForm((c) => ({ ...c, notificationOverdueDays: e.target.value }))} placeholder="1, 7, 15" /><small className="text-muted">Días después; vacío desactiva.</small></div></>}
              <div className="col-md-4"><label className="form-label">Teléfono</label><input className="form-control" value={unitForm.phone} onChange={(e) => setUnitForm((c) => ({ ...c, phone: e.target.value }))} /></div>
              <div className="col-md-6"><label className="form-label">Accesos adicionales como propietario</label><textarea className="form-control" rows="2" placeholder="Un email por línea" value={(unitForm.manualOwnerPortalEmails || []).join("\n")} onChange={(e) => setUnitForm((c) => ({ ...c, manualOwnerPortalEmails: e.target.value.split(/[\n,;]+/) }))} /><small className="text-muted">Podrán ver pólizas, actas, reglamento de copropiedad y demás contenido reservado.</small></div>
              <div className="col-md-6"><label className="form-label">Accesos adicionales como ocupante</label><textarea className="form-control" rows="2" placeholder="Un email por línea" value={(unitForm.manualPortalEmails || []).join("\n")} onChange={(e) => setUnitForm((c) => ({ ...c, manualPortalEmails: e.target.value.split(/[\n,;]+/) }))} /><small className="text-muted">Verán únicamente los bloques habilitados para propietarios y ocupantes.</small></div>
              {editingUnitId && <div className="col-md-8"><label className="form-label">Motivo de la edición *</label><textarea className="form-control" rows="2" placeholder="Ej. Cambio de titular informado mediante escritura del 05/08/2026" value={unitChangeForm.reason} onChange={(e) => setUnitChangeForm((c) => ({ ...c, reason: e.target.value }))} required /><small className="text-muted">Se incorporará al historial permanente de la unidad.</small></div>}
              <div className="col-md-4 d-flex align-items-end justify-content-end"><button className="btn btn-primary" disabled={operation === "unit"} type="submit">{operation === "unit" ? "Guardando..." : editingUnitId ? "Guardar cambios" : "Agregar unidad"}</button></div>
            </div>
          </form>}
        </div>
      </section>}

      <div hidden={activeWorkspace !== "information"}>
        <ConsortiumPortalInformationPanel
          inmobiliariaId={activeInmobiliariaId}
          consortiumId={consortiumId}
          canManage={canManage}
        />
      </div>

      <div hidden={activeWorkspace !== "messages"}>
        <ConsortiumClaimsPanel
          inmobiliariaId={activeInmobiliariaId}
          consortium={{ id: consortiumId, ...consortium }}
          units={activeUnits}
          suppliers={consortiumSuppliers}
          canManage={canManage}
        />
      </div>

      {activeWorkspace === "units" && canManage && (
        <section className="card border-0 shadow-sm mb-4 consortium-section-anchor" id="saldos-iniciales">
          <div className="card-body p-4">
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
              <div>
                <div className="d-flex flex-wrap align-items-center gap-2 mb-1"><h2 className="h5 mb-0">Migración y saldos iniciales</h2><span className="badge text-bg-light border">Configuración inicial</span></div>
                <p className="text-muted small mb-0">Solo se usa al incorporar deuda o crédito proveniente de una administración anterior.</p>
              </div>
              <button className="btn btn-sm btn-outline-primary" type="button" onClick={() => setShowOpeningBalanceForm((current) => !current)}>{showOpeningBalanceForm ? "Cerrar formulario" : "Registrar saldo anterior"}</button>
            </div>
            {showOpeningBalanceForm && <form className="border-top mt-4 pt-4" onSubmit={submitOpeningBalance}>
              <div className="row g-3">
                <div className="col-md-3"><label className="form-label">Unidad *</label><select className="form-select" value={openingBalanceForm.unitId} onChange={(e) => setOpeningBalanceForm((c) => ({ ...c, unitId: e.target.value }))} required><option value="">Seleccionar...</option>{activeUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.code}</option>)}</select></div>
                <div className="col-md-3"><label className="form-label">Tipo *</label><select className="form-select" value={openingBalanceForm.type} onChange={(e) => setOpeningBalanceForm((c) => ({ ...c, type: e.target.value }))}><option value="debit">Deuda anterior</option><option value="credit">Saldo a favor anterior</option></select></div>
                <div className="col-md-3"><label className="form-label">Importe *</label><input className="form-control" inputMode="decimal" placeholder="0,00" value={openingBalanceForm.amountMajor} onChange={(e) => setOpeningBalanceForm((c) => ({ ...c, amountMajor: e.target.value }))} required /></div>
                <div className="col-md-3"><label className="form-label">Fecha de origen *</label><input className="form-control" type="date" value={openingBalanceForm.effectiveDate} onChange={(e) => setOpeningBalanceForm((c) => ({ ...c, effectiveDate: e.target.value }))} required /></div>
                {openingBalanceForm.type === "debit" && <><div className="col-md-3"><label className="form-label">Período *</label><input className="form-control" type="month" value={openingBalanceForm.periodKey} onChange={(e) => setOpeningBalanceForm((c) => ({ ...c, periodKey: e.target.value }))} required /></div><div className="col-md-3"><label className="form-label">Vencimiento *</label><input className="form-control" type="date" value={openingBalanceForm.dueDate} onChange={(e) => setOpeningBalanceForm((c) => ({ ...c, dueDate: e.target.value }))} required /></div></>}
                <div className={openingBalanceForm.type === "debit" ? "col-md-6" : "col-md-12"}><label className="form-label">Origen / motivo *</label><input className="form-control" placeholder="Ej. Migración de cuenta corriente anterior" value={openingBalanceForm.reason} onChange={(e) => setOpeningBalanceForm((c) => ({ ...c, reason: e.target.value }))} required /></div>
                <div className="col-12 d-flex flex-wrap justify-content-between align-items-center gap-2"><small className="text-muted">El saldo a favor se exhibe por separado y no se imputa automáticamente hasta confirmar su aplicación.</small><button className="btn btn-outline-primary" disabled={operation === "opening-balance" || !activeUnits.length} type="submit">{operation === "opening-balance" ? "Registrando..." : "Registrar saldo inicial"}</button></div>
              </div>
            </form>}
          </div>
        </section>
      )}

      <div hidden={activeWorkspace !== "penalties"}>
        <ConsortiumPenaltiesPanel
          inmobiliariaId={activeInmobiliariaId}
          consortium={{ id: consortiumId, ...consortium }}
          units={activeUnits}
          obligations={obligations}
          canManage={canManage}
          requestedUnitId={penaltyRequest.unitId}
          requestNonce={penaltyRequest.nonce}
          onChanged={load}
        />
      </div>

      <div hidden={activeWorkspace !== "treasury"}>
        <ConsortiumTreasuryPanel
          inmobiliariaId={activeInmobiliariaId}
          consortium={{ id: consortiumId, ...consortium }}
          periods={periods}
          canManage={canManage}
          refreshKey={treasuryRefreshKey}
          payableRequest={payableRequest}
          onAccountsChanged={setTreasuryAccounts}
          onObligationsChanged={setSupplierObligations}
          onSuppliersChanged={setConsortiumSuppliers}
        />
      </div>

      {activeWorkspace === "liquidations" && <>
      <section className="card border-0 shadow-sm mb-4 consortium-section-anchor" id="liquidaciones">
        <div className="card-body p-4">
          <h2 className="h5">Liquidaciones mensuales</h2>
          {canManage && <form className="row g-3 align-items-end mb-4" onSubmit={createPeriod}>
            <div className="col-md-4"><label className="form-label">Período a liquidar</label><input className="form-control" type="month" value={newPeriodKey} onChange={(e) => setNewPeriodKey(e.target.value)} required /></div>
            <div className="col-md-4"><label className="form-label">Primer vencimiento</label><input className="form-control" type="date" value={newDueDate} onChange={(e) => setNewDueDate(e.target.value)} required /></div>
            <div className="col-md-4"><label className="form-label">Pronto pago hasta</label><input className="form-control" type="date" value={newEarlyPaymentDate} onChange={(e) => setNewEarlyPaymentDate(e.target.value)} /><div className="input-group mt-1"><input className="form-control" type="number" min="0" max="100" step="0.01" value={newEarlyPaymentDiscountPercent} onChange={(e) => setNewEarlyPaymentDiscountPercent(e.target.value)} /><span className="input-group-text">% bonif.</span></div></div>
            <div className="col-md-4"><label className="form-label">Segundo vencimiento</label><input className="form-control" type="date" value={newSecondDueDate} onChange={(e) => setNewSecondDueDate(e.target.value)} /><div className="input-group mt-1"><input className="form-control" type="number" min="0" max="1000" step="0.01" value={newSecondDueSurchargePercent} onChange={(e) => setNewSecondDueSurchargePercent(e.target.value)} /><span className="input-group-text">% recargo</span></div></div>
            <div className="col-12"><small className="text-muted">La liquidación guarda estas condiciones. Si una fecha no corresponde, dejala vacía; el interés por mora continúa siendo independiente.</small></div>
            <div className="col-12"><button className="btn btn-outline-primary w-100" disabled={operation === "create-period"} type="submit">Crear borrador mensual</button></div>
          </form>}
          <div className="row g-3 align-items-end">
            <div className="col-lg-8"><label className="form-label" htmlFor="selected-consortium-period">Liquidación seleccionada</label><select id="selected-consortium-period" className="form-select" value={selectedPeriodId} onChange={(e) => setSelectedPeriodId(e.target.value)}><option value="">Seleccionar...</option>{periods.map((period) => <option key={period.id} value={period.id}>{getConsortiumAccountingPeriodLabel(period)} · {getConsortiumPeriodStatus(period.status).label}</option>)}</select></div>
            {selectedPeriod && <div className="col-lg-4"><span className={`badge ${periodState.badge} me-2`}>{periodState.label}</span><span className="text-muted small d-block">1.º vencimiento: {selectedPeriod.dueDate}</span>{selectedPeriod.earlyPaymentDate && <span className="text-success small d-block">Pronto pago: {selectedPeriod.earlyPaymentDate} · {selectedPeriod.earlyPaymentDiscountPercent || 0}% bonif.</span>}{selectedPeriod.secondDueDate && <span className="text-warning small d-block">2.º vencimiento: {selectedPeriod.secondDueDate} · {selectedPeriod.secondDueSurchargePercent || 0}% recargo</span>}</div>}
          </div>
        </div>
      </section>

      {canManage && selectedPeriod?.status === "draft" && (
        <section className="card border-0 shadow-sm mb-4">
          <div className="card-body p-4">
            <div className="d-flex flex-wrap justify-content-between gap-2 mb-3"><div><h2 className="h5 mb-1">Gastos del borrador</h2><p className="text-muted small mb-0">Cada gasto puede prorratearse por coeficiente, partes iguales o una unidad determinada.</p></div><strong className="consortium-money">Total: {formatConsortiumMoney(draftTotal, selectedPeriod.currency)}</strong></div>
            <ConsortiumMonthlyLiquidationAssistant
              currency={selectedPeriod.currency || consortium.currency}
              disabled={Boolean(operation)}
              documents={selectedExpenseDocuments}
              draftDirty={draftExpensesDirty}
              expenses={periodExpenses}
              previousPeriod={previousMonthlyPeriod}
              recurringExpenses={recurringExpenses}
              units={activeUnits}
              onApplyPrevious={applyPreviousPeriodExpenses}
              onApplyRecurring={applyRecurringExpenses}
              onRemoveRecurring={removeRecurringExpense}
              onSaveAsRecurring={saveDraftAsRecurring}
              onSaveDraft={handleSaveExpenses}
            />
            <div className="row g-4">
              <div className="col-lg-5">
                <form className="rounded border bg-light p-3" id="consortium-expense-form" onSubmit={addExpense}>
                  <div className="d-flex justify-content-between align-items-center gap-2 mb-2"><h3 className="h6 mb-0">{editingExpenseId ? "Editar gasto" : "Agregar gasto"}</h3>{editingExpenseId && <button className="btn btn-sm btn-link" type="button" onClick={cancelExpenseEdit}>Cancelar edición</button>}</div>
                  <div className="mb-3"><label className="form-label">Concepto *</label><input className="form-control" value={expenseForm.concept} onChange={(e) => setExpenseForm((c) => ({ ...c, concept: e.target.value }))} required /></div>
                  <div className="row g-3 mb-3"><div className="col-md-6"><label className="form-label">Tipo</label><select className="form-select" value={expenseForm.category} onChange={(e) => setExpenseForm((c) => ({ ...c, category: e.target.value }))}>{CONSORTIUM_EXPENSE_CATEGORIES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></div><div className="col-md-6"><label className="form-label">Importe</label><input className="form-control" inputMode="decimal" placeholder="0,00" value={expenseForm.amountMajor} onChange={(e) => setExpenseForm((c) => ({ ...c, amountMajor: e.target.value }))} required /></div></div>
                  <div className="mb-3"><label className="form-label">Distribución</label><select className="form-select" value={expenseForm.distributionMode} onChange={(e) => setExpenseForm((c) => ({ ...c, distributionMode: e.target.value, specificUnitId: "", coefficientGroupId: e.target.value === "coefficient" ? (c.coefficientGroupId || "general") : "" }))}>{CONSORTIUM_DISTRIBUTION_MODES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></div>
                  {expenseForm.distributionMode === "coefficient" && <div className="mb-3"><label className="form-label">Grupo de coeficientes</label><select className="form-select" value={expenseForm.coefficientGroupId || "general"} onChange={(e) => setExpenseForm((c) => ({ ...c, coefficientGroupId: e.target.value }))}>{(consortium.coefficientGroups || [{ id: "general", name: "Gastos generales" }]).filter((group) => group.active !== false).map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></div>}
                  {expenseForm.distributionMode === "specific" && <div className="mb-3"><label className="form-label">Unidad</label><select className="form-select" value={expenseForm.specificUnitId} onChange={(e) => setExpenseForm((c) => ({ ...c, specificUnitId: e.target.value }))}><option value="">Seleccionar...</option>{activeUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.code}</option>)}</select></div>}
                  <div className="mb-3"><label className="form-label">Notas</label><input className="form-control" value={expenseForm.notes} onChange={(e) => setExpenseForm((c) => ({ ...c, notes: e.target.value }))} /></div>
                  <button className="btn btn-outline-primary w-100" type="submit">{editingExpenseId ? "Actualizar gasto" : "Agregar al borrador"}</button>
                </form>
              </div>
              <div className="col-lg-7">
                <div className="list-group consortium-expense-list mb-3">
                  {periodExpenses.map((expense) => (
                    <div className="list-group-item" key={expense.id}>
                      <div className="d-flex justify-content-between gap-3"><div><strong>{expense.concept}</strong><div className="small text-muted">{CONSORTIUM_EXPENSE_CATEGORIES.find((item) => item.id === expense.category)?.label} · {CONSORTIUM_DISTRIBUTION_MODES.find((item) => item.id === expense.distributionMode)?.label}{expense.distributionMode === "coefficient" && ` · ${(consortium.coefficientGroups || []).find((group) => group.id === expense.coefficientGroupId)?.name || "Gastos generales"}`}</div>{expense.notes && <small className="text-muted d-block mt-1">{expense.notes}</small>}</div><div className="text-end"><strong className="consortium-money">{formatConsortiumMoney(expense.amountMinor, selectedPeriod.currency)}</strong><div className="d-flex justify-content-end gap-2"><button className="btn btn-sm btn-link p-0" type="button" onClick={() => editExpense(expense)}>Editar</button><button className="btn btn-sm btn-link text-danger p-0" type="button" onClick={() => removeExpense(expense.id)}>Quitar</button></div></div></div>
                    </div>
                  ))}
                  {!periodExpenses.length && <div className="list-group-item text-center text-muted py-4">Todavía no hay gastos.</div>}
                </div>
                <div className="d-flex flex-wrap justify-content-end gap-2"><button className="btn btn-outline-secondary" disabled={Boolean(operation) || !draftExpensesDirty} type="button" onClick={handleSaveExpenses}>{draftExpensesDirty ? "Guardar borrador" : "Borrador guardado"}</button><button className="btn btn-primary" disabled={Boolean(operation) || !periodExpenses.length || !activeUnits.length} type="button" onClick={issuePeriod}>Emitir expensas</button></div>
              </div>
            </div>
          </div>
        </section>
      )}

      {selectedPeriod && (
        <ConsortiumExpenseDocumentsPanel
          inmobiliariaId={activeInmobiliariaId}
          consortiumId={consortiumId}
          period={selectedPeriod}
          expenses={selectedPeriod.status === "draft" ? periodExpenses : selectedPeriod.expenses || []}
          documents={selectedExpenseDocuments}
          supplierObligations={supplierObligations}
          coefficientGroups={consortium.coefficientGroups || []}
          canManage={canManage}
          disabled={Boolean(operation)}
          beforeUpload={selectedPeriod.status === "draft" ? () => saveExpenses({ showSuccess: false }) : undefined}
          onIncorporateAiDocuments={incorporateAiExpenseDocuments}
          onPreparePayable={prepareExpensePayable}
          onChanged={load}
        />
      )}

      {selectedPeriod && selectedPeriod.status !== "draft" && !selectedPeriod.source && (
        <ConsortiumCommunicationsPanel
          inmobiliariaId={activeInmobiliariaId}
          consortium={{ id: consortiumId, ...consortium }}
          period={selectedPeriod}
          obligations={selectedObligations}
          units={activeUnits}
          canManage={canManage}
        />
      )}

      {selectedPeriod && selectedPeriod.status !== "draft" && (
        <section className="card border-0 shadow-sm mb-4">
          <div className="card-body p-4">
            <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3"><div><h2 className="h5 mb-1">{selectedPeriod.source === "penalty" ? "Débito por multa" : "Expensas emitidas"} · {getConsortiumAccountingPeriodLabel(selectedPeriod)}</h2><p className="text-muted small mb-0">Total {formatConsortiumMoney(periodSummary.total, selectedPeriod.currency)} · cobrado {formatConsortiumMoney(periodSummary.paid, selectedPeriod.currency)} · saldo {formatConsortiumMoney(periodSummary.balance, selectedPeriod.currency)}</p>{selectedPeriod.status === "closed" && <small className="text-success d-block mt-1">Cierre mensual confirmado{selectedPeriod.closeReview?.summary ? ` · ${selectedPeriod.closeReview.summary.warningCount || 0} advertencia(s) registradas` : ""}.</small>}</div>{canManage && selectedPeriod.status === "issued" && <button className="btn btn-outline-success" disabled={closeAssistantLoading || operation === "close-period"} type="button" onClick={openCloseAssistant}>{closeAssistantLoading ? "Controlando..." : "Revisar cierre mensual"}</button>}</div>
            {showCloseAssistant && <div id="consortium-monthly-close"><ConsortiumMonthlyCloseAssistant
              acknowledged={closeAcknowledged}
              checklist={closeChecklist}
              consortiumId={consortiumId}
              currency={selectedPeriod.currency || consortium.currency}
              loading={closeAssistantLoading}
              note={closeNote}
              operation={operation}
              onAcknowledgedChange={setCloseAcknowledged}
              onClose={() => setShowCloseAssistant(false)}
              onConfirm={closePeriod}
              onNavigate={navigateFromCloseAssistant}
              onNoteChange={setCloseNote}
              onRefresh={refreshCloseChecklist}
            /></div>}
            <ConsortiumPaymentReportsPanel
              reports={paymentReports}
              periodId={selectedPeriod.id}
              canManage={canManage}
              operation={operation}
              onApprove={approvePaymentReport}
              onReject={rejectPaymentReport}
            />
            <div className="table-responsive">
              <table className="table table-hover">
                <thead><tr><th>Unidad</th><th>Ordinarias</th><th>Extraordinarias</th><th>Multas</th><th>Total</th><th>Cobrado</th><th>Saldo</th><th>Estado</th><th className="text-end">Acciones</th></tr></thead>
                <tbody>
                  {selectedObligations.map((obligation) => {
                    const status = getConsortiumObligationStatus(obligation);
                    const state = getConsortiumObligationStatusLabel(status);
                    return <tr key={obligation.id}><td><strong>{obligation.unitSnapshot?.code || obligation.unitId}</strong><div className="small text-muted">{obligation.unitSnapshot?.ownerName || obligation.unitSnapshot?.occupantName || "Sin responsable"}</div></td><td className="consortium-money">{formatConsortiumMoney(obligation.ordinaryMinor, obligation.currency)}</td><td className="consortium-money">{formatConsortiumMoney(obligation.extraordinaryMinor, obligation.currency)}</td><td className="consortium-money">{formatConsortiumMoney(obligation.penaltyMinor, obligation.currency)}</td><td className="consortium-money"><div>{formatConsortiumMoney(obligation.totalAmountMinor, obligation.currency)}</div>{obligation.earlyPaymentAmountMinor < obligation.baseAmountMinor && <small className="text-success">Pronto pago: {formatConsortiumMoney(obligation.earlyPaymentAmountMinor, obligation.currency)}</small>}{obligation.secondDueAmountMinor > obligation.baseAmountMinor && <small className="text-warning d-block">2.º: {formatConsortiumMoney(obligation.secondDueAmountMinor, obligation.currency)}</small>}</td><td className="consortium-money">{formatConsortiumMoney(obligation.paidAmountMinor, obligation.currency)}</td><td className="consortium-money fw-semibold">{formatConsortiumMoney(obligation.balanceMinor, obligation.currency)}</td><td><span className={`badge ${state.badge}`}>{state.label}</span></td><td className="text-end"><div className="btn-group btn-group-sm"><Link className="btn btn-outline-primary" to={`/admin/consorcios/${consortiumId}/liquidaciones/${obligation.id}`}>Liquidación</Link><Link className="btn btn-outline-secondary" to={`/admin/consorcios/${consortiumId}/unidades/${obligation.unitId}/cuenta-corriente`}>Cuenta</Link>{canManage && obligation.source !== "penalty" && <button className="btn btn-outline-warning" type="button" onClick={() => selectAdjustment(obligation)}>Ajustar</button>}{canManage && Number(obligation.balanceMinor || 0) > 0 && <button className="btn btn-outline-success" type="button" onClick={() => selectPayment(obligation)}>Cobrar</button>}</div></td></tr>;
                  })}
                </tbody>
              </table>
            </div>

            {canManage && adjustmentForm.obligationId && (
              <form id="consortium-adjustment-form" className="rounded border border-warning bg-warning-subtle p-3 mt-4" onSubmit={submitAdjustment}>
                <div className="d-flex justify-content-between align-items-center mb-3"><div><h3 className="h6 mb-1">Rectificar liquidación emitida</h3><small className="text-muted">La liquidación original se conserva y el cambio queda asentado como movimiento independiente.</small></div><button className="btn btn-sm btn-link" type="button" onClick={() => setAdjustmentForm(emptyAdjustmentForm())}>Cancelar</button></div>
                <div className="row g-3">
                  <div className="col-md-2"><label className="form-label">Movimiento</label><select className="form-select" value={adjustmentForm.type} onChange={(e) => setAdjustmentForm((c) => ({ ...c, type: e.target.value, category: e.target.value === "debit" && c.category === "interest" ? "ordinary" : c.category }))}><option value="debit">Nota de débito</option><option value="credit">Nota de crédito</option></select></div>
                  <div className="col-md-2"><label className="form-label">Tipo de cargo</label><select className="form-select" value={adjustmentForm.category} onChange={(e) => setAdjustmentForm((c) => ({ ...c, category: e.target.value }))}>{CONSORTIUM_EXPENSE_CATEGORIES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}{adjustmentForm.type === "credit" && <option value="interest">Interés por mora</option>}</select></div>
                  <div className="col-md-2"><label className="form-label">Importe</label><input className="form-control" inputMode="decimal" value={adjustmentForm.amountMajor} onChange={(e) => setAdjustmentForm((c) => ({ ...c, amountMajor: e.target.value }))} required /></div>
                  <div className="col-md-2"><label className="form-label">Fecha</label><input className="form-control" type="date" value={adjustmentForm.effectiveDate} onChange={(e) => setAdjustmentForm((c) => ({ ...c, effectiveDate: e.target.value }))} required /></div>
                  <div className="col-md-4"><label className="form-label">Motivo *</label><input className="form-control" value={adjustmentForm.reason} onChange={(e) => setAdjustmentForm((c) => ({ ...c, reason: e.target.value }))} required /></div>
                  <div className="col-12 text-end"><button className="btn btn-warning" disabled={operation === "adjustment"} type="submit">{operation === "adjustment" ? "Registrando..." : "Confirmar rectificación"}</button></div>
                </div>
              </form>
            )}

            {canManage && paymentForm.obligationId && (
              <form id="consortium-payment-form" className="rounded border bg-light p-3 mt-4" onSubmit={submitPayment}>
                <div className="d-flex justify-content-between align-items-center mb-3"><div><h3 className="h6 mb-0">Registrar cobro</h3>{paymentSchedule && <small className="text-muted">{paymentSchedule.earlyPaymentDate && paymentSchedule.earlyPaymentDiscountMinor > 0 && `Pronto pago: ${formatConsortiumMoney(paymentSchedule.earlyPaymentAmountMinor, paymentObligation.currency)} · `}Primer vencimiento: {formatConsortiumMoney(paymentSchedule.dueAmountMinor, paymentObligation.currency)}{paymentSchedule.secondDueDate && paymentSchedule.secondDueSurchargeMinor > 0 && ` · Segundo: ${formatConsortiumMoney(paymentSchedule.secondDueAmountMinor, paymentObligation.currency)}`}</small>}</div><button className="btn btn-sm btn-link" type="button" onClick={() => setPaymentForm((c) => ({ ...c, obligationId: "" }))}>Cancelar</button></div>
                <div className="row g-3">
                  <div className="col-md-3"><label className="form-label">Importe</label><input className="form-control" inputMode="decimal" value={paymentForm.amountMajor} onChange={(e) => setPaymentForm((c) => ({ ...c, amountMajor: e.target.value }))} required /></div>
                  <div className="col-md-3"><label className="form-label">Fecha</label><input className="form-control" type="date" max={todayKey()} value={paymentForm.date} onChange={(e) => setPaymentForm((current) => ({ ...current, date: e.target.value, amountMajor: paymentSchedule ? minorToMajorInput(getConsortiumScheduledAmountForDate({ schedule: paymentSchedule, paymentDate: e.target.value })) : current.amountMajor }))} required /><small className="text-muted">El importe se ajusta al vencimiento aplicable.</small></div>
                  <div className="col-md-3"><label className="form-label">Medio</label><select className="form-select" value={paymentForm.method} onChange={(e) => setPaymentForm((c) => ({ ...c, method: e.target.value }))}>{CONSORTIUM_PAYMENT_METHODS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></div>
                  <div className="col-md-3"><label className="form-label">Referencia</label><input className="form-control" value={paymentForm.reference} onChange={(e) => setPaymentForm((c) => ({ ...c, reference: e.target.value }))} /></div>
                  <div className="col-md-5"><label className="form-label">Ingresar fondos en</label><select className="form-select" value={paymentForm.treasuryAccountId} onChange={(e) => setPaymentForm((c) => ({ ...c, treasuryAccountId: e.target.value }))}><option value="">No afectar tesorería</option>{treasuryAccounts.filter((item) => item.active !== false).map((item) => <option key={item.id} value={item.id}>{item.name} · {formatConsortiumMoney(item.currentBalanceMinor, item.currency)}</option>)}</select><small className="text-muted">Si elegís una cuenta, el cobro generará el ingreso automáticamente.</small></div>
                  <div className="col-md-7"><label className="form-label">Observaciones</label><input className="form-control" value={paymentForm.notes} onChange={(e) => setPaymentForm((c) => ({ ...c, notes: e.target.value }))} /></div>
                  <div className="col-12 text-end"><button className="btn btn-success" disabled={operation === "payment"} type="submit">Confirmar cobro</button></div>
                </div>
              </form>
            )}
          </div>
        </section>
      )}
      </>}
    </main>
  );
};

export default ConsortiumDetailPage;
