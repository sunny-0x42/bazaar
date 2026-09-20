from indexer.parse import parse_activity_text, parse_gno_event, parse_transaction


def test_parse_list():
    event = {
        "type": "List",
        "pkg_path": "gno.land/r/bazaar/nft",
        "attrs": [
            {"key": "id", "value": "1"},
            {"key": "seller", "value": "g1seller"},
            {"key": "price", "value": "5000000"},
        ],
    }
    row = parse_gno_event(event, caller="g1caller", height=42, hash="abc", idx=0)
    assert row is not None
    assert row["kind"] == "list"
    assert row["id"] == "1"
    assert row["actor"] == "g1seller"
    assert row["price"] == 5_000_000
    assert row["height"] == 42
    assert row["hash"] == "abc"
    assert row["idx"] == 0


def test_parse_buy():
    event = {
        "type": "Buy",
        "pkg_path": "gno.land/r/bazaar/nft",
        "attrs": [
            {"key": "id", "value": "2"},
            {"key": "buyer", "value": "g1buyer"},
            {"key": "fee", "value": "2500"},
        ],
    }
    row = parse_gno_event(
        event,
        caller="g1caller",
        height=99,
        hash="def",
        idx=1,
        send="1000000ugnot",
    )
    assert row is not None
    assert row["kind"] == "buy"
    assert row["id"] == "2"
    assert row["actor"] == "g1buyer"
    assert row["price"] == 1_000_000
    assert row["height"] == 99
    assert row["hash"] == "def"


def test_skip_junk():
    assert parse_gno_event({"type": "Init", "attrs": [{"key": "admin", "value": "g1"}]}) is None
    assert parse_gno_event({"type": "Transfer", "attrs": [{"key": "id", "value": "1"}]}) is None
    assert parse_gno_event({"type": "WithdrawFees", "attrs": []}) is None
    assert parse_gno_event({"type": "", "attrs": []}) is None
    assert parse_gno_event({"type": "Nope"}) is None
    assert parse_gno_event({}) is None
    assert parse_gno_event(None) is None
    assert parse_gno_event({"__typename": "StorageDepositEvent", "type": "List"}) is None


def test_type_map_and_actor_fallback():
    mint = parse_gno_event(
        {
            "type": "Mint",
            "attrs": [
                {"key": "id", "value": "3"},
                {"key": "owner", "value": "g1owner"},
                {"key": "collection", "value": "stones"},
            ],
        }
    )
    assert mint is not None
    assert mint["kind"] == "mint"
    assert mint["slug"] == "stones"
    assert mint["actor"] == "g1owner"

    drop = parse_gno_event({"type": "CreateDrop", "attrs": [{"key": "slug", "value": "gems"}]})
    assert drop is not None and drop["kind"] == "drop" and drop["slug"] == "gems"

    col = parse_gno_event({"type": "CreateCollection", "attrs": [{"key": "slug", "value": "gems"}]})
    assert col is not None and col["kind"] == "drop"

    pub = parse_gno_event(
        {
            "type": "PublicMint",
            "attrs": [{"key": "id", "value": "4"}, {"key": "slug", "value": "gems"}, {"key": "n", "value": "1"}],
        },
        caller="g1minter",
    )
    assert pub is not None
    assert pub["kind"] == "publicmint"
    assert pub["actor"] == "g1minter"

    cancel = parse_gno_event({"type": "Cancel", "attrs": [{"key": "id", "value": "3"}]}, caller="g1seller")
    assert cancel is not None
    assert cancel["actor"] == "g1seller"


def test_parse_transaction_uses_msgcall_caller():
    tx = {
        "hash": "h1",
        "block_height": 10,
        "messages": [{"value": {"__typename": "MsgCall", "caller": "g1alice", "func": "List", "args": ["1", "9"]}}],
        "response": {
            "events": [
                {"__typename": "GnoEvent", "type": "List", "attrs": [{"key": "id", "value": "1"}, {"key": "price", "value": "9"}]},
                {"__typename": "GnoEvent", "type": "Init", "attrs": [{"key": "admin", "value": "g1"}]},
            ]
        },
    }
    rows = parse_transaction(tx)
    assert len(rows) == 1
    assert rows[0]["kind"] == "list"
    assert rows[0]["actor"] == "g1alice"
    assert rows[0]["price"] == 9
    assert rows[0]["hash"] == "h1"
    assert rows[0]["height"] == 10


def test_parse_activity_lines():
    raw = '("mint|1|stones|g1a|0|X\\nlist|3|stones|g1a|1|Y" string)'
    rows = parse_activity_text(raw)
    assert [(r["kind"], r["id"], r["slug"], r["actor"], r["price"], r["name"]) for r in rows] == [
        ("mint", "1", "stones", "g1a", 0, "X"),
        ("list", "3", "stones", "g1a", 1, "Y"),
    ]
    assert parse_activity_text('("" string)') == []
    assert parse_activity_text("") == []
    assert parse_activity_text("junk|1|x") == []
