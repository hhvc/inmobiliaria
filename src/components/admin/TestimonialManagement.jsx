// components/admin/TestimonialManagement.jsx
import { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  updateDoc,
  doc,
  query,
  where,
  orderBy,
  deleteDoc,
} from "firebase/firestore";
import { db } from "../../firebase/config";
import { useAuth } from "../../context/auth/useAuth";

const TestimonialManagement = () => {
  const [testimonials, setTestimonials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("pending"); // pending, approved, rejected
  const { hasRole } = useAuth();

  // Cargar testimonios según el filtro
  useEffect(() => {
    const fetchTestimonials = async () => {
      try {
        let q;
        if (filter === "all") {
          q = query(
            collection(db, "testimonials"),
            orderBy("createdAt", "desc")
          );
        } else {
          q = query(
            collection(db, "testimonials"),
            where("status", "==", filter),
            orderBy("createdAt", "desc")
          );
        }

        const querySnapshot = await getDocs(q);
        const testimonialsData = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setTestimonials(testimonialsData);
      } catch (error) {
        console.error("Error cargando testimonios:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTestimonials();
  }, [filter]);

  const updateTestimonialStatus = async (testimonialId, newStatus) => {
    try {
      const testimonialRef = doc(db, "testimonials", testimonialId);
      await updateDoc(testimonialRef, {
        status: newStatus,
        reviewedAt: new Date(),
        reviewedBy: "admin", // Podrías usar el usuario actual
      });

      // Actualizar el estado local
      setTestimonials((prev) =>
        prev.filter((testimonial) => testimonial.id !== testimonialId)
      );
    } catch (error) {
      console.error("Error actualizando testimonio:", error);
      alert("Error al actualizar el testimonio");
    }
  };

  const deleteTestimonial = async (testimonialId) => {
    if (
      !window.confirm("¿Estás seguro de que quieres eliminar este testimonio?")
    ) {
      return;
    }

    try {
      await deleteDoc(doc(db, "testimonials", testimonialId));
      setTestimonials((prev) =>
        prev.filter((testimonial) => testimonial.id !== testimonialId)
      );
    } catch (error) {
      console.error("Error eliminando testimonio:", error);
      alert("Error al eliminar el testimonio");
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: "warning",
      approved: "success",
      rejected: "danger",
    };
    const texts = {
      pending: "Pendiente",
      approved: "Aprobado",
      rejected: "Rechazado",
    };
    return (
      <span className={`badge bg-${badges[status]}`}>{texts[status]}</span>
    );
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
          <p className="mt-2">Cargando comentarios...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mt-4">
      <div className="row">
        <div className="col-12">
          <div className="d-flex justify-content-between align-items-center mb-4">
            <div>
              <h1>💬 Gestión de Comentarios</h1>
              <p className="text-muted mb-0">
                Revisa y modera los comentarios de los huéspedes
              </p>
            </div>
            <div className="text-end">
              <small className="text-muted d-block">
                Total: <strong>{testimonials.length}</strong> comentarios
              </small>
            </div>
          </div>

          {/* Filtros */}
          <div className="card mb-4">
            <div className="card-body">
              <div className="row align-items-center">
                <div className="col-md-6">
                  <label className="form-label fw-bold">
                    Filtrar por estado:
                  </label>
                  <select
                    className="form-select"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  >
                    <option value="pending">Pendientes de revisión</option>
                    <option value="approved">Aprobados</option>
                    <option value="rejected">Rechazados</option>
                    <option value="all">Todos los comentarios</option>
                  </select>
                </div>
                <div className="col-md-6">
                  <div className="bg-light p-3 rounded">
                    <small className="text-muted">
                      <strong>Estadísticas rápidas:</strong>
                      <br />• Pendientes:{" "}
                      {
                        testimonials.filter((t) => t.status === "pending")
                          .length
                      }
                      <br />• Aprobados:{" "}
                      {
                        testimonials.filter((t) => t.status === "approved")
                          .length
                      }
                      <br />• Rechazados:{" "}
                      {
                        testimonials.filter((t) => t.status === "rejected")
                          .length
                      }
                    </small>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Lista de testimonios */}
          {testimonials.length === 0 ? (
            <div className="text-center py-5">
              <div className="alert alert-info">
                <h4>
                  ✅ No hay comentarios{" "}
                  {filter !== "all" ? `con estado "${filter}"` : ""}
                </h4>
                <p className="mb-0">
                  {filter === "pending"
                    ? "Todos los comentarios han sido revisados."
                    : "No se encontraron comentarios con este filtro."}
                </p>
              </div>
            </div>
          ) : (
            <div className="row">
              {testimonials.map((testimonial) => (
                <div key={testimonial.id} className="col-12 mb-4">
                  <div className="card">
                    <div className="card-header d-flex justify-content-between align-items-center">
                      <div>
                        <strong>{testimonial.author}</strong>
                        {testimonial.email && (
                          <small className="text-muted ms-2">
                            ({testimonial.email})
                          </small>
                        )}
                      </div>
                      <div>
                        {getStatusBadge(testimonial.status)}
                        <small className="text-muted ms-2">
                          {testimonial.createdAt
                            ?.toDate?.()
                            ?.toLocaleDateString() ||
                            new Date(
                              testimonial.createdAt?.seconds * 1000
                            ).toLocaleDateString()}
                        </small>
                      </div>
                    </div>
                    <div className="card-body">
                      <p className="card-text">{testimonial.text}</p>

                      {testimonial.status === "pending" && (
                        <div className="mt-3">
                          <button
                            className="btn btn-success btn-sm me-2"
                            onClick={() =>
                              updateTestimonialStatus(
                                testimonial.id,
                                "approved"
                              )
                            }
                          >
                            ✅ Aprobar
                          </button>
                          <button
                            className="btn btn-danger btn-sm me-2"
                            onClick={() =>
                              updateTestimonialStatus(
                                testimonial.id,
                                "rejected"
                              )
                            }
                          >
                            ❌ Rechazar
                          </button>
                          <button
                            className="btn btn-outline-danger btn-sm"
                            onClick={() => deleteTestimonial(testimonial.id)}
                          >
                            🗑️ Eliminar
                          </button>
                        </div>
                      )}

                      {testimonial.status !== "pending" && (
                        <div className="mt-3">
                          <small className="text-muted">
                            Revisado el:{" "}
                            {testimonial.reviewedAt
                              ?.toDate?.()
                              ?.toLocaleDateString() ||
                              new Date(
                                testimonial.reviewedAt?.seconds * 1000
                              ).toLocaleDateString()}
                          </small>
                          <div className="mt-2">
                            <button
                              className="btn btn-outline-warning btn-sm me-2"
                              onClick={() =>
                                updateTestimonialStatus(
                                  testimonial.id,
                                  "pending"
                                )
                              }
                            >
                              ↩️ Volver a pendiente
                            </button>
                            <button
                              className="btn btn-outline-danger btn-sm"
                              onClick={() => deleteTestimonial(testimonial.id)}
                            >
                              🗑️ Eliminar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TestimonialManagement;
