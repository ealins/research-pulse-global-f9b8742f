import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";

import { Globe, type GlobeArc, type GlobePoint } from "@/components/Globe";

type Spoke = { to: string; label: string; count?: number | string };

export type Cluster = {
  key: string;
  label: string;
  blurb: string;
  tone: "monitor" | "act" | "knowledge";
  spokes: Spoke[];
};

const TONE = {
  monitor: {
    stroke: "stroke-primary",
    softStroke: "stroke-primary/25",
    fill: "fill-primary",
    text: "text-primary",
    border: "border-primary/35",
    bg: "bg-primary/10",
    glow: "shadow-[0_0_24px_-8px_var(--primary)]",
  },
  knowledge: {
    stroke: "stroke-muted-foreground",
    softStroke: "stroke-muted-foreground/25",
    fill: "fill-muted-foreground",
    text: "text-muted-foreground",
    border: "border-border",
    bg: "bg-muted/50",
    glow: "",
  },
  act: {
    stroke: "stroke-destructive",
    softStroke: "stroke-destructive/25",
    fill: "fill-destructive",
    text: "text-destructive",
    border: "border-destructive/35",
    bg: "bg-destructive/10",
    glow: "shadow-[0_0_24px_-8px_var(--destructive)]",
  },
} as const;

const SIZE = 620;
const C = SIZE / 2;
const RING = 246;

/** Sector angles in degrees, 0 = top, clockwise. */
const SECTORS: Record<string, [number, number]> = {
  monitor: [-128, -14],
  act: [10, 124],
  knowledge: [148, 232],
};

function polar(r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return {
    x: Number((C + r * Math.cos(rad)).toFixed(2)),
    y: Number((C + r * Math.sin(rad)).toFixed(2)),
  };
}

function arcPath(r: number, from: number, to: number) {
  const a = polar(r, from);
  const b = polar(r, to);
  const large = Math.abs(to - from) > 180 ? 1 : 0;
  return `M${a.x.toFixed(1)},${a.y.toFixed(1)} A${r},${r} 0 ${large} 1 ${b.x.toFixed(1)},${b.y.toFixed(1)}`;
}

export function PulseHub({
  clusters,
  points,
  arcs,
  loading,
}: {
  clusters: Cluster[];
  points: GlobePoint[];
  arcs: GlobeArc[];
  loading?: boolean;
}) {
  const [hover, setHover] = useState<string | null>(null);

  const laidOut = useMemo(
    () =>
      clusters.map((cluster) => {
        const [start, end] = SECTORS[cluster.tone] ?? [-60, 60];
        const ring = RING;
        const span = end - start;
        const n = Math.max(cluster.spokes.length, 1);
        const gap = 3;
        const seg = (span - gap * (n - 1)) / n;
        return {
          cluster,
          ring,
          start,
          end,
          segments: cluster.spokes.map((spoke, si) => {
            const from = start + si * (seg + gap);
            const to = from + seg;
            return { spoke, from, to, mid: (from + to) / 2 };
          }),
        };
      }),
    [clusters],
  );

  return (
    <div className="relative">
      <div className="relative mx-auto aspect-square w-full max-w-[620px]">
        {/* Globe core */}
        <div className="absolute left-1/2 top-1/2 w-[58%] -translate-x-1/2 -translate-y-1/2">
          <div className="mx-auto w-full text-primary">
            {loading ? (
              <div className="aspect-square w-full animate-pulse rounded-full bg-muted/40" />
            ) : (
              <Globe points={points} arcs={arcs} compact />
            )}
          </div>
        </div>

        {/* Rings and spokes */}
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="pointer-events-none absolute inset-0 h-full w-full"
        >
          {[RING - 40, RING, RING + 34].map((r) => (
            <circle
              key={r}
              cx={C}
              cy={C}
              r={r}
              className="fill-none stroke-border/40"
              strokeWidth="0.7"
              strokeDasharray="2 6"
            />
          ))}

          {laidOut.map(({ cluster, ring, start, end, segments }) => {
            const tone = TONE[cluster.tone];
            const head = polar(ring + 64, (start + end) / 2);
            return (
              <g key={cluster.key}>
                <path
                  d={arcPath(ring, start, end)}
                  className={`fill-none ${tone.softStroke}`}
                  strokeWidth="10"
                  strokeLinecap="round"
                />
                <text
                  x={head.x}
                  y={head.y}
                  textAnchor="middle"
                  className={`pointer-events-none fill-current text-[11px] font-medium uppercase tracking-[0.22em] ${tone.text}`}
                >
                  {cluster.label}
                </text>

                {segments.map(({ spoke, from, to, mid }) => {
                  const active = hover === spoke.to;
                  const label = polar(ring + 20, mid);
                  const dot = polar(ring, mid);
                  return (
                    <g key={spoke.to}>
                      <Link
                        to={spoke.to}
                        className="pointer-events-auto"
                        onMouseEnter={() => setHover(spoke.to)}
                        onMouseLeave={() => setHover(null)}
                      >
                        <path
                          d={arcPath(ring, from, to)}
                          className={`fill-none ${tone.stroke} transition-[stroke-width,opacity]`}
                          strokeWidth={active ? 13 : 8}
                          strokeLinecap="round"
                          opacity={active ? 1 : 0.72}
                        />
                        <circle cx={dot.x} cy={dot.y} r={active ? 3 : 2} className={tone.fill} />
                        <text
                          x={label.x}
                          y={label.y}
                          textAnchor="middle"
                          className={`fill-current text-[12px] ${
                            active ? tone.text : "text-foreground/75"
                          }`}
                        >
                          {spoke.label}
                        </text>
                        {spoke.count !== undefined ? (
                          <text
                            x={label.x}
                            y={label.y + 13}
                            textAnchor="middle"
                            className={`mono-num fill-current text-[10px] ${tone.text}`}
                          >
                            {spoke.count}
                          </text>
                        ) : null}
                      </Link>
                    </g>
                  );
                })}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Legend / fallback navigation (also the accessible list) */}
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {clusters.map((cluster) => {
          const tone = TONE[cluster.tone];
          return (
            <div key={cluster.key} className={`panel p-4 ${tone.glow}`}>
              <p
                className={`text-[0.65rem] font-medium uppercase tracking-[0.2em] ${tone.text}`}
              >
                {cluster.label}
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                {cluster.blurb}
              </p>
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {cluster.spokes.map((spoke) => (
                  <li key={spoke.to}>
                    <Link
                      to={spoke.to}
                      onMouseEnter={() => setHover(spoke.to)}
                      onMouseLeave={() => setHover(null)}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.7rem] transition-colors ${tone.border} ${tone.bg} hover:opacity-80`}
                    >
                      <span className="text-foreground/85">{spoke.label}</span>
                      {spoke.count !== undefined ? (
                        <span className={`mono-num ${tone.text}`}>{spoke.count}</span>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
