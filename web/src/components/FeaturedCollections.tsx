import { listedShare, type CollectionMarket, type ExploreCollection } from "../lib/catalog";
import { isOpenEdition, isPublicDrop } from "../lib/chain";
import { ItemArt } from "./ItemArt";
import { PriceMark } from "./PriceMark";

type Props = {
  collections: ExploreCollection[];
  markets: Map<string, CollectionMarket>;
  onOpen: (slug: string) => void;
};

export function FeaturedCollections({ collections, markets, onOpen }: Props) {

  if (collections.length === 0) return null;
  return (
    <section className="market-section">
      <h2 className="section-title">Featured</h2>
      <div className="featured-grid">
        {collections.map((col) => {
          const m = markets.get(col.slug);
          const floor = m && m.floor > 0 ? m.floor : col.floor;
          const share = listedShare(m?.listed || 0, m?.supply || 0);
          return (
            <article
              key={col.slug}
              className="featured-card"
              role="button"
              tabIndex={0}
              aria-label={`Open ${col.name}`}
              onClick={() => onOpen(col.slug)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onOpen(col.slug);
                }
              }}
            >
              <div className="featured-cover">
                <ItemArt name={col.name} image={col.cover} alt="" />
              </div>
              <div className="featured-body">
                <h3>
                  {col.name}
                  {isPublicDrop(col) && (isOpenEdition(col) || col.minted < col.maxSupply) ? (
                    <span className="tag">{col.paused ? "Paused" : "Mint"}</span>
                  ) : null}
                </h3>
                <dl className="featured-stats">
                  <div>
                    <dt>Floor</dt>
                    <dd className="num">{floor > 0 ? <PriceMark ugnot={floor} /> : "—"}</dd>
                  </div>
                  <div>
                    <dt>Vol</dt>
                    <dd className="num">{m && m.vol > 0 ? <PriceMark ugnot={m.vol} /> : "—"}</dd>
                  </div>
                  <div>
                    <dt>Listed</dt>
                    <dd className="num listed-stack">
                      <span className="listed-pct">{share.pct || "—"}</span>
                      <span className="listed-ratio muted">{share.ratio}</span>
                    </dd>
                  </div>
                </dl>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
