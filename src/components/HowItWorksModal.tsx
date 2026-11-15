import React from 'react';
import { X } from 'lucide-react';
import { DEFAULT_SCORING_WEIGHTS } from '../engine/inference';

interface HowItWorksModalProps {
  open: boolean;
  onClose: () => void;
}

export const HowItWorksModal: React.FC<HowItWorksModalProps> = ({ open, onClose }) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="how-it-works-title"
    >
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-[#0D111A] border border-slate-800 rounded-md text-slate-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div>
            <h2 id="how-it-works-title" className="text-lg font-display font-semibold text-slate-100">
              How the SI Engine Works
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Plain-language guide to the reasoning, datasets, safety rating, margins, and confidence calculation
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-100 rounded transition-colors"
            aria-label="Close How It Works window"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-6 text-sm leading-relaxed text-slate-300">
          {/* 1. Reasoning Behind the Analysis */}
          <section className="space-y-2">
            <h3 className="text-xs font-mono uppercase tracking-wider text-cyan-400">
              1. Why Space Fire Analysis Needs Its Own Reasoning
            </h3>
            <p>
              On Earth, gravity pulls cool, dense air downward and pushes hot exhaust gases upward. That natural draft
              stretches flames into a teardrop shape and sets standard Earth fire-safety thresholds. In space
              (microgravity on the ISS, or reduced gravity on the Moon at 0.166 g and Mars at 0.38 g), buoyancy
              disappears or weakens dramatically.
            </p>
            <p>
              Without buoyancy, flames behave in ways Earth tests miss: gentle cabin ventilation can keep fabrics and
              plastics burning at lower oxygen levels than on Earth (observed in <strong>BASS</strong> and{' '}
              <strong>SAFFIRE</strong>), while liquid fuel droplets can drop below ~1,200 K and continue burning
              invisibly as low-temperature <strong>cool flames</strong> (discovered in <strong>FLEX</strong> and{' '}
              <strong>CFI</strong>). Because no single experiment tested every possible spacecraft cabin, the SI Engine
              combines results from all of NASA&apos;s PSI combustion campaigns into one shared physical comparison.
            </p>
          </section>

          {/* 2. Which Data Drives Which Answer */}
          <section className="space-y-2 border-t border-slate-800 pt-5">
            <h3 className="text-xs font-mono uppercase tracking-wider text-cyan-400">
              2. How the SI Engine Uses the NASA PSI Datasets
            </h3>
            <p>
              When you enter cabin conditions (or feed live spacecraft sensor readings to the Sensor Agent), the engine
              first converts every value into matching physical units and searches the harmonized dataset in three steps:
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <strong>Step 1 — Match Historical Space Experiments:</strong> The engine scores how close your conditions
                are to each recorded test across six physical dimensions: oxygen concentration (30% importance), gravity
                level (18%), ambient pressure (15%), airflow velocity (14%), fuel/material type (13%), and inert gas
                diluent such as N₂, CO₂, or Helium (10%). The 8 closest experiments are shown as your supporting evidence.
              </li>
              <li>
                <strong>Step 2 — Fit a Local Physics-Guided Prediction:</strong> Giving greater weight to the most
                similar NASA runs, the engine estimates ignition probability, extinction likelihood, flame temperature,
                and burn/spread rate relative to a 1-g Earth baseline. Specific NASA campaigns anchor specific behaviors:
                <span className="block text-xs text-slate-400 mt-1">
                  · <strong>FLEX / FLEX-2 / CFI / PSI-117:</strong> Liquid droplet burn rates, radiative extinction, and
                  cool-flame extinction diameters.<br />
                  · <strong>ACME (BRE, Flame Design, CFI-G, s-Flame, CLD, E-FIELD):</strong> Gaseous limits, CO₂ and He
                  suppressant effects, and emulated solid flammability at reduced pressure.<br />
                  · <strong>BASS / BASS-II &amp; SAFFIRE I–III:</strong> Solid fabric/plastic flame spread in forced
                  spacecraft ventilation flows.<br />
                  · <strong>SAME / SAME-R / SPICE / SLICE / DAFT:</strong> Pyrolysis smoke aerosol shifts, soot limits,
                  and detector behavior.
                </span>
              </li>
              <li>
                <strong>Step 3 — Solve the Limiting Oxygen Index (LOI):</strong> The engine sweeps oxygen concentration
                from 8% to 55% under your exact pressure, gravity, airflow, and diluent to find the minimum oxygen
                percentage needed to keep a flame alive.
              </li>
            </ul>
          </section>

          {/* 3. How the Safety Rating & 6 Safety Margins Are Defined */}
          <section className="space-y-2.5 border-t border-slate-800 pt-5">
            <h3 className="text-xs font-mono uppercase tracking-wider text-cyan-400">
              3. How the 0–100 Fire Safety Rating &amp; Safety Margins Are Defined
            </h3>
            <p>
              Every safety margin is scored on a <strong>0 to 100</strong> scale where <strong>higher = safer</strong>{' '}
              (more margin before a hazardous fire can start or persist):
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              <div className="border border-slate-800 bg-[#07090E] p-3">
                <div className="font-semibold text-slate-100">
                  1. Ignition Margin ({(DEFAULT_SCORING_WEIGHTS.ignition * 100).toFixed(0)}% weight)
                </div>
                <p className="text-slate-400 mt-1">
                  Equal to <code>100 × (1 − ignition probability)</code>. High when ignition energy or oxygen is too low
                  for a spark or hot wire to start combustion.
                </p>
              </div>
              <div className="border border-slate-800 bg-[#07090E] p-3">
                <div className="font-semibold text-slate-100">
                  2. Sustainability Margin ({(DEFAULT_SCORING_WEIGHTS.sustainability * 100).toFixed(0)}% weight)
                </div>
                <p className="text-slate-400 mt-1">
                  Measures whether an ignited flame can survive rather than self-extinguish. Drops sharply when
                  sustained burning is likely.
                </p>
              </div>
              <div className="border border-slate-800 bg-[#07090E] p-3">
                <div className="font-semibold text-slate-100">
                  3. Spread / Burn Rate Margin ({(DEFAULT_SCORING_WEIGHTS.spread * 100).toFixed(0)}% weight)
                </div>
                <p className="text-slate-400 mt-1">
                  Decreases exponentially as predicted flame spread rate (mm/s) or droplet burn rate (mm²/s) accelerates.
                </p>
              </div>
              <div className="border border-slate-800 bg-[#07090E] p-3">
                <div className="font-semibold text-slate-100">
                  4. Extinction Margin ({(DEFAULT_SCORING_WEIGHTS.extinction * 100).toFixed(0)}% weight)
                </div>
                <p className="text-slate-400 mt-1">
                  Combines predicted self-extinction likelihood with how far your cabin O₂ sits below (safer) or above
                  (riskier) the estimated Limiting Oxygen Index.
                </p>
              </div>
              <div className="border border-slate-800 bg-[#07090E] p-3">
                <div className="font-semibold text-slate-100">
                  5. Cool-Flame Margin ({(DEFAULT_SCORING_WEIGHTS.coolFlame * 100).toFixed(0)}% weight)
                </div>
                <p className="text-slate-400 mt-1">
                  Equal to <code>100 × (1 − cool-flame risk)</code>. Flags hidden hazard when pressure, fuel type, and
                  low gravity favor invisible combustion below ~1,200 K.
                </p>
              </div>
              <div className="border border-slate-800 bg-[#07090E] p-3">
                <div className="font-semibold text-slate-100">
                  6. Data Confidence Contribution ({(DEFAULT_SCORING_WEIGHTS.confidence * 100).toFixed(0)}% weight)
                </div>
                <p className="text-slate-400 mt-1">
                  Reflects empirical evidence density in the local pressure/gravity/diluent neighborhood, bounded so
                  raising O₂ can never artificially increase the Fire Safety Rating.
                </p>
              </div>
            </div>
            <p className="text-xs text-slate-400 pt-1">
              The final <strong>Fire Safety Index</strong> is the weighted average of these six margins (minus a direct
              hyperoxic penalty whenever O₂ exceeds 21%). Ratings map to four tiers:{' '}
              <strong>Low Risk (72–100)</strong>, <strong>Moderate (48–71.9)</strong>,{' '}
              <strong>High (26–47.9)</strong>, and <strong>Critical (&lt; 26)</strong>.
            </p>
          </section>

          {/* 4. Confidence Level & Extrapolation */}
          <section className="space-y-2 border-t border-slate-800 pt-5">
            <h3 className="text-xs font-mono uppercase tracking-wider text-cyan-400">
              4. How Confidence Level &amp; Extrapolation Warnings Work
            </h3>
            <p>
              The <strong>Confidence Level (0–100%)</strong> tells you how strongly your answer is backed by actual space
              and ground experiments—not just model extrapolation. It is computed from two things:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong>Top-Match Similarity (65%):</strong> How closely the 3 nearest NASA PSI experiments match your
                exact oxygen, pressure, gravity, airflow, diluent, and fuel.
              </li>
              <li>
                <strong>Neighborhood Data Density (35%):</strong> How many total experimental tests lie close to your
                operating point (the effective sample size).
              </li>
            </ul>
            <p>
              If any input you specify falls outside the minimum-to-maximum range ever measured in the datasets (for
              example, very high pressure or high duct velocity), the engine reduces confidence proportionally, displays
              an amber <strong>Extrapolation Warning</strong> listing the exact out-of-range variables, and widens the
              uncertainty intervals around ignition, extinction, and LOI.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};
