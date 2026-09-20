import { activityKindLabel, liveTradeRows, type Activity } from "../lib/chain";
import { PriceMark } from "./PriceMark";

type Props = {
  rows: Activity[];
};

function hrefFor(row: Activity): string {
  if (row.id) return `#/i/${row.id}`;
  if (row.slug) return `#/c/${row.slug}`;
  return "#/explore";
}

export function LiveTicker({ rows }: Props) {
  const trades = liveTradeRows(rows, 24);
  if (trades.length === 0) return null;
  const loop = trades.length === 1 ? [...trades, ...trades] : [...trades, ...trades];
  const duration = Math.max(22, trades.length * 3.4);

  return (
    <section className="live-stage" aria-label="Live orders">
      <div className="live-head">
        <div className="live-badge">
          <span className="live-pulse" aria-hidden />
          Live
        </div>
        <p className="live-kicker">Lists, sales, and offers</p>
      </div>
      <div className="live-bar">
        <div className="live-mask">
          <ul className="live-track" style={{ animationDuration: `${duration}s` }}>
            {loop.map((row, i) => (
              <li key={`${row.kind}-${row.id}-${row.name}-${i}`}>
                <a className={`live-chip kind-${(row.kind || "activity").toLowerCase()}`} href={hrefFor(row)}>
                  <span className="live-kind">{activityKindLabel(row.kind)}</span>
                  <span className="live-copy">
                    <strong>{row.name || "Item"}</strong>
                  </span>
                  {row.price > 0 ? <PriceMark ugnot={row.price} size={16} className="live-price" /> : null}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
