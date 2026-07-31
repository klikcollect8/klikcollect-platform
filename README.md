# KlikCollect

Provisional Commerce OS codebase for a curated Nairobi marketplace.

**Product authority** lives in the Engineering Bible at `Desktop/klikcollect` (`docs/`). This repo is the provisional M1 walking-skeleton implementation — not a second source of truth.

## Surfaces

| Surface | Path | Who |
|---------|------|-----|
| Marketplace | `/` | Customers — browse, cart, account |
| Vendor Commerce OS | `/app` | Vendors — catalogue, inventory, orders |
| Platform Admin | `/admin` | Platform staff — curation, vendors, system |

## Stack (provisional)

- Next.js App Router + TypeScript + Tailwind
- **Clerk** — identity (Chapter 20 still DRAFT; adapter pattern per ADR-0018)
- **Local `.data/` JSON** — M1 catalogue / orders / cart truth
- Supabase — optional sync only (`COMMERCE_SYNC_ENABLED`), not the auth system
- Money is **display-only** (`moneyMinor` / KES cents). No live tender until M3.

## Run

```bash
npm.cmd install
npm.cmd run dev -- -p 3000
```

Requires `.env.local` with Clerk keys and (optional) Supabase keys. See existing `.env.local` for variable names.

## Milestone boundary

Aligned to Chapter 05 **M2 walking skeleton**: catalogue + inventory (INV-7) + order state machine + money-free POS + barcode. Live tender / ledger wait for **M3**.
