// CalendarHeader.jsx
const CalendarHeader = ({ selectedDate, view, setView, navigateDate }) => {
  const getHeaderText = () => {
    switch (view) {
      case "month":
        return selectedDate
          .toLocaleDateString("es-ES", {
            month: "long",
            year: "numeric",
          })
          .toUpperCase();

      case "week": {
        // 🔥 Envolvemos este case en llaves para crear un bloque de ámbito
        const startOfWeek = new Date(selectedDate);
        const day = startOfWeek.getDay();
        const diff = startOfWeek.getDate() - day;
        startOfWeek.setDate(diff);

        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);

        return `Semana del ${startOfWeek.getDate()} al ${endOfWeek.getDate()} de ${endOfWeek.toLocaleDateString(
          "es-ES",
          { month: "long" }
        )}`;
      }

      case "day":
        return selectedDate.toLocaleDateString("es-ES", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        });

      default:
        return "";
    }
  };

  return (
    <>
      {/* Encabezado y botones de vista */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1>📅 Calendario de Seguimientos</h1>
        <div>
          <button
            className={`btn btn-sm ${
              view === "month" ? "btn-primary" : "btn-outline-primary"
            }`}
            onClick={() => setView("month")}
          >
            Mes
          </button>
          <button
            className={`btn btn-sm mx-2 ${
              view === "week" ? "btn-primary" : "btn-outline-primary"
            }`}
            onClick={() => setView("week")}
          >
            Semana
          </button>
          <button
            className={`btn btn-sm ${
              view === "day" ? "btn-primary" : "btn-outline-primary"
            }`}
            onClick={() => setView("day")}
          >
            Día
          </button>
        </div>
      </div>

      {/* Navegación de fechas */}
      <div className="card mb-4">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center">
            <button
              className="btn btn-outline-primary"
              onClick={() => navigateDate(-1)}
            >
              ‹ Anterior
            </button>

            <h4 className="mb-0 text-center">{getHeaderText()}</h4>

            <button
              className="btn btn-outline-primary"
              onClick={() => navigateDate(1)}
            >
              Siguiente ›
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default CalendarHeader;
