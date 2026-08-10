-- Vendor content reports → platform moderation queue

CREATE TABLE IF NOT EXISTS content_reports (
  id BIGSERIAL PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  vendor_public_id TEXT NOT NULL,
  actor_clerk_id TEXT NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('review', 'question')),
  target_id TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT 'other',
  message TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_review', 'resolved', 'dismissed')),
  admin_notes TEXT,
  resolved_by_clerk_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_content_reports_status
  ON content_reports (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_content_reports_vendor
  ON content_reports (vendor_public_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_content_reports_target
  ON content_reports (target_type, target_id);
