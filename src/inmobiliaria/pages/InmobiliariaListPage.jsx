import { useState } from "react";
import { useNavigate } from "react-router-dom";
import InmobiliariaList from "../components/InmobiliariaList";
import InmobiliariaFilters from "../components/InmobiliariaFilters";
import { bajaInmobiliaria } from "../services/inmobiliaria.service";
import { useAuth } from "../../context/auth/useAuth";

export default function InmobiliariaListPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [filters, setFilters] = useState({
    search: "",
    estado: "",
  });

  const handleDisable = async (inmo) => {
    const ok = window.confirm(
      `¿Seguro que deseas dar de baja a la inmobiliaria "${inmo.nombre}"?`
    );

    if (!ok) return;

    try {
      await bajaInmobiliaria(inmo.id, user.uid);
    } catch (error) {
      console.error("Error al dar de baja la inmobiliaria", error);
      alert("No se pudo dar de baja la inmobiliaria");
    }
  };

  return (
    <div className="container py-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h3>🏢 Inmobiliarias</h3>
        <button
          className="btn btn-primary"
          onClick={() => navigate("/admin/inmobiliarias/nueva")}
        >
          ➕ Nueva Inmobiliaria
        </button>
      </div>

      <InmobiliariaFilters filters={filters} onChange={setFilters} />

      <InmobiliariaList
        filters={filters}
        onEdit={(inmo) => navigate(`/admin/inmobiliarias/${inmo.id}/editar`)}
        onDisable={handleDisable}
      />
    </div>
  );
}
