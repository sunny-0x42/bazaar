"""FastAPI activity indexer. Read-only. Port 8788."""

from __future__ import annotations

from collections.abc import Iterator
from typing import Any, Literal

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field

from . import config, graphql, qeval
from .parse import parse_transaction
from .store import Store

SourceName = Literal["indexer", "qeval", "mixed"]

app = FastAPI(title="Bazaar indexer", version="1")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[config.CORS_ORIGIN],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


class ActivityEvent(BaseModel):
    model_config = ConfigDict(extra="ignore")

    kind: str
    id: str = ""
    slug: str = ""
    actor: str = ""
    price: int = 0
    name: str = ""
    height: int = 0
    hash: str = ""


class ActivityResponse(BaseModel):
    events: list[ActivityEvent]
    source: SourceName


class ChartPoint(BaseModel):
    model_config = ConfigDict(extra="ignore")

    height: int = 0
    price: int = 0
    kind: str
    id: str = ""
    name: str = ""


class ChartResponse(BaseModel):
    points: list[ChartPoint]


class HealthResponse(BaseModel):
    ok: bool
    height: int = 0
    pkg: str
    source: str


class StatsResponse(BaseModel):
    listings: int = 0
    volume_ugnot: int = 0
    events: int = 0


class SyncResponse(BaseModel):
    ok: bool
    inserted: int = 0
    source: str = ""
    height: int = 0
    error: str = Field(default="")


def get_store() -> Iterator[Store]:
    store = Store(config.DB_PATH)
    try:
        yield store
    finally:
        store.close()


def _public(row: dict[str, Any]) -> ActivityEvent:
    return ActivityEvent.model_validate(row)


def _source_from_store(store: Store) -> str:
    found = store.sources()
    found.discard("")
    if not found:
        return "none"
    if found == {"mixed"} or len(found) > 1:
        return "mixed"
    return next(iter(found))


def _chain_height() -> int:
    try:
        height = qeval.rpc_height()
        if height:
            return height
    except Exception:
        pass
    try:
        return graphql.fetch_height()
    except Exception:
        return 0


def _merge_events(*groups: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], SourceName]:
    seen: dict[tuple[Any, ...], dict[str, Any]] = {}
    origins: set[str] = set()
    for group in groups:
        for row in group:
            origins.add(str(row.get("source") or "indexer"))
            hash_ = str(row.get("hash") or "")
            if hash_:
                key: tuple[Any, ...] = ("h", hash_, int(row.get("idx") or 0))
            else:
                key = (
                    "k",
                    str(row.get("kind") or ""),
                    str(row.get("id") or ""),
                    int(row.get("height") or 0),
                    str(row.get("actor") or ""),
                )
            prev = seen.get(key)
            if prev is None:
                seen[key] = row
                continue
            if not prev.get("price") and row.get("price"):
                prev["price"] = row["price"]
            if not prev.get("name") and row.get("name"):
                prev["name"] = row["name"]
            if not prev.get("slug") and row.get("slug"):
                prev["slug"] = row["slug"]
            if not prev.get("hash") and row.get("hash"):
                prev["hash"] = row["hash"]
            if not prev.get("height") and row.get("height"):
                prev["height"] = row["height"]
    events = sorted(
        seen.values(),
        key=lambda row: (int(row.get("height") or 0), str(row.get("hash") or ""), int(row.get("idx") or 0)),
        reverse=True,
    )
    origins.discard("")
    if origins == {"qeval"}:
        source: SourceName = "qeval"
    elif origins == {"indexer"}:
        source = "indexer"
    else:
        source = "mixed" if origins else "indexer"
    return events, source


def _sync_graphql(store: Store) -> int:
    inserted = 0
    for tx in graphql.fetch_transactions(config.NFT_PKG):
        for event in parse_transaction(tx, pkg=config.NFT_PKG):
            event["source"] = "indexer"
            if store.upsert(event, source="indexer"):
                inserted += 1
    return inserted


def _sync_qeval(store: Store) -> int:
    inserted = 0
    for event in qeval.fetch_activity("", pkg=config.NFT_PKG):
        event["source"] = "qeval"
        if store.upsert(event, source="qeval"):
            inserted += 1
    return inserted


@app.get("/api/health", response_model=HealthResponse)
def health(store: Store = Depends(get_store)) -> HealthResponse:
    height = 0
    ok = False
    try:
        height = _chain_height()
        ok = height > 0
    except Exception:
        ok = False
    return HealthResponse(ok=ok, height=height, pkg=config.NFT_PKG, source=_source_from_store(store))


@app.get("/api/activity", response_model=ActivityResponse)
def activity(
    slug: str = "",
    limit: int = Query(50, ge=1, le=500),
    store: Store = Depends(get_store),
) -> ActivityResponse:
    stored = store.list_events(slug=slug, limit=limit)
    live: list[dict[str, Any]] = []
    live_ok = False
    if not stored:
        try:
            live = qeval.fetch_activity(slug, pkg=config.NFT_PKG)
            for row in live:
                row["source"] = "qeval"
            live_ok = True
        except Exception:
            live = []
    events, source = _merge_events(stored, live)
    if not stored:
        source = "qeval" if live_ok else "indexer"
    elif not live:
        tag = _source_from_store(store)
        source = tag if tag in ("indexer", "qeval", "mixed") else "indexer"
    return ActivityResponse(events=[_public(row) for row in events[:limit]], source=source)


@app.get("/api/chart", response_model=ChartResponse)
def chart(
    slug: str = "",
    limit: int = Query(50, ge=1, le=500),
    store: Store = Depends(get_store),
) -> ChartResponse:
    rows = store.chart_points(slug=slug, limit=limit)
    return ChartResponse(points=[ChartPoint.model_validate(row) for row in rows])


@app.get("/api/stats", response_model=StatsResponse)
def stats(store: Store = Depends(get_store)) -> StatsResponse:
    return StatsResponse.model_validate(store.stats())


@app.post("/api/sync", response_model=SyncResponse)
def sync(store: Store = Depends(get_store)) -> SyncResponse:
    inserted = 0
    errors: list[str] = []
    got_indexer = False
    got_qeval = False
    try:
        inserted += _sync_graphql(store)
        got_indexer = True
    except Exception:
        errors.append("graphql")
    try:
        inserted += _sync_qeval(store)
        got_qeval = True
    except Exception:
        errors.append("qeval")
    if got_indexer and got_qeval:
        source = "mixed"
    elif got_indexer:
        source = "indexer"
    elif got_qeval:
        source = "qeval"
    else:
        raise HTTPException(status_code=502, detail="sync failed")
    return SyncResponse(
        ok=True,
        inserted=inserted,
        source=source,
        height=_chain_height(),
        error=",".join(errors),
    )
