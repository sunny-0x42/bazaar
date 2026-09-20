# Platform upgrades — NFT marketplace

Synthesized from `bazaar-research`, `bazaar-defi`, `bazaar-protocol`, `bazaar-product` (2026-09-19). Not investment advice.

## Why v1 looked like a token list

Realm `List(symbol, amount, price)` is a **fungible lot**. UI had ticker marks, “N tokens”, Create with decimals/supply. OpenSea-class UIs sell **one object with a picture and an id**.

Pearl still has no `p/demo/tokens/grc721`. Official grc721 in gnolang/gno is quarantined. Gnomies is a different company. Bazaar ships its own unique-item realm.

## Shipped in this cut (do now)

| Layer | Change |
| --- | --- |
| Contract | `gno.land/r/bazaar/nft` — Mint(name, imageURL), List(id, price), Buy, Cancel. 1 id = 1 listing. |
| Hub | `SetModule("nft", path)`. Old `market` GRC20 stays. |
| Fee | Unchanged 50 bps on GNOT price. |
| UI | Explore image cards, Mint item, Sell by id, Portfolio. English. Adena. |

## Next upgrades (proposal, not built)

Ordered. Each needs a human yes before Pearl addpkg.

1. **Collection page + activity** — shipped: hero, Items/Activity tabs, `Activity()` ring cap 50, `ListItemsByCollection`.
2. **Numeric AVL keys** — pad `itemKey` so `ListOpen` is mint-order, not `"10"` before `"2"`.
3. **Owner index** — `TokensOf` today scans the whole tree.
4. **Media** — IPFS/https allowlist; on-chain we only store URL (no blob).
5. **Royalty** — reject until a written model + yes.
6. **Offers / auction / sweep** — reject until a second book realm.
7. **External GRC721** — only if Pearl later deploys `grc721` and a registry like `grc20reg`.
8. **Indexer** — shipped: FastAPI `indexer/` on :8788, GraphQL + qeval, UI Activity prefers `/api/activity`. Later: live subscribe / volume charts.

## Invariants to keep

- Unique owner; listed item owner = realm; seller recorded.
- `IsUserCall` + exact `OriginSend` ugnot.
- Panic on money paths.
- No fake USD. Testnet GNOT has no market value.
