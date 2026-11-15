import React, { useCallback, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookmarkPlus,
  ExternalLink,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
import {
  DiluentType,
  FuelPhase,
  InferenceInput,
  InferenceResult,
  ScoringWeights,
  UnitSystem,
} from '../types/combustion';
import {
  DEFAULT_SCORING_WEIGHTS,
  FUEL_OPTIONS,
  GRAVITY_PRESETS,
  HABITAT_PRESETS,
} from '../engine/inference';
import {
  cmSToFtMin,
  gToMS2,
  kelvinToFahrenheit,
  kPaToUnit,
  mmToInches,
  pressureToKPa,
  velocityToCmS,
  lengthToMm,
} from '../engine/units';
import { SafetyGauge } from './SafetyGauge';
import { MarginRadar } from './MarginRadar';

interface NumericFieldProps {
  id?: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  onCommit: (val: number) => void;
  className?: string;
  ariaLabel?: string;
}

const NumericField: React.FC<NumericFieldProps> = ({
  id,
  value,
  min,
  max,
  step,
  disabled,
  onCommit,
  className,
  ariaLabel,
}) => {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState(String(value));

  const clampVal = (n: number) => {
    let v = n;
    if (min !== undefined) v = Math.max(min, v);
    if (max !== undefined) v = Math.min(max, v);
    return v;
  };

  return (
    <input
      id={id}
      type="number"
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      value={focused ? draft : value}
      aria-label={ariaLabel}
      onFocus={() => {
        setFocused(true);
        setDraft(String(value));
      }}
      onBlur={() => {
        setFocused(false);
        const parsed = Number(draft);
        if (draft.trim() !== '' && Number.isFinite(parsed)) {
          onCommit(clampVal(parsed));
        }
      }}
      onChange={(e) => {
        const raw = e.target.value;
        setDraft(raw);
        if (raw.trim() === '') return;
        const parsed = Number(raw);
        if (Number.isFinite(parsed)) {
          onCommit(clampVal(parsed));
        }
      }}
      className={className}
    />
  );
};

interface EnginePageProps {
  input: InferenceInput;
  onChangeInput: React.Dispatch<React.SetStateAction<InferenceInput>>;
  result: InferenceResult;
  unitSystem: UnitSystem;
  onChangeUnitSystem: (u: UnitSystem) => void;
  onSaveScenario: (narrative?: string, narrativeModel?: string) => void;
  savedBanner: string | null;
}

export const EnginePage: React.FC<EnginePageProps> = ({
  input,
  onChangeInput,
  result,
  unitSystem,
  onChangeUnitSystem,
  onSaveScenario,
  savedBanner,
}) => {
  const [showWeights, setShowWeights] = useState(false);
  const [narrative, setNarrative] = useState<string | null>(null);
  const [narrativeModel, setNarrativeModel] = useState<string | undefined>(undefined);
  const [narrativeLoading, setNarrativeLoading] = useState(false);
  const [narrativeError, setNarrativeError] = useState<string | null>(null);

  const weights = input.weights ?? DEFAULT_SCORING_WEIGHTS;

  const updateField = useCallback(
    <K extends keyof InferenceInput>(key: K, val: InferenceInput[K]) => {
      if (typeof val === 'number' && !Number.isFinite(val)) return;
      onChangeInput((prev) => {
        const next = { ...prev, [key]: val };
        if (key === 'o2Percent' || key === 'diluentType') {
          const o2 = key === 'o2Percent' ? Number(val) : prev.o2Percent;
          const dil = key === 'diluentType' ? (val as DiluentType) : prev.diluentType;
          next.diluentFraction =
            dil === 'None' ? 0 : Number(Math.max(0, 1 - o2 / 100).toFixed(3));
        }
        return next;
      });
    },
    [onChangeInput]
  );

  const updateWeight = useCallback(
    (k: keyof ScoringWeights, rawVal: number) => {
      if (!Number.isFinite(rawVal)) return;
      onChangeInput((prev) => ({
        ...prev,
        weights: { ...(prev.weights ?? DEFAULT_SCORING_WEIGHTS), [k]: Math.max(0, rawVal) },
      }));
    },
    [onChangeInput]
  );

  const handleGenerateNarrative = async () => {
    setNarrativeLoading(true);
    setNarrativeError(null);
    try {
      const payload = {
        missionName: input.missionName,
        inputsSI: result.normalizedInput,
        fireSafetyIndex: result.fireSafetyIndex,
        riskTier: result.riskTier,
        subScores: result.subScores,
        predictions: result.predictions,
        confidence: result.confidence,
        extrapolation: result.extrapolation,
        supportingExperiments: result.nearestNeighbors.slice(0, 5).map((n) => ({
          experiment_id: n.record.experiment_id,
          experiment_name: n.record.experiment_name,
          similarity_pct: Number((n.similarity * 100).toFixed(1)),
          fuel: n.record.fuel_or_material,
          O2_pct: n.record.O2_mole_fraction !== null ? Number((n.record.O2_mole_fraction * 100).toFixed(1)) : null,
          pressure_kPa: n.record.total_pressure_kPa,
          gravity_g: n.record.gravity_level_g,
          outcome: n.record.observed_outcome,
          regime: n.record.flame_regime,
          doi: n.record.doi_link,
        })),
        reportPassages: result.relevantPassages.slice(0, 3).map((p) => ({
          experiment_id: p.passage.experiment_id,
          source_file: p.passage.source_file,
          section: p.passage.page_or_section,
          excerpt: p.passage.text,
        })),
      };

      const res = await fetch('/api/narrative', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNarrativeError(data.error || 'Failed to generate narrative assessment.');
        return;
      }
      setNarrative(data.narrative);
      setNarrativeModel(data.model);
    } catch (err) {
      setNarrativeError(err instanceof Error ? err.message : 'Network error calling narrative API.');
    } finally {
      setNarrativeLoading(false);
    }
  };

  const radarData = useMemo(
    () => [
      { axis: 'Ignition', value: result.subScores.ignitionSafety, fullMark: 100 },
      { axis: 'Sustainability', value: result.subScores.sustainabilitySafety, fullMark: 100 },
      { axis: 'Spread Rate', value: result.subScores.spreadSafety, fullMark: 100 },
      { axis: 'Extinction', value: result.subScores.extinctionMargin, fullMark: 100 },
      { axis: 'Cool-Flame', value: result.subScores.coolFlameMargin, fullMark: 100 },
      { axis: 'Confidence', value: result.subScores.dataConfidence, fullMark: 100 },
    ],
    [result.subScores]
  );

  // Unit display helpers
  const pressureDisplay =
    unitSystem === 'metric'
      ? Number(input.totalPressureKPa.toFixed(1))
      : Number(kPaToUnit(input.totalPressureKPa, 'psi').toFixed(2));
  const pressureUnit = unitSystem === 'metric' ? 'kPa' : 'psi';
  const flowDisplay =
    unitSystem === 'metric'
      ? Number(input.ambientFlowCmS.toFixed(1))
      : Number(cmSToFtMin(input.ambientFlowCmS).toFixed(1));
  const flowUnit = unitSystem === 'metric' ? 'cm/s' : 'ft/min';
  const sizeDisplay =
    unitSystem === 'metric'
      ? Number(input.characteristicSizeMm.toFixed(2))
      : Number(mmToInches(input.characteristicSizeMm).toFixed(3));
  const sizeUnit = unitSystem === 'metric' ? 'mm' : 'in';

  const tempDisplay =
    unitSystem === 'metric'
      ? `${result.predictions.predictedPeakTemperatureK} K`
      : `${Math.round(kelvinToFahrenheit(result.predictions.predictedPeakTemperatureK))} °F`;

  return (
    <div className="space-y-4">
      {/* Workspace Telemetry & Preset Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-[#0D111A] border border-slate-800">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-mono text-slate-400 mr-2">Presets:</span>
          {HABITAT_PRESETS.map((preset) => {
            const active = input.missionName === preset.input.missionName;
            return (
              <button
                key={preset.id}
                onClick={() => onChangeInput({ ...preset.input, weights })}
                title={preset.subtitle}
                className={`px-2.5 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                    : 'bg-[#07090E] text-slate-300 border border-slate-800 hover:border-slate-600'
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center bg-[#07090E] border border-slate-800 rounded p-0.5">
            <button
              onClick={() => onChangeUnitSystem('metric')}
              className={`px-2.5 py-1 text-xs font-mono rounded transition-colors whitespace-nowrap shrink-0 ${
                unitSystem === 'metric' ? 'bg-slate-800 text-cyan-300' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Metric SI
            </button>
            <button
              onClick={() => onChangeUnitSystem('imperial')}
              className={`px-2.5 py-1 text-xs font-mono rounded transition-colors whitespace-nowrap shrink-0 ${
                unitSystem === 'imperial' ? 'bg-slate-800 text-cyan-300' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Imperial
            </button>
          </div>

          <button
            onClick={() => setShowWeights((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border rounded transition-colors whitespace-nowrap shrink-0 ${
              showWeights
                ? 'bg-slate-800 border-cyan-500/50 text-cyan-300'
                : 'bg-[#07090E] border-slate-800 text-slate-300 hover:border-slate-600'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Weights
          </button>

          <button
            onClick={() => onSaveScenario(narrative ?? undefined, narrativeModel)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-cyan-500 text-slate-950 hover:bg-cyan-400 rounded transition-colors whitespace-nowrap shrink-0"
          >
            <BookmarkPlus className="w-3.5 h-3.5" />
            Save Scenario
          </button>
        </div>
      </div>

      {savedBanner && (
        <div className="px-4 py-2 bg-emerald-950/40 border border-emerald-700/50 text-emerald-300 text-xs font-mono">
          ● {savedBanner}
        </div>
      )}

      {/* Asymmetric Split Console */}
      <div className="grid grid-cols-1 lg:grid-cols-[350px_minmax(0,1fr)] gap-4 items-start">
        {/* Left Parameter Column */}
        <aside className="bg-[#0D111A] border border-slate-800 p-4 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <h2 className="text-sm font-display font-semibold text-slate-100">
              Boundary Conditions
            </h2>
            <span className="text-xs font-mono text-slate-400">Live Inference</span>
          </div>

          <div className="space-y-3.5">
            {/* Mission Name */}
            <div>
              <label className="block text-xs text-slate-400 mb-1" htmlFor="mission-name">
                Mission / Habitat Label
              </label>
              <input
                id="mission-name"
                type="text"
                value={input.missionName}
                onChange={(e) => updateField('missionName', e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-[#07090E] border border-slate-800 text-slate-100 rounded focus:outline-none focus:border-cyan-500"
              />
            </div>

            {/* O2 Concentration */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <label className="text-slate-300" htmlFor="o2-input">
                  Oxygen Concentration
                </label>
                <span className="font-mono text-cyan-300 tabular-nums">
                  {input.o2Percent.toFixed(1)}% ({result.normalizedInput.o2MoleFraction.toFixed(3)} mol)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="o2-input"
                  type="range"
                  min={8}
                  max={100}
                  step={0.5}
                  value={input.o2Percent}
                  onChange={(e) => updateField('o2Percent', Number(e.target.value))}
                  className="flex-1"
                />
                <NumericField
                  min={5}
                  max={100}
                  step={0.5}
                  value={input.o2Percent}
                  onCommit={(v) => updateField('o2Percent', v)}
                  className="w-16 px-2 py-1 text-xs font-mono bg-[#07090E] border border-slate-800 text-slate-100 rounded text-right tabular-nums"
                  ariaLabel="O2 percent numeric"
                />
              </div>
            </div>

            {/* Total Pressure */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <label className="text-slate-300" htmlFor="pressure-input">
                  Total Pressure
                </label>
                <span className="font-mono text-slate-300 tabular-nums">
                  {pressureDisplay} {pressureUnit} · {(input.totalPressureKPa / 101.325).toFixed(2)} atm
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="pressure-input"
                  type="range"
                  min={20}
                  max={350}
                  step={0.5}
                  value={input.totalPressureKPa}
                  onChange={(e) => updateField('totalPressureKPa', Number(e.target.value))}
                  className="flex-1"
                />
                <NumericField
                  min={1}
                  step={0.5}
                  value={pressureDisplay}
                  onCommit={(val) => {
                    const kpa = unitSystem === 'metric' ? val : pressureToKPa(val, 'psi');
                    updateField('totalPressureKPa', Math.max(5, kpa));
                  }}
                  className="w-20 px-2 py-1 text-xs font-mono bg-[#07090E] border border-slate-800 text-slate-100 rounded text-right tabular-nums"
                  ariaLabel="Pressure numeric"
                />
              </div>
            </div>

            {/* Gravity Level */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <label className="text-slate-300" htmlFor="gravity-input">
                  Gravity Level
                </label>
                <span className="font-mono text-slate-300 tabular-nums">
                  {input.gravityG < 0.001 ? '1e-4 g' : `${input.gravityG.toFixed(3)} g`} ({gToMS2(input.gravityG).toFixed(2)} m/s²)
                </span>
              </div>
              <input
                id="gravity-input"
                type="range"
                min={0.0001}
                max={1.0}
                step={0.005}
                value={input.gravityG}
                onChange={(e) => updateField('gravityG', Number(e.target.value))}
                className="w-full"
              />
              <div className="grid grid-cols-4 gap-1 mt-1.5">
                {GRAVITY_PRESETS.map((gp) => (
                  <button
                    key={gp.label}
                    type="button"
                    onClick={() => updateField('gravityG', gp.value)}
                    className={`px-1.5 py-1 text-[11px] font-mono rounded border transition-colors whitespace-nowrap ${
                      Math.abs(input.gravityG - gp.value) < 0.005
                        ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                        : 'bg-[#07090E] border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {gp.label.split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>

            {/* Diluent Gas & Fraction */}
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs text-slate-300 mb-1" htmlFor="diluent-select">
                  Diluent Gas
                </label>
                <select
                  id="diluent-select"
                  value={input.diluentType}
                  onChange={(e) => updateField('diluentType', e.target.value as DiluentType)}
                  className="w-full px-2.5 py-1.5 text-xs font-mono bg-[#07090E] border border-slate-800 text-slate-100 rounded"
                >
                  <option value="N2">N₂ (Nitrogen)</option>
                  <option value="CO2">CO₂ (Carbon Dioxide)</option>
                  <option value="He">He (Helium)</option>
                  <option value="Ar">Ar (Argon)</option>
                  <option value="Mixed">Mixed Inert</option>
                  <option value="None">None (Pure O₂)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1" htmlFor="diluent-frac">
                  Diluent Fraction
                </label>
                <NumericField
                  id="diluent-frac"
                  min={0}
                  max={0.95}
                  step={0.01}
                  disabled={input.diluentType === 'None'}
                  value={input.diluentType === 'None' ? 0 : input.diluentFraction}
                  onCommit={(v) => updateField('diluentFraction', v)}
                  className="w-full px-2.5 py-1.5 text-xs font-mono bg-[#07090E] border border-slate-800 text-slate-100 rounded tabular-nums disabled:opacity-50"
                />
              </div>
            </div>

            {/* Ambient Flow Velocity */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <label className="text-slate-300" htmlFor="flow-input">
                  Ambient Flow Velocity
                </label>
                <span className="font-mono text-slate-300 tabular-nums">
                  {flowDisplay} {flowUnit}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="flow-input"
                  type="range"
                  min={0}
                  max={60}
                  step={0.5}
                  value={input.ambientFlowCmS}
                  onChange={(e) => updateField('ambientFlowCmS', Number(e.target.value))}
                  className="flex-1"
                />
                <NumericField
                  min={0}
                  max={400}
                  step={0.5}
                  value={flowDisplay}
                  onCommit={(val) => {
                    const cms = unitSystem === 'metric' ? val : velocityToCmS(val, 'ft/min');
                    updateField('ambientFlowCmS', Math.max(0, cms));
                  }}
                  className="w-20 px-2 py-1 text-xs font-mono bg-[#07090E] border border-slate-800 text-slate-100 rounded text-right tabular-nums"
                  ariaLabel="Flow velocity numeric"
                />
              </div>
            </div>

            {/* Fuel / Material & Phase */}
            <div className="grid grid-cols-1 gap-2.5">
              <div>
                <label className="block text-xs text-slate-300 mb-1" htmlFor="fuel-select">
                  Fuel / Material
                </label>
                <select
                  id="fuel-select"
                  value={input.fuelMaterial}
                  onChange={(e) => {
                    const selected = FUEL_OPTIONS.find((f) => f.label === e.target.value);
                    onChangeInput({
                      ...input,
                      fuelMaterial: e.target.value,
                      fuelPhase: selected?.phase ?? input.fuelPhase,
                    });
                  }}
                  className="w-full px-2.5 py-1.5 text-xs bg-[#07090E] border border-slate-800 text-slate-100 rounded"
                >
                  {FUEL_OPTIONS.map((f) => (
                    <option key={f.label} value={f.label}>
                      {f.label} ({f.phase})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1">Fuel Phase</label>
                <div className="grid grid-cols-3 gap-1">
                  {(['solid', 'liquid droplet', 'gas'] as FuelPhase[]).map((ph) => (
                    <button
                      key={ph}
                      type="button"
                      onClick={() => updateField('fuelPhase', ph)}
                      className={`px-2 py-1 text-[11px] rounded border transition-colors whitespace-nowrap ${
                        input.fuelPhase === ph
                          ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                          : 'bg-[#07090E] border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {ph === 'liquid droplet' ? 'Droplet' : ph === 'solid' ? 'Solid' : 'Gas'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Characteristic Size & Ignition Energy */}
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs text-slate-300 mb-1" htmlFor="size-input">
                  Size / Diam. ({sizeUnit})
                </label>
                <NumericField
                  id="size-input"
                  min={0.01}
                  step={0.1}
                  value={sizeDisplay}
                  onCommit={(val) => {
                    const mm = unitSystem === 'metric' ? val : lengthToMm(val, 'in');
                    updateField('characteristicSizeMm', Math.max(0.1, mm));
                  }}
                  className="w-full px-2.5 py-1.5 text-xs font-mono bg-[#07090E] border border-slate-800 text-slate-100 rounded tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1" htmlFor="ign-energy">
                  Ignition Energy (mJ)
                </label>
                <NumericField
                  id="ign-energy"
                  min={1}
                  max={10000}
                  step={10}
                  value={input.ignitionEnergyMj}
                  onCommit={(v) => updateField('ignitionEnergyMj', Math.max(1, v))}
                  className="w-full px-2.5 py-1.5 text-xs font-mono bg-[#07090E] border border-slate-800 text-slate-100 rounded tabular-nums"
                />
              </div>
            </div>

            {/* Optional Advanced Weights */}
            {showWeights && (
              <div className="border-t border-slate-800 pt-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-cyan-400">Sub-Score Weights</span>
                  <button
                    type="button"
                    onClick={() => updateField('weights', { ...DEFAULT_SCORING_WEIGHTS })}
                    className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200"
                  >
                    <RotateCcw className="w-3 h-3" /> Reset
                  </button>
                </div>
                {(
                  [
                    ['ignition', 'Ignition Margin'],
                    ['sustainability', 'Sustainability'],
                    ['spread', 'Spread / Burn Rate'],
                    ['extinction', 'Extinction Margin'],
                    ['coolFlame', 'Cool-Flame Risk'],
                    ['confidence', 'Data Confidence'],
                  ] as Array<[keyof ScoringWeights, string]>
                ).map(([k, label]) => (
                  <div key={k} className="space-y-0.5">
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>{label}</span>
                      <span className="font-mono tabular-nums">
                        {(result.weightsUsed[k] * 100).toFixed(0)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={weights[k]}
                      onChange={(e) => updateWeight(k, Number(e.target.value))}
                      className="w-full"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>

        {/* Main Inference Viewport */}
        <div className="space-y-4 min-w-0">
          {result.insufficientDataReason && (
            <div className="p-4 bg-rose-950/40 border border-rose-700/60 text-rose-200 text-sm">
              <strong>Insufficient Empirical Data:</strong> {result.insufficientDataReason}
            </div>
          )}

          {result.extrapolation.isExtrapolating && (
            <div className="p-3.5 bg-amber-950/30 border border-amber-600/50 text-amber-200 text-xs space-y-1.5">
              <div className="flex items-center gap-2 font-semibold text-amber-300">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Extrapolation Warning: Query lies outside the measured NASA PSI convex range</span>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-amber-200/90 pl-6">
                {result.extrapolation.outOfRangeDimensions.map((d) => (
                  <span key={d.dimension}>
                    {d.dimension}: query {d.queryValue} (data range {d.datasetMin}–{d.datasetMax})
                  </span>
                ))}
              </div>
              <p className="text-[11px] text-amber-300/80 pl-6">
                Uncertainty intervals have been widened and confidence reduced to {result.confidence.toFixed(1)}%.
              </p>
            </div>
          )}

          {/* Top Visual Row: Safety Gauge + Radar */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="bg-[#0D111A] border border-slate-800 p-5 flex flex-col justify-between">
              <div className="flex items-baseline justify-between">
                <h2 className="text-sm font-display font-semibold text-slate-100">
                  Fire Safety Index
                </h2>
                <span className="text-xs font-mono text-slate-400 tabular-nums">
                  N_eff = {result.effectiveSampleSize}
                </span>
              </div>

              <SafetyGauge
                score={result.fireSafetyIndex}
                riskTier={result.riskTier}
                confidence={result.confidence}
                isExtrapolating={result.extrapolation.isExtrapolating}
              />

              <div className="border-t border-slate-800 pt-3 mt-2 text-xs text-slate-400 flex flex-wrap items-center justify-between gap-2">
                <span>Weighted blend of 6 physics-informed margins</span>
                <span className="font-mono text-slate-300 tabular-nums">
                  LOI {result.predictions.limitingOxygenIndexPercent}% vs {input.o2Percent.toFixed(1)}% O₂
                </span>
              </div>
            </div>

            <div className="bg-[#0D111A] border border-slate-800 p-5">
              <div className="flex items-baseline justify-between mb-2">
                <h2 className="text-sm font-display font-semibold text-slate-100">
                  Sub-Score Margin Profile
                </h2>
                <span className="text-xs font-mono text-slate-400">100 = Maximum Margin</span>
              </div>
              <MarginRadar data={radarData} />
            </div>
          </div>

          {/* Computed Physical Predictions Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            <div className="bg-[#0D111A] border border-slate-800 p-4">
              <div className="text-xs font-mono uppercase tracking-wider text-slate-400">
                Ignition / Sustained Prob.
              </div>
              <div className="mt-1.5 flex items-baseline gap-2">
                <span className="text-2xl font-mono font-semibold text-slate-100 tabular-nums">
                  {(result.predictions.ignitionProbability * 100).toFixed(1)}
                </span>
                <span className="text-xs font-mono text-slate-400">%</span>
              </div>
              <div className="mt-1 text-xs font-mono text-slate-400 tabular-nums">
                95% band: {(result.predictions.ignitionInterval[0] * 100).toFixed(1)}% – {(result.predictions.ignitionInterval[1] * 100).toFixed(1)}%
              </div>
            </div>

            <div className="bg-[#0D111A] border border-slate-800 p-4">
              <div className="text-xs font-mono uppercase tracking-wider text-slate-400">
                Extinction Likelihood
              </div>
              <div className="mt-1.5 flex items-baseline gap-2">
                <span className="text-2xl font-mono font-semibold text-slate-100 tabular-nums">
                  {(result.predictions.extinctionLikelihood * 100).toFixed(1)}
                </span>
                <span className="text-xs font-mono text-slate-400">%</span>
              </div>
              <div className="mt-1 text-xs font-mono text-slate-400 tabular-nums">
                {result.predictions.predictedHotExtinctionDiameterMm !== null
                  ? `D_ext hot ${
                      unitSystem === 'metric'
                        ? `${result.predictions.predictedHotExtinctionDiameterMm} mm`
                        : `${mmToInches(result.predictions.predictedHotExtinctionDiameterMm).toFixed(3)} in`
                    } · cool ${
                      unitSystem === 'metric'
                        ? `${result.predictions.predictedCoolExtinctionDiameterMm} mm`
                        : `${mmToInches(result.predictions.predictedCoolExtinctionDiameterMm ?? 0).toFixed(3)} in`
                    }`
                  : `Band: ${(result.predictions.extinctionInterval[0] * 100).toFixed(1)}% – ${(result.predictions.extinctionInterval[1] * 100).toFixed(1)}%`}
              </div>
            </div>

            <div className="bg-[#0D111A] border border-slate-800 p-4">
              <div className="text-xs font-mono uppercase tracking-wider text-slate-400">
                Likely Flame Regime
              </div>
              <div className="mt-1.5 flex items-baseline justify-between gap-2">
                <span className="text-2xl font-mono font-semibold text-cyan-300 capitalize">
                  {result.predictions.likelyFlameRegime}
                </span>
                <span className="text-xs font-mono text-slate-400 tabular-nums">
                  T_peak {tempDisplay}
                </span>
              </div>
              <div className="mt-1 text-xs font-mono text-slate-400 tabular-nums">
                Cool-flame risk: {(result.predictions.coolFlameRiskScore * 100).toFixed(0)}% (1200 K threshold)
              </div>
            </div>

            <div className="bg-[#0D111A] border border-slate-800 p-4">
              <div className="text-xs font-mono uppercase tracking-wider text-slate-400">
                Burn / Spread vs 1g Earth
              </div>
              <div className="mt-1.5 flex items-baseline gap-2">
                <span className="text-2xl font-mono font-semibold text-slate-100 tabular-nums">
                  {result.predictions.spreadOrBurnRateRelativeToEarth.toFixed(2)}×
                </span>
                <span className="text-xs font-mono text-slate-400">Earth baseline</span>
              </div>
              <div className="mt-1 text-xs font-mono text-slate-400 tabular-nums">
                Est. rate: {result.predictions.predictedSpreadOrBurnRate.toFixed(2)}{' '}
                {input.fuelPhase === 'liquid droplet' ? 'mm²/s' : 'mm/s'}
              </div>
            </div>

            <div className="bg-[#0D111A] border border-slate-800 p-4">
              <div className="text-xs font-mono uppercase tracking-wider text-slate-400">
                Limiting Oxygen Index (LOI)
              </div>
              <div className="mt-1.5 flex items-baseline gap-2">
                <span className="text-2xl font-mono font-semibold text-slate-100 tabular-nums">
                  {result.predictions.limitingOxygenIndexPercent.toFixed(1)}
                </span>
                <span className="text-xs font-mono text-slate-400">% O₂</span>
              </div>
              <div className="mt-1 text-xs font-mono text-slate-400 tabular-nums">
                Band: {result.predictions.loiInterval[0]}% – {result.predictions.loiInterval[1]}%
              </div>
            </div>

            <div className="bg-[#0D111A] border border-slate-800 p-4">
              <div className="text-xs font-mono uppercase tracking-wider text-slate-400">
                Regime Probability Split
              </div>
              <div className="mt-2 grid grid-cols-3 gap-x-2 gap-y-1 text-[11px] font-mono tabular-nums">
                {(['hot', 'cool', 'oscillatory', 'multi-stage', 'warm', 'none'] as const).map((r) => (
                  <div key={r} className="flex justify-between text-slate-300">
                    <span className="text-slate-400">{r.slice(0, 5)}</span>
                    <span>{(result.predictions.regimeProbabilities[r] * 100).toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Nearest-Neighbor Supporting Experiments Table */}
          <div className="bg-[#0D111A] border border-slate-800 p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
              <h3 className="text-sm font-display font-semibold text-slate-100">
                Supporting NASA PSI Experiments (Top {result.nearestNeighbors.length} Nearest Matches)
              </h3>
              <span className="text-xs font-mono text-slate-400">
                Weighted distance over O₂, ln(P), g^0.25, √v, diluent, fuel
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-mono">
                    <th className="py-2 pr-3">Experiment</th>
                    <th className="py-2 pr-3">Sim.</th>
                    <th className="py-2 pr-3">Fuel / Phase</th>
                    <th className="py-2 pr-3">O₂</th>
                    <th className="py-2 pr-3">Press.</th>
                    <th className="py-2 pr-3">Grav.</th>
                    <th className="py-2 pr-3">Flow</th>
                    <th className="py-2 pr-3">Outcome / Regime</th>
                    <th className="py-2">Index Link</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70 font-mono tabular-nums">
                  {result.nearestNeighbors.map(({ record, similarity }) => (
                    <tr key={record.id} className="hover:bg-slate-900/50">
                      <td className="py-2 pr-3 font-sans">
                        <div className="font-medium text-slate-100">{record.experiment_name}</div>
                        <div className="text-[11px] font-mono text-slate-400">
                          {record.experiment_id} · {record.platform}
                        </div>
                      </td>
                      <td className="py-2 pr-3 text-cyan-300 font-semibold">
                        {(similarity * 100).toFixed(1)}%
                      </td>
                      <td className="py-2 pr-3 font-sans text-slate-200">
                        {record.fuel_or_material}
                        <span className="text-slate-500"> · {record.fuel_phase}</span>
                      </td>
                      <td className="py-2 pr-3 text-slate-200">
                        {record.O2_mole_fraction !== null ? `${(record.O2_mole_fraction * 100).toFixed(1)}%` : '—'}
                      </td>
                      <td className="py-2 pr-3 text-slate-200">
                        {record.total_pressure_kPa !== null
                          ? unitSystem === 'metric'
                            ? `${record.total_pressure_kPa.toFixed(1)} kPa`
                            : `${kPaToUnit(record.total_pressure_kPa, 'psi').toFixed(1)} psi`
                          : '—'}
                      </td>
                      <td className="py-2 pr-3 text-slate-200">
                        {record.gravity_level_g !== null
                          ? record.gravity_level_g < 0.001
                            ? '1e-4 g'
                            : `${record.gravity_level_g.toFixed(3)} g`
                          : '—'}
                      </td>
                      <td className="py-2 pr-3 text-slate-200">
                        {record.ambient_flow_velocity_cm_s !== null
                          ? unitSystem === 'metric'
                            ? `${record.ambient_flow_velocity_cm_s.toFixed(1)} cm/s`
                            : `${cmSToFtMin(record.ambient_flow_velocity_cm_s).toFixed(1)} fpm`
                          : '—'}
                      </td>
                      <td className="py-2 pr-3 text-slate-200 font-sans">
                        <span>{record.observed_outcome ?? '—'}</span>
                        <span className="text-slate-500"> / {record.flame_regime ?? '—'}</span>
                      </td>
                      <td className="py-2">
                        {record.doi_link ? (
                          <a
                            href={record.doi_link}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-cyan-400 hover:underline"
                          >
                            DOI <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Knowledge Base Citations + Gemini AI Assessment */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="bg-[#0D111A] border border-slate-800 p-4 space-y-3">
              <div className="flex items-baseline justify-between">
                <h3 className="text-sm font-display font-semibold text-slate-100">
                  Report & Dissertation Citations
                </h3>
                <span className="text-xs font-mono text-slate-400">
                  {result.relevantPassages.length} passages matched
                </span>
              </div>
              {result.relevantPassages.length === 0 ? (
                <p className="text-xs text-slate-400">
                  No direct passage matches in the knowledge base for this parameter combination.
                </p>
              ) : (
                <div className="space-y-3">
                  {result.relevantPassages.map(({ passage }) => (
                    <div key={passage.id} className="border-t border-slate-800 pt-2.5 first:border-t-0 first:pt-0">
                      <div className="flex items-baseline justify-between gap-2 text-xs">
                        <span className="font-medium text-slate-100">{passage.title}</span>
                        <span className="font-mono text-cyan-400 shrink-0">{passage.experiment_id}</span>
                      </div>
                      <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                        {passage.source_file} · {passage.page_or_section}
                      </div>
                      <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">{passage.text}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-[#0D111A] border border-slate-800 p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-display font-semibold text-slate-100">
                    Scientific Assessment Narrative
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Synthesized strictly from computed metrics & retrieved PSI evidence
                  </p>
                </div>
                <button
                  onClick={handleGenerateNarrative}
                  disabled={narrativeLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 rounded transition-colors disabled:opacity-50 whitespace-nowrap shrink-0"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {narrativeLoading ? 'Synthesizing...' : narrative ? 'Regenerate' : 'Generate Assessment'}
                </button>
              </div>

              {narrativeError && (
                <div className="p-3 bg-rose-950/30 border border-rose-800/50 text-xs text-rose-300">
                  {narrativeError}
                </div>
              )}

              {narrative ? (
                <div className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap bg-[#07090E] border border-slate-800 p-3.5">
                  {narrative}
                </div>
              ) : (
                <div className="text-xs text-slate-400 bg-[#07090E] border border-slate-800 p-4 leading-relaxed">
                  Click <strong>Generate Assessment</strong> to produce an operational plain-language engineering brief
                  grounded exclusively in the computed Fire Safety Index ({result.fireSafetyIndex}/100), LOI estimate (
                  {result.predictions.limitingOxygenIndexPercent}%), and the {result.nearestNeighbors.length} nearest
                  NASA PSI records.
                </div>
              )}
            </div>
          </div>

          {/* Required SI Engine Page Footer Watermark / Acknowledgements & Disclaimer */}
          <footer className="border-t border-slate-800/80 pt-3 pb-2 text-[11px] text-slate-500 flex flex-wrap items-center justify-between gap-2">
            <span>
              Claude (by Anthropic) was used to extract, organize and help synthesize the datasets and to design the engine specification. · Google AI Studio was used to build the SI Engine application.
            </span>
            <span className="font-mono text-slate-400">
              Research decision-support tool; not certified for operational safety decisions.
            </span>
          </footer>
        </div>
      </div>
    </div>
  );
};
