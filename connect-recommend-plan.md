## Recommended Connect integration

### A. Account configuration
Accounts API: `/v2/core/accounts`  
Legacy account `type`: not used  
Dashboard: none (embedded components are the seller UI)  
Fee collection: your platform manages pricing (`fees_collector: application`)  
Negative balance liability: your platform (`losses_collector: application`)

KlikCollect runs checkout under the platform brand. Sellers are recipients of delayed transfers after pickup, so each connected account needs **recipient** configuration with `stripe_transfers` on `stripe_balance`.

### B. Charge pattern: separate charges and transfers
Customer pays the platform (Stripe Checkout Session / PaymentIntent). Funds stay on the platform until pickup/delivery is confirmed, then you transfer each vendor’s net. Do **not** use `application_fee_amount` — retain fees by transferring less than the captured amount.

### C. Vendor onboarding flow
Onboarding method: embedded (`account_onboarding` + `notification_banner` + `account_management` + `payouts`)  
Vendors complete KYC inside Vendor OS. Only enable transfers when recipient `stripe_transfers` capability is `active`.

### D. Payments dashboard access for vendors
Dashboard: none — sellers do not log into Stripe Dashboard. Embedded components are the primary interface for onboarding, requirements, and payouts.

### E. Embedded components
- `account_onboarding`
- `notification_banner` (required)
- `account_management`
- `payouts`
- `payments` (reduced detail with separate charges — acceptable)

### F. Webhook integration
Verify Stripe webhook signatures; handle `checkout.session.completed`, `payment_intent.succeeded`, `account.updated`, `transfer.created` / `transfer.failed`.

### G. Onboarding status gating
Before transfer: confirm recipient `stripe_balance.stripe_transfers` capability is `active` (and payouts where required).

### H. Fee structure
- Platform fee model: **mixed (rule-based)** — default **10% commission** on goods + **delivery fee by area/hub** (lookup; MVP fallback 0 for pickup)
- Transfer math: `vendor_net = goods_subtotal - commission (+ delivery share if vendor earns delivery)`
- Customer pays: goods + delivery (buyer-facing). Platform keeps commission (+ delivery if platform-kept).
- Check [stripe.com/pricing](https://stripe.com/pricing) — platform pays Stripe processing fees from retained margin.

```
Customer pays items + delivery
        │
        ▼
 ┌──────────────┐
 │  KlikCollect │ ── keeps commission (+ delivery if platform-kept) − Stripe fees
 └──────┬───────┘
        │ transfer after pickup (goods − commission)
        ▼
 ┌──────────────┐
 │    Vendor    │
 └──────────────┘
```

### I. Dual rail
- **Stripe**: cards (and Dashboard-enabled methods) via Checkout Sessions  
- **Paystack**: M-Pesa (+ existing card path retained)  
Gift wrap removed from checkout.

### J. Implementation plan
1. Env + Stripe SDK + fee rules tables  
2. Connected account create + AccountSession embedded onboarding  
3. Checkout rebuild + Stripe initialize/verify/webhook  
4. Pending vendor settlements → transfer on pickup confirmation  
5. Go-live: webhook endpoint, Connect settings, test mode end-to-end  

### K. Risk and liability
- Negative balance liability: your platform (enables transfer reversals on disputes)  
- Risk controls: platform + Stripe Radar on platform charges  

### L. Why this fits
- Multi-vendor click & collect with delayed payout  
- Platform owns customer relationship / checkout  
- Variable commission + area delivery fees  
- Keep Paystack for Kenya M-Pesa  

### M. Open questions
- Exact per-category / per-area fee tables (seeded with MVP defaults; editable later)  
- Whether delivery fee is platform-kept or shared with courier/vendor (MVP: platform-kept)
