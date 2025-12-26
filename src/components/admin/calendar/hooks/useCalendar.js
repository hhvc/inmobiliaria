// hooks/useCalendar.js
import { useState, useEffect } from "react";
import { useAuth } from "../../../../context/auth/useAuth";
import {
  fetchCalendarEvents,
  checkAndUpdateOverdueEvents,
} from "../services/calendarService";

export const useCalendar = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [view, setView] = useState("month");
  const { hasRole } = useAuth();

  // Cargar eventos
  useEffect(() => {
    if (!hasRole("admin")) return;

    const loadEvents = async () => {
      try {
        const eventsData = await fetchCalendarEvents();
        setEvents(eventsData);
      } catch (error) {
        console.error("Error loading events:", error);
      } finally {
        setLoading(false);
      }
    };

    loadEvents();
  }, [hasRole]);

  // Verificar eventos vencidos
  useEffect(() => {
    const checkOverdue = async () => {
      if (events.length === 0) return;

      const overdueEvents = await checkAndUpdateOverdueEvents(events);

      if (overdueEvents.length > 0) {
        setEvents((prev) =>
          prev.map((event) => {
            const isOverdue = overdueEvents.find((oe) => oe.id === event.id);
            if (isOverdue) {
              return { ...event, followUpStatus: "vencido", status: "Perdido" };
            }
            return event;
          })
        );
      }
    };

    checkOverdue();
  }, [events]);

  // Navegación
  const navigateDate = (direction) => {
    const newDate = new Date(selectedDate);
    if (view === "month") newDate.setMonth(newDate.getMonth() + direction);
    else if (view === "week")
      newDate.setDate(newDate.getDate() + direction * 7);
    else newDate.setDate(newDate.getDate() + direction);
    setSelectedDate(newDate);
  };

  return {
    events,
    loading,
    selectedDate,
    view,
    setView,
    setSelectedDate,
    navigateDate,
    setEvents,
  };
};
