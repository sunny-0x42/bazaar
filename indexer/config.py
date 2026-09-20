"""Env defaults for Pearl. No keys."""

from __future__ import annotations

import os
from pathlib import Path

NFT_PKG = os.environ.get("BAZAAR_NFT_PKG", "gno.land/r/bazaar/nft").strip() or "gno.land/r/bazaar/nft"
INDEXER_URL = (
    os.environ.get("BAZAAR_INDEXER_URL", "https://indexer.pearl.testnets.gno.land/graphql/query").strip()
    or "https://indexer.pearl.testnets.gno.land/graphql/query"
)
RPC = os.environ.get("BAZAAR_RPC", "https://rpc.pearl.testnets.gno.land").strip() or "https://rpc.pearl.testnets.gno.land"
DB_PATH = os.environ.get("BAZAAR_DB", str(Path(__file__).resolve().parent / "bazaar.db")).strip()

HTTP_TIMEOUT = float(os.environ.get("BAZAAR_HTTP_TIMEOUT", "10") or "10")
CORS_ORIGIN = "http://127.0.0.1:5176"


def rpc_url() -> str:
    return RPC.rstrip("/")


def indexer_url() -> str:
    return INDEXER_URL.rstrip("/")
