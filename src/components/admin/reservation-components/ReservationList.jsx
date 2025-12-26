// components/admin/reservation-components/ReservationList.jsx
import ReservationRow from "./ReservationRow";

const ReservationList = ({
  reservations,
  loadingReservations,
  filterStatus,
  onUpdateStatus,
  onDeleteReservation,
  showCabanaColumn = false,
}) => {
  if (loadingReservations) {
    return (
      <div className="text-center py-4">
        <div className="spinner-border" role="status">
          <span className="visually-hidden">Cargando...</span>
        </div>
        <p className="mt-2">Cargando reservas...</p>
      </div>
    );
  }

  if (reservations.length === 0) {
    return (
      <div className="text-center py-4">
        <div className="alert alert-info">
          <h5>📭 No hay reservas</h5>
          <p className="mb-0">
            {filterStatus === "all"
              ? "No se encontraron reservas."
              : `No hay reservas con estado "${filterStatus}".`}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="table-responsive">
      <table className="table table-striped table-hover">
        <thead className="table-dark">
          <tr>
            {showCabanaColumn && <th>Cabaña</th>}
            <th>Huésped</th>
            <th>Contacto</th>
            <th>Fechas</th>
            <th>Personas</th>
            <th>Total</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {reservations.map((reservation) => (
            <ReservationRow
              key={reservation.id}
              reservation={reservation}
              onUpdateStatus={onUpdateStatus}
              onDeleteReservation={onDeleteReservation}
              showCabanaColumn={showCabanaColumn}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ReservationList;
