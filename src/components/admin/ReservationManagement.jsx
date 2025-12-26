// components/admin/ReservationManagement.jsx
import { useState, useEffect, useCallback } from "react";
import {
  collection,
  getDocs,
  updateDoc,
  doc,
  query,
  where,
  orderBy,
  deleteDoc,
} from "firebase/firestore";
import { db } from "../../firebase/config";
import ReservationSystem from "../components/ReservationSystem";
import { useAuth } from "../../context/auth/useAuth";
import CabanaSelector from "./reservation-components/CabanaSelector";
import ReservationFilters from "./reservation-components/ReservationFilters";
import ReservationStats from "./reservation-components/ReservationStats";
import ReservationList from "./reservation-components/ReservationList";

const ReservationManagement = () => {
  const [cabanas, setCabanas] = useState([]);
  const [selectedCabana, setSelectedCabana] = useState("all"); // "all" para todas las cabañas
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("gestionar");
  const [reservations, setReservations] = useState([]);
  const [loadingReservations, setLoadingReservations] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const { hasRole } = useAuth();

  // Cargar todas las cabañas
  useEffect(() => {
    const fetchCabanas = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "cabanas"));
        const cabanasData = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        setCabanas(cabanasData);
        // No seleccionamos cabaña por defecto, usamos "all"
      } catch (error) {
        console.error("Error cargando cabañas:", error);
        setError("No se pudieron cargar las cabañas");
      } finally {
        setLoading(false);
      }
    };

    fetchCabanas();
  }, []);

  // Mover fetchReservations a useCallback para memoizarla
  const fetchReservations = useCallback(async () => {
    setLoadingReservations(true);
    try {
      let q;

      if (selectedCabana === "all") {
        // Consulta para TODAS las cabañas
        if (filterStatus === "all") {
          q = query(
            collection(db, "reservations"),
            orderBy("createdAt", "desc")
          );
        } else {
          q = query(
            collection(db, "reservations"),
            where("status", "==", filterStatus),
            orderBy("createdAt", "desc")
          );
        }
      } else {
        // Consulta para una cabaña específica
        if (filterStatus === "all") {
          q = query(
            collection(db, "reservations"),
            where("cabanaId", "==", selectedCabana),
            orderBy("createdAt", "desc")
          );
        } else {
          q = query(
            collection(db, "reservations"),
            where("cabanaId", "==", selectedCabana),
            where("status", "==", filterStatus),
            orderBy("createdAt", "desc")
          );
        }
      }

      const querySnapshot = await getDocs(q);
      const reservationsData = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        checkIn: doc.data().checkIn?.toDate?.() || new Date(doc.data().checkIn),
        checkOut:
          doc.data().checkOut?.toDate?.() || new Date(doc.data().checkOut),
        createdAt:
          doc.data().createdAt?.toDate?.() || new Date(doc.data().createdAt),
      }));

      // Enriquecer las reservas con información de la cabaña
      const enrichedReservations = reservationsData.map((reservation) => {
        const cabana = cabanas.find((c) => c.id === reservation.cabanaId);
        return {
          ...reservation,
          cabanaNombre: cabana?.nombre || "Cabaña no encontrada",
          cabanaInfo: cabana,
        };
      });

      setReservations(enrichedReservations);
    } catch (error) {
      console.error("Error cargando reservas:", error);
      setError("Error al cargar las reservas");
    } finally {
      setLoadingReservations(false);
    }
  }, [selectedCabana, filterStatus, cabanas]); // Dependencias de fetchReservations

  // Cargar reservas cuando cambia la cabaña seleccionada o el filtro
  useEffect(() => {
    if (activeTab === "gestionar") {
      fetchReservations();
    }
  }, [selectedCabana, activeTab, filterStatus, fetchReservations]);

  const handleUpdateStatus = async (reservationId, newStatus) => {
    try {
      const reservationRef = doc(db, "reservations", reservationId);
      await updateDoc(reservationRef, {
        status: newStatus,
        updatedAt: new Date(),
      });

      setReservations((prev) =>
        prev.map((reservation) =>
          reservation.id === reservationId
            ? { ...reservation, status: newStatus }
            : reservation
        )
      );

      alert(`Reserva ${getStatusText(newStatus)} correctamente`);
    } catch (error) {
      console.error("Error actualizando reserva:", error);
      alert("Error al actualizar la reserva");
    }
  };

  const handleDeleteReservation = async (reservationId) => {
    if (
      !confirm(
        "¿Estás seguro de que quieres eliminar esta reserva? Esta acción no se puede deshacer."
      )
    ) {
      return;
    }

    try {
      await deleteDoc(doc(db, "reservations", reservationId));
      setReservations((prev) =>
        prev.filter((reservation) => reservation.id !== reservationId)
      );
      alert("Reserva eliminada correctamente");
    } catch (error) {
      console.error("Error eliminando reserva:", error);
      alert("Error al eliminar la reserva");
    }
  };

  const getStatusText = (status) => {
    const texts = {
      pending: "marcada como pendiente",
      confirmed: "confirmada",
      cancelled: "cancelada",
    };
    return texts[status] || status;
  };

  const handleClose = () => {
    alert(
      "Reserva procesada correctamente. Puedes continuar gestionando reservas."
    );
    // Recargar las reservas después de crear una nueva
    if (activeTab === "gestionar") {
      fetchReservations();
    }
  };

  const handleCabanaChange = (cabanaId) => {
    setSelectedCabana(cabanaId);
  };

  // Obtener la cabaña seleccionada para mostrar en el formulario de creación
  const getSelectedCabanaForCreation = () => {
    if (selectedCabana === "all") {
      return cabanas[0]; // Para crear reserva, necesitamos una cabaña específica
    }
    return cabanas.find((c) => c.id === selectedCabana);
  };

  if (!hasRole("admin")) {
    return (
      <div className="container mt-4">
        <div className="alert alert-danger text-center">
          <h4>🚫 Acceso Denegado</h4>
          <p>No tienes permisos para acceder a esta sección.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container mt-4 text-center">
        <div className="spinner-border" role="status">
          <span className="visually-hidden">Cargando...</span>
        </div>
        <p className="mt-2">Cargando sistema de reservas...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mt-4">
        <div className="alert alert-danger text-center">
          <h4>❌ Error</h4>
          <p>{error}</p>
          <button
            className="btn btn-primary mt-2"
            onClick={() => window.location.reload()}
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  if (cabanas.length === 0) {
    return (
      <div className="container mt-4">
        <div className="alert alert-warning text-center">
          <h4>📝 No hay cabañas configuradas</h4>
          <p>
            Primero debes crear cabañas en el sistema para gestionar reservas.
          </p>
          <a href="/admin/cabanas" className="btn btn-primary">
            🏠 Gestionar Cabañas
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="container mt-4">
      <div className="row">
        <div className="col-12">
          <div className="d-flex justify-content-between align-items-center mb-4">
            <div>
              <h1>📅 Sistema de Reservas - Administración</h1>
              <p className="text-muted mb-0">
                Gestiona reservas para{" "}
                {selectedCabana === "all"
                  ? "todas las cabañas"
                  : "una cabaña específica"}
              </p>
            </div>
            <div className="text-end">
              <small className="text-muted d-block">
                Cabañas disponibles: <strong>{cabanas.length}</strong>
              </small>
              <small className="text-muted">
                {selectedCabana === "all"
                  ? "Viendo reservas de todas las cabañas"
                  : "Selecciona una cabaña para gestionar sus reservas"}
              </small>
            </div>
          </div>

          {/* Selector de Cabaña usando el componente modular */}
          <CabanaSelector
            cabanas={cabanas}
            selectedCabana={selectedCabana}
            onCabanaChange={handleCabanaChange}
            showAllOption={true}
          />

          {/* Pestañas de Navegación */}
          <div className="card mb-4">
            <div className="card-header bg-light">
              <ul className="nav nav-tabs card-header-tabs">
                <li className="nav-item">
                  <button
                    className={`nav-link ${
                      activeTab === "gestionar" ? "active" : ""
                    }`}
                    onClick={() => setActiveTab("gestionar")}
                  >
                    📋 Gestionar Reservas Existentes
                  </button>
                </li>
                <li className="nav-item">
                  <button
                    className={`nav-link ${
                      activeTab === "crear" ? "active" : ""
                    }`}
                    onClick={() => setActiveTab("crear")}
                  >
                    ➕ Crear Nueva Reserva
                  </button>
                </li>
              </ul>
            </div>

            <div className="card-body">
              {/* Pestaña: Gestionar Reservas */}
              {activeTab === "gestionar" && (
                <div>
                  {/* Filtros y Estadísticas usando componentes modulares */}
                  <div className="row mb-4">
                    <div className="col-md-6">
                      <ReservationFilters
                        filterStatus={filterStatus}
                        onFilterChange={setFilterStatus}
                      />
                    </div>
                    <div className="col-md-6">
                      <ReservationStats reservations={reservations} />
                    </div>
                  </div>

                  {/* Lista de Reservas usando el componente modular */}
                  <ReservationList
                    reservations={reservations}
                    loadingReservations={loadingReservations}
                    filterStatus={filterStatus}
                    onUpdateStatus={handleUpdateStatus}
                    onDeleteReservation={handleDeleteReservation}
                    showCabanaColumn={selectedCabana === "all"}
                  />
                </div>
              )}

              {/* Pestaña: Crear Nueva Reserva */}
              {activeTab === "crear" && (
                <div>
                  <div className="alert alert-info mb-4">
                    <h6>💡 Modo Administración</h6>
                    <p className="mb-2">
                      En este modo puedes crear reservas en nombre de los
                      clientes. Las reservas se crearán con estado "pending" y
                      deberás contactar al cliente para confirmar los detalles.
                    </p>
                    <small className="text-muted">
                      <strong>Nota:</strong> Este sistema no procesa pagos. Las
                      reservas son solicitudes que requieren confirmación
                      manual.
                    </small>
                  </div>

                  {/* Sistema de Reservas */}
                  {getSelectedCabanaForCreation() && (
                    <div className="reservation-container">
                      <ReservationSystem
                        cabana={getSelectedCabanaForCreation()}
                        onClose={handleClose}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReservationManagement;
