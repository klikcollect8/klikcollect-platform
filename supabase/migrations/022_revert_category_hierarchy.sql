-- Undo nested category taxonomy (product_categories + parent_id)

DROP TABLE IF EXISTS public.product_categories;

DROP INDEX IF EXISTS public.categories_parent_id_idx;

ALTER TABLE public.categories
  DROP COLUMN IF EXISTS parent_id;
