import { activityKindLabel, liveItemPath, liveTradeRows, type Activity } from "../lib/chain";
import { liveArtKey } from "../lib/liveart";
import { ItemArt } from "./ItemArt";
import { PriceMark } from "./PriceMark";

type Props = {
  rows: Activity[];
  images?: Record<string, { image: string; name: string }>;
  onOpen?: (row: Activity) => void;
};

export function LiveTicker({ rows, images = {}, onOpen }: Props) {
  const trades = liveTradeRows(rows, 12);
  if (trades.length === 0) return null;
  const loop = [...trades, ...trades];
  const duration = Math.max(36, trades.length * 5);

  return (
    <section className="live-stage" aria-label="Live orders">
      <div className="live-head">
        <h2 className="section-title">
          <span className="live-pulse" aria-hidden />
          Live
        </h2>
        <p className="live-kicker">Lists, sales, and offers</p>
      </div>
      <div className="live-bar">
        <div className="live-mask">
          <ul className="live-track" style={{ animationDuration: `${duration}s` }}>
            {loop.map((row, i) => {
              const art = images[liveArtKey(row)];
              const label = row.name || art?.name || (row.id ? `#${row.id}` : "Item");
              const copy = i >= trades.length;
              return (
                <li key={`${row.kind}-${row.id}-${row.name}-${i}`} aria-hidden={copy || undefined}>
                  <a
                    className={`live-pull kind-${(row.kind || "activity").toLowerCase()}`}
                    href={liveItemPath(row)}
                    tabIndex={copy ? -1 : undefined}
                    onClick={(event) => {
                      if (!onOpen || !row.id) return;
                      event.preventDefault();
                      onOpen(row);
                    }}
                  >
                    <span className="live-pull-art">
                      <ItemArt name={label} image={art?.image || ""} alt={copy ? "" : label} priority={!copy && i < 6} />
                      <span className="live-kind">{activityKindLabel(row.kind)}</span>
                    </span>
                    <span className="live-pull-meta">
                      <strong>{label}</strong>
                      {row.price > 0 ? <PriceMark ugnot={row.price} size={13} className="live-price" /> : null}
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
