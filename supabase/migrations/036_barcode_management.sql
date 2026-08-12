-- Phase B: additional barcodes + barcode assignment history

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS additional_barcodes jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.products.additional_barcodes IS
  'Secondary barcodes/GTINs that resolve to this canonical product; primary remains products.barcode.';

CREATE TABLE IF NOT EXISTS public.product_barcode_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_public_id text NOT NULL,
  barcode text NOT NULL,
  role text NOT NULL DEFAULT 'primary'
    CHECK (role = ANY (ARRAY['primary'::text, 'additional'::text, 'gtin'::text, 'cleared'::text])),
  action text NOT NULL DEFAULT 'assigned'
    CHECK (action = ANY (ARRAY[
      'assigned'::text,
      'promoted'::text,
      'demoted'::text,
      'removed'::text,
      'merged'::text
    ])),
  actor_clerk_user_id text,
  actor_email text,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS product_barcode_history_product_idx
  ON public.product_barcode_history (product_public_id, created_at DESC);

CREATE INDEX IF NOT EXISTS product_barcode_history_barcode_idx
  ON public.product_barcode_history (barcode, created_at DESC);

ALTER TABLE public.product_barcode_history ENABLE ROW LEVEL SECURITY;
