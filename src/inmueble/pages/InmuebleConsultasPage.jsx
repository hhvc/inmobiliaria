import { useEffect, useMemo, useState, useCallback } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../../context/auth/useAuth";
import {
    getConsultasByInmobiliaria,
    markConsultaAsRead,
    markConsultaAsUnread,
    archiveConsulta,
    restoreConsulta,
} from "../services/inmuebleConsulta.service";

const formatDate = (timestamp) => {
    if (!timestamp) return "Sin fecha";

    if (typeof timestamp.toDate === "function") {
        return timestamp.toDate().toLocaleString("es-AR");
    }

    return "Sin fecha";
};

const buildPublicUrl = (slug) => {
    if (!slug) return null;
    return `/inmueble/${slug}`;
};

const normalizeWhatsappNumber = (value = "") => {
    return value.toString().replace(/\D/g, "");
};

const buildWhatsappReplyUrl = (consulta) => {
    const phone = normalizeWhatsappNumber(consulta.telefono);

    if (!phone) return null;

    const publicUrl = consulta.inmuebleSlug
        ? `${window.location.origin}/inmueble/${consulta.inmuebleSlug}`
        : "";

    const message = [
        `Hola ${consulta.nombre || ""}, te contacto por tu consulta en LaDocTaProp.`,
        consulta.inmuebleTitulo
            ? `Inmueble: ${consulta.inmuebleTitulo}`
            : "",
        consulta.inmuebleOperacion || consulta.inmuebleTipo
            ? `Referencia: ${consulta.inmuebleOperacion || ""} ${consulta.inmuebleTipo || ""}`.trim()
            : "",
        publicUrl ? `Link: ${publicUrl}` : "",
    ]
        .filter(Boolean)
        .join("\n");

    return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
};

const buildLeadClipboardText = (consulta) => {
    const publicUrl = consulta.inmuebleSlug
        ? `${window.location.origin}/inmueble/${consulta.inmuebleSlug}`
        : "";

    return [
        "Consulta de inmueble - LaDocTaProp",
        "",
        `Nombre: ${consulta.nombre || "Sin nombre"}`,
        `Email: ${consulta.email || "Sin email"}`,
        `Teléfono / WhatsApp: ${consulta.telefono || "Sin teléfono"}`,
        "",
        `Inmueble: ${consulta.inmuebleTitulo || "Sin título"}`,
        `Operación: ${consulta.inmuebleOperacion || "Sin operación"}`,
        `Tipo: ${consulta.inmuebleTipo || "Sin tipo"}`,
        publicUrl ? `Link: ${publicUrl}` : "",
        "",
        consulta.mensaje ? `Mensaje:\n${consulta.mensaje}` : "Mensaje: Sin mensaje",
    ]
        .filter(Boolean)
        .join("\n");
};

const CONSULTA_FILTERS = [
    { value: "activas", label: "Todas" },
    { value: "nuevas", label: "Nuevas" },
    { value: "leidas", label: "Leídas" },
    { value: "archivadas", label: "Archivadas" },
];

const isArchivedConsulta = (consulta) => {
    return consulta.archivada === true || consulta.estado === "archivada";
};

const getConsultaStats = (consultas) => {
    return consultas.reduce(
        (acc, consulta) => {
            const isArchived = isArchivedConsulta(consulta);

            if (isArchived) {
                acc.archivadas += 1;
                return acc;
            }

            acc.activas += 1;

            if (consulta.leida) {
                acc.leidas += 1;
            } else {
                acc.nuevas += 1;
            }

            return acc;
        },
        {
            activas: 0,
            nuevas: 0,
            leidas: 0,
            archivadas: 0,
        },
    );
};

const InmuebleConsultasPage = () => {
    const { user, activeInmobiliariaId } = useAuth();

    const [consultas, setConsultas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionLoadingId, setActionLoadingId] = useState(null);
    const [consultaFilter, setConsultaFilter] = useState("activas");
    const [error, setError] = useState(null);

    const fetchConsultas = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            if (!user?.uid) {
                setConsultas([]);
                return;
            }

            if (!activeInmobiliariaId) {
                setConsultas([]);
                setError("No hay inmobiliaria activa seleccionada");
                return;
            }

            const data = await getConsultasByInmobiliaria(activeInmobiliariaId, {
                includeArchived: true,
                pageSize: 100,
            });

            setConsultas(data);
        } catch (err) {
            console.error("Error cargando consultas:", err);

            if (err.code === "permission-denied") {
                setError("No tenés permisos para ver estas consultas");
            } else {
                setError(err.message || "No se pudieron cargar las consultas");
            }
        } finally {
            setLoading(false);
        }
    }, [user?.uid, activeInmobiliariaId]);

    useEffect(() => {
        fetchConsultas();
    }, [fetchConsultas]);

    const stats = useMemo(() => {
        return getConsultaStats(consultas);
    }, [consultas]);

    const filteredConsultas = useMemo(() => {
        return consultas.filter((consulta) => {
            const isArchived = isArchivedConsulta(consulta);

            if (consultaFilter === "archivadas") {
                return isArchived;
            }

            if (isArchived) {
                return false;
            }

            if (consultaFilter === "nuevas") {
                return !consulta.leida;
            }

            if (consultaFilter === "leidas") {
                return consulta.leida;
            }

            return true;
        });
    }, [consultas, consultaFilter]);

    const handleMarkAsRead = async (consulta) => {
        try {
            setActionLoadingId(consulta.id);

            await markConsultaAsRead(consulta.id);

            setConsultas((prev) =>
                prev.map((item) =>
                    item.id === consulta.id
                        ? { ...item, leida: true, estado: "leida" }
                        : item,
                ),
            );
        } catch (err) {
            console.error("Error marcando consulta como leída:", err);
            alert(err.message || "No se pudo marcar la consulta como leída");
        } finally {
            setActionLoadingId(null);
        }
    };

    const handleMarkAsUnread = async (consulta) => {
        try {
            setActionLoadingId(consulta.id);

            await markConsultaAsUnread(consulta.id);

            setConsultas((prev) =>
                prev.map((item) =>
                    item.id === consulta.id
                        ? { ...item, leida: false, estado: "nueva" }
                        : item,
                ),
            );
        } catch (err) {
            console.error("Error marcando consulta como no leída:", err);
            alert(err.message || "No se pudo marcar la consulta como no leída");
        } finally {
            setActionLoadingId(null);
        }
    };

    const handleArchive = async (consulta) => {
        if (!window.confirm("¿Archivar esta consulta?")) return;

        try {
            setActionLoadingId(consulta.id);

            await archiveConsulta(consulta.id);

            setConsultas((prev) => prev.filter((item) => item.id !== consulta.id));
        } catch (err) {
            console.error("Error archivando consulta:", err);
            alert(err.message || "No se pudo archivar la consulta");
        } finally {
            setActionLoadingId(null);
        }
    };

    const handleRestore = async (consulta) => {
        try {
            setActionLoadingId(consulta.id);

            await restoreConsulta(consulta.id);

            setConsultas((prev) =>
                prev.map((item) =>
                    item.id === consulta.id
                        ? {
                            ...item,
                            archivada: false,
                            estado: "leida",
                            leida: true,
                        }
                        : item,
                ),
            );
        } catch (err) {
            console.error("Error restaurando consulta:", err);
            alert(err.message || "No se pudo restaurar la consulta");
        } finally {
            setActionLoadingId(null);
        }
    };

    const handleCopyLeadData = async (consulta) => {
        try {
            await navigator.clipboard.writeText(buildLeadClipboardText(consulta));
            alert("Datos del lead copiados.");
        } catch (err) {
            console.error("Error copiando datos del lead:", err);
            alert("No se pudieron copiar los datos del lead.");
        }
    };

    if (loading) {
        return (
            <section className="container py-4">
                <p className="text-muted">Cargando consultas...</p>
            </section>
        );
    }

    if (error) {
        return (
            <section className="container py-4">
                <div className="alert alert-danger">{error}</div>
            </section>
        );
    }

    return (
        <section className="container py-4">
            <header className="mb-4 d-flex flex-wrap justify-content-between align-items-center gap-3">
                <div>
                    <h1 className="h3 mb-1">Consultas de inmuebles</h1>
                    <p className="text-muted mb-0">
                        Leads recibidos desde las fichas públicas del portal.
                    </p>
                </div>

                <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={fetchConsultas}
                >
                    Actualizar
                </button>
            </header>

            <section className="mb-4">
                <div className="d-flex flex-wrap gap-2">
                    {CONSULTA_FILTERS.map((filter) => (
                        <button
                            key={filter.value}
                            type="button"
                            className={
                                consultaFilter === filter.value
                                    ? "btn btn-primary btn-sm"
                                    : "btn btn-outline-primary btn-sm"
                            }
                            onClick={() => setConsultaFilter(filter.value)}
                        >
                            {filter.label}{" "}
                            <span className="badge text-bg-light ms-1">
                                {stats[filter.value] ?? 0}
                            </span>
                        </button>
                    ))}
                </div>
            </section>

            {consultas.length === 0 ? (
                <div className="alert alert-info">
                    Todavía no hay consultas para esta inmobiliaria.
                </div>
            ) : filteredConsultas.length === 0 ? (
                <div className="alert alert-info">
                    No hay consultas para el filtro seleccionado.
                </div>
            ) : (
                <div className="row g-3">
                    {filteredConsultas.map((consulta) => {
                        const publicUrl = buildPublicUrl(consulta.inmuebleSlug);
                        const whatsappReplyUrl = buildWhatsappReplyUrl(consulta);
                        const isLoading = actionLoadingId === consulta.id;
                        const isArchived = isArchivedConsulta(consulta);

                        return (
                            <article className="col-12" key={consulta.id}>
                                <div
                                    className={`card ${isArchived
                                        ? "border-secondary"
                                        : consulta.leida
                                            ? "border-light"
                                            : "border-primary"
                                        }`}
                                >
                                    <div className="card-body">
                                        <div className="d-flex flex-wrap justify-content-between gap-3">
                                            <div>
                                                <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
                                                    <h2 className="h5 mb-0">
                                                        {consulta.nombre || "Consulta sin nombre"}
                                                    </h2>

                                                    <span
                                                        className={
                                                            isArchived
                                                                ? "badge bg-dark"
                                                                : consulta.leida
                                                                    ? "badge bg-secondary"
                                                                    : "badge bg-primary"
                                                        }
                                                    >
                                                        {isArchived ? "Archivada" : consulta.leida ? "Leída" : "Nueva"}
                                                    </span>
                                                </div>

                                                <p className="text-muted mb-1">
                                                    {formatDate(consulta.createdAt)}
                                                </p>

                                                <p className="mb-1">
                                                    <strong>Inmueble:</strong>{" "}
                                                    {consulta.inmuebleTitulo || "Sin título"}
                                                </p>

                                                <p className="mb-1">
                                                    <strong>Operación:</strong>{" "}
                                                    {consulta.inmuebleOperacion || "Sin operación"} ·{" "}
                                                    {consulta.inmuebleTipo || "Sin tipo"}
                                                </p>
                                            </div>

                                            <div className="text-md-end">
                                                {publicUrl && (
                                                    <Link
                                                        to={publicUrl}
                                                        target="_blank"
                                                        className="btn btn-sm btn-outline-primary"
                                                    >
                                                        Ver publicación
                                                    </Link>
                                                )}
                                            </div>
                                        </div>

                                        <hr />

                                        <div className="row g-3">
                                            <div className="col-md-4">
                                                <div className="small text-muted">Email</div>
                                                {consulta.email ? (
                                                    <a href={`mailto:${consulta.email}`}>
                                                        {consulta.email}
                                                    </a>
                                                ) : (
                                                    <span className="text-muted">Sin email</span>
                                                )}
                                            </div>

                                            <div className="col-md-4">
                                                <div className="small text-muted">
                                                    Teléfono / WhatsApp
                                                </div>
                                                {consulta.telefono ? (
                                                    <div className="d-flex flex-column align-items-start gap-2">
                                                        <a href={`tel:${consulta.telefono}`}>
                                                            {consulta.telefono}
                                                        </a>

                                                        {whatsappReplyUrl && (
                                                            <a
                                                                href={whatsappReplyUrl}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="btn btn-sm btn-success"
                                                            >
                                                                Responder por WhatsApp
                                                            </a>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-muted">Sin teléfono</span>
                                                )}
                                            </div>

                                            <div className="col-md-4">
                                                <div className="small text-muted">Estado</div>
                                                <span>{consulta.estado || "nueva"}</span>
                                            </div>
                                        </div>

                                        {consulta.mensaje && (
                                            <div className="mt-3">
                                                <div className="small text-muted">Mensaje</div>
                                                <p className="mb-0" style={{ whiteSpace: "pre-line" }}>
                                                    {consulta.mensaje}
                                                </p>
                                            </div>
                                        )}

                                        <div className="d-flex flex-wrap gap-2 mt-4">
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-outline-dark"
                                                disabled={isLoading}
                                                onClick={() => handleCopyLeadData(consulta)}
                                            >
                                                Copiar datos del lead
                                            </button>

                                            {isArchived ? (
                                                <button
                                                    type="button"
                                                    className="btn btn-sm btn-outline-primary"
                                                    disabled={isLoading}
                                                    onClick={() => handleRestore(consulta)}
                                                >
                                                    Restaurar
                                                </button>
                                            ) : (
                                                <>
                                                    {consulta.leida ? (
                                                        <button
                                                            type="button"
                                                            className="btn btn-sm btn-outline-secondary"
                                                            disabled={isLoading}
                                                            onClick={() => handleMarkAsUnread(consulta)}
                                                        >
                                                            Marcar como nueva
                                                        </button>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            className="btn btn-sm btn-outline-success"
                                                            disabled={isLoading}
                                                            onClick={() => handleMarkAsRead(consulta)}
                                                        >
                                                            Marcar como leída
                                                        </button>
                                                    )}

                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-outline-danger"
                                                        disabled={isLoading}
                                                        onClick={() => handleArchive(consulta)}
                                                    >
                                                        Archivar
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </article>
                        );
                    })}
                </div>
            )}
        </section>
    );
};

export default InmuebleConsultasPage;