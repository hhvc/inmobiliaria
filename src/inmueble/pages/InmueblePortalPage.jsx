import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import SEO from "../../components/SEO";
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
    sortBy: "destacados",
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

const SORT_OPTIONS = [
    { value: "destacados", label: "Destacados primero" },
    { value: "recientes", label: "Más recientes" },
    { value: "precio_asc", label: "Precio menor a mayor" },
    { value: "precio_desc", label: "Precio mayor a menor" },
    { value: "dormitorios_desc", label: "Más dormitorios" },
    { value: "superficie_desc", label: "Mayor superficie" },
];

const DEFAULT_SEO_IMAGE = "/assets/img/Logo.png";

const normalizeText = (value = "") => {
    return value
        .toString()
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
};

const normalizeSeoText = (value = "") => {
    return value
        .toString()
        .replace(/\s+/g, " ")
        .trim();
};

const truncateText = (value = "", maxLength = 165) => {
    const cleanValue = normalizeSeoText(value);

    if (cleanValue.length <= maxLength) return cleanValue;

    return `${cleanValue.slice(0, maxLength - 1).trim()}…`;
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

const getOptionLabel = (options, value) => {
    return options.find((option) => option.value === value)?.label || value;
};

const getActiveFilterBadges = (filters) => {
    const badges = [];

    if (filters.search) {
        badges.push({
            key: "search",
            label: `Búsqueda: ${filters.search}`,
        });
    }

    if (filters.operacion) {
        badges.push({
            key: "operacion",
            label: `Operación: ${getOptionLabel(OPERACIONES, filters.operacion)}`,
        });
    }

    if (filters.tipo) {
        badges.push({
            key: "tipo",
            label: `Tipo: ${getOptionLabel(TIPOS, filters.tipo)}`,
        });
    }

    if (filters.ciudad) {
        badges.push({
            key: "ciudad",
            label: `Ciudad: ${filters.ciudad}`,
        });
    }

    if (filters.barrio) {
        badges.push({
            key: "barrio",
            label: `Barrio: ${filters.barrio}`,
        });
    }

    if (filters.dormitoriosMin) {
        badges.push({
            key: "dormitoriosMin",
            label: `Dormitorios: ${filters.dormitoriosMin}+`,
        });
    }

    if (filters.precioMin) {
        badges.push({
            key: "precioMin",
            label: `Precio mín.: ${filters.precioMin}`,
        });
    }

    if (filters.precioMax) {
        badges.push({
            key: "precioMax",
            label: `Precio máx.: ${filters.precioMax}`,
        });
    }

    if (filters.sortBy && filters.sortBy !== INITIAL_FILTERS.sortBy) {
        badges.push({
            key: "sortBy",
            label: `Orden: ${getOptionLabel(SORT_OPTIONS, filters.sortBy)}`,
        });
    }

    return badges;
};

const getFiltersFromSearchParams = (searchParams) => {
    return {
        ...INITIAL_FILTERS,
        search: searchParams.get("search") || "",
        operacion: searchParams.get("operacion") || "",
        tipo: searchParams.get("tipo") || "",
        ciudad: searchParams.get("ciudad") || "",
        barrio: searchParams.get("barrio") || "",
        dormitoriosMin: searchParams.get("dormitoriosMin") || "",
        precioMin: searchParams.get("precioMin") || "",
        precioMax: searchParams.get("precioMax") || "",
        sortBy: searchParams.get("sortBy") || INITIAL_FILTERS.sortBy,
    };
};

const getSearchParamsFromFilters = (filters) => {
    const params = new URLSearchParams();

    Object.entries(filters).forEach(([key, value]) => {
        if (!value) return;

        if (key === "sortBy" && value === INITIAL_FILTERS.sortBy) {
            return;
        }

        params.set(key, value);
    });

    return params;
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

const getDateValue = (value) => {
    if (!value) return 0;

    if (typeof value.toDate === "function") {
        return value.toDate().getTime();
    }

    const date = new Date(value);

    return Number.isFinite(date.getTime()) ? date.getTime() : 0;
};

const sortInmuebles = (items, sortBy) => {
    const sortedItems = [...items];

    sortedItems.sort((a, b) => {
        if (sortBy === "recientes") {
            return getDateValue(b.createdAt) - getDateValue(a.createdAt);
        }

        if (sortBy === "precio_asc") {
            const priceA = toNumber(a.precio);
            const priceB = toNumber(b.precio);

            if (priceA === null && priceB === null) return 0;
            if (priceA === null) return 1;
            if (priceB === null) return -1;

            return priceA - priceB;
        }

        if (sortBy === "precio_desc") {
            const priceA = toNumber(a.precio);
            const priceB = toNumber(b.precio);

            if (priceA === null && priceB === null) return 0;
            if (priceA === null) return 1;
            if (priceB === null) return -1;

            return priceB - priceA;
        }

        if (sortBy === "dormitorios_desc") {
            return (toNumber(b.dormitorios) || 0) - (toNumber(a.dormitorios) || 0);
        }

        if (sortBy === "superficie_desc") {
            return (
                (toNumber(b.superficie?.total) || 0) -
                (toNumber(a.superficie?.total) || 0)
            );
        }

        return Number(Boolean(b.destacado)) - Number(Boolean(a.destacado));
    });

    return sortedItems;
};

const buildPortalUrl = (searchParamsString = "") => {
    const path = "/inmuebles";
    const suffix = searchParamsString ? `?${searchParamsString}` : "";

    if (typeof window === "undefined") {
        return `${path}${suffix}`;
    }

    return `${window.location.origin}${path}${suffix}`;
};

const buildSeoTitle = (filters) => {
    const parts = [];

    if (filters.tipo) {
        parts.push(getOptionLabel(TIPOS, filters.tipo));
    }

    if (filters.operacion) {
        parts.push(`en ${getOptionLabel(OPERACIONES, filters.operacion)}`);
    }

    if (filters.barrio) {
        parts.push(`en ${filters.barrio}`);
    } else if (filters.ciudad) {
        parts.push(`en ${filters.ciudad}`);
    }

    if (filters.search) {
        parts.push(`| ${filters.search}`);
    }

    if (parts.length === 0) {
        return "Inmuebles publicados | LaDoctaProp";
    }

    return `${parts.join(" ")} | LaDoctaProp`;
};

const buildSeoDescription = ({ filters, resultCount }) => {
    const parts = [];

    if (resultCount > 0) {
        parts.push(
            `${resultCount} ${resultCount === 1 ? "inmueble publicado" : "inmuebles publicados"
            }`,
        );
    } else {
        parts.push("Buscador de inmuebles publicados");
    }

    if (filters.operacion) {
        parts.push(`operación ${getOptionLabel(OPERACIONES, filters.operacion)}`);
    }

    if (filters.tipo) {
        parts.push(`tipo ${getOptionLabel(TIPOS, filters.tipo)}`);
    }

    if (filters.ciudad) {
        parts.push(`en ${filters.ciudad}`);
    }

    if (filters.barrio) {
        parts.push(`barrio ${filters.barrio}`);
    }

    if (filters.dormitoriosMin) {
        parts.push(`desde ${filters.dormitoriosMin} dormitorios`);
    }

    if (filters.precioMin || filters.precioMax) {
        const priceText = [
            filters.precioMin ? `precio mínimo ${filters.precioMin}` : "",
            filters.precioMax ? `precio máximo ${filters.precioMax}` : "",
        ]
            .filter(Boolean)
            .join(" y ");

        parts.push(priceText);
    }

    const baseDescription =
        parts.length > 1
            ? parts.join(", ")
            : "Filtrá propiedades por operación, tipo, ciudad, barrio, dormitorios y precio.";

    return truncateText(
        `${baseDescription}. Consultá propiedades publicadas en LaDoctaProp y compartí búsquedas inmobiliarias.`,
    );
};

const buildItemListJsonLd = ({ filteredInmuebles, seoUrl }) => {
    return {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: "Inmuebles publicados en LaDoctaProp",
        description:
            "Buscador público de inmuebles publicados en LaDoctaProp.",
        url: seoUrl,
        mainEntity: {
            "@type": "ItemList",
            itemListElement: filteredInmuebles.slice(0, 20).map((inmueble, index) => {
                const detalleUrl = buildPortalItemUrl(inmueble);
                const coverImage = getCoverImage(inmueble);

                return {
                    "@type": "ListItem",
                    position: index + 1,
                    url: detalleUrl,
                    item: {
                        "@type": "Offer",
                        name: inmueble.titulo || "Inmueble publicado",
                        url: detalleUrl,
                        image: coverImage?.url || undefined,
                        price: toNumber(inmueble.precio) || undefined,
                        priceCurrency: inmueble.moneda || "USD",
                        itemOffered: {
                            "@type": "Place",
                            name: inmueble.titulo || "Inmueble publicado",
                            address: buildAddress(inmueble) || undefined,
                        },
                    },
                };
            }),
        },
    };
};

const buildPortalItemUrl = (inmueble) => {
    const slugOrId = inmueble?.slug || inmueble?.id;

    if (!slugOrId) return "";

    if (typeof window === "undefined") {
        return `/inmueble/${slugOrId}`;
    }

    return `${window.location.origin}/inmueble/${slugOrId}`;
};

const InmueblePortalPage = () => {
    const [searchParams, setSearchParams] = useSearchParams();

    const [inmuebles, setInmuebles] = useState([]);
    const [filters, setFilters] = useState(() =>
        getFiltersFromSearchParams(searchParams),
    );
    const [copySuccess, setCopySuccess] = useState(false);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const searchParamsString = searchParams.toString();

    useEffect(() => {
        setFilters(getFiltersFromSearchParams(searchParams));
    }, [searchParams]);

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
        const filteredItems = inmuebles.filter((inmueble) =>
            matchesFilters(inmueble, filters),
        );

        return sortInmuebles(filteredItems, filters.sortBy);
    }, [filters, inmuebles]);

    const activeFiltersCount = useMemo(() => {
        return Object.entries(filters).filter(([key, value]) => {
            if (!value) return false;

            if (key === "sortBy" && value === INITIAL_FILTERS.sortBy) {
                return false;
            }

            return true;
        }).length;
    }, [filters]);

    const activeFilterBadges = useMemo(() => {
        return getActiveFilterBadges(filters);
    }, [filters]);

    const destacadosCount = useMemo(() => {
        return inmuebles.filter((inmueble) => inmueble.destacado).length;
    }, [inmuebles]);

    const seoUrl = useMemo(() => {
        return buildPortalUrl(searchParamsString);
    }, [searchParamsString]);

    const seoTitle = useMemo(() => {
        return buildSeoTitle(filters);
    }, [filters]);

    const seoDescription = useMemo(() => {
        return buildSeoDescription({
            filters,
            resultCount: filteredInmuebles.length,
        });
    }, [filteredInmuebles.length, filters]);

    const seoImage = useMemo(() => {
        const firstCover = filteredInmuebles
            .map((inmueble) => getCoverImage(inmueble))
            .find((image) => image?.url);

        return firstCover?.url || DEFAULT_SEO_IMAGE;
    }, [filteredInmuebles]);

    const portalJsonLd = useMemo(() => {
        return buildItemListJsonLd({
            filteredInmuebles,
            seoUrl,
        });
    }, [filteredInmuebles, seoUrl]);

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

    const updateFilters = (nextFilters, options = {}) => {
        setFilters(nextFilters);
        setSearchParams(getSearchParamsFromFilters(nextFilters), {
            replace: options.replace ?? true,
        });
        setCopySuccess(false);
    };

    const handleFilterChange = (e) => {
        const { name, value } = e.target;

        const nextFilters = {
            ...filters,
            [name]: value,
        };

        if (name === "ciudad") {
            nextFilters.barrio = "";
        }

        updateFilters(nextFilters);
    };

    const handleClearFilters = () => {
        updateFilters(INITIAL_FILTERS);
    };

    const handleRemoveFilter = (key) => {
        const nextFilters = {
            ...filters,
            [key]: INITIAL_FILTERS[key] ?? "",
        };

        if (key === "ciudad") {
            nextFilters.barrio = "";
        }

        updateFilters(nextFilters);
    };

    const handleCopySearch = async () => {
        try {
            const currentUrl =
                typeof window !== "undefined" ? window.location.href : "";

            if (!currentUrl) {
                throw new Error("No se pudo obtener la URL actual");
            }

            await navigator.clipboard.writeText(currentUrl);

            setCopySuccess(true);

            window.setTimeout(() => {
                setCopySuccess(false);
            }, 2500);
        } catch (err) {
            console.error("Error copiando búsqueda:", err);
            setCopySuccess(false);
            alert("No se pudo copiar el link de búsqueda.");
        }
    };

    const handleShareSearchByWhatsapp = () => {
        try {
            const currentUrl =
                typeof window !== "undefined" ? window.location.href : "";

            if (!currentUrl) {
                throw new Error("No se pudo obtener la URL actual");
            }

            const message = [
                "Te comparto esta búsqueda de inmuebles en LaDocTaProp:",
                currentUrl,
            ].join("\n");

            const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;

            window.open(whatsappUrl, "_blank", "noopener,noreferrer");
        } catch (err) {
            console.error("Error compartiendo búsqueda por WhatsApp:", err);
            alert("No se pudo abrir WhatsApp para compartir la búsqueda.");
        }
    };

    const saveCurrentSearchUrl = () => {
        if (typeof window === "undefined") return;

        window.sessionStorage.setItem("lastInmuebleSearchUrl", window.location.href);
    };

    return (
        <main className="portal-home">
            <SEO
                title={seoTitle}
                description={seoDescription}
                image={seoImage}
                url={seoUrl}
                type="website"
                siteName="LaDoctaProp"
                jsonLd={portalJsonLd}
            />

            <section className="py-5">
                <div className="container">
                    <div className="row align-items-end g-4 mb-4">
                        <div className="col-lg-8">
                            <div className="portal-eyebrow">Buscador inmobiliario</div>

                            <h1 className="portal-section-title mb-3">
                                Inmuebles publicados
                            </h1>

                            <p className="lead text-muted mb-0">
                                Filtrá propiedades por operación, tipo, ciudad, barrio,
                                dormitorios y precio. Compartí búsquedas o entrá a la ficha para
                                consultar directo.
                            </p>
                        </div>

                        <div className="col-lg-4">
                            <div className="row g-2">
                                <div className="col-6">
                                    <div className="portal-stat">
                                        <div className="portal-stat-number">{inmuebles.length}</div>
                                        <div className="small text-muted">Publicadas</div>
                                    </div>
                                </div>

                                <div className="col-6">
                                    <div className="portal-stat">
                                        <div className="portal-stat-number">{destacadosCount}</div>
                                        <div className="small text-muted">Destacadas</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <section className="portal-search-card card mb-4">
                        <div className="card-body p-3 p-lg-4">
                            <div className="row g-3">
                                <div className="col-12 col-xl-4">
                                    <label className="form-label">Buscar</label>
                                    <input
                                        type="search"
                                        name="search"
                                        className="form-control form-control-lg"
                                        placeholder="Ej: Nueva Córdoba, casa, pileta..."
                                        value={filters.search}
                                        onChange={handleFilterChange}
                                    />
                                </div>

                                <div className="col-6 col-lg-3 col-xl-2">
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

                                <div className="col-6 col-lg-3 col-xl-2">
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

                                <div className="col-6 col-lg-3 col-xl-2">
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

                                <div className="col-6 col-lg-3 col-xl-2">
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

                                <div className="col-6 col-lg-3 col-xl-2">
                                    <label className="form-label">Dormitorios</label>
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

                                <div className="col-6 col-lg-3 col-xl-2">
                                    <label className="form-label">Precio mín.</label>
                                    <input
                                        type="number"
                                        name="precioMin"
                                        className="form-control"
                                        min="0"
                                        placeholder="50000"
                                        value={filters.precioMin}
                                        onChange={handleFilterChange}
                                    />
                                </div>

                                <div className="col-6 col-lg-3 col-xl-2">
                                    <label className="form-label">Precio máx.</label>
                                    <input
                                        type="number"
                                        name="precioMax"
                                        className="form-control"
                                        min="0"
                                        placeholder="150000"
                                        value={filters.precioMax}
                                        onChange={handleFilterChange}
                                    />
                                </div>

                                <div className="col-12 col-lg-3 col-xl-3">
                                    <label className="form-label">Ordenar por</label>
                                    <select
                                        name="sortBy"
                                        className="form-select"
                                        value={filters.sortBy}
                                        onChange={handleFilterChange}
                                    >
                                        {SORT_OPTIONS.map((option) => (
                                            <option key={option.value} value={option.value}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="col-12 col-lg-3 col-xl-3 d-grid">
                                    <label className="form-label d-none d-lg-block">&nbsp;</label>
                                    <button
                                        type="button"
                                        className="btn btn-outline-secondary"
                                        onClick={handleClearFilters}
                                        disabled={activeFiltersCount === 0}
                                    >
                                        Limpiar filtros
                                    </button>
                                </div>
                            </div>
                        </div>
                    </section>

                    <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
                        <div>
                            <div className="fw-semibold">
                                {filteredInmuebles.length} resultado
                                {filteredInmuebles.length === 1 ? "" : "s"}
                            </div>

                            {activeFilterBadges.length > 0 && (
                                <div className="d-flex flex-wrap gap-2 mt-2">
                                    {activeFilterBadges.map((badge) => (
                                        <button
                                            key={badge.key}
                                            type="button"
                                            className="btn btn-sm btn-light border rounded-pill"
                                            onClick={() => handleRemoveFilter(badge.key)}
                                            title="Quitar filtro"
                                        >
                                            {badge.label} ×
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="d-flex flex-wrap gap-2">
                            <button
                                type="button"
                                className="btn btn-outline-primary btn-sm"
                                onClick={handleCopySearch}
                            >
                                {copySuccess ? "Búsqueda copiada" : "Copiar búsqueda"}
                            </button>

                            <button
                                type="button"
                                className="btn btn-success btn-sm"
                                onClick={handleShareSearchByWhatsapp}
                            >
                                Compartir por WhatsApp
                            </button>
                        </div>
                    </div>

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
                                    <article
                                        className="col-12 col-md-6 col-xl-4"
                                        key={inmueble.id}
                                    >
                                        <div className="card h-100 shadow-sm border-0 overflow-hidden">
                                            <div className="position-relative">
                                                {coverImage ? (
                                                    <img
                                                        src={coverImage.url}
                                                        alt={inmueble.titulo}
                                                        className="card-img-top"
                                                        style={{
                                                            height: 250,
                                                            objectFit: "cover",
                                                        }}
                                                        loading="lazy"
                                                    />
                                                ) : (
                                                    <div
                                                        className="bg-light d-flex align-items-center justify-content-center text-muted"
                                                        style={{ height: 250 }}
                                                    >
                                                        Sin imagen
                                                    </div>
                                                )}

                                                <div className="position-absolute top-0 start-0 p-3 d-flex flex-wrap gap-2">
                                                    {inmueble.operacion && (
                                                        <span className="badge text-bg-primary">
                                                            {inmueble.operacion}
                                                        </span>
                                                    )}

                                                    {inmueble.tipo && (
                                                        <span className="badge text-bg-dark">
                                                            {inmueble.tipo}
                                                        </span>
                                                    )}
                                                </div>

                                                {inmueble.destacado && (
                                                    <div className="position-absolute top-0 end-0 p-3">
                                                        <span className="badge text-bg-warning">
                                                            Destacado
                                                        </span>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="card-body d-flex flex-column p-4">
                                                <h2 className="h5 mb-2">{inmueble.titulo}</h2>

                                                {address && (
                                                    <p className="text-muted small mb-2">{address}</p>
                                                )}

                                                <div className="h4 mb-3">{formatPrice(inmueble)}</div>

                                                <div className="row g-2 small text-muted mb-3">
                                                    {inmueble.dormitorios && (
                                                        <div className="col-6">
                                                            {inmueble.dormitorios} dorm.
                                                        </div>
                                                    )}

                                                    {inmueble.banos && (
                                                        <div className="col-6">{inmueble.banos} baños</div>
                                                    )}

                                                    {inmueble.superficie?.total && (
                                                        <div className="col-6">
                                                            {formatNumber(inmueble.superficie.total)} m²
                                                        </div>
                                                    )}

                                                    {inmueble.cocheras && (
                                                        <div className="col-6">
                                                            {inmueble.cocheras} coch.
                                                        </div>
                                                    )}
                                                </div>

                                                {inmueble.descripcion && (
                                                    <p className="text-muted small">
                                                        {inmueble.descripcion.length > 120
                                                            ? `${inmueble.descripcion.slice(0, 120)}...`
                                                            : inmueble.descripcion}
                                                    </p>
                                                )}

                                                <div className="mt-auto d-grid">
                                                    <Link
                                                        to={detalleUrl}
                                                        className="btn btn-primary"
                                                        onClick={saveCurrentSearchUrl}
                                                    >
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
                </div>
            </section>
        </main>
    );
};

export default InmueblePortalPage;