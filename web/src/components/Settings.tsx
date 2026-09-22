import { NETWORKS, UGNOT, type Network } from "../lib/chain";
import { Select } from "./Select";
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
  onNetwork,
  isAdmin,
  launchFeeUgnot = 0,
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
          Network and package paths. The UI reads GetModule("nft"), then GetModule("market"). Live default is nftv7.
          Frozen books (nft–nftv5) stay on-chain — paste a path to read one. Factory is the local collection
          registry at gno.land/r/bazaar/factory; Explore prefers factory rows when present.
        </p>
      </header>

      <div className="panel form-narrow settings-panel">
        <div className="field-group">
          <h2>Network</h2>
          <label>
            Chain
            <Select
              ariaLabel="Chain"
              value={network.id}
              onChange={onNetwork}
              options={NETWORKS.map((n) => ({
                value: n.id,
                label: `${n.chainName} (${n.chainId})`,
              }))}
            />
          </label>
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
              Local <span className="mono">gno.land/r/bazaar/factory</span>. Pearl{" "}
              <span className="mono">…/bazaar/factoryv2</span>. Each collection is its own realm
              (unique PackageAddress) at <span className="mono">gno.land/r/bazaar/c/{"{slug}"}</span>. Empty falls back
              to nftv7 Explore.
            </span>
          </label>
        </div>

        {isAdmin && onSetLaunchFee ? (
          <div className="field-group">
            <h2>Launchpad create fee</h2>
            <p className="muted">
              Paid once when a creator launches a collection. Live now: {launchFeeUgnot / UGNOT} GNOT. Admin can change
              this without a new package.
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
