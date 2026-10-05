# Collection factory (one realm per collection)

Each collection is its own Gno realm, not a slug inside nftv7.

## Mainnet

Factory: `gno.land/r/g1n4pl5uc4yt5r96m9w6fmdznx3x0jyg8l6arhmt/bazaar/bazaarv5`

Create path: copy `gno.land/r/bazaar/col`, retarget imports ([listing-external.md](listing-external.md)), `addpkg`, **Reserve**, then `Init` with an empty send. `Register` runs inside `Init`. Adena cannot `addpkg`.

- `LaunchFee()` is 1000 GNOT (`1000000000ugnot`) as read on 2026-10-05. A normal account sends that on `Reserve`. `ReserveDue` for the factory admin is 0. Admin `SetLaunchFee` changes the next Reserve. `CancelReserve` returns the ugnot that Reserve locked.
- `Init` without a matching Reserve panics `col: reserve first` on the current template. The live factory has no `CreditLaunchFee`. The committed `col` sample still calls `CreditLaunchFee`; replace that before `addpkg`.
- `Withdraw` sends spendable ugnot on the factory (`balance − sum of open reserves`) to the admin.
- `Buy` on a collection that imports this factory uses `ProtocolBps()` (**200**). Admin `SetProtocolBps` accepts 0–500. After `HolderDiscount`, `GenesisShareBps()` (**1100**, 11% of the protocol fee) goes to `GenesisSink()` (`perk2`). The rest goes to `ProtocolSink()`.
- Older packages `bazaarv1`, `bazaarv2`, `bazaarv3`, `bazaarv4`, and Pearl `factoryv3` / `nftv7` stay on their chains. A new collection registers here.

Source package in this repo is `gno.land/r/bazaar/factory`. The mainnet deploy name is `bazaarv5`.

## Adena

The live template imports genesis `gno.land/p/nt/grc721/v0`. `OwnerOf(tid string) (address, error)`. `List` escrows the token to the collection realm. See [adena-collectables.md](adena-collectables.md).

## Realms

| Path | Role |
| --- | --- |
| `gno.land/r/bazaar/factory` | Factory source |
| `gno.land/r/…/bazaar/bazaarv5` | Live mainnet factory |
| `gno.land/r/bazaar/col` | Template. Do not launch this path as a product collection. |
| `gno.land/r/<g1>/…/<slug>` | One collection. `package` name = slug. |

## Launch (local gnodev)

1. `factory.Init`. The first EOA is admin. Source default `LaunchFee` is 1000 GNOT. Tests set it to 0.
2. Slug `[a-z][a-z0-9]{1,10}`.
3. `Reserve` the slug, then `Init(...)` with an empty send. Fixed supply starts paused until slots exist and the creator calls `ResumeMint`. `SetDropSale`, `StartPublic`, `SetMintCap`, `SetHidden`, `Reveal`, and `AddAllowlist` live on the `col` template.
4. `maxSupply` 0 stays an open edition until `PauseMint`.

## Drop slots

`AddDropItems(cur, blob)` is creator-only and takes no `OriginSend`. Up to 20 lines: `name|image|rarity|Trait:Value;Trait:Value`.

`PublicMint(cur)` consumes the next slot when `loaded > 0`.

## Reads

`ListCollections()` lines:

```
slug|name|cover|pkg|mintPrice|maxSupply|minted|creator|addr|royaltyBps
```

The public UI reads `bazaarv5` and still merges `bazaarv2`, `bazaarv1`, and `factory`. Hidden slugs: `test`, `stdcol`, `adcol`, `col3333`, `shown`.

Adena’s collectable is the **collection pkg**, not the factory.

## Money

- Primary `PublicMint`: exact mint price, 0 protocol, GNOT to the creator.
- Secondary: `List` escrows the GRC721 to the realm. `Buy` pays seller, royalty, `ProtocolSink`, and `GenesisSink`. Missing payment or a bad caller panics.
- The collection page has no Pool tab.
