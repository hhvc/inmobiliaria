export const TAX_PROVIDERS = [
  {
    id: "municipalidad_cordoba",
    authorityName: "Municipalidad de Córdoba",
    jurisdictionLevel: "municipal",
    jurisdictionCode: "AR-X-CORDOBA-CAPITAL",
    taxType: "municipal_property",
    taxTypeLabel: "Contribución municipal sobre inmuebles",
    officialPortalUrl: "https://pagosmuni.cordoba.gob.ar/",
    integrationMode: "official_link",
    identifierTypes: [
      { id: "cadastral_designation", label: "Designación catastral municipal" },
      { id: "municipal_object_id", label: "ID de objeto municipal" },
    ],
  },
  {
    id: "rentas_cordoba",
    authorityName: "Rentas Córdoba",
    jurisdictionLevel: "provincial",
    jurisdictionCode: "AR-X",
    taxType: "provincial_property",
    taxTypeLabel: "Impuesto inmobiliario provincial",
    officialPortalUrl: "https://www.rentascordoba.gob.ar/",
    integrationMode: "official_link",
    identifierTypes: [
      { id: "provincial_account", label: "Número de cuenta" },
      { id: "provincial_registration", label: "Matrícula provincial" },
      { id: "cadastral_nomenclature", label: "Nomenclatura catastral" },
    ],
  },
  {
    id: "other",
    authorityName: "Otro organismo",
    jurisdictionLevel: "other",
    jurisdictionCode: "",
    taxType: "other",
    taxTypeLabel: "Otra obligación vinculada al inmueble",
    officialPortalUrl: "",
    integrationMode: "manual",
    identifierTypes: [
      { id: "account", label: "Cuenta, partida o identificador" },
    ],
  },
];

export const TAX_OBJECT_STATUS_OPTIONS = [
  { id: "active", label: "Activo" },
  { id: "archived", label: "Archivado" },
];

export const TAX_OBLIGATION_STATUS_OPTIONS = [
  { id: "pending", label: "Pendiente" },
  { id: "overdue", label: "Vencida" },
  { id: "payment_pending", label: "Pago informado" },
  { id: "disputed", label: "Observada / reclamada" },
  { id: "paid", label: "Pagada" },
  { id: "cancelled", label: "Anulada" },
];

export const TAX_REPRESENTATION_STATUS_OPTIONS = [
  { id: "not_required", label: "Consulta pública / no requerida" },
  { id: "pending", label: "Autorización pendiente" },
  { id: "authorized", label: "Autorización vigente" },
  { id: "expired", label: "Autorización vencida" },
  { id: "revoked", label: "Autorización revocada" },
];

export const TAX_STATUS_LABELS = Object.fromEntries(
  TAX_OBLIGATION_STATUS_OPTIONS.map((item) => [item.id, item.label]),
);

export const TAX_STATUS_BADGES = {
  pending: "text-bg-warning",
  overdue: "text-bg-danger",
  payment_pending: "text-bg-info",
  disputed: "text-bg-secondary",
  paid: "text-bg-success",
  cancelled: "text-bg-light border text-dark",
};

export const TAX_NOTIFICATION_DEFAULT_SETTINGS = Object.freeze({
  enabled: true,
  inAppEnabled: true,
  emailEnabled: false,
  overdueAlert: true,
  recipientEmails: [],
  timezone: "America/Argentina/Buenos_Aires",
});

export const TAX_NOTIFICATION_TYPE_LABELS = {
  tax_due_reminder: "Próximo vencimiento",
  tax_due_today: "Vence hoy",
  tax_overdue: "Obligación vencida",
};

export const getTaxProvider = (providerId = "") => (
  TAX_PROVIDERS.find((provider) => provider.id === providerId) || TAX_PROVIDERS.at(-1)
);
