# Network check (2026-09-19)

Official docs (https://docs.gno.land/resources/gnoland-networks) still list **Pearl / Test16** as the current testnet.

| Network | chain-id | Writable product work? |
| --- | --- | --- |
| Pearl | pearl-1 | Yes (faucet, unrestricted transfers). Live height ~533k. |
| Staging | staging | Rolling master; state can wipe. gnomcp admits it read-only. |
| Mainnet | gnoland-1 | No. Transfers locked; addpkg parked (GPAO). Tag after Pearl is `chain/mainnet`, not a new gemstone testnet. |
| Sapphire / Topaz / test13 | archives | Do not target for new Bazaar deploys. |

gnomcp default `pearl` profile is **read-only**. `testnet` still points at archived topaz-1. Pearl writes: local gnodev, or human gnokey after yes.

Pearl packages used: `gno.land/p/demo/tokens/grc20`, `gno.land/p/nt/avl/v0` (`Get` returns `any`). **No** `p/demo/tokens/grc721` on Pearl — NFT listings are not v1.
