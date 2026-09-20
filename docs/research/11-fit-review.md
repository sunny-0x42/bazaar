# Fit review — what is off, what is broken (2026-09-19)

Not investment advice. Pearl eval on `gno.land/r/g1n4pl5…/bazaar/nftv2` (outline + `ListCollections` / `ListOpen` / `Activity` / missing `Socials`).

## Live Pearl vs repo

| Surface | Repo / UI | Pearl nftv2 | Result |
| --- | --- | --- | --- |
| List / Buy / Cancel / UpdatePrice / Transfer | yes | yes | Works if Adena payload stays gnomi-shaped |
| CreateDrop / PublicMint / SetBio / PauseMint | yes | yes | Works |
| SeedSamples | yes, 6 collections / 21 items | already seeded once: **3 collections / 9 listings** | Cannot re-seed; foxes/docks/clay **not on Pearl** |
| Offer / InstantSell / Sweep | yes | **not declared** | UI hides after probe; earlier Adena error |
| Pool / Socials / LaunchCollection | yes | **not declared** | Same |
| MintIn creator-only | repo yes | old MintIn (anyone) | Weaker than repo |
| ME catalog rows | UI preview | not on chain | Buy is sample; stats are mapped SOL→GNOT |

## What does not fit

1. **Two markets on one table.** Magic Eden clones (floor 7d %, top offer, 10k supply) sit next to three tiny live drops. Collectors cannot tell Preview vs Buy-on-Pearl.
2. **Launchpad is an edition printer.** `PublicMint` names `{collection} #{n}` and reuses cover unless `/samples/{slug}-0{n}.png` exists. No per-item art/traits. See `10-drop-slots.md`.
3. **Rarity is `id % 10`.** Not trait frequency. Misleading vs ME OpenRarity.
4. **“7d Vol / Floor 7d %” are not 7 days on-chain.** Tape cap ~50; ME % only on catalog fixtures. Live stones/lamps/relics show —.
5. **USD toggle uses mainnet GNOT/USD** on Pearl test GNOT and on SOL-mapped preview GNOT. Numerically consistent, economically false. Ribbon already says test GNOT has no market value.
6. **ListOpen cap 50** — a 3000-supply drop cannot list through Explore.
7. **Indexer** (`:8788`) is optional; UI fail-softs to realm tape. Charts/true 7d never leave the machine.
8. **Profile** is a holdings view, not an on-chain profile (no name/bio/avatar realm).
9. **docs/research/09-gap.md is stale** (says no offers, no USD, no UpdatePrice in UI — those exist in source).

## What works well enough

- Explore Featured + ME-style table, full width, GNOT|USD quote.
- Collection drill-down, Live ticker, Profile `#/u/{g1}`, hash routes.
- Secondary Buy on the 9 Pearl listings (self-buy still blocked).
- Adena DoContract shape aligned with gnomi.fun.

## Three directions (pick a lane)

### 1 — Honesty cut (smallest)

Split Explore: **On this chain** (Pearl `ListCollections` + `ListOpen`) vs **Preview** (catalog / ME fixtures). Label USD as “mainnet GNOT/USD, display only.” Do not mix ME 7d % into live rows. No new realm.

### 2 — Pearl module cut

`yes deploy` nftv3 (offers, pool, socials, LaunchCollection, creator MintIn, 6-collection seed). Hub `SetModule("nft", nftv3)`. UI already probes missing funcs. Old 9 listings stay on nftv2 unless we migrate (we cannot move items).

### 3 — Launchpad slots (product)

`AddDropItems` table so each mint has its own image/traits/rarity (`10-drop-slots.md`). Needed before “many collections like ME” is true. Requires a new package path.

Recommended order: **1 then 2 then 3**. Shipping 3 onto nftv2 is impossible; shipping 2 without 1 keeps the fake ME book looking live.

## Not this cycle

Royalty, allowlist, Dutch, 10k supply, OpenRarity in-realm, ingest foreign GRC721, bonding-curve pad.
