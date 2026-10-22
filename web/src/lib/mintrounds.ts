import { formatUtcMinute, type DropSale } from "./chain";

export type MintRoundId = "whitelist" | "public";
export type MintRoundState = "live" | "upcoming" | "ended" | "waiting" | "unsaved";

export type MintRoundCard = {
  id: MintRoundId;
  title: "Whitelist" | "Public";
  state: MintRoundState;
  stateLabel: "Live" | "Upcoming" | "Ended" | "Next" | "Not on chain";
  priceUgnot: number;
  /** Replaces Free when the pack has no whitelist price. */
  priceLabel?: string;
  supply: string;
  opens: string;
  closes: string;
  /** Unix seconds. 0 means this bound is not set. */
  opensAt: number;
  closesAt: number;
  wallet: string;
  /** Mints counted in this round. */
  filled: number;
  /** Round allocation. 0 means the bar is hidden. */
  fillCap: number;
  /** False while a closed whitelist count is still loading. The bar must not use the live total. */
  fillKnown?: boolean;
};

/** Launch-pack whitelist. Shown only while the collection has no chain round. */
export type PlannedWhitelist = {
  qty: number;
  /** Unix seconds. 0 means the pack has no open time. */
  start: number;
};

/** Wizard draft. Shown on Launch step 5 and on #/m/{slug} before Init. */
export type LaunchDraft = {
  slug: string;
  name: string;
  cover: string;
  supply: number;
  mintPrice: number;
  royaltyBps: number;
  saleDual: boolean;
  wlPrice: number;
  wlSupply: number;
  wlStart: number;
  wlEnd: number;
  publicStart: number;
  publicEnd: number;
  wlCap: number;
  pubCap: number;
};

const DRAFT_KEY = "bazaar.launchDraft.v1";

export function writeLaunchDraft(draft: LaunchDraft) {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    /* private mode */
  }
}

export function readLaunchDraft(slug: string): LaunchDraft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as LaunchDraft;
    if (!data || typeof data.slug !== "string" || data.slug !== slug.trim()) return null;
    return data;
  } catch {
    return null;
  }
}

/**
 * Phase a signed drop would report at `now` with minted still 0.
 * Mirrors col.mintPhase without publicForced.
 */
export function previewDropSale(input: {
  now: number;
  royaltyBps: number;
  mintPrice: number;
  saleDual: boolean;
  wlPrice: number;
  wlSupply: number;
  wlStart: number;
  wlEnd: number;
  publicStart: number;
  publicEnd: number;
}): DropSale {
  const wlStart = input.saleDual ? input.wlStart : 0;
  const wlEnd = input.saleDual ? input.wlEnd : 0;
  const wlSupply = input.saleDual ? input.wlSupply : 0;
  const { publicStart, publicEnd, now } = input;
  let phase: DropSale["phase"] = "public";
  if (wlStart > 0 && now < wlStart) phase = "closed";
  else if (publicStart > 0 && now >= publicStart) phase = publicEnd > 0 && now >= publicEnd ? "closed" : "public";
  else if (publicStart > 0 && now < publicStart) {
    if (wlEnd > 0 && now >= wlEnd) phase = "closed";
    else if (wlSupply > 0) phase = "whitelist";
    else phase = "closed";
  } else if (wlEnd > 0 && now >= wlEnd) phase = "public";
  else if (wlSupply > 0) phase = "whitelist";
  else if (publicStart > 0 && now < publicStart) phase = "closed";
  return {
    royaltyBps: input.royaltyBps,
    wlPrice: input.saleDual ? input.wlPrice : 0,
    wlSupply,
    phase,
    mintPrice: input.mintPrice,
    wlStart,
    wlEnd,
    publicStart,
    publicEnd,
  };
}

const STATE_LABEL: Record<MintRoundState, MintRoundCard["stateLabel"]> = {
  live: "Live",
  upcoming: "Upcoming",
  ended: "Ended",
  waiting: "Next",
  unsaved: "Not on chain",
};

export type MintRoundInput = {
  /** Unix seconds. Tests inject this so the clock is not the machine clock. */
  now: number;
  maxSupply: number;
  /** Public price used only when the chain has no sale object. */
  mintPrice: number;
  sale?: DropSale | null;
  mintWlCap?: number;
  mintPubCap?: number;
  planned?: PlannedWhitelist | null;
  /** Total minted on the collection. Split across the two rounds. */
  minted?: number;
  /**
   * Mints that landed before the whitelist close. After that round ends, the
   * whitelist bar stays on this count and the unminted remainder joins public.
   */
  wlMinted?: number;
  /** Closed-round snapshot is still loading. Do not paint later mints onto whitelist. */
  wlMintedPending?: boolean;
};

function hasWhitelist(sale: DropSale): boolean {
  return sale.wlSupply > 0 || sale.wlStart > 0 || sale.wlEnd > 0;
}

function nftCount(n: number): string {
  const v = Math.max(0, Math.floor(n));
  return v === 1 ? "1 NFT" : `${v} NFTs`;
}

function walletLine(cap: number | undefined): string {
  const n = Math.max(0, Math.floor(cap || 0));
  return n > 0 ? `${n} per wallet` : "No per-wallet cap";
}

function clock(unix: number, empty: string): string {
  return unix > 0 ? formatUtcMinute(unix) : empty;
}

/** Chain phase is consumed as given. A set end is ended at that second. A set start is live at that second. */
function whitelistState(sale: DropSale, now: number): MintRoundState {
  if (sale.phase === "public") return "ended";
  if (sale.wlEnd > 0 && now >= sale.wlEnd) return "ended";
  if (sale.wlStart > 0 && now < sale.wlStart) return "upcoming";
  if (sale.phase === "whitelist") return "live";
  return "ended";
}

function publicState(sale: DropSale, now: number): MintRoundState {
  if (sale.publicEnd > 0 && now >= sale.publicEnd) return "ended";
  if (sale.phase === "public") return "live";
  if (sale.publicStart > 0 && now < sale.publicStart) return "upcoming";
  if (sale.phase === "whitelist") return "waiting";
  return "waiting";
}

function card(
  id: MintRoundId,
  title: MintRoundCard["title"],
  state: MintRoundState,
  priceUgnot: number,
  supply: string,
  opens: string,
  closes: string,
  wallet: string,
  opensAt = 0,
  closesAt = 0,
  priceLabel?: string,
): MintRoundCard {
  const row: MintRoundCard = {
    id,
    title,
    state,
    stateLabel: STATE_LABEL[state],
    priceUgnot,
    supply,
    opens,
    closes,
    opensAt,
    closesAt,
    wallet,
    filled: 0,
    fillCap: 0,
  };
  if (priceLabel) row.priceLabel = priceLabel;
  return row;
}

export type RoundCountdown = { kind: "opens" | "closes" | "open" | "ended"; left: number };

/** Next clock for a round. A missing bound is 0. Open with no close stays open. */
export function roundCountdown(opensAt: number, closesAt: number, nowSec: number): RoundCountdown | null {
  if (opensAt <= 0 && closesAt <= 0) return null;
  if (opensAt > nowSec) return { kind: "opens", left: opensAt - nowSec };
  if (closesAt > nowSec) return { kind: "closes", left: closesAt - nowSec };
  if (closesAt > 0) return { kind: "ended", left: 0 };
  return { kind: "open", left: 0 };
}

export function countdownParts(seconds: number): { days: number; hours: number; mins: number; secs: number } {
  const s = Math.max(0, Math.floor(seconds));
  return {
    days: Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    mins: Math.floor((s % 3600) / 60),
    secs: s % 60,
  };
}

export function formatRoundCountdown(seconds: number): string {
  const parts = countdownParts(seconds);
  const clock = [parts.hours, parts.mins, parts.secs].map((n) => String(n).padStart(2, "0")).join(":");
  return parts.days > 0 ? `${parts.days}d ${clock}` : clock;
}

export type RoundFill = { minted: number; cap: number };

/**
 * Mints whose block time falls in [wlStart, wlEnd). A mint at the close second
 * is not a whitelist mint. wlStart 0 counts every mint before the close.
 */
export function whitelistMintedAtClose(times: number[], wlStart: number, wlEnd: number): number {
  const end = Math.floor(wlEnd);
  const start = Math.floor(wlStart);
  if (!(end > 0)) return 0;
  let n = 0;
  for (const raw of times) {
    const t = Math.floor(raw);
    if (!Number.isFinite(t) || t <= 0) continue;
    if (start > 0 && t < start) continue;
    if (t < end) n += 1;
  }
  return n;
}

/**
 * Split the collection mint count across the two rounds.
 * While whitelist is live, mints fill that bar and the public bar stays at 0.
 * After the round closes, pass `wlMinted`: that bar stays put, and the unminted
 * whitelist remainder is added to the public cap.
 */
export function roundMintFill(
  id: MintRoundId,
  phase: DropSale["phase"] | "none",
  wlSupply: number,
  minted: number,
  maxSupply: number,
  wlMinted?: number,
): RoundFill {
  const total = Math.max(0, Math.floor(minted));
  const wlCap = Math.max(0, Math.floor(wlSupply));
  const supply = Math.max(0, Math.floor(maxSupply));
  const closed = phase !== "whitelist" && phase !== "none";
  const known = closed && wlMinted != null && Number.isFinite(wlMinted) ? Math.max(0, Math.floor(wlMinted)) : null;
  if (known != null) {
    const wlShown = wlCap > 0 ? Math.min(known, wlCap) : known;
    const pubCap = supply > 0 ? Math.max(0, supply - wlShown) : 0;
    const pubMinted = Math.max(0, total - wlShown);
    if (id === "whitelist") return { minted: wlShown, cap: wlCap };
    return { minted: pubCap > 0 ? Math.min(pubMinted, pubCap) : pubMinted, cap: pubCap };
  }
  const pubCap = supply > 0 ? Math.max(0, supply - wlCap) : 0;
  if (id === "whitelist") return { minted: Math.min(total, wlCap), cap: wlCap };
  if (phase === "whitelist") return { minted: 0, cap: pubCap };
  if (wlCap <= 0) return { minted: supply > 0 ? Math.min(total, supply) : total, cap: supply };
  const pubMinted = Math.max(0, total - wlCap);
  return { minted: pubCap > 0 ? Math.min(pubMinted, pubCap) : pubMinted, cap: pubCap };
}

/**
 * Clock to draw on a card. A round the creator already closed has none,
 * even when its scheduled close is still ahead.
 */
export function roundVisibleCountdown(
  round: Pick<MintRoundCard, "state" | "opensAt" | "closesAt">,
  nowSec: number,
): RoundCountdown | null {
  if (round.state === "ended") return null;
  const tick = roundCountdown(round.opensAt, round.closesAt, nowSec);
  if (!tick || tick.kind === "ended") return null;
  return tick;
}

/** Countdown for one card. An ended round stays ended even if its old close is still ahead. */
export function roundCardCountdown(
  round: Pick<MintRoundCard, "state" | "opensAt" | "closesAt">,
  nowSec: number,
): RoundCountdown | null {
  if (round.opensAt <= 0 && round.closesAt <= 0) return null;
  if (round.state === "ended") return { kind: "ended", left: 0 };
  if (round.state === "upcoming" || round.state === "unsaved" || round.state === "waiting") {
    if (round.opensAt > nowSec) return { kind: "opens", left: round.opensAt - nowSec };
    return null;
  }
  if (round.closesAt > nowSec) return { kind: "closes", left: round.closesAt - nowSec };
  if (round.closesAt > 0) return { kind: "ended", left: 0 };
  return { kind: "open", left: 0 };
}

function plannedWhitelist(planned: PlannedWhitelist | null | undefined): PlannedWhitelist | null {
  if (!planned || (planned.qty <= 0 && planned.start <= 0)) return null;
  return planned;
}

function applyFill(cards: MintRoundCard[], input: MintRoundInput): MintRoundCard[] {
  const phase = input.sale?.phase ?? "none";
  const wlSupply = input.sale?.wlSupply ?? 0;
  const minted = input.minted ?? 0;
  const plannedCap = input.planned?.qty ?? 0;
  return cards.map((row) => {
    if (row.state === "unsaved") return { ...row, filled: 0, fillCap: Math.max(0, plannedCap) };
    const pastWhitelist = phase !== "whitelist" && phase !== "none";
    if (pastWhitelist && input.wlMintedPending && input.wlMinted == null && (input.sale?.wlEnd ?? 0) > 0) {
      const cap = row.id === "whitelist" ? Math.max(0, Math.floor(wlSupply)) : Math.max(0, Math.floor(input.maxSupply) - Math.max(0, Math.floor(wlSupply)));
      return { ...row, filled: 0, fillCap: Math.max(0, cap), fillKnown: false };
    }
    const wlMinted = phase === "whitelist" || phase === "none" ? undefined : input.wlMinted;
    const fill = roundMintFill(row.id, phase, wlSupply, minted, input.maxSupply, wlMinted);
    const supply =
      row.id === "public" && wlMinted != null && fill.cap > 0 ? nftCount(fill.cap) : row.supply;
    return { ...row, filled: fill.minted, fillCap: fill.cap, supply };
  });
}

function unsavedWhitelist(planned: PlannedWhitelist, wallet: string): MintRoundCard {
  return card(
    "whitelist",
    "Whitelist",
    "unsaved",
    0,
    planned.qty > 0 ? nftCount(planned.qty) : "No whitelist quantity",
    clock(planned.start, "Open now"),
    "Stays open",
    wallet,
    planned.start,
    0,
    "Not set",
  );
}

export function mintRoundCards(input: MintRoundInput): MintRoundCard[] {
  const pubSupply = input.maxSupply > 0 ? nftCount(input.maxSupply) : "Open edition";
  const planned = plannedWhitelist(input.planned);
  const sale = input.sale;
  if (!sale) {
    const cards: MintRoundCard[] = [];
    if (planned) cards.push(unsavedWhitelist(planned, walletLine(input.mintWlCap)));
    cards.push(
      card(
        "public",
        "Public",
        "live",
        input.mintPrice,
        pubSupply,
        "When the drop is resumed",
        "Stays open",
        walletLine(input.mintPubCap),
      ),
    );
    return applyFill(cards, input);
  }
  const wl = hasWhitelist(sale);
  const cards: MintRoundCard[] = [];
  if (wl) {
    cards.push(
      card(
        "whitelist",
        "Whitelist",
        whitelistState(sale, input.now),
        sale.wlPrice,
        sale.wlSupply > 0 ? nftCount(sale.wlSupply) : "No whitelist quantity",
        clock(sale.wlStart, "Open now"),
        clock(sale.wlEnd, "Stays open"),
        walletLine(input.mintWlCap),
        sale.wlStart,
        sale.wlEnd,
      ),
    );
  } else if (planned) {
    cards.push(unsavedWhitelist(planned, walletLine(input.mintWlCap)));
  }
  cards.push(
    card(
      "public",
      "Public",
      publicState(sale, input.now),
      sale.mintPrice,
      pubSupply,
      clock(sale.publicStart, wl ? "After the whitelist round" : "When the drop is resumed"),
      clock(sale.publicEnd, "Stays open"),
      walletLine(input.mintPubCap),
      sale.publicStart,
      sale.publicEnd,
    ),
  );
  return applyFill(cards, input);
}

/**
 * Collection pages keep a single mint price when the drop is public with no clock.
 * A whitelist round or any set open/close is shown as round cards.
 */
export function collectionShowsRounds(cards: MintRoundCard[]): boolean {
  return cards.some(
    (row) =>
      row.id === "whitelist" ||
      row.state !== "live" ||
      row.opens !== "When the drop is resumed" ||
      row.closes !== "Stays open",
  );
}

/** Shown only while the chain phase is closed. */
export function mintClosedNote(cards: MintRoundCard[], phase: DropSale["phase"] | undefined): string {
  if (phase !== "closed") return "";
  const upcoming = cards.find((row) => row.state === "upcoming");
  if (upcoming) return `${upcoming.title} opens ${upcoming.opens}.`;
  if (cards.some((row) => row.id === "public" && row.state === "ended")) return "Public round has ended.";
  if (cards.some((row) => row.state === "ended")) return "This round has ended.";
  return "This round is not open yet.";
}

/**
 * Phase col.mintPhase would report at `now`. Does not know Start public
 * (`publicForced`); callers keep a fetched public phase themselves.
 */
export function scheduleMintPhase(sale: DropSale, now: number, minted: number): DropSale["phase"] {
  const mintedN = Math.max(0, Math.floor(minted));
  if (sale.wlStart > 0 && now < sale.wlStart) return "closed";
  if (sale.publicStart > 0 && now >= sale.publicStart) {
    if (sale.publicEnd > 0 && now >= sale.publicEnd) return "closed";
    return "public";
  }
  if (sale.publicStart > 0 && now < sale.publicStart) {
    if (sale.wlEnd > 0 && now >= sale.wlEnd) return "closed";
    if (sale.wlSupply > 0 && mintedN < sale.wlSupply) return "whitelist";
    return "closed";
  }
  if (sale.wlEnd > 0 && now >= sale.wlEnd) return "public";
  if (sale.wlSupply > 0 && mintedN < sale.wlSupply) return "whitelist";
  return "public";
}

/** Fetched phase plus the local clock. A stored public phase is Start public until publicEnd. */
export function resolveMintPhase(sale: DropSale, now: number, minted: number): DropSale["phase"] {
  const derived = scheduleMintPhase(sale, now, minted);
  if (sale.phase === "public" && derived !== "public" && (sale.publicEnd <= 0 || now < sale.publicEnd)) {
    return "public";
  }
  return derived;
}

export function mintPayUgnot(
  phase: DropSale["phase"] | "none",
  sale: DropSale | null | undefined,
  dropPrice: number,
): number {
  if (phase === "whitelist") return Math.max(0, Math.floor(sale?.wlPrice || 0));
  const pub = dropPrice > 0 ? dropPrice : sale?.mintPrice || 0;
  return Math.max(0, Math.floor(pub));
}

export type MintAction =
  | { kind: "paused" }
  | { kind: "soldout" }
  | { kind: "connect" }
  | { kind: "note"; note: string }
  | { kind: "countdown"; label: string; seconds: number; priceUgnot: number; eligible: true }
  | { kind: "mint"; priceUgnot: number; eligible: boolean };

export type MintDeskInput = MintRoundInput & {
  paused: boolean;
  soldOut: boolean;
  connected: boolean;
  /** null until OnAllowlist returns. */
  allowlisted: boolean | null;
};

export type MintDesk = {
  sale: DropSale | null;
  cards: MintRoundCard[];
  action: MintAction;
};

function mintActionOf(
  input: MintDeskInput,
  live: DropSale | null,
  cards: MintRoundCard[],
): MintAction {
  if (input.paused) return { kind: "paused" };
  if (input.soldOut) return { kind: "soldout" };
  const phase = live?.phase ?? "none";
  const price = mintPayUgnot(phase === "none" ? "public" : phase, live, input.mintPrice);
  const wl = cards.find((row) => row.id === "whitelist");
  const wlWait = !!wl && wl.state === "upcoming" && wl.opensAt > input.now;
  if (phase === "closed" && input.allowlisted === true && wlWait && wl) {
    const seconds = wl.opensAt - input.now;
    return {
      kind: "countdown",
      label: `Mint in ${formatRoundCountdown(seconds)}`,
      seconds,
      priceUgnot: Math.max(0, Math.floor(live?.wlPrice || 0)),
      eligible: true,
    };
  }
  if (!live) {
    if (!input.connected) return { kind: "connect" };
    return { kind: "mint", priceUgnot: price, eligible: false };
  }
  if (phase === "closed") return { kind: "note", note: mintClosedNote(cards, "closed") };
  if (phase === "whitelist") {
    if (!input.connected) return { kind: "connect" };
    if (input.allowlisted === false) return { kind: "note", note: "This wallet is not on the whitelist." };
    return { kind: "mint", priceUgnot: price, eligible: input.allowlisted === true };
  }
  if (!input.connected) return { kind: "connect" };
  return { kind: "mint", priceUgnot: price, eligible: false };
}

/** Round cards and the mint button from the schedule clock, not the last fetched phase. */
export function mintDesk(input: MintDeskInput): MintDesk {
  const minted = input.minted ?? 0;
  const live = input.sale ? { ...input.sale, phase: resolveMintPhase(input.sale, input.now, minted) } : null;
  const cards = mintRoundCards({ ...input, sale: live, minted });
  return { sale: live, cards, action: mintActionOf(input, live, cards) };
}

/** One Adena signature stays under the simulate ceiling. A larger mint is another signature. */
export const MINT_QTY_HARD_MAX = 20;

/**
 * A block height strictly before `sinceUnix`. Blocks are assumed no faster than
 * one every 2s, with extra slack so a slow block does not hide an earlier mint.
 */
export function mintLookbackHeight(headHeight: number, headUnix: number, sinceUnix: number): number {
  const head = Math.floor(headHeight);
  if (!Number.isFinite(head) || head <= 1) return 1;
  const span = Math.max(0, Math.floor(headUnix) - Math.floor(sinceUnix || 0));
  const blocks = Math.ceil(span / 2) + 3000;
  return Math.max(1, head - blocks);
}

/** Heights strictly inside (lo, hi), at most `n`, spread across the window. */
export function probeHeights(lo: number, hi: number, n: number): number[] {
  const a = Math.floor(lo);
  const b = Math.floor(hi);
  const count = Math.max(1, Math.floor(n));
  if (!(b > a) || count < 1) return [];
  const span = b - a;
  if (span <= count) {
    const out: number[] = [];
    for (let h = a; h <= b; h++) out.push(h);
    return out;
  }
  const out: number[] = [];
  for (let i = 1; i <= count; i++) out.push(a + Math.floor((span * i) / (count + 1)));
  return [...new Set(out)];
}

/**
 * Shrink [lo, hi] to the first height whose time is >= target.
 * A probe below the target raises lo. A probe at or after it lowers hi.
 */
export function narrowHeightWindow(
  lo: number,
  hi: number,
  probes: { height: number; time: number }[],
  target: number,
): { lo: number; hi: number } {
  let nextLo = Math.floor(lo);
  let nextHi = Math.floor(hi);
  const goal = Math.floor(target);
  for (const probe of probes) {
    const height = Math.floor(probe.height);
    const time = Math.floor(probe.time);
    if (!Number.isFinite(height) || !Number.isFinite(time) || time <= 0) continue;
    if (height < nextLo || height > nextHi) continue;
    if (time < goal) nextLo = Math.max(nextLo, height + 1);
    else nextHi = Math.min(nextHi, height);
  }
  if (nextLo > nextHi) return { lo: Math.floor(lo), hi: Math.floor(hi) };
  return { lo: nextLo, hi: nextHi };
}

/** PublicMint messages with block height in [startH, endH). */
export function countMintsInHeightRange(heights: number[], startH: number, endH: number): number {
  const start = Math.floor(startH);
  const end = Math.floor(endH);
  if (!(end > start)) return 0;
  let n = 0;
  for (const raw of heights) {
    const h = Math.floor(raw);
    if (!Number.isFinite(h)) continue;
    if (h >= start && h < end) n += 1;
  }
  return n;
}

/**
 * First committed height whose header time is >= target.
 * Block time is treated as monotonic. null when the head is still before the target
 * or a header read fails. A handful of parallel probes, not one read per mint.
 */
export async function firstBlockAtOrAfter(
  head: { height: number; time: number },
  targetUnix: number,
  readTime: (height: number) => Promise<number | null>,
): Promise<number | null> {
  const target = Math.floor(targetUnix);
  const headH = Math.floor(head.height);
  const headT = Math.floor(head.time);
  if (!(target > 0) || !(headH > 0) || !(headT > 0)) return null;
  if (headT < target) return null;
  const est = headH - Math.ceil(Math.max(0, headT - target) / 3);
  let lo = Math.max(1, est - 20000);
  let hi = headH;
  const known = new Map<number, number>([[headH, headT]]);
  for (let round = 0; round < 8 && lo < hi; round++) {
    const points = probeHeights(lo, hi, 6).filter((h) => !known.has(h));
    if (points.length > 0) {
      let missing = points;
      for (let pass = 0; pass < 2 && missing.length > 0; pass++) {
        const rows = await Promise.all(missing.map(async (h) => [h, await readTime(h)] as const));
        const again: number[] = [];
        for (const [h, time] of rows) {
          if (time == null) again.push(h);
          else known.set(h, time);
        }
        missing = again;
      }
      if (missing.length > 0) return null;
    }
    const next = narrowHeightWindow(
      lo,
      hi,
      [...known].map(([height, time]) => ({ height, time })),
      target,
    );
    if (next.lo > next.hi || (next.lo === lo && next.hi === hi)) return null;
    lo = next.lo;
    hi = next.hi;
  }
  if (lo !== hi) return null;
  const time = known.get(lo);
  if (time == null || time < target) return null;
  return lo;
}

export type MintQtyRound = "whitelist" | "public";

/**
 * How many PublicMint calls this wallet can still sign in the open round.
 * supplyLeft < 0 means the collection does not cap supply.
 * A phase cap of 0 means that round has no per-wallet cap.
 */
export function mintQtyLimit(input: {
  round: MintQtyRound;
  wlCap: number;
  pubCap: number;
  mintCap: number;
  walletWl: number;
  walletPub: number;
  supplyLeft: number;
}): number {
  const wlCap = Math.max(0, Math.floor(input.wlCap || 0));
  const pubCap = Math.max(0, Math.floor(input.pubCap || 0));
  const mintCap = Math.max(0, Math.floor(input.mintCap || 0));
  const walletWl = Math.max(0, Math.floor(input.walletWl || 0));
  const walletPub = Math.max(0, Math.floor(input.walletPub || 0));
  let left = MINT_QTY_HARD_MAX;
  if (input.round === "whitelist") {
    if (wlCap > 0) left = Math.min(left, wlCap - walletWl);
  } else if (pubCap > 0) {
    left = Math.min(left, pubCap - walletPub);
  }
  if (mintCap > 0) left = Math.min(left, mintCap - walletWl - walletPub);
  if (input.supplyLeft >= 0) left = Math.min(left, Math.floor(input.supplyLeft));
  if (!Number.isFinite(left)) return 0;
  return Math.max(0, left);
}

/** Successful PublicMint times. A mint at publicStart counts as public, matching the schedule clock. */
export function splitPhaseMints(times: number[], publicStart: number): { wl: number; pub: number } {
  const start = Math.floor(publicStart || 0);
  let wl = 0;
  let pub = 0;
  for (const raw of times) {
    const t = Math.floor(raw);
    if (!Number.isFinite(t)) continue;
    if (start > 0 && t >= start) pub += 1;
    else wl += 1;
  }
  return { wl, pub };
}

/** Empty or junk input becomes 1. Values above max clamp down. max below 1 yields 0. */
export function clampMintQty(raw: string, max: number): number {
  const maxN = Math.floor(max);
  if (!Number.isFinite(maxN) || maxN < 1) return 0;
  const digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return 1;
  const n = Number(digits);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(maxN, Math.floor(n));
}

export function mintButtonLabel(qty: number, unitUgnot: number): string {
  const n = Math.max(1, Math.floor(qty) || 1);
  const unit = Math.max(0, Math.floor(unitUgnot) || 0);
  const head = `Mint ${n}`;
  if (unit <= 0) return head;
  const g = ((unit * n) / 1_000_000).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${head} · ${g} GNOT`;
}

/** A later read must not move the minted bar backwards. */
export function mergeMintedCount(shown: number, read: number): number {
  const base = Number.isFinite(shown) ? Math.max(0, Math.floor(shown)) : 0;
  if (!Number.isFinite(read) || read < 0) return base;
  return Math.max(base, Math.floor(read));
}

export function mintQtyNote(input: { limit: number; roundCap: number; used: number }): string {
  const limit = Math.max(0, Math.floor(input.limit) || 0);
  const roundCap = Math.max(0, Math.floor(input.roundCap) || 0);
  const used = Math.max(0, Math.floor(input.used) || 0);
  if (limit <= 0) return "";
  if (used > 0) return `${used} minted this round · ${limit} left`;
  if (roundCap > 0 && limit >= roundCap) {
    return roundCap === 1 ? "1 per wallet this round" : `${roundCap} per wallet this round`;
  }
  if (roundCap <= 0 && limit >= MINT_QTY_HARD_MAX) return `${MINT_QTY_HARD_MAX} per signature`;
  return limit === 1 ? "1 left this round" : `${limit} left this round`;
}
