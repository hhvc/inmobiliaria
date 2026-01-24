import { useContext } from "react";
import { AuthContext } from "../../context/auth/AuthContext";

const InmobiliariaSelector = () => {
  const {
    user,
    activeInmobiliariaId,
    setActiveInmobiliaria, // ✅ setter correcto
  } = useContext(AuthContext);

  if (!user) return null;
  if (!Array.isArray(user.inmobiliarias) || user.inmobiliarias.length <= 1) {
    return null;
  }

  return (
    <div className="mb-3">
      <label className="form-label fw-semibold">Inmobiliaria activa</label>

      <select
        className="form-select"
        value={activeInmobiliariaId || ""}
        onChange={(e) => setActiveInmobiliaria(e.target.value)}
      >
        <option value="" disabled>
          Seleccionar inmobiliaria
        </option>

        {user.inmobiliarias.map((id) => (
          <option key={id} value={id}>
            {id}
          </option>
        ))}
      </select>
    </div>
  );
};

export default InmobiliariaSelector;
