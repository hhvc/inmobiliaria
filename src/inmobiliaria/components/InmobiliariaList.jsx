// src/inmobiliaria/components/InmobiliariaList.jsx
import { useInmobiliariaList } from "../../inmobiliaria/hooks/useInmobiliariaList";

export default function InmobiliariaList({ onEdit, onDisable }) {
  const { inmobiliarias, loading, error, isEmpty } = useInmobiliariaList();

  if (loading) {
    return <p className="text-muted">Cargando inmobiliarias...</p>;
  }

  if (error) {
    return <div className="alert alert-danger">{error}</div>;
  }

  if (isEmpty) {
    return (
      <div className="alert alert-info">No hay inmobiliarias disponibles.</div>
    );
  }

  return (
    <>
      {/* 🖥 DESKTOP: TABLA */}
      <div className="d-none d-md-block table-responsive">
        <table className="table table-striped align-middle">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Razón social</th>
              <th>CUIT</th>
              <th>Email</th>
              <th>Estado</th>
              <th style={{ width: 140 }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {inmobiliarias.map((inmo) => (
              <tr key={inmo.id}>
                <td>{inmo.nombre}</td>
                <td>{inmo.razonSocial}</td>
                <td>{inmo.cuit}</td>
                <td>{inmo.email}</td>
                <td>
                  {inmo.activa ? (
                    <span className="badge bg-success">Activa</span>
                  ) : (
                    <span className="badge bg-secondary">Inactiva</span>
                  )}
                </td>
                <td>
                  <button
                    className="btn btn-sm btn-outline-primary me-2"
                    onClick={() => onEdit?.(inmo)}
                  >
                    Editar
                  </button>
                  <button
                    className="btn btn-sm btn-outline-danger"
                    onClick={() => onDisable?.(inmo)}
                  >
                    Baja
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 📱 MOBILE: CARDS */}
      <div className="d-md-none">
        <div className="row g-3">
          {inmobiliarias.map((inmo) => (
            <div className="col-12" key={inmo.id}>
              <div className="card shadow-sm">
                <div className="card-body">
                  <h6 className="card-title mb-1">{inmo.nombre}</h6>
                  <p className="mb-1 small text-muted">{inmo.razonSocial}</p>

                  <div className="small">
                    <div>
                      <strong>CUIT:</strong> {inmo.cuit}
                    </div>
                    <div>
                      <strong>Email:</strong> {inmo.email}
                    </div>
                  </div>

                  <div className="mt-2">
                    {inmo.activa ? (
                      <span className="badge bg-success">Activa</span>
                    ) : (
                      <span className="badge bg-secondary">Inactiva</span>
                    )}
                  </div>

                  <div className="d-flex gap-2 mt-3">
                    <button
                      className="btn btn-sm btn-outline-primary w-100"
                      onClick={() => onEdit?.(inmo)}
                    >
                      Editar
                    </button>
                    <button
                      className="btn btn-sm btn-outline-danger w-100"
                      onClick={() => onDisable?.(inmo)}
                    >
                      Baja
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
