-- Eats Uber-like polish: driver profiles, ratings, offers, customer arrived, realtime.

create table if not exists public.driver_profiles (
  clerk_user_id text primary key,
  display_name text,
  phone text,
  photo_url text,
  vehicle_label text,
  updated_at timestamptz not null default now()
);

alter table public.driver_profiles enable row level security;

create table if not exists public.delivery_ratings (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique,
  delivery_public_id text not null,
  order_public_id text,
  clerk_user_id text,
  stars smallint not null check (stars between 1 and 5),
  tip_minor bigint not null default 0 check (tip_minor >= 0),
  comment text,
  created_at timestamptz not null default now()
);

create index if not exists delivery_ratings_delivery_idx
  on public.delivery_ratings (delivery_public_id);
create index if not exists delivery_ratings_clerk_idx
  on public.delivery_ratings (clerk_user_id);

alter table public.delivery_ratings enable row level security;

alter table public.deliveries
  add column if not exists customer_arrived_at timestamptz,
  add column if not exists offered_to_clerk_user_id text,
  add column if not exists offer_expires_at timestamptz;

create index if not exists deliveries_offered_idx
  on public.deliveries (offered_to_clerk_user_id)
  where offered_to_clerk_user_id is not null;

-- Realtime for live track (ignore if already members)
do $$
begin
  begin
    alter publication supabase_realtime add table public.deliveries;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.driver_locations;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.orders;
  exception when duplicate_object then null;
  end;
end $$;
