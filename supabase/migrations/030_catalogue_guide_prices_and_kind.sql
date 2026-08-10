-- Product kind + advisory guide price band for admin catalogue registration.
-- Vendors still set their own offer price/stock; these guide prices are advisory.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS product_kind text NOT NULL DEFAULT 'branded'
    CHECK (product_kind = ANY (ARRAY[
      'branded'::text,
      'fresh_weight'::text,
      'packaged_grocery'::text,
      'variable_bulk'::text
    ])),
  ADD COLUMN IF NOT EXISTS sale_unit text
    CHECK (sale_unit IS NULL OR sale_unit = ANY (ARRAY[
      'each'::text,
      'kg'::text,
      'g'::text,
      'l'::text,
      'pack'::text
    ])),
  ADD COLUMN IF NOT EXISTS guide_price_min_minor bigint,
  ADD COLUMN IF NOT EXISTS guide_price_avg_minor bigint,
  ADD COLUMN IF NOT EXISTS guide_price_max_minor bigint;

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_guide_price_band_chk;

ALTER TABLE public.products
  ADD CONSTRAINT products_guide_price_band_chk
  CHECK (
    guide_price_min_minor IS NULL
    OR guide_price_avg_minor IS NULL
    OR guide_price_max_minor IS NULL
    OR (
      guide_price_min_minor >= 0
      AND guide_price_avg_minor >= 0
      AND guide_price_max_minor >= 0
      AND guide_price_min_minor <= guide_price_avg_minor
      AND guide_price_avg_minor <= guide_price_max_minor
    )
  );

CREATE INDEX IF NOT EXISTS products_kind_idx
  ON public.products (product_kind)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS products_guide_price_avg_idx
  ON public.products (guide_price_avg_minor)
  WHERE deleted_at IS NULL AND guide_price_avg_minor IS NOT NULL;
