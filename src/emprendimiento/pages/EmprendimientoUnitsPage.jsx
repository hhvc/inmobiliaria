import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import SEO from "../../components/SEO";
import { useAuth } from "../../context/auth/useAuth";
import EmprendimientoUnitsCsvImport from "../components/EmprendimientoUnitsCsvImport";
import {
  OPERACIONES_OPCIONES,
  TIPOS_INMUEBLE_OPCIONES,
} from "../../inmueble/utils/inmuebleSchema";
import { getEmprendimientoById } from "../services/emprendimiento.service";
import {
  createEmprendimientoUnits,
  getAllInmueblesForUnitMatrix,
  importEmprendimientoUnits,
  linkInmueblesToEmprendimiento,
  unlinkInmuebleFromEmprendimiento,
  updateEmprendimientoUnits,
} from "../services/emprendimientoUnit.service";
import {
  UNIDAD_DISPONIBILIDADES,
  createEmptyUnitRow,
  duplicateUnitRow,
  inmuebleToUnitRow,
  validateUnitRows,
} from "../utils/emprendimientoUnits.helpers";

const createRowId = () =>
  `row-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const UnitFieldsRow = ({
  row,
  onChange,
  onDuplicate,
  onRemove,
  errors = {},
  compact = false,
}) => (
  <tr>
    <td style={{ minWidth: 110 }}>
      <input
        className={`form-control form-control-sm ${errors.codigo ? "is-invalid" : ""}`}
        value={row.codigo}
        placeholder="1° A"
        onChange={(event) => onChange("codigo", event.target.value)}
      />
      {errors.codigo && <div className="invalid-feedback">{errors.codigo}</div>}
    </td>
    <td style={{ minWidth: 145 }}>
      <select className="form-select form-select-sm" value={row.tipo} onChange={(event) => onChange("tipo", event.target.value)}>
        {TIPOS_INMUEBLE_OPCIONES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
      </select>
    </td>
    <td style={{ minWidth: 140 }}>
      <input className="form-control form-control-sm" value={row.tipologia} placeholder="2 dormitorios" onChange={(event) => onChange("tipologia", event.target.value)} />
    </td>
    <td style={{ minWidth: 90 }}>
      <input className="form-control form-control-sm" value={row.piso} placeholder="2" onChange={(event) => onChange("piso", event.target.value)} />
    </td>
    <td style={{ minWidth: 85 }}>
      <input className="form-control form-control-sm" type="number" min="0" value={row.ambientes} onChange={(event) => onChange("ambientes", event.target.value)} />
    </td>
    <td style={{ minWidth: 85 }}>
      <input className="form-control form-control-sm" type="number" min="0" value={row.dormitorios} onChange={(event) => onChange("dormitorios", event.target.value)} />
    </td>
    <td style={{ minWidth: 100 }}>
      <input className="form-control form-control-sm" type="number" min="0" step="0.01" value={row.superficie} onChange={(event) => onChange("superficie", event.target.value)} />
    </td>
    <td style={{ minWidth: 125 }}>
      <select className="form-select form-select-sm" value={row.operacion} onChange={(event) => onChange("operacion", event.target.value)}>
        {OPERACIONES_OPCIONES.filter((item) => ["venta", "alquiler", "alquiler_temporal"].includes(item.id)).map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
      </select>
    </td>
    <td style={{ minWidth: 130 }}>
      <div className="input-group input-group-sm">
        <select className="form-select" style={{ maxWidth: 70 }} value={row.moneda} onChange={(event) => onChange("moneda", event.target.value)}>
          <option value="USD">USD</option>
          <option value="ARS">ARS</option>
        </select>
        <input className="form-control" type="number" min="0" step="0.01" value={row.precio} onChange={(event) => onChange("precio", event.target.value)} />
      </div>
    </td>
    <td style={{ minWidth: 140 }}>
      <select className="form-select form-select-sm" value={row.disponibilidad} onChange={(event) => onChange("disponibilidad", event.target.value)}>
        {UNIDAD_DISPONIBILIDADES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
      </select>
    </td>
    <td className="text-nowrap">
      {onDuplicate && (
        <button
          type="button"
          className="btn btn-sm btn-outline-primary me-2"
          onClick={onDuplicate}
        >
          Duplicar
        </button>
      )}
      {onRemove && (
        <button type="button" className={`btn btn-sm ${compact ? "btn-outline-danger" : "btn-outline-secondary"}`} onClick={onRemove}>
          {compact ? "Quitar" : "Desvincular"}
        </button>
      )}
    </td>
  </tr>
);

const EmprendimientoUnitsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { activeInmobiliariaId } = useAuth();

  const [emprendimiento, setEmprendimiento] = useState(null);
  const [units, setUnits] = useState([]);
  const [availableInmuebles, setAvailableInmuebles] = useState([]);
  const [rowsById, setRowsById] = useState({});
  const [initialRowsById, setInitialRowsById] = useState({});
  const [newRows, setNewRows] = useState([
    createEmptyUnitRow(createRowId()),
  ]);
  const [selectedExistingIds, setSelectedExistingIds] = useState([]);
  const [existingSearch, setExistingSearch] = useState("");
  const [matrixErrors, setMatrixErrors] = useState({});
  const [newRowErrors, setNewRowErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async () => {
    if (!activeInmobiliariaId || !id) {
      setError("No se pudo determinar la inmobiliaria o el emprendimiento.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");
      const [development, inmuebles] = await Promise.all([
        getEmprendimientoById(activeInmobiliariaId, id),
        getAllInmueblesForUnitMatrix(activeInmobiliariaId),
      ]);

      if (!development) throw new Error("No se encontró el emprendimiento");

      const linked = inmuebles.filter(
        (inmueble) => inmueble.emprendimientoId === development.id,
      );
      const available = inmuebles.filter(
        (inmueble) => !inmueble.emprendimientoId && inmueble.deleted !== true,
      );
      const nextRows = linked.reduce((accumulator, inmueble) => {
        accumulator[inmueble.id] = inmuebleToUnitRow(inmueble);
        return accumulator;
      }, {});

      setEmprendimiento(development);
      setUnits(linked);
      setAvailableInmuebles(available);
      setRowsById(nextRows);
      setInitialRowsById(nextRows);
      setSelectedExistingIds([]);
      setMatrixErrors({});
    } catch (loadError) {
      setError(loadError.message || "No se pudo cargar la matriz de unidades");
    } finally {
      setLoading(false);
    }
  }, [activeInmobiliariaId, id]);

  useEffect(() => {
    load();
  }, [load]);

  const availabilityCounts = useMemo(() => {
    return units.reduce(
      (counts, unit) => {
        const status =
          rowsById[unit.id]?.disponibilidad ||
          unit.unidadEmprendimiento?.disponibilidad ||
          "disponible";
        counts[status] = (counts[status] || 0) + 1;
        return counts;
      },
      { disponible: 0, reservada: 0, vendida: 0, no_disponible: 0 },
    );
  }, [rowsById, units]);

  const filteredAvailable = useMemo(() => {
    const needle = existingSearch.trim().toLowerCase();
    if (!needle) return availableInmuebles;

    return availableInmuebles.filter((inmueble) =>
      [inmueble.titulo, inmueble.tipo, inmueble.operacion, inmueble.direccion?.ciudad]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [availableInmuebles, existingSearch]);

  const changeLinkedRow = (unitId, field, value) => {
    setRowsById((current) => ({
      ...current,
      [unitId]: { ...current[unitId], [field]: value },
    }));
    setSuccess("");
  };

  const changeNewRow = (rowId, field, value) => {
    setNewRows((current) =>
      current.map((row) =>
        row.rowId === rowId ? { ...row, [field]: value } : row,
      ),
    );
    setNewRowErrors({});
    setSuccess("");
  };

  const duplicateIntoNewRows = (row) => {
    if (newRows.length >= 50) {
      setError("La carga múltiple admite hasta 50 unidades por vez.");
      return;
    }

    const duplicate = duplicateUnitRow(row, createRowId());
    setNewRows((current) => [...current, duplicate]);
    setNewRowErrors({});
    setError("");
    setSuccess(
      `Se agregó “${duplicate.codigo || "unidad sin código"}” a las altas pendientes. Revisala y presioná Crear cuando esté lista.`,
    );
  };

  const duplicateLinkedUnit = (unit) => {
    const params = new URLSearchParams();
    params.set("duplicarId", unit.id);
    params.set("inmobiliariaId", activeInmobiliariaId);
    navigate(`/admin/inmuebles/nuevo?${params.toString()}`);
  };

  const saveMatrix = async () => {
    const orderedRows = units.map((unit) => rowsById[unit.id]);
    const errors = validateUnitRows(orderedRows);
    setMatrixErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const changedUnits = units.filter(
      (unit) =>
        JSON.stringify(rowsById[unit.id]) !==
        JSON.stringify(initialRowsById[unit.id]),
    );

    if (changedUnits.length === 0) {
      setSuccess("No había cambios pendientes en la matriz.");
      return;
    }

    try {
      setWorking(true);
      setError("");
      await updateEmprendimientoUnits({
        inmobiliariaId: activeInmobiliariaId,
        emprendimiento,
        units: changedUnits,
        rowsById,
      });
      setSuccess(`${changedUnits.length} unidad(es) actualizada(s).`);
      await load();
    } catch (saveError) {
      setError(saveError.message || "No se pudo guardar la matriz");
    } finally {
      setWorking(false);
    }
  };

  const createUnits = async () => {
    const rows = newRows.filter((row) =>
      Object.entries(row).some(
        ([key, value]) => key !== "rowId" && value !== "" && value !== null,
      ),
    );
    const errors = validateUnitRows(rows);
    setNewRowErrors(errors);
    if (Object.keys(errors).length > 0) return;

    try {
      setWorking(true);
      setError("");
      const created = await createEmprendimientoUnits({
        inmobiliariaId: activeInmobiliariaId,
        emprendimiento,
        rows,
      });
      setNewRows([createEmptyUnitRow(createRowId())]);
      setSuccess(`${created.length} unidad(es) creada(s) como borrador.`);
      await load();
    } catch (createError) {
      setError(createError.message || "No se pudieron crear las unidades");
    } finally {
      setWorking(false);
    }
  };

  const importUnits = async (importRows) => {
    try {
      setWorking(true);
      setError("");
      setSuccess("");
      const report = await importEmprendimientoUnits({
        inmobiliariaId: activeInmobiliariaId,
        emprendimiento,
        existingUnits: units,
        importRows,
      });

      if (report.created > 0 || report.updated > 0) await load();

      if (report.failed > 0) {
        setError(
          `La importación terminó con ${report.failed} fila(s) sin guardar. Revisá el informe.`,
        );
      } else {
        setSuccess(
          `Importación terminada: ${report.created} unidad(es) creada(s) y ${report.updated} actualizada(s).`,
        );
      }

      return report;
    } finally {
      setWorking(false);
    }
  };

  const linkSelected = async () => {
    const selected = availableInmuebles.filter((inmueble) =>
      selectedExistingIds.includes(inmueble.id),
    );
    if (selected.length === 0) return;

    try {
      setWorking(true);
      setError("");
      await linkInmueblesToEmprendimiento({
        inmobiliariaId: activeInmobiliariaId,
        emprendimiento,
        inmuebles: selected,
      });
      setSuccess(`${selected.length} inmueble(s) vinculado(s). Completá sus códigos en la matriz.`);
      await load();
    } catch (linkError) {
      setError(linkError.message || "No se pudieron vincular los inmuebles");
    } finally {
      setWorking(false);
    }
  };

  const unlink = async (unit) => {
    if (!window.confirm(`¿Desvincular “${unit.titulo}” del emprendimiento?`)) return;

    try {
      setWorking(true);
      setError("");
      await unlinkInmuebleFromEmprendimiento({
        inmobiliariaId: activeInmobiliariaId,
        inmueble: unit,
      });
      setSuccess("Unidad desvinculada. El inmueble no fue eliminado.");
      await load();
    } catch (unlinkError) {
      setError(unlinkError.message || "No se pudo desvincular la unidad");
    } finally {
      setWorking(false);
    }
  };

  if (loading) {
    return <main className="container py-5 text-center">Cargando matriz...</main>;
  }

  return (
    <main className="container-fluid px-3 px-xl-5 py-4">
      <SEO title={`Unidades de ${emprendimiento?.nombre || "emprendimiento"} | ONO Prop`} noIndex />

      <header className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
        <div>
          <p className="text-uppercase text-muted small mb-1">Matriz de unidades</p>
          <h1 className="h3 mb-1">{emprendimiento?.nombre || "Emprendimiento"}</h1>
          <p className="text-muted mb-0">Administrá disponibilidad, precios y características sin duplicar inmuebles.</p>
        </div>
        <div className="d-flex flex-wrap gap-2">
          <Link className="btn btn-outline-secondary" to="/admin/emprendimientos">Volver</Link>
          <Link className="btn btn-outline-primary" to={`/admin/emprendimientos/${id}/editar`}>Editar proyecto</Link>
          <Link className="btn btn-primary" to={`/admin/inmuebles/nuevo?emprendimientoId=${encodeURIComponent(id)}&emprendimientoNombre=${encodeURIComponent(emprendimiento?.nombre || "")}&emprendimientoSlug=${encodeURIComponent(emprendimiento?.slug || "")}`}>Nueva unidad completa</Link>
        </div>
      </header>

      {error && <div className="alert alert-danger">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <section className="row g-3 mb-4">
        {[
          ["Total", units.length, "text-bg-dark"],
          ["Disponibles", availabilityCounts.disponible, "text-bg-success"],
          ["Reservadas", availabilityCounts.reservada, "text-bg-warning"],
          ["Vendidas", availabilityCounts.vendida, "text-bg-primary"],
          ["No disponibles", availabilityCounts.no_disponible, "text-bg-secondary"],
        ].map(([label, value, badge]) => (
          <div className="col-6 col-md" key={label}>
            <div className="card border-0 shadow-sm h-100"><div className="card-body"><span className={`badge ${badge} mb-2`}>{label}</span><div className="h3 mb-0">{value}</div></div></div>
          </div>
        ))}
      </section>

      <section className="card border-0 shadow-sm mb-4">
        <div className="card-header d-flex flex-wrap justify-content-between align-items-center gap-2">
          <div><strong>Unidades ya creadas y vinculadas</strong><div className="small text-muted">Cada fila es un inmueble guardado. “Duplicar” abre una copia completa y editable; “Desvincular” sólo la separa del emprendimiento, sin eliminarla.</div></div>
          <button type="button" className="btn btn-primary btn-sm" disabled={working || units.length === 0} onClick={saveMatrix}>{working ? "Guardando..." : "Guardar cambios"}</button>
        </div>
        <div className="table-responsive">
          <table className="table table-sm table-hover align-middle mb-0">
            <thead className="table-light"><tr><th>Código *</th><th>Tipo</th><th>Tipología</th><th>Piso</th><th>Amb.</th><th>Dorm.</th><th>m²</th><th>Operación</th><th>Precio</th><th>Disponibilidad</th><th>Acciones</th></tr></thead>
            <tbody>
              {units.length === 0 ? <tr><td colSpan="11" className="text-center text-muted py-4">Todavía no hay unidades vinculadas.</td></tr> : units.map((unit, index) => (
                <UnitFieldsRow key={unit.id} row={rowsById[unit.id]} errors={matrixErrors[index] || {}} onChange={(field, value) => changeLinkedRow(unit.id, field, value)} onDuplicate={() => duplicateLinkedUnit(unit)} onRemove={() => unlink(unit)} />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <EmprendimientoUnitsCsvImport
        units={units}
        working={working}
        onImport={importUnits}
      />

      <section className="card border-0 shadow-sm mb-4">
        <div className="card-header"><strong>Altas pendientes: crear varias unidades</strong><div className="small text-muted">Estas filas todavía no existen como inmuebles. Podés editarlas, duplicarlas o quitarlas; recién se guardarán al presionar Crear. Se crearán no publicadas y heredarán la ubicación del emprendimiento.</div></div>
        <div className="table-responsive">
          <table className="table table-sm align-middle mb-0">
            <thead className="table-light"><tr><th>Código *</th><th>Tipo</th><th>Tipología</th><th>Piso</th><th>Amb.</th><th>Dorm.</th><th>m²</th><th>Operación</th><th>Precio</th><th>Disponibilidad</th><th>Acciones</th></tr></thead>
            <tbody>
              {newRows.map((row, index) => (
                <UnitFieldsRow key={row.rowId} compact row={row} errors={newRowErrors[index] || {}} onChange={(field, value) => changeNewRow(row.rowId, field, value)} onDuplicate={() => duplicateIntoNewRows(row)} onRemove={newRows.length > 1 ? () => setNewRows((current) => current.filter((item) => item.rowId !== row.rowId)) : null} />
              ))}
            </tbody>
          </table>
        </div>
        <div className="card-footer d-flex flex-wrap justify-content-between gap-2">
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setNewRows((current) => [...current, createEmptyUnitRow(createRowId())])} disabled={newRows.length >= 50}>+ Agregar fila</button>
          <button type="button" className="btn btn-success btn-sm" onClick={createUnits} disabled={working}>{working ? "Creando..." : `Crear ${newRows.length} unidad(es)`}</button>
        </div>
      </section>

      <section className="card border-0 shadow-sm">
        <div className="card-header"><strong>Vincular inmuebles existentes</strong><div className="small text-muted">Sólo se muestran inmuebles que todavía no pertenecen a otro emprendimiento.</div></div>
        <div className="card-body">
          <input className="form-control mb-3" type="search" placeholder="Buscar por título, tipo, operación o ciudad" value={existingSearch} onChange={(event) => setExistingSearch(event.target.value)} />
          {filteredAvailable.length === 0 ? <p className="text-muted mb-0">No hay inmuebles independientes disponibles.</p> : (
            <div className="row g-2">
              {filteredAvailable.map((inmueble) => (
                <div className="col-md-6 col-xl-4" key={inmueble.id}>
                  <label className="border rounded p-3 w-100 h-100 d-flex gap-2">
                    <input type="checkbox" className="form-check-input flex-shrink-0" checked={selectedExistingIds.includes(inmueble.id)} onChange={(event) => setSelectedExistingIds((current) => event.target.checked ? [...current, inmueble.id] : current.filter((item) => item !== inmueble.id))} />
                    <span><strong className="d-block">{inmueble.titulo || "Sin título"}</strong><span className="small text-muted">{inmueble.operacion} · {inmueble.tipo} · {inmueble.direccion?.ciudad || "Sin ciudad"}</span></span>
                  </label>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="card-footer text-end"><button type="button" className="btn btn-outline-primary btn-sm" disabled={working || selectedExistingIds.length === 0} onClick={linkSelected}>Vincular seleccionados ({selectedExistingIds.length})</button></div>
      </section>
    </main>
  );
};

export default EmprendimientoUnitsPage;
