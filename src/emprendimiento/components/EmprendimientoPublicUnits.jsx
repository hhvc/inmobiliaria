import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import {
  PUBLIC_UNIT_AVAILABILITY,
  PUBLIC_UNIT_INITIAL_FILTERS,
  filterPublicUnits,
  getConfiguredPublicUnits,
  getPublicUnitAvailability,
  getPublicUnitBedrooms,
  getPublicUnitCode,
  getPublicUnitFilterOptions,
  getPublicUnitPrice,
  getPublicUnitSummary,
  getPublicUnitSurface,
  getPublicUnitTypology,
  isPublicUnitContactable,
} from "../utils/emprendimientoPublicUnits.helpers";

const formatNumber = (value) =>
  Number(value).toLocaleString("es-AR", { maximumFractionDigits: 2 });

const formatUnitPrice = (unit) => {
  const price = getPublicUnitPrice(unit);
  return price === null
    ? "Consultar"
    : `${unit.moneda || "USD"} ${formatNumber(price)}`;
};

const formatSurfaceRange = (summary) => {
  if (summary.minSurface === null) return "Consultar";
  if (summary.minSurface === summary.maxSurface) {
    return `${formatNumber(summary.minSurface)} m²`;
  }
  return `${formatNumber(summary.minSurface)} a ${formatNumber(
    summary.maxSurface,
  )} m²`;
};

const formatMinimumPrices = (minPrices = {}) => {
  const entries = Object.entries(minPrices);
  if (entries.length === 0) return "Consultar";
  return entries
    .map(([currency, price]) => `${currency} ${formatNumber(price)}`)
    .join(" · ");
};

const EmprendimientoPublicUnits = ({
  units = [],
  showSold = false,
  onConsult,
}) => {
  const [filters, setFilters] = useState(PUBLIC_UNIT_INITIAL_FILTERS);

  const configuredUnits = useMemo(
    () => getConfiguredPublicUnits(units, { showSold }),
    [showSold, units],
  );
  const filterOptions = useMemo(
    () => getPublicUnitFilterOptions(configuredUnits),
    [configuredUnits],
  );
  const summary = useMemo(
    () => getPublicUnitSummary(configuredUnits),
    [configuredUnits],
  );
  const filteredUnits = useMemo(
    () => filterPublicUnits(configuredUnits, filters),
    [configuredUnits, filters],
  );

  const hasActiveFilters = Object.values(filters).some(Boolean);

  const changeFilter = (field, value) => {
    setFilters((current) => ({ ...current, [field]: value }));
  };

  return (
    <section className="bg-light py-5" id="unidades-disponibles">
      <div className="container">
        <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
          <div>
            <p className="text-uppercase text-muted small mb-1">Disponibilidad</p>
            <h2 className="h3 mb-1">Compará las unidades publicadas</h2>
            <p className="text-muted mb-0">
              Filtrá alternativas y consultá directamente por la que te interesa.
            </p>
          </div>
          <Link className="btn btn-outline-secondary" to="/inmuebles">
            Ver todos los inmuebles
          </Link>
        </div>

        {configuredUnits.length === 0 ? (
          <div className="alert alert-light border">
            Consultá por las unidades disponibles de este emprendimiento.
          </div>
        ) : (
          <>
            <div className="row g-3 mb-4">
              {[
                ["Unidades publicadas", summary.total],
                ["Disponibles", summary.disponible],
                ["Precio desde", formatMinimumPrices(summary.minPrices)],
                ["Superficies", formatSurfaceRange(summary)],
              ].map(([label, value]) => (
                <div className="col-6 col-xl-3" key={label}>
                  <div className="card h-100 border-0 shadow-sm">
                    <div className="card-body">
                      <div className="small text-muted mb-1">{label}</div>
                      <div className="h5 mb-0">{value}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="card border-0 shadow-sm mb-4">
              <div className="card-header d-flex flex-wrap justify-content-between align-items-center gap-2">
                <strong>Filtrar unidades</strong>
                {hasActiveFilters && (
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    onClick={() => setFilters(PUBLIC_UNIT_INITIAL_FILTERS)}
                  >
                    Limpiar filtros
                  </button>
                )}
              </div>
              <div className="card-body row g-3">
                <div className="col-md-4 col-xl-2">
                  <label className="form-label small">Tipología</label>
                  <select
                    className="form-select"
                    value={filters.tipologia}
                    onChange={(event) =>
                      changeFilter("tipologia", event.target.value)
                    }
                  >
                    <option value="">Todas</option>
                    {filterOptions.typologies.map((value) => (
                      <option value={value} key={value}>{value}</option>
                    ))}
                  </select>
                </div>
                <div className="col-md-4 col-xl-2">
                  <label className="form-label small">Dormitorios</label>
                  <select
                    className="form-select"
                    value={filters.dormitorios}
                    onChange={(event) =>
                      changeFilter("dormitorios", event.target.value)
                    }
                  >
                    <option value="">Todos</option>
                    {filterOptions.bedrooms.map((value) => (
                      <option value={value} key={value}>{value}</option>
                    ))}
                  </select>
                </div>
                <div className="col-md-4 col-xl-2">
                  <label className="form-label small">Superficie mínima</label>
                  <div className="input-group">
                    <input
                      className="form-control"
                      type="number"
                      min="0"
                      value={filters.superficieMin}
                      onChange={(event) =>
                        changeFilter("superficieMin", event.target.value)
                      }
                    />
                    <span className="input-group-text">m²</span>
                  </div>
                </div>
                <div className="col-md-4 col-xl-2">
                  <label className="form-label small">Moneda</label>
                  <select
                    className="form-select"
                    value={filters.moneda}
                    onChange={(event) => {
                      const currency = event.target.value;
                      setFilters((current) => ({
                        ...current,
                        moneda: currency,
                        precioMax: currency ? current.precioMax : "",
                      }));
                    }}
                  >
                    <option value="">Todas</option>
                    {filterOptions.currencies.map((value) => (
                      <option value={value} key={value}>{value}</option>
                    ))}
                  </select>
                </div>
                <div className="col-md-4 col-xl-2">
                  <label className="form-label small">Precio máximo</label>
                  <input
                    className="form-control"
                    type="number"
                    min="0"
                    disabled={
                      filterOptions.currencies.length > 1 && !filters.moneda
                    }
                    placeholder={
                      filterOptions.currencies.length > 1 && !filters.moneda
                        ? "Elegí moneda"
                        : ""
                    }
                    value={filters.precioMax}
                    onChange={(event) =>
                      changeFilter("precioMax", event.target.value)
                    }
                  />
                </div>
                <div className="col-md-4 col-xl-2">
                  <label className="form-label small">Disponibilidad</label>
                  <select
                    className="form-select"
                    value={filters.disponibilidad}
                    onChange={(event) =>
                      changeFilter("disponibilidad", event.target.value)
                    }
                  >
                    <option value="">Todas</option>
                    {Object.entries(PUBLIC_UNIT_AVAILABILITY).map(
                      ([value, config]) => (
                        <option value={value} key={value}>{config.label}</option>
                      ),
                    )}
                  </select>
                </div>
              </div>
            </div>

            <div className="d-flex justify-content-between align-items-center mb-2">
              <span className="small text-muted">
                {filteredUnits.length} de {configuredUnits.length} unidad(es)
              </span>
            </div>

            <div className="table-responsive bg-white rounded shadow-sm">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Unidad</th>
                    <th>Tipología</th>
                    <th>Dorm.</th>
                    <th>Superficie</th>
                    <th>Precio</th>
                    <th>Estado</th>
                    <th className="text-end">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUnits.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="text-center text-muted py-4">
                        No hay unidades que coincidan con los filtros.
                      </td>
                    </tr>
                  ) : (
                    filteredUnits.map((unit) => {
                      const availability = getPublicUnitAvailability(unit);
                      const availabilityConfig =
                        PUBLIC_UNIT_AVAILABILITY[availability] ||
                        PUBLIC_UNIT_AVAILABILITY.no_disponible;
                      const surface = getPublicUnitSurface(unit);
                      const bedrooms = getPublicUnitBedrooms(unit);
                      const contactable = isPublicUnitContactable(unit);

                      return (
                        <tr key={unit.id}>
                          <td>
                            <strong>{getPublicUnitCode(unit)}</strong>
                            {unit.unidadEmprendimiento?.piso && (
                              <div className="small text-muted">
                                Piso/sector {unit.unidadEmprendimiento.piso}
                              </div>
                            )}
                          </td>
                          <td>{getPublicUnitTypology(unit)}</td>
                          <td>{bedrooms === "" ? "—" : bedrooms}</td>
                          <td>{surface === null ? "—" : `${formatNumber(surface)} m²`}</td>
                          <td className="fw-semibold">{formatUnitPrice(unit)}</td>
                          <td>
                            <span className={`badge ${availabilityConfig.badgeClass}`}>
                              {availabilityConfig.label}
                            </span>
                          </td>
                          <td>
                            <div className="d-flex justify-content-end flex-wrap gap-2">
                              {unit.slug && (
                                <Link
                                  className="btn btn-sm btn-outline-secondary"
                                  to={`/inmueble/${unit.slug}`}
                                >
                                  Ver ficha
                                </Link>
                              )}
                              <button
                                type="button"
                                className="btn btn-sm btn-primary"
                                disabled={!contactable}
                                onClick={() => onConsult?.(unit)}
                              >
                                {contactable ? "Consultar" : "No disponible"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </section>
  );
};

export default EmprendimientoPublicUnits;
