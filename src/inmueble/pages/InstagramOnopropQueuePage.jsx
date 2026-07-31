import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";

import {
    approveOnopropInstagramPublication,
    listOnopropInstagramRequests,
    rejectOnopropInstagramPublication,
} from "../services/instagram.service";

const STATUS_OPTIONS = [
    { value: "pending", label: "Pendientes" },
    { value: "error", label: "Con error" },
    { value: "published", label: "Publicadas" },
    { value: "rejected", label: "Rechazadas" },
];

const formatDate = (value) => {
    if (!value) return "-";

    return new Intl.DateTimeFormat("es-AR", {
        dateStyle: "short",
        timeStyle: "short",
    }).format(new Date(value));
};

const InstagramOnopropQueuePage = () => {
    const [status, setStatus] = useState("pending");
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [operationId, setOperationId] = useState("");
    const [error, setError] = useState("");

    const loadRequests = useCallback(async () => {
        try {
            setLoading(true);
            setError("");
            const result = await listOnopropInstagramRequests(status);
            setRequests(result.requests || []);
        } catch (err) {
            console.error("Error cargando solicitudes de Instagram:", err);
            setError(err.message || "No se pudieron cargar las solicitudes.");
        } finally {
            setLoading(false);
        }
    }, [status]);

    useEffect(() => {
        loadRequests();
    }, [loadRequests]);

    const handleApprove = async (requestId) => {
        if (!window.confirm("¿Publicar este inmueble en el Instagram de Onoprop?")) {
            return;
        }

        try {
            setOperationId(requestId);
            setError("");
            await approveOnopropInstagramPublication(requestId);
            await loadRequests();
        } catch (err) {
            console.error("Error publicando en Instagram de Onoprop:", err);
            setError(err.message || "No se pudo publicar la solicitud.");
        } finally {
            setOperationId("");
        }
    };

    const handleReject = async (requestId) => {
        const rejectionReason = window.prompt(
            "Motivo del rechazo (opcional):",
            "",
        );
        if (rejectionReason === null) return;

        try {
            setOperationId(requestId);
            setError("");
            await rejectOnopropInstagramPublication({
                requestId,
                rejectionReason,
            });
            await loadRequests();
        } catch (err) {
            console.error("Error rechazando solicitud de Instagram:", err);
            setError(err.message || "No se pudo rechazar la solicitud.");
        } finally {
            setOperationId("");
        }
    };

    return (
        <main className="container py-4">
            <header className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
                <div>
                    <p className="text-uppercase text-muted small mb-1">
                        Instagram de Onoprop
                    </p>
                    <h1 className="h3 mb-1">Cola de publicaciones</h1>
                    <p className="text-muted mb-0">
                        Revisá los avisos enviados por las inmobiliarias antes de
                        publicarlos en la cuenta central.
                    </p>
                </div>

                <Link
                    to="/admin/inmuebles/listado"
                    className="btn btn-outline-secondary"
                >
                    Volver al listado
                </Link>
            </header>

            <section className="card border-0 shadow-sm mb-4">
                <div className="card-body p-4">
                    <div className="d-flex flex-wrap gap-2">
                        {STATUS_OPTIONS.map((option) => (
                            <button
                                type="button"
                                className={`btn ${
                                    status === option.value
                                        ? "btn-primary"
                                        : "btn-outline-primary"
                                }`}
                                onClick={() => setStatus(option.value)}
                                key={option.value}
                            >
                                {option.label}
                            </button>
                        ))}

                        <button
                            type="button"
                            className="btn btn-outline-secondary ms-auto"
                            onClick={loadRequests}
                            disabled={loading}
                        >
                            Actualizar
                        </button>
                    </div>
                </div>
            </section>

            {error && <div className="alert alert-danger">{error}</div>}

            {loading ? (
                <div className="text-center py-5">
                    <div className="spinner-border" />
                    <p className="text-muted mt-3">Cargando solicitudes...</p>
                </div>
            ) : requests.length === 0 ? (
                <div className="alert alert-light border">
                    No hay solicitudes en este estado.
                </div>
            ) : (
                <section className="d-flex flex-column gap-4">
                    {requests.map((item) => (
                        <article className="card border-0 shadow-sm" key={item.id}>
                            <div className="card-body p-4">
                                <div className="row g-4">
                                    <div className="col-lg-3">
                                        {item.imageUrls?.[0] ? (
                                            <img
                                                src={item.imageUrls[0]}
                                                alt={item.inmuebleTitulo}
                                                className="img-fluid rounded border w-100"
                                                style={{
                                                    aspectRatio: "1 / 1",
                                                    objectFit: "cover",
                                                }}
                                            />
                                        ) : (
                                            <div className="bg-light border rounded p-5 text-center text-muted">
                                                Sin imagen
                                            </div>
                                        )}

                                        <div className="small text-muted mt-2">
                                            {item.imageUrls?.length || 0} imagen(es)
                                        </div>
                                    </div>

                                    <div className="col-lg-9">
                                        <div className="d-flex flex-wrap justify-content-between gap-3 mb-3">
                                            <div>
                                                <h2 className="h5 mb-1">
                                                    {item.inmuebleTitulo ||
                                                        "Inmueble sin título"}
                                                </h2>
                                                <p className="text-muted mb-0">
                                                    {item.inmobiliariaNombre ||
                                                        item.inmobiliariaId}
                                                </p>
                                            </div>

                                            <div className="text-lg-end small text-muted">
                                                Solicitada:{" "}
                                                {formatDate(item.requestedAt)}
                                            </div>
                                        </div>

                                        <pre
                                            className="bg-light border rounded p-3 small"
                                            style={{
                                                whiteSpace: "pre-wrap",
                                                fontFamily: "inherit",
                                            }}
                                        >
                                            {item.caption}
                                        </pre>

                                        {item.lastError && (
                                            <div className="alert alert-danger">
                                                {item.lastError}
                                            </div>
                                        )}

                                        {item.rejectionReason && (
                                            <div className="alert alert-warning">
                                                {item.rejectionReason}
                                            </div>
                                        )}

                                        {item.permalink && (
                                            <a
                                                href={item.permalink}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="btn btn-outline-success me-2"
                                            >
                                                Ver en Instagram
                                            </a>
                                        )}

                                        {(item.status === "pending" ||
                                            item.status === "error") && (
                                            <div className="d-flex flex-wrap gap-2">
                                                <button
                                                    type="button"
                                                    className="btn btn-success"
                                                    onClick={() =>
                                                        handleApprove(item.id)
                                                    }
                                                    disabled={
                                                        operationId === item.id
                                                    }
                                                >
                                                    {operationId === item.id
                                                        ? "Procesando..."
                                                        : "Aprobar y publicar"}
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn btn-outline-danger"
                                                    onClick={() =>
                                                        handleReject(item.id)
                                                    }
                                                    disabled={
                                                        operationId === item.id
                                                    }
                                                >
                                                    Rechazar
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </article>
                    ))}
                </section>
            )}
        </main>
    );
};

export default InstagramOnopropQueuePage;
