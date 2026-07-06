import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { getInmuebleById } from "../services/inmueble.service";
import { useAuth } from "../../context/auth/useAuth";
import { canReadInmueble } from "../helpers/permissions";

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

const buildAddress = (direccion = {}) => {
    return [
        direccion.calle,
        direccion.numero,
        direccion.barrio,
        direccion.ciudad,
    ]
        .filter(Boolean)
        .join(", ");
};

const InmueblePreviewPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();

    const { user, activeInmobiliariaId } = useAuth();

    const [inmueble, setInmueble] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const sortedImages = useMemo(() => {
        if (!Array.isArray(inmueble?.images)) return [];

        return [...inmueble.images]
            .filter((img) => img?.url)
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    }, [inmueble]);

    const coverImage = sortedImages[0] || null;
    const address = buildAddress(inmueble?.direccion);

    useEffect(() => {
        const fetchInmueble = async () => {
            try {
                setLoading(true);
                setError(null);

                if (!id) {
                    throw new Error("ID de inmueble no recibido");
                }

                if (!activeInmobiliariaId) {
                    throw new Error("No hay inmobiliaria activa seleccionada");
                }

                const data = await getInmuebleById(activeInmobiliariaId, id);

                if (!data) {
                    throw new Error("El inmueble no existe");
                }

                if (!canReadInmueble(user, data)) {
                    throw new Error("No tenés permisos para ver este inmueble");
                }

                setInmueble(data);
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
    }, [id, user, activeInmobiliariaId]);

    if (loading) {
        return (
            <main className="container py-5">
                <p className="text-muted">Cargando vista previa...</p>
            </main>
        );
    }

    if (error) {
        return (
            <main className="container py-5">
                <div className="alert alert-danger">{error}</div>

                <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => navigate("/admin/inmuebles/listado")}
                >
                    Volver al listado
                </button>
            </main>
        );
    }

    if (!inmueble) return null;

    return (
        <main className="container py-4">
            <div className="alert alert-info d-flex justify-content-between align-items-center gap-3">
                <div>
                    <strong>Vista previa admin.</strong>{" "}
                    Esta página permite ver el inmueble aunque no esté publicado en el
                    portal.
                </div>

                <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    onClick={() => navigate("/admin/inmuebles/listado")}
                >
                    Volver
                </button>
            </div>

            <header className="mb-4">
                <div className="d-flex flex-wrap justify-content-between gap-3 align-items-start">
                    <div>
                        <p className="text-uppercase text-muted small mb-1">
                            {inmueble.operacion || "Inmueble"}
                            {inmueble.tipo ? ` · ${inmueble.tipo}` : ""}
                        </p>

                        <h1 className="h2 mb-2">{inmueble.titulo}</h1>

                        {address && <p className="text-muted mb-0">{address}</p>}

                        <div className="mt-2 d-flex flex-wrap gap-2">
                            <span
                                className={
                                    inmueble.estado === "activo"
                                        ? "badge bg-success"
                                        : "badge bg-secondary"
                                }
                            >
                                Estado: {inmueble.estado || "sin estado"}
                            </span>

                            <span
                                className={
                                    inmueble.publicarEnPortal
                                        ? "badge bg-primary"
                                        : "badge bg-light text-dark"
                                }
                            >
                                Portal:{" "}
                                {inmueble.publicarEnPortal ? "Publicado" : "No publicado"}
                            </span>

                            {inmueble.destacado && (
                                <span className="badge bg-warning text-dark">Destacado</span>
                            )}
                        </div>
                    </div>

                    <div className="text-md-end">
                        <div className="h3 mb-1">{formatPrice(inmueble)}</div>

                        {inmueble.expensas > 0 && (
                            <div className="text-muted">
                                Expensas: ${formatNumber(inmueble.expensas)}
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {coverImage && (
                <section className="mb-4">
                    <img
                        src={coverImage.url}
                        alt={inmueble.titulo}
                        className="img-fluid rounded w-100"
                        style={{
                            maxHeight: 520,
                            objectFit: "cover",
                        }}
                    />
                </section>
            )}

            {sortedImages.length > 1 && (
                <section className="mb-4">
                    <div className="row g-3">
                        {sortedImages.slice(1).map((img, index) => (
                            <div className="col-6 col-md-3" key={img.storagePath || img.url}>
                                <img
                                    src={img.url}
                                    alt={`${inmueble.titulo} - imagen ${index + 2}`}
                                    className="img-fluid rounded w-100"
                                    style={{
                                        height: 160,
                                        objectFit: "cover",
                                    }}
                                    loading="lazy"
                                />
                            </div>
                        ))}
                    </div>
                </section>
            )}

            <div className="row g-4">
                <section className="col-lg-8">
                    <div className="card mb-4">
                        <div className="card-header fw-semibold">Características</div>

                        <div className="card-body">
                            <div className="row g-3">
                                {inmueble.superficie?.total && (
                                    <div className="col-6 col-md-4">
                                        <div className="text-muted small">Superficie total</div>
                                        <div className="fw-semibold">
                                            {formatNumber(inmueble.superficie.total)} m²
                                        </div>
                                    </div>
                                )}

                                {inmueble.superficie?.cubierta && (
                                    <div className="col-6 col-md-4">
                                        <div className="text-muted small">Superficie cubierta</div>
                                        <div className="fw-semibold">
                                            {formatNumber(inmueble.superficie.cubierta)} m²
                                        </div>
                                    </div>
                                )}

                                {inmueble.ambientes && (
                                    <div className="col-6 col-md-4">
                                        <div className="text-muted small">Ambientes</div>
                                        <div className="fw-semibold">{inmueble.ambientes}</div>
                                    </div>
                                )}

                                {inmueble.dormitorios && (
                                    <div className="col-6 col-md-4">
                                        <div className="text-muted small">Dormitorios</div>
                                        <div className="fw-semibold">{inmueble.dormitorios}</div>
                                    </div>
                                )}

                                {inmueble.banos && (
                                    <div className="col-6 col-md-4">
                                        <div className="text-muted small">Baños</div>
                                        <div className="fw-semibold">{inmueble.banos}</div>
                                    </div>
                                )}

                                {inmueble.cocheras && (
                                    <div className="col-6 col-md-4">
                                        <div className="text-muted small">Cocheras</div>
                                        <div className="fw-semibold">{inmueble.cocheras}</div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {inmueble.descripcion && (
                        <div className="card">
                            <div className="card-header fw-semibold">Descripción</div>

                            <div className="card-body">
                                <p className="mb-0" style={{ whiteSpace: "pre-line" }}>
                                    {inmueble.descripcion}
                                </p>
                            </div>
                        </div>
                    )}
                </section>

                <aside className="col-lg-4">
                    <div className="card sticky-top" style={{ top: 90 }}>
                        <div className="card-header fw-semibold">Datos admin</div>

                        <div className="card-body small text-muted">
                            <p className="mb-2">
                                <strong>ID:</strong> {inmueble.id}
                            </p>

                            <p className="mb-2">
                                <strong>Inmobiliaria:</strong> {inmueble.inmobiliariaId}
                            </p>

                            {inmueble.slug && (
                                <p className="mb-2">
                                    <strong>Slug:</strong> {inmueble.slug}
                                </p>
                            )}

                            <button
                                type="button"
                                className="btn btn-primary w-100 mt-3"
                                onClick={() => navigate(`/admin/inmuebles/${id}/editar`)}
                            >
                                Editar inmueble
                            </button>
                        </div>
                    </div>
                </aside>
            </div>
        </main>
    );
};

export default InmueblePreviewPage;