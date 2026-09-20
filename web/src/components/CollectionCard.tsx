import type { ExploreCollection } from "../lib/catalog";
import { ItemArt } from "./ItemArt";
import { PriceMark } from "./PriceMark";

type Props = {
  collection: ExploreCollection;
  onOpen: (slug: string) => void;
};

export function CollectionCard({ collection, onOpen }: Props) {
  const count = collection.itemCount;
  const countLabel = `${count} ${count === 1 ? "item" : "items"}`;
  const showFloor = collection.floor > 0;
  const showMint = !showFloor && collection.maxSupply > 0;

  return (
    <article
      className="collection-card"
      role="button"
      tabIndex={0}
      aria-label={`Open ${collection.name}`}
      onClick={() => onOpen(collection.slug)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(collection.slug);
        }
      }}
    >
      <ItemArt name={collection.name} image={collection.cover} alt="" />
      <h2>{collection.name}</h2>
      {showFloor ? (
        <div className="listing-price">
          <PriceMark ugnot={collection.floor} />
        </div>
      ) : showMint ? (
        <div className="listing-price">
          Mint <PriceMark ugnot={collection.mintPrice} />
        </div>
      ) : null}
      <div className="collection-meta">
        <span className="muted">{countLabel}</span>
      </div>
    </article>
  );
}
