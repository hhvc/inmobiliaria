export const PUBLIC_UNIT_AVAILABILITY = {
  disponible: { label: "Disponible", badgeClass: "text-bg-success" },
  reservada: { label: "Reservada", badgeClass: "text-bg-warning" },
  vendida: { label: "Vendida", badgeClass: "text-bg-primary" },
  no_disponible: { label: "No disponible", badgeClass: "text-bg-secondary" },
};

export const PUBLIC_UNIT_INITIAL_FILTERS = {
  tipologia: "",
  dormitorios: "",
  superficieMin: "",
  moneda: "",
  precioMax: "",
  disponibilidad: "",
};

const cleanText = (value = "") => value?.toString?.().trim?.() || "";

const toNumberOrNull = (value) => {
  if (value === "" || value === null || value === undefined) return null;
  const number = Number(value?.toString?.().replace?.(",", "."));
  return Number.isFinite(number) ? number : null;
};

export const getPublicUnitAvailability = (unit = {}) =>
  cleanText(unit.unidadEmprendimiento?.disponibilidad) || "disponible";

export const getPublicUnitCode = (unit = {}) =>
  cleanText(unit.unidadEmprendimiento?.codigo) || "Sin código";

export const getPublicUnitTypology = (unit = {}) =>
  cleanText(unit.unidadEmprendimiento?.tipologia) ||
  cleanText(unit.tipo) ||
  "Sin tipología";

export const getPublicUnitBedrooms = (unit = {}) =>
  unit.caracteristicas?.dormitorios ?? unit.dormitorios ?? "";

export const getPublicUnitSurface = (unit = {}) => {
  const total = toNumberOrNull(unit.superficie?.total);
  return total ?? toNumberOrNull(unit.superficie?.cubierta);
};

export const getPublicUnitPrice = (unit = {}) => toNumberOrNull(unit.precio);

export const isPublicUnitContactable = (unit = {}) =>
  ["disponible", "reservada"].includes(getPublicUnitAvailability(unit));

export const getConfiguredPublicUnits = (
  units = [],
  { showSold = false } = {},
) =>
  (Array.isArray(units) ? units : []).filter(
    (unit) => showSold || getPublicUnitAvailability(unit) !== "vendida",
  );

const uniqueSorted = (values = [], compare) =>
  [...new Set(values.filter((value) => value !== "" && value !== null))].sort(
    compare,
  );

export const getPublicUnitFilterOptions = (units = []) => ({
  typologies: uniqueSorted(
    units.map(getPublicUnitTypology),
    (a, b) => a.localeCompare(b, "es"),
  ),
  bedrooms: uniqueSorted(
    units.map(getPublicUnitBedrooms).map((value) => cleanText(value)),
    (a, b) => Number(a) - Number(b),
  ),
  currencies: uniqueSorted(
    units.map((unit) => cleanText(unit.moneda).toUpperCase() || "USD"),
    (a, b) => a.localeCompare(b),
  ),
});

const availabilityRank = {
  disponible: 0,
  reservada: 1,
  no_disponible: 2,
  vendida: 3,
};

export const filterPublicUnits = (units = [], filters = {}) => {
  const normalizedFilters = {
    ...PUBLIC_UNIT_INITIAL_FILTERS,
    ...(filters || {}),
  };
  const minSurface = toNumberOrNull(normalizedFilters.superficieMin);
  const maxPrice = toNumberOrNull(normalizedFilters.precioMax);

  return [...units]
    .filter((unit) =>
      normalizedFilters.tipologia
        ? getPublicUnitTypology(unit) === normalizedFilters.tipologia
        : true,
    )
    .filter((unit) =>
      normalizedFilters.dormitorios
        ? cleanText(getPublicUnitBedrooms(unit)) ===
          cleanText(normalizedFilters.dormitorios)
        : true,
    )
    .filter((unit) => {
      if (minSurface === null) return true;
      const surface = getPublicUnitSurface(unit);
      return surface !== null && surface >= minSurface;
    })
    .filter((unit) => {
      if (!normalizedFilters.moneda) return true;
      return (
        (cleanText(unit.moneda).toUpperCase() || "USD") ===
        normalizedFilters.moneda
      );
    })
    .filter((unit) => {
      if (maxPrice === null) return true;
      const price = getPublicUnitPrice(unit);
      return price !== null && price <= maxPrice;
    })
    .filter((unit) =>
      normalizedFilters.disponibilidad
        ? getPublicUnitAvailability(unit) ===
          normalizedFilters.disponibilidad
        : true,
    )
    .sort((a, b) => {
      const statusDifference =
        (availabilityRank[getPublicUnitAvailability(a)] ?? 9) -
        (availabilityRank[getPublicUnitAvailability(b)] ?? 9);
      if (statusDifference !== 0) return statusDifference;

      const priceA = getPublicUnitPrice(a) ?? Number.POSITIVE_INFINITY;
      const priceB = getPublicUnitPrice(b) ?? Number.POSITIVE_INFINITY;
      if (priceA !== priceB) return priceA - priceB;

      return getPublicUnitCode(a).localeCompare(getPublicUnitCode(b), "es");
    });
};

export const getPublicUnitSummary = (units = []) => {
  const summary = {
    total: units.length,
    disponible: 0,
    reservada: 0,
    vendida: 0,
    no_disponible: 0,
    minPrices: {},
    minSurface: null,
    maxSurface: null,
  };

  units.forEach((unit) => {
    const availability = getPublicUnitAvailability(unit);
    summary[availability] = (summary[availability] || 0) + 1;

    const price = getPublicUnitPrice(unit);
    if (price !== null && isPublicUnitContactable(unit)) {
      const currency = cleanText(unit.moneda).toUpperCase() || "USD";
      const currentMinimum = summary.minPrices[currency];
      summary.minPrices[currency] =
        currentMinimum === undefined ? price : Math.min(currentMinimum, price);
    }

    const surface = getPublicUnitSurface(unit);
    if (surface !== null) {
      summary.minSurface =
        summary.minSurface === null
          ? surface
          : Math.min(summary.minSurface, surface);
      summary.maxSurface =
        summary.maxSurface === null
          ? surface
          : Math.max(summary.maxSurface, surface);
    }
  });

  return summary;
};

export const buildPublicUnitConsultationMessage = ({
  developmentName = "",
  unit = null,
} = {}) => {
  if (!unit) {
    return developmentName
      ? `Quiero recibir información sobre el emprendimiento ${developmentName}.`
      : "Quiero recibir información sobre este emprendimiento.";
  }

  const code = getPublicUnitCode(unit);
  const typology = getPublicUnitTypology(unit);
  const project = cleanText(developmentName);

  return `Quiero consultar por la unidad ${code} (${typology})${
    project ? ` del emprendimiento ${project}` : ""
  }.`;
};
