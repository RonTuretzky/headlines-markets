import { useMemo, useRef, useState } from "react";
import type { PricePoint } from "../hooks/usePriceHistory";

// YES-price history chart. Design per the dataviz method: single series (no legend —
// the header names it), 2px line in the YES entity green, 10%-opacity area wash,
// hairline solid gridlines, muted text tokens for all labels, ≥8px end marker with a
// 2px surface ring, crosshair + tooltip hover layer, range filter tabs above.
const GREEN = "#32a800"; // validated vs paper surface (all six checks pass)
const SURFACE = "#fdfcf9";
const GRID = "#eae2d6"; // paper-2, one step off surface
const INK_MUTED = "#808080";

const RANGES: { label: string; seconds: number | null }[] = [
  { label: "1H", seconds: 3600 },
  { label: "6H", seconds: 6 * 3600 },
  { label: "1D", seconds: 86400 },
  { label: "1W", seconds: 7 * 86400 },
  { label: "ALL", seconds: null },
];

export function PriceChart({ points, now }: { points: PricePoint[]; now: number }) {
  const [range, setRange] = useState("ALL");
  const [hover, setHover] = useState<{ x: number; idx: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const W = 640;
  const H = 220;
  const PAD = { l: 34, r: 14, t: 10, b: 22 };

  const shown = useMemo(() => {
    const r = RANGES.find((r) => r.label === range);
    if (!r?.seconds) return points;
    const cutoff = now - r.seconds;
    const inRange = points.filter((p) => p.ts >= cutoff);
    // keep the last pre-cutoff point so the line enters from the left edge
    const before = points.filter((p) => p.ts < cutoff);
    return before.length ? [{ ...before[before.length - 1], ts: cutoff }, ...inRange] : inRange;
  }, [points, range, now]);

  if (points.length < 2) {
    return (
      <div className="bread-card flex h-[180px] items-center justify-center text-sm text-surface-grey-2">
        No trades yet — the chart starts with the first trade.
      </div>
    );
  }

  const t0 = shown[0]?.ts ?? 0;
  const t1 = shown[shown.length - 1]?.ts ?? 1;
  const x = (ts: number) => PAD.l + ((ts - t0) / Math.max(1, t1 - t0)) * (W - PAD.l - PAD.r);
  const y = (price: number) => PAD.t + (1 - price) * (H - PAD.t - PAD.b);

  // step-after line: price holds between trades
  let d = "";
  shown.forEach((p, i) => {
    const px = x(p.ts);
    const py = y(p.price);
    if (i === 0) d = `M ${px} ${py}`;
    else d += ` H ${px} V ${py}`;
  });
  const last = shown[shown.length - 1];
  const areaD = `${d} V ${y(0)} H ${x(t0)} Z`;

  const onMove = (e: React.MouseEvent) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = ((e.clientX - rect.left) / rect.width) * W;
    // nearest point at or before the cursor (step semantics)
    let idx = 0;
    for (let i = 0; i < shown.length; i++) if (x(shown[i].ts) <= mx) idx = i;
    setHover({ x: Math.max(PAD.l, Math.min(W - PAD.r, mx)), idx });
  };

  const hovered = hover ? shown[hover.idx] : null;

  return (
    <div className="bread-card p-4" data-testid="price-chart">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-caption font-bold uppercase text-surface-grey-2">Yes price</div>
        <div className="flex border-2 border-surface-ink">
          {RANGES.map((r) => (
            <button
              key={r.label}
              onClick={() => setRange(r.label)}
              className={`px-2 py-0.5 text-caption font-bold ${
                range === r.label ? "bg-surface-ink text-paper-0" : "bg-paper-0 text-surface-grey-2"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        {/* hairline gridlines + ¢ ticks (muted text tokens) */}
        {[0, 0.25, 0.5, 0.75, 1].map((v) => (
          <g key={v}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke={GRID} strokeWidth="1" />
            <text x={PAD.l - 6} y={y(v) + 3} textAnchor="end" fontSize="9" fill={INK_MUTED}>
              {Math.round(v * 100)}¢
            </text>
          </g>
        ))}
        {/* time labels: first + last */}
        <text x={PAD.l} y={H - 6} fontSize="9" fill={INK_MUTED}>
          {fmtTick(t0)}
        </text>
        <text x={W - PAD.r} y={H - 6} textAnchor="end" fontSize="9" fill={INK_MUTED}>
          {fmtTick(t1)}
        </text>
        {/* area wash + line */}
        <path d={areaD} fill={GREEN} opacity="0.1" />
        <path d={d} fill="none" stroke={GREEN} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {/* end marker: 8px dot with 2px surface ring */}
        {last && (
          <>
            <circle cx={x(last.ts)} cy={y(last.price)} r="6" fill={SURFACE} />
            <circle cx={x(last.ts)} cy={y(last.price)} r="4" fill={GREEN} />
          </>
        )}
        {/* crosshair + hover marker */}
        {hover && hovered && (
          <>
            <line x1={x(hovered.ts)} x2={x(hovered.ts)} y1={PAD.t} y2={H - PAD.b} stroke={INK_MUTED} strokeWidth="1" />
            <circle cx={x(hovered.ts)} cy={y(hovered.price)} r="6" fill={SURFACE} />
            <circle cx={x(hovered.ts)} cy={y(hovered.price)} r="4" fill={GREEN} />
          </>
        )}
      </svg>
      <div className="mt-1 flex h-5 items-center justify-between text-caption text-surface-grey-2">
        {hovered ? (
          <span>
            <b className="text-surface-ink">{Math.round(hovered.price * 100)}¢</b> ·{" "}
            {new Date(hovered.ts * 1000).toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </span>
        ) : (
          <span>
            Last <b className="text-surface-ink">{last ? Math.round(last.price * 100) : "—"}¢</b>
          </span>
        )}
        <span>{shown.length - 1} trades in range</span>
      </div>
    </div>
  );
}

function fmtTick(ts: number): string {
  return new Date(ts * 1000).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric" });
}

/** Card-sized sparkline: same entity green, no axes — the card carries the labels. */
export function Sparkline({ points, width = 96, height = 30 }: { points: PricePoint[]; width?: number; height?: number }) {
  if (points.length < 2) return <div style={{ width, height }} />;
  const t0 = points[0].ts;
  const t1 = points[points.length - 1].ts;
  const x = (ts: number) => 2 + ((ts - t0) / Math.max(1, t1 - t0)) * (width - 10);
  const y = (p: number) => 3 + (1 - p) * (height - 6);
  let d = "";
  points.forEach((p, i) => {
    d += i === 0 ? `M ${x(p.ts)} ${y(p.price)}` : ` H ${x(p.ts)} V ${y(p.price)}`;
  });
  const last = points[points.length - 1];
  return (
    <svg width={width} height={height} aria-hidden="true">
      <path d={d} fill="none" stroke={GREEN} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(last.ts)} cy={y(last.price)} r="5" fill={SURFACE} />
      <circle cx={x(last.ts)} cy={y(last.price)} r="3" fill={GREEN} />
    </svg>
  );
}
