import {
  DiluentType,
  ExtrapolationCheck,
  FlameRegime,
  FuelPhase,
  InferenceInput,
  InferenceResult,
  KnowledgePassage,
  NeighborMatch,
  RiskTier,
  ScoringWeights,
  SubScores,
  UnifiedRecord,
} from '../types/combustion';
import { o2PercentToMoleFraction } from './units';

export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  ignition: 0.25,
  sustainability: 0.22,
  spread: 0.18,
  extinction: 0.15,
  coolFlame: 0.12,
  confidence: 0.08,
};

export interface HabitatPreset {
  id: string;
  label: string;
  subtitle: string;
  input: Omit<InferenceInput, 'weights'>;
}

export const HABITAT_PRESETS: HabitatPreset[] = [
  {
    id: 'iss',
    label: 'ISS Cabin',
    subtitle: '21% O2 · 101.3 kPa · 0g · N2',
    input: {
      missionName: 'ISS Cabin Nominal (101.3 kPa / 21% O2)',
      o2Percent: 21.0,
      totalPressureKPa: 101.3,
      gravityG: 0.0001,
      diluentType: 'N2',
      diluentFraction: 0.79,
      ambientFlowCmS: 15.0,
      fuelMaterial: 'SIBAL cotton-fiberglass',
      fuelPhase: 'solid',
      characteristicSizeMm: 50.0,
      ignitionEnergyMj: 250,
    },
  },
  {
    id: 'lunar',
    label: 'Lunar Habitat',
    subtitle: '34% O2 · 56.5 kPa · 0.166g · N2',
    input: {
      missionName: 'Artemis Lunar Surface Habitat (8.2 psi / 34% O2)',
      o2Percent: 34.0,
      totalPressureKPa: 56.5,
      gravityG: 0.166,
      diluentType: 'N2',
      diluentFraction: 0.66,
      ambientFlowCmS: 15.0,
      fuelMaterial: 'PMMA',
      fuelPhase: 'solid',
      characteristicSizeMm: 20.0,
      ignitionEnergyMj: 250,
    },
  },
  {
    id: 'mars',
    label: 'Mars Habitat',
    subtitle: '34% O2 · 56.5 kPa · 0.38g · N2',
    input: {
      missionName: 'Mars Transit / Surface Habitat (56.5 kPa / 34% O2)',
      o2Percent: 34.0,
      totalPressureKPa: 56.5,
      gravityG: 0.38,
      diluentType: 'N2',
      diluentFraction: 0.66,
      ambientFlowCmS: 15.0,
      fuelMaterial: 'PMMA',
      fuelPhase: 'solid',
      characteristicSizeMm: 20.0,
      ignitionEnergyMj: 250,
    },
  },
  {
    id: 'orion',
    label: 'Orion Exploration',
    subtitle: '30% O2 · 70.3 kPa · 0g · N2',
    input: {
      missionName: 'Orion Exploration Atmosphere (10.2 psi / 30% O2)',
      o2Percent: 30.0,
      totalPressureKPa: 70.3,
      gravityG: 0.0001,
      diluentType: 'N2',
      diluentFraction: 0.70,
      ambientFlowCmS: 12.0,
      fuelMaterial: 'Nomex',
      fuelPhase: 'solid',
      characteristicSizeMm: 25.0,
      ignitionEnergyMj: 300,
    },
  },
  {
    id: 'spacesuit',
    label: 'Spacesuit (EMU)',
    subtitle: '100% O2 · 29.6 kPa · 0g · None',
    input: {
      missionName: 'EVA Spacesuit Pure-O2 Loop (4.3 psi / 100% O2)',
      o2Percent: 100.0,
      totalPressureKPa: 29.6,
      gravityG: 0.0001,
      diluentType: 'None',
      diluentFraction: 0.0,
      ambientFlowCmS: 8.0,
      fuelMaterial: 'Nomex',
      fuelPhase: 'solid',
      characteristicSizeMm: 20.0,
      ignitionEnergyMj: 200,
    },
  },
  {
    id: 'earth',
    label: 'Earth Reference',
    subtitle: '21% O2 · 101.3 kPa · 1.0g · N2',
    input: {
      missionName: 'Earth 1-g Sea-Level Reference (101.3 kPa / 21% O2)',
      o2Percent: 21.0,
      totalPressureKPa: 101.3,
      gravityG: 1.0,
      diluentType: 'N2',
      diluentFraction: 0.79,
      ambientFlowCmS: 10.0,
      fuelMaterial: 'PMMA',
      fuelPhase: 'solid',
      characteristicSizeMm: 20.0,
      ignitionEnergyMj: 250,
    },
  },
];

export const GRAVITY_PRESETS = [
  { label: 'Micro-g (ISS)', value: 0.0001 },
  { label: 'Moon (0.166 g)', value: 0.166 },
  { label: 'Mars (0.38 g)', value: 0.38 },
  { label: 'Earth (1.0 g)', value: 1.0 },
];

export const FUEL_OPTIONS: Array<{ label: string; phase: FuelPhase }> = [
  { label: 'PMMA', phase: 'solid' },
  { label: 'SIBAL cotton-fiberglass', phase: 'solid' },
  { label: 'Nomex', phase: 'solid' },
  { label: 'cellulose / paper', phase: 'solid' },
  { label: 'Kapton wire insulation', phase: 'solid' },
  { label: 'silicone elastomer', phase: 'solid' },
  { label: 'n-heptane', phase: 'liquid droplet' },
  { label: 'n-dodecane', phase: 'liquid droplet' },
  { label: 'methanol', phase: 'liquid droplet' },
  { label: 'methane', phase: 'gas' },
  { label: 'ethylene', phase: 'gas' },
  { label: 'dimethyl ether', phase: 'gas' },
  { label: 'propane', phase: 'gas' },
  { label: 'hydrogen', phase: 'gas' },
];

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function getFuelFamily(fuel: string): { family: string; reactivity: number; coolFlameAffinity: number } {
  const f = fuel.toLowerCase();
  if (f.includes('dodecane')) return { family: 'heavy_alkane', reactivity: 0.86, coolFlameAffinity: 0.95 };
  if (f.includes('heptane')) return { family: 'mid_alkane', reactivity: 0.85, coolFlameAffinity: 0.88 };
  if (f.includes('methanol')) return { family: 'alcohol', reactivity: 0.72, coolFlameAffinity: 0.25 };
  if (f.includes('hydrogen') || f === 'h2') return { family: 'hydrogen', reactivity: 0.98, coolFlameAffinity: 0.05 };
  if (f.includes('ethylene') || f.includes('c2h4')) return { family: 'alkene_gas', reactivity: 0.90, coolFlameAffinity: 0.30 };
  if (f.includes('dimethyl') || f.includes('dme')) return { family: 'ether_gas', reactivity: 0.88, coolFlameAffinity: 0.92 };
  if (f.includes('butane') || f.includes('propane')) return { family: 'alkane_gas', reactivity: 0.84, coolFlameAffinity: 0.76 };
  if (f.includes('methane') || f.includes('ch4')) return { family: 'methane', reactivity: 0.75, coolFlameAffinity: 0.15 };
  if (f.includes('sibal') || f.includes('cotton') || f.includes('cellul') || f.includes('paper')) {
    return { family: 'cellulosic', reactivity: 0.82, coolFlameAffinity: 0.22 };
  }
  if (f.includes('pmma')) return { family: 'thermoplastic', reactivity: 0.74, coolFlameAffinity: 0.18 };
  if (f.includes('nomex') || f.includes('teflon') || f.includes('ptfe') || f.includes('kapton') || f.includes('silicone')) {
    return { family: 'flame_retardant_polymer', reactivity: 0.38, coolFlameAffinity: 0.28 };
  }
  return { family: 'general', reactivity: 0.65, coolFlameAffinity: 0.30 };
}

function diluentThermalFactor(d: DiluentType | null): number {
  switch (d) {
    case 'CO2':
      return -0.36; // high molar Cp + radiative absorption
    case 'He':
      return -0.20; // high thermal conductivity -> diffusive quenching
    case 'Ar':
      return 0.08;
    case 'None':
      return 0.38;
    case 'Mixed':
      return -0.10;
    case 'N2':
    default:
      return 0.0;
  }
}

function computeDistance(
  query: {
    o2MoleFraction: number;
    totalPressureKPa: number;
    gravityG: number;
    ambientFlowCmS: number;
    diluentType: DiluentType;
    fuelMaterial: string;
    fuelPhase: FuelPhase;
  },
  rec: UnifiedRecord
): { total: number; breakdown: NeighborMatch['distanceBreakdown'] } {
  const o2Diff =
    rec.O2_mole_fraction !== null
      ? Math.abs(query.o2MoleFraction - rec.O2_mole_fraction) / 0.10
      : 0.8;

  const pDiff =
    rec.total_pressure_kPa !== null && rec.total_pressure_kPa > 0
      ? Math.abs(Math.log(Math.max(5, query.totalPressureKPa)) - Math.log(Math.max(5, rec.total_pressure_kPa))) / 0.7
      : 0.6;

  const gDiff =
    rec.gravity_level_g !== null
      ? Math.abs(Math.pow(Math.max(0.00005, query.gravityG), 0.25) - Math.pow(Math.max(0.00005, rec.gravity_level_g), 0.25)) / 0.55
      : 0.5;

  const vDiff =
    rec.ambient_flow_velocity_cm_s !== null
      ? Math.abs(Math.sqrt(Math.max(0, query.ambientFlowCmS)) - Math.sqrt(Math.max(0, rec.ambient_flow_velocity_cm_s))) / 3.0
      : 0.5;

  const dilDiff =
    rec.diluent_type === null
      ? 0.5
      : rec.diluent_type === query.diluentType
      ? 0.0
      : rec.diluent_type === 'None' || query.diluentType === 'None'
      ? 1.1
      : 0.75;

  const qFam = getFuelFamily(query.fuelMaterial);
  const rFam = getFuelFamily(rec.fuel_or_material);
  let fuelDiff = 1.15;
  if (rec.fuel_or_material.toLowerCase().includes(query.fuelMaterial.toLowerCase()) ||
      query.fuelMaterial.toLowerCase().includes(rec.fuel_or_material.toLowerCase().replace(/\s*\(emulated\)/, ''))) {
    fuelDiff = 0.0;
  } else if (qFam.family === rFam.family) {
    fuelDiff = 0.25;
  } else if (rec.fuel_phase === query.fuelPhase) {
    fuelDiff = 0.65;
  }

  // Weighted Euclidean distance in normalized physics space
  const sq =
    0.30 * o2Diff * o2Diff +
    0.15 * pDiff * pDiff +
    0.18 * gDiff * gDiff +
    0.14 * vDiff * vDiff +
    0.10 * dilDiff * dilDiff +
    0.13 * fuelDiff * fuelDiff;

  return {
    total: Math.sqrt(sq),
    breakdown: {
      o2: Number(o2Diff.toFixed(3)),
      pressure: Number(pDiff.toFixed(3)),
      gravity: Number(gDiff.toFixed(3)),
      flow: Number(vDiff.toFixed(3)),
      diluent: Number(dilDiff.toFixed(3)),
      fuel: Number(fuelDiff.toFixed(3)),
    },
  };
}

/**
 * Builds the physics-informed feature vector for Ridge Regression.
 * Incorporates radiative/diffusive diluent priors, gravity buoyancy scaling,
 * pressure kinetics, and low-flow microgravity flammability extension.
 */
function buildPhysicsFeatures(params: {
  o2MoleFraction: number;
  totalPressureKPa: number;
  gravityG: number;
  ambientFlowCmS: number;
  diluentType: DiluentType | null;
  fuelMaterial: string;
}): number[] {
  const { reactivity } = getFuelFamily(params.fuelMaterial);
  const lnP = Math.log(Math.max(10, params.totalPressureKPa) / 101.325);
  const gQuarter = Math.pow(Math.max(0.00005, params.gravityG), 0.25);
  const sqrtV = Math.sqrt(Math.max(0, params.ambientFlowCmS) + 0.1) - Math.sqrt(0.1);
  // Microgravity low-flow flammability extension prior (BASS / ACME)
  const lowFlowExtension = Math.exp(-params.gravityG / 0.08) * Math.exp(-params.ambientFlowCmS / 18.0);
  const dilFactor = diluentThermalFactor(params.diluentType);

  return [
    1.0,
    params.o2MoleFraction,
    lnP,
    gQuarter,
    sqrtV,
    lowFlowExtension,
    dilFactor,
    reactivity,
  ];
}

/**
 * Solves weighted Ridge Regression: (X^T W X + lambda * I) beta = X^T W y
 * via Gaussian elimination with partial pivoting.
 */
function fitWeightedRidge(
  X: number[][],
  y: number[],
  weights: number[],
  lambda = 0.25
): number[] {
  const n = X.length;
  const p = X[0]?.length ?? 0;
  if (n === 0 || p === 0) return [];

  const A: number[][] = Array.from({ length: p }, () => Array(p).fill(0));
  const b: number[] = Array(p).fill(0);

  for (let i = 0; i < n; i++) {
    const w = weights[i];
    const xi = X[i];
    const yi = y[i];
    for (let j = 0; j < p; j++) {
      b[j] += w * xi[j] * yi;
      for (let k = 0; k < p; k++) {
        A[j][k] += w * xi[j] * xi[k];
      }
    }
  }

  // Ridge regularization (do not penalize intercept j=0)
  for (let j = 1; j < p; j++) {
    A[j][j] += lambda;
  }
  A[0][0] += 1e-6;

  // Solve A * beta = b
  for (let col = 0; col < p; col++) {
    let pivotRow = col;
    for (let row = col + 1; row < p; row++) {
      if (Math.abs(A[row][col]) > Math.abs(A[pivotRow][col])) {
        pivotRow = row;
      }
    }
    [A[col], A[pivotRow]] = [A[pivotRow], A[col]];
    [b[col], b[pivotRow]] = [b[pivotRow], b[col]];

    const diag = Math.abs(A[col][col]) < 1e-9 ? 1e-9 : A[col][col];
    for (let row = col + 1; row < p; row++) {
      const factor = A[row][col] / diag;
      for (let k = col; k < p; k++) {
        A[row][k] -= factor * A[col][k];
      }
      b[row] -= factor * b[col];
    }
  }

  const beta = Array(p).fill(0);
  for (let i = p - 1; i >= 0; i--) {
    let sum = b[i];
    for (let j = i + 1; j < p; j++) {
      sum -= A[i][j] * beta[j];
    }
    beta[i] = sum / (Math.abs(A[i][i]) < 1e-9 ? 1e-9 : A[i][i]);
  }
  return beta;
}

function dot(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * (b[i] ?? 0);
  return s;
}

function computeExtrapolationCheck(
  query: {
    o2MoleFraction: number;
    totalPressureKPa: number;
    gravityG: number;
    ambientFlowCmS: number;
    characteristicSizeMm: number;
  },
  dataset: UnifiedRecord[]
): ExtrapolationCheck {
  const validO2 = dataset.map((r) => r.O2_mole_fraction).filter((v): v is number => v !== null);
  const validP = dataset.map((r) => r.total_pressure_kPa).filter((v): v is number => v !== null);
  const validG = dataset.map((r) => r.gravity_level_g).filter((v): v is number => v !== null);
  const validV = dataset.map((r) => r.ambient_flow_velocity_cm_s).filter((v): v is number => v !== null);
  const validSize = dataset.map((r) => r.characteristic_size_mm).filter((v): v is number => v !== null);

  const out: ExtrapolationCheck['outOfRangeDimensions'] = [];

  const checkDim = (
    name: string,
    qVal: number,
    arr: number[],
    fmt: (v: number) => string
  ) => {
    if (!arr.length) return;
    const min = Math.min(...arr);
    const max = Math.max(...arr);
    if (qVal < min - 1e-6 || qVal > max + 1e-6) {
      out.push({
        dimension: name,
        queryValue: fmt(qVal),
        datasetMin: fmt(min),
        datasetMax: fmt(max),
      });
    }
  };

  checkDim('O2 Concentration', query.o2MoleFraction, validO2, (v) => `${(v * 100).toFixed(1)}%`);
  checkDim('Total Pressure', query.totalPressureKPa, validP, (v) => `${v.toFixed(1)} kPa`);
  checkDim('Gravity Level', query.gravityG, validG, (v) => `${v.toFixed(4)} g`);
  checkDim('Ambient Flow Velocity', query.ambientFlowCmS, validV, (v) => `${v.toFixed(1)} cm/s`);
  checkDim('Characteristic Size', query.characteristicSizeMm, validSize, (v) => `${v.toFixed(1)} mm`);

  const coverage = clamp(1 - out.length * 0.22, 0.15, 1.0);
  return {
    isExtrapolating: out.length > 0,
    outOfRangeDimensions: out,
    convexCoverageScore: Number(coverage.toFixed(3)),
  };
}

export function normalizeWeights(w?: Partial<ScoringWeights>): ScoringWeights {
  const merged: ScoringWeights = {
    ignition: Math.max(0, w?.ignition ?? DEFAULT_SCORING_WEIGHTS.ignition),
    sustainability: Math.max(0, w?.sustainability ?? DEFAULT_SCORING_WEIGHTS.sustainability),
    spread: Math.max(0, w?.spread ?? DEFAULT_SCORING_WEIGHTS.spread),
    extinction: Math.max(0, w?.extinction ?? DEFAULT_SCORING_WEIGHTS.extinction),
    coolFlame: Math.max(0, w?.coolFlame ?? DEFAULT_SCORING_WEIGHTS.coolFlame),
    confidence: Math.max(0, w?.confidence ?? DEFAULT_SCORING_WEIGHTS.confidence),
  };
  const sum =
    merged.ignition +
    merged.sustainability +
    merged.spread +
    merged.extinction +
    merged.coolFlame +
    merged.confidence;
  if (sum <= 0) return { ...DEFAULT_SCORING_WEIGHTS };
  return {
    ignition: merged.ignition / sum,
    sustainability: merged.sustainability / sum,
    spread: merged.spread / sum,
    extinction: merged.extinction / sum,
    coolFlame: merged.coolFlame / sum,
    confidence: merged.confidence / sum,
  };
}

export function computeDatasetVersionHash(dataset: UnifiedRecord[]): string {
  return `psi-${dataset.length}-${dataset.map((r) => r.id).slice(0, 5).join('_')}`;
}

/**
 * Evaluates the physics-informed prediction at arbitrary O2 while holding the fitted
 * model and non-O2 query parameters fixed, enabling both LOI root-finding and strict
 * physical monotonicity verification.
 */
function evaluateCorePredictions(
  o2MoleFraction: number,
  baseQuery: {
    totalPressureKPa: number;
    gravityG: number;
    ambientFlowCmS: number;
    diluentType: DiluentType;
    fuelMaterial: string;
    fuelPhase: FuelPhase;
    characteristicSizeMm: number;
    ignitionEnergyMj: number;
  },
  betas: {
    betaIgn: number[];
    betaExt: number[];
    betaSpread: number[];
    betaTemp: number[];
  }
) {
  const feat = buildPhysicsFeatures({
    o2MoleFraction,
    totalPressureKPa: baseQuery.totalPressureKPa,
    gravityG: baseQuery.gravityG,
    ambientFlowCmS: baseQuery.ambientFlowCmS,
    diluentType: baseQuery.diluentType,
    fuelMaterial: baseQuery.fuelMaterial,
  });

  const fam = getFuelFamily(baseQuery.fuelMaterial);
  const dilThermal = diluentThermalFactor(baseQuery.diluentType);
  const energyBoost = clamp((Math.log10(Math.max(10, baseQuery.ignitionEnergyMj)) - 2.0) * 0.04, -0.05, 0.12);

  // Combine empirical ridge model with monotonic O2 physical constraint
  const rawIgn = dot(betas.betaIgn, feat);
  const o2SlopeIgn = Math.max(2.1, betas.betaIgn[1] ?? 2.3);
  const ignAdj = rawIgn + (o2SlopeIgn - (betas.betaIgn[1] ?? 0)) * (o2MoleFraction - 0.21) + energyBoost;
  const ignitionProbability = clamp(ignAdj, 0.02, 0.995);

  const rawExt = dot(betas.betaExt, feat);
  const o2SlopeExt = Math.min(-1.9, betas.betaExt[1] ?? -2.1);
  const extAdj = rawExt + (o2SlopeExt - (betas.betaExt[1] ?? 0)) * (o2MoleFraction - 0.21);
  const extinctionLikelihood = clamp(extAdj, 0.01, 0.98);

  const rawSpread = dot(betas.betaSpread, feat);
  const o2SlopeSpread = Math.max(4.5, betas.betaSpread[1] ?? 6.0);
  const spreadAdj = rawSpread + (o2SlopeSpread - (betas.betaSpread[1] ?? 0)) * (o2MoleFraction - 0.21);
  const predictedSpreadOrBurnRate = Math.max(0, spreadAdj * (1 - extinctionLikelihood * 0.65));

  const rawTemp = dot(betas.betaTemp, feat);
  const o2SlopeTemp = Math.max(900, betas.betaTemp[1] ?? 1200);
  const tempAdj = rawTemp + (o2SlopeTemp - (betas.betaTemp[1] ?? 0)) * (o2MoleFraction - 0.21);
  const predictedPeakTemperatureK = clamp(
    tempAdj + dilThermal * 180,
    550,
    2750
  );

  // Cool flame risk: promoted by low gravity, elevated pressure, long-chain alkanes / DME, and radiative cooling near ~1200 K
  const pressureKinetics = clamp(Math.log(Math.max(20, baseQuery.totalPressureKPa) / 50) / 1.8, 0, 1);
  const microgBoost = Math.exp(-baseQuery.gravityG / 0.15);
  const dropletGeometryFactor = baseQuery.fuelPhase === 'liquid droplet' ? 1.0 : baseQuery.fuelPhase === 'gas' ? 0.55 : 0.25;
  const tempProximityTo1200 = Math.exp(-Math.pow((predictedPeakTemperatureK - 1150) / 480, 2));
  const coolFlameRiskScore = clamp(
    (0.35 * fam.coolFlameAffinity + 0.25 * pressureKinetics + 0.20 * microgBoost + 0.20 * tempProximityTo1200) *
      dropletGeometryFactor *
      (0.55 + 0.45 * ignitionProbability),
    0.02,
    0.96
  );

  return {
    ignitionProbability,
    extinctionLikelihood,
    predictedSpreadOrBurnRate,
    predictedPeakTemperatureK,
    coolFlameRiskScore,
  };
}

/**
 * Main Scientific Inference Pipeline.
 */
export function runInference(
  input: InferenceInput,
  dataset: UnifiedRecord[],
  knowledgeBase: KnowledgePassage[]
): InferenceResult {
  const o2MoleFraction = o2PercentToMoleFraction(input.o2Percent);
  const diluentFraction =
    input.diluentType === 'None'
      ? 0
      : clamp(input.diluentFraction > 0 ? Math.min(input.diluentFraction, 1 - o2MoleFraction) : 1 - o2MoleFraction, 0, 1);

  const queryNorm = {
    o2MoleFraction,
    totalPressureKPa: clamp(input.totalPressureKPa, 5, 1000),
    gravityG: clamp(input.gravityG, 0.00001, 2.0),
    diluentType: input.diluentType,
    diluentFraction,
    ambientFlowCmS: clamp(input.ambientFlowCmS, 0, 200),
    fuelMaterial: input.fuelMaterial.trim() || 'PMMA',
    fuelPhase: input.fuelPhase,
    characteristicSizeMm: clamp(input.characteristicSizeMm, 0.1, 1000),
    ignitionEnergyMj: clamp(input.ignitionEnergyMj, 1, 10000),
  };

  const combustionRecords = dataset.filter(
    (r) => r.O2_mole_fraction !== null && r.total_pressure_kPa !== null
  );

  if (combustionRecords.length < 3) {
    const weightsUsed = normalizeWeights(input.weights);
    return {
      timestamp: new Date().toISOString(),
      datasetVersionHash: computeDatasetVersionHash(dataset),
      normalizedInput: queryNorm,
      fireSafetyIndex: 0,
      riskTier: 'Critical',
      subScores: {
        ignitionSafety: 0,
        sustainabilitySafety: 0,
        spreadSafety: 0,
        extinctionMargin: 0,
        coolFlameMargin: 0,
        dataConfidence: 0,
      },
      weightsUsed,
      predictions: {
        ignitionProbability: 0,
        ignitionInterval: [0, 1],
        extinctionLikelihood: 0,
        extinctionInterval: [0, 1],
        predictedHotExtinctionDiameterMm: null,
        predictedCoolExtinctionDiameterMm: null,
        likelyFlameRegime: 'none',
        regimeProbabilities: { hot: 0, warm: 0, cool: 0, oscillatory: 0, 'multi-stage': 0, none: 1 },
        spreadOrBurnRateRelativeToEarth: 1,
        predictedSpreadOrBurnRate: 0,
        predictedPeakTemperatureK: 295,
        limitingOxygenIndexPercent: 21,
        loiInterval: [10, 40],
        coolFlameRiskScore: 0,
      },
      confidence: 0,
      effectiveSampleSize: 0,
      extrapolation: {
        isExtrapolating: true,
        outOfRangeDimensions: [{ dimension: 'Dataset', queryValue: 'Any', datasetMin: 'N/A', datasetMax: 'N/A' }],
        convexCoverageScore: 0,
      },
      nearestNeighbors: [],
      relevantPassages: [],
      insufficientDataReason: 'Dataset contains fewer than 3 combustion records with O2 and pressure measurements.',
    };
  }

  // 1. Weighted Similarity Search (top-k)
  const scoredMatches: NeighborMatch[] = combustionRecords
    .map((record) => {
      const dist = computeDistance(queryNorm, record);
      const similarity = Math.exp(-(dist.total * dist.total) / 0.85);
      return {
        record,
        similarity,
        distanceBreakdown: dist.breakdown,
      };
    })
    .sort((a, b) => b.similarity - a.similarity);

  const nearestNeighbors = scoredMatches.slice(0, 8);

  // 2. Kernel-Weighted Ridge Regression over the unified dataset
  // Note: To prevent O2 density fluctuations from breaking O2 monotonicity,
  // kernel weights for model fitting use non-O2 context similarity (pressure, gravity, flow, diluent, fuel).
  const contextWeights = combustionRecords.map((rec) => {
    const dist = computeDistance({ ...queryNorm, o2MoleFraction: rec.O2_mole_fraction ?? queryNorm.o2MoleFraction }, rec);
    return Math.max(0.02, Math.exp(-(dist.total * dist.total) / 0.95));
  });

  const X: number[][] = [];
  const yIgn: number[] = [];
  const yExt: number[] = [];
  const ySpread: number[] = [];
  const wSpread: number[] = [];
  const XSpread: number[][] = [];
  const yTemp: number[] = [];
  const wTemp: number[] = [];
  const XTemp: number[][] = [];

  combustionRecords.forEach((rec, i) => {
    const feat = buildPhysicsFeatures({
      o2MoleFraction: rec.O2_mole_fraction ?? 0.21,
      totalPressureKPa: rec.total_pressure_kPa ?? 101.3,
      gravityG: rec.gravity_level_g ?? 0.0001,
      ambientFlowCmS: rec.ambient_flow_velocity_cm_s ?? 0,
      diluentType: rec.diluent_type,
      fuelMaterial: rec.fuel_or_material,
    });
    const w = contextWeights[i];

    const ignVal =
      rec.observed_outcome === 'sustained'
        ? 0.95
        : rec.observed_outcome === 'ignited'
        ? 0.78
        : rec.observed_outcome === 'extinguished'
        ? 0.55
        : 0.06;
    const extVal =
      rec.observed_outcome === 'no ignition'
        ? 0.95
        : rec.observed_outcome === 'extinguished'
        ? 0.82
        : rec.observed_outcome === 'ignited'
        ? 0.35
        : 0.08;

    X.push(feat);
    yIgn.push(ignVal);
    yExt.push(extVal);

    if (rec.burn_rate_or_spread_rate !== null) {
      XSpread.push(feat);
      ySpread.push(rec.burn_rate_or_spread_rate);
      wSpread.push(w);
    }
    if (rec.peak_temperature_K !== null) {
      XTemp.push(feat);
      yTemp.push(rec.peak_temperature_K);
      wTemp.push(w);
    }
  });

  const betas = {
    betaIgn: fitWeightedRidge(X, yIgn, contextWeights, 0.35),
    betaExt: fitWeightedRidge(X, yExt, contextWeights, 0.35),
    betaSpread: fitWeightedRidge(XSpread, ySpread, wSpread, 0.45),
    betaTemp: fitWeightedRidge(XTemp, yTemp, wTemp, 0.50),
  };

  // 3. Evaluate at Query Point and at 1g Earth Counterfactual
  const core = evaluateCorePredictions(queryNorm.o2MoleFraction, queryNorm, betas);
  const earthCounterfactual = evaluateCorePredictions(
    queryNorm.o2MoleFraction,
    { ...queryNorm, gravityG: 1.0 },
    betas
  );

  const spreadOrBurnRateRelativeToEarth = Number(
    clamp(
      core.predictedSpreadOrBurnRate / Math.max(0.25, earthCounterfactual.predictedSpreadOrBurnRate),
      0.15,
      3.5
    ).toFixed(2)
  );

  // 4. Solve for Limiting Oxygen Index (LOI) via 24-step bisection
  let lo = 0.08;
  let hi = 0.55;
  for (let iter = 0; iter < 24; iter++) {
    const mid = 0.5 * (lo + hi);
    const probe = evaluateCorePredictions(mid, queryNorm, betas);
    const sustainedMargin = probe.ignitionProbability - 0.55 * probe.extinctionLikelihood;
    if (sustainedMargin >= 0.32) {
      hi = mid;
    } else {
      lo = mid;
    }
  }
  const loiFraction = 0.5 * (lo + hi);
  const limitingOxygenIndexPercent = Number((loiFraction * 100).toFixed(1));

  // 5. Predict Droplet/Spherical Extinction Diameters if applicable
  let predictedHotExtinctionDiameterMm: number | null = null;
  let predictedCoolExtinctionDiameterMm: number | null = null;
  const dropletMatches = scoredMatches.filter((m) => m.record.extinction_diameter_mm !== null);

  if (queryNorm.fuelPhase === 'liquid droplet' && dropletMatches.length > 0) {
    let hotSum = 0;
    let hotW = 0;
    let coolSum = 0;
    let coolW = 0;
    for (const m of dropletMatches) {
      const de = m.record.extinction_diameter_mm!;
      const w = Math.max(0.01, m.similarity);
      if (m.record.flame_regime === 'cool' || m.record.flame_regime === 'multi-stage') {
        coolSum += w * de;
        coolW += w;
      } else {
        hotSum += w * de;
        hotW += w;
      }
    }
    const o2Scaling = clamp(0.21 / Math.max(0.10, queryNorm.o2MoleFraction), 0.55, 1.8);
    const dilScale = queryNorm.diluentType === 'He' ? 1.45 : queryNorm.diluentType === 'CO2' ? 1.25 : 1.0;
    predictedHotExtinctionDiameterMm = Number(((hotW > 0 ? hotSum / hotW : 0.45) * o2Scaling * dilScale).toFixed(3));
    predictedCoolExtinctionDiameterMm = Number(((coolW > 0 ? coolSum / coolW : 0.28) * o2Scaling).toFixed(3));
  }

  // 6. Regime Probabilities (kernel-weighted votes + ~1200K radiative cool-flame physics prior)
  const regimeScores: Record<FlameRegime, number> = {
    hot: 0.05,
    warm: 0.03,
    cool: 0.03,
    oscillatory: 0.03,
    'multi-stage': 0.03,
    none: 0.02,
  };
  for (const m of scoredMatches.slice(0, 12)) {
    const reg = m.record.flame_regime ?? 'hot';
    regimeScores[reg] += m.similarity;
  }
  // Physics priors on regime
  if (core.ignitionProbability < 0.28 || core.extinctionLikelihood > 0.85) {
    regimeScores.none += 1.8;
  } else {
    if (core.predictedPeakTemperatureK >= 1400) regimeScores.hot += 1.4;
    if (core.predictedPeakTemperatureK < 1250 && core.coolFlameRiskScore > 0.45) {
      regimeScores.cool += 1.6 * core.coolFlameRiskScore;
      regimeScores['multi-stage'] += 0.9 * core.coolFlameRiskScore;
    }
    if (queryNorm.diluentType === 'CO2' || core.extinctionLikelihood > 0.5) {
      regimeScores.oscillatory += 0.7;
    }
  }
  const totalRegimeWeight = Object.values(regimeScores).reduce((a, b) => a + b, 0) || 1;
  const regimeProbabilities = {} as Record<FlameRegime, number>;
  let likelyFlameRegime: FlameRegime = 'hot';
  let bestP = -1;
  (Object.keys(regimeScores) as FlameRegime[]).forEach((k) => {
    const p = Number((regimeScores[k] / totalRegimeWeight).toFixed(3));
    regimeProbabilities[k] = p;
    if (p > bestP) {
      bestP = p;
      likelyFlameRegime = k;
    }
  });

  // 7. Confidence, Effective Sample Size & Extrapolation Check
  const effectiveSampleSize = Number(
    scoredMatches.reduce((acc, m) => acc + m.similarity, 0).toFixed(2)
  );
  const top3Sim =
    nearestNeighbors.slice(0, 3).reduce((acc, m) => acc + m.similarity, 0) /
    Math.max(1, Math.min(3, nearestNeighbors.length));

  // Context density computed independently of O2 peakiness so O2 monotonicity holds cleanly
  const contextEss = Number(contextWeights.reduce((acc, w) => acc + w, 0).toFixed(2));
  const extrapolation = computeExtrapolationCheck(queryNorm, combustionRecords);

  const rawConfidence = clamp(
    (0.65 * top3Sim + 0.35 * clamp(effectiveSampleSize / 8, 0, 1)) * 100 * extrapolation.convexCoverageScore,
    8,
    98
  );
  const confidence = Number(rawConfidence.toFixed(1));

  // Context-only confidence component used inside Fire Safety Index so raising O2 never raises Fire Safety Index
  const contextConfidenceScore = Number(
    clamp(
      (0.5 + 0.5 * clamp(contextEss / 10, 0, 1)) * 100 * (extrapolation.isExtrapolating ? 0.75 : 1.0),
      15,
      95
    ).toFixed(1)
  );

  // Widen intervals on extrapolation or low confidence
  const halfWidth = clamp(0.06 + (100 - confidence) / 380 + (extrapolation.isExtrapolating ? 0.12 : 0), 0.05, 0.38);
  const ignitionInterval: [number, number] = [
    Number(clamp(core.ignitionProbability - halfWidth, 0, 1).toFixed(3)),
    Number(clamp(core.ignitionProbability + halfWidth, 0, 1).toFixed(3)),
  ];
  const extinctionInterval: [number, number] = [
    Number(clamp(core.extinctionLikelihood - halfWidth, 0, 1).toFixed(3)),
    Number(clamp(core.extinctionLikelihood + halfWidth, 0, 1).toFixed(3)),
  ];
  const loiHalfWidth = Number(clamp(1.2 + (100 - confidence) * 0.08 + (extrapolation.isExtrapolating ? 3.0 : 0), 1.0, 9.0).toFixed(1));
  const loiInterval: [number, number] = [
    Number(clamp(limitingOxygenIndexPercent - loiHalfWidth, 5, 95).toFixed(1)),
    Number(clamp(limitingOxygenIndexPercent + loiHalfWidth, 5, 95).toFixed(1)),
  ];

  // 8. Transparent 0-100 Fire Safety Index (higher = safer)
  const loiMarginComponent = clamp(50 + (limitingOxygenIndexPercent - input.o2Percent) * 4.2, 0, 100);
  const subScores: SubScores = {
    ignitionSafety: Number(clamp(100 * (1 - core.ignitionProbability), 0, 100).toFixed(1)),
    sustainabilitySafety: Number(
      clamp(100 * (1 - clamp(core.ignitionProbability * (1 - 0.5 * core.extinctionLikelihood), 0, 1)), 0, 100).toFixed(1)
    ),
    spreadSafety: Number(clamp(100 * Math.exp(-0.22 * core.predictedSpreadOrBurnRate), 0, 100).toFixed(1)),
    extinctionMargin: Number(clamp(0.55 * (core.extinctionLikelihood * 100) + 0.45 * loiMarginComponent, 0, 100).toFixed(1)),
    coolFlameMargin: Number(clamp(100 * (1 - core.coolFlameRiskScore), 0, 100).toFixed(1)),
    dataConfidence: confidence,
  };

  const weightsUsed = normalizeWeights(input.weights);
  // Note: uses contextConfidenceScore for the weighted confidence term when O2 varies so raising O2 strictly cannot raise Fire Safety Index
  const safetyRaw =
    weightsUsed.ignition * subScores.ignitionSafety +
    weightsUsed.sustainability * subScores.sustainabilitySafety +
    weightsUsed.spread * subScores.spreadSafety +
    weightsUsed.extinction * subScores.extinctionMargin +
    weightsUsed.coolFlame * subScores.coolFlameMargin +
    weightsUsed.confidence * Math.min(subScores.dataConfidence, contextConfidenceScore);

  // Additional smooth physical O2 monotonic safety ceiling above 21% O2
  const o2Penalty = Math.max(0, input.o2Percent - 21) * 0.35;
  const fireSafetyIndex = Number(clamp(safetyRaw - o2Penalty, 0, 100).toFixed(1));

  const riskTier: RiskTier =
    fireSafetyIndex >= 72
      ? 'Low'
      : fireSafetyIndex >= 48
      ? 'Moderate'
      : fireSafetyIndex >= 26
      ? 'High'
      : 'Critical';

  // 9. Knowledge Base Evidence Retrieval
  const neighborExpIds = new Set(nearestNeighbors.map((n) => n.record.experiment_id));
  const queryTokens = [
    queryNorm.fuelMaterial.toLowerCase(),
    queryNorm.fuelPhase.toLowerCase(),
    queryNorm.diluentType.toLowerCase(),
    likelyFlameRegime,
    queryNorm.gravityG < 0.05 ? 'microgravity' : 'gravity',
    core.coolFlameRiskScore > 0.4 ? 'cool flame' : '',
  ].filter(Boolean);

  const relevantPassages = knowledgeBase
    .map((passage) => {
      const hay = `${passage.title} ${passage.text} ${passage.tags.join(' ')}`.toLowerCase();
      let score = neighborExpIds.has(passage.experiment_id) ? 3.0 : 0;
      for (const tok of queryTokens) {
        if (hay.includes(tok)) score += 1.2;
      }
      return { passage, relevanceScore: Number(score.toFixed(2)) };
    })
    .filter((p) => p.relevanceScore > 0.5)
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, 5);

  return {
    timestamp: new Date().toISOString(),
    datasetVersionHash: computeDatasetVersionHash(dataset),
    normalizedInput: queryNorm,
    fireSafetyIndex,
    riskTier,
    subScores,
    weightsUsed,
    predictions: {
      ignitionProbability: Number(core.ignitionProbability.toFixed(3)),
      ignitionInterval,
      extinctionLikelihood: Number(core.extinctionLikelihood.toFixed(3)),
      extinctionInterval,
      predictedHotExtinctionDiameterMm,
      predictedCoolExtinctionDiameterMm,
      likelyFlameRegime,
      regimeProbabilities,
      spreadOrBurnRateRelativeToEarth,
      predictedSpreadOrBurnRate: Number(core.predictedSpreadOrBurnRate.toFixed(2)),
      predictedPeakTemperatureK: Math.round(core.predictedPeakTemperatureK),
      limitingOxygenIndexPercent,
      loiInterval,
      coolFlameRiskScore: Number(core.coolFlameRiskScore.toFixed(3)),
    },
    confidence,
    effectiveSampleSize,
    extrapolation,
    nearestNeighbors,
    relevantPassages,
  };
}
