import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { RewardsPage } from "./RewardsPage";
import type { RewardDesk } from "../lib/rewards";

const desk: RewardDesk = {
  protocolBps: 200,
  shareBps: 1100,
  perkPkg: "gno.land/r/demo/perk",
  discountBps: 150,
  perkDiscountBps: 150,
  weight: 150,
  totalWeight: 300,
  accountedUgnot: 2_000_000,
  held: 1,
  sealed: false,
  countedBps: 0,
  countedWeight: 0,
  countedNfts: 0,
  poolUgnot: 2_000_000,
  claimUgnot: 1_000_000,
  epoch: false,
  unsettledUgnot: 0,
  epochs: 0,
  legacyPkg: "",
  legacyClaimUgnot: 0,
  syncIds: [],
};

describe("RewardsPage", () => {
  it("shows the fee saved on 100 GNOT and the weight share of the pool", () => {
    const html = renderToStaticMarkup(
      <RewardsPage
        rpc=""
        factory=""
        address="g1abc"
        collection=""
        connected
        blocked={false}
        busy={false}
        onConnect={() => undefined}
        onClaim={async () => false}
        onSync={async () => false}
        preview={desk}
      />,
    );
    expect(html).toContain("Rewards");
    expect(html).toContain("Protocol fee skipped");
    expect(html).toContain("1.50 GNOT");
    expect(html).toContain("1.000000 GNOT");
    expect(html).toContain("1,000,000 ugnot");
    expect(html).toContain("Claim pays this wallet 1.000000 GNOT (1,000,000 ugnot).");
    expect(html).toContain("Recorded weight is 150 of 300");
    expect(html).toContain('data-saved="1500000"');
    expect(html).toContain('data-charged="500000"');
    expect(html).toContain('data-pool="2000000"');
    expect(html).toContain('data-claim="1000000"');
    expect(html).toContain("You can claim");
    expect(html).toContain(">Pool<");
    expect(html).toContain("50% of pool weight");
    expect(html).toContain("buyer still pays the full list price");
    expect(html).toContain("not the mint price");
    expect(html).toContain("seller receives");
    expect(html).toContain("not a count of NFTs");
    expect(html).toContain("after the holder discount");
    expect(html).toContain('data-eligible="yes"');
    expect(html).toContain("This wallet is eligible.");
    expect(html).toContain(">Claim<");
    expect(html).not.toContain("Your discount brings it");
  });

  it("does not present a zero discount as money already saved", () => {
    const html = renderToStaticMarkup(
      <RewardsPage
        rpc=""
        factory=""
        address=""
        collection=""
        connected={false}
        blocked={false}
        busy={false}
        onConnect={() => undefined}
        onClaim={async () => false}
        onSync={async () => false}
        preview={{ ...desk, discountBps: 0, perkDiscountBps: 0, weight: 0, accountedUgnot: 0, poolUgnot: 0, claimUgnot: 0 }}
      />,
    );
    expect(html).toContain("Protocol fee");
    expect(html).toContain("2.00 GNOT");
    expect(html).toContain("Connect Adena to read this wallet");
    expect(html).toContain("not the mint price");
    expect(html).not.toContain("Protocol fee skipped");
    expect(html).not.toContain("1.50 GNOT");
    expect(html).toContain("not a personal balance");
    expect(html).not.toContain("This wallet is eligible");
    expect(html).not.toContain("This wallet is not eligible");
  });

  it("tells a synced-empty holder that holding the NFT is not enough", () => {
    const html = renderToStaticMarkup(
      <RewardsPage
        rpc=""
        factory=""
        address="g1abc"
        collection=""
        connected
        blocked={false}
        busy={false}
        onConnect={() => undefined}
        onClaim={async () => false}
        onSync={async () => false}
        preview={{ ...desk, discountBps: 0, perkDiscountBps: 0, weight: 0, accountedUgnot: 0, poolUgnot: 0, claimUgnot: 0, held: 0, sealed: false }}
      />,
    );
    expect(html).toContain('data-eligible="no"');
    expect(html).toContain("This wallet is not eligible.");
    expect(html).toContain("It does not hold a Bazaar Gens NFT.");
    expect(html).toContain("Claim pays this wallet 0.000000 GNOT (0 ugnot).");
    expect(html).toContain("This wallet has no recorded weight.");
    expect(html).toContain("The deploy wallet records weight from Admin");
    expect(html).not.toContain("Protocol fee skipped");
  });

  it("says the perk record is eligible before Buy has caught up", () => {
    const html = renderToStaticMarkup(
      <RewardsPage
        rpc=""
        factory=""
        address="g1abc"
        collection=""
        connected
        blocked={false}
        busy={false}
        onConnect={() => undefined}
        onClaim={async () => false}
        onSync={async () => false}
        preview={{ ...desk, discountBps: 0, perkDiscountBps: 25, weight: 25 }}
      />,
    );
    expect(html).toContain('data-eligible="yes"');
    expect(html).toContain("This wallet is eligible on the perk record.");
    expect(html).not.toContain("This wallet is not eligible.");
  });

  it("tells a sealed holder why the NFT is not eligible yet", () => {
    const html = renderToStaticMarkup(
      <RewardsPage
        rpc=""
        factory=""
        address="g1abc"
        collection=""
        connected
        blocked={false}
        busy={false}
        onConnect={() => undefined}
        onClaim={async () => false}
        onSync={async () => false}
        preview={{ ...desk, discountBps: 0, perkDiscountBps: 0, weight: 0, held: 1, sealed: true }}
      />,
    );
    expect(html).toContain('data-eligible="no"');
    expect(html).toContain('data-held="1"');
    expect(html).toContain("This wallet holds 1 Bazaar Gens.");
    expect(html).toContain("still sealed");
    expect(html).not.toContain("This wallet is eligible.");
  });

  it("shows the discount and share weight counted from revealed NFTs before Sync", () => {
    const html = renderToStaticMarkup(
      <RewardsPage
        rpc=""
        factory=""
        address="g1abc"
        collection=""
        connected
        blocked={false}
        busy={false}
        onConnect={() => undefined}
        onClaim={async () => false}
        onSync={async () => false}
        preview={{
          ...desk,
          discountBps: 0,
          perkDiscountBps: 0,
          weight: 0,
          totalWeight: 0,
          accountedUgnot: 0,
          held: 1,
          countedBps: 25,
          countedWeight: 25,
          countedNfts: 1,
          poolUgnot: 2_398_000,
          claimUgnot: 0,
          syncIds: [119],
        }}
      />,
    );
    expect(html).toContain('data-eligible="yes"');
    expect(html).toContain('data-counted="25"');
    expect(html).toContain('data-counted-weight="25"');
    expect(html).toContain("Protocol fee this discount skips");
    expect(html).toContain("0.25 GNOT");
    expect(html).toContain("1.75 GNOT");
    expect(html).toContain('data-saved="250000"');
    expect(html).toContain("Counted discount is 0.25% (Common)");
    expect(html).toContain("Share weight is 25");
    expect(html).toContain("Counted Share weight is 25 from 1 revealed NFT");
    expect(html).toContain("Claim pays this wallet 0.000000 GNOT (0 ugnot).");
    expect(html).toContain("stays with weight recorded earlier");
    expect(html).toContain("Counted weight");
    expect(html).toContain("The admin wallet records this discount onto the factory");
    expect(html).not.toContain(">Sync NFT<");
    expect(html).not.toContain(">Sync 1 NFT<");
    expect(html).toContain("claimable by the first wallet recorded");
    expect(html).toContain("buyer still pays the full list price");
    expect(html).not.toContain("Protocol fee skipped");
    expect(html).not.toContain("This wallet is not eligible.");
    expect(html).not.toContain("Not eligible yet");
  });

  it("shows an unsettled perk2 pool and a separate earlier-pool Claim", () => {
    const html = renderToStaticMarkup(
      <RewardsPage
        rpc=""
        factory=""
        address="g1abc"
        collection=""
        connected
        blocked={false}
        busy={false}
        onConnect={() => undefined}
        onClaim={async () => false}
        onSync={async () => false}
        preview={{
          ...desk,
          perkPkg: "gno.land/r/demo/perk2",
          discountBps: 0,
          perkDiscountBps: 0,
          weight: 0,
          totalWeight: 0,
          accountedUgnot: 0,
          held: 1,
          countedBps: 25,
          countedWeight: 25,
          countedNfts: 1,
          poolUgnot: 2_456_437,
          claimUgnot: 0,
          epoch: true,
          unsettledUgnot: 2_456_437,
          epochs: 0,
          legacyPkg: "gno.land/r/demo/perk",
          legacyClaimUgnot: 100_000,
          syncIds: [92],
        }}
      />,
    );
    expect(html).toContain("2.456437");
    expect(html).toContain("GNOT unsettled");
    expect(html).toContain("Unsettled pool is 2.456437 GNOT (2,456,437 ugnot).");
    expect(html).toContain("An admin Settle splits the unsettled pool across recorded weight.");
    expect(html).toContain("The deploy wallet records weight from Admin");
    expect(html).toContain("Claim earlier pool");
    expect(html).toContain('data-legacy-claim="100000"');
    expect(html).toContain("Earlier pool pays this wallet 0.100000 GNOT");
    expect(html).not.toContain("claimable by the first wallet recorded");
    expect(html).not.toContain("stays with weight recorded earlier");
  });
});
