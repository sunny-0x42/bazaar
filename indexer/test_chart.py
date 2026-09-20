from indexer.app import ChartPoint, ChartResponse
from indexer.store import Store


def _event(**kwargs):
    row = {
        "kind": "list",
        "id": "1",
        "slug": "stones",
        "actor": "g1a",
        "price": 100,
        "name": "A",
        "height": 10,
        "hash": "h1",
        "idx": 0,
    }
    row.update(kwargs)
    return row


def _points(store: Store, slug: str = "", limit: int = 50) -> dict:
    rows = store.chart_points(slug=slug, limit=limit)
    return ChartResponse(points=[ChartPoint.model_validate(row) for row in rows]).model_dump()


def test_chart_empty_points():
    store = Store(":memory:")
    try:
        assert _points(store) == {"points": []}
    finally:
        store.close()


def test_chart_buy_list_price_positive_oldest_first():
    store = Store(":memory:")
    store.upsert(_event(kind="mint", id="0", price=0, height=1, hash="h0", name="M"))
    store.upsert(_event(kind="list", id="1", price=50, height=30, hash="h3", name="Late"))
    store.upsert(_event(kind="buy", id="2", price=200, height=10, hash="h1", name="Early"))
    store.upsert(_event(kind="list", id="3", price=0, height=11, hash="h2", name="Zero"))
    store.upsert(_event(kind="cancel", id="4", price=9, height=12, hash="h4", name="X"))
    store.upsert(_event(kind="list", id="5", price=80, height=20, hash="h5", slug="gems", name="Other"))
    try:
        assert _points(store, limit=50) == {
            "points": [
                {"height": 10, "price": 200, "kind": "buy", "id": "2", "name": "Early"},
                {"height": 20, "price": 80, "kind": "list", "id": "5", "name": "Other"},
                {"height": 30, "price": 50, "kind": "list", "id": "1", "name": "Late"},
            ]
        }
        assert _points(store, slug="stones", limit=2) == {
            "points": [
                {"height": 10, "price": 200, "kind": "buy", "id": "2", "name": "Early"},
                {"height": 30, "price": 50, "kind": "list", "id": "1", "name": "Late"},
            ]
        }
        assert _points(store, slug="nope") == {"points": []}
    finally:
        store.close()
