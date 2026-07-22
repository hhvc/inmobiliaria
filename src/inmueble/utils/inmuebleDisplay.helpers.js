import { AMENITIES_LABELS } from "./inmuebleDetailsSchema";

const toNumber = (value) => {
    const number = Number(value);

    return Number.isFinite(number) ? number : null;
};

export const getInmuebleCaracteristicas = (inmueble = {}) => {
    return inmueble.caracteristicas && typeof inmueble.caracteristicas === "object"
        ? inmueble.caracteristicas
        : {};
};

export const getInmuebleSuperficie = (inmueble = {}) => {
    return inmueble.superficie && typeof inmueble.superficie === "object"
        ? inmueble.superficie
        : {};
};

export const getInmuebleAmenities = (inmueble = {}) => {
    return inmueble.amenities && typeof inmueble.amenities === "object"
        ? inmueble.amenities
        : {};
};

export const getInmuebleServicios = (inmueble = {}) => {
    return inmueble.servicios && typeof inmueble.servicios === "object"
        ? inmueble.servicios
        : {};
};

export const getDormitorios = (inmueble = {}) => {
    const caracteristicas = getInmuebleCaracteristicas(inmueble);

    return caracteristicas.dormitorios || inmueble.dormitorios || "";
};

export const getBanos = (inmueble = {}) => {
    const caracteristicas = getInmuebleCaracteristicas(inmueble);

    return caracteristicas.banos || inmueble.banos || inmueble.banios || "";
};

export const getAmbientes = (inmueble = {}) => {
    const caracteristicas = getInmuebleCaracteristicas(inmueble);

    return caracteristicas.ambientes || inmueble.ambientes || "";
};

export const getCocherasCantidad = (inmueble = {}) => {
    const caracteristicas = getInmuebleCaracteristicas(inmueble);

    return caracteristicas.cocherasCantidad || inmueble.cocheras || "";
};

export const hasCochera = (inmueble = {}) => {
    const caracteristicas = getInmuebleCaracteristicas(inmueble);

    return Boolean(
        caracteristicas.cocheras ||
        caracteristicas.cocherasCantidad ||
        inmueble.cocheras,
    );
};

export const getSuperficiePrincipal = (inmueble = {}) => {
    const superficie = getInmuebleSuperficie(inmueble);

    return (
        superficie.cubierta ||
        superficie.total ||
        superficie.terreno ||
        superficie.descubierta ||
        ""
    );
};

export const getSuperficiePrincipalLabel = (inmueble = {}) => {
    const superficie = getInmuebleSuperficie(inmueble);

    if (superficie.cubierta) return `${superficie.cubierta} m² cub.`;
    if (superficie.total) return `${superficie.total} m² tot.`;
    if (superficie.terreno) return `${superficie.terreno} m² terreno`;
    if (superficie.descubierta) return `${superficie.descubierta} m² desc.`;

    return "";
};

export const getInmuebleFeatureBadges = (inmueble = {}) => {
    const items = [];

    const ambientes = getAmbientes(inmueble);
    const dormitorios = getDormitorios(inmueble);
    const banos = getBanos(inmueble);
    const cocherasCantidad = getCocherasCantidad(inmueble);
    const superficieLabel = getSuperficiePrincipalLabel(inmueble);

    if (ambientes) {
        items.push({
            key: "ambientes",
            label: `${ambientes} amb.`,
            value: toNumber(ambientes),
        });
    }

    if (dormitorios) {
        items.push({
            key: "dormitorios",
            label: `${dormitorios} dorm.`,
            value: toNumber(dormitorios),
        });
    }

    if (banos) {
        items.push({
            key: "banos",
            label: `${banos} baño${Number(banos) === 1 ? "" : "s"}`,
            value: toNumber(banos),
        });
    }

    if (cocherasCantidad) {
        items.push({
            key: "cocheras",
            label: `${cocherasCantidad} coch.`,
            value: toNumber(cocherasCantidad),
        });
    } else if (hasCochera(inmueble)) {
        items.push({
            key: "cocheras",
            label: "Con cochera",
            value: 1,
        });
    }

    if (superficieLabel) {
        items.push({
            key: "superficie",
            label: superficieLabel,
            value: toNumber(getSuperficiePrincipal(inmueble)),
        });
    }

    return items;
};

export const getInmuebleAmenityBadges = (inmueble = {}, maxItems = 5) => {
    const amenities = getInmuebleAmenities(inmueble);

    return Object.entries(amenities)
        .filter(([, value]) => Boolean(value))
        .map(([key]) => ({
            key,
            label: AMENITIES_LABELS[key] || key,
        }))
        .slice(0, maxItems);
};

export const inmuebleHasAmenity = (inmueble = {}, amenityKey = "") => {
    const amenities = getInmuebleAmenities(inmueble);

    return Boolean(amenities?.[amenityKey]);
};