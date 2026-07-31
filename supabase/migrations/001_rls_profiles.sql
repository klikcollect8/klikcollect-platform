-- RLS Policies for profiles table
-- 
-- These policies ensure:
-- 1. Users can read their own profile (for role checks)
-- 2. Users can update their own profile (except role field)
-- 3. Only head_admin can update roles
-- 4. Service role is NOT needed for routine role checks

-- Enable RLS on profiles table (if not already enabled)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to recreate with correct logic)
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Head admin can update any profile role" ON profiles;

-- Policy 1: Users can SELECT their own profile row
-- This allows authenticated users to read their own profile for role checks
-- Uses auth.uid() which is secure - cannot be spoofed by client
CREATE POLICY "Users can view own profile"
  ON profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Policy 2: Users can UPDATE their own profile (except role)
-- Allows users to update their own information (email, status, etc.)
-- Role updates are handled separately by head_admin only
CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id AND
    -- Prevent users from updating their own role
    (role IS NULL OR role = (SELECT role FROM profiles WHERE id = auth.uid()))
  );

-- Policy 3: Users can INSERT their own profile
-- This is typically handled by a trigger, but we allow it for safety
CREATE POLICY "Users can insert own profile"
  ON profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Policy 4: Only head_admin can update roles
-- Create/update function to check if current user is head_admin
CREATE OR REPLACE FUNCTION is_head_admin()
RETURNS BOOLEAN 
LANGUAGE sql 
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'head_admin'
  );
$$;

-- Policy for head_admin to update any profile's role
CREATE POLICY "Head admin can update any profile role"
  ON profiles
  FOR UPDATE
  USING (is_head_admin())
  WITH CHECK (is_head_admin());

-- Note: The existing "Admins can read all profiles" policy can stay
-- as it's useful for admin operations, but our code uses the "Users can view own profile"
-- policy for routine role checks (which is more secure)

-- Indexes for performance on role lookups
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_id ON profiles(id);
