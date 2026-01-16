import { useEffect, useState, useCallback } from "react";
import { getInmobiliariasByRole } from "../services/inmobiliaria.service";
import { useAuth } from "../../context/auth/useAuth";

/**
 * 🏢 Hook para listar inmobiliarias según rol
 *
 * root  → todas
 * admin → solo las asociadas
 */
export function useInmobiliariaList() {
  const { user } = useAuth();

  const [inmobiliarias, setInmobiliarias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /**
   * 🔄 Carga principal
   */
  const fetchInmobiliarias = useCallback(async () => {
    if (!user) {
      setInmobiliarias([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const data = await getInmobiliariasByRole(user);
      setInmobiliarias(data);
    } catch (err) {
      console.error("[useInmobiliariaList] Error:", err);
      setError("No se pudieron cargar las inmobiliarias");
    } finally {
      setLoading(false);
    }
  }, [user]);

  /**
   * ▶️ Auto load
   */
  useEffect(() => {
    fetchInmobiliarias();
  }, [fetchInmobiliarias]);

  /**
   * 🔁 API pública del hook
   */
  return {
    inmobiliarias,
    loading,
    error,
    reload: fetchInmobiliarias,
    isEmpty: !loading && inmobiliarias.length === 0,
  };
}
