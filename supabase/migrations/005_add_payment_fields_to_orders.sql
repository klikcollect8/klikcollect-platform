-- Add payment-related columns to orders table for Paystack integration
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS payment_reference TEXT,
  ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'card',
  ADD COLUMN IF NOT EXISTS payment_channel TEXT,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

-- Add an index on payment_reference for quick lookups during verification
CREATE INDEX IF NOT EXISTS idx_orders_payment_reference ON orders (payment_reference);

-- Add a check constraint for valid payment statuses
ALTER TABLE orders
  ADD CONSTRAINT chk_payment_status
  CHECK (payment_status IN ('pending', 'paid', 'failed', 'abandoned'));
