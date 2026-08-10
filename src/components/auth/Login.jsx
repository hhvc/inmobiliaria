import { useState } from "react";

import { useAuth } from "../../context/auth/useAuth";
import EmailLogin from "./EmailLogin";
import PhoneLogin from "./PhoneLogin";

const PHONE_AUTH_ENABLED = import.meta.env.VITE_PHONE_AUTH_ENABLED === "true";

const Login = ({ compact = false }) => {
  const { user, signInWithGoogle } = useAuth();
  const [authMethod, setAuthMethod] = useState("email");
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState("");

  const handleGoogleLogin = async () => {
    try {
      setGoogleLoading(true);
      setGoogleError("");
      await signInWithGoogle();
    } catch (error) {
      setGoogleError(error.message || "No se pudo iniciar sesión con Google.");
    } finally {
      setGoogleLoading(false);
    }
  };

  if (user) return null;

  return (
    <div className={`auth-card-content ${compact ? "auth-card-content--compact" : ""}`}>
      <div className="auth-card-heading">
        <img
          className="auth-card-logo"
          src="/assets/img/logoONOProp3.png"
          alt="ONO Prop"
        />
        <div>
          <p className="auth-eyebrow mb-1">Tu espacio inmobiliario</p>
          <h2 className="h4 mb-1">Ingresá a ONO Prop</h2>
          <p className="text-muted small mb-0">
            Administrá propiedades, consultas y servicios desde un solo lugar.
          </p>
        </div>
      </div>

      <button
        type="button"
        className="btn auth-google-button w-100"
        disabled={googleLoading}
        onClick={handleGoogleLogin}
      >
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 48 48">
          <path fill="#4285f4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z" />
          <path fill="#34a853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z" />
          <path fill="#fbbc05" d="M11.69 28.18C11.25 26.86 11 24.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z" />
          <path fill="#ea4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.92 4.18 29.94 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7C13.42 14.62 18.27 10.75 24 10.75z" />
        </svg>
        {googleLoading ? "Conectando..." : "Continuar con Google"}
      </button>

      {googleError && <div className="alert alert-danger py-2 small mt-3">{googleError}</div>}

      <div className="auth-divider" aria-hidden="true">
        <span>{PHONE_AUTH_ENABLED ? "o elegí otro método" : "o ingresá con email"}</span>
      </div>

      {PHONE_AUTH_ENABLED && (
        <div className="auth-method-tabs" role="tablist" aria-label="Método de acceso">
          <button
            type="button"
            role="tab"
            aria-selected={authMethod === "email"}
            className={authMethod === "email" ? "active" : ""}
            onClick={() => setAuthMethod("email")}
          >
            Email
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={authMethod === "phone"}
            className={authMethod === "phone" ? "active" : ""}
            onClick={() => setAuthMethod("phone")}
          >
            Celular
          </button>
        </div>
      )}

      <div className="auth-method-panel">
        {PHONE_AUTH_ENABLED && authMethod === "phone" ? <PhoneLogin /> : <EmailLogin />}
      </div>

      <p className="auth-legal-copy mb-0">
        Al continuar aceptás las <a href="/terminos">Condiciones del servicio</a> y
        la <a href="/privacidad">Política de privacidad</a>.
      </p>
    </div>
  );
};

export default Login;
