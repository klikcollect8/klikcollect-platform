-- Brand enrichment for Product Intelligence (aliases, identity fields)
ALTER TABLE public.brands
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS aliases text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS manufacturer text;

COMMENT ON COLUMN public.brands.aliases IS
  'Alternate spellings used for product matching (e.g. Coke → Coca-Cola).';
