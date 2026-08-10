const LAND_TYPES = new Set(["casa", "quinta", "campo", "terreno"]);

const hasValue = (value) =>
  value !== undefined && value !== null && value !== "";

const firstValue = (...values) => values.find(hasValue) ?? "";

const buildStoredParcel = (parcel) => {
  if (!parcel || typeof parcel !== "object" || Array.isArray(parcel)) {
    return null;
  }

  // GeoJSON usa matrices anidadas para sus coordenadas y Firestore no admite
  // arrays directamente dentro de otros arrays. La geometría se conserva en
  // la respuesta en memoria para dibujar la parcela, pero no en el snapshot.
  return Object.fromEntries(
    Object.entries(parcel).filter(([key]) => key !== "geometry"),
  );
};

export const buildParcelSnapshot = (result = {}) => ({
  schemaVersion: 1,
  provider: result.provider || "IDECOR / Mapas Córdoba",
  queriedAt: result.queriedAt || new Date().toISOString(),
  location: result.location || null,
  parcel: buildStoredParcel(result.parcel),
  urbanPlanning: result.urbanPlanning || {
    occupancy: null,
    subdivision: null,
    landUse: null,
  },
  legalNotice: result.legalNotice || "",
  coverageNotice: result.coverageNotice || "",
});

export const getParcelLandArea = (parcel = {}) => firstValue(
  parcel.landAreaUrban,
  parcel.landAreaRural,
);

export const mergeParcelResultIntoInmueble = ({
  values = {},
  result = {},
} = {}) => {
  const parcel = result.parcel || null;
  const currentSurface = values.superficie || {};
  const nextSurface = {...currentSurface};
  const completedFields = [];
  const canUseLandSurface = !values.tipo || LAND_TYPES.has(values.tipo);
  const landArea = getParcelLandArea(parcel || {});

  if (
    parcel &&
    canUseLandSurface &&
    !hasValue(currentSurface.terreno) &&
    hasValue(landArea)
  ) {
    nextSurface.terreno = String(landArea);
    completedFields.push("superficie de terreno");
  }

  return {
    superficie: nextSurface,
    datosParcelarios: buildParcelSnapshot(result),
    completedFields,
  };
};

export const getStoredParcelSummary = (datosParcelarios = {}) => {
  const parcel = datosParcelarios.parcel || {};
  const occupancy = datosParcelarios.urbanPlanning?.occupancy || {};
  const landUse = datosParcelarios.urbanPlanning?.landUse || {};

  return {
    nomenclature: parcel.nomenclature || "",
    accountNumber: parcel.accountNumber || "",
    landArea: getParcelLandArea(parcel),
    improvementsArea: firstValue(parcel.improvementsArea),
    totalValuation: firstValue(parcel.totalValuation),
    zone: firstValue(occupancy.zone, occupancy.designation, landUse.zone),
    fos: firstValue(occupancy.fos),
    fot: firstValue(occupancy.fot),
    permittedUse: firstValue(
      landUse.dominantUse,
      landUse.complementaryUse,
    ),
  };
};
