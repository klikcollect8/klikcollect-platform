-- Paystack payment intents, settlements, payouts, webhooks.
-- Extends existing ledger_* tables; vendor_public_id for Clerk-era text ids.

alter table public.ledger_accounts
  add column if not exists vendor_public_id text;

create index if not exists ledger_accounts_vendor_public_idx
  on public.ledger_accounts (vendor_public_id);

create table if not exists public.payment_intents (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique,
  order_public_id text,
  clerk_user_id text,
  email text,
  amount_minor bigint not null check (amount_minor > 0),
  currency_code char(3) not null default 'KES',
  paystack_reference text unique,
  paystack_access_code text,
  authorization_url text,
  status text not null default 'pending'
    check (status in ('pending', 'success', 'failed', 'abandoned')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payment_intents_order_idx on public.payment_intents (order_public_id);
create index if not exists payment_intents_status_idx on public.payment_intents (status);

create table if not exists public.transfer_recipients (
  id uuid primary key default gen_random_uuid(),
  vendor_public_id text not null,
  recipient_code text not null unique,
  type text not null,
  name text,
  currency_code char(3) not null default 'KES',
  details jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists transfer_recipients_vendor_idx
  on public.transfer_recipients (vendor_public_id);

create table if not exists public.settlements (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique,
  vendor_public_id text not null,
  period_start date,
  period_end date,
  gross_minor bigint not null default 0,
  fees_minor bigint not null default 0,
  net_minor bigint not null default 0,
  status text not null default 'open'
    check (status in ('open', 'ready', 'paid', 'cancelled')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists settlements_vendor_idx on public.settlements (vendor_public_id);

create table if not exists public.payouts (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique,
  vendor_public_id text not null,
  settlement_id uuid references public.settlements (id) on delete set null,
  recipient_id uuid references public.transfer_recipients (id) on delete set null,
  amount_minor bigint not null check (amount_minor > 0),
  currency_code char(3) not null default 'KES',
  paystack_transfer_code text,
  idempotency_key text not null unique,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'success', 'failed', 'reversed', 'frozen')),
  created_by_clerk_user_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payouts_vendor_idx on public.payouts (vendor_public_id);

create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'paystack',
  event_id text,
  event_type text not null,
  payload jsonb not null,
  processed boolean not null default false,
  error text,
  created_at timestamptz not null default now(),
  unique (provider, event_id)
);

create index if not exists webhook_events_type_idx on public.webhook_events (event_type);

create table if not exists public.kyc_submissions (
  id uuid primary key default gen_random_uuid(),
  vendor_public_id text not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'needs_info')),
  legal_name text,
  registration_number text,
  documents jsonb not null default '[]'::jsonb,
  notes text,
  payouts_frozen boolean not null default false,
  reviewed_by_clerk_user_id text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists kyc_submissions_vendor_idx on public.kyc_submissions (vendor_public_id);
create index if not exists kyc_submissions_status_idx on public.kyc_submissions (status);

create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  vendor_public_id text,
  percent_off numeric,
  amount_off_minor bigint,
  active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.promotions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  vendor_public_id text,
  status text not null default 'draft'
    check (status in ('draft', 'active', 'ended')),
  rules jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.deliveries (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique,
  order_public_id text,
  vendor_public_id text not null,
  driver_clerk_user_id text,
  status text not null default 'pending'
    check (status in ('pending', 'assigned', 'picked_up', 'in_transit', 'delivered', 'failed', 'cancelled')),
  customer_name text,
  customer_phone text,
  address_text text,
  lat double precision,
  lng double precision,
  otp_code text,
  pod jsonb not null default '{}'::jsonb,
  assigned_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists deliveries_vendor_idx on public.deliveries (vendor_public_id);
create index if not exists deliveries_driver_idx on public.deliveries (driver_clerk_user_id);
create index if not exists deliveries_status_idx on public.deliveries (status);

create table if not exists public.warehouse_tasks (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique,
  vendor_public_id text not null,
  order_public_id text,
  type text not null check (type in ('receive', 'pick', 'pack')),
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'done', 'cancelled')),
  assignee_clerk_user_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  key_prefix text not null,
  key_hash text not null,
  scopes text[] not null default '{}',
  created_by_clerk_user_id text,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.panel_notifications (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text not null,
  title text not null,
  body text,
  read_at timestamptz,
  href text,
  created_at timestamptz not null default now()
);

create index if not exists panel_notifications_user_idx
  on public.panel_notifications (clerk_user_id, created_at desc);

alter table public.payment_intents enable row level security;
alter table public.transfer_recipients enable row level security;
alter table public.settlements enable row level security;
alter table public.payouts enable row level security;
alter table public.webhook_events enable row level security;
alter table public.kyc_submissions enable row level security;
alter table public.coupons enable row level security;
alter table public.promotions enable row level security;
alter table public.deliveries enable row level security;
alter table public.warehouse_tasks enable row level security;
alter table public.api_keys enable row level security;
alter table public.panel_notifications enable row level security;
