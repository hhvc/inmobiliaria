import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import {
    OPERACIONES_OPCIONES,
    TIPOS_INMUEBLE_OPCIONES,
} from "../utils/inmuebleSchema";
import { getNetworkSharedInmuebles } from "../services/inmueble.service";
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

const getMainImage = (inmueble) => {
    if (!Array.isArray(inmueble?.images) || inmueble.images.length === 0) {
        return null;
    }

    return inmueble.images[0]?.url || inmueble.images[0]?.src || null;
};

const getLocationText = (inmueble) => {
    const parts = [
        inmueble?.direccion?.barrio,
        inmueble?.direccion?.ciudad,
    ].filter(Boolean);

    return parts.length > 0 ? parts.join(", ") : "Ubicación no informada";
};

const InmuebleNetworkPage = () => {
    const { user, activeInmobiliariaId } = useAuth();

    const [filters, setFilters] = useState({
        search: "",
        tipo: "",
        operacion: "",
    });

    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const excludeInmobiliariaIds = useMemo(() => {
        const userInmobiliarias = Array.isArray(user?.inmobiliarias)
            ? user.inmobiliarias
            : [];

        return Array.from(
            new Set(
                [activeInmobiliariaId, ...userInmobiliarias].filter(Boolean),
            ),
        );
    }, [activeInmobiliariaId, user]);

    const fetchItems = async () => {
        try {
            setLoading(true);
            setError("");

            const result = await getNetworkSharedInmuebles({
                ...filters,
                excludeInmobiliariaIds,
            });

            setItems(result.data || []);
        } catch (err) {
            console.error("Error cargando Red de colegas:", err);
            setError(
                err.message || "No se pudieron cargar los inmuebles compartidos",
            );
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchItems();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [excludeInmobiliariaIds.join("|")]);

    const handleChange = (e) => {
        const { name, value } = e.target;

        setFilters((prev) => ({
            ...prev,
            [name]: value,
        }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        fetchItems();
    };

    const handleReset = () => {
        setFilters({
            search: "",
            tipo: "",
            operacion: "",
        });

        window.setTimeout(() => {
            fetchItems();
        }, 0);
    };

    return (
        <section className="container py-4">
            <header className="mb-4 d-flex flex-column flex-lg-row justify-content-between gap-3">
                <div>
                    <h1 className="h3 mb-1">Red de colegas</h1>
                    <p className="text-muted mb-0">
                        Inmuebles compartidos por otras inmobiliarias para colaboración
                        comercial.
                    </p>
                </div>

                <Link
                    to="/admin/inmuebles/listado"
                    className="btn btn-outline-secondary align-self-start"
                >
                    Volver a mis inmuebles
                </Link>
            </header>

            <div className="alert alert-info">
                <strong>Información interna.</strong> Estos inmuebles no necesariamente
                están publicados para el público general. La información comercial se
                comparte solo entre colegas habilitados en ONO Prop.
            </div>

            <form className="card mb-4" onSubmit={handleSubmit}>
                <div className="card-body row g-3 align-items-end">
                    <div className="col-md-4">
                        <label className="form-label">Buscar</label>
                        <input
                            type="search"
                            name="search"
                            className="form-control"
                            value={filters.search}
                            placeholder="Título, barrio, ciudad..."
                            onChange={handleChange}
                        />
                    </div>

                    <div className="col-md-3">
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

                    <div className="col-md-3">
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

                    <div className="col-md-2 d-flex gap-2">
                        <button type="submit" className="btn btn-primary w-100">
                            Filtrar
                        </button>

                        <button
                            type="button"
                            className="btn btn-outline-secondary"
                            onClick={handleReset}
                            title="Limpiar filtros"
                        >
                            ×
                        </button>
                    </div>
                </div>
            </form>

            {loading && (
                <div className="text-center text-muted py-5">
                    Cargando inmuebles compartidos...
                </div>
            )}

            {!loading && error && <div className="alert alert-danger">{error}</div>}

            {!loading && !error && items.length === 0 && (
                <div className="card">
                    <div className="card-body text-center py-5">
                        <h2 className="h5">Todavía no hay inmuebles compartidos</h2>
                        <p className="text-muted mb-0">
                            Cuando otras inmobiliarias activen “Compartir con colegas”, sus
                            inmuebles aparecerán en esta sección.
                        </p>
                    </div>
                </div>
            )}

            {!loading && !error && items.length > 0 && (
                <div className="row g-4">
                    {items.map((inmueble) => {
                        const imageUrl = getMainImage(inmueble);
                        const networkData = inmueble.networkData || {};
                        const sharing = inmueble.sharing || {};

                        return (
                            <div className="col-12" key={`${inmueble.inmobiliariaId}-${inmueble.id}`}>
                                <article className="card shadow-sm border-0 overflow-hidden">
                                    <div className="row g-0">
                                        <div className="col-md-4 col-lg-3">
                                            {imageUrl ? (
                                                <img
                                                    src={imageUrl}
                                                    alt={inmueble.titulo || "Inmueble compartido"}
                                                    className="w-100 h-100"
                                                    style={{
                                                        minHeight: 220,
                                                        objectFit: "cover",
                                                    }}
                                                />
                                            ) : (
                                                <div
                                                    className="d-flex align-items-center justify-content-center bg-light text-muted h-100"
                                                    style={{ minHeight: 220 }}
                                                >
                                                    Sin imagen
                                                </div>
                                            )}
                                        </div>

                                        <div className="col-md-8 col-lg-9">
                                            <div className="card-body">
                                                <div className="d-flex flex-column flex-lg-row justify-content-between gap-3">
                                                    <div>
                                                        <div className="d-flex flex-wrap gap-2 mb-2">
                                                            <span className="badge text-bg-primary">
                                                                Red de colegas
                                                            </span>

                                                            {sharing.allowColleagueContact && (
                                                                <span className="badge text-bg-success">
                                                                    Acepta contacto
                                                                </span>
                                                            )}

                                                            {networkData.documentationStatus && (
                                                                <span className="badge text-bg-light border">
                                                                    Doc.: {networkData.documentationStatus}
                                                                </span>
                                                            )}
                                                        </div>

                                                        <h2 className="h5 mb-1">
                                                            {inmueble.titulo || "Inmueble sin título"}
                                                        </h2>

                                                        <p className="text-muted mb-2">
                                                            {getLocationText(inmueble)}
                                                        </p>

                                                        <p className="h5 mb-3">
                                                            {formatCurrency(inmueble.moneda, inmueble.precio)}
                                                        </p>
                                                    </div>

                                                    <div className="text-lg-end">
                                                        <small className="text-muted d-block">
                                                            Inmobiliaria
                                                        </small>
                                                        <strong>{inmueble.inmobiliariaId}</strong>
                                                    </div>
                                                </div>

                                                <hr />

                                                <div className="row g-3">
                                                    <div className="col-md-4">
                                                        <small className="text-muted d-block">
                                                            Comisión ofrecida
                                                        </small>
                                                        <strong>
                                                            {networkData.commissionShare || "No informada"}
                                                        </strong>
                                                    </div>

                                                    <div className="col-md-4">
                                                        <small className="text-muted d-block">
                                                            Precio interno / margen
                                                        </small>
                                                        <strong>
                                                            {networkData.internalPrice || "No informado"}
                                                        </strong>
                                                    </div>

                                                    <div className="col-md-4">
                                                        <small className="text-muted d-block">
                                                            Dirección exacta
                                                        </small>
                                                        <strong>
                                                            {networkData.exactAddress || "No compartida"}
                                                        </strong>
                                                    </div>

                                                    {networkData.visitInstructions && (
                                                        <div className="col-12">
                                                            <small className="text-muted d-block">
                                                                Instrucciones para visitas
                                                            </small>
                                                            <p className="mb-0">
                                                                {networkData.visitInstructions}
                                                            </p>
                                                        </div>
                                                    )}

                                                    {networkData.notesForColleagues && (
                                                        <div className="col-12">
                                                            <small className="text-muted d-block">
                                                                Observaciones para colegas
                                                            </small>
                                                            <p className="mb-0">
                                                                {networkData.notesForColleagues}
                                                            </p>
                                                        </div>
                                                    )}

                                                    {(networkData.ownerName || networkData.ownerPhone) && (
                                                        <div className="col-12">
                                                            <div className="alert alert-warning small mb-0">
                                                                <strong>Datos del propietario:</strong>{" "}
                                                                {[networkData.ownerName, networkData.ownerPhone]
                                                                    .filter(Boolean)
                                                                    .join(" · ")}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </article>
                            </div>
                        );
                    })}
                </div>
            )}
        </section>
    );
};

export default InmuebleNetworkPage;