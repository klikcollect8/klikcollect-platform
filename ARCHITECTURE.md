# Architecture (panels + money rails)

## Authority

Engineering Bible: `Desktop/klikcollect/docs/`. This document describes the **current codebase**.

## Identity & RBAC

- **Clerk** authenticates; **KlikCollect** authorizes via `lib/authz/*`.
- See [`docs/rbac.md`](docs/rbac.md).
- Memberships: `platform_memberships`, `staff_memberships` (Clerk text ids).
- Gates: `lib/auth/require-admin.ts`, `lib/auth/require-vendor.ts`, `requirePermission`.

## Money

- Paystack test/live via `lib/paystack/client.ts` (card + M-Pesa `mobile_money` channel).
- Docs: [`docs/paystack.md`](docs/paystack.md).
- Capture path: initialize → Paystack → callback verify **and** webhook → `lib/payments/capture.ts` (idempotent ledger + receipt + order `payment_status`).
- Ledger append-only: `lib/ledger/post.ts` + balances via `lib/ledger/balances.ts`.
- Tables: `payment_intents`, `payment_receipts`, `ledger_*`, `settlements`, `payouts`, `transfer_recipients`, `webhook_events`.
- Display: `lib/currency.ts` / money helpers (KES).

## Surfaces

| Surface        | Route               | Notes                                                                 |
| -------------- | ------------------- | --------------------------------------------------------------------- |
| Storefront     | `app/(storefront)/` | Customer marketplace - theme untouched by panels work                 |
| Vendor OS      | `/app`              | My business — offers/stock/orders/staff (not catalogue owner)         |
| Platform admin | `/admin`            | Ops control plane — catalogue, offers inspect, finance, KYC, security |

**Catalogue authority:** platform owns `products`; vendors own `product_offers` (price/stock). See `docs/rbac.md`.

## Data truth

| Layer                   | Role                                            |
| ----------------------- | ----------------------------------------------- |
| `.data/*.json`          | Local M1 commerce fallback                      |
| Supabase                | Memberships, ledger, KYC, deliveries, marketing |
| `lib/commerce-truth.ts` | Catalogue read unification                      |

## Middleware

`proxy.ts` - Clerk auth for `/admin`, `/app`, `/account`.

## Feature flags

`pos`, `marketing`, `finance` default **on** in `lib/feature-flag-types.ts`. Delivery/`couriers` and the `/eats` Uber-style plane are retired — marketplace is **pickup + receipt** (`/r/{publicId}`).
