const ReservationFilters = ({
  filterStatus,
  onFilterChange,
  searchTerm,
  onSearchChange,
}) => {
  return (
    <div className="row mb-4">
      <div className="col-md-4">
        <label className="form-label fw-bold">Filtrar por estado:</label>
        <select
          className="form-select"
          value={filterStatus}
          onChange={(e) => onFilterChange(e.target.value)}
        >
          <option value="all">Todas las reservas</option>
          <option value="pending">Pendientes</option>
          <option value="confirmed">Confirmadas</option>
          <option value="cancelled">Canceladas</option>
        </select>
      </div>
      <div className="col-md-4">
        <label className="form-label fw-bold">Buscar:</label>
        <input
          type="text"
          className="form-control"
          placeholder="Buscar por nombre, email o teléfono..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
      <div className="col-md-4">
        <label className="form-label fw-bold">Acciones rápidas:</label>
        <div className="d-grid gap-2">
          <button
            className="btn btn-outline-primary btn-sm"
            onClick={() => window.print()}
          >
            🖨️ Imprimir Lista
          </button>
          <button
            className="btn btn-outline-success btn-sm"
            onClick={() => alert("Exportar a Excel - Próximamente")}
          >
            📊 Exportar Excel
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReservationFilters;
