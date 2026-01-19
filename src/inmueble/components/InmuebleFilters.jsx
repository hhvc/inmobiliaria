import PropTypes from "prop-types";

const InmuebleFilters = ({ filters, onChange, onReset, loading = false }) => {
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    onChange({
      ...filters,
      [name]: type === "checkbox" ? checked : value,
    });
  };

  return (
    <div className="card mb-4">
      <div className="card-body">
        <h5 className="card-title mb-3">Filtros</h5>

        <div className="row g-3">
          {/* Texto libre */}
          <div className="col-12 col-md-4">
            <label className="form-label">Buscar</label>
            <input
              type="text"
              className="form-control"
              name="search"
              placeholder="Título, dirección, referencia..."
              value={filters.search || ""}
              onChange={handleChange}
              disabled={loading}
            />
          </div>

          {/* Operación */}
          <div className="col-12 col-md-2">
            <label className="form-label">Operación</label>
            <select
              className="form-select"
              name="operacion"
              value={filters.operacion || ""}
              onChange={handleChange}
              disabled={loading}
            >
              <option value="">Todas</option>
              <option value="venta">Venta</option>
              <option value="alquiler">Alquiler</option>
            </select>
          </div>

          {/* Tipo */}
          <div className="col-12 col-md-2">
            <label className="form-label">Tipo</label>
            <select
              className="form-select"
              name="tipo"
              value={filters.tipo || ""}
              onChange={handleChange}
              disabled={loading}
            >
              <option value="">Todos</option>
              <option value="casa">Casa</option>
              <option value="departamento">Departamento</option>
              <option value="terreno">Terreno</option>
              <option value="local">Local</option>
              <option value="oficina">Oficina</option>
            </select>
          </div>

          {/* Estado */}
          <div className="col-12 col-md-2">
            <label className="form-label">Estado</label>
            <select
              className="form-select"
              name="estado"
              value={filters.estado || ""}
              onChange={handleChange}
              disabled={loading}
            >
              <option value="">Todos</option>
              <option value="disponible">Disponible</option>
              <option value="reservado">Reservado</option>
              <option value="vendido">Vendido</option>
              <option value="alquilado">Alquilado</option>
            </select>
          </div>

          {/* Destacado */}
          <div className="col-12 col-md-2 d-flex align-items-end">
            <div className="form-check">
              <input
                className="form-check-input"
                type="checkbox"
                name="destacado"
                id="destacado"
                checked={filters.destacado || false}
                onChange={handleChange}
                disabled={loading}
              />
              <label className="form-check-label" htmlFor="destacado">
                Solo destacados
              </label>
            </div>
          </div>

          {/* Acciones */}
          <div className="col-12 d-flex gap-2 mt-2">
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={onReset}
              disabled={loading}
            >
              Limpiar filtros
            </button>

            {loading && (
              <div className="d-flex align-items-center">
                <span className="spinner-border spinner-border-sm me-2" />
                Cargando…
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

InmuebleFilters.propTypes = {
  filters: PropTypes.shape({
    search: PropTypes.string,
    operacion: PropTypes.string,
    tipo: PropTypes.string,
    estado: PropTypes.string,
    destacado: PropTypes.bool,
  }).isRequired,
  onChange: PropTypes.func.isRequired,
  onReset: PropTypes.func.isRequired,
  loading: PropTypes.bool,
};

export default InmuebleFilters;
