export const CONSORTIUM_PORTAL_VISIBILITIES = [
  { id: "all", label: "Propietarios y ocupantes" },
  { id: "owners", label: "Solo propietarios" },
];

export const CONSORTIUM_PORTAL_SECTIONS = [
  {
    id: "emergency_contacts",
    label: "Contactos de emergencia",
    description: "Policía, bomberos, Defensa Civil, administración y proveedores de guardia.",
    visibility: "all",
    fixedVisibility: true,
    resourceLabel: "contacto",
  },
  {
    id: "evacuation",
    label: "Evacuación y emergencias",
    description: "Procedimientos ante incendios, escapes de gas y otras contingencias.",
    visibility: "all",
    fixedVisibility: true,
    resourceLabel: "procedimiento",
  },
  {
    id: "safety_report",
    label: "Informe de seguridad",
    description: "Evaluaciones profesionales, observaciones y medidas preventivas.",
    visibility: "owners",
    resourceLabel: "informe",
  },
  {
    id: "insurance",
    label: "Seguros",
    description: "Pólizas vigentes, coberturas, vencimientos y renovaciones.",
    visibility: "owners",
    fixedVisibility: true,
    resourceLabel: "póliza",
  },
  {
    id: "ownership_regulations",
    label: "Reglamento de Copropiedad",
    description: "Reglamento y sus modificaciones, reservado a propietarios.",
    visibility: "owners",
    fixedVisibility: true,
    resourceLabel: "documento",
  },
  {
    id: "coexistence_regulations",
    label: "Reglamento de convivencia",
    description: "Reglas internas de uso y convivencia del edificio.",
    visibility: "all",
    fixedVisibility: true,
    resourceLabel: "documento",
  },
  {
    id: "regulations",
    label: "Normativa relevante",
    description: "Enlaces a normas, ordenanzas y recursos de consulta.",
    visibility: "all",
    fixedVisibility: true,
    resourceLabel: "enlace",
  },
  {
    id: "owner_council",
    label: "Consejo de Propietarios",
    description: "Integrantes y canales de contacto del consejo.",
    visibility: "owners",
    resourceLabel: "integrante",
  },
  {
    id: "managed_messages",
    label: "Gestiones de la administración",
    description: "Consultas, solicitudes, avisos y reclamos con seguimiento anonimizado.",
    visibility: "owners",
    fixedVisibility: true,
    resourceLabel: "",
  },
  {
    id: "assembly_minutes",
    label: "Actas digitales",
    description: "Actas y documentación de las asambleas de propietarios.",
    visibility: "owners",
    fixedVisibility: true,
    resourceLabel: "acta",
  },
];

export const CONSORTIUM_PORTAL_SECTION_IDS = CONSORTIUM_PORTAL_SECTIONS
  .map((section) => section.id);

export const getConsortiumPortalSection = (sectionId = "") => (
  CONSORTIUM_PORTAL_SECTIONS.find((section) => section.id === sectionId) || null
);

export const createDefaultConsortiumPortalSections = () => Object.fromEntries(
  CONSORTIUM_PORTAL_SECTIONS.map((section) => [section.id, {
    enabled: false,
    visibility: section.visibility,
  }]),
);

export const normalizeConsortiumPortalSections = (value = {}) => Object.fromEntries(
  CONSORTIUM_PORTAL_SECTIONS.map((section) => {
    const requested = value?.[section.id] || {};
    const visibility = section.fixedVisibility
      ? section.visibility
      : requested.visibility === "all" ? "all" : "owners";
    return [section.id, {
      enabled: requested.enabled === true,
      visibility,
    }];
  }),
);

export const isConsortiumPortalSectionVisibleTo = (
  section = {},
  portalAccessRole = "occupant",
) => section.enabled === true && (
  section.visibility === "all" || portalAccessRole === "owner"
);

export const CONSORTIUM_PORTAL_FILE_SECTIONS = new Set([
  "evacuation",
  "safety_report",
  "insurance",
  "ownership_regulations",
  "coexistence_regulations",
  "assembly_minutes",
]);

export const CONSORTIUM_PORTAL_REQUIRED_FILE_SECTIONS = new Set([
  "safety_report",
  "insurance",
  "ownership_regulations",
  "coexistence_regulations",
  "assembly_minutes",
]);

export const createEmptyConsortiumPortalResource = (section = "emergency_contacts") => ({
  section,
  title: "",
  summary: "",
  body: "",
  phone: "",
  email: "",
  url: "",
  providerName: "",
  policyNumber: "",
  coverage: "",
  memberRole: "",
  issuedDate: "",
  effectiveDate: "",
  expiresAt: "",
  meetingDate: "",
  published: true,
  file: null,
});
