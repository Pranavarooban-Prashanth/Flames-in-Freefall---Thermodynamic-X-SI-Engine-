import React, { useMemo, useState } from 'react';
import { Download, Edit3, FolderOpen, Trash2 } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { SavedScenario, UnitSystem } from '../types/combustion';
import {
  exportScenarioPrintableReport,
  exportScenariosAsCSV,
  exportScenariosAsJSON,
} from '../engine/persistence';
import { kPaToUnit } from '../engine/units';

const BAR_MARGIN = { top: 10, right: 20, bottom: 10, left: 4 };
const TICK_STYLE = { fill: '#94A3B8', fontSize: 11 };
const Y_DOMAIN: [number, number] = [0, 100];
const TOOLTIP_STYLE = {
  backgroundColor: '#07090E',
  borderColor: '#1E293B',
  fontSize: '12px',
  fontFamily: 'IBM Plex Mono',
};
const LEGEND_STYLE = { fontSize: '11px' };

interface HistoryPageProps {
  scenarios: SavedScenario[];
  unitSystem: UnitSystem;
  onLoadScenario: (scenario: SavedScenario) => void;
  onRenameScenario: (id: string, newName: string) => void;
  onDeleteScenario: (id: string) => void;
}

export const HistoryPage: React.FC<HistoryPageProps> = ({
  scenarios,
  unitSystem,
  onLoadScenario,
  onRenameScenario,
  onDeleteScenario,
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState<string>('');

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const compared = useMemo(
    () => scenarios.filter((s) => selectedIds.includes(s.id)),
    [scenarios, selectedIds]
  );

  const compareChartData = useMemo(
    () =>
      compared.map((s) => ({
        name: s.name.slice(0, 22),
        safetyIndex: s.result.fireSafetyIndex,
        ignitionProbPct: Number((s.result.predictions.ignitionProbability * 100).toFixed(1)),
        loiPct: s.result.predictions.limitingOxygenIndexPercent,
      })),
    [compared]
  );

  return (
    <div className="space-y-4">
      {/* Header & Export Toolbar */}
      <div className="bg-[#0D111A] border border-slate-800 p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-base font-display font-semibold text-slate-100">
            Saved Scenarios & Side-by-Side Comparison
          </h1>
          <p className="text-xs text-slate-400">
            {scenarios.length} saved run(s) · Automatically re-computed whenever new datasets are ingested
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => exportScenariosAsJSON(compared.length ? compared : scenarios)}
            disabled={scenarios.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono bg-[#07090E] border border-slate-700 text-slate-200 hover:border-cyan-500 rounded disabled:opacity-40 whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" /> Export JSON
          </button>
          <button
            onClick={() => exportScenariosAsCSV(compared.length ? compared : scenarios)}
            disabled={scenarios.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono bg-[#07090E] border border-slate-700 text-slate-200 hover:border-cyan-500 rounded disabled:opacity-40 whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
          <button
            onClick={() => exportScenarioPrintableReport(compared.length ? compared : scenarios)}
            disabled={scenarios.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono bg-cyan-500 text-slate-950 hover:bg-cyan-400 font-semibold rounded disabled:opacity-40 whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" /> Export Report (PDF/HTML)
          </button>
        </div>
      </div>

      {/* Scenarios List */}
      <div className="bg-[#0D111A] border border-slate-800 p-4">
        {scenarios.length === 0 ? (
          <p className="text-xs text-slate-400 py-8 text-center">
            No saved scenarios yet. Run an inference on the SI Engine page and click <strong>Save Scenario</strong>.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-mono">
                  <th className="py-2 pr-3">Compare</th>
                  <th className="py-2 pr-3">Scenario Name</th>
                  <th className="py-2 pr-3">Conditions</th>
                  <th className="py-2 pr-3">Safety Index</th>
                  <th className="py-2 pr-3">Regime / LOI</th>
                  <th className="py-2 pr-3">Updated</th>
                  <th className="py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {scenarios.map((s) => {
                  const checked = selectedIds.includes(s.id);
                  const isEditing = editingId === s.id;
                  return (
                    <tr key={s.id} className="hover:bg-slate-900/40">
                      <td className="py-2.5 pr-3">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSelect(s.id)}
                          aria-label={`Select ${s.name} for comparison`}
                        />
                      </td>
                      <td className="py-2.5 pr-3">
                        {isEditing ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={draftName}
                              onChange={(e) => setDraftName(e.target.value)}
                              className="px-2 py-1 text-xs bg-[#07090E] border border-cyan-500 text-slate-100 rounded"
                            />
                            <button
                              onClick={() => {
                                if (draftName.trim()) onRenameScenario(s.id, draftName.trim());
                                setEditingId(null);
                              }}
                              className="px-2 py-1 text-[11px] bg-cyan-500 text-slate-950 font-semibold rounded"
                            >
                              Save
                            </button>
                          </div>
                        ) : (
                          <div>
                            <div className="font-medium text-slate-100">{s.name}</div>
                            <div className="text-[11px] font-mono text-slate-500">
                              {s.input.fuelMaterial} · {s.result.datasetVersionHash}
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 pr-3 font-mono text-slate-300 tabular-nums">
                        {s.input.o2Percent}% O₂ ·{' '}
                        {unitSystem === 'metric'
                          ? `${s.input.totalPressureKPa} kPa`
                          : `${kPaToUnit(s.input.totalPressureKPa, 'psi').toFixed(1)} psi`}{' '}
                        · {s.input.gravityG} g · {s.input.diluentType}
                      </td>
                      <td className="py-2.5 pr-3 font-mono tabular-nums">
                        <span className="text-slate-100 font-semibold">{s.result.fireSafetyIndex}</span>
                        <span className="text-slate-400"> / 100 ({s.result.riskTier})</span>
                      </td>
                      <td className="py-2.5 pr-3 font-mono text-slate-300 tabular-nums">
                        {s.result.predictions.likelyFlameRegime} · LOI {s.result.predictions.limitingOxygenIndexPercent}%
                      </td>
                      <td className="py-2.5 pr-3 font-mono text-[11px] text-slate-400 tabular-nums">
                        {new Date(s.updatedAt).toLocaleString()}
                      </td>
                      <td className="py-2.5 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => onLoadScenario(s)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] bg-[#07090E] border border-slate-700 text-cyan-300 hover:border-cyan-500 rounded whitespace-nowrap"
                          >
                            <FolderOpen className="w-3 h-3" /> Load
                          </button>
                          <button
                            onClick={() => {
                              setEditingId(s.id);
                              setDraftName(s.name);
                            }}
                            aria-label="Rename scenario"
                            className="p-1.5 text-slate-400 hover:text-slate-100 border border-slate-800 rounded"
                          >
                            <Edit3 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedIds((prev) => prev.filter((x) => x !== s.id));
                              onDeleteScenario(s.id);
                            }}
                            aria-label="Delete scenario"
                            className="p-1.5 text-slate-400 hover:text-rose-400 border border-slate-800 rounded"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Side-by-Side Comparison View */}
      {compared.length >= 2 && (
        <div className="bg-[#0D111A] border border-slate-800 p-4 space-y-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-display font-semibold text-slate-100">
              Side-by-Side Comparison ({compared.length} Selected)
            </h2>
            <span className="text-xs font-mono text-slate-400">Select checkboxes above to compare</span>
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={compareChartData} margin={BAR_MARGIN}>
                <CartesianGrid stroke="#1E293B" strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={TICK_STYLE} />
                <YAxis domain={Y_DOMAIN} tick={TICK_STYLE} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend wrapperStyle={LEGEND_STYLE} />
                <Bar dataKey="safetyIndex" name="Fire Safety Index (0-100)" fill="#06B6D4" isAnimationActive={false} />
                <Bar dataKey="ignitionProbPct" name="Ignition Prob (%)" fill="#F43F5E" isAnimationActive={false} />
                <Bar dataKey="loiPct" name="LOI (% O2)" fill="#10B981" isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs font-mono tabular-nums">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2 pr-3">Metric</th>
                  {compared.map((s) => (
                    <th key={s.id} className="py-2 pr-3 font-sans text-slate-100">
                      {s.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                <tr>
                  <td className="py-1.5 pr-3 text-slate-400 font-sans">Fire Safety Index</td>
                  {compared.map((s) => (
                    <td key={s.id} className="py-1.5 pr-3 text-cyan-300 font-semibold">
                      {s.result.fireSafetyIndex} ({s.result.riskTier})
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-1.5 pr-3 text-slate-400 font-sans">Atmosphere (O₂ / P / Diluent)</td>
                  {compared.map((s) => (
                    <td key={s.id} className="py-1.5 pr-3">
                      {s.input.o2Percent}% / {s.input.totalPressureKPa} kPa / {s.input.diluentType}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-1.5 pr-3 text-slate-400 font-sans">Gravity / Flow / Fuel</td>
                  {compared.map((s) => (
                    <td key={s.id} className="py-1.5 pr-3">
                      {s.input.gravityG}g / {s.input.ambientFlowCmS} cm/s / {s.input.fuelMaterial}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-1.5 pr-3 text-slate-400 font-sans">Ignition / Extinction Prob</td>
                  {compared.map((s) => (
                    <td key={s.id} className="py-1.5 pr-3">
                      {(s.result.predictions.ignitionProbability * 100).toFixed(1)}% / {(s.result.predictions.extinctionLikelihood * 100).toFixed(1)}%
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-1.5 pr-3 text-slate-400 font-sans">Regime / Peak Temp / LOI</td>
                  {compared.map((s) => (
                    <td key={s.id} className="py-1.5 pr-3">
                      {s.result.predictions.likelyFlameRegime} / {s.result.predictions.predictedPeakTemperatureK} K / {s.result.predictions.limitingOxygenIndexPercent}%
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-1.5 pr-3 text-slate-400 font-sans">Spread vs 1g / Confidence</td>
                  {compared.map((s) => (
                    <td key={s.id} className="py-1.5 pr-3">
                      {s.result.predictions.spreadOrBurnRateRelativeToEarth}x / {s.result.confidence}%
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
