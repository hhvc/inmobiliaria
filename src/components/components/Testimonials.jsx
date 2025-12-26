import { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  addDoc,
} from "firebase/firestore";
import { db } from "../../firebase/config"; // Ajusta la ruta según tu estructura

const Testimonials = () => {
  const [currentTestimonial, setCurrentTestimonial] = useState(0);
  const [testimonials, setTestimonials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    author: "",
    text: "",
    email: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  // Cargar testimonios aprobados desde Firestore
  useEffect(() => {
    const fetchTestimonials = async () => {
      try {
        const q = query(
          collection(db, "testimonials"),
          where("status", "==", "approved"),
          orderBy("createdAt", "desc")
        );
        const querySnapshot = await getDocs(q);
        const testimonialsData = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          // Convertir Firestore Timestamp a Date
          createdAt: doc.data().createdAt?.toDate
            ? doc.data().createdAt.toDate()
            : new Date(doc.data().createdAt),
        }));
        setTestimonials(testimonialsData);
      } catch (error) {
        console.error("Error cargando testimonios:", error);
        // En caso de error, mostrar testimonios por defecto
        setTestimonials([
          {
            id: 1,
            text: `"Pasamos nuestra luna de miel en Siquiman, fueron dos semanas inolvidables. El lugar es precioso y fueron muy cariñosos con nosotros. Esperamos volver a verlos este verano. ¡Gracias por todo!"`,
            author: "Gastón y Marian M.",
            createdAt: new Date(),
          },
          {
            id: 2,
            text: `Gracias chicos por su buena onda, la pasamos genial. Cariños.`,
            author: "Familia Bustos Argañaraz",
            createdAt: new Date(),
          },
          {
            id: 3,
            text: `Veníamos buscando hace tiempo un lugar para escaparnos un finde y recargar las pilas, y lo encontramos. Pasamos un finde hermoso, muchas gracias.`,
            author: "dr Pepe Carena y familia",
            createdAt: new Date(),
          },
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchTestimonials();
  }, []);

  // Auto-rotate testimonials
  useEffect(() => {
    if (testimonials.length === 0) return;

    const interval = setInterval(() => {
      setCurrentTestimonial((prev) => (prev + 1) % testimonials.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [testimonials.length]);

  const handleSubmitTestimonial = async (e) => {
    e.preventDefault();
    if (!formData.author.trim() || !formData.text.trim()) {
      setMessage("Por favor completa todos los campos obligatorios");
      return;
    }

    setSubmitting(true);
    setMessage("");

    try {
      const testimonialData = {
        author: formData.author.trim(),
        text: formData.text.trim(),
        email: formData.email.trim() || "",
        status: "pending",
        createdAt: new Date(),
      };

      // CORRECCIÓN: Guardar en Firestore
      await addDoc(collection(db, "testimonials"), testimonialData);

      setMessage(
        "¡Gracias por tu comentario! Será revisado antes de publicarse."
      );
      setFormData({ author: "", text: "", email: "" });
      setShowForm(false);
    } catch (error) {
      console.error("Error enviando testimonio:", error);
      setMessage("Error al enviar el comentario. Intenta nuevamente.");
    } finally {
      setSubmitting(false);
    }
  };

  const nextTestimonial = () => {
    if (testimonials.length === 0) return;
    setCurrentTestimonial((prev) => (prev + 1) % testimonials.length);
  };

  const prevTestimonial = () => {
    if (testimonials.length === 0) return;
    setCurrentTestimonial(
      (prev) => (prev - 1 + testimonials.length) % testimonials.length
    );
  };

  const goToTestimonial = (index) => {
    if (testimonials.length === 0) return;
    setCurrentTestimonial(index);
  };

  if (loading) {
    return (
      <section id="press" className="testimonials bg-light py-5">
        <div className="container">
          <div className="row">
            <div className="col-lg-12 text-center mb-4">
              <h2>Los saludos de los huéspedes</h2>
            </div>
          </div>
          <div className="row">
            <div className="col-lg-8 mx-auto text-center">
              <div className="spinner-border" role="status">
                <span className="visually-hidden">Cargando...</span>
              </div>
              <p className="mt-2">Cargando comentarios...</p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="press" className="testimonials bg-light py-5">
      <div className="container">
        <div className="row">
          <div className="col-lg-12 text-center mb-4">
            <h2>Los saludos de los huéspedes</h2>
            <p className="text-muted">
              Comentarios de nuestros huéspedes - ¿Ya nos visitaste?{" "}
              <button
                className="btn btn-link p-0 text-primary"
                onClick={() => setShowForm(!showForm)}
                style={{ textDecoration: "underline" }}
              >
                ¡Deja tu comentario!
              </button>
            </p>
          </div>
        </div>

        {/* Formulario para nuevo testimonio */}
        {showForm && (
          <div className="row mb-5">
            <div className="col-lg-8 mx-auto">
              <div className="card shadow-sm">
                <div className="card-header bg-primary text-white">
                  <h5 className="mb-0">Deja tu comentario</h5>
                </div>
                <div className="card-body">
                  <form onSubmit={handleSubmitTestimonial}>
                    <div className="mb-3">
                      <label className="form-label">
                        <strong>Tu nombre *</strong>
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        value={formData.author}
                        onChange={(e) =>
                          setFormData({ ...formData, author: e.target.value })
                        }
                        required
                        placeholder="Ej: María González"
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">
                        <strong>Tu email (opcional)</strong>
                      </label>
                      <input
                        type="email"
                        className="form-control"
                        value={formData.email}
                        onChange={(e) =>
                          setFormData({ ...formData, email: e.target.value })
                        }
                        placeholder="tucorreo@ejemplo.com"
                      />
                      <small className="form-text text-muted">
                        Tu email no será publicado, solo lo usaremos para
                        verificaciones.
                      </small>
                    </div>
                    <div className="mb-3">
                      <label className="form-label">
                        <strong>Tu comentario *</strong>
                      </label>
                      <textarea
                        className="form-control"
                        rows="4"
                        value={formData.text}
                        onChange={(e) =>
                          setFormData({ ...formData, text: e.target.value })
                        }
                        required
                        placeholder="Comparte tu experiencia, qué te gustó, recomendaciones..."
                        maxLength="500"
                      />
                      <small className="form-text text-muted">
                        {formData.text.length}/500 caracteres
                      </small>
                    </div>
                    <div className="d-flex gap-2">
                      <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={submitting}
                      >
                        {submitting ? (
                          <>
                            <span className="spinner-border spinner-border-sm me-2" />
                            Enviando...
                          </>
                        ) : (
                          "📨 Enviar comentario"
                        )}
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline-secondary"
                        onClick={() => {
                          setShowForm(false);
                          setMessage("");
                        }}
                        disabled={submitting}
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                  {message && (
                    <div
                      className={`alert ${
                        message.includes("Error")
                          ? "alert-danger"
                          : "alert-success"
                      } mt-3`}
                    >
                      {message}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {testimonials.length === 0 ? (
          <div className="row">
            <div className="col-lg-8 mx-auto text-center">
              <div className="alert alert-info">
                <p>Aún no hay comentarios publicados.</p>
                <button
                  className="btn btn-primary"
                  onClick={() => setShowForm(true)}
                >
                  Sé el primero en comentar
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="row">
            <div className="col-lg-8 mx-auto">
              <div className="testimonials-carousel text-center">
                <div className="testimonial-item">
                  <div className="quote-container bg-white p-4 rounded shadow-sm">
                    <p className="quote fs-5" style={{ fontStyle: "italic" }}>
                      "{testimonials[currentTestimonial].text}"
                    </p>
                  </div>
                  <div className="testimonial-info mt-3">
                    <span className="name fw-bold fs-6">
                      {testimonials[currentTestimonial].author}
                    </span>
                    {testimonials[currentTestimonial].createdAt && (
                      <small className="d-block text-muted mt-1">
                        {testimonials[
                          currentTestimonial
                        ].createdAt.toLocaleDateString("es-ES", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </small>
                    )}
                  </div>
                </div>
              </div>

              {/* Controles del carrusel */}
              {testimonials.length > 1 && (
                <div className="mt-4 text-center">
                  {/* Indicadores */}
                  <div className="mb-3 d-flex justify-content-center">
                    {testimonials.map((_, index) => (
                      <button
                        key={index}
                        onClick={() => goToTestimonial(index)}
                        className={`btn btn-sm rounded-circle ${
                          currentTestimonial === index
                            ? "bg-primary"
                            : "bg-secondary"
                        }`}
                        style={{
                          width: "12px",
                          height: "12px",
                          margin: "0 5px",
                          border: "none",
                          cursor: "pointer",
                        }}
                        aria-label={`Ir al testimonio ${index + 1}`}
                      />
                    ))}
                  </div>

                  {/* Botones de navegación */}
                  <div className="d-flex justify-content-center">
                    <button
                      onClick={prevTestimonial}
                      className="btn btn-outline-primary me-2"
                    >
                      ← Anterior
                    </button>
                    <button
                      onClick={nextTestimonial}
                      className="btn btn-outline-primary"
                    >
                      Siguiente →
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Invitación para dejar comentario al final */}
        {!showForm && testimonials.length > 0 && (
          <div className="row mt-4">
            <div className="col-lg-8 mx-auto text-center">
              <button
                className="btn btn-outline-primary"
                onClick={() => setShowForm(true)}
              >
                ✍️ ¿Tú también nos visitaste? ¡Cuéntanos tu experiencia!
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default Testimonials;
