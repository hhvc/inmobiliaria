export const EMPRENDIMIENTO_TIPOS = [
  { id: "edificio", label: "Edificio" },
  { id: "loteo", label: "Loteo" },
  { id: "barrio_cerrado", label: "Barrio cerrado" },
  { id: "complejo", label: "Complejo inmobiliario" },
  { id: "parque_industrial", label: "Parque industrial" },
  { id: "otro", label: "Otro" },
];

export const EMPRENDIMIENTO_ESTADOS_OBRA = [
  { id: "proyecto", label: "En proyecto" },
  { id: "preventa", label: "Preventa" },
  { id: "en_pozo", label: "En pozo" },
  { id: "en_construccion", label: "En construcción" },
  { id: "terminado", label: "Terminado" },
];

export const EMPRENDIMIENTO_ESTADOS = ["activo", "pausado"];

export const emprendimientoInitialValues = {
  inmobiliariaId: "",
  nombre: "",
  descripcion: "",
  tipo: "edificio",
  desarrollista: "",
  estadoObra: "proyecto",
  avanceObra: 0,
  fechaEntrega: "",
  direccion: {
    calle: "",
    numero: "",
    barrio: "",
    ciudad: "",
    provincia: "Córdoba",
    pais: "Argentina",
    lat: null,
    lng: null,
  },
  financiacion: {
    disponible: false,
    anticipo: "",
    cuotas: "",
    descripcion: "",
  },
  amenities: [],
  servicios: [],
  images: [],
  estado: "activo",
  destacado: false,
  publicarEnPortal: false,
  noIndex: false,
  mostrarUnidadesVendidas: false,
};

const cleanText = (value = "") => value?.toString?.().trim?.() || "";

export const normalizeStringList = (value = []) => {
  const entries = Array.isArray(value)
    ? value
    : value
        .toString()
        .split(/\r?\n|,/g);

  return Array.from(
    new Set(entries.map((entry) => cleanText(entry)).filter(Boolean)),
  );
};

export const normalizeEmprendimiento = (data = {}) => ({
  ...emprendimientoInitialValues,
  ...data,
  nombre: cleanText(data.nombre),
  descripcion: cleanText(data.descripcion),
  desarrollista: cleanText(data.desarrollista),
  avanceObra: Math.min(100, Math.max(0, Number(data.avanceObra) || 0)),
  fechaEntrega: cleanText(data.fechaEntrega),
  direccion: {
    ...emprendimientoInitialValues.direccion,
    ...(data.direccion || {}),
  },
  financiacion: {
    ...emprendimientoInitialValues.financiacion,
    ...(data.financiacion || {}),
    disponible: Boolean(data.financiacion?.disponible),
    anticipo: cleanText(data.financiacion?.anticipo),
    cuotas: cleanText(data.financiacion?.cuotas),
    descripcion: cleanText(data.financiacion?.descripcion),
  },
  amenities: normalizeStringList(data.amenities),
  servicios: normalizeStringList(data.servicios),
  images: Array.isArray(data.images) ? data.images : [],
  destacado: Boolean(data.destacado),
  publicarEnPortal: Boolean(data.publicarEnPortal),
  noIndex: Boolean(data.noIndex),
  mostrarUnidadesVendidas: Boolean(data.mostrarUnidadesVendidas),
});

export const validateEmprendimiento = (data = {}) => {
  const normalized = normalizeEmprendimiento(data);
  const errors = {};

  if (!normalized.inmobiliariaId) {
    errors.inmobiliariaId = "La inmobiliaria es obligatoria";
  }

  if (normalized.nombre.length < 5) {
    errors.nombre = "El nombre debe tener al menos 5 caracteres";
  }

  if (normalized.descripcion.length < 20) {
    errors.descripcion = "La descripción debe tener al menos 20 caracteres";
  }

  if (!EMPRENDIMIENTO_TIPOS.some((item) => item.id === normalized.tipo)) {
    errors.tipo = "Seleccioná un tipo válido";
  }

  if (
    !EMPRENDIMIENTO_ESTADOS_OBRA.some(
      (item) => item.id === normalized.estadoObra,
    )
  ) {
    errors.estadoObra = "Seleccioná un estado de obra válido";
  }

  if (!EMPRENDIMIENTO_ESTADOS.includes(normalized.estado)) {
    errors.estado = "Seleccioná un estado válido";
  }

  if (!normalized.direccion.ciudad?.trim?.()) {
    errors.ciudad = "La ciudad es obligatoria";
  }

  return errors;
};

export const getEmprendimientoTypeLabel = (tipo = "") =>
  EMPRENDIMIENTO_TIPOS.find((item) => item.id === tipo)?.label || tipo;

export const getEmprendimientoStatusLabel = (estado = "") =>
  EMPRENDIMIENTO_ESTADOS_OBRA.find((item) => item.id === estado)?.label ||
  estado;
