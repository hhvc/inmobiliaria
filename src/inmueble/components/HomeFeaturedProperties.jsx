import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import PortalFavoriteButton from "./PortalFavoriteButton";

import { getActiveParticularPublications } from "../../particular/services/particularPublicationListing.service";
import { getPublicInmobiliariaById } from "../../inmobiliaria/services/inmobiliaria.service";
import { getPublicInmuebles } from "../services/inmueble.service";
import { getPortalRankingConfig } from "../services/portalRankingConfig.service";
import {
    DEFAULT_PORTAL_RANKING_CONFIG,
    getPaidPromotionScore,
    sortPortalItemsByRelevance,
} from "../utils/portalRanking.helpers";

const FEATURED_SOURCE_PAGE_SIZE = 6;
const FEATURED_VISIBLE_COUNT = 6;

const getCoverImageUrl = (item = {}) => {
    if (!Array.isArray(item.images)) return "";

    const image = [...item.images]
        .filter((candidate) => candidate?.url || candidate?.thumbnailUrl)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))[0];

    return image?.thumbnailUrl || image?.url || "";
};

const getLocation = (item = {}) => {
    const direccion = item.direccion && typeof item.direccion === "object"
        ? item.direccion
        : {};

    return (
        item.ubicacion ||
        [
            item.barrio || direccion.barrio,
            item.ciudad || item.localidad || direccion.ciudad,
        ]
            .filter(Boolean)
            .join(", ") ||
        "Ubicación a consultar"
    );
};

const formatPrice = (item = {}) => {
    if (item.precioLabel) return item.precioLabel;

    const value = Number(item.precio || item.precioEstimado);

    if (!Number.isFinite(value) || value <= 0) return "Consultar precio";

    return `${item.moneda || "USD"} ${value.toLocaleString("es-AR")}`;
};

const getAgencyLogoUrl = (agency = {}) => (
    agency.logoUrl ||
    agency.logo ||
    agency.branding?.logoUrl ||
    agency.branding?.logo?.url ||
    agency.branding?.logo ||
    agency.branding?.isologoUrl ||
    ""
);

const getFeaturedPublisherData = (item = {}, sourceType, agency = null) => {
    const isParticular = sourceType === "particular";
    const publisher = item.publisher && typeof item.publisher === "object"
        ? item.publisher
        : {};
    const isPersonalPublisher = publisher.type === "user" || item.publisherMode === "user";
    const sourceName =
        publisher.name ||
        item.sourceLabel ||
        item.inmobiliariaNombre ||
        agency?.nombre ||
        agency?.razonSocial ||
        (isParticular ? "Dueño particular" : "Inmobiliaria adherida");
    const sourceLogoUrl =
        publisher.photoURL ||
        publisher.logoUrl ||
        item.sourceLogoUrl ||
        item.inmobiliariaLogoUrl ||
        (!isPersonalPublisher ? getAgencyLogoUrl(agency) : "");
    const agencySlug =
        publisher.slug ||
        item.inmobiliariaSlug ||
        item.agenciaSlug ||
        agency?.slug ||
        "";

    return {
        sourceName,
        sourceLogoUrl,
        sourceProfilePath:
            publisher.profilePath ||
            (!isParticular && !isPersonalPublisher && agencySlug
                ? `/inmobiliaria/${agencySlug}`
                : ""),
    };
};

const getInmuebleAgencyId = (item = {}) => (
    item.inmobiliariaId || item.ownerInmobiliariaId || item.agenciaId || ""
);

const hasStoredPublisherIdentity = (item = {}) => Boolean(
    item.publisher?.name &&
    (
        item.publisher?.photoURL ||
        item.publisher?.logoUrl ||
        item.sourceLogoUrl ||
        item.inmobiliariaLogoUrl
    )
);

const loadMissingFeaturedAgencies = async (items = []) => {
    const agencyIds = Array.from(new Set(
        items
            .filter((item) => item.publisher?.type !== "user" && item.publisherMode !== "user")
            .filter((item) => !hasStoredPublisherIdentity(item))
            .map(getInmuebleAgencyId)
            .filter(Boolean),
    ));

    const entries = await Promise.all(agencyIds.map(async (agencyId) => {
        try {
            return [agencyId, await getPublicInmobiliariaById(agencyId)];
        } catch (error) {
            console.warn("No se pudo completar la identidad de la inmobiliaria:", error);
            return [agencyId, null];
        }
    }));

    return Object.fromEntries(entries);
};

const normalizeFeaturedItem = (item, sourceType, agenciesById = {}) => {
    const isParticular = sourceType === "particular";
    const agency = isParticular
        ? null
        : agenciesById[getInmuebleAgencyId(item)] || null;

    return {
        ...item,
        sourceType,
        publicPath: isParticular
            ? `/particulares/${item.id}`
            : `/inmueble/${item.slug || item.id}`,
        titulo: item.titulo || item.ubicacion || "Inmueble publicado",
        locationLabel: getLocation(item),
        coverImageUrl: getCoverImageUrl(item),
        priceLabel: formatPrice(item),
        ...getFeaturedPublisherData(item, sourceType, agency),
    };
};

const getPublisherInitial = (value = "") => {
    const cleanValue = value.toString().trim();
    return cleanValue ? cleanValue.slice(0, 1).toUpperCase() : "I";
};

const HomeFeaturedProperties = () => {
    const sectionRef = useRef(null);
    const [shouldLoad, setShouldLoad] = useState(false);
    const [items, setItems] = useState([]);
    const [rankingConfig, setRankingConfig] = useState(
        DEFAULT_PORTAL_RANKING_CONFIG,
    );
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        const section = sectionRef.current;

        if (!section || typeof IntersectionObserver === "undefined") {
            setShouldLoad(true);
            return undefined;
        }

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries.some((entry) => entry.isIntersecting)) {
                    setShouldLoad(true);
                    observer.disconnect();
                }
            },
            { rootMargin: "300px 0px" },
        );

        observer.observe(section);

        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (!shouldLoad) return undefined;

        let active = true;

        const loadFeatured = async () => {
            try {
                setLoading(true);
                setError("");

                const [agencyResult, particularResult, config] = await Promise.all([
                    getPublicInmuebles({ pageSize: FEATURED_SOURCE_PAGE_SIZE }),
                    getActiveParticularPublications({
                        pageSize: FEATURED_SOURCE_PAGE_SIZE,
                    }),
                    getPortalRankingConfig(),
                ]);

                if (!active) return;

                const agencyItems = agencyResult?.data || [];
                const agenciesById = await loadMissingFeaturedAgencies(agencyItems);

                if (!active) return;

                const normalizedItems = [
                    ...agencyItems.map((item) =>
                        normalizeFeaturedItem(item, "inmobiliaria", agenciesById),
                    ),
                    ...(particularResult?.data || []).map((item) =>
                        normalizeFeaturedItem(item, "particular"),
                    ),
                ];

                setRankingConfig(config);
                setItems(
                    sortPortalItemsByRelevance(normalizedItems, config).slice(
                        0,
                        FEATURED_VISIBLE_COUNT,
                    ),
                );
            } catch (err) {
                if (!active) return;

                console.error("No se pudieron cargar los inmuebles destacados:", err);
                setError("No pudimos cargar los destacados en este momento.");
            } finally {
                if (active) setLoading(false);
            }
        };

        loadFeatured();

        return () => {
            active = false;
        };
    }, [shouldLoad]);

    const visibleItems = useMemo(() => items.slice(0, FEATURED_VISIBLE_COUNT), [items]);

    return (
        <section
            ref={sectionRef}
            className="portal-section bg-white home-featured-section"
            aria-busy={loading}
        >
            <div className="container">
                <div className="d-flex flex-wrap justify-content-between align-items-end gap-3 mb-4">
                    <div>
                        <p className="text-uppercase text-muted small mb-1">
                            Oportunidades para explorar
                        </p>
                        <h2 className="portal-section-title mb-0">Inmuebles destacados</h2>
                    </div>

                    <Link to="/inmuebles" className="btn btn-outline-primary">
                        Ver todos los inmuebles
                    </Link>
                </div>

                {!shouldLoad && (
                    <div className="home-featured-placeholder" aria-hidden="true" />
                )}

                {loading && (
                    <div className="row g-4" aria-label="Cargando inmuebles destacados">
                        {Array.from({ length: 3 }).map((_, index) => (
                            <div className="col-12 col-md-6 col-lg-4" key={index}>
                                <div className="home-featured-skeleton" />
                            </div>
                        ))}
                    </div>
                )}

                {!loading && error && <div className="alert alert-light border">{error}</div>}

                {!loading && !error && shouldLoad && visibleItems.length === 0 && (
                    <div className="alert alert-light border mb-0">
                        Las nuevas publicaciones destacadas aparecerán en esta sección.
                    </div>
                )}

                {!loading && !error && visibleItems.length > 0 && (
                    <div className="row g-4">
                        {visibleItems.map((item) => {
                            const isPromoted =
                                getPaidPromotionScore(item, rankingConfig) > 0;

                            return (
                                <article
                                    className="col-12 col-md-6 col-lg-4"
                                    key={`${item.sourceType}:${item.id}`}
                                >
                                    <div className="card h-100 border-0 shadow-sm overflow-hidden text-dark home-featured-card">
                                        <div className="position-relative home-featured-image-wrap">
                                            <Link
                                                to={item.publicPath}
                                                state={{ performanceSource: "home" }}
                                                className="text-decoration-none"
                                            >
                                                {item.coverImageUrl ? (
                                                    <img
                                                        src={item.coverImageUrl}
                                                        alt={item.titulo}
                                                        className="home-featured-image"
                                                        loading="lazy"
                                                    />
                                                ) : (
                                                    <div className="home-featured-image-empty">
                                                        Sin imagen
                                                    </div>
                                                )}
                                            </Link>

                                            <div className="position-absolute top-0 start-0 p-3 d-flex gap-2">
                                                {isPromoted && (
                                                    <span className="badge text-bg-warning">
                                                        ★ Destacado
                                                    </span>
                                                )}
                                                <span className="badge text-bg-dark">
                                                    {item.sourceType === "particular"
                                                        ? "Particular"
                                                        : "Inmobiliaria"}
                                                </span>
                                            </div>
                                            <div className="position-absolute top-0 end-0 p-3">
                                                <PortalFavoriteButton
                                                    item={item}
                                                    compact
                                                    performanceSource="home"
                                                />
                                            </div>
                                        </div>

                                        <div className="card-body p-4">
                                            {item.sourceProfilePath ? (
                                                <Link
                                                    to={item.sourceProfilePath}
                                                    className="home-featured-publisher d-flex align-items-center gap-2 text-decoration-none mb-3 pb-3 border-bottom"
                                                    aria-label={`Ver inmobiliaria ${item.sourceName}`}
                                                >
                                                    {item.sourceLogoUrl ? (
                                                        <img
                                                            src={item.sourceLogoUrl}
                                                            alt={`Logo de ${item.sourceName}`}
                                                            className="portal-source-avatar"
                                                            loading="lazy"
                                                        />
                                                    ) : (
                                                        <span className="portal-source-avatar portal-source-avatar-fallback">
                                                            {getPublisherInitial(item.sourceName)}
                                                        </span>
                                                    )}
                                                    <span className="min-w-0">
                                                        <span className="d-block small text-muted lh-sm">
                                                            Publicado por
                                                        </span>
                                                        <span className="d-block fw-semibold small text-truncate">
                                                            {item.sourceName}
                                                        </span>
                                                    </span>
                                                </Link>
                                            ) : (
                                                <div className="home-featured-publisher d-flex align-items-center gap-2 mb-3 pb-3 border-bottom">
                                                    {item.sourceLogoUrl ? (
                                                        <img
                                                            src={item.sourceLogoUrl}
                                                            alt={item.sourceName}
                                                            className="portal-source-avatar"
                                                            loading="lazy"
                                                        />
                                                    ) : (
                                                        <span className="portal-source-avatar portal-source-avatar-fallback">
                                                            {getPublisherInitial(item.sourceName)}
                                                        </span>
                                                    )}
                                                    <span className="min-w-0">
                                                        <span className="d-block small text-muted lh-sm">
                                                            Publicado por
                                                        </span>
                                                        <span className="d-block fw-semibold small text-truncate">
                                                            {item.sourceName}
                                                        </span>
                                                    </span>
                                                </div>
                                            )}
                                            <Link
                                                to={item.publicPath}
                                                state={{ performanceSource: "home" }}
                                                className="text-decoration-none text-dark"
                                            >
                                                <h3 className="h5 home-featured-title mb-2">
                                                    {item.titulo}
                                                </h3>
                                            </Link>
                                            <p className="text-muted small mb-3">
                                                📍 {item.locationLabel}
                                            </p>
                                            <div className="h5 text-primary mb-0">
                                                {item.priceLabel}
                                            </div>
                                        </div>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                )}
            </div>
        </section>
    );
};

export default HomeFeaturedProperties;
