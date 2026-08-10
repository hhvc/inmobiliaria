import { DEFAULT_TASACION_PARAMETERS } from "./tasacion.constants.js";
import { calculateComparativeMethod } from "./tasacion.helpers.js";

const today = () => new Date().toISOString().slice(0, 10);

const createComparableId = () => {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `comparable-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export const createEmptyComparable = () => ({
  id: createComparableId(),
  dataType: "publicacion",
  propertyType: "",
  operation: "",
  currency: "",
  source: "",
  sourceUrl: "",
  verifiedAt: today(),
  sourceCapturedAt: "",
  distanceMeters: null,
  sourceSnapshot: null,
  address: "",
  price: "",
  surfaces: {
    cubierta: "",
    semicubierta: "",
    balcon: "",
    descubierta: "",
    terreno: "",
  },
  adjustments: {
    offer: DEFAULT_TASACION_PARAMETERS.defaultOfferFactor,
    time: 1,
    location: 1,
    surface: 1,
    floor: 1,
    disposition: 1,
    quality: 1,
    ageCondition: 1,
    extras: 1,
    other: 1,
  },
  reliabilityWeight: 3,
  notes: "",
});

export const createEmptyTasacion = () => ({
  schemaVersion: 3,
  estado: "borrador",
  currentStep: 1,
  versioning: {
    seriesId: "",
    versionNumber: 1,
    previousTasacionId: "",
    changeReason: "",
  },
  workflow: {
    events: [],
    submittedAt: null,
    approvedAt: null,
    issuedAt: null,
    deliveredAt: null,
    annulledAt: null,
  },
  issuance: {
    verificationCode: "",
    issuedBy: "",
    agencySnapshot: null,
  },
  delivery: {
    recipient: "",
    notes: "",
  },
  annulment: {
    reason: "",
  },
  propertyLink: {
    mode: "",
    inmuebleId: "",
    inmuebleTitle: "",
    importedAt: "",
    draftCreatedFromTasacion: false,
    syncDraft: false,
  },
  scope: {
    reportType: "estimacion_comercial",
    purpose: "venta",
    purposeDetail: "",
    clientName: "",
    clientDocument: "",
    ownerName: "",
    ownerDocument: "",
    valuationDate: today(),
    currency: "USD",
    otherCurrency: "",
    propertyRegistry: "",
    cadastralNomenclature: "",
    surveyPlan: "",
    titleNotes: "",
    appraiser: {
      name: "",
      profession: "",
      license: "",
      council: "",
    },
  },
  inspection: {
    inspectionDate: today(),
    mode: "presencial",
    inspectedBy: "",
    address: {
      street: "",
      number: "",
      neighborhood: "",
      city: "",
      province: "Córdoba",
      country: "Argentina",
      postalCode: "",
    },
    geolocation: { latitude: "", longitude: "" },
    zoning: { code: "", fot: "", fos: "", permittedUse: "" },
    parcelData: null,
    services: {
      water: false,
      sewer: false,
      gas: false,
      electricity: true,
      pavement: false,
      streetLighting: false,
    },
    environmentNotes: "",
    riskNotes: "",
    documentationNotes: "",
  },
  subject: {
    typology: "departamento",
    description: "",
    occupancy: "desocupado",
    bestUse: "uso_actual",
    bestUseRationale: "",
    age: "",
    usefulLife: 70,
    condition: 2.5,
    constructionQuality: "estandar",
    floor: "",
    disposition: "frente",
    orientation: "",
    surfaces: {
      cubierta: "",
      semicubierta: "",
      balcon: "",
      descubierta: "",
      terreno: "",
      frente: "",
      fondo: "",
    },
    lot: {
      position: "",
      mainFront: "",
      secondaryFront: "",
      averageDepth: "",
      dimensionsNotes: "",
    },
    amenities: "",
    adverseFactors: "",
  },
  methods: {
    comparative: true,
    cost: false,
    comparativeUnitBasis: "auto",
    selectionRationale: "",
  },
  parameters: JSON.parse(JSON.stringify(DEFAULT_TASACION_PARAMETERS)),
  comparables: [createEmptyComparable(), createEmptyComparable(), createEmptyComparable()],
  costMethod: {
    landUnitValue: "",
    landValueSource: "",
    landAdjustments: {
      location: 1,
      measures: 1,
      surface: 1,
      shape: 1,
      topography: 1,
      buildability: 1,
      services: 1,
      corner: 1,
    },
    landAdjustmentRationale: "",
    replacementCostPerSquareMeter: "",
    replacementCostSource: "",
    semiCoveredCostFactor: 0.5,
    residualPercent: DEFAULT_TASACION_PARAMETERS.defaultResidualPercent,
    functionalDepreciationAmount: "",
    scenario: "conservar",
    remodelingCost: "",
    demolitionCost: "",
    otherAdjustments: "",
    notes: "",
  },
  conclusion: {
    selectedMethod: "comparativo",
    adoptedMarketValue: "",
    rationale: "",
    professionalOpinion: "",
    limitations: "",
  },
  mortgage: {
    destination: "vivienda_propia",
    isPurchaseFinancing: false,
    acquisitionPrice: "",
    proposedLoanAmount: "",
    quickSaleFactor: DEFAULT_TASACION_PARAMETERS.quickSaleFactor,
    directRealizationCosts: "",
    guaranteeFactor:
      DEFAULT_TASACION_PARAMETERS.defaultGuaranteeFactors.vivienda_propia,
    institutionPolicyNotes: "",
  },
  review: {
    status: "pendiente",
    notes: "",
    reviewedBy: "",
    reviewedAt: null,
    signatureConfirmed: false,
  },
});

const mergeNested = (base, value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return base;
  return Object.entries(base).reduce(
    (result, [key, defaultValue]) => ({
      ...result,
      [key]:
        defaultValue &&
        typeof defaultValue === "object" &&
        !Array.isArray(defaultValue)
          ? mergeNested(defaultValue, value[key])
          : value[key] ?? defaultValue,
    }),
    { ...value },
  );
};

export const normalizeTasacion = (value = {}) => {
  const empty = createEmptyTasacion();
  const normalized = mergeNested(empty, value);
  normalized.schemaVersion = empty.schemaVersion;

  normalized.workflow.events = Array.isArray(value.workflow?.events)
    ? value.workflow.events
    : [];

  normalized.comparables = Array.isArray(value.comparables)
    ? value.comparables.map((item) => mergeNested(createEmptyComparable(), item))
    : empty.comparables;
  const reportCurrency = normalized.scope.currency === "OTRA"
    ? normalized.scope.otherCurrency
    : normalized.scope.currency;
  normalized.comparables = normalized.comparables.map((item) => {
    const isLegacyManualComparable =
      !item.currency &&
      !item.externalSource?.provider &&
      (item.source || item.address || Number(item.price) > 0);
    return isLegacyManualComparable
      ? {...item, currency: reportCurrency || ""}
      : item;
  });

  // Compatibilidad con los primeros borradores, que guardaban las medidas
  // lineales dentro de surfaces.frente y surfaces.fondo.
  const legacyFront = value.subject?.surfaces?.frente;
  const legacyDepth = value.subject?.surfaces?.fondo;
  if (!normalized.subject.lot.mainFront && legacyFront) {
    normalized.subject.lot.mainFront = legacyFront;
  }
  if (!normalized.subject.lot.averageDepth && legacyDepth) {
    normalized.subject.lot.averageDepth = legacyDepth;
  }
  if (!normalized.subject.lot.position && (legacyFront || legacyDepth)) {
    normalized.subject.lot.position = "medianero";
  }

  return normalized;
};

export const validateTasacionStep = (tasacion, step) => {
  const errors = [];

  if (step === 1) {
    if (!tasacion.propertyLink?.mode) {
      errors.push("Seleccioná un inmueble existente o indicá que es un inmueble nuevo.");
    }
    if (!tasacion.scope?.clientName?.trim()) errors.push("Ingresá el cliente o comitente.");
    if (!tasacion.scope?.valuationDate) errors.push("Ingresá la fecha de valuación.");
    if (!tasacion.scope?.purpose) errors.push("Seleccioná la finalidad.");
  }

  if (step === 2) {
    if (!tasacion.inspection?.inspectionDate) errors.push("Ingresá la fecha de inspección.");
    if (!tasacion.inspection?.address?.city?.trim()) errors.push("Ingresá la ciudad del inmueble.");
    if (!tasacion.inspection?.address?.province?.trim()) errors.push("Ingresá la provincia.");
  }

  if (step === 3) {
    const surfaces = tasacion.subject?.surfaces || {};
    if (!tasacion.subject?.typology) errors.push("Seleccioná la tipología.");
    if (!(Number(surfaces.cubierta) > 0 || Number(surfaces.terreno) > 0)) {
      errors.push("Ingresá superficie cubierta o superficie de terreno.");
    }
    if (!(Number(tasacion.subject?.usefulLife) > 0) && Number(surfaces.cubierta) > 0) {
      errors.push("Ingresá una vida útil estimada mayor a cero.");
    }
    if (Number(surfaces.terreno) > 0 && !tasacion.subject?.lot?.position) {
      errors.push("Indicá si el lote es medianero, esquina, doble frente o irregular.");
    }
    if (
      tasacion.subject?.lot?.position === "esquina" &&
      !(Number(tasacion.subject?.lot?.secondaryFront) > 0)
    ) {
      errors.push("Ingresá el frente sobre la calle secundaria del lote esquina.");
    }
  }

  if (step === 4) {
    if (!tasacion.methods?.comparative && !tasacion.methods?.cost) {
      errors.push("Seleccioná al menos un método de valuación.");
    }
    if (tasacion.methods?.comparative) {
      const comparison = calculateComparativeMethod({
        subjectSurfaces: tasacion.subject?.surfaces,
        comparables: tasacion.comparables,
        parameters: tasacion.parameters,
        unitBasis: tasacion.methods?.comparativeUnitBasis,
        currency:
          tasacion.scope?.currency === "OTRA"
            ? tasacion.scope?.otherCurrency
            : tasacion.scope?.currency,
      });
      if (comparison.validComparableCount < 3) {
        errors.push("El método comparativo requiere al menos 3 antecedentes completos para la base unitaria elegida.");
      }
      if (comparison.validComparableCount > 5) {
        errors.push("El MVP admite hasta 5 antecedentes válidos por tasación.");
      }
      const incompatibleCurrencies = comparison.comparables.filter(
        (item) =>
          Number(item.price) > 0 &&
          item.comparisonSurface > 0 &&
          item.currencyCompatible === false,
      );
      if (incompatibleCurrencies.length > 0) {
        errors.push(
          "Confirmá o convertí la moneda de todos los antecedentes para que coincida con la moneda del informe.",
        );
      }
    }
    if (tasacion.methods?.cost) {
      if (!(Number(tasacion.costMethod?.landUnitValue) > 0)) {
        errors.push("Ingresá el valor unitario del terreno para el método del costo.");
      }
    }
  }

  if (step === 5) {
    if (!(Number(tasacion.conclusion?.adoptedMarketValue) > 0)) {
      errors.push("Ingresá el valor de mercado adoptado.");
    }
    if (!tasacion.conclusion?.rationale?.trim()) {
      errors.push("Fundamentá la reconciliación y el valor adoptado.");
    }
  }

  return errors;
};
