import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import SEO from "../../components/SEO";
import PublicationRequestActivityLog from "../components/PublicationRequestActivityLog";
import PublicationRequestImages from "../components/PublicationRequestImages";
import { getMyParticularPublicationRequests } from "../services/particularPublication.service";
import {
    getMyParticularPublications,
    updateParticularPublicationPublicStatus,
} from "../services/particularPublicationListing.service";

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

const TARGET_TYPE_LABELS = {
    onoprop: "ONO Prop",
    inmobiliaria: "Inmobiliaria",
};

const PUBLICATION_MODE_LABELS = {
    particular: "Publicación particular",
    inmobiliaria: "Gestionada por inmobiliaria",
};

const PUBLIC_STATUS_LABELS = {
    active: "Activa",
    paused: "Pausada",
    deleted: "Dada de baja",
    sold: "Vendida",
    rented: "Alquilada",
};

const PUBLIC_STATUS_BADGES = {
    active: "text-bg-success",
    paused: "text-bg-warning",
    deleted: "text-bg-danger",
    sold: "text-bg-primary",
    rented: "text-bg-info",
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

const getReviewOwnerName = (request) => {
    if (request?.targetType === "inmobiliaria") {
        return (
            request.targetInmobiliariaNombre ||
            request.assignedInmobiliariaNombre ||
            "la inmobiliaria elegida"
        );
    }

    return "ONO Prop";
};

const getTargetDescription = (request) => {
    if (request?.targetType === "inmobiliaria") {
        return (
            request.targetInmobiliariaNombre ||
            request.assignedInmobiliariaNombre ||
            "Inmobiliaria seleccionada"
        );
    }

    return "ONO Prop";
};

const getStatusHelp = (request) => {
    const ownerName = getReviewOwnerName(request);

    if (request?.particularPublicationId) {
        return "Tu solicitud ya fue aprobada como publicación particular. Ahora podés administrar la publicación desde la sección de publicaciones aprobadas.";
    }

    if (request?.convertedInmuebleId) {
        return `Tu solicitud ya fue convertida en una publicación. ${ownerName} revisará los datos finales antes de dejarla visible en el portal.`;
    }

    const status = request?.estado || "nuevo";

    const helpByStatus = {
        nuevo: `Recibimos tu solicitud y está pendiente de revisión por ${ownerName}.`,
        en_revision: `${ownerName} está revisando los datos cargados.`,
        contactado: `${ownerName} ya intentó contactarte o dejó la solicitud marcada para seguimiento.`,
        derivado: "La solicitud fue derivada para evaluación comercial.",
        cerrado: "La gestión fue cerrada.",
        descartado: "La solicitud fue descartada.",
    };

    return helpByStatus[status] || "La solicitud está registrada.";
};

const isConvertedPublicationVisible = (request) => {
    return (
        Boolean(request?.convertedInmuebleId) &&
        request?.convertedPublicVisible === true &&
        Boolean(request?.convertedPublicPath)
    );
};

const getConvertedPublicPath = (request) => {
    if (!isConvertedPublicationVisible(request)) {
        return "";
    }

    return request.convertedPublicPath;
};

const getParticularPublicationPublicUrl = (publication) => {
    if (!publication?.id) return "";

    return `/particulares/${publication.id}`;
};

const MyParticularPublicationRequestsPage = () => {
    const [items, setItems] = useState([]);
    const [publications, setPublications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingPublications, setLoadingPublications] = useState(true);
    const [updatingPublicationId, setUpdatingPublicationId] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const siteUrl = import.meta.env.VITE_PUBLIC_SITE_URL || "https://onoprop.com";

    const counters = useMemo(() => {
        return items.reduce(
            (acc, item) => {
                acc.total += 1;
                acc[item.estado] = (acc[item.estado] || 0) + 1;

                if (item.targetType === "onoprop") {
                    acc.onoprop += 1;
                }

                if (item.targetType === "inmobiliaria") {
                    acc.inmobiliaria += 1;
                }

                if (item.convertedInmuebleId || item.particularPublicationId) {
                    acc.convertidas += 1;
                }

                return acc;
            },
            {
                total: 0,
                onoprop: 0,
                inmobiliaria: 0,
                convertidas: 0,
            },
        );
    }, [items]);

    const publicationCounters = useMemo(() => {
        return publications.reduce(
            (acc, publication) => {
                acc.total += 1;
                acc[publication.publicStatus] =
                    (acc[publication.publicStatus] || 0) + 1;

                return acc;
            },
            {
                total: 0,
                active: 0,
                paused: 0,
                deleted: 0,
                sold: 0,
                rented: 0,
            },
        );
    }, [publications]);

    const fetchItems = async () => {
        try {
            setLoading(true);
            setError("");

            const data = await getMyParticularPublicationRequests();

            setItems(data);
        } catch (err) {
            console.error("Error cargando mis solicitudes:", err);
            setError(err.message || "No se pudieron cargar tus solicitudes.");
        } finally {
            setLoading(false);
        }
    };

    const fetchPublications = async () => {
        try {
            setLoadingPublications(true);
            setError("");

            const data = await getMyParticularPublications({
                pageSize: 50,
            });

            setPublications(data);
        } catch (err) {
            console.error("Error cargando publicaciones particulares:", err);
            setError(err.message || "No se pudieron cargar tus publicaciones.");
        } finally {
            setLoadingPublications(false);
        }
    };

    useEffect(() => {
        fetchItems();
        fetchPublications();
    }, []);

    const handleUpdatePublicationStatus = async (publication, publicStatus) => {
        try {
            const label = PUBLIC_STATUS_LABELS[publicStatus] || publicStatus;

            const confirmed = window.confirm(
                `¿Confirmás cambiar esta publicación a "${label}"?`,
            );

            if (!confirmed) return;

            setUpdatingPublicationId(publication.id);
            setError("");
            setSuccess("");

            await updateParticularPublicationPublicStatus(
                publication.id,
                publicStatus,
            );

            setSuccess("Publicación actualizada correctamente.");
            await fetchPublications();
        } catch (err) {
            console.error("Error actualizando publicación particular:", err);
            setError(err.message || "No se pudo actualizar la publicación.");
        } finally {
            setUpdatingPublicationId("");
        }
    };

    const handleRefreshAll = async () => {
        setSuccess("");
        await Promise.all([fetchItems(), fetchPublications()]);
    };

    return (
        <main className="portal-home">
            <SEO
                title="Mis publicaciones | ONO Prop"
                description="Consultá el estado de tus solicitudes y administrá tus publicaciones particulares aprobadas en ONO Prop."
                url={`${siteUrl}/mis-publicaciones`}
                type="website"
                siteName="ONO Prop"
                noIndex
            />

            <section className="portal-section">
                <div className="container">
                    <div className="row align-items-end g-3 mb-4">
                        <div className="col-lg-8">
                            <p className="text-uppercase text-muted small mb-1">
                                Publicaciones particulares
                            </p>

                            <h1 className="portal-section-title mb-2">
                                Mis publicaciones
                            </h1>

                            <p className="lead text-muted mb-0">
                                Consultá tus solicitudes enviadas y administrá las publicaciones
                                particulares que ya fueron aprobadas.
                            </p>
                        </div>

                        <div className="col-lg-4 text-lg-end d-flex flex-column flex-sm-row justify-content-lg-end gap-2">
                            <button
                                type="button"
                                className="btn btn-outline-secondary"
                                disabled={loading || loadingPublications}
                                onClick={handleRefreshAll}
                            >
                                Actualizar
                            </button>

                            <Link to="/publicar" className="btn btn-primary">
                                Nueva solicitud
                            </Link>
                        </div>
                    </div>

                    {error && <div className="alert alert-danger">{error}</div>}

                    {success && <div className="alert alert-success">{success}</div>}

                    <section className="card border-0 shadow-sm mb-4">
                        <div className="card-body p-3 p-md-4">
                            <div className="d-flex flex-column flex-md-row justify-content-between gap-2 mb-3">
                                <div>
                                    <h2 className="h4 mb-1">Mis publicaciones aprobadas</h2>

                                    <p className="text-muted mb-0">
                                        Administrá las publicaciones particulares que ya fueron
                                        aprobadas por ONO Prop.
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    className="btn btn-outline-secondary"
                                    disabled={loadingPublications}
                                    onClick={fetchPublications}
                                >
                                    Actualizar publicaciones
                                </button>
                            </div>

                            <div className="row g-3 mb-4">
                                <div className="col-6 col-md-3">
                                    <div className="border rounded-3 p-3">
                                        <div className="h5 mb-0">{publicationCounters.total}</div>
                                        <div className="small text-muted">Total</div>
                                    </div>
                                </div>

                                <div className="col-6 col-md-3">
                                    <div className="border rounded-3 p-3">
                                        <div className="h5 mb-0">
                                            {publicationCounters.active || 0}
                                        </div>
                                        <div className="small text-muted">Activas</div>
                                    </div>
                                </div>

                                <div className="col-6 col-md-3">
                                    <div className="border rounded-3 p-3">
                                        <div className="h5 mb-0">
                                            {publicationCounters.paused || 0}
                                        </div>
                                        <div className="small text-muted">Pausadas</div>
                                    </div>
                                </div>

                                <div className="col-6 col-md-3">
                                    <div className="border rounded-3 p-3">
                                        <div className="h5 mb-0">
                                            {(publicationCounters.sold || 0) +
                                                (publicationCounters.rented || 0)}
                                        </div>
                                        <div className="small text-muted">Finalizadas</div>
                                    </div>
                                </div>
                            </div>

                            {loadingPublications && (
                                <div className="alert alert-light border mb-0">
                                    Cargando tus publicaciones...
                                </div>
                            )}

                            {!loadingPublications && publications.length === 0 && (
                                <div className="alert alert-info mb-0">
                                    Todavía no tenés publicaciones particulares aprobadas.
                                </div>
                            )}

                            {!loadingPublications && publications.length > 0 && (
                                <div className="d-flex flex-column gap-3">
                                    {publications.map((publication) => {
                                        const publicUrl =
                                            getParticularPublicationPublicUrl(publication);
                                        const statusLabel =
                                            PUBLIC_STATUS_LABELS[publication.publicStatus] ||
                                            publication.publicStatus ||
                                            "Sin estado";
                                        const statusBadge =
                                            PUBLIC_STATUS_BADGES[publication.publicStatus] ||
                                            "text-bg-secondary";

                                        return (
                                            <article
                                                className="border rounded-3 p-3"
                                                key={publication.id}
                                            >
                                                <div className="d-flex flex-column flex-lg-row justify-content-between gap-3">
                                                    <div>
                                                        <div className="d-flex flex-wrap gap-2 mb-2">
                                                            <span className={`badge ${statusBadge}`}>
                                                                {statusLabel}
                                                            </span>

                                                            <span className="badge text-bg-light border">
                                                                {publication.operacion || "operación"}
                                                            </span>

                                                            <span className="badge text-bg-light border">
                                                                {publication.tipo || "inmueble"}
                                                            </span>

                                                            <span className="badge text-bg-dark">
                                                                Particular
                                                            </span>
                                                        </div>

                                                        <h3 className="h5 mb-1">
                                                            {publication.titulo ||
                                                                publication.ubicacion ||
                                                                "Publicación"}
                                                        </h3>

                                                        <p className="text-muted mb-2">
                                                            {publication.ubicacion || "Sin ubicación"}
                                                        </p>

                                                        {publication.precioEstimado && (
                                                            <p className="mb-0">
                                                                <strong>{publication.precioEstimado}</strong>
                                                            </p>
                                                        )}
                                                    </div>

                                                    <div className="text-lg-end small text-muted">
                                                        <div>
                                                            Aprobada: {formatDate(publication.approvedAt)}
                                                        </div>

                                                        <div>
                                                            Actualizada: {formatDate(publication.updatedAt)}
                                                        </div>
                                                    </div>
                                                </div>

                                                {publication.images?.[0]?.url && (
                                                    <div className="mt-3">
                                                        <img
                                                            src={publication.images[0].url}
                                                            alt={publication.titulo || "Publicación particular"}
                                                            className="rounded-3 border"
                                                            style={{
                                                                width: "100%",
                                                                maxWidth: "260px",
                                                                height: "150px",
                                                                objectFit: "cover",
                                                            }}
                                                        />
                                                    </div>
                                                )}

                                                {publication.descripcion && (
                                                    <p
                                                        className="text-muted mt-3 mb-0"
                                                        style={{ whiteSpace: "pre-line" }}
                                                    >
                                                        {publication.descripcion}
                                                    </p>
                                                )}

                                                <div className="mt-3 d-flex flex-wrap gap-2">
                                                    {publication.publicStatus === "active" && (
                                                        <Link
                                                            to={publicUrl}
                                                            className="btn btn-outline-primary"
                                                        >
                                                            Ver publicación
                                                        </Link>
                                                    )}

                                                    {publication.publicStatus === "active" && (
                                                        <button
                                                            type="button"
                                                            className="btn btn-outline-warning"
                                                            disabled={
                                                                updatingPublicationId === publication.id
                                                            }
                                                            onClick={() =>
                                                                handleUpdatePublicationStatus(
                                                                    publication,
                                                                    "paused",
                                                                )
                                                            }
                                                        >
                                                            Pausar
                                                        </button>
                                                    )}

                                                    {publication.publicStatus === "paused" && (
                                                        <button
                                                            type="button"
                                                            className="btn btn-success"
                                                            disabled={
                                                                updatingPublicationId === publication.id
                                                            }
                                                            onClick={() =>
                                                                handleUpdatePublicationStatus(
                                                                    publication,
                                                                    "active",
                                                                )
                                                            }
                                                        >
                                                            Reactivar
                                                        </button>
                                                    )}

                                                    {["active", "paused"].includes(
                                                        publication.publicStatus,
                                                    ) && (
                                                            <>
                                                                <button
                                                                    type="button"
                                                                    className="btn btn-outline-primary"
                                                                    disabled={
                                                                        updatingPublicationId === publication.id
                                                                    }
                                                                    onClick={() =>
                                                                        handleUpdatePublicationStatus(
                                                                            publication,
                                                                            "sold",
                                                                        )
                                                                    }
                                                                >
                                                                    Marcar vendida
                                                                </button>

                                                                <button
                                                                    type="button"
                                                                    className="btn btn-outline-info"
                                                                    disabled={
                                                                        updatingPublicationId === publication.id
                                                                    }
                                                                    onClick={() =>
                                                                        handleUpdatePublicationStatus(
                                                                            publication,
                                                                            "rented",
                                                                        )
                                                                    }
                                                                >
                                                                    Marcar alquilada
                                                                </button>

                                                                <button
                                                                    type="button"
                                                                    className="btn btn-outline-danger"
                                                                    disabled={
                                                                        updatingPublicationId === publication.id
                                                                    }
                                                                    onClick={() =>
                                                                        handleUpdatePublicationStatus(
                                                                            publication,
                                                                            "deleted",
                                                                        )
                                                                    }
                                                                >
                                                                    Dar de baja
                                                                </button>
                                                            </>
                                                        )}
                                                </div>
                                            </article>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </section>

                    <section className="card border-0 shadow-sm">
                        <div className="card-body p-3 p-md-4">
                            <div className="d-flex flex-column flex-md-row justify-content-between gap-2 mb-3">
                                <div>
                                    <h2 className="h4 mb-1">Mis solicitudes enviadas</h2>

                                    <p className="text-muted mb-0">
                                        Seguí el estado de las solicitudes que cargaste desde el
                                        formulario de publicación.
                                    </p>
                                </div>
                            </div>

                            <div className="row g-3 mb-4">
                                <div className="col-6 col-md-3">
                                    <div className="border rounded-3 p-3">
                                        <div className="h5 mb-0">{counters.total}</div>
                                        <div className="small text-muted">Total</div>
                                    </div>
                                </div>

                                <div className="col-6 col-md-3">
                                    <div className="border rounded-3 p-3">
                                        <div className="h5 mb-0">{counters.nuevo || 0}</div>
                                        <div className="small text-muted">Nuevas</div>
                                    </div>
                                </div>

                                <div className="col-6 col-md-3">
                                    <div className="border rounded-3 p-3">
                                        <div className="h5 mb-0">
                                            {(counters.en_revision || 0) +
                                                (counters.contactado || 0)}
                                        </div>
                                        <div className="small text-muted">En gestión</div>
                                    </div>
                                </div>

                                <div className="col-6 col-md-3">
                                    <div className="border rounded-3 p-3">
                                        <div className="h5 mb-0">{counters.convertidas || 0}</div>
                                        <div className="small text-muted">Aprobadas / convertidas</div>
                                    </div>
                                </div>
                            </div>

                            {loading && (
                                <div className="alert alert-light border">
                                    Cargando solicitudes...
                                </div>
                            )}

                            {!loading && items.length === 0 && (
                                <div className="alert alert-info">
                                    Todavía no tenés solicitudes de publicación.

                                    <div className="mt-3">
                                        <Link to="/publicar" className="btn btn-primary">
                                            Crear primera solicitud
                                        </Link>
                                    </div>
                                </div>
                            )}

                            {!loading && items.length > 0 && (
                                <div className="d-flex flex-column gap-4">
                                    {items.map((request) => {
                                        const isConverted = Boolean(request.convertedInmuebleId);
                                        const isParticularPublicationApproved = Boolean(
                                            request.particularPublicationId,
                                        );
                                        const publicPath = getConvertedPublicPath(request);
                                        const isPublicVisible = Boolean(publicPath);
                                        const targetDescription = getTargetDescription(request);
                                        const reviewOwnerName = getReviewOwnerName(request);
                                        const statusHelp = getStatusHelp(request);

                                        return (
                                            <article
                                                className="border rounded-3 p-3 p-md-4"
                                                key={request.id}
                                            >
                                                <div className="d-flex flex-column flex-lg-row justify-content-between gap-3 mb-3">
                                                    <div>
                                                        <div className="d-flex flex-wrap gap-2 mb-2">
                                                            <span
                                                                className={`badge ${STATUS_BADGE[request.estado] ||
                                                                    "text-bg-secondary"
                                                                    }`}
                                                            >
                                                                {STATUS_LABELS[request.estado] ||
                                                                    request.estado}
                                                            </span>

                                                            {isConverted && (
                                                                <span className="badge text-bg-success">
                                                                    Convertida en publicación
                                                                </span>
                                                            )}

                                                            {isParticularPublicationApproved && (
                                                                <span className="badge text-bg-success">
                                                                    Aprobada como particular
                                                                </span>
                                                            )}

                                                            <span className="badge text-bg-dark">
                                                                {targetDescription}
                                                            </span>

                                                            <span className="badge text-bg-light border">
                                                                {request.operacion || "operación"}
                                                            </span>

                                                            <span className="badge text-bg-light border">
                                                                {request.tipo || "inmueble"}
                                                            </span>
                                                        </div>

                                                        <h3 className="h5 mb-1">
                                                            {request.ubicacion || "Propiedad sin ubicación"}
                                                        </h3>

                                                        <p className="text-muted mb-0">
                                                            {request.precioEstimado || "Sin precio estimado"}
                                                        </p>
                                                    </div>

                                                    <div className="text-lg-end small text-muted">
                                                        <div>Creada: {formatDate(request.createdAt)}</div>

                                                        <div>
                                                            Actualizada: {formatDate(request.updatedAt)}
                                                        </div>

                                                        {request.convertedAt && (
                                                            <div>
                                                                Convertida: {formatDate(request.convertedAt)}
                                                            </div>
                                                        )}

                                                        {request.particularPublicationApprovedAt && (
                                                            <div>
                                                                Aprobada:{" "}
                                                                {formatDate(
                                                                    request.particularPublicationApprovedAt,
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                <div
                                                    className={`alert ${isConverted || isParticularPublicationApproved
                                                        ? "alert-success"
                                                        : request.estado === "descartado"
                                                            ? "alert-danger"
                                                            : "alert-light border"
                                                        } mb-3`}
                                                >
                                                    <strong>Estado:</strong> {statusHelp}

                                                    {isConverted && request.convertedTitle && (
                                                        <div className="small mt-2">
                                                            Publicación creada:{" "}
                                                            <strong>{request.convertedTitle}</strong>
                                                        </div>
                                                    )}

                                                    {isConverted && !isPublicVisible && (
                                                        <div className="small mt-2">
                                                            La publicación ya fue creada, pero todavía está en
                                                            revisión interna antes de mostrarse públicamente.
                                                        </div>
                                                    )}

                                                    {isParticularPublicationApproved &&
                                                        request.particularPublicationPath && (
                                                            <div className="mt-3">
                                                                <Link
                                                                    to={request.particularPublicationPath}
                                                                    className="btn btn-sm btn-success"
                                                                >
                                                                    Ver publicación particular
                                                                </Link>
                                                            </div>
                                                        )}

                                                    {isPublicVisible && (
                                                        <div className="mt-3">
                                                            <Link
                                                                to={publicPath}
                                                                className="btn btn-sm btn-success"
                                                            >
                                                                Ver publicación
                                                            </Link>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="alert alert-light border small">
                                                    <div>
                                                        <strong>Responsable de revisión:</strong>{" "}
                                                        {reviewOwnerName}
                                                    </div>

                                                    <div>
                                                        <strong>Destino elegido:</strong>{" "}
                                                        {targetDescription}
                                                    </div>

                                                    <div>
                                                        <strong>Tipo de destino:</strong>{" "}
                                                        {TARGET_TYPE_LABELS[request.targetType] ||
                                                            request.targetType ||
                                                            "Sin definir"}
                                                    </div>

                                                    <div>
                                                        <strong>Modo:</strong>{" "}
                                                        {PUBLICATION_MODE_LABELS[
                                                            request.publicationMode
                                                        ] ||
                                                            request.publicationMode ||
                                                            "Sin definir"}
                                                    </div>

                                                    <div>
                                                        <strong>Servicio:</strong>{" "}
                                                        {request.billingStatus === "free"
                                                            ? "Gratuito por ahora"
                                                            : request.billingStatus || "Sin definir"}
                                                    </div>
                                                </div>

                                                <div className="mb-3">
                                                    <strong className="d-block mb-1">
                                                        Descripción enviada:
                                                    </strong>

                                                    <p
                                                        className="mb-0 text-muted"
                                                        style={{ whiteSpace: "pre-line" }}
                                                    >
                                                        {request.descripcion}
                                                    </p>
                                                </div>

                                                <PublicationRequestImages
                                                    images={request.images}
                                                    title="Fotos enviadas"
                                                    emptyMessage="No cargaste fotos en esta solicitud."
                                                />

                                                <PublicationRequestActivityLog
                                                    activityLog={request.activityLog}
                                                    title="Seguimiento de tu solicitud"
                                                    emptyMessage="Todavía no hay movimientos registrados."
                                                    maxItems={6}
                                                    publicView
                                                />

                                                <div className="d-flex flex-wrap gap-2 mt-3">
                                                    {isPublicVisible && (
                                                        <Link
                                                            to={publicPath}
                                                            className="btn btn-success btn-sm"
                                                        >
                                                            Ver publicación
                                                        </Link>
                                                    )}

                                                    {isParticularPublicationApproved &&
                                                        request.particularPublicationPath && (
                                                            <Link
                                                                to={request.particularPublicationPath}
                                                                className="btn btn-success btn-sm"
                                                            >
                                                                Ver publicación particular
                                                            </Link>
                                                        )}

                                                    <Link
                                                        to="/publicar"
                                                        className="btn btn-outline-primary btn-sm"
                                                    >
                                                        Nueva solicitud
                                                    </Link>

                                                    {request.targetType === "inmobiliaria" && (
                                                        <Link
                                                            to="/inmobiliarias"
                                                            className="btn btn-outline-secondary btn-sm"
                                                        >
                                                            Ver inmobiliarias
                                                        </Link>
                                                    )}
                                                </div>
                                            </article>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </section>
                </div>
            </section>
        </main>
    );
};

export default MyParticularPublicationRequestsPage;