import { describe, expect, it } from "vitest";
import { formatUtcMinute, parseEvalBool, type DropSale } from "./chain";
import {
  clampMintQty,
  collectionShowsRounds,
  formatRoundCountdown,
  mintButtonLabel,
  mintClosedNote,
  mintDesk,
  countMintsInHeightRange,
  firstBlockAtOrAfter,
  mintLookbackHeight,
  narrowHeightWindow,
  mintQtyLimit,
  mergeMintedCount,
  mintQtyNote,
  launchpadEnded,
  mintRoundCards,
  previewDropSale,
  roundCardCountdown,
  roundCountdown,
  roundMintFill,
  whitelistMintedAtClose,
  roundVisibleCountdown,
  splitPhaseMints,
  type MintDeskInput,
} from "./mintrounds";

/** 2026-09-28 00:00 UTC. Whitelist opens on this second. */
const WL_START = 1_790_553_600;
const WL_END = WL_START + 12 * 3600;
const PUBLIC_END = WL_END + 24 * 3600;

function sale(over: Partial<DropSale> = {}): DropSale {
  return {
    royaltyBps: 500,
    wlPrice: 500_000,
    wlSupply: 333,
    phase: "whitelist",
    mintPrice: 1_000_000,
    wlStart: WL_START,
    wlEnd: WL_END,
    publicStart: WL_END,
    publicEnd: 0,
    ...over,
  };
}

describe("launchpadEnded", () => {
  const now = WL_START + 48 * 3600;
  it("closes after publicEnd and after a whitelist-only window", () => {
    expect(launchpadEnded({ publicStart: WL_END, publicEnd: PUBLIC_END }, now)).toBe(true);
    expect(launchpadEnded({ publicStart: WL_END, publicEnd: PUBLIC_END }, PUBLIC_END - 1)).toBe(false);
    expect(launchpadEnded({ publicStart: WL_END, publicEnd: PUBLIC_END }, PUBLIC_END)).toBe(true);
    expect(launchpadEnded({ wlEnd: WL_END }, WL_END)).toBe(true);
    expect(launchpadEnded({ wlEnd: WL_END, publicStart: WL_END + 60 }, WL_END + 10)).toBe(false);
    expect(launchpadEnded({ publicEnd: 0, wlEnd: 0 }, now)).toBe(false);
  });
});

describe("previewDropSale", () => {
  const now = WL_START + 24 * 3600;
  const publicStart = WL_START + 8 * 24 * 3600;

  it("keeps whitelist live until the public start", () => {
    const saleRow = previewDropSale({
      now,
      royaltyBps: 0,
      mintPrice: 20_000_000,
      saleDual: true,
      wlPrice: 500_000,
      wlSupply: 333,
      wlStart: WL_START,
      wlEnd: 0,
      publicStart,
      publicEnd: 0,
    });
    expect(saleRow.phase).toBe("whitelist");
    const cards = mintRoundCards({
      now,
      maxSupply: 1111,
      mintPrice: 20_000_000,
      sale: saleRow,
    });
    expect(cards[0]).toMatchObject({ title: "Whitelist", state: "live", priceUgnot: 500_000, supply: "333 NFTs" });
    expect(cards[1]).toMatchObject({ title: "Public", state: "upcoming", priceUgnot: 20_000_000, opens: formatUtcMinute(publicStart) });
  });
});

describe("mintRoundCards", () => {
  it("treats the start second as live and keeps both clocks", () => {
    const cards = mintRoundCards({
      now: WL_START,
      maxSupply: 1111,
      mintPrice: 1_000_000,
      mintWlCap: 2,
      mintPubCap: 5,
      sale: sale(),
    });
    expect(cards.map((row) => row.id)).toEqual(["whitelist", "public"]);
    expect(cards[0]).toMatchObject({
      title: "Whitelist",
      state: "live",
      stateLabel: "Live",
      priceUgnot: 500_000,
      supply: "333 NFTs",
      opens: formatUtcMinute(WL_START),
      closes: formatUtcMinute(WL_END),
      wallet: "2 per wallet",
    });
    expect(cards[1]).toMatchObject({
      title: "Public",
      state: "upcoming",
      stateLabel: "Upcoming",
      priceUgnot: 1_000_000,
      supply: "1111 NFTs",
      opens: formatUtcMinute(WL_END),
      closes: "Stays open",
      wallet: "5 per wallet",
    });
    expect(cards[0].opens).toBe("2026-09-28 00:00 UTC");
    expect(cards[0].closes).toBe("2026-09-28 12:00 UTC");
  });

  it("ends a round on its end second", () => {
    const atWlEnd = mintRoundCards({
      now: WL_END,
      maxSupply: 1111,
      mintPrice: 1_000_000,
      sale: sale({ phase: "public" }),
    });
    expect(atWlEnd[0].state).toBe("ended");
    expect(atWlEnd[1].state).toBe("live");

    const atPublicEnd = mintRoundCards({
      now: PUBLIC_END,
      maxSupply: 1111,
      mintPrice: 1_000_000,
      sale: sale({ phase: "public", publicEnd: PUBLIC_END }),
    });
    expect(atPublicEnd[1]).toMatchObject({
      state: "ended",
      stateLabel: "Ended",
      closes: formatUtcMinute(PUBLIC_END),
    });
  });

  it("marks public as next when whitelist is live and public has no clock", () => {
    const cards = mintRoundCards({
      now: WL_START,
      maxSupply: 1111,
      mintPrice: 9,
      sale: sale({ publicStart: 0, publicEnd: 0, wlEnd: 0 }),
    });
    expect(cards[1]).toMatchObject({
      state: "waiting",
      stateLabel: "Next",
      opens: "After the whitelist round",
      closes: "Stays open",
    });
  });

  it("uses one public card when the drop has no whitelist and no sale clock", () => {
    const cards = mintRoundCards({
      now: WL_START,
      maxSupply: 0,
      mintPrice: 0,
      mintPubCap: 0,
      sale: sale({
        phase: "public",
        wlPrice: 0,
        wlSupply: 0,
        wlStart: 0,
        wlEnd: 0,
        publicStart: 0,
        publicEnd: 0,
        mintPrice: 0,
      }),
    });
    expect(cards).toHaveLength(1);
    expect(collectionShowsRounds(cards)).toBe(false);
    expect(cards[0]).toMatchObject({
      id: "public",
      state: "live",
      priceUgnot: 0,
      supply: "Open edition",
      opens: "When the drop is resumed",
      closes: "Stays open",
      wallet: "No per-wallet cap",
    });
  });

  it("keeps an ended whitelist round next to public", () => {
    const cards = mintRoundCards({
      now: PUBLIC_END,
      maxSupply: 1111,
      mintPrice: 20_000_000,
      mintWlCap: 1,
      mintPubCap: 3,
      sale: sale({
        phase: "closed",
        wlPrice: 10_000_000,
        mintPrice: 20_000_000,
        publicStart: WL_END,
        publicEnd: PUBLIC_END,
      }),
    });
    expect(collectionShowsRounds(cards)).toBe(true);
    expect(cards.map((row) => row.id)).toEqual(["whitelist", "public"]);
    expect(cards.map((row) => row.state)).toEqual(["ended", "ended"]);
    expect(cards[0].priceUgnot).toBe(10_000_000);
    expect(cards[1].priceUgnot).toBe(20_000_000);
  });

  it("falls back to the drop price when the chain has no sale object", () => {
    const cards = mintRoundCards({
      now: WL_START,
      maxSupply: 1,
      mintPrice: 250_000,
      sale: null,
    });
    expect(cards).toEqual([
      expect.objectContaining({
        id: "public",
        state: "live",
        priceUgnot: 250_000,
        supply: "1 NFT",
        opens: "When the drop is resumed",
        closes: "Stays open",
      }),
    ]);
  });

  it("shows the launch-pack whitelist as not on chain, without a price", () => {
    const cards = mintRoundCards({
      now: WL_START,
      maxSupply: 1111,
      mintPrice: 20_000_000,
      sale: sale({
        phase: "public",
        wlPrice: 0,
        wlSupply: 0,
        wlStart: 0,
        wlEnd: 0,
        publicStart: 0,
        publicEnd: 0,
        mintPrice: 20_000_000,
      }),
      planned: { qty: 333, start: WL_START },
    });
    expect(cards.map((row) => row.id)).toEqual(["whitelist", "public"]);
    expect(cards[0]).toMatchObject({
      state: "unsaved",
      stateLabel: "Not on chain",
      priceUgnot: 0,
      priceLabel: "Not set",
      supply: "333 NFTs",
      opens: "2026-09-28 00:00 UTC",
      closes: "Stays open",
    });
    expect(cards[1]).toMatchObject({
      id: "public",
      state: "live",
      priceUgnot: 20_000_000,
      opens: "When the drop is resumed",
    });
  });

  it("keeps the chain whitelist when a pack round is also present", () => {
    const cards = mintRoundCards({
      now: WL_START,
      maxSupply: 1111,
      mintPrice: 1,
      sale: sale(),
      planned: { qty: 1, start: 1 },
    });
    expect(cards[0]).toMatchObject({ state: "live", priceUgnot: 500_000, supply: "333 NFTs" });
    expect(cards[0].priceLabel).toBeUndefined();
  });

  it("says open now when a whitelist round has quantity and no start", () => {
    const cards = mintRoundCards({
      now: WL_START,
      maxSupply: 10,
      mintPrice: 1,
      sale: sale({ phase: "whitelist", wlStart: 0, wlEnd: 0, publicStart: 0 }),
    });
    expect(cards[0]).toMatchObject({ state: "live", opens: "Open now", supply: "333 NFTs" });
  });
});

describe("roundCountdown", () => {
  it("counts down to open, then to close", () => {
    expect(roundCountdown(100, 200, 50)).toEqual({ kind: "opens", left: 50 });
    expect(roundCountdown(100, 200, 100)).toEqual({ kind: "closes", left: 100 });
    expect(roundCountdown(100, 0, 150)).toEqual({ kind: "open", left: 0 });
    expect(roundCountdown(100, 200, 200)).toEqual({ kind: "ended", left: 0 });
    expect(roundCountdown(0, 0, 10)).toBeNull();
    expect(formatRoundCountdown(90061)).toBe("1d 01:01:01");
    expect(formatRoundCountdown(3661)).toBe("01:01:01");
  });

  it("stores the unix bounds the countdown reads", () => {
    const cards = mintRoundCards({
      now: WL_START - 60,
      maxSupply: 1111,
      mintPrice: 1,
      sale: sale(),
    });
    expect(cards[0]).toMatchObject({ id: "whitelist", opensAt: WL_START, closesAt: WL_END });
    expect(cards[1]).toMatchObject({ id: "public", opensAt: WL_END, closesAt: 0 });
    expect(roundCountdown(cards[0].opensAt, cards[0].closesAt, WL_START - 60)?.kind).toBe("opens");
    expect(roundCountdown(cards[1].opensAt, cards[1].closesAt, WL_END + 60)?.kind).toBe("open");
  });

  it("follows the round state when the old close is still ahead", () => {
    expect(roundCardCountdown({ state: "ended", opensAt: 100, closesAt: 200 }, 150)).toEqual({ kind: "ended", left: 0 });
    expect(roundCardCountdown({ state: "live", opensAt: 100, closesAt: 0 }, 150)).toEqual({ kind: "open", left: 0 });
    expect(roundCardCountdown({ state: "live", opensAt: 100, closesAt: 200 }, 150)).toEqual({ kind: "closes", left: 50 });
    expect(roundCardCountdown({ state: "upcoming", opensAt: 200, closesAt: 300 }, 150)).toEqual({ kind: "opens", left: 50 });
    expect(roundCardCountdown({ state: "waiting", opensAt: 50, closesAt: 300 }, 150)).toBeNull();
    expect(roundCardCountdown({ state: "live", opensAt: 0, closesAt: 0 }, 10)).toBeNull();
  });

  it("hides the clock after the creator has ended the round", () => {
    expect(roundVisibleCountdown({ state: "ended", opensAt: 100, closesAt: 200 }, 150)).toBeNull();
    expect(roundVisibleCountdown({ state: "live", opensAt: 100, closesAt: 200 }, 150)).toEqual({ kind: "closes", left: 50 });
    expect(roundVisibleCountdown({ state: "live", opensAt: 100, closesAt: 0 }, 150)).toEqual({ kind: "open", left: 0 });
    const now = WL_END + 60;
    const cards = mintRoundCards({
      now,
      maxSupply: 1111,
      mintPrice: 1,
      sale: sale({ phase: "public", wlEnd: WL_END + 3600, publicStart: WL_END, publicEnd: 0 }),
    });
    expect(cards[0].state).toBe("ended");
    expect(roundVisibleCountdown(cards[0], now)).toBeNull();
    expect(roundVisibleCountdown(cards[1], now)?.kind).toBe("open");
  });
});

describe("roundMintFill", () => {
  it("fills only the whitelist bar while that phase is live", () => {
    expect(roundMintFill("whitelist", "whitelist", 333, 10, 1111)).toEqual({ minted: 10, cap: 333 });
    expect(roundMintFill("public", "whitelist", 333, 10, 1111)).toEqual({ minted: 0, cap: 778 });
  });

  it("moves later mints onto the public bar after a full whitelist", () => {
    expect(roundMintFill("whitelist", "public", 333, 400, 1111, 333)).toEqual({ minted: 333, cap: 333 });
    expect(roundMintFill("public", "public", 333, 400, 1111, 333)).toEqual({ minted: 67, cap: 778 });
    expect(roundMintFill("whitelist", "public", 1, 2, 1111, 1)).toEqual({ minted: 1, cap: 1 });
    expect(roundMintFill("public", "public", 1, 2, 1111, 1)).toEqual({ minted: 1, cap: 1110 });
  });

  it("freezes a closed whitelist and adds its unminted supply to public", () => {
    expect(whitelistMintedAtClose([100, 200, 250], 150, 250)).toBe(1);
    expect(whitelistMintedAtClose([249, 249], 0, 250)).toBe(2);
    expect(roundMintFill("whitelist", "public", 333, 100, 1111, 86)).toEqual({ minted: 86, cap: 333 });
    expect(roundMintFill("public", "public", 333, 100, 1111, 86)).toEqual({ minted: 14, cap: 1025 });
    expect(roundMintFill("public", "closed", 333, 86, 1111, 86)).toEqual({ minted: 0, cap: 1025 });
    const cards = mintRoundCards({
      now: WL_END + 10,
      maxSupply: 1111,
      mintPrice: 1,
      minted: 100,
      wlMinted: 86,
      sale: sale({ phase: "public" }),
    });
    expect(cards[0]).toMatchObject({ id: "whitelist", filled: 86, fillCap: 333, supply: "333 NFTs" });
    expect(cards[1]).toMatchObject({ id: "public", filled: 14, fillCap: 1025, supply: "1025 NFTs" });
  });

  it("does not paint later mints onto a closed whitelist while the close count is loading", () => {
    const cards = mintRoundCards({
      now: WL_END + 10,
      maxSupply: 1111,
      mintPrice: 1,
      minted: 100,
      wlMintedPending: true,
      sale: sale({ phase: "public" }),
    });
    expect(cards[0]).toMatchObject({ id: "whitelist", filled: 0, fillCap: 333, fillKnown: false });
    expect(cards[1]).toMatchObject({ id: "public", filled: 0, fillCap: 778, fillKnown: false });
  });

  it("puts the counts on the round cards", () => {
    const cards = mintRoundCards({
      now: WL_START + 60,
      maxSupply: 1111,
      mintPrice: 1,
      minted: 10,
      sale: sale(),
    });
    expect(cards[0]).toMatchObject({ id: "whitelist", filled: 10, fillCap: 333 });
    expect(cards[1]).toMatchObject({ id: "public", filled: 0, fillCap: 778 });
  });
});

describe("mintClosedNote", () => {
  it("names the next round with its UTC open time", () => {
    const cards = mintRoundCards({
      now: WL_START - 60,
      maxSupply: 1111,
      mintPrice: 1_000_000,
      sale: sale({ phase: "closed" }),
    });
    expect(mintClosedNote(cards, "public")).toBe("");
    expect(mintClosedNote(cards, "closed")).toBe("Whitelist opens 2026-09-28 00:00 UTC.");
  });

  it("says the public round ended, then a generic end, then not open", () => {
    const ended = mintRoundCards({
      now: PUBLIC_END,
      maxSupply: 1111,
      mintPrice: 1,
      sale: sale({ phase: "closed", publicEnd: PUBLIC_END }),
    });
    expect(mintClosedNote(ended, "closed")).toBe("Public round has ended.");

    const wlEnded = mintRoundCards({
      now: WL_END,
      maxSupply: 1111,
      mintPrice: 1,
      sale: sale({ phase: "closed", publicStart: 0, publicEnd: 0 }),
    });
    expect(wlEnded[0].state).toBe("ended");
    expect(wlEnded[1].state).toBe("waiting");
    expect(mintClosedNote(wlEnded, "closed")).toBe("This round has ended.");

    const idle = mintRoundCards({
      now: WL_START,
      maxSupply: 10,
      mintPrice: 0,
      sale: sale({
        phase: "closed",
        wlSupply: 0,
        wlStart: 0,
        wlEnd: 0,
        publicStart: 0,
        publicEnd: 0,
        mintPrice: 0,
      }),
    });
    expect(mintClosedNote(idle, "closed")).toBe("This round is not open yet.");
  });
});

/** Whitelist, a gap, then public. Fetched phase stays closed on purpose. */
function gensSale(over: Partial<DropSale> = {}): DropSale {
  return sale({
    phase: "closed",
    wlPrice: 100_000_000,
    mintPrice: 200_000_000,
    wlSupply: 333,
    wlEnd: WL_START + 4 * 3600,
    publicStart: WL_START + 4 * 3600 + 1800,
    publicEnd: WL_START + 24 * 3600,
    ...over,
  });
}

function deskAt(now: number, over: Partial<MintDeskInput> = {}) {
  return mintDesk({
    now,
    maxSupply: 1111,
    mintPrice: 200_000_000,
    sale: gensSale(),
    mintWlCap: 1,
    mintPubCap: 3,
    minted: 0,
    paused: false,
    soldOut: false,
    connected: true,
    allowlisted: true,
    ...over,
  });
}

describe("mintDesk", () => {
  it("shows a countdown mint for an allowlisted wallet, then enables it on the open second", () => {
    const before = deskAt(WL_START - 10);
    expect(before.cards[0]).toMatchObject({ id: "whitelist", state: "upcoming", stateLabel: "Upcoming" });
    expect(before.action).toEqual({
      kind: "countdown",
      label: "Mint in 00:00:10",
      seconds: 10,
      priceUgnot: 100_000_000,
      eligible: true,
    });

    const open = deskAt(WL_START);
    expect(open.sale?.phase).toBe("whitelist");
    expect(open.cards[0]).toMatchObject({ state: "live", stateLabel: "Live" });
    expect(open.action).toEqual({ kind: "mint", priceUgnot: 100_000_000, eligible: true });
  });

  it("keeps other wallets on the closed note until whitelist, then blocks them", () => {
    const waiting = deskAt(WL_START - 10, { allowlisted: false });
    expect(waiting.action).toEqual({ kind: "note", note: "Whitelist opens 2026-09-28 00:00 UTC." });

    const open = deskAt(WL_START, { allowlisted: false });
    expect(open.action).toEqual({ kind: "note", note: "This wallet is not on the whitelist." });

    const unknown = deskAt(WL_START, { allowlisted: null });
    expect(unknown.action).toEqual({ kind: "mint", priceUgnot: 100_000_000, eligible: false });
  });

  it("asks for Adena during an open round", () => {
    expect(deskAt(WL_START, { connected: false }).action).toEqual({ kind: "connect" });
  });

  it("charges the public price when that round opens, without a whitelist line", () => {
    const gap = WL_START + 4 * 3600;
    const between = deskAt(gap);
    expect(between.sale?.phase).toBe("closed");
    expect(between.action).toEqual({
      kind: "note",
      note: `Public opens ${formatUtcMinute(gap + 1800)}.`,
    });

    const pub = deskAt(gap + 1800);
    expect(pub.sale?.phase).toBe("public");
    expect(pub.cards[1]).toMatchObject({ id: "public", state: "live" });
    expect(pub.action).toEqual({ kind: "mint", priceUgnot: 200_000_000, eligible: false });
  });

  it("stops whitelist mint after the whitelist allocation is filled", () => {
    const full = deskAt(WL_START, { minted: 333 });
    expect(full.sale?.phase).toBe("closed");
    expect(full.action.kind).toBe("note");
  });

  it("keeps Start public on the public price before the whitelist clock", () => {
    const forced = deskAt(WL_START - 10, { sale: gensSale({ phase: "public" }) });
    expect(forced.sale?.phase).toBe("public");
    expect(forced.cards[0]).toMatchObject({ id: "whitelist", state: "ended" });
    expect(forced.action).toEqual({ kind: "mint", priceUgnot: 200_000_000, eligible: false });
  });

  it("closes after publicEnd and prefers pause or sold out over the clock", () => {
    expect(deskAt(WL_START + 24 * 3600).action).toEqual({ kind: "note", note: "Public round has ended." });
    expect(deskAt(WL_START - 10, { paused: true }).action).toEqual({ kind: "paused" });
    expect(deskAt(WL_START - 10, { soldOut: true }).action).toEqual({ kind: "soldout" });
  });

  it("mints at the drop price when the collection has no sale clock", () => {
    const row = deskAt(WL_START, { sale: null, mintPrice: 5 });
    expect(row.action).toEqual({ kind: "mint", priceUgnot: 5, eligible: false });
  });
});

describe("mint quantity", () => {
  it("caps whitelist at one and public at the remaining wallet allowance", () => {
    expect(
      mintQtyLimit({ round: "whitelist", wlCap: 1, pubCap: 3, mintCap: 0, walletWl: 0, walletPub: 0, supplyLeft: 1111 }),
    ).toBe(1);
    expect(
      mintQtyLimit({ round: "whitelist", wlCap: 1, pubCap: 3, mintCap: 0, walletWl: 1, walletPub: 0, supplyLeft: 1111 }),
    ).toBe(0);
    expect(
      mintQtyLimit({ round: "public", wlCap: 1, pubCap: 3, mintCap: 0, walletWl: 1, walletPub: 0, supplyLeft: 1111 }),
    ).toBe(3);
    expect(
      mintQtyLimit({ round: "public", wlCap: 1, pubCap: 3, mintCap: 0, walletWl: 1, walletPub: 2, supplyLeft: 1111 }),
    ).toBe(1);
  });

  it("also stops at supply and the lifetime cap", () => {
    expect(
      mintQtyLimit({ round: "public", wlCap: 1, pubCap: 3, mintCap: 0, walletWl: 0, walletPub: 0, supplyLeft: 2 }),
    ).toBe(2);
    expect(
      mintQtyLimit({ round: "public", wlCap: 1, pubCap: 3, mintCap: 2, walletWl: 1, walletPub: 0, supplyLeft: 100 }),
    ).toBe(1);
    expect(
      mintQtyLimit({ round: "public", wlCap: 0, pubCap: 0, mintCap: 0, walletWl: 0, walletPub: 0, supplyLeft: -1 }),
    ).toBe(20);
  });

  it("counts a mint at public start as public", () => {
    const start = 1_000;
    expect(splitPhaseMints([999, 1000, 1000], start)).toEqual({ wl: 1, pub: 2 });
    expect(splitPhaseMints([10, 20], 0)).toEqual({ wl: 2, pub: 0 });
  });

  it("labels the button with the count and the total GNOT", () => {
    expect(mintButtonLabel(1, 100_000_000)).toBe("Mint 1 · 100.00 GNOT");
    expect(mintButtonLabel(3, 200_000_000)).toBe("Mint 3 · 600.00 GNOT");
    expect(mintButtonLabel(2, 0)).toBe("Mint 2");
    expect(clampMintQty("", 3)).toBe(1);
    expect(clampMintQty("9", 3)).toBe(3);
    expect(clampMintQty("0", 3)).toBe(1);
    expect(clampMintQty("2", 0)).toBe(0);
    expect(mintQtyNote({ limit: 3, roundCap: 3, used: 0 })).toBe("3 per wallet this round");
    expect(mintQtyNote({ limit: 2, roundCap: 3, used: 1 })).toBe("1 minted this round · 2 left");
    expect(mintQtyNote({ limit: 1, roundCap: 1, used: 0 })).toBe("1 per wallet this round");
  });

  it("keeps the minted bar from moving backwards", () => {
    expect(mergeMintedCount(79, 80)).toBe(80);
    expect(mergeMintedCount(80, 79)).toBe(80);
    expect(mergeMintedCount(0, Number.NaN)).toBe(0);
  });

  it("looks back far enough to include the round open", async () => {
    expect(mintLookbackHeight(449441, 1_800_000_000, 1_800_000_000 - 6300)).toBe(449441 - Math.ceil(6300 / 2) - 3000);
    expect(mintLookbackHeight(10, 100, 0)).toBe(1);
    expect(narrowHeightWindow(1, 20, [{ height: 9, time: 9 }, { height: 11, time: 11 }], 10)).toEqual({ lo: 10, hi: 11 });
    expect(countMintsInHeightRange([9, 10, 10, 12], 10, 12)).toBe(2);
    const origin = 1_700_000_000;
    const timeOf = (h: number) => origin + h * 3;
    const head = { height: 5000, time: timeOf(5000) };
    const target = timeOf(2500) + 1;
    let reads = 0;
    const found = await firstBlockAtOrAfter(head, target, async (h) => {
      reads += 1;
      return timeOf(h);
    });
    expect(found).toBe(2501);
    expect(timeOf(found || 0) >= target).toBe(true);
    expect(timeOf((found || 1) - 1) < target).toBe(true);
    expect(reads).toBeLessThan(40);
  });
});

describe("parseEvalBool", () => {
  it("reads qeval bools", () => {
    expect(parseEvalBool("true")).toBe(true);
    expect(parseEvalBool("(true bool)")).toBe(true);
    expect(parseEvalBool("false")).toBe(false);
    expect(parseEvalBool("(false bool)")).toBe(false);
    expect(parseEvalBool("")).toBe(false);
  });
});
