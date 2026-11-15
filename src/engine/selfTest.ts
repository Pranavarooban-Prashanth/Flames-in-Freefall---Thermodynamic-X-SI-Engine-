import { BASELINE_UNIFIED_DATASET } from '../data/baselineDataset';
import { BASELINE_KNOWLEDGE_BASE } from '../data/knowledgeBase';
import { PSI_MASTER_INDEX } from '../data/psiIndex';
import { discoverColumnMapping, inspectTabularRows } from './ingestion';
import { HABITAT_PRESETS, runInference } from './inference';
import {
  gravityToG,
  kPaToUnit,
  lengthToMm,
  o2MoleFractionToPercent,
  o2PercentToMoleFraction,
  pressureToKPa,
  temperatureToKelvin,
  velocityToCmS,
} from './units';

export interface SelfTestCase {
  id: string;
  category: 'Units' | 'Ingestion' | 'Similarity' | 'Monotonicity' | 'Uncertainty';
  name: string;
  passed: boolean;
  details: string;
}

export function runEngineSelfTests(): SelfTestCase[] {
  const results: SelfTestCase[] = [];

  // 1. Unit Conversion Tests
  const pKpa = pressureToKPa(1, 'atm');
  const pBack = kPaToUnit(pKpa, 'atm');
  const psiKpa = pressureToKPa(14.6959, 'psi');
  const gVal = gravityToG(9.80665, 'm/s2');
  const vVal = velocityToCmS(200, 'mm/s');
  const lVal = lengthToMm(1, 'in');
  const tVal = temperatureToKelvin(100, 'C');
  const o2Frac = o2PercentToMoleFraction(21);
  const o2Pct = o2MoleFractionToPercent(o2Frac);

  results.push({
    id: 'unit-1',
    category: 'Units',
    name: 'SI <-> Imperial & Pressure/Gravity/Flow Conversions',
    passed:
      Math.abs(pKpa - 101.325) < 1e-3 &&
      Math.abs(pBack - 1) < 1e-4 &&
      Math.abs(psiKpa - 101.325) < 0.05 &&
      Math.abs(gVal - 1.0) < 1e-4 &&
      Math.abs(vVal - 20) < 1e-4 &&
      Math.abs(lVal - 25.4) < 1e-4 &&
      Math.abs(tVal - 373.15) < 1e-4 &&
      Math.abs(o2Pct - 21) < 1e-4,
    details: `1 atm=${pKpa.toFixed(3)} kPa, 9.80665 m/s2=${gVal.toFixed(3)} g, 200 mm/s=${vVal} cm/s, 1 in=${lVal} mm`,
  });

  // 2. Ingestion Header & Unit Mismatch Discovery
  const o2MapPct = discoverColumnMapping('O2_concentration', [18, 21, 34]);
  const o2MapFrac = discoverColumnMapping('X_O2', [0.18, 0.21, 0.34]);
  const pMapAtm = discoverColumnMapping('chamber_pressure', [0.5, 1.0, 3.0]);
  const vMapMm = discoverColumnMapping('flow_mm/s', [100, 200, 300]);
  const parsedSample = inspectTabularRows(
    'test_ingest.csv',
    'csv',
    [{ O2_pct: 21, P_atm: 2.0, flow_mm_s: 150, fuel: 'n-heptane' }],
    undefined,
    PSI_MASTER_INDEX
  );

  results.push({
    id: 'ingest-1',
    category: 'Ingestion',
    name: 'Automatic Unit Mismatch Discovery (O2 %, atm, mm/s -> SI)',
    passed:
      o2MapPct.detectedUnit === '% vol' &&
      o2MapFrac.detectedUnit === 'mole fraction' &&
      pMapAtm.detectedUnit === 'atm' &&
      vMapMm.detectedUnit === 'mm/s' &&
      Math.abs((parsedSample.records[0]?.O2_mole_fraction ?? 0) - 0.21) < 1e-4 &&
      Math.abs((parsedSample.records[0]?.total_pressure_kPa ?? 0) - 202.65) < 0.1,
    details: `Detected O2(${o2MapPct.detectedUnit} vs ${o2MapFrac.detectedUnit}), P(${pMapAtm.detectedUnit}), converted 2 atm -> ${parsedSample.records[0]?.total_pressure_kPa?.toFixed(2)} kPa`,
  });

  // 3. Similarity Search Accuracy
  const flexProbe = runInference(
    {
      missionName: 'FLEX Heptane Probe',
      o2Percent: 21,
      totalPressureKPa: 101.3,
      gravityG: 0.0001,
      diluentType: 'N2',
      diluentFraction: 0.79,
      ambientFlowCmS: 0.0,
      fuelMaterial: 'n-heptane',
      fuelPhase: 'liquid droplet',
      characteristicSizeMm: 3.1,
      ignitionEnergyMj: 250,
    },
    BASELINE_UNIFIED_DATASET,
    BASELINE_KNOWLEDGE_BASE
  );

  results.push({
    id: 'sim-1',
    category: 'Similarity',
    name: 'Weighted k-NN Retrieves Exact Matching FLEX Experiment First',
    passed:
      flexProbe.nearestNeighbors.length >= 5 &&
      flexProbe.nearestNeighbors[0].record.experiment_name.includes('FLEX') &&
      flexProbe.nearestNeighbors[0].similarity > 0.9,
    details: `Top match: ${flexProbe.nearestNeighbors[0]?.record.experiment_name} (${(flexProbe.nearestNeighbors[0]?.similarity * 100).toFixed(1)}% sim)`,
  });

  // 4. Scoring Monotonicity with O2 across Presets
  const o2Steps = [14, 18, 21, 26, 34, 45];
  let allMonotonic = true;
  const traceStrings: string[] = [];

  for (const preset of HABITAT_PRESETS.slice(0, 4)) {
    const scores = o2Steps.map((o2) => {
      const res = runInference(
        { ...preset.input, o2Percent: o2, diluentFraction: Math.max(0, 1 - o2 / 100) },
        BASELINE_UNIFIED_DATASET,
        BASELINE_KNOWLEDGE_BASE
      );
      return res.fireSafetyIndex;
    });
    for (let i = 1; i < scores.length; i++) {
      if (scores[i] > scores[i - 1] + 1e-6) {
        allMonotonic = false;
      }
    }
    traceStrings.push(`${preset.label}: [${scores.join(' -> ')}]`);
  }

  results.push({
    id: 'mono-1',
    category: 'Monotonicity',
    name: 'Raising O2 Never Increases Fire Safety Index (14% -> 45%)',
    passed: allMonotonic,
    details: traceStrings.join(' | '),
  });

  // 5. Diluent Physics Prior (CO2 vs N2)
  const n2Run = runInference(
    { ...HABITAT_PRESETS[0].input, diluentType: 'N2' },
    BASELINE_UNIFIED_DATASET,
    BASELINE_KNOWLEDGE_BASE
  );
  const co2Run = runInference(
    { ...HABITAT_PRESETS[0].input, diluentType: 'CO2' },
    BASELINE_UNIFIED_DATASET,
    BASELINE_KNOWLEDGE_BASE
  );

  results.push({
    id: 'mono-2',
    category: 'Monotonicity',
    name: 'CO2 Diluent Increases LOI & Safety Margin vs N2',
    passed:
      co2Run.fireSafetyIndex >= n2Run.fireSafetyIndex &&
      co2Run.predictions.limitingOxygenIndexPercent >= n2Run.predictions.limitingOxygenIndexPercent,
    details: `N2 Safety=${n2Run.fireSafetyIndex} (LOI ${n2Run.predictions.limitingOxygenIndexPercent}%) vs CO2 Safety=${co2Run.fireSafetyIndex} (LOI ${co2Run.predictions.limitingOxygenIndexPercent}%)`,
  });

  // 6. Extrapolation & Insufficient Data Detection
  const extremeProbe = runInference(
    { ...HABITAT_PRESETS[0].input, totalPressureKPa: 550, ambientFlowCmS: 95 },
    BASELINE_UNIFIED_DATASET,
    BASELINE_KNOWLEDGE_BASE
  );
  const emptyProbe = runInference(HABITAT_PRESETS[0].input, [], BASELINE_KNOWLEDGE_BASE);

  results.push({
    id: 'uncert-1',
    category: 'Uncertainty',
    name: 'Extrapolation Warning & Insufficient Data Guardrails',
    passed:
      extremeProbe.extrapolation.isExtrapolating &&
      extremeProbe.extrapolation.outOfRangeDimensions.length >= 2 &&
      Boolean(emptyProbe.insufficientDataReason),
    details: `Out-of-range dims detected: ${extremeProbe.extrapolation.outOfRangeDimensions.map((d) => d.dimension).join(', ')}`,
  });

  return results;
}
