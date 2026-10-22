# Bazaar marketplace indexer

Off-chain reader for mint / list / buy / cancel / publicmint / drop. Does not replace the on-chain activity ring (cap 50). Indexer keeps history + height.

## Process

`C:\Users\Hi\gno-bazaar\indexer` — FastAPI, port **8788**. No keys. Read-only.

Sources (in order, merge by hash+index or kind+id+height):

1. Mainnet **tx-indexer GraphQL** `https://indexer.gno.land/graphql/query` — `getTransactions` where `success` and `MsgCall.pkg_path` eq the **collection** pkg. Parse `response.events` `GnoEvent`.
2. Fallback **vm/qeval** `Activity()` / `ActivityByCollection` on `https://rpc.gno.land:443` (many `col` realms have no `Activity()` tape; indexer is the Explore source).

## HTTP

| Path | Notes |
| --- | --- |
| `GET /api/health` | `{ ok, height, pkg, source }` |
| `GET /api/activity?slug=&limit=50` | newest first, same shape as UI Activity |
| `GET /api/stats` | listings, volume_ugnot (sum of buy prices), events |
| `POST /api/sync` | pull once |

Activity JSON: `{ kind, id, slug, actor, price, name, height, hash }`

## UI

Vite proxies `/api` → `127.0.0.1:8788`. Collection Activity tab: indexer first, then on-chain `ActivityByCollection`, then catalog preview.

## Env

`BAZAAR_NFT_PKG`, `BAZAAR_INDEXER_URL`, `BAZAAR_RPC`, `BAZAAR_DB` (sqlite path).
