-- Product resolver: external sources, field provenance, provider cache, scan events.
-- Canonical products remain source of truth; external data is candidate/provenance only.

-- ---------------------------------------------------------------------------
-- Link KlikCollect products ↔ external provider records
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_external_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_public_id text NOT NULL,
  provider text NOT NULL,
  external_product_id text,
  barcode text,
  source_url text,
  source_version text,
  last_fetched_at timestamptz,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS product_external_sources_provider_ext_uidx
  ON public.product_external_sources (provider, external_product_id)
  WHERE external_product_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS product_external_sources_provider_barcode_uidx
  ON public.product_external_sources (provider, barcode)
  WHERE barcode IS NOT NULL;

CREATE INDEX IF NOT EXISTS product_external_sources_product_idx
  ON public.product_external_sources (product_public_id);

-- ---------------------------------------------------------------------------
-- Per-field provenance (original external vs normalised / admin override)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_field_provenance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_public_id text NOT NULL,
  field_key text NOT NULL,
  provider text NOT NULL,
  external_product_id text,
  barcode text,
  original_value jsonb,
  normalised_value jsonb,
  confidence text NOT NULL DEFAULT 'medium'
    CHECK (confidence = ANY (ARRAY['high'::text, 'medium'::text, 'low'::text, 'unknown'::text])),
  admin_override boolean NOT NULL DEFAULT false,
  approved_by text,
  approved_at timestamptz,
  retrieved_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS product_field_provenance_product_field_provider_uidx
  ON public.product_field_provenance (product_public_id, field_key, provider);

CREATE INDEX IF NOT EXISTS product_field_provenance_product_idx
  ON public.product_field_provenance (product_public_id);

-- ---------------------------------------------------------------------------
-- Short-lived provider response cache (not a permanent catalogue copy)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.provider_lookup_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  barcode text NOT NULL,
  status text NOT NULL
    CHECK (status = ANY (ARRAY['hit'::text, 'miss'::text, 'error'::text])),
  payload jsonb,
  error_message text,
  retrieved_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS provider_lookup_cache_provider_barcode_uidx
  ON public.provider_lookup_cache (provider, barcode);

CREATE INDEX IF NOT EXISTS provider_lookup_cache_expires_idx
  ON public.provider_lookup_cache (expires_at);

-- ---------------------------------------------------------------------------
-- Scan / resolve history for debugging and audit
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.barcode_scan_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_clerk_user_id text,
  actor_email text,
  barcode text NOT NULL,
  format text,
  resolution_status text NOT NULL
    CHECK (resolution_status = ANY (ARRAY[
      'local_found'::text,
      'external_found'::text,
      'partial'::text,
      'not_found'::text,
      'invalid'::text,
      'error'::text,
      'committed'::text,
      'duplicate_blocked'::text
    ])),
  resolved_product_public_id text,
  provider_results jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS barcode_scan_events_barcode_idx
  ON public.barcode_scan_events (barcode, created_at DESC);

CREATE INDEX IF NOT EXISTS barcode_scan_events_actor_idx
  ON public.barcode_scan_events (actor_clerk_user_id, created_at DESC);

ALTER TABLE public.product_external_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_field_provenance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_lookup_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.barcode_scan_events ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.product_external_sources IS
  'Maps canonical catalogue products to external provider IDs; never auto-overwrite approved fields.';
COMMENT ON TABLE public.product_field_provenance IS
  'Where each imported field came from; original_value retained after admin edits.';
COMMENT ON TABLE public.provider_lookup_cache IS
  'TTL cache for external barcode lookups; subject to provider licence terms.';
COMMENT ON TABLE public.barcode_scan_events IS
  'Resolver/scan history for debugging why a barcode resolved to a product.';
