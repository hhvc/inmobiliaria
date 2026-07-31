import { Link } from "react-router-dom";

import SEO from "../components/SEO";
import {
  LEGAL_EMAIL,
  LEGAL_LAST_UPDATED,
  LEGAL_OPERATOR,
  LEGAL_SITE_URL,
} from "./legal.constants";
import "./legal.css";

const LEGAL_LINKS = [
  { to: "/privacidad", label: "Privacidad" },
  { to: "/terminos", label: "Términos" },
  { to: "/eliminacion-de-datos", label: "Eliminación de datos" },
];

const LegalPageLayout = ({
  eyebrow,
  title,
  description,
  canonicalPath,
  intro,
  children,
}) => {
  return (
    <div className="legal-page">
      <SEO
        title={`${title} | ONO Prop`}
        description={description}
        url={`${LEGAL_SITE_URL}${canonicalPath}`}
        type="website"
        siteName="ONO Prop"
      />

      <header className="legal-hero">
        <div className="container legal-shell">
          <nav aria-label="Navegación legal" className="legal-breadcrumb">
            <Link to="/">ONO Prop</Link>
            <span aria-hidden="true">/</span>
            <span>{eyebrow}</span>
          </nav>

          <p className="legal-eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p className="legal-intro">{intro}</p>
          <p className="legal-updated">
            Vigente desde el {LEGAL_LAST_UPDATED}
          </p>
        </div>
      </header>

      <div className="container legal-shell legal-body">
        <aside className="legal-summary" aria-label="Información del responsable">
          <strong>Responsable</strong>
          <span>{LEGAL_OPERATOR}</span>
          <a href={`mailto:${LEGAL_EMAIL}`}>{LEGAL_EMAIL}</a>
        </aside>

        <article className="legal-content">{children}</article>

        <nav className="legal-related" aria-label="Documentos legales relacionados">
          {LEGAL_LINKS.map((link) => (
            <Link key={link.to} to={link.to}>
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
};

export default LegalPageLayout;
