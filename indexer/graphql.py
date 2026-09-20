"""Pearl tx-indexer GraphQL (read-only)."""

from __future__ import annotations

from typing import Any

import httpx

from .config import HTTP_TIMEOUT, indexer_url

TX_QUERY = """
query BazaarActivity($pkg: String!) {
  getTransactions(
    where: {
      success: { eq: true }
      messages: { value: { MsgCall: { pkg_path: { eq: $pkg } } } }
    }
  ) {
    hash
    block_height
    messages {
      value {
        __typename
        ... on MsgCall {
          caller
          func
          args
          send
          pkg_path
        }
      }
    }
    response {
      events {
        __typename
        ... on GnoEvent {
          type
          pkg_path
          attrs {
            key
            value
          }
        }
      }
    }
  }
}
"""

HEIGHT_QUERY = """
query BazaarHeight {
  latestBlockHeight
}
"""


def post_graphql(
    query: str,
    variables: dict[str, Any] | None = None,
    *,
    url: str | None = None,
    timeout: float | None = None,
) -> dict[str, Any]:
    endpoint = (url or indexer_url()).rstrip("/")
    wait = HTTP_TIMEOUT if timeout is None else timeout
    with httpx.Client(timeout=wait) as client:
        response = client.post(
            endpoint,
            json={"query": query, "variables": variables or {}},
            headers={"Content-Type": "application/json", "Accept": "application/json"},
        )
        response.raise_for_status()
        body = response.json()
    if not isinstance(body, dict):
        raise RuntimeError("graphql: bad payload")
    errors = body.get("errors")
    if errors:
        first = errors[0] if isinstance(errors, list) and errors else errors
        message = first.get("message") if isinstance(first, dict) else str(first)
        raise RuntimeError(f"graphql: {message}")
    data = body.get("data")
    if not isinstance(data, dict):
        return {}
    return data


def fetch_transactions(pkg: str, *, url: str | None = None) -> list[dict[str, Any]]:
    data = post_graphql(TX_QUERY, {"pkg": pkg}, url=url)
    rows = data.get("getTransactions") or []
    if not isinstance(rows, list):
        return []
    return [row for row in rows if isinstance(row, dict)]


def fetch_height(*, url: str | None = None) -> int:
    data = post_graphql(HEIGHT_QUERY, url=url)
    try:
        return int(data.get("latestBlockHeight") or 0)
    except (TypeError, ValueError):
        return 0
