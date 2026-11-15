export type PlatformType = 'ISS' | 'Shuttle' | 'Cygnus' | 'Drop Tower' | 'Parabolic' | 'Ground';
export type FuelPhase = 'solid' | 'liquid droplet' | 'gas';
export type DiluentType = 'N2' | 'CO2' | 'He' | 'Ar' | 'Mixed' | 'None';
export type ObservedOutcome = 'ignited' | 'sustained' | 'extinguished' | 'no ignition';
export type FlameRegime = 'hot' | 'warm' | 'cool' | 'oscillatory' | 'multi-stage' | 'none';
export type UnitSystem = 'metric' | 'imperial';
export type RiskTier = 'Low' | 'Moderate' | 'High' | 'Critical';

export const CANONICAL_FIELDS = [
  'experiment_id',
  'experiment_name',
  'platform',
  'fuel_or_material',
  'fuel_phase',
  'geometry',
  'characteristic_size_mm',
  'O2_mole_fraction',
  'total_pressure_kPa',
  'diluent_type',
  'diluent_fraction',
  'gravity_level_g',
  'ambient_flow_velocity_cm_s',
  'ignition_energy_or_method',
  'observed_outcome',
  'flame_regime',
  'extinction_diameter_mm',
  'burn_rate_or_spread_rate',
  'peak_temperature_K',
  'flame_standoff_ratio',
  'source_file',
  'source_row',
] as const;

export type CanonicalField = (typeof CANONICAL_FIELDS)[number];

export interface UnifiedRecord {
  id: string;
  experiment_id: string;
  experiment_name: string;
  platform: PlatformType;
  fuel_or_material: string;
  fuel_phase: FuelPhase;
  geometry: string | null;
  characteristic_size_mm: number | null;
  O2_mole_fraction: number | null;
  total_pressure_kPa: number | null;
  diluent_type: DiluentType | null;
  diluent_fraction: number | null;
  gravity_level_g: number | null;
  ambient_flow_velocity_cm_s: number | null;
  ignition_energy_or_method: string | null;
  observed_outcome: ObservedOutcome | null;
  flame_regime: FlameRegime | null;
  extinction_diameter_mm: number | null;
  burn_rate_or_spread_rate: number | null;
  peak_temperature_K: number | null;
  flame_standoff_ratio: number | null;
  source_file: string;
  source_row: number | null;
  doi_link?: string | null;
}

export interface PSIIndexEntry {
  psi_id: string;
  short_name: string;
  full_title: string;
  investigators: string;
  version: string;
  doi_url: string;
  category: 'combustion' | 'aerosol_smoke' | 'non_combustion_reference';
  platform: PlatformType;
  fuel_phase: FuelPhase | 'N/A';
  source_filename: string;
  description: string;
}

export interface KnowledgePassage {
  id: string;
  experiment_id: string;
  experiment_name: string;
  title: string;
  source_file: string;
  page_or_section: string;
  text: string;
  tags: string[];
  doi_url?: string;
}

export interface ColumnSchemaInfo {
  header: string;
  inferred_canonical_field: CanonicalField | 'unmapped';
  detected_unit: string;
  conversion_applied: string;
  data_type: 'number' | 'string' | 'mixed' | 'empty';
  non_null_count: number;
  min: number | null;
  max: number | null;
  sample_values: string[];
}

export interface SchemaRegistryEntry {
  filename: string;
  file_type: 'csv' | 'xlsx' | 'pdf' | 'doc' | 'docx' | 'json' | 'baseline';
  sheet_name?: string;
  row_count: number;
  status: 'parsed' | 'partial' | 'failed' | 'indexed_only';
  failure_reason?: string;
  headers: ColumnSchemaInfo[];
  unit_conversions: string[];
  ingested_at: string;
}

export interface IngestionReport {
  generated_at: string;
  files: SchemaRegistryEntry[];
  total_records: number;
  total_passages: number;
  field_completeness: Record<CanonicalField, number>;
  experiment_completeness: Array<{
    experiment_name: string;
    experiment_id: string;
    row_count: number;
    fields: Record<CanonicalField, number>;
  }>;
  unit_conversions_log: Array<{
    source_file: string;
    column: string;
    from_unit: string;
    to_unit: string;
    rule: string;
  }>;
  failed_files: Array<{
    filename: string;
    file_type: string;
    reason: string;
  }>;
}

export interface ScoringWeights {
  ignition: number;
  sustainability: number;
  spread: number;
  extinction: number;
  coolFlame: number;
  confidence: number;
}

export interface InferenceInput {
  missionName: string;
  o2Percent: number; // % vol (0-100)
  totalPressureKPa: number; // kPa
  gravityG: number; // 0 to 1+ g
  diluentType: DiluentType;
  diluentFraction: number; // 0 to 1
  ambientFlowCmS: number; // cm/s
  fuelMaterial: string;
  fuelPhase: FuelPhase;
  characteristicSizeMm: number; // mm
  ignitionEnergyMj: number; // mJ
  weights?: ScoringWeights;
}

export interface NeighborMatch {
  record: UnifiedRecord;
  similarity: number; // 0..1
  distanceBreakdown: {
    o2: number;
    pressure: number;
    gravity: number;
    flow: number;
    diluent: number;
    fuel: number;
  };
}

export interface SubScores {
  ignitionSafety: number; // 0-100 (higher = safer)
  sustainabilitySafety: number; // 0-100
  spreadSafety: number; // 0-100
  extinctionMargin: number; // 0-100
  coolFlameMargin: number; // 0-100
  dataConfidence: number; // 0-100
}

export interface ExtrapolationCheck {
  isExtrapolating: boolean;
  outOfRangeDimensions: Array<{
    dimension: string;
    queryValue: string;
    datasetMin: string;
    datasetMax: string;
  }>;
  convexCoverageScore: number; // 0..1
}

export interface InferenceResult {
  timestamp: string;
  datasetVersionHash: string;
  normalizedInput: {
    o2MoleFraction: number;
    totalPressureKPa: number;
    gravityG: number;
    diluentType: DiluentType;
    diluentFraction: number;
    ambientFlowCmS: number;
    fuelMaterial: string;
    fuelPhase: FuelPhase;
    characteristicSizeMm: number;
    ignitionEnergyMj: number;
  };
  fireSafetyIndex: number; // 0..100 (higher = safer)
  riskTier: RiskTier;
  subScores: SubScores;
  weightsUsed: ScoringWeights;
  predictions: {
    ignitionProbability: number; // 0..1
    ignitionInterval: [number, number];
    extinctionLikelihood: number; // 0..1
    extinctionInterval: [number, number];
    predictedHotExtinctionDiameterMm: number | null;
    predictedCoolExtinctionDiameterMm: number | null;
    likelyFlameRegime: FlameRegime;
    regimeProbabilities: Record<FlameRegime, number>;
    spreadOrBurnRateRelativeToEarth: number; // ratio e.g. 1.24x or 0.65x
    predictedSpreadOrBurnRate: number;
    predictedPeakTemperatureK: number;
    limitingOxygenIndexPercent: number;
    loiInterval: [number, number];
    coolFlameRiskScore: number; // 0..1
  };
  confidence: number; // 0..100
  effectiveSampleSize: number;
  extrapolation: ExtrapolationCheck;
  nearestNeighbors: NeighborMatch[];
  relevantPassages: Array<{
    passage: KnowledgePassage;
    relevanceScore: number;
  }>;
  insufficientDataReason?: string;
}

export interface SavedScenario {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  input: InferenceInput;
  result: InferenceResult;
  narrative?: string;
  narrativeModel?: string;
}
