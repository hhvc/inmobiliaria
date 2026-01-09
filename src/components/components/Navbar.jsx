// src/components/components/Navbar.jsx
import { useState, useCallback } from "react";
import { useAuth } from "../../context/auth/useAuth";
import { Link, useNavigate } from "react-router-dom";
import Login from "../auth/Login";

const MENU_ITEMS = [
  { id: "about", label: "Inicio" },
  { id: "cabañas", label: "Inmuebles" },
  { id: "fotos", label: "Fotos" },
  // { id: "actividades", label: "Actividades" },
  { id: "contact", label: "Contacto" },
];

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);

  const { user, logout, hasRole } = useAuth();
  const navigate = useNavigate();

  const closeMenus = useCallback(() => {
    setIsMenuOpen(false);
    setIsUserMenuOpen(false);
  }, []);

  const toggleMenu = () => setIsMenuOpen((prev) => !prev);
  const toggleUserMenu = () => setIsUserMenuOpen((prev) => !prev);

  /** 🧭 Scroll suave con redirección inteligente */
  const handleScroll = (e, targetId) => {
    e.preventDefault();
    closeMenus();

    const scrollToTarget = () => {
      const target = document.getElementById(targetId);
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    };

    if (window.location.pathname !== "/") {
      navigate("/");
      setTimeout(scrollToTarget, 300);
    } else {
      scrollToTarget();
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
          {/* Logo */}
          <a
            className="navbar-brand"
            href="#page-top"
            onClick={(e) => handleScroll(e, "page-top")}
          >
            <img
              src="/assets/img/Logo.png"
              alt="LaDocTaProp"
              className="img-fluid"
              style={{ maxHeight: "50px" }}
            />
          </a>

          {/* Toggler */}
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

          {/* Menú */}
          <div
            className={`collapse navbar-collapse ${isMenuOpen ? "show" : ""}`}
            id="navbarNav"
          >
            <ul className="navbar-nav ms-auto">
              {MENU_ITEMS.map(({ id, label }) => (
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

              {/* Usuario */}
              <li className="nav-item dropdown">
                {user ? (
                  <>
                    <button
                      className="nav-link dropdown-toggle btn btn-link"
                      onClick={toggleUserMenu}
                      aria-expanded={isUserMenuOpen}
                      style={{
                        border: "none",
                        background: "none",
                        color: "rgba(255,255,255,0.85)",
                      }}
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
                    </button>

                    <ul
                      className={`dropdown-menu dropdown-menu-end ${
                        isUserMenuOpen ? "show" : ""
                      }`}
                    >
                      <li className="px-3 py-2">
                        <small className="text-muted">Conectado como</small>
                        <br />
                        <strong>{user.displayName || user.email}</strong>
                        <br />
                        <small className="text-muted">
                          Rol: <strong>{user.role}</strong>
                        </small>
                      </li>

                      <li>
                        <hr className="dropdown-divider" />
                      </li>

                      {hasRole("admin") && (
                        <li>
                          <Link
                            className="dropdown-item"
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

      {/* Modal Login */}
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
                />
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
