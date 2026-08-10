import { normalizeTasacion } from "./tasacionSchema.js";

const hasValue = (value) => value !== undefined && value !== null && value !== "";

const sourceValue = (...values) => values.find(hasValue) ?? "";

const sourceBoolean = (source, key, fallback = false) =>
  Object.prototype.hasOwnProperty.call(source || {}, key)
    ? Boolean(source[key])
    : Boolean(fallback);

const INMUEBLE_TO_TASACION_TYPE = {
  casa: "casa",
  departamento: "departamento",
  terreno: "terreno",
  local: "local",
  oficina: "oficina",
  quinta: "casa",
  cochera: "otro",
  deposito: "otro",
  campo: "otro",
};

const TASACION_TO_INMUEBLE_TYPE = {
  casa: "casa",
  departamento: "departamento",
  ph: "casa",
  oficina: "oficina",
  local: "local",
  terreno: "terreno",
  otro: "casa",
};

const CONDITION_BY_INMUEBLE_STATE = {
  a_estrenar: 1,
  excelente: 1,
  muy_bueno: 1.5,
  bueno: 2,
  regular: 3,
  a_refaccionar: 4,
};

const INMUEBLE_STATE_BY_CONDITION = (condition) => {
  const value = Number(condition);
  if (value <= 1) return "excelente";
  if (value <= 1.5) return "muy_bueno";
  if (value <= 2.5) return "bueno";
  if (value <= 3.5) return "regular";
  return "a_refaccionar";
};

const amenitySummary = (amenities = {}) =>
  Object.entries(amenities)
    .filter(([, enabled]) => Boolean(enabled))
    .map(([name]) => name)
    .join(", ");

const getInmuebleCoordinates = (inmueble = {}) => {
  const location = inmueble.distribution?.mercadolibre?.location || {};
  return {
    latitude: sourceValue(
      inmueble.direccion?.latitude,
      inmueble.direccion?.lat,
      inmueble.latitude,
      inmueble.latitud,
      location.latitude,
    ),
    longitude: sourceValue(
      inmueble.direccion?.longitude,
      inmueble.direccion?.lng,
      inmueble.longitude,
      inmueble.longitud,
      location.longitude,
    ),
  };
};

export const applyInmuebleToTasacion = (tasacion = {}, inmueble = {}) => {
  const current = normalizeTasacion(tasacion);
  const superficie = inmueble.superficie || {};
  const caracteristicas = inmueble.caracteristicas || {};
  const medidas = inmueble.medidas || {};
  const direccion = inmueble.direccion || {};
  const servicios = inmueble.servicios || {};
  const lote = inmueble.lote || {};
  const parcelData = inmueble.datosParcelarios || {};
  const parcel = parcelData.parcel || {};
  const occupancy = parcelData.urbanPlanning?.occupancy || {};
  const landUse = parcelData.urbanPlanning?.landUse || {};
  const coordinates = getInmuebleCoordinates(inmueble);
  const importedAt = new Date().toISOString();

  return normalizeTasacion({
    ...current,
    propertyLink: {
      mode: "existing",
      inmuebleId: inmueble.id || "",
      inmuebleTitle: inmueble.titulo || "",
      importedAt,
      draftCreatedFromTasacion: false,
      syncDraft: false,
    },
    scope: {
      ...current.scope,
      ownerName: sourceValue(inmueble.networkData?.ownerName, current.scope.ownerName),
      cadastralNomenclature: sourceValue(
        parcel.nomenclature,
        current.scope.cadastralNomenclature,
      ),
    },
    inspection: {
      ...current.inspection,
      address: {
        ...current.inspection.address,
        street: sourceValue(direccion.calle, inmueble.calle, current.inspection.address.street),
        number: sourceValue(direccion.numero, inmueble.numero, current.inspection.address.number),
        neighborhood: sourceValue(direccion.barrio, inmueble.barrio, current.inspection.address.neighborhood),
        city: sourceValue(direccion.ciudad, inmueble.ciudad, current.inspection.address.city),
        province: sourceValue(direccion.provincia, inmueble.provincia, current.inspection.address.province),
        country: sourceValue(direccion.pais, inmueble.pais, current.inspection.address.country),
        postalCode: sourceValue(direccion.codigoPostal, inmueble.codigoPostal, current.inspection.address.postalCode),
      },
      geolocation: {
        latitude: sourceValue(coordinates.latitude, current.inspection.geolocation.latitude),
        longitude: sourceValue(coordinates.longitude, current.inspection.geolocation.longitude),
      },
      zoning: {
        ...current.inspection.zoning,
        code: sourceValue(
          occupancy.zone,
          occupancy.designation,
          landUse.zone,
          current.inspection.zoning.code,
        ),
        fot: sourceValue(occupancy.fot, current.inspection.zoning.fot),
        fos: sourceValue(occupancy.fos, current.inspection.zoning.fos),
        permittedUse: sourceValue(
          landUse.dominantUse,
          landUse.complementaryUse,
          current.inspection.zoning.permittedUse,
        ),
      },
      parcelData: parcelData.parcel
        ? parcelData
        : current.inspection.parcelData,
      services: {
        ...current.inspection.services,
        water: sourceBoolean(servicios, "agua", current.inspection.services.water),
        sewer: sourceBoolean(servicios, "cloacas", current.inspection.services.sewer),
        gas: sourceBoolean(servicios, "gas", current.inspection.services.gas),
        electricity: sourceBoolean(
          servicios,
          "luz",
          current.inspection.services.electricity,
        ),
        pavement: sourceBoolean(
          servicios,
          "pavimento",
          current.inspection.services.pavement,
        ),
      },
      documentationNotes: sourceValue(
        inmueble.networkData?.documentationStatus,
        current.inspection.documentationNotes,
      ),
    },
    subject: {
      ...current.subject,
      typology: INMUEBLE_TO_TASACION_TYPE[inmueble.tipo] || current.subject.typology,
      description: sourceValue(inmueble.descripcion, current.subject.description),
      age: sourceValue(caracteristicas.antiguedad, inmueble.antiguedad, current.subject.age),
      condition:
        CONDITION_BY_INMUEBLE_STATE[caracteristicas.estadoConservacion] ??
        current.subject.condition,
      floor: sourceValue(caracteristicas.piso, current.subject.floor),
      orientation: sourceValue(caracteristicas.orientacion, current.subject.orientation),
      surfaces: {
        ...current.subject.surfaces,
        cubierta: sourceValue(superficie.cubierta, inmueble.superficieCubierta, current.subject.surfaces.cubierta),
        semicubierta: sourceValue(superficie.semicubierta, current.subject.surfaces.semicubierta),
        balcon: sourceValue(superficie.balcon, current.subject.surfaces.balcon),
        descubierta: sourceValue(superficie.descubierta, current.subject.surfaces.descubierta),
        terreno: sourceValue(superficie.terreno, inmueble.superficieTerreno, current.subject.surfaces.terreno),
      },
      lot: {
        ...current.subject.lot,
        position: sourceValue(lote.position, lote.posicion, current.subject.lot.position),
        mainFront: sourceValue(lote.mainFront, lote.frentePrincipal, medidas.frente, superficie.frente, current.subject.lot.mainFront),
        secondaryFront: sourceValue(lote.secondaryFront, lote.frenteSecundario, current.subject.lot.secondaryFront),
        averageDepth: sourceValue(lote.averageDepth, lote.fondoMedio, medidas.fondo, superficie.fondo, current.subject.lot.averageDepth),
        dimensionsNotes: sourceValue(lote.dimensionsNotes, lote.observaciones, current.subject.lot.dimensionsNotes),
      },
      amenities: sourceValue(amenitySummary(inmueble.amenities), current.subject.amenities),
    },
  });
};

const buildDraftTitle = (tasacion = {}) => {
  const address = tasacion.inspection?.address || {};
  const type = tasacion.subject?.typology || "inmueble";
  const location = sourceValue(
    address.neighborhood,
    address.street,
    address.city,
  );
  const normalizedType = type === "ph" ? "PH" : `${type.charAt(0).toUpperCase()}${type.slice(1)}`;
  return location ? `${normalizedType} en ${location}` : `${normalizedType} para completar`;
};

export const buildInmuebleDraftFromTasacion = (
  tasacion = {},
  { tasacionId = "" } = {},
) => {
  const normalized = normalizeTasacion(tasacion);
  const address = normalized.inspection.address;
  const surfaces = normalized.subject.surfaces;
  const lot = normalized.subject.lot;
  const condition = normalized.subject.condition;
  const totalSurface =
    Number(surfaces.cubierta || 0) +
    Number(surfaces.semicubierta || 0) +
    Number(surfaces.balcon || 0) +
    Number(surfaces.descubierta || 0);

  return {
    titulo: buildDraftTitle(normalized),
    descripcion: normalized.subject.description || "",
    tipo: TASACION_TO_INMUEBLE_TYPE[normalized.subject.typology] || "casa",
    operacion: "venta",
    precio: normalized.conclusion.adoptedMarketValue || "",
    moneda: normalized.scope.currency === "OTRA" ? "USD" : normalized.scope.currency,
    expensas: "",
    direccion: {
      calle: address.street || "",
      numero: address.number || "",
      barrio: address.neighborhood || "",
      ciudad: address.city || "",
      provincia: address.province || "",
      pais: address.country || "Argentina",
      codigoPostal: address.postalCode || "",
      lat: normalized.inspection.geolocation.latitude || null,
      lng: normalized.inspection.geolocation.longitude || null,
      precisionMapa: "precisa",
    },
    superficie: {
      total: totalSurface || surfaces.terreno || "",
      cubierta: surfaces.cubierta || "",
      semicubierta: surfaces.semicubierta || "",
      balcon: surfaces.balcon || "",
      descubierta: surfaces.descubierta || "",
      terreno: surfaces.terreno || "",
      frente: lot.mainFront || "",
      fondo: lot.averageDepth || "",
    },
    caracteristicas: {
      antiguedad: normalized.subject.age || "",
      orientacion: normalized.subject.orientation || "",
      estadoConservacion: INMUEBLE_STATE_BY_CONDITION(condition),
      piso: normalized.subject.floor || "",
    },
    servicios: {
      agua: Boolean(normalized.inspection.services.water),
      cloacas: Boolean(normalized.inspection.services.sewer),
      gas: Boolean(normalized.inspection.services.gas),
      luz: Boolean(normalized.inspection.services.electricity),
      pavimento: Boolean(normalized.inspection.services.pavement),
    },
    medidas: {
      frente: lot.mainFront || "",
      fondo: lot.averageDepth || "",
    },
    datosParcelarios: normalized.inspection.parcelData || null,
    lote: {
      position: lot.position || "",
      mainFront: lot.mainFront || "",
      secondaryFront: lot.secondaryFront || "",
      averageDepth: lot.averageDepth || "",
      dimensionsNotes: lot.dimensionsNotes || "",
    },
    images: [],
    videos: [],
    sharing: {
      enabled: false,
      mode: "all_colleagues",
      allowColleagueContact: true,
      showExactAddressToColleagues: false,
      showOwnerDataToColleagues: false,
    },
    sharedWith: {},
    estado: "inactivo",
    destacado: false,
    publicarEnPortal: false,
    noIndex: true,
    sourceType: "tasacion",
    sourceTasacionId: tasacionId,
    managedFromTasacion: true,
  };
};

export const linkTasacionToDraft = (tasacion = {}, inmueble = {}) =>
  normalizeTasacion({
    ...tasacion,
    propertyLink: {
      mode: "new",
      inmuebleId: inmueble.id || inmueble.inmuebleId || "",
      inmuebleTitle: inmueble.titulo || buildDraftTitle(tasacion),
      importedAt: new Date().toISOString(),
      draftCreatedFromTasacion: true,
      syncDraft: true,
    },
  });
