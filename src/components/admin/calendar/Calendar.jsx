// components/admin/calendar/Calendar.jsx
import { useCalendar } from "./hooks/useCalendar";
import { useCalendarEvents } from "./hooks/useCalendarEvents";
import MonthView from "./views/MonthView";
import WeekView from "./views/WeekView";
import DayView from "./views/DayView";
import CalendarHeader from "./CalendarHeader";
import EventsList from "./EventsList";
import { useAuth } from "../../../context/auth/useAuth";
import "./calendar.css";

const Calendar = () => {
  const { events, loading, selectedDate, view, setView, navigateDate } =
    useCalendar();

  const { markEventAsCompleted } = useCalendarEvents();

  const { hasRole } = useAuth();

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
        <p className="mt-2">Cargando calendario...</p>
      </div>
    );
  }

  return (
    <div className="container mt-4">
      <div className="row">
        <div className="col-12">
          <CalendarHeader
            selectedDate={selectedDate}
            view={view}
            setView={setView}
            navigateDate={navigateDate}
          />

          {/* Vistas del Calendario */}
          {view === "month" && (
            <MonthView selectedDate={selectedDate} events={events} />
          )}
          {view === "week" && (
            <WeekView selectedDate={selectedDate} events={events} />
          )}
          {view === "day" && (
            <DayView selectedDate={selectedDate} events={events} />
          )}

          {/* Listas de Eventos */}
          <EventsList
            events={events}
            markEventAsCompleted={markEventAsCompleted}
          />
        </div>
      </div>
    </div>
  );
};

export default Calendar;
