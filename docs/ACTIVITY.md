# Collection page + activity (Next)

## Collection activity

Factory `col` realms emit chain events (`List` / `Buy` / `Cancel` / `Mint` / `PublicMint`) but often have **no** `Activity()` tape. The UI fills Activity from the **mainnet indexer** (`docs/INDEXER.md`). Collection page has no Pool tab.

kind: `mint` | `list` | `buy` | `cancel` | `publicmint` | `transfer` | `init`

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
- Tabs **Items** | **Chart** | **Activity** (no Pool)
- Activity: compact table (Event, Item, From, Price)
- Mainnet Explore does not load `/samples/catalog.json`

English. No USD. No traits.
