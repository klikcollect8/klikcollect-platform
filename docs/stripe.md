# Stripe (KlikCollect dual rail)

Cards + Connect vendor payouts. M-Pesa stays on Paystack.

See also: [`connect-recommend-plan.md`](../connect-recommend-plan.md), [`docs/paystack.md`](./paystack.md).

## Model

- **Charge pattern:** separate charges and transfers (hold until pickup)
- **Connected accounts:** Accounts v2, `dashboard: none`, recipient + `stripe_transfers`
- **Fees:** rule-based — default **10% commission** + delivery by area (`fee_rules`)
- **Gift wrap:** removed

## Env

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Checkout + Connect.js |
| `STRIPE_SECRET_KEY` | Server SDK — prefer **restricted** `rk_test_…` |
| `STRIPE_WEBHOOK_SECRET` | `/api/webhooks/stripe` signing secret |
| `STRIPE_CURRENCY` | Default `kes` |
| `STRIPE_CONNECT_COUNTRY` | Default `KE` |
| `STRIPE_LIVE_ENABLED` | Prefer live secret when `true` |

## Webhook (configured)

Test-mode endpoint (platform account):

`https://klikcollect-platform.vercel.app/api/webhooks/stripe`

Events: `checkout.session.*`, `payment_intent.*`, `account.updated`, `transfer.*`

Add the same `STRIPE_WEBHOOK_SECRET` + Stripe keys on the **Vercel** project env, then redeploy so production can verify signatures.

### Localhost forwarding

Production webhook URL does not hit `localhost`. For local webhook delivery:

```bash
# Install: https://docs.stripe.com/stripe-cli
stripe login
npm run stripe:listen
```

Or: `npm run stripe:webhook` (prints/writes a CLI `whsec_` — use only while `stripe listen` is running).

Callback/verify still works for local card tests without webhooks.

## Fee rules (seeded)

| Kind | Examples |
| --- | --- |
| Commission default | 10% |
| Category overrides | Fresh 8%, Dairy 9%, Pantry 12%, Household 11% |
| Pickup | KES 0 |
| Areas | Westlands 150 → Karen 350 (KES) |
| Hubs | Westlands / Kilimani / CBD |

Edit rows in `fee_rules` (or add migration) — no code change needed for new areas.

## Local test

1. `GET /api/payments/config` → `stripe.ready: true`, `webhookConfigured: true`
2. Checkout → **Card** → Stripe Checkout (test card `4242…`)
3. Success → `/payment/callback` → receipt
4. Vendor OS → **Payouts** (`/app/payments`) → embedded onboarding
5. Mark order **collected** → `vendor_transfer_intents` transfer executes

## Routes

| Route | Role |
| --- | --- |
| `POST /api/payments/initialize` | `provider: stripe\|paystack` |
| `GET/POST /api/payments/verify` | Dual-rail verify + capture |
| `POST /api/payments/quote` | Delivery / fee preview |
| `POST /api/webhooks/stripe` | Source of truth for Stripe capture |
| `GET/POST /api/os/stripe/connect` | Vendor Account Session |
| `/app/payments` | Embedded onboarding UI |
| `/checkout` | Rebuilt dual-rail checkout |

## Ledger

- Capture idempotency: `stripe:{reference}` or `paystack:{reference}`
- Cash account: `cash_stripe`
