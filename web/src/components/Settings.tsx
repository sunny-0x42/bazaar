import { UGNOT, type Network } from "../lib/chain";
import { useEffect, useState } from "react";

type Props = {
  hub: string;
  nft: string;
  factory: string;
  connected: boolean;
  blocked: boolean;
  busy: boolean;
  onHub: (v: string) => void;
  onNft: (v: string) => void;
  onFactory: (v: string) => void;
  onConnect: () => void;
  onSeed: () => void;
  network: Network;
  onNetwork: (id: string) => void;
  isAdmin?: boolean;
  launchFeeUgnot?: number;
  adminReserveFree?: boolean;
  onSetLaunchFee?: (ugnot: number) => void;
};

export function Settings({
  hub,
  nft,
  factory,
  connected,
  blocked,
  busy,
  onHub,
  onNft,
  onFactory,
  onConnect,
  onSeed,
  network,
  onNetwork: _onNetwork,
  isAdmin,
  launchFeeUgnot = 0,
  adminReserveFree = false,
  onSetLaunchFee,
}: Props) {
  const [feeGnot, setFeeGnot] = useState("");
  useEffect(() => {
    setFeeGnot(launchFeeUgnot ? String(launchFeeUgnot / UGNOT) : "0");
  }, [launchFeeUgnot]);
  return (
    <section className="page">
      <header className="page-head">
        <h1>Settings</h1>
        <p className="muted">
          Network and package paths. Explore reads bazaarv2 collections. Frozen books (nft–nftv7) stay on-chain — paste
          a path to read one. Factory is bazaarv2; Adena collectables are each collection pkg, not the factory.
        </p>
      </header>

      <div className="panel form-narrow settings-panel">
        <div className="field-group">
          <h2>Network</h2>
          <p className="muted">
            {network.id === "onyx"
              ? "Onyx testnet (onyx-1). Adena stays on Onyx."
              : "gno.land mainnet (gnoland-1). Other networks are not offered in this UI."}
          </p>
        </div>

        <div className="field-group">
          <h2>Package paths</h2>
          <label>
            Hub package path
            <input className="mono" value={hub} onChange={(e) => onHub(e.target.value)} spellCheck={false} />
          </label>
          <label>
            NFT package path
            <input className="mono" value={nft} onChange={(e) => onNft(e.target.value)} spellCheck={false} />
          </label>
          <label>
            Factory package path
            <input className="mono" value={factory} onChange={(e) => onFactory(e.target.value)} spellCheck={false} />
            <span className="hint">
              Mainnet factory <span className="mono">…/bazaar/bazaarv2</span>. Each collection is its own realm at{" "}
              <span className="mono">…/bazaar/c/{"{slug}"}</span>.
            </span>
          </label>
        </div>

        {isAdmin && onSetLaunchFee ? (
          <div className="field-group">
            <h2>Launchpad create fee</h2>
            <p className="muted">
              Paid once when a wallet launches a collection. Live now: {launchFeeUgnot / UGNOT} GNOT.{" "}
              {adminReserveFree
                ? "This wallet reserves with an empty send. Other wallets pay the fee above."
                : "Every wallet, including this one, pays this fee on the current factory."}{" "}
              Admin can change the fee without a new package.
            </p>
            <label>
              Fee (GNOT)
              <input value={feeGnot} onChange={(e) => setFeeGnot(e.target.value)} inputMode="decimal" />
            </label>
            <button
              className="btn primary"
              type="button"
              disabled={blocked || busy || !feeGnot.trim() || Number(feeGnot) < 0}
              onClick={() => onSetLaunchFee(Math.round(Number(feeGnot) * UGNOT))}
            >
              Set create fee
            </button>
          </div>
        ) : null}

        <div className="field-group">
          <h2>Sample data</h2>
          <p className="muted">
            On local gnodev after Init, seed three sample collections (9 listed items) so Explore is a live book.
          </p>
          {connected ? (
            <button className="btn primary" type="button" disabled={blocked || busy} onClick={onSeed}>
              Seed sample collections
            </button>
          ) : (
            <button className="btn primary" type="button" onClick={onConnect}>
              Connect Adena to seed
            </button>
          )}
        </div>

        <div className="field-group">
          <h2>Endpoints</h2>
          <dl className="settings-meta">
            <div>
              <dt>RPC</dt>
              <dd className="mono">{network.rpcUrl}</dd>
            </div>
            {network.faucet ? (
              <div>
                <dt>Faucet</dt>
                <dd>
                  <a href={network.faucet} target="_blank" rel="noreferrer">
                    {network.faucet}
                  </a>
                </dd>
              </div>
            ) : null}
            <div>
              <dt>gnoweb</dt>
              <dd>
                <a href={network.gnoweb} target="_blank" rel="noreferrer">
                  {network.gnoweb}
                </a>
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}
