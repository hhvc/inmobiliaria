// EventsList.jsx
import {
  getUpcomingEvents,
  getOverdueEvents,
  getFirestoreDate,
} from "./services/calendarService";
import { FOLLOW_UP_TYPES } from "./services/calendarService";

const EventsList = ({ events, markEventAsCompleted }) => {
  const upcomingEvents = getUpcomingEvents(events);
  const overdueEvents = getOverdueEvents(events);

  const EventItem = ({ event, isOverdue = false }) => {
    const eventDate = getFirestoreDate(event.scheduledFollowUp);
    const statusInfo =
      event.followUpStatus === "vencido"
        ? { badge: "bg-danger", text: "Vencido" }
        : event.followUpStatus === "completado"
        ? { badge: "bg-success", text: "Completado" }
        : { badge: "bg-warning text-dark", text: "Programado" };

    return (
      <div className={`list-group-item ${isOverdue ? "border-danger" : ""}`}>
        <div className="d-flex w-100 justify-content-between align-items-start">
          <div className="flex-grow-1">
            <h6 className={`mb-1 ${isOverdue ? "text-danger" : ""}`}>
              {event.name}
            </h6>
            <p className="mb-1 text-muted small">{event.email}</p>
            <p className="mb-1 small">{event.message?.substring(0, 100)}...</p>
          </div>
          <div className="text-end">
            {isOverdue ? (
              <small className="text-danger d-block fw-bold">
                Vencido el {eventDate?.toLocaleDateString()}
              </small>
            ) : (
              <small className="text-muted d-block">
                {eventDate?.toLocaleDateString()}
              </small>
            )}
            <small className="text-muted d-block">
              {eventDate?.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </small>
          </div>
        </div>
        <div className="mt-2">
          <span className={`badge ${statusInfo.badge} me-2`}>
            {statusInfo.text}
          </span>
          <span className="badge bg-secondary me-2">
            {FOLLOW_UP_TYPES.find((f) => f.value === event.followUpType)
              ?.label || "Seguimiento"}
          </span>
          <span className="badge bg-info">{event.status || "nuevo"}</span>
          {event.followUpStatus !== "completado" && (
            <button
              className={`btn btn-success btn-sm ${isOverdue ? "" : "ms-2"}`}
              onClick={() => markEventAsCompleted(event.id)}
            >
              ✅ {isOverdue ? "Marcar como Completado" : "Completar"}
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Eventos próximos */}
      <div className="card mt-4">
        <div className="card-header d-flex justify-content-between align-items-center">
          <h5 className="mb-0">📋 Eventos Próximos</h5>
          <span className="badge bg-primary">
            {upcomingEvents.length} eventos
          </span>
        </div>
        <div className="card-body">
          {upcomingEvents.length === 0 ? (
            <p className="text-muted">No hay eventos programados.</p>
          ) : (
            <div className="list-group">
              {upcomingEvents.slice(0, 10).map((event) => (
                <EventItem key={event.id} event={event} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Eventos vencidos */}
      <div className="card mt-4 border-danger">
        <div className="card-header bg-danger text-white d-flex justify-content-between align-items-center">
          <h5 className="mb-0">⚠️ Eventos Vencidos</h5>
          <span className="badge bg-light text-danger">
            {overdueEvents.length} eventos
          </span>
        </div>
        <div className="card-body">
          {overdueEvents.length === 0 ? (
            <p className="text-muted">
              No hay eventos vencidos. ¡Buen trabajo!
            </p>
          ) : (
            <div className="list-group">
              {overdueEvents.map((event) => (
                <EventItem key={event.id} event={event} isOverdue={true} />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default EventsList;
