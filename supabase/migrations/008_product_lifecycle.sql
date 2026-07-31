-- Migration: Product Lifecycle Status
-- Adds status field to products for administrative workflows

-- Step 1: Create the status type
DO $$ BEGIN
    CREATE TYPE product_status AS ENUM ('draft', 'pending_review', 'published', 'archived');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Step 2: Add status column to products
ALTER TABLE products
ADD COLUMN IF NOT EXISTS status product_status DEFAULT 'published';

-- Step 3: Update existing products to published
UPDATE products SET status = 'published' WHERE status IS NULL;

-- Step 4: Ensure public can only see published products (RLS)
-- First enable RLS if not enabled
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Drop existing select policy if any
DROP POLICY IF EXISTS "Public can view products" ON products;

-- Create new select policy
CREATE POLICY "Public can view published products"
ON products FOR SELECT
TO anon, authenticated
USING (status = 'published');

-- Allow admins to see all products
DROP POLICY IF EXISTS "Admins can view all products" ON products;
CREATE POLICY "Admins can view all products"
ON products FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'head_admin', 'editor', 'moderator')
  )
);
