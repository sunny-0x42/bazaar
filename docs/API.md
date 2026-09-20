# Bazaar API

Default product is the **NFT book** (`docs/NFT.md`, `gno.land/r/bazaar/nft`). The GRC20 factory book below is **legacy**.

Local package paths (gnodev / tests). On Pearl they deploy under `gno.land/r/<g1>/bazaar/…`. The UI resolves `GetModule("nft")` first, then `GetModule("market")`.

## Hub `gno.land/r/bazaar`

| Func | Who | Notes |
| --- | --- | --- |
| `Init(cur)` | first EOA | once |
| `SetModule(cur, name, path)` | admin | `market` now; later `nft` |
| `GetModule(name) string` | anyone | empty if missing |
| `ListModules() string` | anyone | `name\|path` lines |
| `AddAdmin` / `RemoveAdmin` / `IsAdmin` | admin | cannot remove last admin |
| `Render(path)` | gnoweb | |

## Market `gno.land/r/bazaar/market`

Factory + book in one realm so a listing can escrow the same GRC20 without a compile-time import of a foreign token. Upgrade by deploying `marketv2` and `SetModule("market", newPath)`.

Fee: 50 bps of `price` ugnot. Seller receives `price - fee`.

| Func | Who | Notes |
| --- | --- | --- |
| `Init(cur)` | first EOA | admin = caller |
| `Create(cur, name, symbol, decimals, supply)` | EOA | mints `supply` to creator; symbol 2–8 A–Z0–9, unique |
| `Transfer` / `Approve` / `TransferFrom` | holder / spender | standard GRC20 |
| `BalanceOf` / `TotalSupply` / `Meta` / `ListSymbols` | read | |
| `List(cur, symbol, amount, priceUgnot)` | EOA | pulls tokens from caller into escrow |
| `Buy(cur, id)` | EOA | `OriginSend` must equal `price` ugnot |
| `Cancel(cur, id)` | seller | returns escrow |
| `WithdrawFees(cur)` | admin | protocol ugnot |
| `TransferAdmin(cur, next)` | admin | rotate fee admin |
| `GetListing(id) string` | read | `id\|symbol\|seller\|amount\|price\|status` |
| `ListOpen() string` | read | open rows |
| `ListingCount() int` / `ProtocolBps() int64` / `ProtocolFees() int64` | read | |

Statuses: `open`, `sold`, `cancelled`.

## UI flow

1. Connect Adena on Pearl (or local gnodev).
2. Create token → List (no separate Approve; List pulls from the caller).
3. Buyer: Buy with exact GNOT (`send = price ugnot`).
4. Seller may Cancel while `open`.
