export const CONSORTIUM_PILOT_OFFER = Object.freeze({
  code: "consortium-pilot-2026",
  catalogItemId: "consorcios",
  title: "Piloto Administración de Consorcios",
  currency: "ARS",
  unitPriceMinor: 100000,
  minimumMonthlyAmountMinor: 2000000,
  durationDays: 30,
  setupFeeMinor: 0,
  priceLockMonths: 6,
  earlyAdopterSlots: 3,
  termsVersion: "2026-09-23.1",
});

export const CONSORTIUM_CURRENT_MANAGEMENT_OPTIONS = Object.freeze([
  { value: "spreadsheet", label: "Planillas de cálculo" },
  { value: "manual", label: "Papeles o registros manuales" },
  { value: "mixed", label: "Varias herramientas sin integrar" },
  { value: "software", label: "Otro sistema de administración" },
  { value: "starting", label: "Estoy comenzando a administrar" },
]);

export const CONSORTIUM_MAIN_PAIN_OPTIONS = Object.freeze([
  { value: "settlements", label: "Liquidaciones y expensas" },
  { value: "collections", label: "Cobranzas, mora y conciliación" },
  { value: "communication", label: "Consultas y comunicación con consorcistas" },
  { value: "documents", label: "Documentación y vencimientos" },
  { value: "control", label: "Control económico y trazabilidad" },
  { value: "migration", label: "Migrar desde otro sistema" },
]);

export const CONSORTIUM_START_TIMING_OPTIONS = Object.freeze([
  { value: "now", label: "Lo antes posible" },
  { value: "within_30_days", label: "Dentro de los próximos 30 días" },
  { value: "within_90_days", label: "Dentro de los próximos 3 meses" },
  { value: "exploring", label: "Solo estoy evaluando alternativas" },
]);

export const normalizeConsortiumUnitCount = (value) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 0;
  return Math.min(parsed, 10000);
};

export const calculateConsortiumPilotEstimate = (unitCount) => {
  const normalizedUnitCount = normalizeConsortiumUnitCount(unitCount);
  return {
    unitCount: normalizedUnitCount,
    calculatedAmountMinor: normalizedUnitCount * CONSORTIUM_PILOT_OFFER.unitPriceMinor,
    estimatedMonthlyAmountMinor: Math.max(
      normalizedUnitCount * CONSORTIUM_PILOT_OFFER.unitPriceMinor,
      CONSORTIUM_PILOT_OFFER.minimumMonthlyAmountMinor,
    ),
    minimumApplied: (
      normalizedUnitCount * CONSORTIUM_PILOT_OFFER.unitPriceMinor <
      CONSORTIUM_PILOT_OFFER.minimumMonthlyAmountMinor
    ),
  };
};

export const buildConsortiumPilotLeadData = ({ requestType = "pilot", unitCount } = {}) => ({
  offerCode: CONSORTIUM_PILOT_OFFER.code,
  requestType: requestType === "demo" ? "demo" : "pilot",
  unitCount: normalizeConsortiumUnitCount(unitCount),
});

export const buildConsortiumQualificationData = ({
  consortiumCount,
  currentManagementMethod,
  mainPain,
  startTiming,
} = {}) => ({
  consortiumCount: Math.min(
    5000,
    Math.max(0, Number.parseInt(consortiumCount, 10) || 0),
  ),
  currentManagementMethod: CONSORTIUM_CURRENT_MANAGEMENT_OPTIONS.some(
    (option) => option.value === currentManagementMethod,
  ) ? currentManagementMethod : "",
  mainPain: CONSORTIUM_MAIN_PAIN_OPTIONS.some(
    (option) => option.value === mainPain,
  ) ? mainPain : "",
  startTiming: CONSORTIUM_START_TIMING_OPTIONS.some(
    (option) => option.value === startTiming,
  ) ? startTiming : "",
});
