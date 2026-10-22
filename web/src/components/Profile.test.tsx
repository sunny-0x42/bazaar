import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LOCAL, type Item } from "../lib/chain";
import { Profile } from "./Profile";

const wallet = "g1holder000000000000000000000000000000";

function nft(id: string, listed = false): Item {
  return {
    id,
    name: `Bazaar Gens #${id}`,
    owner: wallet,
    seller: listed ? wallet : "",
    price: listed ? 2_000_000 : 0,
    listed,
    image: "/og.jpg",
    collection: "bazaargens",
    rarity: "Common",
    traits: "",
    revealed: true,
    slot: Number(id),
  };
}

describe("Profile wallet list", () => {
  it("checks every unlisted wallet NFT and offers one list action", () => {
    const html = renderToStaticMarkup(
      <Profile
        address={wallet}
        network={LOCAL}
        connected
        wallet={wallet}
        items={[nft("206"), nft("207"), nft("208", true)]}
        created={[]}
        activity={[]}
        blocked={false}
        busy={false}
        onConnect={() => undefined}
        onCancel={() => undefined}
        onOpenTab={() => undefined}
        onOpenCollection={() => undefined}
        onBuy={() => undefined}
        onListWallet={() => undefined}
      />,
    );
    expect(html).toContain("List wallet");
    expect(html).toContain("2 of 2 still in the wallet");
    expect(html).toContain(">List 2<");
    expect(html).toContain('aria-label="Remove #206 from wallet list"');
    expect(html).toContain('aria-pressed="true"');
    expect(html).not.toContain('aria-label="Include #208 in wallet list"');
  });
});
