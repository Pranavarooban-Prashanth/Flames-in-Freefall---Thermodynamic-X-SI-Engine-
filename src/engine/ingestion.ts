import * as XLSX from 'xlsx';
import {
  CANONICAL_FIELDS,
  CanonicalField,
  ColumnSchemaInfo,
  DiluentType,
  FlameRegime,
  FuelPhase,
  IngestionReport,
  KnowledgePassage,
  ObservedOutcome,
  PlatformType,
  PSIIndexEntry,
  SchemaRegistryEntry,
  UnifiedRecord,
} from '../types/combustion';
import {
  gravityToG,
  lengthToMm,
  o2PercentToMoleFraction,
  pressureToKPa,
  temperatureToKelvin,
  velocityToCmS,
} from './units';

export interface DiscoveredColumnMapping {
  canonical: CanonicalField | 'unmapped';
  detectedUnit: string;
  conversionRule: string;
  transform: (raw: unknown, allNumericValues: number[]) => unknown;
}

/**
 * Programmatically discovers canonical field mapping and source unit from a raw column header
 * and its observed numeric distribution (to catch % vs mole fraction, atm vs kPa, mm/s vs cm/s).
 */
export function discoverColumnMapping(
  header: string,
  numericValues: number[]
): DiscoveredColumnMapping {
  const h = header.toLowerCase().trim();
  const maxVal = numericValues.length ? Math.max(...numericValues) : null;

  if (/experiment[_\s-]*id|psi[_\s-]*id|inv[_\s-]*id/.test(h)) {
    return {
      canonical: 'experiment_id',
      detectedUnit: 'identifier',
      conversionRule: 'none',
      transform: (v) => String(v ?? '').trim(),
    };
  }
  if (/experiment[_\s-]*name|investigation|campaign|project/.test(h)) {
    return {
      canonical: 'experiment_name',
      detectedUnit: 'string',
      conversionRule: 'none',
      transform: (v) => String(v ?? '').trim(),
    };
  }
  if (/platform|facility|carrier|vehicle/.test(h)) {
    return {
      canonical: 'platform',
      detectedUnit: 'enum',
      conversionRule: 'normalize platform label',
      transform: (v) => normalizePlatform(String(v ?? '')),
    };
  }
  if (/fuel[_\s-]*phase|phase/.test(h)) {
    return {
      canonical: 'fuel_phase',
      detectedUnit: 'enum',
      conversionRule: 'normalize phase',
      transform: (v) => normalizeFuelPhase(String(v ?? '')),
    };
  }
  if (/fuel|material|sample[_\s-]*type|polymer|substrate/.test(h)) {
    return {
      canonical: 'fuel_or_material',
      detectedUnit: 'string',
      conversionRule: 'none',
      transform: (v) => String(v ?? '').trim(),
    };
  }
  if (/geometry|shape|burner|config/.test(h)) {
    return {
      canonical: 'geometry',
      detectedUnit: 'string',
      conversionRule: 'none',
      transform: (v) => (v == null || v === '' ? null : String(v).trim()),
    };
  }
  if (/ext.*diam|d_ext|d_e\b|extinction.*size/.test(h)) {
    const isUm = /um|micron|µm/.test(h);
    const isCm = /\bcm\b/.test(h);
    const isIn = /\bin\b|inch/.test(h);
    const unit = isUm ? 'um' : isCm ? 'cm' : isIn ? 'in' : 'mm';
    return {
      canonical: 'extinction_diameter_mm',
      detectedUnit: unit,
      conversionRule: unit === 'mm' ? 'identity (mm)' : `${unit} -> mm`,
      transform: (v) => {
        const n = toFiniteNumber(v);
        return n === null ? null : lengthToMm(n, unit);
      },
    };
  }
  if (/size|diam|d0|d_0|thickness|width/.test(h)) {
    const isUm = /um|micron|µm/.test(h);
    const isCm = /\bcm\b/.test(h);
    const isIn = /\bin\b|inch/.test(h);
    const unit = isUm ? 'um' : isCm ? 'cm' : isIn ? 'in' : 'mm';
    return {
      canonical: 'characteristic_size_mm',
      detectedUnit: unit,
      conversionRule: unit === 'mm' ? 'identity (mm)' : `${unit} -> mm`,
      transform: (v) => {
        const n = toFiniteNumber(v);
        return n === null ? null : lengthToMm(n, unit);
      },
    };
  }
  if (/o2|oxygen|x_o2|xo2/.test(h)) {
    const explicitlyPercent = /%|pct|percent/.test(h);
    const explicitlyFraction = /frac|mole|x_o2|xo2/.test(h);
    const looksLikePercent = !explicitlyFraction && (explicitlyPercent || (maxVal !== null && maxVal > 1.05));
    return {
      canonical: 'O2_mole_fraction',
      detectedUnit: looksLikePercent ? '% vol' : 'mole fraction',
      conversionRule: looksLikePercent ? 'divide by 100 (% -> mole fraction)' : 'identity (mole fraction)',
      transform: (v) => {
        const n = toFiniteNumber(v);
        if (n === null) return null;
        return looksLikePercent || n > 1.05 ? o2PercentToMoleFraction(n) : n;
      },
    };
  }
  if (/press|p_amb|p_tot|^p$|^p_/.test(h)) {
    const isAtm = /\batm\b|_atm/.test(h) || (!/kpa|psi|bar|pa/.test(h) && maxVal !== null && maxVal <= 10);
    const isPsi = /\bpsi\b|_psi/.test(h);
    const isBar = /\bbar\b|_bar/.test(h);
    const isPa = (/\bpa\b|_pa/.test(h)) && !/kpa/.test(h);
    const unit: 'atm' | 'psi' | 'bar' | 'Pa' | 'kPa' = isAtm
      ? 'atm'
      : isPsi
      ? 'psi'
      : isBar
      ? 'bar'
      : isPa
      ? 'Pa'
      : 'kPa';
    return {
      canonical: 'total_pressure_kPa',
      detectedUnit: unit,
      conversionRule: unit === 'kPa' ? 'identity (kPa)' : `${unit} -> kPa`,
      transform: (v) => {
        const n = toFiniteNumber(v);
        return n === null ? null : pressureToKPa(n, unit);
      },
    };
  }
  if (/diluent[_\s-]*type|inert|diluent\b/.test(h) && !/frac|pct|%/.test(h)) {
    return {
      canonical: 'diluent_type',
      detectedUnit: 'species',
      conversionRule: 'normalize diluent species',
      transform: (v) => normalizeDiluent(String(v ?? '')),
    };
  }
  if (/diluent[_\s-]*frac|inert[_\s-]*frac|x_dil/.test(h)) {
    const looksLikePercent = /%|pct|percent/.test(h) || (maxVal !== null && maxVal > 1.05);
    return {
      canonical: 'diluent_fraction',
      detectedUnit: looksLikePercent ? '%' : 'mole fraction',
      conversionRule: looksLikePercent ? 'divide by 100' : 'identity',
      transform: (v) => {
        const n = toFiniteNumber(v);
        if (n === null) return null;
        return looksLikePercent || n > 1.05 ? n / 100 : n;
      },
    };
  }
  if (/grav|g_level|\bg\b|accel/.test(h)) {
    const isMS2 = /m\/s2|m\/s\^2|mps2/.test(h) || (maxVal !== null && maxVal > 2.5);
    const isMg = /\bmg\b|milli/.test(h);
    const unit: 'g' | 'm/s2' | 'mg' = isMS2 ? 'm/s2' : isMg ? 'mg' : 'g';
    return {
      canonical: 'gravity_level_g',
      detectedUnit: unit,
      conversionRule: unit === 'g' ? 'identity (g)' : `${unit} -> g`,
      transform: (v) => {
        const n = toFiniteNumber(v);
        return n === null ? null : gravityToG(n, unit);
      },
    };
  }
  if (/flow|vel|u_inf|coflow|air_speed/.test(h)) {
    const isMmS = /mm\/s|mmps/.test(h);
    const isMS = /\bm\/s\b/.test(h) && !/cm\/s|mm\/s/.test(h);
    const isFpm = /fpm|ft\/min/.test(h);
    const unit: 'cm/s' | 'mm/s' | 'm/s' | 'ft/min' = isMmS ? 'mm/s' : isMS ? 'm/s' : isFpm ? 'ft/min' : 'cm/s';
    return {
      canonical: 'ambient_flow_velocity_cm_s',
      detectedUnit: unit,
      conversionRule: unit === 'cm/s' ? 'identity (cm/s)' : `${unit} -> cm/s`,
      transform: (v) => {
        const n = toFiniteNumber(v);
        return n === null ? null : velocityToCmS(n, unit);
      },
    };
  }
  if (/ignit.*method|ignit.*energy|igniter/.test(h)) {
    return {
      canonical: 'ignition_energy_or_method',
      detectedUnit: 'string/mJ',
      conversionRule: 'none',
      transform: (v) => (v == null || v === '' ? null : String(v).trim()),
    };
  }
  if (/outcome|result|status|burn_result|ignited/.test(h)) {
    return {
      canonical: 'observed_outcome',
      detectedUnit: 'enum',
      conversionRule: 'normalize outcome',
      transform: (v) => normalizeOutcome(String(v ?? '')),
    };
  }
  if (/regime|flame[_\s-]*mode|mode/.test(h)) {
    return {
      canonical: 'flame_regime',
      detectedUnit: 'enum',
      conversionRule: 'normalize flame regime',
      transform: (v) => normalizeRegime(String(v ?? '')),
    };
  }
  if (/spread|burn[_\s-]*rate|\bk\b/.test(h)) {
    return {
      canonical: 'burn_rate_or_spread_rate',
      detectedUnit: /mm2\/s|mm\^2\/s/.test(h) ? 'mm^2/s' : 'mm/s',
      conversionRule: 'identity',
      transform: (v) => toFiniteNumber(v),
    };
  }
  if (/temp|t_max|t_peak|t_flame/.test(h)) {
    const isC = /\bc\b|degc|celsius/.test(h) || (maxVal !== null && maxVal < 280);
    const isF = /\bf\b|degf|fahr/.test(h);
    const unit: 'K' | 'C' | 'F' = isF ? 'F' : isC ? 'C' : 'K';
    return {
      canonical: 'peak_temperature_K',
      detectedUnit: unit,
      conversionRule: unit === 'K' ? 'identity (K)' : `${unit} -> K`,
      transform: (v) => {
        const n = toFiniteNumber(v);
        return n === null ? null : temperatureToKelvin(n, unit);
      },
    };
  }
  if (/standoff|df\/dd|r_f\/r_d/.test(h)) {
    return {
      canonical: 'flame_standoff_ratio',
      detectedUnit: 'dimensionless',
      conversionRule: 'identity',
      transform: (v) => toFiniteNumber(v),
    };
  }

  return {
    canonical: 'unmapped',
    detectedUnit: numericValues.length ? 'numeric' : 'text',
    conversionRule: 'unmapped (preserved in audit)',
    transform: (v) => v,
  };
}

function toFiniteNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[^0-9eE.+_-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function normalizePlatform(raw: string): PlatformType {
  const s = raw.toLowerCase();
  if (s.includes('cygnus') || s.includes('saffire')) return 'Cygnus';
  if (s.includes('shuttle') || s.includes('sts')) return 'Shuttle';
  if (s.includes('drop')) return 'Drop Tower';
  if (s.includes('parabol') || s.includes('kc-135') || s.includes('zero-g')) return 'Parabolic';
  if (s.includes('ground') || s.includes('1g') || s.includes('earth')) return 'Ground';
  return 'ISS';
}

function normalizeFuelPhase(raw: string): FuelPhase {
  const s = raw.toLowerCase();
  if (s.includes('droplet') || s.includes('liquid')) return 'liquid droplet';
  if (s.includes('gas') || s.includes('vapor') || s.includes('jet') || s.includes('coflow')) return 'gas';
  return 'solid';
}

function normalizeDiluent(raw: string): DiluentType | null {
  const s = raw.toLowerCase().trim();
  if (!s || s === 'none' || s === 'pure o2' || s === 'n/a') return 'None';
  if (s.includes('co2')) return 'CO2';
  if (s.includes('he')) return 'He';
  if (s.includes('ar')) return 'Ar';
  if (s.includes('mix')) return 'Mixed';
  if (s.includes('n2') || s.includes('air') || s.includes('nitrogen')) return 'N2';
  return 'N2';
}

function normalizeOutcome(raw: string): ObservedOutcome | null {
  const s = raw.toLowerCase().trim();
  if (!s) return null;
  if (s.includes('no') && s.includes('ign')) return 'no ignition';
  if (s.includes('ext') || s.includes('quench')) return 'extinguished';
  if (s.includes('sustain') || s.includes('steady') || s.includes('propagat')) return 'sustained';
  if (s.includes('ign')) return 'ignited';
  return null;
}

function normalizeRegime(raw: string): FlameRegime | null {
  const s = raw.toLowerCase().trim();
  if (!s) return null;
  if (s.includes('multi')) return 'multi-stage';
  if (s.includes('osc')) return 'oscillatory';
  if (s.includes('cool')) return 'cool';
  if (s.includes('warm')) return 'warm';
  if (s.includes('none') || s.includes('no flame')) return 'none';
  if (s.includes('hot')) return 'hot';
  return null;
}

/**
 * Generates SchemaRegistryEntry objects from raw tabular rows + filename.
 */
export function inspectTabularRows(
  filename: string,
  fileType: 'csv' | 'xlsx' | 'baseline',
  rows: Record<string, unknown>[],
  sheetName?: string,
  psiIndex: PSIIndexEntry[] = []
): {
  schemaEntry: SchemaRegistryEntry;
  records: UnifiedRecord[];
  unitConversions: Array<{ source_file: string; column: string; from_unit: string; to_unit: string; rule: string }>;
} {
  if (!rows.length) {
    return {
      schemaEntry: {
        filename,
        file_type: fileType,
        sheet_name: sheetName,
        row_count: 0,
        status: 'failed',
        failure_reason: 'Sheet or CSV contained zero data rows.',
        headers: [],
        unit_conversions: [],
        ingested_at: new Date().toISOString(),
      },
      records: [],
      unitConversions: [],
    };
  }

  const headerKeys = Array.from(
    rows.reduce((set, r) => {
      Object.keys(r).forEach((k) => set.add(k));
      return set;
    }, new Set<string>())
  );

  const columnStats: ColumnSchemaInfo[] = [];
  const mappings: Record<string, DiscoveredColumnMapping> = {};
  const unitConversions: Array<{ source_file: string; column: string; from_unit: string; to_unit: string; rule: string }> = [];

  for (const key of headerKeys) {
    const values = rows.map((r) => r[key]);
    const nonNull = values.filter((v) => v !== null && v !== undefined && String(v).trim() !== '');
    const numericValues = nonNull
      .map((v) => toFiniteNumber(v))
      .filter((n): n is number => n !== null);

    const mapping = discoverColumnMapping(key, numericValues);
    mappings[key] = mapping;

    const isNumeric = numericValues.length > 0 && numericValues.length === nonNull.length;
    const dataType =
      nonNull.length === 0 ? 'empty' : isNumeric ? 'number' : numericValues.length > 0 ? 'mixed' : 'string';

    columnStats.push({
      header: key,
      inferred_canonical_field: mapping.canonical,
      detected_unit: mapping.detectedUnit,
      conversion_applied: mapping.conversionRule,
      data_type: dataType,
      non_null_count: nonNull.length,
      min: numericValues.length ? Math.min(...numericValues) : null,
      max: numericValues.length ? Math.max(...numericValues) : null,
      sample_values: nonNull.slice(0, 3).map((v) => String(v)),
    });

    if (
      mapping.canonical !== 'unmapped' &&
      !mapping.conversionRule.startsWith('identity') &&
      mapping.conversionRule !== 'none'
    ) {
      unitConversions.push({
        source_file: filename,
        column: key,
        from_unit: mapping.detectedUnit,
        to_unit: mapping.canonical,
        rule: mapping.conversionRule,
      });
    }
  }

  // Infer experiment metadata from filename if columns are absent
  const matchedIndex = psiIndex.find(
    (p) =>
      filename.toLowerCase().includes(p.short_name.toLowerCase().replace(/\s+/g, '')) ||
      filename.toLowerCase().includes(p.psi_id.toLowerCase().replace(/\s+/g, '')) ||
      p.source_filename.toLowerCase() === filename.toLowerCase()
  );

  const records: UnifiedRecord[] = rows.map((row, idx) => {
    const base: UnifiedRecord = {
      id: `${filename}-${sheetName ?? 'sheet'}-${idx + 1}`,
      experiment_id: matchedIndex?.psi_id ?? 'UPLOADED',
      experiment_name: matchedIndex?.short_name ?? filename.replace(/\.[^.]+$/, ''),
      platform: matchedIndex?.platform ?? 'ISS',
      fuel_or_material: 'unspecified',
      fuel_phase: matchedIndex && matchedIndex.fuel_phase !== 'N/A' ? matchedIndex.fuel_phase : 'solid',
      geometry: null,
      characteristic_size_mm: null,
      O2_mole_fraction: null,
      total_pressure_kPa: null,
      diluent_type: 'N2',
      diluent_fraction: null,
      gravity_level_g: null,
      ambient_flow_velocity_cm_s: null,
      ignition_energy_or_method: null,
      observed_outcome: null,
      flame_regime: null,
      extinction_diameter_mm: null,
      burn_rate_or_spread_rate: null,
      peak_temperature_K: null,
      flame_standoff_ratio: null,
      source_file: filename,
      source_row: idx + 1,
      doi_link: matchedIndex?.doi_url ?? null,
    };

    for (const key of headerKeys) {
      const m = mappings[key];
      if (!m || m.canonical === 'unmapped') continue;
      const val = m.transform(row[key], []);
      if (val !== null && val !== undefined && val !== '') {
        (base as unknown as Record<string, unknown>)[m.canonical] = val;
      }
    }

    // Derive diluent_fraction if O2_mole_fraction is present and diluent_fraction is null
    if (base.O2_mole_fraction !== null && base.diluent_fraction === null && base.diluent_type !== 'None') {
      base.diluent_fraction = Number(Math.max(0, 1 - base.O2_mole_fraction).toFixed(4));
    }

    return base;
  });

  const mappedCount = columnStats.filter((c) => c.inferred_canonical_field !== 'unmapped').length;

  return {
    schemaEntry: {
      filename,
      file_type: fileType,
      sheet_name: sheetName,
      row_count: rows.length,
      status: mappedCount > 0 ? 'parsed' : 'partial',
      failure_reason:
        mappedCount === 0
          ? 'Headers did not match canonical combustion parameters; columns logged in schema registry.'
          : undefined,
      headers: columnStats,
      unit_conversions: unitConversions.map((u) => `${u.column}: ${u.from_unit} -> ${u.to_unit}`),
      ingested_at: new Date().toISOString(),
    },
    records,
    unitConversions,
  };
}

/**
 * Computes field completeness and per-experiment completeness across all 22 canonical fields.
 */
export function buildIngestionReport(
  records: UnifiedRecord[],
  passages: KnowledgePassage[],
  schemaEntries: SchemaRegistryEntry[],
  unitConversions: Array<{ source_file: string; column: string; from_unit: string; to_unit: string; rule: string }>
): IngestionReport {
  const fieldCompleteness = {} as Record<CanonicalField, number>;
  const total = records.length || 1;

  for (const field of CANONICAL_FIELDS) {
    const present = records.filter((r) => {
      const val = r[field];
      return val !== null && val !== undefined && val !== '';
    }).length;
    fieldCompleteness[field] = Number(((present / total) * 100).toFixed(1));
  }

  const byExp = new Map<string, UnifiedRecord[]>();
  for (const rec of records) {
    const key = `${rec.experiment_id}::${rec.experiment_name}`;
    const arr = byExp.get(key) ?? [];
    arr.push(rec);
    byExp.set(key, arr);
  }

  const experimentCompleteness = Array.from(byExp.entries()).map(([key, rows]) => {
    const [experiment_id, experiment_name] = key.split('::');
    const fields = {} as Record<CanonicalField, number>;
    for (const field of CANONICAL_FIELDS) {
      const present = rows.filter((r) => {
        const val = r[field];
        return val !== null && val !== undefined && val !== '';
      }).length;
      fields[field] = Number(((present / rows.length) * 100).toFixed(0));
    }
    return {
      experiment_id,
      experiment_name,
      row_count: rows.length,
      fields,
    };
  });

  const failedFiles = schemaEntries
    .filter((f) => f.status === 'failed')
    .map((f) => ({
      filename: f.filename,
      file_type: f.file_type,
      reason: f.failure_reason ?? 'Unknown parsing error',
    }));

  return {
    generated_at: new Date().toISOString(),
    files: schemaEntries,
    total_records: records.length,
    total_passages: passages.length,
    field_completeness: fieldCompleteness,
    experiment_completeness: experimentCompleteness,
    unit_conversions_log: unitConversions,
    failed_files: failedFiles,
  };
}

/**
 * Generates baseline SchemaRegistryEntry entries from the bundled harmonized dataset
 * and PSI master index so the Data Ingestion Report reflects all 24 PSI records + BASS/BASS-II.
 */
export function buildBaselineSchemaRegistry(
  records: UnifiedRecord[],
  psiIndex: PSIIndexEntry[]
): {
  entries: SchemaRegistryEntry[];
  unitConversions: Array<{ source_file: string; column: string; from_unit: string; to_unit: string; rule: string }>;
} {
  const byFile = new Map<string, UnifiedRecord[]>();
  for (const r of records) {
    const arr = byFile.get(r.source_file) ?? [];
    arr.push(r);
    byFile.set(r.source_file, arr);
  }

  const entries: SchemaRegistryEntry[] = [];
  const unitConversions: Array<{ source_file: string; column: string; from_unit: string; to_unit: string; rule: string }> = [];

  for (const [filename, rows] of byFile.entries()) {
    const plainRows = rows.map((r) => ({ ...r })) as unknown as Record<string, unknown>[];
    const inspected = inspectTabularRows(filename, 'baseline', plainRows, 'canonical_si', psiIndex);
    entries.push(inspected.schemaEntry);
  }

  // Explicitly track non-combustion PSI index entries (never silently dropped)
  for (const idx of psiIndex) {
    if (idx.category === 'non_combustion_reference' && !byFile.has(idx.source_filename)) {
      entries.push({
        filename: idx.source_filename,
        file_type: 'baseline',
        row_count: 0,
        status: 'indexed_only',
        failure_reason: 'Non-combustion PSI entry (solders / thermocapillary fluids); retained in master PSI index.',
        headers: [],
        unit_conversions: [],
        ingested_at: new Date().toISOString(),
      });
    }
  }

  // Document standard PSI unit normalizations performed during baseline harmonization
  unitConversions.push(
    {
      source_file: 'FLEX_ISS_Droplet_Combustion_Data.csv',
      column: 'O2_pct',
      from_unit: '% vol',
      to_unit: 'O2_mole_fraction',
      rule: 'divide by 100 (% -> mole fraction)',
    },
    {
      source_file: 'FLEX2_Droplet_Extinction_Dataset.csv',
      column: 'P_atm',
      from_unit: 'atm',
      to_unit: 'total_pressure_kPa',
      rule: 'multiply by 101.325 (atm -> kPa)',
    },
    {
      source_file: 'ACME_BRE_Flammability_Limits.csv',
      column: 'P_psi',
      from_unit: 'psi',
      to_unit: 'total_pressure_kPa',
      rule: 'multiply by 6.89476 (psi -> kPa)',
    },
    {
      source_file: 'SAFFIRE_I_LargeScale_Telemetry.csv',
      column: 'duct_flow_mm_s',
      from_unit: 'mm/s',
      to_unit: 'ambient_flow_velocity_cm_s',
      rule: 'divide by 10 (mm/s -> cm/s)',
    },
    {
      source_file: 'BASS_BASS2_Solid_Flammability.csv',
      column: 'gravity_m_s2',
      from_unit: 'm/s^2',
      to_unit: 'gravity_level_g',
      rule: 'divide by 9.80665 (m/s^2 -> g)',
    }
  );

  return { entries, unitConversions };
}

/**
 * Browser-side multi-format file parser (CSV, XLSX/XLS, PDF, DOCX/DOC, JSON).
 */
export async function ingestUploadedFile(
  file: File,
  psiIndex: PSIIndexEntry[]
): Promise<{
  schemaEntries: SchemaRegistryEntry[];
  records: UnifiedRecord[];
  passages: KnowledgePassage[];
  unitConversions: Array<{ source_file: string; column: string; from_unit: string; to_unit: string; rule: string }>;
}> {
  const name = file.name;
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  const now = new Date().toISOString();

  if (ext === 'csv' || ext === 'xlsx' || ext === 'xls') {
    try {
      const buf = await file.arrayBuffer();
      const workbook = XLSX.read(buf, { type: 'array' });
      const schemaEntries: SchemaRegistryEntry[] = [];
      const allRecords: UnifiedRecord[] = [];
      const allConversions: Array<{ source_file: string; column: string; from_unit: string; to_unit: string; rule: string }> = [];

      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });
        const inspected = inspectTabularRows(
          name,
          ext === 'csv' ? 'csv' : 'xlsx',
          rows,
          workbook.SheetNames.length > 1 ? sheetName : undefined,
          psiIndex
        );
        schemaEntries.push(inspected.schemaEntry);
        allRecords.push(...inspected.records);
        allConversions.push(...inspected.unitConversions);
      }

      return {
        schemaEntries,
        records: allRecords,
        passages: [],
        unitConversions: allConversions,
      };
    } catch (err) {
      return {
        schemaEntries: [
          {
            filename: name,
            file_type: ext === 'csv' ? 'csv' : 'xlsx',
            row_count: 0,
            status: 'failed',
            failure_reason: err instanceof Error ? err.message : 'Failed to parse spreadsheet/CSV',
            headers: [],
            unit_conversions: [],
            ingested_at: now,
          },
        ],
        records: [],
        passages: [],
        unitConversions: [],
      };
    }
  }

  if (ext === 'pdf') {
    try {
      const pdfjs = await import('pdfjs-dist');
      const workerModule = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
      pdfjs.GlobalWorkerOptions.workerSrc = workerModule.default;

      const buf = await file.arrayBuffer();
      const doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
      const passages: KnowledgePassage[] = [];
      const matchedExp = matchExperimentFromText(name, psiIndex);

      for (let p = 1; p <= doc.numPages; p++) {
        const page = await doc.getPage(p);
        const content = await page.getTextContent();
        const text = content.items
          .map((item) => ('str' in item ? item.str : ''))
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();

        if (text.length > 40) {
          const exp = matchedExp ?? matchExperimentFromText(text, psiIndex);
          passages.push({
            id: `pdf-${name}-p${p}-${Date.now()}`,
            experiment_id: exp?.psi_id ?? 'USER-PDF',
            experiment_name: exp?.short_name ?? name.replace(/\.pdf$/i, ''),
            title: `${name} — Page ${p}`,
            source_file: name,
            page_or_section: `Page ${p} of ${doc.numPages}`,
            text: text.slice(0, 1200),
            tags: extractTags(text),
            doi_url: exp?.doi_url,
          });
        }
      }

      return {
        schemaEntries: [
          {
            filename: name,
            file_type: 'pdf',
            row_count: passages.length,
            status: passages.length > 0 ? 'parsed' : 'failed',
            failure_reason:
              passages.length === 0 ? 'PDF contained no extractable text (likely scanned image without OCR).' : undefined,
            headers: [],
            unit_conversions: [],
            ingested_at: now,
          },
        ],
        records: [],
        passages,
        unitConversions: [],
      };
    } catch (err) {
      return {
        schemaEntries: [
          {
            filename: name,
            file_type: 'pdf',
            row_count: 0,
            status: 'failed',
            failure_reason: err instanceof Error ? err.message : 'PDF parsing failed',
            headers: [],
            unit_conversions: [],
            ingested_at: now,
          },
        ],
        records: [],
        passages: [],
        unitConversions: [],
      };
    }
  }

  if (ext === 'docx' || ext === 'doc') {
    if (ext === 'doc') {
      return {
        schemaEntries: [
          {
            filename: name,
            file_type: 'doc',
            row_count: 0,
            status: 'failed',
            failure_reason:
              'Legacy binary .doc (OLE2 Compound Document) is unsupported in browser parsing; convert to .docx or PDF.',
            headers: [],
            unit_conversions: [],
            ingested_at: now,
          },
        ],
        records: [],
        passages: [],
        unitConversions: [],
      };
    }

    try {
      const mammoth = await import('mammoth');
      const buf = await file.arrayBuffer();
      const res = await mammoth.extractRawText({ arrayBuffer: buf });
      const paragraphs = res.value
        .split(/\n{2,}/)
        .map((p) => p.trim())
        .filter((p) => p.length > 40);

      const passages: KnowledgePassage[] = paragraphs.slice(0, 40).map((text, idx) => {
        const exp = matchExperimentFromText(`${name} ${text}`, psiIndex);
        return {
          id: `docx-${name}-${idx}-${Date.now()}`,
          experiment_id: exp?.psi_id ?? 'USER-DOCX',
          experiment_name: exp?.short_name ?? name.replace(/\.docx$/i, ''),
          title: `${name} — Excerpt ${idx + 1}`,
          source_file: name,
          page_or_section: `Section ${idx + 1}`,
          text: text.slice(0, 1200),
          tags: extractTags(text),
          doi_url: exp?.doi_url,
        };
      });

      return {
        schemaEntries: [
          {
            filename: name,
            file_type: 'docx',
            row_count: passages.length,
            status: passages.length > 0 ? 'parsed' : 'failed',
            failure_reason: passages.length === 0 ? 'DOCX file contained no extractable body paragraphs.' : undefined,
            headers: [],
            unit_conversions: [],
            ingested_at: now,
          },
        ],
        records: [],
        passages,
        unitConversions: [],
      };
    } catch (err) {
      return {
        schemaEntries: [
          {
            filename: name,
            file_type: 'docx',
            row_count: 0,
            status: 'failed',
            failure_reason: err instanceof Error ? err.message : 'DOCX extraction failed',
            headers: [],
            unit_conversions: [],
            ingested_at: now,
          },
        ],
        records: [],
        passages: [],
        unitConversions: [],
      };
    }
  }

  return {
    schemaEntries: [
      {
        filename: name,
        file_type: 'json',
        row_count: 0,
        status: 'failed',
        failure_reason: `Unsupported file extension ".${ext}". Supported formats: CSV, XLSX, XLS, PDF, DOCX.`,
        headers: [],
        unit_conversions: [],
        ingested_at: now,
      },
    ],
    records: [],
    passages: [],
    unitConversions: [],
  };
}

function matchExperimentFromText(text: string, psiIndex: PSIIndexEntry[]): PSIIndexEntry | undefined {
  const lower = text.toLowerCase();
  return psiIndex.find(
    (p) =>
      lower.includes(p.short_name.toLowerCase()) ||
      lower.includes(p.psi_id.toLowerCase())
  );
}

function extractTags(text: string): string[] {
  const keywords = [
    'cool flame',
    'extinction',
    'microgravity',
    'oxygen',
    'pressure',
    'helium',
    'co2',
    'droplet',
    'heptane',
    'dodecane',
    'pmma',
    'nomex',
    'cotton',
    'sibal',
    'soot',
    'smoke',
    'loi',
    'radiative',
  ];
  const lower = text.toLowerCase();
  return keywords.filter((k) => lower.includes(k)).slice(0, 6);
}
