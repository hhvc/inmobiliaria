import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import SEO from "../../components/SEO";

import {
    getNetworkCollaborationRequests,
    updateNetworkCollaborationRequestStatus,
} from "../services/inmueble.service";

const VIEW_OPTIONS = [
    { id: "received", label: "Recibidas" },
    { id: "sent", label: "Enviadas" },
];

const STATUS_OPTIONS = [
    { id: "pendiente", label: "Pendientes" },
    { id: "aceptada", label: "Aceptadas" },
    { id: "rechazada", label: "Rechazadas" },
    { id: "cerrada", label: "Cerradas" },
    { id: "", label: "Todas" },
];

const STATUS_BADGE = {
    pendiente: "text-bg-warning",
    aceptada: "text-bg-success",
    rechazada: "text-bg-danger",
    cerrada: "text-bg-secondary",
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

const getStatusLabel = (estado) => {
    const option = STATUS_OPTIONS.find((item) => item.id === estado);

    return option?.label || estado || "Sin estado";
};

const InmuebleNetworkRequestsPage = () => {
    const [view, setView] = useState("received");
    const [statusFilter, setStatusFilter] = useState("pendiente");

    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [updatingId, setUpdatingId] = useState("");
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

            const data = await getNetworkCollaborationRequests({
                view,
                estado: statusFilter,
            });

            setItems(data);
        } catch (err) {
            console.error("Error cargando solicitudes de colaboración:", err);
            setError(err.message || "No se pudieron cargar las solicitudes");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchItems();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [view, statusFilter]);

    const handleStatusChange = async (request, estado) => {
        try {
            const labels = {
                aceptada: "aceptar",
                rechazada: "rechazar",
                cerrada: "cerrar",
            };

            const confirmed = window.confirm(
                `¿Confirmás ${labels[estado] || "actualizar"} esta solicitud?`,
            );

            if (!confirmed) return;

            setUpdatingId(request.id);
            setError("");
            setSuccess("");

            await updateNetworkCollaborationRequestStatus(request.id, {
                estado,
            });

            setSuccess("Solicitud actualizada correctamente.");
            await fetchItems();
        } catch (err) {
            console.error("Error actualizando solicitud:", err);
            setError(err.message || "No se pudo actualizar la solicitud");
        } finally {
            setUpdatingId("");
        }
    };

    return (
        <main className="portal-home">
            <SEO
                title="Solicitudes de colaboración | ONO Prop"
                description="Panel para revisar solicitudes de colaboración entre inmobiliarias dentro de la Red de colegas."
                url={`${siteUrl}/admin/red/solicitudes`}
                type="website"
                siteName="ONO Prop"
                noIndex
            />

            <section className="portal-section">
                <div className="container">
                    <div className="mb-4">
                        <Link
                            to="/admin/red/inmuebles-compartidos"
                            className="btn btn-outline-secondary"
                        >
                            ← Volver a Red de colegas
                        </Link>
                    </div>

                    <div className="row align-items-end g-3 mb-4">
                        <div className="col-lg-7">
                            <p className="text-uppercase text-muted small mb-1">
                                Red de colegas
                            </p>

                            <h1 className="portal-section-title mb-2">
                                Solicitudes de colaboración
                            </h1>

                            <p className="lead text-muted mb-0">
                                Revisá pedidos recibidos por tus inmuebles compartidos y
                                consultá las solicitudes que enviaste a otras inmobiliarias.
                            </p>
                        </div>

                        <div className="col-lg-3">
                            <label className="form-label">Vista</label>

                            <select
                                className="form-select"
                                value={view}
                                onChange={(e) => setView(e.target.value)}
                            >
                                {VIEW_OPTIONS.map((option) => (
                                    <option key={option.id} value={option.id}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="col-lg-2">
                            <label className="form-label">Estado</label>

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
                                const isReceived = view === "received";
                                const isPending = request.estado === "pendiente";
                                const detailUrl = `/admin/red/inmuebles-compartidos/${request.ownerInmobiliariaId}/${request.inmuebleId}`;

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
                                                            {getStatusLabel(request.estado)}
                                                        </span>

                                                        <span className="badge text-bg-light border">
                                                            {isReceived ? "Recibida" : "Enviada"}
                                                        </span>
                                                    </div>

                                                    <h2 className="h5 mb-1">
                                                        {request.inmuebleTitulo || "Inmueble compartido"}
                                                    </h2>

                                                    <p className="text-muted mb-0">
                                                        {isReceived ? (
                                                            <>
                                                                Solicitante:{" "}
                                                                <strong>
                                                                    {request.requesterUserEmail ||
                                                                        request.requesterUserId}
                                                                </strong>
                                                            </>
                                                        ) : (
                                                            <>
                                                                Inmobiliaria destino:{" "}
                                                                <strong>{request.ownerInmobiliariaId}</strong>
                                                            </>
                                                        )}
                                                    </p>
                                                </div>

                                                <div className="text-lg-end small text-muted">
                                                    <div>Creada: {formatDate(request.createdAt)}</div>
                                                    <div>Actualizada: {formatDate(request.updatedAt)}</div>
                                                </div>
                                            </div>

                                            {request.mensaje && (
                                                <div className="alert alert-light border small">
                                                    <strong>Mensaje:</strong> {request.mensaje}
                                                </div>
                                            )}

                                            <div className="row g-3 mb-3">
                                                <div className="col-md-6">
                                                    <small className="text-muted d-block">
                                                        Inmobiliaria propietaria
                                                    </small>
                                                    <strong>{request.ownerInmobiliariaId}</strong>
                                                </div>

                                                <div className="col-md-6">
                                                    <small className="text-muted d-block">
                                                        Inmobiliaria solicitante
                                                    </small>
                                                    <strong>{request.requesterInmobiliariaId}</strong>
                                                </div>
                                            </div>

                                            <div className="d-flex flex-wrap gap-2">
                                                <Link to={detailUrl} className="btn btn-outline-primary">
                                                    Ver inmueble
                                                </Link>

                                                {isReceived && isPending && (
                                                    <>
                                                        <button
                                                            type="button"
                                                            className="btn btn-success"
                                                            disabled={updatingId === request.id}
                                                            onClick={() =>
                                                                handleStatusChange(request, "aceptada")
                                                            }
                                                        >
                                                            Aceptar
                                                        </button>

                                                        <button
                                                            type="button"
                                                            className="btn btn-outline-danger"
                                                            disabled={updatingId === request.id}
                                                            onClick={() =>
                                                                handleStatusChange(request, "rechazada")
                                                            }
                                                        >
                                                            Rechazar
                                                        </button>
                                                    </>
                                                )}

                                                {isReceived && request.estado === "aceptada" && (
                                                    <button
                                                        type="button"
                                                        className="btn btn-outline-secondary"
                                                        disabled={updatingId === request.id}
                                                        onClick={() =>
                                                            handleStatusChange(request, "cerrada")
                                                        }
                                                    >
                                                        Cerrar
                                                    </button>
                                                )}
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

export default InmuebleNetworkRequestsPage;