const SUPPORTED_OPERATIONS = new Set([
  "venta",
  "alquiler",
  "alquiler_temporal",
  "tasacion",
]);

const DIRECT_PROPERTY_TYPES = new Set([
  "casa",
  "departamento",
  "terreno",
  "local",
  "oficina",
  "cochera",
  "campo",
]);

const OTHER_PROPERTY_TYPES = new Set(["deposito", "quinta"]);
const MAX_DESCRIPTION_LENGTH = 1000;

const hasDetectedPath = (detectedFields, path) => (
  detectedFields.includes(path)
);

const hasText = (value) => typeof value === "string" && value.trim() !== "";

const formatPrice = (price, currency) => {
  const normalizedPrice = String(price || "").trim();
  if (!normalizedPrice) return "";

  const numericPrice = Number(normalizedPrice.replace(",", "."));
  const formattedPrice = Number.isFinite(numericPrice)
    ? new Intl.NumberFormat("es-AR", {
      maximumFractionDigits: 2,
    }).format(numericPrice)
    : normalizedPrice;

  if (currency === "ARS") return `$ ${formattedPrice}`;
  if (currency === "USD") return `USD ${formattedPrice}`;
  return formattedPrice;
};

const buildApproximateLocation = (draft = {}, detectedFields = []) => {
  const locationParts = [
    ["direccion.barrio", draft?.direccion?.barrio],
    ["direccion.ciudad", draft?.direccion?.ciudad],
    ["direccion.provincia", draft?.direccion?.provincia],
  ]
    .filter(([path, value]) => hasDetectedPath(detectedFields, path) && hasText(value))
    .map(([, value]) => value.trim());

  return Array.from(new Set(locationParts)).join(", ");
};

const resolveParticularType = (type) => {
  if (DIRECT_PROPERTY_TYPES.has(type)) return type;
  if (OTHER_PROPERTY_TYPES.has(type)) return "otro";
  return "";
};

export const mergeAiDraftIntoParticularPublication = ({
  values = {},
  draft = {},
  detectedFields = [],
  preserveExisting = true,
} = {}) => {
  const detected = Array.from(new Set(
    Array.isArray(detectedFields) ? detectedFields : [],
  ));
  const suggestions = [];

  if (
    hasDetectedPath(detected, "operacion") &&
    SUPPORTED_OPERATIONS.has(draft.operacion)
  ) {
    suggestions.push(["operacion", draft.operacion]);
  }

  if (hasDetectedPath(detected, "tipo")) {
    const propertyType = resolveParticularType(draft.tipo);
    if (propertyType) suggestions.push(["tipo", propertyType]);
  }

  if (hasDetectedPath(detected, "precio")) {
    const price = formatPrice(draft.precio, draft.moneda);
    if (price) suggestions.push(["precioEstimado", price]);
  }

  const approximateLocation = buildApproximateLocation(draft, detected);
  if (approximateLocation) {
    suggestions.push(["ubicacion", approximateLocation]);
  }

  if (hasDetectedPath(detected, "descripcion") && hasText(draft.descripcion)) {
    suggestions.push([
      "descripcion",
      draft.descripcion.trim().slice(0, MAX_DESCRIPTION_LENGTH),
    ]);
  }

  const nextValues = {...values};
  let appliedCount = 0;
  let preservedCount = 0;

  suggestions.forEach(([field, value]) => {
    if (preserveExisting && hasText(nextValues[field])) {
      preservedCount += 1;
      return;
    }

    nextValues[field] = value;
    appliedCount += 1;
  });

  return {
    values: nextValues,
    appliedCount,
    preservedCount,
  };
};

