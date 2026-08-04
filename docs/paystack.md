# Paystack (KlikCollect)

Kenya / KES. Card and **M-Pesa via Paystack `mobile_money` channel** (not Daraja).

## Env (local only - never commit)

| Variable                                           | Purpose                                                             |
| -------------------------------------------------- | ------------------------------------------------------------------- |
| `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY`                  | Inline popup + Payment Providers UI                                 |
| `PAYSTACK_SECRET_KEY` / `PAYSTACK_TEST_SECRET_KEY` | Server initialize/verify/transfer/refund                            |
| `PAYSTACK_WEBHOOK_SECRET`                          | HMAC for `/api/webhooks/paystack` (defaults to secret key if unset) |
| `PAYSTACK_LIVE_ENABLED`                            | Prefer live secret when `true`                                      |

MCP (`@paystack/mcp-server` in `.cursor/mcp.json`) accepts **test secrets only** (`sk_test_`).

## Localhost test checklist

1. Confirm keys: `GET /api/payments/config` → `ready: true`
2. `npm run dev` → http://localhost:3000
3. Sign in → add items → `/checkout`
4. **Card (recommended):** choose Card → Pay → Paystack Inline → test card `4084084084084081`, any future expiry, any CVV, PIN `0000` if asked
5. **M-Pesa:** choose M-Pesa → enter `07…` / `+2547…` → Pay → complete STK/hosted mobile_money in Paystack sandbox
6. Success → `/account/receipts/{id}`; order shows as paid on `/account/orders`
7. Cart clears **only after** success

### Webhook on localhost (optional)

Callback/verify is enough for local testing. For webhook:

1. `ngrok http 3000`
2. Paystack Dashboard → Webhook URL: `https://{tunnel}/api/webhooks/paystack`
3. Event: `charge.success`

## Checkout flow

1. Create order (`POST /api/orders`)
2. `POST /api/payments/initialize` with `method: card|mpesa`, optional `phone` (2547…)
3. Client opens **Paystack Inline** via `accessCode` (`lib/paystack/inline.ts`); redirect fallback uses `authorizationUrl`
4. Poll `GET /api/payments/verify?reference=` until success
5. `captureSuccessfulPayment` → ledger + receipt + `orders.payment_status=paid`
6. Webhook `charge.success` uses same capture (idempotent `paystack:{reference}`)

## App routes

| Route                           | Role                                                                    |
| ------------------------------- | ----------------------------------------------------------------------- |
| `POST /api/payments/initialize` | Start checkout (`method`: `card` \| `mpesa`)                            |
| `GET/POST /api/payments/verify` | Verify + capture (pollable)                                             |
| `POST /api/webhooks/paystack`   | Source of truth for capture                                             |
| `GET /api/admin/paystack`       | Admin ops console data (balance, txns, local intents/receipts/webhooks) |
| `POST /api/admin/paystack`      | Admin actions: `verify`, `sync_capture`, `refund`                       |
| `/admin/payments`               | Paystack ops console UI                                                 |
| `GET /api/receipts?reference=`  | Lookup receipt by Paystack ref                                          |
| `GET /api/receipts/[id]`        | Receipt by public id                                                    |
| `/account/receipts/[id]`        | Customer receipt UI                                                     |
| `/account/receipts/lookup?ref=` | Redirect helper                                                         |
| `/r/[publicId]`                 | Printable receipt                                                       |

## Ledger & balances

- Append-only via `lib/ledger/post.ts` - never UPDATE/DELETE `ledger_entries`.
- Idempotency key for captures: `paystack:{reference}` (shared by verify + webhook).
- Balances = `SUM(ledger_entries.amount_minor)` per account (`lib/ledger/balances.ts`).

## Notes

- Single platform charge this pass (no multi-vendor Paystack split).
- Never put `sk_*` in client bundles.

## Skills

- `.agents/skills/paystack-best-practices`
- `.agents/skills/paystack-connect-patterns`
- `.agents/skills/paystack-directory`
