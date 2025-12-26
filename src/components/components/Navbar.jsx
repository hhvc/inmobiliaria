import { useState } from "react";
import { useAuth } from "../../context/auth/useAuth";
import { Link, useNavigate } from "react-router-dom";
import Login from "../auth/Login";

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const { user, logout, hasRole } = useAuth();
  const navigate = useNavigate();

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);
  const toggleUserMenu = () => setIsUserMenuOpen(!isUserMenuOpen);
  const closeMenus = () => {
    setIsMenuOpen(false);
    setIsUserMenuOpen(false);
  };

  /** 🧭 Mueve a la página principal y hace scroll a la sección */
  const handleScroll = (e, targetId) => {
    e.preventDefault();
    closeMenus();

    // Si no estás en "/", te redirige primero y luego hace scroll
    if (window.location.pathname !== "/") {
      navigate("/");
      setTimeout(() => {
        const target = document.getElementById(targetId);
        if (target) {
          target.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 300); // Espera a que se monte el DOM del home
    } else {
      const target = document.getElementById(targetId);
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      closeMenus();
      navigate("/");
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
    }
  };

  const openLoginModal = () => {
    setShowLoginModal(true);
    closeMenus();
  };

  const closeLoginModal = () => setShowLoginModal(false);

  return (
    <>
      <nav className="navbar navbar-expand-lg navbar-dark bg-dark fixed-top">
        <div className="container">
          <a
            className="navbar-brand"
            href="#page-top"
            onClick={(e) => handleScroll(e, "page-top")}
          >
            <img
              src="/assets/img/logo.png"
              className="img-fluid"
              alt="Cañada al Lago"
              style={{ maxHeight: "50px" }}
            />
          </a>

          <button
            className="navbar-toggler"
            type="button"
            onClick={toggleMenu}
            aria-controls="navbarNav"
            aria-expanded={isMenuOpen}
            aria-label="Toggle navigation"
          >
            <span className="navbar-toggler-icon"></span>
          </button>

          <div
            className={`collapse navbar-collapse ${isMenuOpen ? "show" : ""}`}
            id="navbarNav"
          >
            <ul className="navbar-nav ms-auto">
              {[
                { id: "about", label: "Inicio" },
                { id: "cabañas", label: "Cabañas" },
                { id: "fotos", label: "Fotos" },
                { id: "actividades", label: "Actividades" },
                { id: "contact", label: "Contacto" },
              ].map(({ id, label }) => (
                <li className="nav-item" key={id}>
                  <a
                    href={`#${id}`}
                    className="nav-link"
                    onClick={(e) => handleScroll(e, id)}
                  >
                    {label}
                  </a>
                </li>
              ))}

              {/* Menú de usuario */}
              <li
                className={`nav-item dropdown ${isUserMenuOpen ? "show" : ""}`}
              >
                {user ? (
                  <>
                    <a
                      className="nav-link dropdown-toggle"
                      href="#"
                      role="button"
                      onClick={toggleUserMenu}
                      aria-expanded={isUserMenuOpen}
                      style={{ cursor: "pointer" }}
                    >
                      {user.photoURL ? (
                        <img
                          src={user.photoURL}
                          alt="Perfil"
                          className="rounded-circle me-2"
                          style={{ width: "32px", height: "32px" }}
                        />
                      ) : (
                        <i className="fa fa-user me-2"></i>
                      )}
                      {user.displayName || "Usuario"}
                    </a>
                    <ul
                      className={`dropdown-menu dropdown-menu-end ${
                        isUserMenuOpen ? "show" : ""
                      }`}
                    >
                      <li>
                        <div className="dropdown-item-text">
                          <small>Conectado como</small>
                          <br />
                          <strong>{user.displayName || user.email}</strong>
                          <br />
                          <small className="text-muted">
                            Rol: <strong>{user.role}</strong>
                          </small>
                        </div>
                      </li>
                      <li>
                        <hr className="dropdown-divider" />
                      </li>

                      {/* 🧱 Dashboard visible para admin */}
                      {hasRole("admin") && (
                        <li>
                          <Link
                            className="nav-link ps-3"
                            to="/admin/dashboard"
                            onClick={closeMenus}
                          >
                            <i className="fa fa-dashboard me-2"></i>
                            Dashboard Admin
                          </Link>
                        </li>
                      )}

                      <li>
                        <button
                          className="dropdown-item text-danger"
                          onClick={handleLogout}
                        >
                          <i className="fa fa-sign-out me-2"></i>
                          Cerrar Sesión
                        </button>
                      </li>
                    </ul>
                  </>
                ) : (
                  <button
                    className="nav-link btn btn-link"
                    onClick={openLoginModal}
                    style={{
                      border: "none",
                      background: "none",
                      color: "rgba(255,255,255,0.85)",
                      textDecoration: "none",
                    }}
                  >
                    <i className="fa fa-user me-2"></i>
                    Iniciar Sesión
                  </button>
                )}
              </li>
            </ul>
          </div>
        </div>
      </nav>

      {/* Modal de Login */}
      {showLoginModal && (
        <div
          className="modal show d-block"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          onClick={closeLoginModal}
        >
          <div
            className="modal-dialog modal-dialog-centered"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Iniciar Sesión</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={closeLoginModal}
                  aria-label="Close"
                ></button>
              </div>
              <div className="modal-body">
                <Login />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Navbar;
