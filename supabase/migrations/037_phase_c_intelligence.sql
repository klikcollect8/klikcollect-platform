-- Phase C: source registry, discovery confidence, enrichment run log

CREATE TABLE IF NOT EXISTS public.product_source_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id text NOT NULL UNIQUE,
  display_name text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  is_local boolean NOT NULL DEFAULT false,
  priority integer NOT NULL DEFAULT 100,
  health_status text NOT NULL DEFAULT 'unknown'
    CHECK (health_status = ANY (ARRAY[
      'healthy'::text,
      'degraded'::text,
      'down'::text,
      'unknown'::text,
      'disabled'::text
    ])),
  last_ok_at timestamptz,
  last_error_at timestamptz,
  last_error text,
  consecutive_failures integer NOT NULL DEFAULT 0,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.product_source_registry
  (provider_id, display_name, enabled, is_local, priority, health_status)
VALUES
  ('klikcollect', 'KlikCollect', true, true, 10, 'healthy'),
  ('open_food_facts', 'Open Food Facts', true, false, 20, 'unknown'),
  ('open_products_facts', 'Open Products Facts', true, false, 30, 'unknown')
ON CONFLICT (provider_id) DO NOTHING;

ALTER TABLE public.product_discovery_candidates
  ADD COLUMN IF NOT EXISTS confidence_band text
    CHECK (
      confidence_band IS NULL
      OR confidence_band = ANY (ARRAY['high'::text, 'medium'::text, 'low'::text])
    ),
  ADD COLUMN IF NOT EXISTS confidence_score integer;

CREATE INDEX IF NOT EXISTS product_discovery_confidence_idx
  ON public.product_discovery_candidates (status, confidence_band)
  WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS public.catalogue_job_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type text NOT NULL
    CHECK (job_type = ANY (ARRAY[
      'reconcile'::text,
      'enrich'::text,
      'source_health'::text,
      'offline_sync'::text
    ])),
  status text NOT NULL DEFAULT 'running'
    CHECK (status = ANY (ARRAY[
      'running'::text,
      'ok'::text,
      'error'::text,
      'partial'::text
    ])),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  actor_clerk_user_id text
);

CREATE INDEX IF NOT EXISTS catalogue_job_runs_type_idx
  ON public.catalogue_job_runs (job_type, started_at DESC);

ALTER TABLE public.product_source_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalogue_job_runs ENABLE ROW LEVEL SECURITY;
