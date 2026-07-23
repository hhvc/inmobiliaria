import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";

import SEO from "../../components/SEO";
import { getInmuebleById } from "../services/inmueble.service";
import { getPublicInmobiliariaById } from "../../inmobiliaria/services/inmobiliaria.service";
import { useAuth } from "../../context/auth/useAuth";
import { canReadInmueble } from "../helpers/permissions";
import InmuebleVideoSection from "../components/InmuebleVideoSection";
import { getVisibleInmuebleVideos } from "../utils/inmuebleVideos.helpers";

const DEFAULT_SEO_IMAGE = "/assets/img/Logo.png";

const INITIAL_CONSULTA = {
    nombre: "",
    email: "",
    telefono: "",
    mensaje: "",
};

const formatPrice = (inmueble) => {
    if (!inmueble?.precio) return "Consultar";

    const moneda = inmueble.moneda || "USD";
    const precio = Number(inmueble.precio);

    if (!Number.isFinite(precio)) {
        return `${moneda} ${inmueble.precio}`;
    }

    return `${moneda} ${precio.toLocaleString("es-AR")}`;
};

const formatNumber = (value) => {
    const number = Number(value);

    if (!Number.isFinite(number)) return value;

    return number.toLocaleString("es-AR");
};

const toNumber = (value) => {
    if (value === null || value === undefined || value === "") return null;

    const number = Number(value);

    return Number.isFinite(number) ? number : null;
};

const normalizeSeoText = (value = "") => {
    return value.toString().replace(/\s+/g, " ").trim();
};

const truncateText = (value = "", maxLength = 155) => {
    const cleanValue = normalizeSeoText(value);

    if (cleanValue.length <= maxLength) return cleanValue;

    return `${cleanValue.slice(0, maxLength - 1).trim()}…`;
};

const capitalize = (value = "") => {
    const cleanValue = normalizeSeoText(value);

    if (!cleanValue) return "";

    return cleanValue.charAt(0).toUpperCase() + cleanValue.slice(1);
};

const normalizeWhatsappNumber = (value = "") => {
    return value.toString().replace(/\D/g, "");
};

const getDireccionValue = (inmueble, key) => {
    return inmueble?.direccion?.[key] || inmueble?.[key] || "";
};

const buildAddress = (inmueble) => {
    return [
        getDireccionValue(inmueble, "calle"),
        getDireccionValue(inmueble, "numero"),
        getDireccionValue(inmueble, "barrio"),
        getDireccionValue(inmueble, "ciudad"),
    ]
        .filter(Boolean)
        .join(", ");
};

const getCurrentPreviewUrl = (id) => {
    if (!id) return "";

    if (typeof window === "undefined") {
        return `/admin/inmuebles/${id}/preview`;
    }

    return window.location.href;
};

const getPublicUrl = (inmueble) => {
    if (!inmueble?.slug) return "";

    if (typeof window === "undefined") {
        return `/inmueble/${inmueble.slug}`;
    }

    return `${window.location.origin}/inmueble/${inmueble.slug}`;
};

const buildWhatsappMessage = (inmueble) => {
    const publicUrl = getPublicUrl(inmueble);

    const parts = [
        "Hola, me interesa este inmueble publicado en ONO Prop.",
        inmueble?.titulo ? `Inmueble: ${inmueble.titulo}` : "",
        inmueble?.operacion ? `Operación: ${inmueble.operacion}` : "",
        inmueble?.tipo ? `Tipo: ${inmueble.tipo}` : "",
        inmueble?.precio ? `Precio: ${formatPrice(inmueble)}` : "",
        publicUrl ? `Link: ${publicUrl}` : "",
    ].filter(Boolean);

    return parts.join("\n");
};

const buildWhatsappUrl = ({ whatsapp, inmueble }) => {
    const cleanNumber = normalizeWhatsappNumber(whatsapp);

    if (!cleanNumber) return null;

    const message = encodeURIComponent(buildWhatsappMessage(inmueble));

    return `https://wa.me/${cleanNumber}?text=${message}`;
};

const getNestedFeature = (inmueble, key) => {
    return inmueble?.caracteristicas?.[key] || inmueble?.[key] || "";
};

const getFeatureItems = (inmueble) => {
    const items = [];

    if (inmueble.superficie?.total) {
        items.push({
            label: "Superficie total",
            value: `${formatNumber(inmueble.superficie.total)} m²`,
        });
    }

    if (inmueble.superficie?.cubierta) {
        items.push({
            label: "Cubierta",
            value: `${formatNumber(inmueble.superficie.cubierta)} m²`,
        });
    }

    const ambientes = getNestedFeature(inmueble, "ambientes");
    const dormitorios = getNestedFeature(inmueble, "dormitorios");
    const banos = getNestedFeature(inmueble, "banos");
    const cocheras =
        getNestedFeature(inmueble, "cocherasCantidad") ||
        getNestedFeature(inmueble, "cocheras");

    if (ambientes) {
        items.push({
            label: "Ambientes",
            value: ambientes,
        });
    }

    if (dormitorios) {
        items.push({
            label: "Dormitorios",
            value: dormitorios,
        });
    }

    if (banos) {
        items.push({
            label: "Baños",
            value: banos,
        });
    }

    if (cocheras) {
        items.push({
            label: "Cocheras",
            value: cocheras === true ? "Sí" : cocheras,
        });
    }

    return items;
};

const buildSeoTitle = (inmueble, inmobiliaria) => {
    const title = normalizeSeoText(inmueble?.titulo);
    const operation = capitalize(inmueble?.operacion);
    const type = capitalize(inmueble?.tipo);
    const city = getDireccionValue(inmueble, "ciudad");
    const agencyName = inmobiliaria?.nombre || "ONO Prop";

    if (title) {
        return `${title} | Vista previa | ${agencyName}`;
    }

    return ["Vista previa", operation, type, city ? `en ${city}` : "", agencyName]
        .filter(Boolean)
        .join(" ");
};

const buildSeoDescription = ({ inmueble, inmobiliaria, address, featureItems }) => {
    const operation = capitalize(inmueble?.operacion);
    const type = capitalize(inmueble?.tipo);
    const price = formatPrice(inmueble);
    const agencyName = inmobiliaria?.nombre || "ONO Prop";

    const featureText =
        featureItems.length > 0
            ? featureItems
                .slice(0, 4)
                .map((item) => `${item.value} ${item.label.toLowerCase()}`)
                .join(", ")
            : "";

    const descriptionParts = [
        "Vista previa administrativa.",
        operation && type ? `${type} en ${operation}.` : "",
        address ? `Ubicación: ${address}.` : "",
        price ? `Precio: ${price}.` : "",
        featureText ? `Características: ${featureText}.` : "",
        inmueble?.descripcion ? normalizeSeoText(inmueble.descripcion) : "",
        `Publicado por ${agencyName}.`,
    ].filter(Boolean);

    return truncateText(descriptionParts.join(" "), 165);
};

const isPublicable = (inmueble = {}) => {
    return (
        inmueble.estado === "activo" &&
        inmueble.publicarEnPortal === true &&
        inmueble.deleted !== true &&
        inmueble.isDeleted !== true
    );
};

const buildEditPath = ({ id, inmobiliariaId }) => {
    if (!id) return "/admin/inmuebles/listado";

    const params = new URLSearchParams();

    if (inmobiliariaId) {
        params.set("inmobiliariaId", inmobiliariaId);
    }

    const queryString = params.toString();

    return `/admin/inmuebles/${id}/editar${queryString ? `?${queryString}` : ""}`;
};

const InmueblePreviewPage = () => {
    const { id } = useParams();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    const { user, activeInmobiliariaId } = useAuth();

    const queryInmobiliariaId =
        searchParams.get("inmobiliariaId") || searchParams.get("inmoId") || "";

    const selectedInmobiliariaId = queryInmobiliariaId || activeInmobiliariaId || "";

    const [inmueble, setInmueble] = useState(null);
    const [inmobiliaria, setInmobiliaria] = useState(null);
    const [loading, setLoading] = useState(true);
    const [contactLoading, setContactLoading] = useState(false);
    const [error, setError] = useState(null);
    const [selectedImageIndex, setSelectedImageIndex] = useState(0);
    const [copySuccess, setCopySuccess] = useState(false);
    const [consultaValues, setConsultaValues] = useState(INITIAL_CONSULTA);

    const sortedImages = useMemo(() => {
        if (!Array.isArray(inmueble?.images)) return [];

        return [...inmueble.images]
            .filter((img) => img?.url)
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    }, [inmueble]);

    const selectedImage = sortedImages[selectedImageIndex] || sortedImages[0];
    const visibleVideos = getVisibleInmuebleVideos(inmueble?.videos || []);
    const hasVideos = visibleVideos.length > 0;
    const address = buildAddress(inmueble);
    const featureItems = getFeatureItems(inmueble || {});
    const contactoInmobiliaria = useMemo(() => {
        return inmobiliaria?.configuracion?.contacto || {};
    }, [inmobiliaria]);
    const expensas = toNumber(inmueble?.expensas);
    const whatsappUrl = useMemo(() => {
        return buildWhatsappUrl({
            whatsapp: contactoInmobiliaria.whatsapp,
            inmueble,
        });
    }, [contactoInmobiliaria.whatsapp, inmueble]);

    const editPath = buildEditPath({
        id,
        inmobiliariaId: inmueble?.inmobiliariaId || selectedInmobiliariaId,
    });

    const publicPath = inmueble?.slug ? `/inmueble/${inmueble.slug}` : "";
    const seoUrl = getCurrentPreviewUrl(id);
    const seoImage = selectedImage?.url || sortedImages[0]?.url || DEFAULT_SEO_IMAGE;
    const seoTitle = buildSeoTitle(inmueble, inmobiliaria);
    const seoDescription = buildSeoDescription({
        inmueble,
        inmobiliaria,
        address,
        featureItems,
    });

    useEffect(() => {
        setSelectedImageIndex(0);
    }, [id]);

    useEffect(() => {
        const fetchInmueble = async () => {
            try {
                setLoading(true);
                setError(null);
                setInmobiliaria(null);

                if (!id) {
                    throw new Error("ID de inmueble no recibido");
                }

                if (!selectedInmobiliariaId) {
                    throw new Error("No hay inmobiliaria seleccionada para cargar la vista previa");
                }

                const data = await getInmuebleById(selectedInmobiliariaId, id);

                if (!data) {
                    throw new Error("El inmueble no existe");
                }

                if (!canReadInmueble(user, data)) {
                    throw new Error("No tenés permisos para ver este inmueble");
                }

                setInmueble(data);

                if (data.inmobiliariaId || selectedInmobiliariaId) {
                    try {
                        setContactLoading(true);

                        const inmobiliariaData = await getPublicInmobiliariaById(
                            data.inmobiliariaId || selectedInmobiliariaId,
                        );

                        setInmobiliaria(inmobiliariaData);
                    } catch (contactErr) {
                        console.warn(
                            "No se pudieron cargar los datos públicos de la inmobiliaria:",
                            contactErr,
                        );
                    } finally {
                        setContactLoading(false);
                    }
                }
            } catch (err) {
                console.error("Error cargando vista previa:", err);

                if (err.code === "permission-denied") {
                    setError("Acceso denegado");
                } else {
                    setError(err.message || "No se pudo cargar la vista previa");
                }
            } finally {
                setLoading(false);
            }
        };

        fetchInmueble();
    }, [id, user, selectedInmobiliariaId]);

    const handleConsultaChange = (e) => {
        const { name, value } = e.target;

        setConsultaValues((prev) => ({
            ...prev,
            [name]: value,
        }));
    };

    const handleCopyInmuebleLink = async () => {
        try {
            const currentUrl = getPublicUrl(inmueble) || getCurrentPreviewUrl(id);

            if (!currentUrl) {
                throw new Error("No se pudo obtener el link del inmueble");
            }

            await navigator.clipboard.writeText(currentUrl);

            setCopySuccess(true);

            window.setTimeout(() => {
                setCopySuccess(false);
            }, 2500);
        } catch (err) {
            console.error("Error copiando link del inmueble:", err);
            setCopySuccess(false);
            alert("No se pudo copiar el link del inmueble.");
        }
    };

    const handleShareInmuebleByWhatsapp = () => {
        try {
            const currentUrl = getPublicUrl(inmueble) || getCurrentPreviewUrl(id);

            if (!currentUrl) {
                throw new Error("No se pudo obtener el link del inmueble");
            }

            const message = [
                "Te comparto este inmueble publicado en ONO Prop:",
                inmueble?.titulo ? `Inmueble: ${inmueble.titulo}` : "",
                inmueble?.operacion ? `Operación: ${inmueble.operacion}` : "",
                inmueble?.tipo ? `Tipo: ${inmueble.tipo}` : "",
                inmueble?.precio ? `Precio: ${formatPrice(inmueble)}` : "",
                currentUrl,
            ]
                .filter(Boolean)
                .join("\n");

            const whatsappShareUrl = `https://wa.me/?text=${encodeURIComponent(
                message,
            )}`;

            window.open(whatsappShareUrl, "_blank", "noopener,noreferrer");
        } catch (err) {
            console.error("Error compartiendo inmueble por WhatsApp:", err);
            alert("No se pudo abrir WhatsApp para compartir el inmueble.");
        }
    };

    if (loading) {
        return (
            <main className="portal-home">
                <SEO
                    title="Cargando vista previa | ONO Prop"
                    description="Cargando vista previa administrativa del inmueble."
                    image={DEFAULT_SEO_IMAGE}
                    url={getCurrentPreviewUrl(id)}
                    noIndex
                />

                <div className="container py-5">
                    <div className="alert alert-light border">Cargando vista previa...</div>
                </div>
            </main>
        );
    }

    if (error) {
        return (
            <main className="portal-home">
                <SEO
                    title="Vista previa no disponible | ONO Prop"
                    description="No se pudo cargar la vista previa administrativa del inmueble."
                    image={DEFAULT_SEO_IMAGE}
                    url={getCurrentPreviewUrl(id)}
                    noIndex
                />

                <div className="container py-5">
                    <div className="alert alert-danger mb-3">{error}</div>

                    <div className="d-flex flex-wrap gap-2">
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => navigate("/admin/inmuebles/listado")}
                        >
                            Volver al listado
                        </button>

                        <Link to="/admin/dashboard" className="btn btn-outline-secondary">
                            Volver al dashboard
                        </Link>
                    </div>
                </div>
            </main>
        );
    }

    if (!inmueble) {
        return null;
    }

    return (
        <main className="portal-home">
            <SEO
                title={seoTitle}
                description={seoDescription}
                image={seoImage}
                url={seoUrl}
                type="article"
                siteName={inmobiliaria?.nombre || "ONO Prop"}
                noIndex
            />

            <section className="py-4 py-lg-5">
                <div className="container">
                    <div className="alert alert-info d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3 mb-4">
                        <div>
                            <strong>Vista previa admin.</strong>{" "}
                            Esta pantalla usa el mismo diseño de la ficha pública, pero puede
                            mostrarse aunque el inmueble no esté publicado en el portal.

                            <div className="small mt-1">
                                Estado: <strong>{inmueble.estado || "sin estado"}</strong> · Portal:{" "}
                                <strong>{isPublicable(inmueble) ? "publicado" : "no publicado"}</strong>
                                {inmueble.noIndex ? " · noindex activo" : ""}
                            </div>
                        </div>

                        <div className="d-flex flex-wrap gap-2">
                            <Link to="/admin/inmuebles/listado" className="btn btn-sm btn-outline-secondary">
                                Volver al listado
                            </Link>

                            <Link to={editPath} className="btn btn-sm btn-primary">
                                Editar inmueble
                            </Link>

                            {publicPath && isPublicable(inmueble) && (
                                <Link to={publicPath} className="btn btn-sm btn-success">
                                    Ver publicación real
                                </Link>
                            )}
                        </div>
                    </div>

                    <section className="card border-0 shadow-sm overflow-hidden mb-4">
                        <div className="row g-0">
                            <div className="col-lg-7">
                                <div className="p-3 p-lg-4">
                                    {selectedImage ? (
                                        <img
                                            src={selectedImage.url}
                                            alt={inmueble.titulo}
                                            className="img-fluid rounded-4 w-100"
                                            style={{
                                                height: 520,
                                                objectFit: "cover",
                                            }}
                                        />
                                    ) : (
                                        <div
                                            className="bg-light rounded-4 d-flex align-items-center justify-content-center text-muted"
                                            style={{ height: 520 }}
                                        >
                                            Sin imagen disponible
                                        </div>
                                    )}

                                    {sortedImages.length > 1 && (
                                        <div className="d-flex gap-2 mt-3 overflow-auto pb-1">
                                            {sortedImages.map((img, index) => (
                                                <button
                                                    key={img.storagePath || img.url}
                                                    type="button"
                                                    className={`border rounded-3 p-0 overflow-hidden ${selectedImageIndex === index
                                                        ? "border-primary border-3"
                                                        : "border-light"
                                                        }`}
                                                    onClick={() => setSelectedImageIndex(index)}
                                                    style={{
                                                        width: 92,
                                                        height: 70,
                                                        flex: "0 0 auto",
                                                        background: "transparent",
                                                    }}
                                                    aria-label={`Ver imagen ${index + 1}`}
                                                >
                                                    <img
                                                        src={img.url}
                                                        alt={`${inmueble.titulo} - imagen ${index + 1}`}
                                                        className="w-100 h-100"
                                                        style={{ objectFit: "cover" }}
                                                        loading="lazy"
                                                    />
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="col-lg-5">
                                <div className="p-4 p-lg-5 h-100 d-flex flex-column">
                                    <div className="mb-3 d-flex flex-wrap gap-2">
                                        {inmueble.operacion && (
                                            <span className="badge text-bg-primary">
                                                {inmueble.operacion}
                                            </span>
                                        )}

                                        {inmueble.tipo && (
                                            <span className="badge text-bg-dark">{inmueble.tipo}</span>
                                        )}

                                        {inmueble.destacado && (
                                            <span className="badge text-bg-warning">Destacado</span>
                                        )}

                                        {hasVideos && (
                                            <span className="badge text-bg-success">🎥 Tiene video</span>
                                        )}

                                        {!isPublicable(inmueble) && (
                                            <span className="badge text-bg-secondary">Vista privada</span>
                                        )}
                                    </div>

                                    <h1 className="display-6 fw-bold mb-3">{inmueble.titulo}</h1>

                                    {address && <p className="text-muted mb-3">{address}</p>}

                                    {inmobiliaria?.nombre && (
                                        <p className="text-muted mb-4">
                                            Publicado por{" "}
                                            {inmobiliaria.slug ? (
                                                <Link to={`/inmobiliaria/${inmobiliaria.slug}`}>
                                                    <strong>{inmobiliaria.nombre}</strong>
                                                </Link>
                                            ) : (
                                                <strong>{inmobiliaria.nombre}</strong>
                                            )}
                                        </p>
                                    )}

                                    <div className="mb-4">
                                        <div className="text-muted small">Precio</div>
                                        <div className="display-6 fw-bold">{formatPrice(inmueble)}</div>

                                        {expensas > 0 && (
                                            <div className="text-muted mt-1">
                                                Expensas: ${formatNumber(expensas)}
                                            </div>
                                        )}
                                    </div>

                                    {featureItems.length > 0 && (
                                        <div className="row g-2 mb-4">
                                            {featureItems.slice(0, 4).map((item) => (
                                                <div className="col-6" key={item.label}>
                                                    <div className="border rounded-3 p-3 h-100 bg-white">
                                                        <div className="fw-semibold">{item.value}</div>
                                                        <div className="small text-muted">{item.label}</div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <div className="d-grid gap-2 mt-auto">
                                        {whatsappUrl && (
                                            <a
                                                href={whatsappUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="btn btn-success btn-lg"
                                            >
                                                Consultar por WhatsApp
                                            </a>
                                        )}

                                        {hasVideos && (
                                            <a href="#videos" className="btn btn-outline-primary">
                                                Ver videos
                                            </a>
                                        )}

                                        <a href="#consulta" className="btn btn-primary">
                                            Enviar consulta
                                        </a>

                                        <div className="d-flex gap-2">
                                            <button
                                                type="button"
                                                className="btn btn-outline-primary w-50"
                                                onClick={handleCopyInmuebleLink}
                                            >
                                                {copySuccess ? "Link copiado" : "Copiar link"}
                                            </button>

                                            <button
                                                type="button"
                                                className="btn btn-outline-success w-50"
                                                onClick={handleShareInmuebleByWhatsapp}
                                            >
                                                Compartir
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    <div className="row g-4">
                        <section className="col-lg-8">
                            <InmuebleVideoSection videos={visibleVideos} />

                            {featureItems.length > 0 && (
                                <div className="card border-0 shadow-sm mb-4">
                                    <div className="card-body p-4">
                                        <h2 className="h4 mb-3">Características</h2>

                                        <div className="row g-3">
                                            {featureItems.map((item) => (
                                                <div className="col-6 col-md-4" key={item.label}>
                                                    <div className="border rounded-3 p-3 h-100">
                                                        <div className="h5 mb-1">{item.value}</div>
                                                        <div className="small text-muted">{item.label}</div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {inmueble.descripcion && (
                                <div className="card border-0 shadow-sm mb-4">
                                    <div className="card-body p-4">
                                        <h2 className="h4 mb-3">Descripción</h2>

                                        <p
                                            className="mb-0 text-muted"
                                            style={{
                                                whiteSpace: "pre-line",
                                                fontSize: "1.05rem",
                                            }}
                                        >
                                            {inmueble.descripcion}
                                        </p>
                                    </div>
                                </div>
                            )}

                            <div className="card border-0 shadow-sm mb-4">
                                <div className="card-body p-4">
                                    <h2 className="h4 mb-3">Ubicación</h2>

                                    {address ? (
                                        <p className="text-muted mb-0">{address}</p>
                                    ) : (
                                        <p className="text-muted mb-0">
                                            La ubicación se informará al contactar.
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="card border-0 shadow-sm">
                                <div className="card-body p-4">
                                    <h2 className="h5 mb-3">Datos internos de vista previa</h2>

                                    <div className="row g-3 small text-muted">
                                        <div className="col-md-6">
                                            <strong>ID:</strong> {inmueble.id}
                                        </div>

                                        <div className="col-md-6">
                                            <strong>Inmobiliaria:</strong>{" "}
                                            {inmueble.inmobiliariaId || selectedInmobiliariaId}
                                        </div>

                                        {inmueble.slug && (
                                            <div className="col-md-6">
                                                <strong>Slug:</strong> {inmueble.slug}
                                            </div>
                                        )}

                                        <div className="col-md-6">
                                            <strong>Imágenes:</strong> {sortedImages.length}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>

                        <aside className="col-lg-4" id="consulta">
                            <div className="card border-0 shadow-sm sticky-top" style={{ top: 90 }}>
                                <div className="card-body p-4">
                                    <h2 className="h4 mb-2">Consultar inmueble</h2>

                                    <p className="text-muted">
                                        Vista previa del bloque de consulta que verá el visitante en
                                        la ficha pública.
                                    </p>

                                    {contactLoading && (
                                        <p className="small text-muted">Cargando contacto...</p>
                                    )}

                                    {whatsappUrl && (
                                        <a
                                            href={whatsappUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="btn btn-success w-100 mb-3"
                                        >
                                            Consultar por WhatsApp
                                        </a>
                                    )}

                                    {inmobiliaria?.nombre && (
                                        <div className="small text-muted mb-2">
                                            Inmobiliaria: <strong>{inmobiliaria.nombre}</strong>
                                        </div>
                                    )}

                                    {contactoInmobiliaria.email && (
                                        <div className="small text-muted mb-2">
                                            Email:{" "}
                                            <a href={`mailto:${contactoInmobiliaria.email}`}>
                                                {contactoInmobiliaria.email}
                                            </a>
                                        </div>
                                    )}

                                    {contactoInmobiliaria.telefono && (
                                        <div className="small text-muted mb-3">
                                            Teléfono:{" "}
                                            <a href={`tel:${contactoInmobiliaria.telefono}`}>
                                                {contactoInmobiliaria.telefono}
                                            </a>
                                        </div>
                                    )}

                                    <div className="alert alert-light border small">
                                        El formulario está deshabilitado en vista previa para evitar
                                        generar consultas reales desde administración.
                                    </div>

                                    <form>
                                        <div className="mb-3">
                                            <label className="form-label">Nombre *</label>
                                            <input
                                                type="text"
                                                name="nombre"
                                                className="form-control"
                                                value={consultaValues.nombre}
                                                onChange={handleConsultaChange}
                                                disabled
                                            />
                                        </div>

                                        <div className="mb-3">
                                            <label className="form-label">Email</label>
                                            <input
                                                type="email"
                                                name="email"
                                                className="form-control"
                                                value={consultaValues.email}
                                                onChange={handleConsultaChange}
                                                disabled
                                            />
                                        </div>

                                        <div className="mb-3">
                                            <label className="form-label">Teléfono / WhatsApp</label>
                                            <input
                                                type="tel"
                                                name="telefono"
                                                className="form-control"
                                                value={consultaValues.telefono}
                                                onChange={handleConsultaChange}
                                                disabled
                                            />
                                            <div className="form-text">
                                                Ingresá al menos un email o teléfono.
                                            </div>
                                        </div>

                                        <div className="mb-3">
                                            <label className="form-label">Mensaje</label>
                                            <textarea
                                                name="mensaje"
                                                className="form-control"
                                                rows={4}
                                                value={consultaValues.mensaje}
                                                onChange={handleConsultaChange}
                                                disabled
                                                placeholder="Hola, me interesa este inmueble..."
                                            />
                                        </div>

                                        <button type="button" className="btn btn-primary w-100" disabled>
                                            Enviar consulta
                                        </button>
                                    </form>

                                    <hr />

                                    <div className="small text-muted">Código interno: {inmueble.id}</div>
                                </div>
                            </div>
                        </aside>
                    </div>
                </div>
            </section>
        </main>
    );
};

export default InmueblePreviewPage;