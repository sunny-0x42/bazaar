# Adena collectables — Bazaar NFT surface

This note is for **Adena / Onbloc** (and any Gno wallet). Bazaar does not fork Adena (GPL). Wallets **qeval** these functions and sign **`MsgCall`** the same way they already do for Bazaar mint/list.

Live site: https://bazaar-gno.vercel.app  
Chain: **pearl-1** · RPC `https://rpc.pearl.testnets.gno.land:443`

## Unit of a collectable

One **collection** = one **realm package** = one derived `g1` address.

Example (Glow, factoryv3 template with wallet aliases):

| | |
| --- | --- |
| Pkg path | `gno.land/r/g1n4pl5uc4yt5r96m9w6fmdznx3x0jyg8l6arhmt/bazaar/c/glow` |
| Realm address | `chain.PackageAddress(pkg)` (copy from the collection page) |

Do **not** treat `nftv7` slugs as many contracts. Do **not** import the GRC721 **library** (`p/…/grc721/v0`) as a collectable — tokens live on the **collection realm**.

## qeval (display)

| Need | Func | Example |
| --- | --- | --- |
| Name | `Name()` | `("Glow" string)` |
| Symbol | `Symbol()` | `("glow" string)` |
| Balance | `BalanceOf("g1…")` | `(1 int64)` |
| Ids owned | `TokensOf("g1…")` | csv of int ids |
| Metadata | `TokenURI(id)` | `data:application/json;charset=utf-8,…` |
| Owner | `OwnerOf(id)` / `GrcOwnerOf(id)` | address / string |

Aliases `Name` / `Symbol` / `BalanceOf` ship on the current `col` template (Glow+). Older pkgs (foam, mist, reef) only have `GrcName` / `GrcBalanceOf`. Prefer aliases; fall back to `Grc*` if undeclared.

### TokenURI

JSON ERC-721 shape inside a data URI (`name`, `description`, `image`, `attributes`). `image` is an absolute `https://` (or `ipfs://`) URL.

Decode `data:application/json…` (optional `charset=utf-8`, percent-encoding). If `TokenURI` is a bare `https://` / `/samples/` string, treat it as the image (legacy foam).

### Listed items

`List` escrows the NFT to the **collection realm**. `TokensOf(user)` then **omits** that id. Show listed items from Bazaar UI, or skip them in the wallet until `Cancel`. Do not treat escrow as a burn.

## MsgCall (send)

Unlisted only: `TransferFrom(from, to, id)` on the **collection pkg**. Listed tokens panic `col: listed`.

Mint/list/buy stay on Bazaar (`PublicMint`, `List`, `Buy`) with exact `ugnot` `OriginSend`.

## Discovery (optional)

Poll factory registries, then for each `pkg` call `TokensOf` + `TokenURI`:

- `gno.land/r/g1n4pl5uc4yt5r96m9w6fmdznx3x0jyg8l6arhmt/bazaar/factoryv3`
- `gno.land/r/g1n4pl5uc4yt5r96m9w6fmdznx3x0jyg8l6arhmt/bazaar/factoryv2`

`ListCollections()` lines: `slug|name|cover|pkg|mintPrice|maxSupply|minted|creator|addr|royaltyBps`

User paste (Manage Collectables) of a single pkg path is enough for v1.

## Add-collectable UX (if Adena ships RPC)

Suggested payload: `{ chain_id: "pearl-1", pkg_path: "gno.land/r/…/c/glow" }`. Until then, copy the realm path from Bazaar.

`onbloc/gno-token-resource` is GRC20-only today. A GRC721 row would be pkg path + name + symbol + logo — not required for qeval.
