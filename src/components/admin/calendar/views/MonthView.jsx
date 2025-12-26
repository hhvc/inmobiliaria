// views/MonthView.jsx
import {
  getEventsForDate,
  getFirestoreDate,
} from "../services/calendarService";

const MonthView = ({ selectedDate, events }) => {
  const renderMonthView = () => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDay = firstDay.getDay();

    const weeks = [];
    let day = 1;

    for (let i = 0; i < 6; i++) {
      const days = [];
      for (let j = 0; j < 7; j++) {
        if ((i === 0 && j < startDay) || day > daysInMonth) {
          days.push(<td key={j} className="text-muted bg-light"></td>);
        } else {
          const currentDate = new Date(year, month, day);
          const dayEvents = getEventsForDate(events, currentDate);

          days.push(
            <td key={j} className="calendar-day p-1">
              <div className="d-flex justify-content-between align-items-start">
                <span
                  className={`badge ${
                    currentDate.toDateString() === new Date().toDateString()
                      ? "bg-primary text-white"
                      : "bg-light text-dark"
                  }`}
                >
                  {day}
                </span>
                {dayEvents.length > 0 && (
                  <span className="badge bg-warning text-dark">
                    {dayEvents.length}
                  </span>
                )}
              </div>
              <div className="calendar-events mt-1">
                {dayEvents.slice(0, 3).map((event) => {
                  const eventDate = getFirestoreDate(event.scheduledFollowUp);
                  const isOverdue =
                    eventDate &&
                    eventDate < new Date() &&
                    event.followUpStatus !== "completado";

                  return (
                    <div
                      key={event.id}
                      className={`small p-1 mb-1 rounded text-white ${
                        event.followUpStatus === "vencido" || isOverdue
                          ? "bg-danger"
                          : event.followUpStatus === "completado"
                          ? "bg-success"
                          : "bg-warning text-dark"
                      }`}
                      title={`${event.name} - ${
                        event.followUpType || "Seguimiento"
                      } - ${eventDate?.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}`}
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
                {dayEvents.length > 3 && (
                  <div className="small text-muted">
                    +{dayEvents.length - 3} más
                  </div>
                )}
              </div>
            </td>
          );
          day++;
        }
      }
      weeks.push(<tr key={i}>{days}</tr>);
      if (day > daysInMonth) break;
    }

    return weeks;
  };

  return (
    <div className="card">
      <div className="card-body p-0">
        <div className="table-responsive">
          <table className="table table-bordered calendar-table mb-0">
            <thead className="table-light">
              <tr>
                {["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"].map(
                  (day) => (
                    <th key={day} className="text-center py-3">
                      {day}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>{renderMonthView()}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default MonthView;
