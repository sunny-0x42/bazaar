import {
  formatFloorPct,
  listedShare,
  type CollectionMarket,
  type ExploreCollection,
} from "../lib/catalog";
import { shortPkgPath } from "../lib/chain";
import { CopyLine } from "./CopyLine";
import { ItemArt } from "./ItemArt";
import { PriceMark } from "./PriceMark";

export type MarketSortKey = "floor" | "topOffer" | "floorPct" | "vol" | "sales" | "listed";

type Props = {
  collections: ExploreCollection[];
  markets: Map<string, CollectionMarket>;
  sort: MarketSortKey;
  dir: "asc" | "desc";
  onSort: (key: MarketSortKey) => void;
  onOpen: (slug: string) => void;
};

export function CollectionTable({ collections, markets, sort, dir, onSort, onOpen }: Props) {
  const ordered = collections.slice().sort((a, b) => {
    const ma = markets.get(a.slug);
    const mb = markets.get(b.slug);
    const av = value(ma, a, sort);
    const bv = value(mb, b, sort);
    const cmp = av === bv ? a.name.localeCompare(b.name) : av - bv;
    return dir === "asc" ? cmp : -cmp;
  });

  function head(key: MarketSortKey, label: string) {
    const active = sort === key;
    return (
      <th>
        <button type="button" className={active ? "is-active" : ""} onClick={() => onSort(key)}>
          {label}
          {active ? <span aria-hidden>{dir === "asc" ? " ↑" : " ↓"}</span> : null}
        </button>
      </th>
    );
  }

  return (
    <div className="market-table-wrap">
      <table className="market-table">
        <thead>
          <tr>
            <th className="num-col">#</th>
            <th>Collection</th>
            {head("floor", "Floor")}
            {head("topOffer", "Top Offer")}
            {head("floorPct", "Floor 7d %")}
            {head("vol", "Volume")}
            {head("sales", "Sales")}
            {head("listed", "Listed")}
          </tr>
        </thead>
        <tbody>
          {ordered.map((col, i) => {
            const m = markets.get(col.slug);
            const share = listedShare(m?.listed || 0, m?.supply || 0);
            const pct = m?.floorPct7d;
            return (
              <tr
                key={col.slug}
                tabIndex={0}
                onClick={() => onOpen(col.slug)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onOpen(col.slug);
                  }
                }}
              >
                <td className="num-col muted">{i + 1}</td>
                <td>
                  <span className="market-col-name">
                    <span className="market-thumb">
                      <ItemArt name={col.name} image={col.cover} alt="" />
                    </span>
                    <span className="market-col-copy">
                      <strong>{col.name}</strong>
                      {col.pkg ? (
                        <CopyLine display={shortPkgPath(col.pkg)} value={col.pkg} />
                      ) : null}
                    </span>
                  </span>
                </td>
                <td className="num">{m && m.floor > 0 ? <PriceMark ugnot={m.floor} /> : "—"}</td>
                <td className="num">{m && m.topOffer > 0 ? <PriceMark ugnot={m.topOffer} /> : "—"}</td>
                <td
                  className={`num ${pct == null ? "" : pct > 0 ? "is-up" : pct < 0 ? "is-down" : ""}`}
                >
                  {pct == null ? "—" : formatFloorPct(pct)}
                </td>
                <td className="num">{m && m.vol > 0 ? <PriceMark ugnot={m.vol} /> : "—"}</td>
                <td className="num">{m && m.sales > 0 ? m.sales.toLocaleString() : "—"}</td>
                <td className="num listed-stack">
                  {m && (m.listed > 0 || m.supply > 0) ? (
                    <>
                      <span className="listed-pct">{share.pct || "—"}</span>
                      <span className="listed-ratio muted">{share.ratio}</span>
                    </>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function value(m: CollectionMarket | undefined, col: ExploreCollection, key: MarketSortKey): number {
  if (!m) return 0;
  if (key === "floor") return m.floor || col.floor;
  if (key === "topOffer") return m.topOffer;
  if (key === "floorPct") return m.floorPct7d ?? Number.NEGATIVE_INFINITY;
  if (key === "vol") return m.vol;
  if (key === "sales") return m.sales;
  return m.listed;
}
