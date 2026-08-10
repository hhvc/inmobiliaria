export const CONSORTIUM_STATUSES = [
  { id: "active", label: "Activo", badge: "text-bg-success" },
  { id: "archived", label: "Archivado", badge: "text-bg-secondary" },
];

export const CONSORTIUM_UNIT_TYPES = [
  { id: "apartment", label: "Departamento" },
  { id: "office", label: "Oficina" },
  { id: "commercial", label: "Local" },
  { id: "garage", label: "Cochera" },
  { id: "storage", label: "Baulera" },
  { id: "other", label: "Otra unidad" },
];

export const CONSORTIUM_EXPENSE_CATEGORIES = [
  { id: "ordinary", label: "Ordinaria" },
  { id: "extraordinary", label: "Extraordinaria" },
];

export const CONSORTIUM_DISTRIBUTION_MODES = [
  { id: "coefficient", label: "Por coeficiente" },
  { id: "equal", label: "Partes iguales" },
  { id: "specific", label: "Unidad determinada" },
];

export const CONSORTIUM_PERIOD_STATUSES = [
  { id: "draft", label: "Borrador", badge: "text-bg-secondary" },
  { id: "issued", label: "Emitida", badge: "text-bg-primary" },
  { id: "closed", label: "Cerrada", badge: "text-bg-success" },
];

export const CONSORTIUM_PAYMENT_METHODS = [
  { id: "transfer", label: "Transferencia" },
  { id: "cash", label: "Efectivo" },
  { id: "deposit", label: "Depósito" },
  { id: "card", label: "Tarjeta / plataforma" },
  { id: "other", label: "Otro" },
];

export const CONSORTIUM_DOCUMENT_ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp";

export const getConsortiumStatus = (status = "active") =>
  CONSORTIUM_STATUSES.find((item) => item.id === status)
  || CONSORTIUM_STATUSES[0];

export const getConsortiumPeriodStatus = (status = "draft") =>
  CONSORTIUM_PERIOD_STATUSES.find((item) => item.id === status)
  || CONSORTIUM_PERIOD_STATUSES[0];
