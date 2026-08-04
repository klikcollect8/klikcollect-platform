---
name: paystack-connect-patterns
description: >-
  Vendor settlement patterns with Paystack for KlikCollect — transfer recipients,
  subaccounts/splits, payouts to vendors, freeze payouts for compliance. Use when
  implementing settlements, withdrawals, or multi-vendor money movement.
---

# Paystack Vendor Settlement Patterns

## Model (KlikCollect M3+)

1. Customer pays platform Paystack account (single merchant).
2. Ledger credits vendor payable account (`owner_type=vendor`, `vendor_public_id`).
3. Settlement batch computes net (GMV − fees − refunds).
4. Payout via **Transfer** to vendor bank/mobile money recipient.
5. Compliance can **freeze payouts** (`payments:freeze_payouts`) — block transfer creation.

## Transfer recipients

- Create once per vendor payout method → store in `transfer_recipients`.
- Fields: Paystack `recipient_code`, type (`nuban` / `mobile_money`), currency `KES`, vendor_public_id.
- Only Finance Manager / Vendor Owner / Finance Admin may create/update.

## Splits / subaccounts (optional)

- Use when Paystack Split or Subaccount is preferred over post-hoc transfers.
- Still post **full** amount to ledger for audit; split is cash movement, ledger is truth.

## Freeze

- `vendors.payouts_frozen` (or `kyc_profiles.payouts_frozen`) checked before Transfer.
- Compliance Officer sets freeze; Finance Admin sees blocked payouts.

## Idempotency

- Every payout row has `idempotency_key`; Paystack transfer reference = public id.
- Never retry transfer without checking existing `payouts` status.
