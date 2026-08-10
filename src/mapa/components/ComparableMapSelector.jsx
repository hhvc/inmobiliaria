import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { searchOmiComparables } from "../services/omi.service";
import {
  MAX_TASACION_COMPARABLES,
  buildInmuebleComparable,
  buildInmuebleMapPoint,
  buildOmiComparable,
  buildOmiMapPoint,
  filterComparableMapPoints,
  isTasacionComparableEmpty,
  normalizeMapCoordinates,
} from "../utils/mapa.helpers";
import InteractiveMap from "./InteractiveMap";

const sourceKey = (provider, recordId) =>
  provider && recordId ? `${provider}:${recordId}` : "";

const EMPTY_FILTERS = {
  source: "all",
  propertyType: "",
  operation: "",
  publication: "",
  minPrice: "",
  maxPrice: "",
  minSurface: "",
  maxSurface: "",
  maxDistanceKm: "",
  dateFrom: "",
  dateTo: "",
};

const TYPE_LABELS = {
  casa: "Casa / PH",
  departamento: "Departamento",
  terreno: "Terreno / lote",
  local: "Local / depósito",
  oficina: "Oficina",
  campo: "Campo",
  otro: "Otra tipología",
};

const typeLabel = (value) => {
  if (TYPE_LABELS[value]) return TYPE_LABELS[value];
  if (value.startsWith("omi:")) return `Tipología OMI código ${value.slice(4)}`;
  return value;
};

const operationLabel = (value) => ({
  venta: "Venta",
  alquiler: "Alquiler",
  alquiler_temporal: "Alquiler temporal",
}[value] || value);

const formatDistance = (value) => {
  if (!Number.isFinite(Number(value))) return "Distancia no disponible";
  if (Number(value) < 1000) return `${Math.round(Number(value))} m`;
  return `${(Number(value) / 1000).toLocaleString("es-AR", {
    maximumFractionDigits: 2,
  })} km`;
};

const ComparableMapSelector = ({
  subjectLocation,
  subjectInmuebleId = "",
  inmuebles = [],
  existingComparables = [],
  onAddComparable,
  inmobiliariaId = "",
}) => {
  const coordinates = normalizeMapCoordinates(
    subjectLocation?.latitude,
    subjectLocation?.longitude,
  );
  const [bounds, setBounds] = useState(null);
  const [omiItems, setOmiItems] = useState([]);
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const automaticSearchCoordinate = useRef("");
  const coordinateKey = coordinates
    ? `${coordinates.latitude.toFixed(6)}:${coordinates.longitude.toFixed(6)}`
    : "";

  const subjectPoint = coordinates
    ? {
        id: "tasacion-subject",
        kind: "subject",
        position: [coordinates.latitude, coordinates.longitude],
        title: "Inmueble a tasar",
        address: "Ubicación del bien sujeto",
      }
    : null;

  const ownPoints = useMemo(
    () =>
      inmuebles
        .filter((item) => item.id !== subjectInmuebleId)
        .map((item) => buildInmuebleMapPoint(item, {
          subjectLocation: coordinates,
        }))
        .filter(Boolean),
    [coordinates, inmuebles, subjectInmuebleId],
  );
  const omiPoints = useMemo(
    () => omiItems
      .map((item) => buildOmiMapPoint(item, {subjectLocation: coordinates}))
      .filter(Boolean),
    [coordinates, omiItems],
  );
  const allPoints = useMemo(
    () => [...ownPoints, ...omiPoints],
    [omiPoints, ownPoints],
  );
  const points = useMemo(
    () => filterComparableMapPoints(allPoints, filters),
    [allPoints, filters],
  );
  const typeOptions = useMemo(
    () => Array.from(new Set(allPoints.map((point) => point.comparableType)
      .filter(Boolean))).sort(),
    [allPoints],
  );
  const operationOptions = useMemo(
    () => Array.from(new Set(allPoints.map((point) => point.operation)
      .filter(Boolean))).sort(),
    [allPoints],
  );
  const existingKeys = useMemo(
    () =>
      new Set(
        existingComparables
          .map((item) =>
            sourceKey(
              item.externalSource?.provider,
              item.externalSource?.recordId,
            ),
          )
          .filter(Boolean),
      ),
    [existingComparables],
  );
  const usedComparableCount = existingComparables.filter(
    (item) => !isTasacionComparableEmpty(item),
  ).length;
  const limitReached = usedComparableCount >= MAX_TASACION_COMPARABLES;

  const searchCurrentArea = useCallback(async () => {
    if (!bounds) return;
    try {
      setLoading(true);
      setError("");
      setNotice("");
      const result = await searchOmiComparables({
        bounds,
        crs: "EPSG:4326",
        limit: 200,
        inmobiliariaId,
      });
      setOmiItems(result?.items || []);
      setNotice(
        `${result?.returned || 0} antecedentes OMI encontrados en el área visible.`,
      );
    } catch (searchError) {
      setError(searchError.message || "No se pudo consultar OMI.");
    } finally {
      setLoading(false);
    }
  }, [bounds, inmobiliariaId]);

  useEffect(() => {
    automaticSearchCoordinate.current = "";
    setSelectedPoint(null);
    setOmiItems([]);
  }, [coordinateKey]);

  useEffect(() => {
    if (
      !coordinates ||
      !bounds ||
      automaticSearchCoordinate.current === coordinateKey
    ) return undefined;
    const timeout = window.setTimeout(() => {
      automaticSearchCoordinate.current = coordinateKey;
      searchCurrentArea();
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [bounds, coordinateKey, coordinates, searchCurrentArea]);

  useEffect(() => {
    if (
      selectedPoint &&
      !points.some((point) => point.id === selectedPoint.id)
    ) {
      setSelectedPoint(null);
    }
  }, [points, selectedPoint]);

  const selectedComparable = selectedPoint
    ? selectedPoint.kind === "omi"
      ? buildOmiComparable(selectedPoint.raw, {subjectLocation: coordinates})
      : buildInmuebleComparable(selectedPoint.raw, {subjectLocation: coordinates})
    : null;
  const selectedKey = selectedComparable
    ? sourceKey(
        selectedComparable.externalSource?.provider,
        selectedComparable.externalSource?.recordId,
      )
    : "";
  const alreadyAdded = selectedKey && existingKeys.has(selectedKey);

  if (!coordinates) {
    return (
      <div className="alert alert-info mb-4">
        Indicá la ubicación del inmueble en el paso 2 para buscar antecedentes
        propios y de OMI sobre el mapa.
      </div>
    );
  }

  return (
    <section className="comparable-map-selector border rounded p-3 mb-4">
      <div className="d-flex flex-wrap justify-content-between gap-2 align-items-start mb-2">
        <div>
          <h3 className="h6 mb-1">Buscar antecedentes en el mapa</h3>
          <p className="text-muted small mb-0">
            Se muestran inmuebles de la inmobiliaria y antecedentes profesionales
            de OMI dentro del área visible.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-sm btn-outline-primary"
          disabled={!bounds || loading}
          onClick={searchCurrentArea}
        >
          {loading ? "Consultando OMI..." : "Buscar OMI en esta zona"}
        </button>
      </div>

      <div className="comparable-map-legend small text-muted mb-2">
        <span className="legend-subject">Bien sujeto</span>
        <span className="legend-inmueble">Inmuebles propios</span>
        <span className="legend-omi">OMI / IDECOR</span>
      </div>

      <div className="card bg-light border mb-3">
        <div className="card-body py-3">
          <div className="d-flex flex-wrap justify-content-between gap-2 mb-2">
            <strong className="small">Filtrar antecedentes visibles</strong>
            <button
              type="button"
              className="btn btn-sm btn-link p-0"
              onClick={() => setFilters(EMPTY_FILTERS)}
            >
              Limpiar filtros
            </button>
          </div>
          <div className="row g-2">
            <div className="col-6 col-lg-3">
              <label className="form-label small">Fuente</label>
              <select
                className="form-select form-select-sm"
                value={filters.source}
                onChange={(event) => setFilters((current) => ({
                  ...current,
                  source: event.target.value,
                }))}
              >
                <option value="all">Todas</option>
                <option value="inmueble">Inventario propio</option>
                <option value="omi">OMI / IDECOR</option>
              </select>
            </div>
            <div className="col-6 col-lg-3">
              <label className="form-label small">Tipología</label>
              <select
                className="form-select form-select-sm"
                value={filters.propertyType}
                onChange={(event) => setFilters((current) => ({
                  ...current,
                  propertyType: event.target.value,
                }))}
              >
                <option value="">Todas</option>
                {typeOptions.map((value) => (
                  <option value={value} key={value}>{typeLabel(value)}</option>
                ))}
              </select>
            </div>
            <div className="col-6 col-lg-3">
              <label className="form-label small">Operación</label>
              <select
                className="form-select form-select-sm"
                value={filters.operation}
                onChange={(event) => setFilters((current) => ({
                  ...current,
                  operation: event.target.value,
                }))}
              >
                <option value="">Todas / sin clasificar</option>
                {operationOptions.map((value) => (
                  <option value={value} key={value}>{operationLabel(value)}</option>
                ))}
              </select>
            </div>
            <div className="col-6 col-lg-3">
              <label className="form-label small">Estado de ficha</label>
              <select
                className="form-select form-select-sm"
                value={filters.publication}
                onChange={(event) => setFilters((current) => ({
                  ...current,
                  publication: event.target.value,
                }))}
              >
                <option value="">Publicados y borradores</option>
                <option value="published">Solo publicados</option>
                <option value="draft">Solo no publicados</option>
              </select>
            </div>
            {[
              ["minPrice", "Precio mínimo"],
              ["maxPrice", "Precio máximo"],
              ["minSurface", "Superficie mínima"],
              ["maxSurface", "Superficie máxima"],
              ["maxDistanceKm", "Distancia máxima (km)"],
            ].map(([id, label]) => (
              <div className="col-6 col-lg" key={id}>
                <label className="form-label small">{label}</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="form-control form-control-sm"
                  value={filters[id]}
                  onChange={(event) => setFilters((current) => ({
                    ...current,
                    [id]: event.target.value,
                  }))}
                />
              </div>
            ))}
            <div className="col-6 col-lg">
              <label className="form-label small">Fecha desde</label>
              <input
                type="date"
                className="form-control form-control-sm"
                value={filters.dateFrom}
                onChange={(event) => setFilters((current) => ({
                  ...current,
                  dateFrom: event.target.value,
                }))}
              />
            </div>
            <div className="col-6 col-lg">
              <label className="form-label small">Fecha hasta</label>
              <input
                type="date"
                className="form-control form-control-sm"
                value={filters.dateTo}
                onChange={(event) => setFilters((current) => ({
                  ...current,
                  dateTo: event.target.value,
                }))}
              />
            </div>
          </div>
          <div className="form-text mt-2">
            Mostrando {points.length} de {allPoints.length} antecedentes cargados
            en el área. Seleccionados: {usedComparableCount} de {MAX_TASACION_COMPARABLES}.
          </div>
        </div>
      </div>

      {error && <div className="alert alert-warning py-2">{error}</div>}
      {notice && <div className="alert alert-light border py-2">{notice}</div>}

      <InteractiveMap
        center={[coordinates.latitude, coordinates.longitude]}
        zoom={15}
        subjectPoint={subjectPoint}
        points={points}
        selectedPointId={selectedPoint?.id || ""}
        onSelectPoint={(point) => {
          if (point.kind !== "subject") setSelectedPoint(point);
        }}
        onViewportChange={setBounds}
        focusPosition={[coordinates.latitude, coordinates.longitude]}
        focusVersion={coordinateKey}
      />

      {points.length === 0 && allPoints.length > 0 && (
        <div className="alert alert-info py-2 mt-2 mb-0">
          Ningún antecedente cumple los filtros actuales.
        </div>
      )}

      {selectedPoint && selectedComparable && (
        <div className="card mt-3">
          <div className="card-body d-flex flex-wrap justify-content-between gap-3 align-items-center">
            <div>
              <div className="text-uppercase text-muted small">
                {selectedPoint.kind === "omi"
                  ? "Antecedente OMI / IDECOR"
                  : "Inmueble propio"}
              </div>
              <strong>{selectedPoint.title}</strong>
              <div>{selectedPoint.priceLabel}</div>
              {selectedPoint.surfaceLabel && (
                <div className="small text-muted">{selectedPoint.surfaceLabel}</div>
              )}
              <div className="small text-muted">
                {formatDistance(selectedPoint.distanceMeters)} del inmueble sujeto
                {selectedPoint.sourceDate ? ` · dato ${selectedPoint.sourceDate}` : ""}
              </div>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              disabled={alreadyAdded || limitReached}
              onClick={() => onAddComparable?.(selectedComparable)}
            >
              {alreadyAdded
                ? "Antecedente ya agregado"
                : limitReached
                  ? "Máximo de 5 antecedentes"
                  : "Agregar como antecedente"}
            </button>
          </div>
        </div>
      )}

      <p className="form-text mt-2 mb-0">
        Los datos OMI se incorporan con trazabilidad de fuente. Antes de adoptar
        el valor verificá moneda, fecha, tipología, vigencia y comparabilidad.
      </p>
    </section>
  );
};

export default ComparableMapSelector;
