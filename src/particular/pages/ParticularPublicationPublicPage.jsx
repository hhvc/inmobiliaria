import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import SEO from "../../components/SEO";
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

const getMainImage = (images = []) => {
    if (!Array.isArray(images) || images.length === 0) return null;

    return [...images].sort((a, b) => (a.order || 0) - (b.order || 0))[0];
};

const isPublicVisible = (publication) => {
    return (
        publication?.publicationType === "particular" &&
        publication?.publicStatus === "active" &&
        publication?.moderationStatus === "approved"
    );
};

const ParticularPublicationPublicPage = () => {
    const { id } = useParams();

    const [publication, setPublication] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const siteUrl = import.meta.env.VITE_PUBLIC_SITE_URL || "https://onoprop.com";

    const mainImage = useMemo(() => {
        return getMainImage(publication?.images);
    }, [publication]);

    const whatsappUrl = buildWhatsappUrl(publication?.contact?.telefono || "");
    const email = publication?.contact?.email || "";
    const operationLabel =
        OPERATION_LABELS[publication?.operacion] || publication?.operacion || "";
    const typeLabel = TYPE_LABELS[publication?.tipo] || publication?.tipo || "";
    const statusLabel =
        PUBLIC_STATUS_LABELS[publication?.publicStatus] ||
        publication?.publicStatus ||
        "";

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
                title={`${publication.titulo || "Publicación particular"} | ONO Prop`}
                description={
                    publication.descripcion ||
                    "Publicación particular aprobada en ONO Prop."
                }
                url={`${siteUrl}/particulares/${publication.id}`}
                image={mainImage?.url || ""}
                type="article"
                siteName="ONO Prop"
                noIndex={publication.noIndex === true}
            />

            <section className="portal-section">
                <div className="container">
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
                            </div>

                            <h1 className="portal-section-title mb-2">
                                {publication.titulo || publication.ubicacion || "Publicación"}
                            </h1>

                            <p className="lead text-muted mb-3">
                                {publication.ubicacion || "Ubicación no informada"}
                            </p>

                            {publication.precioEstimado && (
                                <div className="h4 mb-4">{publication.precioEstimado}</div>
                            )}

                            {mainImage?.url && (
                                <img
                                    src={mainImage.url}
                                    alt={publication.titulo || "Publicación particular"}
                                    className="img-fluid rounded-4 shadow-sm mb-4"
                                    style={{
                                        width: "100%",
                                        maxHeight: "520px",
                                        objectFit: "cover",
                                    }}
                                />
                            )}

                            {publication.images?.length > 1 && (
                                <div className="row g-3 mb-4">
                                    {publication.images.slice(1).map((image) => (
                                        <div className="col-6 col-md-4" key={image.id || image.url}>
                                            <img
                                                src={image.url}
                                                alt={image.name || publication.titulo || "Foto"}
                                                className="img-fluid rounded-3 border"
                                                style={{
                                                    width: "100%",
                                                    height: "160px",
                                                    objectFit: "cover",
                                                }}
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}

                            <section className="card border-0 shadow-sm mb-4">
                                <div className="card-body p-4">
                                    <h2 className="h4 mb-3">Descripción</h2>

                                    <p
                                        className="text-muted mb-0"
                                        style={{ whiteSpace: "pre-line" }}
                                    >
                                        {publication.descripcion}
                                    </p>
                                </div>
                            </section>
                        </div>

                        <aside className="col-lg-4">
                            <div className="card border-0 shadow-sm sticky-top">
                                <div className="card-body p-4">
                                    <h2 className="h5 mb-3">Contactar al particular</h2>

                                    <div className="alert alert-light border small">
                                        Esta publicación fue cargada por un propietario particular y
                                        aprobada por ONO Prop.
                                    </div>

                                    {publication.contact?.nombre && (
                                        <div className="mb-3">
                                            <small className="text-muted d-block">Nombre</small>
                                            <strong>{publication.contact.nombre}</strong>
                                        </div>
                                    )}

                                    {publication.contact?.telefono && (
                                        <div className="mb-3">
                                            <small className="text-muted d-block">Teléfono</small>
                                            <strong>{publication.contact.telefono}</strong>
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

                                        {email && (
                                            <a
                                                href={`mailto:${email}?subject=Consulta por ${encodeURIComponent(
                                                    publication.titulo || "publicación particular",
                                                )}`}
                                                className="btn btn-outline-primary"
                                            >
                                                Enviar email
                                            </a>
                                        )}
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