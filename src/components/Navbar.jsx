// src/components/Navbar.jsx
import { useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "../context/auth/useAuth";
import Login from "./auth/Login";
import InmobiliariaSelector from "./context/InmobiliariaSelector";

const MENU_ITEMS = [
  { type: "scroll", id: "page-top", label: "Inicio" },
  { type: "route", path: "/inmuebles", label: "Inmuebles" },
  { type: "scroll", id: "fotos", label: "Fotos" },
  { type: "scroll", id: "contact", label: "Contacto" },
];

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);

  const { user, logout, hasRole } = useAuth();
  const navigate = useNavigate();

  const isAdminUser =
    hasRole?.("admin") ||
    hasRole?.("root") ||
    user?.role === "admin" ||
    user?.role === "root";

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

  const handleRouteClick = () => {
    closeMenus();
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
              style={{ maxHeight: 50 }}
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
              {MENU_ITEMS.map((item) => (
                <li className="nav-item" key={item.label}>
                  {item.type === "route" ? (
                    <Link
                      to={item.path}
                      className="nav-link"
                      onClick={handleRouteClick}
                    >
                      {item.label}
                    </Link>
                  ) : (
                    <a
                      href={`#${item.id}`}
                      className="nav-link"
                      onClick={(e) => handleScroll(e, item.id)}
                    >
                      {item.label}
                    </a>
                  )}
                </li>
              ))}

              {/* 🔑 Selector de Inmobiliaria Activa */}
              {user &&
                Array.isArray(user.inmobiliarias) &&
                user.inmobiliarias.length > 1 && (
                  <li className="nav-item d-flex align-items-center me-3">
                    <InmobiliariaSelector />
                  </li>
                )}

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
                          style={{ width: 32, height: 32 }}
                        />
                      ) : (
                        <i className="fa fa-user me-2"></i>
                      )}

                      {user.displayName || "Usuario"}
                    </button>

                    <ul
                      className={`dropdown-menu dropdown-menu-end ${isUserMenuOpen ? "show" : ""
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

                      {isAdminUser && (
                        <>
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

                          <li>
                            <Link
                              className="dropdown-item"
                              to="/admin/inmuebles"
                              onClick={closeMenus}
                            >
                              <i className="fa fa-building me-2"></i>
                              Panel de Inmuebles
                            </Link>
                          </li>

                          <li>
                            <Link
                              className="dropdown-item"
                              to="/admin/inmuebles/listado"
                              onClick={closeMenus}
                            >
                              <i className="fa fa-list me-2"></i>
                              Listado de Inmuebles
                            </Link>
                          </li>

                          <li>
                            <Link
                              className="dropdown-item"
                              to="/admin/inmuebles/consultas"
                              onClick={closeMenus}
                            >
                              <i className="fa fa-envelope me-2"></i>
                              Consultas de Inmuebles
                            </Link>
                          </li>

                          <li>
                            <Link
                              className="dropdown-item"
                              to="/admin/inmuebles/nuevo"
                              onClick={closeMenus}
                            >
                              <i className="fa fa-plus me-2"></i>
                              Nueva Publicación
                            </Link>
                          </li>

                          <li>
                            <Link
                              className="dropdown-item"
                              to="/admin/inmobiliarias"
                              onClick={closeMenus}
                            >
                              <i className="fa fa-briefcase me-2"></i>
                              Inmobiliarias
                            </Link>
                          </li>

                          <li>
                            <hr className="dropdown-divider" />
                          </li>
                        </>
                      )}

                      <li>
                        <Link
                          className="dropdown-item"
                          to="/perfil"
                          onClick={closeMenus}
                        >
                          <i className="fa fa-user-circle me-2"></i>
                          Mi Perfil
                        </Link>
                      </li>

                      <li>
                        <Link
                          className="dropdown-item"
                          to="/inmuebles"
                          onClick={closeMenus}
                        >
                          <i className="fa fa-search me-2"></i>
                          Ver Portal Público
                        </Link>
                      </li>

                      <li>
                        <hr className="dropdown-divider" />
                      </li>

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