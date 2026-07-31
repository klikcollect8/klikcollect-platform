-- Backfill Missing Profiles
-- Creates profiles rows for any auth.users that don't have a profile

-- Insert profiles for any auth.users missing from profiles table
INSERT INTO public.profiles (id, email, role, created_at, updated_at)
SELECT 
  u.id,
  u.email,
  'customer'::text AS role, -- Default role for existing users
  COALESCE(u.created_at, NOW()) AS created_at,
  NOW() AS updated_at
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- Verify: Count how many profiles were created
-- SELECT COUNT(*) FROM profiles WHERE created_at > NOW() - INTERVAL '1 minute';
