-- Cart lines were duplicating because UNIQUE (cart_id, product_public_id, offer_public_id)
-- does not collapse NULLs in offer_public_id, and the app upsert used .eq(null) which
-- never matches in PostgREST. Merge duplicates, then enforce uniqueness for null-offer rows.

WITH ranked AS (
  SELECT
    id,
    quantity,
    ROW_NUMBER() OVER (
      PARTITION BY cart_id, product_public_id
      ORDER BY updated_at DESC NULLS LAST, id
    ) AS rn,
    SUM(quantity) OVER (
      PARTITION BY cart_id, product_public_id
    ) AS total_qty
  FROM public.cart_items
  WHERE offer_public_id IS NULL
),
updated AS (
  UPDATE public.cart_items ci
  SET quantity = r.total_qty,
      updated_at = NOW()
  FROM ranked r
  WHERE ci.id = r.id
    AND r.rn = 1
    AND ci.quantity IS DISTINCT FROM r.total_qty
  RETURNING ci.id
)
DELETE FROM public.cart_items ci
USING ranked r
WHERE ci.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS cart_items_cart_product_null_offer_uidx
  ON public.cart_items (cart_id, product_public_id)
  WHERE offer_public_id IS NULL;
