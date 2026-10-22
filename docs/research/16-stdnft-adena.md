# Official GRC721 probe vs Bazaar `col` (mainnet)

Live Adena probe (unlisted, wallet still owns token `1`):

`gno.land/r/g1n4pl5uc4yt5r96m9w6fmdznx3x0jyg8l6arhmt/bazaar/stdnft`

gnoweb: https://gno.land/r/g1n4pl5uc4yt5r96m9w6fmdznx3x0jyg8l6arhmt/bazaar/stdnft

Paste that pkg in Adena **Manage Collectables** on **gnoland-1**.

## What shipped

Realm `stdnft` wraps **genesis** libs (not the Bazaar fork):

- `gno.land/p/nt/grc721/v0`
- `gno.land/p/nt/grc721/metadata/v0`
- `gno.land/p/nt/grc721/enumerable/v0`

Heights: addpkg **318375**, `Init` **318382**, `Mint` **318384**. `Init` emitted `NewToken` from `p/nt/grc721/v0`. `Mint` emitted `Transfer` (from empty) plus `TokenURIUpdate` from `p/nt/grc721/metadata/v0`.

Token `1` “Std Gnomie”, image `https://bazaar-gno.vercel.app/gnomies.png`, owner `g1n4pl5uc4yt5r96m9w6fmdznx3x0jyg8l6arhmt`.

Local source: `gno.land/r/bazaar/stdnft`. `gno test ./gno.land/r/bazaar/stdnft/` PASS. Deploy: `tools/mainnet-stdnft.ps1 -Broadcast`.

## qeval that Adena can call (proven on chain)

| Need | `stdnft` | Result |
| --- | --- | --- |
| Name | `Name()` | `("StdNFT" string)` |
| Symbol | `Symbol()` | `("STDNFT" string)` |
| Balance | `BalanceOf("g1…")` | `(1 int64)` |
| Owner | `OwnerOf("1")` | wallet `g1n4pl5…` (string) |
| Ids | `TokensOf("g1…")` | `("1" string)` |
| Enumerable | `TokenOfOwnerByIndex("g1…", 0)` | `("1" string)` |
| Metadata | `TokenURI("1")` | `data:application/json;charset=utf-8,%7B…` |
| Send | `TransferFrom(from, to, "1")` | string ids |

## Same wallet vs Bazaar `c/test`

Pkg: `gno.land/r/g1n4pl5…/bazaar/c/test` (listed Gnomies Legendary).

| Surface | `stdnft` (genesis GRC721) | `col` / `c/test` (Bazaar fork) |
| --- | --- | --- |
| Library | genesis `p/nt/grc721/*` | `p/g1…/bazaar/grc721/v0` + metadata only |
| TokenID | `string` (`"1"`) | `int` (`1`) |
| `OwnerOf("1")` | works | **fails** (`cannot use untyped string as IntKind`) |
| `TokenURI("1")` | works | `TokenURI(1)` only |
| `TokenOfOwnerByIndex` | yes | **missing** |
| `TokensOf` | `string` address | `address` (qeval `"g1…"` still coerces) |
| Enumerable extension | attached | not attached |
| List/Buy escrow | none | `List` moves NFT to realm `g1kn8z…` |
| Wallet gallery while listed | n/a (unlisted) | `BalanceOf` **0**, `TokensOf` empty, `OwnerOf(1)` = realm |

`c/test` TokenURI JSON shape matches `stdnft` (percent-encoded data URI + https image). Encoding is not the Adena gap. **String vs int TokenID** and **missing TokenOfOwnerByIndex** are.

## Packages Bazaar uses today

| Path | Role |
| --- | --- |
| `p/nt/grc721/v0` + metadata + enumerable + royalty | genesis on **mainnet only**. Pearl does not have them. |
| `p/g1…/bazaar/grc721/v0` + `metadata/v0` | what `factory` / `col` / `c/test` import |
| `p/bazaar/grc721/{enumerable,royalty}/v0` | in repo, **not** on mainnet col |
| `r/g1…/bazaar/factory` | Explore registry, LaunchFee 10 GNOT |
| `r/g1…/bazaar/c/{slug}` | GRC721 + List/Buy in one realm |
| `r/bazaar/nft` (nftv7 on Pearl) | multi-slug one realm; poor Adena mapping |

## How to finish the product

Do **not** overwrite `c/test`, factory, or Pearl cols.

1. **Adena check (human).** Paste `…/bazaar/stdnft` on gnoland-1.
   - Name + image + token `1` → string-id + TokenURI + enumerable is enough; next `col` template should match `stdnft` qeval.
   - Collection adds, no image → try `data:application/json;base64` TokenURI on a new mint (do not mutate this pkg).
   - Cannot add pkg → Adena chain / collectables RPC, not Bazaar.

2. **Collection template `col` (source)** now matches that Adena surface and still `List`/`Buy`s:
   - `OwnerOf("1")` / `TokenURI("1")` / `TransferFrom(from,to,"1")` / `TokensOf("g1…")` / `TokenOfOwnerByIndex`.
   - `List`/`Buy`/`Cancel` stay int MsgCall (Adena DoContract args are strings → int).
   - Listed NFT owner = collection realm, so Adena hides it until Cancel/Buy.
   - Frozen `c/test` is still int `OwnerOf(1)`. Next `tools/mainnet-new-col.ps1 -Slug NAME -Broadcast` copies this template.

3. **Listed items.** Wallet hide while listed is correct (`OwnerOf` = realm). Profile/Explore stay the listed surface. Do not teach Adena to show escrowed ids as wallet-owned.

4. **External GRC721.** Still compile-time import. A plain `stdnft`-class realm can list on Bazaar only via a per-pkg adapter or by copying List/Buy into that realm. Genesis GRC721 does not add OpenSea-style “paste any contract”.
