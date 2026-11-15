import React, { useMemo, useState } from 'react';
import { Download, ExternalLink, FileUp, RotateCcw } from 'lucide-react';
import {
  IngestionReport,
  KnowledgePassage,
  PSIIndexEntry,
  SchemaRegistryEntry,
  UnifiedRecord,
  UnitSystem,
} from '../types/combustion';
import { ingestUploadedFile } from '../engine/ingestion';
import { kPaToUnit, kelvinToFahrenheit, mmToInches } from '../engine/units';

interface DatasetsPageProps {
  dataset: UnifiedRecord[];
  psiIndex: PSIIndexEntry[];
  report: IngestionReport;
  unitSystem: UnitSystem;
  customFileCount: number;
  onIngestComplete: (payload: {
    records: UnifiedRecord[];
    passages: KnowledgePassage[];
    schemaEntries: SchemaRegistryEntry[];
    unitConversions: IngestionReport['unit_conversions_log'];
  }) => void;
  onResetCustomData: () => void;
}

type ModalityKey = 'droplet' | 'gas' | 'solid' | 'aerosol' | 'reference';

export const DatasetsPage: React.FC<DatasetsPageProps> = ({
  dataset,
  psiIndex,
  report,
  unitSystem,
  customFileCount,
  onIngestComplete,
  onResetCustomData,
}) => {
  const [activeModality, setActiveModality] = useState<ModalityKey>('droplet');
  const [ingesting, setIngesting] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const droplet = dataset.filter((r) => r.fuel_phase === 'liquid droplet');
    const gas = dataset.filter((r) => r.fuel_phase === 'gas');
    const aerosolIds = new Set(['PSI 102', 'PSI 101', 'PSI 115', 'PSI 47']);
    const aerosol = dataset.filter((r) => aerosolIds.has(r.experiment_id));
    const solid = dataset.filter((r) => r.fuel_phase === 'solid' && !aerosolIds.has(r.experiment_id));
    const reference = psiIndex.filter((p) => p.category === 'non_combustion_reference');
    return { droplet, gas, solid, aerosol, reference };
  }, [dataset, psiIndex]);

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setIngesting(true);
    setUploadStatus(null);

    const aggRecords: UnifiedRecord[] = [];
    const aggPassages: KnowledgePassage[] = [];
    const aggSchemas: SchemaRegistryEntry[] = [];
    const aggConversions: IngestionReport['unit_conversions_log'] = [];

    for (const file of Array.from(fileList)) {
      const res = await ingestUploadedFile(file, psiIndex);
      aggRecords.push(...res.records);
      aggPassages.push(...res.passages);
      aggSchemas.push(...res.schemaEntries);
      aggConversions.push(...res.unitConversions);
    }

    onIngestComplete({
      records: aggRecords,
      passages: aggPassages,
      schemaEntries: aggSchemas,
      unitConversions: aggConversions,
    });

    setUploadStatus(
      `Ingested ${fileList.length} file(s): +${aggRecords.length} harmonized rows, +${aggPassages.length} report passages. Saved scenarios re-evaluated.`
    );
    setIngesting(false);
  };

  const handleDownloadRegistry = () => {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'schema_registry.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const fmtP = (kpa: number | null) =>
    kpa === null
      ? '—'
      : unitSystem === 'metric'
      ? `${kpa.toFixed(1)} kPa`
      : `${kPaToUnit(kpa, 'psi').toFixed(1)} psi`;

  const fmtLen = (mm: number | null) =>
    mm === null
      ? '—'
      : unitSystem === 'metric'
      ? `${mm.toFixed(2)} mm`
      : `${mmToInches(mm).toFixed(3)} in`;

  const fmtTemp = (k: number | null) =>
    k === null
      ? '—'
      : unitSystem === 'metric'
      ? `${Math.round(k)} K`
      : `${Math.round(kelvinToFahrenheit(k))} °F`;

  const modalityTabs: Array<{ key: ModalityKey; label: string; count: number; desc: string }> = [
    {
      key: 'droplet',
      label: 'Droplet & Cool Flames',
      count: grouped.droplet.length,
      desc: 'FLEX, FLEX-2, CFI, PSI-117 — isolated spherical liquid droplets measuring extinction diameter Dₑ, burning constant K (mm²/s), and standoff ratio.',
    },
    {
      key: 'gas',
      label: 'Gaseous & Coflow Flames',
      count: grouped.gas.length,
      desc: 'ACME (CFI-G, Flame Design, BRE, s-Flame, CLD Flame, E-FIELD), SPICE, SLICE — porous burners & coflow nozzles measuring diluents, peak temperatures, and stability.',
    },
    {
      key: 'solid',
      label: 'Solid Flammability & Spread',
      count: grouped.solid.length,
      desc: 'BASS, BASS-II, SAFFIRE-I/II/III — solid polymers and fabrics in forced spacecraft ventilation flows measuring spread rates (mm/s) across 0g, partial-g, and 1g.',
    },
    {
      key: 'aerosol',
      label: 'Smoke & Cabin Aerosols',
      count: grouped.aerosol.length,
      desc: 'SAME, SAME-R, PSI-115, DAFT/DAFT-2 — pyrolysis heaters and ambient cabin particulate baselines for spacecraft smoke detection.',
    },
    {
      key: 'reference',
      label: 'Index-Only Non-Combustion',
      count: grouped.reference.length,
      desc: 'Non-combustion PSI search index entries (STDCE-1 Marangoni fluids, Solder solidification) preserved for full catalog accountability.',
    },
  ];

  const activeMeta = modalityTabs.find((m) => m.key === activeModality)!;

  return (
    <div className="space-y-4">
      {/* Header & Summary */}
      <div className="bg-[#0D111A] border border-slate-800 p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1 max-w-3xl">
            <h1 className="text-base font-display font-semibold text-slate-100">
              NASA PSI Experimental Datasets
            </h1>
            <p className="text-xs text-slate-400 leading-relaxed">
              Each NASA PSI investigation measures fundamentally different physical quantities. Rather than forcing all
              experiments into one mismatched table, records are organized below by experimental modality with only the
              columns genuinely measured by that apparatus (unmeasured fields remain absent rather than assumed).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={handleDownloadRegistry}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#07090E] border border-slate-700 text-slate-200 hover:border-cyan-500 rounded transition-colors whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              Export schema_registry.json
            </button>
            {customFileCount > 0 && (
              <button
                onClick={onResetCustomData}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#07090E] border border-slate-700 text-amber-300 hover:border-amber-500 rounded transition-colors whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset Uploads ({customFileCount})
              </button>
            )}
          </div>
        </div>

        {/* Modality Summary Cards / Segmented Selector */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          {modalityTabs.map((tab) => {
            const active = activeModality === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveModality(tab.key)}
                className={`text-left p-3 border rounded transition-colors ${
                  active
                    ? 'bg-cyan-500/15 border-cyan-500/60 text-slate-100'
                    : 'bg-[#07090E] border-slate-800 text-slate-300 hover:border-slate-600'
                }`}
              >
                <div className="text-xs font-medium">{tab.label}</div>
                <div className="text-lg font-mono font-semibold text-cyan-300 mt-1 tabular-nums">
                  {tab.count}
                  <span className="text-[11px] font-normal text-slate-400 ml-1">
                    {tab.key === 'reference' ? 'index entries' : 'test runs'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Modality Domain-Native Table */}
      <div className="bg-[#0D111A] border border-slate-800 p-4 space-y-3">
        <div className="border-b border-slate-800 pb-2.5">
          <h2 className="text-sm font-display font-semibold text-slate-100">
            {activeMeta.label} ({activeMeta.count})
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">{activeMeta.desc}</p>
        </div>

        <div className="overflow-x-auto">
          {activeModality === 'droplet' && (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-mono">
                  <th className="py-2 pr-3">Experiment</th>
                  <th className="py-2 pr-3">Platform</th>
                  <th className="py-2 pr-3">Liquid Fuel</th>
                  <th className="py-2 pr-3">D₀</th>
                  <th className="py-2 pr-3">O₂</th>
                  <th className="py-2 pr-3">Pressure</th>
                  <th className="py-2 pr-3">Diluent</th>
                  <th className="py-2 pr-3">D_ext</th>
                  <th className="py-2 pr-3">Burn Const. K</th>
                  <th className="py-2 pr-3">Standoff d_f/d_d</th>
                  <th className="py-2 pr-3">Regime</th>
                  <th className="py-2">Outcome</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70 font-mono tabular-nums">
                {grouped.droplet.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-900/40">
                    <td className="py-2 pr-3 font-sans">
                      <div className="font-medium text-slate-100">{r.experiment_name}</div>
                      <div className="text-[11px] font-mono text-slate-500">{r.experiment_id}</div>
                    </td>
                    <td className="py-2 pr-3 font-sans text-slate-300">{r.platform}</td>
                    <td className="py-2 pr-3 font-sans text-slate-200">{r.fuel_or_material}</td>
                    <td className="py-2 pr-3">{fmtLen(r.characteristic_size_mm)}</td>
                    <td className="py-2 pr-3">{r.O2_mole_fraction !== null ? `${(r.O2_mole_fraction * 100).toFixed(1)}%` : '—'}</td>
                    <td className="py-2 pr-3">{fmtP(r.total_pressure_kPa)}</td>
                    <td className="py-2 pr-3">{r.diluent_type ?? '—'}</td>
                    <td className="py-2 pr-3 text-cyan-300">{fmtLen(r.extinction_diameter_mm)}</td>
                    <td className="py-2 pr-3">{r.burn_rate_or_spread_rate !== null ? `${r.burn_rate_or_spread_rate.toFixed(2)} mm²/s` : '—'}</td>
                    <td className="py-2 pr-3">{r.flame_standoff_ratio !== null ? r.flame_standoff_ratio.toFixed(1) : '—'}</td>
                    <td className="py-2 pr-3 font-sans text-cyan-300">{r.flame_regime ?? '—'}</td>
                    <td className="py-2 font-sans text-slate-200">{r.observed_outcome ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeModality === 'gas' && (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-mono">
                  <th className="py-2 pr-3">Experiment</th>
                  <th className="py-2 pr-3">Fuel / Emulated</th>
                  <th className="py-2 pr-3">Burner / Geometry</th>
                  <th className="py-2 pr-3">Nozzle / Size</th>
                  <th className="py-2 pr-3">O₂</th>
                  <th className="py-2 pr-3">Pressure</th>
                  <th className="py-2 pr-3">Diluent</th>
                  <th className="py-2 pr-3">Coflow / Flow</th>
                  <th className="py-2 pr-3">Peak Temp</th>
                  <th className="py-2 pr-3">Regime</th>
                  <th className="py-2">Outcome</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70 font-mono tabular-nums">
                {grouped.gas.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-900/40">
                    <td className="py-2 pr-3 font-sans">
                      <div className="font-medium text-slate-100">{r.experiment_name}</div>
                      <div className="text-[11px] font-mono text-slate-500">{r.experiment_id}</div>
                    </td>
                    <td className="py-2 pr-3 font-sans text-slate-200">{r.fuel_or_material}</td>
                    <td className="py-2 pr-3 font-sans text-slate-400">{r.geometry ?? '—'}</td>
                    <td className="py-2 pr-3">{fmtLen(r.characteristic_size_mm)}</td>
                    <td className="py-2 pr-3">{r.O2_mole_fraction !== null ? `${(r.O2_mole_fraction * 100).toFixed(1)}%` : '—'}</td>
                    <td className="py-2 pr-3">{fmtP(r.total_pressure_kPa)}</td>
                    <td className="py-2 pr-3">{r.diluent_type ?? '—'}</td>
                    <td className="py-2 pr-3">{r.ambient_flow_velocity_cm_s !== null ? `${r.ambient_flow_velocity_cm_s.toFixed(1)} cm/s` : '—'}</td>
                    <td className="py-2 pr-3 text-amber-300">{fmtTemp(r.peak_temperature_K)}</td>
                    <td className="py-2 pr-3 font-sans text-cyan-300">{r.flame_regime ?? '—'}</td>
                    <td className="py-2 font-sans text-slate-200">{r.observed_outcome ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeModality === 'solid' && (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-mono">
                  <th className="py-2 pr-3">Experiment</th>
                  <th className="py-2 pr-3">Platform</th>
                  <th className="py-2 pr-3">Solid Material</th>
                  <th className="py-2 pr-3">Sample Width / Geometry</th>
                  <th className="py-2 pr-3">Gravity</th>
                  <th className="py-2 pr-3">O₂</th>
                  <th className="py-2 pr-3">Pressure</th>
                  <th className="py-2 pr-3">Forced Flow</th>
                  <th className="py-2 pr-3">Spread Rate</th>
                  <th className="py-2">Outcome</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70 font-mono tabular-nums">
                {grouped.solid.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-900/40">
                    <td className="py-2 pr-3 font-sans">
                      <div className="font-medium text-slate-100">{r.experiment_name}</div>
                      <div className="text-[11px] font-mono text-slate-500">{r.experiment_id}</div>
                    </td>
                    <td className="py-2 pr-3 font-sans text-slate-300">{r.platform}</td>
                    <td className="py-2 pr-3 font-sans text-slate-200">{r.fuel_or_material}</td>
                    <td className="py-2 pr-3 font-sans text-slate-400">
                      {fmtLen(r.characteristic_size_mm)} · {r.geometry ?? '—'}
                    </td>
                    <td className="py-2 pr-3">{r.gravity_level_g !== null ? `${r.gravity_level_g} g` : '—'}</td>
                    <td className="py-2 pr-3">{r.O2_mole_fraction !== null ? `${(r.O2_mole_fraction * 100).toFixed(1)}%` : '—'}</td>
                    <td className="py-2 pr-3">{fmtP(r.total_pressure_kPa)}</td>
                    <td className="py-2 pr-3">{r.ambient_flow_velocity_cm_s !== null ? `${r.ambient_flow_velocity_cm_s.toFixed(1)} cm/s` : '—'}</td>
                    <td className="py-2 pr-3 text-cyan-300">
                      {r.burn_rate_or_spread_rate !== null ? `${r.burn_rate_or_spread_rate.toFixed(2)} mm/s` : '—'}
                    </td>
                    <td className="py-2 font-sans text-slate-200">{r.observed_outcome ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeModality === 'aerosol' && (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-mono">
                  <th className="py-2 pr-3">Experiment</th>
                  <th className="py-2 pr-3">Specimen / Aerosol Source</th>
                  <th className="py-2 pr-3">Apparatus / Heater</th>
                  <th className="py-2 pr-3">O₂</th>
                  <th className="py-2 pr-3">Pressure</th>
                  <th className="py-2 pr-3">Cabin / Duct Flow</th>
                  <th className="py-2 pr-3">Pyrolysis / Gas Temp</th>
                  <th className="py-2">Observed State</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70 font-mono tabular-nums">
                {grouped.aerosol.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-900/40">
                    <td className="py-2 pr-3 font-sans">
                      <div className="font-medium text-slate-100">{r.experiment_name}</div>
                      <div className="text-[11px] font-mono text-slate-500">{r.experiment_id}</div>
                    </td>
                    <td className="py-2 pr-3 font-sans text-slate-200">{r.fuel_or_material}</td>
                    <td className="py-2 pr-3 font-sans text-slate-400">{r.ignition_energy_or_method ?? 'Ambient duct sampling'}</td>
                    <td className="py-2 pr-3">{r.O2_mole_fraction !== null ? `${(r.O2_mole_fraction * 100).toFixed(1)}%` : '—'}</td>
                    <td className="py-2 pr-3">{fmtP(r.total_pressure_kPa)}</td>
                    <td className="py-2 pr-3">{r.ambient_flow_velocity_cm_s !== null ? `${r.ambient_flow_velocity_cm_s.toFixed(1)} cm/s` : '—'}</td>
                    <td className="py-2 pr-3">{fmtTemp(r.peak_temperature_K)}</td>
                    <td className="py-2 font-sans text-slate-200">{r.observed_outcome ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeModality === 'reference' && (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-mono">
                  <th className="py-2 pr-3">PSI ID</th>
                  <th className="py-2 pr-3">Title</th>
                  <th className="py-2 pr-3">Investigators</th>
                  <th className="py-2 pr-3">Reason Not Mixed Into Combustion Table</th>
                  <th className="py-2">DOI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {grouped.reference.map((entry) => (
                  <tr key={entry.psi_id}>
                    <td className="py-2 pr-3 font-mono text-cyan-300">{entry.psi_id}</td>
                    <td className="py-2 pr-3 text-slate-100">{entry.full_title}</td>
                    <td className="py-2 pr-3 text-slate-400">{entry.investigators}</td>
                    <td className="py-2 pr-3 text-amber-300/90 text-xs">{entry.description}</td>
                    <td className="py-2 font-mono">
                      <a
                        href={entry.doi_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-cyan-400 hover:underline"
                      >
                        DOI <ExternalLink className="w-3 h-3" />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* True Non-Null Measurement Completeness & Additional File Upload */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="bg-[#0D111A] border border-slate-800 p-4 space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-display font-semibold text-slate-100">
              Measured Parameter Coverage Across Unified Records
            </h2>
            <span className="text-xs font-mono text-slate-400">Honest non-null %</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs font-mono tabular-nums">
            {(
              [
                ['O2_mole_fraction', 'O₂ Mole Frac.'],
                ['total_pressure_kPa', 'Pressure (kPa)'],
                ['gravity_level_g', 'Gravity (g)'],
                ['ambient_flow_velocity_cm_s', 'Flow Vel.'],
                ['characteristic_size_mm', 'Sample/D₀ Size'],
                ['extinction_diameter_mm', 'Droplet D_ext'],
                ['burn_rate_or_spread_rate', 'Spread / K Rate'],
                ['peak_temperature_K', 'Peak Temp (K)'],
                ['flame_standoff_ratio', 'Standoff Ratio'],
              ] as const
            ).map(([field, label]) => {
              const pct = report.field_completeness[field] ?? 0;
              return (
                <div key={field} className="border border-slate-800 bg-[#07090E] p-2.5">
                  <div className="text-slate-400 text-[11px]">{label}</div>
                  <div className="text-slate-100 font-semibold mt-0.5">{pct.toFixed(1)}%</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-[#0D111A] border border-slate-800 p-4 space-y-3">
          <div>
            <h2 className="text-sm font-display font-semibold text-slate-100">
              Ingest Additional Experimental Datasets
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Drop additional CSV, XLSX, PDF, or DOCX files to merge new test rows or report passages and auto-update saved scenarios.
            </p>
          </div>
          <label className="flex flex-col items-center justify-center border border-dashed border-slate-700 hover:border-cyan-500 bg-[#07090E] p-4 cursor-pointer transition-colors">
            <FileUp className="w-4 h-4 text-cyan-400 mb-1" />
            <span className="text-xs text-slate-200">
              {ingesting ? 'Parsing and normalizing SI units...' : 'Upload CSV / XLSX / PDF / DOCX'}
            </span>
            <input
              type="file"
              multiple
              accept=".csv,.xlsx,.xls,.pdf,.docx,.doc"
              onChange={(e) => handleFiles(e.target.files)}
              className="hidden"
            />
          </label>
          {uploadStatus && (
            <div className="p-2.5 bg-emerald-950/30 border border-emerald-700/50 text-emerald-300 text-xs font-mono">
              ● {uploadStatus}
            </div>
          )}
          {report.failed_files.length > 0 && (
            <div className="space-y-1 text-xs font-mono text-rose-300">
              {report.failed_files.map((ff, i) => (
                <div key={i}>
                  ✖ {ff.filename}: {ff.reason}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
