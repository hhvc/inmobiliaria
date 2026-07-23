import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import SEO from "../../components/SEO";

import {
    addParticularPublicationRequestInternalNote,
    getParticularPublicationRequestsForInmobiliaria,
    updateParticularPublicationRequest,
} from "../services/particularPublication.service";

import PublicationRequestImages from "../components/PublicationRequestImages";
import PublicationRequestActivityLog from "../components/PublicationRequestActivityLog";
import InmuebleVideoSection from "../../inmueble/components/InmuebleVideoSection";
import { getVisibleInmuebleVideos } from "../../inmueble/utils/inmuebleVideos.helpers";

const STATUS_OPTIONS = [
    { id: "nuevo", label: "Nuevas" },
    { id: "en_revision", label: "En revisión" },
    { id: "contactado", label: "Contactadas" },
    { id: "cerrado", label: "Cerradas" },
    { id: "descartado", label: "Descartadas" },
    { id: "", label: "Todas" },
];

const STATUS_BADGE = {
    nuevo: "text-bg-primary",
    en_revision: "text-bg-info",
    contactado: "text-bg-warning",
    derivado: "text-bg-secondary",
    cerrado: "text-bg-success",
    descartado: "text-bg-danger",
};

const STATUS_LABELS = {
    nuevo: "Nueva",
    en_revision: "En revisión",
    contactado: "Contactada",
    derivado: "Derivada",
    cerrado: "Cerrada",
    descartado: "Descartada",
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

const normalizeText = (value = "") => {
    return value
        .toString()
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
};

const requestMatchesSearch = (request, searchTerm) => {
    const normalizedSearch = normalizeText(searchTerm);

    if (!normalizedSearch) return true;

    const searchableText = [
        request.nombre,
        request.email,
        request.telefono,
        request.operacion,
        request.tipo,
        request.ubicacion,
        request.descripcion,
        request.precioEstimado,
        request.estado,
        request.targetInmobiliariaNombre,
        request.convertedTitle,
        request.convertedInmuebleId,
    ]
        .filter(Boolean)
        .join(" ");

    return normalizeText(searchableText).includes(normalizedSearch);
};

const buildWhatsappUrl = (telefono = "") => {
    const clean = telefono.replace(/\D/g, "");

    if (!clean) return "";

    return `https://wa.me/${clean}`;
};

const buildConvertUrl = (request) => {
    const params = new URLSearchParams();

    params.set("particularRequestId", request.id);

    const targetInmobiliariaId =
        request.targetInmobiliariaId || request.assignedInmobiliariaId || "";

    if (targetInmobiliariaId) {
        params.set("inmobiliariaId", targetInmobiliariaId);
    }

    return `/admin/inmuebles/nuevo?${params.toString()}`;
};

const getConvertedInmuebleEditUrl = (request) => {
    if (!request?.convertedInmuebleId || !request?.convertedInmobiliariaId) {
        return "";
    }

    const params = new URLSearchParams();

    params.set("inmobiliariaId", request.convertedInmobiliariaId);
    params.set("fromParticularRequest", "1");
    params.set("particularRequestId", request.id);

    return `/admin/inmuebles/${request.convertedInmuebleId}/editar?${params.toString()}`;
};

const getConvertedInmueblePreviewUrl = (request) => {
    if (!request?.convertedInmuebleId || !request?.convertedInmobiliariaId) {
        return "";
    }

    const params = new URLSearchParams();

    params.set("inmobiliariaId", request.convertedInmobiliariaId);

    return `/admin/inmuebles/${request.convertedInmuebleId}/preview?${params.toString()}`;
};

const getStoredOrGeneratedEditUrl = (request) => {
    if (request?.convertedEditPath) {
        return request.convertedEditPath;
    }

    return getConvertedInmuebleEditUrl(request);
};

const getStoredOrGeneratedPreviewUrl = (request) => {
    if (request?.convertedPreviewPath) {
        return request.convertedPreviewPath;
    }

    return getConvertedInmueblePreviewUrl(request);
};

const getConvertedPublicUrl = (request) => {
    if (
        request?.convertedPublicVisible === true &&
        request?.convertedPublicPath
    ) {
        return request.convertedPublicPath;
    }

    return "";
};

const canConvertRequest = (request) => {
    if (!request?.id) return false;
    if (request.convertedInmuebleId) return false;
    if (request.conversionLockStatus === "processing") return false;
    if (request.estado === "descartado") return false;

    return true;
};

const getConversionLockLabel = (request) => {
    if (request?.convertedInmuebleId) {
        return "Convertida";
    }

    if (request?.conversionLockStatus === "processing") {
        return "Conversión en proceso";
    }

    if (request?.conversionLockStatus === "failed") {
        return "Conversión fallida";
    }

    return "";
};

const getConversionLockBadgeClass = (request) => {
    if (request?.convertedInmuebleId) {
        return "text-bg-success";
    }

    if (request?.conversionLockStatus === "processing") {
        return "text-bg-warning";
    }

    if (request?.conversionLockStatus === "failed") {
        return "text-bg-danger";
    }

    return "text-bg-secondary";
};

const InmobiliariaParticularRequestsPage = () => {
    const [items, setItems] = useState([]);
    const [statusFilter, setStatusFilter] = useState("nuevo");
    const [searchTerm, setSearchTerm] = useState("");
    const [notesById, setNotesById] = useState({});
    const [loading, setLoading] = useState(true);
    const [updatingId, setUpdatingId] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const siteUrl = import.meta.env.VITE_PUBLIC_SITE_URL || "https://onoprop.com";

    const counters = useMemo(() => {
        return items.reduce(
            (acc, item) => {
                acc.total += 1;
                acc[item.estado] = (acc[item.estado] || 0) + 1;

                if (item.convertedInmuebleId) {
                    acc.convertidas += 1;
                }

                return acc;
            },
            { total: 0, convertidas: 0 },
        );
    }, [items]);

    const filteredItems = useMemo(() => {
        return items.filter((request) => {
            if (statusFilter && request.estado !== statusFilter) {
                return false;
            }

            return requestMatchesSearch(request, searchTerm);
        });
    }, [items, searchTerm, statusFilter]);

    const fetchItems = async () => {
        try {
            setLoading(true);
            setError("");

            const data = await getParticularPublicationRequestsForInmobiliaria({
                estado: "",
                pageSize: 100,
            });

            setItems(data);
        } catch (err) {
            console.error("Error cargando solicitudes particulares:", err);
            setError(err.message || "No se pudieron cargar las solicitudes.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchItems();
    }, []);

    const handleNoteChange = (requestId, value) => {
        setNotesById((prev) => ({
            ...prev,
            [requestId]: value,
        }));

        setError("");
        setSuccess("");
    };

    const handleUpdateStatus = async (request, estado) => {
        try {
            const confirmed = window.confirm(
                `¿Confirmás cambiar esta solicitud a "${STATUS_LABELS[estado] || estado}"?`,
            );

            if (!confirmed) return;

            setUpdatingId(request.id);
            setError("");
            setSuccess("");

            await updateParticularPublicationRequest(request.id, {
                estado,
                internalNote: notesById[request.id] || request.internalNote || "",
            });

            setSuccess("Solicitud actualizada correctamente.");
            await fetchItems();
        } catch (err) {
            console.error("Error actualizando solicitud:", err);
            setError(err.message || "No se pudo actualizar la solicitud.");
        } finally {
            setUpdatingId("");
        }
    };

    const handleSaveInternalNote = async (request) => {
        try {
            const note = notesById[request.id] ?? request.internalNote ?? "";

            if (!note.trim()) {
                setError("Escribí una nota antes de guardarla.");
                setSuccess("");
                return;
            }

            setUpdatingId(request.id);
            setError("");
            setSuccess("");

            await addParticularPublicationRequestInternalNote(request.id, {
                internalNote: note,
            });

            setSuccess("Nota interna guardada correctamente.");
            await fetchItems();
        } catch (err) {
            console.error("Error guardando nota interna:", err);
            setError(err.message || "No se pudo guardar la nota interna.");
        } finally {
            setUpdatingId("");
        }
    };

    return (
        <main className="portal-home">
            <SEO
                title="Solicitudes de particulares | ONO Prop"
                description="Solicitudes enviadas por propietarios particulares a la inmobiliaria."
                url={`${siteUrl}/admin/inmobiliaria/solicitudes-particulares`}
                type="website"
                siteName="ONO Prop"
                noIndex
            />

            <section className="portal-section">
                <div className="container">
                    <div className="row align-items-end g-3 mb-4">
                        <div className="col-lg-8">
                            <p className="text-uppercase text-muted small mb-1">
                                Solicitudes recibidas
                            </p>

                            <h1 className="portal-section-title mb-2">
                                Publicaciones de particulares
                            </h1>

                            <p className="lead text-muted mb-0">
                                Revisá las propiedades que particulares enviaron a tu
                                inmobiliaria para validar datos, contactar al propietario y
                                convertir la solicitud en una publicación.
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
                                    <div className="small text-muted">Total recibidas</div>
                                </div>
                            </div>
                        </div>

                        <div className="col-6 col-md-3">
                            <div className="card border-0 shadow-sm">
                                <div className="card-body">
                                    <div className="h4 mb-0">{counters.nuevo || 0}</div>
                                    <div className="small text-muted">Nuevas</div>
                                </div>
                            </div>
                        </div>

                        <div className="col-6 col-md-3">
                            <div className="card border-0 shadow-sm">
                                <div className="card-body">
                                    <div className="h4 mb-0">{counters.contactado || 0}</div>
                                    <div className="small text-muted">Contactadas</div>
                                </div>
                            </div>
                        </div>

                        <div className="col-6 col-md-3">
                            <div className="card border-0 shadow-sm">
                                <div className="card-body">
                                    <div className="h4 mb-0">{counters.convertidas || 0}</div>
                                    <div className="small text-muted">Convertidas</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <section className="card border-0 shadow-sm mb-4">
                        <div className="card-body p-3 p-md-4">
                            <div className="row g-3 align-items-end">
                                <div className="col-lg-8">
                                    <label className="form-label">Buscar solicitud</label>

                                    <input
                                        type="search"
                                        className="form-control"
                                        placeholder="Nombre, email, teléfono, ubicación, descripción, precio..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>

                                <div className="col-lg-4 d-flex gap-2">
                                    <button
                                        type="button"
                                        className="btn btn-outline-secondary w-100"
                                        onClick={fetchItems}
                                        disabled={loading}
                                    >
                                        Actualizar
                                    </button>

                                    {(searchTerm || statusFilter) && (
                                        <button
                                            type="button"
                                            className="btn btn-outline-dark w-100"
                                            onClick={() => {
                                                setSearchTerm("");
                                                setStatusFilter("");
                                            }}
                                        >
                                            Limpiar
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </section>

                    {error && <div className="alert alert-danger">{error}</div>}

                    {success && <div className="alert alert-success">{success}</div>}

                    {loading && (
                        <div className="alert alert-light border">
                            Cargando solicitudes...
                        </div>
                    )}

                    {!loading && items.length === 0 && (
                        <div className="alert alert-info">
                            No hay solicitudes de particulares enviadas a esta inmobiliaria.
                        </div>
                    )}

                    {!loading && items.length > 0 && filteredItems.length === 0 && (
                        <div className="alert alert-info">
                            No hay solicitudes para mostrar con este filtro.
                        </div>
                    )}

                    {!loading && filteredItems.length > 0 && (
                        <div className="d-flex flex-column gap-4">
                            {filteredItems.map((request) => {
                                const whatsappUrl = buildWhatsappUrl(request.telefono);
                                const noteValue =
                                    notesById[request.id] ?? request.internalNote ?? "";
                                const isConverted = Boolean(request.convertedInmuebleId);
                                const conversionLockLabel = getConversionLockLabel(request);
                                const canConvert = canConvertRequest(request);
                                const editUrl = getStoredOrGeneratedEditUrl(request);
                                const previewUrl = getStoredOrGeneratedPreviewUrl(request);
                                const publicUrl = getConvertedPublicUrl(request);
                                const visibleVideos = getVisibleInmuebleVideos(request?.videos || []);
                                const hasVideos = visibleVideos.length > 0;

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
                                                            {STATUS_LABELS[request.estado] || request.estado}
                                                        </span>

                                                        {conversionLockLabel && (
                                                            <span className={`badge ${getConversionLockBadgeClass(request)}`}>
                                                                {conversionLockLabel}
                                                            </span>
                                                        )}

                                                        <span className="badge text-bg-light border">
                                                            {request.operacion || "operación"}
                                                        </span>

                                                        <span className="badge text-bg-light border">
                                                            {request.tipo || "inmueble"}
                                                        </span>
                                                        {hasVideos && (
                                                            <span className="badge text-bg-danger">
                                                                🎥 {visibleVideos.length} video{visibleVideos.length === 1 ? "" : "s"}
                                                            </span>
                                                        )}
                                                    </div>

                                                    <h2 className="h5 mb-1">
                                                        {request.ubicacion || "Propiedad sin ubicación"}
                                                    </h2>

                                                    <p className="text-muted mb-0">
                                                        Solicitante:{" "}
                                                        <strong>{request.nombre || "Sin nombre"}</strong>
                                                    </p>
                                                </div>

                                                <div className="text-lg-end small text-muted">
                                                    <div>Creada: {formatDate(request.createdAt)}</div>
                                                    <div>Actualizada: {formatDate(request.updatedAt)}</div>
                                                    {request.convertedAt && (
                                                        <div>
                                                            Convertida: {formatDate(request.convertedAt)}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {isConverted && (
                                                <div className="alert alert-success small">
                                                    <strong>Solicitud convertida en inmueble.</strong>

                                                    {request.convertedTitle && (
                                                        <div>
                                                            Publicación:{" "}
                                                            <strong>{request.convertedTitle}</strong>
                                                        </div>
                                                    )}

                                                    {request.convertedInmuebleId && (
                                                        <div>
                                                            ID: <code>{request.convertedInmuebleId}</code>
                                                        </div>
                                                    )}
                                                    <div className="mt-2">
                                                        Estado público:{" "}
                                                        {publicUrl ? (
                                                            <span className="badge text-bg-success">Visible en portal</span>
                                                        ) : (
                                                            <span className="badge text-bg-warning">En revisión / no publicada</span>
                                                        )}
                                                    </div>
                                                    <div className="mt-2 d-flex flex-wrap gap-2">
                                                        {editUrl && (
                                                            <Link to={editUrl} className="btn btn-sm btn-success">
                                                                Editar inmueble
                                                            </Link>
                                                        )}

                                                        {previewUrl && (
                                                            <Link
                                                                to={previewUrl}
                                                                className="btn btn-sm btn-outline-success"
                                                            >
                                                                Vista previa
                                                            </Link>
                                                        )}
                                                        {publicUrl && (
                                                            <Link to={publicUrl} className="btn btn-sm btn-success">
                                                                Ver publicación pública
                                                            </Link>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            <div className="row g-3 mb-3">
                                                <div className="col-md-4">
                                                    <small className="text-muted d-block">Teléfono</small>
                                                    <strong>{request.telefono || "Sin teléfono"}</strong>
                                                </div>

                                                <div className="col-md-4">
                                                    <small className="text-muted d-block">Email</small>
                                                    <strong>{request.email || "Sin email"}</strong>
                                                </div>

                                                <div className="col-md-4">
                                                    <small className="text-muted d-block">
                                                        Precio estimado
                                                    </small>
                                                    <strong>
                                                        {request.precioEstimado || "Sin precio estimado"}
                                                    </strong>
                                                </div>
                                            </div>

                                            {request.conversionLockStatus === "processing" && !isConverted && (
                                                <div className="alert alert-warning small">
                                                    <strong>Conversión en proceso.</strong>
                                                    <div>
                                                        Esta solicitud está siendo convertida en inmueble. Para evitar duplicados,
                                                        no se puede iniciar otra conversión hasta que finalice.
                                                    </div>
                                                </div>
                                            )}

                                            {request.conversionLockStatus === "failed" && !isConverted && (
                                                <div className="alert alert-danger small">
                                                    <strong>La última conversión no se completó.</strong>
                                                    <div>
                                                        {request.conversionError ||
                                                            "Podés revisar el error y volver a intentar la conversión."}
                                                    </div>
                                                </div>
                                            )}

                                            <div className="alert alert-light border">
                                                <strong>Descripción enviada:</strong>
                                                <br />
                                                <span style={{ whiteSpace: "pre-line" }}>
                                                    {request.descripcion}
                                                </span>
                                            </div>

                                            <PublicationRequestImages
                                                images={request.images}
                                                title="Fotos enviadas por el particular"
                                                emptyMessage="El particular no cargó fotos en esta solicitud."
                                            />

                                            <InmuebleVideoSection
                                                videos={visibleVideos}
                                                title="Videos enviados por el particular"
                                            />

                                            <PublicationRequestActivityLog
                                                activityLog={request.activityLog}
                                                title="Historial interno"
                                                showActor
                                            />

                                            <div className="mb-3">
                                                <label className="form-label">Nota interna</label>

                                                <textarea
                                                    className="form-control"
                                                    rows={3}
                                                    value={noteValue}
                                                    placeholder="Ej: contactar por WhatsApp, falta documentación, coordinar visita, convertir en publicación..."
                                                    onChange={(e) =>
                                                        handleNoteChange(request.id, e.target.value)
                                                    }
                                                />
                                                <div className="mt-2">
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-outline-primary"
                                                        disabled={updatingId === request.id}
                                                        onClick={() => handleSaveInternalNote(request)}
                                                    >
                                                        Guardar nota
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="d-flex flex-wrap gap-2">
                                                {request.email && (
                                                    <a
                                                        href={`mailto:${request.email}`}
                                                        className="btn btn-outline-primary"
                                                    >
                                                        Enviar email
                                                    </a>
                                                )}

                                                {whatsappUrl && (
                                                    <a
                                                        href={whatsappUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="btn btn-outline-success"
                                                    >
                                                        WhatsApp
                                                    </a>
                                                )}

                                                {canConvert ? (
                                                    <Link
                                                        to={buildConvertUrl(request)}
                                                        className={
                                                            request.conversionLockStatus === "failed"
                                                                ? "btn btn-warning"
                                                                : "btn btn-primary"
                                                        }
                                                    >
                                                        {request.conversionLockStatus === "failed"
                                                            ? "Reintentar conversión"
                                                            : "Convertir en inmueble"}
                                                    </Link>
                                                ) : (
                                                    <button type="button" className="btn btn-outline-secondary" disabled>
                                                        {request.conversionLockStatus === "processing"
                                                            ? "Conversión en proceso"
                                                            : isConverted
                                                                ? "Ya convertida"
                                                                : "No convertible"}
                                                    </button>
                                                )}

                                                <button
                                                    type="button"
                                                    className="btn btn-outline-secondary"
                                                    disabled={updatingId === request.id || isConverted}
                                                    onClick={() =>
                                                        handleUpdateStatus(request, "en_revision")
                                                    }
                                                >
                                                    En revisión
                                                </button>

                                                <button
                                                    type="button"
                                                    className="btn btn-outline-warning"
                                                    disabled={updatingId === request.id || isConverted}
                                                    onClick={() => handleUpdateStatus(request, "contactado")}
                                                >
                                                    Contactado
                                                </button>

                                                <button
                                                    type="button"
                                                    className="btn btn-success"
                                                    disabled={updatingId === request.id || isConverted}
                                                    onClick={() => handleUpdateStatus(request, "cerrado")}
                                                >
                                                    Cerrar
                                                </button>

                                                <button
                                                    type="button"
                                                    className="btn btn-outline-danger"
                                                    disabled={updatingId === request.id || isConverted}
                                                    onClick={() =>
                                                        handleUpdateStatus(request, "descartado")
                                                    }
                                                >
                                                    Descartar
                                                </button>
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

export default InmobiliariaParticularRequestsPage;