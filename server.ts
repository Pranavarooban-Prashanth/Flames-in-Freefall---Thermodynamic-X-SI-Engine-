import { Content, FunctionDeclaration, GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { BASELINE_UNIFIED_DATASET } from './src/data/baselineDataset';
import { BASELINE_KNOWLEDGE_BASE } from './src/data/knowledgeBase';
import { PSI_MASTER_INDEX } from './src/data/psiIndex';
import { runInference } from './src/engine/inference';
import {
  DiluentType,
  FuelPhase,
  InferenceInput,
  InferenceResult,
  KnowledgePassage,
  UnifiedRecord,
} from './src/types/combustion';

dotenv.config();

const PORT = 3000;

const evaluateSafetyTool: FunctionDeclaration = {
  name: 'evaluate_spacecraft_fire_safety',
  description:
    'Runs the NASA PSI Scientific Inference (SI) Engine on normalized physical sensor readings to compute a 0-100 Fire Safety Rating, risk tier, ignition/extinction probabilities, Limiting Oxygen Index (LOI), flame regime, and nearest historical space experiments.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      missionName: {
        type: Type.STRING,
        description: 'Mission, spacecraft module, or sensor zone identifier.',
      },
      o2Percent: {
        type: Type.NUMBER,
        description: 'Oxygen concentration in volume percent (0 to 100). Convert from ppO2/total pressure or mole fraction if needed.',
      },
      totalPressureKPa: {
        type: Type.NUMBER,
        description: 'Total cabin or chamber pressure in kPa (convert from psi * 6.89476 or atm * 101.325).',
      },
      gravityG: {
        type: Type.NUMBER,
        description: 'Gravity acceleration in Earth g (e.g., 0.0001 for ISS/orbital microgravity, 0.166 Moon, 0.38 Mars, 1.0 Earth). Convert from m/s^2 by dividing by 9.80665.',
      },
      diluentType: {
        type: Type.STRING,
        description: 'Dominant inert diluent gas: N2, CO2, He, Ar, Mixed, or None.',
      },
      diluentFraction: {
        type: Type.NUMBER,
        description: 'Mole fraction of diluent gas (0 to 1). Typically 1 - o2Percent/100.',
      },
      ambientFlowCmS: {
        type: Type.NUMBER,
        description: 'Ventilation or ambient gas flow speed in cm/s (convert from m/s * 100, mm/s / 10, or ft/min * 0.508).',
      },
      fuelMaterial: {
        type: Type.STRING,
        description: 'Exposed combustible fuel or material (e.g., PMMA, SIBAL cotton-fiberglass, Nomex, Kapton wire insulation, cellulose / paper, n-heptane, n-dodecane, methane, ethylene, dimethyl ether, hydrogen).',
      },
      fuelPhase: {
        type: Type.STRING,
        description: 'Physical phase of the fuel hazard: solid, liquid droplet, or gas.',
      },
      characteristicSizeMm: {
        type: Type.NUMBER,
        description: 'Characteristic sample thickness/width or droplet/nozzle diameter in mm.',
      },
      ignitionEnergyMj: {
        type: Type.NUMBER,
        description: 'Estimated electrical arc, short-circuit, hot-surface, or heater ignition energy in mJ (default ~250 if unspecified).',
      },
    },
    required: [
      'missionName',
      'o2Percent',
      'totalPressureKPa',
      'gravityG',
      'diluentType',
      'ambientFlowCmS',
      'fuelMaterial',
      'fuelPhase',
    ],
  },
};

const searchKnowledgeTool: FunctionDeclaration = {
  name: 'search_psi_knowledge_base',
  description:
    'Searches NASA PSI final reports, dissertations, and experiment summaries for sensor signatures such as smoke aerosol coagulation, non-luminous cool flames, wire pyrolysis, or ventilation effects.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      keywords: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: 'Keywords from the physical sensor anomaly (e.g., ["Kapton", "smoke", "cool flame", "ventilation"]).',
      },
    },
    required: ['keywords'],
  },
};

function sanitizeDiluent(val: unknown): DiluentType {
  const s = String(val ?? 'N2').toUpperCase();
  if (s.includes('CO2')) return 'CO2';
  if (s === 'HE' || s.includes('HELIUM')) return 'He';
  if (s === 'AR' || s.includes('ARGON')) return 'Ar';
  if (s.includes('MIX')) return 'Mixed';
  if (s.includes('NONE') || s.includes('PURE')) return 'None';
  return 'N2';
}

function sanitizeFuelPhase(val: unknown): FuelPhase {
  const s = String(val ?? 'solid').toLowerCase();
  if (s.includes('droplet') || s.includes('liquid')) return 'liquid droplet';
  if (s.includes('gas') || s.includes('vapor')) return 'gas';
  return 'solid';
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '6mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'si-engine-api' });
  });

  app.get('/api/schema-registry', (_req, res) => {
    try {
      const regPath = path.resolve(process.cwd(), 'schema_registry.json');
      if (!fs.existsSync(regPath)) {
        res.status(404).json({ error: 'schema_registry.json has not been generated yet.' });
        return;
      }
      const raw = fs.readFileSync(regPath, 'utf-8');
      res.type('application/json').send(raw);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to read schema registry.' });
    }
  });

  app.post('/api/narrative', async (req, res) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      res.status(503).json({
        error:
          'GEMINI_API_KEY is not configured in environment secrets. Configure it in Settings > Secrets to enable AI narrative synthesis.',
      });
      return;
    }

    const { payload } = req.body ?? {};
    if (!payload) {
      res.status(400).json({ error: 'Missing structured inference payload.' });
      return;
    }

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const systemInstruction = `You are a spacecraft combustion and fire-safety scientist interpreting results from the SI Engine.
STRICT GROUNDING RULES:
1. Only reference and explain numbers, ranges, Fire Safety Index values, sub-scores, LOI estimates, flame regimes, extrapolation warnings, experiment IDs, and report passages explicitly present in the provided JSON payload.
2. NEVER invent measurements, experiments, DOIs, or temperatures not in the JSON.
3. Structure your assessment concisely into four plain-text markdown sections (under 320 words total):
   - **Assessment Summary**: State the Fire Safety Index, risk tier, likely flame regime, and whether an Extrapolation Warning applies.
   - **Physical Drivers**: Explain how the entered gravity, O2 concentration, pressure, diluent, and flow velocity drive ignition, spread relative to 1-g, or cool-flame (~1200 K radiative transition) risks.
   - **Supporting NASA PSI Evidence**: Cite the top nearest-neighbor experiment IDs, similarity percentages, and relevant report passages.
   - **Actionable Engineering Recommendations**: Give 2–3 concrete mitigations tailored to the numbers (e.g. lowering O2 toward LOI, adjusting ventilation flow, CO2/He diluent substitution, or optical/aerosol monitoring for non-luminous cool flames).`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Generate a grounded spacecraft fire-safety assessment strictly from this computed inference JSON:\n\n${JSON.stringify(
          payload,
          null,
          2
        )}`,
        config: {
          systemInstruction,
        },
      });

      const narrative = response.text?.trim();
      if (!narrative) {
        res.status(502).json({ error: 'Gemini returned an empty narrative response.' });
        return;
      }

      res.json({
        narrative,
        model: 'gemini-4-hydrogen',
        generatedAt: new Date().toISOString(),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate narrative via Gemini API.';
      res.status(502).json({ error: message });
    }
  });

  app.post('/api/agent/analyze', async (req, res) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      res.status(503).json({
        error:
          'GEMINI_API_KEY is not configured in environment secrets. Configure it in Settings > Secrets to run the Space Mission Sensor Agent.',
      });
      return;
    }

    const { sensorInputText, customRecords = [], customPassages = [] } = req.body ?? {};
    if (!sensorInputText || !String(sensorInputText).trim()) {
      res.status(400).json({ error: 'Please provide spacecraft sensor telemetry or system readings to analyze.' });
      return;
    }

    const activeDataset: UnifiedRecord[] = [
      ...BASELINE_UNIFIED_DATASET,
      ...(Array.isArray(customRecords) ? (customRecords as UnifiedRecord[]) : []),
    ];
    const activeKnowledge: KnowledgePassage[] = [
      ...BASELINE_KNOWLEDGE_BASE,
      ...(Array.isArray(customPassages) ? (customPassages as KnowledgePassage[]) : []),
    ];

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const systemInstruction = `You are the SI Engine Mission Telemetry Safety Agent.
Your task:
1. Inspect raw spacecraft physical sensor readings and flight-system logs (ECLSS O2/ppO2 sensors, cabin pressure transducers, microgravity accelerometers, HVAC duct anemometers, gas chromatographs, smoke/aerosol detectors, thermocouples, and material/payload fault indicators).
2. Convert any non-SI sensor units accurately (e.g., psi -> kPa by *6.89476; atm -> kPa by *101.325; m/s^2 -> g by /9.80665; ft/min -> cm/s by *0.508; m/s -> cm/s by *100; ppO2/P_total -> o2Percent).
3. ALWAYS call the 'evaluate_spacecraft_fire_safety' tool with the normalized parameters so the real NASA PSI SI Engine computes the official 0-100 Fire Safety Rating, risk tier, LOI, regime, and nearest historical experiments. If multiple distinct zones or timestamps appear in the telemetry, evaluate each critical condition.
4. Also call 'search_psi_knowledge_base' if smoke, pyrolysis, wire overheating, cool flames, or detector anomalies are present in the sensor stream.
5. In your final response, NEVER invent numbers. State the exact SI Engine Fire Safety Rating (0-100), risk tier, sensor anomalies detected (e.g., low-flow flammability hazard, cool-flame invisibility below ~1200 K, hyperoxic elevation, smoke coagulation), supporting NASA PSI experiment IDs, and concrete spacecraft flight-controller actions.`;

      const contents: Content[] = [
        {
          role: 'user',
          parts: [
            {
              text: `Analyze the following spacecraft physical sensor & system telemetry against the NASA PSI datasets and compute a fire safety rating:\n\n${String(
                sensorInputText
              )}`,
            },
          ],
        },
      ];

      const toolTrace: Array<{
        toolName: string;
        args: Record<string, unknown>;
        summary: string;
      }> = [];
      const inferences: Array<{
        input: InferenceInput;
        result: InferenceResult;
      }> = [];

      let finalText = '';
      for (let step = 0; step < 4; step++) {
        const response = await ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents,
          config: {
            systemInstruction,
            tools: [{ functionDeclarations: [evaluateSafetyTool, searchKnowledgeTool] }],
          },
        });

        const candidateContent = response.candidates?.[0]?.content;
        const functionCalls = response.functionCalls;

        if (!functionCalls || functionCalls.length === 0) {
          finalText = (response.text ?? '').trim();
          break;
        }

        if (candidateContent) {
          contents.push(candidateContent);
        }

        const responseParts = functionCalls.map((fc) => {
          const args = (fc.args ?? {}) as Record<string, unknown>;

          if (fc.name === 'evaluate_spacecraft_fire_safety') {
            const o2Percent = Number(args.o2Percent ?? 21);
            const diluentType = sanitizeDiluent(args.diluentType);
            const normalizedInput: InferenceInput = {
              missionName: String(args.missionName ?? 'Mission Sensor Telemetry'),
              o2Percent: Number.isFinite(o2Percent) ? o2Percent : 21,
              totalPressureKPa: Number(args.totalPressureKPa ?? 101.3),
              gravityG: Number(args.gravityG ?? 0.0001),
              diluentType,
              diluentFraction:
                diluentType === 'None'
                  ? 0
                  : Number(args.diluentFraction ?? Math.max(0, 1 - (Number.isFinite(o2Percent) ? o2Percent : 21) / 100)),
              ambientFlowCmS: Number(args.ambientFlowCmS ?? 10),
              fuelMaterial: String(args.fuelMaterial ?? 'PMMA'),
              fuelPhase: sanitizeFuelPhase(args.fuelPhase),
              characteristicSizeMm: Number(args.characteristicSizeMm ?? 20),
              ignitionEnergyMj: Number(args.ignitionEnergyMj ?? 250),
            };

            const infResult = runInference(normalizedInput, activeDataset, activeKnowledge);
            inferences.push({ input: normalizedInput, result: infResult });
            toolTrace.push({
              toolName: fc.name,
              args: normalizedInput as unknown as Record<string, unknown>,
              summary: `Safety Index ${infResult.fireSafetyIndex}/100 (${infResult.riskTier}) · LOI ${infResult.predictions.limitingOxygenIndexPercent}% · Regime: ${infResult.predictions.likelyFlameRegime} · Confidence ${infResult.confidence}%`,
            });

            return {
              functionResponse: {
                id: fc.id,
                name: fc.name,
                response: {
                  fireSafetyIndex: infResult.fireSafetyIndex,
                  riskTier: infResult.riskTier,
                  confidence: infResult.confidence,
                  extrapolation: infResult.extrapolation,
                  subScores: infResult.subScores,
                  predictions: infResult.predictions,
                  nearestExperiments: infResult.nearestNeighbors.slice(0, 5).map((n) => ({
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
                },
              },
            };
          }

          // search_psi_knowledge_base
          const keywords = Array.isArray(args.keywords)
            ? args.keywords.map((k) => String(k).toLowerCase())
            : [];
          const matchedPassages = activeKnowledge
            .map((p) => {
              const hay = `${p.title} ${p.text} ${p.tags.join(' ')}`.toLowerCase();
              const hits = keywords.filter((kw) => hay.includes(kw)).length;
              return { p, hits };
            })
            .filter((x) => x.hits > 0)
            .sort((a, b) => b.hits - a.hits)
            .slice(0, 4)
            .map((x) => ({
              experiment_id: x.p.experiment_id,
              experiment_name: x.p.experiment_name,
              title: x.p.title,
              source_file: x.p.source_file,
              section: x.p.page_or_section,
              text: x.p.text,
              doi: x.p.doi_url,
            }));

          const matchedIndex = PSI_MASTER_INDEX.filter((idx) =>
            keywords.some((kw) => `${idx.short_name} ${idx.full_title} ${idx.description}`.toLowerCase().includes(kw))
          ).slice(0, 4);

          toolTrace.push({
            toolName: fc.name ?? 'search_psi_knowledge_base',
            args,
            summary: `Retrieved ${matchedPassages.length} report passage(s) and ${matchedIndex.length} PSI index entry(s).`,
          });

          return {
            functionResponse: {
              id: fc.id,
              name: fc.name ?? 'search_psi_knowledge_base',
              response: {
                passages: matchedPassages,
                psiEntries: matchedIndex.map((m) => ({
                  psi_id: m.psi_id,
                  short_name: m.short_name,
                  doi_url: m.doi_url,
                  description: m.description,
                })),
              },
            },
          };
        });

        contents.push({
          role: 'user',
          parts: responseParts,
        });
      }

      if (!finalText) {
        finalText = 'Sensor telemetry evaluated via SI Engine tools; review the computed safety ratings below.';
      }

      res.json({
        analysisText: finalText,
        toolTrace,
        inferences,
        model: 'gemini-4-hydrogen',
        analyzedAt: new Date().toISOString(),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sensor agent analysis failed.';
      res.status(502).json({ error: message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : undefined,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SI Engine server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
