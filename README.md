# Bazaar

Fixed-price **NFT marketplace and collection launchpad** on [gno.land](https://gno.land) mainnet (`gnoland-1`). The public site is **[Nomaq](https://nomaq.xyz)**. Launch a collection, mint in GNOT, then list and buy on the secondary book.

GNOT on mainnet has market value. Nothing here is investment advice.

## Product

| | |
| --- | --- |
| Primary mint | 0% protocol. GNOT goes to the creator. |
| Create collection | `LaunchFee()` is **1000 GNOT**. Admin can `SetLaunchFee`. |
| Secondary `Buy` | `ProtocolBps()` is **200** (2%). The higher `HolderDiscount` of seller or buyer is subtracted, floored at 0. Admin `SetProtocolBps` accepts 0–500. |
| Genesis share | **11%** of that protocol fee (`GenesisShareBps()` = 1100) goes to `perk2`. The rest goes to `ProtocolSink()`. |
| Royalty | 0–10% set at `Init`, paid on `Buy` to the collection creator |
| List / Cancel | 0 |
| Wallet | [Adena](https://adena.app) on mainnet |
| Units | 1 GNOT = 1,000,000 `ugnot` |

Live site: https://nomaq.xyz

Factory for a new collection:

`gno.land/r/g1n4pl5uc4yt5r96m9w6fmdznx3x0jyg8l6arhmt/bazaar/bazaarv5`

Fee getters were read on 2026-10-05. Read them again before quoting a number.

### Bazaar Gens does not show in Adena

Nomaq shows a Bazaar Gens NFT you own. Adena does not render that collection.

Realm: `gno.land/r/g1n4pl5uc4yt5r96m9w6fmdznx3x0jyg8l6arhmt/bazaar/c/bazaargens`

- `TokenURI(tid string)` returns a `data:application/json` document. The Pinata image URL sits in the JSON `image` field. Adena uses the whole string as the image address, so the card has no picture.
- `TokenMetadata` is not a public function. Adena reads that function for the card (`name`, `image`, `traitType`).
- The realm was deployed as a **public** package. Mainnet runs `v1.5.1`, which refuses a second `addpkg` of a public package (`package already exists`). Only a realm deployed with `private = true` can be replaced in place. Bazaar Gens has no private flag and no public call that rewrites `TokenURI`. The minted tokens stay as they are.
- A **listed** NFT is held by the collection realm until you cancel or it sells, so it also leaves the wallet balance. That is separate from the metadata mismatch. An unlisted Bazaar Gens token still does not render in Adena.

View and trade the item on https://nomaq.xyz. Full note: [docs/adena-collectables.md](docs/adena-collectables.md).

- [Guide](https://nomaq.xyz/#/guide)
- [Standards](docs/STANDARDS.md)
- [How to list](docs/LISTING.md)
- [List without Launch](docs/listing-external.md)
- [Factory](docs/FACTORY.md)
- [Collection realm](docs/col-realm.md)
- [Adena collectables](docs/adena-collectables.md)

The committed sample `gno.land/r/bazaar/col` still has the older 50 bps book. Follow [listing-external.md](docs/listing-external.md) before `addpkg`.

## Layout

| Path | Role |
| --- | --- |
| `gno.land/p/bazaar/fee/v1` | Overflow-safe `ProtocolFee` (mainnet copy under the deployer `g1`) |
| `gno.land/r/bazaar/factory` | Factory source. The live mainnet deploy is `bazaarv5`. |
| `gno.land/r/bazaar/col` | Collection template. Retarget imports before `addpkg`. |
| `web/` | English Vite UI |

## Local UI

```bash
cd web
npm install
npm run dev
```

http://127.0.0.1:5176

```bash
gno test ./gno.land/p/bazaar/fee/v1/
gno test ./gno.land/r/bazaar/factory/
gno test ./gno.land/r/bazaar/col/
cd web && npm test
```

## Networks

- Production UI: **gnoland-1** at https://nomaq.xyz. New collections register on `bazaarv5`.
- Local: `gno test` / `gnodev`.
- Pearl `factoryv3` and `nftv7` stay on Pearl. They are not this site.
