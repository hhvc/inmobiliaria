// src/inmobiliaria/components/InmobiliariaFilters.jsx
export default function InmobiliariaFilters({ filters, onChange }) {
  return (
    <div className="card mb-4">
      <div className="card-body">
        <div className="row g-3">
          <div className="col-md-4">
            <input
              type="text"
              className="form-control"
              placeholder="Buscar por nombre..."
              value={filters.search}
              onChange={(e) => onChange({ ...filters, search: e.target.value })}
            />
          </div>

          <div className="col-md-3">
            <select
              className="form-select"
              value={filters.estado}
              onChange={(e) => onChange({ ...filters, estado: e.target.value })}
            >
              <option value="">Todas</option>
              <option value="activa">Activas</option>
              <option value="inactiva">Inactivas</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
