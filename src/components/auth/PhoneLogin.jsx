import { useState, useEffect, useRef } from "react";
import { useAuth } from "../../context/auth/useAuth";

const PhoneLogin = ({ onSwitchToEmail, onSwitchToGoogle }) => {
  const {
    setupPhoneAuth,
    sendSMSCode,
    verifySMSCode,
    cancelPhoneAuth,
    confirmationResult,
    recaptchaReady,
  } = useAuth();

  const [step, setStep] = useState(1);
  const [phoneDigits, setPhoneDigits] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [showRecaptcha, setShowRecaptcha] = useState(false);

  const mountedRef = useRef(true);
  const recaptchaInitializedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cancelPhoneAuth();
    };
  }, [cancelPhoneAuth]);

  // Inicializar reCAPTCHA de forma oculta
  useEffect(() => {
    if (step !== 1 || recaptchaInitializedRef.current) return;

    const initializeRecaptcha = async () => {
      try {
        setMessage("Configurando verificación de seguridad...");
        console.log("🔄 PhoneLogin: Inicializando reCAPTCHA...");

        if (!mountedRef.current) return;

        // Mostrar temporalmente el reCAPTCHA para inicialización
        setShowRecaptcha(true);

        // Pequeño delay para asegurar que el DOM esté listo
        await new Promise((resolve) => setTimeout(resolve, 100));

        console.log("🔄 PhoneLogin: Llamando a setupPhoneAuth...");
        await setupPhoneAuth("recaptcha-container");
        recaptchaInitializedRef.current = true;

        if (mountedRef.current) {
          // Ocultar después de la inicialización
          setShowRecaptcha(false);
          setMessage("");
          console.log("✅ PhoneLogin: reCAPTCHA Enterprise inicializado");
        }
      } catch (error) {
        console.error("❌ PhoneLogin: Error inicializando reCAPTCHA:", error);
        if (mountedRef.current) {
          setShowRecaptcha(false);
          setMessage(
            `Error de seguridad: ${error.message}. Recarga la página.`
          );
          recaptchaInitializedRef.current = false;
        }
      }
    };

    initializeRecaptcha();
  }, [step, setupPhoneAuth]);

  useEffect(() => {
    if (confirmationResult && step === 1) {
      console.log(
        "✅ PhoneLogin: confirmationResult recibido, avanzando a paso 2"
      );
      setStep(2);
    }
  }, [confirmationResult, step]);

  const handleSendCode = async (e) => {
    e.preventDefault();
    if (loading) return;

    console.log("🔄 PhoneLogin: Iniciando envío de código...");
    console.log("🔍 PhoneLogin: recaptchaReady:", recaptchaReady);

    if (!recaptchaReady) {
      setMessage(
        "La verificación de seguridad no está lista. Espera un momento."
      );
      return;
    }

    const digits = phoneDigits.replace(/\D/g, "");
    if (digits.length !== 10) {
      setMessage("Ingresa código de área + número (10 dígitos en total)");
      return;
    }

    const fullPhone = `+549${digits}`;
    setLoading(true);
    setMessage("Enviando código...");

    try {
      console.log("🔄 PhoneLogin: Llamando a sendSMSCode...");
      await sendSMSCode(fullPhone);
      setMessage("✓ Código enviado por SMS. Revisa tu teléfono.");
    } catch (error) {
      console.error("❌ PhoneLogin: Error en sendSMSCode:", error);
      setMessage(`✗ ${error.message || "Error al enviar SMS."}`);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setMessage("");

    try {
      await verifySMSCode(code);
      setMessage("✓ Verificación exitosa. Redirigiendo...");
    } catch (error) {
      console.error("❌ PhoneLogin: Error en verifySMSCode:", error);
      setMessage(`✗ ${error.message || "Error al verificar el código."}`);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  const handleBackToPhone = () => {
    cancelPhoneAuth();
    recaptchaInitializedRef.current = false;
    setStep(1);
    setCode("");
    setMessage("");
    setShowRecaptcha(false);
  };

  const displayedFullPhone = `+549${phoneDigits.replace(/\D/g, "")}`;

  return (
    <div>
      <h5>Iniciar con Teléfono</h5>

      {step === 1 && (
        <form onSubmit={handleSendCode}>
          <div className="mb-3">
            <label className="form-label">Solo celulares de Argentina</label>
            <div className="input-group">
              <span className="input-group-text">+54 9</span>
              <input
                type="tel"
                className="form-control"
                placeholder="1198765432"
                value={phoneDigits}
                onChange={(e) =>
                  setPhoneDigits(e.target.value.replace(/\D/g, ""))
                }
                required
                disabled={loading}
                maxLength={10}
              />
            </div>
            <small className="form-text text-muted">
              Ingresa código de área + número (10 dígitos). Ej: 3511234567
            </small>
          </div>

          {/* Contenedor reCAPTCHA - completamente oculto */}
          <div
            style={{
              display: showRecaptcha ? "block" : "none",
              width: "1px",
              height: "1px",
              overflow: "hidden",
            }}
          />

          <button
            type="submit"
            className="btn btn-primary w-100"
            disabled={
              loading ||
              !recaptchaReady ||
              phoneDigits.replace(/\D/g, "").length !== 10
            }
          >
            {loading ? "Enviando código..." : "Enviar código por SMS"}
          </button>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={handleVerifyCode}>
          <div className="mb-3">
            <p>
              Verificando: <strong>{displayedFullPhone}</strong>
            </p>
            <input
              type="text"
              className="form-control"
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              required
              maxLength={6}
              disabled={loading}
            />
            <small className="form-text text-muted">
              Ingresa el código de 6 dígitos que recibiste por SMS
            </small>
          </div>
          <button
            type="submit"
            className="btn btn-success w-100"
            disabled={loading || code.length !== 6}
          >
            {loading ? "Verificando..." : "Verificar código"}
          </button>
          <button
            type="button"
            className="btn btn-link w-100"
            onClick={handleBackToPhone}
            disabled={loading}
          >
            ← Cambiar número
          </button>
        </form>
      )}

      <div className="mt-3">
        <button
          onClick={onSwitchToEmail}
          className="btn btn-outline-secondary w-100 mb-2"
          disabled={loading}
        >
          Usar email
        </button>
        <button
          onClick={onSwitchToGoogle}
          className="btn btn-outline-primary w-100"
          disabled={loading}
        >
          Continuar con Google
        </button>
      </div>

      {message && (
        <div
          className={`alert ${
            message.includes("✗")
              ? "alert-danger"
              : message.includes("✓")
              ? "alert-success"
              : "alert-info"
          } mt-3`}
        >
          {message}
        </div>
      )}
    </div>
  );
};

export default PhoneLogin;
