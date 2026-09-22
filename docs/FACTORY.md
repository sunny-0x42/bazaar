# Local launchpad factory (per-realm collections)

**This is the local launchpad factory.** Each collection is its **own Gno realm** (`gno.land/r/bazaar/c/<slug>`), not a slug inside nftv7.

Pearl factory with **Reserve**: `…/bazaar/factoryv3`. Live catalog still merges `factoryv2` (foam/mist). Frozen `factory` / `factoryv2` are not overwritten. New cols: `Reserve` (pay fee) → `pearl-new-col.ps1` → Adena `Init` with **empty send**. nftv7 remains the old in-realm pad.

Gno cannot `MsgAddPackage` from a realm. Adena cannot `addpkg`. Copy/addpkg the `col` template, then `Init`.

`TokenURI(id)` after mint is a `data:application/json` ERC-721 document (`name`, `description`, `image`, `attributes`). Foam (older addpkg) still returns a bare image URL. New `pearl-new-col` instances use JSON. The GRC721 `metadata` extension is attached at `Init`.

## Realms

| Path | Role |
| --- | --- |
| `gno.land/r/bazaar/factory` | Registry + launch fee. **This** local factory. |
| `gno.land/r/bazaar/col` | Template collection (copy; do not launch this path as a product collection) |
| `gno.land/r/bazaar/c/<slug>` | One collection instance (`package <slug>`) |

Factory does **not** import collection packages (future paths are unknown).

Pearl: `gno.land/r/g1n4pl5uc4yt5r96m9w6fmdznx3x0jyg8l6arhmt/bazaar/nftv7` remains the live book until Pearl factory yes.

## Launch (local)

1. `factory.Init` — first EOA is admin. Default `LaunchFee` = `1_000_000_000` ugnot (1000 GNOT). Admin `SetLaunchFee`.
2. Copy template: `tools/local-new-col.ps1 -Slug <slug>`
   - Slug = last path element of the collection pkg **and** the Gno package name: `[a-z][a-z0-9]{1,10}` (2–11 chars, GRC721 symbol max 11, no hyphen).
3. Deploy the new pkg (gnodev extra-root picks it up). Adena cannot addpkg.
4. Call `<slug>.Init(cur, name, symbol, cover, maxSupply, mintPriceUgnot, royaltyBps)` as EOA with **exact** `LaunchFee` ugnot (`OriginSend`). Extra denoms panic.
   - Collection sends ugnot to `factory.Address()`, then `CreditLaunchFee` + `Register`.
   - `Register` stores slug = last path element of the collection pkg, pkg path, creator = `Previous.Previous` EOA.
   - Panic if slug taken or pkg already registered.

`maxSupply` 0 = open edition until creator `PauseMint`.

## Drop slots

`AddDropItems(cur, blob)` — creator only, no `OriginSend`. Up to 20 pipe lines: `name|image|rarity|Trait:Value;Trait:Value`. Appends slots; `loaded` cannot exceed `maxSupply` (or 10_000 if open edition). Empty loaded = numbered edition mint.

`PublicMint(cur)` — if `loaded > 0`, consume the next slot (name, image, rarity, traits). Panic `col: no slot` when `minted >= loaded`. Else name `{collection} #{n}`, image `/samples/{slug}-0{n}.png` or cover.

## Reads (UI / Adena)

Factory `ListCollections()` lines:

```
slug|name|cover|pkg|mintPrice|maxSupply|minted|creator
```

`CollectionOf(slug)` → collection pkg path.

Collection reads match the nft book so the UI can reuse them: `ItemLine`, `ListOpen`, `NextID`, `TokenURI`, `GrcName`, `GrcSymbol`, `GrcOwnerOf`, `GrcBalanceOf`, `OwnerOf`, `PriceOf`, `ListDropSlots`, `LoadedOf`.

Adena **Add collectable** = the **collection pkg path** (`gno.land/r/bazaar/c/<slug>`), not the factory and not `nftv7`.

## Money

- Primary `PublicMint`: exact `mintPrice` ugnot, 0 protocol fee, GNOT to creator.
- Secondary `List` / `UpdatePrice` / `Cancel` / `Buy`: escrow is GRC721 `TransferFrom` owner→realm on List, realm→buyer on Buy. Buy: 50 bps protocol (`fee.ProtocolFee`) to factory, `royaltyBps` to creator, rest to seller.
- Fail-closed: `panic`, not `error`. `requireUser` = `cur.Previous().IsUserCall()`.
- Factory admin `Withdraw` sends accumulated ugnot (launch fees + protocol) to admin.

## Sample

`gno.land/r/bazaar/c/demo` (`package demo`) is the gnodev sample instance of the template.

Skip pool / offers / sweep / whitelist in this local v1.
