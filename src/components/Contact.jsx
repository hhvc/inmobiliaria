import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";

import { useContactForm } from "../hooks/useContactForm";

const CONTACT_EMAIL = "hectorvazquez.laboral@gmail.com";
const CONTACT_PHONE_DISPLAY = "+54 351 9 5478785";
const CONTACT_WHATSAPP_NUMBER = "54935195478785";

const buildWhatsappUrl = () => {
  const message = [
    "Hola, quiero recibir información sobre ONO Prop.",
    "Me interesa conocer cómo funciona la plataforma para inmobiliarias.",
  ].join("\n");

  return `https://wa.me/${CONTACT_WHATSAPP_NUMBER}?text=${encodeURIComponent(
    message,
  )}`;
};

const Contact = () => {
  const location = useLocation();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    message: "",
  });

  const [errors, setErrors] = useState({});
  const { loading, error, success, submitContactForm } = useContactForm();

  useEffect(() => {
    if (location.state?.prefillMessage) {
      setFormData((prev) => ({
        ...prev,
        message: location.state.prefillMessage,
      }));
    }
  }, [location.state]);

  const whatsappUrl = buildWhatsappUrl();

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = "Por favor ingresá tu nombre o el de tu inmobiliaria.";
    }

    if (!formData.email.trim()) {
      newErrors.email = "Por favor ingresá tu email.";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Por favor ingresá un email válido.";
    }

    if (!formData.phone.trim()) {
      newErrors.phone = "Por favor ingresá tu teléfono o WhatsApp.";
    }

    if (!formData.message.trim()) {
      newErrors.message = "Por favor escribí un mensaje.";
    }

    setErrors(newErrors);

    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    const wasSent = await submitContactForm({
      ...formData,
      source: "ONO Prop - Página de inicio",
    });

    if (wasSent) {
      setFormData({
        name: "",
        email: "",
        phone: "",
        message: "",
      });
    }
  };

  return (
    <section id="contact" className="section-transparent">
      <div className="container section-panel">
        <div className="row justify-content-center text-center mb-5">
          <div className="col-lg-8">
            <p className="text-uppercase text-muted small mb-1">
              Contacto comercial
            </p>

            <h2 className="portal-section-title mb-3">
              Hablemos sobre tu inmobiliaria.
            </h2>

            <p className="lead text-muted mb-0">
              Contanos qué necesitás publicar, cómo trabajás hoy y qué tipo de
              presencia digital querés construir. Te respondemos para coordinar
              una demo o una primera implementación.
            </p>
          </div>
        </div>

        <div className="row g-4 align-items-stretch">
          <div className="col-lg-7">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body p-4 p-lg-5">
                <h3 className="h4 mb-3">Solicitar información</h3>

                <p className="text-muted mb-4">
                  Completá el formulario y te contactamos para evaluar si ONO
                  Prop se adapta a tu inmobiliaria, equipo o proyecto comercial.
                </p>

                <form onSubmit={handleSubmit} noValidate>
                  <div className="mb-3">
                    <label htmlFor="name" className="form-label">
                      Nombre / Inmobiliaria
                    </label>

                    <input
                      type="text"
                      className={`form-control ${errors.name ? "is-invalid" : ""
                        }`}
                      id="name"
                      name="name"
                      placeholder="Ej: Juan Pérez / Inmobiliaria Centro"
                      value={formData.name}
                      onChange={handleChange}
                      required
                    />

                    {errors.name && (
                      <div className="invalid-feedback">{errors.name}</div>
                    )}
                  </div>

                  <div className="mb-3">
                    <label htmlFor="email" className="form-label">
                      Email
                    </label>

                    <input
                      type="email"
                      className={`form-control ${errors.email ? "is-invalid" : ""
                        }`}
                      id="email"
                      name="email"
                      placeholder="tuemail@dominio.com"
                      value={formData.email}
                      onChange={handleChange}
                      required
                    />

                    {errors.email && (
                      <div className="invalid-feedback">{errors.email}</div>
                    )}
                  </div>

                  <div className="mb-3">
                    <label htmlFor="phone" className="form-label">
                      Teléfono / WhatsApp
                    </label>

                    <input
                      type="tel"
                      className={`form-control ${errors.phone ? "is-invalid" : ""
                        }`}
                      id="phone"
                      name="phone"
                      placeholder="Incluí código de país si estás fuera de Argentina"
                      value={formData.phone}
                      onChange={handleChange}
                      required
                    />

                    {errors.phone && (
                      <div className="invalid-feedback">{errors.phone}</div>
                    )}
                  </div>

                  <div className="mb-3">
                    <label htmlFor="message" className="form-label">
                      Mensaje
                    </label>

                    <textarea
                      className={`form-control ${errors.message ? "is-invalid" : ""
                        }`}
                      id="message"
                      name="message"
                      rows="5"
                      placeholder="Contanos cuántas propiedades publicás, si necesitás dominio propio, sitio para tu inmobiliaria o gestión de consultas."
                      value={formData.message}
                      onChange={handleChange}
                      required
                    />

                    {errors.message && (
                      <div className="invalid-feedback">{errors.message}</div>
                    )}
                  </div>

                  {success && (
                    <div className="alert alert-success">
                      ¡Mensaje enviado correctamente! Te responderemos a la
                      brevedad.
                    </div>
                  )}

                  {error && <div className="alert alert-danger">{error}</div>}

                  <div className="d-flex flex-wrap gap-2">
                    <button
                      type="submit"
                      className="btn btn-primary px-4"
                      disabled={loading}
                    >
                      {loading ? (
                        <>
                          <span
                            className="spinner-border spinner-border-sm me-2"
                            role="status"
                            aria-hidden="true"
                          />
                          Enviando...
                        </>
                      ) : (
                        "Enviar consulta"
                      )}
                    </button>

                    <a
                      href={whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-outline-success"
                    >
                      Escribir por WhatsApp
                    </a>
                  </div>
                </form>
              </div>
            </div>
          </div>

          <div className="col-lg-5">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body p-4 p-lg-5">
                <p className="text-uppercase text-muted small mb-1">
                  ONO Prop
                </p>

                <h3 className="h4 mb-3">
                  Plataforma inmobiliaria para equipos que quieren crecer.
                </h3>

                <p className="text-muted">
                  ONO Prop está pensado para inmobiliarias, desarrollistas y
                  equipos comerciales que necesitan publicar propiedades,
                  ordenar consultas y construir una presencia digital más
                  profesional.
                </p>

                <div className="vstack gap-3 mt-4">
                  <div className="p-3 rounded border bg-white">
                    <div className="small text-muted mb-1">Email</div>
                    <a
                      href={`mailto:${CONTACT_EMAIL}`}
                      className="fw-semibold text-decoration-none"
                    >
                      {CONTACT_EMAIL}
                    </a>
                  </div>

                  <div className="p-3 rounded border bg-white">
                    <div className="small text-muted mb-1">
                      WhatsApp comercial
                    </div>
                    <a
                      href={whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="fw-semibold text-decoration-none"
                    >
                      {CONTACT_PHONE_DISPLAY}
                    </a>
                  </div>

                  <div className="p-3 rounded border bg-white">
                    <div className="small text-muted mb-1">Modalidad</div>
                    <div className="fw-semibold">
                      Atención online para inmobiliarias
                    </div>
                    <div className="small text-muted mt-1">
                      Plataforma preparada para operar con clientes de distintos
                      países.
                    </div>
                  </div>
                </div>

                <hr />

                <div className="small text-muted">
                  Por ahora no publicamos una dirección física en la landing
                  principal para mantener una imagen comercial más internacional.
                  Los datos legales o fiscales pueden incorporarse luego en una
                  página específica.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Contact;