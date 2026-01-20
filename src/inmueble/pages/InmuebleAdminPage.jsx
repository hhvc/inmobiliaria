// src/inmueble/pages/InmuebleAdminPage.jsx
import { Link } from "react-router-dom";

const InmuebleAdminPage = () => {
  return (
    <div className="container mt-4">
      <div className="row">
        <div className="col-md-12">
          <div className="d-flex justify-content-between align-items-center mb-4">
            <div>
              <h1>🏠 Administración de Inmuebles</h1>
              <p className="text-muted mb-0">
                Gestiona todos los inmuebles de la plataforma
              </p>
            </div>
          </div>

          <div className="row">
            {/* Tarjeta para Listar Inmuebles */}
            <div className="col-md-6 col-lg-4 mb-4">
              <div className="card h-100 shadow-sm">
                <div className="card-body text-center">
                  <i
                    className="fa fa-list fa-3x mb-3"
                    style={{ color: "#6610f2" }}
                  ></i>
                  <h5 className="card-title">📋 Listar Inmuebles</h5>
                  <p className="card-text">
                    Visualiza todos los inmuebles, edita, elimina o destaca
                    propiedades existentes.
                  </p>
                  <Link
                    to="/admin/inmuebles/listado"
                    className="btn"
                    style={{ backgroundColor: "#6610f2", color: "white" }}
                  >
                    Ver Listado
                  </Link>
                </div>
              </div>
            </div>

            {/* Tarjeta para Crear Inmueble */}
            <div className="col-md-6 col-lg-4 mb-4">
              <div className="card h-100 shadow-sm">
                <div className="card-body text-center">
                  <i
                    className="fa fa-plus-circle fa-3x mb-3"
                    style={{ color: "#17a2b8" }}
                  ></i>
                  <h5 className="card-title">➕ Crear Inmueble</h5>
                  <p className="card-text">
                    Agrega un nuevo inmueble al sistema: completa la
                    información, sube imágenes y publica.
                  </p>
                  <Link
                    to="/admin/inmuebles/nuevo"
                    className="btn"
                    style={{ backgroundColor: "#17a2b8", color: "white" }}
                  >
                    Crear Inmueble
                  </Link>
                </div>
              </div>
            </div>

            {/* Tarjeta para Ver Público */}
            <div className="col-md-6 col-lg-4 mb-4">
              <div className="card h-100 shadow-sm">
                <div className="card-body text-center">
                  <i
                    className="fa fa-eye fa-3x mb-3"
                    style={{ color: "#28a745" }}
                  ></i>
                  <h5 className="card-title">👁️ Ver Público</h5>
                  <p className="card-text">
                    Previsualiza cómo se ven los inmuebles en la página pública
                    y verifica la información.
                  </p>
                  <Link
                    to="/inmuebles"
                    className="btn"
                    style={{ backgroundColor: "#28a745", color: "white" }}
                  >
                    Ver Público
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Sección de ayuda */}
          <div className="card mt-4">
            <div className="card-header bg-light">
              <h5 className="mb-0">📌 Primeros pasos</h5>
            </div>
            <div className="card-body">
              <ol>
                <li>
                  <strong>1. Configura permisos de Firebase</strong>
                  <p className="text-muted mb-2">
                    Ve a la consola de Firebase → Firestore Database → Reglas y
                    configura las reglas de seguridad.
                  </p>
                </li>
                <li>
                  <strong>2. Crea tu primer inmueble</strong>
                  <p className="text-muted mb-2">
                    Usa el botón "Crear Inmueble" para agregar tu primera
                    propiedad.
                  </p>
                </li>
                <li>
                  <strong>3. Gestiona tus inmuebles</strong>
                  <p className="text-muted mb-2">
                    Una vez creados, podrás editarlos, destacarlos o eliminarlos
                    desde el listado.
                  </p>
                </li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InmuebleAdminPage;
