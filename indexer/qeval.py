"""vm/qeval over JSON-RPC abci_query (read-only)."""

from __future__ import annotations

import base64
from typing import Any

import httpx

from .config import HTTP_TIMEOUT, NFT_PKG, rpc_url
from .parse import parse_activity_text, parse_price


def _b64(text: str) -> str:
    return base64.b64encode(text.encode("utf-8")).decode("ascii")


def _decode_data(raw: Any) -> str:
    if raw is None or raw == "":
        return ""
    if isinstance(raw, bytes):
        return raw.decode("utf-8", errors="replace")
    text = str(raw)
    try:
        return base64.b64decode(text).decode("utf-8", errors="replace")
    except Exception:
        return text


def _abci_data(payload: dict[str, Any]) -> str:
    err = payload.get("error")
    if err:
        if isinstance(err, dict):
            raise RuntimeError(str(err.get("data") or err.get("message") or "rpc error"))
        raise RuntimeError(str(err))
    result = payload.get("result") or {}
    resp = result.get("response") or {}
    if not isinstance(resp, dict):
        return ""
    base = resp.get("ResponseBase") or {}
    if isinstance(base, dict) and base.get("Error"):
        raise RuntimeError(str(base.get("Log") or "qeval failed"))
    raw = ""
    if isinstance(base, dict):
        raw = base.get("Data") or ""
    if not raw:
        raw = resp.get("value") or resp.get("Value") or ""
    return _decode_data(raw)


def abci_query(path: str, data: str, *, rpc: str | None = None, timeout: float | None = None) -> str:
    endpoint = (rpc or rpc_url()).rstrip("/")
    wait = HTTP_TIMEOUT if timeout is None else timeout
    body = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "abci_query",
        "params": {"path": path, "data": _b64(data), "prove": False},
    }
    with httpx.Client(timeout=wait) as client:
        response = client.post(endpoint, json=body, headers={"Content-Type": "application/json"})
        response.raise_for_status()
        payload = response.json()
    if not isinstance(payload, dict):
        raise RuntimeError("rpc: bad payload")
    return _abci_data(payload)


def qeval(expr: str, *, pkg: str | None = None, rpc: str | None = None) -> str:
    package = (pkg or NFT_PKG).strip()
    expression = expr.strip()
    if not package or not expression:
        return ""
    return abci_query("vm/qeval", f"{package}.{expression}", rpc=rpc)


def _gno_string(value: str) -> str:
    return '"' + value.replace("\\", "\\\\").replace('"', '\\"') + '"'


def rpc_height(*, rpc: str | None = None) -> int:
    endpoint = (rpc or rpc_url()).rstrip("/")
    body = {"jsonrpc": "2.0", "id": 1, "method": "status", "params": {}}
    with httpx.Client(timeout=HTTP_TIMEOUT) as client:
        response = client.post(endpoint, json=body, headers={"Content-Type": "application/json"})
        response.raise_for_status()
        payload = response.json()
    if not isinstance(payload, dict):
        return 0
    result = payload.get("result") or {}
    info = result.get("sync_info") or result.get("SyncInfo") or {}
    return parse_price(info.get("latest_block_height") or info.get("latestBlockHeight"))


def fetch_activity(slug: str = "", *, pkg: str | None = None, rpc: str | None = None) -> list[dict[str, Any]]:
    slug = slug.strip()
    if slug:
        expr = f"ActivityByCollection({_gno_string(slug)})"
    else:
        expr = "Activity()"
    raw = qeval(expr, pkg=pkg, rpc=rpc)
    # Activity() has no height; keep 0 so repeats merge on (kind, id, height, actor).
    return parse_activity_text(raw, height=0)
