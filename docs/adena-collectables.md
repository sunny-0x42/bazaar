# Adena collectables — Bazaar NFT surface

This note is for holders and for Adena / Onbloc. Nomaq does not fork Adena. Wallets qeval these functions and sign `MsgCall` the same way they already do for mint and list.

| | |
| --- | --- |
| Site | https://nomaq.xyz |
| Chain | `gnoland-1` · RPC `https://rpc.gno.land:443` |
| Bazaar Gens | `gno.land/r/g1n4pl5uc4yt5r96m9w6fmdznx3x0jyg8l6arhmt/bazaar/c/bazaargens` |
| New collections | `gno.land/r/g1n4pl5uc4yt5r96m9w6fmdznx3x0jyg8l6arhmt/bazaar/bazaarv5` |

Adena indexes `NewToken` / `Transfer` whose `pkg_path` is genesis `gno.land/p/nt/grc721/v0`. A collection that should show a token grid imports that library. `OwnerOf` must be `(address, error)`.

The committed `gno.land/r/bazaar/col` sample still imports `gno.land/p/bazaar/grc721/v0` and exports `OwnerOf(id int) address`. That pair leaves the collection card without a token grid. The live Bazaar Gens realm uses the string form.

The public grid hides slugs `test`, `stdcol`, `adcol`, `col3333`, `shown`, and `seafish`.

## Holders — Bazaar Gens does not render in Adena

Nomaq shows a Bazaar Gens NFT while you own it. Adena does not render that collection, including an unlisted token whose `OwnerOf` is your address.

Adena puts the `TokenURI` string in the image tag and reads `TokenMetadata` for the card. On the live realm:

| Call | What the chain returns |
| --- | --- |
| `TokenURI("92")` | One string: `data:application/json;charset=utf-8,…`. The picture is the `image` field inside that JSON (a `https://gateway.pinata.cloud/ipfs/…` URL). Adena does not open the JSON. |
| `TokenMetadata("92")` | Not declared. |
| `Name()` / `Symbol()` / `BalanceOf` / `TokensOf` / `OwnerOf("92")` | Collection name, unlisted balance, and owner. Nomaq uses these, plus `ItemLine`, to paint the card. |

Connecting the site (`AddEstablish`) only names the dapp session. It does not register the GRC721 package.

### The collection cannot be patched in place

Bazaar Gens was deployed as a **public** package. Its `gnomod.toml` has no `private = true`. Mainnet runs `v1.5.1`. That release rejects a second `addpkg` of a public package with `package already exists`. Only a realm deployed with `private = true` can be replaced, and that replacement keeps the existing realm storage.

There is no public function that rewrites the stored `TokenURI`. Minted Bazaar Gens tokens stay on this realm. View and trade them on https://nomaq.xyz.

A wallet that decoded `data:application/json` and used the `image` field would show the picture. The Adena build that reads `TokenURI` as an image address does not. Nomaq cannot change that by a site deploy.

### Listed items

`List` moves the NFT to the collection realm. `TokensOf` and `BalanceOf` of the seller then omit that id. `OwnerOf` for that id is the realm address. Adena hides it until `Cancel` or `Buy`. Escrow is not a burn. An unlisted Bazaar Gens token is still invisible in Adena, because of the metadata mismatch above.

## What Adena draws

Collections that show in Adena return the image from `TokenURI` and the card from `TokenMetadata`.

`TokenURI` returns the image URL itself (`https://…`), not a JSON document.

`TokenMetadata(tid) (string, error)` returns JSON. The attribute key Adena reads is `traitType` (camelCase):

```json
{
  "name": "Bazaar Gens #0092",
  "description": "Bazaar Gens #92",
  "image": "https://gateway.pinata.cloud/ipfs/bafybeiebnyh5hxzzzcgiffc4unc2a55fukwzxtyhgoe3nac242enpozgkm",
  "attributes": [{ "traitType": "Rarity", "value": "Common" }]
}
```

Live Bazaar Gens does the opposite: `TokenURI(tid string) string` returns the data URI (attributes use `trait_type`), and `TokenMetadata` is absent.

A new collection that should appear in Adena should return the https image from `TokenURI`, add `TokenMetadata`, keep `OwnerOf(tid string) (address, error)`, and set `private = true` in `gnomod.toml` before the first `addpkg` if those reads may need a later correction. A public package on this mainnet cannot be replaced.

## qeval (display)

| Need | Func | Example |
| --- | --- | --- |
| Name | `Name()` | `("Bazaar Gens" string)` |
| Symbol | `Symbol()` | string |
| Balance | `BalanceOf("g1…")` | `(1 int64)` |
| Ids owned | `TokensOf("g1…")` | csv of ids. Listed ids are omitted. |
| Enumerable | `TokenOfOwnerByIndex("g1…", 0)` | one id string, when the pkg exports it |
| Image | `TokenURI("1")` | On Bazaar Gens: a JSON data URI, which Adena does not render. For a visible card: the `https://` image URL. |
| Card | `TokenMetadata("1")` | Absent on Bazaar Gens. Elsewhere: `(string, error)` JSON with `traitType`. |
| Owner | `OwnerOf("1")` | `(address, error)`. Adena: `owner, err := OwnerOf("1"); owner.String()`. A `string` return leaves the collection card with no token grid. |

`Name` / `Symbol` / `BalanceOf` are the aliases. `GrcName` / `GrcSymbol` / `GrcBalanceOf` remain on the template. Prefer the aliases.

The chain `validImage` rejects `ipfs://` at mint and `Init`. Store `https://gateway.pinata.cloud/ipfs/<cid>`.

## MsgCall

Unlisted only: `TransferFrom(from, to, id)` on the collection pkg. Listed tokens panic `col: listed`.

`PublicMint`, `List`, and `Buy` stay on that same pkg, with exact `ugnot` `OriginSend` when a payment is required.

## Discovery

For new collections, poll bazaarv5 and then `TokensOf` + `TokenURI` on each `pkg`:

`gno.land/r/g1n4pl5uc4yt5r96m9w6fmdznx3x0jyg8l6arhmt/bazaar/bazaarv5`

`ListCollections()` lines: `slug|name|cover|pkg|mintPrice|maxSupply|minted|creator|addr|royaltyBps`

The Nomaq UI also merges older registries `bazaarv2`, `bazaarv1`, and `factory`. Those packages stay on chain. A new collectable registers on bazaarv5.

Pasting one pkg path into Manage Collectables is enough for a single collection. Bazaar Gens will still not draw, for the reason in the holders section.

## Add-collectable payload

`{ chain_id: "gnoland-1", pkg_path: "gno.land/r/…/c/<slug>" }`

`onbloc/gno-token-resource` is GRC20-only. A GRC721 row would be pkg path + name + symbol + logo. qeval does not need that row.

## Unit of a collectable

One collection = one realm package = one derived `g1` address. Realm address is `chain.PackageAddress(pkg)`, also printed on the collection page.

Do not treat nftv7 slugs as many contracts. Do not add the GRC721 library (`p/nt/grc721/v0` or `p/…/grc721/v0`) as a collectable. Tokens live on the collection realm.
