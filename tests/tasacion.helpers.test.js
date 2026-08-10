import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateComparativeMethod,
  calculateCostMethod,
  calculateRiskAdjustments,
  calculateRossHeidecke,
  calculateWeightedSurface,
} from "../src/tasacion/utils/tasacion.helpers.js";
import {
  normalizeTasacion,
  validateTasacionStep,
} from "../src/tasacion/utils/tasacionSchema.js";
import {
  applyInmuebleToTasacion,
  buildInmuebleDraftFromTasacion,
} from "../src/tasacion/utils/tasacionInmueble.helpers.js";
import {
  canEditTasacion,
  canTransitionTasacion,
  createTasacionVerificationCode,
  validateTasacionForIssuance,
  validateTasacionForReview,
} from "../src/tasacion/utils/tasacionWorkflow.helpers.js";

test("pondera superficies con el perfil técnico predeterminado", () => {
  assert.equal(
    calculateWeightedSurface({
      cubierta: 100,
      semicubierta: 20,
      balcon: 10,
      descubierta: 50,
    }),
    125,
  );
});

test("Ross-Heidecke conserva el terreno fuera del cálculo y devuelve coeficiente remanente", () => {
  const result = calculateRossHeidecke({ age: 20, usefulLife: 80, condition: 2 });
  assert.equal(result.lifeConsumedPercent, 25);
  assert.ok(result.totalDepreciationPercent > 15);
  assert.ok(result.remainingCoefficient > 0 && result.remainingCoefficient < 1);
});

test("el comparativo calcula estadística y promedio ponderado sin adoptar automáticamente el valor", () => {
  const comparables = [100000, 110000, 120000].map((price, index) => ({
    id: `${index}`,
    dataType: "venta",
    price,
    surfaces: { cubierta: 100 },
    adjustments: { offer: 1 },
    reliabilityWeight: index + 1,
  }));
  const result = calculateComparativeMethod({
    subjectSurfaces: { cubierta: 80 },
    comparables,
  });

  assert.equal(result.validComparableCount, 3);
  assert.equal(result.averageUnitValue, 1100);
  assert.equal(result.medianUnitValue, 1100);
  assert.equal(result.weightedAverageUnitValue, 1133.33);
  assert.equal(result.indicatedValue, 90666.67);
  assert.equal(result.meetsMinimumSample, true);
});

test("excluye antecedentes cuya moneda no fue confirmada contra el informe", () => {
  const result = calculateComparativeMethod({
    subjectSurfaces: {cubierta: 100},
    currency: "USD",
    comparables: [
      {
        price: 100000,
        currency: "ARS",
        surfaces: {cubierta: 100},
        adjustments: {offer: 1},
      },
      {
        price: 90000,
        currency: "USD",
        surfaces: {cubierta: 100},
        adjustments: {offer: 1},
      },
    ],
  });

  assert.equal(result.comparables[0].currencyCompatible, false);
  assert.equal(result.comparables[0].valid, false);
  assert.equal(result.comparables[1].valid, true);
  assert.equal(result.validComparableCount, 1);
});

test("el comparativo de lotes usa terreno sin confundirlo con superficie descubierta", () => {
  const result = calculateComparativeMethod({
    subjectSurfaces: { terreno: 300, descubierta: 250 },
    unitBasis: "auto",
    comparables: [30000, 33000, 36000].map((price, index) => ({
      id: `land-${index}`,
      dataType: "venta",
      price,
      surfaces: { terreno: 300, descubierta: 250 },
      adjustments: { offer: 1 },
      reliabilityWeight: 1,
    })),
  });

  assert.equal(result.resolvedUnitBasis, "land");
  assert.equal(result.subjectComparisonSurface, 300);
  assert.equal(result.validComparableCount, 3);
  assert.equal(result.indicatedValue, 33000);
});

test("el método del costo separa suelo y edificación depreciada", () => {
  const result = calculateCostMethod({
    subject: {
      age: 10,
      usefulLife: 80,
      condition: 2,
      surfaces: { terreno: 300, cubierta: 100, semicubierta: 20 },
    },
    cost: {
      landUnitValue: 100,
      landAdjustments: { location: 1, shape: 1 },
      replacementCostPerSquareMeter: 500,
      semiCoveredCostFactor: 0.5,
      residualPercent: 5,
      scenario: "conservar",
    },
  });

  assert.equal(result.landValue, 30000);
  assert.equal(result.computableBuildingArea, 110);
  assert.equal(result.replacementCostNew, 55000);
  assert.ok(result.indicatedValue > result.landValue);
});

test("la simulación separa realización, garantía computable y LTV conservador", () => {
  const result = calculateRiskAdjustments({
    marketValue: 100000,
    quickSaleFactor: 0.85,
    directRealizationCosts: 5000,
    proposedLoanAmount: 60000,
    acquisitionPrice: 90000,
    isPurchaseFinancing: true,
    destination: "vivienda_propia",
  });

  assert.equal(result.quickSaleValue, 80000);
  assert.equal(result.guaranteeComputableValue, 60000);
  assert.equal(result.conservativeLtvBase, 90000);
  assert.equal(result.ltvPercent, 66.67);
});

test("migra las antiguas medidas frente y fondo sin perder borradores", () => {
  const result = normalizeTasacion({
    subject: { surfaces: { frente: 10, fondo: 30 } },
  });

  assert.equal(result.subject.lot.position, "medianero");
  assert.equal(result.subject.lot.mainFront, 10);
  assert.equal(result.subject.lot.averageDepth, 30);
});

test("migra la moneda de antecedentes manuales anteriores al control multimoneda", () => {
  const result = normalizeTasacion({
    scope: {currency: "USD"},
    comparables: [{source: "Carga manual", price: 100000, surfaces: {cubierta: 80}}],
  });

  assert.equal(result.comparables[0].currency, "USD");
});

test("un lote esquina requiere identificar su segundo frente", () => {
  const result = normalizeTasacion({
    subject: {
      typology: "terreno",
      surfaces: { terreno: 300 },
      lot: { position: "esquina", mainFront: 10, secondaryFront: "" },
    },
  });

  assert.ok(
    validateTasacionStep(result, 3).some((message) =>
      message.includes("calle secundaria"),
    ),
  );
});

test("importa un inmueble cargado sin mezclar terreno y superficie descubierta", () => {
  const result = applyInmuebleToTasacion(normalizeTasacion({}), {
    id: "inmueble-1",
    titulo: "Casa de prueba",
    tipo: "casa",
    descripcion: "Desarrollada en dos plantas",
    publicarEnPortal: false,
    direccion: {
      calle: "San Martín",
      numero: "123",
      barrio: "Centro",
      ciudad: "Córdoba",
      lat: -31.4167,
      lng: -64.1833,
    },
    superficie: {
      cubierta: 180,
      semicubierta: 20,
      descubierta: 100,
      terreno: 300,
    },
    caracteristicas: {
      antiguedad: 12,
      estadoConservacion: "muy_bueno",
    },
    servicios: { agua: true, luz: false },
    medidas: { frente: 10, fondo: 30 },
    datosParcelarios: {
      parcel: { nomenclature: "11-01-01-01-001-001" },
      urbanPlanning: {
        occupancy: { zone: "R2", fos: 0.6, fot: 1.5 },
        landUse: { dominantUse: "Residencial" },
      },
    },
  });

  assert.equal(result.propertyLink.mode, "existing");
  assert.equal(result.propertyLink.inmuebleId, "inmueble-1");
  assert.equal(result.inspection.address.street, "San Martín");
  assert.equal(result.inspection.services.water, true);
  assert.equal(result.inspection.services.electricity, false);
  assert.equal(result.subject.surfaces.cubierta, 180);
  assert.equal(result.subject.surfaces.descubierta, 100);
  assert.equal(result.subject.surfaces.terreno, 300);
  assert.equal(result.subject.lot.mainFront, 10);
  assert.equal(result.subject.lot.averageDepth, 30);
  assert.equal(result.inspection.geolocation.latitude, -31.4167);
  assert.equal(result.scope.cadastralNomenclature, "11-01-01-01-001-001");
  assert.equal(result.inspection.zoning.code, "R2");
  assert.equal(result.inspection.zoning.fos, 0.6);
  assert.equal(result.inspection.zoning.fot, 1.5);
  assert.equal(result.inspection.zoning.permittedUse, "Residencial");
  assert.equal(
    result.inspection.parcelData.parcel.nomenclature,
    "11-01-01-01-001-001",
  );
});

test("crea un borrador de inmueble no publicado y trazable desde la tasación", () => {
  const tasacion = normalizeTasacion({
    propertyLink: { mode: "new", syncDraft: true },
    scope: { currency: "USD" },
    inspection: {
      address: { street: "Belgrano", number: "456", city: "Córdoba" },
    },
    subject: {
      typology: "casa",
      age: 8,
      surfaces: {
        cubierta: 120,
        semicubierta: 15,
        descubierta: 165,
        terreno: 300,
      },
      lot: { position: "medianero", mainFront: 10, averageDepth: 30 },
    },
  });

  const draft = buildInmuebleDraftFromTasacion(tasacion, {
    tasacionId: "tasacion-1",
  });

  assert.equal(draft.estado, "inactivo");
  assert.equal(draft.publicarEnPortal, false);
  assert.equal(draft.noIndex, true);
  assert.equal(draft.sourceType, "tasacion");
  assert.equal(draft.sourceTasacionId, "tasacion-1");
  assert.equal(draft.superficie.cubierta, 120);
  assert.equal(draft.superficie.descubierta, 165);
  assert.equal(draft.superficie.terreno, 300);
});

const createCompleteTasacion = () => normalizeTasacion({
  propertyLink: { mode: "new" },
  scope: {
    reportType: "tasacion_profesional",
    clientName: "Cliente de prueba",
    valuationDate: "2026-08-06",
    currency: "USD",
    appraiser: {
      name: "Profesional Matriculado",
      profession: "Corredor inmobiliario",
      license: "CPI 1234",
    },
  },
  inspection: {
    inspectionDate: "2026-08-06",
    address: { city: "Córdoba", province: "Córdoba" },
  },
  subject: {
    typology: "departamento",
    usefulLife: 70,
    surfaces: { cubierta: 80 },
  },
  methods: { comparative: true, cost: false },
  comparables: [90000, 95000, 100000].map((price, index) => ({
    id: `workflow-${index}`,
    dataType: "publicacion",
    currency: "USD",
    price,
    surfaces: { cubierta: 80 },
    adjustments: { offer: 1 },
  })),
  conclusion: {
    adoptedMarketValue: 95000,
    rationale: "Se adopta el promedio de la muestra homogénea.",
  },
});

test("el circuito solo habilita transiciones válidas y congela la edición al revisar", () => {
  assert.equal(canEditTasacion("borrador"), true);
  assert.equal(canEditTasacion("observada"), true);
  assert.equal(canEditTasacion("en_revision"), false);
  assert.equal(canTransitionTasacion("borrador", "en_revision"), true);
  assert.equal(canTransitionTasacion("en_revision", "aprobada"), true);
  assert.equal(canTransitionTasacion("aprobada", "emitida"), true);
  assert.equal(canTransitionTasacion("emitida", "entregada"), true);
  assert.equal(canTransitionTasacion("emitida", "borrador"), false);
});

test("la emisión profesional exige expediente completo, matrícula y firma confirmada", () => {
  const complete = createCompleteTasacion();
  assert.deepEqual(validateTasacionForReview(complete), []);
  assert.ok(validateTasacionForIssuance(complete).some((message) => message.includes("firma")));

  complete.review.signatureConfirmed = true;
  assert.deepEqual(validateTasacionForIssuance(complete), []);

  complete.scope.appraiser.license = "";
  assert.ok(validateTasacionForIssuance(complete).some((message) => message.includes("matrícula")));
});

test("genera códigos de verificación estables, legibles y sin datos personales", () => {
  const code = createTasacionVerificationCode({
    date: new Date("2026-08-06T12:00:00Z"),
    randomUUID: () => "12345678-90ab-cdef-1234-567890abcdef",
  });
  assert.equal(code, "ONO-2026-1234567890AB");
});

test("migra borradores previos incorporando serie, flujo y emisión vacía", () => {
  const migrated = normalizeTasacion({ estado: "borrador", scope: { clientName: "Anterior" } });
  assert.equal(migrated.schemaVersion, 3);
  assert.equal(migrated.versioning.versionNumber, 1);
  assert.deepEqual(migrated.workflow.events, []);
  assert.equal(migrated.issuance.verificationCode, "");
});
