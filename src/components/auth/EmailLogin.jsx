import { useState } from "react";
import { useAuth } from "../../context/auth/useAuth";

const EmailLogin = ({ onSwitchToGoogle }) => {
  const { signInWithEmail, signUpWithEmail, resetPassword } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [isResetting, setIsResetting] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    displayName: "",
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");

  // Función para validar contraseña
  const validatePassword = (password) => {
    if (password.length < 6) {
      return "La contraseña debe tener al menos 6 caracteres";
    }
    if (!/(?=.*[a-z])/.test(password)) {
      return "La contraseña debe contener al menos una letra minúscula";
    }
    if (!/(?=.*[A-Z])/.test(password)) {
      return "La contraseña debe contener al menos una letra mayúscula";
    }
    return "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setPasswordError("");

    try {
      if (isResetting) {
        await resetPassword(formData.email);
        setMessage("Se ha enviado un email para restablecer tu contraseña");
        setIsResetting(false);
      } else if (isLogin) {
        await signInWithEmail(formData.email, formData.password);
        setMessage("Inicio de sesión exitoso");
      } else {
        // Validar contraseña antes de registrar
        const passwordValidation = validatePassword(formData.password);
        if (passwordValidation) {
          setPasswordError(passwordValidation);
          setLoading(false);
          return;
        }

        await signUpWithEmail(
          formData.email,
          formData.password,
          formData.displayName
        );
        setMessage("Registro exitoso");
      }
    } catch (error) {
      setMessage(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Validar contraseña en tiempo real solo en registro
    if (name === "password" && !isLogin) {
      const error = validatePassword(value);
      setPasswordError(error);
    }
  };

  if (isResetting) {
    return (
      <div>
        <h5>Recuperar Contraseña</h5>
        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <input
              type="email"
              name="email"
              className="form-control"
              placeholder="Email"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary w-100"
            disabled={loading}
          >
            {loading ? "Enviando..." : "Enviar Email de Recuperación"}
          </button>
          <button
            type="button"
            className="btn btn-link w-100"
            onClick={() => setIsResetting(false)}
          >
            Volver al login
          </button>
        </form>
        {message && <div className="alert alert-info mt-3">{message}</div>}
      </div>
    );
  }

  return (
    <div>
      <h5>{isLogin ? "Iniciar Sesión" : "Registrarse"}</h5>
      <form onSubmit={handleSubmit}>
        {!isLogin && (
          <div className="mb-3">
            <input
              type="text"
              name="displayName"
              className="form-control"
              placeholder="Nombre completo"
              value={formData.displayName}
              onChange={handleChange}
              required
            />
          </div>
        )}
        <div className="mb-3">
          <input
            type="email"
            name="email"
            className="form-control"
            placeholder="Email"
            value={formData.email}
            onChange={handleChange}
            required
          />
        </div>
        <div className="mb-3">
          <input
            type="password"
            name="password"
            className={`form-control ${
              passwordError && !isLogin ? "is-invalid" : ""
            }`}
            placeholder="Contraseña"
            value={formData.password}
            onChange={handleChange}
            required
          />
          {!isLogin && passwordError && (
            <div className="invalid-feedback">{passwordError}</div>
          )}
          {!isLogin && !passwordError && formData.password && (
            <div className="valid-feedback">✓ Contraseña válida</div>
          )}
          {!isLogin && (
            <small className="form-text text-muted">
              La contraseña debe tener al menos 6 caracteres, una mayúscula y
              una minúscula
            </small>
          )}
        </div>
        <button
          type="submit"
          className="btn btn-primary w-100"
          disabled={loading || (!isLogin && passwordError && formData.password)}
        >
          {loading
            ? "Procesando..."
            : isLogin
            ? "Iniciar Sesión"
            : "Registrarse"}
        </button>
      </form>

      <div className="mt-3 text-center">
        <button
          type="button"
          className="btn btn-link"
          onClick={() => {
            setIsLogin(!isLogin);
            setPasswordError(""); // Limpiar error al cambiar modo
          }}
        >
          {isLogin
            ? "¿No tienes cuenta? Regístrate"
            : "¿Ya tienes cuenta? Inicia sesión"}
        </button>
        {isLogin && (
          <button
            type="button"
            className="btn btn-link d-block w-100"
            onClick={() => setIsResetting(true)}
          >
            ¿Olvidaste tu contraseña?
          </button>
        )}
      </div>

      <div className="mt-3">
        <button
          onClick={onSwitchToGoogle}
          className="btn btn-outline-primary w-100"
        >
          Continuar con Google
        </button>
      </div>

      {message && (
        <div
          className={`alert ${
            message.includes("Error") ? "alert-danger" : "alert-info"
          } mt-3`}
        >
          {message}
        </div>
      )}
    </div>
  );
};

export default EmailLogin;
