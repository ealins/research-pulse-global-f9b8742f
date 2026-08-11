import { useEffect, useMemo, useRef, useState } from "react";
import { LAND_RINGS } from "@/lib/world-land";

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

const TILT = (-16 * Math.PI) / 180;

type Vec = { x: number; y: number; z: number };

function toVec(lat: number, lon: number, rot: number): Vec {
  const phi = (lat * Math.PI) / 180;
  const lambda = ((lon + rot) * Math.PI) / 180;
  const x = Math.cos(phi) * Math.sin(lambda);
  const yr = Math.sin(phi);
  const zr = Math.cos(phi) * Math.cos(lambda);
  // axial tilt around the x axis so the sphere reads three-dimensional
  const y = yr * Math.cos(TILT) - zr * Math.sin(TILT);
  const z = yr * Math.sin(TILT) + zr * Math.cos(TILT);
  return { x, y, z };
}

function cssVar(name: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

export function Globe({
  points,
  arcs = [],
  selectedId,
  onSelect,
  compact = false,
  height,
}: {
  points: GlobePoint[];
  arcs?: GlobeArc[];
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  compact?: boolean;
  height?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [spinning, setSpinning] = useState(true);
  const [hover, setHover] = useState<{ name: string; x: number; y: number; live: boolean } | null>(
    null,
  );

  const rot = useRef(-24);
  const vel = useRef(0.006); // deg per ms — the idle glide
  const drag = useRef<{ x: number; last: number; time: number; moved: boolean } | null>(null);
  const hitmap = useRef<{ id: string; name: string; x: number; y: number; r: number; live: boolean }[]>(
    [],
  );
  const pulse = useRef(0);

  const pts = useMemo(() => points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon)), [
    points,
  ]);
  const sel = useRef<string | null>(selectedId ?? null);
  sel.current = selectedId ?? null;
  const dataRef = useRef({ pts, arcs });
  dataRef.current = { pts, arcs };

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const theme = {
      ocean: cssVar("--card", "oklch(0.22 0.03 250)"),
      land: cssVar("--muted", "oklch(0.3 0.02 250)"),
      grid: cssVar("--border", "oklch(0.35 0.02 250)"),
      primary: cssVar("--primary", "oklch(0.78 0.14 200)"),
      growth: cssVar("--growth", "oklch(0.78 0.16 150)"),
      signal: cssVar("--signal", "oklch(0.7 0.1 250)"),
      fg: cssVar("--foreground", "oklch(0.95 0.01 250)"),
    };

    let w = 0;
    let h = 0;
    let dpr = 1;
    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = Math.max(240, rect.width);
      h = height ?? w;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    let raf = 0;
    let last = performance.now();

    const frame = (now: number) => {
      const dt = Math.min(48, now - last);
      last = now;
      pulse.current = (pulse.current + dt / 1400) % 1;

      if (!drag.current) {
        // ease back toward the idle glide speed for a pleasant continuous drift
        vel.current += (0.006 - vel.current) * (1 - Math.exp(-dt / 420));
        if (spinning) rot.current = (rot.current + vel.current * dt) % 360;
      }

      const cx = w / 2;
      const cy = h / 2;
      const R = Math.min(w, h) * 0.42;
      const rotation = rot.current;
      const { pts: P, arcs: A } = dataRef.current;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const px = (v: Vec) => ({ x: cx + R * v.x, y: cy - R * v.y, z: v.z });

      // atmosphere
      const atmo = ctx.createRadialGradient(cx, cy, R * 0.92, cx, cy, R * 1.22);
      atmo.addColorStop(0, theme.primary);
      atmo.addColorStop(1, "transparent");
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = atmo;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 1.22, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      // ocean sphere with a lit north-west shoulder
      const body = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R);
      body.addColorStop(0, theme.signal);
      body.addColorStop(0.45, theme.ocean);
      body.addColorStop(1, "oklch(0.16 0.03 250)");
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fillStyle = body;
      ctx.fill();

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.clip();

      // graticule
      ctx.strokeStyle = theme.grid;
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 0.6;
      for (let lat = -60; lat <= 60; lat += 30) {
        ctx.beginPath();
        let open = false;
        for (let lon = -180; lon <= 180; lon += 3) {
          const p = px(toVec(lat, lon, rotation));
          if (p.z > 0) {
            open ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y);
            open = true;
          } else open = false;
        }
        ctx.stroke();
      }
      for (let lon = -180; lon < 180; lon += 30) {
        ctx.beginPath();
        let open = false;
        for (let lat = -90; lat <= 90; lat += 3) {
          const p = px(toVec(lat, lon, rotation));
          if (p.z > 0) {
            open ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y);
            open = true;
          } else open = false;
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // land masses
      ctx.fillStyle = theme.land;
      ctx.strokeStyle = theme.primary;
      ctx.lineWidth = 0.5;
      for (const ring of LAND_RINGS) {
        let started = false;
        let visible = false;
        ctx.beginPath();
        for (let i = 0; i < ring.length; i += 2) {
          const p = px(toVec(ring[i + 1]!, ring[i]!, rotation));
          if (p.z > -0.02) {
            if (started) ctx.lineTo(p.x, p.y);
            else {
              ctx.moveTo(p.x, p.y);
              started = true;
            }
            if (p.z > 0) visible = true;
          }
        }
        if (!visible) continue;
        ctx.closePath();
        ctx.globalAlpha = 0.85;
        ctx.fill();
        ctx.globalAlpha = 0.35;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // collaboration arcs lifted off the surface
      const byId = new Map(P.map((p) => [p.id, p] as const));
      ctx.lineWidth = 0.9;
      for (const a of A) {
        const s = byId.get(a.from);
        const t = byId.get(a.to);
        if (!s || !t) continue;
        const sv = toVec(s.lat, s.lon, rotation);
        const tv = toVec(t.lat, t.lon, rotation);
        if (sv.z <= 0 || tv.z <= 0) continue;
        const mid = { x: (sv.x + tv.x) / 2, y: (sv.y + tv.y) / 2, z: (sv.z + tv.z) / 2 };
        const len = Math.hypot(mid.x, mid.y, mid.z) || 1;
        const lift = 1 + 0.22 * Math.hypot(sv.x - tv.x, sv.y - tv.y, sv.z - tv.z);
        const mp = px({ x: (mid.x / len) * lift, y: (mid.y / len) * lift, z: mid.z });
        const sp = px(sv);
        const tp = px(tv);
        ctx.strokeStyle = theme.primary;
        ctx.globalAlpha = 0.16 + Math.min(0.3, a.weight * 0.05);
        ctx.beginPath();
        ctx.moveTo(sp.x, sp.y);
        ctx.quadraticCurveTo(mp.x, mp.y, tp.x, tp.y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.restore();

      // 3D university pins: stem from surface + elevated orb
      const hits: typeof hitmap.current = [];
      const drawn = P.map((p) => ({ p, v: toVec(p.lat, p.lon, rotation) }))
        .filter((d) => d.v.z > 0.02)
        .sort((a, b) => a.v.z - b.v.z);

      for (const { p, v } of drawn) {
        const base = px(v);
        const elev = 0.1 + Math.min(0.08, p.weight * 0.012);
        const top = px({ x: v.x * (1 + elev), y: v.y * (1 + elev), z: v.z });
        const depth = 0.45 + 0.55 * v.z;
        const active = sel.current === p.id;
        const color = p.live ? theme.growth : theme.primary;
        const r = (active ? 4.6 : 3.2) * depth;

        ctx.globalAlpha = 0.5 * depth;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1 * depth;
        ctx.beginPath();
        ctx.moveTo(base.x, base.y);
        ctx.lineTo(top.x, top.y);
        ctx.stroke();

        // ground shadow
        ctx.globalAlpha = 0.5 * depth;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.ellipse(base.x, base.y, 1.8 * depth, 0.9 * depth, 0, 0, Math.PI * 2);
        ctx.fill();

        if (p.live) {
          const t = pulse.current;
          ctx.globalAlpha = (1 - t) * 0.4 * depth;
          ctx.beginPath();
          ctx.arc(top.x, top.y, r + t * 12, 0, Math.PI * 2);
          ctx.strokeStyle = color;
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        const orb = ctx.createRadialGradient(
          top.x - r * 0.4,
          top.y - r * 0.4,
          r * 0.1,
          top.x,
          top.y,
          r,
        );
        orb.addColorStop(0, theme.fg);
        orb.addColorStop(0.5, color);
        orb.addColorStop(1, color);
        ctx.globalAlpha = depth;
        ctx.fillStyle = orb;
        ctx.beginPath();
        ctx.arc(top.x, top.y, r, 0, Math.PI * 2);
        ctx.fill();

        if (active) {
          ctx.globalAlpha = 1;
          ctx.strokeStyle = theme.fg;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(top.x, top.y, r + 3.5, 0, Math.PI * 2);
          ctx.stroke();
        }

        hits.push({ id: p.id, name: p.name, x: top.x, y: top.y, r: Math.max(9, r + 5), live: p.live });
      }
      ctx.globalAlpha = 1;
      hitmap.current = hits;

      // limb shading for sphere depth
      const limb = ctx.createRadialGradient(cx, cy, R * 0.55, cx, cy, R);
      limb.addColorStop(0, "transparent");
      limb.addColorStop(1, "oklch(0.12 0.02 250)");
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = limb;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [spinning, height]);

  const pick = (e: React.PointerEvent | React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    let best: (typeof hitmap.current)[number] | null = null;
    let bestD = Infinity;
    for (const hp of hitmap.current) {
      const d = Math.hypot(hp.x - x, hp.y - y);
      if (d < hp.r && d < bestD) {
        best = hp;
        bestD = d;
      }
    }
    return best;
  };

  return (
    <div ref={wrapRef} className="relative w-full">
      <canvas
        ref={canvasRef}
        className="block w-full touch-none select-none"
        onPointerDown={(e) => {
          drag.current = { x: e.clientX, last: e.clientX, time: performance.now(), moved: false };
          (e.target as Element).setPointerCapture?.(e.pointerId);
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (d) {
            const now = performance.now();
            const dx = e.clientX - d.last;
            if (Math.abs(e.clientX - d.x) > 3) d.moved = true;
            rot.current += dx * 0.32;
            const dt = Math.max(8, now - d.time);
            vel.current = (dx * 0.32) / dt;
            d.last = e.clientX;
            d.time = now;
            return;
          }
          const hit = pick(e);
          setHover(hit ? { name: hit.name, x: hit.x, y: hit.y, live: hit.live } : null);
        }}
        onPointerUp={(e) => {
          const d = drag.current;
          drag.current = null;
          if (d && !d.moved) {
            const hit = pick(e);
            onSelect?.(hit && hit.id !== selectedId ? hit.id : null);
          }
        }}
        onPointerLeave={() => {
          drag.current = null;
          setHover(null);
        }}
        style={{ cursor: hover ? "pointer" : "grab" }}
      />

      {hover ? (
        <div
          className="panel pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md px-2 py-1 text-[0.7rem] whitespace-nowrap"
          style={{ left: hover.x, top: hover.y - 10 }}
        >
          <span className={hover.live ? "text-growth" : "text-foreground"}>{hover.name}</span>
        </div>
      ) : null}

      {compact ? null : (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-3 text-[0.65rem] text-muted-foreground">
          <button
            type="button"
            onClick={() => setSpinning((s) => !s)}
            className="rounded-md border border-border px-2 py-1 hover:border-primary/40 hover:text-primary"
          >
            {spinning ? "Pause glide" : "Resume glide"}
          </button>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-growth" /> open positions
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-primary" /> no live call
          </span>
          <span>drag to spin · click a pin</span>
        </div>
      )}
    </div>
  );
}
