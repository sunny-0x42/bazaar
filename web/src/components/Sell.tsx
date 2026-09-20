import { protocolFeeLabel, protocolFeeUgnot, ugnotFromGnot, type Item } from "../lib/chain";
import { PriceMark } from "./PriceMark";
import { EmptyState } from "./EmptyState";
import { ItemArt } from "./ItemArt";
import { Select } from "./Select";
import type { Tab } from "./types";

type Props = {
  items: Item[];
  listId: string;
  listPrice: string;
  connected: boolean;
  blocked: boolean;
  busy: boolean;
  onId: (v: string) => void;
  onPrice: (v: string) => void;
  onList: () => void;
  onConnect: () => void;
  onOpenTab: (tab: Tab) => void;
};

export function Sell({
  items,
  listId,
  listPrice,
  connected,
  blocked,
  busy,
  onId,
  onPrice,
  onList,
  onConnect,
  onOpenTab,
}: Props) {
  const priceUgnot = ugnotFromGnot(listPrice);
  const fee = protocolFeeUgnot(priceUgnot);
  const receive = Math.max(0, priceUgnot - fee);
  const selected = items.find((row) => row.id === listId);
  const updating = !!selected?.listed;
  const canList = !!selected && priceUgnot > 0;

  return (
    <section className="page">
      <header className="page-head">
        <h1>{updating ? "Update price" : "List an item"}</h1>
        <p className="muted">
          {updating
            ? "Change the GNOT price on your listing. The item stays in escrow."
            : "Unlisted items you own. Listing escrows the item at a fixed GNOT price."}
        </p>
      </header>

      {!connected ? (
        <EmptyState title="Connect Adena" body="Connect a wallet to list an item you own.">
          <button className="btn primary" type="button" onClick={onConnect}>
            Connect Adena
          </button>
        </EmptyState>
      ) : null}

      {connected && items.length === 0 ? (
        <EmptyState title="No unlisted items" body="Mint from a drop first, then set a GNOT price here.">
          <button className="btn primary" type="button" onClick={() => onOpenTab("create")}>
            Launch
          </button>
        </EmptyState>
      ) : null}

      {connected && items.length > 0 ? (
        <div className="two-col sell-layout">
          <form
            className="panel"
            onSubmit={(e) => {
              e.preventDefault();
              if (canList) onList();
            }}
          >
            <h2>{updating ? "Your listing" : "List item"}</h2>
            {selected ? (
              <div className="sell-preview">
                <span className="market-thumb">
                  <ItemArt name={selected.name} image={selected.image} alt="" />
                </span>
                <div>
                  <strong>{selected.name}</strong>
                  <p className="muted">
                    #{selected.id} · {selected.collection || "bazaar"}
                    {selected.rarity ? ` · ${selected.rarity}` : ""}
                  </p>
                </div>
              </div>
            ) : null}
            <label>
              Item
              <Select
                ariaLabel="Item"
                value={listId}
                onChange={onId}
                options={items.map((row) => ({
                  value: row.id,
                  label: `#${row.id} ${row.name}`,
                }))}
              />
            </label>
            <label>
              Price (GNOT)
              <input value={listPrice} onChange={(e) => onPrice(e.target.value)} inputMode="decimal" placeholder="e.g. 1.5" />
            </label>
            <button className="btn primary btn-block" type="submit" disabled={blocked || busy || !canList}>
              {updating ? "Update price" : "List"}
            </button>
          </form>

          <aside className="panel math-panel">
            <h2>You receive</h2>
            <dl className="featured-stats sell-math">
              <div>
                <dt>Buyer pays</dt>
                <dd>
                  <PriceMark ugnot={priceUgnot} />
                </dd>
              </div>
              <div>
                <dt>Protocol ({protocolFeeLabel()})</dt>
                <dd>
                  <PriceMark ugnot={fee} />
                </dd>
              </div>
              <div>
                <dt>You get</dt>
                <dd className="pay">
                  <PriceMark ugnot={receive} />
                </dd>
              </div>
            </dl>
            <p className="hint">50 bps is included in the listed price. No royalty.</p>
          </aside>
        </div>
      ) : null}
    </section>
  );
}
