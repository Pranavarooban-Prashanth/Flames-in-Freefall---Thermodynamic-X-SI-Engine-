import { useEffect, useMemo, useState } from 'react';
import { BookOpen } from 'lucide-react';
import { BASELINE_UNIFIED_DATASET } from './data/baselineDataset';
import { BASELINE_KNOWLEDGE_BASE } from './data/knowledgeBase';
import { PSI_MASTER_INDEX } from './data/psiIndex';
import {
  buildBaselineSchemaRegistry,
  buildIngestionReport,
} from './engine/ingestion';
import {
  DEFAULT_SCORING_WEIGHTS,
  HABITAT_PRESETS,
  runInference,
} from './engine/inference';
import {
  CustomIngestedStore,
  loadCustomIngestedData,
  loadSavedScenarios,
  persistCustomIngestedData,
  persistSavedScenarios,
  rerunSavedScenarios,
} from './engine/persistence';
import {
  InferenceInput,
  InferenceResult,
  SavedScenario,
  UnitSystem,
} from './types/combustion';
import { EnginePage } from './components/EnginePage';
import { SensorAgentPage } from './components/SensorAgentPage';
import { ExplorerPage } from './components/ExplorerPage';
import { DatasetsPage } from './components/DatasetsPage';
import { HistoryPage } from './components/HistoryPage';
import { ExecutiveSummaryPage } from './components/ExecutiveSummaryPage';
import { CreditsPage } from './components/CreditsPage';
import { HowItWorksModal } from './components/HowItWorksModal';

type PageTab = 'engine' | 'agent' | 'explorer' | 'datasets' | 'history' | 'summary' | 'credits';

const NAV_ITEMS: Array<{ id: PageTab; label: string }> = [
  { id: 'engine', label: 'SI Engine' },
  { id: 'agent', label: 'Sensor Agent' },
  { id: 'explorer', label: 'Explorer' },
  { id: 'datasets', label: 'Datasets' },
  { id: 'history', label: 'History' },
  { id: 'summary', label: 'Summary' },
  { id: 'credits', label: 'Credits' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<PageTab>('engine');
  const [unitSystem, setUnitSystem] = useState<UnitSystem>('metric');
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);
  const [savedBanner, setSavedBanner] = useState<string | null>(null);

  const [customData, setCustomData] = useState<CustomIngestedStore>(() =>
    loadCustomIngestedData()
  );

  const [input, setInput] = useState<InferenceInput>(() => ({
    ...HABITAT_PRESETS[0].input,
    weights: { ...DEFAULT_SCORING_WEIGHTS },
  }));

  const [scenarios, setScenarios] = useState<SavedScenario[]>(() =>
    loadSavedScenarios()
  );

  const unifiedDataset = useMemo(
    () => [...BASELINE_UNIFIED_DATASET, ...customData.records],
    [customData.records]
  );

  const knowledgeBase = useMemo(
    () => [...BASELINE_KNOWLEDGE_BASE, ...customData.passages],
    [customData.passages]
  );

  const baselineRegistry = useMemo(
    () => buildBaselineSchemaRegistry(BASELINE_UNIFIED_DATASET, PSI_MASTER_INDEX),
    []
  );

  const allSchemaEntries = useMemo(
    () => [...baselineRegistry.entries, ...customData.schemaEntries],
    [baselineRegistry.entries, customData.schemaEntries]
  );

  const allUnitConversions = useMemo(
    () => [...baselineRegistry.unitConversions, ...customData.unitConversions],
    [baselineRegistry.unitConversions, customData.unitConversions]
  );

  const ingestionReport = useMemo(
    () =>
      buildIngestionReport(
        unifiedDataset,
        knowledgeBase,
        allSchemaEntries,
        allUnitConversions
      ),
    [unifiedDataset, knowledgeBase, allSchemaEntries, allUnitConversions]
  );

  const result = useMemo(
    () => runInference(input, unifiedDataset, knowledgeBase),
    [input, unifiedDataset, knowledgeBase]
  );

  useEffect(() => {
    persistSavedScenarios(scenarios);
  }, [scenarios]);

  useEffect(() => {
    persistCustomIngestedData(customData);
  }, [customData]);

  const handleSaveScenario = (narrative?: string, narrativeModel?: string) => {
    const now = new Date().toISOString();
    const newScenario: SavedScenario = {
      id: `sc-${Date.now()}`,
      name: input.missionName.trim() || `Scenario ${scenarios.length + 1}`,
      createdAt: now,
      updatedAt: now,
      input: { ...input },
      result,
      narrative,
      narrativeModel,
    };
    setScenarios((prev) => [newScenario, ...prev]);
    setSavedBanner(`Saved "${newScenario.name}" (${result.fireSafetyIndex}/100) to History.`);
    setTimeout(() => setSavedBanner(null), 4000);
  };

  const handleSaveAgentScenario = (
    agentInput: InferenceInput,
    agentResult: InferenceResult,
    narrative: string,
    narrativeModel?: string
  ) => {
    const now = new Date().toISOString();
    const newScenario: SavedScenario = {
      id: `sc-agent-${Date.now()}`,
      name: agentInput.missionName.trim() || `Sensor Agent Run`,
      createdAt: now,
      updatedAt: now,
      input: agentInput,
      result: agentResult,
      narrative,
      narrativeModel,
    };
    setScenarios((prev) => [newScenario, ...prev]);
  };

  const handleIngestComplete = (payload: CustomIngestedStore) => {
    const nextCustom: CustomIngestedStore = {
      records: [...customData.records, ...payload.records],
      passages: [...customData.passages, ...payload.passages],
      schemaEntries: [...customData.schemaEntries, ...payload.schemaEntries],
      unitConversions: [...customData.unitConversions, ...payload.unitConversions],
    };
    setCustomData(nextCustom);

    const nextDataset = [...BASELINE_UNIFIED_DATASET, ...nextCustom.records];
    const nextKb = [...BASELINE_KNOWLEDGE_BASE, ...nextCustom.passages];
    setScenarios((prev) => rerunSavedScenarios(prev, nextDataset, nextKb));
  };

  const handleResetCustomData = () => {
    const empty: CustomIngestedStore = {
      records: [],
      passages: [],
      schemaEntries: [],
      unitConversions: [],
    };
    setCustomData(empty);
    setScenarios((prev) =>
      rerunSavedScenarios(prev, BASELINE_UNIFIED_DATASET, BASELINE_KNOWLEDGE_BASE)
    );
  };

  return (
    <div className="min-h-screen bg-[#07090E] text-slate-100 flex flex-col">
      {/* Top Bar Contract: 3 clean zones separated by gap-8 */}
      <header className="border-b border-slate-800 bg-[#07090E]/95 sticky top-0 z-40">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line brand title */}
          <a
            href="#engine"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('engine');
            }}
            className="text-base sm:text-lg font-display font-bold tracking-tight text-slate-100 whitespace-nowrap shrink-0"
          >
            SI Engine: Extraterrestrial Fire Safety
          </a>

          {/* Zone 2: Concise single-line nav links */}
          <nav className="hidden md:flex items-center gap-5 overflow-x-auto" aria-label="Primary navigation">
            {NAV_ITEMS.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`text-xs font-medium py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'border-cyan-400 text-cyan-300'
                      : 'border-transparent text-slate-400 hover:text-slate-100'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: 1 primary action */}
          <div className="flex items-center shrink-0">
            <button
              onClick={() => setHowItWorksOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium bg-[#0D111A] border border-slate-700 hover:border-cyan-500 text-slate-100 rounded transition-colors whitespace-nowrap shrink-0"
            >
              <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
              How It Works
            </button>
          </div>
        </div>

        {/* Mobile Nav Strip */}
        <div className="md:hidden border-t border-slate-800/80 px-4 py-2 flex items-center gap-4 overflow-x-auto">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`text-xs font-medium whitespace-nowrap shrink-0 ${
                activeTab === item.id ? 'text-cyan-300' : 'text-slate-400'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-5">
        {activeTab === 'engine' && (
          <EnginePage
            input={input}
            onChangeInput={setInput}
            result={result}
            unitSystem={unitSystem}
            onChangeUnitSystem={setUnitSystem}
            onSaveScenario={handleSaveScenario}
            savedBanner={savedBanner}
          />
        )}

        {activeTab === 'agent' && (
          <SensorAgentPage
            customRecords={customData.records}
            customPassages={customData.passages}
            unitSystem={unitSystem}
            onLoadIntoEngine={(agentInput) => {
              setInput({ ...agentInput, weights: input.weights });
              setActiveTab('engine');
            }}
            onSaveAgentScenario={handleSaveAgentScenario}
          />
        )}

        {activeTab === 'explorer' && (
          <ExplorerPage
            dataset={unifiedDataset}
            queryInput={input}
            queryResult={result}
            unitSystem={unitSystem}
          />
        )}

        {activeTab === 'datasets' && (
          <DatasetsPage
            dataset={unifiedDataset}
            psiIndex={PSI_MASTER_INDEX}
            report={ingestionReport}
            unitSystem={unitSystem}
            customFileCount={customData.schemaEntries.length}
            onIngestComplete={handleIngestComplete}
            onResetCustomData={handleResetCustomData}
          />
        )}

        {activeTab === 'history' && (
          <HistoryPage
            scenarios={scenarios}
            unitSystem={unitSystem}
            onLoadScenario={(s) => {
              setInput(s.input);
              setActiveTab('engine');
            }}
            onRenameScenario={(id, newName) =>
              setScenarios((prev) =>
                prev.map((s) =>
                  s.id === id ? { ...s, name: newName, updatedAt: new Date().toISOString() } : s
                )
              )
            }
            onDeleteScenario={(id) =>
              setScenarios((prev) => prev.filter((s) => s.id !== id))
            }
          />
        )}

        {activeTab === 'summary' && <ExecutiveSummaryPage />}

        {activeTab === 'credits' && (
          <CreditsPage
            psiIndex={PSI_MASTER_INDEX}
            dataset={unifiedDataset}
            schemaEntries={allSchemaEntries}
          />
        )}
      </main>

      <HowItWorksModal
        open={howItWorksOpen}
        onClose={() => setHowItWorksOpen(false)}
      />
    </div>
  );
}
