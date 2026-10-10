import { useEffect, useMemo, useState } from "react";

import {
  calculateConsortiumAssessments,
  formatConsortiumMoney,
  getConsortiumAccountingPeriodLabel,
  majorToMinor,
  minorToMajorInput,
} from "../utils/consorcio.helpers";

const ConsortiumMonthlyLiquidationAssistant = ({
  currency = "ARS",
  disabled = false,
  documents = [],
  draftDirty = false,
  expenses = [],
  previousPeriod = null,
  recurringExpenses = [],
  units = [],
  onApplyPrevious,
  onApplyRecurring,
  onRemoveRecurring,
  onSaveAsRecurring,
  onSaveDraft,
}) => {
  const [open, setOpen] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedTemplates, setSelectedTemplates] = useState({});
  const [templateAmounts, setTemplateAmounts] = useState({});

  useEffect(() => {
    setSelectedTemplates(Object.fromEntries(recurringExpenses.map((item) => [item.id, true])));
    setTemplateAmounts(Object.fromEntries(
      recurringExpenses.map((item) => [item.id, minorToMajorInput(item.amountMinor)]),
    ));
  }, [recurringExpenses]);

  const preview = useMemo(() => {
    if (!expenses.length || !units.length) return { assessments: [], error: "" };
    try {
      return {
        ...calculateConsortiumAssessments({ units, expenses }),
        error: "",
      };
    } catch (error) {
      return { assessments: [], error: error.message || "No se pudo calcular la vista previa." };
    }
  }, [expenses, units]);

  const activeDocuments = useMemo(
    () => documents.filter((item) => item.voided !== true),
    [documents],
  );
  const documentedExpenseIds = useMemo(
    () => new Set(activeDocuments.map((item) => item.expenseId)),
    [activeDocuments],
  );
  const documentedCount = expenses.filter((item) => documentedExpenseIds.has(item.id)).length;
  const selectedRecurringCount = recurringExpenses.filter(
    (item) => selectedTemplates[item.id] && majorToMinor(templateAmounts[item.id]) > 0,
  ).length;

  const applyRecurring = () => {
    const selected = recurringExpenses
      .filter((item) => selectedTemplates[item.id])
      .map((item) => ({
        ...item,
        amountMinor: majorToMinor(templateAmounts[item.id]),
      }))
      .filter((item) => item.amountMinor > 0);
    onApplyRecurring?.(selected);
  };

  const checklist = [
    {
      ok: units.length > 0,
      label: "Padrón activo",
      detail: units.length ? `${units.length} unidad(es) participarán del prorrateo.` : "Cargá al menos una unidad activa.",
    },
    {
      ok: expenses.length > 0,
      label: "Gastos cargados",
      detail: expenses.length ? `${expenses.length} concepto(s) por ${formatConsortiumMoney(preview.totalExpensesMinor || 0, currency)}.` : "Copiá una base o agregá los gastos del mes.",
    },
    {
      ok: expenses.length > 0 && !preview.error,
      label: "Prorrateo validado",
      detail: preview.error || (preview.assessments.length ? `La vista previa cubre ${preview.assessments.length} unidad(es).` : "Pendiente de cálculo."),
    },
    {
      ok: !draftDirty,
      label: "Borrador guardado",
      detail: draftDirty ? "Hay cambios locales pendientes de guardar." : "El borrador coincide con la información almacenada.",
    },
  ];

  return (
    <section className="rounded border border-primary-subtle bg-primary-subtle p-3 mb-4 consortium-monthly-liquidation-assistant">
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-3">
        <div>
          <span className="badge text-bg-primary mb-2">Preparación asistida</span>
          <h3 className="h5 mb-1">Armá la liquidación del mes sin empezar de cero</h3>
          <p className="text-muted small mb-0">Reutilizá conceptos habituales, actualizá importes y controlá el prorrateo antes de emitir.</p>
        </div>
        <button className="btn btn-sm btn-outline-primary" type="button" onClick={() => setOpen((current) => !current)}>{open ? "Ocultar asistente" : "Abrir asistente"}</button>
      </div>

      {open && <div className="mt-4">
        <div className="row g-3 mb-4">
          <div className="col-lg-6">
            <div className="rounded border bg-white p-3 h-100">
              <span className="small text-uppercase text-muted">Opción 1</span>
              <h4 className="h6 mt-1">Usar el mes anterior como base</h4>
              {previousPeriod ? <>
                <p className="small text-muted mb-3">{getConsortiumAccountingPeriodLabel(previousPeriod)} · {(previousPeriod.expenses || []).length} gasto(s). Se copian solo los conceptos y valores; los comprobantes no se duplican.</p>
                <button className="btn btn-outline-primary w-100" disabled={disabled || !(previousPeriod.expenses || []).length} type="button" onClick={onApplyPrevious}>Copiar gastos del período anterior</button>
              </> : <p className="small text-muted mb-0">Todavía no hay un período mensual anterior con gastos para reutilizar.</p>}
            </div>
          </div>

          <div className="col-lg-6">
            <div className="rounded border bg-white p-3 h-100">
              <span className="small text-uppercase text-muted">Opción 2</span>
              <h4 className="h6 mt-1">Aplicar gastos recurrentes</h4>
              {!recurringExpenses.length && <p className="small text-muted">Guardá un borrador habitual como recurrente y quedará disponible para los próximos meses.</p>}
              <div className="vstack gap-2 mb-3">
                {recurringExpenses.map((item) => <div className="d-flex align-items-center gap-2" key={item.id}>
                  <input aria-label={`Usar ${item.concept}`} className="form-check-input mt-0" type="checkbox" checked={Boolean(selectedTemplates[item.id])} onChange={(event) => setSelectedTemplates((current) => ({ ...current, [item.id]: event.target.checked }))} />
                  <span className="small flex-grow-1 text-truncate" title={item.concept}>{item.concept}</span>
                  <input aria-label={`Importe de ${item.concept}`} className="form-control form-control-sm consortium-recurring-amount" inputMode="decimal" value={templateAmounts[item.id] || ""} onChange={(event) => setTemplateAmounts((current) => ({ ...current, [item.id]: event.target.value }))} />
                  <button aria-label={`Quitar ${item.concept} de recurrentes`} className="btn btn-sm btn-link text-danger px-1" disabled={disabled} type="button" onClick={() => onRemoveRecurring?.(item.id)}>×</button>
                </div>)}
              </div>
              <button className="btn btn-outline-primary w-100" disabled={disabled || !selectedRecurringCount} type="button" onClick={applyRecurring}>Incorporar {selectedRecurringCount || ""} recurrente{selectedRecurringCount === 1 ? "" : "s"}</button>
            </div>
          </div>
        </div>

        <div className="rounded border bg-white p-3 mb-3">
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
            <div><h4 className="h6 mb-1">Control previo</h4><p className="small text-muted mb-0">El asistente no emite nada: primero podés revisar y guardar el borrador.</p></div>
            <div className="d-flex flex-wrap gap-2">
              <button className="btn btn-sm btn-outline-secondary" disabled={disabled || !expenses.length} type="button" onClick={onSaveAsRecurring}>Guardar gastos actuales como recurrentes</button>
              <button className="btn btn-sm btn-primary" disabled={disabled || !draftDirty} type="button" onClick={onSaveDraft}>{draftDirty ? "Guardar cambios" : "Borrador guardado"}</button>
            </div>
          </div>
          <div className="row g-2">
            {checklist.map((item) => <div className="col-md-6" key={item.label}><div className={`rounded border p-2 h-100 ${item.ok ? "border-success-subtle" : "border-warning-subtle bg-warning-subtle"}`}><strong className="small d-block"><span className={item.ok ? "text-success" : "text-warning-emphasis"}>{item.ok ? "✓" : "!"}</span> {item.label}</strong><span className="small text-muted">{item.detail}</span></div></div>)}
          </div>
          {expenses.length > 0 && <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 border-top mt-3 pt-3"><small className="text-muted">Respaldo documental: {documentedCount} de {expenses.length} gasto(s). Después de emitir, vinculá en Tesorería las facturas que queden pendientes de pago.</small><button className="btn btn-sm btn-outline-dark" disabled={Boolean(preview.error)} type="button" onClick={() => setShowPreview((current) => !current)}>{showPreview ? "Ocultar prorrateo" : "Ver prorrateo por unidad"}</button></div>}
        </div>

        {showPreview && !preview.error && <div className="rounded border bg-white overflow-hidden">
          <div className="table-responsive consortium-assessment-preview">
            <table className="table table-sm table-hover align-middle mb-0">
              <thead className="table-light"><tr><th>Unidad</th><th className="text-end">Ordinarias</th><th className="text-end">Extraordinarias</th><th className="text-end">Total estimado</th></tr></thead>
              <tbody>{preview.assessments.map((item) => <tr key={item.unitId}><td><strong>{item.unitSnapshot?.code || item.unitId}</strong><small className="text-muted d-block">{item.unitSnapshot?.ownerName || item.unitSnapshot?.occupantName || "Sin responsable informado"}</small></td><td className="text-end consortium-money">{formatConsortiumMoney(item.ordinaryMinor, currency)}</td><td className="text-end consortium-money">{formatConsortiumMoney(item.extraordinaryMinor, currency)}</td><td className="text-end consortium-money fw-semibold">{formatConsortiumMoney(item.totalAmountMinor, currency)}</td></tr>)}</tbody>
              <tfoot className="table-light"><tr><th>Total</th><th colSpan="2"></th><th className="text-end consortium-money">{formatConsortiumMoney(preview.totalAssessedMinor || 0, currency)}</th></tr></tfoot>
            </table>
          </div>
        </div>}
      </div>}
    </section>
  );
};

export default ConsortiumMonthlyLiquidationAssistant;
