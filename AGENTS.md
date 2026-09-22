# Agents

Work only in this repo. Spawn `bazaar-*` only.

Never edit: `C:\Users\Hi\gnomemepad`, `C:\Users\Hi\zdex`, `C:\Users\Hi\gno-lending`, `C:\Users\Hi\gno-oracle`, `C:\Users\Hi\gnomies-nft`, `C:\Users\Hi\gno-vault-strategy`, `C:\Users\Hi\gno-mobile-wallet`, `C:\Users\Hi\arcgnomi`.

## Product

Fixed-price NFT marketplace and collection launchpad on gno.land. Hub `SetModule` for upgrades. UI English.

## Blockchain bar (Gno)

`.gno` work: `~/.grok/rules/gno-bar.md` + `gno-build`. `gno test` on `gno.land/p/bazaar` and `gno.land/r/bazaar`. Money fail-closed. No homemade crypto. Small diff. Done: tests pass, invariants, unproven assumptions.

## Commands

```
gno test ./gno.land/p/bazaar/fee/v1/
gno test ./gno.land/r/bazaar/
gno test ./gno.land/r/bazaar/market/
gno test ./gno.land/r/bazaar/factory/
gno test ./gno.land/r/bazaar/col/
gno test ./gno.land/r/bazaar/c/demo/
cd web; npm test
cd web; npm run dev
```

Local UI: http://127.0.0.1:5176

Pearl addpkg needs an explicit human yes. gnomcp `pearl` is read-only.
