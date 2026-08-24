import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../../context/auth/useAuth";
import { savePortalSearchAlert } from "../services/portalDemand.service";
import { hasMeaningfulPortalSearch } from "../utils/portalSearch.helpers";

const PortalSearchAlertModal = ({ open, filters, onClose }) => {
    const { user } = useAuth();
    const [email, setEmail] = useState("");
    const [frequency, setFrequency] = useState("daily");
    const [consentAccepted, setConsentAccepted] = useState(false);
    const [honeypot, setHoneypot] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    useEffect(() => {
        if (!open) return;

        setEmail(user?.email || "");
        setFrequency("daily");
        setConsentAccepted(false);
        setHoneypot("");
        setLoading(false);
        setError("");
        setSuccess("");
    }, [open, user?.email]);

    useEffect(() => {
        if (!open) return undefined;

        const handleEscape = (event) => {
            if (event.key === "Escape" && !loading) onClose();
        };

        document.addEventListener("keydown", handleEscape);
        return () => document.removeEventListener("keydown", handleEscape);
    }, [loading, onClose, open]);

    if (!open) return null;

    const hasCriteria = hasMeaningfulPortalSearch(filters);

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError("");
        setSuccess("");

        if (!hasCriteria) {
            setError("Elegí al menos un filtro antes de guardar la búsqueda.");
            return;
        }

        if (!consentAccepted) {
            setError("Aceptá el envío de alertas para continuar.");
            return;
        }

        try {
            setLoading(true);
            const result = await savePortalSearchAlert({
                email,
                filters,
                frequency,
                consentAccepted,
                honeypot,
            });

            setSuccess(result?.alreadyActive
                ? "La búsqueda ya estaba activa. Actualizamos su frecuencia."
                : "Te enviamos un email. Confirmá el enlace para activar la alerta.");
        } catch (err) {
            setError(err.message || "No se pudo guardar la búsqueda.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            className="portal-modal-backdrop"
            role="presentation"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget && !loading) onClose();
            }}
        >
            <section
                className="portal-modal-card card border-0 shadow-lg"
                role="dialog"
                aria-modal="true"
                aria-labelledby="portal-alert-title"
            >
                <div className="card-body p-4 p-lg-5">
                    <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
                        <div>
                            <p className="portal-eyebrow mb-1">Avisos de oportunidades</p>
                            <h2 id="portal-alert-title" className="h3 mb-0">
                                Guardar esta búsqueda
                            </h2>
                        </div>
                        <button
                            type="button"
                            className="btn-close"
                            onClick={onClose}
                            disabled={loading}
                            aria-label="Cerrar"
                        />
                    </div>

                    <p className="text-muted">
                        Te avisaremos cuando se publiquen nuevos inmuebles que coincidan con
                        los filtros actuales. Podés darte de baja desde cualquier email.
                    </p>

                    {!hasCriteria && (
                        <div className="alert alert-info">
                            Primero elegí una operación, tipo, ubicación, precio u otro filtro.
                        </div>
                    )}

                    {error && <div className="alert alert-warning">{error}</div>}
                    {success && <div className="alert alert-success">{success}</div>}

                    {!success && (
                        <form onSubmit={handleSubmit}>
                            <div className="mb-3">
                                <label className="form-label" htmlFor="portal-alert-email">
                                    Email
                                </label>
                                <input
                                    id="portal-alert-email"
                                    type="email"
                                    className="form-control"
                                    value={email}
                                    onChange={(event) => setEmail(event.target.value)}
                                    placeholder="tu@email.com"
                                    autoComplete="email"
                                    required
                                    disabled={loading}
                                />
                            </div>

                            <div className="mb-3">
                                <label className="form-label" htmlFor="portal-alert-frequency">
                                    Frecuencia máxima
                                </label>
                                <select
                                    id="portal-alert-frequency"
                                    className="form-select"
                                    value={frequency}
                                    onChange={(event) => setFrequency(event.target.value)}
                                    disabled={loading}
                                >
                                    <option value="daily">Una vez por día</option>
                                    <option value="weekly">Una vez por semana</option>
                                </select>
                                <div className="form-text">
                                    Solo enviaremos un mensaje si aparecen nuevas coincidencias.
                                </div>
                            </div>

                            <div className="portal-honeypot" aria-hidden="true">
                                <label htmlFor="portal-alert-company">Empresa</label>
                                <input
                                    id="portal-alert-company"
                                    type="text"
                                    value={honeypot}
                                    onChange={(event) => setHoneypot(event.target.value)}
                                    tabIndex="-1"
                                    autoComplete="off"
                                />
                            </div>

                            <div className="form-check mb-4">
                                <input
                                    id="portal-alert-consent"
                                    type="checkbox"
                                    className="form-check-input"
                                    checked={consentAccepted}
                                    onChange={(event) => setConsentAccepted(event.target.checked)}
                                    disabled={loading}
                                />
                                <label className="form-check-label small" htmlFor="portal-alert-consent">
                                    Acepto recibir alertas de esta búsqueda y el tratamiento de mi
                                    email según la <Link to="/privacidad">Política de privacidad</Link>.
                                </label>
                            </div>

                            <button
                                type="submit"
                                className="btn btn-primary w-100"
                                disabled={loading || !hasCriteria}
                            >
                                {loading ? "Guardando..." : "Enviar email de confirmación"}
                            </button>
                        </form>
                    )}

                    {success && (
                        <button type="button" className="btn btn-primary w-100" onClick={onClose}>
                            Entendido
                        </button>
                    )}
                </div>
            </section>
        </div>
    );
};

export default PortalSearchAlertModal;
