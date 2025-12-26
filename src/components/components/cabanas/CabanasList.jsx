import { useState, useEffect } from "react";
import { collection, getDocs, orderBy, query, where } from "firebase/firestore";
import { db } from "../../../firebase/config";
import Cabana from "./Cabana";
import SmartSearch from "./SmartSearch";

const CabanasList = () => {
  const [cabanas, setCabanas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filtroDestacadas, setFiltroDestacadas] = useState(false);
  const [showSmartSearch, setShowSmartSearch] = useState(false);

  useEffect(() => {
    const fetchCabanas = async () => {
      try {
        let q;

        if (filtroDestacadas) {
          // Solo cabañas destacadas y disponibles
          q = query(
            collection(db, "cabanas"),
            where("disponible", "==", true),
            where("destacada", "==", true),
            orderBy("orden", "asc")
          );
        } else {
          // Todas las cabañas disponibles
          q = query(
            collection(db, "cabanas"),
            where("disponible", "==", true),
            orderBy("orden", "asc")
          );
        }

        const querySnapshot = await getDocs(q);
        const cabanasData = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setCabanas(cabanasData);
      } catch (error) {
        console.error("Error cargando cabañas:", error);
        setError("Error al cargar las cabañas. Por favor, recarga la página.");
      } finally {
        setLoading(false);
      }
    };

    fetchCabanas();
  }, [filtroDestacadas]);

  // Función para contar cabañas destacadas
  const contarCabanasDestacadas = () => {
    return cabanas.filter((cabana) => cabana.destacada).length;
  };

  // Calcular estadísticas para el resumen
  const calcularEstadisticas = () => {
    if (cabanas.length === 0) {
      return { precioMinimo: 0, capacidadMaxima: 0 };
    }

    const precios = cabanas.map((c) => c.precios?.base || c.precioNoche || 100);
    const precioMinimo = Math.min(...precios);

    const capacidades = cabanas.map((c) => {
      if (c.capacidad && typeof c.capacidad === "object") {
        return c.capacidad.maxPersonas || 0;
      }
      // Intentar extraer número del string antiguo
      const match = (c.capacidad || "").match(/\d+/);
      return match ? parseInt(match[0]) : 0;
    });
    const capacidadMaxima = Math.max(...capacidades);

    return { precioMinimo, capacidadMaxima };
  };

  const { precioMinimo, capacidadMaxima } = calcularEstadisticas();

  if (loading) {
    return (
      <section
        className="pricing py-5"
        style={{ backgroundImage: "url('/assets/img/bgTop2.jpg')" }}
      >
        <div className="container">
          <div className="text-center py-5">
            <div className="spinner-border text-light" role="status">
              <span className="visually-hidden">Cargando...</span>
            </div>
            <p className="text-white mt-2">Cargando cabañas...</p>
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section
        className="pricing py-5"
        style={{ backgroundImage: "url('/assets/img/bgTop2.jpg')" }}
      >
        <div className="container">
          <div className="alert alert-danger text-center">{error}</div>
        </div>
      </section>
    );
  }

  return (
    <section
      id="cabañas"
      className="pricing py-5"
      style={{ backgroundImage: "url('/assets/img/bgTop2.jpg')" }}
    >
      <div className="container">
        <div className="row text-center mb-4">
          <div className="col-lg-12">
            <h1 className="text-muted mb-3">Nuestras Cabañas</h1>
            <p className="text-muted-50 lead">
              Elige el lugar perfecto para tu escapada inolvidable
            </p>
          </div>
        </div>

        {/* Botón para mostrar/ocultar el SmartSearch */}
        <div className="row mb-4">
          <div className="col-12 text-center">
            <button
              className={`btn ${
                showSmartSearch ? "btn-warning" : "btn-success"
              } btn-lg`}
              onClick={() => setShowSmartSearch(!showSmartSearch)}
            >
              {showSmartSearch ? (
                <>🙈 Ocultar Asistente de Búsqueda</>
              ) : (
                <>🔍 Buscar/ Solicitar presupuesto personalizado</>
              )}
            </button>
          </div>
        </div>

        {/* Componente SmartSearch */}
        {showSmartSearch && (
          <div className="row mb-5">
            <div className="col-12">
              <div className="card shadow-lg border-0">
                <div className="card-body p-0">
                  <SmartSearch />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Lista de cabañas */}
        <div className="row">
          {cabanas.map((cabana) => (
            <Cabana key={cabana.id} cabana={cabana} />
          ))}
        </div>

        {/* Filtros y estadísticas - Comentado para futuro uso */}
        {/* <div className="row mb-4">
          <div className="col-12">
            <div className="card bg-dark bg-opacity-50 border-light">
              <div className="card-body py-3">
                <div className="row align-items-center">
                  <div className="col-md-6">
                    <div className="form-check form-switch mb-0">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="filtroDestacadas"
                        checked={filtroDestacadas}
                        onChange={(e) => setFiltroDestacadas(e.target.checked)}
                      />
                      <label
                        className="form-check-label text-white"
                        htmlFor="filtroDestacadas"
                      >
                        ⭐ Mostrar solo cabañas destacadas
                      </label>
                    </div>
                  </div>
                  <div className="col-md-6 text-md-end">
                    <small className="text-white-50">
                      Mostrando <strong>{cabanas.length}</strong> cabaña
                      {cabanas.length !== 1 ? "s" : ""} disponible
                      {cabanas.length !== 1 ? "s" : ""}
                      {filtroDestacadas && (
                        <span className="text-warning">
                          {" "}
                          ({contarCabanasDestacadas()} destacada
                          {contarCabanasDestacadas() !== 1 ? "s" : ""})
                        </span>
                      )}
                    </small>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div> */}

        {cabanas.length === 0 ? (
          <div className="text-center py-5">
            <div className="alert alert-info text-white bg-transparent border-light">
              <h4>
                {filtroDestacadas
                  ? "No hay cabañas destacadas disponibles"
                  : "No hay cabañas disponibles"}
              </h4>
              <p className="mb-0">
                {filtroDestacadas
                  ? "Intenta desactivar el filtro de destacadas para ver todas las opciones."
                  : "Estamos preparando nuevas opciones para ti. Próximamente más cabañas."}
              </p>
              {filtroDestacadas && (
                <button
                  className="btn btn-outline-light mt-3"
                  onClick={() => setFiltroDestacadas(false)}
                >
                  Ver todas las cabañas
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Resumen rápido de cabañas */}
            {cabanas.length > 1 && (
              <div className="row mb-4">
                <div className="col-12">
                  <div className="card bg-dark bg-opacity-25 border-secondary">
                    <div className="card-body py-2">
                      <div className="row text-center">
                        <div className="col-md-3">
                          <small className="text-white-50">Cabañas</small>
                          <div className="text-white fw-bold">
                            {cabanas.length}
                          </div>
                        </div>
                        <div className="col-md-3">
                          <small className="text-white-50">Destacadas</small>
                          <div className="text-warning fw-bold">
                            {contarCabanasDestacadas()}
                          </div>
                        </div>
                        <div className="col-md-3">
                          <small className="text-white-50">Precios desde</small>
                          <div className="text-success fw-bold">
                            ${precioMinimo}
                          </div>
                        </div>
                        <div className="col-md-3">
                          <small className="text-white-50">
                            Capacidad máxima
                          </small>
                          <div className="text-info fw-bold">
                            {capacidadMaxima} persona
                            {capacidadMaxima !== 1 ? "s" : ""}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Información adicional - Comentado para futuro uso */}
            {/* <div className="row mt-4">
              <div className="col-12">
                <div className="card bg-dark bg-opacity-25 border-light">
                  <div className="card-body text-center">
                    <small className="text-white-50">
                      💡 <strong>¿No encuentras lo que buscas?</strong> Todas
                      nuestras cabañas incluyen servicios básicos. Contáctanos
                      para consultas sobre disponibilidad especial o necesidades
                      específicas.
                    </small>
                  </div>
                </div>
              </div>
            </div> */}
          </>
        )}
      </div>
    </section>
  );
};

export default CabanasList;
