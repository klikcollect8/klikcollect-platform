-- Product discovery queue: external candidates not yet in KlikCollect catalogue.

CREATE TABLE IF NOT EXISTS public.product_discovery_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id text NOT NULL UNIQUE DEFAULT ('disc_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 16)),
  barcode text,
  name text,
  brand text,
  provider text NOT NULL,
  external_product_id text,
  source text NOT NULL DEFAULT 'scan'
    CHECK (source = ANY (ARRAY['scan'::text, 'similar'::text, 'search'::text])),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status = ANY (ARRAY['pending'::text, 'imported'::text, 'dismissed'::text])),
  resolved_product_public_id text,
  similarity_seed_barcode text,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS product_discovery_candidates_barcode_uidx
  ON public.product_discovery_candidates (barcode)
  WHERE barcode IS NOT NULL;

CREATE INDEX IF NOT EXISTS product_discovery_candidates_status_seen_idx
  ON public.product_discovery_candidates (status, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS product_discovery_candidates_name_idx
  ON public.product_discovery_candidates (name);

CREATE INDEX IF NOT EXISTS product_discovery_candidates_seed_idx
  ON public.product_discovery_candidates (similarity_seed_barcode)
  WHERE similarity_seed_barcode IS NOT NULL;

ALTER TABLE public.product_discovery_candidates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS product_discovery_candidates_service ON public.product_discovery_candidates;
CREATE POLICY product_discovery_candidates_service
  ON public.product_discovery_candidates
  FOR ALL
  USING (true)
  WITH CHECK (true);
