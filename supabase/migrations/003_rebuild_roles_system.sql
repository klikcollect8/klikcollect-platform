-- Rebuild Roles System - Clean Implementation
-- This migration removes broken policies/triggers and creates a correct, minimal roles system

-- ============================================================================
-- STEP 1: Ensure profiles table schema is correct
-- ============================================================================

-- Ensure role column is NOT NULL with default (if not already)
ALTER TABLE profiles 
  ALTER COLUMN role SET DEFAULT 'customer',
  ALTER COLUMN role SET NOT NULL;

-- Update any NULL roles to 'customer'
UPDATE profiles SET role = 'customer' WHERE role IS NULL;

-- Ensure role constraint is correct
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles 
  ADD CONSTRAINT profiles_role_check 
  CHECK (role IN ('customer', 'editor', 'moderator', 'admin', 'head_admin'));

-- ============================================================================
-- STEP 2: Drop ALL existing broken policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can read all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Head admin can update any profile role" ON profiles;
DROP POLICY IF EXISTS "Head admins can update profiles" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

-- Drop helper functions that might cause circular dependencies
DROP FUNCTION IF EXISTS is_head_admin() CASCADE;
DROP FUNCTION IF EXISTS get_user_role(uuid) CASCADE;

-- ============================================================================
-- STEP 3: Enable RLS (should already be enabled, but ensure it)
-- ============================================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 4: Create minimal, correct RLS policies
-- ============================================================================

-- Policy 1: Authenticated users can SELECT their own profile
-- This is the ONLY way to read roles - via RLS, no service role
CREATE POLICY "users_select_own_profile"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Policy 2: Authenticated users can UPDATE their own profile EXCEPT role
-- Role field is protected - users cannot change their own role
CREATE POLICY "users_update_own_profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id AND
    -- Prevent role changes: new role must equal old role
    role = (SELECT role FROM profiles WHERE id = auth.uid())
  );

-- Policy 3: Authenticated users can INSERT their own profile
-- Backup for trigger (shouldn't be needed, but safety net)
CREATE POLICY "users_insert_own_profile"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Policy 4: Only head_admin can update role for anyone
-- This uses a simple function that checks current user's role
CREATE OR REPLACE FUNCTION check_is_head_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path TO public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'head_admin'
  );
$$;

CREATE POLICY "head_admin_update_roles"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (check_is_head_admin())
  WITH CHECK (check_is_head_admin());

-- ============================================================================
-- STEP 5: Create/update trigger function to auto-create profiles
-- ============================================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    'customer', -- Default role
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING; -- Handle race conditions gracefully
  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger on auth.users INSERT
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- ============================================================================
-- STEP 6: Create indexes for performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_id ON profiles(id);

-- ============================================================================
-- Migration complete
-- ============================================================================
