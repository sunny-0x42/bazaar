import { useId, useMemo, useState } from "react";
import { UGNOT, gnotFromUgnot } from "../lib/chain";
import type { ChartPoint } from "../lib/chart";
import { PriceMark } from "./PriceMark";
import { useQuote } from "./Quote";

type Props = {
  points: ChartPoint[];
  height?: number;
  compact?: boolean;
};

const WIDTH = 720;

export function PriceChart({ points, height = 220, compact = false }: Props) {
  const { quote, formatUgnot } = useQuote();
  const gid = useId().replace(/:/g, "");
  const [hover, setHover] = useState<number | null>(null);

  const pad = compact ? { t: 8, r: 8, b: 8, l: 8 } : { t: 16, r: 18, b: 28, l: 52 };
  const innerW = Math.max(1, WIDTH - pad.l - pad.r);
  const innerH = Math.max(1, height - pad.t - pad.b);

  const layout = useMemo(() => {
    if (points.length === 0) return null;
    const prices = points.map((p) => p.price);
    let minP = Math.min(...prices);
    let maxP = Math.max(...prices);
    if (minP === maxP) {
      const padAmt = minP > 0 ? minP * 0.08 : UGNOT;
      minP = Math.max(0, minP - padAmt);
      maxP = maxP + padAmt;
    }
    const span = maxP - minP || 1;
    const coords = points.map((p, i) => {
      const t = points.length === 1 ? 0.5 : i / (points.length - 1);
      return {
        x: pad.l + t * innerW,
        y: pad.t + (1 - (p.price - minP) / span) * innerH,
        p,
      };
    });
    const line = coords.map((c, i) => `${i === 0 ? "M" : "L"}${round(c.x)} ${round(c.y)}`).join(" ");
    const first = coords[0];
    const last = coords[coords.length - 1];
    const fill = `${line} L${round(last.x)} ${round(pad.t + innerH)} L${round(first.x)} ${round(pad.t + innerH)} Z`;
    return { minP, maxP, coords, line, fill, first, last };
  }, [points, innerH, innerW, pad.l, pad.t]);

  if (points.length === 0) {
    if (compact) return null;
    return (
      <div className="price-chart empty" style={{ minHeight: height }} role="img" aria-label="No trades yet">
        <p className="muted">No trades yet</p>
      </div>
    );
  }
  if (!layout) return null;

  const { minP, maxP, coords, line, fill, first, last } = layout;
  const lastP = points[points.length - 1];
  const firstP = points[0];
  const delta = firstP.price > 0 ? ((lastP.price - firstP.price) / firstP.price) * 100 : 0;
  const yTicks = compact ? [] : [maxP, (minP + maxP) / 2, minP];
  const active = hover != null ? coords[hover] : last;
  const label = `Price ${formatUgnot(lastP.price)}`;

  function nearest(clientX: number, svg: SVGSVGElement) {
    const box = svg.getBoundingClientRect();
    const x = ((clientX - box.left) / box.width) * WIDTH;
    let best = 0;
    let bestD = Infinity;
    coords.forEach((c, i) => {
      const d = Math.abs(c.x - x);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    setHover(best);
  }

  return (
    <figure className={compact ? "price-chart compact" : "price-chart"}>
      {!compact ? (
        <header className="chart-head">
          <div>
            <span className="muted">Last</span>
            <PriceMark ugnot={lastP.price} size={16} />
          </div>
          {points.length > 1 ? (
            <span className={`stat-delta ${delta > 0 ? "is-up" : delta < 0 ? "is-down" : ""}`}>
              {delta > 0 ? "+" : delta < 0 ? "−" : ""}
              {Math.abs(delta).toFixed(Math.abs(delta) >= 10 ? 1 : 2)}%
            </span>
          ) : null}
        </header>
      ) : null}
      <svg
        viewBox={`0 0 ${WIDTH} ${height}`}
        width="100%"
        height={height}
        role="img"
        aria-label={label}
        onMouseMove={(e) => nearest(e.clientX, e.currentTarget)}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={`cg-${gid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2ee6c5" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#2ee6c5" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {!compact ? (
          <g className="chart-grid" aria-hidden="true">
            {yTicks.map((price, i) => {
              const y = pad.t + (i / Math.max(yTicks.length - 1, 1)) * innerH;
              const tick = quote === "usd" ? formatUgnot(price) : gnotFromUgnot(price);
              return (
                <g key={`y-${i}`}>
                  <line x1={pad.l} x2={WIDTH - pad.r} y1={y} y2={y} />
                  <text x={pad.l - 8} y={y + 4} textAnchor="end">
                    {tick}
                  </text>
                </g>
              );
            })}
          </g>
        ) : null}
        <path d={fill} fill={`url(#cg-${gid})`} stroke="none" />
        <path d={line} className="chart-line" />
        <circle cx={round(active.x)} cy={round(active.y)} r={compact ? 2.5 : 4.5} className="chart-dot" />
        {hover != null && !compact ? (
          <g className="chart-hover">
            <line x1={active.x} x2={active.x} y1={pad.t} y2={pad.t + innerH} />
            <text x={Math.min(active.x + 8, WIDTH - 80)} y={Math.max(active.y - 10, pad.t + 12)}>
              {quote === "usd" ? formatUgnot(active.p.price) : `${gnotFromUgnot(active.p.price)} GNOT`}
            </text>
          </g>
        ) : null}
      </svg>
      {!compact ? (
        <figcaption className="chart-caption">
          {String(first.p.x)} → {String(last.p.x)} · {quote === "usd" ? "USD" : "GNOT"}
        </figcaption>
      ) : null}
    </figure>
  );
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}
