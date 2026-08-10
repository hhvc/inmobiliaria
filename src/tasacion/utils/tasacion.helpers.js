import {
  DEFAULT_TASACION_PARAMETERS,
  ROSS_HEIDECKE_ESTADOS,
  TASACION_ENGINE_VERSION,
} from "./tasacion.constants.js";

export const toFiniteNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const roundMoney = (value, decimals = 2) => {
  const factor = 10 ** decimals;
  return Math.round((toFiniteNumber(value) + Number.EPSILON) * factor) / factor;
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const calculateWeightedSurface = (
  surfaces = {},
  weights = DEFAULT_TASACION_PARAMETERS.surfaceWeights,
) => {
  const cubierta = Math.max(0, toFiniteNumber(surfaces.cubierta));
  const semicubierta = Math.max(0, toFiniteNumber(surfaces.semicubierta));
  const balcon = Math.max(0, toFiniteNumber(surfaces.balcon));
  const descubierta = Math.max(0, toFiniteNumber(surfaces.descubierta));

  return roundMoney(
    cubierta * toFiniteNumber(weights.cubierta, 1) +
      semicubierta * toFiniteNumber(weights.semicubierta, 0.5) +
      balcon * toFiniteNumber(weights.balcon, 0.5) +
      descubierta * toFiniteNumber(weights.descubierta, 0.2),
    4,
  );
};

export const calculateRossHeidecke = ({
  age = 0,
  usefulLife = 0,
  condition = 2.5,
} = {}) => {
  const normalizedAge = Math.max(0, toFiniteNumber(age));
  const normalizedUsefulLife = Math.max(0, toFiniteNumber(usefulLife));
  const lifeConsumedPercent =
    normalizedUsefulLife > 0
      ? clamp((normalizedAge / normalizedUsefulLife) * 100, 0, 100)
      : 0;

  const ageDepreciation =
    0.5 * lifeConsumedPercent + 0.005 * lifeConsumedPercent ** 2;
  const conditionEntry =
    ROSS_HEIDECKE_ESTADOS.find(
      (item) => item.value === toFiniteNumber(condition, 2.5),
    ) || ROSS_HEIDECKE_ESTADOS.find((item) => item.value === 2.5);
  const conditionDepreciation = conditionEntry?.baseDepreciation || 0;
  const totalDepreciation = clamp(
    ageDepreciation +
      conditionDepreciation * (1 - ageDepreciation / 100),
    0,
    100,
  );

  return {
    lifeConsumedPercent: roundMoney(lifeConsumedPercent, 4),
    ageDepreciationPercent: roundMoney(ageDepreciation, 4),
    conditionDepreciationPercent: roundMoney(conditionDepreciation, 4),
    totalDepreciationPercent: roundMoney(totalDepreciation, 4),
    remainingCoefficient: roundMoney(1 - totalDepreciation / 100, 6),
    condition: conditionEntry?.value || 2.5,
    conditionLabel: conditionEntry?.label || "2,5 · Normal",
  };
};

const median = (values = []) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
};

const standardDeviation = (values = [], mean = 0) => {
  if (values.length < 2) return 0;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
    (values.length - 1);
  return Math.sqrt(variance);
};

const comparableAdjustmentFactor = (comparable = {}, parameters = {}) => {
  const factors = comparable.adjustments || {};
  const offerDefault =
    comparable.dataType === "publicacion"
      ? toFiniteNumber(parameters.defaultOfferFactor, 0.92)
      : 1;
  const factorNames = [
    "offer",
    "time",
    "location",
    "surface",
    "floor",
    "disposition",
    "quality",
    "ageCondition",
    "extras",
    "other",
  ];

  return factorNames.reduce((product, name) => {
    const fallback = name === "offer" ? offerDefault : 1;
    return product * Math.max(0, toFiniteNumber(factors[name], fallback));
  }, 1);
};

export const calculateComparable = (
  comparable = {},
  parameters = DEFAULT_TASACION_PARAMETERS,
  unitBasis = "construction_weighted",
  expectedCurrency = "",
) => {
  const weightedSurface = calculateWeightedSurface(
    comparable.surfaces,
    parameters.surfaceWeights,
  );
  const landSurface = Math.max(0, toFiniteNumber(comparable.surfaces?.terreno));
  const comparisonSurface =
    unitBasis === "land" ? landSurface : weightedSurface;
  const price = Math.max(0, toFiniteNumber(comparable.price));
  const unitPrice = comparisonSurface > 0 ? price / comparisonSurface : 0;
  const totalAdjustmentFactor = comparableAdjustmentFactor(
    comparable,
    parameters,
  );
  const homogenizedUnitPrice = unitPrice * totalAdjustmentFactor;
  const reliabilityWeight = clamp(
    toFiniteNumber(comparable.reliabilityWeight, 3),
    1,
    5,
  );
  const normalizedExpectedCurrency = String(expectedCurrency || "")
    .trim()
    .toUpperCase();
  const comparableCurrency = String(comparable.currency || "")
    .trim()
    .toUpperCase();
  const currencyCompatible =
    !normalizedExpectedCurrency || comparableCurrency === normalizedExpectedCurrency;

  return {
    ...comparable,
    weightedSurface,
    landSurface: roundMoney(landSurface, 4),
    comparisonSurface: roundMoney(comparisonSurface, 4),
    unitBasis,
    unitPrice: roundMoney(unitPrice),
    totalAdjustmentFactor: roundMoney(totalAdjustmentFactor, 6),
    homogenizedUnitPrice: roundMoney(homogenizedUnitPrice),
    reliabilityWeight,
    currencyCompatible,
    valid:
      price > 0 &&
      comparisonSurface > 0 &&
      homogenizedUnitPrice > 0 &&
      currencyCompatible,
  };
};

export const resolveComparativeUnitBasis = ({
  requestedBasis = "auto",
  subjectSurfaces = {},
} = {}) => {
  if (["construction_weighted", "land"].includes(requestedBasis)) {
    return requestedBasis;
  }

  const hasBuiltSurface =
    toFiniteNumber(subjectSurfaces?.cubierta) > 0 ||
    toFiniteNumber(subjectSurfaces?.semicubierta) > 0 ||
    toFiniteNumber(subjectSurfaces?.balcon) > 0;
  const hasLandSurface = toFiniteNumber(subjectSurfaces?.terreno) > 0;

  return !hasBuiltSurface && hasLandSurface
    ? "land"
    : "construction_weighted";
};

export const calculateComparativeMethod = ({
  subjectSurfaces = {},
  comparables = [],
  parameters = DEFAULT_TASACION_PARAMETERS,
  unitBasis = "auto",
  currency = "",
} = {}) => {
  const subjectWeightedSurface = calculateWeightedSurface(
    subjectSurfaces,
    parameters.surfaceWeights,
  );
  const subjectLandSurface = Math.max(
    0,
    toFiniteNumber(subjectSurfaces?.terreno),
  );
  const resolvedUnitBasis = resolveComparativeUnitBasis({
    requestedBasis: unitBasis,
    subjectSurfaces,
  });
  const subjectComparisonSurface =
    resolvedUnitBasis === "land"
      ? subjectLandSurface
      : subjectWeightedSurface;
  const calculatedComparables = comparables.map((item) =>
    calculateComparable(item, parameters, resolvedUnitBasis, currency),
  );
  const validComparables = calculatedComparables.filter((item) => item.valid);
  const unitValues = validComparables.map((item) => item.homogenizedUnitPrice);
  const averageUnitValue = unitValues.length
    ? unitValues.reduce((sum, value) => sum + value, 0) / unitValues.length
    : 0;
  const totalWeight = validComparables.reduce(
    (sum, item) => sum + item.reliabilityWeight,
    0,
  );
  const weightedAverageUnitValue = totalWeight
    ? validComparables.reduce(
        (sum, item) =>
          sum + item.homogenizedUnitPrice * item.reliabilityWeight,
        0,
      ) / totalWeight
    : 0;
  const deviation = standardDeviation(unitValues, averageUnitValue);

  return {
    subjectWeightedSurface,
    subjectLandSurface: roundMoney(subjectLandSurface, 4),
    subjectComparisonSurface: roundMoney(subjectComparisonSurface, 4),
    requestedUnitBasis: unitBasis,
    resolvedUnitBasis,
    comparables: calculatedComparables,
    validComparableCount: validComparables.length,
    averageUnitValue: roundMoney(averageUnitValue),
    medianUnitValue: roundMoney(median(unitValues)),
    weightedAverageUnitValue: roundMoney(weightedAverageUnitValue),
    minimumUnitValue: roundMoney(unitValues.length ? Math.min(...unitValues) : 0),
    maximumUnitValue: roundMoney(unitValues.length ? Math.max(...unitValues) : 0),
    standardDeviation: roundMoney(deviation),
    coefficientOfVariationPercent: roundMoney(
      averageUnitValue > 0 ? (deviation / averageUnitValue) * 100 : 0,
    ),
    indicatedValue: roundMoney(
      weightedAverageUnitValue * subjectComparisonSurface,
    ),
    meetsMinimumSample:
      validComparables.length >=
      toFiniteNumber(parameters.minimumComparables, 3),
    meetsRecommendedSample:
      validComparables.length >=
      toFiniteNumber(parameters.recommendedComparables, 5),
  };
};

const multiplyFactors = (factors = {}) =>
  Object.values(factors).reduce(
    (product, value) => product * Math.max(0, toFiniteNumber(value, 1)),
    1,
  );

export const calculateCostMethod = ({
  subject = {},
  cost = {},
  parameters = DEFAULT_TASACION_PARAMETERS,
} = {}) => {
  const landArea = Math.max(0, toFiniteNumber(subject.surfaces?.terreno));
  const landUnitValue = Math.max(0, toFiniteNumber(cost.landUnitValue));
  const landAdjustmentFactor = multiplyFactors(cost.landAdjustments || {});
  const landValue = landArea * landUnitValue * landAdjustmentFactor;

  const coveredArea = Math.max(0, toFiniteNumber(subject.surfaces?.cubierta));
  const semiCoveredArea = Math.max(
    0,
    toFiniteNumber(subject.surfaces?.semicubierta),
  );
  const semiCoveredCostFactor = Math.max(
    0,
    toFiniteNumber(cost.semiCoveredCostFactor, 0.5),
  );
  const computableBuildingArea =
    coveredArea + semiCoveredArea * semiCoveredCostFactor;
  const replacementCostPerSquareMeter = Math.max(
    0,
    toFiniteNumber(cost.replacementCostPerSquareMeter),
  );
  const replacementCostNew =
    computableBuildingArea * replacementCostPerSquareMeter;
  const rossHeidecke = calculateRossHeidecke({
    age: subject.age,
    usefulLife: subject.usefulLife,
    condition: subject.condition,
  });
  const residualPercent = clamp(
    toFiniteNumber(
      cost.residualPercent,
      parameters.defaultResidualPercent || 5,
    ),
    0,
    100,
  );
  const residualValue = replacementCostNew * (residualPercent / 100);
  const depreciatedBuildingValue = Math.max(
    0,
    replacementCostNew -
      (replacementCostNew - residualValue) *
        (rossHeidecke.totalDepreciationPercent / 100) -
      Math.max(0, toFiniteNumber(cost.functionalDepreciationAmount)),
  );
  const scenario = cost.scenario || "conservar";
  const remodelingCost = Math.max(0, toFiniteNumber(cost.remodelingCost));
  const demolitionCost = Math.max(0, toFiniteNumber(cost.demolitionCost));
  const otherAdjustments = toFiniteNumber(cost.otherAdjustments);

  let adoptedBuildingValue = depreciatedBuildingValue;
  let indicatedValue = landValue + depreciatedBuildingValue + otherAdjustments;

  if (scenario === "remodelar") {
    adoptedBuildingValue = Math.max(0, depreciatedBuildingValue - remodelingCost);
    indicatedValue = landValue + adoptedBuildingValue + otherAdjustments;
  }

  if (scenario === "demoler") {
    adoptedBuildingValue = 0;
    indicatedValue = landValue - demolitionCost + otherAdjustments;
  }

  return {
    landArea: roundMoney(landArea, 4),
    landUnitValue: roundMoney(landUnitValue),
    landAdjustmentFactor: roundMoney(landAdjustmentFactor, 6),
    landValue: roundMoney(landValue),
    computableBuildingArea: roundMoney(computableBuildingArea, 4),
    replacementCostNew: roundMoney(replacementCostNew),
    residualValue: roundMoney(residualValue),
    rossHeidecke,
    depreciatedBuildingValue: roundMoney(depreciatedBuildingValue),
    adoptedBuildingValue: roundMoney(adoptedBuildingValue),
    scenario,
    remodelingCost: roundMoney(remodelingCost),
    demolitionCost: roundMoney(demolitionCost),
    otherAdjustments: roundMoney(otherAdjustments),
    indicatedValue: roundMoney(Math.max(0, indicatedValue)),
  };
};

export const calculateRiskAdjustments = ({
  marketValue = 0,
  quickSaleFactor = DEFAULT_TASACION_PARAMETERS.quickSaleFactor,
  directRealizationCosts = 0,
  proposedLoanAmount = 0,
  acquisitionPrice = 0,
  destination = "vivienda_propia",
  guaranteeFactor,
  isPurchaseFinancing = false,
  parameters = DEFAULT_TASACION_PARAMETERS,
} = {}) => {
  const normalizedMarketValue = Math.max(0, toFiniteNumber(marketValue));
  const normalizedQuickSaleFactor = clamp(
    toFiniteNumber(quickSaleFactor, parameters.quickSaleFactor || 0.85),
    0,
    1,
  );
  const quickSaleValue = Math.max(
    0,
    normalizedMarketValue * normalizedQuickSaleFactor -
      Math.max(0, toFiniteNumber(directRealizationCosts)),
  );
  const policyFactor = clamp(
    toFiniteNumber(
      guaranteeFactor,
      destination === "vivienda_propia"
        ? parameters.defaultGuaranteeFactors?.vivienda_propia || 0.75
        : parameters.defaultGuaranteeFactors?.otros_usos || 0.5,
    ),
    0,
    1,
  );
  const normalizedAcquisitionPrice = Math.max(
    0,
    toFiniteNumber(acquisitionPrice),
  );
  const conservativeLtvBase =
    isPurchaseFinancing && normalizedAcquisitionPrice > 0
      ? Math.min(normalizedMarketValue, normalizedAcquisitionPrice)
      : normalizedMarketValue;
  const loan = Math.max(0, toFiniteNumber(proposedLoanAmount));

  return {
    marketValue: roundMoney(normalizedMarketValue),
    quickSaleFactor: roundMoney(normalizedQuickSaleFactor, 6),
    quickSaleValue: roundMoney(quickSaleValue),
    directRealizationCosts: roundMoney(directRealizationCosts),
    guaranteeComputationFactor: roundMoney(policyFactor, 6),
    guaranteeComputableValue: roundMoney(quickSaleValue * policyFactor),
    conservativeLtvBase: roundMoney(conservativeLtvBase),
    proposedLoanAmount: roundMoney(loan),
    ltvPercent: roundMoney(
      conservativeLtvBase > 0 ? (loan / conservativeLtvBase) * 100 : 0,
    ),
  };
};

export const calculateTasacion = (tasacion = {}) => {
  const parameters = {
    ...DEFAULT_TASACION_PARAMETERS,
    ...(tasacion.parameters || {}),
    surfaceWeights: {
      ...DEFAULT_TASACION_PARAMETERS.surfaceWeights,
      ...(tasacion.parameters?.surfaceWeights || {}),
    },
    defaultGuaranteeFactors: {
      ...DEFAULT_TASACION_PARAMETERS.defaultGuaranteeFactors,
      ...(tasacion.parameters?.defaultGuaranteeFactors || {}),
    },
  };
  const comparative = calculateComparativeMethod({
    subjectSurfaces: tasacion.subject?.surfaces,
    comparables: tasacion.comparables,
    parameters,
    unitBasis: tasacion.methods?.comparativeUnitBasis,
    currency:
      tasacion.scope?.currency === "OTRA"
        ? tasacion.scope?.otherCurrency
        : tasacion.scope?.currency,
  });
  const cost = calculateCostMethod({
    subject: tasacion.subject,
    cost: tasacion.costMethod,
    parameters,
  });
  const adoptedMarketValue = Math.max(
    0,
    toFiniteNumber(tasacion.conclusion?.adoptedMarketValue),
  );
  const risk = calculateRiskAdjustments({
    marketValue: adoptedMarketValue,
    quickSaleFactor: tasacion.mortgage?.quickSaleFactor,
    directRealizationCosts: tasacion.mortgage?.directRealizationCosts,
    proposedLoanAmount: tasacion.mortgage?.proposedLoanAmount,
    acquisitionPrice: tasacion.mortgage?.acquisitionPrice,
    destination: tasacion.mortgage?.destination,
    guaranteeFactor: tasacion.mortgage?.guaranteeFactor,
    isPurchaseFinancing: tasacion.mortgage?.isPurchaseFinancing,
    parameters,
  });

  return {
    engineVersion: TASACION_ENGINE_VERSION,
    parameterVersion: parameters.version,
    calculatedAt: new Date().toISOString(),
    comparative,
    cost,
    risk,
  };
};

export const formatTasacionMoney = (value, currency = "USD") => {
  const currencyCode = String(currency === "OTRA" ? "USD" : currency || "USD")
    .trim()
    .toUpperCase();

  try {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: currencyCode,
      maximumFractionDigits: 2,
    }).format(toFiniteNumber(value));
  } catch {
    return `${currencyCode} ${new Intl.NumberFormat("es-AR", {
      maximumFractionDigits: 2,
    }).format(toFiniteNumber(value))}`;
  }
};

export const getTasacionProgress = (tasacion = {}) => {
  const checks = [
    Boolean(tasacion.scope?.clientName && tasacion.scope?.valuationDate),
    Boolean(tasacion.inspection?.address?.city && tasacion.inspection?.inspectionDate),
    Boolean(
      tasacion.subject?.typology &&
        (toFiniteNumber(tasacion.subject?.surfaces?.cubierta) > 0 ||
          toFiniteNumber(tasacion.subject?.surfaces?.terreno) > 0),
    ),
    Boolean(
      (tasacion.methods?.comparative && (tasacion.comparables || []).length >= 3) ||
        (tasacion.methods?.cost &&
          toFiniteNumber(tasacion.costMethod?.landUnitValue) > 0),
    ),
    Boolean(
      toFiniteNumber(tasacion.conclusion?.adoptedMarketValue) > 0 &&
        tasacion.conclusion?.rationale?.trim(),
    ),
  ];
  const completed = checks.filter(Boolean).length;

  return {
    completed,
    total: checks.length,
    percent: Math.round((completed / checks.length) * 100),
  };
};
