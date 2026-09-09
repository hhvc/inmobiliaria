import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import SEO from "../components/SEO";
import HomeFeaturedProperties from "../inmueble/components/HomeFeaturedProperties";
import {
    PORTAL_INITIAL_FILTERS,
    getPortalSearchParamsFromFilters,
    hasAdvancedPortalFilters,
} from "../inmueble/utils/portalSearch.helpers";

const OPERATIONS = [
    { value: "venta", label: "Comprar" },
    { value: "alquiler", label: "Alquilar" },
    { value: "alquiler_temporal", label: "Alquiler temporal" },
];

const PROPERTY_TYPES = [
    { value: "casa", label: "Casas", icon: "🏠" },
    { value: "departamento", label: "Departamentos", icon: "🏢" },
    { value: "terreno", label: "Terrenos", icon: "📐" },
    { value: "local", label: "Locales", icon: "🏪" },
    { value: "oficina", label: "Oficinas", icon: "💼" },
    { value: "campo", label: "Campos", icon: "🌾" },
];

const PortalSearchHomePage = () => {
    const navigate = useNavigate();
    const [filters, setFilters] = useState({ ...PORTAL_INITIAL_FILTERS });
    const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

    const siteUrl = import.meta.env.VITE_PUBLIC_SITE_URL || "https://onoprop.com";

    const handleChange = (event) => {
        const { name, value, type, checked } = event.target;

        setFilters((current) => ({
            ...current,
            [name]: type === "checkbox" ? (checked ? "true" : "") : value,
        }));
    };

    const handleSubmit = (event) => {
        event.preventDefault();

        const params = getPortalSearchParamsFromFilters(filters);
        const query = params.toString();

        navigate(query ? `/inmuebles?${query}` : "/inmuebles");
    };

    const websiteJsonLd = {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: "ONO Prop",
        url: siteUrl,
        potentialAction: {
            "@type": "SearchAction",
            target: `${siteUrl}/inmuebles?search={search_term_string}`,
            "query-input": "required name=search_term_string",
        },
    };

    return (
        <main id="page-top" className="portal-home portal-search-home">
            <SEO
                title="ONO Prop | Buscá y publicá inmuebles"
                description="Buscá casas, departamentos, terrenos, locales y oficinas publicados por inmobiliarias y particulares en ONO Prop."
                url={siteUrl}
                type="website"
                siteName="ONO Prop"
                jsonLd={websiteJsonLd}
            />

            <section className="portal-search-hero">
                <div className="container">
                    <div className="text-center mx-auto portal-search-heading">
                        <div className="portal-eyebrow">Portal inmobiliario</div>
                        <h1 className="portal-hero-title mb-3">
                            Encontrá el inmueble que estás buscando
                        </h1>
                        <p className="portal-hero-text mb-4">
                            Publicaciones de inmobiliarias y particulares, con contacto directo
                            y filtros simples para llegar más rápido a la propiedad indicada!
                        </p>
                    </div>

                    <form
                        className="portal-search-card card border-0 shadow-lg mx-auto"
                        onSubmit={handleSubmit}
                        role="search"
                    >
                        <div className="card-body p-3 p-lg-4">
                            <div className="row g-3 align-items-end">
                                <div className="col-12 col-xl-4">
                                    <label className="form-label" htmlFor="home-search">
                                        Ubicación o palabra clave
                                    </label>
                                    <input
                                        id="home-search"
                                        type="search"
                                        name="search"
                                        className="form-control form-control-lg"
                                        placeholder="Ej: Nueva Córdoba, casa con pileta..."
                                        value={filters.search}
                                        onChange={handleChange}
                                    />
                                </div>

                                <div className="col-6 col-xl-2">
                                    <label className="form-label" htmlFor="home-operation">
                                        Operación
                                    </label>
                                    <select
                                        id="home-operation"
                                        name="operacion"
                                        className="form-select form-select-lg"
                                        value={filters.operacion}
                                        onChange={handleChange}
                                    >
                                        <option value="">Todas</option>
                                        {OPERATIONS.map((operation) => (
                                            <option key={operation.value} value={operation.value}>
                                                {operation.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="col-6 col-xl-2">
                                    <label className="form-label" htmlFor="home-type">
                                        Tipo
                                    </label>
                                    <select
                                        id="home-type"
                                        name="tipo"
                                        className="form-select form-select-lg"
                                        value={filters.tipo}
                                        onChange={handleChange}
                                    >
                                        <option value="">Todos</option>
                                        {PROPERTY_TYPES.map((type) => (
                                            <option key={type.value} value={type.value}>
                                                {type.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="col-6 col-xl-2 d-grid">
                                    <button type="submit" className="btn btn-primary btn-lg">
                                        Buscar
                                    </button>
                                </div>

                                <div className="col-6 col-xl-2 d-grid">
                                    <button
                                        type="button"
                                        className="btn btn-outline-secondary btn-lg"
                                        onClick={() => setShowAdvancedFilters((current) => !current)}
                                        aria-expanded={showAdvancedFilters}
                                        aria-controls="home-advanced-filters"
                                    >
                                        {showAdvancedFilters ? "Menos filtros" : "Más filtros"}
                                        {!showAdvancedFilters && hasAdvancedPortalFilters(filters)
                                            ? " •"
                                            : ""}
                                    </button>
                                </div>

                                {showAdvancedFilters && (
                                    <div className="col-12" id="home-advanced-filters">
                                        <div className="row g-3 pt-3 mt-1 border-top">
                                            <div className="col-6 col-md-4 col-lg-2">
                                                <label className="form-label">Origen</label>
                                                <select
                                                    name="sourceType"
                                                    className="form-select"
                                                    value={filters.sourceType}
                                                    onChange={handleChange}
                                                >
                                                    <option value="">Todos</option>
                                                    <option value="inmobiliaria">Inmobiliarias</option>
                                                    <option value="particular">Particulares</option>
                                                </select>
                                            </div>

                                            <div className="col-6 col-md-4 col-lg-2">
                                                <label className="form-label">Ciudad</label>
                                                <input
                                                    type="text"
                                                    name="ciudad"
                                                    className="form-control"
                                                    placeholder="Ej: Córdoba"
                                                    value={filters.ciudad}
                                                    onChange={handleChange}
                                                />
                                            </div>

                                            <div className="col-6 col-md-4 col-lg-2">
                                                <label className="form-label">Barrio</label>
                                                <input
                                                    type="text"
                                                    name="barrio"
                                                    className="form-control"
                                                    placeholder="Ej: General Paz"
                                                    value={filters.barrio}
                                                    onChange={handleChange}
                                                />
                                            </div>

                                            <div className="col-6 col-md-4 col-lg-2">
                                                <label className="form-label">Dormitorios</label>
                                                <select
                                                    name="dormitoriosMin"
                                                    className="form-select"
                                                    value={filters.dormitoriosMin}
                                                    onChange={handleChange}
                                                >
                                                    <option value="">Cualquiera</option>
                                                    <option value="1">1+</option>
                                                    <option value="2">2+</option>
                                                    <option value="3">3+</option>
                                                    <option value="4">4+</option>
                                                </select>
                                            </div>

                                            <div className="col-6 col-md-4 col-lg-2">
                                                <label className="form-label">Precio mín.</label>
                                                <input
                                                    type="number"
                                                    name="precioMin"
                                                    className="form-control"
                                                    min="0"
                                                    value={filters.precioMin}
                                                    onChange={handleChange}
                                                />
                                            </div>

                                            <div className="col-6 col-md-4 col-lg-2">
                                                <label className="form-label">Precio máx.</label>
                                                <input
                                                    type="number"
                                                    name="precioMax"
                                                    className="form-control"
                                                    min="0"
                                                    value={filters.precioMax}
                                                    onChange={handleChange}
                                                />
                                            </div>

                                            <div className="col-12">
                                                <div className="d-flex flex-wrap gap-3">
                                                    {[
                                                        ["piscina", "Pileta"],
                                                        ["patio", "Patio"],
                                                        ["jardin", "Jardín"],
                                                        ["aptoCredito", "Apto crédito"],
                                                        ["video", "Con video"],
                                                    ].map(([name, label]) => (
                                                        <div className="form-check" key={name}>
                                                            <input
                                                                id={`home-${name}`}
                                                                className="form-check-input"
                                                                type="checkbox"
                                                                name={name}
                                                                checked={filters[name] === "true"}
                                                                onChange={handleChange}
                                                            />
                                                            <label
                                                                className="form-check-label"
                                                                htmlFor={`home-${name}`}
                                                            >
                                                                {label}
                                                            </label>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </form>

                    <div className="d-flex flex-wrap justify-content-center gap-2 mt-4">
                        <Link to="/publicar-inmueble-gratis" className="btn btn-primary">
                            Publicar como particular
                        </Link>
                        <Link to="/software-para-inmobiliarias" className="btn btn-outline-primary">
                            Publicar como inmobiliaria
                        </Link>
                    </div>
                </div>
            </section>

            <section className="portal-quick-searches bg-white">
                <div className="container">
                    <div className="d-flex flex-wrap justify-content-center gap-2">
                        {PROPERTY_TYPES.map((type) => (
                            <Link
                                key={type.value}
                                to={`/inmuebles?tipo=${type.value}`}
                                className="portal-type-chip"
                            >
                                <span aria-hidden="true">{type.icon}</span>
                                {type.label}
                            </Link>
                        ))}
                    </div>
                </div>
            </section>

            <HomeFeaturedProperties />

            <section className="portal-section portal-home-paths">
                <div className="container">
                    <div className="row g-4">
                        <div className="col-md-4">
                            <div className="portal-feature-card h-100">
                                <div className="portal-feature-icon">🔎</div>
                                <h2 className="h5">Buscá con confianza</h2>
                                <p className="text-muted">
                                    Compará publicaciones, revisá quién publica y contactá de
                                    manera directa.
                                </p>
                                <Link to="/sobre-onoprop" className="btn btn-outline-primary">
                                    Conocer ONO Prop
                                </Link>
                            </div>
                        </div>

                        <div className="col-md-4">
                            <div className="portal-feature-card h-100">
                                <div className="portal-feature-icon">🏢</div>
                                <h2 className="h5">Herramientas para inmobiliarias</h2>
                                <p className="text-muted">
                                    Publicación, sitio propio, red de colegas y módulos de gestión
                                    en una misma plataforma.
                                </p>
                                <Link to="/software-para-inmobiliarias" className="btn btn-outline-primary">
                                    Ver soluciones
                                </Link>
                            </div>
                        </div>

                        <div className="col-md-4">
                            <div className="portal-feature-card h-100">
                                <div className="portal-feature-icon">✓</div>
                                <h2 className="h5">Servicios a medida</h2>
                                <p className="text-muted">
                                    Elegí integraciones, publicaciones destacadas y herramientas
                                    según las necesidades de tu inmobiliaria.
                                </p>
                                <Link to="/planes" className="btn btn-outline-primary">
                                    Ver planes y servicios
                                </Link>
                            </div>
                        </div>
                    </div>

                    <div className="text-center mt-5">
                        <p className="text-muted mb-2">¿Necesitás ayuda o querés hacer una consulta?</p>
                        <Link to="/contacto" className="btn btn-outline-dark">
                            Contactar a ONO Prop
                        </Link>
                    </div>
                </div>
            </section>
        </main>
    );
};

export default PortalSearchHomePage;
