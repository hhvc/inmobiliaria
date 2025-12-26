// views/DayView.jsx
import {
  getEventsForDate,
  getFirestoreDate,
} from "../services/calendarService";

const DayView = ({ selectedDate, events }) => {
  const dayEvents = getEventsForDate(events, selectedDate).sort((a, b) => {
    const dateA = getFirestoreDate(a.scheduledFollowUp);
    const dateB = getFirestoreDate(b.scheduledFollowUp);
    return (dateA || 0) - (dateB || 0);
  });

  const getEventsByHour = () => {
    const hours = {};
    for (let hour = 0; hour < 24; hour++) {
      hours[hour] = dayEvents.filter((event) => {
        const eventDate = getFirestoreDate(event.scheduledFollowUp);
        return eventDate && eventDate.getHours() === hour;
      });
    }
    return hours;
  };

  const eventsByHour = getEventsByHour();

  return (
    <div className="card">
      <div className="card-header">
        <h5 className="mb-0">
          {selectedDate.toLocaleDateString("es-ES", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </h5>
      </div>
      <div className="card-body p-0">
        <div className="day-view-container">
          {Array.from({ length: 24 }, (_, hour) => (
            <div key={hour} className="day-view-hour-row border-bottom">
              <div className="day-view-hour-label">
                <span className="fw-bold">
                  {hour.toString().padStart(2, "0")}:00
                </span>
              </div>
              <div className="day-view-events">
                {eventsByHour[hour].map((event) => {
                  const eventDate = getFirestoreDate(event.scheduledFollowUp);
                  const isOverdue =
                    eventDate &&
                    eventDate < new Date() &&
                    event.followUpStatus !== "completado";

                  return (
                    <div
                      key={event.id}
                      className={`day-view-event ${
                        event.followUpStatus === "vencido" || isOverdue
                          ? "bg-danger"
                          : event.followUpStatus === "completado"
                          ? "bg-success"
                          : "bg-warning text-dark"
                      }`}
                    >
                      <div className="fw-bold">{event.name}</div>
                      <small>
                        {eventDate?.toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </small>
                      <div className="small mt-1">
                        {event.followUpType && (
                          <span className="badge bg-secondary me-1">
                            {event.followUpType}
                          </span>
                        )}
                        <span className="badge bg-light text-dark">
                          {event.email}
                        </span>
                      </div>
                    </div>
                  );
                })}
                {eventsByHour[hour].length === 0 && (
                  <div className="text-muted small p-2">Sin eventos</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DayView;
