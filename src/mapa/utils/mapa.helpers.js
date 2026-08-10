import { createEmptyComparable } from "../../tasacion/utils/tasacionSchema.js";

export const CORDOBA_CITY_CENTER = [-31.4201, -64.1888];
export const MAX_TASACION_COMPARABLES = 5;

const toFiniteNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const cleanText = (value, maxLength = 300) => {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\s+/g, " ").trim().slice(0, maxLength);
};

export const normalizeMapPropertyType = (value = "") => {
  const normalized = cleanText(value, 80)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (/departamento|depto|apartamento/.test(normalized)) return "departamento";
  if (/casa|chalet|\bph\b|duplex/.test(normalized)) return "casa";
  if (/terreno|lote/.test(normalized)) return "terreno";
  if (/local|galpon|deposito/.test(normalized)) return "local";
  if (/oficina|consultorio/.test(normalized)) return "oficina";
  if (/campo|estancia|chacra|rural/.test(normalized)) return "campo";

  return "otro";
};

const firstFinite = (...values) => {
  for (const value of values) {
    const number = toFiniteNumber(value);
    if (number !== null) return number;
  }
  return null;
};

export const normalizeMapCoordinates = (latitudeValue, longitudeValue) => {
  const latitude = toFiniteNumber(latitudeValue);
  const longitude = toFiniteNumber(longitudeValue);

  if (
    latitude === null ||
    longitude === null ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }

  return { latitude, longitude };
};

const coordinatesFrom = (value = {}) => {
  if (!value) return null;
  if (Array.isArray(value)) {
    return normalizeMapCoordinates(value[0], value[1]);
  }
  return normalizeMapCoordinates(
    value.latitude ?? value.lat,
    value.longitude ?? value.lng,
  );
};

export const calculateMapDistanceMeters = (origin, destination) => {
  const from = coordinatesFrom(origin);
  const to = coordinatesFrom(destination);
  if (!from || !to) return null;

  const radians = (degrees) => (degrees * Math.PI) / 180;
  const earthRadiusMeters = 6371008.8;
  const latitudeDelta = radians(to.latitude - from.latitude);
  const longitudeDelta = radians(to.longitude - from.longitude);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(from.latitude)) *
      Math.cos(radians(to.latitude)) *
      Math.sin(longitudeDelta / 2) ** 2;

  return Math.round(
    earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)),
  );
};

export const normalizeMapDateKey = (value) => {
  if (!value) return "";
  if (typeof value?.toDate === "function") {
    return value.toDate().toISOString().slice(0, 10);
  }
  if (Number.isFinite(Number(value?.seconds))) {
    return new Date(Number(value.seconds) * 1000).toISOString().slice(0, 10);
  }

  const text = cleanText(value, 40);
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const dayMonthYear = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dayMonthYear) {
    return `${dayMonthYear[3]}-${dayMonthYear[2].padStart(2, "0")}-${dayMonthYear[1].padStart(2, "0")}`;
  }
  const monthYear = text.match(/^(\d{1,2})[/-](\d{4})$/);
  if (monthYear) return `${monthYear[2]}-${monthYear[1].padStart(2, "0")}-01`;
  return "";
};

export const getInmuebleCoordinates = (inmueble = {}) => {
  const direccion = inmueble.direccion || {};
  const location = inmueble.location || inmueble.ubicacionGeografica || {};
  const mercadoLibreLocation =
    inmueble.mercadoLibre?.location ||
    inmueble.distribution?.mercadoLibre?.location ||
    {};

  return normalizeMapCoordinates(
    firstFinite(
      direccion.lat,
      direccion.latitude,
      inmueble.lat,
      inmueble.latitude,
      inmueble.latitud,
      location.lat,
      location.latitude,
      mercadoLibreLocation.latitude,
    ),
    firstFinite(
      direccion.lng,
      direccion.longitude,
      inmueble.lng,
      inmueble.longitude,
      inmueble.longitud,
      location.lng,
      location.longitude,
      mercadoLibreLocation.longitude,
    ),
  );
};

export const buildInmuebleAddress = (inmueble = {}, exact = false) => {
  const direccion = inmueble.direccion || {};
  const firstLine = exact
    ? [direccion.calle, direccion.numero].filter(Boolean).join(" ")
    : "";
  return [firstLine, direccion.barrio, direccion.ciudad, direccion.provincia]
    .filter(Boolean)
    .map((item) => cleanText(item, 120))
    .join(", ");
};

export const formatMapPrice = (item = {}) => {
  const price = toFiniteNumber(item.precio ?? item.price ?? item.value);
  if (price === null || price <= 0) return "Consultar";
  const currency = cleanText(item.moneda || item.currency || "USD", 10);
  return `${currency} ${price.toLocaleString("es-AR")}`;
};

export const buildInmuebleMapPoint = (
  inmueble = {},
  { publicView = false, subjectLocation = null } = {},
) => {
  const coordinates = getInmuebleCoordinates(inmueble);
  if (!coordinates) return null;

  const mapPrecision =
    inmueble.direccion?.precisionMapa === "precisa"
      ? "precisa"
      : "aproximada";
  const shouldApproximate = publicView && mapPrecision !== "precisa";

  const latitude = shouldApproximate
    ? Number(coordinates.latitude.toFixed(3))
    : coordinates.latitude;
  const longitude = shouldApproximate
    ? Number(coordinates.longitude.toFixed(3))
    : coordinates.longitude;
  const superficie = inmueble.superficie || {};
  const primarySurface = firstFinite(
    superficie.cubierta,
    superficie.total,
    superficie.terreno,
  );

  return {
    id: `inmueble:${inmueble.inmobiliariaId || ""}:${inmueble.id || ""}`,
    sourceId: inmueble.id || "",
    kind: "inmueble",
    position: [latitude, longitude],
    title: cleanText(inmueble.titulo || "Inmueble", 180),
    address: buildInmuebleAddress(
      inmueble,
      !publicView || mapPrecision === "precisa",
    ),
    priceLabel: formatMapPrice(inmueble),
    price: firstFinite(inmueble.precio),
    currency: cleanText(inmueble.moneda || "", 12),
    propertyType: cleanText(inmueble.tipo, 80),
    comparableType: normalizeMapPropertyType(inmueble.tipo),
    operation: cleanText(inmueble.operacion, 80),
    primarySurface,
    sourceDate: normalizeMapDateKey(
      inmueble.updatedAt || inmueble.createdAt,
    ),
    distanceMeters: calculateMapDistanceMeters(subjectLocation, {
      latitude,
      longitude,
    }),
    published: inmueble.publicarEnPortal === true,
    mapPrecision,
    slug: cleanText(inmueble.slug, 220),
    raw: inmueble,
  };
};

export const buildOmiMapPoint = (item = {}, { subjectLocation = null } = {}) => {
  const coordinates = item.geometry?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null;
  const normalized = normalizeMapCoordinates(coordinates[1], coordinates[0]);
  if (!normalized) return null;

  const surface =
    toFiniteNumber(item.surfaces?.built) ??
    toFiniteNumber(item.surfaces?.own) ??
    toFiniteNumber(item.surfaces?.urbanLand) ??
    toFiniteNumber(item.surfaces?.ruralLand);

  return {
    id: `omi:${item.id || ""}`,
    sourceId: cleanText(item.id, 100),
    kind: "omi",
    position: [normalized.latitude, normalized.longitude],
    title: item.address
      ? cleanText(item.address, 180)
      : `Antecedente OMI ${cleanText(item.id, 60)}`,
    address: cleanText(
      [item.address, item.neighborhood, item.locality]
        .filter(Boolean)
        .join(", "),
      300,
    ),
    priceLabel:
      toFiniteNumber(item.value) === null
        ? "Valor no informado"
        : Number(item.value).toLocaleString("es-AR"),
    price: toFiniteNumber(item.value),
    currency: item.currencyTypeCode === null || item.currencyTypeCode === undefined
      ? ""
      : `OMI:${item.currencyTypeCode}`,
    comparableType:
      item.propertyTypeCode === null || item.propertyTypeCode === undefined
        ? ""
        : `omi:${item.propertyTypeCode}`,
    operation: "",
    primarySurface: surface,
    sourceDate: normalizeMapDateKey(item.valueDate || item.loadedAt),
    distanceMeters: calculateMapDistanceMeters(subjectLocation, normalized),
    surfaceLabel: surface === null ? "" : `${surface.toLocaleString("es-AR")} m²`,
    raw: item,
  };
};

const today = () => new Date().toISOString().slice(0, 10);

export const buildOmiComparable = (item = {}, { subjectLocation = null } = {}) => {
  const comparable = createEmptyComparable();
  const builtSurface =
    toFiniteNumber(item.surfaces?.built) ??
    toFiniteNumber(item.surfaces?.own) ??
    "";
  const landSurface =
    toFiniteNumber(item.surfaces?.urbanLand) ??
    toFiniteNumber(item.surfaces?.ruralLand) ??
    "";
  const notes = [
    item.valueDate ? `Fecha de valor OMI: ${item.valueDate}.` : "",
    item.currencyTypeCode !== null && item.currencyTypeCode !== undefined
      ? `Código de moneda OMI: ${item.currencyTypeCode}; verificar equivalencia antes de adoptar.`
      : "Verificar moneda antes de adoptar el antecedente.",
    item.propertyTypeCode !== null && item.propertyTypeCode !== undefined
      ? `Código de tipología OMI: ${item.propertyTypeCode}.`
      : "",
  ]
    .filter(Boolean)
    .join(" ");
  const capturedAt = new Date().toISOString();
  const normalizedCoordinates = Array.isArray(item.geometry?.coordinates)
    ? normalizeMapCoordinates(
        item.geometry.coordinates[1],
        item.geometry.coordinates[0],
      )
    : null;
  const distanceMeters = calculateMapDistanceMeters(
    subjectLocation,
    normalizedCoordinates,
  );
  const snapshotSurfaces = {
    cubierta: builtSurface,
    semicubierta: "",
    balcon: "",
    descubierta: "",
    terreno: landSurface,
  };
  const snapshotAddress = cleanText(
    [item.address, item.neighborhood, item.locality]
      .filter(Boolean)
      .join(", "),
    300,
  );

  return {
    ...comparable,
    dataType: "publicacion",
    propertyType:
      item.propertyTypeCode === null || item.propertyTypeCode === undefined
        ? ""
        : `omi:${item.propertyTypeCode}`,
    operation: "",
    currency:
      item.currencyTypeCode === null || item.currencyTypeCode === undefined
        ? ""
        : `OMI:${item.currencyTypeCode}`,
    source: "OMI profesional - IDECOR",
    sourceUrl: cleanText(item.sourceUrl, 1000),
    verifiedAt: today(),
    sourceCapturedAt: capturedAt,
    distanceMeters,
    address: snapshotAddress,
    price: toFiniteNumber(item.value) ?? "",
    surfaces: {...comparable.surfaces, ...snapshotSurfaces},
    notes,
    externalSource: {
      provider: "omi",
      recordId: cleanText(item.id, 100),
      valueDate: cleanText(item.valueDate, 30),
      currencyTypeCode: toFiniteNumber(item.currencyTypeCode),
      propertyTypeCode: toFiniteNumber(item.propertyTypeCode),
      coordinates: Array.isArray(item.geometry?.coordinates)
        ? item.geometry.coordinates.slice(0, 2)
        : [],
    },
    sourceSnapshot: {
      schemaVersion: 1,
      capturedAt,
      provider: "OMI profesional - IDECOR",
      recordId: cleanText(item.id, 100),
      sourceDate: cleanText(item.valueDate || item.loadedAt, 40),
      address: snapshotAddress,
      cadastralNomenclature: cleanText(item.cadastralNomenclature, 100),
      price: toFiniteNumber(item.value),
      currencyTypeCode: toFiniteNumber(item.currencyTypeCode),
      propertyTypeCode: toFiniteNumber(item.propertyTypeCode),
      valueTypeCode: toFiniteNumber(item.valueTypeCode),
      surfaces: snapshotSurfaces,
      coordinates: normalizedCoordinates,
    },
  };
};

export const buildInmuebleComparable = (
  inmueble = {},
  {subjectLocation = null} = {},
) => {
  const comparable = createEmptyComparable();
  const superficie = inmueble.superficie || {};
  const publisherName =
    inmueble.publisherSnapshot?.nombre ||
    inmueble.publisher?.nombre ||
    inmueble.inmobiliariaNombre ||
    "Inmueble propio";
  const coordinates = getInmuebleCoordinates(inmueble);
  const capturedAt = new Date().toISOString();
  const snapshotSurfaces = {
    cubierta: toFiniteNumber(superficie.cubierta) ?? "",
    semicubierta: toFiniteNumber(superficie.semicubierta) ?? "",
    balcon: toFiniteNumber(superficie.balcon) ?? "",
    descubierta: toFiniteNumber(superficie.descubierta) ?? "",
    terreno:
      toFiniteNumber(superficie.terreno) ??
      toFiniteNumber(superficie.total) ??
      "",
  };
  const address = buildInmuebleAddress(inmueble, true);

  return {
    ...comparable,
    dataType: inmueble.operacion === "alquiler" ? "alquiler" : "publicacion",
    propertyType: normalizeMapPropertyType(inmueble.tipo),
    operation: cleanText(inmueble.operacion, 80),
    currency: cleanText(inmueble.moneda || "", 12),
    source: cleanText(publisherName, 180),
    sourceUrl:
      inmueble.publicarEnPortal === true && inmueble.slug
        ? `https://onoprop.com/inmueble/${inmueble.slug}`
        : "",
    verifiedAt: today(),
    sourceCapturedAt: capturedAt,
    distanceMeters: calculateMapDistanceMeters(subjectLocation, coordinates),
    address,
    price: toFiniteNumber(inmueble.precio) ?? "",
    surfaces: {...comparable.surfaces, ...snapshotSurfaces},
    notes: `Antecedente tomado de un inmueble cargado en ONO Prop: ${cleanText(
      inmueble.titulo || inmueble.id,
      180,
    )}. Verificar vigencia y condiciones de oferta.`,
    externalSource: {
      provider: "onoprop",
      recordId: cleanText(inmueble.id, 100),
      inmobiliariaId: cleanText(inmueble.inmobiliariaId, 100),
    },
    sourceSnapshot: {
      schemaVersion: 1,
      capturedAt,
      provider: "ONO Prop",
      recordId: cleanText(inmueble.id, 100),
      inmobiliariaId: cleanText(inmueble.inmobiliariaId, 100),
      title: cleanText(inmueble.titulo, 180),
      address,
      price: toFiniteNumber(inmueble.precio),
      currency: cleanText(inmueble.moneda || "", 12),
      propertyType: cleanText(inmueble.tipo, 80),
      operation: cleanText(inmueble.operacion, 80),
      published: inmueble.publicarEnPortal === true,
      sourceDate: normalizeMapDateKey(
        inmueble.updatedAt || inmueble.createdAt,
      ),
      surfaces: snapshotSurfaces,
      coordinates,
    },
  };
};

export const isTasacionComparableEmpty = (comparable = {}) => {
  const hasSurface = Object.values(comparable.surfaces || {}).some(
    (value) => toFiniteNumber(value) !== null && Number(value) > 0,
  );
  return (
    !cleanText(comparable.source) &&
    !cleanText(comparable.address) &&
    !(toFiniteNumber(comparable.price) > 0) &&
    !hasSurface
  );
};

const comparableSourceKey = (comparable = {}) => {
  const provider = cleanText(comparable.externalSource?.provider, 50);
  const recordId = cleanText(comparable.externalSource?.recordId, 120);
  return provider && recordId ? `${provider}:${recordId}` : "";
};

export const addMappedComparable = (comparables = [], comparable) => {
  const items = Array.isArray(comparables) ? [...comparables] : [];
  const sourceKey = comparableSourceKey(comparable);
  if (
    sourceKey &&
    items.some((item) => comparableSourceKey(item) === sourceKey)
  ) {
    return { items, added: false, duplicate: true };
  }

  const emptyIndex = items.findIndex(isTasacionComparableEmpty);
  if (emptyIndex >= 0) items[emptyIndex] = comparable;
  else if (items.length >= MAX_TASACION_COMPARABLES) {
    return {items, added: false, duplicate: false, limitReached: true};
  } else items.push(comparable);

  return {items, added: true, duplicate: false, limitReached: false};
};

const withinNumericRange = (value, minimum, maximum) => {
  const number = toFiniteNumber(value);
  const min = toFiniteNumber(minimum);
  const max = toFiniteNumber(maximum);
  if (min !== null && (number === null || number < min)) return false;
  if (max !== null && (number === null || number > max)) return false;
  return true;
};

export const filterComparableMapPoints = (points = [], filters = {}) => {
  return points.filter((point) => {
    if (filters.source && filters.source !== "all" && point.kind !== filters.source) {
      return false;
    }
    if (filters.propertyType && point.comparableType !== filters.propertyType) {
      return false;
    }
    if (filters.operation && point.operation !== filters.operation) return false;
    if (filters.publication && point.kind !== "inmueble") return false;
    if (filters.publication === "published" && point.published !== true) return false;
    if (filters.publication === "draft" && point.published === true) return false;
    if (!withinNumericRange(point.price, filters.minPrice, filters.maxPrice)) {
      return false;
    }
    if (!withinNumericRange(
      point.primarySurface,
      filters.minSurface,
      filters.maxSurface,
    )) {
      return false;
    }
    const maxDistanceKm = toFiniteNumber(filters.maxDistanceKm);
    if (
      maxDistanceKm !== null &&
      (point.distanceMeters === null ||
        point.distanceMeters > maxDistanceKm * 1000)
    ) {
      return false;
    }
    const dateFrom = normalizeMapDateKey(filters.dateFrom);
    const dateTo = normalizeMapDateKey(filters.dateTo);
    if (dateFrom && (!point.sourceDate || point.sourceDate < dateFrom)) return false;
    if (dateTo && (!point.sourceDate || point.sourceDate > dateTo)) return false;
    return true;
  });
};
