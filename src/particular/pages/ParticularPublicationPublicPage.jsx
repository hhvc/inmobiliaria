import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import SEO from "../../components/SEO";
import InmuebleVideoSection from "../../inmueble/components/InmuebleVideoSection";
import { getVisibleInmuebleVideos } from "../../inmueble/utils/inmuebleVideos.helpers";
import { getParticularPublicationById } from "../services/particularPublicationListing.service";

const PUBLIC_STATUS_LABELS = {
    active: "Activa",
    paused: "Pausada",
    deleted: "Dada de baja",
    sold: "Vendida",
    rented: "Alquilada",
};

const OPERATION_LABELS = {
    venta: "Venta",
    alquiler: "Alquiler",
    alquiler_temporal: "Alquiler temporal",
    tasacion: "Tasación",
};

const TYPE_LABELS = {
    casa: "Casa",
    departamento: "Departamento",
    terreno: "Terreno",
    local: "Local",
    oficina: "Oficina",
    cochera: "Cochera",
    campo: "Campo",
    otro: "Inmueble",
};

const formatDate = (value) => {
    if (!value) return "Sin fecha";

    const date = value instanceof Date ? value : new Date(value);

    if (Number.isNaN(date.getTime())) return "Sin fecha";

    return date.toLocaleDateString("es-AR", {
        dateStyle: "long",
    });
};

const buildWhatsappUrl = (telefono = "") => {
    const clean = telefono.replace(/\D/g, "");

    if (!clean) return "";

    return `https://wa.me/${clean}`;
};

const getOrderedImages = (images = []) => {
    if (!Array.isArray(images)) return [];

    return [...images]
        .filter((image) => image?.url)
        .sort((a, b) => {
            const orderA = Number.isFinite(Number(a.order)) ? Number(a.order) : 0;
            const orderB = Number.isFinite(Number(b.order)) ? Number(b.order) : 0;

            return orderA - orderB;
        });
};

const isPublicVisible = (publication) => {
    return (
        publication?.publicationType === "particular" &&
        publication?.publicStatus === "active" &&
        publication?.moderationStatus === "approved"
    );
};

const buildEmailHref = ({ email, title }) => {
    if (!email) return "";

    const subject = encodeURIComponent(
        `Consulta por ${title || "publicación particular"}`,
    );

    return `mailto:${email}?subject=${subject}`;
};

const ParticularPublicationPublicPage = () => {
    const { id } = useParams();

    const [publication, setPublication] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const siteUrl = import.meta.env.VITE_PUBLIC_SITE_URL || "https://onoprop.com";

    const orderedImages = useMemo(() => {
        return getOrderedImages(publication?.images);
    }, [publication]);

    const mainImage = orderedImages[0] || null;
    const secondaryImages = orderedImages.slice(1);
    const imageCount = orderedImages.length;

    const visibleVideos = useMemo(() => {
        return getVisibleInmuebleVideos(publication?.videos || []);
    }, [publication]);

    const videoCount = visibleVideos.length;
    const hasVideos = videoCount > 0;

    const contactName = publication?.contact?.nombre || "";
    const contactPhone = publication?.contact?.telefono || "";
    const email = publication?.contact?.email || "";
    const whatsappUrl = buildWhatsappUrl(contactPhone);
    const emailHref = buildEmailHref({
        email,
        title: publication?.titulo,
    });

    const operationLabel =
        OPERATION_LABELS[publication?.operacion] || publication?.operacion || "";
    const typeLabel = TYPE_LABELS[publication?.tipo] || publication?.tipo || "";
    const statusLabel =
        PUBLIC_STATUS_LABELS[publication?.publicStatus] ||
        publication?.publicStatus ||
        "";

    const pageTitle = publication?.titulo || "Publicación particular";
    const pageDescription =
        publication?.descripcion ||
        "Publicación particular aprobada en ONO Prop.";

    useEffect(() => {
        const fetchPublication = async () => {
            try {
                setLoading(true);
                setError("");

                const data = await getParticularPublicationById(id);

                setPublication(data);
            } catch (err) {
                console.error("Error cargando publicación particular:", err);
                setError(err.message || "No se pudo cargar la publicación.");
            } finally {
                setLoading(false);
            }
        };

        fetchPublication();
    }, [id]);

    if (loading) {
        return (
            <main className="portal-home">
                <section className="portal-section">
                    <div className="container">
                        <div className="alert alert-light border">
                            Cargando publicación...
                        </div>
                    </div>
                </section>
            </main>
        );
    }

    if (error || !publication) {
        return (
            <main className="portal-home">
                <SEO
                    title="Publicación no encontrada | ONO Prop"
                    description="La publicación particular solicitada no está disponible."
                    url={`${siteUrl}/particulares/${id}`}
                    type="website"
                    siteName="ONO Prop"
                    noIndex
                />

                <section className="portal-section">
                    <div className="container">
                        <div className="alert alert-warning">
                            {error || "La publicación no está disponible."}
                        </div>

                        <Link to="/inmuebles" className="btn btn-primary">
                            Ver inmuebles disponibles
                        </Link>
                    </div>
                </section>
            </main>
        );
    }

    if (!isPublicVisible(publication)) {
        return (
            <main className="portal-home">
                <SEO
                    title="Publicación no disponible | ONO Prop"
                    description="Esta publicación particular no se encuentra visible públicamente."
                    url={`${siteUrl}/particulares/${id}`}
                    type="website"
                    siteName="ONO Prop"
                    noIndex
                />

                <section className="portal-section">
                    <div className="container">
                        <div className="alert alert-info">
                            Esta publicación no se encuentra disponible públicamente.
                        </div>

                        <Link to="/inmuebles" className="btn btn-primary">
                            Ver inmuebles disponibles
                        </Link>
                    </div>
                </section>
            </main>
        );
    }

    return (
        <main className="portal-home">
            <SEO
                title={`${pageTitle} | ONO Prop`}
                description={pageDescription}
                url={`${siteUrl}/particulares/${publication.id}`}
                image={mainImage?.url || ""}
                type="article"
                siteName="ONO Prop"
                noIndex={publication.noIndex === true}
            />

            <section className="portal-section">
                <div className="container">
                    <div className="mb-4">
                        <Link to="/inmuebles" className="btn btn-sm btn-outline-secondary">
                            ← Volver al portal
                        </Link>
                    </div>

                    <div className="row g-4">
                        <div className="col-lg-8">
                            <div className="d-flex flex-wrap gap-2 mb-3">
                                <span className="badge text-bg-success">{statusLabel}</span>

                                <span className="badge text-bg-dark">Particular</span>

                                {operationLabel && (
                                    <span className="badge text-bg-light border">
                                        {operationLabel}
                                    </span>
                                )}

                                {typeLabel && (
                                    <span className="badge text-bg-light border">
                                        {typeLabel}
                                    </span>
                                )}

                                {imageCount > 0 && (
                                    <span className="badge text-bg-light border">
                                        📷 {imageCount} foto{imageCount === 1 ? "" : "s"}
                                    </span>
                                )}

                                {hasVideos && (
                                    <span className="badge text-bg-danger">
                                        🎥 {videoCount} video{videoCount === 1 ? "" : "s"}
                                    </span>
                                )}
                            </div>

                            <h1 className="portal-section-title mb-2">
                                {pageTitle}
                            </h1>

                            <p className="lead text-muted mb-3">
                                {publication.ubicacion || "Ubicación no informada"}
                            </p>

                            {publication.precioEstimado && (
                                <div className="h4 mb-4">{publication.precioEstimado}</div>
                            )}

                            <div className="d-flex flex-wrap gap-2 mb-4">
                                {hasVideos && (
                                    <a href="#videos" className="btn btn-outline-primary">
                                        Ver videos
                                    </a>
                                )}

                                {whatsappUrl && (
                                    <a
                                        href={whatsappUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="btn btn-success"
                                    >
                                        Consultar por WhatsApp
                                    </a>
                                )}

                                {emailHref && (
                                    <a href={emailHref} className="btn btn-outline-primary">
                                        Enviar email
                                    </a>
                                )}
                            </div>

                            <section className="card border-0 shadow-sm mb-4 overflow-hidden">
                                {mainImage?.url ? (
                                    <div className="position-relative">
                                        <img
                                            src={mainImage.url}
                                            alt={pageTitle}
                                            className="img-fluid"
                                            style={{
                                                width: "100%",
                                                maxHeight: "560px",
                                                objectFit: "cover",
                                            }}
                                        />

                                        <div className="position-absolute bottom-0 start-0 p-3 d-flex flex-wrap gap-2">
                                            {imageCount > 0 && (
                                                <span className="badge text-bg-dark shadow-sm">
                                                    📷 {imageCount} foto
                                                    {imageCount === 1 ? "" : "s"}
                                                </span>
                                            )}

                                            {hasVideos && (
                                                <span className="badge text-bg-danger shadow-sm">
                                                    🎥 {videoCount} video
                                                    {videoCount === 1 ? "" : "s"}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div
                                        className="bg-light d-flex align-items-center justify-content-center text-muted"
                                        style={{ minHeight: "320px" }}
                                    >
                                        Publicación sin fotos cargadas
                                    </div>
                                )}
                            </section>

                            {secondaryImages.length > 0 && (
                                <section className="mb-4">
                                    <div className="d-flex justify-content-between align-items-end gap-3 mb-3">
                                        <div>
                                            <p className="text-uppercase text-muted small mb-1">
                                                Galería
                                            </p>

                                            <h2 className="h4 mb-0">Fotos de la publicación</h2>
                                        </div>
                                    </div>

                                    <div className="row g-3">
                                        {secondaryImages.map((image) => (
                                            <div
                                                className="col-6 col-md-4"
                                                key={image.id || image.url}
                                            >
                                                <img
                                                    src={image.thumbnailUrl || image.url}
                                                    alt={image.name || pageTitle}
                                                    className="img-fluid rounded-3 border shadow-sm"
                                                    loading="lazy"
                                                    style={{
                                                        width: "100%",
                                                        height: "170px",
                                                        objectFit: "cover",
                                                    }}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            )}

                            {hasVideos && (
                                <div id="videos" className="mb-4">
                                    <InmuebleVideoSection
                                        videos={visibleVideos}
                                        title="Videos de la publicación"
                                    />
                                </div>
                            )}

                            <section className="card border-0 shadow-sm mb-4">
                                <div className="card-body p-4">
                                    <h2 className="h4 mb-3">Descripción</h2>

                                    {publication.descripcion ? (
                                        <p
                                            className="text-muted mb-0"
                                            style={{ whiteSpace: "pre-line" }}
                                        >
                                            {publication.descripcion}
                                        </p>
                                    ) : (
                                        <p className="text-muted mb-0">
                                            El propietario todavía no cargó una descripción
                                            detallada.
                                        </p>
                                    )}
                                </div>
                            </section>

                            <section className="card border-0 shadow-sm mb-4">
                                <div className="card-body p-4">
                                    <h2 className="h4 mb-3">Datos principales</h2>

                                    <div className="row g-3">
                                        <div className="col-6 col-md-3">
                                            <small className="text-muted d-block">
                                                Operación
                                            </small>
                                            <strong>{operationLabel || "Sin informar"}</strong>
                                        </div>

                                        <div className="col-6 col-md-3">
                                            <small className="text-muted d-block">
                                                Tipo
                                            </small>
                                            <strong>{typeLabel || "Sin informar"}</strong>
                                        </div>

                                        <div className="col-6 col-md-3">
                                            <small className="text-muted d-block">
                                                Ubicación
                                            </small>
                                            <strong>
                                                {publication.ubicacion || "Sin informar"}
                                            </strong>
                                        </div>

                                        <div className="col-6 col-md-3">
                                            <small className="text-muted d-block">
                                                Publicación
                                            </small>
                                            <strong>Particular</strong>
                                        </div>
                                    </div>
                                </div>
                            </section>
                        </div>

                        <aside className="col-lg-4">
                            <div
                                className="card border-0 shadow-sm sticky-top"
                                style={{ top: "1rem" }}
                            >
                                <div className="card-body p-4">
                                    <h2 className="h5 mb-3">Contactar al particular</h2>

                                    <div className="alert alert-light border small">
                                        Esta publicación fue cargada por un propietario particular
                                        y aprobada por ONO Prop.
                                    </div>

                                    {contactName && (
                                        <div className="mb-3">
                                            <small className="text-muted d-block">Nombre</small>
                                            <strong>{contactName}</strong>
                                        </div>
                                    )}

                                    {contactPhone && (
                                        <div className="mb-3">
                                            <small className="text-muted d-block">Teléfono</small>
                                            <strong>{contactPhone}</strong>
                                        </div>
                                    )}

                                    {email && (
                                        <div className="mb-3">
                                            <small className="text-muted d-block">Email</small>
                                            <strong>{email}</strong>
                                        </div>
                                    )}

                                    <div className="d-grid gap-2">
                                        {whatsappUrl && (
                                            <a
                                                href={whatsappUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="btn btn-success"
                                            >
                                                Consultar por WhatsApp
                                            </a>
                                        )}

                                        {emailHref && (
                                            <a
                                                href={emailHref}
                                                className="btn btn-outline-primary"
                                            >
                                                Enviar email
                                            </a>
                                        )}

                                        <Link
                                            to="/inmuebles"
                                            className="btn btn-outline-secondary"
                                        >
                                            Ver más inmuebles
                                        </Link>
                                    </div>

                                    <hr />

                                    <div className="small text-muted">
                                        Publicada el {formatDate(publication.approvedAt)}
                                    </div>

                                    <div className="small text-muted">
                                        ID: <code>{publication.id}</code>
                                    </div>
                                </div>
                            </div>
                        </aside>
                    </div>
                </div>
            </section>
        </main>
    );
};

export default ParticularPublicationPublicPage;