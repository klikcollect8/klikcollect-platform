# Architecture (provisional M1)

## Authority

Engineering Bible: `Desktop/klikcollect/docs/`. This document describes the **current codebase**, not ratified chapter contracts that are still PLANNED (File Structure, API, etc.).

## Identity

- **Clerk** is the only customer/staff identity provider in this tree.
- Admin and vendor gates: `lib/admin-auth.ts`, `lib/auth/require-clerk-user.ts`, `lib/auth/require-vendor.ts`, `lib/auth/require-admin.ts`.
- Middleware entry: `proxy.ts` (Next.js 16).

## Data truth

| Layer | Role |
|-------|------|
| `.data/*.json` | Local M1 truth — catalogue, OS orders, cart/wishlist, memberships, events |
| `lib/commerce-truth.ts` | Unified catalogue read (local + optional legacy merge) |
| `lib/catalogue-store.ts` / `orders-store.ts` / `customer-store.ts` / `m1-store.ts` | Write paths for local truth |
| `lib/data.ts` | **Legacy** Supabase helpers — narrow use; prefer `.data` truth |
| `lib/commerce-sync.ts` | Optional push to Supabase when enabled |

## Money

- `lib/money.ts` — format/parse KES minor units (INV-1 display).
- No Paystack / live tender / ledger in this milestone.

## Route groups

```
app/(storefront)/   marketplace + /account
app/(os)/app/       vendor Commerce OS
app/admin/          platform admin
app/api/            route handlers
```
