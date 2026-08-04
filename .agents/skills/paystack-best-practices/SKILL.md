---
name: paystack-best-practices
description: >-
  Paystack integration for KlikCollect — initialize/verify transactions, webhooks,
  refunds, transfers, KES amounts in minor units. Use when building or debugging
  payments, ledger posts, or payouts. Never expose secret keys client-side.
---

# Paystack Best Practices (KlikCollect)

## Keys

| Key | Where | Notes |
|-----|--------|------|
| `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` (`pk_test_` / `pk_live_`) | Client OK | Inline / Popup |
| `PAYSTACK_SECRET_KEY` / `PAYSTACK_TEST_SECRET_KEY` (`sk_test_`) | Server only | Initialize, verify, transfer, refund |
| `PAYSTACK_WEBHOOK_SECRET` | Server | Verify `x-paystack-signature` |

**Never** put `sk_*` in client bundles. Paystack MCP accepts **test secrets only** (`sk_test_`).

## Amounts (KES)

- Always **minor units** (cents/kobo-style): KES 1.00 → `100`.
- Use `lib/money.ts` helpers; store `amount_minor` as bigint/integer.
- Currency code: `KES`.

## Checkout flow

1. Server: create `payment_intents` row + call Paystack **Initialize Transaction**.
2. Client: redirect/Popup with `authorization_url` / access code.
3. Webhook `charge.success` (source of truth) → verify signature → mark paid → **append** ledger entries.
4. Verify endpoint is backup only; do not trust client-only success.

## Webhooks

- Persist raw event in `webhook_events` with Paystack `id` for idempotency.
- HMAC SHA512 of body with secret → compare to `x-paystack-signature`.
- On duplicate event id: return 200, no double-post to ledger.

## Refunds / payouts

- Refunds: Paystack Refund API + reverse ledger legs (new entries, never edit old).
- Payouts: Transfer Recipient + Transfer; require `payments:payout` / `finance:withdraw`.
- Constitutional: never UPDATE/DELETE `ledger_entries`.

## RBAC

- Capture: cashier / POS / checkout.
- Refund: Store Manager+, Finance Manager, Finance Admin — **not** cashier.
- Withdraw: Vendor Owner / Finance Manager only (not Vendor Admin).
- Platform Admin: view reports; cannot bypass ledger or delete immutable records.

## Code locations

- Client: `lib/paystack/client.ts`
- APIs: `app/api/payments/*`, `app/api/webhooks/paystack`
- Ledger: `lib/ledger/*`
