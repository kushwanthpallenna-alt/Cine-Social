-- ============================================================
-- MIGRATION: Unique username constraint and public profile RLS
-- ============================================================

-- 1. Ensure unique constraint/index on username (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique_idx 
ON public.profiles (LOWER(username)) 
WHERE username IS NOT NULL;

-- 2. Enable RLS and add public SELECT policy on profiles table for logged-out visitors
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read access on profiles" ON public.profiles;
CREATE POLICY "Allow public read access on profiles" 
ON public.profiles 
FOR SELECT 
USING (true);
