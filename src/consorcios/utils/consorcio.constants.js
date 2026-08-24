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

export const CONSORTIUM_SUPPLIER_CATEGORIES = [
  { id: "maintenance", label: "Mantenimiento y reparaciones" },
  { id: "utilities", label: "Servicios públicos" },
  { id: "professional", label: "Servicios profesionales" },
  { id: "insurance", label: "Seguros" },
  { id: "staff", label: "Personal y cargas sociales" },
  { id: "taxes", label: "Impuestos y tasas" },
  { id: "other", label: "Otros" },
];

export const CONSORTIUM_TREASURY_ACCOUNT_TYPES = [
  { id: "bank", label: "Cuenta bancaria" },
  { id: "cash", label: "Caja" },
  { id: "wallet", label: "Billetera virtual" },
  { id: "reserve", label: "Fondo de reserva" },
  { id: "other", label: "Otra cuenta" },
];

export const CONSORTIUM_SUPPLIER_OBLIGATION_STATUSES = [
  { id: "pending", label: "Pendiente", badge: "text-bg-warning" },
  { id: "overdue", label: "Vencida", badge: "text-bg-danger" },
  { id: "partial", label: "Pago parcial", badge: "text-bg-info" },
  { id: "partial_overdue", label: "Vencida con pago parcial", badge: "text-bg-danger" },
  { id: "paid", label: "Pagada", badge: "text-bg-success" },
  { id: "voided", label: "Anulada", badge: "text-bg-secondary" },
];

export const CONSORTIUM_CLAIM_CATEGORIES = [
  { id: "plumbing", label: "Agua y plomería" },
  { id: "electricity", label: "Electricidad" },
  { id: "gas", label: "Gas" },
  { id: "elevator", label: "Ascensores" },
  { id: "security", label: "Seguridad y accesos" },
  { id: "cleaning", label: "Limpieza" },
  { id: "common_area", label: "Espacios comunes" },
  { id: "administration", label: "Consulta administrativa" },
  { id: "other", label: "Otro" },
];

export const CONSORTIUM_COMMUNICATION_TYPES = [
  {
    id: "notice",
    label: "Denuncia o aviso",
    description: "Informar una situación, un riesgo o un posible incumplimiento.",
    badge: "text-bg-danger",
  },
  {
    id: "request",
    label: "Solicitud",
    description: "Pedir una gestión, autorización, reparación o información.",
    badge: "text-bg-primary",
  },
  {
    id: "claim",
    label: "Reclamo",
    description: "Manifestar una disconformidad y solicitar una respuesta o solución.",
    badge: "text-bg-warning",
  },
];

export const CONSORTIUM_CLAIM_PRIORITIES = [
  { id: "low", label: "Baja", badge: "text-bg-light border" },
  { id: "normal", label: "Normal", badge: "text-bg-secondary" },
  { id: "high", label: "Alta", badge: "text-bg-warning" },
  { id: "urgent", label: "Urgente", badge: "text-bg-danger" },
];

export const CONSORTIUM_CLAIM_STATUSES = [
  { id: "open", label: "Recibido", badge: "text-bg-primary" },
  { id: "in_review", label: "En revisión", badge: "text-bg-info" },
  { id: "scheduled", label: "Visita programada", badge: "text-bg-warning" },
  { id: "in_progress", label: "En curso", badge: "text-bg-warning" },
  { id: "resolved", label: "Resuelto", badge: "text-bg-success" },
  { id: "closed", label: "Cerrado", badge: "text-bg-dark" },
  { id: "rejected", label: "No corresponde", badge: "text-bg-secondary" },
];

export const getConsortiumSupplierCategory = (category = "other") =>
  CONSORTIUM_SUPPLIER_CATEGORIES.find((item) => item.id === category)
  || CONSORTIUM_SUPPLIER_CATEGORIES.at(-1);

export const getConsortiumTreasuryAccountType = (type = "bank") =>
  CONSORTIUM_TREASURY_ACCOUNT_TYPES.find((item) => item.id === type)
  || CONSORTIUM_TREASURY_ACCOUNT_TYPES[0];

export const getConsortiumSupplierObligationState = (status = "pending") =>
  CONSORTIUM_SUPPLIER_OBLIGATION_STATUSES.find((item) => item.id === status)
  || CONSORTIUM_SUPPLIER_OBLIGATION_STATUSES[0];

export const getConsortiumClaimCategory = (category = "other") =>
  CONSORTIUM_CLAIM_CATEGORIES.find((item) => item.id === category)
  || CONSORTIUM_CLAIM_CATEGORIES.at(-1);

export const getConsortiumCommunicationType = (type = "claim") =>
  CONSORTIUM_COMMUNICATION_TYPES.find((item) => item.id === type)
  || CONSORTIUM_COMMUNICATION_TYPES.at(-1);

export const getConsortiumClaimPriority = (priority = "normal") =>
  CONSORTIUM_CLAIM_PRIORITIES.find((item) => item.id === priority)
  || CONSORTIUM_CLAIM_PRIORITIES[1];

export const getConsortiumClaimStatus = (status = "open") =>
  CONSORTIUM_CLAIM_STATUSES.find((item) => item.id === status)
  || CONSORTIUM_CLAIM_STATUSES[0];

export const CONSORTIUM_DOCUMENT_ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp";

export const getConsortiumStatus = (status = "active") =>
  CONSORTIUM_STATUSES.find((item) => item.id === status)
  || CONSORTIUM_STATUSES[0];

export const getConsortiumPeriodStatus = (status = "draft") =>
  CONSORTIUM_PERIOD_STATUSES.find((item) => item.id === status)
  || CONSORTIUM_PERIOD_STATUSES[0];
