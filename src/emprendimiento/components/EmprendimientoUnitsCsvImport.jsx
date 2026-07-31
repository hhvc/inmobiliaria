import { useRef, useState } from "react";

import {
  UNIT_CSV_MAX_ROWS,
  buildUnitCsvImportPreview,
  buildUnitCsvTemplate,
} from "../utils/emprendimientoUnitsCsv.helpers";

const ACTION_LABELS = {
  create: "Crear",
  update: "Actualizar",
  invalid: "Rechazada",
};

const ACTION_BADGES = {
  create: "text-bg-success",
  update: "text-bg-primary",
  invalid: "text-bg-danger",
};

const downloadTemplate = () => {
  const blob = new Blob([buildUnitCsvTemplate()], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "plantilla-unidades-onoprop.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const EmprendimientoUnitsCsvImport = ({
  units = [],
  working = false,
  onImport,
}) => {
  const inputRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [fileName, setFileName] = useState("");
  const [localError, setLocalError] = useState("");
  const [report, setReport] = useState(null);

  const reset = () => {
    setPreview(null);
    setFileName("");
    setLocalError("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const readFile = async (file) => {
    setLocalError("");
    setReport(null);

    if (!file) {
      reset();
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setPreview(null);
      setFileName(file.name);
      setLocalError("El archivo supera el máximo de 2 MB.");
      return;
    }

    try {
      const text = await file.text();
      setPreview(buildUnitCsvImportPreview(text, units));
      setFileName(file.name);
    } catch (error) {
      setPreview(null);
      setFileName(file.name);
      setLocalError(error.message || "No se pudo leer el archivo.");
    }
  };

  const confirmImport = async () => {
    if (!preview?.validRows?.length || !onImport) return;

    try {
      setLocalError("");
      const result = await onImport(preview.validRows);
      const validationRejected = preview.rows
        .filter((item) => item.action === "invalid")
        .map((item) => ({
          lineNumber: item.lineNumber,
          codigo: item.row.codigo,
          error: Object.values(item.errors).join(" · "),
        }));
      const saveRejected = result.results
        .filter((item) => item.status === "failed")
        .map((item) => ({
          lineNumber: item.lineNumber,
          codigo: item.codigo,
          error: item.error,
        }));
      setReport({
        ...result,
        validationRejected: preview.summary.invalid,
        rejected: preview.summary.invalid + result.failed,
        rejectedDetails: [...validationRejected, ...saveRejected],
      });
      reset();
    } catch (error) {
      setLocalError(error.message || "No se pudo completar la importación.");
    }
  };

  return (
    <section className="card border-0 shadow-sm mb-4">
      <div className="card-header d-flex flex-wrap justify-content-between align-items-start gap-2">
        <div>
          <strong>Importar unidades desde CSV</strong>
          <div className="small text-muted">
            Compatible con Excel. Las unidades se concilian por código: las
            existentes se actualizan y las nuevas se crean como borrador.
          </div>
        </div>
        <button
          type="button"
          className="btn btn-outline-primary btn-sm"
          onClick={downloadTemplate}
        >
          Descargar plantilla CSV
        </button>
      </div>

      <div className="card-body">
        <div className="row g-3 align-items-end">
          <div className="col-lg-8">
            <label className="form-label" htmlFor="unit-csv-file">
              Archivo CSV
            </label>
            <input
              ref={inputRef}
              id="unit-csv-file"
              className="form-control"
              type="file"
              accept=".csv,.txt,text/csv,text/plain,application/vnd.ms-excel"
              disabled={working}
              onChange={(event) => readFile(event.target.files?.[0])}
            />
            <div className="form-text">
              Hasta {UNIT_CSV_MAX_ROWS} filas y 2 MB. Desde Excel elegí “CSV
              UTF-8 (delimitado por comas)” o conservá el separador punto y
              coma de la plantilla.
            </div>
          </div>
          <div className="col-lg-4 d-flex gap-2">
            {preview && (
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={reset}
                disabled={working}
              >
                Quitar archivo
              </button>
            )}
          </div>
        </div>

        <div className="alert alert-info small mt-3 mb-0">
          Las altas quedan sin publicar. Al actualizar una unidad existente se
          conservan sus imágenes, descripción y estado de publicación actual.
        </div>

        {localError && <div className="alert alert-danger mt-3 mb-0">{localError}</div>}

        {report && (
          <div
            className={`alert ${report.rejected ? "alert-warning" : "alert-success"} mt-3 mb-0`}
          >
            Importación terminada: {report.created} creada(s), {report.updated}{" "}
            actualizada(s) y {report.rejected} rechazada(s).
            {report.rejected > 0 && (
              <ul className="mb-0 mt-2">
                {report.rejectedDetails.map((item) => (
                    <li key={`${item.lineNumber}-${item.codigo}`}>
                      Fila {item.lineNumber}, {item.codigo || "sin código"}: {item.error}
                    </li>
                  ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {preview && (
        <>
          <div className="border-top px-3 py-3">
            <div className="d-flex flex-wrap gap-2 align-items-center">
              <strong>Vista previa: {fileName}</strong>
              <span className="badge text-bg-light border">
                {preview.summary.total} filas
              </span>
              <span className="badge text-bg-success">
                {preview.summary.create} nuevas
              </span>
              <span className="badge text-bg-primary">
                {preview.summary.update} actualizaciones
              </span>
              <span className="badge text-bg-danger">
                {preview.summary.invalid} rechazadas
              </span>
            </div>

            {preview.globalErrors.map((message) => (
              <div className="alert alert-danger mt-3 mb-0" key={message}>
                {message}
              </div>
            ))}
          </div>

          <div className="table-responsive border-top">
            <table className="table table-sm table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>Fila</th>
                  <th>Código</th>
                  <th>Tipo</th>
                  <th>Tipología</th>
                  <th>m²</th>
                  <th>Operación</th>
                  <th>Precio</th>
                  <th>Disponibilidad</th>
                  <th>Acción</th>
                  <th>Observaciones</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((item) => (
                  <tr key={`${item.lineNumber}-${item.row.codigo}`}>
                    <td>{item.lineNumber}</td>
                    <td>{item.row.codigo || "—"}</td>
                    <td>{item.row.tipo || "—"}</td>
                    <td>{item.row.tipologia || "—"}</td>
                    <td>{item.row.superficie === "" ? "—" : item.row.superficie}</td>
                    <td>{item.row.operacion || "—"}</td>
                    <td>
                      {item.row.precio === ""
                        ? "—"
                        : `${item.row.moneda} ${item.row.precio.toLocaleString("es-AR")}`}
                    </td>
                    <td>{item.row.disponibilidad || "—"}</td>
                    <td>
                      <span className={`badge ${ACTION_BADGES[item.action]}`}>
                        {ACTION_LABELS[item.action]}
                      </span>
                    </td>
                    <td className="small text-danger" style={{ minWidth: 220 }}>
                      {Object.values(item.errors).join(" · ") || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card-footer d-flex flex-wrap justify-content-between align-items-center gap-2">
            <span className="small text-muted">
              Las filas rechazadas no se guardarán.
            </span>
            <button
              type="button"
              className="btn btn-success"
              disabled={
                working ||
                preview.globalErrors.length > 0 ||
                preview.validRows.length === 0
              }
              onClick={confirmImport}
            >
              {working
                ? "Importando..."
                : `Importar ${preview.validRows.length} fila(s) válida(s)`}
            </button>
          </div>
        </>
      )}
    </section>
  );
};

export default EmprendimientoUnitsCsvImport;
