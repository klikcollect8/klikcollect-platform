-- Phase 1 RBAC: platform memberships + expanded vendor/store/delivery staff roles.
-- Clerk authenticates; KlikCollect authorizes via memberships.

-- Platform staff memberships
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

comment on table public.platform_memberships is
  'Platform-scoped RBAC membership. Service role manages until RLS policies ship.';

-- Broaden staff_memberships roles + optional store scope
alter table public.staff_memberships
  drop constraint if exists staff_memberships_role_check;

alter table public.staff_memberships
  add column if not exists store_id text;

alter table public.staff_memberships
  add column if not exists email text;

alter table public.staff_memberships
  add constraint staff_memberships_role_check check (role in (
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
  ));

create index if not exists staff_memberships_store_idx
  on public.staff_memberships (store_id);

create index if not exists staff_memberships_email_idx
  on public.staff_memberships (email);

comment on column public.staff_memberships.store_id is
  'Optional branch scope for store roles (cashier, stock_clerk, store_manager, …).';

-- Append-only audit log for compliance (Phase 3 ready; used by authz docs)
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

-- Staff invites helper view (active + invited)
create or replace view public.active_staff_memberships as
  select *
  from public.staff_memberships
  where status in ('active', 'invited');
