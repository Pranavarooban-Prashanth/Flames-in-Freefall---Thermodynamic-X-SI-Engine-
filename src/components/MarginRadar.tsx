import React, { useState } from 'react';

export interface MarginRadarDatum {
  axis: string;
  value: number;
  fullMark: number;
}

interface MarginRadarProps {
  data: MarginRadarDatum[];
}

export const MarginRadar: React.FC<MarginRadarProps> = ({ data }) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const cx = 175;
  const cy = 112;
  const maxR = 76;
  const n = data.length;

  const pointAt = (index: number, pct: number) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * index) / n;
    const r = (Math.max(0, Math.min(100, pct)) / 100) * maxR;
    return {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
      angle,
    };
  };

  const rings = [25, 50, 75, 100];

  const polygonPoints = data
    .map((d, i) => {
      const pt = pointAt(i, d.value);
      return `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
    })
    .join(' ');

  const hoveredItem = hoveredIdx !== null ? data[hoveredIdx] : null;

  return (
    <div className="relative h-52 w-full flex items-center justify-center select-none">
      <svg
        viewBox="0 0 350 224"
        className="w-full h-full max-w-[380px] overflow-visible"
        role="img"
        aria-label="Sub-Score Margin Profile Radar Chart"
      >
        {/* Concentric grid rings */}
        {rings.map((ring) => {
          const pts = data
            .map((_, i) => {
              const p = pointAt(i, ring);
              return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
            })
            .join(' ');
          return (
            <polygon
              key={ring}
              points={pts}
              fill="none"
              stroke="#1E293B"
              strokeWidth={ring === 100 ? 1.25 : 1}
            />
          );
        })}

        {/* Radial spokes */}
        {data.map((d, i) => {
          const outer = pointAt(i, 100);
          return (
            <line
              key={d.axis}
              x1={cx}
              y1={cy}
              x2={outer.x}
              y2={outer.y}
              stroke="#1E293B"
              strokeWidth={1}
            />
          );
        })}

        {/* Ring scale ticks along vertical top spoke */}
        {[25, 50, 75, 100].map((val) => {
          const y = cy - (val / 100) * maxR;
          return (
            <text
              key={val}
              x={cx + 3}
              y={y + 3}
              fill="#475569"
              fontSize={9}
              fontFamily="IBM Plex Mono, monospace"
            >
              {val}
            </text>
          );
        })}

        {/* Filled radar polygon */}
        <polygon
          points={polygonPoints}
          fill="#06B6D4"
          fillOpacity={0.22}
          stroke="#06B6D4"
          strokeWidth={2}
          strokeLinejoin="round"
        />

        {/* Vertex dots + hover hit targets */}
        {data.map((d, i) => {
          const pt = pointAt(i, d.value);
          const isHovered = hoveredIdx === i;
          return (
            <g
              key={d.axis}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
              className="cursor-pointer"
            >
              <circle
                cx={pt.x}
                cy={pt.y}
                r={isHovered ? 5 : 3.2}
                fill={isHovered ? '#22D3EE' : '#06B6D4'}
                stroke="#07090E"
                strokeWidth={1.5}
              />
              <circle cx={pt.x} cy={pt.y} r={12} fill="transparent" />
            </g>
          );
        })}

        {/* Axis labels positioned outside outer ring */}
        {data.map((d, i) => {
          const labelPos = pointAt(i, 122);
          const cos = Math.cos(labelPos.angle);
          const textAnchor =
            Math.abs(cos) < 0.2 ? 'middle' : cos > 0 ? 'start' : 'end';
          const sin = Math.sin(labelPos.angle);
          const dy = sin > 0.5 ? 5 : sin < -0.5 ? -2 : 3;
          return (
            <text
              key={d.axis}
              x={labelPos.x}
              y={labelPos.y + dy}
              textAnchor={textAnchor}
              fill={hoveredIdx === i ? '#E2E8F0' : '#94A3B8'}
              fontSize={10.5}
              fontFamily="IBM Plex Mono, monospace"
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
              className="cursor-pointer"
            >
              {d.axis}
            </text>
          );
        })}
      </svg>

      {hoveredItem && (
        <div className="pointer-events-none absolute bottom-1 right-1 bg-[#07090E] border border-slate-700 px-2.5 py-1 text-[11px] font-mono text-slate-200 tabular-nums">
          <span className="text-slate-400">{hoveredItem.axis}: </span>
          <span className="text-cyan-300 font-semibold">
            {hoveredItem.value.toFixed(1)}
          </span>
          <span className="text-slate-500"> / 100</span>
        </div>
      )}
    </div>
  );
};
