-- Nested category taxonomy: parent_id + product_categories junction

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.categories(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS categories_parent_id_idx ON public.categories(parent_id);

CREATE TABLE IF NOT EXISTS public.product_categories (
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (product_id, category_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS product_categories_one_primary
  ON public.product_categories(product_id)
  WHERE is_primary;

CREATE INDEX IF NOT EXISTS product_categories_category_id_idx
  ON public.product_categories(category_id);

-- Backfill junction from denormalized products.category_id
INSERT INTO public.product_categories (product_id, category_id, is_primary)
SELECT p.id, p.category_id, true
FROM public.products p
WHERE p.category_id IS NOT NULL
ON CONFLICT (product_id, category_id) DO UPDATE
SET is_primary = EXCLUDED.is_primary;
