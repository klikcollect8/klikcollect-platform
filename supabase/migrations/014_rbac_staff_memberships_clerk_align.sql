-- Align staff_memberships + clerk_identities with Clerk-centric RBAC (app lib/authz).
-- Applied remotely as: rbac_staff_memberships_clerk_align
-- staff_memberships was empty — safe to reshape from UUID/FK model to text clerk/vendor ids.

-- 1) clerk_identities: ensure clerk_user_id exists (remote used clerk_subject)
alter table public.clerk_identities
  add column if not exists clerk_user_id text;

alter table public.clerk_identities
  add column if not exists email text;

alter table public.clerk_identities
  add column if not exists updated_at timestamptz not null default now();

update public.clerk_identities
set clerk_user_id = clerk_subject
where (clerk_user_id is null or clerk_user_id = '')
  and clerk_subject is not null;

create unique index if not exists clerk_identities_clerk_user_id_uidx
  on public.clerk_identities (clerk_user_id)
  where clerk_user_id is not null;

create index if not exists clerk_identities_email_idx
  on public.clerk_identities (email);

comment on table public.clerk_identities is
  'Maps Clerk user IDs to optional legacy users rows.';

-- 2) Recreate staff_memberships in Clerk shape
drop view if exists public.active_staff_memberships;

drop table if exists public.staff_memberships cascade;

create table public.staff_memberships (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text not null,
  email text,
  vendor_id text not null,
  store_id text,
  role text not null check (role in (
    'vendor_owner',
    'vendor_admin',
    'store_manager',
    'inventory_manager',
    'product_manager',
    'finance_manager',
    'vendor_support',
    'marketing_manager',
    'vendor_staff',
    'cashier',
    'sales_assistant',
    'stock_clerk',
    'vendor_driver',
    'independent_driver',
    'fleet_manager',
    'dispatch_manager',
    'warehouse_manager',
    'picker',
    'packer'
  )),
  status text not null default 'active' check (status in ('active', 'invited', 'revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clerk_user_id, vendor_id)
);

create index staff_memberships_vendor_idx on public.staff_memberships (vendor_id);
create index staff_memberships_clerk_idx on public.staff_memberships (clerk_user_id);
create index staff_memberships_store_idx on public.staff_memberships (store_id);
create index staff_memberships_email_idx on public.staff_memberships (email);

alter table public.staff_memberships enable row level security;

comment on table public.staff_memberships is
  'Vendor-scoped RBAC membership (Clerk). Service role manages until RLS policies ship.';
comment on column public.staff_memberships.store_id is
  'Optional branch scope for store roles (cashier, stock_clerk, store_manager, …).';
comment on column public.staff_memberships.vendor_id is
  'Vendor public id text (e.g. ven_…), not necessarily vendors.id uuid.';

create or replace view public.active_staff_memberships as
  select *
  from public.staff_memberships
  where status in ('active', 'invited');

-- 3) Ensure platform_memberships is present and correct
create table if not exists public.platform_memberships (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text not null unique,
  email text,
  role text not null check (role in (
    'super_admin',
    'platform_admin',
    'compliance_officer',
    'finance_admin',
    'support_agent',
    'marketplace_curator',
    'bi_analyst'
  )),
  status text not null default 'active' check (status in ('active', 'invited', 'revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists platform_memberships_email_idx
  on public.platform_memberships (email);
create index if not exists platform_memberships_role_idx
  on public.platform_memberships (role);

alter table public.platform_memberships enable row level security;

-- 4) Ensure audit_log exists
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_clerk_user_id text,
  action text not null,
  resource_type text,
  resource_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_created_idx on public.audit_log (created_at desc);
create index if not exists audit_log_actor_idx on public.audit_log (actor_clerk_user_id);

alter table public.audit_log enable row level security;

comment on table public.audit_log is
  'Append-only audit events. Application must not UPDATE/DELETE rows (constitutional).';
