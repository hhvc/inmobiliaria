import { useState } from "react";

import { useAuth } from "../../context/auth/useAuth";

const validatePassword = (password) => {
  if (password.length < 6) return "Usá al menos 6 caracteres.";
  if (!/(?=.*[a-z])/.test(password)) return "Agregá al menos una minúscula.";
  if (!/(?=.*[A-Z])/.test(password)) return "Agregá al menos una mayúscula.";
  return "";
};

const EmailLogin = () => {
  const { signInWithEmail, signUpWithEmail, resetPassword } = useAuth();
  const [mode, setMode] = useState("login");
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    displayName: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const passwordError = mode === "register" && formData.password
    ? validatePassword(formData.password)
    : "";

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
    setMessage("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setIsError(false);
    try {
      if (mode === "reset") {
        await resetPassword(formData.email.trim());
        setMessage("Te enviamos un enlace para restablecer tu contraseña.");
        return;
      }
      if (mode === "register") {
        const validation = validatePassword(formData.password);
        if (validation) throw new Error(validation);
        await signUpWithEmail(
          formData.email.trim(),
          formData.password,
          formData.displayName.trim(),
        );
        return;
      }
      await signInWithEmail(formData.email.trim(), formData.password);
    } catch (error) {
      setIsError(true);
      setMessage(error.message || "No se pudo completar el acceso.");
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setMessage("");
    setIsError(false);
    setShowPassword(false);
  };

  return (
    <div>
      <div className="mb-3">
        <h3 className="h6 mb-1">
          {mode === "login" && "Accedé con tu email"}
          {mode === "register" && "Creá tu cuenta"}
          {mode === "reset" && "Recuperá tu contraseña"}
        </h3>
        <p className="text-muted small mb-0">
          {mode === "register"
            ? "Las cuentas nuevas deben confirmar su dirección de email."
            : "Tus datos se transmiten de forma segura."}
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        {mode === "register" && (
          <div className="mb-3">
            <label className="form-label" htmlFor="authDisplayName">Nombre completo</label>
            <input
              id="authDisplayName"
              type="text"
              name="displayName"
              className="form-control auth-control"
              autoComplete="name"
              placeholder="Cómo querés que te llamemos"
              value={formData.displayName}
              onChange={handleChange}
              required
            />
          </div>
        )}

        <div className="mb-3">
          <label className="form-label" htmlFor="authEmail">Email</label>
          <input
            id="authEmail"
            type="email"
            name="email"
            className="form-control auth-control"
            autoComplete="email"
            placeholder="nombre@empresa.com"
            value={formData.email}
            onChange={handleChange}
            required
          />
        </div>

        {mode !== "reset" && (
          <div className="mb-3">
            <div className="d-flex justify-content-between align-items-center">
              <label className="form-label" htmlFor="authPassword">Contraseña</label>
              {mode === "login" && (
                <button
                  type="button"
                  className="auth-inline-link"
                  onClick={() => switchMode("reset")}
                >
                  ¿La olvidaste?
                </button>
              )}
            </div>
            <div className="input-group">
              <input
                id="authPassword"
                type={showPassword ? "text" : "password"}
                name="password"
                className={`form-control auth-control ${passwordError ? "is-invalid" : ""}`}
                autoComplete={mode === "register" ? "new-password" : "current-password"}
                placeholder="Tu contraseña"
                value={formData.password}
                onChange={handleChange}
                required
              />
              <button
                type="button"
                className="btn btn-outline-secondary auth-password-toggle"
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                onClick={() => setShowPassword((current) => !current)}
              >
                {showPassword ? "Ocultar" : "Ver"}
              </button>
              {passwordError && <div className="invalid-feedback">{passwordError}</div>}
            </div>
            {mode === "register" && !passwordError && (
              <div className="form-text">Mínimo 6 caracteres, mayúscula y minúscula.</div>
            )}
          </div>
        )}

        <button
          type="submit"
          className="btn btn-primary auth-submit-button w-100"
          disabled={loading || Boolean(passwordError)}
        >
          {loading && "Procesando..."}
          {!loading && mode === "login" && "Ingresar"}
          {!loading && mode === "register" && "Crear cuenta"}
          {!loading && mode === "reset" && "Enviar enlace"}
        </button>
      </form>

      {message && (
        <div className={`alert ${isError ? "alert-danger" : "alert-success"} py-2 small mt-3 mb-0`}>
          {message}
        </div>
      )}

      <div className="auth-mode-footer">
        {mode === "login" && (
          <>
            ¿Todavía no tenés cuenta?{" "}
            <button type="button" onClick={() => switchMode("register")}>Crearla</button>
          </>
        )}
        {mode === "register" && (
          <>
            ¿Ya tenés cuenta?{" "}
            <button type="button" onClick={() => switchMode("login")}>Ingresar</button>
          </>
        )}
        {mode === "reset" && (
          <button type="button" onClick={() => switchMode("login")}>
            ← Volver al ingreso
          </button>
        )}
      </div>
    </div>
  );
};

export default EmailLogin;
