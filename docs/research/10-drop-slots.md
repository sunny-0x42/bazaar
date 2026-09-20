# Launchpad v2 — unique items, traits, rarity (2026-09-19)

Notes only. Not investment advice. Not a GRC20 pad. Not Gnomies. Not gnomi.fun.

Goal: make **Launch collection** work for many collections where each minted NFT has its **own image, name, rarity, and traits** — like Magic Eden / Candy Machine / OpenSea Drops — without breaking Gno money-path rules.

## What we have (v1)

`CreateDrop` + `PublicMint` is a **fixed-price edition printer**:

| Field | Today |
| --- | --- |
| Name | `{collection} #{n}` |
| Image | `/samples/{slug}-0{n}.png` if that path exists, else **cover** |
| Rarity | `rarityOf(id)` = `id % 10` → Common/Uncommon/Rare/Epic/Legendary |
| Traits | none |
| Load list | none — slots are not pre-declared |

That fits a poster drop (same art, numbered). It does **not** fit a PFP / 1-of-N collection (Mad Lads-style): different picture, different traits, rarity from trait frequency.

`Mint` / `MintIn` already mint a unique name+image, but `MintIn` is **creator-only** and is not a paid public mint.

Hard rules kept: `PublicMint` 0 bps to creator; `Buy` 50 bps; quote `ugnot`; no homemade RNG; images are URLs not blobs; no `TransferFrom` of an unknown GRC721; `maxSupply` 1–3000.

## How other pads do it

| Pad | Load | Mint | Traits | Rarity | Reveal |
| --- | --- | --- | --- | --- | --- |
| **Metaplex Candy Machine** (ME Launchpad sits on this) | Creator **inserts** N items: name + metadata URI | Buyer mints; machine assigns next/guarded item | In JSON at the URI (`attributes[]`) | Off-chain: statistical (ME), MoonRank, HowRare | Optional hidden URI until reveal |
| **OpenSea Drops** | Upload **media + CSV/JSON**: token id → file + trait columns | Drop contract mints sequential ids | String traits in metadata | **OpenRarity** after reveal; ranks change if metadata changes | Placeholder until reveal; sequential ids can be sniped if metadata is public |
| **Tensor / ME secondary** | N/A (book) | N/A | Filter by trait | Rank chip | — |

Shared pattern (all of them):

1. Collection settings (name, cover, supply, price, stages).
2. **A table of N unique payloads** (image + attributes) loaded *before* or *as* mint.
3. Traits live in metadata; **rarity is computed from trait frequencies**, not from `tokenId % 10`.
4. Images live off-chain (Arweave / HTTP). Chain stores a URI.

Gno cannot copy Candy Machine guards (allowlist Merkle, bot gate) in v2 without a new primitive. Sequential mint + preloaded slots is the piece that **does** map.

## Three directions

### A — Drop slots (Candy Machine insert)

Creator after `CreateDrop`:

```
AddDropItems(slug, blob)
  blob = lines  name|image|rarity|Background:Dusk;Fur:Ember
PublicMint → take slot minted (0-based), mint that payload
```

- Each NFT has its own image URL, name, optional rarity label, optional traits.
- Sequential assignment (no RNG). Creator who wants a shuffle **pre-shuffles the file** (same as hiding the mapping off-chain).
- Batch add (e.g. ≤ 20 lines / tx) because 3000 items in one `addpkg`/call will gas out.
- `PublicMint` panics if `minted >= loaded` (cannot mint an empty slot).
- Trait string cap: e.g. 8 pairs, key/value `[A-Za-z0-9 _-]`, `|` and `;` reserved.
- UI: Launch collection → **Load items** (paste CSV / JSON) → mint page shows remaining.
- Collection page: trait chips; filter later (v2.1).
- Rarity **label** can be creator-set (Common…Legendary) **or** left blank and filled by an indexer statistical rank after mint-out (ME-style). Do not keep `id % 10` for slot drops.

Fits Gno: deterministic, fail-closed, no RNG, URLs already valid.

### B — Metadata URI only (OpenSea tokenURI)

Each slot is one `https://…/n.json`. Realm stores URI. UI fetches JSON (`name`, `image`, `attributes`).

- Smaller on-chain state.
- Traits/rarity entirely off-chain — ranks can change if the host edits JSON (OpenSea warns about this).
- Fail-open for collectors if the host dies: item image blank.

Reject as the **only** store. Optional later: `uri` field *in addition to* on-chain name/image/traits.

### C — Layer generator on-chain

Store layers + weights, compose on mint.

Reject. Needs RNG or a huge combination table; images still off-chain; Gno has no canvas. Generators (HashLips, etc.) stay **off-chain**; their output CSV feeds direction A.

## Recommendation

**Ship A (drop slots) as Launchpad v2.** Keep v1 `PublicMint` edition printer when the creator loads **zero** slots (today’s cover+#n behavior) so old drops do not break.

| Creator intent | Path |
| --- | --- |
| Numbered editions, same art | `CreateDrop` only → current `PublicMint` |
| Unique art + traits | `CreateDrop` + `AddDropItems` until `loaded == maxSupply` → `PublicMint` consumes slot |
| Single 1/1 | existing Launch **Mint 1/1** (`Mint` / `MintIn`) |

Rarity display:

1. If slot has a rarity string, show that chip (creator-declared).
2. After a collection is minted out, indexer may attach **statistical rarity** (product of trait frequencies). Do not bake OpenRarity into the realm.
3. Remove `rarityOf(id % 10)` for new slot mints (keep for already-minted seed items).

Deferred (not v2): allowlist, Dutch, royalty, hidden Merkle reveal, trait filter sidebar, 10k supply (keep 3000 cap).

## UI (English)

Launch → Collection (unchanged params) then a second panel **Items in this drop**:

- Rows: `#`, name, image URL, rarity, traits.
- Paste CSV: `name,image,rarity,trait:value;trait:value`
- Progress: `loaded / maxSupply`. Mint disabled until `loaded == maxSupply` **or** creator checks “edition drop (no slot table)”.

Item drawer: Properties grid = traits, not only rarity.

## Invariants (if built)

- Money path: `PublicMint` still exact `mintPrice`, 0 bps, creator paid, `IsUserCall`.
- `AddDropItems` does not take `OriginSend`.
- Slot cannot be overwritten once loaded (`panic` on reuse).
- `PublicMint` with slots: `minted < loaded` and `minted < maxSupply`.
- No RNG. Shuffle is the creator’s file order.

## Assumptions not proven

- HTTP image hosts stay up (same as today).
- 20-line batches × 150 txs for a 3000 drop is acceptable UX on Adena.
- Pearl gas for `AddDropItems` of 20 lines — unmeasured until gnodev smoke.
