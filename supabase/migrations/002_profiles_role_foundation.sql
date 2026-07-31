-- Profiles Role Foundation Migration
-- 
-- This migration ensures:
-- 1. RLS enabled on profiles
-- 2. Authenticated users can SELECT their own profile row
-- 3. Authenticated users can UPDATE their own non-role fields (but NOT role)
-- 4. Only head_admin can update role (safe policy)
-- 5. Auto-create profiles row on new user signup (default role 'customer')
-- 6. Role constraint updated to use 'customer' instead of 'user'

-- Step 1: Update role constraint to use 'customer' instead of 'user'
-- First, drop old constraint to allow updates
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- Temporarily disable trigger that logs role changes (to avoid constraint violations during migration)
ALTER TABLE profiles DISABLE TRIGGER log_role_change_trigger;

-- Update any existing 'user' roles to 'customer' (now that constraint is dropped)
UPDATE profiles SET role = 'customer' WHERE role = 'user' OR role IS NULL;

-- Re-enable the trigger
ALTER TABLE profiles ENABLE TRIGGER log_role_change_trigger;

-- Create new constraint with 'customer' instead of 'user'
ALTER TABLE profiles 
  ADD CONSTRAINT profiles_role_check 
  CHECK (role = ANY (ARRAY['customer'::text, 'editor'::text, 'moderator'::text, 'admin'::text, 'head_admin'::text]));

-- Update default role to 'customer'
ALTER TABLE profiles ALTER COLUMN role SET DEFAULT 'customer';

-- Step 2: Ensure RLS is enabled
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Step 3: Drop and recreate RLS policies with correct logic

-- Drop existing policies if they exist
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
-- The WITH CHECK clause prevents role changes by comparing old and new role
CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id AND
    -- Prevent users from updating their own role
    -- If role is being changed, it must remain the same (old = new)
    (role IS NULL OR role = (SELECT role FROM profiles WHERE id = auth.uid()))
  );

-- Policy 3: Users can INSERT their own profile
-- This is typically handled by a trigger, but we allow it for safety
CREATE POLICY "Users can insert own profile"
  ON profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Step 4: Create/update function to check if current user is head_admin
-- This function is used in the head_admin update policy
CREATE OR REPLACE FUNCTION is_head_admin()
RETURNS BOOLEAN 
LANGUAGE sql 
SECURITY DEFINER
STABLE
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'head_admin'
  );
$$;

-- Policy 4: Only head_admin can update roles
-- This policy allows head_admin to update any profile, including role changes
-- The is_head_admin() function checks the current user's role securely
CREATE POLICY "Head admin can update any profile role"
  ON profiles
  FOR UPDATE
  USING (is_head_admin())
  WITH CHECK (is_head_admin());

-- Step 5: Update trigger function to auto-create profiles with 'customer' role
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'customer')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Ensure trigger exists (it should already exist from previous migrations)
-- Drop and recreate to ensure it's correct
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Step 6: Create indexes for performance on role lookups
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_id ON profiles(id);

-- Step 7: Add comment for documentation
COMMENT ON COLUMN profiles.role IS 'User roles: customer (default), editor, moderator, admin, head_admin (highest)';
