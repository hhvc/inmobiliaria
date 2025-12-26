import { useState, useEffect } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../../firebase/config";
import { useNavigate } from "react-router-dom";

const SmartSearch = () => {
  const navigate = useNavigate();
  const [cabanas, setCabanas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [dateErrors, setDateErrors] = useState({ checkIn: "", checkOut: "" });

  // Estado del formulario de búsqueda
  const [searchParams, setSearchParams] = useState({
    checkIn: "",
    checkOut: "",
    adultos: 2,
    menores: 0,
    menores3: 0,
    presupuestoMaximo: "",
  });

  // Cargar todas las cabañas disponibles
  useEffect(() => {
    const fetchCabanas = async () => {
      try {
        const q = query(
          collection(db, "cabanas"),
          where("disponible", "==", true)
        );
        const querySnapshot = await getDocs(q);
        const cabanasData = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setCabanas(cabanasData);
      } catch (error) {
        console.error("Error cargando cabañas:", error);
      }
    };

    fetchCabanas();
  }, []);

  // Validar fechas
  useEffect(() => {
    const errors = { checkIn: "", checkOut: "" };

    if (searchParams.checkIn) {
      const checkInDate = new Date(searchParams.checkIn);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 0);
      tomorrow.setHours(0, 0, 0, 0);

      if (checkInDate < tomorrow) {
        errors.checkIn = "La fecha de ingreso debe ser a partir de mañana.";
      }
    }

    if (searchParams.checkIn && searchParams.checkOut) {
      const checkInDate = new Date(searchParams.checkIn);
      const checkOutDate = new Date(searchParams.checkOut);

      if (checkOutDate <= checkInDate) {
        errors.checkOut =
          "La fecha de salida debe ser posterior a la de ingreso.";
      }
    }

    setDateErrors(errors);
  }, [searchParams.checkIn, searchParams.checkOut]);

  // Calcular noches
  const calcularNoches = () => {
    if (!searchParams.checkIn || !searchParams.checkOut) return 0;
    const checkIn = new Date(searchParams.checkIn);
    const checkOut = new Date(searchParams.checkOut);
    const diffTime = Math.abs(checkOut - checkIn);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  // Calcular precio estimado para una cabaña
  const calcularPrecioEstimado = (cabana) => {
    const noches = calcularNoches();
    if (noches === 0) return 0;

    const precioBase = cabana.precios?.base || 100;

    // Calcular adicionales por personas
    const adultosBase = 2;
    const adicionalAdultos =
      Math.max(0, searchParams.adultos - adultosBase) *
      (cabana.precios?.adicionalAdulto || 0);
    const adicionalMenores =
      searchParams.menores * (cabana.precios?.adicionalMenor || 0);
    const adicionalMenores3 =
      searchParams.menores3 * (cabana.precios?.adicionalMenor3 || 0);

    const adicionalPorNoche =
      adicionalAdultos + adicionalMenores + adicionalMenores3;
    const precioPorNoche = precioBase + adicionalPorNoche;

    return precioPorNoche * noches;
  };

  // Verificar si una cabaña está disponible para las fechas seleccionadas
  const verificarDisponibilidad = async (cabanaId) => {
    try {
      const q = query(
        collection(db, "reservations"),
        where("cabanaId", "==", cabanaId),
        where("status", "in", ["confirmed", "pending"])
      );

      const querySnapshot = await getDocs(q);
      const reservas = querySnapshot.docs.map((doc) => doc.data());

      if (!searchParams.checkIn || !searchParams.checkOut) return true;

      const checkIn = new Date(searchParams.checkIn);
      const checkOut = new Date(searchParams.checkOut);

      // Verificar superposición de fechas
      for (const reserva of reservas) {
        const reservaCheckIn =
          reserva.checkIn?.toDate?.() || new Date(reserva.checkIn);
        const reservaCheckOut =
          reserva.checkOut?.toDate?.() || new Date(reserva.checkOut);

        if (
          (checkIn >= reservaCheckIn && checkIn <= reservaCheckOut) ||
          (checkOut >= reservaCheckIn && checkOut <= reservaCheckOut) ||
          (checkIn <= reservaCheckIn && checkOut >= reservaCheckOut)
        ) {
          return false; // Hay superposición
        }
      }

      return true;
    } catch (error) {
      console.error("Error verificando disponibilidad:", error);
      return true; // En caso de error, asumimos disponible
    }
  };

  // Función principal de búsqueda
  const handleSearch = async () => {
    // Validar fechas antes de buscar
    if (dateErrors.checkIn || dateErrors.checkOut) {
      alert("Por favor corrige las fechas antes de buscar.");
      return;
    }

    if (!searchParams.checkIn || !searchParams.checkOut) {
      alert("Por favor selecciona las fechas de tu estadía");
      return;
    }

    setLoading(true);
    setShowResults(false);

    try {
      const totalPersonas =
        searchParams.adultos + searchParams.menores + searchParams.menores3;
      const presupuesto = searchParams.presupuestoMaximo
        ? parseInt(searchParams.presupuestoMaximo)
        : null;
      const noches = calcularNoches();

      // Filtrar cabañas por capacidad
      let cabanasFiltradas = cabanas.filter((cabana) => {
        if (cabana.capacidad && typeof cabana.capacidad === "object") {
          return cabana.capacidad.maxPersonas >= totalPersonas;
        }
        // Para formato antiguo
        const capacidadNum = parseInt(cabana.capacidad) || 0;
        return capacidadNum >= totalPersonas;
      });

      // Verificar disponibilidad y calcular precios
      const resultadosConPrecio = await Promise.all(
        cabanasFiltradas.map(async (cabana) => {
          const disponible = await verificarDisponibilidad(cabana.id);
          const precioEstimado = calcularPrecioEstimado(cabana);

          return {
            ...cabana,
            disponible,
            precioEstimado,
            noches,
            recomendacionScore: calcularScoreRecomendacion(
              cabana,
              precioEstimado,
              totalPersonas,
              presupuesto
            ),
          };
        })
      );

      // Filtrar por disponibilidad y presupuesto
      let resultadosFinales = resultadosConPrecio.filter(
        (cabana) =>
          cabana.disponible &&
          (!presupuesto || cabana.precioEstimado <= presupuesto)
      );

      // Ordenar por score de recomendación
      resultadosFinales.sort(
        (a, b) => b.recomendacionScore - a.recomendacionScore
      );

      setSearchResults(resultadosFinales);
      setShowResults(true);
    } catch (error) {
      console.error("Error en la búsqueda:", error);
      alert("Error al procesar la búsqueda. Intenta nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  // Calcular score de recomendación
  const calcularScoreRecomendacion = (
    cabana,
    precioEstimado,
    totalPersonas,
    presupuesto
  ) => {
    let score = 0;

    // Puntaje por relación capacidad-personas
    let capacidadMaxima;
    if (cabana.capacidad && typeof cabana.capacidad === "object") {
      capacidadMaxima = cabana.capacidad.maxPersonas;
    } else {
      capacidadMaxima = parseInt(cabana.capacidad) || 0;
    }

    const ratioCapacidad = capacidadMaxima / totalPersonas;
    if (ratioCapacidad >= 1.5) score += 30; // Mucho espacio
    else if (ratioCapacidad >= 1.2) score += 20; // Espacio adecuado
    else score += 10; // Justo

    // Puntaje por precio (más barato = mejor)
    if (presupuesto) {
      const ratioPrecio = 1 - precioEstimado / presupuesto;
      score += Math.max(0, ratioPrecio * 40);
    } else {
      // Sin presupuesto, preferir opciones económicas
      const precioBase = cabana.precios?.base || 100;
      if (precioBase <= 150) score += 30;
      else if (precioBase <= 200) score += 20;
      else score += 10;
    }

    // Puntaje por cabaña destacada
    if (cabana.destacada) score += 20;

    // Puntaje por amenities
    if (cabana.amenities) {
      if (cabana.amenities.includes("pileta")) score += 15;
      if (cabana.amenities.includes("parrilla")) score += 10;
      if (cabana.amenities.includes("wifi")) score += 5;
    }

    return score;
  };

  // Navegar a la reserva de una cabaña específica
  const handleReservar = (cabanaId) => {
    const params = new URLSearchParams({
      cabana: cabanaId,
      checkIn: searchParams.checkIn,
      checkOut: searchParams.checkOut,
      adultos: searchParams.adultos,
      menores: searchParams.menores,
      menores3: searchParams.menores3,
    });
    navigate(`/reservar?${params.toString()}`);
  };

  // Navegar a contacto con los detalles de la búsqueda
  const handleSolicitarPropuestaPersonalizada = () => {
    const mensaje = `Estoy buscando alojamiento para: 
- Fechas: ${searchParams.checkIn} a ${searchParams.checkOut}
- ${calcularNoches()} noches
- ${searchParams.adultos} adultos, ${
      searchParams.menores
    } menores (3-12 años), ${searchParams.menores3} menores (menores de 3 años)
- Presupuesto máximo: ${
      searchParams.presupuestoMaximo
        ? "$" + searchParams.presupuestoMaximo
        : "No especificado"
    }
- Observaciones (agregar):`;

    navigate("/contacto", {
      state: {
        prefillMessage: mensaje,
      },
    });
  };

  // Fecha mínima (mañana)
  const getMinDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split("T")[0];
  };

  return (
    <div className="smart-search-container">
      <div className="card shadow-lg">
        <div className="card-header bg-success text-white">
          <h4 className="mb-0">🔍 Presupuesto personalizado</h4>
          <p className="mb-0 mt-1 small opacity-75">
            Completa lo que buscas y te recomendaremos las mejores opciones
          </p>
        </div>

        <div className="card-body">
          {/* Formulario de Búsqueda */}
          <div className="row g-3">
            {/* Fechas */}
            <div className="col-md-6">
              <label className="form-label fw-bold">📅 Fecha de Ingreso</label>
              <input
                type="date"
                className={`form-control ${
                  dateErrors.checkIn ? "is-invalid" : ""
                }`}
                value={searchParams.checkIn}
                onChange={(e) =>
                  setSearchParams({ ...searchParams, checkIn: e.target.value })
                }
                min={getMinDate()}
              />
              {dateErrors.checkIn && (
                <div className="invalid-feedback">{dateErrors.checkIn}</div>
              )}
            </div>
            <div className="col-md-6">
              <label className="form-label fw-bold">📅 Fecha de Salida</label>
              <input
                type="date"
                className={`form-control ${
                  dateErrors.checkOut ? "is-invalid" : ""
                }`}
                value={searchParams.checkOut}
                onChange={(e) =>
                  setSearchParams({ ...searchParams, checkOut: e.target.value })
                }
                min={searchParams.checkIn || getMinDate()}
              />
              {dateErrors.checkOut && (
                <div className="invalid-feedback">{dateErrors.checkOut}</div>
              )}
            </div>

            {/* Personas */}
            <div className="col-md-4">
              <label className="form-label fw-bold">👨‍👩‍👧‍👦 Adultos</label>
              <select
                className="form-select"
                value={searchParams.adultos}
                onChange={(e) =>
                  setSearchParams({
                    ...searchParams,
                    adultos: parseInt(e.target.value),
                  })
                }
              >
                {[1, 2, 3, 4, 5, 6].map((num) => (
                  <option key={num} value={num}>
                    {num} adulto{num !== 1 ? "s" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-md-4">
              <label className="form-label fw-bold">
                🧒 Menores (3-12 años)
              </label>
              <select
                className="form-select"
                value={searchParams.menores}
                onChange={(e) =>
                  setSearchParams({
                    ...searchParams,
                    menores: parseInt(e.target.value),
                  })
                }
              >
                {[0, 1, 2, 3, 4].map((num) => (
                  <option key={num} value={num}>
                    {num} menor{num !== 1 ? "es" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-md-4">
              <label className="form-label fw-bold">
                👶 Menores {"<"} 3 años
              </label>
              <select
                className="form-select"
                value={searchParams.menores3}
                onChange={(e) =>
                  setSearchParams({
                    ...searchParams,
                    menores3: parseInt(e.target.value),
                  })
                }
              >
                {[0, 1, 2, 3].map((num) => (
                  <option key={num} value={num}>
                    {num} menor{num !== 1 ? "es" : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Presupuesto */}
            <div className="col-12">
              <label className="form-label fw-bold">
                💰 Presupuesto Máximo (opcional)
              </label>
              <div className="input-group">
                <span className="input-group-text">$</span>
                <input
                  type="number"
                  className="form-control"
                  placeholder="Ej: 50000 (dejar vacío para cualquier presupuesto)"
                  value={searchParams.presupuestoMaximo}
                  onChange={(e) =>
                    setSearchParams({
                      ...searchParams,
                      presupuestoMaximo: e.target.value,
                    })
                  }
                  min="0"
                />
              </div>
              <small className="form-text text-muted">
                Estamos para ayudarte a encontrar la mejor opción dentro de tu
                presupuesto
              </small>
            </div>
          </div>

          {/* Resumen de búsqueda */}
          {searchParams.checkIn &&
            searchParams.checkOut &&
            !dateErrors.checkIn &&
            !dateErrors.checkOut && (
              <div className="alert alert-info mt-3">
                <div className="row text-center">
                  <div className="col-md-3">
                    <strong>Noches:</strong>
                    <br />
                    <span className="h5">{calcularNoches()}</span>
                  </div>
                  <div className="col-md-3">
                    <strong>Total personas:</strong>
                    <br />
                    <span className="h5">
                      {searchParams.adultos +
                        searchParams.menores +
                        searchParams.menores3}
                    </span>
                  </div>
                  <div className="col-md-3">
                    <strong>Adultos:</strong>
                    <br />
                    <span className="h5">{searchParams.adultos}</span>
                  </div>
                  <div className="col-md-3">
                    <strong>Menores:</strong>
                    <br />
                    <span className="h5">
                      {searchParams.menores + searchParams.menores3}
                    </span>
                  </div>
                </div>
              </div>
            )}

          {/* Botón de búsqueda */}
          <div className="text-center mt-4">
            <button
              className="btn btn-success btn-lg px-5"
              onClick={handleSearch}
              disabled={
                loading ||
                !searchParams.checkIn ||
                !searchParams.checkOut ||
                !!dateErrors.checkIn ||
                !!dateErrors.checkOut
              }
            >
              {loading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" />
                  Buscando opciones...
                </>
              ) : (
                <>🎯 Ver opciones</>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Resultados */}
      {showResults && (
        <div className="results-container mt-4">
          <div className="card">
            <div className="card-header bg-success text-white">
              <h5 className="mb-0">
                💡 Encontramos
                <span className="badge bg-light text-success ms-2">
                  {searchResults.length} coincidencias automáticas
                </span>{" "}
                pero puedes pedir un presupuesto personalizado
              </h5>
            </div>

            <div className="card-body">
              {searchResults.length === 0 ? (
                <div className="text-center py-4">
                  <div className="alert alert-warning">
                    <h5>
                      😔 No hay coincidencias automáticas, pero déjanos tus
                      datos y te enviaremos una propuesta personalizada
                    </h5>
                    <p className="mb-3">Puedes intentar:</p>
                    <ul className="text-start">
                      <li>Ajustar las fechas de tu estadía</li>
                      <li>Modificar el número de personas</li>
                      <li>Aumentar tu presupuesto máximo</li>
                      <li>
                        Consultar disponibilidad directamente por teléfono
                      </li>
                    </ul>
                    <button
                      className="btn btn-outline-primary m-2"
                      onClick={() => setShowResults(false)}
                    >
                      Modificar búsqueda
                    </button>
                    <button
                      className="btn btn-outline-primary m-2"
                      onClick={handleSolicitarPropuestaPersonalizada}
                    >
                      → Solicitar propuesta personalizada
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Resumen de resultados */}
                  <div className="alert alert-success mb-4">
                    <div className="row text-center">
                      <div className="col-md-4">
                        <strong>Mejor opción:</strong>
                        <br />
                        <span className="h5">
                          ${Math.round(searchResults[0].precioEstimado)}
                        </span>
                      </div>
                      <div className="col-md-4">
                        <strong>Rango de precios:</strong>
                        <br />
                        <span className="h6">
                          $
                          {Math.round(
                            Math.min(
                              ...searchResults.map((r) => r.precioEstimado)
                            )
                          )}{" "}
                          - $
                          {Math.round(
                            Math.max(
                              ...searchResults.map((r) => r.precioEstimado)
                            )
                          )}
                        </span>
                      </div>
                      <div className="col-md-4">
                        <strong>Duración:</strong>
                        <br />
                        <span className="h6">{calcularNoches()} noches</span>
                      </div>
                    </div>
                  </div>

                  {/* Lista de resultados */}
                  <div className="row">
                    {searchResults.map((cabana, index) => (
                      <div key={cabana.id} className="col-lg-6 mb-4">
                        <div
                          className={`card h-100 ${
                            index === 0 ? "border-warning border-2" : ""
                          }`}
                        >
                          {index === 0 && (
                            <div className="card-header bg-warning text-dark text-center">
                              <strong>⭐ MEJOR OPCIÓN RECOMENDADA</strong>
                            </div>
                          )}
                          <div className="card-body">
                            <div className="d-flex justify-content-between align-items-start mb-2">
                              <h5 className="card-title">{cabana.nombre}</h5>
                              {cabana.destacada && (
                                <span className="badge bg-primary">
                                  Destacada
                                </span>
                              )}
                            </div>

                            <p className="card-text text-muted small">
                              {cabana.descripcionCorta ||
                                cabana.descripcion?.substring(0, 100)}
                              ...
                            </p>

                            <div className="mb-3">
                              <div className="row text-center small">
                                <div className="col-4">
                                  <strong>Capacidad</strong>
                                  <br />
                                  {cabana.capacidad &&
                                  typeof cabana.capacidad === "object"
                                    ? cabana.capacidad.maxPersonas
                                    : cabana.capacidad}{" "}
                                  personas
                                </div>
                                <div className="col-4">
                                  <strong>Dormitorios</strong>
                                  <br />
                                  {cabana.dormitorios}
                                </div>
                                <div className="col-4">
                                  <strong>Precio/noche</strong>
                                  <br />${cabana.precios?.base || 100}
                                </div>
                              </div>
                            </div>

                            <div className="bg-light p-3 rounded mb-3">
                              <div className="d-flex justify-content-between align-items-center">
                                <div>
                                  <strong>Precio estimado:</strong>
                                  <br />
                                  <span className="h5 text-success">
                                    ${Math.round(cabana.precioEstimado)}
                                  </span>
                                  <small className="text-muted d-block">
                                    {calcularNoches()} noches × $
                                    {Math.round(
                                      cabana.precioEstimado / calcularNoches()
                                    )}
                                    /noche
                                  </small>
                                </div>
                                {cabana.precioEstimado <=
                                  (searchParams.presupuestoMaximo || Infinity) *
                                    0.7 && (
                                  <span className="badge bg-success">
                                    Dentro de presupuesto
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="d-grid">
                              <button
                                className="btn btn-success"
                                onClick={() => handleReservar(cabana.id)}
                              >
                                🏠 Simular reserva
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="text-center mt-4">
                    <button
                      className="btn btn-outline-secondary m-2"
                      onClick={() => setShowResults(false)}
                    >
                      ← Realizar nueva búsqueda
                    </button>
                    <button
                      className="btn btn-outline-secondary m-2"
                      onClick={handleSolicitarPropuestaPersonalizada}
                    >
                      → Solicitar propuesta personalizada
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SmartSearch;
