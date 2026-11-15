import React, { useState } from 'react';
import {
  Activity,
  ArrowRight,
  BookmarkPlus,
  Cpu,
  FileUp,
  Send,
} from 'lucide-react';
import {
  InferenceInput,
  InferenceResult,
  KnowledgePassage,
  UnifiedRecord,
  UnitSystem,
} from '../types/combustion';
import { SafetyGauge } from './SafetyGauge';
import { kPaToUnit } from '../engine/units';

interface SensorAgentPageProps {
  customRecords: UnifiedRecord[];
  customPassages: KnowledgePassage[];
  unitSystem: UnitSystem;
  onLoadIntoEngine: (input: InferenceInput) => void;
  onSaveAgentScenario: (
    input: InferenceInput,
    result: InferenceResult,
    narrative: string,
    model?: string
  ) => void;
}

interface AgentResponse {
  analysisText: string;
  toolTrace: Array<{
    toolName: string;
    args: Record<string, unknown>;
    summary: string;
  }>;
  inferences: Array<{
    input: InferenceInput;
    result: InferenceResult;
  }>;
  model: string;
  analyzedAt: string;
}

const TELEMETRY_PRESETS: Array<{ id: string; label: string; subtitle: string; payload: string }> = [
  {
    id: 'iss-kapton',
    label: 'ISS Destiny Rack Fault',
    subtitle: '14.7 psi · 21.4% O2 · Kapton smoke spike',
    payload: JSON.stringify(
      {
        mission: 'ISS Destiny Lab — Payload Rack ER-3',
        timestamp_utc: '2026-11-15T08:42:11Z',
        sensors: {
          eclss_o2_pct: 21.4,
          cabin_pressure_psi: 14.69,
          sams_accelerometer_g: 0.00012,
          rack_hvac_anemometer_cm_s: 11.5,
          gas_balance: 'N2',
          thermocouple_wire_harness_K: 875,
          photoelectric_smoke_obscuration_pct_per_ft: 2.8,
          ionization_detector_ratio: 0.65,
        },
        system_note:
          'Overheated Kapton wire bundle insulation (~2.2 mm diameter) inside rack cooling bay; electrical arc energy estimated ~280 mJ.',
      },
      null,
      2
    ),
  },
  {
    id: 'lunar-airlock',
    label: 'Artemis Lunar Habitat',
    subtitle: '8.2 psi · 34% O2 · 1.62 m/s²',
    payload: JSON.stringify(
      {
        mission: 'Artemis Surface Habitat — Airlock Prep',
        timestamp_utc: '2026-11-15T08:45:00Z',
        sensors: {
          mass_spec_o2_mole_fraction: 0.34,
          pressure_transducer_kPa: 56.5,
          imu_gravity_m_s2: 1.62,
          duct_flow_ft_min: 29.5,
          diluent_species: 'N2',
          exposed_material: 'PMMA viewport trim & cotton stowage',
          sample_characteristic_size_mm: 20,
          relay_arc_fault_mJ: 320,
        },
      },
      null,
      2
    ),
  },
  {
    id: 'dodecane-leak',
    label: 'Coolant / Fuel Droplet Leak',
    subtitle: '2.0 atm · 21% O2 · n-dodecane mist',
    payload: `TELEMETRY_LOG: Microgravity Fluid Bay B
P_CHAMBER = 2.0 atm
O2_CONC = 21.0 % vol (balance N2)
G_LEVEL = 0.0001 g
VENT_FLOW = 2.5 cm/s (quiescent isolation mode)
OPTICAL_SENSOR = 0 visible flame emission; IR radiometer detects 860 K low-temp zone
FUEL_LEAK = n-dodecane droplet spray (~3.2 mm diameter) near 250 mJ hot surface`,
  },
  {
    id: 'co2-suppress',
    label: 'CO₂ Suppression Check',
    subtitle: '101.3 kPa · 21% O2 · CO2 diluent',
    payload: JSON.stringify(
      {
        mission: 'Orbital Module — Post-Suppression Atmosphere Verification',
        sensors: {
          o2_pct: 21.0,
          pressure_kPa: 101.3,
          gravity_g: 0.0001,
          flow_cm_s: 4.0,
          diluent_gas: 'CO2',
          diluent_mole_fraction: 0.79,
          residual_fuel: 'methane gas pocket (6.4 mm nozzle leak)',
          ignition_energy_mJ: 200,
        },
      },
      null,
      2
    ),
  },
];

export const SensorAgentPage: React.FC<SensorAgentPageProps> = ({
  customRecords,
  customPassages,
  unitSystem,
  onLoadIntoEngine,
  onSaveAgentScenario,
}) => {
  const [sensorText, setSensorText] = useState<string>(TELEMETRY_PRESETS[0].payload);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<AgentResponse | null>(null);
  const [savedFlag, setSavedFlag] = useState(false);

  // Quick physical sensor builder state
  const [chO2, setChO2] = useState(21.0);
  const [chPressKpa, setChPressKpa] = useState(101.3);
  const [chGravG, setChGravG] = useState(0.0001);
  const [chFlowCmS, setChFlowCmS] = useState(12.0);
  const [chDiluent, setChDiluent] = useState('N2');
  const [chFuel, setChFuel] = useState('PMMA');
  const [chTempK, setChTempK] = useState(310);

  const handleComposeFromSensors = () => {
    const packet = {
      mission: 'Live ECLSS & Environmental Sensor Bus',
      timestamp_utc: new Date().toISOString(),
      sensors: {
        eclss_o2_percent: chO2,
        cabin_pressure_kPa: chPressKpa,
        accelerometer_gravity_g: chGravG,
        ventilation_anemometer_cm_s: chFlowCmS,
        dominant_diluent_gas: chDiluent,
        thermocouple_peak_K: chTempK,
        monitored_material_or_fuel: chFuel,
      },
    };
    setSensorText(JSON.stringify(packet, null, 2));
  };

  const handleFileUpload = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    setSensorText(text.slice(0, 12000));
  };

  const handleAnalyze = async () => {
    setLoading(true);
    setError(null);
    setSavedFlag(false);
    try {
      const res = await fetch('/api/agent/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sensorInputText: sensorText,
          customRecords,
          customPassages,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Agent analysis request failed.');
        return;
      }
      setResponse(data as AgentResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error calling Sensor AI Agent.');
    } finally {
      setLoading(false);
    }
  };

  const primary = response?.inferences?.[0];

  return (
    <div className="space-y-4">
      {/* Header Strip */}
      <div className="bg-[#0D111A] border border-slate-800 p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-base font-display font-semibold text-slate-100">
            Space Mission Sensor AI Agent
          </h1>
          <p className="text-xs text-slate-400">
            Ingests physical ECLSS, accelerometer, anemometer, and thermal/smoke telemetry, converts units, executes the NASA PSI SI Engine, and issues a grounded fire safety rating.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-mono text-slate-400 mr-1">Telemetry Streams:</span>
          {TELEMETRY_PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => setSensorText(p.payload)}
              title={p.subtitle}
              className="px-2.5 py-1.5 text-xs bg-[#07090E] border border-slate-800 hover:border-cyan-500 text-slate-200 rounded transition-colors whitespace-nowrap shrink-0"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Split Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-[420px_minmax(0,1fr)] gap-4 items-start">
        {/* Left: Telemetry Input & Sensor Bus Builder */}
        <div className="space-y-4">
          <div className="bg-[#0D111A] border border-slate-800 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-wider text-cyan-400">
                Raw Sensor Packet / Log Stream
              </span>
              <label className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono bg-[#07090E] border border-slate-700 hover:border-cyan-500 text-slate-200 rounded cursor-pointer">
                <FileUp className="w-3 h-3" />
                Load Log (.json/.csv/.txt)
                <input
                  type="file"
                  accept=".json,.csv,.txt,.log"
                  onChange={(e) => handleFileUpload(e.target.files?.[0])}
                  className="hidden"
                />
              </label>
            </div>

            <textarea
              rows={13}
              value={sensorText}
              onChange={(e) => setSensorText(e.target.value)}
              placeholder="Paste spacecraft sensor telemetry (JSON, CSV, key-value telemetry, or anomaly description)..."
              className="w-full p-3 text-xs font-mono bg-[#07090E] border border-slate-800 text-slate-100 rounded focus:outline-none focus:border-cyan-500 leading-relaxed"
            />

            <button
              onClick={handleAnalyze}
              disabled={loading || !sensorText.trim()}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold bg-cyan-500 text-slate-950 hover:bg-cyan-400 rounded transition-colors disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              {loading ? 'Agent Normalizing Sensors & Querying SI Engine...' : 'Analyze Sensor Stream & Compute Safety Rating'}
            </button>
          </div>

          {/* Direct Sensor Channel Composer */}
          <div className="bg-[#0D111A] border border-slate-800 p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-display font-semibold text-slate-100">
                Compose Live Sensor Packet
              </span>
              <button
                type="button"
                onClick={handleComposeFromSensors}
                className="text-xs font-mono text-cyan-400 hover:underline"
              >
                Push to Telemetry Stream
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">ECLSS O₂ (%)</label>
                <input
                  type="number"
                  step={0.1}
                  value={chO2}
                  onChange={(e) => setChO2(Number(e.target.value))}
                  className="w-full px-2 py-1 font-mono bg-[#07090E] border border-slate-800 rounded text-slate-100 tabular-nums"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Pressure (kPa)</label>
                <input
                  type="number"
                  step={0.5}
                  value={chPressKpa}
                  onChange={(e) => setChPressKpa(Number(e.target.value))}
                  className="w-full px-2 py-1 font-mono bg-[#07090E] border border-slate-800 rounded text-slate-100 tabular-nums"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Accel. (g)</label>
                <input
                  type="number"
                  step={0.001}
                  value={chGravG}
                  onChange={(e) => setChGravG(Number(e.target.value))}
                  className="w-full px-2 py-1 font-mono bg-[#07090E] border border-slate-800 rounded text-slate-100 tabular-nums"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Duct Flow (cm/s)</label>
                <input
                  type="number"
                  step={0.5}
                  value={chFlowCmS}
                  onChange={(e) => setChFlowCmS(Number(e.target.value))}
                  className="w-full px-2 py-1 font-mono bg-[#07090E] border border-slate-800 rounded text-slate-100 tabular-nums"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Diluent Gas</label>
                <select
                  value={chDiluent}
                  onChange={(e) => setChDiluent(e.target.value)}
                  className="w-full px-2 py-1 font-mono bg-[#07090E] border border-slate-800 rounded text-slate-100"
                >
                  <option value="N2">N₂</option>
                  <option value="CO2">CO₂</option>
                  <option value="He">He</option>
                  <option value="None">None (Pure O₂)</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Thermocouple (K)</label>
                <input
                  type="number"
                  step={10}
                  value={chTempK}
                  onChange={(e) => setChTempK(Number(e.target.value))}
                  className="w-full px-2 py-1 font-mono bg-[#07090E] border border-slate-800 rounded text-slate-100 tabular-nums"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-[11px] text-slate-400 mb-1">Monitored Material / Fuel Hazard</label>
                <input
                  type="text"
                  value={chFuel}
                  onChange={(e) => setChFuel(e.target.value)}
                  className="w-full px-2 py-1 bg-[#07090E] border border-slate-800 rounded text-slate-100"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right: Agent Analysis, Tool Trace, and Safety Rating */}
        <div className="space-y-4 min-w-0">
          {error && (
            <div className="p-4 bg-rose-950/40 border border-rose-700/60 text-xs text-rose-200">
              {error}
            </div>
          )}

          {!response && !loading && !error && (
            <div className="bg-[#0D111A] border border-slate-800 p-8 text-center space-y-2">
              <Cpu className="w-7 h-7 text-cyan-400 mx-auto" />
              <h2 className="text-sm font-display font-semibold text-slate-100">
                Ready for Mission Sensor Telemetry
              </h2>
              <p className="text-xs text-slate-400 max-w-lg mx-auto leading-relaxed">
                Select a telemetry stream preset or paste raw spacecraft sensor readings on the left. The AI agent will
                extract and unit-convert sensor values, invoke the SI Engine against the NASA PSI datasets, and deliver a
                verified Fire Safety Rating with actionable flight-controller guidance.
              </p>
            </div>
          )}

          {loading && (
            <div className="bg-[#0D111A] border border-slate-800 p-8 text-center space-y-2">
              <Activity className="w-6 h-6 text-cyan-400 mx-auto" />
              <p className="text-xs font-mono text-slate-300">
                Parsing physical sensor units · Executing SI Engine function calls · Retrieving NASA PSI evidence...
              </p>
            </div>
          )}

          {response && (
            <>
              {primary && (
                <div className="bg-[#0D111A] border border-slate-800 p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
                    <div>
                      <h2 className="text-sm font-display font-semibold text-slate-100">
                        Evaluated Safety Rating: {primary.input.missionName}
                      </h2>
                      <p className="text-xs font-mono text-slate-400 mt-0.5 tabular-nums">
                        {primary.input.o2Percent}% O₂ ·{' '}
                        {unitSystem === 'metric'
                          ? `${primary.input.totalPressureKPa.toFixed(1)} kPa`
                          : `${kPaToUnit(primary.input.totalPressureKPa, 'psi').toFixed(1)} psi`}{' '}
                        · {primary.input.gravityG} g · {primary.input.ambientFlowCmS} cm/s · {primary.input.fuelMaterial}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => onLoadIntoEngine(primary.input)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#07090E] border border-slate-700 hover:border-cyan-500 text-cyan-300 rounded transition-colors whitespace-nowrap"
                      >
                        Open in SI Engine <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          onSaveAgentScenario(
                            primary.input,
                            primary.result,
                            response.analysisText,
                            response.model
                          );
                          setSavedFlag(true);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-cyan-500 text-slate-950 hover:bg-cyan-400 rounded transition-colors whitespace-nowrap"
                      >
                        <BookmarkPlus className="w-3.5 h-3.5" />
                        {savedFlag ? 'Saved' : 'Save Scenario'}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-[240px_minmax(0,1fr)] gap-4 items-center">
                    <SafetyGauge
                      score={primary.result.fireSafetyIndex}
                      riskTier={primary.result.riskTier}
                      confidence={primary.result.confidence}
                      isExtrapolating={primary.result.extrapolation.isExtrapolating}
                    />

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs font-mono tabular-nums">
                      <div className="border border-slate-800 bg-[#07090E] p-3">
                        <div className="text-slate-400 text-[11px]">Ignition Prob.</div>
                        <div className="text-slate-100 text-base font-semibold mt-0.5">
                          {(primary.result.predictions.ignitionProbability * 100).toFixed(1)}%
                        </div>
                      </div>
                      <div className="border border-slate-800 bg-[#07090E] p-3">
                        <div className="text-slate-400 text-[11px]">Estimated LOI</div>
                        <div className="text-slate-100 text-base font-semibold mt-0.5">
                          {primary.result.predictions.limitingOxygenIndexPercent}% O₂
                        </div>
                      </div>
                      <div className="border border-slate-800 bg-[#07090E] p-3">
                        <div className="text-slate-400 text-[11px]">Flame Regime</div>
                        <div className="text-cyan-300 text-base font-semibold mt-0.5 capitalize">
                          {primary.result.predictions.likelyFlameRegime}
                        </div>
                      </div>
                      <div className="border border-slate-800 bg-[#07090E] p-3">
                        <div className="text-slate-400 text-[11px]">Extinction Prob.</div>
                        <div className="text-slate-100 text-base font-semibold mt-0.5">
                          {(primary.result.predictions.extinctionLikelihood * 100).toFixed(1)}%
                        </div>
                      </div>
                      <div className="border border-slate-800 bg-[#07090E] p-3">
                        <div className="text-slate-400 text-[11px]">Rate vs Earth 1g</div>
                        <div className="text-slate-100 text-base font-semibold mt-0.5">
                          {primary.result.predictions.spreadOrBurnRateRelativeToEarth}×
                        </div>
                      </div>
                      <div className="border border-slate-800 bg-[#07090E] p-3">
                        <div className="text-slate-400 text-[11px]">Cool-Flame Risk</div>
                        <div className="text-amber-300 text-base font-semibold mt-0.5">
                          {(primary.result.predictions.coolFlameRiskScore * 100).toFixed(0)}%
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Agent Briefing */}
              <div className="bg-[#0D111A] border border-slate-800 p-5 space-y-2.5">
                <div className="flex items-baseline justify-between border-b border-slate-800 pb-2">
                  <h3 className="text-sm font-display font-semibold text-slate-100">
                    Mission Safety Agent Report
                  </h3>
                  <span className="text-[11px] font-mono text-slate-400">
                    {response.model} · {new Date(response.analyzedAt).toLocaleTimeString()}
                  </span>
                </div>
                <div className="text-xs sm:text-[13px] text-slate-200 leading-relaxed whitespace-pre-wrap">
                  {response.analysisText}
                </div>
              </div>

              {/* Transparent Tool Execution Trace */}
              <div className="bg-[#0D111A] border border-slate-800 p-4 space-y-2.5">
                <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400">
                  Agent Tool Execution &amp; Sensor Normalization Trace ({response.toolTrace.length})
                </h3>
                <div className="space-y-2">
                  {response.toolTrace.map((step, i) => (
                    <div key={i} className="border border-slate-800 bg-[#07090E] p-3 text-xs space-y-1">
                      <div className="flex items-center justify-between gap-2 font-mono">
                        <span className="text-cyan-300 font-semibold">
                          {i + 1}. {step.toolName}
                        </span>
                        <span className="text-slate-300">{step.summary}</span>
                      </div>
                      <pre className="text-[11px] text-slate-400 overflow-x-auto pt-1">
                        {JSON.stringify(step.args)}
                      </pre>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
