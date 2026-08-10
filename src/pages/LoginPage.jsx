import { Navigate, useLocation } from "react-router-dom";

import Login from "../components/auth/Login";
import SEO from "../components/SEO";
import { useAuth } from "../context/auth/useAuth";

const LoginPage = () => {
  const { user, emailVerificationPending } = useAuth();
  const location = useLocation();
  const siteUrl = import.meta.env.VITE_PUBLIC_SITE_URL || "https://onoprop.com";
  const redirectTo = location.state?.from?.pathname || "/publicar";

  if (user && emailVerificationPending) {
    return <Navigate to="/verificar-email" state={{ from: location.state?.from }} replace />;
  }
  if (user) return <Navigate to={redirectTo} replace />;

  return (
    <main className="auth-page">
      <SEO
        title="Iniciar sesión | ONO Prop"
        description="Ingresá a ONO Prop para publicar propiedades, administrar consultas y acceder a servicios inmobiliarios."
        url={`${siteUrl}/login`}
        type="website"
        siteName="ONO Prop"
        noIndex
      />

      <div className="container py-4 py-lg-5">
        <section className="auth-shell">
          <aside className="auth-story-panel">
            <div>
              <span className="auth-story-badge">Plataforma inmobiliaria</span>
              <h1>Todo tu negocio inmobiliario, en un mismo lugar.</h1>
              <p>
                Publicaciones, difusión, consultas, tasaciones y gestión profesional
                conectadas en una experiencia simple.
              </p>
            </div>
            <ul className="auth-benefit-list">
              <li><span>✓</span> Acceso seguro para tu equipo</li>
              <li><span>✓</span> Herramientas activadas según tu plan</li>
              <li><span>✓</span> Información centralizada y auditable</li>
            </ul>
            <p className="auth-story-footnote mb-0">
              ¿Solo querés publicar como particular? También podés crear una cuenta gratuita.
            </p>
          </aside>
          <div className="auth-form-panel">
            <Login />
          </div>
        </section>
      </div>
    </main>
  );
};

export default LoginPage;
