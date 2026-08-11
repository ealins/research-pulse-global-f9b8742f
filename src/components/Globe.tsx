import { useEffect, useMemo, useRef, useState } from "react";

export type GlobePoint = {
  id: string;
  name: string;
  slug: string;
  lat: number;
  lon: number;
  country: string | null;
  weight: number;
  live: boolean;
};

export type GlobeArc = { from: string; to: string; weight: number };

const R = 150;
const CX = 160;
const CY = 160;

function project(lat: number, lon: number, rotation: number) {
  const phi = (lat * Math.PI) / 180;
  const lambda = ((lon + rotation) * Math.PI) / 180;
  const x = Math.cos(phi) * Math.sin(lambda);
  const y = Math.sin(phi);
  const z = Math.cos(phi) * Math.cos(lambda);
  return { x: CX + R * x, y: CY - R * y, visible: z > 0, z };
}

function graticule(rotation: number) {
  const paths: string[] = [];
  for (let lat = -60; lat <= 60; lat += 30) {
    const pts: string[] = [];
    for (let lon = -180; lon <= 180; lon += 4) {
      const p = project(lat, lon, rotation);
      if (p.visible) pts.push(`${p.x.toFixed(1)},${p.y.toFixed(1)}`);
      else if (pts.length) {
        paths.push(`M${pts.join("L")}`);
        pts.length = 0;
      }
    }
    if (pts.length) paths.push(`M${pts.join("L")}`);
  }
  for (let lon = -180; lon < 180; lon += 30) {
    const pts: string[] = [];
    for (let lat = -90; lat <= 90; lat += 4) {
      const p = project(lat, lon, rotation);
      if (p.visible) pts.push(`${p.x.toFixed(1)},${p.y.toFixed(1)}`);
      else if (pts.length) {
        paths.push(`M${pts.join("L")}`);
        pts.length = 0;
      }
    }
    if (pts.length) paths.push(`M${pts.join("L")}`);
  }
  return paths;
}

export function Globe({
  points,
  arcs = [],
  selectedId,
  onSelect,
}: {
  points: GlobePoint[];
  arcs?: GlobeArc[];
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
}) {
  const [rotation, setRotation] = useState(-10);
  const [spinning, setSpinning] = useState(true);
  const drag = useRef<{ x: number; start: number } | null>(null);

  useEffect(() => {
    if (!spinning) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      setRotation((r) => (r + dt * 0.006) % 360);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [spinning]);

  const lines = useMemo(() => graticule(rotation), [rotation]);
  const projected = useMemo(
    () => points.map((p) => ({ ...p, pos: project(p.lat, p.lon, rotation) })),
    [points, rotation],
  );
  const byId = useMemo(
    () => new Map(projected.map((p) => [p.id, p] as const)),
    [projected],
  );

  return (
    <div className="relative">
      <svg
        viewBox="0 0 320 320"
        className="w-full max-w-[420px] touch-none select-none"
        onPointerDown={(e) => {
          drag.current = { x: e.clientX, start: rotation };
          setSpinning(false);
          (e.target as Element).setPointerCapture?.(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          setRotation(drag.current.start + (e.clientX - drag.current.x) * 0.4);
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
      >
        <defs>
          <radialGradient id="globeFill" cx="35%" cy="30%">
            <stop offset="0%" stopColor="hsl(var(--globe-hi, 195 90% 60%))" stopOpacity="0.18" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.04" />
          </radialGradient>
        </defs>

        <circle cx={CX} cy={CY} r={R} className="fill-primary/5 stroke-border" strokeWidth="1" />
        <circle cx={CX} cy={CY} r={R} fill="url(#globeFill)" className="text-primary" />

        {lines.map((d, i) => (
          <path key={i} d={d} className="fill-none stroke-border/70" strokeWidth="0.6" />
        ))}

        {arcs.map((a, i) => {
          const s = byId.get(a.from);
          const t = byId.get(a.to);
          if (!s || !t || !s.pos.visible || !t.pos.visible) return null;
          const mx = (s.pos.x + t.pos.x) / 2;
          const my = (s.pos.y + t.pos.y) / 2;
          const lift = 0.85;
          return (
            <path
              key={i}
              d={`M${s.pos.x},${s.pos.y} Q${CX + (mx - CX) * (1 + lift * 0.25)},${CY + (my - CY) * (1 + lift * 0.25)} ${t.pos.x},${t.pos.y}`}
              className="fill-none stroke-signal/35"
              strokeWidth={Math.min(1.6, 0.4 + a.weight * 0.25)}
            />
          );
        })}

        {projected
          .filter((p) => p.pos.visible)
          .sort((a, b) => a.pos.z - b.pos.z)
          .map((p) => {
            const active = selectedId === p.id;
            const r = 2 + Math.min(3.5, p.weight * 0.5);
            return (
              <g key={p.id} onClick={() => onSelect?.(active ? null : p.id)} className="cursor-pointer">
                {p.live ? (
                  <circle cx={p.pos.x} cy={p.pos.y} r={r + 3} className="fill-growth/20" />
                ) : null}
                <circle
                  cx={p.pos.x}
                  cy={p.pos.y}
                  r={active ? r + 1.5 : r}
                  className={
                    active
                      ? "fill-primary stroke-primary-foreground"
                      : p.live
                        ? "fill-growth stroke-background"
                        : "fill-signal stroke-background"
                  }
                  strokeWidth="0.6"
                />
                {active ? (
                  <text
                    x={p.pos.x + 7}
                    y={p.pos.y + 3}
                    className="fill-foreground text-[7px]"
                  >
                    {p.name}
                  </text>
                ) : null}
              </g>
            );
          })}
      </svg>

      <div className="mt-3 flex items-center justify-center gap-3 text-[0.65rem] text-muted-foreground">
        <button
          type="button"
          onClick={() => setSpinning((s) => !s)}
          className="rounded-md border border-border px-2 py-1 hover:border-primary/40 hover:text-primary"
        >
          {spinning ? "Pause rotation" : "Resume rotation"}
        </button>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-growth" /> open positions
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-signal" /> no live call
        </span>
      </div>
    </div>
  );
}
