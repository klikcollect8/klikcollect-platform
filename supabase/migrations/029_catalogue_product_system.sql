-- Canonical catalogue system: brands, media, product enrichment,
-- platform-owned variants, offer↔, audit log.

-- ---------------------------------------------------------------------------
-- Brands
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id text NOT NULL UNIQUE,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'active'
    CHECK (status = ANY (ARRAY['active'::text, 'archived'::text])),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS brands_name_idx ON public.brands (lower(name));

-- ---------------------------------------------------------------------------
-- Products — platform enrichment columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS brand_id uuid REFERENCES public.brands(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS manufacturer text,
  ADD COLUMN IF NOT EXISTS mpn text,
  ADD COLUMN IF NOT EXISTS sku text,
  ADD COLUMN IF NOT EXISTS gtin text,
  ADD COLUMN IF NOT EXISTS barcode text,
  ADD COLUMN IF NOT EXISTS seo_title text,
  ADD COLUMN IF NOT EXISTS seo_description text,
  ADD COLUMN IF NOT EXISTS weight_g integer,
  ADD COLUMN IF NOT EXISTS dims jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS specs jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS perishability text
    CHECK (perishability IS NULL OR perishability = ANY (ARRAY[
      'perishable'::text, 'non_perishable'::text, 'refrigerated'::text, 'frozen'::text
    ])),
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS featured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS search_visible boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS related_product_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS option_axes jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS products_sku_unique_idx
  ON public.products (sku)
  WHERE sku IS NOT NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS products_gtin_unique_idx
  ON public.products (gtin)
  WHERE gtin IS NOT NULL AND deleted_at IS NULL AND status <> 'archived';

CREATE UNIQUE INDEX IF NOT EXISTS products_barcode_unique_idx
  ON public.products (barcode)
  WHERE barcode IS NOT NULL AND deleted_at IS NULL AND status <> 'archived';

CREATE INDEX IF NOT EXISTS products_brand_id_idx
  ON public.products (brand_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS products_status_updated_idx
  ON public.products (status, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS products_name_lower_idx
  ON public.products (lower(name))
  WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- Categories hierarchy (optional parent)
-- ---------------------------------------------------------------------------
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS categories_parent_idx
  ON public.categories (parent_id)
  WHERE parent_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Product media
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id text NOT NULL UNIQUE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  product_public_id text NOT NULL,
  variant_public_id text,
  role text NOT NULL DEFAULT 'gallery'
    CHECK (role = ANY (ARRAY['main'::text, 'gallery'::text, 'variant'::text])),
  url text NOT NULL,
  original_url text,
  width integer,
  height integer,
  sort_order integer NOT NULL DEFAULT 0,
  alt_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS product_media_product_idx
  ON public.product_media (product_public_id, sort_order)
  WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- Product variants — canonical (vendor optional)
-- ---------------------------------------------------------------------------
ALTER TABLE public.product_variants
  ALTER COLUMN vendor_id DROP NOT NULL;

ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'
    CHECK (status = ANY (ARRAY['active'::text, 'archived'::text, 'draft'::text]));

ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS gtin text;

ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS product_variants_product_sku_idx
  ON public.product_variants (product_id, sku)
  WHERE sku IS NOT NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS product_variants_barcode_active_idx
  ON public.product_variants (barcode)
  WHERE barcode IS NOT NULL AND deleted_at IS NULL AND status = 'active';

CREATE INDEX IF NOT EXISTS product_variants_product_id_idx
  ON public.product_variants (product_id)
  WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- Product offers — variant-aware uniqueness
-- ---------------------------------------------------------------------------
ALTER TABLE public.product_offers
  ADD COLUMN IF NOT EXISTS variant_public_id text;

ALTER TABLE public.product_offers
  ADD COLUMN IF NOT EXISTS variant_key text
    GENERATED ALWAYS AS (COALESCE(variant_public_id, '__default__')) STORED;

ALTER TABLE public.product_offers
  DROP CONSTRAINT IF EXISTS product_offers_product_id_vendor_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS product_offers_product_vendor_variant_uidx
  ON public.product_offers (product_id, vendor_id, variant_key)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS product_offers_variant_idx
  ON public.product_offers (variant_public_id)
  WHERE variant_public_id IS NOT NULL AND deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- Product relations (related / accessories / alternatives)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_relations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_public_id text NOT NULL,
  related_public_id text NOT NULL,
  relation_type text NOT NULL DEFAULT 'related'
    CHECK (relation_type = ANY (ARRAY[
      'related'::text, 'frequently_bought'::text, 'alternative'::text, 'accessory'::text
    ])),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_public_id, related_public_id, relation_type)
);

-- ---------------------------------------------------------------------------
-- Product audit log
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_public_id text NOT NULL,
  actor_clerk_user_id text,
  actor_email text,
  action text NOT NULL,
  before_state jsonb,
  after_state jsonb,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS product_audit_log_product_idx
  ON public.product_audit_log (product_public_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Slug redirects (published URL changes)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_slug_redirects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_slug text NOT NULL UNIQUE,
  to_product_public_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- RLS (service role bypasses; enable for defense in depth)
-- ---------------------------------------------------------------------------
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_relations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_slug_redirects ENABLE ROW LEVEL SECURITY;
