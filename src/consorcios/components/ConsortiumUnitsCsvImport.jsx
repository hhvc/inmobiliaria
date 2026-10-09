import { useRef, useState } from "react";

import {
  CONSORTIUM_UNIT_CSV_MAX_ROWS,
  buildConsortiumUnitCsvImportPreview,
  buildConsortiumUnitCsvTemplate,
} from "../utils/consorcioUnitsCsv.helpers";

const todayKey = () => new Date().toISOString().slice(0, 10);
const currentPeriodKey = () => todayKey().slice(0, 7);

const downloadTemplate = () => {
  const blob = new Blob([buildConsortiumUnitCsvTemplate()], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "plantilla-unidades-consorcio-onoprop.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const ConsortiumUnitsCsvImport = ({
  units = [],
  working = false,
  defaultDueDate = todayKey(),
  onImport,
  onClose,
}) => {
  const inputRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [fileName, setFileName] = useState("");
  const [localError, setLocalError] = useState("");
  const [report, setReport] = useState(null);
  const [migration, setMigration] = useState({
    effectiveDate: todayKey(),
    periodKey: currentPeriodKey(),
    dueDate: defaultDueDate || todayKey(),
    reason: "Migración desde administración anterior",
  });

  const clearFile = () => {
    setPreview(null);
    setFileName("");
    setLocalError("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const readFile = async (file) => {
    setLocalError("");
    setReport(null);
    if (!file) {
      clearFile();
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setFileName(file.name);
      setPreview(null);
      setLocalError("El archivo supera el máximo de 2 MB.");
      return;
    }
    try {
      setFileName(file.name);
      setPreview(buildConsortiumUnitCsvImportPreview(await file.text(), units));
    } catch (error) {
      setPreview(null);
      setLocalError(error.message || "No se pudo leer el archivo.");
    }
  };

  const confirmImport = async () => {
    if (!preview?.validRows?.length || !onImport) return;
    if (preview.summary.withBalance && (
      !migration.effectiveDate || !migration.periodKey || !migration.dueDate || !migration.reason.trim()
    )) {
      setLocalError("Completá los datos comunes de los saldos anteriores.");
      return;
    }
    try {
      setLocalError("");
      const result = await onImport(preview.validRows, migration);
      setReport(result);
      clearFile();
    } catch (error) {
      setLocalError(error.message || "No se pudo completar la importación.");
    }
  };

  return (
    <section className="card border-primary-subtle bg-primary-subtle bg-opacity-10 mb-4" id="consortium-unit-import">
      <div className="card-body p-4">
        <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
          <div>
            <span className="badge text-bg-primary mb-2">Puesta en marcha</span>
            <h3 className="h5 mb-1">Importar padrón desde Excel</h3>
            <p className="text-muted small mb-0">Cargá todas las unidades juntas. ONO Prop revisa el archivo antes de guardar.</p>
          </div>
          <button className="btn-close" type="button" aria-label="Cerrar importación" onClick={onClose} />
        </div>

        <div className="row g-3 mb-4">
          <div className="col-md-4"><div className="bg-white rounded border p-3 h-100"><strong className="d-block mb-1">1. Descargá la plantilla</strong><small className="text-muted">Solo “unidad” es obligatoria. Eliminá los ejemplos antes de cargarla.</small><button className="btn btn-sm btn-outline-primary d-block mt-3" type="button" onClick={downloadTemplate}>Descargar CSV</button></div></div>
          <div className="col-md-4"><div className="bg-white rounded border p-3 h-100"><strong className="d-block mb-1">2. Completala en Excel</strong><small className="text-muted">Un saldo positivo es deuda anterior; uno negativo es saldo a favor.</small></div></div>
          <div className="col-md-4"><div className="bg-white rounded border p-3 h-100"><strong className="d-block mb-1">3. Revisá y confirmá</strong><small className="text-muted">Las filas con errores se señalan y nunca se guardan por accidente.</small></div></div>
        </div>

        <div className="row g-3 align-items-end">
          <div className="col-lg-8">
            <label className="form-label" htmlFor="consortium-unit-csv">Archivo CSV</label>
            <input
              ref={inputRef}
              className="form-control"
              id="consortium-unit-csv"
              type="file"
              accept=".csv,.txt,text/csv,text/plain,application/vnd.ms-excel"
              disabled={working}
              onChange={(event) => readFile(event.target.files?.[0])}
            />
            <div className="form-text">Hasta {CONSORTIUM_UNIT_CSV_MAX_ROWS} unidades y 2 MB.</div>
          </div>
          <div className="col-lg-4">
            {preview && <button className="btn btn-outline-secondary" type="button" disabled={working} onClick={clearFile}>Quitar archivo</button>}
          </div>
        </div>

        {localError && <div className="alert alert-danger mt-3 mb-0">{localError}</div>}
        {report && <div className={`alert mt-3 mb-0 ${report.balanceFailed ? "alert-warning" : "alert-success"}`}><strong>Importación terminada.</strong> Se crearon {report.created} unidad(es){report.balancesApplied ? ` y ${report.balancesApplied} saldo(s) inicial(es)` : ""}.{report.balanceFailed ? ` ${report.balanceFailed} saldo(s) deberán registrarse manualmente.` : ""}{report.balanceFailures?.length > 0 && <ul className="mb-0 mt-2">{report.balanceFailures.map((item) => <li key={item.code}>{item.code}: {item.error}</li>)}</ul>}</div>}

        {preview && <>
          <div className="border-top mt-4 pt-4">
            <div className="d-flex flex-wrap gap-2 align-items-center mb-3">
              <strong>Vista previa · {fileName}</strong>
              <span className="badge text-bg-light border">{preview.summary.total} filas</span>
              <span className="badge text-bg-success">{preview.summary.valid} listas</span>
              <span className="badge text-bg-danger">{preview.summary.invalid} con errores</span>
              {preview.summary.withBalance > 0 && <span className="badge text-bg-info">{preview.summary.withBalance} con saldo anterior</span>}
            </div>
            {preview.globalErrors.map((message) => <div className="alert alert-danger" key={message}>{message}</div>)}
          </div>

          {preview.summary.withBalance > 0 && <div className="rounded border bg-white p-3 mb-3">
            <h4 className="h6">Datos comunes para los saldos anteriores</h4>
            <p className="small text-muted">Se aplican únicamente a las filas cuyo saldo inicial sea distinto de cero.</p>
            <div className="row g-3">
              <div className="col-md-3"><label className="form-label">Fecha de corte</label><input className="form-control" type="date" value={migration.effectiveDate} onChange={(event) => setMigration((current) => ({ ...current, effectiveDate: event.target.value }))} /></div>
              <div className="col-md-3"><label className="form-label">Período de la deuda</label><input className="form-control" type="month" value={migration.periodKey} onChange={(event) => setMigration((current) => ({ ...current, periodKey: event.target.value }))} /></div>
              <div className="col-md-3"><label className="form-label">Vencimiento</label><input className="form-control" type="date" value={migration.dueDate} onChange={(event) => setMigration((current) => ({ ...current, dueDate: event.target.value }))} /></div>
              <div className="col-md-3"><label className="form-label">Origen</label><input className="form-control" value={migration.reason} onChange={(event) => setMigration((current) => ({ ...current, reason: event.target.value }))} /></div>
            </div>
          </div>}

          <div className="table-responsive bg-white border rounded">
            <table className="table table-sm table-hover align-middle mb-0">
              <thead className="table-light"><tr><th>Fila</th><th>Unidad</th><th>Tipo</th><th>Coeficiente</th><th>Titular</th><th>Ocupante</th><th>Saldo inicial</th><th>Estado</th><th>Observaciones</th></tr></thead>
              <tbody>{preview.rows.map((item) => <tr key={`${item.lineNumber}-${item.row.code}`}><td>{item.lineNumber}</td><td><strong>{item.row.code || "—"}</strong><small className="d-block text-muted">{[item.row.floor && `Piso ${item.row.floor}`, item.row.apartment && `Dpto. ${item.row.apartment}`].filter(Boolean).join(" · ")}</small></td><td>{item.row.type}</td><td>{item.row.coefficient}</td><td>{item.row.ownerName || "—"}<small className="d-block text-muted">{item.row.ownerEmail}</small></td><td>{item.row.occupantName || "—"}<small className="d-block text-muted">{item.row.occupantEmail}</small></td><td className={item.row.openingBalanceMajor < 0 ? "text-success" : item.row.openingBalanceMajor > 0 ? "text-danger" : ""}>{item.row.openingBalanceMajor.toLocaleString("es-AR", { style: "currency", currency: "ARS" })}</td><td><span className={`badge ${item.action === "create" ? "text-bg-success" : "text-bg-danger"}`}>{item.action === "create" ? "Lista" : "Corregir"}</span></td><td className="small text-danger" style={{ minWidth: 220 }}>{Object.values(item.errors).join(" · ") || "—"}</td></tr>)}</tbody>
            </table>
          </div>

          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 pt-3">
            <small className="text-muted">Las filas con errores no se importarán.</small>
            <button className="btn btn-success" type="button" disabled={working || preview.globalErrors.length > 0 || preview.validRows.length === 0} onClick={confirmImport}>{working ? "Importando..." : `Importar ${preview.validRows.length} unidad(es)`}</button>
          </div>
        </>}
      </div>
    </section>
  );
};

export default ConsortiumUnitsCsvImport;
