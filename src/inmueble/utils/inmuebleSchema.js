/**
 * Schema base para Inmuebles
 * Fuente única de verdad para:
 * - formularios
 * - selects
 * - validaciones
 * - normalización de datos
 */

/* =========================
   Operaciones
   ========================= */

export const OPERACIONES_OPCIONES = [
  { id: "venta", label: "Venta" },
  { id: "alquiler", label: "Alquiler" },
  { id: "alquiler_temporal", label: "Alquiler Temporal" },
  { id: "compra", label: "Compra" },
  { id: "tasacion", label: "Tasación" },
];

export const OPERACIONES_IDS = OPERACIONES_OPCIONES.map((op) => op.id);

/* =========================
   Tipos de inmueble
   ========================= */

export const TIPOS_INMUEBLE_OPCIONES = [
  { id: "casa", label: "Casa" },
  { id: "departamento", label: "Departamento" },
  { id: "terreno", label: "Terreno" },
  { id: "local", label: "Local" },
  { id: "oficina", label: "Oficina" },
  { id: "cochera", label: "Cochera" },
  { id: "deposito", label: "Depósito" },
  { id: "quinta", label: "Quinta" },
  { id: "campo", label: "Campo" },
];

export const TIPOS_INMUEBLE_IDS = TIPOS_INMUEBLE_OPCIONES.map((t) => t.id);

/* =========================
   Estados de publicación
   ========================= */

export const INMUEBLE_ESTADOS = [
  "borrador",
  "publicado",
  "pausado",
  "vendido",
  "alquilado",
];

/* =========================
   Valores iniciales
   ========================= */

export const inmuebleInitialValues = {
  /* ===== Relación (Patrón Híbrido) ===== */
  inmobiliariaId: null, // dueña principal
  sharedWith: [], // inmobiliarias con acceso
  visibility: "privado", // privado | compartido
  createdBy: null, // uid del usuario creador

  /* ===== Identidad ===== */
  titulo: "",
  descripcion: "",

  /* ===== Clasificación ===== */
  tipo: "casa",
  operacion: "venta",
  estado: "borrador",

  /* ===== Precio ===== */
  precio: "",
  moneda: "USD",
  expensas: "",

  /* ===== Ubicación ===== */
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

  /* ===== Superficie (m²) ===== */
  superficie: {
    total: "",
    cubierta: "",
    descubierta: "",
  },

  /* ===== Ambientes ===== */
  ambientes: "",
  dormitorios: "",
  banos: "",
  toilettes: "",
  cocheras: "",

  /* ===== Características ===== */
  antiguedad: "",
  orientacion: "",
  disposicion: "",
  pisos: "",
  aptoCredito: false,
  aptoProfesional: false,
  aceptaMascotas: false,

  /* ===== Servicios ===== */
  servicios: {
    agua: false,
    luz: false,
    gas: false,
    cloacas: false,
    internet: false,
    pavimento: false,
  },

  /* ===== Imágenes ===== */
  images: [],

  /* ===== Publicación ===== */
  destacado: false,
  orden: 0,

  /* ===== Auditoría ===== */
  createdAt: null,
  updatedAt: null,
};

/* =========================
   Normalización
   ========================= */

export const normalizeInmuebleData = (data) => {
  return {
    ...data,

    precio: data.precio !== "" ? Number(data.precio) : null,
    expensas: data.expensas !== "" ? Number(data.expensas) : null,

    superficie: {
      total:
        data.superficie.total !== "" ? Number(data.superficie.total) : null,
      cubierta:
        data.superficie.cubierta !== ""
          ? Number(data.superficie.cubierta)
          : null,
      descubierta:
        data.superficie.descubierta !== ""
          ? Number(data.superficie.descubierta)
          : null,
    },

    ambientes: data.ambientes !== "" ? Number(data.ambientes) : null,
    dormitorios: data.dormitorios !== "" ? Number(data.dormitorios) : null,
    banos: data.banos !== "" ? Number(data.banos) : null,
    toilettes: data.toilettes !== "" ? Number(data.toilettes) : null,
    cocheras: data.cocheras !== "" ? Number(data.cocheras) : null,
    antiguedad: data.antiguedad !== "" ? Number(data.antiguedad) : null,
    pisos: data.pisos !== "" ? Number(data.pisos) : null,

    updatedAt: new Date(),
  };
};

/* =========================
   Validaciones mínimas
   ========================= */

export const validateInmueble = (data) => {
  const errors = {};

  if (!data.inmobiliariaId) {
    errors.inmobiliariaId = "La inmobiliaria es obligatoria";
  }

  if (!data.titulo || data.titulo.trim().length < 5) {
    errors.titulo = "El título es obligatorio (mín. 5 caracteres)";
  }

  if (!TIPOS_INMUEBLE_IDS.includes(data.tipo)) {
    errors.tipo = "Seleccioná un tipo de inmueble válido";
  }

  if (!OPERACIONES_IDS.includes(data.operacion)) {
    errors.operacion = "Seleccioná una operación válida";
  }

  if (data.operacion !== "tasacion" && !data.precio) {
    errors.precio = "El precio es obligatorio";
  }

  if (!data.direccion.ciudad) {
    errors.ciudad = "La ciudad es obligatoria";
  }

  return errors;
};
