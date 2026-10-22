# Bazaar on gnoland-1

Namespace: `g1n4pl5uc4yt5r96m9w6fmdznx3x0jyg8l6arhmt`. Do not overwrite live pkgs.

## Live

| Pkg | Role |
| --- | --- |
| `gno.land/p/<g1>/bazaar/fee/v1` | Protocol math |
| genesis `gno.land/p/nt/grc721/v0` (+ metadata) | Adena event filter |
| `gno.land/r/<g1>/bazaar/bazaarv4` | Factory live: ProtocolSink, SetGenesis(gcol2), SetDiscountPusher(gpush), LaunchFee 1000 GNOT |
| `gno.land/r/<g1>/bazaar/gpush` | Discount pusher (gcol2 mint → factory.HolderDiscount) |
| `gno.land/r/<g1>/bazaar/gcol2` | Genesis GRC721 live (GRC721 + gpush). 1111 supply. |
| `gno.land/r/<g1>/bazaar/bazaarv3` | Frozen; GenesisPkg still gcol |
| `gno.land/r/<g1>/bazaar/bazaarv2` | Frozen previous factory |
| `gno.land/r/<g1>/bazaar/gcol` | Genesis GRC721 live (slim, no factory import). bazaarv3 `SetGenesis` attached. |
| `gno.land/r/<g1>/bazaar/genesis` | Inert (GPAO never enabled) |
| `gno.land/r/<g1>/bazaar/gnft` | Inert (GPAO never enabled; imported bazaarv3) |
| `gno.land/r/<g1>/bazaar/bazaarv1` | Frozen (seenBank / CreditLaunchFee) |
| `gno.land/r/<g1>/bazaar/factory` | Frozen first factory |
| `gno.land/r/<g1>/bazaar/c/{slug}` | Collection copies of `r/bazaar/col` |

UI Explore lists **bazaarv3**. Hidden slugs: `test`, `stdcol`, `adcol`, `col3333`, `shown`.

## New collection

```powershell
powershell -File tools/mainnet-launch-col.ps1 -Slug NAME
```

Stages `col` with genesis GRC721 + `OwnerOf (address, error)`, addpkg, GPAO, **Reserve bazaarv2** (current `LaunchFee`, 1000 GNOT), Init (empty send), optional mint.

## Checks

1. `gnokey query auth/gasprice -remote https://rpc.gno.land:443`
2. CLA valid for deployer g1
3. Spendable GNOT for LaunchFee + storage
4. `gno test ./gno.land/r/bazaar/factory/` and `./gno.land/r/bazaar/col/`
