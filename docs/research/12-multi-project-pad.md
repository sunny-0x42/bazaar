# Launchpad as a multi-project studio (2026-09-19)

Notes only. Not investment advice. Not gnomi.fun. Not Gnomies. Builds on `10-drop-slots.md` (slots shipped in source).

Goal: Bazaar is usable by **many independent projects** (PFP, 1/1 series, edition posters, game items) without each team writing a realm. Same fee lock: primary 0 bps, secondary 50 bps, quote ugnot.

## What a multi-project pad actually is

Three products, not one:

| Role | ME / OpenSea Studio / LaunchMyNFT | Bazaar now |
| --- | --- | --- |
| **Studio** (creator configures a drop) | no-code: supply, price, phases, assets, mint page | Launch form + Load items CSV |
| **Mint surface** (collectors mint *this* drop) | hosted `/mint/{collection}` | Launch grid of all drops |
| **Book** (secondary) | ME / OS marketplace | Explore + collection page |

A pad that “many projects use” is **self-serve studio + per-drop mint page + automatic listing on the book**. Curation (ME Launchpad vetting) is optional and off-chain.

## Competitor map (what they sell to projects)

| Need | Candy Machine / ME | OpenSea Drops | LaunchMyNFT | Gno-safe on Bazaar |
| --- | --- | --- | --- | --- |
| Unique art + traits | insert items / URI | CSV + media | generate or upload | **Slots** (`AddDropItems`) — shipped |
| Edition / same art | possible | possible | possible | **loaded=0** PublicMint — shipped |
| 1/1 | separate | Studio | upload 1 | **Mint / MintIn** — shipped |
| Allowlist / WL | Merkle / candy guard | drop stages | WL phase | **Address tree** (batch `AddAllowlist`). No Merkle (no homemade crypto) |
| Per-wallet cap | guard | stage limit | yes | **avl `slug:addr → n`** |
| Start / end | timestamp guards | calendar stages | yes | **block height** if no trusted `time.Now`; else unix if stdlib |
| Pause / price edit | update machine | drop settings | yes | **PauseMint / SetMintPrice** — shipped |
| Dedicated mint page | ME drop page | OS drop page | auto mint page | **missing** (`#/m/{slug}`) |
| Creator dashboard | studio | studio | dashboard | **thin** (Launch tabs only) |
| Reveal / hidden | hiddenSettings | placeholder URI | optional | **deferred** (sequential slots already leak order) |
| Bot tax / captcha | candy guard | OS account | some | **deferred** (EOA `IsUserCall` only) |
| Dutch / bonding | rare | no | no | **reject** (not this product) |
| Royalty | optional | optional | optional | **reject** (0 primary ≠ royalty) |
| 10k supply | common | 10k | large | **keep 3000** until gas proven |

## Three directions for “many projects”

### 1 — Self-serve studio (recommended next)

No new mint math. Make one project’s lifecycle obvious:

1. Create drop (settings).
2. Load slots *or* mark edition.
3. Optional: allowlist wallets + per-wallet cap + start/end height.
4. Public mint on **`#/m/{slug}`** (cover, price, remaining, mint CTA) — not buried in Launch’s global grid.
5. Creator hub: my drops, loaded/minted, pause, add 20 slots, add 50 allowlist lines.
6. After mint, item is already on the Bazaar book (`List` when holder wants).

Fits Gno. Highest leverage for “nhiều dự án sử dụng.”

### 2 — Phased mint (WL then public)

Two prices, two windows, same slots. `PublicMint` checks: if now in WL window, caller must be on tree and `mintedBy[caller] < cap`. Else public price.

Do this **after** 1. Without a mint page and dashboard, phases are unusable.

### 3 — Hosted metadata URI beside slots

Optional `uri` per slot for long descriptions / extra files. Traits stay on-chain (filter already uses them). URI is extra, not the only store (`10-drop-slots` rejected URI-only).

## Do not copy

- ME **curated** Launchpad (doxx, legal agreement) — that is a company process, not a realm.
- HashLips **on-chain** generator.
- Merkle allowlist unless a canonical `/p/` exists.
- Dutch, raffle RNG, royalty slider.

## Invariants if built

- Money path still `PublicMint` exact `mintPrice` (or phase price), 0 bps to creator, `IsUserCall`.
- Allowlist add does not take `OriginSend`.
- Caps fail-closed (`panic`).
- Slots still sequential; shuffle is the creator’s file.

## Assumptions not proven

- Adena 20-line slot batches × 150 txs for 3000 items.
- Allowlist of a few thousand g1 in avl vs gas.
- Block-height windows vs user expectation of clock time.
- Pearl still on `nftv2` — studio/phases need a new path (`nftv3+`) after human yes.
