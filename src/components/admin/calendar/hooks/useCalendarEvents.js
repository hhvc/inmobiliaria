// hooks/useCalendarEvents.js
import { useCallback } from "react";
import { markEventAsCompleted as markEventCompleted } from "../services/calendarService";

export const useCalendarEvents = () => {
  const markEventAsCompleted = useCallback(async (eventId, setEvents) => {
    try {
      await markEventCompleted(eventId);

      setEvents((prev) =>
        prev.map((event) =>
          event.id === eventId
            ? { ...event, followUpStatus: "completado" }
            : event
        )
      );
    } catch (error) {
      console.error("Error marcando evento como completado:", error);
      throw error;
    }
  }, []);

  return {
    markEventAsCompleted,
  };
};
