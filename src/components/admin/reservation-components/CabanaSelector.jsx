// components/admin/reservation-components/CabanaSelector.jsx
const CabanaSelector = ({
  cabanas,
  selectedCabana,
  onCabanaChange,
  showAllOption = false,
}) => {
  return (
    <div className="card mb-4">
      <div className="card-header bg-light">
        <h5 className="mb-0">🏠 Seleccionar Cabaña</h5>
      </div>
      <div className="card-body">
        <div className="row align-items-center">
          <div className="col-md-6">
            <label className="form-label fw-bold">Cabaña:</label>
            <select
              className="form-select"
              value={selectedCabana || ""}
              onChange={(e) => onCabanaChange(e.target.value)}
            >
              {showAllOption && (
                <option value="all">🏘️ Todas las Cabañas</option>
              )}
              {cabanas.map((cabana) => (
                <option key={cabana.id} value={cabana.id}>
                  {cabana.nombre} - ${cabana.precios?.base || 100}/noche -{" "}
                  {cabana.capacidad && typeof cabana.capacidad === "object"
                    ? `${cabana.capacidad.maxPersonas} pers.`
                    : `${cabana.capacidad || 0} pers.`}
                </option>
              ))}
            </select>
          </div>
          <div className="col-md-6">
            {selectedCabana && selectedCabana !== "all" && (
              <div className="bg-light p-3 rounded">
                <h6 className="mb-1">
                  {cabanas.find((c) => c.id === selectedCabana)?.nombre}
                </h6>
                <small className="text-muted d-block">
                  Capacidad:{" "}
                  {(() => {
                    const cabana = cabanas.find((c) => c.id === selectedCabana);
                    return cabana?.capacidad &&
                      typeof cabana.capacidad === "object"
                      ? cabana.capacidad.maxPersonas
                      : cabana?.capacidad || 0;
                  })()}{" "}
                  huéspedes • Dormitorios:{" "}
                  {cabanas.find((c) => c.id === selectedCabana)?.dormitorios}
                </small>
                <small className="text-muted">
                  Precio base: $
                  {cabanas.find((c) => c.id === selectedCabana)?.precios
                    ?.base || 100}
                  /noche
                  {cabanas.find((c) => c.id === selectedCabana)?.precios
                    ?.temporadas &&
                    cabanas.find((c) => c.id === selectedCabana)?.precios
                      .temporadas.length > 0 && (
                      <span className="text-success">
                        {" "}
                        • Tarifas especiales configuradas
                      </span>
                    )}
                </small>
              </div>
            )}
            {selectedCabana === "all" && (
              <div className="bg-light p-3 rounded">
                <h6 className="mb-1">🏘️ Todas las Cabañas</h6>
                <small className="text-muted">
                  Viendo reservas de todas las cabañas del complejo
                </small>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CabanaSelector;
