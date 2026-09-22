import { useState } from "react";
import { itemRowKey, SWEEP_CAP, type Item } from "../lib/chain";
import { ItemArt } from "./ItemArt";
import { PriceMark } from "./PriceMark";

export type CheckoutResult = { ok: boolean; preview?: boolean; error?: string };

type Props = {
  items: Item[];
  connected: boolean;
  busy: boolean;
  onRemove: (id: string) => void;
  onClear: () => void;
  onCheckout: () => Promise<CheckoutResult>;
  onConnect: () => void;
};

export function CartBar({ items, connected, busy, onRemove, onClear, onCheckout, onConnect }: Props) {
  const [status, setStatus] = useState("");
  const [working, setWorking] = useState(false);
  if (items.length === 0) return null;
  const total = items.reduce((s, it) => s + it.price, 0);
  const liveN = items.filter((it) => !!it.id).length;
  const previewN = items.length - liveN;

  async function handleCheckout() {
    setStatus("");
    if (!connected) {
      onConnect();
      setStatus("Connect Adena, then tap Checkout again.");
      return;
    }
    setWorking(true);
    try {
      const res = await onCheckout();
      if (res.ok && res.preview) {
        setStatus("Done. Preview listings are not on nftv7, so nothing was swept on-chain.");
        window.setTimeout(() => onClear(), 2200);
        return;
      }
      if (res.ok) {
        setStatus("Checkout submitted. Sign in Adena if a prompt is open.");
        return;
      }
      setStatus(res.error || "Checkout failed.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="cart-sheet" role="dialog" aria-label="Cart checkout">
      <header className="cart-sheet-head">
        <strong>Cart</strong>
        <span className="muted">
          {items.length}/{SWEEP_CAP}
        </span>
      </header>
      <ul className="cart-sheet-list">
        {items.map((it) => (
          <li key={itemRowKey(it)}>
            <span className="cart-sheet-thumb">
              <ItemArt name={it.name} image={it.image} size={40} alt="" />
            </span>
            <span className="cart-sheet-copy">
              <strong>{it.name}</strong>
              <span className="muted">{it.id ? `#${it.id}` : "Preview"}</span>
            </span>
            <PriceMark ugnot={it.price} size={13} />
            <button className="icon-btn" type="button" aria-label={`Remove ${it.name}`} onClick={() => onRemove(itemRowKey(it))}>
              ×
            </button>
          </li>
        ))}
      </ul>
      <footer className="cart-sheet-foot">
        <div className="cart-sheet-total">
          <span className="muted">Total</span>
          <PriceMark ugnot={total} size={16} />
        </div>
        {previewN > 0 ? (
          <p className="cart-sheet-hint">
            {liveN > 0
              ? `${previewN} preview item${previewN === 1 ? "" : "s"} skipped on-chain. ${liveN} live item${liveN === 1 ? "" : "s"} will Sweep.`
              : "Preview listings only. Checkout will not send a Sweep tx."}
          </p>
        ) : null}
        {status ? <p className="cart-sheet-status">{status}</p> : null}
        <div className="cart-sheet-actions">
          <button className="btn" type="button" onClick={onClear} disabled={working}>
            Clear
          </button>
          <button className="btn primary" type="button" disabled={working || busy || items.length < 1} onClick={() => void handleCheckout()}>
            {working ? "Working…" : connected ? "Checkout" : "Connect to checkout"}
          </button>
        </div>
      </footer>
    </div>
  );
}
