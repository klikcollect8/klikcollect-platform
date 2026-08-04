-- Vendor Commerce Slice (Phase 1)
-- Tenant key = vendor_public_id (+ optional store_id / store public_id).

-- ---------------------------------------------------------------------------
-- Vendor storefront profile (branding beyond vendors.name/logo)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vendor_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_public_id text NOT NULL UNIQUE,
  display_name text,
  description text,
  story text,
  logo_url text,
  banner_url text,
  theme_color text,
  contact_email text,
  contact_phone text,
  whatsapp text,
  socials jsonb NOT NULL DEFAULT '{}'::jsonb,
  policies jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vendor_profiles_vendor_idx
  ON public.vendor_profiles (vendor_public_id);

ALTER TABLE public.vendor_profiles ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Store hours (per branch + holiday overrides)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.store_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_public_id text NOT NULL,
  vendor_public_id text NOT NULL,
  day_of_week smallint, -- 0=Sun .. 6=Sat; null for holiday override
  open_time time,
  close_time time,
  is_closed boolean NOT NULL DEFAULT false,
  holiday_date date,
  holiday_label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS store_hours_store_idx
  ON public.store_hours (store_public_id);
CREATE INDEX IF NOT EXISTS store_hours_vendor_idx
  ON public.store_hours (vendor_public_id);

ALTER TABLE public.store_hours ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Product variants — extend existing table
-- ---------------------------------------------------------------------------
ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS product_public_id text,
  ADD COLUMN IF NOT EXISTS vendor_public_id text,
  ADD COLUMN IF NOT EXISTS options jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS barcode text,
  ADD COLUMN IF NOT EXISTS sale_price_minor bigint,
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

-- ---------------------------------------------------------------------------
-- Inventory movements — UI-facing reason
-- ---------------------------------------------------------------------------
ALTER TABLE public.inventory_movements
  ADD COLUMN IF NOT EXISTS reason text,
  ADD COLUMN IF NOT EXISTS store_public_id text,
  ADD COLUMN IF NOT EXISTS variant_public_id text;

CREATE INDEX IF NOT EXISTS inventory_movements_vendor_created_idx
  ON public.inventory_movements (vendor_public_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Vendor-scoped CRM customers
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vendor_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id text NOT NULL UNIQUE,
  vendor_public_id text NOT NULL,
  email text,
  phone text,
  name text,
  notes text,
  tags text[] NOT NULL DEFAULT '{}',
  loyalty_points integer NOT NULL DEFAULT 0,
  store_credit_minor bigint NOT NULL DEFAULT 0,
  order_count integer NOT NULL DEFAULT 0,
  total_spent_minor bigint NOT NULL DEFAULT 0,
  last_order_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS vendor_customers_vendor_email_uidx
  ON public.vendor_customers (vendor_public_id, lower(email))
  WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS vendor_customers_vendor_phone_uidx
  ON public.vendor_customers (vendor_public_id, phone)
  WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS vendor_customers_vendor_idx
  ON public.vendor_customers (vendor_public_id);

ALTER TABLE public.vendor_customers ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Append-only vendor activity feed
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vendor_activity_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  vendor_public_id text NOT NULL,
  kind text NOT NULL, -- order | payment | driver | review | stock | pos | system
  title text NOT NULL,
  body text,
  ref_type text,
  ref_id text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vendor_activity_events_vendor_created_idx
  ON public.vendor_activity_events (vendor_public_id, created_at DESC);

ALTER TABLE public.vendor_activity_events ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Stores — manager + POS metadata (GPS already exists)
-- ---------------------------------------------------------------------------
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS manager_clerk_id text,
  ADD COLUMN IF NOT EXISTS pos_meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
