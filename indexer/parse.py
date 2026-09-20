"""GnoEvent / Activity() lines → UI activity dicts.

Original Bazaar parser. Unknown event types are skipped.
"""

from __future__ import annotations

from typing import Any

KIND_FROM_TYPE = {
    "mint": "mint",
    "list": "list",
    "buy": "buy",
    "cancel": "cancel",
    "publicmint": "publicmint",
    "createdrop": "drop",
    "createcollection": "drop",
}

ACTIVITY_KINDS = frozenset({"mint", "list", "buy", "cancel", "publicmint", "drop"})

ATTR_KEYS = ("id", "slug", "seller", "buyer", "owner", "price", "fee", "name", "n", "admin")


def _as_str(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def parse_ugnot_send(send: Any) -> int:
    text = _as_str(send).replace(" ", "")
    if text.endswith("ugnot"):
        text = text[: -len("ugnot")]
    return parse_price(text)


def parse_price(value: Any) -> int:
    text = _as_str(value)
    if not text:
        return 0
    try:
        return int(text, 10)
    except ValueError:
        return 0


def attrs_map(attrs: Any) -> dict[str, str]:
    raw: dict[str, str] = {}
    if isinstance(attrs, dict):
        if "key" in attrs and "value" in attrs and len(attrs) <= 4:
            k = _as_str(attrs.get("key"))
            if k:
                raw[k] = _as_str(attrs.get("value"))
        else:
            for key, value in attrs.items():
                k = _as_str(key)
                if k:
                    raw[k] = _as_str(value)
    elif isinstance(attrs, (list, tuple)):
        for item in attrs:
            if not isinstance(item, dict):
                continue
            k = _as_str(item.get("key"))
            if not k:
                continue
            raw[k] = _as_str(item.get("value"))
    out = {k: raw[k] for k in ATTR_KEYS if k in raw}
    if not out.get("slug"):
        collection = raw.get("collection") or raw.get("Collection")
        if collection:
            out["slug"] = collection
    return out


def _kind_from_type(event_type: Any) -> str | None:
    key = _as_str(event_type).lower()
    if not key:
        return None
    return KIND_FROM_TYPE.get(key)


def _actor(attrs: dict[str, str], caller: str = "") -> str:
    for key in ("buyer", "seller", "owner"):
        value = attrs.get(key) or ""
        if value:
            return value
    return _as_str(caller)


def activity_dict(
    *,
    kind: str,
    item_id: str = "",
    slug: str = "",
    actor: str = "",
    price: int = 0,
    name: str = "",
    height: int = 0,
    hash: str = "",
    idx: int = 0,
) -> dict[str, Any]:
    return {
        "kind": kind,
        "id": _as_str(item_id),
        "slug": _as_str(slug),
        "actor": _as_str(actor),
        "price": int(price or 0),
        "name": _as_str(name),
        "height": int(height or 0),
        "hash": _as_str(hash),
        "idx": int(idx or 0),
    }


def parse_gno_event(
    event: Any,
    *,
    caller: str = "",
    height: int = 0,
    hash: str = "",
    idx: int = 0,
    pkg: str = "",
    send: str = "",
) -> dict[str, Any] | None:
    if not isinstance(event, dict):
        return None
    typename = _as_str(event.get("__typename"))
    if typename and typename not in ("GnoEvent", "Event"):
        return None
    kind = _kind_from_type(event.get("type"))
    if kind is None:
        return None
    ev_pkg = _as_str(event.get("pkg_path"))
    if pkg and ev_pkg and ev_pkg != pkg:
        return None
    attrs = attrs_map(event.get("attrs"))
    price = parse_price(attrs.get("price"))
    if price <= 0 and kind in ("buy", "publicmint"):
        price = parse_ugnot_send(send)
    return activity_dict(
        kind=kind,
        item_id=attrs.get("id", ""),
        slug=attrs.get("slug", ""),
        actor=_actor(attrs, caller),
        price=price,
        name=attrs.get("name", ""),
        height=height,
        hash=hash,
        idx=idx,
    )


def _msg_call_field(tx: dict[str, Any], field: str) -> str:
    messages = tx.get("messages") or []
    if not isinstance(messages, list):
        return ""
    for msg in messages:
        if not isinstance(msg, dict):
            continue
        value = msg.get("value") or msg
        if not isinstance(value, dict):
            continue
        typename = _as_str(value.get("__typename"))
        inner = value
        if typename and typename != "MsgCall":
            maybe = value.get("MsgCall")
            if isinstance(maybe, dict):
                inner = maybe
            else:
                continue
        got = _as_str(inner.get(field))
        if got:
            return got
        nested = value.get("MsgCall")
        if isinstance(nested, dict):
            got = _as_str(nested.get(field))
            if got:
                return got
    return ""


def _msg_call_caller(tx: dict[str, Any]) -> str:
    return _msg_call_field(tx, "caller")


def _msg_call_send(tx: dict[str, Any]) -> str:
    return _msg_call_field(tx, "send")


def _tx_events(tx: dict[str, Any]) -> list[Any]:
    response = tx.get("response")
    if isinstance(response, dict):
        events = response.get("events")
        if isinstance(events, list):
            return events
    events = tx.get("events")
    if isinstance(events, list):
        return events
    return []


def parse_transaction(tx: Any, *, pkg: str = "") -> list[dict[str, Any]]:
    if not isinstance(tx, dict):
        return []
    caller = _msg_call_caller(tx)
    send = _msg_call_send(tx)
    height = parse_price(tx.get("block_height"))
    hash_ = _as_str(tx.get("hash"))
    out: list[dict[str, Any]] = []
    for i, event in enumerate(_tx_events(tx)):
        row = parse_gno_event(
            event,
            caller=caller,
            height=height,
            hash=hash_,
            idx=i,
            pkg=pkg,
            send=send,
        )
        if row is not None:
            out.append(row)
    return out


def unwrap_eval(raw: str) -> str:
    text = str(raw or "")
    first = text.split("\n", 1)[0]
    quoted = first.find('"')
    if quoted >= 0:
        chunk = first[quoted + 1 :]
        if chunk.endswith('" string)') or chunk.endswith('" string'):
            chunk = chunk[: chunk.rfind('"')]
        elif chunk.endswith('"'):
            chunk = chunk[:-1]
        return chunk.replace("\\n", "\n").replace('\\"', '"')
    stripped = first.strip()
    if stripped.startswith("(") and stripped.endswith(")"):
        stripped = stripped[1:-1].strip()
    if stripped.endswith(" string"):
        stripped = stripped[: -len(" string")].strip()
    return stripped


def parse_activity_line(
    line: str,
    *,
    height: int = 0,
    hash: str = "",
    idx: int = 0,
) -> dict[str, Any] | None:
    parts = line.split("|")
    kind = _as_str(parts[0]).lower() if parts else ""
    if kind not in ACTIVITY_KINDS:
        return None
    return activity_dict(
        kind=kind,
        item_id=parts[1] if len(parts) > 1 else "",
        slug=parts[2] if len(parts) > 2 else "",
        actor=parts[3] if len(parts) > 3 else "",
        price=parse_price(parts[4] if len(parts) > 4 else 0),
        name=parts[5] if len(parts) > 5 else "",
        height=height,
        hash=hash,
        idx=idx,
    )


def parse_activity_text(raw: str, *, height: int = 0) -> list[dict[str, Any]]:
    text = unwrap_eval(raw)
    if not text.strip():
        return []
    out: list[dict[str, Any]] = []
    for i, line in enumerate(text.split("\n")):
        row = parse_activity_line(line.strip(), height=height, idx=i)
        if row is not None:
            out.append(row)
    return out
