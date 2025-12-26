import { useState } from "react";
import { useAuth } from "../../context/auth/useAuth";
import EmailLogin from "./EmailLogin";
// import PhoneLogin from "./PhoneLogin"; // Comentado temporalmente

const Login = () => {
  const { user, logout, signInWithGoogle } = useAuth();
  const [authMethod, setAuthMethod] = useState("email"); // 'email', 'phone', 'google'

  const handleGoogleLogin = async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      alert("Error al iniciar sesión con Google: " + error.message);
    }
  };

  if (user) {
    return (
      <div
        style={{ padding: "20px", textAlign: "center", background: "#f8f9fa" }}
      >
        <div className="card" style={{ maxWidth: "400px", margin: "0 auto" }}>
          <div className="card-body">
            <h5 className="card-title">Sesión Activa</h5>
            <p className="card-text">
              Bienvenido, <strong>{user.displayName || user.email}</strong>!
            </p>
            <button onClick={logout} className="btn btn-outline-danger">
              Cerrar Sesión
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <section id="login" style={{ padding: "40px 0", background: "#f8f9fa" }}>
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-md-6">
            <div className="card">
              <div className="card-header text-center">
                <h4 className="mb-0">Acceso Administrativo</h4>
              </div>
              <div className="card-body">
                {/* Método rápido - Google */}
                <div className="text-center mb-4">
                  <button
                    onClick={handleGoogleLogin}
                    className="btn btn-outline-primary"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      margin: "0 auto",
                      gap: "10px",
                      width: "100%",
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 48 48">
                      <path
                        fill="#4285f4"
                        d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
                      />
                      <path
                        fill="#34a853"
                        d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
                      />
                      <path
                        fill="#fbbc05"
                        d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7z"
                      />
                      <path
                        fill="#ea4335"
                        d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.92 4.18 29.94 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7C13.42 14.62 18.27 10.75 24 10.75z"
                      />
                    </svg>
                    Continuar con Google
                  </button>
                </div>

                <div className="text-center mb-3">
                  <small className="text-muted">O elige otro método</small>
                </div>

                {/* Selector de método - Solo email por ahora */}
                <div className="d-flex gap-2 mb-4">
                  <button
                    onClick={() => setAuthMethod("email")}
                    className={`btn flex-fill ${
                      authMethod === "email"
                        ? "btn-primary"
                        : "btn-outline-primary"
                    }`}
                  >
                    Email
                  </button>
                  {/* Comentado temporalmente - Botón de teléfono
                  <button
                    onClick={() => setAuthMethod("phone")}
                    className={`btn flex-fill ${
                      authMethod === "phone"
                        ? "btn-primary"
                        : "btn-outline-primary"
                    }`}
                  >
                    Teléfono
                  </button>
                  */}
                </div>

                {/* Formularios */}
                {authMethod === "email" && (
                  <EmailLogin
                    // onSwitchToPhone={() => setAuthMethod("phone")} // Comentado temporalmente
                    onSwitchToGoogle={handleGoogleLogin}
                  />
                )}

                {/* Comentado temporalmente - Login por teléfono
                {authMethod === "phone" && (
                  <PhoneLogin
                    onSwitchToEmail={() => setAuthMethod("email")}
                    onSwitchToGoogle={handleGoogleLogin}
                  />
                )}
                */}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Login;