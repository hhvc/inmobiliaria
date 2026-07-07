import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { getPublicInmuebles } from "../services/inmueble.service";

const INITIAL_FILTERS = {
    search: "",
    operacion: "",
    tipo: "",
    ciudad: "",
    barrio: "",
    dormitoriosMin: "",
    precioMin: "",
    precioMax: "",
};

const OPERACIONES = [
    { value: "venta", label: "Venta" },
    { value: "alquiler", label: "Alquiler" },
    { value: "alquiler_temporal", label: "Alquiler temporal" },
    { value: "compra", label: "Compra" },
    { value: "tasacion", label: "Tasación" },
];

const TIPOS = [
    { value: "casa", label: "Casa" },
    { value: "departamento", label: "Departamento" },
    { value: "terreno", label: "Terreno" },
    { value: "local", label: "Local" },
    { value: "oficina", label: "Oficina" },
    { value: "cochera", label: "Cochera" },
    { value: "deposito", label: "Depósito" },
    { value: "quinta", label: "Quinta" },
    { value: "campo", label: "Campo" },
];

const normalizeText = (value = "") => {
    return value
        .toString()
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
};

const toNumber = (value) => {
    if (value === null || value === undefined || value === "") return null;

    const cleanValue = value.toString().replace(/\./g, "").replace(",", ".");
    const number = Number(cleanValue);

    return Number.isFinite(number) ? number : null;
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

const getCoverImage = (inmueble) => {
    if (!Array.isArray(inmueble?.images)) return null;

    return [...inmueble.images]
        .filter((img) => img?.url)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))[0];
};

const getUniqueOptions = (items, getter) => {
    const values = items
        .map(getter)
        .filter(Boolean)
        .map((value) => value.toString().trim())
        .filter(Boolean);

    return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
};

const matchesTextSearch = (inmueble, search) => {
    const normalizedSearch = normalizeText(search);

    if (!normalizedSearch) return true;

    const searchableText = [
        inmueble.titulo,
        inmueble.descripcion,
        inmueble.tipo,
        inmueble.operacion,
        getDireccionValue(inmueble, "calle"),
        getDireccionValue(inmueble, "barrio"),
        getDireccionValue(inmueble, "ciudad"),
        getDireccionValue(inmueble, "provincia"),
    ]
        .filter(Boolean)
        .join(" ");

    return normalizeText(searchableText).includes(normalizedSearch);
};

const matchesFilters = (inmueble, filters) => {
    if (!matchesTextSearch(inmueble, filters.search)) return false;

    if (filters.operacion && inmueble.operacion !== filters.operacion) {
        return false;
    }

    if (filters.tipo && inmueble.tipo !== filters.tipo) {
        return false;
    }

    if (
        filters.ciudad &&
        normalizeText(getDireccionValue(inmueble, "ciudad")) !==
        normalizeText(filters.ciudad)
    ) {
        return false;
    }

    if (
        filters.barrio &&
        normalizeText(getDireccionValue(inmueble, "barrio")) !==
        normalizeText(filters.barrio)
    ) {
        return false;
    }

    const dormitorios = toNumber(inmueble.dormitorios);
    const dormitoriosMin = toNumber(filters.dormitoriosMin);

    if (
        dormitoriosMin !== null &&
        (dormitorios === null || dormitorios < dormitoriosMin)
    ) {
        return false;
    }

    const precio = toNumber(inmueble.precio);
    const precioMin = toNumber(filters.precioMin);
    const precioMax = toNumber(filters.precioMax);

    if (precioMin !== null && (precio === null || precio < precioMin)) {
        return false;
    }

    if (precioMax !== null && (precio === null || precio > precioMax)) {
        return false;
    }

    return true;
};

const InmueblePortalPage = () => {
    const [inmuebles, setInmuebles] = useState([]);
    const [filters, setFilters] = useState(INITIAL_FILTERS);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const ciudades = useMemo(() => {
        return getUniqueOptions(inmuebles, (inmueble) =>
            getDireccionValue(inmueble, "ciudad"),
        );
    }, [inmuebles]);

    const barrios = useMemo(() => {
        const filteredByCiudad = filters.ciudad
            ? inmuebles.filter(
                (inmueble) =>
                    normalizeText(getDireccionValue(inmueble, "ciudad")) ===
                    normalizeText(filters.ciudad),
            )
            : inmuebles;

        return getUniqueOptions(filteredByCiudad, (inmueble) =>
            getDireccionValue(inmueble, "barrio"),
        );
    }, [filters.ciudad, inmuebles]);

    const filteredInmuebles = useMemo(() => {
        return inmuebles.filter((inmueble) => matchesFilters(inmueble, filters));
    }, [filters, inmuebles]);

    const activeFiltersCount = useMemo(() => {
        return Object.values(filters).filter(Boolean).length;
    }, [filters]);

    useEffect(() => {
        const fetchInmuebles = async () => {
            try {
                setLoading(true);
                setError(null);

                const result = await getPublicInmuebles({
                    pageSize: 100,
                });

                setInmuebles(result?.data || []);
            } catch (err) {
                console.error("Error cargando portal público de inmuebles:", err);

                if (err.code === "permission-denied") {
                    setError("No se pudieron cargar los inmuebles publicados.");
                } else {
                    setError(err.message || "No se pudieron cargar los inmuebles.");
                }
            } finally {
                setLoading(false);
            }
        };

        fetchInmuebles();
    }, []);

    const handleFilterChange = (e) => {
        const { name, value } = e.target;

        setFilters((prev) => {
            const nextFilters = {
                ...prev,
                [name]: value,
            };

            if (name === "ciudad") {
                nextFilters.barrio = "";
            }

            return nextFilters;
        });
    };

    const handleClearFilters = () => {
        setFilters(INITIAL_FILTERS);
    };

    return (
        <main className="container py-4">
            <header className="mb-4">
                <p className="text-uppercase text-muted small mb-1">
                    Portal inmobiliario
                </p>

                <div className="d-flex flex-wrap justify-content-between gap-3 align-items-start">
                    <div>
                        <h1 className="h2 mb-2">Inmuebles publicados</h1>

                        <p className="text-muted mb-0">
                            Buscá propiedades por operación, tipo, ubicación, dormitorios y
                            precio.
                        </p>
                    </div>

                    <div className="text-md-end">
                        <div className="fw-semibold">
                            {filteredInmuebles.length} resultado
                            {filteredInmuebles.length === 1 ? "" : "s"}
                        </div>

                        {activeFiltersCount > 0 && (
                            <button
                                type="button"
                                className="btn btn-link btn-sm p-0"
                                onClick={handleClearFilters}
                            >
                                Limpiar filtros
                            </button>
                        )}
                    </div>
                </div>
            </header>

            <section className="card mb-4">
                <div className="card-body">
                    <div className="row g-3">
                        <div className="col-12 col-lg-4">
                            <label className="form-label">Buscar</label>
                            <input
                                type="search"
                                name="search"
                                className="form-control"
                                placeholder="Ej: Nueva Córdoba, casa, pileta..."
                                value={filters.search}
                                onChange={handleFilterChange}
                            />
                        </div>

                        <div className="col-6 col-lg-2">
                            <label className="form-label">Operación</label>
                            <select
                                name="operacion"
                                className="form-select"
                                value={filters.operacion}
                                onChange={handleFilterChange}
                            >
                                <option value="">Todas</option>
                                {OPERACIONES.map((operacion) => (
                                    <option key={operacion.value} value={operacion.value}>
                                        {operacion.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="col-6 col-lg-2">
                            <label className="form-label">Tipo</label>
                            <select
                                name="tipo"
                                className="form-select"
                                value={filters.tipo}
                                onChange={handleFilterChange}
                            >
                                <option value="">Todos</option>
                                {TIPOS.map((tipo) => (
                                    <option key={tipo.value} value={tipo.value}>
                                        {tipo.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="col-6 col-lg-2">
                            <label className="form-label">Ciudad</label>
                            <select
                                name="ciudad"
                                className="form-select"
                                value={filters.ciudad}
                                onChange={handleFilterChange}
                            >
                                <option value="">Todas</option>
                                {ciudades.map((ciudad) => (
                                    <option key={ciudad} value={ciudad}>
                                        {ciudad}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="col-6 col-lg-2">
                            <label className="form-label">Barrio</label>
                            <select
                                name="barrio"
                                className="form-select"
                                value={filters.barrio}
                                onChange={handleFilterChange}
                                disabled={barrios.length === 0}
                            >
                                <option value="">Todos</option>
                                {barrios.map((barrio) => (
                                    <option key={barrio} value={barrio}>
                                        {barrio}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="col-6 col-lg-2">
                            <label className="form-label">Dormitorios mín.</label>
                            <select
                                name="dormitoriosMin"
                                className="form-select"
                                value={filters.dormitoriosMin}
                                onChange={handleFilterChange}
                            >
                                <option value="">Cualquiera</option>
                                <option value="1">1+</option>
                                <option value="2">2+</option>
                                <option value="3">3+</option>
                                <option value="4">4+</option>
                                <option value="5">5+</option>
                            </select>
                        </div>

                        <div className="col-6 col-lg-2">
                            <label className="form-label">Precio mínimo</label>
                            <input
                                type="number"
                                name="precioMin"
                                className="form-control"
                                min="0"
                                placeholder="Ej: 50000"
                                value={filters.precioMin}
                                onChange={handleFilterChange}
                            />
                        </div>

                        <div className="col-6 col-lg-2">
                            <label className="form-label">Precio máximo</label>
                            <input
                                type="number"
                                name="precioMax"
                                className="form-control"
                                min="0"
                                placeholder="Ej: 150000"
                                value={filters.precioMax}
                                onChange={handleFilterChange}
                            />
                        </div>

                        <div className="col-12 col-lg-6 d-flex align-items-end justify-content-lg-end">
                            <button
                                type="button"
                                className="btn btn-outline-secondary"
                                onClick={handleClearFilters}
                                disabled={activeFiltersCount === 0}
                            >
                                Limpiar búsqueda
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            {loading && (
                <div className="alert alert-light border">
                    Cargando inmuebles publicados...
                </div>
            )}

            {error && <div className="alert alert-warning">{error}</div>}

            {!loading && !error && filteredInmuebles.length === 0 && (
                <div className="alert alert-info">
                    No encontramos inmuebles con esos filtros. Probá ampliando la
                    búsqueda.
                </div>
            )}

            {!loading && !error && filteredInmuebles.length > 0 && (
                <section className="row g-4">
                    {filteredInmuebles.map((inmueble) => {
                        const coverImage = getCoverImage(inmueble);
                        const address = buildAddress(inmueble);
                        const detalleUrl = `/inmueble/${inmueble.slug || inmueble.id}`;

                        return (
                            <article className="col-12 col-md-6 col-xl-4" key={inmueble.id}>
                                <div className="card h-100 shadow-sm">
                                    {coverImage ? (
                                        <img
                                            src={coverImage.url}
                                            alt={inmueble.titulo}
                                            className="card-img-top"
                                            style={{
                                                height: 230,
                                                objectFit: "cover",
                                            }}
                                            loading="lazy"
                                        />
                                    ) : (
                                        <div
                                            className="bg-light d-flex align-items-center justify-content-center text-muted"
                                            style={{ height: 230 }}
                                        >
                                            Sin imagen
                                        </div>
                                    )}

                                    <div className="card-body d-flex flex-column">
                                        <div className="d-flex flex-wrap gap-2 mb-2">
                                            {inmueble.operacion && (
                                                <span className="badge text-bg-primary">
                                                    {inmueble.operacion}
                                                </span>
                                            )}

                                            {inmueble.tipo && (
                                                <span className="badge text-bg-secondary">
                                                    {inmueble.tipo}
                                                </span>
                                            )}

                                            {inmueble.destacado && (
                                                <span className="badge text-bg-warning">
                                                    Destacado
                                                </span>
                                            )}
                                        </div>

                                        <h2 className="h5">{inmueble.titulo}</h2>

                                        {address && (
                                            <p className="text-muted small mb-2">{address}</p>
                                        )}

                                        <div className="h5 mb-3">{formatPrice(inmueble)}</div>

                                        <div className="row g-2 small text-muted mb-3">
                                            {inmueble.dormitorios && (
                                                <div className="col-6">
                                                    Dormitorios: {inmueble.dormitorios}
                                                </div>
                                            )}

                                            {inmueble.banos && (
                                                <div className="col-6">Baños: {inmueble.banos}</div>
                                            )}

                                            {inmueble.superficie?.total && (
                                                <div className="col-6">
                                                    Sup.: {formatNumber(inmueble.superficie.total)} m²
                                                </div>
                                            )}

                                            {inmueble.cocheras && (
                                                <div className="col-6">
                                                    Cocheras: {inmueble.cocheras}
                                                </div>
                                            )}
                                        </div>

                                        {inmueble.descripcion && (
                                            <p className="text-muted small">
                                                {inmueble.descripcion.length > 110
                                                    ? `${inmueble.descripcion.slice(0, 110)}...`
                                                    : inmueble.descripcion}
                                            </p>
                                        )}

                                        <div className="mt-auto">
                                            <Link to={detalleUrl} className="btn btn-primary w-100">
                                                Ver inmueble
                                            </Link>
                                        </div>
                                    </div>
                                </div>
                            </article>
                        );
                    })}
                </section>
            )}
        </main>
    );
};

export default InmueblePortalPage;