import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ChainCollection, DropSale } from "../lib/chain";
import { MintPage } from "./MintPage";

function drop(pkg = "gno.land/r/g1n4pl5uc4yt5r96m9w6fmdznx3x0jyg8l6arhmt/bazaar/c/bazaargens"): ChainCollection {
  return {
    slug: "bazaargens",
    name: "Bazaar Gens",
    cover: "",
    count: 0,
    mintPrice: 200_000_000,
    maxSupply: 1111,
    minted: 0,
    creator: "g1creator",
    paused: false,
    drop: true,
    bio: "",
    pkg,
  };
}

function sale(now: number, wlStart: number): DropSale {
  return {
    royaltyBps: 200,
    wlPrice: 100_000_000,
    wlSupply: 333,
    phase: "closed",
    mintPrice: 200_000_000,
    wlStart,
    wlEnd: now + 4 * 3600,
    publicStart: now + 5 * 3600,
    publicEnd: now + 24 * 3600,
  };
}

function html(now: number, wlStart: number, allowlisted: boolean | null) {
  return renderToStaticMarkup(
    <MintPage
      drop={drop()}
      slug="bazaargens"
      loaded={1111}
      allowN={1}
      mintCap={0}
      mintWlCap={1}
      mintPubCap={3}
      sale={sale(now, wlStart)}
      connected
      allowlisted={allowlisted}
      blocked={false}
      busy={false}
      onMint={() => {}}
      onConnect={() => {}}
      onOpenCollection={() => {}}
      onBack={() => {}}
    />,
  );
}

describe("MintPage whitelist mint button", () => {
  const now = Math.floor(Date.now() / 1000);

  it("shows the eligible line and a countdown button before whitelist opens", () => {
    const body = html(now, now + 90, true);
    expect(body).toContain("Eligible for whitelist");
    expect(body).toContain("Mint in ");
    expect(body).toContain("1 per wallet this round");
    expect(body).toContain('data-mint-max="1"');
    expect(body).toContain("disabled");
  });

  it("enables Mint on the open second from the same closed fetch", () => {
    const body = html(now, now - 5, true);
    expect(body).toContain("Eligible for whitelist");
    expect(body).not.toContain("Mint in ");
    expect(body).toContain("Mint 1 · 100.00 GNOT");
    expect(body).toContain('data-mint-max="1"');
    const wl = body.indexOf("<h3>Whitelist</h3>");
    const qty = body.indexOf('aria-label="Mint quantity"');
    const supply = body.indexOf("<dt>Supply</dt>");
    const pub = body.indexOf("<h3>Public</h3>");
    expect(qty).toBeGreaterThan(wl);
    expect(supply).toBeGreaterThan(qty);
    expect(pub).toBeGreaterThan(qty);
    expect(body).toContain('aria-label="Increase quantity" disabled=""');
    expect(body).toContain('class="btn primary btn-block" type="button">Mint 1 · 100.00 GNOT');
  });

  it("hides the eligible line and the mint button for a wallet that is not listed", () => {
    const waiting = html(now, now + 90, false);
    expect(waiting).not.toContain("Eligible for whitelist");
    expect(waiting).toContain("Whitelist opens ");
    const open = html(now, now - 5, false);
    expect(open).toContain("This wallet is not on the whitelist.");
    expect(open).not.toContain(">Mint<");
    expect(open).not.toContain("Mint quantity");
  });

  it("leaves three public mints when the whitelist mint does not count", () => {
    const body = renderToStaticMarkup(
      <MintPage
        drop={drop()}
        slug="bazaargens"
        loaded={1111}
        allowN={1}
        mintCap={0}
        mintWlCap={1}
        mintPubCap={3}
        sale={{
          ...sale(now, now - 20 * 3600),
          wlEnd: now - 6 * 3600,
          publicStart: now - 5 * 3600,
          publicEnd: now + 3600,
        }}
        connected
        allowlisted={true}
        blocked={false}
        busy={false}
        walletWl={1}
        walletPub={1}
        onMint={() => {}}
        onConnect={() => {}}
        onOpenCollection={() => {}}
        onBack={() => {}}
      />,
    );
    expect(body).toContain('data-mint-max="2"');
    expect(body).toContain("1 minted this round · 2 left");
    expect(body).toContain("Mint 1 · 200.00 GNOT");
    expect(body).not.toContain("Eligible for whitelist");
    expect(body.indexOf('aria-label="Mint quantity"')).toBeGreaterThan(body.indexOf("<h3>Public</h3>"));
  });

  it("replaces the mint button when this wallet already used the round", () => {
    const body = renderToStaticMarkup(
      <MintPage
        drop={drop()}
        slug="bazaargens"
        loaded={1111}
        allowN={1}
        mintCap={0}
        mintWlCap={1}
        mintPubCap={3}
        sale={sale(now, now - 5)}
        connected
        allowlisted={true}
        blocked={false}
        busy={false}
        walletWl={1}
        onMint={() => {}}
        onConnect={() => {}}
        onOpenCollection={() => {}}
        onBack={() => {}}
      />,
    );
    expect(body).toContain("This wallet has reached the mint cap for this round.");
    expect(body).toContain('data-mint-max="0"');
    expect(body).toContain('aria-label="Mint quantity"');
    expect(body).toContain('aria-label="Increase quantity" disabled=""');
    expect(body).not.toContain("Mint 1");
  });

  it("hides mint when the realm is not a launchpad copy", () => {
    const body = renderToStaticMarkup(
      <MintPage
        drop={drop("gno.land/r/g1t2kg2vtr3fukg43eujkn6x53gfdyakhngt4sfd/gnofly/nfts/market/bazaar/v1/gnofly")}
        slug="bazaargens"
        loaded={1111}
        allowN={1}
        mintCap={0}
        mintWlCap={1}
        mintPubCap={3}
        sale={sale(now, now - 5)}
        connected
        allowlisted={true}
        blocked={false}
        busy={false}
        onMint={() => {}}
        onConnect={() => {}}
        onOpenCollection={() => {}}
        onBack={() => {}}
      />,
    );
    expect(body).toContain("Mint is not on Nomaq");
    expect(body).toContain("This collection mints outside the launchpad.");
    expect(body).not.toContain("Eligible for whitelist");
  });
});
