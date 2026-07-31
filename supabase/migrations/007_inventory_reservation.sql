-- Migration: Inventory Reservation System
-- Handles temporary stock holds during checkout

-- Step 1: Create the inventory_reservations table
CREATE TABLE IF NOT EXISTS inventory_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  order_reference TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '15 minutes'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Step 2: Create an index for expired reservations
CREATE INDEX IF NOT EXISTS idx_inventory_reservations_expires_at ON inventory_reservations(expires_at);

-- Step 3: Function to get available stock (real stock - active reservations)
CREATE OR REPLACE FUNCTION get_available_stock(p_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  total_stock INTEGER;
  reserved_stock INTEGER;
BEGIN
  -- Get current stock
  SELECT stock INTO total_stock FROM products WHERE id = p_id;

  -- Get active reservations
  SELECT coalesce(sum(quantity), 0) INTO reserved_stock
  FROM inventory_reservations
  WHERE product_id = p_id AND expires_at > now();

  RETURN total_stock - reserved_stock;
END;
$$;

-- Step 4: Procedure to clean up expired reservations
CREATE OR REPLACE FUNCTION cleanup_expired_reservations()
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM inventory_reservations WHERE expires_at < now();
END;
$$;
