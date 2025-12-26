// services/calendarService.js
import {
  collection,
  getDocs,
  query,
  orderBy,
  updateDoc,
  doc,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../../../firebase/config";

// Función auxiliar para manejar fechas de Firestore
export const getFirestoreDate = (firestoreTimestamp) => {
  if (!firestoreTimestamp) return null;

  if (typeof firestoreTimestamp.toDate === "function")
    return firestoreTimestamp.toDate();
  if (firestoreTimestamp.seconds !== undefined)
    return new Date(firestoreTimestamp.seconds * 1000);
  if (firestoreTimestamp instanceof Date) return firestoreTimestamp;
  if (typeof firestoreTimestamp === "string")
    return new Date(firestoreTimestamp);

  console.warn("Formato de fecha no reconocido:", firestoreTimestamp);
  return null;
};

// Obtener eventos del calendario
export const fetchCalendarEvents = async () => {
  try {
    const q = query(
      collection(db, "contactMessages"),
      where("scheduledFollowUp", "!=", null),
      orderBy("scheduledFollowUp", "asc")
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error("Error cargando eventos del calendario:", error);
    throw error;
  }
};

// Marcar evento como completado
export const markEventAsCompleted = async (eventId) => {
  try {
    await updateDoc(doc(db, "contactMessages", eventId), {
      followUpStatus: "completado",
      lastUpdated: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error marcando evento como completado:", error);
    throw error;
  }
};

// Verificar y actualizar eventos vencidos
export const checkAndUpdateOverdueEvents = async (events) => {
  const now = new Date();
  const overdueEvents = events.filter((event) => {
    const eventDate = getFirestoreDate(event.scheduledFollowUp);
    return eventDate && eventDate < now && event.followUpStatus !== "vencido";
  });

  for (const event of overdueEvents) {
    try {
      await updateDoc(doc(db, "contactMessages", event.id), {
        followUpStatus: "vencido",
        status: "Perdido",
        lastUpdated: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error actualizando evento vencido:", error);
    }
  }

  return overdueEvents;
};

// Helper functions para vistas
export const getEventsForDate = (events, date) => {
  return events.filter((event) => {
    const eventDate = getFirestoreDate(event.scheduledFollowUp);
    if (!eventDate) return false;
    return eventDate.toDateString() === date.toDateString();
  });
};

export const getUpcomingEvents = (events) => {
  return events
    .filter((event) => {
      const eventDate = getFirestoreDate(event.scheduledFollowUp);
      return eventDate && eventDate >= new Date();
    })
    .sort((a, b) => {
      const dateA = getFirestoreDate(a.scheduledFollowUp);
      const dateB = getFirestoreDate(b.scheduledFollowUp);
      return (dateA || 0) - (dateB || 0);
    });
};

export const getOverdueEvents = (events) => {
  return events
    .filter((event) => {
      const eventDate = getFirestoreDate(event.scheduledFollowUp);
      return (
        eventDate &&
        eventDate < new Date() &&
        event.followUpStatus !== "completado"
      );
    })
    .sort((a, b) => {
      const dateA = getFirestoreDate(a.scheduledFollowUp);
      const dateB = getFirestoreDate(b.scheduledFollowUp);
      return (dateA || 0) - (dateB || 0);
    });
};

export const FOLLOW_UP_TYPES = [
  { value: "llamada", label: "📞 Llamada" },
  { value: "email", label: "📧 Email" },
  { value: "reunion", label: "👥 Reunión" },
  { value: "propuesta", label: "📄 Enviar Propuesta" },
  { value: "seguimiento", label: "🔄 Seguimiento" },
];
