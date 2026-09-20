# Collection page + activity (Next)

## Realm `gno.land/r/bazaar/nft`

On-chain ring (cap **50**, oldest dropped). `eval` can read it. Do not rely on ABCI logs.

Event line: `kind|id|slug|actor|price|name`

kind: `mint` | `list` | `buy` | `cancel` | `drop` | `publicmint` | `offer` | `canceloffer` | `accept` | `depositpool` | `withdrawpool` | `depositnft` | `withdrawnft`

| Func | Notes |
| --- | --- |
| `Activity() string` | newest first, cap 50 |
| `ActivityByCollection(slug) string` | newest first, that slug only |
| `ListItemsByCollection(slug) string` | **all** items in slug (listed + unlisted), ItemLine, cap 50 |

Record after successful Mint/MintIn, List, Buy, Cancel, CreateDrop, PublicMint.

Buy actor = buyer; List actor = seller; mint actor = minter; drop actor = creator.

## UI

Collection page (Explore drill-down):

- Hero: cover, name, slug, official Website / X / Discord, stats row
- Stats: Floor Price, Top Offer, 7d Vol, 7d Sales, Market Cap, Listed / Supply, % Owners
- 7d Vol / 7d Sales are the recent activity tape (cap 50), not a calendar window
- Tabs **Items** | **Offers** | **Pool** | **Chart** | **Activity**
- Offers: escrowed GNOT bid on an item; owner/seller Accept; bidder Cancel
- Instant Sell: owner/seller takes the highest bid (`InstantSell`)
- Sweep: one tx, up to 10 cheapest listed items (`Sweep`, `OriginSend` = sum of prices)
- Pool: deposit/withdraw ugnot shares; deposit/withdraw unlisted NFTs (`DepositNftPool` / `WithdrawNftPool`)
- Activity: compact table (Event, Item, From, Price)
- Preview catalog: 3 fake rows per collection (`mint` then `list`) so the tab is not blank without Pearl

English. No USD. No traits.
