import { Link } from "react-router-dom";
import { useAuth } from "../../context/auth/useAuth";
import { useDashboardStats } from "../../hooks/useDashboardStats";

const AdminDashboard = () => {
  const { user, hasRole } = useAuth();
  const { stats, loading, error } = useDashboardStats();

  if (!hasRole("admin")) {
    return (
      <div className="container mt-4">
        <div className="alert alert-danger text-center">
          <h4>🚫 Acceso Denegado</h4>
          <p>No tienes permisos para acceder a esta sección.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mt-4">
      <div className="row">
        <div className="col-md-12">
          <div className="d-flex justify-content-between align-items-center mb-4">
            <div>
              <h1>🛠️ Panel de Administración</h1>
              <p className="text-muted mb-0">
                Bienvenido, <strong>{user?.displayName || user?.email}</strong>
              </p>
            </div>
            <div className="text-end">
              <small className="text-muted">
                Rol: <strong>{user?.role}</strong>
              </small>
            </div>
          </div>

          {/* Mostrar error si existe */}
          {error && (
            <div
              className="alert alert-warning alert-dismissible fade show"
              role="alert"
            >
              <strong>Advertencia:</strong> {error}
              <button
                type="button"
                className="btn-close"
                data-bs-dismiss="alert"
              ></button>
            </div>
          )}

          {/* Tarjetas de estadísticas rápidas */}
          <div className="row mb-5">
            {/* Cabañas */}
            <div className="col-md-2">
              <div className="card bg-primary text-white">
                <div className="card-body text-center">
                  <i className="fa fa-home fa-2x mb-2"></i>
                  {loading ? (
                    <div
                      className="spinner-border spinner-border-sm"
                      role="status"
                    >
                      <span className="visually-hidden">Cargando...</span>
                    </div>
                  ) : (
                    <>
                      <h4 className="mb-0">{stats.totalCabanas}</h4>
                      <small>Total Cabañas</small>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="col-md-2">
              <div className="card bg-success text-white">
                <div className="card-body text-center">
                  <i className="fa fa-check-circle fa-2x mb-2"></i>
                  {loading ? (
                    <div
                      className="spinner-border spinner-border-sm"
                      role="status"
                    >
                      <span className="visually-hidden">Cargando...</span>
                    </div>
                  ) : (
                    <>
                      <h4 className="mb-0">{stats.cabanasDisponibles}</h4>
                      <small>Disponibles</small>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="col-md-2">
              <div className="card bg-warning text-white">
                <div className="card-body text-center">
                  <i className="fa fa-star fa-2x mb-2"></i>
                  {loading ? (
                    <div
                      className="spinner-border spinner-border-sm"
                      role="status"
                    >
                      <span className="visually-hidden">Cargando...</span>
                    </div>
                  ) : (
                    <>
                      <h4 className="mb-0">{stats.cabanasDestacadas}</h4>
                      <small>Destacadas</small>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Reservas */}
            <div className="col-md-2">
              <div className="card bg-info text-white">
                <div className="card-body text-center">
                  <i className="fa fa-calendar-check fa-2x mb-2"></i>
                  {loading ? (
                    <div
                      className="spinner-border spinner-border-sm"
                      role="status"
                    >
                      <span className="visually-hidden">Cargando...</span>
                    </div>
                  ) : (
                    <>
                      <h4 className="mb-0">{stats.totalReservas}</h4>
                      <small>Total Reservas</small>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="col-md-2">
              <div className="card bg-success text-white">
                <div className="card-body text-center">
                  <i className="fa fa-check fa-2x mb-2"></i>
                  {loading ? (
                    <div
                      className="spinner-border spinner-border-sm"
                      role="status"
                    >
                      <span className="visually-hidden">Cargando...</span>
                    </div>
                  ) : (
                    <>
                      <h4 className="mb-0">{stats.reservasConfirmadas}</h4>
                      <small>Confirmadas</small>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="col-md-2">
              <div className="card bg-warning text-white">
                <div className="card-body text-center">
                  <i className="fa fa-clock fa-2x mb-2"></i>
                  {loading ? (
                    <div
                      className="spinner-border spinner-border-sm"
                      role="status"
                    >
                      <span className="visually-hidden">Cargando...</span>
                    </div>
                  ) : (
                    <>
                      <h4 className="mb-0">{stats.reservasPendientes}</h4>
                      <small>Pendientes</small>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Segunda fila de estadísticas */}
            <div className="col-md-2 mt-3">
              <div className="card bg-danger text-white">
                <div className="card-body text-center">
                  <i className="fa fa-times fa-2x mb-2"></i>
                  {loading ? (
                    <div
                      className="spinner-border spinner-border-sm"
                      role="status"
                    >
                      <span className="visually-hidden">Cargando...</span>
                    </div>
                  ) : (
                    <>
                      <h4 className="mb-0">{stats.reservasCanceladas}</h4>
                      <small>Canceladas</small>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="col-md-2 mt-3">
              <div
                className="card text-white"
                style={{ backgroundColor: "#6f42c1" }}
              >
                <div className="card-body text-center">
                  <i className="fa fa-envelope fa-2x mb-2"></i>
                  {loading ? (
                    <div
                      className="spinner-border spinner-border-sm"
                      role="status"
                    >
                      <span className="visually-hidden">Cargando...</span>
                    </div>
                  ) : (
                    <>
                      <h4 className="mb-0">{stats.totalContactos}</h4>
                      <small>Total Contactos</small>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="col-md-2 mt-3">
              <div className="card bg-info text-white">
                <div className="card-body text-center">
                  <i className="fa fa-calendar-day fa-2x mb-2"></i>
                  {loading ? (
                    <div
                      className="spinner-border spinner-border-sm"
                      role="status"
                    >
                      <span className="visually-hidden">Cargando...</span>
                    </div>
                  ) : (
                    <>
                      <h4 className="mb-0">{stats.contactosHoy}</h4>
                      <small>Contactos Hoy</small>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="col-md-2 mt-3">
              <div className="card bg-warning text-white">
                <div className="card-body text-center">
                  <i className="fa fa-bell fa-2x mb-2"></i>
                  {loading ? (
                    <div
                      className="spinner-border spinner-border-sm"
                      role="status"
                    >
                      <span className="visually-hidden">Cargando...</span>
                    </div>
                  ) : (
                    <>
                      <h4 className="mb-0">{stats.contactosNoLeidos}</h4>
                      <small>Contactos Por Leer</small>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="col-md-2 mt-3">
              <div className="card bg-secondary text-white">
                <div className="card-body text-center">
                  <i className="fa fa-users fa-2x mb-2"></i>
                  {loading ? (
                    <div
                      className="spinner-border spinner-border-sm"
                      role="status"
                    >
                      <span className="visually-hidden">Cargando...</span>
                    </div>
                  ) : (
                    <>
                      <h4 className="mb-0">{stats.totalUsuarios}</h4>
                      <small>Usuarios</small>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="col-md-2 mt-3">
              <div className="card bg-dark text-white">
                <div className="card-body text-center">
                  <i className="fa fa-chart-line fa-2x mb-2"></i>
                  {loading ? (
                    <div
                      className="spinner-border spinner-border-sm"
                      role="status"
                    >
                      <span className="visually-hidden">Cargando...</span>
                    </div>
                  ) : (
                    <>
                      <h4 className="mb-0">
                        {stats.totalContactos > 0
                          ? `${Math.round(
                              (stats.contactosHoy / stats.totalContactos) * 100
                            )}%`
                          : "0%"}
                      </h4>
                      <small>Hoy vs Total</small>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Módulos de administración */}
          <div className="row">
            {/* Gestión de Reservas - AHORA ACTIVO */}
            <div className="col-md-6 col-lg-4 mb-4">
              <div className="card h-100 shadow-sm">
                <div className="card-body text-center">
                  <i className="fa fa-calendar-check fa-3x text-success mb-3"></i>
                  <h5 className="card-title">📅 Gestión de Reservas</h5>
                  <p className="card-text">
                    Gestiona reservas, confirmaciones, check-ins y calendario de
                    disponibilidad.
                  </p>
                  <Link to="/admin/reservas" className="btn btn-success">
                    Gestionar Reservas
                    {stats.reservasPendientes > 0 && (
                      <span className="badge bg-warning ms-1">
                        {stats.reservasPendientes}
                      </span>
                    )}
                  </Link>
                </div>
              </div>
            </div>

            {/* Gestión de Cabañas */}
            <div className="col-md-6 col-lg-4 mb-4">
              <div className="card h-100 shadow-sm">
                <div className="card-body text-center">
                  <i className="fa fa-home fa-3x text-primary mb-3"></i>
                  <h5 className="card-title">🏠 Gestión de Cabañas</h5>
                  <p className="card-text">
                    Administra todas las cabañas: crear, editar, eliminar y
                    configurar precios.
                  </p>
                  <Link to="/admin/cabanas" className="btn btn-primary">
                    Gestionar Cabañas
                  </Link>
                </div>
              </div>
            </div>

            {/* Gestión de Contactos */}
            <div className="col-md-6 col-lg-4 mb-4">
              <div className="card h-100 shadow-sm">
                <div className="card-body text-center">
                  <i className="fa fa-envelope fa-3x text-info mb-3"></i>
                  <h5 className="card-title">📨 Gestión de Contactos</h5>
                  <p className="card-text">
                    Revisa y gestiona todos los mensajes de contacto de
                    prospectos y clientes.
                  </p>
                  <Link to="/admin/contactos" className="btn btn-info">
                    Gestionar Contactos
                    {stats.contactosNoLeidos > 0 && (
                      <span className="badge bg-danger ms-1">
                        {stats.contactosNoLeidos}
                      </span>
                    )}
                  </Link>
                </div>
              </div>
            </div>

            {/* Calendario de Seguimientos */}
            <div className="col-md-6 col-lg-4 mb-4">
              <div className="card h-100 shadow-sm">
                <div className="card-body text-center">
                  <i className="fa fa-calendar fa-3x text-warning mb-3"></i>
                  <h5 className="card-title">📅 Calendario de Seguimientos</h5>
                  <p className="card-text">
                    Gestiona seguimientos y eventos programados con contactos.
                  </p>
                  <Link to="/admin/calendar" className="btn btn-warning">
                    Ver Calendario
                  </Link>
                </div>
              </div>
            </div>

            <div className="col-md-6 col-lg-4 mb-4">
              <div className="card h-100 shadow-sm">
                <div className="card-body text-center">
                  <i className="fa fa-comments fa-3x text-info mb-3"></i>
                  <h5 className="card-title">💬 Gestión de Comentarios</h5>
                  <p className="card-text">
                    Revisa, aprueba o rechaza comentarios de huéspedes para
                    mostrar en el sitio.
                  </p>
                  <Link to="/admin/testimonios" className="btn btn-info">
                    Gestionar Comentarios
                    {/* Puedes agregar un badge con la cantidad pendiente si quieres */}
                  </Link>
                </div>
              </div>
            </div>

            {/* Gestión de Galería */}
            <div className="col-md-6 col-lg-4 mb-4">
              <div className="card h-100 shadow-sm">
                <div className="card-body text-center">
                  <i className="fa fa-image fa-3x text-purple mb-3"></i>
                  <h5 className="card-title">🖼️ Gestión de Galería</h5>
                  <p className="card-text">
                    Administra las imágenes de la galería del sitio web.
                  </p>
                  <Link
                    to="/admin/gallery"
                    className="btn"
                    style={{
                      backgroundColor: "var(--bs-purple)",
                      color: "white",
                    }}
                  >
                    Gestionar Galería
                  </Link>
                </div>
              </div>
            </div>

            {/* Reportes y Analytics */}
            <div className="col-md-6 col-lg-4 mb-4">
              <div className="card h-100 shadow-sm">
                <div className="card-body text-center">
                  <i className="fa fa-chart-bar fa-3x text-danger mb-3"></i>
                  <h5 className="card-title">📊 Reportes y Analytics</h5>
                  <p className="card-text">
                    Reportes detallados, estadísticas y análisis del negocio.
                  </p>
                  <button className="btn btn-outline-secondary" disabled>
                    Próximamente
                  </button>
                </div>
              </div>
            </div>

            {/* Gestión de Usuarios */}
            <div className="col-md-6 col-lg-4 mb-4">
              <div className="card h-100 shadow-sm">
                <div className="card-body text-center">
                  <i className="fa fa-users fa-3x text-dark mb-3"></i>
                  <h5 className="card-title">👥 Gestión de Usuarios</h5>
                  <p className="card-text">
                    Administra usuarios, roles y permisos del sistema.
                  </p>
                  <button className="btn btn-outline-secondary" disabled>
                    Próximamente
                  </button>
                </div>
              </div>
            </div>

            {/* Configuración */}
            <div className="col-md-6 col-lg-4 mb-4">
              <div className="card h-100 shadow-sm">
                <div className="card-body text-center">
                  <i className="fa fa-cog fa-3x text-secondary mb-3"></i>
                  <h5 className="card-title">⚙️ Configuración</h5>
                  <p className="card-text">
                    Configuración general del sitio web y preferencias.
                  </p>
                  <button className="btn btn-outline-secondary" disabled>
                    Próximamente
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Acciones rápidas */}
          <div className="card mt-4">
            <div className="card-header bg-light">
              <h5 className="mb-0">🚀 Acciones Rápidas</h5>
            </div>
            <div className="card-body">
              <div className="d-flex gap-2 flex-wrap">
                <Link to="/admin/cabanasform" className="btn btn-primary">
                  ➕ Agregar Nueva Cabaña
                </Link>
                <Link to="/admin/reservas" className="btn btn-success">
                  📅 Ver Reservas
                  {stats.reservasPendientes > 0 && (
                    <span className="badge bg-warning ms-1">
                      {stats.reservasPendientes}
                    </span>
                  )}
                </Link>
                <Link to="/admin/contactos" className="btn btn-info">
                  📧 Ver Mensajes
                  {stats.contactosNoLeidos > 0 && (
                    <span className="badge bg-danger ms-1">
                      {stats.contactosNoLeidos}
                    </span>
                  )}
                </Link>
                <button className="btn btn-outline-secondary" disabled>
                  🔔 Notificaciones
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
