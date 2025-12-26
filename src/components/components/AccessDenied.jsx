import { Link } from "react-router-dom";

const AccessDenied = () => {
  return (
    <div className="container mt-5">
      <div className="row justify-content-center">
        <div className="col-md-6 text-center">
          <div className="alert alert-danger">
            <h1>🚫 Acceso Denegado</h1>
            <p>No tienes permisos para acceder a esta página.</p>
            <Link to="/" className="btn btn-primary">
              Volver al Inicio
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccessDenied;
