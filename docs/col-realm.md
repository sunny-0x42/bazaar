# Collection realm sample (own mint site + list on Bazaar)

Canonical source to copy: [`gno.land/r/bazaar/col`](../gno.land/r/bazaar/col/) (`col.gno`, `book.gno`).

You can run your own mint page. Bazaar lists and buys on that same package. Minting on an unrelated realm does not list here.

Chain is mainnet `gnoland-1`. Site: https://bazaar.gnomi.fun. Adena cannot `addpkg`.

## Retarget before addpkg

The committed sample is behind the live factory. Change it before you publish:

| Sample on `master` today | Live collection |
| --- | --- |
| `import "gno.land/r/bazaar/factory"` | named import `factory` of `gno.land/r/g1n4pl5uc4yt5r96m9w6fmdznx3x0jyg8l6arhmt/bazaar/bazaarv5` |
| `gno.land/p/bazaar/grc721/v0` | genesis `gno.land/p/nt/grc721/v0` and `gno.land/p/nt/grc721/metadata/v0` |
| `gno.land/p/bazaar/fee/v1` | `gno.land/p/g1n4pl5uc4yt5r96m9w6fmdznx3x0jyg8l6arhmt/bazaar/fee/v1` |
| `const protocolBps = 50`, fee paid to `factory.Address()` | `factory.ProtocolBps()`, `HolderDiscount`, `GenesisShareBps()` as in [listing-external.md](listing-external.md) |
| `Init` calls `CreditLaunchFee` when the slug was not reserved | `Reserve` first. `Init` sends nothing. `bazaarv5` has no `CreditLaunchFee`. |
| `OwnerOf(id int) address`, `TokenURI(id int)` | `OwnerOf(tid string) (address, error)`, `TokenURI(tid string)` |

Last path element = `package` name, `[a-z][a-z0-9]{1,10}` (2–11, no hyphen). Example: `gno.land/r/<your-g1>/mycol` with `package mycol`.

## Your mint site (Adena)

Same `DoContract` Bazaar uses (`/vm.m_call`). `pkg_path` is your collection realm. The gas figures below are an example, not a measured limit.

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
| Reserve (on bazaarv5, once) | `Reserve` | `slug` | `LaunchFee()` ugnot. 0 when `ReserveDue` for that account is 0. |
| Init (on your pkg, once) | `Init` | `name, symbol, cover, maxSupply, mintPriceUgnot, royaltyBps` | `""` after that Reserve |
| Optional slots | `AddDropItems` | one blob, lines `name\|https://image\|Rarity\|Trait:Value` (max 20 lines / tx) | `""` |
| Public mint | `PublicMint` | none | exact `MintPrice()` ugnot, or `""` if 0 |
| Creator mint | `Mint` | `name, imageURL` | `""` |
| Pause / resume | `PauseMint` / `ResumeMint` | none | `""` |

`OriginSend` is empty or exactly one `ugnot` coin of the required amount. An extra denom panics.

Cover and item images pass `validImage`: `http://` or `https://`, or `/samples/…`, at most 200 characters. The chain rejects `ipfs://`. For IPFS art, store `https://gateway.pinata.cloud/ipfs/<cid>`. Leave out `ipfs.io`, `dweb.link`, `w3s.link`, and `nftstorage.link`. `TokenURI` should put an absolute `https://` URL in `image`.

## What Bazaar calls (list / buy)

All on your package. `cur realm` is the first argument. Adena omits it. The VM fills it.

| `func` | `args` | `send` |
| --- | --- | --- |
| `List` | `id, priceUgnot` | `""` |
| `UpdatePrice` | `id, priceUgnot` | `""` |
| `Cancel` | `id` | `""` |
| `Buy` | `id` | exact list price ugnot |
| `Transfer` | `to, id` | `""` (unlisted only) |
| `TransferFrom` | `from, to, id` | `""` (unlisted only) |

`Buy` uses bazaarv5 `ProtocolBps()` (200 on 2026-10-05) minus holder discount, plus your `RoyaltyBps()` to `Creator()`. The seller cannot buy their own listing. Listed tokens escrow to the realm. `TransferFrom` while listed panics. Fee split: [listing-external.md](listing-external.md).

### qeval (Explore + Adena)

Live Bazaar Gens and a retargeted template:

| Func | Shape |
| --- | --- |
| `Name()` / `Symbol()` | string (also `GrcName` / `GrcSymbol`) |
| `BalanceOf("g1…")` | int64 |
| `OwnerOf("1")` | `(address, error)`. Adena uses `owner, err := OwnerOf("1"); owner.String()`. |
| `TokenURI("1")` | `data:application/json;charset=utf-8,…` |
| `TokensOf("g1…")` | csv of ids. Listed ids are omitted. |
| `TokenOfOwnerByIndex("g1…", 0)` | one id string, on the retargeted template |
| `ListOpen()` | up to 50 lines, columns below |
| `ItemLine(id)` | one line, same columns |
| `MintPrice()` `MaxSupply()` `Minted()` `RoyaltyBps()` `Creator()` | numbers / address |
| `ListCollections()` on bazaarv5 | `slug\|name\|cover\|pkg\|mintPrice\|maxSupply\|minted\|creator\|addr\|royaltyBps` |

`ListOpen` / `ItemLine` columns:

```
id|name|owner|seller|price|listed|image|slug|rarity|traits|revealed|slot
```

`listed`, `revealed` are `true` or `false`.

The committed sample still exposes `OwnerOf(id int) address` and `TokenURI(id int)`. Adena’s token grid needs the string form.

Wallet spec: [adena-collectables.md](adena-collectables.md).

## Factory (Explore)

`Reserve` on bazaarv5, then `Init` with an empty send, and the collection `Register`s. Explore can also show older rows from `bazaarv2`, `bazaarv1`, and `factory`. A new collection uses bazaarv5.

`gno.land/r/g1n4pl5uc4yt5r96m9w6fmdznx3x0jyg8l6arhmt/bazaar/bazaarv5`

Read `LaunchFee()` for the current ugnot amount.

## Tests

```bash
gno test ./gno.land/r/bazaar/col
gno test ./gno.land/r/bazaar/factory
```

Copy the folder, change `package` and `gnomod.toml` `module`, switch GRC721 to genesis `p/nt/grc721`, rewrite the factory import to bazaarv5, replace the 50 bps book, `addpkg`, `Reserve`, then `Init`.
