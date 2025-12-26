// components/admin/ContactMessages.jsx
import { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  query,
  orderBy,
  updateDoc,
  doc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "../../firebase/config";
import { useAuth } from "../../context/auth/useAuth";

// Configuración de estados CRM
const STATUS_OPTIONS = [
  { value: "nuevo", label: "🆕 Nuevo", color: "bg-primary" },
  { value: "en_gestion", label: "🔄 En Gestión", color: "bg-info" },
  { value: "contactado", label: "📞 Contactado", color: "bg-success" },
  { value: "interesado", label: "⭐ Interesado", color: "bg-warning" },
  {
    value: "propuesta_enviada",
    label: "📄 Propuesta Enviada",
    color: "bg-purple",
  },
  { value: "negociacion", label: "💼 Negociación", color: "bg-orange" },
  { value: "ganado", label: "✅ Ganado", color: "bg-success" },
  { value: "perdido", label: "❌ Perdido", color: "bg-danger" },
];

const FOLLOW_UP_TYPES = [
  { value: "llamada", label: "📞 Llamada" },
  { value: "email", label: "📧 Email" },
  { value: "reunion", label: "👥 Reunión" },
  { value: "propuesta", label: "📄 Enviar Propuesta" },
  { value: "seguimiento", label: "🔄 Seguimiento" },
];

// Función auxiliar para manejar fechas de Firestore
const getFirestoreDate = (firestoreTimestamp) => {
  if (!firestoreTimestamp) return null;

  // Si es un objeto Timestamp de Firestore con método toDate
  if (typeof firestoreTimestamp.toDate === "function") {
    return firestoreTimestamp.toDate();
  }

  // Si es un objeto Timestamp con propiedades seconds/nanoseconds
  if (firestoreTimestamp.seconds !== undefined) {
    return new Date(firestoreTimestamp.seconds * 1000);
  }

  // Si ya es un objeto Date
  if (firestoreTimestamp instanceof Date) {
    return firestoreTimestamp;
  }

  // Si es un string de fecha
  if (typeof firestoreTimestamp === "string") {
    return new Date(firestoreTimestamp);
  }

  console.warn("Formato de fecha no reconocido:", firestoreTimestamp);
  return null;
};

const ContactMessages = () => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [activeTab, setActiveTab] = useState("info");
  const [newNote, setNewNote] = useState("");
  const [scheduledFollowUp, setScheduledFollowUp] = useState("");
  const [followUpType, setFollowUpType] = useState("seguimiento");
  const { hasRole } = useAuth();

  useEffect(() => {
    if (!hasRole("admin")) return;

    const fetchMessages = async () => {
      try {
        const q = query(
          collection(db, "contactMessages"),
          orderBy("createdAt", "desc")
        );
        const querySnapshot = await getDocs(q);
        const messagesData = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setMessages(messagesData);
      } catch (error) {
        console.error("Error cargando mensajes:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();
  }, [hasRole]);

  const updateStatus = async (messageId, newStatus) => {
    try {
      await updateDoc(doc(db, "contactMessages", messageId), {
        status: newStatus,
        lastUpdated: serverTimestamp(),
      });

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId ? { ...msg, status: newStatus } : msg
        )
      );

      setSelectedMessage((prev) =>
        prev ? { ...prev, status: newStatus } : null
      );
    } catch (error) {
      console.error("Error actualizando estado:", error);
    }
  };

  const addNote = async (messageId) => {
    if (!newNote.trim()) return;

    try {
      const note = {
        content: newNote,
        createdAt: serverTimestamp(),
        createdBy: "admin",
        type: "note",
      };

      const messageRef = doc(db, "contactMessages", messageId);
      const currentMessage = messages.find((msg) => msg.id === messageId);
      const updatedNotes = [...(currentMessage.notes || []), note];

      await updateDoc(messageRef, {
        notes: updatedNotes,
        lastUpdated: serverTimestamp(),
      });

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId ? { ...msg, notes: updatedNotes } : msg
        )
      );

      setSelectedMessage((prev) =>
        prev ? { ...prev, notes: updatedNotes } : null
      );

      setNewNote("");
    } catch (error) {
      console.error("Error agregando nota:", error);
    }
  };

  const scheduleFollowUp = async (messageId) => {
    if (!scheduledFollowUp) return;

    try {
      // Convertir a Timestamp de Firestore
      const followUpTimestamp = Timestamp.fromDate(new Date(scheduledFollowUp));

      await updateDoc(doc(db, "contactMessages", messageId), {
        scheduledFollowUp: followUpTimestamp,
        followUpType: followUpType,
        followUpStatus: "programado",
        lastUpdated: serverTimestamp(),
      });

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId
            ? {
                ...msg,
                scheduledFollowUp: followUpTimestamp,
                followUpType: followUpType,
                followUpStatus: "programado",
              }
            : msg
        )
      );

      setSelectedMessage((prev) =>
        prev
          ? {
              ...prev,
              scheduledFollowUp: followUpTimestamp,
              followUpType: followUpType,
              followUpStatus: "programado",
            }
          : null
      );

      setScheduledFollowUp("");
      setFollowUpType("seguimiento");
    } catch (error) {
      console.error("Error programando seguimiento:", error);
    }
  };

  const completeFollowUp = async (messageId) => {
    try {
      await updateDoc(doc(db, "contactMessages", messageId), {
        followUpStatus: "completado",
        lastUpdated: serverTimestamp(),
      });

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId ? { ...msg, followUpStatus: "completado" } : msg
        )
      );

      setSelectedMessage((prev) =>
        prev ? { ...prev, followUpStatus: "completado" } : null
      );
    } catch (error) {
      console.error("Error completando seguimiento:", error);
    }
  };

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
      <div className="container mt-4">
        <div className="text-center">
          <div className="spinner-border" role="status">
            <span className="visually-hidden">Cargando...</span>
          </div>
          <p className="mt-2">Cargando contactos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid mt-4">
      <div className="row">
        <div className="col-12">
          <h1>👥 CRM - Gestión de Contactos</h1>
          <p className="text-muted">
            Total: {messages.length} contactos | Nuevos:{" "}
            {messages.filter((m) => m.status === "nuevo").length} | En gestión:{" "}
            {messages.filter((m) => m.status === "en_gestion").length}
          </p>
        </div>
      </div>

      <div className="row">
        {/* Lista de contactos */}
        <div className="col-md-4">
          <div className="card">
            <div className="card-header">
              <h5 className="mb-0">📋 Lista de Contactos</h5>
            </div>
            <div className="card-body p-0">
              <div className="list-group list-group-flush">
                {messages.map((message) => {
                  const status =
                    STATUS_OPTIONS.find((s) => s.value === message.status) ||
                    STATUS_OPTIONS[0];
                  const followUpDate = getFirestoreDate(
                    message.scheduledFollowUp
                  );
                  const createdDate = getFirestoreDate(message.createdAt);

                  return (
                    <button
                      key={message.id}
                      className={`list-group-item list-group-item-action ${
                        selectedMessage?.id === message.id ? "active" : ""
                      }`}
                      onClick={() => setSelectedMessage(message)}
                    >
                      <div className="d-flex w-100 justify-content-between align-items-start">
                        <h6 className="mb-1">{message.name}</h6>
                        <small>
                          {createdDate
                            ? createdDate.toLocaleDateString()
                            : "Fecha no disponible"}
                        </small>
                      </div>
                      <p className="mb-1 text-truncate small">
                        {message.email}
                      </p>
                      <div className="d-flex justify-content-between align-items-center">
                        <span className={`badge ${status.color} text-white`}>
                          {status.label}
                        </span>
                        {followUpDate && (
                          <small className="text-muted">
                            📅 {followUpDate.toLocaleDateString()}
                          </small>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Detalles del contacto */}
        <div className="col-md-8">
          {selectedMessage ? (
            <div className="card">
              <div className="card-header">
                <ul className="nav nav-tabs card-header-tabs">
                  <li className="nav-item">
                    <button
                      className={`nav-link ${
                        activeTab === "info" ? "active" : ""
                      }`}
                      onClick={() => setActiveTab("info")}
                    >
                      📋 Información
                    </button>
                  </li>
                  <li className="nav-item">
                    <button
                      className={`nav-link ${
                        activeTab === "notes" ? "active" : ""
                      }`}
                      onClick={() => setActiveTab("notes")}
                    >
                      📝 Notas
                    </button>
                  </li>
                  <li className="nav-item">
                    <button
                      className={`nav-link ${
                        activeTab === "followup" ? "active" : ""
                      }`}
                      onClick={() => setActiveTab("followup")}
                    >
                      📅 Seguimiento
                    </button>
                  </li>
                </ul>
              </div>

              <div className="card-body">
                {/* Pestaña de Información */}
                {activeTab === "info" && (
                  <div>
                    <div className="row mb-3">
                      <div className="col-md-6">
                        <h5>Información de Contacto</h5>
                        <p>
                          <strong>👤 Nombre:</strong> {selectedMessage.name}
                        </p>
                        <p>
                          <strong>📧 Email:</strong> {selectedMessage.email}
                        </p>
                        <p>
                          <strong>📞 Teléfono:</strong>{" "}
                          {selectedMessage.phone || "No proporcionado"}
                        </p>
                        <p>
                          <strong>📅 Fecha de contacto:</strong>{" "}
                          {getFirestoreDate(
                            selectedMessage.createdAt
                          )?.toLocaleString() || "Fecha no disponible"}
                        </p>
                      </div>
                      <div className="col-md-6">
                        <h5>Gestión</h5>
                        <div className="mb-3">
                          <label className="form-label">
                            <strong>Estado:</strong>
                          </label>
                          <select
                            className="form-select"
                            value={selectedMessage.status || "nuevo"}
                            onChange={(e) =>
                              updateStatus(selectedMessage.id, e.target.value)
                            }
                          >
                            {STATUS_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="mb-3">
                      <strong>💬 Mensaje original:</strong>
                      <div className="bg-light p-3 rounded mt-2">
                        {selectedMessage.message}
                      </div>
                    </div>

                    <div className="mt-3">
                      <a
                        href={`mailto:${selectedMessage.email}`}
                        className="btn btn-primary me-2"
                      >
                        📧 Responder
                      </a>
                      <a
                        href={`tel:${selectedMessage.phone}`}
                        className="btn btn-outline-primary me-2"
                      >
                        📞 Llamar
                      </a>
                      <button
                        className="btn btn-outline-info"
                        onClick={() => setActiveTab("followup")}
                      >
                        📅 Programar Seguimiento
                      </button>
                    </div>
                  </div>
                )}

                {/* Pestaña de Notas */}
                {activeTab === "notes" && (
                  <div>
                    <h5>📝 Notas y Comentarios</h5>

                    {/* Lista de notas existentes */}
                    <div className="mb-4">
                      {selectedMessage.notes?.length > 0 ? (
                        selectedMessage.notes
                          .sort((a, b) => {
                            const dateA = getFirestoreDate(a.createdAt);
                            const dateB = getFirestoreDate(b.createdAt);
                            return (dateB || 0) - (dateA || 0);
                          })
                          .map((note, index) => (
                            <div key={index} className="card mb-2">
                              <div className="card-body">
                                <p className="mb-1">{note.content}</p>
                                <small className="text-muted">
                                  {getFirestoreDate(
                                    note.createdAt
                                  )?.toLocaleString() || "Fecha no disponible"}
                                </small>
                              </div>
                            </div>
                          ))
                      ) : (
                        <p className="text-muted">No hay notas aún.</p>
                      )}
                    </div>

                    {/* Agregar nueva nota */}
                    <div className="card">
                      <div className="card-body">
                        <h6>Agregar Nueva Nota</h6>
                        <textarea
                          className="form-control mb-2"
                          rows="3"
                          placeholder="Escribe tus notas aquí..."
                          value={newNote}
                          onChange={(e) => setNewNote(e.target.value)}
                        />
                        <button
                          className="btn btn-primary"
                          onClick={() => addNote(selectedMessage.id)}
                          disabled={!newNote.trim()}
                        >
                          ➕ Agregar Nota
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Pestaña de Seguimiento */}
                {activeTab === "followup" && (
                  <div>
                    <h5>📅 Gestión de Seguimientos</h5>

                    {/* Seguimiento programado actual */}
                    {selectedMessage.scheduledFollowUp && (
                      <div className="card mb-4">
                        <div className="card-body">
                          <h6>Seguimiento Programado</h6>
                          <p>
                            <strong>Tipo:</strong>{" "}
                            {FOLLOW_UP_TYPES.find(
                              (f) => f.value === selectedMessage.followUpType
                            )?.label || "Seguimiento"}
                          </p>
                          <p>
                            <strong>Fecha:</strong>{" "}
                            {getFirestoreDate(
                              selectedMessage.scheduledFollowUp
                            )?.toLocaleString() || "Fecha no disponible"}
                          </p>
                          <p>
                            <strong>Estado:</strong>
                            <span
                              className={`badge ${
                                selectedMessage.followUpStatus === "vencido"
                                  ? "bg-danger"
                                  : selectedMessage.followUpStatus ===
                                    "completado"
                                  ? "bg-success"
                                  : "bg-warning"
                              } ms-2`}
                            >
                              {selectedMessage.followUpStatus || "programado"}
                            </span>
                          </p>

                          {selectedMessage.followUpStatus !== "completado" && (
                            <button
                              className="btn btn-success btn-sm"
                              onClick={() =>
                                completeFollowUp(selectedMessage.id)
                              }
                            >
                              ✅ Marcar como Completado
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Programar nuevo seguimiento */}
                    <div className="card">
                      <div className="card-body">
                        <h6>Programar Nuevo Seguimiento</h6>
                        <div className="row">
                          <div className="col-md-6">
                            <label className="form-label">
                              Tipo de Seguimiento
                            </label>
                            <select
                              className="form-select"
                              value={followUpType}
                              onChange={(e) => setFollowUpType(e.target.value)}
                            >
                              {FOLLOW_UP_TYPES.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="col-md-6">
                            <label className="form-label">Fecha y Hora</label>
                            <input
                              type="datetime-local"
                              className="form-control"
                              value={scheduledFollowUp}
                              onChange={(e) =>
                                setScheduledFollowUp(e.target.value)
                              }
                            />
                          </div>
                        </div>
                        <button
                          className="btn btn-primary mt-3"
                          onClick={() => scheduleFollowUp(selectedMessage.id)}
                          disabled={!scheduledFollowUp}
                        >
                          📅 Programar Seguimiento
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center text-muted py-5">
              <h4>Selecciona un contacto para ver los detalles</h4>
              <p>Gestiona el estado, agrega notas y programa seguimientos.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ContactMessages;
