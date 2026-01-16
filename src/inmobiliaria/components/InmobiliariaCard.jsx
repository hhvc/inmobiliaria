// src/inmobiliaria/components/InmobiliariaCard.jsx
export default function InmobiliariaCard({ inmobiliaria, onEdit, onDisable }) {
  return (
    <div className="card shadow-sm h-100">
      <div className="card-body">
        <h6 className="card-title mb-1">{inmobiliaria.nombre}</h6>
        <p className="text-muted small mb-2">{inmobiliaria.razonSocial}</p>

        <div className="small mb-2">
          <div>
            <strong>CUIT:</strong> {inmobiliaria.cuit}
          </div>
          <div>
            <strong>Email:</strong> {inmobiliaria.email}
          </div>
        </div>

        <div className="mb-3">
          {inmobiliaria.activa ? (
            <span className="badge bg-success">Activa</span>
          ) : (
            <span className="badge bg-secondary">Inactiva</span>
          )}
        </div>

        <div className="d-flex gap-2">
          <button
            className="btn btn-sm btn-outline-primary w-100"
            onClick={() => onEdit(inmobiliaria)}
          >
            Editar
          </button>
          <button
            className="btn btn-sm btn-outline-danger w-100"
            onClick={() => onDisable(inmobiliaria)}
          >
            Baja
          </button>
        </div>
      </div>
    </div>
  );
}
