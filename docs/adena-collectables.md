# Adena collectables — Bazaar NFT surface

This note is for Adena / Onbloc and any Gno wallet. Bazaar does not fork Adena (GPL). Wallets qeval these functions and sign `MsgCall` the same way they already do for Bazaar mint and list.

Live site: https://bazaar.gnomi.fun

Chain: `gnoland-1`. RPC `https://rpc.gno.land`.

Factory for a new collection: `gno.land/r/g1n4pl5uc4yt5r96m9w6fmdznx3x0jyg8l6arhmt/bazaar/bazaarv5`

Adena indexes `NewToken` / `Transfer` whose `pkg_path` is genesis `gno.land/p/nt/grc721/v0`. A collection that should show a token grid imports that library. `OwnerOf` must be `(address, error)`.

The committed `gno.land/r/bazaar/col` sample still imports `gno.land/p/bazaar/grc721/v0` and exports `OwnerOf(id int) address`. That pair leaves the collection card without a token grid. The live Bazaar Gens realm uses the string form.

The public grid hides slugs `test`, `stdcol`, `adcol`, `col3333`, and `shown`.

## Unit of a collectable

One collection = one realm package = one derived `g1` address.

| | |
| --- | --- |
| Pkg path | `gno.land/r/g1n4pl5uc4yt5r96m9w6fmdznx3x0jyg8l6arhmt/bazaar/c/bazaargens` |
| Realm address | `chain.PackageAddress(pkg)`, also printed on the collection page |

Do not treat nftv7 slugs as many contracts. Do not add the GRC721 library (`p/nt/grc721/v0` or `p/…/grc721/v0`) as a collectable. Tokens live on the collection realm.

## qeval (display)

| Need | Func | Example |
| --- | --- | --- |
| Name | `Name()` | `("Bazaar Gens" string)` |
| Symbol | `Symbol()` | string |
| Balance | `BalanceOf("g1…")` | `(1 int64)` |
| Ids owned | `TokensOf("g1…")` | csv of ids. Listed ids are omitted. |
| Enumerable | `TokenOfOwnerByIndex("g1…", 0)` | one id string, when the pkg exports it |
| Metadata | `TokenURI("1")` | `data:application/json;charset=utf-8,…` |
| Owner | `OwnerOf("1")` | `(address, error)`. Adena: `owner, err := OwnerOf("1"); owner.String()`. A `string` return leaves the collection card with no token grid. |

`Name` / `Symbol` / `BalanceOf` are the aliases. `GrcName` / `GrcSymbol` / `GrcBalanceOf` remain on the template. Prefer the aliases.

### TokenURI

JSON inside a data URI: `name`, `description`, `image`, `attributes`. `image` on a current collection is an absolute `https://` URL. The chain `validImage` rejects `ipfs://` at mint and `Init`. Decode `data:application/json` (optional `charset=utf-8`, percent-encoding).

### Listed items

`List` escrows the NFT to the collection realm. `TokensOf(user)` then omits that id. `OwnerOf` for that id is the realm address. Show the listing in the Bazaar UI, or skip it in the wallet until `Cancel` or `Buy`. Escrow is not a burn.

## MsgCall

Unlisted only: `TransferFrom(from, to, id)` on the collection pkg. Listed tokens panic `col: listed`.

`PublicMint`, `List`, and `Buy` stay on that same pkg, with exact `ugnot` `OriginSend` when a payment is required.

## Discovery

For new collections, poll bazaarv5 and then `TokensOf` + `TokenURI` on each `pkg`:

`gno.land/r/g1n4pl5uc4yt5r96m9w6fmdznx3x0jyg8l6arhmt/bazaar/bazaarv5`

`ListCollections()` lines: `slug|name|cover|pkg|mintPrice|maxSupply|minted|creator|addr|royaltyBps`

The Bazaar UI also merges older registries `bazaarv2`, `bazaarv1`, and `factory`. Those packages stay on chain. A new collectable registers on bazaarv5.

Pasting one pkg path into Manage Collectables is enough for a single collection.

## Add-collectable payload

`{ chain_id: "gnoland-1", pkg_path: "gno.land/r/…/c/<slug>" }`

`onbloc/gno-token-resource` is GRC20-only. A GRC721 row would be pkg path + name + symbol + logo. qeval does not need that row.
