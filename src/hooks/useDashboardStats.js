// hooks/useDashboardStats.js
import { useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase/config";

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

export const useDashboardStats = () => {
  const [stats, setStats] = useState({
    // Cabañas
    totalCabanas: 0,
    cabanasDisponibles: 0,
    cabanasDestacadas: 0,

    // Reservas
    totalReservas: 0,
    reservasPendientes: 0,
    reservasConfirmadas: 0,
    reservasCanceladas: 0,
    reservasHoy: 0,
    ingresosTotales: 0,
    ingresosPendientes: 0,

    // Contactos
    totalContactos: 0,
    contactosNoLeidos: 0,
    contactosHoy: 0,

    // Usuarios
    totalUsuarios: 0,

    // Inmobiliarias
    totalInmobiliarias: 0,
    inmobiliariasActivas: 0,
    inmobiliariasHoy: 0,

    // Inmuebles (nuevas estadísticas)
    totalInmuebles: 0,
    inmueblesActivos: 0,
    inmueblesHoy: 0,
    inmueblesDestacados: 0,
    inmueblesPorTipo: {},
    inmueblesPorOperacion: {},
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);

        // ====================================================
        // 1. Obtener estadísticas de cabañas
        // ====================================================
        let totalCabanas = 0;
        let cabanasDisponibles = 0;
        let cabanasDestacadas = 0;

        try {
          const cabanasRef = collection(db, "cabanas");
          const cabanasSnapshot = await getDocs(cabanasRef);
          const cabanasData = cabanasSnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));

          totalCabanas = cabanasData.length;
          cabanasDisponibles = cabanasData.filter(
            (cabana) => cabana.disponible
          ).length;
          cabanasDestacadas = cabanasData.filter(
            (cabana) => cabana.destacada
          ).length;
        } catch (cabanasError) {
          console.log("Colección de cabañas no disponible:", cabanasError);
        }

        // ====================================================
        // 2. Obtener estadísticas de usuarios
        // ====================================================
        let totalUsuarios = 0;
        try {
          const usuariosRef = collection(db, "users");
          const usuariosSnapshot = await getDocs(usuariosRef);
          totalUsuarios = usuariosSnapshot.size;
        } catch (userError) {
          console.log("Colección de usuarios no disponible:", userError);
        }

        // ====================================================
        // 3. Obtener estadísticas de contactos
        // ====================================================
        let totalContactos = 0;
        let contactosNoLeidos = 0;
        let contactosHoy = 0;

        try {
          const contactosRef = collection(db, "contactMessages");
          const contactosSnapshot = await getDocs(contactosRef);
          const contactosData = contactosSnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));

          totalContactos = contactosData.length;

          // Contactos no leídos (donde read es false o no existe)
          contactosNoLeidos = contactosData.filter(
            (contacto) => !contacto.read
          ).length;

          // Contactos de hoy
          const hoy = new Date();
          hoy.setHours(0, 0, 0, 0); // Inicio del día de hoy

          contactosHoy = contactosData.filter((contacto) => {
            const fechaCreacion = getFirestoreDate(contacto.createdAt);
            return fechaCreacion && fechaCreacion >= hoy;
          }).length;
        } catch (contactosError) {
          console.log("Colección de contactos no disponible:", contactosError);
        }

        // ====================================================
        // 4. Obtener estadísticas de reservas
        // ====================================================
        let totalReservas = 0;
        let reservasPendientes = 0;
        let reservasConfirmadas = 0;
        let reservasCanceladas = 0;
        let reservasHoy = 0;
        let ingresosTotales = 0;
        let ingresosPendientes = 0;

        try {
          const reservasRef = collection(db, "reservations");
          const reservasSnapshot = await getDocs(reservasRef);
          const reservasData = reservasSnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));

          totalReservas = reservasData.length;
          reservasPendientes = reservasData.filter(
            (r) => r.status === "pending"
          ).length;
          reservasConfirmadas = reservasData.filter(
            (r) => r.status === "confirmed"
          ).length;
          reservasCanceladas = reservasData.filter(
            (r) => r.status === "cancelled"
          ).length;

          // Reservas de hoy (creadas hoy)
          const hoy = new Date();
          hoy.setHours(0, 0, 0, 0);
          reservasHoy = reservasData.filter((reserva) => {
            const fechaCreacion = getFirestoreDate(reserva.createdAt);
            return fechaCreacion && fechaCreacion >= hoy;
          }).length;

          // Cálculo de ingresos
          ingresosTotales = reservasData
            .filter((r) => r.status === "confirmed")
            .reduce((total, reserva) => total + (reserva.total || 0), 0);

          ingresosPendientes = reservasData
            .filter((r) => r.status === "pending")
            .reduce((total, reserva) => total + (reserva.total || 0), 0);
        } catch (reservasError) {
          console.log("Colección de reservas no disponible:", reservasError);
        }

        // ====================================================
        // 5. Obtener estadísticas de inmobiliarias
        // ====================================================
        let totalInmobiliarias = 0;
        let inmobiliariasActivas = 0;
        let inmobiliariasHoy = 0;

        try {
          const inmobiliariasRef = collection(db, "inmobiliarias");
          const inmobiliariasSnapshot = await getDocs(inmobiliariasRef);
          const inmobiliariasData = inmobiliariasSnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));

          totalInmobiliarias = inmobiliariasData.length;
          inmobiliariasActivas = inmobiliariasData.filter(
            (inmobiliaria) => inmobiliaria.activa === true
          ).length;

          // Inmobiliarias creadas hoy
          const hoy = new Date();
          hoy.setHours(0, 0, 0, 0);
          inmobiliariasHoy = inmobiliariasData.filter((inmobiliaria) => {
            const fechaCreacion = getFirestoreDate(inmobiliaria.createdAt);
            return fechaCreacion && fechaCreacion >= hoy;
          }).length;
        } catch (inmobiliariasError) {
          console.log(
            "Colección de inmobiliarias no disponible:",
            inmobiliariasError
          );
        }

        // ====================================================
        // 6. Obtener estadísticas de inmuebles (NUEVO)
        // ====================================================
        let totalInmuebles = 0;
        let inmueblesActivos = 0;
        let inmueblesHoy = 0;
        let inmueblesDestacados = 0;
        const inmueblesPorTipo = {};
        const inmueblesPorOperacion = {};

        try {
          const inmueblesRef = collection(db, "inmuebles");
          const inmueblesSnapshot = await getDocs(inmueblesRef);
          const inmueblesData = inmueblesSnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));

          totalInmuebles = inmueblesData.length;

          // Para determinar si un inmueble está activo, asumimos que está activo a menos que tenga un campo 'activo' en false
          // O podríamos considerar todos los inmuebles como activos si no hay campo de estado
          inmueblesActivos = inmueblesData.filter(
            (inmueble) => inmueble.activo !== false
          ).length;

          // Inmuebles destacados
          inmueblesDestacados = inmueblesData.filter(
            (inmueble) => inmueble.destacado === true
          ).length;

          // Inmuebles creados hoy
          const hoy = new Date();
          hoy.setHours(0, 0, 0, 0);
          inmueblesHoy = inmueblesData.filter((inmueble) => {
            const fechaCreacion = getFirestoreDate(inmueble.createdAt);
            return fechaCreacion && fechaCreacion >= hoy;
          }).length;

          // Estadísticas por tipo
          inmueblesData.forEach((inmueble) => {
            const tipo = inmueble.tipo || "sin_tipo";
            inmueblesPorTipo[tipo] = (inmueblesPorTipo[tipo] || 0) + 1;

            const operacion = inmueble.operacion || "sin_operacion";
            inmueblesPorOperacion[operacion] =
              (inmueblesPorOperacion[operacion] || 0) + 1;
          });
        } catch (inmueblesError) {
          console.log("Colección de inmuebles no disponible:", inmueblesError);
        }

        // ====================================================
        // 7. Actualizar estado con todas las estadísticas
        // ====================================================
        setStats({
          // Cabañas
          totalCabanas,
          cabanasDisponibles,
          cabanasDestacadas,

          // Reservas
          totalReservas,
          reservasPendientes,
          reservasConfirmadas,
          reservasCanceladas,
          reservasHoy,
          ingresosTotales,
          ingresosPendientes,

          // Contactos
          totalContactos,
          contactosNoLeidos,
          contactosHoy,

          // Usuarios
          totalUsuarios,

          // Inmobiliarias
          totalInmobiliarias,
          inmobiliariasActivas,
          inmobiliariasHoy,

          // Inmuebles (nuevo)
          totalInmuebles,
          inmueblesActivos,
          inmueblesHoy,
          inmueblesDestacados,
          inmueblesPorTipo,
          inmueblesPorOperacion,
        });
      } catch (err) {
        console.error("Error fetching dashboard stats:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  return { stats, loading, error };
};
