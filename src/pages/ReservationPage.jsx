import ReservationSystem from "../components/components/ReservationSystem";

const ReservationPage = () => {
  return (
    <div className="container mt-4">
      <div className="row">
        <div className="col-12">
          <h1>🏠 Realizar Reserva</h1>
          <p className="text-muted">
            Completa los datos para confirmar tu reserva
          </p>
        </div>
      </div>
      <ReservationSystem />
    </div>
  );
};

export default ReservationPage;
