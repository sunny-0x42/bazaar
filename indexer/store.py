"""sqlite3 activity store. Unique (hash, idx) or (kind, id, height, actor)."""

from __future__ import annotations

import sqlite3
from pathlib import Path
from typing import Any, Iterator

from .parse import activity_dict

_SCHEMA = """
CREATE TABLE IF NOT EXISTS events (
  kind TEXT NOT NULL,
  item_id TEXT NOT NULL DEFAULT '',
  slug TEXT NOT NULL DEFAULT '',
  actor TEXT NOT NULL DEFAULT '',
  price INTEGER NOT NULL DEFAULT 0,
  name TEXT NOT NULL DEFAULT '',
  height INTEGER NOT NULL DEFAULT 0,
  hash TEXT NOT NULL DEFAULT '',
  idx INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'indexer'
);
CREATE UNIQUE INDEX IF NOT EXISTS events_hash_idx
  ON events(hash, idx) WHERE hash != '';
CREATE UNIQUE INDEX IF NOT EXISTS events_kind_id_height_actor
  ON events(kind, item_id, height, actor);
"""


def _row_dict(row: sqlite3.Row) -> dict[str, Any]:
    out = activity_dict(
        kind=row["kind"],
        item_id=row["item_id"],
        slug=row["slug"],
        actor=row["actor"],
        price=int(row["price"] or 0),
        name=row["name"],
        height=int(row["height"] or 0),
        hash=row["hash"],
        idx=int(row["idx"] or 0),
    )
    out["source"] = row["source"] or "indexer"
    return out


class Store:
    def __init__(self, path: str) -> None:
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        self.conn = sqlite3.connect(path)
        self.conn.row_factory = sqlite3.Row
        self.conn.execute("PRAGMA journal_mode=WAL")
        self.conn.executescript(_SCHEMA)
        self.conn.commit()

    def close(self) -> None:
        self.conn.close()

    def _find(self, event: dict[str, Any]) -> sqlite3.Row | None:
        hash_ = str(event.get("hash") or "")
        if hash_:
            cur = self.conn.execute(
                "SELECT rowid, * FROM events WHERE hash = ? AND idx = ?",
                (hash_, int(event.get("idx") or 0)),
            )
            row = cur.fetchone()
            if row is not None:
                return row
        cur = self.conn.execute(
            "SELECT rowid, * FROM events WHERE kind = ? AND item_id = ? AND height = ? AND actor = ?",
            (
                str(event.get("kind") or ""),
                str(event.get("id") or ""),
                int(event.get("height") or 0),
                str(event.get("actor") or ""),
            ),
        )
        return cur.fetchone()

    def upsert(self, event: dict[str, Any], source: str = "indexer") -> bool:
        existing = self._find(event)
        kind = str(event.get("kind") or "")
        item_id = str(event.get("id") or "")
        slug = str(event.get("slug") or "")
        actor = str(event.get("actor") or "")
        price = int(event.get("price") or 0)
        name = str(event.get("name") or "")
        height = int(event.get("height") or 0)
        hash_ = str(event.get("hash") or "")
        idx = int(event.get("idx") or 0)
        if existing is None:
            try:
                self.conn.execute(
                    """
                    INSERT INTO events (kind, item_id, slug, actor, price, name, height, hash, idx, source)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (kind, item_id, slug, actor, price, name, height, hash_, idx, source),
                )
                self.conn.commit()
                return True
            except sqlite3.IntegrityError:
                self.conn.rollback()
                existing = self._find(event)
                if existing is None:
                    raise
        new_source = existing["source"] or source
        if new_source != source:
            new_source = "mixed"
        self.conn.execute(
            """
            UPDATE events
            SET slug = CASE WHEN slug = '' THEN ? ELSE slug END,
                price = CASE WHEN price = 0 THEN ? ELSE price END,
                name = CASE WHEN name = '' THEN ? ELSE name END,
                height = CASE WHEN height = 0 THEN ? ELSE height END,
                hash = CASE WHEN hash = '' THEN ? ELSE hash END,
                idx = CASE WHEN hash = '' THEN ? ELSE idx END,
                source = ?
            WHERE rowid = ?
            """,
            (slug, price, name, height, hash_, idx, new_source, existing["rowid"]),
        )
        self.conn.commit()
        return False

    def list_events(self, slug: str = "", limit: int = 50) -> list[dict[str, Any]]:
        slug = slug.strip()
        limit = max(1, min(int(limit or 50), 500))
        if slug:
            cur = self.conn.execute(
                """
                SELECT * FROM events
                WHERE slug = ?
                ORDER BY height DESC, hash DESC, idx DESC
                LIMIT ?
                """,
                (slug, limit),
            )
        else:
            cur = self.conn.execute(
                """
                SELECT * FROM events
                ORDER BY height DESC, hash DESC, idx DESC
                LIMIT ?
                """,
                (limit,),
            )
        return [_row_dict(row) for row in cur.fetchall()]

    def chart_points(self, slug: str = "", limit: int = 50) -> list[dict[str, Any]]:
        slug = slug.strip()
        limit = max(1, min(int(limit or 50), 500))
        if slug:
            cur = self.conn.execute(
                """
                SELECT * FROM events
                WHERE slug = ?
                  AND kind IN ('buy', 'list')
                  AND price > 0
                ORDER BY height ASC, hash ASC, idx ASC
                LIMIT ?
                """,
                (slug, limit),
            )
        else:
            cur = self.conn.execute(
                """
                SELECT * FROM events
                WHERE kind IN ('buy', 'list')
                  AND price > 0
                ORDER BY height ASC, hash ASC, idx ASC
                LIMIT ?
                """,
                (limit,),
            )
        return [_row_dict(row) for row in cur.fetchall()]

    def all_events(self) -> list[dict[str, Any]]:
        cur = self.conn.execute("SELECT * FROM events ORDER BY height ASC, idx ASC")
        return [_row_dict(row) for row in cur.fetchall()]

    def sources(self) -> set[str]:
        cur = self.conn.execute("SELECT DISTINCT source FROM events")
        return {str(row[0] or "") for row in cur.fetchall() if row[0]}

    def stats(self) -> dict[str, int]:
        rows = self.all_events()
        latest: dict[str, str] = {}
        volume = 0
        for row in rows:
            kind = row["kind"]
            if kind == "buy":
                volume += int(row["price"] or 0)
            item_id = row["id"]
            if item_id and kind in ("list", "buy", "cancel"):
                latest[item_id] = kind
        listings = sum(1 for kind in latest.values() if kind == "list")
        return {"listings": listings, "volume_ugnot": volume, "events": len(rows)}


def open_store(path: str) -> Iterator[Store]:
    store = Store(path)
    try:
        yield store
    finally:
        store.close()
