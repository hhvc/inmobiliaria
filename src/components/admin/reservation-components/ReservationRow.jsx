// components/admin/reservation-components/ReservationRow.jsx
const ReservationRow = ({
  reservation,
  onUpdateStatus,
  onDeleteReservation,
  showCabanaColumn = false,
}) => {
  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: { class: "warning", text: "Pendiente" },
      confirmed: { class: "success", text: "Confirmada" },
      cancelled: { class: "danger", text: "Cancelada" },
    };

    const config = statusConfig[status] || { class: "secondary", text: status };
    return <span className={`badge bg-${config.class}`}>{config.text}</span>;
  };

  const handleQuickAction = (action) => {
    switch (action) {
      case "confirm":
        onUpdateStatus(reservation.id, "confirmed");
        break;
      case "cancel":
        onUpdateStatus(reservation.id, "cancelled");
        break;
      case "pending":
        onUpdateStatus(reservation.id, "pending");
        break;
      default:
        break;
    }
  };

  const getPricePerNight = () => {
    if (reservation.nights && reservation.nights > 0) {
      return Math.round(reservation.total / reservation.nights);
    }
    return reservation.total;
  };

  const showDetailedModal = () => {
    const details = `
🏠 **INFORMACIÓN DE LA RESERVA**

👤 **Huésped:** ${reservation.guestName}
📧 **Email:** ${reservation.guestEmail}
📞 **Teléfono:** ${reservation.guestPhone}

📅 **Fechas:**
   • Check-in: ${reservation.checkIn?.toLocaleDateString("es-ES")}
   • Check-out: ${reservation.checkOut?.toLocaleDateString("es-ES")}
   • ${reservation.nights} noches de estadía

👥 **Personas:**
   • ${reservation.adultos} adultos
   • ${reservation.menores} menores
   • ${reservation.menores3} menores (0-3 años)
   • Total: ${reservation.totalPersonas} personas

💰 **Pagos:**
   • Total: $${reservation.total}
   • Precio por noche: $${getPricePerNight()}
   • Estado: ${reservation.status}

${
  reservation.specialRequests
    ? `💬 **Solicitudes especiales:**\n${reservation.specialRequests}`
    : "💬 **Solicitudes especiales:** Ninguna"
}

${showCabanaColumn ? `🏡 **Cabaña:** ${reservation.cabanaNombre}` : ""}
📋 **Creada:** ${reservation.createdAt?.toLocaleDateString("es-ES")}
    `.trim();

    alert(details);
  };

  const getActionButtons = () => {
    const buttons = [];

    switch (reservation.status) {
      case "pending":
        buttons.push(
          {
            label: "✅ Confirmar",
            className: "btn-success btn-sm mb-1",
            action: () => handleQuickAction("confirm"),
            title: "Confirmar reserva",
          },
          {
            label: "❌ Cancelar",
            className: "btn-danger btn-sm mb-1",
            action: () => handleQuickAction("cancel"),
            title: "Cancelar reserva",
          }
        );
        break;
      case "confirmed":
        buttons.push({
          label: "↩️ Pendiente",
          className: "btn-warning btn-sm mb-1",
          action: () => handleQuickAction("pending"),
          title: "Volver a pendiente",
        });
        break;
      case "cancelled":
        buttons.push({
          label: "🔄 Reactivar",
          className: "btn-warning btn-sm mb-1",
          action: () => handleQuickAction("pending"),
          title: "Reactivar reserva",
        });
        break;
    }

    // Botón de detalles siempre visible
    buttons.push({
      label: "👁️ Detalles",
      className: "btn-outline-info btn-sm mb-1",
      action: showDetailedModal,
      title: "Ver detalles completos",
    });

    // Botón de eliminar siempre visible
    buttons.push({
      label: "🗑️ Eliminar",
      className: "btn-outline-danger btn-sm",
      action: () => onDeleteReservation(reservation.id),
      title: "Eliminar reserva permanentemente",
    });

    return buttons;
  };

  return (
    <tr>
      {/* Columna de Cabaña (condicional) */}
      {showCabanaColumn && (
        <td>
          <strong>{reservation.cabanaNombre}</strong>
          {reservation.cabanaInfo?.precios?.temporadas &&
            reservation.cabanaInfo.precios.temporadas.length > 0 && (
              <div>
                <small className="text-success">💰 Tarifas especiales</small>
              </div>
            )}
        </td>
      )}

      {/* Columna de Huésped */}
      <td>
        <div className="d-flex flex-column">
          <strong className="mb-1">{reservation.guestName}</strong>
          <small className="text-muted">
            📅 Creada: {reservation.createdAt?.toLocaleDateString("es-ES")}
          </small>
          {reservation.specialRequests && (
            <small
              className="text-info mt-1 cursor-pointer"
              title={reservation.specialRequests}
              onClick={() =>
                alert(
                  `💬 Solicitudes especiales:\n\n${reservation.specialRequests}`
                )
              }
              style={{ cursor: "pointer" }}
            >
              💬 Tiene solicitudes especiales
            </small>
          )}
        </div>
      </td>

      {/* Columna de Contacto */}
      <td>
        <div className="d-flex flex-column">
          <a
            href={`mailto:${reservation.guestEmail}`}
            className="text-decoration-none"
            title="Enviar email"
          >
            📧 {reservation.guestEmail}
          </a>
          <a
            href={`tel:${reservation.guestPhone}`}
            className="text-decoration-none mt-1"
            title="Llamar"
          >
            📞 {reservation.guestPhone}
          </a>
        </div>
      </td>

      {/* Columna de Fechas */}
      <td>
        <div className="d-flex flex-column">
          <div>
            <strong>📍 Check-in:</strong>
            <br />
            <span className="text-success">
              {reservation.checkIn?.toLocaleDateString("es-ES")}
            </span>
          </div>
          <div className="mt-1">
            <strong>🚪 Check-out:</strong>
            <br />
            <span className="text-danger">
              {reservation.checkOut?.toLocaleDateString("es-ES")}
            </span>
          </div>
          <div className="mt-1">
            <small className="text-muted">🌙 {reservation.nights} noches</small>
          </div>
        </div>
      </td>

      {/* Columna de Personas */}
      <td>
        <div className="d-flex flex-column">
          <div>
            <span className="badge bg-primary me-1">{reservation.adultos}</span>
            adultos
          </div>
          <div className="mt-1">
            <span className="badge bg-info me-1">{reservation.menores}</span>
            menores
          </div>
          <div className="mt-1">
            <span className="badge bg-warning me-1">
              {reservation.menores3}
            </span>
            menores 3
          </div>
          <div className="mt-2">
            <small className="text-muted border-top pt-1">
              👥 Total: {reservation.totalPersonas} personas
            </small>
          </div>
        </div>
      </td>

      {/* Columna de Precio */}
      <td>
        <div className="d-flex flex-column">
          <strong className="h5 text-success">${reservation.total}</strong>
          <small className="text-muted">${getPricePerNight()}/noche</small>
          {reservation.desglosePrecios && (
            <small className="text-info mt-1">💰 Precio desglosado</small>
          )}
        </div>
      </td>

      {/* Columna de Estado */}
      <td>
        <div className="d-flex justify-content-center">
          {getStatusBadge(reservation.status)}
        </div>
      </td>

      {/* Columna de Acciones */}
      <td>
        <div className="btn-group-vertical btn-group-sm w-100">
          {getActionButtons().map((button, index) => (
            <button
              key={index}
              className={`btn ${button.className} w-100 mb-1`}
              onClick={button.action}
              title={button.title}
            >
              {button.label}
            </button>
          ))}
        </div>
      </td>
    </tr>
  );
};

export default ReservationRow;
