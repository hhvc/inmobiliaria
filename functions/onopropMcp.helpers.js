const ONOPROP_BASE_URL = "https://onoprop.com";
const ONOPROP_MCP_CAMPAIGN = "onoprop_mcp";

export const buildTrackedOnopropUrl = (pathname = "/", content = "") => {
    const url = new URL(pathname, ONOPROP_BASE_URL);
    url.searchParams.set("utm_source", "chatgpt");
    url.searchParams.set("utm_medium", "plugin");
    url.searchParams.set("utm_campaign", ONOPROP_MCP_CAMPAIGN);
    if (content) url.searchParams.set("utm_content", cleanMcpText(content, 80));
    return url.toString();
};

const OPERATION_LABELS = Object.freeze({
    venta: "Venta",
    alquiler: "Alquiler",
    alquiler_temporal: "Alquiler temporal",
});

const PROPERTY_TYPE_LABELS = Object.freeze({
    casa: "Casa",
    departamento: "Departamento",
    terreno: "Terreno",
    local: "Local",
    oficina: "Oficina",
    cochera: "Cochera",
    deposito: "Depósito",
    quinta: "Quinta",
    campo: "Campo",
});

export const cleanMcpText = (value = "", maxLength = 4000) => value
    .toString()
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);

const CONTACT_PLACEHOLDER = "[dato de contacto disponible en la ficha]";

const redactPhoneCandidate = (value = "") => {
    const digits = value.replace(/\D/g, "");
    return digits.length >= 8 && digits.length <= 15
        ? CONTACT_PLACEHOLDER
        : value;
};

export const redactMcpContactDetails = (value = "", maxLength = 4000) => {
    const source = cleanMcpText(value, Math.max(maxLength * 2, 8000));
    const redacted = source
        .replace(
            /https?:\/\/(?:wa\.me|api\.whatsapp\.com|chat\.whatsapp\.com)\/\S+/gi,
            CONTACT_PLACEHOLDER,
        )
        .replace(
            /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
            CONTACT_PLACEHOLDER,
        )
        .replace(/\+[\d\s().-]{7,}\d/g, redactPhoneCandidate)
        .replace(/\b(?:\d[\s().-]*){10,15}\b/g, redactPhoneCandidate)
        .replace(
            /\b(tel(?:eacute;|é)?fono|tel\.?|celular|cel\.?|whatsapp|wsp)\s*[:.-]?\s*(?:\d[\d\s().-]{6,}\d)/gi,
            (_match, label) => `${label}: ${CONTACT_PLACEHOLDER}`,
        )
        .replace(
            /(?:\s*\[dato de contacto disponible en la ficha\]){2,}/g,
            ` ${CONTACT_PLACEHOLDER}`,
        );

    return cleanMcpText(redacted, maxLength);
};

export const normalizeMcpText = (value = "") => cleanMcpText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const toFiniteNumber = (value) => {
    if (value === null || value === undefined || value === "") return null;
    if (typeof value === "number") return Number.isFinite(value) ? value : null;

    let normalized = value.toString().trim().replace(/[^\d,.-]/g, "");
    if (!normalized) return null;

    const commaIndex = normalized.lastIndexOf(",");
    const dotIndex = normalized.lastIndexOf(".");

    if (commaIndex >= 0 && dotIndex >= 0) {
        const decimalSeparator = commaIndex > dotIndex ? "," : ".";
        const thousandsSeparator = decimalSeparator === "," ? "." : ",";
        normalized = normalized.split(thousandsSeparator).join("");
        normalized = normalized.replace(decimalSeparator, ".");
    } else if (commaIndex >= 0) {
        const decimalDigits = normalized.length - commaIndex - 1;
        normalized = decimalDigits === 3
            ? normalized.replace(/,/g, "")
            : normalized.replace(",", ".");
    } else if (dotIndex >= 0) {
        const dotCount = (normalized.match(/\./g) || []).length;
        const decimalDigits = normalized.length - dotIndex - 1;
        if (dotCount > 1 || decimalDigits === 3) {
            normalized = normalized.replace(/\./g, "");
        }
    }

    const number = Number(normalized);
    return Number.isFinite(number) ? number : null;
};

const normalizeCurrency = (value = "") => {
    const normalized = normalizeMcpText(value).toUpperCase();
    if (!normalized) return "";
    if (["$", "ARS", "PESO", "PESOS"].includes(normalized)) return "ARS";
    if (["U$S", "US$", "USD", "DOLAR", "DOLARES"].includes(normalized)) {
        return "USD";
    }
    return normalized.slice(0, 12);
};

const getAddressValue = (listing = {}, key) => (
    listing?.direccion?.[key] ?? listing?.[key] ?? ""
);

const firstFiniteNumber = (...values) => {
    for (const value of values) {
        const number = toFiniteNumber(value);
        if (number !== null) return number;
    }
    return null;
};

const normalizeGeoName = (value = "") => normalizeMcpText(value)
    .replace(/[.,;:/_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const withoutGeoPrefix = (value = "") => normalizeGeoName(value)
    .replace(/^(?:la )?provincia (?:de )?/, "")
    .replace(/^(?:la )?ciudad (?:de )?/, "")
    .replace(/^barrio /, "")
    .trim();

const canonicalCityName = (value = "") => {
    const normalized = withoutGeoPrefix(value);
    if ([
        "cordoba",
        "cordoba capital",
        "capital",
        "capital de cordoba",
    ].includes(normalized)) {
        return "cordoba";
    }
    return normalized;
};

const splitFreeformLocation = (value = "") => cleanMcpText(value, 240)
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

const inferKnownCityCorrection = (listing = {}, city = "") => {
    if (canonicalCityName(city) !== "cordoba") return "";

    const neighborhood = withoutGeoPrefix(getAddressValue(listing, "barrio"));
    const title = normalizeGeoName(listing.titulo || listing.title);
    const identifiesCarlosPaz = ["carlos paz", "villa carlos paz"].includes(
        neighborhood,
    ) || /\b(?:centro|zona centrica|departamento|dpto) (?:de|en) (?:villa )?carlos paz\b/
        .test(title);

    return identifiesCarlosPaz ? "Villa Carlos Paz" : "";
};

const buildLocationMetadata = (listing = {}, source = "agency") => {
    const freeformParts = splitFreeformLocation(listing.ubicacion);
    const explicitCity = getAddressValue(listing, "ciudad") ||
        listing.localidad;
    const explicitProvince = getAddressValue(listing, "provincia");
    const canInferFreeform = source === "particular" &&
        !explicitCity && freeformParts.length > 0;
    const correctedCity = inferKnownCityCorrection(listing, explicitCity);

    return {
        location_neighborhood: cleanMcpText(
            getAddressValue(listing, "barrio") || (
                canInferFreeform && freeformParts.length >= 3
                    ? freeformParts.at(-3)
                    : ""
            ),
            120,
        ),
        location_city: cleanMcpText(
            correctedCity || explicitCity || (canInferFreeform
                ? freeformParts.at(freeformParts.length >= 2 ? -2 : -1)
                : ""),
            120,
        ),
        location_province: cleanMcpText(
            explicitProvince || (
                canInferFreeform && freeformParts.length >= 2
                    ? freeformParts.at(-1)
                    : ""
            ),
            120,
        ),
        location_street: cleanMcpText(
            getAddressValue(listing, "calle"),
            160,
        ),
        location_number: cleanMcpText(
            getAddressValue(listing, "numero"),
            40,
        ),
    };
};

export const buildPublicLocation = (listing = {}, source = "agency") => {
    if (source === "particular") {
        return cleanMcpText(
            listing.ubicacion || [
                getAddressValue(listing, "barrio"),
                getAddressValue(listing, "ciudad") || listing.localidad,
                getAddressValue(listing, "provincia"),
            ].filter(Boolean).join(", "),
            240,
        ) || "Ubicación a consultar";
    }

    const approximate = listing?.direccion?.precisionMapa !== "precisa";
    const parts = approximate
        ? [
            getAddressValue(listing, "barrio"),
            getAddressValue(listing, "ciudad") || listing.localidad,
            getAddressValue(listing, "provincia"),
        ]
        : [
            getAddressValue(listing, "calle"),
            getAddressValue(listing, "numero"),
            getAddressValue(listing, "barrio"),
            getAddressValue(listing, "ciudad") || listing.localidad,
            getAddressValue(listing, "provincia"),
        ];

    return cleanMcpText(parts.filter(Boolean).join(", "), 240) ||
        cleanMcpText(listing.ubicacion, 240) ||
        "Ubicación a consultar";
};

const getImageUrl = (listing = {}) => {
    if (!Array.isArray(listing.images)) return "";
    const image = [...listing.images]
        .filter((item) => item?.url || item?.thumbnailUrl)
        .sort((a, b) => Number(a?.order || 0) - Number(b?.order || 0))[0];
    return cleanMcpText(image?.thumbnailUrl || image?.url || "", 1000);
};

const getSurface = (listing = {}) => toFiniteNumber(
    listing?.superficie?.total ??
    listing?.superficie?.terreno ??
    listing.superficieTotal ??
    listing.superficieTerreno,
);

const getTimestamp = (value) => {
    if (!value) return 0;
    if (typeof value.toMillis === "function") return value.toMillis();
    if (value instanceof Date) return value.getTime();
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
};

const sanitizeMcpTitle = (value = "") => cleanMcpText(
    redactMcpContactDetails(value, 240)
        .split(CONTACT_PLACEHOLDER)
        .join(" ")
        .replace(/[\s|,;:/-]+$/g, ""),
    240,
);

const buildPropertyTitle = (listing = {}) => {
    const explicitTitle = sanitizeMcpTitle(listing.titulo || listing.title);
    if (explicitTitle) return explicitTitle;

    const operation = OPERATION_LABELS[listing.operacion] || "Inmueble";
    const type = PROPERTY_TYPE_LABELS[listing.tipo] || "propiedad";
    return `${operation} de ${type.toLowerCase()} en ${listing.location}`;
};

export const mapAgencyListingForMcp = ({
    id,
    agencyId,
    listing = {},
    agency = {},
} = {}) => {
    const slug = cleanMcpText(listing.slug || id, 180);
    const location = buildPublicLocation(listing, "agency");
    const price = toFiniteNumber(listing.precio);
    const currency = normalizeCurrency(listing.moneda || "USD") || "USD";
    const locationMetadata = buildLocationMetadata(listing, "agency");

    const result = {
        id: `agency:${cleanMcpText(agencyId, 128)}:${cleanMcpText(id, 128)}`,
        title: "",
        url: buildTrackedOnopropUrl(
            `/inmueble/${encodeURIComponent(slug)}`,
            "property_listing",
        ),
        description: redactMcpContactDetails(listing.descripcion, 4000),
        operation: cleanMcpText(listing.operacion, 40),
        operation_label: OPERATION_LABELS[listing.operacion] || cleanMcpText(
            listing.operacion,
            80,
        ),
        property_type: cleanMcpText(listing.tipo, 40),
        property_type_label: PROPERTY_TYPE_LABELS[listing.tipo] || cleanMcpText(
            listing.tipo,
            80,
        ),
        location,
        ...locationMetadata,
        price,
        currency,
        bedrooms: firstFiniteNumber(
            listing?.caracteristicas?.dormitorios,
            listing.dormitorios,
        ),
        bathrooms: firstFiniteNumber(
            listing?.caracteristicas?.banos,
            listing.banos,
            listing.banios,
        ),
        parking_spaces: firstFiniteNumber(
            listing?.caracteristicas?.cocherasCantidad,
            listing.cocheras,
        ),
        total_area_m2: getSurface(listing),
        source: "inmobiliaria",
        publisher_name: cleanMcpText(
            listing.inmobiliariaNombre ||
            listing.inmobiliariaDisplayName ||
            agency.nombre ||
            agency.razonSocial ||
            "Inmobiliaria adherida",
            180,
        ),
        image_url: getImageUrl(listing),
        updated_at_ms: getTimestamp(listing.updatedAt || listing.createdAt),
    };
    result.title = buildPropertyTitle({ ...listing, location });
    return result;
};

export const mapParticularListingForMcp = ({ id, listing = {} } = {}) => {
    const location = buildPublicLocation(listing, "particular");
    const price = toFiniteNumber(listing.precio ?? listing.precioEstimado);
    const currency = normalizeCurrency(listing.moneda);
    const locationMetadata = buildLocationMetadata(listing, "particular");
    const result = {
        id: `particular:${cleanMcpText(id, 128)}`,
        title: "",
        url: buildTrackedOnopropUrl(
            `/particulares/${encodeURIComponent(id)}`,
            "property_listing",
        ),
        description: redactMcpContactDetails(listing.descripcion, 4000),
        operation: cleanMcpText(listing.operacion, 40),
        operation_label: OPERATION_LABELS[listing.operacion] || cleanMcpText(
            listing.operacion,
            80,
        ),
        property_type: cleanMcpText(listing.tipo, 40),
        property_type_label: PROPERTY_TYPE_LABELS[listing.tipo] || cleanMcpText(
            listing.tipo,
            80,
        ),
        location,
        ...locationMetadata,
        price,
        currency,
        bedrooms: firstFiniteNumber(
            listing?.caracteristicas?.dormitorios,
            listing.dormitorios,
        ),
        bathrooms: firstFiniteNumber(
            listing?.caracteristicas?.banos,
            listing.banos,
            listing.banios,
        ),
        parking_spaces: firstFiniteNumber(
            listing?.caracteristicas?.cocherasCantidad,
            listing.cocheras,
        ),
        total_area_m2: getSurface(listing),
        source: "particular",
        publisher_name: "Particular verificado por ONO Prop",
        image_url: getImageUrl(listing),
        updated_at_ms: getTimestamp(listing.updatedAt || listing.createdAt),
    };
    result.title = buildPropertyTitle({ ...listing, location });
    return result;
};

const getSearchScore = (property = {}, filters = {}) => {
    const queryTokens = normalizeMcpText(filters.query)
        .split(/\s+/)
        .filter((token) => token.length >= 2);
    if (queryTokens.length === 0) return 0;

    const title = normalizeMcpText(property.title);
    const location = normalizeMcpText(property.location);
    const type = normalizeMcpText(property.property_type_label);
    const operation = normalizeMcpText(property.operation_label);
    const description = normalizeMcpText(property.description);

    return queryTokens.reduce((score, token) => {
        if (title.includes(token)) score += 8;
        if (location.includes(token)) score += 7;
        if (type.includes(token)) score += 5;
        if (operation.includes(token)) score += 5;
        if (description.includes(token)) score += 2;
        return score;
    }, 0);
};

const looselyMatchesGeoName = (value = "", target = "") => {
    if (!value || !target) return false;
    if (value === target) return true;
    if (target.length < 4 || value.length < 4) return false;
    return value.includes(target) || target.includes(value);
};

const resolveLocationRequest = (filters = {}) => {
    const rawLocation = normalizeGeoName(filters.location);
    let scope = filters.location_scope || "auto";

    if (scope === "auto") {
        if (/^(?:la )?provincia (?:de )?/.test(rawLocation)) {
            scope = "province";
        } else if (/^(?:la )?ciudad (?:de )?/.test(rawLocation)) {
            scope = "city";
        } else if (/^barrio /.test(rawLocation)) {
            scope = "neighborhood";
        } else if (canonicalCityName(rawLocation) === "cordoba") {
            scope = "city";
        }
    }

    return {
        target: withoutGeoPrefix(rawLocation),
        scope,
    };
};

const matchesPropertyLocation = (property = {}, filters = {}) => {
    if (!filters.location) return true;

    const { target, scope } = resolveLocationRequest(filters);
    if (!target) return true;

    const city = canonicalCityName(property.location_city);
    const province = withoutGeoPrefix(property.location_province);
    const neighborhood = withoutGeoPrefix(property.location_neighborhood);
    const targetCity = canonicalCityName(target);

    if (scope === "province") {
        return looselyMatchesGeoName(province, target);
    }
    if (scope === "city") {
        return looselyMatchesGeoName(city, targetCity);
    }
    if (scope === "neighborhood") {
        return looselyMatchesGeoName(neighborhood, target);
    }

    if (looselyMatchesGeoName(city, targetCity) ||
        looselyMatchesGeoName(neighborhood, target)) {
        return true;
    }

    const hasStructuredLocation = Boolean(city || province || neighborhood);
    return !hasStructuredLocation && normalizeGeoName(
        property.location,
    ).includes(target);
};

const keepUniquePropertyRecords = (properties = []) => properties.reduce(
    (unique, property) => {
        if (!unique.some((candidate) => candidate.id === property.id)) {
            unique.push(property);
        }
        return unique;
    },
    [],
);

export const filterAndRankMcpProperties = (properties = [], filters = {}) => {
    const currency = normalizeCurrency(filters.currency);
    const minPrice = toFiniteNumber(filters.min_price);
    const maxPrice = toFiniteNumber(filters.max_price);
    const minBedrooms = toFiniteNumber(filters.min_bedrooms);
    const maxResults = Math.min(Math.max(Number(filters.limit) || 10, 1), 20);

    let ranked = properties
        .map((property) => ({
            ...property,
            search_score: getSearchScore(property, filters),
        }))
        .filter((property) => !filters.operation || (
            property.operation === filters.operation
        ))
        .filter((property) => !filters.property_type || (
            property.property_type === filters.property_type
        ))
        .filter((property) => !filters.source || filters.source === "all" || (
            property.source === filters.source
        ))
        .filter((property) => matchesPropertyLocation(property, filters))
        .filter((property) => !currency || property.currency === currency)
        .filter((property) => minPrice === null || (
            property.price !== null && property.price >= minPrice
        ))
        .filter((property) => maxPrice === null || (
            property.price !== null && property.price <= maxPrice
        ))
        .filter((property) => !normalizeMcpText(filters.query) || (
            property.search_score > 0
        ));

    if (minBedrooms !== null) {
        const bedroomCandidates = ranked.filter((property) => (
            property.bedrooms !== null && property.bedrooms >= minBedrooms
        ));
        const exactMatches = bedroomCandidates.filter((property) => (
            property.bedrooms === minBedrooms
        ));
        const minimumMode = filters.bedroom_search_mode === "minimum";

        if (minimumMode) {
            ranked = bedroomCandidates.map((property) => ({
                ...property,
                bedroom_match: property.bedrooms === minBedrooms
                    ? "exact"
                    : "minimum",
                bedroom_target: minBedrooms,
                bedroom_price_ceiling: null,
                bedroom_priority: 0,
            }));
        } else if (exactMatches.length === 0) {
            ranked = bedroomCandidates.map((property) => ({
                ...property,
                bedroom_match: "alternative",
                bedroom_target: minBedrooms,
                bedroom_price_ceiling: null,
                bedroom_priority: 0,
            }));
        } else {
            const priceCeilingsByCurrency = exactMatches.reduce((ceilings, property) => {
                if (property.price === null) return ceilings;
                const previous = ceilings.get(property.currency);
                if (previous === undefined || property.price > previous) {
                    ceilings.set(property.currency, property.price);
                }
                return ceilings;
            }, new Map());

            ranked = bedroomCandidates
                .filter((property) => {
                    if (property.bedrooms === minBedrooms) return true;
                    const ceiling = priceCeilingsByCurrency.get(property.currency);
                    return property.price !== null && ceiling !== undefined &&
                        property.price <= ceiling;
                })
                .map((property) => {
                    const exact = property.bedrooms === minBedrooms;
                    return {
                        ...property,
                        bedroom_match: exact ? "exact" : "opportunity",
                        bedroom_target: minBedrooms,
                        bedroom_price_ceiling:
                            priceCeilingsByCurrency.get(property.currency) ?? null,
                        bedroom_priority: exact ? 0 : 1,
                    };
                });
        }
    }

    ranked.sort((a, b) => {
        if ((a.bedroom_priority || 0) !== (b.bedroom_priority || 0)) {
            return (a.bedroom_priority || 0) - (b.bedroom_priority || 0);
        }
        if (filters.sort === "price_asc") {
            return (a.price ?? Number.MAX_SAFE_INTEGER) -
                (b.price ?? Number.MAX_SAFE_INTEGER);
        }
        if (filters.sort === "price_desc") {
            return (b.price ?? -1) - (a.price ?? -1);
        }
        if (filters.sort === "recent") {
            return b.updated_at_ms - a.updated_at_ms;
        }
        if (a.search_score !== b.search_score) {
            return b.search_score - a.search_score;
        }
        return b.updated_at_ms - a.updated_at_ms;
    });

    return keepUniquePropertyRecords(ranked)
        .slice(0, maxResults)
        .map((item) => Object.fromEntries(
            Object.entries(item).filter(([key]) => key !== "search_score"),
        ));
};

export const parseMcpPropertyId = (value = "") => {
    const parts = cleanMcpText(value, 400).split(":");
    if (parts[0] === "agency" && parts.length === 3 && parts[1] && parts[2]) {
        return { source: "agency", agencyId: parts[1], propertyId: parts[2] };
    }
    if (parts[0] === "particular" && parts.length === 2 && parts[1]) {
        return { source: "particular", propertyId: parts[1] };
    }
    return null;
};

export const buildMcpPropertyDetail = (property = {}) => {
    const facts = [
        property.operation_label && `Operación: ${property.operation_label}`,
        property.property_type_label && `Tipo: ${property.property_type_label}`,
        property.location && `Ubicación: ${property.location}`,
        property.price !== null && property.price !== undefined &&
            `Precio publicado: ${property.currency || ""} ${property.price}`.trim(),
        property.bedrooms !== null && `Dormitorios: ${property.bedrooms}`,
        property.bathrooms !== null && `Baños: ${property.bathrooms}`,
        property.parking_spaces !== null && `Cocheras: ${property.parking_spaces}`,
        property.total_area_m2 !== null &&
            `Superficie informada: ${property.total_area_m2} m²`,
        property.publisher_name && `Publica: ${property.publisher_name}`,
    ].filter(Boolean);

    return {
        ...property,
        text: [
            property.title,
            ...facts,
            property.description,
            `Ficha actualizada y contacto: ${property.url}`,
        ].filter(Boolean).join("\n"),
    };
};

export const getOnopropStartOptions = (goal = "") => {
    const options = {
        publicar_inmueble: {
            id: "publicar_inmueble",
            title: "Publicar un inmueble gratis",
            description: "Iniciá la publicación como particular y enviá los datos para revisión.",
            url: buildTrackedOnopropUrl(
                "/publicar-inmueble-gratis",
                "publicar_inmueble",
            ),
        },
        sumar_inmobiliaria: {
            id: "sumar_inmobiliaria",
            title: "Incorporar una inmobiliaria",
            description: "Creá el espacio de la inmobiliaria para administrar y difundir publicaciones.",
            url: buildTrackedOnopropUrl(
                "/inmobiliarias/alta",
                "sumar_inmobiliaria",
            ),
        },
        contratar_software: {
            id: "contratar_software",
            title: "Soluciones para inmobiliarias",
            description: "Conocé los módulos, integraciones y servicios disponibles en ONO Prop.",
            url: buildTrackedOnopropUrl(
                "/software-para-inmobiliarias",
                "contratar_software",
            ),
        },
        solicitar_tasacion: {
            id: "solicitar_tasacion",
            title: "Solicitar una tasación profesional",
            description: "Contactá a ONO Prop para vincularte con una inmobiliaria y solicitar una tasación.",
            url: buildTrackedOnopropUrl(
                "/contacto",
                "solicitar_tasacion",
            ),
        },
    };

    return options[goal] ? [options[goal]] : Object.values(options);
};
