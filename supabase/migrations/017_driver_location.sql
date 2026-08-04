-- Live driver presence for Uber-like /driver map + tracking.

create table if not exists public.driver_locations (
  clerk_user_id text primary key,
  lat double precision not null,
  lng double precision not null,
  heading double precision,
  online boolean not null default false,
  accuracy_m double precision,
  active_delivery_id uuid references public.deliveries (id) on delete set null,
  updated_at timestamptz not null default now()
);

create index if not exists driver_locations_online_idx
  on public.driver_locations (online, updated_at desc);

alter table public.driver_locations enable row level security;

comment on table public.driver_locations is
  'Latest GPS ping + online state for delivery drivers. Service role writes from API.';
