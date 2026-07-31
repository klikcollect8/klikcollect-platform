-- Phase A: Clerk identity mapping + vendor staff memberships
-- Clerk authenticates; KlikCollect authorizes via memberships (Ch 21).

create table if not exists public.clerk_identities (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text not null unique,
  email text,
  user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists clerk_identities_email_idx on public.clerk_identities (email);

create table if not exists public.staff_memberships (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text not null,
  vendor_id text not null,
  role text not null check (role in ('vendor_owner', 'vendor_staff')),
  status text not null default 'active' check (status in ('active', 'invited', 'revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clerk_user_id, vendor_id)
);

create index if not exists staff_memberships_vendor_idx on public.staff_memberships (vendor_id);
create index if not exists staff_memberships_clerk_idx on public.staff_memberships (clerk_user_id);

alter table public.clerk_identities enable row level security;
alter table public.staff_memberships enable row level security;

-- Service role / admin clients manage these until full RLS policies ship.
comment on table public.clerk_identities is 'Maps Clerk user IDs to optional legacy auth.users rows.';
comment on table public.staff_memberships is 'Vendor-scoped membership for Commerce OS authorization.';
