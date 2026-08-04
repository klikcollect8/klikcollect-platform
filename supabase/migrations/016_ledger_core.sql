-- Ledger ensure + payment receipts + seed platform accounts.

create table if not exists public.ledger_accounts (
  id uuid primary key default gen_random_uuid(),
  currency_code char(3) not null default 'KES',
  code text not null,
  name text not null,
  owner_type text not null default 'platform',
  vendor_id uuid,
  vendor_public_id text,
  created_at timestamptz not null default now()
);

alter table public.ledger_accounts
  add column if not exists vendor_public_id text;

create unique index if not exists ledger_accounts_code_uidx
  on public.ledger_accounts (code);

create table if not exists public.ledger_transactions (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique,
  idempotency_key text not null unique,
  transaction_type text not null,
  reference_type text,
  reference_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.ledger_entries (
  id bigserial primary key,
  transaction_id uuid not null references public.ledger_transactions (id),
  account_id uuid not null references public.ledger_accounts (id),
  currency_code char(3) not null default 'KES',
  amount_minor bigint not null,
  created_at timestamptz not null default now()
);

create index if not exists ledger_entries_account_idx
  on public.ledger_entries (account_id);

create index if not exists ledger_entries_tx_idx
  on public.ledger_entries (transaction_id);

create table if not exists public.payment_receipts (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique,
  order_public_id text,
  payment_intent_public_id text,
  paystack_reference text not null unique,
  clerk_user_id text,
  customer_email text,
  amount_minor bigint not null check (amount_minor > 0),
  currency_code char(3) not null default 'KES',
  channel text,
  line_items jsonb not null default '[]'::jsonb,
  paid_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists payment_receipts_user_idx
  on public.payment_receipts (clerk_user_id, created_at desc);

create index if not exists payment_receipts_order_idx
  on public.payment_receipts (order_public_id);

insert into public.ledger_accounts (code, name, owner_type, currency_code)
select v.code, v.name, v.owner_type, v.currency_code
from (
  values
    ('cash_paystack', 'Cash — Paystack', 'platform', 'KES'),
    ('mpesa_clearing', 'M-Pesa clearing', 'platform', 'KES'),
    ('revenue_clearing', 'Revenue clearing', 'platform', 'KES'),
    ('vendor_payable', 'Vendor payable (aggregate)', 'platform', 'KES'),
    ('platform_fees', 'Platform fees', 'platform', 'KES')
) as v(code, name, owner_type, currency_code)
where not exists (
  select 1 from public.ledger_accounts a where a.code = v.code
);

alter table public.ledger_accounts enable row level security;
alter table public.ledger_transactions enable row level security;
alter table public.ledger_entries enable row level security;
alter table public.payment_receipts enable row level security;
