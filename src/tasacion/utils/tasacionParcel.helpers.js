import {buildParcelSnapshot, getParcelLandArea} from
  "../../inmueble/utils/inmuebleParcel.helpers.js";

const LAND_TYPOLOGIES = new Set(["casa", "terreno", "otro"]);

const hasValue = (value) =>
  value !== undefined && value !== null && value !== "";

const sourceValue = (...values) => values.find(hasValue) ?? "";

export const mergeParcelResultIntoTasacion = ({
  tasacion = {},
  result = {},
} = {}) => {
  const parcel = result.parcel || null;
  const occupancy = result.urbanPlanning?.occupancy || {};
  const landUse = result.urbanPlanning?.landUse || {};
  const currentInspection = tasacion.inspection || {};
  const currentScope = tasacion.scope || {};
  const currentSubject = tasacion.subject || {};
  const currentSurfaces = currentSubject.surfaces || {};
  const landArea = getParcelLandArea(parcel || {});
  const canCompleteLand = LAND_TYPOLOGIES.has(currentSubject.typology);
  const completedFields = [];

  const cadastralNomenclature = sourceValue(
    currentScope.cadastralNomenclature,
    parcel?.nomenclature,
  );
  if (!hasValue(currentScope.cadastralNomenclature) && parcel?.nomenclature) {
    completedFields.push("nomenclatura catastral");
  }

  const zone = sourceValue(
    currentInspection.zoning?.code,
    occupancy.zone,
    occupancy.designation,
    landUse.zone,
  );
  const fot = sourceValue(currentInspection.zoning?.fot, occupancy.fot);
  const fos = sourceValue(currentInspection.zoning?.fos, occupancy.fos);
  const permittedUse = sourceValue(
    currentInspection.zoning?.permittedUse,
    landUse.dominantUse,
    landUse.complementaryUse,
  );
  if (!hasValue(currentInspection.zoning?.code) && zone) completedFields.push("zona");
  if (!hasValue(currentInspection.zoning?.fot) && hasValue(fot)) completedFields.push("FOT");
  if (!hasValue(currentInspection.zoning?.fos) && hasValue(fos)) completedFields.push("FOS");
  if (!hasValue(currentInspection.zoning?.permittedUse) && permittedUse) {
    completedFields.push("uso del suelo");
  }

  const terrainSurface =
    canCompleteLand && !hasValue(currentSurfaces.terreno) && hasValue(landArea)
      ? String(landArea)
      : currentSurfaces.terreno;
  if (terrainSurface !== currentSurfaces.terreno) {
    completedFields.push("superficie de terreno");
  }

  return {
    tasacion: {
      ...tasacion,
      scope: {
        ...currentScope,
        cadastralNomenclature,
      },
      inspection: {
        ...currentInspection,
        zoning: {
          ...(currentInspection.zoning || {}),
          code: zone,
          fot,
          fos,
          permittedUse,
        },
        parcelData: buildParcelSnapshot(result),
      },
      subject: {
        ...currentSubject,
        surfaces: {
          ...currentSurfaces,
          terreno: terrainSurface,
        },
      },
    },
    completedFields,
  };
};
