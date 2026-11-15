import {
  IngestionReport,
  KnowledgePassage,
  SavedScenario,
  SchemaRegistryEntry,
  UnifiedRecord,
} from '../types/combustion';
import { runInference } from './inference';

const SCENARIOS_KEY = 'si_engine_saved_scenarios_v1';
const CUSTOM_DATA_KEY = 'si_engine_custom_dataset_v1';

export interface CustomIngestedStore {
  records: UnifiedRecord[];
  passages: KnowledgePassage[];
  schemaEntries: SchemaRegistryEntry[];
  unitConversions: IngestionReport['unit_conversions_log'];
}

export function loadSavedScenarios(): SavedScenario[] {
  try {
    const raw = localStorage.getItem(SCENARIOS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function persistSavedScenarios(scenarios: SavedScenario[]): void {
  try {
    localStorage.setItem(SCENARIOS_KEY, JSON.stringify(scenarios));
  } catch {
    // Ignore quota errors gracefully
  }
}

export function loadCustomIngestedData(): CustomIngestedStore {
  try {
    const raw = localStorage.getItem(CUSTOM_DATA_KEY);
    if (!raw) {
      return { records: [], passages: [], schemaEntries: [], unitConversions: [] };
    }
    const parsed = JSON.parse(raw);
    return {
      records: Array.isArray(parsed.records) ? parsed.records : [],
      passages: Array.isArray(parsed.passages) ? parsed.passages : [],
      schemaEntries: Array.isArray(parsed.schemaEntries) ? parsed.schemaEntries : [],
      unitConversions: Array.isArray(parsed.unitConversions) ? parsed.unitConversions : [],
    };
  } catch {
    return { records: [], passages: [], schemaEntries: [], unitConversions: [] };
  }
}

export function persistCustomIngestedData(store: CustomIngestedStore): void {
  try {
    localStorage.setItem(CUSTOM_DATA_KEY, JSON.stringify(store));
  } catch {
    // Ignore storage quota issues
  }
}

/**
 * Automatically re-runs all saved scenarios whenever the unified dataset changes.
 */
export function rerunSavedScenarios(
  scenarios: SavedScenario[],
  dataset: UnifiedRecord[],
  knowledgeBase: KnowledgePassage[]
): SavedScenario[] {
  return scenarios.map((s) => ({
    ...s,
    updatedAt: new Date().toISOString(),
    result: runInference(s.input, dataset, knowledgeBase),
  }));
}

export function exportScenariosAsJSON(scenarios: SavedScenario[]): void {
  const blob = new Blob([JSON.stringify(scenarios, null, 2)], { type: 'application/json' });
  triggerDownload(blob, `si_engine_scenarios_${new Date().toISOString().slice(0, 10)}.json`);
}

export function exportScenariosAsCSV(scenarios: SavedScenario[]): void {
  const headers = [
    'id',
    'name',
    'createdAt',
    'updatedAt',
    'O2_percent',
    'total_pressure_kPa',
    'gravity_g',
    'diluent_type',
    'ambient_flow_cm_s',
    'fuel_material',
    'fuel_phase',
    'characteristic_size_mm',
    'fire_safety_index',
    'risk_tier',
    'likely_flame_regime',
    'ignition_probability',
    'extinction_likelihood',
    'limiting_oxygen_index_pct',
    'spread_relative_to_earth',
    'confidence_pct',
    'extrapolating',
  ];

  const rows = scenarios.map((s) => [
    csvCell(s.id),
    csvCell(s.name),
    csvCell(s.createdAt),
    csvCell(s.updatedAt),
    s.input.o2Percent,
    s.input.totalPressureKPa,
    s.input.gravityG,
    csvCell(s.input.diluentType),
    s.input.ambientFlowCmS,
    csvCell(s.input.fuelMaterial),
    csvCell(s.input.fuelPhase),
    s.input.characteristicSizeMm,
    s.result.fireSafetyIndex,
    csvCell(s.result.riskTier),
    csvCell(s.result.predictions.likelyFlameRegime),
    s.result.predictions.ignitionProbability,
    s.result.predictions.extinctionLikelihood,
    s.result.predictions.limitingOxygenIndexPercent,
    s.result.predictions.spreadOrBurnRateRelativeToEarth,
    s.result.confidence,
    s.result.extrapolation.isExtrapolating,
  ]);

  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, `si_engine_scenarios_${new Date().toISOString().slice(0, 10)}.csv`);
}

export function exportScenarioPrintableReport(scenarios: SavedScenario[]): void {
  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>SI Engine: Extraterrestrial Fire Safety — Scenario Report</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #0f172a; margin: 36px; line-height: 1.5; }
    h1 { font-size: 20px; border-bottom: 2px solid #0f172a; padding-bottom: 8px; }
    .card { border: 1px solid #cbd5e1; padding: 16px; margin-bottom: 18px; page-break-inside: avoid; }
    .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 10px; font-size: 13px; }
    .label { color: #64748b; font-size: 11px; text-transform: uppercase; }
    .val { font-weight: 600; font-family: monospace; }
    .disclaimer { margin-top: 24px; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 10px; }
  </style>
</head>
<body>
  <h1>SI Engine: Extraterrestrial Fire Safety — Exported Scenario Report</h1>
  <p style="font-size:12px;color:#475569;">Generated ${new Date().toLocaleString()} · Research decision-support tool; not certified for operational safety decisions.</p>
  ${scenarios
    .map(
      (s) => `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:baseline;">
        <h2 style="margin:0;font-size:16px;">${escapeHtml(s.name)}</h2>
        <span style="font-family:monospace;font-weight:700;">Safety Index: ${s.result.fireSafetyIndex}/100 (${s.result.riskTier})</span>
      </div>
      <div class="grid">
        <div><div class="label">Atmosphere</div><div class="val">${s.input.o2Percent}% O2 · ${s.input.totalPressureKPa} kPa · ${s.input.diluentType}</div></div>
        <div><div class="label">Gravity / Flow</div><div class="val">${s.input.gravityG} g · ${s.input.ambientFlowCmS} cm/s</div></div>
        <div><div class="label">Fuel / Size</div><div class="val">${escapeHtml(s.input.fuelMaterial)} (${s.input.characteristicSizeMm} mm)</div></div>
        <div><div class="label">Regime / LOI</div><div class="val">${s.result.predictions.likelyFlameRegime} · LOI ${s.result.predictions.limitingOxygenIndexPercent}%</div></div>
        <div><div class="label">Ignition Prob</div><div class="val">${(s.result.predictions.ignitionProbability * 100).toFixed(1)}%</div></div>
        <div><div class="label">Extinction Prob</div><div class="val">${(s.result.predictions.extinctionLikelihood * 100).toFixed(1)}%</div></div>
        <div><div class="label">Rate vs 1g</div><div class="val">${s.result.predictions.spreadOrBurnRateRelativeToEarth}x</div></div>
        <div><div class="label">Confidence</div><div class="val">${s.result.confidence}% ${s.result.extrapolation.isExtrapolating ? '(EXTRAPOLATION)' : ''}</div></div>
      </div>
      ${
        s.narrative
          ? `<div style="margin-top:12px;font-size:12px;background:#f8fafc;padding:10px;border:1px solid #e2e8f0;"><strong>Assessment Narrative:</strong><br/>${escapeHtml(s.narrative).replace(/\n/g, '<br/>')}</div>`
          : ''
      }
    </div>
  `
    )
    .join('')}
  <div class="disclaimer">Data courtesy of NASA Physical Sciences Informatics (PSI) repository. Research decision-support tool; not certified for operational safety decisions.</div>
</body>
</html>`;
  // Avoid window.open in iframe; download standalone HTML report ready for PDF printing or open print dialog on clean blob
  const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
  triggerDownload(blob, `si_engine_report_${new Date().toISOString().slice(0, 10)}.html`);
}

function csvCell(v: unknown): string {
  const s = String(v ?? '');
  return `"${s.replace(/"/g, '""')}"`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
