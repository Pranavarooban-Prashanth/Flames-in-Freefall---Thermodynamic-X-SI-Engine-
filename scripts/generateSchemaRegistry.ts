import fs from 'fs';
import path from 'path';
import { BASELINE_UNIFIED_DATASET } from '../src/data/baselineDataset';
import { BASELINE_KNOWLEDGE_BASE } from '../src/data/knowledgeBase';
import { PSI_MASTER_INDEX } from '../src/data/psiIndex';
import { buildBaselineSchemaRegistry, buildIngestionReport } from '../src/engine/ingestion';

const { entries, unitConversions } = buildBaselineSchemaRegistry(BASELINE_UNIFIED_DATASET, PSI_MASTER_INDEX);
const report = buildIngestionReport(BASELINE_UNIFIED_DATASET, BASELINE_KNOWLEDGE_BASE, entries, unitConversions);

const output = {
  generated_at: report.generated_at,
  master_index_count: PSI_MASTER_INDEX.length,
  total_records: report.total_records,
  total_passages: report.total_passages,
  field_completeness_pct: report.field_completeness,
  unit_conversions_log: report.unit_conversions_log,
  files: entries,
};

fs.writeFileSync(path.resolve(process.cwd(), 'schema_registry.json'), JSON.stringify(output, null, 2));
console.log(`Generated schema_registry.json: ${entries.length} files, ${report.total_records} records, ${report.total_passages} passages.`);
