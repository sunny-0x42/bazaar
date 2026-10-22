import { parseEvalString } from "./chain";

/** Sample secondary price used on the rewards page. 100 GNOT. */
export const REWARD_EXAMPLE_UGNOT = 100_000_000;

const UGNOT = 1_000_000;

/** English UI amount. Independent of the OS locale. */
export function formatRewardGnot(ugnot: number): string {
  const n = Number.isFinite(ugnot) ? ugnot / UGNOT : 0;
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Claim amount at ugnot precision. 2,398,000 ugnot is 2.398000 GNOT. */
export function formatRewardGnotExact(ugnot: number): string {
  if (!Number.isFinite(ugnot)) return "0.000000";
  const sign = ugnot < 0 ? "-" : "";
  const abs = Math.trunc(Math.abs(ugnot));
  const whole = Math.trunc(abs / UGNOT);
  const frac = String(abs % UGNOT).padStart(6, "0");
  return `${sign}${whole.toLocaleString("en-US")}.${frac}`;
}

export function formatUgnot(ugnot: number): string {
  if (!Number.isFinite(ugnot)) return "0";
  return Math.trunc(ugnot).toLocaleString("en-US");
}

/** Live perk before perk2. Claim on this path still pays credits Settle never moved. */
export const LEGACY_PERK_PKG = "gno.land/r/g1n4pl5uc4yt5r96m9w6fmdznx3x0jyg8l6arhmt/bazaar/perk";

/** Bank address of that perk package. It has no exported Address(). */
export const LEGACY_PERK_SINK = "g1fwt83psazx7vxtd7axryvgcg0u2nec86ux5yw8";

export function samePkg(a: string, b: string): boolean {
  return a.trim().replace(/\/+$/, "") === b.trim().replace(/\/+$/, "");
}

/** A second Claim button, only when the earlier pool is a different package and still owes this wallet. */
export function showLegacyClaim(perkPkg: string, legacyPkg: string, legacyUgnot: number): boolean {
  return legacyUgnot > 0 && legacyPkg.trim() !== "" && !samePkg(perkPkg, legacyPkg);
}

/** What Claim pays now, then how later fees split. The weight percent is not the claim. */
export function claimShareLine(input: {
  claimUgnot: number;
  weight: number;
  totalWeight: number;
  countedWeight: number;
  countedNfts: number;
  usingCounted: boolean;
  /** perk2: Claim pays settled accrued. Unsettled waits for admin Settle. */
  epoch?: boolean;
  unsettledUgnot?: number;
  epochs?: number;
}): string {
  const exact = formatRewardGnotExact(input.claimUgnot);
  const coins = formatUgnot(input.claimUgnot);
  const pay = `Claim pays this wallet ${exact} GNOT (${coins} ugnot).`;
  if (input.epoch) {
    const sitting = formatRewardGnotExact(input.unsettledUgnot ?? 0);
    const sittingCoins = formatUgnot(input.unsettledUgnot ?? 0);
    const pool = `Unsettled pool is ${sitting} GNOT (${sittingCoins} ugnot).`;
    const settle = "An admin Settle splits the unsettled pool across recorded weight.";
    if (input.usingCounted) {
      const noun = input.countedNfts === 1 ? "1 revealed NFT" : `${input.countedNfts.toLocaleString("en-US")} revealed NFTs`;
      return `Counted Share weight is ${input.countedWeight.toLocaleString("en-US")} from ${noun}. ${pay} ${pool} The admin wallet records that weight. ${settle}`;
    }
    if (input.weight > 0 && input.totalWeight > 0) {
      const pct = ((input.weight / input.totalWeight) * 100).toLocaleString("en-US", { maximumFractionDigits: 2 });
      return `${pay} ${pool} Recorded weight is ${input.weight.toLocaleString("en-US")} of ${input.totalWeight.toLocaleString("en-US")} (${pct}% of pool weight). ${settle}`;
    }
    if ((input.epochs ?? 0) > 0) {
      return `${pay} ${pool} The admin wallet records this wallet's NFTs. The next Settle includes that weight.`;
    }
    return `${pay} ${pool} The admin wallet records this wallet's NFTs. Settle has not split this pool yet.`;
  }
  if (input.usingCounted) {
    const noun = input.countedNfts === 1 ? "1 revealed NFT" : `${input.countedNfts.toLocaleString("en-US")} revealed NFTs`;
    return `Counted Share weight is ${input.countedWeight.toLocaleString("en-US")} from ${noun}. ${pay} The admin wallet records it. The GNOT already in the pool stays with weight recorded earlier.`;
  }
  if (input.weight > 0 && input.totalWeight > 0) {
    const pct = ((input.weight / input.totalWeight) * 100).toLocaleString("en-US", { maximumFractionDigits: 2 });
    return `${pay} Recorded weight is ${input.weight.toLocaleString("en-US")} of ${input.totalWeight.toLocaleString("en-US")} (${pct}% of pool weight). Fees that arrive after the next recording split by that weight.`;
  }
  return `${pay} This wallet has no recorded weight.`;
}

const FEE_DENOM = 10_000;

/** Same integer split as `p/bazaar/fee/v1` ProtocolFee. */
export function protocolFee(price: number, bps: number): number {
  if (!Number.isFinite(price) || !Number.isFinite(bps) || price < 0 || bps < 0 || bps > FEE_DENOM) return 0;
  const q = Math.floor(price / FEE_DENOM);
  const r = price % FEE_DENOM;
  return q * bps + Math.floor((r * bps) / FEE_DENOM);
}

export function bpsPercent(bps: number): string {
  const n = Number.isFinite(bps) ? bps : 0;
  return (n / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "%";
}

export function discountTier(bps: number): string {
  switch (bps) {
    case 150:
      return "Mythic";
    case 125:
      return "Legendary";
    case 100:
      return "Epic";
    case 75:
      return "Rare";
    case 50:
      return "Uncommon";
    case 25:
      return "Common";
    default:
      return "";
  }
}

/** GNOT the protocol does not charge when this discount is the one Buy applies. */
export function feeSaved(price: number, protocolBps: number, discountBps: number): {
  chargedBps: number;
  full: number;
  charged: number;
  saved: number;
} {
  const cap = Math.max(0, protocolBps);
  const discount = Math.max(0, Math.min(discountBps, cap));
  const chargedBps = cap - discount;
  const full = protocolFee(price, cap);
  const charged = protocolFee(price, chargedBps);
  return { chargedBps, full, charged, saved: full - charged };
}

/** This wallet's Share weight times the GNOT still accounted on the perk realm. */
export function weightShareUgnot(accounted: number, weight: number, total: number): number {
  if (accounted <= 0 || weight <= 0 || total <= 0) return 0;
  return Math.floor((accounted * weight) / total);
}

export type PerkRender = {
  totalWeight: number;
  accountedUgnot: number;
  /** Null when the realm render has no unsettled line. That realm is the old accumulator. */
  unsettledUgnot: number | null;
  epochs: number | null;
};

export function parsePerkRender(raw: string): PerkRender {
  const text = parseEvalString(raw);
  const weight = text.match(/total weight:\s*(-?\d+)/i);
  const accounted = text.match(/accounted:\s*(-?\d+)/i);
  const unsettled = text.match(/unsettled:\s*(-?\d+)/i);
  const epochs = text.match(/epochs:\s*(-?\d+)/i);
  return {
    totalWeight: weight ? Number(weight[1]) : 0,
    accountedUgnot: accounted ? Number(accounted[1]) : 0,
    unsettledUgnot: unsettled ? Number(unsettled[1]) : null,
    epochs: epochs ? Number(epochs[1]) : null,
  };
}

export type RewardDesk = {
  protocolBps: number;
  shareBps: number;
  perkPkg: string;
  discountBps: number;
  perkDiscountBps: number;
  weight: number;
  totalWeight: number;
  accountedUgnot: number;
  /** Bazaar Gens this wallet owns, including sealed ones. */
  held: number;
  /** Collection Hidden(). Sealed NFTs have no rarity yet. */
  sealed: boolean;
  /** Highest tier among revealed, unlisted Bazaar Gens this wallet holds. */
  countedBps: number;
  /** Sum of those tiers. The perk realm stays at 0 until Sync. */
  countedWeight: number;
  countedNfts: number;
  /** GNOT still held by the perk realm. */
  poolUgnot: number;
  /** GNOT Claim would pay this wallet right now. */
  claimUgnot: number;
  /** True when the live perk exports Claimable. Sync records weight; Settle splits later. */
  epoch: boolean;
  /** ugnot Unsettled() would split on the next Settle. */
  unsettledUgnot: number;
  epochs: number;
  /** Earlier perk package, empty when it is still the live genesis perk. */
  legacyPkg: string;
  /** ugnot Claim on legacyPkg would pay. Zero hides that button. */
  legacyClaimUgnot: number;
  /** Revealed, unlisted token ids this wallet can Sync. */
  syncIds: number[];
};

export type HoldRow = {
  rarity: string;
  revealed: boolean;
  listed: boolean;
};

export type CountedHold = {
  discountBps: number;
  weight: number;
  counted: number;
};

/** Same ladder Sync writes: best tier is the fee discount, the sum is share weight. */
export function rarityShareBps(rarity: string): number {
  switch (rarity.trim().toLowerCase()) {
    case "mythic":
      return 150;
    case "legendary":
      return 125;
    case "epic":
      return 100;
    case "rare":
      return 75;
    case "uncommon":
      return 50;
    case "common":
      return 25;
    default:
      return 0;
  }
}

export function countRevealedHold(rows: HoldRow[]): CountedHold {
  let discountBps = 0;
  let weight = 0;
  let counted = 0;
  for (const row of rows) {
    if (!row.revealed || row.listed) continue;
    const bps = rarityShareBps(row.rarity);
    if (bps <= 0) continue;
    counted += 1;
    weight += bps;
    if (bps > discountBps) discountBps = bps;
  }
  return { discountBps, weight, counted };
}

/** Factory HolderDiscount when Buy already has it. Otherwise the counted tier. */
export function rewardDiscountBps(desk: Pick<RewardDesk, "discountBps" | "countedBps">): number {
  if (desk.discountBps > 0) return desk.discountBps;
  return desk.countedBps > 0 ? desk.countedBps : 0;
}

/** Perk ShareWeight when Sync has stored it. Otherwise the counted sum. */
export function rewardWeight(desk: Pick<RewardDesk, "weight" | "countedWeight">): number {
  if (desk.weight > 0) return desk.weight;
  return desk.countedWeight > 0 ? desk.countedWeight : 0;
}

export function holderEligible(
  desk: Pick<RewardDesk, "discountBps" | "perkDiscountBps" | "weight" | "countedBps" | "countedWeight">,
): boolean {
  return desk.discountBps > 0 || desk.perkDiscountBps > 0 || desk.weight > 0 || desk.countedBps > 0 || desk.countedWeight > 0;
}

/** One status line. Empty when the wallet is not connected. */
export function holderNotice(desk: RewardDesk, connected: boolean): string {
  if (!connected) return "";
  if (desk.discountBps > 0) {
    return "This wallet is eligible. Buy can use its holder discount when that discount is the higher of the two wallets.";
  }
  if (desk.perkDiscountBps > 0 || desk.weight > 0) {
    return "This wallet is eligible on the perk record. Buy uses it after the admin wallet records it.";
  }
  if (desk.countedBps > 0 || desk.countedWeight > 0) {
    const n = Math.max(0, Math.floor(desk.countedNfts));
    const noun = n === 1 ? "1 revealed Bazaar Gens" : `${n.toLocaleString("en-US")} revealed Bazaar Gens`;
    const tier = discountTier(desk.countedBps);
    const tierBit = tier ? ` (${tier})` : "";
    const weight = Math.max(0, Math.floor(desk.countedWeight)).toLocaleString("en-US");
    return `This wallet holds ${noun}. Counted discount is ${bpsPercent(desk.countedBps)}${tierBit}. Share weight is ${weight}. The admin wallet records this onto Buy. A listed NFT is not counted.`;
  }
  const n = Math.max(0, Math.floor(desk.held));
  const noun = n === 1 ? "1 Bazaar Gens" : `${n.toLocaleString("en-US")} Bazaar Gens`;
  if (n > 0 && desk.sealed) {
    return `This wallet holds ${noun}. Not eligible yet: the collection is still sealed, so the tier is unread. After reveal, the admin wallet records this wallet.`;
  }
  if (n > 0) {
    return `This wallet holds ${noun}. None are counted. The admin wallet records a revealed, unlisted NFT. A listed NFT does not count.`;
  }
  return "This wallet is not eligible. It does not hold a Bazaar Gens NFT.";
}
