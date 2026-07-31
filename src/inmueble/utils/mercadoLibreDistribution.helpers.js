const normalizeText = (value = "") => {
    return value.toString().trim().replace(/\s+/g, " ");
};

const toNumberOrNull = (value) => {
    if (value === null || value === undefined || value === "") return null;

    if (typeof value === "number") {
        return Number.isFinite(value) ? value : null;
    }

    let normalized = value.toString().trim().replace(/[^\d,.-]/g, "");

    if (normalized.includes(",") && normalized.includes(".")) {
        normalized = normalized.replace(/\./g, "").replace(",", ".");
    } else if (normalized.includes(",")) {
        normalized = normalized.replace(",", ".");
    }

    const parsed = Number(normalized);

    return Number.isFinite(parsed) ? parsed : null;
};

const buildDescription = (inmueble = {}, publicUrl = "") => {
    return [
        normalizeText(inmueble.titulo || ""),
        "",
        normalizeText(inmueble.descripcion || ""),
        "",
        publicUrl ? `Ficha pública: ${publicUrl}` : "",
    ]
        .filter(Boolean)
        .join("\n");
};

const getImages = (inmueble = {}) => {
    if (!Array.isArray(inmueble.images)) return [];

    return [...inmueble.images]
        .filter((image) => image?.url)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((image) => image.url);
};

const getDireccion = (inmueble = {}) => {
    const direccion = inmueble.direccion || {};

    return {
        provincia: inmueble.provincia || direccion.provincia || "",
        ciudad: inmueble.ciudad || direccion.ciudad || "",
        barrio: inmueble.barrio || direccion.barrio || "",
        calle: inmueble.calle || direccion.calle || "",
        numero: inmueble.numero || direccion.numero || "",
        codigoPostal:
            inmueble.codigoPostal ||
            inmueble.zipCode ||
            direccion.codigoPostal ||
            direccion.zipCode ||
            "",
    };
};

const normalizeComparableText = (value = "") => {
    return normalizeText(value)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLocaleLowerCase("es");
};

export const findMercadoLibreOptionByName = (options = [], value = "") => {
    const normalizedValue = normalizeComparableText(value);
    if (!normalizedValue || !Array.isArray(options)) return null;

    return (
        options.find(
            (option) =>
                normalizeComparableText(option?.name) === normalizedValue,
        ) || null
    );
};

export const buildMercadoLibreLocationDefaults = (
    inmueble = {},
    savedLocation = {},
) => {
    const direccion = getDireccion(inmueble);

    return {
        addressLine:
            normalizeText(savedLocation.addressLine || "") ||
            [direccion.calle, direccion.numero].filter(Boolean).join(" "),
        zipCode:
            normalizeText(savedLocation.zipCode || "") ||
            normalizeText(direccion.codigoPostal || ""),
        stateId: normalizeText(savedLocation.stateId || ""),
        cityId: normalizeText(savedLocation.cityId || ""),
        neighborhoodId: normalizeText(savedLocation.neighborhoodId || ""),
        latitude:
            savedLocation.latitude ??
            inmueble.latitude ??
            inmueble.latitud ??
            "",
        longitude:
            savedLocation.longitude ??
            inmueble.longitude ??
            inmueble.longitud ??
            "",
    };
};

const getCaracteristicas = (inmueble = {}) => {
    return inmueble.caracteristicas && typeof inmueble.caracteristicas === "object"
        ? inmueble.caracteristicas
        : {};
};

const getSuperficie = (inmueble = {}) => {
    return inmueble.superficie && typeof inmueble.superficie === "object"
        ? inmueble.superficie
        : {};
};

const buildCandidateAttribute = (id, valueName) => {
    if (valueName === null || valueName === undefined || valueName === "") {
        return null;
    }

    return {
        id,
        value_name: valueName.toString(),
    };
};

export const buildMercadoLibreDraftPayload = ({
    inmueble = {},
    categoryId = "",
    listingTypeId = "silver",
    publicUrl = "",
    mercadoLibreLocation = {},
    mercadoLibreContact = {},
    videoId = "",
} = {}) => {
    const images = getImages(inmueble);
    const direccion = getDireccion(inmueble);
    const caracteristicas = getCaracteristicas(inmueble);
    const superficie = getSuperficie(inmueble);

    const price = toNumberOrNull(inmueble.precio);

    const dormitorios =
        caracteristicas.dormitorios || inmueble.dormitorios || "";

    const banos =
        caracteristicas.banos || inmueble.banos || inmueble.banios || "";

    const ambientes =
        caracteristicas.ambientes || inmueble.ambientes || "";

    const cocheras =
        caracteristicas.cocherasCantidad || inmueble.cocheras || "";

    const superficieCubierta =
        superficie.cubierta || inmueble.superficieCubierta || "";

    const superficieTotal =
        superficie.total || inmueble.superficieTotal || "";

    const candidateAttributes = [
        buildCandidateAttribute("ROOMS", ambientes),
        buildCandidateAttribute("BEDROOMS", dormitorios),
        buildCandidateAttribute("FULL_BATHROOMS", banos),
        buildCandidateAttribute("PARKING_LOTS", cocheras),
        buildCandidateAttribute(
            "COVERED_AREA",
            superficieCubierta ? `${superficieCubierta} m²` : "",
        ),
        buildCandidateAttribute(
            "TOTAL_AREA",
            superficieTotal ? `${superficieTotal} m²` : "",
        ),
    ].filter(Boolean);

    const location = {
        address_line:
            mercadoLibreLocation.addressLine ||
            [direccion.calle, direccion.numero].filter(Boolean).join(" "),
        zip_code: mercadoLibreLocation.zipCode || "",
        ...(mercadoLibreLocation.stateId
            ? { state: { id: mercadoLibreLocation.stateId } }
            : direccion.provincia
                ? { state: { name: direccion.provincia } }
                : {}),
        ...(mercadoLibreLocation.cityId
            ? { city: { id: mercadoLibreLocation.cityId } }
            : direccion.ciudad
                ? { city: { name: direccion.ciudad } }
                : {}),
        ...(mercadoLibreLocation.neighborhoodId
            ? { neighborhood: { id: mercadoLibreLocation.neighborhoodId } }
            : direccion.barrio
                ? { neighborhood: { name: direccion.barrio } }
                : {}),
    };

    const latitude = toNumberOrNull(mercadoLibreLocation.latitude);
    const longitude = toNumberOrNull(mercadoLibreLocation.longitude);
    if (latitude !== null && longitude !== null) {
        location.latitude = latitude;
        location.longitude = longitude;
    }

    const payload = {
        title: normalizeText(inmueble.titulo || "").slice(0, 60),
        category_id: categoryId || "",
        price,
        currency_id: inmueble.moneda || "USD",
        available_quantity: 1,
        buying_mode: "classified",
        listing_type_id: listingTypeId,
        condition: "not_specified",
        channels: ["marketplace"],
        pictures: images.map((source) => ({ source })),
        seller_contact: {
            contact: mercadoLibreContact.name || "",
            other_info: "",
            area_code: mercadoLibreContact.areaCode || "",
            phone: mercadoLibreContact.phone || "",
            area_code2: "",
            phone2: "",
            email: mercadoLibreContact.email || "",
            webmail: "",
        },
        location,
        attributes: candidateAttributes,
        description: {
            plain_text: buildDescription(inmueble, publicUrl),
        },
    };

    if (videoId) payload.video_id = videoId;
    return payload;
};

export const validateMercadoLibreDraft = ({
    inmueble = {},
    categoryId = "",
} = {}) => {
    const errors = [];
    const warnings = [];
    const images = getImages(inmueble);
    const direccion = getDireccion(inmueble);
    const price = toNumberOrNull(inmueble.precio);
    const description = normalizeText(inmueble.descripcion || "");

    if (!categoryId) {
        errors.push("Falta category_id final de Mercado Libre.");
    }

    if (!inmueble.titulo || normalizeText(inmueble.titulo).length < 8) {
        errors.push("Falta un título suficientemente descriptivo.");
    }

    if (!inmueble.operacion) {
        errors.push("Falta operación.");
    }

    if (!inmueble.tipo) {
        errors.push("Falta tipo de inmueble.");
    }

    if (!description || description.length < 40) {
        errors.push("La descripción es demasiado corta.");
    }

    if (!price || price <= 0) {
        errors.push("No tiene precio válido cargado.");
    }

    if (images.length === 0) {
        errors.push("Mercado Libre requiere fotos para una publicación competitiva.");
    }

    if (images.length > 0 && images.length < 3) {
        warnings.push("Conviene cargar al menos 3 imágenes para Mercado Libre.");
    }

    if (!direccion.provincia) {
        warnings.push("Conviene cargar provincia.");
    }

    if (!direccion.ciudad && !direccion.barrio) {
        errors.push("Falta ubicación mínima.");
    }

    warnings.push("Validá categoría y atributos obligatorios con Mercado Libre.");

    return {
        isReady: errors.length === 0,
        errors,
        warnings,
    };
};
