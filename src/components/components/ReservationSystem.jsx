// components/ReservationSystem.jsx
import { useState, useEffect, useMemo } from "react";
import {
  collection,
  getDocs,
  query,
  where,
  addDoc,
  serverTimestamp,
  Timestamp,
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "../../firebase/config";
import { useAuth } from "../../context/auth/useAuth";
import { useSearchParams } from "react-router-dom";

// Función auxiliar para manejar fechas de Firestore
const getFirestoreDate = (firestoreTimestamp) => {
  if (!firestoreTimestamp) return null;
  if (typeof firestoreTimestamp.toDate === "function") {
    return firestoreTimestamp.toDate();
  }
  if (firestoreTimestamp.seconds !== undefined) {
    return new Date(firestoreTimestamp.seconds * 1000);
  }
  if (firestoreTimestamp instanceof Date) {
    return firestoreTimestamp;
  }
  if (typeof firestoreTimestamp === "string") {
    return new Date(firestoreTimestamp);
  }
  console.warn("Formato de fecha no reconocido:", firestoreTimestamp);
  return null;
};

// Función para determinar el precio por noche según la temporada
const getPrecioPorNoche = (fecha, preciosConfig) => {
  // ✅ CORRECCIÓN: Manejar caso cuando preciosConfig es undefined
  if (!preciosConfig || !preciosConfig.base) {
    return 100; // Precio por defecto
  }

  const precioBase = preciosConfig.base;
  let precioFinal = precioBase;
  let temporadaAplicada = "Base";

  // Verificar si hay temporadas configuradas
  if (preciosConfig.temporadas && preciosConfig.temporadas.length > 0) {
    for (const temporada of preciosConfig.temporadas) {
      // Temporada por fechas específicas
      if (temporada.fechaInicio && temporada.fechaFin) {
        const inicio = new Date(temporada.fechaInicio);
        const fin = new Date(temporada.fechaFin);

        if (fecha >= inicio && fecha <= fin) {
          precioFinal = precioBase * temporada.multiplicador;
          temporadaAplicada = temporada.nombre;
          break;
        }
      }

      // Temporada por días de la semana (ej: fines de semana)
      if (temporada.diasSemana && temporada.diasSemana.length > 0) {
        const diaSemana = fecha.getDay(); // 0 = domingo, 1 = lunes, ..., 6 = sábado
        if (temporada.diasSemana.includes(diaSemana)) {
          // Si ya aplicamos un multiplicador, usar el mayor
          const nuevoPrecio = precioBase * temporada.multiplicador;
          if (nuevoPrecio > precioFinal) {
            precioFinal = nuevoPrecio;
            temporadaAplicada = temporada.nombre;
          }
        }
      }
    }
  }

  return {
    precio: Math.round(precioFinal),
    temporada: temporadaAplicada,
    esTemporadaEspecial: temporadaAplicada !== "Base",
  };
};

// Función para calcular el desglose de precios
const calcularDesglosePrecios = (
  checkIn,
  checkOut,
  preciosConfig,
  adultos,
  menores,
  menores3
) => {
  if (!checkIn || !checkOut) return { total: 0, desglose: [], noches: 0 };

  const noches = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
  const desglose = [];
  let total = 0;

  // Calcular adicionales por personas (se aplica por noche)
  const adultosBase = 2; // 2 adultos incluidos en precio base
  const adicionalAdultos =
    Math.max(0, adultos - adultosBase) * (preciosConfig.adicionalAdulto || 0);
  const adicionalMenores = menores * (preciosConfig.adicionalMenor || 0);
  const adicionalMenores3 = menores3 * (preciosConfig.adicionalMenor3 || 0);
  const adicionalPersonasPorNoche =
    adicionalAdultos + adicionalMenores + adicionalMenores3;

  for (let i = 0; i < noches; i++) {
    const fecha = new Date(checkIn);
    fecha.setDate(fecha.getDate() + i);

    const precioNoche = getPrecioPorNoche(fecha, preciosConfig);
    const precioTotalNoche = precioNoche.precio + adicionalPersonasPorNoche;

    desglose.push({
      fecha: new Date(fecha),
      precioBase: precioNoche.precio,
      adicionalPersonas: adicionalPersonasPorNoche,
      precioTotal: precioTotalNoche,
      temporada: precioNoche.temporada,
      esTemporadaEspecial: precioNoche.esTemporadaEspecial,
      detalleAdicionales: {
        adultosExtra: Math.max(0, adultos - adultosBase),
        adicionalAdultos,
        adicionalMenores,
        adicionalMenores3,
      },
    });

    total += precioTotalNoche;
  }

  return {
    total,
    desglose,
    noches,
    adicionalPersonasPorNoche,
    detalleAdicionales: {
      adultosBase,
      adultosExtra: Math.max(0, adultos - adultosBase),
      adicionalAdultos,
      adicionalMenores,
      adicionalMenores3,
    },
  };
};

const ReservationSystem = ({ cabana: propCabana, onClose }) => {
  const [searchParams] = useSearchParams();
  const [selectedDates, setSelectedDates] = useState({
    checkIn: null,
    checkOut: null,
  });
  const [bookedDates, setBookedDates] = useState([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [reservationInfo, setReservationInfo] = useState({
    guestName: "",
    guestEmail: "",
    guestPhone: "",
    adultos: 2, // Valor por defecto (incluidos en precio base)
    menores: 0,
    menores3: 0,
    specialRequests: "",
  });
  const [desglosePrecios, setDesglosePrecios] = useState({
    total: 0,
    desglose: [],
    noches: 0,
  });
  const [mostrarDesglose, setMostrarDesglose] = useState(false);

  // ✅ NUEVO: Estados para manejar cabaña desde URL
  const [cabanaFromURL, setCabanaFromURL] = useState(null);
  const [loadingCabana, setLoadingCabana] = useState(false);
  const [cabanaError, setCabanaError] = useState("");

  const { user } = useAuth();

  // ✅ NUEVO: Obtener parámetros de la URL
  const cabanaIdFromURL = searchParams.get("cabana");
  const checkInFromURL = searchParams.get("checkIn");
  const checkOutFromURL = searchParams.get("checkOut");
  const adultosFromURL = searchParams.get("adultos");
  const menoresFromURL = searchParams.get("menores");
  const menores3FromURL = searchParams.get("menores3");

  // ✅ NUEVO: Cargar cabaña desde Firestore si viene de URL
  useEffect(() => {
    const loadCabanaFromURL = async () => {
      if (!cabanaIdFromURL || propCabana) return; // Si ya tenemos cabaña por props, no cargar

      setLoadingCabana(true);
      setCabanaError("");

      try {
        const cabanaDoc = await getDoc(doc(db, "cabanas", cabanaIdFromURL));
        if (cabanaDoc.exists()) {
          setCabanaFromURL({
            id: cabanaDoc.id,
            ...cabanaDoc.data(),
          });
        } else {
          setCabanaError("No se encontró la cabaña solicitada.");
        }
      } catch (error) {
        console.error("Error cargando cabaña desde URL:", error);
        setCabanaError("Error al cargar la información de la cabaña.");
      } finally {
        setLoadingCabana(false);
      }
    };

    loadCabanaFromURL();
  }, [cabanaIdFromURL, propCabana]);

  // ✅ NUEVO: Pre-seleccionar fechas y personas si vienen de URL
  useEffect(() => {
    if (checkInFromURL) {
      const checkInDate = new Date(checkInFromURL);
      setSelectedDates((prev) => ({ ...prev, checkIn: checkInDate }));
    }

    if (checkOutFromURL) {
      const checkOutDate = new Date(checkOutFromURL);
      setSelectedDates((prev) => ({ ...prev, checkOut: checkOutDate }));
    }

    if (adultosFromURL) {
      setReservationInfo((prev) => ({
        ...prev,
        adultos: parseInt(adultosFromURL) || 2,
      }));
    }

    if (menoresFromURL) {
      setReservationInfo((prev) => ({
        ...prev,
        menores: parseInt(menoresFromURL) || 0,
      }));
    }

    if (menores3FromURL) {
      setReservationInfo((prev) => ({
        ...prev,
        menores3: parseInt(menores3FromURL) || 0,
      }));
    }
  }, [
    checkInFromURL,
    checkOutFromURL,
    adultosFromURL,
    menoresFromURL,
    menores3FromURL,
  ]);

  // ✅ Usar cabaña de props o de URL
  const cabana = propCabana || cabanaFromURL;

  // ✅ CORRECCIÓN CRÍTICA: Usar useMemo para preciosConfig con manejo seguro
  const preciosConfig = useMemo(() => {
    // Si cabana no existe o no tiene precios, usar valores por defecto
    if (!cabana || !cabana.precios) {
      return {
        base: 100,
        adicionalAdulto: 0,
        adicionalMenor: 0,
        adicionalMenor3: 0,
        temporadas: [],
      };
    }
    return cabana.precios;
  }, [cabana]); // Dependencia de cabana completa

  // ✅ Manejo seguro de capacidades (compatibilidad con formato antiguo y nuevo)
  const capacidades = useMemo(() => {
    if (!cabana) return { maxAdultos: 4, maxMenores: 2, maxPersonas: 6 };

    if (cabana.capacidad && typeof cabana.capacidad === "object") {
      // Nuevo formato
      return cabana.capacidad;
    } else {
      // Formato antiguo - crear valores por defecto
      return { maxAdultos: 4, maxMenores: 2, maxPersonas: 6 };
    }
  }, [cabana]);

  // Cargar fechas reservadas para esta cabaña
  useEffect(() => {
    if (!cabana?.id) return; // ✅ Prevenir ejecución si no hay cabana.id

    const fetchBookedDates = async () => {
      try {
        const q = query(
          collection(db, "reservations"),
          where("cabanaId", "==", cabana.id),
          where("status", "in", ["confirmed", "pending"])
        );

        const querySnapshot = await getDocs(q);
        const reservations = querySnapshot.docs.map((doc) => doc.data());

        const allBookedDates = [];
        reservations.forEach((reservation) => {
          const checkIn = getFirestoreDate(reservation.checkIn);
          const checkOut = getFirestoreDate(reservation.checkOut);

          if (checkIn && checkOut) {
            // Generar array con todas las fechas entre checkIn y checkOut
            const currentDate = new Date(checkIn);
            while (currentDate <= checkOut) {
              allBookedDates.push(new Date(currentDate));
              currentDate.setDate(currentDate.getDate() + 1);
            }
          }
        });

        setBookedDates(allBookedDates);
      } catch (error) {
        console.error("Error cargando reservas:", error);
      }
    };

    fetchBookedDates();
  }, [cabana?.id]); // ✅ Dependencia segura

  // ✅ CORRECCIÓN: Actualizar desglose de precios cuando cambian las fechas o personas
  useEffect(() => {
    if (selectedDates.checkIn && selectedDates.checkOut) {
      const resultado = calcularDesglosePrecios(
        selectedDates.checkIn,
        selectedDates.checkOut,
        preciosConfig,
        reservationInfo.adultos,
        reservationInfo.menores,
        reservationInfo.menores3
      );
      setDesglosePrecios(resultado);
    } else {
      setDesglosePrecios({ total: 0, desglose: [], noches: 0 });
    }
  }, [
    selectedDates,
    preciosConfig,
    reservationInfo.adultos,
    reservationInfo.menores,
    reservationInfo.menores3,
  ]);

  const isDateBooked = (date) => {
    return bookedDates.some(
      (bookedDate) => bookedDate.toDateString() === date.toDateString()
    );
  };

  const isDateSelected = (date) => {
    if (!selectedDates.checkIn) return false;
    if (selectedDates.checkIn.toDateString() === date.toDateString())
      return true;
    if (
      selectedDates.checkOut &&
      selectedDates.checkOut.toDateString() === date.toDateString()
    )
      return true;
    if (
      selectedDates.checkIn &&
      selectedDates.checkOut &&
      date >= selectedDates.checkIn &&
      date <= selectedDates.checkOut
    ) {
      return true;
    }
    return false;
  };

  const getPrecioParaFecha = (date) => {
    const precioInfo = getPrecioPorNoche(date, preciosConfig);
    return precioInfo.precio;
  };

  const handleDateClick = (date) => {
    // No permitir seleccionar fechas reservadas
    if (isDateBooked(date)) return;

    // Si no hay check-in seleccionado, o si ya hay check-in y check-out, empezar nueva selección
    if (
      !selectedDates.checkIn ||
      (selectedDates.checkIn && selectedDates.checkOut)
    ) {
      setSelectedDates({ checkIn: date, checkOut: null });
    }
    // Si hay check-in pero no check-out, y la fecha es después del check-in
    else if (
      selectedDates.checkIn &&
      !selectedDates.checkOut &&
      date > selectedDates.checkIn
    ) {
      setSelectedDates({ ...selectedDates, checkOut: date });
    }
    // Si se hace click en una fecha anterior al check-in, resetear
    else if (date < selectedDates.checkIn) {
      setSelectedDates({ checkIn: date, checkOut: null });
    }
  };

  // Función para manejar cambios en el número de personas con validación
  const handlePersonasChange = (tipo, valor) => {
    const nuevoValor = parseInt(valor) || 0;
    const nuevosAdultos =
      tipo === "adultos" ? nuevoValor : reservationInfo.adultos;
    const nuevosMenores =
      tipo === "menores" ? nuevoValor : reservationInfo.menores;
    const nuevosMenores3 =
      tipo === "menores3" ? nuevoValor : reservationInfo.menores3;

    const totalPersonas = nuevosAdultos + nuevosMenores + nuevosMenores3;
    const totalMenores = nuevosMenores + nuevosMenores3;

    // Validar límites
    if (totalPersonas > capacidades.maxPersonas) {
      alert(
        `Máximo ${capacidades.maxPersonas} personas permitidas. Actual: ${totalPersonas}`
      );
      return;
    }

    if (nuevosAdultos > capacidades.maxAdultos) {
      alert(`Máximo ${capacidades.maxAdultos} adultos permitidos`);
      return;
    }

    if (totalMenores > capacidades.maxMenores) {
      alert(`Máximo ${capacidades.maxMenores} menores permitidos`);
      return;
    }

    setReservationInfo((prev) => ({
      ...prev,
      [tipo]: nuevoValor,
    }));
  };

  const handleReservation = async () => {
    if (!cabana?.id) {
      // ✅ Verificar que cabana existe
      alert("Error: Información de cabaña no disponible");
      return;
    }

    if (!selectedDates.checkIn || !selectedDates.checkOut) {
      alert("Por favor selecciona las fechas de tu estadía");
      return;
    }

    if (!reservationInfo.guestName || !reservationInfo.guestEmail) {
      alert("Por favor completa tus datos de contacto");
      return;
    }

    // Validación final de personas
    const totalPersonas =
      reservationInfo.adultos +
      reservationInfo.menores +
      reservationInfo.menores3;
    if (totalPersonas > capacidades.maxPersonas) {
      alert(
        `Máximo ${capacidades.maxPersonas} personas permitidas. Actual: ${totalPersonas}`
      );
      return;
    }

    setLoading(true);
    try {
      const reservationData = {
        cabanaId: cabana.id,
        cabanaName: cabana.nombre,
        checkIn: Timestamp.fromDate(selectedDates.checkIn),
        checkOut: Timestamp.fromDate(selectedDates.checkOut),
        nights: desglosePrecios.noches,
        total: desglosePrecios.total,
        precioBase: preciosConfig.base,
        // ✅ NUEVOS CAMPOS: Información de personas
        adultos: reservationInfo.adultos,
        menores: reservationInfo.menores,
        menores3: reservationInfo.menores3,
        totalPersonas:
          reservationInfo.adultos +
          reservationInfo.menores +
          reservationInfo.menores3,
        adicionalesPersonas:
          desglosePrecios.adicionalPersonasPorNoche * desglosePrecios.noches,
        desglosePrecios: desglosePrecios.desglose.map((item) => ({
          fecha: Timestamp.fromDate(item.fecha),
          precioBase: item.precioBase,
          adicionalPersonas: item.adicionalPersonas,
          precioTotal: item.precioTotal,
          temporada: item.temporada,
        })),
        status: "pending",
        guestName: reservationInfo.guestName,
        guestEmail: reservationInfo.guestEmail,
        guestPhone: reservationInfo.guestPhone,
        specialRequests: reservationInfo.specialRequests,
        createdAt: serverTimestamp(),
        userId: user?.uid || null,
        userEmail: user?.email || null,
      };

      await addDoc(collection(db, "reservations"), reservationData);

      alert(
        "¡Reserva enviada correctamente! Te contactaremos pronto para confirmar."
      );

      // ✅ NUEVO: Manejar cierre diferente según de dónde venga
      if (onClose) {
        onClose(); // Desde admin
      } else {
        // Desde URL, redirigir a home o mostrar mensaje de éxito
        window.location.href = "/";
      }
    } catch (error) {
      console.error("Error creando reserva:", error);
      alert("Error al procesar la reserva. Por favor intenta nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  const renderCalendar = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDay = firstDay.getDay();

    const weeks = [];
    let day = 1;

    for (let i = 0; i < 6; i++) {
      const days = [];
      for (let j = 0; j < 7; j++) {
        if ((i === 0 && j < startDay) || day > daysInMonth) {
          days.push(<td key={j} className="text-muted bg-light p-2"></td>);
        } else {
          const currentDate = new Date(year, month, day);
          const isBooked = isDateBooked(currentDate);
          const isSelected = isDateSelected(currentDate);
          const isToday =
            currentDate.toDateString() === new Date().toDateString();
          const precio = getPrecioParaFecha(currentDate);
          const precioBase = preciosConfig.base || 100;
          const esPrecioEspecial = precio !== precioBase;

          let className = "calendar-day p-2 text-center ";
          if (isBooked) {
            className += "bg-danger text-white";
          } else if (isSelected) {
            className += "bg-primary text-white";
          } else if (isToday) {
            className += "bg-warning";
          } else if (currentDate < new Date().setHours(0, 0, 0, 0)) {
            className += "text-muted bg-light";
          } else if (esPrecioEspecial) {
            className += "bg-info text-white";
          } else {
            className += "bg-white";
          }

          days.push(
            <td
              key={j}
              className={className}
              style={{
                cursor: isBooked ? "not-allowed" : "pointer",
                height: "60px",
                position: "relative",
              }}
              onClick={() => !isBooked && handleDateClick(currentDate)}
              title={isBooked ? "Ocupado" : `$${precio} por noche`}
            >
              <div>{day}</div>
              {!isBooked && (
                <small className="position-absolute bottom-0 start-0 end-0 bg-dark bg-opacity-50 text-white">
                  ${precio}
                </small>
              )}
            </td>
          );
          day++;
        }
      }
      weeks.push(<tr key={i}>{days}</tr>);
      if (day > daysInMonth) break;
    }

    return weeks;
  };

  const navigateMonth = (direction) => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(newDate.getMonth() + direction);
    setCurrentMonth(newDate);
  };

  // ✅ CORRECCIÓN MEJORADA: Manejar estados de carga y error
  if (loadingCabana) {
    return (
      <div className="container mt-4 text-center">
        <div className="spinner-border" role="status">
          <span className="visually-hidden">Cargando...</span>
        </div>
        <p className="mt-2">Cargando información de la cabaña...</p>
      </div>
    );
  }

  if (cabanaError) {
    return (
      <div className="alert alert-danger text-center">
        <h4>❌ Error</h4>
        <p>{cabanaError}</p>
        <button
          className="btn btn-secondary"
          onClick={onClose || (() => window.history.back())}
        >
          Volver
        </button>
      </div>
    );
  }

  if (!cabana) {
    return (
      <div className="alert alert-danger text-center">
        <h4>❌ Error</h4>
        <p>No se pudo cargar la información de la cabaña.</p>
        <button
          className="btn btn-secondary"
          onClick={onClose || (() => window.history.back())}
        >
          Volver
        </button>
      </div>
    );
  }

  return (
    <div className="reservation-system">
      {/* ✅ NUEVO: Indicador de origen */}
      {!propCabana && (
        <div className="alert alert-info mb-4">
          <h6>📅 Reserva desde Búsqueda</h6>
          <p className="mb-0">
            Estás realizando una reserva para <strong>{cabana.nombre}</strong>.
            Las fechas y personas han sido pre-seleccionadas según tu búsqueda.
          </p>
        </div>
      )}

      <div className="row">
        <div className="col-md-6">
          <div className="card">
            <div className="card-header">
              <h5 className="mb-0">📅 Selecciona tus fechas</h5>
            </div>
            <div className="card-body">
              {/* Controles del calendario */}
              <div className="d-flex justify-content-between align-items-center mb-3">
                <button
                  className="btn btn-outline-primary btn-sm"
                  onClick={() => navigateMonth(-1)}
                >
                  ‹
                </button>
                <h6 className="mb-0">
                  {currentMonth
                    .toLocaleDateString("es-ES", {
                      month: "long",
                      year: "numeric",
                    })
                    .toUpperCase()}
                </h6>
                <button
                  className="btn btn-outline-primary btn-sm"
                  onClick={() => navigateMonth(1)}
                >
                  ›
                </button>
              </div>

              {/* Calendario */}
              <div className="table-responsive">
                <table className="table table-bordered mb-0">
                  <thead>
                    <tr>
                      {["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"].map(
                        (day) => (
                          <th key={day} className="text-center small">
                            {day}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody>{renderCalendar()}</tbody>
                </table>
              </div>

              {/* Leyenda mejorada */}
              <div className="mt-3 small">
                <div className="d-flex flex-wrap gap-2">
                  <span>
                    <span className="badge bg-primary">■</span> Seleccionado
                  </span>
                  <span>
                    <span className="badge bg-danger">■</span> Ocupado
                  </span>
                  <span>
                    <span className="badge bg-warning">■</span> Hoy
                  </span>
                  <span>
                    <span className="badge bg-info">■</span> Precio especial
                  </span>
                </div>
                <div className="mt-2 text-muted">
                  <small>
                    Precio base: ${preciosConfig.base || 100} por noche
                  </small>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-6">
          <div className="card">
            <div className="card-header">
              <h5 className="mb-0">📝 Detalles de la Reserva</h5>
            </div>
            <div className="card-body">
              {/* Información de la cabaña */}
              <div className="mb-3">
                <h6>{cabana.nombre}</h6>
                <p className="small text-muted mb-2">
                  Capacidad: {capacidades.maxPersonas} personas máximo •{" "}
                  {cabana.dormitorios} dormitorios
                </p>
                <div className="bg-light p-2 rounded">
                  <small>
                    <strong>Precio base:</strong> ${preciosConfig.base || 100}{" "}
                    por noche (incluye 2 adultos)
                    {preciosConfig.temporadas &&
                      preciosConfig.temporadas.length > 0 && (
                        <span className="text-info">
                          {" "}
                          • Precios variables aplicados
                        </span>
                      )}
                  </small>
                </div>
              </div>

              {/* Fechas seleccionadas */}
              {selectedDates.checkIn && (
                <div className="alert alert-info py-2">
                  <strong>Check-in:</strong>{" "}
                  {selectedDates.checkIn.toLocaleDateString()}
                  {selectedDates.checkOut && (
                    <>
                      <br />
                      <strong>Check-out:</strong>{" "}
                      {selectedDates.checkOut.toLocaleDateString()}
                      <br />
                      <strong>Noches:</strong> {desglosePrecios.noches}
                    </>
                  )}
                </div>
              )}

              {/* Desglose de precios */}
              {desglosePrecios.noches > 0 && (
                <div className="mb-3">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <h6 className="mb-0">💰 Desglose de Precios</h6>
                    <button
                      className="btn btn-sm btn-outline-secondary"
                      onClick={() => setMostrarDesglose(!mostrarDesglose)}
                    >
                      {mostrarDesglose ? "Ocultar" : "Ver detalle"}
                    </button>
                  </div>

                  {mostrarDesglose && (
                    <div className="bg-light p-2 rounded small">
                      {/* Mostrar resumen de adicionales por personas */}
                      {desglosePrecios.detalleAdicionales && (
                        <div className="mb-2 p-2 bg-white rounded">
                          <strong>Adicionales por personas (por noche):</strong>
                          <div className="d-flex justify-content-between">
                            <span>
                              {desglosePrecios.detalleAdicionales.adultosExtra}{" "}
                              adultos extra
                            </span>
                            <span>
                              +$
                              {
                                desglosePrecios.detalleAdicionales
                                  .adicionalAdultos
                              }
                            </span>
                          </div>
                          <div className="d-flex justify-content-between">
                            <span>
                              {reservationInfo.menores} menores (3-12)
                            </span>
                            <span>
                              +$
                              {
                                desglosePrecios.detalleAdicionales
                                  .adicionalMenores
                              }
                            </span>
                          </div>
                          <div className="d-flex justify-content-between">
                            <span>
                              {reservationInfo.menores3} menores {"<"} 3 años
                            </span>
                            <span>
                              +$
                              {
                                desglosePrecios.detalleAdicionales
                                  .adicionalMenores3
                              }
                            </span>
                          </div>
                          <div className="d-flex justify-content-between border-top pt-1">
                            <strong>Total adicional por noche:</strong>
                            <strong>
                              +${desglosePrecios.adicionalPersonasPorNoche}
                            </strong>
                          </div>
                        </div>
                      )}

                      {desglosePrecios.desglose.map((noche, index) => (
                        <div
                          key={index}
                          className="d-flex justify-content-between py-1 border-bottom"
                        >
                          <div>
                            <div>{noche.fecha.toLocaleDateString()}</div>
                            <small className="text-muted">
                              ${noche.precioBase} base
                              {noche.esTemporadaEspecial && (
                                <span className="badge bg-info ms-1">
                                  {noche.temporada}
                                </span>
                              )}
                            </small>
                          </div>
                          <div className="text-end">
                            <div>${noche.precioTotal}</div>
                            <small className="text-muted">
                              +${noche.adicionalPersonas} personas
                            </small>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-2 p-3 bg-success bg-opacity-10 rounded">
                    <div className="d-flex justify-content-between fw-bold">
                      <span>Total ({desglosePrecios.noches} noches):</span>
                      <span>${desglosePrecios.total}</span>
                    </div>
                    <small className="text-muted">
                      Incluye: {reservationInfo.adultos} adultos,{" "}
                      {reservationInfo.menores} menores,{" "}
                      {reservationInfo.menores3} menores 3
                      {preciosConfig.temporadas &&
                        preciosConfig.temporadas.length > 0 && (
                          <span> + tarifas de temporada aplicadas</span>
                        )}
                    </small>
                  </div>
                </div>
              )}

              {/* Formulario de reserva */}
              <div className="mb-3">
                <label className="form-label">Nombre completo *</label>
                <input
                  type="text"
                  className="form-control"
                  value={reservationInfo.guestName}
                  onChange={(e) =>
                    setReservationInfo({
                      ...reservationInfo,
                      guestName: e.target.value,
                    })
                  }
                  required
                />
              </div>

              <div className="row">
                <div className="col-md-6">
                  <label className="form-label">Email *</label>
                  <input
                    type="email"
                    className="form-control"
                    value={reservationInfo.guestEmail}
                    onChange={(e) =>
                      setReservationInfo({
                        ...reservationInfo,
                        guestEmail: e.target.value,
                      })
                    }
                    required
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Teléfono</label>
                  <input
                    type="tel"
                    className="form-control"
                    value={reservationInfo.guestPhone}
                    onChange={(e) =>
                      setReservationInfo({
                        ...reservationInfo,
                        guestPhone: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              {/* ✅ NUEVO: Campos separados para adultos, menores y menores de 3 años */}
              <div className="row mt-2">
                <div className="col-md-4">
                  <label className="form-label">Adultos *</label>
                  <select
                    className="form-select"
                    value={reservationInfo.adultos}
                    onChange={(e) =>
                      handlePersonasChange("adultos", e.target.value)
                    }
                  >
                    {[...Array(capacidades.maxAdultos || 6)].map((_, i) => (
                      <option key={i + 1} value={i + 1}>
                        {i + 1} adulto{i !== 0 ? "s" : ""}
                      </option>
                    ))}
                  </select>
                  <small className="text-muted">
                    Máx: {capacidades.maxAdultos || 4} adultos
                  </small>
                </div>

                <div className="col-md-4">
                  <label className="form-label">Menores (3-12 años)</label>
                  <select
                    className="form-select"
                    value={reservationInfo.menores}
                    onChange={(e) =>
                      handlePersonasChange("menores", e.target.value)
                    }
                  >
                    {[...Array((capacidades.maxMenores || 2) + 1)].map(
                      (_, i) => (
                        <option key={i} value={i}>
                          {i} menor{i !== 1 ? "es" : ""}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div className="col-md-4">
                  <label className="form-label">Menores {"<"} 3 años</label>
                  <select
                    className="form-select"
                    value={reservationInfo.menores3}
                    onChange={(e) =>
                      handlePersonasChange("menores3", e.target.value)
                    }
                  >
                    {[...Array((capacidades.maxMenores || 2) + 1)].map(
                      (_, i) => (
                        <option key={i} value={i}>
                          {i} menor{i !== 1 ? "es" : ""}
                        </option>
                      )
                    )}
                  </select>
                </div>
              </div>

              <div className="mt-2">
                <small className="text-muted">
                  Total:{" "}
                  <strong>
                    {reservationInfo.adultos +
                      reservationInfo.menores +
                      reservationInfo.menores3}
                  </strong>{" "}
                  personas ({reservationInfo.adultos} adultos,{" "}
                  {reservationInfo.menores} menores, {reservationInfo.menores3}{" "}
                  menores 3) | Máximo permitido: {capacidades.maxPersonas || 6}
                </small>
              </div>

              <div className="mt-3">
                <label className="form-label">Solicitudes especiales</label>
                <textarea
                  className="form-control"
                  rows="3"
                  placeholder="Comentarios adicionales..."
                  value={reservationInfo.specialRequests}
                  onChange={(e) =>
                    setReservationInfo({
                      ...reservationInfo,
                      specialRequests: e.target.value,
                    })
                  }
                />
              </div>

              <button
                className="btn btn-success w-100 mt-3"
                onClick={handleReservation}
                disabled={
                  loading || !selectedDates.checkIn || !selectedDates.checkOut
                }
              >
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" />
                    Procesando...
                  </>
                ) : (
                  `📅 Solicitar condiciones de reserva - $${desglosePrecios.total}`
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReservationSystem;
