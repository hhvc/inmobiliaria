import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";

import SEO from "../../components/SEO";
import { useAuth } from "../../context/auth/useAuth";
import { useActiveInmobiliariaModules } from "../../inmobiliaria/hooks/useActiveInmobiliariaModules";
import {
  getInternalPermissions,
  getInternalRoleForInmobiliaria,
  isGlobalRoot,
} from "../../inmobiliaria/utils/inmobiliariaPermissions";
import {
  getConsortiumBudgetVersions,
  getConsortiumBudgets,
  getConsortiumById,
  getConsortiumPeriods,
  getConsortiumUnits,
  saveConsortiumBudget,
} from "../services/consorcio.service";
import {
  buildConsortiumBudgetComparison,
  buildConsortiumBudgetCsv,
  buildConsortiumBudgetFromPeriods,
  buildConsortiumBudgetUnitProjection,
  CONSORTIUM_BUDGET_MONTHS,
  createConsortiumBudgetCategories,
  getDefaultConsortiumBudgetYear,
  normalizeConsortiumBudget,
} from "../utils/consorcioBudget.helpers";
import {
  formatConsortiumMoney,
  majorToMinor,
  minorToMajorInput,
} from "../utils/consorcio.helpers";
import "../consorcio.css";

const downloadCsv = (content, year) => {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `presupuesto-consorcio-${year}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const formatTimestamp = (value) => {
  const milliseconds = value?.toMillis?.() || Number(value?.seconds || 0) * 1000;
  return milliseconds ? new Date(milliseconds).toLocaleString("es-AR") : "Fecha pendiente";
};

const formatPercent = (value) => (
  Number.isFinite(value) ? `${value.toLocaleString("es-AR", { maximumFractionDigits: 1 })}%` : "—"
);

const ConsortiumBudgetPage = () => {
  const { id: consortiumId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { activeInmobiliariaId, loading: agencyLoading } = useActiveInmobiliariaModules();
  const requestedYearParam = searchParams.get("year");
  const requestedYear = requestedYearParam ? Number(requestedYearParam) : Number.NaN;
  const [selectedYear, setSelectedYear] = useState(
    Number.isInteger(requestedYear) ? requestedYear : getDefaultConsortiumBudgetYear(),
  );
  const [consortium, setConsortium] = useState(null);
  const [units, setUnits] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [versions, setVersions] = useState([]);
  const [draft, setDraft] = useState(null);
  const [projectionMonth, setProjectionMonth] = useState("01");
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [operation, setOperation] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const canManage = useMemo(() => {
    const role = getInternalRoleForInmobiliaria(user, activeInmobiliariaId);
    return getInternalPermissions(role, isGlobalRoot(user)).canManageConsortiums;
  }, [activeInmobiliariaId, user]);

  const load = useCallback(async () => {
    if (!activeInmobiliariaId || !consortiumId) return;
    try {
      setLoading(true);
      setError("");
      const [consortiumData, unitData, periodData, budgetData, versionData] = await Promise.all([
        getConsortiumById(activeInmobiliariaId, consortiumId),
        getConsortiumUnits(activeInmobiliariaId, consortiumId),
        getConsortiumPeriods(activeInmobiliariaId, consortiumId),
        getConsortiumBudgets(activeInmobiliariaId, consortiumId),
        getConsortiumBudgetVersions(activeInmobiliariaId, { consortiumId }),
      ]);
      if (!consortiumData) throw new Error("El consorcio no existe.");
      setConsortium(consortiumData);
      setUnits(unitData.filter((item) => item.active !== false && item.deleted !== true));
      setPeriods(periodData);
      setBudgets(budgetData);
      setVersions(versionData);
    } catch (loadError) {
      setError(loadError.message || "No se pudo preparar el presupuesto.");
    } finally {
      setLoading(false);
    }
  }, [activeInmobiliariaId, consortiumId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!consortium) return;
    const existing = budgets.find((item) => Number(item.year) === selectedYear);
    setDraft(existing ? { ...existing } : normalizeConsortiumBudget({
      year: selectedYear,
      currency: consortium.currency || "ARS",
      categories: createConsortiumBudgetCategories(
        consortium.coefficientGroups?.find((item) => item.active !== false)?.id || "general",
      ),
    }));
    setDirty(false);
  }, [budgets, consortium, selectedYear]);

  const changeYear = (year) => {
    if (dirty && !window.confirm("Hay cambios sin guardar. ¿Cambiar de ejercicio y descartarlos?")) return;
    const normalizedYear = Math.min(2100, Math.max(2000, Math.trunc(Number(year) || 0)));
    setSelectedYear(normalizedYear);
    setSearchParams({ year: normalizedYear.toString() }, { replace: true });
    setError("");
    setSuccess("");
  };

  const updateDraft = (updater) => {
    setDraft((current) => updater(current));
    setDirty(true);
    setSuccess("");
  };

  const updateCategory = (categoryId, updater) => updateDraft((current) => ({
    ...current,
    categories: current.categories.map((category) => (
      category.id === categoryId ? updater(category) : category
    )),
  }));

  const updateMonth = (categoryId, monthId, value) => updateCategory(categoryId, (category) => ({
    ...category,
    months: { ...category.months, [monthId]: majorToMinor(value) },
  }));

  const distributeAnnual = (categoryId, value) => {
    const totalMinor = majorToMinor(value);
    const base = Math.floor(totalMinor / 12);
    const remainder = totalMinor - (base * 12);
    updateCategory(categoryId, (category) => ({
      ...category,
      months: Object.fromEntries(CONSORTIUM_BUDGET_MONTHS.map((month, index) => [
        month.id,
        base + (index < remainder ? 1 : 0),
      ])),
    }));
  };

  const comparison = useMemo(() => buildConsortiumBudgetComparison({
    budget: draft || { year: selectedYear },
    periods,
  }), [draft, periods, selectedYear]);

  const projection = useMemo(() => {
    try {
      return {
        ...buildConsortiumBudgetUnitProjection({ budget: draft, units, monthId: projectionMonth }),
        error: "",
      };
    } catch (projectionError) {
      return { assessments: [], error: projectionError.message || "No se pudo calcular la proyección." };
    }
  }, [draft, projectionMonth, units]);

  const currentBudget = budgets.find((item) => Number(item.year) === selectedYear) || null;
  const yearOptions = [...new Set([
    ...Array.from({ length: 8 }, (_, index) => new Date().getFullYear() - 2 + index),
    ...budgets.map((item) => Number(item.year)).filter(Number.isInteger),
    selectedYear,
  ])].sort((first, second) => second - first);
  const currentVersions = versions
    .filter((item) => item.budgetId === `${consortiumId}_${selectedYear}`)
    .sort((first, second) => Number(second.version || 0) - Number(first.version || 0));

  const copyPreviousBudget = () => {
    const previous = budgets.find((item) => Number(item.year) === selectedYear - 1);
    if (!previous) {
      setError(`No existe un presupuesto guardado para ${selectedYear - 1}.`);
      return;
    }
    setDraft(normalizeConsortiumBudget({ ...previous, year: selectedYear, status: "draft", ownerVisible: false }));
    setDirty(true);
    setError("");
    setSuccess(`Se copió el presupuesto ${selectedYear - 1}. Revisalo antes de guardarlo.`);
  };

  const copyPreviousActual = () => {
    const generated = buildConsortiumBudgetFromPeriods({
      periods,
      sourceYear: selectedYear - 1,
      targetYear: selectedYear,
      currency: consortium?.currency || "ARS",
      coefficientGroupId: consortium?.coefficientGroups?.find((item) => item.active !== false)?.id,
    });
    if (!generated.categories.some((item) => Object.values(item.months).some((value) => value > 0))) {
      setError(`No hay liquidaciones emitidas de ${selectedYear - 1} para usar como base.`);
      return;
    }
    setDraft({
      ...generated,
      alertThresholdPercent: draft?.alertThresholdPercent ?? 10,
      notes: draft?.notes || "",
    });
    setDirty(true);
    setError("");
    setSuccess(`Se copiaron los gastos ejecutados de ${selectedYear - 1}. Revisalos antes de guardar.`);
  };

  const save = async (status) => {
    if (!draft || !canManage) return;
    if (status === "approved" && !window.confirm(
      `¿Aprobar la versión del presupuesto ${selectedYear}? Quedará registrada en el historial.`,
    )) return;
    try {
      setOperation(status);
      setError("");
      setSuccess("");
      await saveConsortiumBudget({
        inmobiliariaId: activeInmobiliariaId,
        consortiumId,
        value: { ...draft, status },
      });
      setSuccess(status === "approved"
        ? "Presupuesto aprobado y versionado correctamente."
        : "Borrador presupuestario guardado en una nueva versión.");
      setDirty(false);
      await load();
    } catch (saveError) {
      setError(saveError.message || "No se pudo guardar el presupuesto.");
    } finally {
      setOperation("");
    }
  };

  if (loading || agencyLoading) {
    return <main className="container py-5 text-center">Preparando presupuesto anual...</main>;
  }
  if (!consortium || !draft) {
    return <main className="container py-5"><div className="alert alert-danger">{error || "El consorcio no existe."}</div></main>;
  }

  const currency = draft.currency || consortium.currency || "ARS";
  const activeGroups = (consortium.coefficientGroups || [{ id: "general", name: "Gastos generales", active: true }])
    .filter((item) => item.active !== false);

  return (
    <main className="container-fluid container-xxl py-4 consortium-budget-page">
      <SEO title={`Presupuesto ${selectedYear} | ${consortium.name}`} noIndex />
      <header className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
        <div>
          <Link className="text-decoration-none" to={`/admin/consorcios/${consortiumId}`}>← Volver al consorcio</Link>
          <h1 className="h3 mt-3 mb-1">Presupuesto anual y control de desvíos</h1>
          <p className="text-muted mb-0">{consortium.legalName || consortium.name}</p>
        </div>
        <div className="d-flex flex-wrap align-items-end gap-2">
          <div><label className="form-label small">Ejercicio</label><select className="form-select" value={selectedYear} onChange={(event) => changeYear(event.target.value)}>{yearOptions.map((year) => <option key={year} value={year}>{year}</option>)}</select></div>
          <button className="btn btn-outline-secondary" type="button" onClick={() => downloadCsv(buildConsortiumBudgetCsv(comparison), selectedYear)}>Exportar CSV</button>
          <button className="btn btn-outline-primary" type="button" onClick={() => window.print()}>Imprimir / PDF</button>
        </div>
      </header>

      {error && <div className="alert alert-danger">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}
      {dirty && <div className="alert alert-warning py-2">Hay cambios locales sin guardar.</div>}

      <section className="row g-3 mb-4">
        <div className="col-sm-6 col-xl-3"><div className="card border-0 shadow-sm h-100"><div className="card-body"><span className="text-muted small text-uppercase">Presupuesto anual</span><strong className="fs-4 d-block consortium-money">{formatConsortiumMoney(comparison.plannedMinor, currency)}</strong></div></div></div>
        <div className="col-sm-6 col-xl-3"><div className="card border-0 shadow-sm h-100"><div className="card-body"><span className="text-muted small text-uppercase">Ejecutado</span><strong className="fs-4 d-block consortium-money">{formatConsortiumMoney(comparison.actualMinor, currency)}</strong><small className="text-muted">Solo liquidaciones emitidas o cerradas</small></div></div></div>
        <div className="col-sm-6 col-xl-3"><div className={`card border-0 shadow-sm h-100 ${comparison.varianceMinor > 0 ? "bg-warning-subtle" : ""}`}><div className="card-body"><span className="text-muted small text-uppercase">Desvío anual</span><strong className={`fs-4 d-block consortium-money ${comparison.varianceMinor > 0 ? "text-danger" : "text-success"}`}>{formatConsortiumMoney(comparison.varianceMinor, currency)}</strong><small>{formatPercent(comparison.variancePercent)}</small></div></div></div>
        <div className="col-sm-6 col-xl-3"><div className="card border-0 shadow-sm h-100"><div className="card-body"><span className="text-muted small text-uppercase">Estado</span><strong className="fs-5 d-block">{currentBudget?.status === "approved" ? `Aprobado · v${currentBudget.version}` : currentBudget ? `Borrador · v${currentBudget.version}` : "Sin guardar"}</strong><small className="text-muted">{currentBudget?.publishedVersion ? `Última publicación: v${currentBudget.publishedVersion}${currentBudget.publishedOwnerVisible ? " · propietarios" : " · interna"}` : "Sin versión publicada"}</small></div></div></div>
      </section>

      {canManage && <section className="card border-0 shadow-sm mb-4 consortium-no-print"><div className="card-body p-4">
        <div className="d-flex flex-wrap justify-content-between align-items-start gap-3">
          <div><h2 className="h5 mb-1">Preparación asistida</h2><p className="text-muted small mb-0">Podés empezar desde el presupuesto o los gastos reales del ejercicio anterior.</p></div>
          <div className="d-flex flex-wrap gap-2"><button className="btn btn-outline-secondary" type="button" onClick={copyPreviousBudget}>Copiar presupuesto {selectedYear - 1}</button><button className="btn btn-outline-secondary" type="button" onClick={copyPreviousActual}>Usar ejecutado {selectedYear - 1}</button></div>
        </div>
        <div className="row g-3 mt-2"><div className="col-md-4"><label className="form-label">Alerta al superar el presupuesto</label><div className="input-group"><input className="form-control" min="0" max="500" step="0.1" type="number" value={draft.alertThresholdPercent} onChange={(event) => updateDraft((current) => ({ ...current, alertThresholdPercent: Number(event.target.value) }))} /><span className="input-group-text">%</span></div></div><div className="col-md-8"><label className="form-label">Notas del ejercicio</label><input className="form-control" value={draft.notes || ""} onChange={(event) => updateDraft((current) => ({ ...current, notes: event.target.value }))} /></div></div>
      </div></section>}

      <section className="card border-0 shadow-sm mb-4"><div className="card-body p-0 p-lg-3">
        <div className="p-3 pb-0"><h2 className="h5 mb-1">Plan mensual por rubro</h2><p className="text-muted small">El total anual se distribuye en partes iguales al editarlo; luego podés ajustar cada mes.</p></div>
        <div className="table-responsive consortium-budget-grid"><table className="table table-sm align-middle mb-0"><thead className="table-light"><tr><th className="consortium-budget-rubro">Rubro</th><th>Coeficiente</th>{CONSORTIUM_BUDGET_MONTHS.map((month) => <th className="text-end" key={month.id}>{month.shortLabel}</th>)}<th className="text-end">Anual</th></tr></thead><tbody>{draft.categories.map((category) => {
          const annual = Object.values(category.months).reduce((sum, amount) => sum + Number(amount || 0), 0);
          return <tr key={category.id}><th><span>{category.label}</span><small className="d-block text-muted">{category.expenseClass === "extraordinary" ? "Extraordinario" : category.id === "reserve" ? "Reserva" : "Ordinario"}</small></th><td><select aria-label={`Coeficiente de ${category.label}`} className="form-select form-select-sm consortium-budget-group" disabled={!canManage} value={category.coefficientGroupId || "general"} onChange={(event) => updateCategory(category.id, (current) => ({ ...current, coefficientGroupId: event.target.value }))}>{activeGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></td>{CONSORTIUM_BUDGET_MONTHS.map((month) => <td key={month.id}><input aria-label={`${category.label} ${month.label}`} className="form-control form-control-sm text-end consortium-budget-input" disabled={!canManage} inputMode="decimal" value={minorToMajorInput(category.months[month.id])} onChange={(event) => updateMonth(category.id, month.id, event.target.value)} /></td>)}<td><input aria-label={`Total anual de ${category.label}`} className="form-control form-control-sm text-end fw-semibold consortium-budget-input" disabled={!canManage} inputMode="decimal" value={minorToMajorInput(annual)} onChange={(event) => distributeAnnual(category.id, event.target.value)} /></td></tr>;
        })}</tbody></table></div>
      </div></section>

      {canManage && <section className="card border-0 shadow-sm mb-4 consortium-no-print"><div className="card-body p-4"><div className="form-check mb-3"><input className="form-check-input" id="budget-owner-visible" type="checkbox" checked={draft.ownerVisible === true} onChange={(event) => updateDraft((current) => ({ ...current, ownerVisible: event.target.checked }))} /><label className="form-check-label" htmlFor="budget-owner-visible"><strong>Mostrar el presupuesto aprobado a los propietarios</strong><span className="d-block text-muted small">Los ocupantes no acceden. Un borrador nunca se publica.</span></label></div><div className="d-flex flex-wrap justify-content-end gap-2"><button className="btn btn-outline-secondary" disabled={Boolean(operation)} type="button" onClick={() => save("draft")}>{operation === "draft" ? "Guardando..." : "Guardar borrador y versión"}</button><button className="btn btn-primary" disabled={Boolean(operation) || comparison.plannedMinor <= 0} type="button" onClick={() => save("approved")}>{operation === "approved" ? "Aprobando..." : "Aprobar presupuesto"}</button></div></div></section>}

      <section className="card border-0 shadow-sm mb-4"><div className="card-body p-4"><h2 className="h5">Presupuestado vs. ejecutado</h2><p className="text-muted small">El ejecutado surge de los gastos de liquidaciones emitidas y cerradas del ejercicio.</p><div className="table-responsive"><table className="table table-hover align-middle"><thead><tr><th>Rubro</th><th className="text-end">Presupuestado</th><th className="text-end">Ejecutado</th><th className="text-end">Desvío</th><th className="text-end">%</th><th>Control</th></tr></thead><tbody>{comparison.categoryRows.map((row) => <tr key={row.id}><td>{row.label}</td><td className="text-end consortium-money">{formatConsortiumMoney(row.plannedMinor, currency)}</td><td className="text-end consortium-money">{formatConsortiumMoney(row.actualMinor, currency)}</td><td className={`text-end consortium-money ${row.varianceMinor > 0 ? "text-danger" : "text-success"}`}>{formatConsortiumMoney(row.varianceMinor, currency)}</td><td className="text-end">{formatPercent(row.variancePercent)}</td><td>{row.overThreshold ? <span className="badge text-bg-danger">Revisar</span> : row.actualMinor > 0 ? <span className="badge text-bg-success">Dentro del margen</span> : <span className="badge text-bg-light border">Sin ejecución</span>}</td></tr>)}</tbody></table></div></div></section>

      <div className="row g-4 mb-4">
        <div className="col-xl-5"><section className="card border-0 shadow-sm h-100"><div className="card-body p-4"><h2 className="h5">Control mensual</h2><div className="table-responsive"><table className="table table-sm align-middle"><thead><tr><th>Mes</th><th className="text-end">Plan</th><th className="text-end">Real</th><th></th></tr></thead><tbody>{comparison.monthRows.map((month) => <tr key={month.id}><td>{month.label}</td><td className="text-end consortium-money">{formatConsortiumMoney(month.plannedMinor, currency)}</td><td className="text-end consortium-money">{formatConsortiumMoney(month.actualMinor, currency)}</td><td>{month.overThreshold && <span className="badge text-bg-danger">+{formatPercent(month.variancePercent)}</span>}</td></tr>)}</tbody></table></div></div></section></div>
        <div className="col-xl-7"><section className="card border-0 shadow-sm h-100"><div className="card-body p-4"><div className="d-flex flex-wrap justify-content-between align-items-end gap-2 mb-3"><div><h2 className="h5 mb-1">Proyección por unidad</h2><p className="text-muted small mb-0">Estimación según los coeficientes elegidos; no genera expensas.</p></div><div><label className="form-label small">Mes</label><select className="form-select" value={projectionMonth} onChange={(event) => setProjectionMonth(event.target.value)}>{CONSORTIUM_BUDGET_MONTHS.map((month) => <option key={month.id} value={month.id}>{month.label}</option>)}</select></div></div>{projection.error && <div className="alert alert-warning">{projection.error}</div>}<div className="table-responsive"><table className="table table-sm align-middle"><thead><tr><th>Unidad</th><th>Responsable</th><th className="text-end">Estimación</th></tr></thead><tbody>{projection.assessments.map((assessment) => <tr key={assessment.unitId}><td><strong>{assessment.unitSnapshot?.code || assessment.unitId}</strong></td><td>{assessment.unitSnapshot?.ownerName || assessment.unitSnapshot?.occupantName || "Sin informar"}</td><td className="text-end consortium-money fw-semibold">{formatConsortiumMoney(assessment.totalAmountMinor, currency)}</td></tr>)}{!projection.assessments.length && <tr><td className="text-center text-muted py-4" colSpan="3">Cargá importes para ver la proyección del mes.</td></tr>}</tbody></table></div></div></section></div>
      </div>

      <section className="card border-0 shadow-sm"><div className="card-body p-4"><h2 className="h5">Historial de versiones</h2><p className="text-muted small">Cada guardado conserva una copia inalterable para auditoría.</p><div className="table-responsive"><table className="table table-sm align-middle"><thead><tr><th>Versión</th><th>Estado</th><th>Fecha</th><th>Visibilidad</th><th className="text-end">Total anual</th></tr></thead><tbody>{currentVersions.map((version) => {
        const versionComparison = buildConsortiumBudgetComparison({ budget: version, periods: [] });
        return <tr key={version.id}><td>v{version.version}</td><td><span className={`badge ${version.status === "approved" ? "text-bg-success" : "text-bg-secondary"}`}>{version.status === "approved" ? "Aprobado" : "Borrador"}</span></td><td>{formatTimestamp(version.createdAt)}</td><td>{version.ownerVisible ? "Propietarios" : "Interna"}</td><td className="text-end consortium-money">{formatConsortiumMoney(versionComparison.plannedMinor, version.currency || currency)}</td></tr>;
      })}{!currentVersions.length && <tr><td className="text-center text-muted py-4" colSpan="5">Todavía no hay versiones guardadas.</td></tr>}</tbody></table></div></div></section>
    </main>
  );
};

export default ConsortiumBudgetPage;
