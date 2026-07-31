-- Phase A→C: Catalogue + orders single-truth bridge off local `.data`.
-- M1 still reads/writes `.data/vendor-catalogue.json` + local order stores.
-- This migration prepares Postgres tables/columns for the flip when service-role sync is enabled.

-- Ensure products can carry vendor tenancy for Commerce OS writes.
alter table if exists public.products
  add column if not exists vendor_id text,
  add column if not exists neighbourhood text,
  add column if not exists money_minor bigint,
  add column if not exists source text default 'legacy';

create index if not exists products_vendor_id_idx on public.products (vendor_id);

-- Optional staging table for local→cloud catalogue sync jobs.
create table if not exists public.catalogue_sync_jobs (
  id uuid primary key default gen_random_uuid(),
  vendor_id text,
  status text not null default 'pending'
    check (status in ('pending', 'running', 'succeeded', 'failed')),
  product_count integer not null default 0,
  error text,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

comment on table public.catalogue_sync_jobs is
  'Tracks migration batches from .data vendor-catalogue into public.products.';

-- Orders: attach clerk customer id for account APIs (alongside email).
alter table if exists public.orders
  add column if not exists clerk_user_id text,
  add column if not exists vendor_id text;

create index if not exists orders_clerk_user_id_idx on public.orders (clerk_user_id);
create index if not exists orders_vendor_id_idx on public.orders (vendor_id);
