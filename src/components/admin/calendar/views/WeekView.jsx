// views/WeekView.jsx
import {
  getEventsForDate,
  getFirestoreDate,
} from "../services/calendarService";

const WeekView = ({ selectedDate, events }) => {
  const getWeekDates = (date) => {
    const startOfWeek = new Date(date);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day;
    startOfWeek.setDate(diff);

    const weekDates = [];
    for (let i = 0; i < 7; i++) {
      const weekDay = new Date(startOfWeek);
      weekDay.setDate(startOfWeek.getDate() + i);
      weekDates.push(weekDay);
    }
    return weekDates;
  };

  const weekDates = getWeekDates(selectedDate);

  return (
    <div className="card">
      <div className="card-body">
        <div className="table-responsive">
          <table className="table table-bordered">
            <thead className="table-light">
              <tr>
                <th className="text-center py-3">Hora</th>
                {weekDates.map((date, index) => (
                  <th key={index} className="text-center py-3">
                    <div>
                      <div className="fw-bold">
                        {date.toLocaleDateString("es-ES", { weekday: "short" })}
                      </div>
                      <div className="small">
                        {date.getDate()}{" "}
                        {date.toLocaleDateString("es-ES", { month: "short" })}
                      </div>
                      {date.toDateString() === new Date().toDateString() && (
                        <span className="badge bg-primary btn-sm mt-1">
                          Hoy
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Horas del día */}
              {Array.from({ length: 12 }, (_, hour) => {
                const currentHour = hour + 8; // De 8 AM a 7 PM
                return (
                  <tr key={hour}>
                    <td className="text-center fw-bold">{currentHour}:00</td>
                    {weekDates.map((date, dayIndex) => {
                      const dayEvents = getEventsForDate(events, date).filter(
                        (event) => {
                          const eventDate = getFirestoreDate(
                            event.scheduledFollowUp
                          );
                          return (
                            eventDate && eventDate.getHours() === currentHour
                          );
                        }
                      );

                      return (
                        <td
                          key={dayIndex}
                          className="p-2"
                          style={{ height: "80px", verticalAlign: "top" }}
                        >
                          {dayEvents.map((event) => {
                            const eventDate = getFirestoreDate(
                              event.scheduledFollowUp
                            );
                            const isOverdue =
                              eventDate &&
                              eventDate < new Date() &&
                              event.followUpStatus !== "completado";

                            return (
                              <div
                                key={event.id}
                                className={`small p-1 mb-1 rounded text-white ${
                                  event.followUpStatus === "vencido" ||
                                  isOverdue
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
                              </div>
                            );
                          })}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default WeekView;
