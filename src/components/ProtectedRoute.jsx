import { useAuth } from "../context/auth/useAuth";
import { Navigate, useLocation } from "react-router-dom";

const ProtectedRoute = ({ children, role = null }) => {
  const { user, hasRole, emailVerificationPending } = useAuth();
  const location = useLocation();

  // Si no hay usuario autenticado, redirigir al login
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (emailVerificationPending) {
    return <Navigate to="/verificar-email" state={{ from: location }} replace />;
  }

  // Si se requiere un rol específico y el usuario no lo tiene
  if (role && !hasRole(role)) {
    return (
      <div className="container mt-4">
        <div className="alert alert-danger text-center">
          <h4>🚫 Acceso Denegado</h4>
          <p>No tienes permisos para acceder a esta sección.</p>
        </div>
      </div>
    );
  }

  // Si pasa todas las validaciones, mostrar el contenido
  return children;
};

export default ProtectedRoute;
