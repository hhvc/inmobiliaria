const Footer = () => {
  const currentYear = new Date().getFullYear();

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
        <div className="row align-items-center g-3">
          <div className="col-md-6 text-center text-md-start">
            <p className="mb-1 fw-semibold text-white">LaDoctaProp</p>

            <p className="small mb-0" style={{ color: "rgba(255,255,255,0.62)" }}>
              Plataforma inmobiliaria para publicar, administrar y promocionar
              propiedades.
            </p>
          </div>

          <div className="col-md-6 text-center text-md-end">
            <p className="small mb-2" style={{ color: "rgba(255,255,255,0.62)" }}>
              Desarrollado por
            </p>

            <a
              href="https://ono.ar/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Visitar sitio web de ONO"
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
                <span className="d-block fw-semibold">ono.ar</span>
                <span
                  className="d-block small"
                  style={{ color: "rgba(255,255,255,0.62)" }}
                >
                  Webapps, datos y automatización
                </span>
              </span>
            </a>
          </div>
        </div>

        <hr style={{ borderColor: "rgba(255,255,255,0.12)" }} />

        <div className="d-flex flex-wrap justify-content-center justify-content-md-between gap-2 small">
          <span style={{ color: "rgba(255,255,255,0.52)" }}>
            © {currentYear} LaDoctaProp.
          </span>

          <a
            href="https://ono.ar/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-decoration-none"
            style={{ color: "rgba(255,255,255,0.72)" }}
          >
            Tecnología inmobiliaria desarrollada en Córdoba, Argentina.
          </a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;