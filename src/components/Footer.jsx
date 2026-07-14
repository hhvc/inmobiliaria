import { Link } from "react-router-dom";

import { useDomainAgency } from "../inmobiliaria/context/useDomainAgency";
import { isPortalBaseDomain } from "../inmobiliaria/utils/domainRouting";

const ONO_PROP_LOGO_URL = "/assets/img/logoONOProp3.png";
const DEFAULT_INMOBILIARIA_LOGO_URL = "/assets/img/Logo.png";

const Footer = () => {
  const currentYear = new Date().getFullYear();

  const { inmobiliaria: domainInmobiliaria, slug: domainSlug } =
    useDomainAgency();

  const isPortalDomain = isPortalBaseDomain();
  const isCustomAgencyDomain = !isPortalDomain && Boolean(domainSlug);

  const brandName =
    isCustomAgencyDomain && domainInmobiliaria?.nombre
      ? domainInmobiliaria.nombre
      : "ONO Prop";

  const brandLogoUrl =
    isCustomAgencyDomain && domainInmobiliaria?.branding?.logo?.url
      ? domainInmobiliaria.branding.logo.url
      : isCustomAgencyDomain
        ? DEFAULT_INMOBILIARIA_LOGO_URL
        : ONO_PROP_LOGO_URL;

  const brandDescription = isCustomAgencyDomain
    ? "Sitio inmobiliario desarrollado con ONO Prop."
    : "Plataforma inmobiliaria para publicar propiedades, crear sitios propios, conectar dominios y gestionar consultas comerciales.";

  const brandTarget = isCustomAgencyDomain ? "/" : "/";

  return (
    <footer
      className="site-footer mt-auto border-top"
      role="contentinfo"
      style={{
        position: "relative",
        bottom: "auto",
        left: "auto",
        right: "auto",
        width: "100%",
        flexShrink: 0,
        background: "#111827",
        color: "rgba(255,255,255,0.82)",
        zIndex: 1,
      }}
    >
      <div className="container py-4">
        <div className="row align-items-center g-4">
          <div className="col-md-6 text-center text-md-start">
            <Link
              to={brandTarget}
              className="d-inline-flex align-items-center gap-3 text-decoration-none mb-2"
              style={{ color: "#ffffff" }}
              aria-label={`Ir al inicio de ${brandName}`}
            >
              <img
                src={brandLogoUrl}
                alt={brandName}
                style={{
                  maxHeight: 46,
                  maxWidth: 190,
                  objectFit: "contain",
                }}
              />
            </Link>

            <p
              className="small mb-0"
              style={{ color: "rgba(255,255,255,0.62)" }}
            >
              {brandDescription}
            </p>
          </div>

          <div className="col-md-6 text-center text-md-end">
            <p
              className="small mb-2"
              style={{ color: "rgba(255,255,255,0.62)" }}
            >
              {isCustomAgencyDomain ? "Tecnología" : "Desarrollado por"}
            </p>

            <a
              href={isCustomAgencyDomain ? "https://onoprop.com/" : "https://ono.ar/"}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={
                isCustomAgencyDomain
                  ? "Visitar sitio web de ONO Prop"
                  : "Visitar sitio web de ONO"
              }
              className="d-inline-flex align-items-center gap-2 text-decoration-none"
              style={{ color: "#ffffff" }}
            >
              <span
                className="d-inline-flex align-items-center justify-content-center rounded-3 fw-bold"
                style={{
                  width: 42,
                  height: 42,
                  background: "rgba(255,255,255,0.1)",
                  border: "1px solid rgba(255,255,255,0.18)",
                  letterSpacing: "0.08em",
                }}
              >
                ONO
              </span>

              <span>
                <span className="d-block fw-semibold">
                  {isCustomAgencyDomain ? "ONO Prop" : "ono.ar"}
                </span>

                <span
                  className="d-block small"
                  style={{ color: "rgba(255,255,255,0.62)" }}
                >
                  {isCustomAgencyDomain
                    ? "Portal inmobiliario y sitios para agencias"
                    : "Webapps, datos y automatización"}
                </span>
              </span>
            </a>
          </div>
        </div>

        <hr style={{ borderColor: "rgba(255,255,255,0.12)" }} />

        <div className="d-flex flex-wrap justify-content-center justify-content-md-between gap-2 small">
          <span style={{ color: "rgba(255,255,255,0.52)" }}>
            © {currentYear} {brandName}.
          </span>

          {isCustomAgencyDomain ? (
            <a
              href="https://onoprop.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-decoration-none"
              style={{ color: "rgba(255,255,255,0.72)" }}
            >
              Sitio inmobiliario desarrollado con ONO Prop.
            </a>
          ) : (
            <a
              href="https://ono.ar/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-decoration-none"
              style={{ color: "rgba(255,255,255,0.72)" }}
            >
              Tecnología inmobiliaria desarrollada por ONO.
            </a>
          )}
        </div>
      </div>
    </footer>
  );
};

export default Footer;