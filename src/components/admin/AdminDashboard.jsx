import { Link } from "react-router-dom";

import { useAuth } from "../../context/auth/useAuth";
import { useDashboardStats } from "../../hooks/useDashboardStats";

const getStatValue = (stats, key) => {
  if (!stats) return 0;

  const value = stats[key];

  if (value === null || value === undefined) return 0;

  return value;
};

const userIsRoot = (user, hasRole) => {
  if (typeof hasRole === "function" && hasRole("root")) return true;
  if (!user) return false;
  if (user.role === "root") return true;
  if (user.primaryRole === "root") return true;
  if (Array.isArray(user.roles) && user.roles.includes("root")) return true;

  return false;
};

const userIsAdmin = (user, hasRole) => {
  if (userIsRoot(user, hasRole)) return true;
  if (typeof hasRole === "function" && hasRole("admin")) return true;
  if (!user) return false;
  if (user.role === "admin") return true;
  if (user.primaryRole === "admin") return true;
  if (Array.isArray(user.roles) && user.roles.includes("admin")) return true;

  return false;
};

const StatCard = ({
  title,
  value,
  icon = "fa fa-chart-simple",
  loading = false,
  className = "text-bg-primary",
}) => {
  return (
    <div className="col-6 col-md-4 col-xl-2">
      <div className={`card h-100 border-0 shadow-sm ${className}`}>
        <div className="card-body text-center">
          <i className={`${icon} fa-2x mb-2`}></i>

          {loading ? (
            <div className="spinner-border spinner-border-sm" role="status">
              <span className="visually-hidden">Cargando...</span>
            </div>
          ) : (
            <>
              <div className="h4 mb-0">{value}</div>
              <div className="small">{title}</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const ModuleCard = ({
  title,
  text,
  to,
  buttonLabel,
  icon = "fa fa-circle",
  color = "#0d6efd",
  badge = "",
  disabled = false,
}) => {
  return (
    <div className="col-md-6 col-xl-4">
      <div className="card h-100 border-0 shadow-sm">
        <div className="card-body p-4 d-flex flex-column">
          <div className="d-flex align-items-start gap-3 mb-3">
            <div
              className="rounded-3 d-flex align-items-center justify-content-center flex-shrink-0"
              style={{
                width: 48,
                height: 48,
                backgroundColor: `${color}18`,
                color,
              }}
            >
              <i className={`${icon} fa-lg`}></i>
            </div>

            <div>
              <h2 className="h5 mb-1">{title}</h2>
              {badge && <span className="badge text-bg-light border">{badge}</span>}
            </div>
          </div>

          <p className="text-muted small flex-grow-1">{text}</p>

          {disabled ? (
            <button type="button" className="btn btn-outline-secondary" disabled>
              Próximamente
            </button>
          ) : (
            <Link to={to} className="btn btn-primary">
              {buttonLabel}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};

const QuickLink = ({ to, children, className = "btn btn-outline-primary" }) => {
  return (
    <Link to={to} className={className}>
      {children}
    </Link>
  );
};

const AdminDashboard = () => {
  const { user, hasRole } = useAuth();
  const { stats, loading, error } = useDashboardStats();

  const isRootUser = userIsRoot(user, hasRole);
  const isAdminUser = userIsAdmin(user, hasRole);

  if (!isAdminUser) {
    return (
      <main className="container py-4">
        <div className="alert alert-danger text-center">
          <h1 className="h4">🚫 Acceso denegado</h1>
          <p className="mb-0">No tenés permisos para acceder a esta sección.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="container py-4">
      <div className="d-flex flex-column flex-lg-row justify-content-between gap-3 mb-4">
        <div>
          <p className="text-uppercase text-muted small mb-1">
            Administración ONO Prop
          </p>

          <h1 className="mb-2">🛠️ Panel de Administración</h1>

          <p className="text-muted mb-0">
            Bienvenido, <strong>{user?.displayName || user?.email}</strong>
          </p>
        </div>

        <div className="text-lg-end">
          <div className="badge text-bg-dark mb-2">
            {isRootUser ? "Root" : "Admin"}
          </div>

          <div className="small text-muted">
            {user?.email}
          </div>
        </div>
      </div>

      {error && (
        <div className="alert alert-warning" role="alert">
          <strong>Advertencia:</strong> {error}
        </div>
      )}

      <section className="mb-5">
        <div className="row g-3">
          <StatCard
            title="Inmobiliarias"
            value={getStatValue(stats, "totalInmobiliarias")}
            icon="fa fa-building"
            loading={loading}
            className="text-bg-primary"
          />

          <StatCard
            title="Activas"
            value={getStatValue(stats, "inmobiliariasActivas")}
            icon="fa fa-check-circle"
            loading={loading}
            className="text-bg-success"
          />

          <StatCard
            title="Inmuebles"
            value={getStatValue(stats, "totalInmuebles")}
            icon="fa fa-house"
            loading={loading}
            className="text-bg-info"
          />

          <StatCard
            title="Inmuebles activos"
            value={getStatValue(stats, "inmueblesActivos")}
            icon="fa fa-circle-check"
            loading={loading}
            className="text-bg-success"
          />

          <StatCard
            title="Destacados"
            value={getStatValue(stats, "inmueblesDestacados")}
            icon="fa fa-star"
            loading={loading}
            className="text-bg-warning"
          />

          <StatCard
            title="Usuarios"
            value={getStatValue(stats, "totalUsuarios")}
            icon="fa fa-users"
            loading={loading}
            className="text-bg-dark"
          />
        </div>
      </section>

      {isRootUser && (
        <section className="mb-5">
          <div className="d-flex justify-content-between align-items-end gap-3 mb-3">
            <div>
              <p className="text-uppercase text-muted small mb-1">
                Root ONO Prop
              </p>
              <h2 className="h4 mb-0">Gobierno del portal</h2>
            </div>
          </div>

          <div className="row g-4">
            <ModuleCard
              title="🏢 Inmobiliarias"
              text="Alta, edición, activación y administración general de inmobiliarias adheridas."
              to="/admin/inmobiliarias"
              buttonLabel="Gestionar inmobiliarias"
              icon="fa fa-city"
              color="#6610f2"
              badge={`${getStatValue(stats, "inmobiliariasActivas")} activas`}
            />

            <ModuleCard
              title="📚 Publicaciones del portal"
              text="Vista global de publicaciones de inmobiliarias y particulares, con filtros por origen, estado, operación y tipo."
              to="/admin/portal/publicaciones"
              buttonLabel="Ver publicaciones"
              icon="fa fa-table-list"
              color="#0d6efd"
            />

            <ModuleCard
              title="✅ Verificación"
              text="Revisión de documentación de inmobiliarias y aprobación comercial."
              to="/admin/inmobiliarias/verificacion"
              buttonLabel="Revisar verificaciones"
              icon="fa fa-shield-halved"
              color="#198754"
            />

            <ModuleCard
              title="👥 Usuarios"
              text="Administración de usuarios, roles, inmobiliarias asociadas y permisos."
              to="/admin/usuarios"
              buttonLabel="Gestionar usuarios"
              icon="fa fa-users-gear"
              color="#212529"
            />

            <ModuleCard
              title="⭐ Relevancia del portal"
              text="Configuración de ranking: promociones pagas, prioridad por origen, calidad y recencia."
              to="/admin/portal/ranking"
              buttonLabel="Configurar ranking"
              icon="fa fa-star"
              color="#ffc107"
            />

            <ModuleCard
              title="🏠 Publicaciones particulares"
              text="Solicitudes de dueños particulares para aprobar como publicación ONO Prop o derivar a inmobiliarias."
              to="/admin/publicaciones/particulares"
              buttonLabel="Revisar particulares"
              icon="fa fa-user-tag"
              color="#0dcaf0"
            />

            <ModuleCard
              title="➕ Nueva inmobiliaria"
              text="Crear manualmente una inmobiliaria desde el panel root."
              to="/admin/inmobiliarias/nueva"
              buttonLabel="Crear inmobiliaria"
              icon="fa fa-plus"
              color="#6610f2"
            />
          </div>
        </section>
      )}

      <section className="mb-5">
        <div className="d-flex justify-content-between align-items-end gap-3 mb-3">
          <div>
            <p className="text-uppercase text-muted small mb-1">
              Panel de inmobiliaria
            </p>
            <h2 className="h4 mb-0">Gestión operativa</h2>
          </div>
        </div>

        <div className="row g-4">
          <ModuleCard
            title="🏠 Inmuebles"
            text="Panel principal de propiedades: creación, edición, imágenes, videos, estados y publicación."
            to="/admin/inmuebles"
            buttonLabel="Gestionar inmuebles"
            icon="fa fa-house"
            color="#0d6efd"
            badge={`${getStatValue(stats, "totalInmuebles")} propiedades`}
          />

          <ModuleCard
            title="📋 Listado de inmuebles"
            text="Listado operativo para filtrar, editar, destacar, marcar vendido/alquilado y revisar calidad."
            to="/admin/inmuebles/listado"
            buttonLabel="Ver listado"
            icon="fa fa-list"
            color="#17a2b8"
          />

          <ModuleCard
            title="➕ Nuevo inmueble"
            text="Crear una nueva publicación inmobiliaria desde la inmobiliaria activa."
            to="/admin/inmuebles/nuevo"
            buttonLabel="Crear inmueble"
            icon="fa fa-plus"
            color="#198754"
          />

          <ModuleCard
            title="📨 Consultas"
            text="Gestión de leads y consultas recibidas por publicaciones inmobiliarias."
            to="/admin/inmuebles/consultas"
            buttonLabel="Ver consultas"
            icon="fa fa-envelope"
            color="#0dcaf0"
          />

          <ModuleCard
            title="🏢 Mi inmobiliaria"
            text="Panel general de la inmobiliaria activa, módulos, accesos y estado de configuración."
            to="/admin/inmobiliaria"
            buttonLabel="Ir al panel"
            icon="fa fa-building-user"
            color="#6610f2"
          />

          <ModuleCard
            title="🎨 Branding"
            text="Logo, identidad visual, datos públicos y presentación de la inmobiliaria."
            to="/admin/inmobiliaria/branding"
            buttonLabel="Editar branding"
            icon="fa fa-palette"
            color="#d63384"
          />

          <ModuleCard
            title="🌐 Dominios"
            text="Configuración de dominios públicos asociados a la inmobiliaria."
            to="/admin/inmobiliaria/dominios"
            buttonLabel="Gestionar dominios"
            icon="fa fa-globe"
            color="#20c997"
          />

          <ModuleCard
            title="👤 Usuarios de inmobiliaria"
            text="Administración de usuarios internos y permisos por módulo."
            to="/admin/inmobiliaria/usuarios"
            buttonLabel="Gestionar usuarios"
            icon="fa fa-user-lock"
            color="#6f42c1"
          />

          <ModuleCard
            title="📄 Documentación"
            text="Carga de documentación para verificación de la inmobiliaria."
            to="/admin/inmobiliaria/documentacion"
            buttonLabel="Ver documentación"
            icon="fa fa-file-lines"
            color="#fd7e14"
          />

          <ModuleCard
            title="🔗 Vinculaciones"
            text="Solicitudes de vinculación de usuarios con inmobiliarias."
            to="/admin/inmobiliaria/vinculaciones"
            buttonLabel="Ver vinculaciones"
            icon="fa fa-link"
            color="#198754"
          />

          <ModuleCard
            title="🙋 Solicitudes particulares"
            text="Solicitudes de particulares dirigidas a la inmobiliaria activa."
            to="/admin/inmobiliaria/solicitudes-particulares"
            buttonLabel="Ver solicitudes"
            icon="fa fa-user-check"
            color="#0dcaf0"
          />
        </div>
      </section>

      <section className="mb-5">
        <div className="d-flex justify-content-between align-items-end gap-3 mb-3">
          <div>
            <p className="text-uppercase text-muted small mb-1">
              Red ONO Prop
            </p>
            <h2 className="h4 mb-0">Colaboración entre inmobiliarias</h2>
          </div>
        </div>

        <div className="row g-4">
          <ModuleCard
            title="🤝 Inmuebles compartidos"
            text="Red de propiedades compartidas entre inmobiliarias adheridas."
            to="/admin/red/inmuebles-compartidos"
            buttonLabel="Ver red"
            icon="fa fa-handshake"
            color="#0d6efd"
          />

          <ModuleCard
            title="📬 Solicitudes de red"
            text="Solicitudes, contactos y pedidos de colaboración entre inmobiliarias."
            to="/admin/red/solicitudes"
            buttonLabel="Ver solicitudes"
            icon="fa fa-inbox"
            color="#6f42c1"
          />
        </div>
      </section>

      <section className="mb-5">
        <div className="d-flex justify-content-between align-items-end gap-3 mb-3">
          <div>
            <p className="text-uppercase text-muted small mb-1">
              Accesos públicos
            </p>
            <h2 className="h4 mb-0">Portal</h2>
          </div>
        </div>

        <div className="row g-4">
          <ModuleCard
            title="🔎 Portal de inmuebles"
            text="Vista pública del buscador de publicaciones de inmobiliarias y particulares."
            to="/inmuebles"
            buttonLabel="Ver portal"
            icon="fa fa-magnifying-glass"
            color="#0d6efd"
          />

          <ModuleCard
            title="📝 Publicar como particular"
            text="Formulario público para que un dueño solicite publicar su inmueble."
            to="/publicar"
            buttonLabel="Ver formulario"
            icon="fa fa-pen-to-square"
            color="#198754"
          />

          <ModuleCard
            title="📌 Mis publicaciones"
            text="Panel del usuario particular para revisar solicitudes y publicaciones aprobadas."
            to="/mis-publicaciones"
            buttonLabel="Ver mis publicaciones"
            icon="fa fa-user"
            color="#212529"
          />
        </div>
      </section>

      <section className="mb-5">
        <div className="d-flex justify-content-between align-items-end gap-3 mb-3">
          <div>
            <p className="text-uppercase text-muted small mb-1">
              Legado La Docta Prop
            </p>
            <h2 className="h4 mb-0">Módulos heredados</h2>
          </div>
        </div>

        <div className="row g-4">
          <ModuleCard
            title="⛺ Cabañas"
            text="Gestión heredada de cabañas, previa al módulo inmobiliario."
            to="/admin/cabanas"
            buttonLabel="Gestionar cabañas"
            icon="fa fa-campground"
            color="#0d6efd"
          />

          <ModuleCard
            title="➕ Nueva cabaña"
            text="Formulario heredado de alta de cabañas."
            to="/admin/cabanasform"
            buttonLabel="Crear cabaña"
            icon="fa fa-plus"
            color="#198754"
          />

          <ModuleCard
            title="🖼️ Galería"
            text="Administración de imágenes de galería del sitio."
            to="/admin/gallery"
            buttonLabel="Gestionar galería"
            icon="fa fa-image"
            color="#6f42c1"
          />

          <ModuleCard
            title="📧 Contactos"
            text="Mensajes de contacto generales del sitio heredado."
            to="/admin/contactos"
            buttonLabel="Ver contactos"
            icon="fa fa-envelope"
            color="#0dcaf0"
            badge={`${getStatValue(stats, "contactosNoLeidos")} por leer`}
          />

          <ModuleCard
            title="📅 Reservas"
            text="Gestión heredada de reservas y estadías."
            to="/admin/reservas"
            buttonLabel="Ver reservas"
            icon="fa fa-calendar-check"
            color="#198754"
            badge={`${getStatValue(stats, "reservasPendientes")} pendientes`}
          />

          <ModuleCard
            title="💬 Testimonios"
            text="Moderación de comentarios y testimonios del sitio."
            to="/admin/testimonios"
            buttonLabel="Gestionar testimonios"
            icon="fa fa-comments"
            color="#fd7e14"
          />

          <ModuleCard
            title="🗓️ Calendario"
            text="Calendario de seguimientos y eventos heredados."
            to="/admin/calendar"
            buttonLabel="Ver calendario"
            icon="fa fa-calendar"
            color="#ffc107"
          />
        </div>
      </section>

      <section className="card border-0 shadow-sm">
        <div className="card-header bg-light">
          <h2 className="h5 mb-0">🚀 Acciones rápidas</h2>
        </div>

        <div className="card-body">
          <div className="d-flex flex-wrap gap-2">
            {isRootUser && (
              <>
                <QuickLink to="/admin/portal/publicaciones">
                  📚 Publicaciones del portal
                </QuickLink>
                <QuickLink to="/admin/portal/ranking">
                  ⭐ Ranking del portal
                </QuickLink>

                <QuickLink to="/admin/inmobiliarias/nueva">
                  ➕ Nueva inmobiliaria
                </QuickLink>

                <QuickLink to="/admin/publicaciones/particulares">
                  🏠 Revisar particulares
                </QuickLink>
              </>
            )}

            <QuickLink to="/admin/inmuebles/nuevo">
              ➕ Nuevo inmueble
            </QuickLink>

            <QuickLink to="/admin/inmuebles/listado">
              📋 Listado de inmuebles
            </QuickLink>

            <QuickLink to="/admin/inmuebles/consultas">
              📨 Consultas
            </QuickLink>

            <QuickLink to="/admin/red/inmuebles-compartidos">
              🤝 Red de colegas
            </QuickLink>

            <QuickLink to="/inmuebles" className="btn btn-outline-secondary">
              🔎 Ver portal público
            </QuickLink>
          </div>
        </div>
      </section>
    </main>
  );
};

export default AdminDashboard;