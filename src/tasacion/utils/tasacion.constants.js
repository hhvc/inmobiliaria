export const TASACION_ENGINE_VERSION = "onoprop-tasaciones-1.0.0";

export const TASACION_ESTADOS = [
  { id: "borrador", label: "Borrador", badge: "text-bg-secondary" },
  { id: "en_revision", label: "En revisión", badge: "text-bg-warning" },
  { id: "observada", label: "Observada", badge: "text-bg-danger" },
  { id: "aprobada", label: "Aprobada", badge: "text-bg-success" },
  { id: "emitida", label: "Emitida", badge: "text-bg-primary" },
  { id: "entregada", label: "Entregada", badge: "text-bg-info" },
  { id: "anulada", label: "Anulada", badge: "text-bg-dark" },
];

export const TASACION_TIPOS_INFORME = [
  {
    id: "estimacion_comercial",
    label: "Estimación comercial",
    help: "Orientativa. No declara aptitud hipotecaria ni reemplaza una tasación firmada.",
  },
  {
    id: "tasacion_profesional",
    label: "Tasación profesional",
    help: "Requiere inspección, revisión y firma de un profesional competente.",
  },
  {
    id: "garantia_hipotecaria",
    label: "Garantía hipotecaria",
    help: "Agrega valor de realización y simulaciones; queda sujeta a aceptación de la entidad financiera.",
  },
];

export const TASACION_FINALIDADES = [
  { id: "venta", label: "Venta o adquisición" },
  { id: "garantia", label: "Garantía hipotecaria" },
  { id: "particion", label: "Partición o acuerdo privado" },
  { id: "contable", label: "Valuación técnico-contable" },
  { id: "otro", label: "Otra finalidad" },
];

export const TASACION_TIPOLOGIAS = [
  { id: "departamento", label: "Departamento" },
  { id: "ph", label: "PH" },
  { id: "oficina", label: "Oficina" },
  { id: "casa", label: "Casa / chalet" },
  { id: "local", label: "Local comercial" },
  { id: "terreno", label: "Terreno / lote" },
  { id: "otro", label: "Otro inmueble urbano" },
];

export const TASACION_POSICIONES_LOTE = [
  { id: "medianero", label: "Medianero / entre medianeras" },
  { id: "esquina", label: "Esquina" },
  { id: "doble_frente", label: "Doble frente sobre calles opuestas" },
  { id: "interno", label: "Interno con acceso propio" },
  { id: "irregular", label: "Irregular / configuración especial" },
  { id: "no_aplica", label: "No aplica" },
];

export const TASACION_MONEDAS = [
  { id: "ARS", label: "Peso argentino (ARS)" },
  { id: "USD", label: "Dólar estadounidense (USD)" },
  { id: "EUR", label: "Euro (EUR)" },
  { id: "OTRA", label: "Otra moneda" },
];

export const TASACION_METODOS = [
  { id: "comparativo", label: "Comparativo directo" },
  { id: "costo", label: "Costo separativo (suelo + mejoras)" },
  { id: "residual", label: "Residual", disabled: true },
  { id: "renta", label: "Capitalización de renta", disabled: true },
];

export const ROSS_HEIDECKE_ESTADOS = [
  { id: "1", value: 1, label: "1,0 · Excelente", baseDepreciation: 0 },
  { id: "1.5", value: 1.5, label: "1,5 · Muy buena", baseDepreciation: 0.032 },
  { id: "2", value: 2, label: "2,0 · Buena", baseDepreciation: 2.52 },
  { id: "2.5", value: 2.5, label: "2,5 · Normal", baseDepreciation: 8.09 },
  { id: "3", value: 3, label: "3,0 · Regular", baseDepreciation: 18.1 },
  { id: "3.5", value: 3.5, label: "3,5 · Mala", baseDepreciation: 33.2 },
  { id: "4", value: 4, label: "4,0 · Muy mala", baseDepreciation: 52.6 },
  { id: "4.5", value: 4.5, label: "4,5 · Demolición", baseDepreciation: 75.2 },
  { id: "5", value: 5, label: "5,0 · Irrecuperable", baseDepreciation: 100 },
];

export const COMPARABLE_TIPOS_DATO = [
  { id: "venta", label: "Venta verificada" },
  { id: "oferta_aceptada", label: "Oferta aceptada" },
  { id: "publicacion", label: "Publicación / precio pedido" },
];

export const COMPARATIVE_UNIT_BASES = [
  {
    id: "auto",
    label: "Automática según el inmueble",
    help: "Usa superficie construida ponderada cuando existe; para lotes vacíos usa terreno.",
  },
  {
    id: "construction_weighted",
    label: "Superficie construida ponderada",
    help: "Cubierta + semicubierta, balcón y descubierta con sus ponderadores configurados.",
  },
  {
    id: "land",
    label: "Superficie de terreno",
    help: "Calcula el valor unitario por metro cuadrado de lote.",
  },
];

export const DEFAULT_TASACION_PARAMETERS = Object.freeze({
  version: "ttn-res-80-2025-onoprop-1",
  sourceLabel: "Perfil técnico ONO Prop basado en el Digesto NNV consolidado por Resolución TTN 80/2025",
  surfaceWeights: {
    cubierta: 1,
    semicubierta: 0.5,
    balcon: 0.5,
    descubierta: 0.2,
  },
  defaultOfferFactor: 0.92,
  quickSaleFactor: 0.85,
  quickSaleReferenceRange: { min: 0.8, max: 0.95 },
  minimumComparables: 3,
  recommendedComparables: 5,
  defaultResidualPercent: 5,
  defaultGuaranteeFactors: {
    vivienda_propia: 0.75,
    otros_usos: 0.5,
  },
});

export const TASACION_STEPS = [
  { id: 1, label: "Encargo y legal" },
  { id: 2, label: "Inspección y entorno" },
  { id: 3, label: "Características" },
  { id: 4, label: "Evidencia y métodos" },
  { id: 5, label: "Reconciliación" },
];

export const getTasacionEstado = (estado = "borrador") =>
  TASACION_ESTADOS.find((item) => item.id === estado) || TASACION_ESTADOS[0];
