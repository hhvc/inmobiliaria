import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { getPublicInmuebles } from "../services/inmueble.service";
import {
    OPERACIONES_OPCIONES,
    TIPOS_INMUEBLE_OPCIONES,
} from "../utils/inmuebleSchema";

const PAGE_SIZE = 12;

const INITIAL_FILTERS = {
    search: "",
    tipo: "",
    operacion: "",
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

const buildAddress = (direccion = {}) => {
    return [direccion.barrio, direccion.ciudad].filter(Boolean).join(", ");
};

const getCoverImage = (inmueble) => {
    if (!Array.isArray(inmueble?.images)) return null;

    return [...inmueble.images]
        .filter((img) => img?.url)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))[0];
};

const InmueblePortalPage = () => {
    const [filters, setFilters] = useState(INITIAL_FILTERS);
    const [appliedFilters, setAppliedFilters] = useState(INITIAL_FILTERS);

    const [inmuebles, setInmuebles] = useState([]);
    const [cursor, setCursor] = useState(null);

    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState(null);

    const hasFilters = useMemo(() => {
        return Boolean(
            appliedFilters.search || appliedFilters.tipo || appliedFilters.operacion,
        );
    }, [appliedFilters]);

    const fetchInmuebles = async ({ append = false } = {}) => {
        try {
            if (append) {
                setLoadingMore(true);
            } else {
                setLoading(true);
                setCursor(null);
            }

            setError(null);

            const result = await getPublicInmuebles({
                ...appliedFilters,
                pageSize: PAGE_SIZE,
                lastDoc: append ? cursor : null,
            });

            const nextData = Array.isArray(result?.data) ? result.data : [];

            setInmuebles((prev) => (append ? [...prev, ...nextData] : nextData));
            setCursor(result?.lastDoc || null);
        } catch (err) {
            console.error("Error cargando inmuebles públicos:", err);

            if (err.code === "permission-denied") {
                setError("No se pudieron cargar los inmuebles publicados");
            } else {
                setError(err.message || "Ocurrió un error al cargar los inmuebles");
            }
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    };

    useEffect(() => {
        fetchInmuebles({ append: false });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [appliedFilters]);

    const handleChange = (e) => {
        const { name, value } = e.target;

        setFilters((prev) => ({
            ...prev,
            [name]: value,
        }));
    };

    const handleSearch = (e) => {
        e.preventDefault();
        setAppliedFilters(filters);
    };

    const handleReset = () => {
        setFilters(INITIAL_FILTERS);
        setAppliedFilters(INITIAL_FILTERS);
    };

    return (
        <main className="container py-4">
            <header className="mb-4">
                <p className="text-uppercase text-muted small mb-1">
                    Portal inmobiliario
                </p>

                <h1 className="h2 mb-2">Inmuebles publicados</h1>

                <p className="text-muted mb-0">
                    Propiedades disponibles de las inmobiliarias adheridas.
                </p>
            </header>

            {/* =========================
          Filtros
         ========================= */}
            <section className="card mb-4">
                <div className="card-body">
                    <form className="row g-3 align-items-end" onSubmit={handleSearch}>
                        <div className="col-12 col-lg-4">
                            <label className="form-label">Buscar</label>
                            <input
                                type="search"
                                name="search"
                                className="form-control"
                                placeholder="Barrio, ciudad, descripción..."
                                value={filters.search}
                                onChange={handleChange}
                            />
                        </div>

                        <div className="col-12 col-md-6 col-lg-3">
                            <label className="form-label">Tipo</label>
                            <select
                                name="tipo"
                                className="form-select"
                                value={filters.tipo}
                                onChange={handleChange}
                            >
                                <option value="">Todos</option>

                                {TIPOS_INMUEBLE_OPCIONES.map((tipo) => (
                                    <option key={tipo.id} value={tipo.id}>
                                        {tipo.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="col-12 col-md-6 col-lg-3">
                            <label className="form-label">Operación</label>
                            <select
                                name="operacion"
                                className="form-select"
                                value={filters.operacion}
                                onChange={handleChange}
                            >
                                <option value="">Todas</option>

                                {OPERACIONES_OPCIONES.map((operacion) => (
                                    <option key={operacion.id} value={operacion.id}>
                                        {operacion.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="col-12 col-lg-2 d-flex gap-2">
                            <button type="submit" className="btn btn-primary flex-fill">
                                Buscar
                            </button>

                            <button
                                type="button"
                                className="btn btn-outline-secondary"
                                onClick={handleReset}
                                disabled={!hasFilters}
                            >
                                Limpiar
                            </button>
                        </div>
                    </form>
                </div>
            </section>

            {/* =========================
          Estados
         ========================= */}
            {loading && (
                <div className="text-muted py-4">Cargando inmuebles publicados...</div>
            )}

            {error && <div className="alert alert-warning">{error}</div>}

            {!loading && !error && inmuebles.length === 0 && (
                <div className="alert alert-info">
                    No hay inmuebles publicados con esos criterios.
                </div>
            )}

            {/* =========================
          Listado
         ========================= */}
            {!loading && !error && inmuebles.length > 0 && (
                <>
                    <section className="row g-4">
                        {inmuebles.map((inmueble) => {
                            const coverImage = getCoverImage(inmueble);
                            const address = buildAddress(inmueble.direccion);

                            return (
                                <article className="col-12 col-md-6 col-lg-4" key={inmueble.id}>
                                    <div className="card h-100 shadow-sm">
                                        {coverImage ? (
                                            <img
                                                src={coverImage.url}
                                                alt={inmueble.titulo}
                                                className="card-img-top"
                                                style={{
                                                    height: 220,
                                                    objectFit: "cover",
                                                }}
                                                loading="lazy"
                                            />
                                        ) : (
                                            <div
                                                className="bg-light d-flex align-items-center justify-content-center text-muted"
                                                style={{ height: 220 }}
                                            >
                                                Sin imagen
                                            </div>
                                        )}

                                        <div className="card-body d-flex flex-column">
                                            <div className="d-flex justify-content-between gap-2 mb-2">
                                                <span className="badge bg-secondary">
                                                    {inmueble.operacion || "Inmueble"}
                                                </span>

                                                {inmueble.destacado && (
                                                    <span className="badge bg-primary">Destacado</span>
                                                )}
                                            </div>

                                            <h2 className="h5 card-title">{inmueble.titulo}</h2>

                                            {address && (
                                                <p className="text-muted small mb-2">{address}</p>
                                            )}

                                            <p className="h5 mb-3">{formatPrice(inmueble)}</p>

                                            <div className="small text-muted mb-3">
                                                {inmueble.tipo && <span>{inmueble.tipo}</span>}

                                                {inmueble.ambientes && (
                                                    <span> · {inmueble.ambientes} amb.</span>
                                                )}

                                                {inmueble.dormitorios && (
                                                    <span> · {inmueble.dormitorios} dorm.</span>
                                                )}
                                            </div>

                                            <div className="mt-auto">
                                                <Link
                                                    to={`/inmueble/${inmueble.slug}`}
                                                    className="btn btn-outline-primary w-100"
                                                >
                                                    Ver detalle
                                                </Link>
                                            </div>
                                        </div>
                                    </div>
                                </article>
                            );
                        })}
                    </section>

                    {cursor && (
                        <div className="text-center mt-4">
                            <button
                                type="button"
                                className="btn btn-outline-secondary"
                                onClick={() => fetchInmuebles({ append: true })}
                                disabled={loadingMore}
                            >
                                {loadingMore ? "Cargando..." : "Cargar más"}
                            </button>
                        </div>
                    )}
                </>
            )}
        </main>
    );
};

export default InmueblePortalPage;