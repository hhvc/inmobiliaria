// hooks/useDashboardStats.js
import { useEffect, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";

import { db } from "../firebase/config";
import { useAuth } from "../context/auth/useAuth";

const INITIAL_STATS = {
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

  // Inmuebles / publicaciones
  totalInmuebles: 0,
  inmueblesActivos: 0,
  inmueblesHoy: 0,
  inmueblesDestacados: 0,
  inmueblesPorTipo: {},
  inmueblesPorOperacion: {},

  // Detalle nuevo
  totalInmueblesInmobiliarias: 0,
  inmueblesInmobiliariasActivos: 0,
  totalPublicacionesParticulares: 0,
  publicacionesParticularesActivas: 0,
};

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
    const date = new Date(firestoreTimestamp);
    return Number.isFinite(date.getTime()) ? date : null;
  }

  return null;
};

const isToday = (value) => {
  const date = getFirestoreDate(value);

  if (!date) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return date >= today;
};

const userHasRole = (user, hasRole, roleName) => {
  if (typeof hasRole === "function" && hasRole(roleName)) return true;
  if (!user) return false;
  if (user.role === roleName) return true;
  if (user.primaryRole === roleName) return true;

  return Array.isArray(user.roles) && user.roles.includes(roleName);
};

const getUserInmobiliariaIds = (user = {}) => {
  const ids = [];

  if (Array.isArray(user.inmobiliarias)) {
    ids.push(...user.inmobiliarias);
  }

  if (user.activeInmobiliariaId) {
    ids.push(user.activeInmobiliariaId);
  }

  if (
    user.inmobiliariaRoles &&
    typeof user.inmobiliariaRoles === "object" &&
    !Array.isArray(user.inmobiliariaRoles)
  ) {
    ids.push(...Object.keys(user.inmobiliariaRoles));
  }

  return Array.from(
    new Set(
      ids
        .filter(Boolean)
        .map((id) => id.toString().trim())
        .filter(Boolean),
    ),
  );
};

const safeGetCollection = async (pathParts, label) => {
  try {
    const ref = collection(db, ...pathParts);
    const snapshot = await getDocs(ref);

    return snapshot.docs.map((item) => ({
      id: item.id,
      ...item.data(),
    }));
  } catch (err) {
    console.debug(`${label} no disponible para estadísticas:`, err);
    return [];
  }
};

const safeGetQuery = async (queryRef, label) => {
  try {
    const snapshot = await getDocs(queryRef);

    return snapshot.docs.map((item) => ({
      id: item.id,
      ...item.data(),
    }));
  } catch (err) {
    console.debug(`${label} no disponible para estadísticas:`, err);
    return [];
  }
};

const fetchReadableInmobiliarias = async ({ user, hasRole }) => {
  const isRoot = userHasRole(user, hasRole, "root");

  if (isRoot) {
    return safeGetCollection(["inmobiliarias"], "Colección de inmobiliarias");
  }

  const inmobiliariaIds = getUserInmobiliariaIds(user);

  const entries = await Promise.all(
    inmobiliariaIds.map(async (inmobiliariaId) => {
      try {
        const snap = await getDoc(doc(db, "inmobiliarias", inmobiliariaId));

        if (!snap.exists()) return null;

        return {
          id: snap.id,
          ...snap.data(),
        };
      } catch (err) {
        console.debug(
          `Inmobiliaria ${inmobiliariaId} no disponible para estadísticas:`,
          err,
        );

        return null;
      }
    }),
  );

  return entries.filter(Boolean);
};

const fetchInmueblesByInmobiliarias = async (inmobiliarias = []) => {
  const entries = await Promise.all(
    inmobiliarias.map(async (inmobiliaria) => {
      const inmobiliariaId = inmobiliaria.id;

      const inmuebles = await safeGetCollection(
        ["inmobiliarias", inmobiliariaId, "inmuebles"],
        `Inmuebles de inmobiliaria ${inmobiliariaId}`,
      );

      return inmuebles.map((inmueble) => ({
        ...inmueble,
        inmobiliariaId:
          inmueble.inmobiliariaId ||
          inmueble.ownerInmobiliariaId ||
          inmobiliariaId,
        sourceType: "inmobiliaria",
      }));
    }),
  );

  return entries.flat();
};

const fetchParticularPublications = async ({ user, hasRole }) => {
  const isRoot = userHasRole(user, hasRole, "root");

  if (isRoot) {
    return safeGetCollection(
      ["particular_publications"],
      "Publicaciones particulares",
    );
  }

  const publicParticularQuery = query(
    collection(db, "particular_publications"),
    where("publicationType", "==", "particular"),
    where("publicStatus", "==", "active"),
    where("moderationStatus", "==", "approved"),
  );

  return safeGetQuery(
    publicParticularQuery,
    "Publicaciones particulares públicas",
  );
};

const isDeletedInmueble = (inmueble = {}) => {
  return (
    inmueble.deleted === true ||
    inmueble.isDeleted === true ||
    inmueble.estado === "eliminado" ||
    inmueble.estado === "borrado"
  );
};

const isActiveInmueble = (inmueble = {}) => {
  if (isDeletedInmueble(inmueble)) return false;

  if (inmueble.estado) {
    return inmueble.estado === "activo";
  }

  return inmueble.activo !== false;
};

const isFeaturedInmueble = (inmueble = {}) => {
  if (inmueble.destacado === true) return true;

  const promotion = inmueble.promotion || inmueble.promo || {};

  return Boolean(
    promotion.active === true ||
    promotion.type === "premium" ||
    promotion.type === "destacado" ||
    promotion.plan === "premium" ||
    promotion.plan === "destacado",
  );
};

const isActiveParticularPublication = (publication = {}) => {
  return (
    publication.publicationType === "particular" &&
    publication.publicStatus === "active" &&
    publication.moderationStatus === "approved"
  );
};

const mapParticularPublicationToStatsItem = (publication = {}) => {
  return {
    id: publication.id,
    sourceType: "particular",
    tipo: publication.tipo || "sin_tipo",
    operacion: publication.operacion || "sin_operacion",
    estado: publication.publicStatus || "",
    deleted: publication.publicStatus === "deleted",
    destacado: publication.destacado === true,
    promotion: publication.promotion || publication.promo || null,
    createdAt:
      publication.approvedAt || publication.createdAt || publication.updatedAt,
    updatedAt: publication.updatedAt || publication.approvedAt,
  };
};

const accumulateBreakdowns = ({ items, inmueblesPorTipo, inmueblesPorOperacion }) => {
  items.forEach((item) => {
    const tipo = item.tipo || "sin_tipo";
    const operacion = item.operacion || "sin_operacion";

    inmueblesPorTipo[tipo] = (inmueblesPorTipo[tipo] || 0) + 1;
    inmueblesPorOperacion[operacion] =
      (inmueblesPorOperacion[operacion] || 0) + 1;
  });
};

export const useDashboardStats = () => {
  const { user, hasRole } = useAuth();

  const [stats, setStats] = useState(INITIAL_STATS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        setError(null);

        if (!user) {
          setStats(INITIAL_STATS);
          return;
        }

        // ====================================================
        // 1. Estadísticas legadas de cabañas
        // ====================================================
        const cabanasData = await safeGetCollection(
          ["cabanas"],
          "Colección de cabañas",
        );

        const totalCabanas = cabanasData.length;
        const cabanasDisponibles = cabanasData.filter(
          (cabana) => cabana.disponible === true,
        ).length;
        const cabanasDestacadas = cabanasData.filter(
          (cabana) => cabana.destacada === true,
        ).length;

        // ====================================================
        // 2. Usuarios
        // ====================================================
        const usuariosData = await safeGetCollection(
          ["users"],
          "Colección de usuarios",
        );

        const totalUsuarios = usuariosData.length;

        // ====================================================
        // 3. Contactos legados
        // ====================================================
        const contactosData = await safeGetCollection(
          ["contactMessages"],
          "Colección de contactos",
        );

        const totalContactos = contactosData.length;
        const contactosNoLeidos = contactosData.filter(
          (contacto) => contacto.read !== true,
        ).length;
        const contactosHoy = contactosData.filter((contacto) =>
          isToday(contacto.createdAt),
        ).length;

        // ====================================================
        // 4. Reservas legadas
        // ====================================================
        const reservasData = await safeGetCollection(
          ["reservations"],
          "Colección de reservas",
        );

        const totalReservas = reservasData.length;
        const reservasPendientes = reservasData.filter(
          (reserva) => reserva.status === "pending",
        ).length;
        const reservasConfirmadas = reservasData.filter(
          (reserva) => reserva.status === "confirmed",
        ).length;
        const reservasCanceladas = reservasData.filter(
          (reserva) => reserva.status === "cancelled",
        ).length;
        const reservasHoy = reservasData.filter((reserva) =>
          isToday(reserva.createdAt),
        ).length;

        const ingresosTotales = reservasData
          .filter((reserva) => reserva.status === "confirmed")
          .reduce((total, reserva) => total + (Number(reserva.total) || 0), 0);

        const ingresosPendientes = reservasData
          .filter((reserva) => reserva.status === "pending")
          .reduce((total, reserva) => total + (Number(reserva.total) || 0), 0);

        // ====================================================
        // 5. Inmobiliarias
        // ====================================================
        const inmobiliariasData = await fetchReadableInmobiliarias({
          user,
          hasRole,
        });

        const totalInmobiliarias = inmobiliariasData.length;
        const inmobiliariasActivas = inmobiliariasData.filter(
          (inmobiliaria) => inmobiliaria.activa === true,
        ).length;
        const inmobiliariasHoy = inmobiliariasData.filter((inmobiliaria) =>
          isToday(inmobiliaria.createdAt),
        ).length;

        // ====================================================
        // 6. Inmuebles reales:
        //    /inmobiliarias/{id}/inmuebles
        //    + /particular_publications
        // ====================================================
        const inmueblesInmobiliariasData =
          await fetchInmueblesByInmobiliarias(inmobiliariasData);

        const particularPublicationsData = await fetchParticularPublications({
          user,
          hasRole,
        });

        const activeParticularPublicationsData =
          particularPublicationsData.filter(isActiveParticularPublication);

        const particularItemsForStats = activeParticularPublicationsData.map(
          mapParticularPublicationToStatsItem,
        );

        const inmueblesNoDeleted = inmueblesInmobiliariasData.filter(
          (inmueble) => !isDeletedInmueble(inmueble),
        );

        const inmueblesActivosData =
          inmueblesInmobiliariasData.filter(isActiveInmueble);

        const allStatsItems = [
          ...inmueblesNoDeleted,
          ...particularItemsForStats,
        ];

        const activeStatsItems = [
          ...inmueblesActivosData,
          ...particularItemsForStats,
        ];

        const inmueblesPorTipo = {};
        const inmueblesPorOperacion = {};

        accumulateBreakdowns({
          items: activeStatsItems,
          inmueblesPorTipo,
          inmueblesPorOperacion,
        });

        const totalInmueblesInmobiliarias = inmueblesNoDeleted.length;
        const inmueblesInmobiliariasActivos = inmueblesActivosData.length;
        const totalPublicacionesParticulares = particularPublicationsData.length;
        const publicacionesParticularesActivas =
          activeParticularPublicationsData.length;

        const totalInmuebles = allStatsItems.length;
        const inmueblesActivos = activeStatsItems.length;

        const inmueblesHoy = allStatsItems.filter((item) =>
          isToday(item.createdAt),
        ).length;

        const inmueblesDestacados = allStatsItems.filter(isFeaturedInmueble).length;

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

          // Inmuebles / publicaciones
          totalInmuebles,
          inmueblesActivos,
          inmueblesHoy,
          inmueblesDestacados,
          inmueblesPorTipo,
          inmueblesPorOperacion,

          // Detalle nuevo
          totalInmueblesInmobiliarias,
          inmueblesInmobiliariasActivos,
          totalPublicacionesParticulares,
          publicacionesParticularesActivas,
        });
      } catch (err) {
        console.error("Error fetching dashboard stats:", err);
        setError(err.message || "No se pudieron cargar las estadísticas.");
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [user, hasRole]);

  return { stats, loading, error };
};