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
