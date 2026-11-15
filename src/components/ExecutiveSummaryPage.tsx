import React from 'react';

export const ExecutiveSummaryPage: React.FC = () => {
  return (
    <article className="max-w-3xl mx-auto bg-[#0D111A] border border-slate-800 p-8 sm:p-10 space-y-6">
      <header className="border-b border-slate-800 pb-4">
        <p className="text-xs font-mono text-cyan-400 tracking-wider uppercase">
          SI Engine: Extraterrestrial Fire Safety
        </p>
        <h1 className="text-2xl sm:text-3xl font-display font-semibold text-slate-100 mt-1">
          Executive Summary
        </h1>
      </header>

      <div className="space-y-4 text-[15px] leading-7 text-slate-200">
        <p>
          Fire behaves differently in space. Without buoyancy, flames become spherical, burn at lower temperatures,
          can sustain &ldquo;cool flame&rdquo; chemistry, and may persist or extinguish under conditions that would be
          unremarkable on Earth. Yet spacecraft fire-safety practice still leans heavily on normal-gravity testing. This
          project delivers the Spacecraft Fire Safety Scientific Inference (SI) Engine, a web application that unifies
          NASA Physical Sciences Informatics (PSI) combustion datasets from FLEX, ACME, SAME, SAFFIRE, SPICE, BASS,
          DAFT and related experiments into one searchable, quantitative framework.
        </p>
        <p>
          Users enter mission conditions: oxygen concentration, total pressure, gravity level, diluent gas, ambient
          flow velocity, material or fuel, and sample size. The engine saves each scenario, cross-references it against
          the experimental records, and computes a Fire Safety Index with confidence bounds. It estimates ignition
          susceptibility, flame-spread tendency, extinction likelihood, and the most plausible flame regime: hot,
          warm, cool or oscillatory. Every result cites its supporting experiments and flags any extrapolation beyond
          measured data.
        </p>
        <p>
          By sorting heterogeneous results onto shared metrics, the app lets engineers compare habitats, from the ISS
          to lunar and Martian systems, and find where fire risk is unexpectedly high or low. It is a research
          decision-support tool, not a certified safety authority.
        </p>
      </div>
    </article>
  );
};
