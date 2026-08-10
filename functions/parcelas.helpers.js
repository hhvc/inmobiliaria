const IDECOR_WFS_URL =
    "https://idecor-ws.mapascordoba.gob.ar/geoserver/idecor/wfs";

const LAYER_FIELDS = {
    parcelas: [
        "geom",
        "Nomenclatura",
        "Nro_Cuenta",
        "Tipo_Parcela",
        "Tipo_Valuacion",
        "Estado",
        "desig_oficial",
        "fxf",
        "vut_vigente",
        "Valuacion",
        "vigencia_desde",
        "porcentaje_copropiedad",
        "Superficie_Tierra_Urbana",
        "Valuacion_Tierra_Urbana",
        "Superficie_Tierra_Rural",
        "Valuacion_Tierra_Rural",
        "Superficie_Mejoras",
        "Valuacion_Mejoras",
        "Cantidad_Cuentas",
        "departamento",
        "pedania",
        "localidad",
    ],
    normativas_urbanas_ocupacion_v: [
        "localidad",
        "ord",
        "zona",
        "denominacion",
        "fot",
        "fos",
        "sup_min",
        "frente_min",
        "altura_max",
        "retiros",
    ],
    normativas_urbanas_fraccionamiento_v: [
        "localidad",
        "ord",
        "zona",
        "denominacion",
        "sup_min",
        "frente_min",
    ],
    normativas_urbanas_usos_suelos_v: [
        "localidad",
        "ord",
        "zona",
        "denominacion",
        "uso_dominante",
        "uso_complementario",
    ],
};

const toNullableNumber = (value) => {
    if (value === null || value === undefined || value === "") return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};

const cleanValue = (value, maxLength = 1000) => {
    if (value === null || value === undefined) return null;
    const cleaned = String(value).replace(/\s+/g, " ").trim();
    return cleaned ? cleaned.slice(0, maxLength) : null;
};

const getProperties = (feature) => {
    if (!feature || typeof feature !== "object") return {};
    return feature.properties && typeof feature.properties === "object" ?
        feature.properties : {};
};

export const normalizeIdecorCoordinate = (value, type) => {
    const parsed = Number(value);
    const limits = type === "latitude" ? [-90, 90] : [-180, 180];
    if (!Number.isFinite(parsed) || parsed < limits[0] || parsed > limits[1]) {
        throw new Error(`Coordenada ${type} inválida.`);
    }
    return parsed;
};

export const buildIdecorPointQueryUrl = ({
    layer,
    latitude,
    longitude,
}) => {
    if (!Object.hasOwn(LAYER_FIELDS, layer)) {
        throw new Error("Capa IDECOR no permitida.");
    }
    const lat = normalizeIdecorCoordinate(latitude, "latitude");
    const lng = normalizeIdecorCoordinate(longitude, "longitude");
    const params = new URLSearchParams({
        service: "WFS",
        version: "2.0.0",
        request: "GetFeature",
        typeNames: `idecor:${layer}`,
        outputFormat: "application/json",
        srsName: "EPSG:4326",
        count: "3",
        propertyName: LAYER_FIELDS[layer].join(","),
        CQL_FILTER: `INTERSECTS(geom,SRID=4326;POINT(${lng} ${lat}))`,
    });
    return `${IDECOR_WFS_URL}?${params.toString()}`;
};

export const normalizeParcelFeature = (feature) => {
    if (!feature) return null;
    const properties = getProperties(feature);
    const accountNumber = toNullableNumber(properties.Nro_Cuenta);

    return {
        featureId: cleanValue(feature.id, 160),
        nomenclature: cleanValue(properties.Nomenclatura, 80),
        accountNumber: accountNumber && accountNumber > 0 ?
            String(Math.trunc(accountNumber)) : null,
        officialDesignation: cleanValue(properties.desig_oficial, 180),
        parcelType: cleanValue(properties.Tipo_Parcela, 80),
        valuationType: cleanValue(properties.Tipo_Valuacion, 80),
        status: cleanValue(properties.Estado, 100),
        landAreaUrban: toNullableNumber(properties.Superficie_Tierra_Urbana),
        landAreaRural: toNullableNumber(properties.Superficie_Tierra_Rural),
        improvementsArea: toNullableNumber(properties.Superficie_Mejoras),
        totalValuation: toNullableNumber(properties.Valuacion),
        urbanLandValuation: toNullableNumber(
            properties.Valuacion_Tierra_Urbana,
        ),
        ruralLandValuation: toNullableNumber(
            properties.Valuacion_Tierra_Rural,
        ),
        improvementsValuation: toNullableNumber(
            properties.Valuacion_Mejoras,
        ),
        currentUnitLandValue: toNullableNumber(properties.vut_vigente),
        frontDepthFactor: toNullableNumber(properties.fxf),
        coOwnershipPercentage: toNullableNumber(
            properties.porcentaje_copropiedad,
        ),
        accountsCount: toNullableNumber(properties.Cantidad_Cuentas),
        valuationValidFrom: cleanValue(properties.vigencia_desde, 80),
        department: cleanValue(properties.departamento, 120),
        district: cleanValue(properties.pedania, 120),
        locality: cleanValue(properties.localidad, 160),
        geometry: feature.geometry || null,
    };
};

export const normalizeOccupancyFeature = (feature) => {
    if (!feature) return null;
    const properties = getProperties(feature);
    return {
        locality: cleanValue(properties.localidad, 160),
        ordinance: cleanValue(properties.ord, 240),
        zone: cleanValue(properties.zona, 160),
        designation: cleanValue(properties.denominacion, 240),
        fot: cleanValue(properties.fot, 120),
        fos: cleanValue(properties.fos, 120),
        minimumArea: cleanValue(properties.sup_min, 160),
        minimumFront: cleanValue(properties.frente_min, 160),
        maximumHeight: cleanValue(properties.altura_max, 160),
        setbacks: cleanValue(properties.retiros, 1000),
    };
};

export const normalizeSubdivisionFeature = (feature) => {
    if (!feature) return null;
    const properties = getProperties(feature);
    return {
        locality: cleanValue(properties.localidad, 160),
        ordinance: cleanValue(properties.ord, 240),
        zone: cleanValue(properties.zona, 160),
        designation: cleanValue(properties.denominacion, 240),
        minimumArea: cleanValue(properties.sup_min, 160),
        minimumFront: cleanValue(properties.frente_min, 160),
    };
};

export const normalizeLandUseFeature = (feature) => {
    if (!feature) return null;
    const properties = getProperties(feature);
    return {
        locality: cleanValue(properties.localidad, 160),
        ordinance: cleanValue(properties.ord, 240),
        zone: cleanValue(properties.zona, 160),
        designation: cleanValue(properties.denominacion, 240),
        dominantUse: cleanValue(properties.uso_dominante, 2000),
        complementaryUse: cleanValue(properties.uso_complementario, 2000),
    };
};

export const firstFeature = (payload) => {
    return Array.isArray(payload?.features) ? payload.features[0] || null : null;
};
