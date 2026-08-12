-- Location system: saved locations, correction intelligence,
-- order delivery points, vendor branch verification.
--
-- Access pattern matches other operational tables: RLS enabled with no
-- policies — all reads/writes go through server API routes (service role)
-- which enforce Clerk auth + ownership.

-- 1) DB-backed saved locations (cross-device; localStorage is the
--    signed-out fallback). Delivery pin (delivery_lat/lng) is authoritative;
--    address_lat/lng preserves the provider geocode separately so pin
--    corrections never overwrite the canonical provider location.
CREATE TABLE IF NOT EXISTS public.user_saved_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id text NOT NULL,
  name text NOT NULL DEFAULT 'Saved location',
  label text NOT NULL DEFAULT 'other'
    CHECK (label = ANY (ARRAY['home'::text, 'work'::text, 'other'::text])),
  -- Authoritative delivery point
  delivery_lat double precision NOT NULL,
  delivery_lng double precision NOT NULL,
  -- Provider-resolved geocode (kept separately from the pin)
  address_lat double precision,
  address_lng double precision,
  formatted_address text,
  address_line1 text,
  address_line2 text,
  street text,
  neighbourhood text,
  estate text,
  building text,
  floor text,
  unit text,
  landmark text,
  instructions text,
  city text,
  county text,
  country text NOT NULL DEFAULT 'KE',
  postal_code text,
  place_id text,
  source text NOT NULL DEFAULT 'unknown'
    CHECK (source = ANY (ARRAY[
      'mapbox'::text, 'gps'::text, 'manual'::text, 'seed'::text, 'unknown'::text
    ])),
  confidence text NOT NULL DEFAULT 'manual'
    CHECK (confidence = ANY (ARRAY[
      'high'::text, 'medium'::text, 'low'::text,
      'user_pinned'::text, 'gps_verified'::text,
      'provider_resolved'::text, 'manual'::text
    ])),
  verification text NOT NULL DEFAULT 'unverified'
    CHECK (verification = ANY (ARRAY[
      'unverified'::text, 'user_pinned'::text,
      'gps_verified'::text, 'admin_verified'::text
    ])),
  is_default boolean NOT NULL DEFAULT false,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_saved_locations_user_idx
  ON public.user_saved_locations (clerk_user_id, last_used_at DESC NULLS LAST);

-- 2) Location corrections — append-only signal log. When a user moves the
--    pin away from a provider geocode we record BOTH points; the provider's
--    canonical location is never silently overwritten.
CREATE TABLE IF NOT EXISTS public.location_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  context text NOT NULL
    CHECK (context = ANY (ARRAY[
      'checkout'::text, 'saved_location'::text, 'vendor_branch'::text
    ])),
  provider_lat double precision NOT NULL,
  provider_lng double precision NOT NULL,
  corrected_lat double precision NOT NULL,
  corrected_lng double precision NOT NULL,
  provider_label text,
  place_id text,
  distance_m double precision NOT NULL DEFAULT 0,
  clerk_user_id text,
  store_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS location_corrections_context_idx
  ON public.location_corrections (context, created_at DESC);
CREATE INDEX IF NOT EXISTS location_corrections_place_idx
  ON public.location_corrections (place_id)
  WHERE place_id IS NOT NULL;

-- 3) Orders: persist the authoritative delivery point alongside the
--    descriptive address (previously coordinates were discarded at order
--    creation and only address text survived in notes).
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_lat double precision,
  ADD COLUMN IF NOT EXISTS delivery_lng double precision,
  ADD COLUMN IF NOT EXISTS delivery_landmark text,
  ADD COLUMN IF NOT EXISTS delivery_instructions text,
  ADD COLUMN IF NOT EXISTS delivery_confidence text
    CHECK (
      delivery_confidence IS NULL
      OR delivery_confidence = ANY (ARRAY[
        'high'::text, 'medium'::text, 'low'::text,
        'user_pinned'::text, 'gps_verified'::text,
        'provider_resolved'::text, 'manual'::text
      ])
    ),
  ADD COLUMN IF NOT EXISTS delivery_place_id text;

-- 4) Stores (vendor branches): location verification metadata for the
--    map-based branch editor + admin location quality centre.
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS location_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS location_confidence text
    CHECK (
      location_confidence IS NULL
      OR location_confidence = ANY (ARRAY[
        'high'::text, 'medium'::text, 'low'::text,
        'user_pinned'::text, 'gps_verified'::text,
        'provider_resolved'::text, 'manual'::text
      ])
    ),
  ADD COLUMN IF NOT EXISTS place_id text,
  ADD COLUMN IF NOT EXISTS location_updated_at timestamptz;

ALTER TABLE public.user_saved_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.location_corrections ENABLE ROW LEVEL SECURITY;
