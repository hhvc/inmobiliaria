export const OMI_BASE_URL = "https://omi.mapascordoba.gob.ar";
export const OMI_TYPENAME = "ObservatorioValuacion:Observatorio";
export const OMI_DEFAULT_LIMIT = 50;
export const OMI_MAX_LIMIT = 200;

const WEB_MERCATOR_HALF_WORLD = 20037508.342789244;
const MAX_LATITUDE = 85.05112878;
const MAX_BOUNDS_SIDE_METERS = 100000;

const finiteNumber = (value) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
};

const optionalNumber = (value) => {
    if (value === null || value === undefined || value === "") return null;
    return finiteNumber(value);
};

const optionalText = (value, maxLength = 300) => {
    if (value === null || value === undefined) return "";
    return String(value).trim().slice(0, maxLength);
};

const optionalFlag = (value) => {
    if (value === null || value === undefined || value === "") return null;
    if (value === true || Number(value) === 1) return true;
    if (value === false || Number(value) === 0) return false;
    return null;
};

const extractFirstHttpUrl = (value) => {
    const match = optionalText(value, 4000).match(/https?:\/\/[^\s<>"']+/i);
    return match ? match[0].replace(/[),.;]+$/, "") : "";
};

export const lonLatToWebMercator = (longitude, latitude) => {
    const lon = finiteNumber(longitude);
    const lat = finiteNumber(latitude);
    if (lon === null || lat === null || lon < -180 || lon > 180 ||
        lat < -MAX_LATITUDE || lat > MAX_LATITUDE) {
        throw new Error("Las coordenadas geográficas no son válidas.");
    }

    const x = lon * WEB_MERCATOR_HALF_WORLD / 180;
    const y = Math.log(Math.tan((90 + lat) * Math.PI / 360)) /
        (Math.PI / 180);
    return [x, y * WEB_MERCATOR_HALF_WORLD / 180];
};

export const webMercatorToLonLat = (xValue, yValue) => {
    const x = finiteNumber(xValue);
    const y = finiteNumber(yValue);
    if (x === null || y === null ||
        Math.abs(x) > WEB_MERCATOR_HALF_WORLD ||
        Math.abs(y) > WEB_MERCATOR_HALF_WORLD) {
        throw new Error("Las coordenadas Web Mercator no son válidas.");
    }

    const longitude = x / WEB_MERCATOR_HALF_WORLD * 180;
    const mercatorLatitude = y / WEB_MERCATOR_HALF_WORLD * 180;
    const latitude = 180 / Math.PI * (
        2 * Math.atan(Math.exp(mercatorLatitude * Math.PI / 180)) -
        Math.PI / 2
    );
    return [longitude, latitude];
};

const readBoundsValues = (bounds = {}, crs = "EPSG:4326") => {
    if (Array.isArray(bounds) && bounds.length === 4) {
        return bounds.map(finiteNumber);
    }

    const normalizedCrs = optionalText(crs, 20).toUpperCase();
    if (normalizedCrs === "EPSG:3857") {
        return [
            finiteNumber(bounds.minX),
            finiteNumber(bounds.minY),
            finiteNumber(bounds.maxX),
            finiteNumber(bounds.maxY),
        ];
    }

    return [
        finiteNumber(bounds.west),
        finiteNumber(bounds.south),
        finiteNumber(bounds.east),
        finiteNumber(bounds.north),
    ];
};

export const normalizeOmiBounds = (
    bounds,
    crs = "EPSG:4326",
) => {
    const normalizedCrs = optionalText(crs, 20).toUpperCase();
    if (!["EPSG:4326", "EPSG:3857"].includes(normalizedCrs)) {
        throw new Error("El sistema de coordenadas no está soportado.");
    }

    const values = readBoundsValues(bounds, normalizedCrs);
    if (values.some((value) => value === null)) {
        throw new Error("Faltan los límites del área a consultar.");
    }

    let [minX, minY, maxX, maxY] = values;
    if (normalizedCrs === "EPSG:4326") {
        [minX, minY] = lonLatToWebMercator(minX, minY);
        [maxX, maxY] = lonLatToWebMercator(maxX, maxY);
    }

    if (minX >= maxX || minY >= maxY) {
        throw new Error("Los límites del mapa no forman un área válida.");
    }
    if (maxX - minX > MAX_BOUNDS_SIDE_METERS ||
        maxY - minY > MAX_BOUNDS_SIDE_METERS) {
        throw new Error(
            "Acercá el mapa: el área consultada no puede superar 100 km por lado.",
        );
    }

    return { minX, minY, maxX, maxY };
};

export const normalizeOmiLimit = (value) => {
    const number = Math.trunc(Number(value || OMI_DEFAULT_LIMIT));
    if (!Number.isFinite(number)) return OMI_DEFAULT_LIMIT;
    return Math.max(1, Math.min(OMI_MAX_LIMIT, number));
};

export const buildOmiFeatureUrl = ({ bounds, limit }) => {
    const safeBounds = normalizeOmiBounds(bounds, "EPSG:3857");
    const safeLimit = normalizeOmiLimit(limit);
    const url = new URL("/proxy.php", OMI_BASE_URL);
    url.search = new URLSearchParams({
        service: "WFS",
        version: "1.1.0",
        request: "GetFeature",
        typename: OMI_TYPENAME,
        outputFormat: "application/json",
        srsname: "EPSG:3857",
        bbox: [
            safeBounds.minX,
            safeBounds.minY,
            safeBounds.maxX,
            safeBounds.maxY,
        ].join(","),
        maxFeatures: String(safeLimit),
        count: String(safeLimit),
    }).toString();
    return url;
};

const splitSetCookieHeader = (value) => {
    return optionalText(value, 20000)
        .split(/,(?=\s*[^;,=\s]+=[^;,]*)/g)
        .map((cookie) => cookie.trim())
        .filter(Boolean);
};

export const extractCookieHeader = (setCookieHeaders = []) => {
    const values = Array.isArray(setCookieHeaders) ?
        setCookieHeaders :
        splitSetCookieHeader(setCookieHeaders);
    return values
        .map((cookie) => optionalText(cookie, 10000).split(";", 1)[0].trim())
        .filter((cookie) => /^[^=;\s]+=[^;]*$/.test(cookie))
        .join("; ");
};

export const normalizeOmiFeature = (feature = {}) => {
    const properties = feature?.properties || {};
    const sourceCoordinates = feature?.geometry?.type === "Point" &&
        Array.isArray(feature.geometry.coordinates) ?
        feature.geometry.coordinates : [];
    let coordinates = null;
    try {
        if (sourceCoordinates.length >= 2) {
            coordinates = webMercatorToLonLat(
                sourceCoordinates[0],
                sourceCoordinates[1],
            );
        }
    } catch {
        coordinates = null;
    }

    const sourceRecordId = optionalText(
        properties.id ?? feature.id,
        80,
    );

    return {
        id: sourceRecordId,
        provider: "OMI profesional - IDECOR",
        geometry: coordinates ? {
            type: "Point",
            coordinates,
        } : null,
        address: optionalText(
            properties.Domicilio || properties.ReferenciasUbicacion,
            300,
        ),
        neighborhood: optionalText(properties.Barrio, 160),
        locality: optionalText(properties.Localidad, 160),
        cadastralNomenclature: optionalText(properties.Nomenclatura, 100),
        sourceUrl: extractFirstHttpUrl(properties.Fuente),
        value: optionalNumber(properties.Valor),
        valueDate: optionalText(properties.FechaValor, 30),
        loadedAt: optionalText(properties.FechaCarga, 40),
        valueTypeCode: optionalNumber(properties.TipoDeValor),
        currencyTypeCode: optionalNumber(properties.TipoDeMoneda),
        propertyTypeCode: optionalNumber(properties.TipoDeInmueble),
        legalStatusCode: optionalNumber(properties.SituacionJuridica),
        buildingUseCode: optionalNumber(
            properties.UsoUrbanoEdificado ?? properties.UsoDepartamento,
        ),
        surfaces: {
            urbanLand: optionalNumber(properties.SuperficieLoteUrbano),
            ruralLand: optionalNumber(properties.SuperficieLoteRural),
            built: optionalNumber(properties.SuperficieConstruida),
            own: optionalNumber(properties.SuperficiePropia),
        },
        frontage: optionalNumber(properties.Frente),
        rooms: optionalNumber(properties.Habitaciones),
        floor: optionalNumber(properties.Piso),
        constructionYear: optionalNumber(properties.AnoConstruccion),
        buildingCategoryCode: optionalNumber(properties.CategoriaConstructiva),
        conditionCode: optionalNumber(properties.EstadoConservacion),
        blockLocationCode: optionalNumber(properties.UbicacionCuadra),
        neighborhoodTypeCode: optionalNumber(properties.TipoDeBarrio),
        parking: optionalFlag(properties.Cochera),
        expenses: optionalNumber(properties.Expensas),
        services: {
            electricity: optionalFlag(properties.Luz),
            water: optionalFlag(properties.Agua),
            sewer: optionalFlag(properties.Cloacas),
            gas: optionalFlag(properties.Gas),
            pavement: optionalFlag(properties.Pavimento),
            curbAndGutter: optionalFlag(properties.CordonCuneta),
        },
    };
};

export const normalizeOmiCollection = (payload = {}) => {
    if (payload?.type !== "FeatureCollection" ||
        !Array.isArray(payload.features)) {
        throw new Error("OMI devolvió una respuesta inesperada.");
    }

    return {
        items: payload.features.map(normalizeOmiFeature),
        returned: payload.features.length,
        providerMatched: optionalNumber(
            payload.numberMatched ?? payload.totalFeatures,
        ),
        providerTimestamp: optionalText(payload.timeStamp, 60),
    };
};
