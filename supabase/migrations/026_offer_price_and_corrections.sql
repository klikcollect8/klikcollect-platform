-- Offer price history + catalogue correction requests (vendor → platform)

CREATE TABLE IF NOT EXISTS offer_price_changes (
  id BIGSERIAL PRIMARY KEY,
  offer_id UUID NOT NULL REFERENCES product_offers(id) ON DELETE CASCADE,
  offer_public_id TEXT NOT NULL,
  vendor_public_id TEXT NOT NULL,
  actor_clerk_id TEXT NOT NULL,
  old_price_minor INTEGER NOT NULL,
  new_price_minor INTEGER NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_offer_price_changes_offer
  ON offer_price_changes (offer_public_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_offer_price_changes_vendor
  ON offer_price_changes (vendor_public_id, created_at DESC);

CREATE TABLE IF NOT EXISTS catalogue_correction_requests (
  id BIGSERIAL PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  product_public_id TEXT NOT NULL,
  offer_public_id TEXT,
  vendor_public_id TEXT NOT NULL,
  actor_clerk_id TEXT NOT NULL,
  fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  message TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_review', 'resolved', 'rejected')),
  admin_notes TEXT,
  resolved_by_clerk_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_catalogue_corrections_status
  ON catalogue_correction_requests (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_catalogue_corrections_vendor
  ON catalogue_correction_requests (vendor_public_id, created_at DESC);
