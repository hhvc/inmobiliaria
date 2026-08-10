import { useEffect, useRef, useState } from "react";

import { useAuth } from "../../context/auth/useAuth";
import {
  buildArgentinaMobileE164,
  normalizeArgentinaMobileDigits,
} from "../../context/auth/auth.helpers";

const PhoneLogin = () => {
  const {
    setupPhoneAuth,
    sendSMSCode,
    verifySMSCode,
    cancelPhoneAuth,
    confirmationResult,
    recaptchaReady,
  } = useAuth();
  const [step, setStep] = useState("phone");
  const [phoneDigits, setPhoneDigits] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [recaptchaAttempt, setRecaptchaAttempt] = useState(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    if (step !== "phone") return undefined;
    let cancelled = false;
    const initialize = async () => {
      try {
        setMessage("Preparando verificación segura...");
        setIsError(false);
        await setupPhoneAuth("phone-sign-in-button");
        if (!cancelled && mountedRef.current) setMessage("");
      } catch (error) {
        if (!cancelled && mountedRef.current) {
          setIsError(true);
          setMessage(error.message || "No se pudo preparar la verificación.");
        }
      }
    };
    initialize();
    return () => {
      cancelled = true;
    };
  }, [recaptchaAttempt, setupPhoneAuth, step]);

  useEffect(() => () => {
    mountedRef.current = false;
    cancelPhoneAuth();
  }, [cancelPhoneAuth]);

  useEffect(() => {
    if (confirmationResult) setStep("code");
  }, [confirmationResult]);

  const handleSendCode = async (event) => {
    event.preventDefault();
    const phoneNumber = buildArgentinaMobileE164(phoneDigits);
    if (!phoneNumber) {
      setIsError(true);
      setMessage("Ingresá código de área y número: deben ser 10 dígitos.");
      return;
    }
    try {
      setLoading(true);
      setMessage("");
      setIsError(false);
      await sendSMSCode(phoneNumber);
      setMessage("Código enviado. Revisá los SMS de tu celular.");
    } catch (error) {
      setIsError(true);
      setMessage(error.message || "No se pudo enviar el código.");
      cancelPhoneAuth();
      setRecaptchaAttempt((current) => current + 1);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  const handleVerifyCode = async (event) => {
    event.preventDefault();
    try {
      setLoading(true);
      setMessage("");
      setIsError(false);
      await verifySMSCode(code);
    } catch (error) {
      setIsError(true);
      setMessage(error.message || "No se pudo verificar el código.");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  const changeNumber = () => {
    cancelPhoneAuth();
    setStep("phone");
    setCode("");
    setMessage("");
    setIsError(false);
    setRecaptchaAttempt((current) => current + 1);
  };

  return (
    <div>
      <div className="mb-3">
        <h3 className="h6 mb-1">
          {step === "phone" ? "Ingresá con tu celular" : "Confirmá el código"}
        </h3>
        <p className="text-muted small mb-0">
          {step === "phone"
            ? "Por ahora disponible para celulares argentinos."
            : `Enviamos un SMS a +54 9 ${phoneDigits}.`}
        </p>
      </div>

      {step === "phone" ? (
        <form onSubmit={handleSendCode}>
          <label className="form-label" htmlFor="authPhone">Número de celular</label>
          <div className="input-group mb-2">
            <span className="input-group-text auth-phone-prefix">+54 9</span>
            <input
              id="authPhone"
              type="tel"
              className="form-control auth-control"
              inputMode="numeric"
              autoComplete="tel-national"
              placeholder="351 547 8785"
              value={phoneDigits}
              maxLength={10}
              disabled={loading}
              onChange={(event) => {
                setPhoneDigits(normalizeArgentinaMobileDigits(event.target.value));
                setMessage("");
              }}
              required
            />
          </div>
          <div className="form-text mb-3">
            Código de área sin 0 + número sin 15. Ejemplo: 3515478785.
          </div>
          <button
            id="phone-sign-in-button"
            type="submit"
            className="btn btn-primary auth-submit-button w-100"
            disabled={loading || !recaptchaReady || phoneDigits.length !== 10}
          >
            {loading ? "Enviando..." : "Enviar código por SMS"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleVerifyCode}>
          <label className="form-label" htmlFor="authPhoneCode">Código de 6 dígitos</label>
          <input
            id="authPhoneCode"
            type="text"
            className="form-control auth-control auth-code-input"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="000000"
            value={code}
            maxLength={6}
            disabled={loading}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
            required
          />
          <button
            type="submit"
            className="btn btn-primary auth-submit-button w-100 mt-3"
            disabled={loading || code.length !== 6}
          >
            {loading ? "Verificando..." : "Verificar e ingresar"}
          </button>
          <button
            type="button"
            className="auth-inline-link w-100 text-center mt-3"
            disabled={loading}
            onClick={changeNumber}
          >
            Cambiar número
          </button>
        </form>
      )}

      {message && (
        <div className={`alert ${isError ? "alert-danger" : "alert-info"} py-2 small mt-3 mb-0`}>
          {message}
        </div>
      )}

      <p className="auth-phone-disclosure mb-0">
        Al continuar aceptás recibir un SMS de verificación. Google procesa el número
        para prevenir fraude y abuso; pueden aplicarse cargos de tu operadora.
      </p>
    </div>
  );
};

export default PhoneLogin;
