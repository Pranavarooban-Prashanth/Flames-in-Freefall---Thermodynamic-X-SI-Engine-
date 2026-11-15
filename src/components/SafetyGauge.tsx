import React from 'react';
import { RiskTier } from '../types/combustion';

interface SafetyGaugeProps {
  score: number;
  riskTier: RiskTier;
  confidence: number;
  isExtrapolating: boolean;
}

export const SafetyGauge: React.FC<SafetyGaugeProps> = ({
  score,
  riskTier,
  confidence,
  isExtrapolating,
}) => {
  const clamped = Math.max(0, Math.min(100, score));
  const radius = 78;
  const circumference = Math.PI * radius; // semicircle
  const strokeDashoffset = circumference * (1 - clamped / 100);

  const tierStyles: Record<RiskTier, { stroke: string; text: string; glyph: string }> = {
    Low: { stroke: '#10B981', text: 'text-emerald-400', glyph: '●' },
    Moderate: { stroke: '#06B6D4', text: 'text-cyan-400', glyph: '◆' },
    High: { stroke: '#F59E0B', text: 'text-amber-400', glyph: '▲' },
    Critical: { stroke: '#F43F5E', text: 'text-rose-400', glyph: '✖' },
  };

  const style = tierStyles[riskTier];

  return (
    <div className="flex flex-col items-center justify-center py-2">
      <div className="relative w-52 h-32 flex items-end justify-center">
        <svg viewBox="0 0 200 115" className="w-full h-full overflow-visible" aria-label={`Fire Safety Index ${clamped} out of 100`}>
          {/* Background track */}
          <path
            d="M 22 100 A 78 78 0 0 1 178 100"
            fill="none"
            stroke="#1E293B"
            strokeWidth="12"
            strokeLinecap="butt"
          />
          {/* Tick marks at 0, 26, 48, 72, 100 */}
          {[0, 26, 48, 72, 100].map((val) => {
            const angle = Math.PI * (1 - val / 100);
            const x1 = 100 + 67 * Math.cos(angle);
            const y1 = 100 - 67 * Math.sin(angle);
            const x2 = 100 + 89 * Math.cos(angle);
            const y2 = 100 - 89 * Math.sin(angle);
            return (
              <line
                key={val}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="#334155"
                strokeWidth="1.5"
              />
            );
          })}
          {/* Active arc */}
          <path
            d="M 22 100 A 78 78 0 0 1 178 100"
            fill="none"
            stroke={style.stroke}
            strokeWidth="12"
            strokeLinecap="butt"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-300 ease-out"
          />
        </svg>

        <div className="absolute bottom-1 flex flex-col items-center">
          <div className="text-4xl font-mono font-bold tracking-tight text-slate-100 tabular-nums">
            {clamped.toFixed(1)}
          </div>
          <div className="text-xs font-mono text-slate-400">
            / 100 SAFETY INDEX
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3 text-sm font-medium">
        <span className={`${style.text} font-mono tabular-nums`}>
          {style.glyph} {riskTier} Risk
        </span>
        <span className="text-slate-600" aria-hidden="true">·</span>
        <span className="text-xs font-mono text-slate-400 tabular-nums">
          Confidence: {confidence.toFixed(1)}%
          {isExtrapolating ? ' (Extrapolated)' : ''}
        </span>
      </div>
    </div>
  );
};
