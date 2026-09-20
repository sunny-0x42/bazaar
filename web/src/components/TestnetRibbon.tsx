import type { Network } from "../lib/chain";

export function TestnetRibbon({ network }: { network: Network }) {
  const copy =
    network.id === "local"
      ? "Local gnodev — Init the NFT realm, then Seed sample collections to buy and sell."
      : "Pearl testnet (pearl-1) — test GNOT has no market value.";
  return (
    <div className="testnet-ribbon" role="status">
      {copy}
    </div>
  );
}
