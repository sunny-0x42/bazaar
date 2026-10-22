import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { BAZAAR_GENS_MINT_SLUG, MAINNET, mintHash } from "../lib/chain";
import { BottomNav } from "./BottomNav";
import { Explore } from "./Explore";
import { Header } from "./Header";
import { PRIMARY_NAV, activatePrimary, primaryNavActive } from "./nav";

function activeNavLabels(html: string, aria: string): string[] {
  const nav = html.match(new RegExp(`<nav\\b[^>]*aria-label="${aria}"[^>]*>[\\s\\S]*?</nav>`));
  expect(nav, aria).toBeTruthy();
  const labels: string[] = [];
  const re = /<button\b([^>]*)>([\s\S]*?)<\/button>/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(nav![0]))) {
    if (!/\bclass="[^"]*\bactive\b/.test(match[1])) continue;
    labels.push(match[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
  }
  return labels;
}

describe("Bazaar Gens nav", () => {
  it("opens the mint desk instead of the whitelist page", () => {
    const item = PRIMARY_NAV.find((row) => row.label === "Bazaar Gens");
    expect(item?.mintSlug).toBe(BAZAAR_GENS_MINT_SLUG);
    expect(mintHash(BAZAAR_GENS_MINT_SLUG)).toBe("#/m/bazaargens");
    const tabs: string[] = [];
    const mints: string[] = [];
    activatePrimary(item!, {
      onTab: (tab) => tabs.push(tab),
      onExploreHome: () => tabs.push("home"),
      onOpenMint: (slug) => mints.push(slug),
    });
    expect(mints).toEqual(["bazaargens"]);
    expect(tabs).toEqual([]);
  });

  it("keeps four primary items and highlights Bazaar Gens only on its mint page", () => {
    expect(PRIMARY_NAV.map((row) => row.label)).toEqual(["Explore", "Bazaar Gens", "Rewards", "Profile"]);
    const gens = PRIMARY_NAV.find((row) => row.label === "Bazaar Gens")!;
    const rewards = PRIMARY_NAV.find((row) => row.label === "Rewards")!;
    expect(primaryNavActive(gens, "create", "bazaargens")).toBe(true);
    expect(primaryNavActive(rewards, "create", "bazaargens")).toBe(false);
    expect(primaryNavActive(gens, "rewards", "")).toBe(false);
    expect(primaryNavActive(rewards, "rewards", "")).toBe(true);
  });

  it("marks the same item active in the header and the mobile nav", () => {
    const noop = () => undefined;
    const props = {
      tab: "create" as const,
      mintSlug: "bazaargens",
      onTab: noop,
      onExploreHome: noop,
      onOpenMint: noop,
    };
    const header = renderToStaticMarkup(
      <Header
        {...props}
        query=""
        connected={false}
        onQuery={noop}
        onConnect={noop}
        onDisconnect={noop}
        network={MAINNET}
        onNetwork={noop}
      />,
    );
    const mobile = renderToStaticMarkup(<BottomNav {...props} />);
    expect(activeNavLabels(header, "Primary")).toEqual(["Bazaar Gens"]);
    expect(activeNavLabels(mobile, "Mobile")).toEqual(["Bazaar Gens"]);
  });

  it("keeps the home Bazaar Gens button on the explore page", () => {
    const html = renderToStaticMarkup(
      <Explore
        items={[]}
        chainCollections={[]}
        collectionItems={null}
        collectionActivity={null}
        slug=""
        onSlug={() => undefined}
        query=""
        onQuery={() => undefined}
        loading={false}
        chainNote=""
        connected={false}
        blocked={false}
        busy={false}
        onOpenTab={() => undefined}
        onBuy={() => undefined}
        onSell={() => undefined}
        onCancel={() => undefined}
        onConnect={() => undefined}
        itemId=""
        onItemId={() => undefined}
        factoryOnly
        onOpenMint={() => undefined}
      />,
    );
    expect(html).toContain(">Bazaar Gens · 1,111<");
  });
});
