# Week 0 — Bazaar stand-up

- Company OS: `bazaar-*` agents + skills `bazaar-company`, `bazaar-build`, `bazaar-test`.
- Repo: `C:\Users\Hi\gno-bazaar`.
- v1: hub + market (factory + escrow book) + English Vite UI on :5176.
- Tests: `gno test` fee/hub/market PASS. Web vitest PASS.
- Public chain: Pearl (`pearl-1`). No gemstone testnet after Pearl as of 2026-09-19.
- Next (needs human yes): Pearl addpkg. Do not broadcast until yes.
- Security: no Critical/High theft path. Call `Init` immediately after addpkg (first EOA is admin).
