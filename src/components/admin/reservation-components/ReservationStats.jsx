const ReservationStats = ({ reservations }) => {
  const total = reservations.length;
  const pending = reservations.filter((r) => r.status === "pending").length;
  const confirmed = reservations.filter((r) => r.status === "confirmed").length;
  const cancelled = reservations.filter((r) => r.status === "cancelled").length;

  const totalRevenue = reservations
    .filter((r) => r.status === "confirmed")
    .reduce((sum, r) => sum + (r.total || 0), 0);

  return (
    <div className="row mb-4">
      <div className="col-md-2">
        <div className="card bg-primary text-white">
          <div className="card-body text-center py-3">
            <h4 className="mb-0">{total}</h4>
            <small>Total Reservas</small>
          </div>
        </div>
      </div>
      <div className="col-md-2">
        <div className="card bg-warning text-white">
          <div className="card-body text-center py-3">
            <h4 className="mb-0">{pending}</h4>
            <small>Pendientes</small>
          </div>
        </div>
      </div>
      <div className="col-md-2">
        <div className="card bg-success text-white">
          <div className="card-body text-center py-3">
            <h4 className="mb-0">{confirmed}</h4>
            <small>Confirmadas</small>
          </div>
        </div>
      </div>
      <div className="col-md-2">
        <div className="card bg-danger text-white">
          <div className="card-body text-center py-3">
            <h4 className="mb-0">{cancelled}</h4>
            <small>Canceladas</small>
          </div>
        </div>
      </div>
      <div className="col-md-4">
        <div className="card bg-info text-white">
          <div className="card-body text-center py-3">
            <h4 className="mb-0">${totalRevenue.toLocaleString()}</h4>
            <small>Ingresos Confirmados</small>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReservationStats;
