import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import {
    createNetworkCollaborationRequest,
    getNetworkSharedInmuebleById,
} from "../services/inmueble.service";

import { useAuth } from "../../context/auth/useAuth";

const formatCurrency = (moneda, precio) => {
    if (!precio) return "Consultar";

    const numericPrice = Number(precio);

    if (Number.isNaN(numericPrice)) {
        return `${moneda || ""} ${precio}`.trim();
    }

    return new Intl.NumberFormat("es-AR", {
        style: "currency",
        currency: moneda || "USD",
        maximumFractionDigits: 0,
    }).format(numericPrice);
};

const getLocationText = (inmueble) => {
    const parts = [
        inmueble?.direccion?.calle,
        inmueble?.direccion?.numero,
        inmueble?.direccion?.barrio,
        inmueble?.direccion?.ciudad,
    ].filter(Boolean);

    return parts.length > 0 ? parts.join(", ") : "Ubicación no informada";
};

const getImageUrl = (image) => {
    return image?.url || image?.src || "";
};

const Field = ({ label, value }) => (
    <div>
        <small className="text-muted d-block">{label}</small>
        <strong>{value || "No informado"}</strong>
    </div>
);

const TextBlock = ({ label, value }) => {
    if (!value) return null;

    return (
        <div>
            <small className="text-muted d-block">{label}</small>
            <p className="mb-0">{value}</p>
        </div>
    );
};

const InmuebleNetworkDetailPage = () => {
    const { inmobiliariaId, inmuebleId } = useParams();
    const navigate = useNavigate();
    const { user, activeInmobiliariaId } = useAuth();

    const [inmueble, setInmueble] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [requestMessage, setRequestMessage] = useState("");
    const [requestLoading, setRequestLoading] = useState(false);
    const [requestSuccess, setRequestSuccess] = useState("");
    const [requestError, setRequestError] = useState("");

    const userInmobiliariaIds = useMemo(() => {
        const ids = Array.isArray(user?.inmobiliarias) ? user.inmobiliarias : [];

        return Array.from(new Set([activeInmobiliariaId, ...ids].filter(Boolean)));
    }, [activeInmobiliariaId, user]);

    const isOwnInmueble = userInmobiliariaIds.includes(inmobiliariaId);

    useEffect(() => {
        const fetchInmueble = async () => {
            try {
                setLoading(true);
                setError("");

                if (!inmobiliariaId || !inmuebleId) {
                    throw new Error("No se recibieron los identificadores del inmueble");
                }

                if (isOwnInmueble) {
                    throw new Error(
                        "Este inmueble pertenece a tu propia inmobiliaria. Podés verlo desde tu listado de inmuebles.",
                    );
                }

                const data = await getNetworkSharedInmuebleById(
                    inmobiliariaId,
                    inmuebleId,
                );

                if (!data) {
                    throw new Error(
                        "El inmueble no está disponible en la Red de colegas",
                    );
                }

                setInmueble(data);
            } catch (err) {
                console.error("Error cargando detalle de Red de colegas:", err);
                setError(err.message || "No se pudo cargar el inmueble compartido");
            } finally {
                setLoading(false);
            }
        };

        fetchInmueble();
    }, [inmobiliariaId, inmuebleId, isOwnInmueble]);

    const handleCreateRequest = async (e) => {
        e.preventDefault();

        try {
            setRequestLoading(true);
            setRequestSuccess("");
            setRequestError("");

            await createNetworkCollaborationRequest({
                inmueble,
                requesterInmobiliariaId: activeInmobiliariaId,
                mensaje: requestMessage,
            });

            setRequestSuccess(
                "Solicitud enviada. La inmobiliaria propietaria podrá revisar tu pedido.",
            );
            setRequestMessage("");
        } catch (err) {
            console.error("Error creando solicitud de colaboración:", err);
            setRequestError(
                err.message || "No se pudo enviar la solicitud de colaboración",
            );
        } finally {
            setRequestLoading(false);
        }
    };

    if (loading) {
        return (
            <section className="container py-4">
                <p className="text-muted mb-0">Cargando inmueble compartido...</p>
            </section>
        );
    }

    if (error) {
        return (
            <section className="container py-4">
                <div className="alert alert-danger">{error}</div>

                <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => navigate("/admin/red/inmuebles-compartidos")}
                >
                    Volver a Red de colegas
                </button>
            </section>
        );
    }

    if (!inmueble) return null;

    const networkData = inmueble.networkData || {};
    const sharing = inmueble.sharing || {};
    const images = Array.isArray(inmueble.images) ? inmueble.images : [];
    const mainImage = getImageUrl(images[0]);

    return (
        <section className="container py-4">
            <header className="mb-4 d-flex flex-column flex-lg-row justify-content-between gap-3">
                <div>
                    <div className="d-flex flex-wrap gap-2 mb-2">
                        <span className="badge text-bg-primary">Red de colegas</span>

                        {sharing.allowColleagueContact && (
                            <span className="badge text-bg-success">Acepta contacto</span>
                        )}

                        {networkData.documentationStatus && (
                            <span className="badge text-bg-light border">
                                Doc.: {networkData.documentationStatus}
                            </span>
                        )}
                    </div>

                    <h1 className="h3 mb-1">
                        {inmueble.titulo || "Inmueble compartido"}
                    </h1>

                    <p className="text-muted mb-0">{getLocationText(inmueble)}</p>
                </div>

                <Link
                    to="/admin/red/inmuebles-compartidos"
                    className="btn btn-outline-secondary align-self-start"
                >
                    Volver
                </Link>
            </header>

            <div className="row g-4">
                <div className="col-lg-7">
                    <div className="card border-0 shadow-sm overflow-hidden mb-4">
                        {mainImage ? (
                            <img
                                src={mainImage}
                                alt={inmueble.titulo || "Inmueble compartido"}
                                className="w-100"
                                style={{
                                    maxHeight: 430,
                                    objectFit: "cover",
                                }}
                            />
                        ) : (
                            <div
                                className="d-flex align-items-center justify-content-center bg-light text-muted"
                                style={{ minHeight: 320 }}
                            >
                                Sin imagen principal
                            </div>
                        )}
                    </div>

                    {images.length > 1 && (
                        <div className="row g-3 mb-4">
                            {images.slice(1, 7).map((image, index) => {
                                const imageUrl = getImageUrl(image);

                                if (!imageUrl) return null;

                                return (
                                    <div className="col-6 col-md-4" key={`${imageUrl}-${index}`}>
                                        <img
                                            src={imageUrl}
                                            alt={`Imagen ${index + 2}`}
                                            className="w-100 rounded"
                                            style={{
                                                height: 140,
                                                objectFit: "cover",
                                            }}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    <div className="card border-0 shadow-sm">
                        <div className="card-header bg-white fw-semibold">
                            Descripción pública
                        </div>

                        <div className="card-body">
                            <p className="mb-0">
                                {inmueble.descripcion || "Sin descripción cargada."}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="col-lg-5">
                    <div className="card border-0 shadow-sm mb-4">
                        <div className="card-header bg-white fw-semibold">
                            Datos del inmueble
                        </div>

                        <div className="card-body">
                            <div className="row g-3">
                                <div className="col-6">
                                    <Field
                                        label="Precio publicado"
                                        value={formatCurrency(inmueble.moneda, inmueble.precio)}
                                    />
                                </div>

                                <div className="col-6">
                                    <Field label="Operación" value={inmueble.operacion} />
                                </div>

                                <div className="col-6">
                                    <Field label="Tipo" value={inmueble.tipo} />
                                </div>

                                <div className="col-6">
                                    <Field label="Ambientes" value={inmueble.ambientes} />
                                </div>

                                <div className="col-6">
                                    <Field label="Dormitorios" value={inmueble.dormitorios} />
                                </div>

                                <div className="col-6">
                                    <Field label="Baños" value={inmueble.banos} />
                                </div>

                                <div className="col-6">
                                    <Field label="Cocheras" value={inmueble.cocheras} />
                                </div>

                                <div className="col-6">
                                    <Field
                                        label="Inmobiliaria origen"
                                        value={inmueble.inmobiliariaId}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="card border-0 shadow-sm mb-4">
                        <div className="card-header bg-white fw-semibold">
                            Información para colegas
                        </div>

                        <div className="card-body">
                            <div className="row g-3">
                                <div className="col-12">
                                    <Field
                                        label="Comisión / colaboración ofrecida"
                                        value={networkData.commissionShare}
                                    />
                                </div>

                                <div className="col-12">
                                    <Field
                                        label="Precio interno / margen negociable"
                                        value={networkData.internalPrice}
                                    />
                                </div>

                                <div className="col-12">
                                    <Field
                                        label="Estado de documentación"
                                        value={networkData.documentationStatus}
                                    />
                                </div>

                                <div className="col-12">
                                    <Field
                                        label="Dirección exacta"
                                        value={networkData.exactAddress || "No compartida"}
                                    />
                                </div>

                                <div className="col-12">
                                    <TextBlock
                                        label="Instrucciones para visitas"
                                        value={networkData.visitInstructions}
                                    />
                                </div>

                                <div className="col-12">
                                    <TextBlock
                                        label="Observaciones para colegas"
                                        value={networkData.notesForColleagues}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {(networkData.ownerName || networkData.ownerPhone) && (
                        <div className="alert alert-warning">
                            <strong>Datos del propietario:</strong>
                            <br />
                            {[networkData.ownerName, networkData.ownerPhone]
                                .filter(Boolean)
                                .join(" · ")}
                        </div>
                    )}

                    <div className="card border-0 shadow-sm">
                        <div className="card-body">
                            <h2 className="h6">Solicitar colaboración</h2>

                            <p className="text-muted small">
                                Enviá una solicitud a la inmobiliaria que comparte este
                                inmueble. Quedará registrada para seguimiento comercial.
                            </p>

                            {requestSuccess && (
                                <div className="alert alert-success small">
                                    {requestSuccess}
                                </div>
                            )}

                            {requestError && (
                                <div className="alert alert-danger small">{requestError}</div>
                            )}

                            <form onSubmit={handleCreateRequest}>
                                <div className="mb-3">
                                    <label className="form-label">
                                        Mensaje para la inmobiliaria
                                    </label>

                                    <textarea
                                        className="form-control"
                                        rows={4}
                                        value={requestMessage}
                                        placeholder="Ej: Tengo un interesado para esta propiedad. ¿Podemos coordinar condiciones y visita?"
                                        onChange={(e) => setRequestMessage(e.target.value)}
                                    />
                                </div>

                                <button
                                    type="submit"
                                    className="btn btn-success w-100"
                                    disabled={requestLoading || Boolean(requestSuccess)}
                                >
                                    {requestLoading ? "Enviando..." : "Solicitar colaboración"}
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default InmuebleNetworkDetailPage;