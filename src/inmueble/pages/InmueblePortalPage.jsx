import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import SEO from "../../components/SEO";
import { getActiveParticularPublications } from "../../particular/services/particularPublicationListing.service";
import { getPublicInmuebles } from "../services/inmueble.service";
import {
    getBanos,
    getCocherasCantidad,
    getDormitorios,
    getInmuebleAmenityBadges,
    getInmuebleFeatureBadges,
    getSuperficiePrincipal,
    hasCochera,
    inmuebleHasAmenity,
} from "../utils/inmuebleDisplay.helpers";
import { getVisibleInmuebleVideos } from "../utils/inmuebleVideos.helpers";
import { getPortalRankingConfig } from "../services/portalRankingConfig.service";
import {
    DEFAULT_PORTAL_RANKING_CONFIG,
    getPaidPromotionScore,
    sortPortalItemsByRelevance,
} from "../utils/portalRanking.helpers";
import PublicProfileModal from "../../profile/components/PublicProfileModal";
import PortalFavoriteButton from "../components/PortalFavoriteButton";
import PortalSearchAlertModal from "../components/PortalSearchAlertModal";
import { buildInmueblePublisherDescriptor } from "../../profile/utils/publicProfile.helpers";
import { getPublicProfileById } from "../../profile/services/publicProfile.service";
import {
    PORTAL_INITIAL_FILTERS as INITIAL_FILTERS,
    getPortalFiltersFromSearchParams,
    getPortalSearchParamsFromFilters,
    hasAdvancedPortalFilters,
    matchesPortalTextSearch,
    mergePortalItems,
    requiresCompletePortalDataset,
} from "../utils/portalSearch.helpers";

const PAGE_SIZE_PER_SOURCE = 12;
const COMPLETE_PAGE_SIZE_PER_SOURCE = 50;
const MAX_COMPLETE_DATASET_PAGES = 20;

const SOURCE_TYPES = [
    { value: "inmobiliaria", label: "Inmobiliarias" },
    { value: "particular", label: "Particulares" },
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
    { value: "deposito", label: "Depósito" },
    { value: "quinta", label: "Quinta" },
    { value: "campo", label: "Campo" },
];

const SORT_OPTIONS = [
    { value: "destacados", label: "Relevancia" },
    { value: "recientes", label: "Más recientes" },
    { value: "precio_asc", label: "Precio menor a mayor" },
    { value: "precio_desc", label: "Precio mayor a menor" },
    { value: "dormitorios_desc", label: "Más dormitorios" },
    { value: "superficie_desc", label: "Mayor superficie" },
];

const AMENITY_FILTERS = [
    { key: "piscina", label: "Piscina" },
    { key: "patio", label: "Patio" },
    { key: "jardin", label: "Jardín" },
    { key: "aptoCredito", label: "Apto crédito" },
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
    return value.toString().replace(/\s+/g, " ").trim();
};

const truncateText = (value = "", maxLength = 165) => {
    const cleanValue = normalizeSeoText(value);

    if (cleanValue.length <= maxLength) return cleanValue;

    return `${cleanValue.slice(0, maxLength - 1).trim()}…`;
};

const toNumber = (value) => {
    if (value === null || value === undefined || value === "") return null;

    const cleanValue = value
        .toString()
        .replace(/[^\d,.-]/g, "")
        .replace(/\./g, "")
        .replace(",", ".");

    const number = Number(cleanValue);

    return Number.isFinite(number) ? number : null;
};

const formatPrice = (inmueble) => {
    if (inmueble?.precioLabel) return inmueble.precioLabel;

    if (!inmueble?.precio) return "Consultar";

    const moneda = inmueble.moneda || "USD";
    const precio = Number(inmueble.precio);

    if (!Number.isFinite(precio)) {
        return `${moneda} ${inmueble.precio}`;
    }

    return `${moneda} ${precio.toLocaleString("es-AR")}`;
};

const getDireccionValue = (inmueble, key) => {
    return inmueble?.direccion?.[key] || inmueble?.[key] || "";
};

const buildAddress = (inmueble) => {
    const address = [
        getDireccionValue(inmueble, "barrio"),
        getDireccionValue(inmueble, "ciudad"),
    ]
        .filter(Boolean)
        .join(", ");

    return address || inmueble?.ubicacion || "";
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

    if (filters.sourceType) {
        badges.push({
            key: "sourceType",
            label: `Origen: ${getOptionLabel(SOURCE_TYPES, filters.sourceType)}`,
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

    if (filters.banosMin) {
        badges.push({
            key: "banosMin",
            label: `Baños: ${filters.banosMin}+`,
        });
    }

    if (filters.cocherasMin) {
        badges.push({
            key: "cocherasMin",
            label: `Cocheras: ${filters.cocherasMin}+`,
        });
    }

    if (filters.superficieMin) {
        badges.push({
            key: "superficieMin",
            label: `Superficie mín.: ${filters.superficieMin} m²`,
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

    AMENITY_FILTERS.forEach((amenityFilter) => {
        if (filters[amenityFilter.key] === "true") {
            badges.push({
                key: amenityFilter.key,
                label: amenityFilter.label,
            });
        }
    });

    if (filters.video === "true") {
        badges.push({
            key: "video",
            label: "Con video",
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

const matchesTextSearch = (inmueble, search) => {
    const amenityText = getInmuebleAmenityBadges(inmueble, 20)
        .map((item) => item.label)
        .join(" ");

    return matchesPortalTextSearch(inmueble, search, [
        inmueble.sourceLabel,
        amenityText,
    ]);
};

const matchesMinNumberFilter = ({ currentValue, filterValue }) => {
    const currentNumber = toNumber(currentValue);
    const filterNumber = toNumber(filterValue);

    if (filterNumber === null) return true;

    return currentNumber !== null && currentNumber >= filterNumber;
};

const getCocherasValueForFilter = (inmueble = {}) => {
    const cocherasCantidad = getCocherasCantidad(inmueble);

    if (cocherasCantidad) return cocherasCantidad;

    return hasCochera(inmueble) ? 1 : "";
};

const matchesFilters = (inmueble, filters) => {
    if (!matchesTextSearch(inmueble, filters.search)) return false;

    if (filters.sourceType && inmueble.sourceType !== filters.sourceType) {
        return false;
    }

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

    if (
        !matchesMinNumberFilter({
            currentValue: getDormitorios(inmueble),
            filterValue: filters.dormitoriosMin,
        })
    ) {
        return false;
    }

    if (
        !matchesMinNumberFilter({
            currentValue: getBanos(inmueble),
            filterValue: filters.banosMin,
        })
    ) {
        return false;
    }

    if (
        !matchesMinNumberFilter({
            currentValue: getCocherasValueForFilter(inmueble),
            filterValue: filters.cocherasMin,
        })
    ) {
        return false;
    }

    if (
        !matchesMinNumberFilter({
            currentValue: getSuperficiePrincipal(inmueble),
            filterValue: filters.superficieMin,
        })
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

    const selectedAmenities = AMENITY_FILTERS.filter(
        (amenityFilter) => filters[amenityFilter.key] === "true",
    );

    const hasSelectedAmenities = selectedAmenities.every((amenityFilter) =>
        inmuebleHasAmenity(inmueble, amenityFilter.key),
    );

    if (!hasSelectedAmenities) {
        return false;
    }

    if (
        filters.video === "true" &&
        getVisibleInmuebleVideos(inmueble?.videos || []).length === 0
    ) {
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

const sortInmuebles = (items, sortBy, rankingConfig) => {
    const sortedItems = [...items];

    if (sortBy === "destacados") {
        return sortPortalItemsByRelevance(sortedItems, rankingConfig);
    }

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
            return (
                (toNumber(getDormitorios(b)) || 0) -
                (toNumber(getDormitorios(a)) || 0)
            );
        }

        if (sortBy === "superficie_desc") {
            return (
                (toNumber(getSuperficiePrincipal(b)) || 0) -
                (toNumber(getSuperficiePrincipal(a)) || 0)
            );
        }

        return sortPortalItemsByRelevance([a, b], rankingConfig)[0] === a
            ? -1
            : 1;
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

    if (filters.sourceType) {
        parts.push(getOptionLabel(SOURCE_TYPES, filters.sourceType));
    }

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

    if (filters.dormitoriosMin) {
        parts.push(`desde ${filters.dormitoriosMin} dorm.`);
    }

    if (filters.search) {
        parts.push(`| ${filters.search}`);
    }

    if (parts.length === 0) {
        return "Inmuebles publicados | ONO Prop";
    }

    return `${parts.join(" ")} | ONO Prop`;
};

const buildSeoDescription = ({ filters, resultCount }) => {
    const parts = [];

    if (resultCount > 0) {
        parts.push(
            `${resultCount} ${resultCount === 1
                ? "publicación inmobiliaria"
                : "publicaciones inmobiliarias"
            }`,
        );
    } else {
        parts.push("Buscador de inmuebles publicados");
    }

    if (filters.sourceType) {
        parts.push(`origen ${getOptionLabel(SOURCE_TYPES, filters.sourceType)}`);
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

    if (filters.banosMin) {
        parts.push(`desde ${filters.banosMin} baños`);
    }

    if (filters.cocherasMin) {
        parts.push(`desde ${filters.cocherasMin} cocheras`);
    }

    if (filters.superficieMin) {
        parts.push(`desde ${filters.superficieMin} m²`);
    }

    AMENITY_FILTERS.forEach((amenityFilter) => {
        if (filters[amenityFilter.key] === "true") {
            parts.push(amenityFilter.label.toLowerCase());
        }
    });

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
            : "Filtrá propiedades por operación, tipo, ciudad, barrio, dormitorios, baños, cocheras, superficie, precio y origen.";

    return truncateText(
        `${baseDescription}. Consultá propiedades publicadas por inmobiliarias y particulares en ONO Prop.`,
    );
};

const buildPortalItemUrl = (inmueble) => {
    const path =
        inmueble?.publicPath ||
        (inmueble?.slug || inmueble?.id
            ? `/inmueble/${inmueble.slug || inmueble.id}`
            : "");

    if (!path) return "";

    if (typeof window === "undefined") {
        return path;
    }

    return `${window.location.origin}${path}`;
};

const buildItemListJsonLd = ({ filteredInmuebles, seoUrl }) => {
    return {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: "Inmuebles publicados en ONO Prop",
        description:
            "Buscador público de inmuebles publicados por inmobiliarias y particulares en ONO Prop.",
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
                        seller: {
                            "@type": "Organization",
                            name: inmueble.sourceLabel || "ONO Prop",
                        },
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

const getInmuebleInmobiliariaId = (inmueble = {}) => {
    return (
        inmueble.inmobiliariaId ||
        inmueble.ownerInmobiliariaId ||
        inmueble.agenciaId ||
        ""
    );
};

const getInmobiliariaLogoUrl = (inmobiliaria = {}) => {
    if (!inmobiliaria || typeof inmobiliaria !== "object") return "";

    return (
        inmobiliaria.logoUrl ||
        inmobiliaria.logo ||
        inmobiliaria.branding?.logoUrl ||
        inmobiliaria.branding?.logo?.url ||
        inmobiliaria.branding?.logo ||
        inmobiliaria.branding?.isologoUrl ||
        ""
    );
};

const mapInmuebleToPortalItem = (inmueble, inmobiliariasById = {}) => {
    const slugOrId = inmueble.slug || inmueble.id;
    const inmobiliariaId = getInmuebleInmobiliariaId(inmueble);
    const inmobiliaria = inmobiliariasById[inmobiliariaId] || null;

    const personalPublisher = inmueble.publisher?.type === "user"
        ? inmueble.publisher
        : null;
    const sourceLabel =
        personalPublisher?.name ||
        inmueble.inmobiliariaNombre ||
        inmueble.inmobiliariaDisplayName ||
        inmueble.agenciaNombre ||
        inmueble.inmobiliaria?.nombre ||
        inmobiliaria?.nombre ||
        inmobiliaria?.razonSocial ||
        "Inmobiliaria adherida";

    const inmobiliariaSlug =
        inmueble.inmobiliariaSlug ||
        inmueble.agenciaSlug ||
        inmueble.inmobiliaria?.slug ||
        inmobiliaria?.slug ||
        "";

    const sourceLogoUrl =
        personalPublisher?.photoURL ||
        personalPublisher?.logoUrl ||
        inmueble.inmobiliariaLogoUrl ||
        inmueble.agenciaLogoUrl ||
        inmueble.inmobiliaria?.branding?.logo?.url ||
        inmueble.inmobiliaria?.branding?.logoUrl ||
        inmueble.inmobiliaria?.logoUrl ||
        getInmobiliariaLogoUrl(inmobiliaria);

    return {
        ...inmueble,
        sourceType: "inmobiliaria",
        sourceLabel,
        sourceTypeLabel: "Inmobiliaria",
        sourceBadgeClass: "text-bg-primary",
        sourceLogoUrl,
        inmobiliariaNombre:
            inmueble.inmobiliariaNombre || inmobiliaria?.nombre || sourceLabel,
        inmobiliariaLogoUrl:
            inmueble.inmobiliariaLogoUrl || getInmobiliariaLogoUrl(inmobiliaria),
        inmobiliariaId,
        inmobiliariaSlug,
        publicPath: slugOrId ? `/inmueble/${slugOrId}` : "",
        precioLabel: "",
        promotion: inmueble.promotion || inmueble.promo || null,
        promo: inmueble.promo || inmueble.promotion || null,
        createdAt: inmueble.createdAt || inmueble.updatedAt || null,
        updatedAt: inmueble.updatedAt || inmueble.createdAt || null,
        destacado: Boolean(inmueble.destacado),
    };
};

const mapParticularPublicationToPortalItem = (publication) => {
    const direccion =
        publication.direccion && typeof publication.direccion === "object"
            ? publication.direccion
            : {};

    const ciudad =
        publication.ciudad || direccion.ciudad || publication.localidad || "";

    const barrio = publication.barrio || direccion.barrio || "";

    const precio = publication.precio || publication.precioEstimado || "";

    const ambientes = publication.ambientes || "";
    const dormitorios = publication.dormitorios || "";
    const banos = publication.banos || publication.banios || "";
    const cocheras = publication.cocheras || "";

    const superficie =
        publication.superficie && typeof publication.superficie === "object"
            ? publication.superficie
            : {
                total: publication.superficieTotal || "",
                cubierta: publication.superficieCubierta || "",
                semicubierta: publication.superficieSemicubierta || "",
                descubierta: publication.superficieDescubierta || "",
                terreno: publication.superficieTerreno || "",
            };

    return {
        id: publication.id,
        sourceType: "particular",
        sourceLabel: "Dueño particular",
        sourceTypeLabel: "Particular",
        sourceBadgeClass: "text-bg-dark",
        sourceLogoUrl: "",
        inmobiliariaSlug: "",
        publicPath: `/particulares/${publication.id}`,

        titulo:
            publication.titulo || publication.ubicacion || "Publicación particular",

        descripcion: publication.descripcion || "",
        operacion: publication.operacion || "",
        tipo: publication.tipo || "",

        ubicacion:
            publication.ubicacion ||
            [barrio, ciudad].filter(Boolean).join(", ") ||
            "Ubicación a consultar",

        ciudad,
        barrio,
        direccion,

        precio,
        precioLabel: precio || "Consultar",
        moneda: publication.moneda || "",

        ambientes,
        dormitorios,
        banos,
        cocheras,

        caracteristicas: {
            ...(publication.caracteristicas || {}),
            ambientes: publication.caracteristicas?.ambientes || ambientes,
            dormitorios: publication.caracteristicas?.dormitorios || dormitorios,
            banos: publication.caracteristicas?.banos || banos,
            cocheras: Boolean(
                publication.caracteristicas?.cocheras ||
                publication.caracteristicas?.cocherasCantidad ||
                cocheras,
            ),
            cocherasCantidad:
                publication.caracteristicas?.cocherasCantidad || cocheras,
        },

        superficie,
        amenities: publication.amenities || {},
        servicios: publication.servicios || {},

        images: Array.isArray(publication.images) ? publication.images : [],
        videos: Array.isArray(publication.videos) ? publication.videos : [],

        promotion: publication.promotion || publication.promo || null,
        promo: publication.promo || publication.promotion || null,
        destacado: Boolean(publication.destacado),

        createdAt:
            publication.approvedAt || publication.createdAt || publication.updatedAt || null,

        updatedAt:
            publication.updatedAt || publication.approvedAt || publication.createdAt || null,

        publicStatus: publication.publicStatus || "active",
        moderationStatus: publication.moderationStatus || "approved",

        publisher: {
            type: "user",
            id: publication.ownerUserId || "",
            name: "Dueño particular",
            photoURL: "",
            profilePath: "",
        },
        publisherMode: "user",
        publisherUserId: publication.ownerUserId || "",

        raw: publication,
    };
};

const getSourceDisplayName = (inmueble) => {
    if (inmueble?.sourceType === "particular") {
        return "Dueño particular";
    }

    return (
        inmueble?.sourceLabel ||
        inmueble?.inmobiliariaNombre ||
        inmueble?.agenciaNombre ||
        inmueble?.inmobiliaria?.nombre ||
        "Inmobiliaria adherida"
    );
};

const getSourceTypeLabel = (inmueble) => {
    if (inmueble?.sourceType === "particular") {
        return "Particular";
    }

    return "Inmobiliaria";
};

const hydratePublicPublisherProfiles = async (items = []) => {
    const userIds = Array.from(new Set(
        items
            .filter((item) => item.publisher?.type === "user")
            .map((item) => item.publisherUserId || item.publisher?.id)
            .filter(Boolean),
    ));

    if (userIds.length === 0) return items;

    const profileEntries = await Promise.all(
        userIds.map(async (userId) => [userId, await getPublicProfileById(userId)]),
    );
    const profilesById = Object.fromEntries(profileEntries);

    return items.map((item) => {
        if (item.publisher?.type !== "user") return item;

        const userId = item.publisherUserId || item.publisher?.id || "";
        const profile = profilesById[userId];

        if (profile?.isPublic && profile.displayName) {
            return {
                ...item,
                publisherMode: "user",
                publisherUserId: userId,
                publisher: {
                    ...item.publisher,
                    type: "user",
                    id: userId,
                    name: profile.displayName,
                    photoURL: profile.photoURL || "",
                    logoUrl: profile.photoURL || "",
                    headline: profile.headline || "",
                },
                sourceLabel: profile.displayName,
                sourceLogoUrl: profile.photoURL || "",
            };
        }

        if (item.sourceType === "inmobiliaria") {
            return {
                ...item,
                publisherMode: "agency",
                publisherUserId: "",
                publisher: {
                    type: "inmobiliaria",
                    id: item.inmobiliariaId || "",
                    name: item.inmobiliariaNombre || "Inmobiliaria adherida",
                    logoUrl: item.inmobiliariaLogoUrl || "",
                    photoURL: item.inmobiliariaLogoUrl || "",
                    slug: item.inmobiliariaSlug || "",
                    profilePath: item.inmobiliariaSlug
                        ? `/inmobiliaria/${item.inmobiliariaSlug}`
                        : "",
                },
                sourceLabel: item.inmobiliariaNombre || "Inmobiliaria adherida",
                sourceLogoUrl: item.inmobiliariaLogoUrl || "",
            };
        }

        return {
            ...item,
            publisher: {
                ...item.publisher,
                name: "Dueño particular",
                photoURL: "",
                logoUrl: "",
            },
            sourceLabel: "Dueño particular",
            sourceLogoUrl: "",
        };
    });
};

const getPortalPublisherDescriptor = (inmueble = {}) => {
    if (inmueble.sourceType === "particular") {
        return {
            type: "user",
            id: inmueble.publisherUserId || inmueble.ownerUserId || inmueble.publisher?.id || "",
            name: "Dueño particular",
            photoURL: "",
            profilePath: "",
        };
    }

    return buildInmueblePublisherDescriptor({ inmueble });
};

const getSourceBadgeClass = (inmueble) => {
    if (inmueble?.sourceType === "particular") {
        return "text-bg-dark";
    }

    return "text-bg-primary";
};

const getSourceLogoUrl = (inmueble) => {
    if (inmueble?.sourceType === "particular") {
        return "";
    }

    return (
        inmueble?.sourceLogoUrl ||
        inmueble?.inmobiliariaLogoUrl ||
        inmueble?.agenciaLogoUrl ||
        inmueble?.inmobiliaria?.branding?.logo?.url ||
        inmueble?.inmobiliaria?.logoUrl ||
        ""
    );
};

const getSourceInitial = (name = "") => {
    const cleanName = name.toString().trim();

    if (!cleanName) return "I";

    return cleanName.slice(0, 1).toUpperCase();
};

const getPhotoCount = (inmueble) => {
    if (!Array.isArray(inmueble?.images)) return 0;

    return inmueble.images.filter((image) => image?.url).length;
};

const isPortalItemPromoted = (inmueble, rankingConfig) => {
    return getPaidPromotionScore(inmueble, rankingConfig) > 0;
};

const getShortDescription = (description = "", maxLength = 115) => {
    const cleanDescription = description.toString().replace(/\s+/g, " ").trim();

    if (cleanDescription.length <= maxLength) {
        return cleanDescription;
    }

    return `${cleanDescription.slice(0, maxLength).trim()}...`;
};

const loadPortalBatch = async ({
    includeAgency = true,
    includeParticular = true,
    agencyLastDoc = null,
    particularLastDoc = null,
    operacion = "",
    tipo = "",
    pageSize = PAGE_SIZE_PER_SOURCE,
} = {}) => {
    const emptyResult = {
        data: [],
        lastDoc: null,
        hasMore: false,
    };

    const [agencyResult, particularResult] = await Promise.all([
        includeAgency
            ? getPublicInmuebles({
                pageSize,
                lastDoc: agencyLastDoc,
                operacion,
                tipo,
            })
            : Promise.resolve(emptyResult),
        includeParticular
            ? getActiveParticularPublications({
                pageSize,
                lastDoc: particularLastDoc,
                operacion,
                tipo,
            })
            : Promise.resolve(emptyResult),
    ]);

    const agencyItems = (agencyResult?.data || []).map((inmueble) =>
        mapInmuebleToPortalItem(inmueble),
    );

    const particularItems = (particularResult?.data || []).map(
        mapParticularPublicationToPortalItem,
    );

    const items = await hydratePublicPublisherProfiles([
        ...agencyItems,
        ...particularItems,
    ]);

    return {
        items,
        cursors: {
            agency: agencyResult?.lastDoc || agencyLastDoc || null,
            particular: particularResult?.lastDoc || particularLastDoc || null,
        },
        hasMore: {
            agency: includeAgency && agencyResult?.hasMore === true,
            particular: includeParticular && particularResult?.hasMore === true,
        },
    };
};

const InmueblePortalPage = () => {
    const [searchParams, setSearchParams] = useSearchParams();

    const [inmuebles, setInmuebles] = useState([]);
    const [filters, setFilters] = useState(() =>
        getPortalFiltersFromSearchParams(searchParams),
    );
    const [showAdvancedFilters, setShowAdvancedFilters] = useState(() =>
        hasAdvancedPortalFilters(getPortalFiltersFromSearchParams(searchParams)),
    );
    const [copySuccess, setCopySuccess] = useState(false);
    const [showSearchAlert, setShowSearchAlert] = useState(false);
    const [selectedPublisher, setSelectedPublisher] = useState(null);
    const [cursors, setCursors] = useState({ agency: null, particular: null });
    const [hasMore, setHasMore] = useState({ agency: false, particular: false });

    const [rankingConfig, setRankingConfig] = useState(
        DEFAULT_PORTAL_RANKING_CONFIG,
    );

    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState(null);
    const [loadMoreError, setLoadMoreError] = useState(null);

    const alertStatus = searchParams.get("alerta") || "";
    const needsCompleteDataset = requiresCompletePortalDataset(filters);

    useEffect(() => {
        const nextFilters = getPortalFiltersFromSearchParams(searchParams);
        setFilters(nextFilters);

        if (hasAdvancedPortalFilters(nextFilters)) {
            setShowAdvancedFilters(true);
        }
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

        return sortInmuebles(filteredItems, filters.sortBy, rankingConfig);
    }, [filters, inmuebles, rankingConfig]);

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

    const seoUrl = useMemo(() => {
        return buildPortalUrl(getPortalSearchParamsFromFilters(filters).toString());
    }, [filters]);

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
        let active = true;

        getPortalRankingConfig()
            .then((config) => {
                if (active) setRankingConfig(config);
            })
            .catch((err) => {
                console.warn("No se pudo cargar la configuración del ranking:", err);
            });

        return () => {
            active = false;
        };
    }, []);

    useEffect(() => {
        let active = true;

        const fetchFirstPage = async () => {
            try {
                setLoading(true);
                setError(null);
                setLoadMoreError(null);
                setInmuebles([]);

                const pageSize = needsCompleteDataset
                    ? COMPLETE_PAGE_SIZE_PER_SOURCE
                    : PAGE_SIZE_PER_SOURCE;
                let batch = await loadPortalBatch({
                    includeAgency: filters.sourceType !== "particular",
                    includeParticular: filters.sourceType !== "inmobiliaria",
                    operacion: filters.operacion,
                    tipo: filters.tipo,
                    pageSize,
                });

                if (!active) return;

                let loadedItems = batch.items;
                let loadedCursors = batch.cursors;
                let loadedHasMore = batch.hasMore;
                let loadedPages = 1;

                while (
                    active &&
                    needsCompleteDataset &&
                    (loadedHasMore.agency || loadedHasMore.particular) &&
                    loadedPages < MAX_COMPLETE_DATASET_PAGES
                ) {
                    const nextBatch = await loadPortalBatch({
                        includeAgency:
                            filters.sourceType !== "particular" &&
                            loadedHasMore.agency,
                        includeParticular:
                            filters.sourceType !== "inmobiliaria" &&
                            loadedHasMore.particular,
                        agencyLastDoc: loadedCursors.agency,
                        particularLastDoc: loadedCursors.particular,
                        operacion: filters.operacion,
                        tipo: filters.tipo,
                        pageSize,
                    });

                    if (!active) return;

                    loadedItems = mergePortalItems(loadedItems, nextBatch.items);
                    loadedCursors = nextBatch.cursors;
                    loadedHasMore = nextBatch.hasMore;
                    loadedPages += 1;
                }

                setInmuebles(loadedItems);
                setCursors(loadedCursors);
                setHasMore(loadedHasMore);
            } catch (err) {
                if (!active) return;

                console.error("Error cargando portal público de inmuebles:", err);

                if (err.code === "permission-denied") {
                    setError("No se pudieron cargar los inmuebles publicados.");
                } else {
                    setError(err.message || "No se pudieron cargar los inmuebles.");
                }
            } finally {
                if (active) setLoading(false);
            }
        };

        fetchFirstPage();

        return () => {
            active = false;
        };
    }, [
        filters.sourceType,
        filters.operacion,
        filters.tipo,
        needsCompleteDataset,
    ]);

    const updateFilters = (nextFilters, options = {}) => {
        setFilters(nextFilters);
        setSearchParams(getPortalSearchParamsFromFilters(nextFilters), {
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

    const handleAmenityFilterChange = (key, checked) => {
        updateFilters({
            ...filters,
            [key]: checked ? "true" : "",
        });
    };

    const handleClearFilters = () => {
        updateFilters(INITIAL_FILTERS);
        setShowAdvancedFilters(false);
    };

    const canLoadMore = hasMore.agency || hasMore.particular;

    const handleLoadMore = async () => {
        if (loadingMore || !canLoadMore) return;

        try {
            setLoadingMore(true);
            setLoadMoreError(null);

            const batch = await loadPortalBatch({
                includeAgency:
                    filters.sourceType !== "particular" && hasMore.agency,
                includeParticular:
                    filters.sourceType !== "inmobiliaria" && hasMore.particular,
                agencyLastDoc: cursors.agency,
                particularLastDoc: cursors.particular,
                operacion: filters.operacion,
                tipo: filters.tipo,
            });

            setInmuebles((currentItems) =>
                mergePortalItems(currentItems, batch.items),
            );
            setCursors(batch.cursors);
            setHasMore(batch.hasMore);
        } catch (err) {
            console.error("Error cargando más inmuebles:", err);
            setLoadMoreError(err.message || "No se pudieron cargar más inmuebles.");
        } finally {
            setLoadingMore(false);
        }
    };

    const handleSearchSubmit = (event) => {
        event.preventDefault();

        if (typeof document === "undefined") return;

        document.getElementById("portal-results")?.scrollIntoView({
            behavior: "smooth",
            block: "start",
        });
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
            const currentUrl = buildPortalUrl(
                getPortalSearchParamsFromFilters(filters).toString(),
            );

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
            const currentUrl = buildPortalUrl(
                getPortalSearchParamsFromFilters(filters).toString(),
            );

            if (!currentUrl) {
                throw new Error("No se pudo obtener la URL actual");
            }

            const message = [
                "Te comparto esta búsqueda de inmuebles en ONO Prop:",
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

        window.sessionStorage.setItem(
            "lastInmuebleSearchUrl",
            buildPortalUrl(getPortalSearchParamsFromFilters(filters).toString()),
        );
    };

    return (
        <main className="portal-home">
            <SEO
                title={seoTitle}
                description={seoDescription}
                image={seoImage}
                url={seoUrl}
                type="website"
                siteName="ONO Prop"
                jsonLd={portalJsonLd}
            />

            <section className="py-5">
                <div className="container">
                    {alertStatus === "confirmada" && (
                        <div className="alert alert-success mb-4">
                            <strong>Búsqueda activada.</strong> Te avisaremos cuando aparezcan
                            nuevas publicaciones que coincidan con tus filtros.
                        </div>
                    )}
                    {alertStatus === "cancelada" && (
                        <div className="alert alert-info mb-4">
                            La alerta fue cancelada y no enviaremos nuevos avisos.
                        </div>
                    )}
                    {["invalida", "vencida", "baja-invalida"].includes(alertStatus) && (
                        <div className="alert alert-warning mb-4">
                            El enlace de la alerta no es válido o ya venció. Podés guardar
                            nuevamente la búsqueda actual.
                        </div>
                    )}
                    <div className="row align-items-end g-4 mb-4">
                        <div className="col-lg-7">
                            <div className="portal-eyebrow">Buscador inmobiliario</div>

                            <h1 className="portal-section-title mb-3">
                                Encontrá tu próximo inmueble
                            </h1>

                            <p className="lead text-muted mb-0">
                                Buscá publicaciones de inmobiliarias adheridas y propietarios
                                particulares. Podés precisar la búsqueda cuando lo necesites.
                            </p>
                        </div>

                        <div className="col-lg-5">
                            <div className="d-flex flex-wrap gap-2 justify-content-lg-end">
                                <Link to="/publicar" className="btn btn-primary">
                                    Publicar como particular
                                </Link>
                                <Link to="/inmobiliarias" className="btn btn-outline-primary">
                                    Publicar como inmobiliaria
                                </Link>
                            </div>
                        </div>
                    </div>

                    <form
                        className="portal-search-card card mb-4"
                        onSubmit={handleSearchSubmit}
                        role="search"
                    >
                        <div className="card-body p-3 p-lg-4">
                            <div className="row g-3 align-items-end">
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
                                        className="form-select form-select-lg"
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
                                        className="form-select form-select-lg"
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
                                        aria-controls="portal-advanced-filters"
                                    >
                                        {showAdvancedFilters ? "Menos filtros" : "Más filtros"}
                                        {!showAdvancedFilters && hasAdvancedPortalFilters(filters)
                                            ? " •"
                                            : ""}
                                    </button>
                                </div>

                                {showAdvancedFilters && (
                                    <div className="col-12" id="portal-advanced-filters">
                                        <div className="row g-3 pt-3 mt-1 border-top">
                                            <div className="col-6 col-lg-3 col-xl-2">
                                                <label className="form-label">Origen</label>
                                                <select
                                                    name="sourceType"
                                                    className="form-select"
                                                    value={filters.sourceType}
                                                    onChange={handleFilterChange}
                                                >
                                                    <option value="">Todos</option>
                                                    {SOURCE_TYPES.map((sourceType) => (
                                                        <option
                                                            key={sourceType.value}
                                                            value={sourceType.value}
                                                        >
                                                            {sourceType.label}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div className="col-6 col-lg-3 col-xl-2">
                                                <label className="form-label">Ciudad</label>
                                                <input
                                                    type="text"
                                                    name="ciudad"
                                                    list="portal-ciudades"
                                                    className="form-control"
                                                    placeholder="Ej: Córdoba"
                                                    value={filters.ciudad}
                                                    onChange={handleFilterChange}
                                                />
                                                <datalist id="portal-ciudades">
                                                    {ciudades.map((ciudad) => (
                                                        <option key={ciudad} value={ciudad} />
                                                    ))}
                                                </datalist>
                                            </div>

                                            <div className="col-6 col-lg-3 col-xl-2">
                                                <label className="form-label">Barrio</label>
                                                <input
                                                    type="text"
                                                    name="barrio"
                                                    list="portal-barrios"
                                                    className="form-control"
                                                    placeholder="Ej: Nueva Córdoba"
                                                    value={filters.barrio}
                                                    onChange={handleFilterChange}
                                                />
                                                <datalist id="portal-barrios">
                                                    {barrios.map((barrio) => (
                                                        <option key={barrio} value={barrio} />
                                                    ))}
                                                </datalist>
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
                                                <label className="form-label">Baños</label>
                                                <select
                                                    name="banosMin"
                                                    className="form-select"
                                                    value={filters.banosMin}
                                                    onChange={handleFilterChange}
                                                >
                                                    <option value="">Cualquiera</option>
                                                    <option value="1">1+</option>
                                                    <option value="2">2+</option>
                                                    <option value="3">3+</option>
                                                    <option value="4">4+</option>
                                                </select>
                                            </div>

                                            <div className="col-6 col-lg-3 col-xl-2">
                                                <label className="form-label">Cocheras</label>
                                                <select
                                                    name="cocherasMin"
                                                    className="form-select"
                                                    value={filters.cocherasMin}
                                                    onChange={handleFilterChange}
                                                >
                                                    <option value="">Cualquiera</option>
                                                    <option value="1">1+</option>
                                                    <option value="2">2+</option>
                                                    <option value="3">3+</option>
                                                    <option value="4">4+</option>
                                                </select>
                                            </div>

                                            <div className="col-6 col-lg-3 col-xl-2">
                                                <label className="form-label">Superficie mín.</label>
                                                <input
                                                    type="number"
                                                    name="superficieMin"
                                                    className="form-control"
                                                    min="0"
                                                    placeholder="100"
                                                    value={filters.superficieMin}
                                                    onChange={handleFilterChange}
                                                />
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

                                            <div className="col-12">
                                                <label className="form-label">Diferenciales</label>

                                                <div className="d-flex flex-wrap gap-3">
                                                    {AMENITY_FILTERS.map((amenityFilter) => (
                                                        <div className="form-check" key={amenityFilter.key}>
                                                            <input
                                                                id={`portal-filter-${amenityFilter.key}`}
                                                                className="form-check-input"
                                                                type="checkbox"
                                                                checked={filters[amenityFilter.key] === "true"}
                                                                onChange={(e) =>
                                                                    handleAmenityFilterChange(
                                                                        amenityFilter.key,
                                                                        e.target.checked,
                                                                    )
                                                                }
                                                            />

                                                            <label
                                                                className="form-check-label"
                                                                htmlFor={`portal-filter-${amenityFilter.key}`}
                                                            >
                                                                {amenityFilter.label}
                                                            </label>
                                                        </div>
                                                    ))}

                                                    <div className="form-check">
                                                        <input
                                                            id="portal-filter-video"
                                                            className="form-check-input"
                                                            type="checkbox"
                                                            checked={filters.video === "true"}
                                                            onChange={(e) =>
                                                                handleAmenityFilterChange(
                                                                    "video",
                                                                    e.target.checked,
                                                                )
                                                            }
                                                        />

                                                        <label
                                                            className="form-check-label"
                                                            htmlFor="portal-filter-video"
                                                        >
                                                            Con video
                                                        </label>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="col-12 col-lg-3 d-grid">
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
                                )}
                            </div>
                        </div>
                    </form>

                    <div
                        id="portal-results"
                        className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4 scroll-mt-portal"
                    >
                        <div>
                            <div className="fw-semibold">
                                {filteredInmuebles.length} coincidencia
                                {filteredInmuebles.length === 1 ? "" : "s"} cargada
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
                                className="btn btn-primary btn-sm"
                                onClick={() => setShowSearchAlert(true)}
                            >
                                Guardar búsqueda
                            </button>

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
                            <div className="fw-semibold mb-1">
                                No encontramos coincidencias entre las publicaciones cargadas.
                            </div>
                            <div className="small">
                                {canLoadMore
                                    ? "Podés cargar más resultados o ampliar los filtros."
                                    : "Probá ampliando los filtros de búsqueda."}
                            </div>
                        </div>
                    )}

                    {!loading && !error && filteredInmuebles.length > 0 && (
                        <section className="row g-4">
                            {filteredInmuebles.map((inmueble) => {
                                const coverImage = getCoverImage(inmueble);
                                const address = buildAddress(inmueble);
                                const detalleUrl =
                                    inmueble.publicPath || `/inmueble/${inmueble.slug || inmueble.id}`;
                                const sourceName = getSourceDisplayName(inmueble);
                                const sourceTypeLabel = getSourceTypeLabel(inmueble);
                                const sourceBadgeClass = getSourceBadgeClass(inmueble);
                                const sourceLogoUrl = getSourceLogoUrl(inmueble);
                                const photoCount = getPhotoCount(inmueble);
                                const visibleVideos = getVisibleInmuebleVideos(inmueble?.videos || []);
                                const videoCount = visibleVideos.length;
                                const hasVideos = videoCount > 0;
                                const featureItems = getInmuebleFeatureBadges(inmueble);
                                const amenityItems = getInmuebleAmenityBadges(inmueble, 4);
                                const shortDescription = getShortDescription(inmueble.descripcion);
                                const isPromoted = isPortalItemPromoted(
                                    inmueble,
                                    rankingConfig,
                                );

                                return (
                                    <article
                                        className="col-12 col-md-6 col-xl-4"
                                        key={`${inmueble.sourceType || "inmobiliaria"}-${inmueble.id}`}
                                    >
                                        <div className="card h-100 shadow-sm border-0 overflow-hidden portal-listing-card">
                                            <div className="position-relative portal-listing-image-wrap">
                                                <Link
                                                    to={detalleUrl}
                                                    state={{ performanceSource: "search" }}
                                                    className="text-decoration-none"
                                                    onClick={saveCurrentSearchUrl}
                                                    aria-label={`Ver ${inmueble.titulo || "publicación"}`}
                                                >
                                                    {coverImage ? (
                                                        <img
                                                            src={coverImage.url}
                                                            alt={inmueble.titulo || "Inmueble publicado"}
                                                            className="card-img-top portal-listing-image"
                                                            loading="lazy"
                                                        />
                                                    ) : (
                                                        <div className="portal-listing-image-empty">
                                                            Sin imagen
                                                        </div>
                                                    )}
                                                </Link>

                                                <div className="position-absolute top-0 start-0 p-3 d-flex flex-wrap gap-2">
                                                    <span className={`badge ${sourceBadgeClass}`}>
                                                        {sourceTypeLabel}
                                                    </span>

                                                    {inmueble.operacion && (
                                                        <span className="badge text-bg-light text-dark border">
                                                            {getOptionLabel(OPERACIONES, inmueble.operacion)}
                                                        </span>
                                                    )}

                                                    {inmueble.tipo && (
                                                        <span className="badge text-bg-dark">
                                                            {getOptionLabel(TIPOS, inmueble.tipo)}
                                                        </span>
                                                    )}
                                                </div>

                                                {isPromoted && (
                                                    <div className="position-absolute top-0 end-0 p-3">
                                                        <span className="badge text-bg-warning">
                                                            ★ Destacado
                                                        </span>
                                                    </div>
                                                )}

                                                {hasVideos && (
                                                    <div className="position-absolute bottom-0 start-0 p-3">
                                                        <span className="badge text-bg-danger shadow-sm">
                                                            🎥 {videoCount} video{videoCount === 1 ? "" : "s"}
                                                        </span>
                                                    </div>
                                                )}

                                                {photoCount > 0 && (
                                                    <div className="position-absolute bottom-0 end-0 p-3">
                                                        <span className="badge text-bg-dark bg-opacity-75">
                                                            {photoCount} foto{photoCount === 1 ? "" : "s"}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="card-body d-flex flex-column p-4">
                                                <button
                                                    type="button"
                                                    className="publisher-profile-trigger d-flex align-items-center gap-2 mb-3 pb-3 border-bottom w-100 text-start"
                                                    onClick={() => setSelectedPublisher(
                                                        getPortalPublisherDescriptor(inmueble),
                                                    )}
                                                    aria-label={`Ver información sobre ${sourceName}`}
                                                >
                                                    {sourceLogoUrl ? (
                                                        <img
                                                            src={sourceLogoUrl}
                                                            alt={sourceName}
                                                            className="portal-source-avatar"
                                                            loading="lazy"
                                                        />
                                                    ) : (
                                                        <div className="portal-source-avatar portal-source-avatar-fallback">
                                                            {getSourceInitial(sourceName)}
                                                        </div>
                                                    )}

                                                    <div className="min-w-0">
                                                        <div className="small text-muted lh-sm">
                                                            Publicado por
                                                        </div>
                                                        <div className="fw-semibold small text-truncate">
                                                            {sourceName}
                                                        </div>
                                                    </div>
                                                </button>

                                                {hasVideos && (
                                                    <div className="d-flex flex-wrap gap-2 mb-2">
                                                        <span className="badge text-bg-danger">🎥 Tiene video</span>
                                                    </div>
                                                )}

                                                <div className="d-flex align-items-start gap-2 mb-2">
                                                    <Link
                                                        to={detalleUrl}
                                                        state={{ performanceSource: "search" }}
                                                        className="text-decoration-none text-dark flex-grow-1"
                                                        onClick={saveCurrentSearchUrl}
                                                    >
                                                        <h2 className="h5 mb-0 portal-listing-title">
                                                            {inmueble.titulo || "Inmueble publicado"}
                                                        </h2>
                                                    </Link>
                                                    <PortalFavoriteButton
                                                        item={inmueble}
                                                        compact
                                                        performanceSource="search"
                                                    />
                                                </div>

                                                {address && (
                                                    <p className="text-muted small mb-2">📍 {address}</p>
                                                )}

                                                <div className="h4 mb-3 portal-listing-price">
                                                    {formatPrice(inmueble)}
                                                </div>

                                                {featureItems.length > 0 && (
                                                    <div className="d-flex flex-wrap gap-2 small text-muted mb-3">
                                                        {featureItems.map((item) => (
                                                            <span
                                                                className="border rounded-pill px-2 py-1 bg-light"
                                                                key={item.key}
                                                            >
                                                                {item.label}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}

                                                {amenityItems.length > 0 && (
                                                    <div className="d-flex flex-wrap gap-2 small mb-3">
                                                        {amenityItems.map((item) => (
                                                            <span
                                                                className="badge text-bg-light border text-dark"
                                                                key={item.key}
                                                            >
                                                                {item.label}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}

                                                {shortDescription && (
                                                    <p className="text-muted small mb-4">
                                                        {shortDescription}
                                                    </p>
                                                )}

                                                <div className="mt-auto d-grid gap-2">
                                                    <Link
                                                        to={detalleUrl}
                                                        state={{ performanceSource: "search" }}
                                                        className="btn btn-primary"
                                                        onClick={saveCurrentSearchUrl}
                                                    >
                                                        {hasVideos
                                                            ? "Ver video y detalle"
                                                            : inmueble.sourceType === "particular"
                                                                ? "Ver publicación"
                                                                : "Ver inmueble"}
                                                    </Link>

                                                    {inmueble.sourceType === "inmobiliaria" &&
                                                        inmueble.inmobiliariaSlug && (
                                                            <Link
                                                                to={`/inmobiliaria/${inmueble.inmobiliariaSlug}`}
                                                                className="btn btn-outline-secondary btn-sm"
                                                            >
                                                                Ver inmobiliaria
                                                            </Link>
                                                        )}
                                                </div>
                                            </div>
                                        </div>
                                    </article>
                                );
                            })}
                        </section>
                    )}

                    {!loading && canLoadMore && (
                        <div className="text-center mt-4">
                            <button
                                type="button"
                                className="btn btn-outline-primary btn-lg px-5"
                                onClick={handleLoadMore}
                                disabled={loadingMore}
                            >
                                {loadingMore ? "Cargando..." : "Cargar más inmuebles"}
                            </button>
                            <div className="small text-muted mt-2">
                                Solo se consultan nuevas publicaciones; las anteriores no se
                                vuelven a descargar.
                            </div>
                        </div>
                    )}

                    {loadMoreError && (
                        <div className="alert alert-warning mt-3 mb-0">
                            {loadMoreError}
                        </div>
                    )}
                </div>
            </section>
            <PublicProfileModal
                publisher={selectedPublisher}
                onClose={() => setSelectedPublisher(null)}
            />
            <PortalSearchAlertModal
                open={showSearchAlert}
                filters={filters}
                onClose={() => setShowSearchAlert(false)}
            />
        </main>
    );
};

export default InmueblePortalPage;
