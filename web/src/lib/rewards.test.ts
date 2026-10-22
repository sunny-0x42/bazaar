import { describe, expect, it } from "vitest";
import {
  REWARD_EXAMPLE_UGNOT,
  bpsPercent,
  countRevealedHold,
  claimShareLine,
  feeSaved,
  formatRewardGnotExact,
  formatUgnot,
  holderNotice,
  parsePerkRender,
  showLegacyClaim,
  protocolFee,
  rarityShareBps,
  rewardDiscountBps,
  rewardWeight,
  weightShareUgnot,
  type RewardDesk,
} from "./rewards";

const desk = (patch: Partial<RewardDesk>): RewardDesk => ({
  protocolBps: 200,
  shareBps: 1100,
  perkPkg: "",
  discountBps: 0,
  perkDiscountBps: 0,
  weight: 0,
  totalWeight: 0,
  accountedUgnot: 0,
  held: 0,
  sealed: false,
  countedBps: 0,
  countedWeight: 0,
  countedNfts: 0,
  poolUgnot: 0,
  claimUgnot: 0,
  epoch: false,
  unsettledUgnot: 0,
  epochs: 0,
  legacyPkg: "",
  legacyClaimUgnot: 0,
  syncIds: [],
  ...patch,
});

describe("holder notice", () => {
  it("explains a sealed hold without calling the wallet eligible", () => {
    const line = holderNotice(desk({ held: 1, sealed: true }), true);
    expect(line).toContain("holds 1 Bazaar Gens");
    expect(line).toContain("Not eligible yet");
    expect(line).toContain("still sealed");
    expect(holderNotice(desk({ held: 1, sealed: true }), false)).toBe("");
  });

  it("counts a revealed hold even when the perk realm is still zero", () => {
    const line = holderNotice(
      desk({ held: 1, countedBps: 25, countedWeight: 25, countedNfts: 1 }),
      true,
    );
    expect(line).toContain("Counted discount is 0.25% (Common)");
    expect(line).toContain("Share weight is 25");
    expect(line).toContain("The admin wallet records this onto Buy");
    expect(line).not.toContain("Not eligible yet");
    expect(line).not.toContain("perk record");
  });

  it("does not tell a revealed empty count to wait for reveal", () => {
    const line = holderNotice(desk({ held: 1, sealed: false }), true);
    expect(line).toContain("None are counted");
    expect(line).not.toContain("Reveal, then Sync");
  });
});

describe("revealed hold count", () => {
  it("uses the highest tier as the discount and adds the rest into share weight", () => {
    expect(rarityShareBps(" Common ")).toBe(25);
    expect(rarityShareBps("mythic")).toBe(150);
    expect(rarityShareBps("")).toBe(0);
    const one = countRevealedHold([{ rarity: "Common", revealed: true, listed: false }]);
    expect(one).toEqual({ discountBps: 25, weight: 25, counted: 1 });
    const stacked = countRevealedHold([
      { rarity: "Common", revealed: true, listed: false },
      { rarity: "Mythic", revealed: true, listed: false },
      { rarity: "Rare", revealed: false, listed: false },
      { rarity: "Legendary", revealed: true, listed: true },
      { rarity: "nope", revealed: true, listed: false },
    ]);
    expect(stacked).toEqual({ discountBps: 150, weight: 175, counted: 2 });
    const empty = desk({ countedBps: 25, countedWeight: 50 });
    expect(rewardDiscountBps(empty)).toBe(25);
    expect(rewardDiscountBps(desk({ discountBps: 150, countedBps: 25 }))).toBe(150);
    expect(rewardWeight(empty)).toBe(50);
    expect(rewardWeight(desk({ weight: 150, countedWeight: 50 }))).toBe(150);
  });
});

describe("rewards", () => {
  it("matches the realm fee split", () => {
    expect(protocolFee(REWARD_EXAMPLE_UGNOT, 200)).toBe(2_000_000);
    expect(protocolFee(1, 200)).toBe(0);
    expect(protocolFee(10_000, 200)).toBe(200);
    const saved = feeSaved(REWARD_EXAMPLE_UGNOT, 200, 150);
    expect(saved).toEqual({ chargedBps: 50, full: 2_000_000, charged: 500_000, saved: 1_500_000 });
    expect(feeSaved(REWARD_EXAMPLE_UGNOT, 200, 0).saved).toBe(0);
    expect(feeSaved(REWARD_EXAMPLE_UGNOT, 200, 500).chargedBps).toBe(0);
    const common = feeSaved(REWARD_EXAMPLE_UGNOT, 200, 25);
    expect(common).toEqual({ chargedBps: 175, full: 2_000_000, charged: 1_750_000, saved: 250_000 });
    expect(weightShareUgnot(1_000_000, 50, 100)).toBe(500_000);
  });

  it("splits the accounted pool by share weight", () => {
    expect(weightShareUgnot(1_100_000, 25, 100)).toBe(275_000);
    expect(weightShareUgnot(1_000, 0, 100)).toBe(0);
    expect(weightShareUgnot(1_000, 25, 0)).toBe(0);
    expect(bpsPercent(200)).toBe("2.00%");
    expect(bpsPercent(25)).toBe("0.25%");
  });

  it("reads the perk Render line", () => {
    expect(
      parsePerkRender('("# Bazaar perk\\n\\n- total weight: 175\\n- accounted: 2500000 ugnot\\n" string)'),
    ).toEqual({ totalWeight: 175, accountedUgnot: 2_500_000, unsettledUgnot: null, epochs: null });
    expect(parsePerkRender("")).toEqual({ totalWeight: 0, accountedUgnot: 0, unsettledUgnot: null, epochs: null });
    expect(
      parsePerkRender(
        '("# Bazaar perk2\\n\\n- total weight: 0\\n- accounted: 0 ugnot\\n- unsettled: 2456437 ugnot\\n- epochs: 0\\n" string)',
      ),
    ).toEqual({ totalWeight: 0, accountedUgnot: 0, unsettledUgnot: 2_456_437, epochs: 0 });
  });

  it("prints the claim at ugnot precision and keeps the weight percent off that amount", () => {
    expect(formatRewardGnotExact(2_398_000)).toBe("2.398000");
    expect(formatRewardGnotExact(1_000_000)).toBe("1.000000");
    expect(formatUgnot(2_398_000)).toBe("2,398,000");
    const line = claimShareLine({
      claimUgnot: 2_398_000,
      weight: 25,
      totalWeight: 400,
      countedWeight: 0,
      countedNfts: 0,
      usingCounted: false,
    });
    expect(line).toContain("2.398000 GNOT (2,398,000 ugnot)");
    expect(line).toContain("25 of 400");
    expect(line).toContain("6.25% of pool weight");
    const epoch = claimShareLine({
      claimUgnot: 0,
      weight: 0,
      totalWeight: 0,
      countedWeight: 25,
      countedNfts: 1,
      usingCounted: true,
      epoch: true,
      unsettledUgnot: 2_456_437,
      epochs: 0,
    });
    expect(epoch).toContain("Claim pays this wallet 0.000000 GNOT (0 ugnot).");
    expect(epoch).toContain("Unsettled pool is 2.456437 GNOT (2,456,437 ugnot).");
    expect(epoch).toContain("An admin Settle splits the unsettled pool");
    expect(epoch).not.toContain("first wallet");
    expect(epoch).not.toContain("stays with weight recorded earlier");
    const waiting = claimShareLine({
      claimUgnot: 0,
      weight: 0,
      totalWeight: 0,
      countedWeight: 0,
      countedNfts: 0,
      usingCounted: false,
      epoch: true,
      unsettledUgnot: 2_456_437,
      epochs: 0,
    });
    expect(waiting).toContain("Settle has not split this pool yet.");
    expect(showLegacyClaim("gno.land/r/demo/perk2", "gno.land/r/demo/perk", 1_000)).toBe(true);
    expect(showLegacyClaim("gno.land/r/demo/perk", "gno.land/r/demo/perk", 1_000)).toBe(false);
    expect(showLegacyClaim("gno.land/r/demo/perk2", "gno.land/r/demo/perk", 0)).toBe(false);
  });
});
