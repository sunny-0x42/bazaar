# Collection realm sample (own mint site + list on Bazaar)

Canonical source: [`gno.land/r/bazaar/col`](../gno.land/r/bazaar/col/) (`col.gno`, `book.gno`).

You can run **your own mint page**. Bazaar still lists/buys **on that same pkg**. You do not have to use Bazaar Launch. You **do** need this surface (copy the template, or reimplement it). Minting on an unrelated realm will not list here.

Pearl libs already on chain (import these, do not reinvent GRC721):

| Role | Pearl path |
| --- | --- |
| GRC721 | `gno.land/p/g1n4pl5uc4yt5r96m9w6fmdznx3x0jyg8l6arhmt/bazaar/grc721/v0` |
| Metadata | `…/grc721/metadata/v0` |
| Protocol fee math | `…/bazaar/fee/v1` |
| Explore registry | `gno.land/r/g1n4pl5uc4yt5r96m9w6fmdznx3x0jyg8l6arhmt/bazaar/factoryv3` |

Last path element = `package` name, `[a-z][a-z0-9]{1,10}` (Gno + GRC721 symbol max 11, no hyphen). Example: `gno.land/r/<your-g1>/mycol` → `package mycol`. Rewrite the factory import to the Pearl factoryv3 path (named import `factory "…/factoryv3"`).

## Your mint site (Adena)

Same `DoContract` Bazaar uses (`/vm.m_call`). `pkg_path` = **your** collection realm.

```js
await window.adena.DoContract({
  messages: [
    {
      type: "/vm.m_call",
      value: {
        caller: address,
        send: "1000000ugnot", // exact mintPrice, or "" if mintPrice is 0
        pkg_path: "gno.land/r/<your-g1>/mycol",
        func: "PublicMint",
        args: [],
      },
    },
  ],
  gasFee: "1000000ugnot",
  gasWanted: "80000000",
});
```

| Step | `func` | `args` | `send` |
| --- | --- | --- | --- |
| Init (once) | `Init` | `name, symbol, cover, maxSupply, mintPriceUgnot, royaltyBps` | exact factory `LaunchFee` **or** `""` if you already `Reserve`d the slug |
| Optional slots | `AddDropItems` | one blob, lines `name\|https://image\|Rarity\|Trait:Value` (max 20 lines / tx) | `""` |
| Public mint | `PublicMint` | none | exact `MintPrice()` ugnot, or `""` if 0 |
| Creator mint | `Mint` | `name, imageURL` | `""` |
| Pause / resume | `PauseMint` / `ResumeMint` | none | `""` |

`OriginSend` must be **empty** or **exactly one** `ugnot` coin of the required amount. Extra denoms panic.

Cover / images: `https://`, `ipfs://`, or `/samples/…` (Bazaar UI prefixes the site origin). Prefer absolute `https://` so wallets render full-size art. `TokenURI` JSON `image` should be absolute.

## What Bazaar calls (list / buy / Explore)

All on **your pkg**. `cur realm` is the first arg (Adena omits it; the VM fills it).

| `func` | `args` | `send` |
| --- | --- | --- |
| `List` | `id, priceUgnot` | `""` |
| `UpdatePrice` | `id, priceUgnot` | `""` |
| `Cancel` | `id` | `""` |
| `Buy` | `id` | exact list price ugnot |
| `Transfer` | `to, id` | `""` (unlisted only) |
| `TransferFrom` | `from, to, id` | `""` (unlisted only) |

Secondary `Buy`: 50 bps protocol (`fee/v1`) + your `RoyaltyBps()` to `Creator()`. No self-buy. Listed tokens escrow to the realm address; `TransferFrom` while listed panics.

### qeval (Explore + Adena)

| Func | Shape |
| --- | --- |
| `Name()` / `Symbol()` | string (also `GrcName` / `GrcSymbol`) |
| `BalanceOf("g1…")` | int64 |
| `TokensOf(addr)` | csv of ids |
| `TokenURI(id)` | `data:application/json;charset=utf-8,…` ERC-721 JSON |
| `ListOpen()` | lines `id\|name\|owner\|seller\|price\|listed\|image\|rarity\|traits` (`listed` = `true`/`false`) |
| `ItemLine(id)` | same columns, one line |
| `MintPrice()` `MaxSupply()` `Minted()` `RoyaltyBps()` `Creator()` | numbers / address |
| `ListCollections()` on factoryv3 | `slug\|name\|cover\|pkg\|mintPrice\|maxSupply\|minted\|creator\|addr\|royaltyBps` |

Wallet spec: [adena-collectables.md](adena-collectables.md).

## Factory (Explore)

If `Init` imports factoryv3 and pays/reserves `LaunchFee`, the collection `Register`s itself. Then default Bazaar Explore shows it. Without factory, holders can still list if a UI is pointed at your pkg; the public site will not.

Pearl factory: `gno.land/r/g1n4pl5uc4yt5r96m9w6fmdznx3x0jyg8l6arhmt/bazaar/factoryv3`  
`LaunchFee()` qeval for the current ugnot amount.

## Tests

```bash
gno test ./gno.land/r/bazaar/col
gno test ./gno.land/r/bazaar/factory
```

Copy the folder, change `package` / `gnomod.toml` `module`, rewrite factory + GRC721 imports to Pearl paths, `addpkg`, then `Init`.
