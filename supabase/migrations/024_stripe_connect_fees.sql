-- Stripe Connect + rule-based fees (dual rail with Paystack).

alter table public.payment_intents
  add column if not exists provider text not null default 'paystack'
    check (provider in ('paystack', 'stripe')),
  add column if not exists stripe_checkout_session_id text,
  add column if not exists stripe_payment_intent_id text;

create unique index if not exists payment_intents_stripe_session_uidx
  on public.payment_intents (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

create unique index if not exists payment_intents_stripe_pi_uidx
  on public.payment_intents (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

create table if not exists public.stripe_connected_accounts (
  id uuid primary key default gen_random_uuid(),
  vendor_public_id text not null unique,
  stripe_account_id text not null unique,
  dashboard text not null default 'none',
  charges_ready boolean not null default false,
  transfers_ready boolean not null default false,
  details_submitted boolean not null default false,
  requirements jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists stripe_connected_accounts_vendor_idx
  on public.stripe_connected_accounts (vendor_public_id);

-- Rule-based fees: commission % and delivery by area/hub.
create table if not exists public.fee_rules (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique,
  kind text not null check (kind in ('commission', 'delivery')),
  -- Optional scopes (null = fallback / global)
  category_name text,
  product_public_id text,
  vendor_public_id text,
  area_key text,
  collect_hub text,
  -- commission: percent_bps (1000 = 10.00%); delivery: flat_minor
  percent_bps integer,
  flat_minor bigint,
  priority integer not null default 100,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (kind = 'commission' and percent_bps is not null)
    or (kind = 'delivery' and flat_minor is not null)
  )
);

create index if not exists fee_rules_kind_active_idx
  on public.fee_rules (kind, active, priority);

-- Pending vendor transfers after Stripe capture (separate charges & transfers).
create table if not exists public.vendor_transfer_intents (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique,
  order_public_id text not null,
  vendor_public_id text not null,
  payment_intent_public_id text,
  stripe_transfer_id text,
  goods_minor bigint not null default 0,
  commission_minor bigint not null default 0,
  delivery_minor bigint not null default 0,
  net_minor bigint not null check (net_minor >= 0),
  currency_code char(3) not null default 'KES',
  status text not null default 'pending'
    check (status in ('pending', 'ready', 'transferred', 'failed', 'cancelled')),
  idempotency_key text not null unique,
  error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists vendor_transfer_intents_order_idx
  on public.vendor_transfer_intents (order_public_id);
create index if not exists vendor_transfer_intents_status_idx
  on public.vendor_transfer_intents (status);

-- MVP defaults
insert into public.fee_rules (public_id, kind, percent_bps, priority, metadata)
values ('fee_commission_default', 'commission', 1000, 1000, '{"note":"MVP default 10%"}'::jsonb)
on conflict (public_id) do nothing;

insert into public.fee_rules (public_id, kind, flat_minor, area_key, priority, metadata)
values ('fee_delivery_pickup_default', 'delivery', 0, 'pickup', 1000, '{"note":"MVP pickup delivery 0"}'::jsonb)
on conflict (public_id) do nothing;

alter table public.stripe_connected_accounts enable row level security;
alter table public.fee_rules enable row level security;
alter table public.vendor_transfer_intents enable row level security;
