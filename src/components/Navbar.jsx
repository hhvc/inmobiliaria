import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../context/auth/useAuth";
import Login from "./auth/Login";
import InmobiliariaSelector from "./context/InmobiliariaSelector";
import {
  buildAgencyPath,
  getActiveAgencySlug,
  isPortalBaseDomain,
} from "../inmobiliaria/utils/domainRouting";
import { useDomainAgency } from "../inmobiliaria/context/useDomainAgency";
import { getInmobiliariaBySlug } from "../inmobiliaria/services/inmobiliaria.service";
import { useActiveInmobiliariaModules } from "../inmobiliaria/hooks/useActiveInmobiliariaModules";

const ONO_PROP_LOGO_URL = "/assets/img/logoONOProp3.png";
const DEFAULT_INMOBILIARIA_LOGO_URL = "/assets/img/Logo.png";

const scrollToHash = (hash) => {
  if (!hash) return;

  const targetId = hash.replace("#", "");

  window.setTimeout(() => {
    const target = document.getElementById(targetId);

    if (target) {
      target.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, 150);
};

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [navbarInmobiliaria, setNavbarInmobiliaria] = useState(null);

  const { user, logout, hasRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const { slug: contextDomainSlug, inmobiliaria: domainInmobiliaria } =
    useDomainAgency();

  const { isRoot, isAdmin, hasModule } = useActiveInmobiliariaModules();

  const isPortalDomain = isPortalBaseDomain();

  const activeAgencySlug =
    getActiveAgencySlug(location.pathname) || contextDomainSlug;

  const isAgencyContext = Boolean(activeAgencySlug);

  /*
    Dominio personalizado de inmobiliaria:
    - ladoctaprop.com.ar
    - www.ladoctaprop.com.ar
    - futuros dominios propios de clientes

    En dominios base del portal, aunque la ruta sea /inmobiliaria/:slug,
    el logo debe seguir siendo ONO Prop.
  */
  const isCustomAgencyDomain = !isPortalDomain && Boolean(activeAgencySlug);

  const agencyBasePath = buildAgencyPath(activeAgencySlug);

  useEffect(() => {
    let active = true;

    const loadNavbarInmobiliaria = async () => {
      try {
        setNavbarInmobiliaria(null);

        if (!activeAgencySlug) {
          return;
        }

        if (domainInmobiliaria?.slug === activeAgencySlug) {
          setNavbarInmobiliaria(domainInmobiliaria);
          return;
        }

        const data = await getInmobiliariaBySlug(activeAgencySlug);

        if (!active) return;

        setNavbarInmobiliaria(data);
      } catch (error) {
        console.warn("No se pudo cargar el logo de la inmobiliaria:", error);

        if (active) {
          setNavbarInmobiliaria(null);
        }
      }
    };

    loadNavbarInmobiliaria();

    return () => {
      active = false;
    };
  }, [activeAgencySlug, domainInmobiliaria]);

  const isAdminUser =
    isRoot ||
    isAdmin ||
    hasRole?.("admin") ||
    hasRole?.("root") ||
    user?.role === "admin" ||
    user?.role === "root";

  const brandTarget = isPortalDomain
    ? "/"
    : isCustomAgencyDomain
      ? "/"
      : isAgencyContext && agencyBasePath
        ? agencyBasePath
        : "/";

  const publicMenuItems = useMemo(() => {
    if (isAgencyContext && agencyBasePath) {
      return [
        {
          label: "Inicio",
          to: agencyBasePath,
        },
        {
          label: "Inmuebles",
          to: `${agencyBasePath}#inmuebles-publicados`,
          hash: "#inmuebles-publicados",
        },
        {
          label: "Contacto",
          to: `${agencyBasePath}#contacto`,
          hash: "#contacto",
        },
      ];
    }

    return [
      {
        label: "Inicio",
        to: "/",
      },
      {
        label: "Inmuebles",
        to: "/inmuebles",
      },
      {
        label: "Contacto",
        to: "/#contact",
        hash: "#contact",
      },
    ];
  }, [agencyBasePath, isAgencyContext]);

  const closeMenus = useCallback(() => {
    setIsMenuOpen(false);
    setIsUserMenuOpen(false);
  }, []);

  const toggleMenu = () => {
    setIsMenuOpen((prev) => !prev);
  };

  const toggleUserMenu = () => {
    setIsUserMenuOpen((prev) => !prev);
  };

  const handleNavClick = (item) => {
    closeMenus();

    if (!item.hash) return;

    const [path] = item.to.split("#");
    const currentPath = location.pathname;

    if (path === currentPath) {
      scrollToHash(item.hash);
    } else {
      window.setTimeout(() => {
        scrollToHash(item.hash);
      }, 300);
    }
  };

  const handleBrandClick = () => {
    closeMenus();
  };

  const handleLogout = async () => {
    try {
      await logout();
      closeMenus();
      navigate(isAgencyContext && agencyBasePath ? agencyBasePath : "/");
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
    }
  };

  const openLoginModal = () => {
    setShowLoginModal(true);
    closeMenus();
  };

  const closeLoginModal = () => {
    setShowLoginModal(false);
  };

  const navbarLogoUrl =
    isCustomAgencyDomain && navbarInmobiliaria?.branding?.logo?.url
      ? navbarInmobiliaria.branding.logo.url
      : isCustomAgencyDomain
        ? DEFAULT_INMOBILIARIA_LOGO_URL
        : ONO_PROP_LOGO_URL;

  const navbarLogoAlt =
    isCustomAgencyDomain && navbarInmobiliaria?.nombre
      ? navbarInmobiliaria.nombre
      : isCustomAgencyDomain
        ? "Inmobiliaria"
        : "ONO Prop";

  return (
    <>
      <nav
        className="navbar navbar-expand-lg navbar-dark bg-dark sticky-top shadow-sm"
        style={{
          zIndex: 1040,
        }}
      >
        <div className="container">
          <Link
            className="navbar-brand d-flex align-items-center gap-2 py-1"
            to={brandTarget}
            onClick={handleBrandClick}
            aria-label={navbarLogoAlt}
          >
            <img
              src={navbarLogoUrl}
              alt={navbarLogoAlt}
              className="img-fluid"
              style={{
                maxHeight: 42,
                maxWidth: 210,
                objectFit: "contain",
              }}
            />
          </Link>

          <button
            className="navbar-toggler"
            type="button"
            onClick={toggleMenu}
            aria-controls="mainNavbar"
            aria-expanded={isMenuOpen}
            aria-label="Abrir menú"
          >
            <span className="navbar-toggler-icon" />
          </button>

          <div
            className={`collapse navbar-collapse ${isMenuOpen ? "show" : ""}`}
            id="mainNavbar"
          >
            <ul className="navbar-nav ms-auto align-items-lg-center gap-lg-1">
              {publicMenuItems.map((item) => (
                <li className="nav-item" key={item.label}>
                  <Link
                    to={item.to}
                    className="nav-link"
                    onClick={() => handleNavClick(item)}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}

              {!isAgencyContext &&
                user &&
                Array.isArray(user.inmobiliarias) &&
                user.inmobiliarias.length > 1 && (
                  <li className="nav-item d-flex align-items-center px-lg-2 mt-2 mt-lg-0">
                    <InmobiliariaSelector />
                  </li>
                )}

              <li className="nav-item dropdown">
                {user ? (
                  <>
                    <button
                      type="button"
                      className="nav-link dropdown-toggle btn btn-link d-flex align-items-center"
                      onClick={toggleUserMenu}
                      aria-expanded={isUserMenuOpen}
                      style={{
                        border: "none",
                        background: "none",
                        color: "rgba(255,255,255,0.85)",
                        textDecoration: "none",
                      }}
                    >
                      {user.photoURL ? (
                        <img
                          src={user.photoURL}
                          alt="Perfil"
                          className="rounded-circle me-2"
                          style={{
                            width: 30,
                            height: 30,
                            objectFit: "cover",
                          }}
                        />
                      ) : (
                        <span className="me-2">👤</span>
                      )}

                      <span className="text-truncate" style={{ maxWidth: 160 }}>
                        {user.displayName || user.email || "Usuario"}
                      </span>
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
                          Rol:{" "}
                          <strong>
                            {user.primaryRole || user.role || "usuario"}
                          </strong>
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
                              to="/admin/inmobiliaria"
                              onClick={closeMenus}
                            >
                              Panel de Inmobiliaria
                            </Link>
                          </li>

                          {hasModule("branding") && (
                            <li>
                              <Link
                                className="dropdown-item"
                                to="/admin/inmobiliaria/branding"
                                onClick={closeMenus}
                              >
                                Branding de Inmobiliaria
                              </Link>
                            </li>
                          )}

                          {hasModule("dominios") && (
                            <li>
                              <Link
                                className="dropdown-item"
                                to="/admin/inmobiliaria/dominios"
                                onClick={closeMenus}
                              >
                                Dominios de Inmobiliaria
                              </Link>
                            </li>
                          )}

                          {hasModule("usuarios") && (
                            <li>
                              <Link
                                className="dropdown-item"
                                to="/admin/inmobiliaria/usuarios"
                                onClick={closeMenus}
                              >
                                Usuarios de Inmobiliaria
                              </Link>
                            </li>
                          )}

                          {hasModule("inmuebles") && (
                            <>
                              <li>
                                <Link
                                  className="dropdown-item"
                                  to="/admin/inmuebles"
                                  onClick={closeMenus}
                                >
                                  Panel de Inmuebles
                                </Link>
                              </li>

                              <li>
                                <Link
                                  className="dropdown-item"
                                  to="/admin/inmuebles/listado"
                                  onClick={closeMenus}
                                >
                                  Listado de Inmuebles
                                </Link>
                              </li>

                              <li>
                                <Link
                                  className="dropdown-item"
                                  to="/admin/red/inmuebles-compartidos"
                                  onClick={closeMenus}
                                >
                                  Red de colegas
                                </Link>
                              </li>

                              <li>
                                <Link
                                  className="dropdown-item"
                                  to="/admin/red/solicitudes"
                                  onClick={closeMenus}
                                >
                                  Solicitudes de colaboración
                                </Link>
                              </li>

                              <li>
                                <Link
                                  className="dropdown-item"
                                  to="/admin/inmuebles/nuevo"
                                  onClick={closeMenus}
                                >
                                  Nueva Publicación
                                </Link>
                              </li>
                            </>
                          )}

                          {hasModule("consultas") && (
                            <li>
                              <Link
                                className="dropdown-item"
                                to="/admin/inmuebles/consultas"
                                onClick={closeMenus}
                              >
                                Consultas de Inmuebles
                              </Link>
                            </li>
                          )}

                          {isRoot && (
                            <>
                              <li>
                                <hr className="dropdown-divider" />
                              </li>

                              <li>
                                <Link
                                  className="dropdown-item"
                                  to="/admin/usuarios"
                                  onClick={closeMenus}
                                >
                                  Usuarios y Suscripciones
                                </Link>
                              </li>

                              <li>
                                <Link
                                  className="dropdown-item"
                                  to="/admin/inmobiliarias"
                                  onClick={closeMenus}
                                >
                                  Inmobiliarias
                                </Link>
                              </li>

                              <li>
                                <Link
                                  className="dropdown-item"
                                  to="/admin/inmobiliarias/nueva"
                                  onClick={closeMenus}
                                >
                                  Nueva Inmobiliaria
                                </Link>
                              </li>

                              <li>
                                <Link
                                  className="dropdown-item"
                                  to="/admin/dashboard"
                                  onClick={closeMenus}
                                >
                                  Dashboard Admin
                                </Link>
                              </li>
                            </>
                          )}

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
                          Mi Perfil
                        </Link>
                      </li>

                      {!isAgencyContext && (
                        <li>
                          <Link
                            className="dropdown-item"
                            to="/inmuebles"
                            onClick={closeMenus}
                          >
                            Ver Portal Público
                          </Link>
                        </li>
                      )}

                      {isAgencyContext && agencyBasePath && (
                        <li>
                          <Link
                            className="dropdown-item"
                            to={agencyBasePath}
                            onClick={closeMenus}
                          >
                            Ver sitio de inmobiliaria
                          </Link>
                        </li>
                      )}

                      <li>
                        <hr className="dropdown-divider" />
                      </li>

                      <li>
                        <button
                          type="button"
                          className="dropdown-item text-danger"
                          onClick={handleLogout}
                        >
                          Cerrar sesión
                        </button>
                      </li>
                    </ul>
                  </>
                ) : (
                  <button
                    type="button"
                    className="nav-link btn btn-link"
                    onClick={openLoginModal}
                    style={{
                      border: "none",
                      background: "none",
                      color: "rgba(255,255,255,0.85)",
                      textDecoration: "none",
                    }}
                  >
                    Iniciar sesión
                  </button>
                )}
              </li>
            </ul>
          </div>
        </div>
      </nav>

      {showLoginModal && (
        <div
          className="modal show d-block"
          style={{
            backgroundColor: "rgba(0,0,0,0.5)",
            zIndex: 1055,
          }}
          onClick={closeLoginModal}
        >
          <div
            className="modal-dialog modal-dialog-centered"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Iniciar sesión</h5>

                <button
                  type="button"
                  className="btn-close"
                  onClick={closeLoginModal}
                  aria-label="Cerrar"
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