import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import SEO from "../../components/SEO";

import {
    getInmobiliariaLinkRequestsForAdmin,
    reviewInmobiliariaLinkRequest,
} from "../services/inmobiliaria.service";

const STATUS_OPTIONS = [
    { id: "pendiente", label: "Pendientes" },
    { id: "aceptada", label: "Aceptadas" },
    { id: "rechazada", label: "Rechazadas" },
    { id: "", label: "Todas" },
];

const STATUS_BADGE = {
    pendiente: "text-bg-warning",
    aceptada: "text-bg-success",
    rechazada: "text-bg-danger",
    cancelada: "text-bg-secondary",
};

const formatDate = (value) => {
    if (!value) return "Sin fecha";

    const date = value instanceof Date ? value : new Date(value);

    if (Number.isNaN(date.getTime())) return "Sin fecha";

    return date.toLocaleString("es-AR", {
        dateStyle: "short",
        timeStyle: "short",
    });
};

const InmobiliariaLinkRequestsAdminPage = () => {
    const [items, setItems] = useState([]);
    const [statusFilter, setStatusFilter] = useState("pendiente");
    const [notesById, setNotesById] = useState({});
    const [loading, setLoading] = useState(true);
    const [reviewingId, setReviewingId] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const siteUrl =
        import.meta.env.VITE_PUBLIC_SITE_URL || "https://onoprop.com";

    const counters = useMemo(() => {
        return items.reduce(
            (acc, item) => {
                acc.total += 1;
                acc[item.estado] = (acc[item.estado] || 0) + 1;
                return acc;
            },
            { total: 0 },
        );
    }, [items]);

    const fetchItems = async () => {
        try {
            setLoading(true);
            setError("");

            const data = await getInmobiliariaLinkRequestsForAdmin({
                estado: statusFilter,
            });

            setItems(data);
        } catch (err) {
            console.error("Error cargando solicitudes de vinculación:", err);
            setError(err.message || "No se pudieron cargar las solicitudes");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchItems();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [statusFilter]);

    const handleNoteChange = (requestId, value) => {
        setNotesById((prev) => ({
            ...prev,
            [requestId]: value,
        }));

        setError("");
        setSuccess("");
    };

    const handleReview = async (request, estado) => {
        try {
            const actionLabel = estado === "aceptada" ? "aprobar" : "rechazar";

            const confirmed = window.confirm(
                `¿Confirmás ${actionLabel} la solicitud de ${request.requesterUserEmail}?`,
            );

            if (!confirmed) return;

            setReviewingId(request.id);
            setError("");
            setSuccess("");

            await reviewInmobiliariaLinkRequest(request.id, {
                estado,
                reviewNote: notesById[request.id] || "",
            });

            setSuccess("Solicitud actualizada correctamente.");
            await fetchItems();
        } catch (err) {
            console.error("Error revisando solicitud:", err);
            setError(err.message || "No se pudo actualizar la solicitud");
        } finally {
            setReviewingId("");
        }
    };

    return (
        <main className="portal-home">
            <SEO
                title="Solicitudes de vinculación | ONO Prop"
                description="Panel para aprobar o rechazar solicitudes de vinculación de usuarios a inmobiliarias."
                url={`${siteUrl}/admin/inmobiliaria/vinculaciones`}
                type="website"
                siteName="ONO Prop"
                noIndex
            />

            <section className="portal-section">
                <div className="container">
                    <div className="mb-4">
                        <Link to="/admin/inmobiliaria" className="btn btn-outline-secondary">
                            ← Volver al panel
                        </Link>
                    </div>

                    <div className="row align-items-end g-3 mb-4">
                        <div className="col-lg-8">
                            <p className="text-uppercase text-muted small mb-1">
                                Usuarios e inmobiliarias
                            </p>

                            <h1 className="portal-section-title mb-2">
                                Solicitudes de vinculación
                            </h1>

                            <p className="lead text-muted mb-0">
                                Revisá pedidos de usuarios que quieren vincularse a una
                                inmobiliaria existente.
                            </p>
                        </div>

                        <div className="col-lg-4">
                            <label className="form-label">Filtrar por estado</label>

                            <select
                                className="form-select"
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                            >
                                {STATUS_OPTIONS.map((option) => (
                                    <option key={option.id || "all"} value={option.id}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="row g-3 mb-4">
                        <div className="col-6 col-md-3">
                            <div className="card border-0 shadow-sm">
                                <div className="card-body">
                                    <div className="h4 mb-0">{counters.total}</div>
                                    <div className="small text-muted">Mostradas</div>
                                </div>
                            </div>
                        </div>

                        <div className="col-6 col-md-3">
                            <div className="card border-0 shadow-sm">
                                <div className="card-body">
                                    <div className="h4 mb-0">{counters.pendiente || 0}</div>
                                    <div className="small text-muted">Pendientes</div>
                                </div>
                            </div>
                        </div>

                        <div className="col-6 col-md-3">
                            <div className="card border-0 shadow-sm">
                                <div className="card-body">
                                    <div className="h4 mb-0">{counters.aceptada || 0}</div>
                                    <div className="small text-muted">Aceptadas</div>
                                </div>
                            </div>
                        </div>

                        <div className="col-6 col-md-3">
                            <div className="card border-0 shadow-sm">
                                <div className="card-body">
                                    <div className="h4 mb-0">{counters.rechazada || 0}</div>
                                    <div className="small text-muted">Rechazadas</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {error && <div className="alert alert-danger">{error}</div>}

                    {success && <div className="alert alert-success">{success}</div>}

                    {loading && (
                        <div className="alert alert-light border">
                            Cargando solicitudes...
                        </div>
                    )}

                    {!loading && items.length === 0 && (
                        <div className="alert alert-info">
                            No hay solicitudes para mostrar con este filtro.
                        </div>
                    )}

                    {!loading && items.length > 0 && (
                        <div className="d-flex flex-column gap-4">
                            {items.map((request) => {
                                const isPending = request.estado === "pendiente";
                                const noteValue = notesById[request.id] || "";

                                return (
                                    <article className="card border-0 shadow-sm" key={request.id}>
                                        <div className="card-body p-4">
                                            <div className="d-flex flex-column flex-lg-row justify-content-between gap-3 mb-3">
                                                <div>
                                                    <div className="d-flex flex-wrap gap-2 mb-2">
                                                        <span
                                                            className={`badge ${STATUS_BADGE[request.estado] ||
                                                                "text-bg-secondary"
                                                                }`}
                                                        >
                                                            {request.estado}
                                                        </span>

                                                        <span className="badge text-bg-light border">
                                                            Rol solicitado: {request.requestedRole || "admin"}
                                                        </span>
                                                    </div>

                                                    <h2 className="h5 mb-1">
                                                        {request.inmobiliariaNombre ||
                                                            "Inmobiliaria sin nombre"}
                                                    </h2>

                                                    <p className="text-muted mb-0">
                                                        Solicitante:{" "}
                                                        <strong>
                                                            {request.requesterDisplayName ||
                                                                request.requesterUserEmail ||
                                                                request.requesterUserId}
                                                        </strong>
                                                    </p>
                                                </div>

                                                <div className="text-lg-end small text-muted">
                                                    <div>Creada: {formatDate(request.createdAt)}</div>
                                                    <div>Revisada: {formatDate(request.reviewedAt)}</div>
                                                </div>
                                            </div>

                                            {request.mensaje && (
                                                <div className="alert alert-light border small">
                                                    <strong>Mensaje del solicitante:</strong>{" "}
                                                    {request.mensaje}
                                                </div>
                                            )}

                                            {request.reviewNote && (
                                                <div className="alert alert-light border small">
                                                    <strong>Nota de revisión:</strong>{" "}
                                                    {request.reviewNote}
                                                </div>
                                            )}

                                            {isPending && (
                                                <div className="mb-3">
                                                    <label className="form-label">
                                                        Nota de revisión
                                                    </label>

                                                    <textarea
                                                        className="form-control"
                                                        rows={3}
                                                        value={noteValue}
                                                        placeholder="Ej: Se aprueba acceso / falta confirmar identidad / no pertenece al equipo."
                                                        onChange={(e) =>
                                                            handleNoteChange(request.id, e.target.value)
                                                        }
                                                    />
                                                </div>
                                            )}

                                            <div className="d-flex flex-wrap gap-2">
                                                {isPending && (
                                                    <>
                                                        <button
                                                            type="button"
                                                            className="btn btn-success"
                                                            disabled={reviewingId === request.id}
                                                            onClick={() =>
                                                                handleReview(request, "aceptada")
                                                            }
                                                        >
                                                            Aprobar vinculación
                                                        </button>

                                                        <button
                                                            type="button"
                                                            className="btn btn-outline-danger"
                                                            disabled={reviewingId === request.id}
                                                            onClick={() =>
                                                                handleReview(request, "rechazada")
                                                            }
                                                        >
                                                            Rechazar
                                                        </button>
                                                    </>
                                                )}

                                                <Link
                                                    to={`/inmobiliaria/${request.inmobiliariaId}`}
                                                    className="btn btn-outline-secondary disabled"
                                                    aria-disabled="true"
                                                >
                                                    ID inmobiliaria: {request.inmobiliariaId}
                                                </Link>
                                            </div>
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    )}
                </div>
            </section>
        </main>
    );
};

export default InmobiliariaLinkRequestsAdminPage;