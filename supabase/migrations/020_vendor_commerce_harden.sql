-- Harden vendor commerce schema for fresh installs + missing columns.

CREATE TABLE IF NOT EXISTS public.product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id text NOT NULL UNIQUE,
  product_id uuid NOT NULL,
  vendor_id uuid NOT NULL,
  product_public_id text,
  vendor_public_id text,
  sku text,
  title text NOT NULL DEFAULT 'Default',
  options jsonb NOT NULL DEFAULT '{}'::jsonb,
  barcode text,
  price_minor bigint NOT NULL DEFAULT 0,
  sale_price_minor bigint,
  compare_at_minor bigint,
  wholesale_price_minor bigint,
  currency_code char(3) NOT NULL DEFAULT 'KES',
  on_hand integer NOT NULL DEFAULT 0,
  reserved integer NOT NULL DEFAULT 0,
  vat_class text DEFAULT 'standard',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS product_public_id text,
  ADD COLUMN IF NOT EXISTS vendor_public_id text,
  ADD COLUMN IF NOT EXISTS options jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS barcode text,
  ADD COLUMN IF NOT EXISTS sale_price_minor bigint,
  ADD COLUMN IF NOT EXISTS compare_at_minor bigint,
  ADD COLUMN IF NOT EXISTS wholesale_price_minor bigint,
  ADD COLUMN IF NOT EXISTS on_hand integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reserved integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vat_class text DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS product_variants_product_public_idx
  ON public.product_variants (product_public_id)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS product_variants_vendor_public_idx
  ON public.product_variants (vendor_public_id)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS product_variants_barcode_idx
  ON public.product_variants (barcode)
  WHERE barcode IS NOT NULL AND deleted_at IS NULL;

ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

-- Optional vendor key on receipts for tenant-scoped wallet queries.
ALTER TABLE public.payment_receipts
  ADD COLUMN IF NOT EXISTS vendor_public_id text;

CREATE INDEX IF NOT EXISTS payment_receipts_vendor_idx
  ON public.payment_receipts (vendor_public_id);

-- Allow draft listings (was published|archived only).
ALTER TABLE public.product_offers DROP CONSTRAINT IF EXISTS product_offers_status_check;
ALTER TABLE public.product_offers
  ADD CONSTRAINT product_offers_status_check
  CHECK (status = ANY (ARRAY['published'::text, 'draft'::text, 'archived'::text]));
