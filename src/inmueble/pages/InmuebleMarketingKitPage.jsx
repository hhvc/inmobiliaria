import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";

import { db } from "../../firebase/config";

const getStoredActiveInmobiliariaId = () => {
    if (typeof window === "undefined") return null;

    return (
        window.localStorage.getItem("activeInmobiliariaId") ||
        window.localStorage.getItem("inmobiliariaActivaId") ||
        window.localStorage.getItem("activeInmobiliaria") ||
        null
    );
};

const formatPrice = (inmueble) => {
    const precio = inmueble?.precio;

    if (precio === null || precio === undefined || precio === "") {
        return "Consultar precio";
    }

    const moneda = inmueble?.moneda || "$";
    const numericPrice = Number(precio);

    if (Number.isNaN(numericPrice)) {
        return `${moneda} ${precio}`;
    }

    return `${moneda} ${numericPrice.toLocaleString("es-AR")}`;
};

const normalizeText = (value = "") => {
    return value
        .toString()
        .trim()
        .replace(/\s+/g, " ");
};

const capitalize = (value = "") => {
    const cleanValue = normalizeText(value);

    if (!cleanValue) return "";

    return cleanValue.charAt(0).toUpperCase() + cleanValue.slice(1);
};

const getLocationLabel = (inmueble) => {
    const parts = [
        inmueble?.barrio,
        inmueble?.ciudad,
        inmueble?.provincia,
    ].filter(Boolean);

    return parts.length > 0 ? parts.join(", ") : "Ubicación a consultar";
};

const getMainImage = (inmueble) => {
    if (!Array.isArray(inmueble?.images) || inmueble.images.length === 0) {
        return "";
    }

    const sortedImages = [...inmueble.images].sort((a, b) => {
        const orderA = Number(a?.order ?? 999);
        const orderB = Number(b?.order ?? 999);

        return orderA - orderB;
    });

    return sortedImages[0]?.url || "";
};

const getPublicUrl = (inmueble) => {
    if (typeof window === "undefined") return "";

    const slug = inmueble?.slug;

    if (!slug) return "";

    return `${window.location.origin}/inmueble/${slug}`;
};

const buildFeatureLine = (inmueble) => {
    const features = [];

    if (inmueble?.ambientes) {
        features.push(`${inmueble.ambientes} ambientes`);
    }

    if (inmueble?.dormitorios) {
        features.push(`${inmueble.dormitorios} dormitorios`);
    }

    if (inmueble?.banos) {
        features.push(`${inmueble.banos} baños`);
    }

    if (inmueble?.superficieCubierta) {
        features.push(`${inmueble.superficieCubierta} m² cubiertos`);
    }

    if (inmueble?.superficieTotal) {
        features.push(`${inmueble.superficieTotal} m² totales`);
    }

    return features.join(" · ");
};

const buildHashtags = (inmueble, inmobiliaria) => {
    const baseTags = [
        "inmuebles",
        "inmobiliaria",
        "propiedades",
        "realestate",
    ];

    const dynamicTags = [
        inmueble?.operacion,
        inmueble?.tipo,
        inmueble?.ciudad,
        inmueble?.barrio,
        inmobiliaria?.nombre,
    ]
        .filter(Boolean)
        .map((tag) =>
            tag
                .toString()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .replace(/[^a-zA-Z0-9]/g, "")
                .toLowerCase(),
        )
        .filter(Boolean);

    const uniqueTags = Array.from(new Set([...baseTags, ...dynamicTags]));

    return uniqueTags.map((tag) => `#${tag}`).join(" ");
};

const buildMarketingTexts = ({ inmueble, inmobiliaria, publicUrl }) => {
    const operation = capitalize(inmueble?.operacion || "propiedad");
    const type = capitalize(inmueble?.tipo || "inmueble");
    const title = normalizeText(inmueble?.titulo || `${type} en ${operation}`);
    const price = formatPrice(inmueble);
    const location = getLocationLabel(inmueble);
    const features = buildFeatureLine(inmueble);
    const description = normalizeText(inmueble?.descripcion || "");
    const agencyName = inmobiliaria?.nombre || "LaDoctaProp";
    const hashtags = buildHashtags(inmueble, inmobiliaria);

    const shortInstagram = [
        `🏡 ${title}`,
        "",
        `📍 ${location}`,
        `💰 ${price}`,
        features ? `✨ ${features}` : "",
        "",
        `Consultá por esta propiedad con ${agencyName}.`,
        publicUrl ? `🔗 ${publicUrl}` : "",
        "",
        hashtags,
    ]
        .filter((line) => line !== "")
        .join("\n");

    const longDescription = [
        `${title}`,
        "",
        `Operación: ${operation}`,
        `Tipo: ${type}`,
        `Ubicación: ${location}`,
        `Precio: ${price}`,
        features ? `Características: ${features}` : "",
        "",
        description ||
        "Propiedad publicada por la inmobiliaria. Consultá para recibir más información, coordinar una visita o conocer condiciones comerciales.",
        "",
        `Inmobiliaria: ${agencyName}`,
        publicUrl ? `Ficha pública: ${publicUrl}` : "",
    ]
        .filter((line) => line !== "")
        .join("\n");

    const whatsappText = [
        `Hola, quiero consultar por esta propiedad:`,
        "",
        `${title}`,
        `📍 ${location}`,
        `💰 ${price}`,
        features ? `✨ ${features}` : "",
        publicUrl ? `🔗 ${publicUrl}` : "",
    ]
        .filter((line) => line !== "")
        .join("\n");

    const instagramStory = [
        `${type} en ${operation}`,
        location,
        price,
        publicUrl ? "Pedí más info por el link" : "Pedí más información",
    ]
        .filter(Boolean)
        .join(" · ");

    return {
        shortInstagram,
        longDescription,
        whatsappText,
        instagramStory,
        hashtags,
    };
};

const TextCopyCard = ({ title, description, value, rows = 8 }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(value || "");
            setCopied(true);

            window.setTimeout(() => {
                setCopied(false);
            }, 1800);
        } catch (error) {
            console.error("No se pudo copiar:", error);
            window.alert("No se pudo copiar el texto.");
        }
    };

    return (
        <div className="card border-0 shadow-sm">
            <div className="card-body p-4">
                <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
                    <div>
                        <h2 className="h5 mb-1">{title}</h2>

                        {description && (
                            <p className="text-muted small mb-0">{description}</p>
                        )}
                    </div>

                    <button
                        type="button"
                        className="btn btn-outline-primary btn-sm"
                        onClick={handleCopy}
                        disabled={!value}
                    >
                        {copied ? "Copiado" : "Copiar"}
                    </button>
                </div>

                <textarea
                    className="form-control"
                    rows={rows}
                    value={value}
                    readOnly
                />
            </div>
        </div>
    );
};

const InmuebleMarketingKitPage = () => {
    const { id } = useParams();

    const [inmueble, setInmueble] = useState(null);
    const [inmobiliaria, setInmobiliaria] = useState(null);
    const [loading, setLoading] = useState(true);
    const [copySuccess, setCopySuccess] = useState("");
    const [error, setError] = useState(null);

    const publicUrl = useMemo(() => getPublicUrl(inmueble), [inmueble]);
    const mainImageUrl = useMemo(() => getMainImage(inmueble), [inmueble]);

    const marketingTexts = useMemo(() => {
        if (!inmueble) {
            return {
                shortInstagram: "",
                longDescription: "",
                whatsappText: "",
                instagramStory: "",
                hashtags: "",
            };
        }

        return buildMarketingTexts({
            inmueble,
            inmobiliaria,
            publicUrl,
        });
    }, [inmobiliaria, inmueble, publicUrl]);

    useEffect(() => {
        const loadData = async () => {
            try {
                setLoading(true);
                setError(null);

                const activeInmobiliariaId = getStoredActiveInmobiliariaId();

                if (!activeInmobiliariaId) {
                    throw new Error(
                        "No se pudo determinar la inmobiliaria activa. Volvé al panel de inmobiliaria y seleccioná una.",
                    );
                }

                const inmuebleRef = doc(
                    db,
                    "inmobiliarias",
                    activeInmobiliariaId,
                    "inmuebles",
                    id,
                );

                const inmuebleSnap = await getDoc(inmuebleRef);

                if (!inmuebleSnap.exists()) {
                    throw new Error("No se encontró el inmueble seleccionado.");
                }

                const inmuebleData = {
                    id: inmuebleSnap.id,
                    ...inmuebleSnap.data(),
                    inmobiliariaId: activeInmobiliariaId,
                };

                setInmueble(inmuebleData);

                const inmobiliariaRef = doc(db, "inmobiliarias", activeInmobiliariaId);
                const inmobiliariaSnap = await getDoc(inmobiliariaRef);

                if (inmobiliariaSnap.exists()) {
                    setInmobiliaria({
                        id: inmobiliariaSnap.id,
                        ...inmobiliariaSnap.data(),
                    });
                }
            } catch (err) {
                console.error("Error cargando kit de marketing:", err);
                setError(err.message || "No se pudo cargar el kit de marketing.");
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [id]);

    const handleCopyPublicUrl = async () => {
        try {
            await navigator.clipboard.writeText(publicUrl);
            setCopySuccess("Link público copiado.");

            window.setTimeout(() => {
                setCopySuccess("");
            }, 1800);
        } catch (error) {
            console.error("No se pudo copiar link:", error);
            window.alert("No se pudo copiar el link.");
        }
    };

    if (loading) {
        return (
            <main className="container py-5 text-center">
                <div className="spinner-border" />
                <p className="text-muted mt-3">Generando kit de publicación...</p>
            </main>
        );
    }

    if (error) {
        return (
            <main className="container py-5">
                <div className="alert alert-danger">{error}</div>

                <Link to="/admin/inmuebles/listado" className="btn btn-primary">
                    Volver al listado
                </Link>
            </main>
        );
    }

    return (
        <main className="container py-4">
            <header className="mb-4">
                <div className="d-flex flex-wrap justify-content-between align-items-start gap-3">
                    <div>
                        <p className="text-uppercase text-muted small mb-1">
                            Marketing inmobiliario
                        </p>

                        <h1 className="h3 mb-1">Kit de publicación</h1>

                        <p className="text-muted mb-0">
                            Textos listos para Instagram, WhatsApp y publicación manual en
                            portales.
                        </p>
                    </div>

                    <div className="d-flex flex-wrap gap-2">
                        <Link
                            to="/admin/inmuebles/listado"
                            className="btn btn-outline-secondary"
                        >
                            Volver al listado
                        </Link>

                        {publicUrl && (
                            <a
                                href={publicUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-primary"
                            >
                                Ver ficha pública
                            </a>
                        )}
                    </div>
                </div>
            </header>

            {copySuccess && <div className="alert alert-success">{copySuccess}</div>}

            <section className="row g-4 mb-4">
                <div className="col-lg-8">
                    <div className="card border-0 shadow-sm h-100">
                        <div className="card-body p-4">
                            <div className="row g-4">
                                <div className="col-md-5">
                                    {mainImageUrl ? (
                                        <img
                                            src={mainImageUrl}
                                            alt={inmueble.titulo || "Imagen principal"}
                                            className="img-fluid rounded-4 border"
                                            style={{
                                                width: "100%",
                                                aspectRatio: "4 / 3",
                                                objectFit: "cover",
                                            }}
                                        />
                                    ) : (
                                        <div
                                            className="bg-light border rounded-4 d-flex align-items-center justify-content-center text-muted"
                                            style={{
                                                width: "100%",
                                                aspectRatio: "4 / 3",
                                            }}
                                        >
                                            Sin imagen principal
                                        </div>
                                    )}
                                </div>

                                <div className="col-md-7">
                                    <h2 className="h4 mb-2">
                                        {inmueble.titulo || "Inmueble sin título"}
                                    </h2>

                                    <p className="text-muted mb-3">
                                        {getLocationLabel(inmueble)}
                                    </p>

                                    <div className="d-flex flex-wrap gap-2 mb-3">
                                        <span className="badge text-bg-primary">
                                            {capitalize(inmueble.operacion || "operación")}
                                        </span>

                                        <span className="badge text-bg-light border text-dark">
                                            {capitalize(inmueble.tipo || "tipo")}
                                        </span>

                                        <span className="badge text-bg-success">
                                            {formatPrice(inmueble)}
                                        </span>
                                    </div>

                                    {buildFeatureLine(inmueble) && (
                                        <p className="mb-3">{buildFeatureLine(inmueble)}</p>
                                    )}

                                    <div className="vstack gap-2">
                                        {publicUrl && (
                                            <div className="input-group">
                                                <input
                                                    type="text"
                                                    className="form-control"
                                                    value={publicUrl}
                                                    readOnly
                                                />

                                                <button
                                                    type="button"
                                                    className="btn btn-outline-primary"
                                                    onClick={handleCopyPublicUrl}
                                                >
                                                    Copiar link
                                                </button>
                                            </div>
                                        )}

                                        {mainImageUrl && (
                                            <a
                                                href={mainImageUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="btn btn-outline-secondary"
                                            >
                                                Abrir imagen principal
                                            </a>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <aside className="col-lg-4">
                    <div className="card border-0 shadow-sm h-100">
                        <div className="card-body p-4">
                            <h2 className="h5 mb-3">Uso recomendado</h2>

                            <ol className="text-muted ps-3 mb-0">
                                <li>Copiar texto corto para Instagram.</li>
                                <li>Usar la imagen principal como pieza visual.</li>
                                <li>Agregar el link público en WhatsApp o historias.</li>
                                <li>Usar texto largo para portales inmobiliarios.</li>
                            </ol>
                        </div>
                    </div>
                </aside>
            </section>

            <section className="row g-4 mb-5 pb-4">
                <div className="col-lg-6">
                    <TextCopyCard
                        title="Instagram / Facebook"
                        description="Caption corto para redes sociales."
                        value={marketingTexts.shortInstagram}
                        rows={10}
                    />
                </div>

                <div className="col-lg-6">
                    <TextCopyCard
                        title="WhatsApp"
                        description="Texto para enviar a interesados o grupos."
                        value={marketingTexts.whatsappText}
                        rows={10}
                    />
                </div>

                <div className="col-lg-6">
                    <TextCopyCard
                        title="Descripción larga"
                        description="Base para portales como Zonaprop, Argenprop o MercadoLibre."
                        value={marketingTexts.longDescription}
                        rows={12}
                    />
                </div>

                <div className="col-lg-6">
                    <TextCopyCard
                        title="Historia / texto breve"
                        description="Texto corto para story, flyer o placa."
                        value={marketingTexts.instagramStory}
                        rows={5}
                    />

                    <div className="mt-4">
                        <TextCopyCard
                            title="Hashtags"
                            description="Etiquetas sugeridas para redes."
                            value={marketingTexts.hashtags}
                            rows={5}
                        />
                    </div>
                </div>
            </section>
        </main>
    );
};

export default InmuebleMarketingKitPage;