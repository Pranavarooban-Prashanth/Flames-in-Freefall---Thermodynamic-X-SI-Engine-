import React from 'react';
import { ExternalLink } from 'lucide-react';
import { PSIIndexEntry, SchemaRegistryEntry, UnifiedRecord } from '../types/combustion';

interface CreditsPageProps {
  psiIndex: PSIIndexEntry[];
  dataset: UnifiedRecord[];
  schemaEntries: SchemaRegistryEntry[];
}

export const CreditsPage: React.FC<CreditsPageProps> = ({
  psiIndex,
  dataset,
  schemaEntries,
}) => {
  // Build dynamic list of experiments loaded in the dataset + indexed PSI entries
  const loadedExperimentRows = psiIndex.map((entry) => {
    const matchingRows = dataset.filter(
      (r) => r.experiment_id === entry.psi_id || r.source_file === entry.source_filename
    );
    const schema = schemaEntries.find((s) => s.filename === entry.source_filename);
    return {
      entry,
      rowCount: matchingRows.length,
      sourceFile: schema?.filename ?? entry.source_filename,
      status: schema?.status ?? (matchingRows.length > 0 ? 'parsed' : 'indexed_only'),
    };
  });

  // Also include any user-uploaded files not already in psiIndex
  const knownFiles = new Set(psiIndex.map((p) => p.source_filename));
  const extraUploads = schemaEntries.filter((s) => !knownFiles.has(s.filename));

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Part 1: Dataset Credit */}
      <section className="bg-[#0D111A] border border-slate-800 p-6 sm:p-8 space-y-4">
        <div className="border-b border-slate-800 pb-3">
          <p className="text-xs font-mono text-cyan-400 uppercase tracking-wider">Part 1</p>
          <h1 className="text-xl font-display font-semibold text-slate-100 mt-0.5">
            Dataset Credit & NASA PSI Investigation Provenance
          </h1>
          <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
            Data courtesy of the NASA Physical Sciences Informatics (PSI) repository (NASA Physical Sciences Research
            Program), the Princeton University combustion group data summary, and the University of South Carolina
            cool-flame presentations (T. Farouk and collaborators) and associated dissertations.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-mono">
                <th className="py-2 pr-3">ID</th>
                <th className="py-2 pr-3">Experiment & Investigators</th>
                <th className="py-2 pr-3">Source Filename</th>
                <th className="py-2 pr-3">Rows</th>
                <th className="py-2">PSI DOI / Index Link</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {loadedExperimentRows.map(({ entry, rowCount, sourceFile, status }) => (
                <tr key={`${entry.psi_id}-${entry.short_name}`} className="hover:bg-slate-900/40">
                  <td className="py-2.5 pr-3 font-mono text-cyan-300 whitespace-nowrap align-top">
                    {entry.psi_id}
                  </td>
                  <td className="py-2.5 pr-3 align-top">
                    <div className="font-medium text-slate-100">{entry.full_title}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {entry.investigators} · {entry.version}
                    </div>
                  </td>
                  <td className="py-2.5 pr-3 font-mono text-[11px] text-slate-300 align-top">
                    {sourceFile}
                    <div className="text-slate-500">{status}</div>
                  </td>
                  <td className="py-2.5 pr-3 font-mono tabular-nums text-slate-200 align-top">
                    {rowCount}
                  </td>
                  <td className="py-2.5 align-top whitespace-nowrap">
                    <a
                      href={entry.doi_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-mono text-cyan-400 hover:underline"
                    >
                      {entry.doi_url.replace('http://doi.org/', 'doi:')}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </td>
                </tr>
              ))}
              {extraUploads.map((u, idx) => (
                <tr key={`extra-${u.filename}-${idx}`}>
                  <td className="py-2.5 pr-3 font-mono text-emerald-400">USER-INGEST</td>
                  <td className="py-2.5 pr-3 text-slate-100">User Uploaded Dataset ({u.file_type.toUpperCase()})</td>
                  <td className="py-2.5 pr-3 font-mono text-[11px] text-slate-300">{u.filename}</td>
                  <td className="py-2.5 pr-3 font-mono tabular-nums text-slate-200">{u.row_count}</td>
                  <td className="py-2.5 font-mono text-slate-500">Local upload</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-slate-400 border-t border-slate-800 pt-3">
          Original experimental data, reports, and dissertations remain the property of their respective investigators
          and NASA.
        </p>
      </section>

      {/* Part 2: Acknowledgements */}
      <section className="bg-[#0D111A] border border-slate-800 p-6 sm:p-8 space-y-3">
        <div className="border-b border-slate-800 pb-3">
          <p className="text-xs font-mono text-cyan-400 uppercase tracking-wider">Part 2</p>
          <h2 className="text-xl font-display font-semibold text-slate-100 mt-0.5">
            Acknowledgements & Operational Disclaimer
          </h2>
        </div>

        <ul className="space-y-2 text-sm text-slate-200 list-disc pl-5">
          <li>
            Claude (by Anthropic) was used to extract, organize and help synthesize the datasets and to design the
            engine specification.
          </li>
          <li>Google AI Studio was used to build the SI Engine application.</li>
        </ul>

        <div className="mt-4 p-4 bg-[#07090E] border border-slate-800 text-xs text-slate-300 leading-relaxed">
          <strong>Disclaimer:</strong> The SI Engine: Extraterrestrial Fire Safety application is a research
          decision-support tool developed for comparative combustion and mission-atmosphere exploration. It is{' '}
          <strong>not</strong> certified for operational spacecraft flight safety decisions or formal material
          qualification (e.g., NASA-STD-6001 certification).
        </div>
      </section>
    </div>
  );
};
