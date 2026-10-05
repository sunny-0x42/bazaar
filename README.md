# Bazaar

Fixed-price **NFT marketplace and collection launchpad** on [gno.land](https://gno.land) mainnet (`gnoland-1`). Launch a collection, mint in GNOT, then list and buy on the secondary book.

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

Live site: https://bazaar.gnomi.fun

Factory for a new collection:

`gno.land/r/g1n4pl5uc4yt5r96m9w6fmdznx3x0jyg8l6arhmt/bazaar/bazaarv5`

Fee getters were read on 2026-10-05. Read them again before quoting a number.

- [Guide](https://bazaar.gnomi.fun/#/guide)
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

- Production UI: **gnoland-1**. New collections register on `bazaarv5`.
- Local: `gno test` / `gnodev`.
- Pearl `factoryv3` and `nftv7` stay on Pearl. They are not this site.
