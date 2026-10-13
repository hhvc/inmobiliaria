import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import SEO from "../../components/SEO";
import { useAuth } from "../../context/auth/useAuth";
import { useActiveInmobiliariaModules } from "../../inmobiliaria/hooks/useActiveInmobiliariaModules";
import {
  getInternalPermissions,
  getInternalRoleForInmobiliaria,
  isGlobalRoot,
} from "../../inmobiliaria/utils/inmobiliariaPermissions";
import {
  createConsortiumTreasuryReconciliation,
  downloadPrivateConsortiumDocument,
  getConsortiumById,
  getConsortiumTreasuryAccounts,
  getConsortiumTreasuryMovements,
  getConsortiumTreasuryReconciliations,
  registerConsortiumTreasuryMovement,
} from "../services/consorcio.service";
import {
  formatConsortiumMoney,
  getConsortiumTreasuryBookBalance,
  majorToMinor,
} from "../utils/consorcio.helpers";
import {
  buildConsortiumBankStatementReviewCsv,
  buildConsortiumTreasuryMovementDraftFromStatementRow,
  CONSORTIUM_BANK_STATEMENT_TEMPLATE,
  matchConsortiumBankStatementRows,
  parseConsortiumBankStatementCsv,
} from "../utils/consorcioTreasury.helpers";
import "../consorcio.css";

const todayKey = () => new Date().toISOString().slice(0, 10);
const formatDate = (value = "") => {
  if (!value) return "—";
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString("es-AR");
};
const formatTimestamp = (value) => {
  const milliseconds = value?.toMillis?.() || Number(value?.seconds || 0) * 1000;
  return milliseconds ? new Date(milliseconds).toLocaleString("es-AR") : "Fecha pendiente";
};

const downloadCsv = (content, fileName) => {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const fileSha256 = async (file) => {
  if (!globalThis.crypto?.subtle) return "";
  const digest = await globalThis.crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
};

const confidenceMeta = {
  high: { label: "Alta", badge: "text-bg-success" },
  medium: { label: "Revisar", badge: "text-bg-warning" },
  low: { label: "Baja", badge: "text-bg-secondary" },
  none: { label: "Sin coincidencia", badge: "text-bg-light border" },
};

const ConsortiumBankReconciliationPage = () => {
  const { id: consortiumId = "" } = useParams();
  const { activeInmobiliariaId, loading: agencyLoading } = useActiveInmobiliariaModules();
  const { user } = useAuth();
  const [consortium, setConsortium] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [movements, setMovements] = useState([]);
  const [reconciliations, setReconciliations] = useState([]);
  const [accountId, setAccountId] = useState("");
  const [statementFile, setStatementFile] = useState(null);
  const [statementFileHash, setStatementFileHash] = useState("");
  const [fileInputKey, setFileInputKey] = useState(0);
  const [preview, setPreview] = useState(null);
  const [selections, setSelections] = useState({});
  const [movementDraft, setMovementDraft] = useState(null);
  const [statementDate, setStatementDate] = useState(todayKey());
  const [statementBalanceMajor, setStatementBalanceMajor] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
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
      const [consortiumData, accountData, movementData, reconciliationData] = await Promise.all([
        getConsortiumById(activeInmobiliariaId, consortiumId),
        getConsortiumTreasuryAccounts(activeInmobiliariaId, consortiumId),
        getConsortiumTreasuryMovements(activeInmobiliariaId, consortiumId),
        getConsortiumTreasuryReconciliations(activeInmobiliariaId, consortiumId),
      ]);
      if (!consortiumData) throw new Error("El consorcio no existe.");
      setConsortium(consortiumData);
      setAccounts(accountData);
      setMovements(movementData);
      setReconciliations(reconciliationData);
      setAccountId((current) => current || accountData.find((item) => item.active !== false)?.id || "");
    } catch (loadError) {
      setError(loadError.message || "No se pudo preparar la conciliación bancaria.");
    } finally {
      setLoading(false);
    }
  }, [activeInmobiliariaId, consortiumId]);

  useEffect(() => { load(); }, [load]);

  const activeAccounts = useMemo(() => accounts.filter((item) => (
    item.active !== false && item.deleted !== true
  )), [accounts]);
  const selectedAccount = activeAccounts.find((item) => item.id === accountId) || null;
  const currency = selectedAccount?.currency || consortium?.currency || "ARS";
  const excludedMovementIds = useMemo(() => reconciliations
    .filter((item) => item.voided !== true)
    .flatMap((item) => item.statementImport?.matchedMovementIds || []), [reconciliations]);
  const matchedRows = useMemo(() => matchConsortiumBankStatementRows({
    rows: preview?.rows || [],
    movements,
    accountId,
    currency,
    excludedMovementIds,
  }), [accountId, currency, excludedMovementIds, movements, preview?.rows]);

  useEffect(() => {
    setSelections((current) => {
      const availableByRow = new Map(matchedRows.map((row) => [
        row.id,
        new Set(row.candidates.map(({ movement }) => movement.id)),
      ]));
      const next = Object.fromEntries(Object.entries(current).filter(([rowId, movementId]) => (
        movementId && availableByRow.get(rowId)?.has(movementId)
      )));
      matchedRows.forEach((row) => {
        if (!next[row.id] && row.suggestedMovementId) next[row.id] = row.suggestedMovementId;
      });
      return next;
    });
  }, [matchedRows]);

  const hasStatementBalance = statementBalanceMajor.toString().trim() !== "";
  const statementBalanceMinor = majorToMinor(statementBalanceMajor);
  const bookBalanceMinor = accountId ? getConsortiumTreasuryBookBalance({
    accountId,
    movements,
    dateKey: statementDate,
  }) : 0;
  const differenceMinor = hasStatementBalance
    ? statementBalanceMinor - bookBalanceMinor
    : null;
  const selectedCount = Object.values(selections).filter(Boolean).length;
  const validRowCount = preview?.summary?.valid || 0;
  const unmatchedCount = Math.max(0, validRowCount - selectedCount);
  const duplicateImport = statementFileHash ? reconciliations.find((item) => (
    item.voided !== true && item.statementImport?.fileHash === statementFileHash
  )) : null;

  const selectFile = async (event) => {
    const file = event.target.files?.[0] || null;
    setError("");
    setSuccess("");
    setStatementFile(file);
    setStatementFileHash("");
    setPreview(null);
    setSelections({});
    setMovementDraft(null);
    if (!file) return;
    if (!/\.csv$/i.test(file.name || "") || Number(file.size || 0) > 10 * 1024 * 1024) {
      setError("Seleccioná un archivo CSV de hasta 10 MB.");
      return;
    }
    try {
      const [text, hash] = await Promise.all([file.text(), fileSha256(file)]);
      const result = parseConsortiumBankStatementCsv(text);
      setStatementFileHash(hash);
      setPreview(result);
      const dates = result.validRows.map((row) => row.date).sort();
      if (dates.length) setStatementDate(dates.at(-1));
    } catch (parseError) {
      setError(parseError.message || "No se pudo leer el archivo CSV.");
    }
  };

  const selectMovement = (rowId, movementId) => {
    setSelections((current) => {
      const next = { ...current };
      Object.keys(next).forEach((key) => {
        if (key !== rowId && next[key] === movementId) next[key] = "";
      });
      next[rowId] = movementId;
      return next;
    });
  };

  const prepareMissingMovement = (row) => {
    setError("");
    setSuccess("");
    setMovementDraft(buildConsortiumTreasuryMovementDraftFromStatementRow({
      row,
      accountId,
      consortiumId,
      statementFileHash,
    }));
    globalThis.requestAnimationFrame?.(() => {
      document.getElementById("bank-movement-review")?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });
  };

  const registerMissingMovement = async () => {
    if (!canManage || !movementDraft) return;
    if (!movementDraft.concept?.trim() || !movementDraft.reason?.trim()) {
      setError("Completá el concepto y el motivo antes de registrar el movimiento.");
      return;
    }
    try {
      setOperation(`movement-${movementDraft.rowId}`);
      setError("");
      setSuccess("");
      const movementId = await registerConsortiumTreasuryMovement({
        inmobiliariaId: activeInmobiliariaId,
        consortiumId,
        accountId: movementDraft.accountId,
        direction: movementDraft.direction,
        amountMinor: movementDraft.amountMinor,
        date: movementDraft.date,
        concept: movementDraft.concept,
        reason: movementDraft.reason,
        reference: movementDraft.reference,
        bankStatementTrace: {
          fileHash: movementDraft.statementFileHash,
          lineNumber: movementDraft.lineNumber,
          rowId: movementDraft.rowId,
        },
      });
      const [accountData, movementData] = await Promise.all([
        getConsortiumTreasuryAccounts(activeInmobiliariaId, consortiumId),
        getConsortiumTreasuryMovements(activeInmobiliariaId, consortiumId),
      ]);
      setAccounts(accountData);
      setMovements(movementData);
      setSelections((current) => ({ ...current, [movementDraft.rowId]: movementId }));
      setSuccess("Movimiento registrado y vinculado a la fila del extracto. Revisalo antes de guardar la conciliación.");
      setMovementDraft(null);
    } catch (movementError) {
      setError(movementError.message || "No se pudo registrar el movimiento faltante.");
    } finally {
      setOperation("");
    }
  };

  const submitReconciliation = async (event) => {
    event.preventDefault();
    if (!canManage) return;
    if (!accountId || !statementFile || !preview?.rows?.length) {
      setError("Seleccioná la cuenta y cargá el extracto CSV.");
      return;
    }
    if (!statementDate || !hasStatementBalance) {
      setError("Ingresá la fecha y el saldo final informado por el extracto.");
      return;
    }
    if (preview.globalErrors.length || preview.summary.invalid > 0) {
      setError("Corregí las filas inválidas antes de guardar la conciliación.");
      return;
    }
    if (duplicateImport) {
      setError("Este mismo archivo ya fue conciliado. Revisá el control anterior antes de volver a importarlo.");
      return;
    }
    try {
      setOperation("save");
      setError("");
      setSuccess("");
      const matchedPairs = matchedRows.filter((row) => selections[row.id]).map((row) => ({
        lineNumber: row.lineNumber,
        movementId: selections[row.id],
        date: row.date,
        direction: row.direction,
        amountMinor: row.amountMinor,
      }));
      const dates = preview.validRows.map((row) => row.date).sort();
      await createConsortiumTreasuryReconciliation({
        inmobiliariaId: activeInmobiliariaId,
        consortiumId,
        accountId,
        statementDate,
        statementBalanceMinor,
        notes,
        file: statementFile,
        statementImport: {
          source: "csv",
          fileHash: statementFileHash,
          rowCount: preview.summary.total,
          validRowCount: preview.summary.valid,
          matchedRowCount: matchedPairs.length,
          unmatchedRowCount: unmatchedCount,
          invalidRowCount: preview.summary.invalid,
          periodStart: dates[0] || "",
          periodEnd: dates.at(-1) || "",
          matchedMovementIds: matchedPairs.map((item) => item.movementId),
          matchedPairs,
        },
      });
      setSuccess(`Conciliación guardada: ${matchedPairs.length} movimiento(s) vinculado(s) y ${unmatchedCount} pendiente(s).`);
      setStatementFile(null);
      setStatementFileHash("");
      setPreview(null);
      setSelections({});
      setStatementBalanceMajor("");
      setNotes("");
      setFileInputKey((current) => current + 1);
      await load();
    } catch (saveError) {
      setError(saveError.message || "No se pudo guardar la conciliación.");
    } finally {
      setOperation("");
    }
  };

  const downloadStatement = async (item) => {
    try {
      setOperation(`download-${item.id}`);
      await downloadPrivateConsortiumDocument({
        path: item.statementStoragePath,
        fileName: item.statementFileName,
      });
    } catch (downloadError) {
      setError(downloadError.message || "No se pudo descargar el extracto.");
    } finally {
      setOperation("");
    }
  };

  if (loading || agencyLoading) {
    return <main className="container py-5 text-center">Preparando conciliación bancaria...</main>;
  }
  if (error && !consortium) {
    return <main className="container py-5"><div className="alert alert-danger">{error}</div></main>;
  }

  return (
    <main className="container py-4 consortium-bank-reconciliation-page">
      <SEO title={`Conciliación bancaria | ${consortium?.name || "Consorcio"}`} noIndex />
      <header className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
        <div>
          <Link className="text-decoration-none" to={`/admin/consorcios/${consortiumId}#proveedores-tesoreria`}>← Volver a Tesorería</Link>
          <h1 className="h3 mt-3 mb-1">Conciliación bancaria asistida</h1>
          <p className="text-muted mb-0">{consortium?.legalName || consortium?.name} · relacioná el extracto con movimientos ya registrados</p>
        </div>
        <div className="d-flex flex-wrap gap-2">
          <button className="btn btn-outline-secondary" type="button" onClick={() => downloadCsv(CONSORTIUM_BANK_STATEMENT_TEMPLATE, "plantilla-extracto-bancario.csv")}>Descargar plantilla</button>
          <Link className="btn btn-outline-primary" to={`/admin/consorcios/${consortiumId}/estado-economico`}>Estado económico</Link>
        </div>
      </header>

      {!canManage && <div className="alert alert-info">Tu rol permite consultar conciliaciones, pero no importar ni guardar extractos.</div>}
      {error && <div className="alert alert-danger">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}
      <div className="alert alert-info"><strong>Control humano obligatorio.</strong> El asistente propone coincidencias. Un movimiento faltante solo se registra después de que el administrador revise y confirme sus datos.</div>

      <form onSubmit={submitReconciliation}>
        <section className="card border-0 shadow-sm mb-4"><div className="card-body p-4">
          <div className="d-flex align-items-start gap-3 mb-3"><span className="consortium-step-number">1</span><div><h2 className="h5 mb-1">Cargar el extracto</h2><p className="text-muted small mb-0">Usá CSV con fecha, concepto, referencia y columnas de ingreso/egreso o un importe con signo.</p></div></div>
          <div className="row g-3">
            <div className="col-md-5"><label className="form-label">Cuenta *</label><select className="form-select" value={accountId} onChange={(event) => { setAccountId(event.target.value); setMovementDraft(null); }} required><option value="">Seleccionar...</option>{activeAccounts.map((account) => <option key={account.id} value={account.id}>{account.name} · {formatConsortiumMoney(account.currentBalanceMinor, account.currency)}</option>)}</select></div>
            <div className="col-md-7"><label className="form-label">Extracto CSV *</label><input key={fileInputKey} className="form-control" type="file" accept=".csv,text/csv" disabled={!canManage} onChange={selectFile} /><small className="text-muted">Máximo 500 movimientos y 10 MB. El archivo original quedará archivado.</small></div>
          </div>
          {preview && <div className="row g-3 mt-2"><div className="col-sm-6 col-lg-3"><div className="rounded border p-3"><small className="text-muted d-block">Filas válidas</small><strong>{preview.summary.valid}</strong></div></div><div className="col-sm-6 col-lg-3"><div className="rounded border p-3"><small className="text-muted d-block">Con errores</small><strong className={preview.summary.invalid ? "text-danger" : "text-success"}>{preview.summary.invalid}</strong></div></div><div className="col-sm-6 col-lg-3"><div className="rounded border p-3"><small className="text-muted d-block">Ingresos</small><strong className="consortium-money text-success">{formatConsortiumMoney(preview.summary.inflowsMinor, currency)}</strong></div></div><div className="col-sm-6 col-lg-3"><div className="rounded border p-3"><small className="text-muted d-block">Egresos</small><strong className="consortium-money text-danger">{formatConsortiumMoney(preview.summary.outflowsMinor, currency)}</strong></div></div></div>}
          {preview?.globalErrors?.map((message) => <div className="alert alert-danger mt-3 mb-0" key={message}>{message}</div>)}
          {duplicateImport && <div className="alert alert-warning mt-3 mb-0"><strong>Archivo ya conciliado.</strong> Fue incorporado el {formatTimestamp(duplicateImport.createdAt)}. No se puede guardar nuevamente mientras ese control siga vigente.</div>}
        </div></section>

        {preview?.rows?.length > 0 && <section className="card border-0 shadow-sm mb-4"><div className="card-body p-4">
          <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-3"><div className="d-flex align-items-start gap-3"><span className="consortium-step-number">2</span><div><h2 className="h5 mb-1">Revisar coincidencias</h2><p className="text-muted small mb-0">Las sugerencias de confianza alta se preseleccionan. Podés cambiarlas o dejarlas pendientes.</p></div></div><button className="btn btn-sm btn-outline-secondary" type="button" onClick={() => downloadCsv(buildConsortiumBankStatementReviewCsv({ rows: matchedRows, selections }), "revision-conciliacion.csv")}>Exportar revisión</button></div>
          <div className="table-responsive"><table className="table table-sm align-middle"><thead><tr><th>Fila</th><th>Fecha</th><th>Detalle del banco</th><th className="text-end">Importe</th><th>Confianza</th><th>Movimiento del sistema</th></tr></thead><tbody>{matchedRows.map((row) => {
            const meta = confidenceMeta[row.confidence] || confidenceMeta.none;
            const selectedMovementId = selections[row.id] || "";
            const canRegisterMissing = canManage
              && !duplicateImport
              && !row.errors.length
              && !selectedMovementId;
            return <tr className={row.errors.length ? "table-danger" : ""} key={row.id}>
              <td>{row.lineNumber}</td>
              <td>{formatDate(row.date)}</td>
              <td><strong>{row.concept || "Sin concepto"}</strong><small className="d-block text-muted">{row.reference || "Sin referencia"}</small>{row.errors.map((message) => <small className="d-block text-danger" key={message}>{message}</small>)}</td>
              <td className={`text-end consortium-money ${row.direction === "outflow" ? "text-danger" : "text-success"}`}>{row.direction === "outflow" ? "− " : "+ "}{formatConsortiumMoney(row.amountMinor, currency)}</td>
              <td><span className={`badge ${meta.badge}`}>{meta.label}</span></td>
              <td>{row.errors.length ? "—" : <>
                <select className="form-select form-select-sm" value={selectedMovementId} onChange={(event) => selectMovement(row.id, event.target.value)}>
                  <option value="">Dejar pendiente</option>
                  {row.candidates.map(({ movement, score }) => <option key={movement.id} value={movement.id}>{formatDate(movement.date)} · {movement.concept || "Movimiento"} · {score}%</option>)}
                </select>
                {canRegisterMissing && <button className="btn btn-sm btn-link px-0 mt-1" type="button" onClick={() => prepareMissingMovement(row)}>Registrar faltante</button>}
              </>}</td>
            </tr>;
          })}</tbody></table></div>
          {movementDraft && <div className="rounded border bg-light p-3 mt-3" id="bank-movement-review">
            <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
              <div><h3 className="h6 mb-1">Confirmar movimiento de la fila {movementDraft.lineNumber}</h3><p className="small text-muted mb-0">Fecha, tipo e importe provienen del extracto y no se modifican aquí.</p></div>
              <button className="btn btn-sm btn-outline-secondary" type="button" onClick={() => setMovementDraft(null)}>Cancelar</button>
            </div>
            <div className="row g-3">
              <div className="col-sm-4"><label className="form-label">Fecha</label><div className="form-control bg-white">{formatDate(movementDraft.date)}</div></div>
              <div className="col-sm-4"><label className="form-label">Tipo</label><div className="form-control bg-white">{movementDraft.direction === "outflow" ? "Egreso" : "Ingreso"}</div></div>
              <div className="col-sm-4"><label className="form-label">Importe</label><div className={`form-control bg-white consortium-money ${movementDraft.direction === "outflow" ? "text-danger" : "text-success"}`}>{formatConsortiumMoney(movementDraft.amountMinor, currency)}</div></div>
              <div className="col-md-7"><label className="form-label">Concepto *</label><input className="form-control" maxLength="220" value={movementDraft.concept} onChange={(event) => setMovementDraft((current) => ({ ...current, concept: event.target.value }))} /></div>
              <div className="col-md-5"><label className="form-label">Referencia</label><input className="form-control" maxLength="220" value={movementDraft.reference} onChange={(event) => setMovementDraft((current) => ({ ...current, reference: event.target.value }))} /></div>
              <div className="col-12"><label className="form-label">Motivo / respaldo interno *</label><textarea className="form-control" maxLength="1000" rows="2" value={movementDraft.reason} onChange={(event) => setMovementDraft((current) => ({ ...current, reason: event.target.value }))} /></div>
            </div>
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mt-3">
              <small className="text-muted">Se registrará con trazabilidad al archivo y la fila importada.</small>
              <button className="btn btn-primary" disabled={operation === `movement-${movementDraft.rowId}`} type="button" onClick={registerMissingMovement}>{operation === `movement-${movementDraft.rowId}` ? "Registrando..." : "Confirmar y vincular"}</button>
            </div>
          </div>}
          <div className="d-flex flex-wrap gap-3 small"><span><strong>{selectedCount}</strong> vinculados</span><span><strong>{unmatchedCount}</strong> pendientes</span><span className="text-muted">Un mismo movimiento no puede utilizarse en dos filas.</span></div>
        </div></section>}

        {preview?.rows?.length > 0 && <section className="card border-0 shadow-sm mb-4"><div className="card-body p-4">
          <div className="d-flex align-items-start gap-3 mb-3"><span className="consortium-step-number">3</span><div><h2 className="h5 mb-1">Cerrar el control</h2><p className="text-muted small mb-0">Compará el saldo final del extracto con el saldo reconstruido por ONO Prop.</p></div></div>
          <div className="row g-3">
            <div className="col-md-3"><label className="form-label">Fecha del saldo *</label><input className="form-control" type="date" max={todayKey()} value={statementDate} onChange={(event) => setStatementDate(event.target.value)} required /></div>
            <div className="col-md-3"><label className="form-label">Saldo final del extracto *</label><input className="form-control" inputMode="decimal" value={statementBalanceMajor} onChange={(event) => setStatementBalanceMajor(event.target.value)} required /></div>
            <div className="col-md-3"><label className="form-label">Saldo según ONO Prop</label><div className="form-control bg-light consortium-money">{formatConsortiumMoney(bookBalanceMinor, currency)}</div></div>
            <div className="col-md-3"><label className="form-label">Diferencia</label><div className={`form-control bg-light consortium-money ${differenceMinor === null ? "text-muted" : differenceMinor === 0 ? "text-success" : "text-danger"}`}>{differenceMinor === null ? "—" : formatConsortiumMoney(differenceMinor, currency)}</div></div>
            <div className="col-12"><label className="form-label">Observaciones</label><textarea className="form-control" rows="2" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder={unmatchedCount ? "Explicá cómo se revisarán los movimientos pendientes." : "Opcional"} /></div>
          </div>
          <div className={`alert mt-3 ${differenceMinor === null ? "alert-info" : differenceMinor === 0 ? "alert-success" : "alert-warning"}`}>{differenceMinor === null ? "Ingresá el saldo final informado por el banco para calcular la diferencia." : differenceMinor === 0 ? "El saldo del extracto coincide con el sistema." : "La diferencia quedará visible. Registrá los movimientos faltantes con su respaldo y realizá un nuevo control."}</div>
          <div className="text-end"><button className="btn btn-primary" disabled={!canManage || !statementDate || !hasStatementBalance || operation === "save" || Boolean(duplicateImport) || preview.summary.invalid > 0 || preview.globalErrors.length > 0} type="submit">{operation === "save" ? "Guardando..." : "Guardar conciliación"}</button></div>
        </div></section>}
      </form>

      <section className="card border-0 shadow-sm"><div className="card-body p-4">
        <h2 className="h5">Controles anteriores</h2>
        <div className="table-responsive"><table className="table table-sm align-middle"><thead><tr><th>Fecha</th><th>Cuenta</th><th>Resultado</th><th>Importación</th><th>Creado</th><th className="text-end">Extracto</th></tr></thead><tbody>{reconciliations.slice(0, 20).map((item) => <tr className={item.voided ? "text-muted" : ""} key={item.id}><td>{formatDate(item.statementDate)}</td><td>{item.accountSnapshot?.name || "Cuenta"}</td><td><span className={`badge ${item.voided ? "text-bg-secondary" : Number(item.differenceMinor || 0) === 0 ? "text-bg-success" : "text-bg-warning"}`}>{item.voided ? "Anulada" : Number(item.differenceMinor || 0) === 0 ? "Saldo conciliado" : "Con diferencia"}</span><small className="d-block mt-1">{formatConsortiumMoney(item.differenceMinor, item.currency)}</small></td><td>{item.statementImport ? <><strong>{item.statementImport.matchedRowCount || 0} vinculados</strong><small className="d-block text-muted">{item.statementImport.unmatchedRowCount || 0} pendientes · {item.statementImport.rowCount || 0} filas</small></> : <span className="text-muted">Control manual</span>}</td><td>{formatTimestamp(item.createdAt)}</td><td className="text-end">{item.statementStoragePath ? <button className="btn btn-sm btn-outline-secondary" disabled={operation === `download-${item.id}`} type="button" onClick={() => downloadStatement(item)}>Descargar</button> : "—"}</td></tr>)}{!reconciliations.length && <tr><td className="text-center text-muted py-4" colSpan="6">Todavía no hay controles registrados.</td></tr>}</tbody></table></div>
      </div></section>
    </main>
  );
};

export default ConsortiumBankReconciliationPage;
