import { useCallback, useEffect, useState } from "react";
import {
  getInmueblesByInmobiliaria,
  getPublicInmuebles,
  deleteInmueble,
} from "@/inmueble/services/inmueble.service";

/**
 * Hook para listar inmuebles
 *
 * @param {string} inmobiliariaId
 * @param {Object} options
 * @param {boolean} options.publicOnly - lista solo publicados
 * @param {Object} options.filters - filtros iniciales
 */
export const useInmuebleList = (
  inmobiliariaId,
  { publicOnly = false, filters: initialFilters = {} } = {}
) => {
  const [inmuebles, setInmuebles] = useState([]);
  const [filters, setFilters] = useState(initialFilters);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /* =========================================================
     Fetch
     ========================================================= */

  const fetchInmuebles = useCallback(async () => {
    if (!inmobiliariaId) return;

    setLoading(true);
    setError(null);

    try {
      let data = [];

      if (publicOnly) {
        data = await getPublicInmuebles(inmobiliariaId, filters);
      } else {
        data = await getInmueblesByInmobiliaria(inmobiliariaId, filters);
      }

      setInmuebles(data);
    } catch (err) {
      console.error("Error obteniendo inmuebles:", err);
      setError("No se pudieron cargar los inmuebles");
    } finally {
      setLoading(false);
    }
  }, [inmobiliariaId, publicOnly, filters]);

  /* =========================================================
     Effects
     ========================================================= */

  useEffect(() => {
    fetchInmuebles();
  }, [fetchInmuebles]);

  /* =========================================================
     Acciones
     ========================================================= */

  const removeInmueble = async (inmuebleId) => {
    if (!inmuebleId) return;

    const confirm = window.confirm(
      "¿Eliminar este inmueble? Esta acción no se puede deshacer."
    );

    if (!confirm) return;

    try {
      await deleteInmueble(inmobiliariaId, inmuebleId);
      setInmuebles((prev) => prev.filter((i) => i.id !== inmuebleId));
    } catch (err) {
      console.error("Error eliminando inmueble:", err);
      setError("No se pudo eliminar el inmueble");
    }
  };

  const refresh = () => {
    fetchInmuebles();
  };

  return {
    // Estado
    inmuebles,
    loading,
    error,
    filters,

    // Acciones
    setFilters,
    refresh,
    removeInmueble,
  };
};
