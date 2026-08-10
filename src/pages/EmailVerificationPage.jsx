import { useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

import SEO from "../components/SEO";
import { useAuth } from "../context/auth/useAuth";

const EmailVerificationPage = () => {
  const {
    user,
    emailVerificationPending,
    refreshEmailVerification,
    resendVerificationEmail,
    logout,
  } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const destination = location.state?.from?.pathname || "/publicar";

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = window.setInterval(() => {
      setCooldown((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const checkVerification = async () => {
    try {
      setChecking(true);
      setMessage("");
      setIsError(false);
      const verified = await refreshEmailVerification();
      if (verified) {
        navigate(destination, { replace: true });
      } else {
        setIsError(true);
        setMessage("Todavía no figura verificado. Abrí el enlace del email y volvé a comprobar.");
      }
    } catch (error) {
      setIsError(true);
      setMessage(error.message || "No se pudo comprobar la dirección.");
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    const shouldCheck = new URLSearchParams(location.search).get("comprobar") === "1";
    if (shouldCheck && user && emailVerificationPending) checkVerification();
    // La comprobación automática se reserva para el regreso desde el enlace del email.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resend = async () => {
    try {
      setResending(true);
      setMessage("");
      setIsError(false);
      await resendVerificationEmail();
      setCooldown(60);
      setMessage("Enviamos un nuevo email de verificación. Revisá también spam.");
    } catch (error) {
      setIsError(true);
      setMessage(error.message || "No se pudo reenviar el email.");
    } finally {
      setResending(false);
    }
  };

  const useAnotherAccount = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  if (!user) return <Navigate to="/login" replace />;
  if (!emailVerificationPending) return <Navigate to={destination} replace />;

  return (
    <main className="auth-page auth-verification-page">
      <SEO title="Verificá tu email | ONO Prop" noIndex />
      <div className="container py-5">
        <div className="auth-verification-card mx-auto">
          <div className="auth-mail-icon" aria-hidden="true">✉</div>
          <p className="auth-eyebrow mb-2">Un paso más</p>
          <h1 className="h3 mb-3">Verificá tu dirección de email</h1>
          <p className="text-muted mb-2">Enviamos un enlace de confirmación a:</p>
          <p className="auth-verification-email">{user.email}</p>
          <p className="text-muted small">
            Abrí el mensaje desde este dispositivo o cualquier otro. Después regresá
            y presioná el botón para continuar.
          </p>

          {message && (
            <div className={`alert ${isError ? "alert-danger" : "alert-success"} small`}>
              {message}
            </div>
          )}

          <button
            type="button"
            className="btn btn-primary auth-submit-button w-100"
            disabled={checking || resending}
            onClick={checkVerification}
          >
            {checking ? "Comprobando..." : "Ya verifiqué mi email"}
          </button>
          <button
            type="button"
            className="btn btn-outline-primary w-100 mt-2"
            disabled={resending || checking || cooldown > 0}
            onClick={resend}
          >
            {resending
              ? "Reenviando..."
              : cooldown > 0
                ? `Reenviar en ${cooldown}s`
                : "Reenviar email"}
          </button>
          <button
            type="button"
            className="auth-inline-link mt-4"
            onClick={useAnotherAccount}
          >
            Usar otra cuenta
          </button>
        </div>
      </div>
    </main>
  );
};

export default EmailVerificationPage;
