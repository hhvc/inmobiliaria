import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { collection, getDocs } from "firebase/firestore";

import SEO from "../../components/SEO";
import { db } from "../../firebase/config";

import { getPortalRankingConfig } from "../../inmueble/services/portalRankingConfig.service";
import {
    DEFAULT_PORTAL_RANKING_CONFIG,
    getPortalRankingScore,
} from "../../inmueble/utils/portalRanking.helpers";

const INITIAL_FILTERS = {
    search: "",
    sourceType: "",
    estado: "",
    operacion: "",
    tipo: "",
    portalStatus: "",
};

const SOURCE_OPTIONS = [
    { value: "inmobiliaria", label: "Inmobiliarias" },
    { value: "particular", label: "Particulares" },
];

const PORTAL_STATUS_OPTIONS = [
    { value: "publicada", label: "Publicadas en portal" },
    { value: "no_publicada", label: "No publicadas en portal" },
];

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
    { value: "campo", label: "Campo" },
    { value: "quinta", label: "Quinta" },
    { value: "otro", label: "Otro" },
];

const normalizeText = (value = "") => {
    return value
        .toString()
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
};

const getDateValue = (value) => {
    if (!value) return 0;

    if (typeof value.toDate === "function") {
        return value.toDate().getTime();
    }

    if (value.seconds !== undefined) {
        return value.seconds * 1000;
    }

    const date = new Date(value);

    return Number.isFinite(date.getTime()) ? date.getTime() : 0;
};

const formatDate = (value) => {
    const dateValue = getDateValue(value);

    if (!dateValue) return "Sin fecha";

    return new Intl.DateTimeFormat("es-AR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    }).format(new Date(dateValue));
};

const formatPrice = (publication = {}) => {
    const price =
        publication.precio ||
        publication.precioEstimado ||
        publication.precioLabel ||
        "";

    if (!price) return "Consultar";

    const number = Number(price);

    if (!Number.isFinite(number)) {
        return price.toString();
    }

    const currency = publication.moneda || "USD";

    return `${currency} ${number.toLocaleString("es-AR")}`;
};

const getOptionLabel = (options, value) => {
    return options.find((option) => option.value === value)?.label || value;
};

const getImageCount = (publication = {}) => {
    if (!Array.isArray(publication.images)) return 0;

    return publication.images.filter((image) => image?.url).length;
};

const getVideoCount = (publication = {}) => {
    if (!Array.isArray(publication.videos)) return 0;

    return publication.videos.filter((video) => video?.visible !== false).length;
};

const isDeletedInmueble = (publication = {}) => {
    return (
        publication.deleted === true ||
        publication.isDeleted === true ||
        publication.estado === "eliminado" ||
        publication.estado === "borrado"
    );
};

const isPortalPublished = (publication = {}) => {
    if (publication.sourceType === "particular") {
        return (
            publication.publicStatus === "active" &&
            publication.moderationStatus === "approved"
        );
    }

    return (
        publication.estado === "activo" &&
        publication.deleted !== true &&
        publication.isDeleted !== true &&
        publication.publicarEnPortal === true
    );
};

const getStatusLabel = (publication = {}) => {
    if (publication.sourceType === "particular") {
        return publication.publicStatus || "sin_estado";
    }

    if (isDeletedInmueble(publication)) return "eliminado";

    return publication.estado || "sin_estado";
};

const getPortalBadgeClass = (publication = {}) => {
    return isPortalPublished(publication)
        ? "badge text-bg-success"
        : "badge text-bg-secondary";
};

const getPortalBadgeLabel = (publication = {}) => {
    return isPortalPublished(publication)
        ? "Publicada en portal"
        : "No publicada";
};

const buildInmueblePublicPath = (publication = {}) => {
    if (publication.sourceType === "particular") {
        return `/particulares/${publication.id}`;
    }

    if (publication.slug) return `/inmueble/${publication.slug}`;

    return `/inmueble/${publication.id}`;
};

const buildAdminEditPath = (publication = {}) => {
    if (publication.adminEditPath) {
        return publication.adminEditPath;
    }

    if (publication.sourceType === "particular") {
        return "";
    }

    return `/admin/inmuebles/${publication.id}/editar?inmobiliariaId=${publication.inmobiliariaId}`;
};

const isOnoPropInmobiliaria = (inmobiliaria = {}) => {
    const values = [
        inmobiliaria.nombre,
        inmobiliaria.razonSocial,
        inmobiliaria.slug,
        inmobiliaria.id,
    ]
        .filter(Boolean)
        .map(normalizeText);

    return values.some((value) =>
        [
            "ono prop",
            "onoprop",
            "ono-prop",
            "ono_prop",
        ].includes(value),
    );
};

const isInmuebleFromParticular = (inmueble = {}, inmobiliaria = {}) => {
    if (inmueble.sourceType === "particular") return true;
    if (inmueble.publicationType === "particular") return true;
    if (inmueble.publicationMode === "particular") return true;
    if (inmueble.sourceTargetType === "onoprop") return true;
    if (inmueble.targetType === "onoprop") return true;
    if (inmueble.validationOwner === "onoprop") return true;
    if (inmueble.approvalMode === "particular_publication") return true;
    if (inmueble.particularPublicationId) return true;
    if (inmueble.sourceRequestId && isOnoPropInmobiliaria(inmobiliaria)) return true;

    return false;
};

const getParticularSourceLabel = (inmueble = {}) => {
    return (
        inmueble.ownerDisplayName ||
        inmueble.requesterDisplayName ||
        inmueble.contact?.nombre ||
        inmueble.contact?.name ||
        "Dueño particular"
    );
};

const getRankingResult = (publication = {}, rankingConfig = {}) => {
    try {
        return getPortalRankingScore(publication, rankingConfig);
    } catch (err) {
        console.debug("No se pudo calcular ranking de publicación:", publication.id, err);
        return 0;
    }
};

const getRankingTotal = (publication = {}, rankingConfig = {}) => {
    const result = getRankingResult(publication, rankingConfig);

    if (typeof result === "number") {
        return Math.round(result);
    }

    if (result && typeof result.total === "number") {
        return Math.round(result.total);
    }

    if (result && typeof result.totalScore === "number") {
        return Math.round(result.totalScore);
    }

    if (result && typeof result.score === "number") {
        return Math.round(result.score);
    }

    return 0;
};

const mapInmuebleToPortalPublication = (inmueble = {}, inmobiliaria = {}) => {
    const inmobiliariaName =
        inmobiliaria.nombre ||
        inmobiliaria.razonSocial ||
        inmueble.inmobiliariaNombre ||
        "Inmobiliaria";

    const comesFromParticular = isInmuebleFromParticular(inmueble, inmobiliaria);

    return {
        ...inmueble,

        sourceType: comesFromParticular ? "particular" : "inmobiliaria",
        sourceTypeLabel: comesFromParticular ? "Particular" : "Inmobiliaria",
        sourceLabel: comesFromParticular
            ? getParticularSourceLabel(inmueble)
            : inmobiliariaName,

        managedByLabel: comesFromParticular ? inmobiliariaName : "",
        storageSourceType: "inmobiliaria",

        inmobiliariaId: inmobiliaria.id,
        inmobiliariaSlug: inmobiliaria.slug || "",

        adminEditPath: `/admin/inmuebles/${inmueble.id}/editar?inmobiliariaId=${inmobiliaria.id}`,

        createdAt: inmueble.createdAt || inmueble.updatedAt || null,
        updatedAt: inmueble.updatedAt || inmueble.createdAt || null,
    };
};

const mapParticularToPortalPublication = (publication = {}) => {
    return {
        ...publication,
        sourceType: "particular",
        sourceTypeLabel: "Particular",
        sourceLabel: publication.ownerDisplayName || "Dueño particular",
        titulo:
            publication.titulo ||
            publication.ubicacion ||
            "Publicación particular",
        precio: publication.precio || publication.precioEstimado || "",
        estado: publication.publicStatus || "",
        createdAt:
            publication.approvedAt ||
            publication.createdAt ||
            publication.updatedAt ||
            null,
        updatedAt:
            publication.updatedAt ||
            publication.approvedAt ||
            publication.createdAt ||
            null,
    };
};

const fetchInmueblesFromInmobiliarias = async () => {
    const inmobiliariasSnapshot = await getDocs(collection(db, "inmobiliarias"));

    const inmobiliarias = inmobiliariasSnapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
    }));

    const entries = await Promise.all(
        inmobiliarias.map(async (inmobiliaria) => {
            const inmueblesSnapshot = await getDocs(
                collection(db, "inmobiliarias", inmobiliaria.id, "inmuebles"),
            );

            return inmueblesSnapshot.docs.map((item) =>
                mapInmuebleToPortalPublication(
                    {
                        id: item.id,
                        ...item.data(),
                    },
                    inmobiliaria,
                ),
            );
        }),
    );

    return entries.flat();
};

const fetchParticularPublications = async () => {
    const snapshot = await getDocs(collection(db, "particular_publications"));

    return snapshot.docs.map((item) =>
        mapParticularToPortalPublication({
            id: item.id,
            ...item.data(),
        }),
    );
};

const matchesFilters = (publication = {}, filters = {}) => {
    const search = normalizeText(filters.search);

    if (search) {
        const searchableText = normalizeText(
            [
                publication.titulo,
                publication.descripcion,
                publication.ubicacion,
                publication.tipo,
                publication.operacion,
                publication.sourceLabel,
                publication.inmobiliariaSlug,
                publication.id,
            ]
                .filter(Boolean)
                .join(" "),
        );

        if (!searchableText.includes(search)) {
            return false;
        }
    }

    if (filters.sourceType && publication.sourceType !== filters.sourceType) {
        return false;
    }

    if (filters.estado && getStatusLabel(publication) !== filters.estado) {
        return false;
    }

    if (filters.operacion && publication.operacion !== filters.operacion) {
        return false;
    }

    if (filters.tipo && publication.tipo !== filters.tipo) {
        return false;
    }

    if (filters.portalStatus === "publicada" && !isPortalPublished(publication)) {
        return false;
    }

    if (filters.portalStatus === "no_publicada" && isPortalPublished(publication)) {
        return false;
    }

    return true;
};

const getUniqueOptions = (items, getter) => {
    const values = items
        .map(getter)
        .filter(Boolean)
        .map((value) => value.toString().trim())
        .filter(Boolean);

    return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
};

const PortalPublicationsPage = () => {
    const [publications, setPublications] = useState([]);
    const [rankingConfig, setRankingConfig] = useState(
        DEFAULT_PORTAL_RANKING_CONFIG,
    );
    const [filters, setFilters] = useState(INITIAL_FILTERS);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const filteredPublications = useMemo(() => {
        return publications
            .filter((publication) => matchesFilters(publication, filters))
            .sort((a, b) => {
                const rankingDiff =
                    getRankingTotal(b, rankingConfig) - getRankingTotal(a, rankingConfig);

                if (rankingDiff !== 0) return rankingDiff;

                return getDateValue(b.updatedAt) - getDateValue(a.updatedAt);
            });
    }, [filters, publications, rankingConfig]);

    const statusOptions = useMemo(() => {
        return getUniqueOptions(publications, getStatusLabel);
    }, [publications]);

    const counters = useMemo(() => {
        const inmobiliarias = publications.filter(
            (publication) => publication.sourceType === "inmobiliaria",
        );

        const particulares = publications.filter(
            (publication) => publication.sourceType === "particular",
        );

        const publicadas = publications.filter(isPortalPublished);

        const destacadas = publications.filter(
            (publication) => publication.destacado === true,
        );

        return {
            total: publications.length,
            inmobiliarias: inmobiliarias.length,
            particulares: particulares.length,
            publicadas: publicadas.length,
            noPublicadas: publications.length - publicadas.length,
            destacadas: destacadas.length,
        };
    }, [publications]);

    const loadPublications = async () => {
        try {
            setLoading(true);
            setError("");

            const [inmuebleItems, particularItems, rankingConfigResult] =
                await Promise.all([
                    fetchInmueblesFromInmobiliarias(),
                    fetchParticularPublications(),
                    getPortalRankingConfig(),
                ]);

            setRankingConfig(rankingConfigResult || DEFAULT_PORTAL_RANKING_CONFIG);
            setPublications([...inmuebleItems, ...particularItems]);
        } catch (err) {
            console.error("Error cargando publicaciones del portal:", err);
            setError(
                err.message ||
                "No se pudieron cargar las publicaciones del portal.",
            );
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadPublications();
    }, []);

    const handleFilterChange = (e) => {
        const { name, value } = e.target;

        setFilters((current) => ({
            ...current,
            [name]: value,
        }));
    };

    const handleClearFilters = () => {
        setFilters(INITIAL_FILTERS);
    };

    return (
        <main className="container py-4">
            <SEO
                title="Publicaciones del portal | ONO Prop"
                description="Panel root para revisar publicaciones de inmobiliarias y particulares."
                noIndex
            />

            <div className="d-flex flex-column flex-lg-row justify-content-between gap-3 mb-4">
                <div>
                    <p className="text-uppercase text-muted small mb-1">
                        Root ONO Prop
                    </p>

                    <h1 className="mb-2">Publicaciones del portal</h1>

                    <p className="text-muted mb-0">
                        Vista global de publicaciones cargadas por inmobiliarias y
                        particulares.
                    </p>
                </div>

                <div className="d-flex flex-wrap gap-2 align-items-start">
                    <button
                        type="button"
                        className="btn btn-outline-secondary"
                        disabled={loading}
                        onClick={loadPublications}
                    >
                        Actualizar
                    </button>

                    <Link to="/admin/dashboard" className="btn btn-outline-secondary">
                        Volver al dashboard
                    </Link>

                    <Link to="/inmuebles" className="btn btn-primary">
                        Ver portal público
                    </Link>
                </div>
            </div>

            {error && <div className="alert alert-warning">{error}</div>}

            <section className="row g-3 mb-4">
                <div className="col-6 col-md-4 col-xl-2">
                    <div className="card border-0 shadow-sm text-bg-primary">
                        <div className="card-body text-center">
                            <div className="h4 mb-0">{counters.total}</div>
                            <div className="small">Total</div>
                        </div>
                    </div>
                </div>

                <div className="col-6 col-md-4 col-xl-2">
                    <div className="card border-0 shadow-sm text-bg-info">
                        <div className="card-body text-center">
                            <div className="h4 mb-0">{counters.inmobiliarias}</div>
                            <div className="small">Inmobiliarias</div>
                        </div>
                    </div>
                </div>

                <div className="col-6 col-md-4 col-xl-2">
                    <div className="card border-0 shadow-sm text-bg-dark">
                        <div className="card-body text-center">
                            <div className="h4 mb-0">{counters.particulares}</div>
                            <div className="small">Particulares</div>
                        </div>
                    </div>
                </div>

                <div className="col-6 col-md-4 col-xl-2">
                    <div className="card border-0 shadow-sm text-bg-success">
                        <div className="card-body text-center">
                            <div className="h4 mb-0">{counters.publicadas}</div>
                            <div className="small">Publicadas</div>
                        </div>
                    </div>
                </div>

                <div className="col-6 col-md-4 col-xl-2">
                    <div className="card border-0 shadow-sm text-bg-secondary">
                        <div className="card-body text-center">
                            <div className="h4 mb-0">{counters.noPublicadas}</div>
                            <div className="small">No publicadas</div>
                        </div>
                    </div>
                </div>

                <div className="col-6 col-md-4 col-xl-2">
                    <div className="card border-0 shadow-sm text-bg-warning">
                        <div className="card-body text-center">
                            <div className="h4 mb-0">{counters.destacadas}</div>
                            <div className="small">Destacadas</div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="card border-0 shadow-sm mb-4">
                <div className="card-body">
                    <div className="row g-3">
                        <div className="col-12 col-lg-4">
                            <label className="form-label">Buscar</label>
                            <input
                                type="search"
                                name="search"
                                className="form-control"
                                placeholder="Título, ubicación, inmobiliaria, ID..."
                                value={filters.search}
                                onChange={handleFilterChange}
                            />
                        </div>

                        <div className="col-6 col-lg-2">
                            <label className="form-label">Origen</label>
                            <select
                                name="sourceType"
                                className="form-select"
                                value={filters.sourceType}
                                onChange={handleFilterChange}
                            >
                                <option value="">Todos</option>
                                {SOURCE_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="col-6 col-lg-2">
                            <label className="form-label">Estado portal</label>
                            <select
                                name="portalStatus"
                                className="form-select"
                                value={filters.portalStatus}
                                onChange={handleFilterChange}
                            >
                                <option value="">Todos</option>
                                {PORTAL_STATUS_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="col-6 col-lg-2">
                            <label className="form-label">Estado interno</label>
                            <select
                                name="estado"
                                className="form-select"
                                value={filters.estado}
                                onChange={handleFilterChange}
                            >
                                <option value="">Todos</option>
                                {statusOptions.map((status) => (
                                    <option key={status} value={status}>
                                        {status}
                                    </option>
                                ))}
                            </select>
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
                                {OPERACIONES.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
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
                                {TIPOS.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="col-6 col-lg-2 d-grid">
                            <label className="form-label d-none d-lg-block">&nbsp;</label>
                            <button
                                type="button"
                                className="btn btn-outline-secondary"
                                onClick={handleClearFilters}
                            >
                                Limpiar
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            {loading && (
                <div className="alert alert-light border">
                    Cargando publicaciones...
                </div>
            )}

            {!loading && filteredPublications.length === 0 && (
                <div className="alert alert-info">
                    No hay publicaciones para los filtros seleccionados.
                </div>
            )}

            {!loading && filteredPublications.length > 0 && (
                <section className="card border-0 shadow-sm">
                    <div className="table-responsive">
                        <table className="table table-hover align-middle mb-0">
                            <thead className="table-light">
                                <tr>
                                    <th>Publicación</th>
                                    <th>Origen</th>
                                    <th>Operación</th>
                                    <th>Tipo</th>
                                    <th>Precio</th>
                                    <th>Media</th>
                                    <th>Estado</th>
                                    <th>Ranking</th>
                                    <th>Actualizada</th>
                                    <th className="text-end">Acciones</th>
                                </tr>
                            </thead>

                            <tbody>
                                {filteredPublications.map((publication) => {
                                    const editPath = buildAdminEditPath(publication);
                                    const publicPath = buildInmueblePublicPath(publication);
                                    const rankingScore = getRankingTotal(publication, rankingConfig);

                                    return (
                                        <tr key={`${publication.sourceType}-${publication.id}`}>
                                            <td style={{ minWidth: 260 }}>
                                                <div className="fw-semibold">
                                                    {publication.titulo || "Sin título"}
                                                </div>

                                                <div className="small text-muted">
                                                    {publication.ubicacion || "Sin ubicación"}
                                                </div>

                                                <div className="small text-muted">
                                                    ID: {publication.id}
                                                </div>
                                            </td>

                                            <td>
                                                <span
                                                    className={
                                                        publication.sourceType === "particular"
                                                            ? "badge text-bg-dark"
                                                            : "badge text-bg-primary"
                                                    }
                                                >
                                                    {publication.sourceTypeLabel}
                                                </span>

                                                <div className="small text-muted mt-1">
                                                    {publication.sourceLabel}
                                                </div>
                                                {publication.managedByLabel && (
                                                    <div className="small text-muted">
                                                        Gestionado por {publication.managedByLabel}
                                                    </div>
                                                )}
                                            </td>

                                            <td>
                                                {publication.operacion
                                                    ? getOptionLabel(OPERACIONES, publication.operacion)
                                                    : "-"}
                                            </td>

                                            <td>
                                                {publication.tipo
                                                    ? getOptionLabel(TIPOS, publication.tipo)
                                                    : "-"}
                                            </td>

                                            <td>{formatPrice(publication)}</td>

                                            <td>
                                                <span className="badge text-bg-light border me-1">
                                                    🖼 {getImageCount(publication)}
                                                </span>

                                                <span className="badge text-bg-light border">
                                                    🎥 {getVideoCount(publication)}
                                                </span>
                                            </td>

                                            <td>
                                                <div className="d-flex flex-column gap-1">
                                                    <span className={getPortalBadgeClass(publication)}>
                                                        {getPortalBadgeLabel(publication)}
                                                    </span>

                                                    <span className="small text-muted">
                                                        {getStatusLabel(publication)}
                                                    </span>
                                                </div>
                                            </td>

                                            <td>
                                                <span className="badge text-bg-primary">
                                                    {rankingScore.toLocaleString("es-AR")}
                                                </span>
                                            </td>

                                            <td>{formatDate(publication.updatedAt)}</td>

                                            <td className="text-end">
                                                <div className="btn-group btn-group-sm">
                                                    <Link
                                                        to={publicPath}
                                                        className="btn btn-outline-primary"
                                                    >
                                                        Ver
                                                    </Link>

                                                    {editPath && (
                                                        <Link
                                                            to={editPath}
                                                            className="btn btn-outline-secondary"
                                                        >
                                                            Editar
                                                        </Link>
                                                    )}

                                                    {publication.sourceType === "particular" && (
                                                        <Link
                                                            to="/admin/publicaciones/particulares"
                                                            className="btn btn-outline-secondary"
                                                        >
                                                            Panel
                                                        </Link>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}
        </main>
    );
};

export default PortalPublicationsPage;