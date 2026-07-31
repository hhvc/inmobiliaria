import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../../context/auth/useAuth";
import { createInmueble } from "../services/inmueble.service";
import {
  buildInmuebleBulkImportPayload,
  parseInmuebleBulkImportCsv,
  validateInmuebleBulkImportRow,
} from "../utils/inmuebleBulkImport.helpers";

const INITIAL_SUMMARY = {
  total: 0,
  valid: 0,
  invalid: 0,
  imported: 0,
  failed: 0,
};

const BASE_BULK_IMPORT_FIELDS = [
  { key: "titulo", label: "Título", required: true },
  { key: "operacion", label: "Operación", required: true },
  { key: "tipo", label: "Tipo", required: true },
  { key: "moneda", label: "Moneda" },
  { key: "precio", label: "Precio" },
  { key: "ciudad", label: "Ciudad" },
  { key: "barrio", label: "Barrio" },
  { key: "descripcion", label: "Descripción", required: true },
  { key: "dormitorios", label: "Dormitorios" },
  { key: "banos", label: "Baños" },
  { key: "superficie_cubierta", label: "Sup. cubierta" },
  { key: "superficie_total", label: "Sup. total" },
  { key: "cocheras", label: "Cochera" },
  { key: "estado", label: "Estado" },
  { key: "publicar_en_portal", label: "Portal" },
];

const createMediaFields = (prefix, label, count) => {
  return Array.from({ length: count }, (_, index) => ({
    key: `${prefix}${index + 1}`,
    label: `${label} ${index + 1}`,
  }));
};

const createEmptyManualRow = () => {
  return BASE_BULK_IMPORT_FIELDS.reduce((acc, field) => {
    acc[field.key] = "";
    return acc;
  }, {});
};

const createInitialManualRows = () => {
  return Array.from({ length: 5 }, createEmptyManualRow);
};

const getStatusBadgeClass = (status) => {
  const classes = {
    pending: "text-bg-secondary",
    ready: "text-bg-primary",
    importing: "text-bg-info",
    imported: "text-bg-success",
    invalid: "text-bg-danger",
    failed: "text-bg-warning",
  };

  return `badge ${classes[status] || "text-bg-secondary"}`;
};

const getStatusLabel = (status) => {
  const labels = {
    pending: "Pendiente",
    ready: "Lista",
    importing: "Importando",
    imported: "Importada",
    invalid: "Con errores",
    failed: "Falló",
  };

  return labels[status] || "Pendiente";
};

const normalizeRows = (parsedRows) => {
  return parsedRows.map((item) => {
    const validation = validateInmuebleBulkImportRow(item.raw);

    return {
      ...item,
      ...validation,
      status: validation.isValid ? "ready" : "invalid",
      result: null,
      importError: "",
    };
  });
};

const InmuebleBulkImportPage = () => {
  const { user, activeInmobiliariaId } = useAuth();

  const [rows, setRows] = useState([]);
  const [inputMode, setInputMode] = useState("online");
  const [manualRows, setManualRows] = useState(createInitialManualRows);
  const [imageColumnCount, setImageColumnCount] = useState(3);
  const [videoColumnCount, setVideoColumnCount] = useState(2);
  const [fileName, setFileName] = useState("");
  const [loadingFile, setLoadingFile] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState(null);

  const bulkImportFields = useMemo(() => {
    return [
      ...BASE_BULK_IMPORT_FIELDS,
      ...createMediaFields("imagen", "Imagen", imageColumnCount),
      ...createMediaFields("video", "Video", videoColumnCount),
    ];
  }, [imageColumnCount, videoColumnCount]);

  const summary = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        acc.total += 1;

        if (row.isValid) acc.valid += 1;
        if (!row.isValid) acc.invalid += 1;
        if (row.status === "imported") acc.imported += 1;
        if (row.status === "failed") acc.failed += 1;

        return acc;
      },
      { ...INITIAL_SUMMARY },
    );
  }, [rows]);

  const importableRows = useMemo(() => {
    return rows.filter((row) => row.isValid && row.status !== "imported");
  }, [rows]);

  const canImport = Boolean(
    user?.uid && activeInmobiliariaId && importableRows.length > 0 && !importing,
  );

  const updateRow = (rowNumber, updates) => {
    setRows((prev) =>
      prev.map((row) =>
        row.rowNumber === rowNumber
          ? {
            ...row,
            ...updates,
          }
          : row,
      ),
    );
  };

  const handleAddImageColumn = () => {
    setImageColumnCount((prev) => Math.min(prev + 1, 50));
  };

  const handleAddVideoColumn = () => {
    setVideoColumnCount((prev) => Math.min(prev + 1, 5));
  };

  const handleInputModeChange = (nextMode) => {
    setInputMode(nextMode);
    setRows([]);
    setError(null);
    setFileName("");
  };

  const handleManualCellChange = (rowIndex, fieldKey, value) => {
    setManualRows((prev) =>
      prev.map((row, index) =>
        index === rowIndex
          ? {
            ...row,
            [fieldKey]: value,
          }
          : row,
      ),
    );
  };

  const handleAddManualRows = () => {
    setManualRows((prev) => [
      ...prev,
      ...Array.from({ length: 5 }, createEmptyManualRow),
    ]);
  };

  const handleClearManualRows = () => {
    if (!window.confirm("¿Limpiar todos los datos cargados online?")) return;

    setManualRows(createInitialManualRows());
    setRows([]);
    setError(null);
  };

  const handleValidateManualRows = () => {
    const parsedRows = manualRows
      .map((raw, index) => ({
        rowNumber: index + 2,
        raw,
      }))
      .filter((item) =>
        Object.values(item.raw).some((value) => value.toString().trim()),
      );

    if (parsedRows.length === 0) {
      setError("No hay filas cargadas para validar");
      setRows([]);
      return;
    }

    setError(null);
    setFileName("Carga online");
    setRows(normalizeRows(parsedRows));
  };

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    try {
      setLoadingFile(true);
      setError(null);
      setRows([]);
      setFileName(file.name);

      const text = await file.text();
      const parsedRows = parseInmuebleBulkImportCsv(text);

      if (parsedRows.length === 0) {
        throw new Error("El CSV no tiene filas para importar");
      }

      setRows(normalizeRows(parsedRows));
    } catch (err) {
      console.error("Error leyendo CSV:", err);
      setError(err.message || "No se pudo leer el archivo CSV");
    } finally {
      setLoadingFile(false);
      event.target.value = "";
    }
  };

  const handleImport = async () => {
    if (!user?.uid || !activeInmobiliariaId) {
      setError("No se pudo determinar el usuario o la inmobiliaria activa");
      return;
    }

    if (importableRows.length === 0) {
      setError("No hay filas válidas pendientes para importar");
      return;
    }

    const confirmed = window.confirm(
      `¿Importar ${importableRows.length} inmueble${importableRows.length === 1 ? "" : "s"
      } desde el CSV?`,
    );

    if (!confirmed) return;

    try {
      setImporting(true);
      setError(null);

      for (const row of importableRows) {
        updateRow(row.rowNumber, {
          status: "importing",
          importError: "",
        });

        try {
          const payload = buildInmuebleBulkImportPayload(row.raw, {
            userId: user.uid,
            inmobiliariaId: activeInmobiliariaId,
          });

          const result = await createInmueble(activeInmobiliariaId, payload);

          updateRow(row.rowNumber, {
            status: "imported",
            result,
            importError: "",
          });
        } catch (rowError) {
          console.error(`Error importando fila ${row.rowNumber}:`, rowError);

          updateRow(row.rowNumber, {
            status: "failed",
            importError:
              rowError.message || "No se pudo importar esta fila",
          });
        }
      }
    } finally {
      setImporting(false);
    }
  };

  return (
    <main className="container py-4">
      <header className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
        <div>
          <p className="text-uppercase text-muted small mb-1">
            Panel de inmuebles
          </p>

          <h1 className="h3 mb-1">Carga masiva CSV</h1>

          <p className="text-muted mb-0">
            Importá propiedades desde una planilla CSV con validación previa por
            fila.
          </p>
        </div>

        <div className="btn-group" role="group" aria-label="Modo de carga">
          <button
            type="button"
            className={
              inputMode === "csv"
                ? "btn btn-primary"
                : "btn btn-outline-primary"
            }
            onClick={() => handleInputModeChange("csv")}
          >
            Importar CSV
          </button>

          <button
            type="button"
            className={
              inputMode === "online"
                ? "btn btn-primary"
                : "btn btn-outline-primary"
            }
            onClick={() => handleInputModeChange("online")}
          >
            Completar online
          </button>
        </div>

        <div className="d-flex flex-wrap gap-2">
          <a
            href="/templates/plantilla-carga-masiva-inmuebles.xlsx"
            className="btn btn-outline-primary"
            download
          >
            Descargar plantilla Excel
          </a>

          <a
            href="/templates/plantilla-carga-masiva-inmuebles.csv"
            className="btn btn-outline-secondary"
            download
          >
            Descargar CSV modelo
          </a>

          <Link to="/admin/inmuebles/listado" className="btn btn-outline-secondary">
            Volver al listado
          </Link>
        </div>
      </header>

      {!activeInmobiliariaId && (
        <div className="alert alert-warning">
          No hay inmobiliaria activa seleccionada. Seleccioná una inmobiliaria
          antes de importar.
        </div>
      )}

      {error && <div className="alert alert-danger">{error}</div>}
      {inputMode === "csv" && (
        <section className="card border-0 shadow-sm mb-4">
          <div className="card-body p-4">
            <div className="row g-3 align-items-end">
              <div className="col-12 col-lg-7">
                <label className="form-label">Archivo CSV</label>

                <input
                  type="file"
                  className="form-control"
                  accept=".csv,text/csv"
                  disabled={loadingFile || importing}
                  onChange={handleFileChange}
                />

                <div className="small text-muted mt-2">
                  Recomendado: usar la plantilla descargable. Separador compatible
                  con Excel: punto y coma (;).
                </div>
              </div>

              <div className="col-12 col-lg-5 text-lg-end">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={!canImport}
                  onClick={handleImport}
                >
                  {importing
                    ? "Importando..."
                    : `Importar filas válidas${importableRows.length > 0
                      ? ` (${importableRows.length})`
                      : ""
                    }`}
                </button>
              </div>
            </div>

            {fileName && (
              <div className="small text-muted mt-3">
                Archivo cargado: <strong>{fileName}</strong>
              </div>
            )}
          </div>
        </section>
      )}

      {inputMode === "online" && (
        <section className="card border-0 shadow-sm mb-4">
          <div className="card-body p-4">
            <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-3">
              <div>
                <h2 className="h5 mb-1">Plantilla online</h2>
                <p className="text-muted mb-0">
                  Completá los datos en la grilla, validalos y luego importá las filas válidas.
                </p>
              </div>

              <div className="d-flex flex-wrap gap-2">

                <button
                  type="button"
                  className="btn btn-outline-primary"
                  onClick={handleAddImageColumn}
                  disabled={importing || imageColumnCount >= 50}
                >
                  + Columna imagen
                </button>

                <button
                  type="button"
                  className="btn btn-outline-primary"
                  onClick={handleAddVideoColumn}
                  disabled={importing || videoColumnCount >= 5}
                >
                  + Columna video
                </button>

                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={handleAddManualRows}
                  disabled={importing}
                >
                  Agregar 5 filas
                </button>

                <button
                  type="button"
                  className="btn btn-outline-danger"
                  onClick={handleClearManualRows}
                  disabled={importing}
                >
                  Limpiar
                </button>

                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleValidateManualRows}
                  disabled={importing}
                >
                  Validar datos
                </button>
              </div>
            </div>

            <div className="alert alert-info small">
              Valores sugeridos: operación venta, alquiler, alquiler_temporal o tasacion.
              Tipo casa, departamento, terreno, local, oficina, cochera, campo u otro.
              Portal: sí/no.
            </div>

            <div className="table-responsive">
              <table className="table table-sm table-bordered align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th style={{ width: 60 }}>#</th>
                    {bulkImportFields.map((field) => (
                      <th key={field.key} style={{ minWidth: 160 }}>
                        {field.label}
                        {field.required && (
                          <span className="text-danger ms-1">*</span>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {manualRows.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      <td className="text-muted small">{rowIndex + 1}</td>

                      {bulkImportFields.map((field) => (
                        <td key={field.key}>
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            value={row[field.key] || ""}
                            onChange={(e) =>
                              handleManualCellChange(
                                rowIndex,
                                field.key,
                                e.target.value,
                              )
                            }
                            disabled={importing}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="small text-muted mt-2">
              Las filas vacías se ignoran. Después de validar, revisá la tabla de resultados antes de importar.
            </div>
          </div>
        </section>
      )}

      {rows.length > 0 && (
        <section className="row g-3 mb-4">
          <div className="col-6 col-lg-2">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body">
                <div className="small text-muted">Total</div>
                <div className="h4 mb-0">{summary.total}</div>
              </div>
            </div>
          </div>

          <div className="col-6 col-lg-2">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body">
                <div className="small text-muted">Válidas</div>
                <div className="h4 mb-0 text-primary">{summary.valid}</div>
              </div>
            </div>
          </div>

          <div className="col-6 col-lg-2">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body">
                <div className="small text-muted">Con errores</div>
                <div className="h4 mb-0 text-danger">{summary.invalid}</div>
              </div>
            </div>
          </div>

          <div className="col-6 col-lg-2">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body">
                <div className="small text-muted">Importadas</div>
                <div className="h4 mb-0 text-success">{summary.imported}</div>
              </div>
            </div>
          </div>

          <div className="col-6 col-lg-2">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body">
                <div className="small text-muted">Fallidas</div>
                <div className="h4 mb-0 text-warning">{summary.failed}</div>
              </div>
            </div>
          </div>
        </section>
      )}

      {loadingFile ? (
        <div className="text-center py-5">
          <div className="spinner-border" />
          <p className="text-muted mt-3">Leyendo archivo...</p>
        </div>
      ) : rows.length === 0 ? (
        <section className="card border-0 shadow-sm">
          <div className="card-body p-5 text-center">
            <div className="display-6 mb-3">📄</div>
            <h2 className="h5">
              {inputMode === "online"
                ? "Todavía no validaste la plantilla online"
                : "Todavía no cargaste un CSV"}
            </h2>

            <p className="text-muted mb-0">
              {inputMode === "online"
                ? "Completá o pegá los datos en la grilla online y presioná “Validar datos” para previsualizar las filas antes de importarlas."
                : "Descargá la plantilla, completala y subí el CSV para previsualizar las filas antes de importarlas."}
            </p>
          </div>
        </section>
      ) : (
        <section className="card border-0 shadow-sm">
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Fila</th>
                    <th>Estado</th>
                    <th>Título</th>
                    <th>Operación</th>
                    <th>Tipo</th>
                    <th>Precio</th>
                    <th>Ubicación</th>
                    <th>Observaciones</th>
                    <th>Resultado</th>
                  </tr>
                </thead>

                <tbody>
                  {rows.map((row) => {
                    const raw = row.raw || {};
                    const location = [raw.ciudad, raw.barrio]
                      .filter(Boolean)
                      .join(" · ");

                    return (
                      <tr key={row.rowNumber}>
                        <td>{row.rowNumber}</td>

                        <td>
                          <span className={getStatusBadgeClass(row.status)}>
                            {getStatusLabel(row.status)}
                          </span>
                        </td>

                        <td style={{ minWidth: 220 }}>
                          <div className="fw-semibold">
                            {raw.titulo || "Sin título"}
                          </div>

                          {raw.descripcion && (
                            <div
                              className="small text-muted"
                              style={{
                                display: "-webkit-box",
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: "vertical",
                                overflow: "hidden",
                              }}
                            >
                              {raw.descripcion}
                            </div>
                          )}
                        </td>

                        <td>{raw.operacion || "-"}</td>
                        <td>{raw.tipo || "-"}</td>
                        <td>
                          {raw.moneda || "USD"} {raw.precio || "-"}
                        </td>
                        <td>{location || "-"}</td>

                        <td style={{ minWidth: 260 }}>
                          {row.errors?.length > 0 && (
                            <ul className="small text-danger mb-1 ps-3">
                              {row.errors.map((item) => (
                                <li key={item}>{item}</li>
                              ))}
                            </ul>
                          )}

                          {row.warnings?.length > 0 && (
                            <ul className="small text-warning mb-0 ps-3">
                              {row.warnings.map((item) => (
                                <li key={item}>{item}</li>
                              ))}
                            </ul>
                          )}

                          {row.errors?.length === 0 &&
                            row.warnings?.length === 0 && (
                              <span className="small text-muted">
                                Sin observaciones
                              </span>
                            )}
                        </td>

                        <td style={{ minWidth: 180 }}>
                          {row.status === "importing" && (
                            <span className="small text-muted">
                              Importando...
                            </span>
                          )}

                          {row.status === "imported" && (
                            <div className="d-flex flex-column gap-1">
                              <span className="small text-success">
                                Creado correctamente
                              </span>

                              {row.result?.editPath && (
                                <Link
                                  to={row.result.editPath}
                                  className="btn btn-sm btn-outline-primary"
                                >
                                  Editar
                                </Link>
                              )}
                            </div>
                          )}

                          {row.status === "failed" && (
                            <span className="small text-danger">
                              {row.importError || "Falló la importación"}
                            </span>
                          )}

                          {row.status === "ready" && (
                            <span className="small text-muted">
                              Pendiente de importación
                            </span>
                          )}

                          {row.status === "invalid" && (
                            <span className="small text-muted">
                              Corregir CSV y volver a subir
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}
    </main>
  );
};

export default InmuebleBulkImportPage;
