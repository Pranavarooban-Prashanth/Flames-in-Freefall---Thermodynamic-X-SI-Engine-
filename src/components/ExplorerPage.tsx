import React, { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';
import {
  InferenceInput,
  InferenceResult,
  UnifiedRecord,
  UnitSystem,
} from '../types/combustion';
import { kPaToUnit, mmToInches } from '../engine/units';

const CHART_MARGIN = { top: 10, right: 20, bottom: 16, left: 4 };
const BAR_MARGIN = { top: 10, right: 20, bottom: 10, left: 4 };
const TICK_STYLE = { fill: '#94A3B8', fontSize: 11 };
const TOOLTIP_STYLE = {
  backgroundColor: '#07090E',
  borderColor: '#1E293B',
  fontSize: '12px',
  fontFamily: 'IBM Plex Mono',
};
const CURSOR_STYLE = { strokeDasharray: '3 3', stroke: '#475569' };
const LEGEND_STYLE = { fontSize: '11px', paddingTop: '8px' };
const BAR_LEGEND_STYLE = { fontSize: '11px' };
const O2_DOMAIN: [number, number] = [10, 100];
const G_DOMAIN: [number, number] = [0, 1.1];
const Z_RANGE: [number, number] = [45, 45];
const O2_AXIS_LABEL = {
  value: 'O₂ Concentration (%)',
  position: 'insideBottom' as const,
  offset: -8,
  fill: '#64748B',
  fontSize: 11,
};

interface ExplorerPageProps {
  dataset: UnifiedRecord[];
  queryInput: InferenceInput;
  queryResult: InferenceResult;
  unitSystem: UnitSystem;
}

export const ExplorerPage: React.FC<ExplorerPageProps> = ({
  dataset,
  queryInput,
  queryResult,
  unitSystem,
}) => {
  const [expFilter, setExpFilter] = useState<string>('ALL');
  const [platformFilter, setPlatformFilter] = useState<string>('ALL');
  const [phaseFilter, setPhaseFilter] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');

  const experiments = useMemo(
    () => Array.from(new Set(dataset.map((d) => d.experiment_name))).sort(),
    [dataset]
  );
  const platforms = useMemo(
    () => Array.from(new Set(dataset.map((d) => d.platform))).sort(),
    [dataset]
  );

  const filtered = useMemo(() => {
    return dataset.filter((r) => {
      if (expFilter !== 'ALL' && r.experiment_name !== expFilter) return false;
      if (platformFilter !== 'ALL' && r.platform !== platformFilter) return false;
      if (phaseFilter !== 'ALL' && r.fuel_phase !== phaseFilter) return false;
      if (
        search.trim() &&
        !`${r.experiment_name} ${r.experiment_id} ${r.fuel_or_material} ${r.flame_regime ?? ''} ${r.observed_outcome ?? ''}`
          .toLowerCase()
          .includes(search.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [dataset, expFilter, platformFilter, phaseFilter, search]);

  const o2GravitySustained = useMemo(
    () =>
      filtered
        .filter((r) => r.O2_mole_fraction !== null && r.gravity_level_g !== null && (r.observed_outcome === 'sustained' || r.observed_outcome === 'ignited'))
        .map((r) => ({
          name: `${r.experiment_name} (${r.fuel_or_material})`,
          o2: Number(((r.O2_mole_fraction ?? 0) * 100).toFixed(1)),
          gravity: Number((r.gravity_level_g ?? 0).toFixed(4)),
          outcome: r.observed_outcome,
        })),
    [filtered]
  );

  const o2GravityExtinguished = useMemo(
    () =>
      filtered
        .filter((r) => r.O2_mole_fraction !== null && r.gravity_level_g !== null && (r.observed_outcome === 'extinguished' || r.observed_outcome === 'no ignition'))
        .map((r) => ({
          name: `${r.experiment_name} (${r.fuel_or_material})`,
          o2: Number(((r.O2_mole_fraction ?? 0) * 100).toFixed(1)),
          gravity: Number((r.gravity_level_g ?? 0).toFixed(4)),
          outcome: r.observed_outcome,
        })),
    [filtered]
  );

  const pressureOutcomePoints = useMemo(
    () =>
      filtered
        .filter((r) => r.total_pressure_kPa !== null && r.burn_rate_or_spread_rate !== null)
        .map((r) => ({
          name: `${r.experiment_name} (${r.fuel_or_material})`,
          pressure:
            unitSystem === 'metric'
              ? Number((r.total_pressure_kPa ?? 0).toFixed(1))
              : Number(kPaToUnit(r.total_pressure_kPa ?? 0, 'psi').toFixed(1)),
          rate: Number((r.burn_rate_or_spread_rate ?? 0).toFixed(2)),
          regime: r.flame_regime ?? 'unknown',
        })),
    [filtered, unitSystem]
  );

  const extinctionByFuel = useMemo(() => {
    const map = new Map<string, { fuel: string; hotSum: number; hotN: number; coolSum: number; coolN: number }>();
    for (const r of filtered) {
      if (r.extinction_diameter_mm === null) continue;
      const val = unitSystem === 'metric' ? r.extinction_diameter_mm : mmToInches(r.extinction_diameter_mm);
      const entry = map.get(r.fuel_or_material) ?? {
        fuel: r.fuel_or_material,
        hotSum: 0,
        hotN: 0,
        coolSum: 0,
        coolN: 0,
      };
      if (r.flame_regime === 'cool' || r.flame_regime === 'multi-stage') {
        entry.coolSum += val;
        entry.coolN += 1;
      } else {
        entry.hotSum += val;
        entry.hotN += 1;
      }
      map.set(r.fuel_or_material, entry);
    }
    return Array.from(map.values()).map((e) => ({
      fuel: e.fuel,
      hotAvg: e.hotN ? Number((e.hotSum / e.hotN).toFixed(3)) : 0,
      coolAvg: e.coolN ? Number((e.coolSum / e.coolN).toFixed(3)) : 0,
    }));
  }, [filtered, unitSystem]);

  const queryPointO2G = useMemo(
    () => [
      {
        name: `Active Query: ${queryInput.missionName}`,
        o2: Number(queryInput.o2Percent.toFixed(1)),
        gravity: Number(queryInput.gravityG.toFixed(4)),
      },
    ],
    [queryInput.missionName, queryInput.o2Percent, queryInput.gravityG]
  );

  const queryPointPR = useMemo(
    () => [
      {
        name: `Active Query: ${queryInput.missionName}`,
        pressure:
          unitSystem === 'metric'
            ? Number(queryInput.totalPressureKPa.toFixed(1))
            : Number(kPaToUnit(queryInput.totalPressureKPa, 'psi').toFixed(1)),
        rate: queryResult.predictions.predictedSpreadOrBurnRate,
      },
    ],
    [
      queryInput.missionName,
      queryInput.totalPressureKPa,
      unitSystem,
      queryResult.predictions.predictedSpreadOrBurnRate,
    ]
  );

  const pressureUnit = unitSystem === 'metric' ? 'kPa' : 'psi';
  const lengthUnit = unitSystem === 'metric' ? 'mm' : 'in';

  const pressureAxisLabel = useMemo(
    () => ({
      value: `Total Pressure (${pressureUnit})`,
      position: 'insideBottom' as const,
      offset: -8,
      fill: '#64748B',
      fontSize: 11,
    }),
    [pressureUnit]
  );

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <div className="bg-[#0D111A] border border-slate-800 p-4 flex flex-wrap items-center gap-3 justify-between">
        <div>
          <h1 className="text-base font-display font-semibold text-slate-100">
            Unified Dataset Explorer
          </h1>
          <p className="text-xs text-slate-400">
            {filtered.length} of {dataset.length} harmonized records shown · Active query overlaid in amber
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={expFilter}
            onChange={(e) => setExpFilter(e.target.value)}
            aria-label="Filter by experiment"
            className="px-2.5 py-1.5 text-xs bg-[#07090E] border border-slate-800 text-slate-200 rounded"
          >
            <option value="ALL">All Experiments</option>
            {experiments.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>

          <select
            value={platformFilter}
            onChange={(e) => setPlatformFilter(e.target.value)}
            aria-label="Filter by platform"
            className="px-2.5 py-1.5 text-xs bg-[#07090E] border border-slate-800 text-slate-200 rounded"
          >
            <option value="ALL">All Platforms</option>
            {platforms.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>

          <select
            value={phaseFilter}
            onChange={(e) => setPhaseFilter(e.target.value)}
            aria-label="Filter by fuel phase"
            className="px-2.5 py-1.5 text-xs bg-[#07090E] border border-slate-800 text-slate-200 rounded"
          >
            <option value="ALL">All Phases</option>
            <option value="solid">Solid</option>
            <option value="liquid droplet">Liquid Droplet</option>
            <option value="gas">Gas</option>
          </select>

          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter fuel, regime..."
            className="px-2.5 py-1.5 text-xs bg-[#07090E] border border-slate-800 text-slate-200 rounded w-44"
          />
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* O2 vs Gravity */}
        <div className="bg-[#0D111A] border border-slate-800 p-4">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-sm font-display font-semibold text-slate-100">
              O₂ Concentration vs Gravity Level
            </h2>
            <span className="text-xs font-mono text-slate-400">Query overlaid in Amber</span>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={CHART_MARGIN}>
                <CartesianGrid stroke="#1E293B" strokeDasharray="3 3" />
                <XAxis
                  type="number"
                  dataKey="o2"
                  name="O₂"
                  unit="%"
                  domain={O2_DOMAIN}
                  tick={TICK_STYLE}
                  label={O2_AXIS_LABEL}
                />
                <YAxis
                  type="number"
                  dataKey="gravity"
                  name="Gravity"
                  unit=" g"
                  domain={G_DOMAIN}
                  tick={TICK_STYLE}
                />
                <ZAxis range={Z_RANGE} />
                <Tooltip cursor={CURSOR_STYLE} contentStyle={TOOLTIP_STYLE} />
                <Legend wrapperStyle={LEGEND_STYLE} />
                <Scatter name="Sustained / Ignited" data={o2GravitySustained} fill="#F43F5E" isAnimationActive={false} />
                <Scatter name="Extinguished / No Ign." data={o2GravityExtinguished} fill="#06B6D4" isAnimationActive={false} />
                <Scatter name="Active Query" data={queryPointO2G} fill="#F59E0B" shape="diamond" isAnimationActive={false} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pressure vs Burn/Spread Rate */}
        <div className="bg-[#0D111A] border border-slate-800 p-4">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-sm font-display font-semibold text-slate-100">
              Total Pressure ({pressureUnit}) vs Burn / Spread Rate
            </h2>
            <span className="text-xs font-mono text-slate-400">mm/s (solid/gas) or mm²/s (droplet)</span>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={CHART_MARGIN}>
                <CartesianGrid stroke="#1E293B" strokeDasharray="3 3" />
                <XAxis
                  type="number"
                  dataKey="pressure"
                  name="Pressure"
                  unit={` ${pressureUnit}`}
                  tick={TICK_STYLE}
                  label={pressureAxisLabel}
                />
                <YAxis
                  type="number"
                  dataKey="rate"
                  name="Rate"
                  tick={TICK_STYLE}
                />
                <ZAxis range={Z_RANGE} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend wrapperStyle={LEGEND_STYLE} />
                <Scatter name="Empirical Records" data={pressureOutcomePoints} fill="#38BDF8" isAnimationActive={false} />
                <Scatter name="Active Query Prediction" data={queryPointPR} fill="#F59E0B" shape="diamond" isAnimationActive={false} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Extinction Diameter by Fuel */}
      <div className="bg-[#0D111A] border border-slate-800 p-4">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-sm font-display font-semibold text-slate-100">
            Mean Droplet Extinction Diameter by Fuel ({lengthUnit}) — Hot vs Cool Flame
          </h2>
          <span className="text-xs font-mono text-slate-400">FLEX / FLEX-2 / CFI Droplet Measurements</span>
        </div>
        {extinctionByFuel.length === 0 ? (
          <p className="text-xs text-slate-400 py-8 text-center">
            No droplet extinction diameter records match the current filters.
          </p>
        ) : (
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={extinctionByFuel} margin={BAR_MARGIN}>
                <CartesianGrid stroke="#1E293B" strokeDasharray="3 3" />
                <XAxis dataKey="fuel" tick={TICK_STYLE} />
                <YAxis tick={TICK_STYLE} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend wrapperStyle={BAR_LEGEND_STYLE} />
                <Bar dataKey="hotAvg" name={`Hot Flame D_ext (${lengthUnit})`} fill="#F59E0B" isAnimationActive={false} />
                <Bar dataKey="coolAvg" name={`Cool / Multi-Stage D_ext (${lengthUnit})`} fill="#06B6D4" isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Full Harmonized Records Table */}
      <div className="bg-[#0D111A] border border-slate-800 p-4">
        <h2 className="text-sm font-display font-semibold text-slate-100 mb-3">
          Harmonized Dataset Records ({filtered.length})
        </h2>
        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 bg-[#0D111A] border-b border-slate-800 text-slate-400 font-mono">
              <tr>
                <th className="py-2 pr-3">ID / Exp</th>
                <th className="py-2 pr-3">Platform</th>
                <th className="py-2 pr-3">Fuel / Material</th>
                <th className="py-2 pr-3">O₂</th>
                <th className="py-2 pr-3">P ({pressureUnit})</th>
                <th className="py-2 pr-3">g</th>
                <th className="py-2 pr-3">Flow</th>
                <th className="py-2 pr-3">Outcome</th>
                <th className="py-2 pr-3">Regime</th>
                <th className="py-2 pr-3">T_peak</th>
                <th className="py-2">D_ext ({lengthUnit})</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 font-mono tabular-nums">
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-slate-900/50">
                  <td className="py-1.5 pr-3 font-sans">
                    <span className="text-slate-100 font-medium">{r.experiment_name}</span>
                    <span className="text-slate-500 font-mono ml-1.5">{r.experiment_id}</span>
                  </td>
                  <td className="py-1.5 pr-3 font-sans text-slate-300">{r.platform}</td>
                  <td className="py-1.5 pr-3 font-sans text-slate-200">{r.fuel_or_material}</td>
                  <td className="py-1.5 pr-3">{r.O2_mole_fraction !== null ? `${(r.O2_mole_fraction * 100).toFixed(1)}%` : '—'}</td>
                  <td className="py-1.5 pr-3">
                    {r.total_pressure_kPa !== null
                      ? unitSystem === 'metric'
                        ? r.total_pressure_kPa.toFixed(1)
                        : kPaToUnit(r.total_pressure_kPa, 'psi').toFixed(1)
                      : '—'}
                  </td>
                  <td className="py-1.5 pr-3">{r.gravity_level_g !== null ? r.gravity_level_g : '—'}</td>
                  <td className="py-1.5 pr-3">{r.ambient_flow_velocity_cm_s !== null ? `${r.ambient_flow_velocity_cm_s} cm/s` : '—'}</td>
                  <td className="py-1.5 pr-3 font-sans">{r.observed_outcome ?? '—'}</td>
                  <td className="py-1.5 pr-3 font-sans text-cyan-300">{r.flame_regime ?? '—'}</td>
                  <td className="py-1.5 pr-3">{r.peak_temperature_K !== null ? `${r.peak_temperature_K} K` : '—'}</td>
                  <td className="py-1.5">
                    {r.extinction_diameter_mm !== null
                      ? unitSystem === 'metric'
                        ? r.extinction_diameter_mm.toFixed(2)
                        : mmToInches(r.extinction_diameter_mm).toFixed(3)
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
