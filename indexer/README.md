# Bazaar indexer

Read-only FastAPI reader for mint / list / buy / cancel / publicmint / drop.
Does not replace the on-chain activity ring (cap 50). No keys. No writes.

Default: Pearl RPC `https://rpc.pearl.testnets.gno.land` and GraphQL
`https://indexer.pearl.testnets.gno.land/graphql/query`.

## Run

From the repo root (`C:\Users\Hi\gno-bazaar`):

```
python -m pip install -r indexer/requirements.txt
python -m pytest indexer
python -m uvicorn indexer.app:app --host 127.0.0.1 --port 8788
```

Health: `GET http://127.0.0.1:8788/api/health`

Activity: `GET http://127.0.0.1:8788/api/activity?slug=&limit=50`

Chart: `GET http://127.0.0.1:8788/api/chart?slug=&limit=50`

Sync once: `POST http://127.0.0.1:8788/api/sync`

CORS allows `http://127.0.0.1:5176`.

## Env

| Name | Default |
| --- | --- |
| `BAZAAR_NFT_PKG` | `gno.land/r/bazaar/nft` |
| `BAZAAR_INDEXER_URL` | `https://indexer.pearl.testnets.gno.land/graphql/query` |
| `BAZAAR_RPC` | `https://rpc.pearl.testnets.gno.land` |
| `BAZAAR_DB` | `indexer/bazaar.db` |

Local gnodev: set `BAZAAR_RPC` to the gnodev RPC and leave GraphQL empty or unused;
`POST /api/sync` falls back to `vm/qeval Activity()`.
