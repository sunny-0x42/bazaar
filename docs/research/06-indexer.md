# Indexer GraphQL + SQLite cho Activity (2026-09-19)

Notes only. Không phải investment advice. Không hứa volume. Không clone DEX (Zdex / GnoSwap). Không launchpad curve (gnomi.fun). Không implement indexer/realm trong note này.

Mục tiêu: khóa **cách đọc** history marketplace trên Pearl. On-chain ring `Activity()` cap **50**. Full history sống **off-chain**: Pearl `tx-indexer` GraphQL → projection SQLite của Bazaar. UI copy vẫn English.

## Constraint (không bịa)

| Fact | Value |
| --- | --- |
| Testnet hiện tại | **Pearl / Test16**, `pearl-1`. Official docs: “the one to use unless you have a reason not to”. **Không** gemstone sau Pearl. Tag sau Pearl là `chain/mainnet` (`gnoland-1`). |
| RPC | `https://rpc.pearl.testnets.gno.land:443` |
| GraphQL | `https://indexer.pearl.testnets.gno.land/graphql/query` — live (probe 2026-09-19: `latestBlockHeight` = **535654**). Playground: `https://indexer.pearl.testnets.gno.land/graphql`. |
| Realm đọc | `gno.land/r/bazaar/nft` (local / sau `SetModule("nft", path)`). Pearl `vm/qpaths` prefix `gno.land/r/bazaar/` **trống** lúc probe — chưa `addpkg`. |
| On-chain feed | `Activity()` / `ActivityByCollection(slug)` — newest first, **cap 50**, oldest dropped. `eval` đọc được. |
| Events | `chain.Emit` → ABCI `/block_results`. `eval` / `qrender` **không** trả event log. |
| GRC20 | `gno.land/p/demo/tokens/grc20` có trên Pearl. **Không** `p/demo/tokens/grc721`. |
| Gno import | Không dynamic import. Unique item sống **trong** `r/bazaar/nft`. |
| Escrow | `List(id, priceUgnot)`: owner → realm. `Buy`: `OriginSend` == price ugnot. Fee 50 bps từ price (`p/bazaar/fee/v1`). |
| Không phải | DEX. Bonding-curve pad. Collection Gnomies. Oracle USD. |

Docs: [Gno networks](https://docs.gno.land/resources/gnoland-networks). Getting started: “Pearl is the current testnet” ([Getting started](https://docs.gno.land/builders/getting-started)).

gnomcp profile `pearl` trỏ đúng indexer URL này; profile `testnet` **vẫn** Topaz (`topaz-1`, archive). Đừng theo gnomcp khi docs official nói Pearl.

## Vì sao GraphQL không đủ một mình

Official comparison: `tx-indexer` GraphQL là chỗ cho **CPU-heavy read** và “home feed” của dApp — không phải `eval` trên RPC. ([Ways to interact](https://docs.gno.land/resources/comparison-of-ways-to-interact-with-gnoland).) Running a node: indexer cho query mà RPC **không** trả hiệu quả. ([Running a node](https://docs.gno.land/builders/running-a-node).)

Pearl indexer là **log tx của cả chain**. Một `getTransactions` không bound height có thể timeout (gnomcp `gno_history` trên `r/demo/users` deadline exceeded lúc probe). Query `success` + `typeUrl: exec` + `block_height.gt: 534000` trả ~1.6 MB JSON (nhiều `MsgCall` GnoSwap). Marketplace không ingest DEX.

Bazaar cần **projection** theo slug / kind / price / actor — shape Activity UI, không phải raw Amino tx.

## Pearl GraphQL — `getTransactions`

Live schema (introspection 2026-09-19), khớp [tx-indexer](https://github.com/gnolang/tx-indexer) `serve/graph/schema`:

```
Query.getTransactions(where: FilterTransaction!, order: TransactionOrder): [Transaction]
Query.latestBlockHeight: Int!
```

`TransactionOrder`: `{ heightAndIndex: ASC | DESC }`.

Filter dùng trên Pearl (auto-generated `where`, **không** nhầm với input `TransactionFilter` cũ của query deprecated `transactions(filter:)`):

| Field | Operator | Bazaar dùng |
| --- | --- | --- |
| `success` | `FilterBoolean.eq` | `true` — bỏ tx panic / revert |
| `messages.typeUrl` | `FilterString.eq` | `"exec"` (`MsgCall`). Thiếu filter này: probe `pkg_path` loose trả `create_session` / `UnexpectedMessage`. |
| `messages.value.MsgCall.pkg_path` | `FilterString.eq` | path NFT realm (`gno.land/r/bazaar/nft` hoặc `gno.land/r/<g1>/bazaar/nft`) |
| `block_height` | `FilterInt.eq` / `gt` / `lt` | incremental sync. **Không** có `gte` — dùng `gt: lastHeight`. |
| `response.events.GnoEvent.type` | `FilterString.eq` | optional: `Mint` / `List` / `Buy` / … |
| `response.events.GnoEvent.attrs` | nested key/value | optional: `slug`, `id` |

`FilterString`: `exists`, `eq`, `like`.

`MsgCall` (typeUrl `exec`, route `vm`):

| Field | Ý |
| --- | --- |
| `caller` | EOA signer |
| `pkg_path` | realm được gọi |
| `func` | `Mint` / `List` / `Buy` / `Cancel` / `PublicMint` / `CreateDrop` / … |
| `args` | string args theo thứ tự hàm |
| `send` | OriginSend (`"<amount>ugnot"`). **Buy** / paid `PublicMint`: đây là price; `Buy` emit **không** có attr `price`. |
| `max_deposit` | storage cap |

Các field tx cần persist: `hash` (base64), `index` (trong block), `block_height`, `success`. Dedup: `(hash, index)` hoặc `(kind, id, height)` như `docs/INDEXER.md`.

Không bound `block_height` trên Pearl = rủi ro timeout. Sync: `latestBlockHeight` → `gt: cursor`.

## `GnoEvent` attrs

`chain.Emit(typ, key, value, …)` ghi ABCI. Off-chain đọc `/block_results` hoặc indexer. ([stdlibs Events](https://docs.gno.land/resources/gno-stdlibs), [Effective Gno — emit](https://docs.gno.land/resources/effective-gno#emit-gno-events-to-make-life-off-chain-easier).)

ABCI JSON (docs):

```json
{
  "@type": "/tm.gnoEvent",
  "type": "OwnershipChange",
  "pkg_path": "gno.land/r/demo/example",
  "func": "ChangeOwner",
  "attrs": [{ "key": "oldOwner", "value": "g1…" }, { "key": "newOwner", "value": "g1…" }]
}
```

GraphQL type `GnoEvent` trên Pearl (introspection + schema `transaction.graphql`):

| Field | Có? |
| --- | --- |
| `type` | Có |
| `pkg_path` | Có |
| `attrs { key value }` | Có (`GnoEventAttribute`) |
| `func` | **Không** trên GraphQL. Comment schema vẫn nói có `func`. Lấy tên hàm từ `MsgCall.func`. |

`Event` union live Pearl: `GnoEvent` \| `StorageDepositEvent` \| `StorageUnlockEvent` \| `UnknownEvent`. GitHub schema còn `TransferEvent` (bank) — **chưa** thấy trên Pearl introspection. Parse phải `__typename` + skip storage events.

Probe Pearl height 535691: `GnoEvent.type` = `Transfer` / `Approval` / …; `attrs` = cặp string. Cùng pattern Bazaar sẽ emit.

### Emit Bazaar → hàng Activity

Realm **đã** `chain.Emit` sau money path (`nft.gno` / `book.gno`). Ring `record()` **không** thay Emit — trùng nghĩa, khác chỗ đọc.

| `GnoEvent.type` | attrs | Actor | Price (ugnot) | `record` kind |
| --- | --- | --- | --- | --- |
| `Mint` | `id`, `owner`, `collection` | `owner` | 0 | `mint` |
| `CreateDrop` | `slug` | `MsgCall.caller` | mintPrice chỉ trong ring, **không** trong attrs | `drop` |
| `CreateCollection` | `slug` | caller | — | không lên public feed (`docs/ACTIVITY.md`) |
| `PublicMint` | `id`, `slug`, `n` | caller | `MsgCall.send` (mintPrice) | `publicmint` |
| `List` | `id`, `seller`, `price` | `seller` | attr `price` | `list` |
| `Buy` | `id`, `buyer`, `fee` | `buyer` | **`MsgCall.send`**, không attr `price` | `buy` |
| `Cancel` | `id` | caller / seller | 0 | `cancel` |
| `Transfer` | `id`, `to` | — | — | không public feed |
| `TransferAdmin` / `WithdrawFees` / `Init` | admin | — | — | không public feed |

`name` **không** nằm trong Emit. Ring on-chain có `name`. Indexer: copy từ ring fallback, hoặc bỏ trống / lookup item — không homemade hash.

Chỉ ingest event `success: true`. Panic trên `Buy` = không row (fail-closed, khớp realm).

## Cap 50 — vì sao SQLite của marketplace

On-chain (`nft.gno`):

```
acts.Set(...)
if acts.Size() > 50 {
    old, _ := acts.GetByIndex(0)
    acts.Remove(old)
}
```

Cùng cap: `ListOpen`, `ListByCollection`, `ListItemsByCollection` (scan dừng ở 50). `Activity()` newest first, oldest **mất**.

`eval` đọc ring. `eval` **không** đọc ABCI. Collection tab Activity hôm nay: `ActivityByCollection` rồi catalog preview (`web/src/App.tsx`). Đủ Next; **không** đủ last-sale / volume / history > 50.

Pearl GraphQL giữ **mọi** tx đã index — nhưng:

1. Shape chain-wide, không phải `{ kind, id, slug, actor, price, name, height, hash }`.
2. Unbounded query chậm / timeout.
3. `Buy.price` phải ghép `MsgCall.send`; `name` phải ghép state khác.
4. gnodev local **không** có Pearl indexer.
5. Public indexer có thể lag RPC; cursor `block_height` cần persist.

SQLite (spec `docs/INDEXER.md`, `BAZAAR_DB`):

- Read-only. Không keys. Không ký tx.
- Nguồn 1: GraphQL `getTransactions` + parse `GnoEvent`.
- Nguồn 2: fallback `vm/qeval` `Activity()` / `ActivityByCollection`.
- Merge: `hash+index` hoặc `kind+id+height`.
- Cursor: `height` đã ingest.
- UI: `GET /api/activity?slug=&limit=50` newest first — **limit 50 là page**, không phải trần lịch sử.
- Stats (`volume_ugnot` = tổng price `buy`) **không** tính được từ ring 50 dòng.

Không thay thế ring. Ring = recent truth on-chain, không gas-nặng cho `Buy`. SQLite = history + height. Docs comparison gọi đúng việc này: off-chain service cho feed.

## Đường đọc đề xuất

```
Pearl tx-indexer GraphQL
  getTransactions(
    where: {
      success: { eq: true }
      messages: {
        typeUrl: { eq: "exec" }
        value: { MsgCall: { pkg_path: { eq: BAZAAR_NFT_PKG } } }
      }
      block_height: { gt: cursor }
    }
    order: { heightAndIndex: ASC }
  )
        │
        ▼
  parse response.events GnoEvent
  (skip Storage* / UnknownEvent)
        │
        ▼
  SQLite projection (marketplace)
        │
        ▼
  UI Activity tab  →  nếu trống: eval ActivityByCollection  →  catalog preview
```

Local gnodev: bỏ qua GraphQL, chỉ qeval + SQLite từ ring (vẫn cap 50 cho đến khi có indexer process).

Live subscribe GraphQL (`Subscription.getTransactions`) = **Later**. Vite v1 poll. Không WebSocket trong UI.

## Keep / Adapt / Reject

| Pattern | Source | Verdict | Why |
| --- | --- | --- | --- |
| Off-chain feed từ `tx-indexer` | docs comparison; Effective Gno emit | **Keep** | Đúng chỗ cho history / home feed. |
| Filter `MsgCall.pkg_path` + `success` | tx-indexer schema; Pearl live | **Keep** | Một realm, một book. |
| Parse `GnoEvent.attrs` | stdlibs Events | **Adapt** | GraphQL không có `func`; `Buy` không attr `price`. |
| On-chain ring cap 50 | `Activity()` shipped | **Keep** | Recent tab khi indexer down. Không tăng cap vô hạn on-chain. |
| SQLite projection | `docs/INDEXER.md` | **Keep** | History > 50, volume, cursor height. |
| 24h volume / last sale trên card | ME / Blur | **Later** | Cần SQLite đầy. Không USD. |
| Ingest GnoSwap / foreign GRC20 events | Pearl live sample | **Reject** | Không DEX. Filter `pkg_path` Bazaar. |
| External GRC721 indexer | — | **Reject** | Pearl không `p/demo/tokens/grc721`. |
| Tự host full node chỉ để Activity | Running a node | **Reject** | Public GraphQL + RPC đủ; node chỉ khi archival riêng. |

## Assumptions not proven

- Pearl vẫn là testnet hiện tại tại ngày note; docs không liệt kê gemstone sau Pearl.
- Hosted `indexer.pearl.testnets.gno.land` giữ URL / schema `where` + `eq` ổn định. Schema GitHub còn input `TransactionFilter` cũ — Pearl live dùng `FilterTransaction` nested.
- `GnoEvent.func` có thể xuất hiện trên GraphQL sau; hôm nay lấy `MsgCall.func`.
- `r/bazaar/nft` chưa có trên Pearl; filter `pkg_path` sẽ trống đến khi human yes `addpkg`. Path thật có thể là `gno.land/r/<g1>/bazaar/nft`.
- Nested `pkg_path.eq` không bound `typeUrl` có false positive (`create_session`) — luôn AND `typeUrl: exec`.
- `FilterInt` không `gte`; cursor `gt: lastHeight` có thể miss tx cùng height nếu chỉ so height, không `index`. Dedup `(hash, index)` bắt buộc.
- Public indexer lag vs RPC: UI vẫn tin `eval` cho book (listed/price). Indexer không phải source of truth cho escrow.
- Volume SQLite ≠ valuation. Banner Pearl: test GNOT has no market value.
- Cap 50 ring không nổ gas `Buy` đáng kể — chưa đo. Nếu đo xấu: **không** nhét history vào money path; để SQLite.

## Không làm

- Không DEX, AMM, vault, offer, auction, sweep.
- Không bonding curve / gnomi.fun.
- Không ingest Gnomies hay GRC721 lạ.
- Không giả USD / 24h pump copy.
- Không keys trong indexer process. Không deploy / addpkg trong note này.
- Không edit repo khác (`gnomemepad`, `zdex`, `gnomies-nft`, …).
- Không implement FastAPI/SQLite trong note này. Spec process: `docs/INDEXER.md`.

## Nguồn đã đọc

| Venue | Loại | URL |
| --- | --- | --- |
| Gno | Networks: Pearl = current testnet; không gemstone sau Pearl | https://docs.gno.land/resources/gnoland-networks |
| Gno | Getting started: Pearl is the current testnet | https://docs.gno.land/builders/getting-started |
| Gno | Events: `chain.Emit` → ABCI; attrs key/value | https://docs.gno.land/resources/gno-stdlibs |
| Gno | Effective Gno: emit sau ownership / transfer | https://docs.gno.land/resources/effective-gno |
| Gno | `tx-indexer` GraphQL = off-chain feed (CPU-heavy / home feed) | https://docs.gno.land/resources/comparison-of-ways-to-interact-with-gnoland |
| Gno | Running a node: indexer cho query RPC không trả hiệu quả | https://docs.gno.land/builders/running-a-node |
| tx-indexer | GraphQL `/graphql/query`; `getTransactions`; hosted example | https://github.com/gnolang/tx-indexer |
| tx-indexer | `Transaction` / `MsgCall` / `GnoEvent` schema | https://github.com/gnolang/tx-indexer/blob/main/serve/graph/schema/types/transaction.graphql |
| Pearl | Live GraphQL (probe `latestBlockHeight`, `getTransactions`) | https://indexer.pearl.testnets.gno.land/graphql/query |
| Bazaar | Indexer process spec | `docs/INDEXER.md` |
| Bazaar | On-chain Activity cap 50 | `docs/ACTIVITY.md` |
| Bazaar | Next: Collection page + Activity | `docs/research/05-next.md` |
| Bazaar | Network | `docs/research/00-network.md` |
| Bazaar | Upgrade #8 indexer Later | `docs/UPGRADE.md` |
