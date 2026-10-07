const GROUP_LABELS = {
  direccion: "Ubicación",
  superficie: "Superficie",
  caracteristicas: "Características",
  amenities: "Amenities",
  servicios: "Servicios",
  medidas: "Medidas",
};

const FIELD_LABELS = {
  titulo: "Título",
  descripcion: "Descripción",
  tipo: "Tipo",
  operacion: "Operación",
  precio: "Precio",
  moneda: "Moneda",
  expensas: "Expensas",
  calle: "Calle",
  numero: "Número",
  barrio: "Barrio",
  ciudad: "Ciudad",
  provincia: "Provincia",
  pais: "País",
  total: "Superficie total",
  cubierta: "Superficie cubierta",
  semicubierta: "Superficie semicubierta",
  descubierta: "Superficie descubierta",
  terreno: "Terreno",
  ambientes: "Ambientes",
  dormitorios: "Dormitorios",
  banos: "Baños",
  toilettes: "Toilettes",
  cocheras: "Cochera",
  cocherasCantidad: "Cantidad de cocheras",
  plantas: "Plantas",
  antiguedad: "Antigüedad",
  orientacion: "Orientación",
  estadoConservacion: "Estado de conservación",
  piso: "Piso",
  departamento: "Departamento",
  piscina: "Piscina",
  patio: "Patio",
  jardin: "Jardín",
  quincho: "Quincho",
  parrilla: "Parrilla",
  terraza: "Terraza",
  balcon: "Balcón",
  lavadero: "Lavadero",
  dependencia: "Dependencia",
  escritorio: "Escritorio",
  vestidor: "Vestidor",
  calefaccion: "Calefacción",
  aireAcondicionado: "Aire acondicionado",
  seguridad: "Seguridad",
  alarma: "Alarma",
  aptoCredito: "Apto crédito",
  aptoMascotas: "Apto mascotas",
  amoblado: "Amoblado",
  ascensor: "Ascensor",
  aptoProfesional: "Apto profesional",
  agua: "Agua",
  luz: "Luz",
  gas: "Gas",
  cloacas: "Cloacas",
  internet: "Internet",
  pavimento: "Pavimento",
  telefono: "Teléfono",
  frente: "Frente",
  fondo: "Fondo",
  alturaTecho: "Altura de techo",
  hectareas: "Hectáreas",
};

const DEFAULT_PLACEHOLDER_VALUES = {
  moneda: "USD",
  "direccion.provincia": "Córdoba",
  "direccion.pais": "Argentina",
};

const getPathValue = (source, path) => path.split(".").reduce(
  (value, key) => value?.[key],
  source,
);

const isEmptyValue = (value, path) => {
  if (value === undefined || value === null || value === "") return true;
  if (typeof value === "boolean") return value === false;

  const placeholder = DEFAULT_PLACEHOLDER_VALUES[path];
  return placeholder !== undefined && value === placeholder;
};

const setPathValue = (target, path, value) => {
  const keys = path.split(".");
  if (keys.length === 1) {
    return {
      ...target,
      [keys[0]]: value,
    };
  }

  const [group, field] = keys;
  return {
    ...target,
    [group]: {
      ...(target?.[group] || {}),
      [field]: value,
    },
  };
};

export const getAiDraftFieldLabel = (path = "") => {
  const parts = path.split(".");
  const field = parts.at(-1) || path;
  const fieldLabel = FIELD_LABELS[field] || field;

  if (parts.length < 2 || ["titulo", "descripcion"].includes(path)) {
    return fieldLabel;
  }

  return `${GROUP_LABELS[parts[0]] || parts[0]}: ${fieldLabel}`;
};

export const getAiDraftFieldValue = (draft, path) => getPathValue(draft, path);

export const appendAiSourceTranscript = (
  sourceText = "",
  transcript = "",
  maxLength = 6000,
) => {
  const current = typeof sourceText === "string" ? sourceText.trimEnd() : "";
  const addition = typeof transcript === "string"
    ? transcript.replace(/\s+/g, " ").trim()
    : "";

  if (!addition) return current.slice(0, maxLength);
  return `${current}${current ? " " : ""}${addition}`.slice(0, maxLength);
};

export const getDefaultSelectedAiDraftFieldPaths = ({
  detectedFields = [],
  fieldAssessments = [],
} = {}) => {
  const confidenceByPath = new Map(
    (Array.isArray(fieldAssessments) ? fieldAssessments : [])
      .map((item) => [item?.path, item?.confidence]),
  );

  return Array.from(new Set(
    Array.isArray(detectedFields) ? detectedFields : [],
  )).filter((path) => confidenceByPath.get(path) !== "low");
};

export const mergeAiDraftIntoInmuebleValues = ({
  values = {},
  draft = {},
  detectedFields = [],
  preserveExisting = true,
} = {}) => {
  let nextValues = {...values};
  let appliedCount = 0;
  let preservedCount = 0;

  Array.from(new Set(Array.isArray(detectedFields) ? detectedFields : []))
    .forEach((path) => {
      const nextValue = getPathValue(draft, path);
      if (nextValue === undefined || nextValue === null || nextValue === "") {
        return;
      }

      const currentValue = getPathValue(nextValues, path);
      if (preserveExisting && !isEmptyValue(currentValue, path)) {
        preservedCount += 1;
        return;
      }

      nextValues = setPathValue(nextValues, path, nextValue);
      appliedCount += 1;
    });

  const cocherasCantidad = nextValues?.caracteristicas?.cocherasCantidad;
  if (cocherasCantidad && nextValues?.caracteristicas?.cocheras !== true) {
    nextValues = setPathValue(nextValues, "caracteristicas.cocheras", true);
  }

  return {
    values: nextValues,
    appliedCount,
    preservedCount,
  };
};

